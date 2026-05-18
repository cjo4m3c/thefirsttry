/**
 * grid.js — 把 SVG 畫布網格化，提供 A* 用的 blocked / occupied / proximity 查詢。
 *
 * Grid cell size 來自 constants.js 的 GRID_CELL。constants.js 已確保所有
 * task / lane / column 尺寸都是 GRID_CELL 倍數（cx/cy 也對齊），因此
 * 不再需要 OFFSET — task 邊界永遠落在 cell 邊界上，A* 永遠走 cell 中央。
 *
 * 三個資料層：
 *   1. blocked[]：task 矩形 + 圖外邊界（title/padding）的 cells，不能走
 *   2. occupied[]：之前 A* 算過的 edge 用過的 cells（含 source/target/dir metadata）
 *   3. distMap[]：每個 walkable cell 到最近 blocked cell 的曼哈頓距離
 *      → A* 用此給 proximity penalty，自然 push path 到 corridor 中央
 */

import { GRID_CELL, LAYOUT } from '../constants.js';

export const CELL_SIZE = GRID_CELL;

// Distance-aware OCCUPY 參數（v1.3 + v1.11 S20 不對稱 + v1.12 S22/S23 軸延伸）：
//   Fork 跟 merge 在語意上不對稱：
//     - Fork (同 source 多 outgoing): 出來要散開，避免 labels 重疊
//     - Merge (同 target 多 incoming): 進去要合流，避免接近 target 時各自轉折
//   對稱套同一 SHARE_RADIUS 是設計缺陷，v1.11 S20 拆成兩個常數。
//
// v1.12 S22 進入軸 share-free 延伸（target 側）：
//   只靠 SHARE_RADIUS_TARGET=5 (Manhattan 圓) 不夠 — 同 target 邊在 radius 外
//   被 SHARE_PENALTY=3 推開 1 grid，到 radius 內才合流，產生「進 port 前的小階梯」。
//   修：對 same-target cell，若位於 port 進入軸（perpDist=0）→ 不限距離 share-free。
//   讓所有 incoming 邊早早收斂到 port 軸，最後一段乾乾淨淨進 port。
//
// v1.12 S23 出發軸 share-free 延伸（source 側，對稱 S22）：
//   SHARE_RADIUS_SOURCE=2 圓外被 SHARE_PENALTY=3 推開，多 fork 邊離開 source
//   立刻 1-grid 分流階梯（user 圖一/圖三 case）。
//   修：對 same-source cell，若位於 port 出發軸（perpDist=0）→ 不限距離 share-free。
//   Fork 邊整齊堆疊在 source 軸 trunk，到該轉的位置才分叉（中心由 center bias 拉）。
//   Trade-off：trunk 上 label 會疊，但「整齊出發」視覺優先。
const SHARE_RADIUS_SOURCE = 2;  // fork: trunk 共享範圍小（搭配 S23 軸延伸）
const SHARE_RADIUS_TARGET = 5;  // merge: tail 共享範圍大（搭配 S22 軸延伸）
const SHARE_PENALTY = 3;

// v1.15 Halo (視覺距離 unified §10.5.1)：補上 dim 2 對稱 dim 1 推開範圍。
// markPathOccupied 在每 path cell perpendicular 方向 ±HALO_RADIUS cells 標 halo。
// 異 source/target same/opposite dir halo cells 按距離遞減 penalty，A* 偏 2-3 cells
// 而非 1 cell 緊貼。同 source/target halo 不罰（share-free 不擴大則 fork/merge 退化）。
//   penalty[d=1] = 30  (介於 OCCUPY_SAME_DIR=80 跟 OCCUPY_PERP=8 中間, 強 spread 但不阻擋)
//   penalty[d=2] = 10  (遞減, 接近 perpendicular crossing)
export const HALO_RADIUS = 2;
const HALO_PENALTY_NEAR = 30;  // d=1
const HALO_PENALTY_FAR  = 10;  // d=2

// Port reservation 參數（v1.5 維度 5）：
//   同 port 反向使用（IN+OUT 混用）違反 business-spec §5 規則 1。
//   不是 hard block 而是大 cost 讓 A* 自然避開（仍可選做 fallback）。
const PORT_VIOLATION_PENALTY = 500;

// Coherence 參數（v1.6 維度 6；v1.9 弱化；v1.10 S16 動態權重）：
//   多 incoming 進同 target / 多 outgoing 出同 source 偏好收斂一致 side。
//   anchor 由 v1.8 predictAnchors 預測 / first-wins 補填。
//
//   v1.10 S16 動態權重：依 anchor strength (predictAnchors 投票比例) 縮放：
//     - 壓倒性 majority (5/5 = 1.0): factor=0 → 不罰，異類 edge 自由選自然路徑
//     - 弱 majority (3/5 = 0.6):     factor=0.8 → 中等罰，鼓勵跟隨
//     - 邊際 majority (2/4 = 0.5):   factor=1.0 → 全罰，最強推一致
//     - first-wins (沒預測):         strength=0.5 默認，full penalty
//   解情境 4：end event 集中型 anchor 不再壓倒少數異類 edge。
const COHERENCE_PENALTY = 12;

export class RoutingGrid {
  constructor(positions, svgWidth, svgHeight) {
    this.cellSize = CELL_SIZE;
    this.cols = Math.ceil(svgWidth / this.cellSize) + 2;
    this.rows = Math.ceil(svgHeight / this.cellSize) + 2;
    this.blocked = new Uint8Array(this.cols * this.rows);
    // occupied 用 Map 存 metadata：cell index → { sourceId, targetId, dir }
    // 比 Uint8Array 略慢但能做 source/target-aware penalty。
    this.occupied = new Map();
    this.distMap = null;  // lazy compute on first read
    // Port reservation state (v1.5)：每 task 每 port 的 IN/OUT 使用計數
    // { taskId: { left: { in, out }, right, top, bottom } }
    this.portReservations = {};
    // Coherence state (v1.6 + v1.10 strength)：每 task 的 in/out anchor side + strength
    // { taskId: {
    //     in: 'left'|null, inStrength: 0.5-1.0|0,
    //     out: 'bottom'|null, outStrength: 0.5-1.0|0,
    //   }
    // }
    // strength = 投票多數比例 (predictAnchors 設) 或 0.5 (first-wins 默認)。
    this.coherence = {};
    this.markTasks(positions);
    this.markBoundaries(svgWidth, svgHeight);
  }

  /** 標 task 矩形為障礙物（含元件本體） */
  markTasks(positions) {
    for (const id in positions) {
      const p = positions[id];
      const left   = p.left.x   / this.cellSize;
      const right  = p.right.x  / this.cellSize;
      const top    = p.top.y    / this.cellSize;
      const bottom = p.bottom.y / this.cellSize;
      for (let y = top; y < bottom; y++) {
        for (let x = left; x < right; x++) {
          if (this.inBounds(x, y)) this.blocked[y * this.cols + x] = 1;
        }
      }
    }
  }

  /** 標 SVG 邊界為虛擬障礙物（title bar / lane header / right padding / bottom padding）
   * 這樣 A* 不會把線畫到圖外或穿過 title bar，proximity 計算也更準確。
   */
  markBoundaries(svgWidth, svgHeight) {
    // v1.16 §10.5.1 第 4 種距離：lane 邊界 buffer (情境 4-b)。
    // Title bar 上方 buffer 2 cells、padding 下方 buffer 2 cells，
    // 推開 path → label 不溢出 sticky header 或 padding 區。
    const HEADER_BUFFER_CELLS = 2;
    const FOOTER_BUFFER_CELLS = 2;

    // Title bar + 下方 buffer：rows 0 到 TITLE_H/CELL + HEADER_BUFFER
    const titleRows = LAYOUT.TITLE_H / this.cellSize;
    for (let y = 0; y < titleRows + HEADER_BUFFER_CELLS; y++) {
      for (let x = 0; x < this.cols; x++) {
        this.blocked[y * this.cols + x] = 1;
      }
    }
    // Lane header column：cols 0 到 LANE_HEADER_W/CELL
    const headerCols = LAYOUT.LANE_HEADER_W / this.cellSize;
    for (let y = 0; y < this.rows; y++) {
      for (let x = 0; x < headerCols; x++) {
        this.blocked[y * this.cols + x] = 1;
      }
    }
    // 右側 padding：cols >= (svgWidth - PADDING_RIGHT)/CELL
    const rightStart = Math.floor((svgWidth - LAYOUT.PADDING_RIGHT) / this.cellSize);
    for (let y = 0; y < this.rows; y++) {
      for (let x = rightStart; x < this.cols; x++) {
        this.blocked[y * this.cols + x] = 1;
      }
    }
    // 下側 padding + 上方 buffer
    const bottomStart = Math.floor((svgHeight - LAYOUT.PADDING_BOTTOM) / this.cellSize) - FOOTER_BUFFER_CELLS;
    for (let y = bottomStart; y < this.rows; y++) {
      for (let x = 0; x < this.cols; x++) {
        this.blocked[y * this.cols + x] = 1;
      }
    }
  }

  /** BFS 從所有 blocked cells 同時擴散，給每個 walkable cell 算到最近 blocked 的曼哈頓距離 */
  computeDistanceMap() {
    if (this.distMap) return this.distMap;
    const N = this.cols * this.rows;
    const dist = new Int16Array(N);
    dist.fill(32000);  // ~Infinity
    const queue = [];
    let qHead = 0;
    for (let i = 0; i < N; i++) {
      if (this.blocked[i] === 1) {
        dist[i] = 0;
        queue.push(i);
      }
    }
    while (qHead < queue.length) {
      const idx = queue[qHead++];
      const x = idx % this.cols;
      const y = (idx - x) / this.cols;
      const d = dist[idx];
      // 4-方向擴散
      if (x > 0           && dist[idx - 1]         > d + 1) { dist[idx - 1]         = d + 1; queue.push(idx - 1); }
      if (x < this.cols-1 && dist[idx + 1]         > d + 1) { dist[idx + 1]         = d + 1; queue.push(idx + 1); }
      if (y > 0           && dist[idx - this.cols] > d + 1) { dist[idx - this.cols] = d + 1; queue.push(idx - this.cols); }
      if (y < this.rows-1 && dist[idx + this.cols] > d + 1) { dist[idx + this.cols] = d + 1; queue.push(idx + this.cols); }
    }
    this.distMap = dist;
    return dist;
  }

  /** 取得 cell 到最近 blocked 的距離（0 = 該 cell 自己是 blocked）*/
  proximityDist(x, y) {
    if (!this.inBounds(x, y)) return 0;
    return (this.distMap || this.computeDistanceMap())[y * this.cols + x];
  }

  inBounds(x, y) { return x >= 0 && y >= 0 && x < this.cols && y < this.rows; }
  isBlocked(x, y) { return !this.inBounds(x, y) || this.blocked[y * this.cols + x] === 1; }

  /** Open a task's edge cell so A* can enter/exit through it.
   * 也要清除這個 cell 在 distMap 的影響（重算或標 high distance）。
   * POC：unblock 後重置 distMap（下次讀會重算），少量 unblock 約 5ms 重算。
   */
  unblock(x, y) {
    if (!this.inBounds(x, y)) return;
    if (this.blocked[y * this.cols + x] === 1) {
      this.blocked[y * this.cols + x] = 0;
      this.distMap = null;  // 需要重新算
    }
  }

  /** Mark a cell as occupied by previously routed edge.
   * meta = { sourceId, targetId, dir }  -- 主路徑 cell, haloDist 隱含 0
   */
  markOccupied(x, y, meta) {
    if (this.inBounds(x, y)) this.occupied.set(y * this.cols + x, meta);
  }

  /** v1.15 Halo marker (視覺距離 unified §10.5.1)：補上 dim 2 對稱 dim 1 推開範圍。
   * 在 path cell perpendicular 方向 ±HALO_RADIUS cells 標記 halo cell，
   * 給 getOccupyPenalty 算遞減 penalty 用。
   *
   * meta = { sourceId, targetId, dir, haloDist }  haloDist ∈ [1, HALO_RADIUS]
   *
   * 規則：
   *   - 不覆蓋主路徑 cell (haloDist === undefined 視為 0)
   *   - 若同 cell 已有 halo，保留 haloDist 較小者（更近的 path 優先）
   */
  markHalo(x, y, meta) {
    if (!this.inBounds(x, y)) return;
    const idx = y * this.cols + x;
    const existing = this.occupied.get(idx);
    if (existing) {
      // 主路徑 cell（無 haloDist 欄位）不被 halo 覆蓋
      if (existing.haloDist === undefined) return;
      // 既有 halo 比新的近 → 保留
      if (existing.haloDist <= meta.haloDist) return;
    }
    this.occupied.set(idx, meta);
  }

  /** 取得 occupy 在指定方向下的 penalty（distance-aware v1.3 + v1.12 S22/S23 軸延伸）：
   *
   * 同 source / 同 target 的 share 行為依「離 port 多遠」而定：
   *   - 距離 port ≤ SHARE_RADIUS：共享免費 (trunk/tail，視覺上看起來「從同一個 port 出入」)
   *   - 距離 port > SHARE_RADIUS：spread (SHARE_PENALTY，遠端強迫分流)
   *
   * v1.12 S22 (target 軸延伸)：
   *   位於 target port 進入軸（perpDist=0）的 same-target cell 不限距離 share-free。
   *   解「進 port 前 1-grid 階梯」：incoming 邊提早收斂到 port 軸，最後一段直達。
   *
   * v1.12 S23 (source 軸延伸，對稱)：
   *   位於 source port 出發軸（perpDist=0）的 same-source cell 不限距離 share-free。
   *   解「出發後 1-grid 階梯」：fork 邊整齊堆疊在 source 軸 trunk，到該轉才分叉。
   *
   * 同方向重疊：高 penalty 80（避免平行重疊）
   * 垂直交叉：低 penalty 8（允許交叉）
   *
   * @param {string} [entrySide] — 'left'|'right'|'top'|'bottom'，S22 用來判斷 target 軸方向
   * @param {string} [exitSide]  — 'left'|'right'|'top'|'bottom'，S23 用來判斷 source 軸方向
   */
  getOccupyPenalty(x, y, mySource, myTarget, myDir, startCell, goalCell, entrySide, exitSide) {
    if (!this.inBounds(x, y)) return 0;
    const stored = this.occupied.get(y * this.cols + x);
    if (!stored) return 0;

    // v1.15 Halo cell (視覺距離 unified §10.5.1)：補 dim 2 對稱 dim 1 推開範圍。
    // 同 source/target halo → 0 (share-free 擴大不影響 fork/merge)
    // 異 + same/opposite dir → 遞減 penalty (距離越近罰越多)
    // 異 + perpendicular → 0 (允許交叉)
    if (stored.haloDist !== undefined) {
      if (stored.sourceId === mySource || stored.targetId === myTarget) return 0;
      if (stored.dir === myDir || stored.dir === oppositeDir(myDir)) {
        return stored.haloDist === 1 ? HALO_PENALTY_NEAR : HALO_PENALTY_FAR;
      }
      return 0;
    }

    if (stored.sourceId === mySource) {
      if (startCell) {
        const d = Math.abs(x - startCell.x) + Math.abs(y - startCell.y);
        if (d <= SHARE_RADIUS_SOURCE) return 0;  // 靠近 source port，trunk 共享
        // S23 (v1.12)：source 軸延伸 share-free，對稱 S22。fork 邊堆疊在 source 軸 trunk。
        // 垂直 port (top/bottom)：軸是 x=startCell.x；水平 port (left/right)：軸是 y=startCell.y。
        if (exitSide === 'top' || exitSide === 'bottom') {
          if (x === startCell.x) return 0;
        } else if (exitSide === 'left' || exitSide === 'right') {
          if (y === startCell.y) return 0;
        }
      }
      return SHARE_PENALTY;  // 遠離 source 且偏離軸，spread
    }
    if (stored.targetId === myTarget) {
      if (goalCell) {
        const d = Math.abs(x - goalCell.x) + Math.abs(y - goalCell.y);
        if (d <= SHARE_RADIUS_TARGET) return 0;  // 靠近 target port，tail 合流 (merge 提早共享)
        // S22 (v1.12)：軸延伸 share-free。incoming 邊收斂到 port 軸，避免 1-grid 階梯。
        // 垂直 port (top/bottom)：軸是 x=goalCell.x；水平 port (left/right)：軸是 y=goalCell.y。
        if (entrySide === 'top' || entrySide === 'bottom') {
          if (x === goalCell.x) return 0;
        } else if (entrySide === 'left' || entrySide === 'right') {
          if (y === goalCell.y) return 0;
        }
      }
      return SHARE_PENALTY;
    }
    if (stored.dir === myDir || stored.dir === oppositeDir(myDir)) return 80;  // 同向重疊
    return 8;  // 垂直交叉
  }

  /** Reserve a port for a direction (v1.5).
   *   direction = 'in'  → 該 port 當 incoming entry
   *   direction = 'out' → 該 port 當 outgoing exit
   * 同 port 多 IN / 多 OUT 都允許（merge / fork 共享）；
   * 同 port 反向（IN + OUT 混用）由 getPortConflictPenalty 在 pickBestPath 時收 cost。
   */
  reservePort(taskId, side, direction) {
    if (!taskId || !side || (direction !== 'in' && direction !== 'out')) return;
    if (!this.portReservations[taskId]) {
      this.portReservations[taskId] = {
        left:   { in: 0, out: 0 },
        right:  { in: 0, out: 0 },
        top:    { in: 0, out: 0 },
        bottom: { in: 0, out: 0 },
      };
    }
    const r = this.portReservations[taskId][side];
    if (r) r[direction]++;
    // R3 (v1.6) coherence first-wins：記錄該 task 該方向的 anchor side。
    // v1.10 S16：first-wins 默認 strength=0.5 (full penalty)。
    // predictAnchors 預先設定的 anchor 已含 strength，這裡不覆寫。
    if (!this.coherence[taskId]) {
      this.coherence[taskId] = { in: null, inStrength: 0, out: null, outStrength: 0 };
    }
    if (!this.coherence[taskId][direction]) {
      this.coherence[taskId][direction] = side;
      this.coherence[taskId][`${direction}Strength`] = 0.5;
    }
  }

  /** Cost penalty if 該 port 反向已被用（規則 1 違規）。
   * 大 cost (500) 但不是 Infinity → 仍可選做 fallback 不至於 routing 失敗。
   */
  getPortConflictPenalty(taskId, side, direction) {
    if (!taskId || !side || (direction !== 'in' && direction !== 'out')) return 0;
    const r = this.portReservations[taskId]?.[side];
    if (!r) return 0;
    const opposite = direction === 'in' ? 'out' : 'in';
    return r[opposite] > 0 ? PORT_VIOLATION_PENALTY : 0;
  }

  /** Coherence mismatch penalty (v1.6 維度 6 + v1.10 S16 動態權重)。
   * 該 task 該方向的 anchor side 已記錄時，後續選不一致 side 加 penalty。
   * Penalty 依 anchor strength 動態縮放：
   *   factor = 2 * (1 - strength)
   *     strength=1.0 (壓倒性) → factor=0  → 不罰
   *     strength=0.75         → factor=0.5
   *     strength=0.5 (邊際)   → factor=1.0 → 全罰
   * 解情境 4：集中型 anchor (5/5 票) 不再壓倒少數異類 edge。
   */
  getCoherenceMismatchPenalty(taskId, side, direction) {
    if (!taskId || !side || (direction !== 'in' && direction !== 'out')) return 0;
    const c = this.coherence[taskId];
    const anchor = c?.[direction];
    if (!anchor || anchor === side) return 0;
    const strength = c[`${direction}Strength`] || 0.5;
    const factor = 2 * (1 - strength);  // 1.0 → 0, 0.5 → 1.0
    return COHERENCE_PENALTY * factor;
  }

  /** Pixel coord → grid cell */
  toCell(px, py) {
    return {
      x: Math.round(px / this.cellSize),
      y: Math.round(py / this.cellSize),
    };
  }
  /** Grid cell → pixel coord */
  toPx(c) {
    return { x: c.x * this.cellSize, y: c.y * this.cellSize };
  }
}

function oppositeDir(d) {
  return d === 'east' ? 'west' : d === 'west' ? 'east' : d === 'north' ? 'south' : 'north';
}

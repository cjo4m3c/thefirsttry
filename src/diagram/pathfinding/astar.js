/**
 * astar.js — A* orthogonal path finder with cost-based visual preferences.
 *
 * Cost function (v1.12) per-cell：
 *   cost = 1                                                    // 基本移動
 *        + turnPenalty(turnCount)  if isTurn                    // dim 0: 累進 turn
 *        + max(0, PROXIMITY_BONUS - distFromObstacle) if !stub  // dim 1: corridor 中央
 *        + getOccupyPenalty(cell, dir, src, tgt, entrySide)     // dim 2: smart 占用 (S22 軸延伸)
 *        + centerDist*CENTER_WEIGHT  if !skipRadius && enabled  // dim 4: bend 拉中點
 *
 * dim 5 (Port Reservation) + dim 6 (Coherence) 在 router.js::pickBestPath 加。
 *
 * 沒有 if-then 業務規則。新增情境調權重 / 適用範圍，不寫新分支。
 */

const TURN_PENALTY_BASE = 15;  // 第 1-2 turn 的 cost
                                // (v1.2: 10→15 阻止 proximity-driven zigzag)
                                // v1.10 S15：改成累進函式，base 仍 15 給短 path 用
const PROXIMITY_BONUS = 4;     // cell 離障礙物距離 ≥ 此值時無 penalty
                                // (push path 走 corridor 中央，解決「貼邊」+「bend 靠 target」)
// v1.11 S4 Endpoint Clearance：endpoint 附近 (stub 之外、3-5 cells) 加強推開
const ENDPOINT_BONUS = 6;      // end-zone 內 cell 離障礙物距離 ≥ 6 cells 才不罰
                                // (解 backward edge 進入 target 時箭頭被擠在邊角)
const ENDPOINT_RADIUS = 5;     // 距 start/goal ≤ 此值定義 end-zone
const CENTER_WEIGHT = 1.5;     // turn cell 離 path 中點越遠，加 cost 越多
                                // (解決 bend 偏 source / target 邊 → 拉到中點)
// v1.8 S3 動態 SKIP_RADIUS：原固定 4 對長 path 仍把 1-bend 的 corner-bend 罰到
// A* 改選繞行 3-bend (圖一 5-1-4-3→5-1-4-10 case)。改成「path 長度 / 4」自動 scale，
// 上下界 [4, 10] 保護：對短 path 仍保留 v1.2 行為，對長 path 放寬讓 corner-bend 不被誤罰，
// 但 2-bend U/S 的中段 bend 仍進 Center Bias 計算 (保留 v1.1 修的 bend 拉中點)。
const CENTER_SKIP_RADIUS_MIN = 4;
const CENTER_SKIP_RADIUS_MAX = 10;

/** S15 (v1.10) Turn penalty 累進：第 1-2 turn 同 base，第 3+ 急升。
 *  解長 path 中「bend 數權重相對 base cost 太小」(類型 A)：
 *  3-bend 繞行 vs 2-bend 直達，cost 差距從 (3-2)*15=15 拉開到 25+25=50。
 *  避免 A* 為省 base cost 而多 bend 繞行。
 */
function turnPenalty(turnCount) {
  if (turnCount <= 2) return TURN_PENALTY_BASE;  // 1st-2nd: 15
  if (turnCount === 3) return 25;
  return 30;                                      // 4th+
}

const DIRS = {
  east:  { dx:  1, dy:  0 },
  west:  { dx: -1, dy:  0 },
  south: { dx:  0, dy:  1 },
  north: { dx:  0, dy: -1 },
};
const OPPOSITE = { east: 'west', west: 'east', south: 'north', north: 'south' };

function manhattan(a, b) { return Math.abs(a.x - b.x) + Math.abs(a.y - b.y); }
function cellKey(c, d) { return `${c.x},${c.y},${d}`; }

// 簡易二元堆（min-heap）取代 array sort，A* 主迴圈從 O(n²) 降到 O(n log n)
class MinHeap {
  constructor() { this.arr = []; }
  push(node) {
    this.arr.push(node);
    this._bubbleUp(this.arr.length - 1);
  }
  pop() {
    if (this.arr.length === 0) return undefined;
    const top = this.arr[0];
    const last = this.arr.pop();
    if (this.arr.length > 0) {
      this.arr[0] = last;
      this._sinkDown(0);
    }
    return top;
  }
  get size() { return this.arr.length; }
  _bubbleUp(i) {
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this._cmp(this.arr[i], this.arr[parent]) < 0) {
        [this.arr[i], this.arr[parent]] = [this.arr[parent], this.arr[i]];
        i = parent;
      } else break;
    }
  }
  _sinkDown(i) {
    const n = this.arr.length;
    while (true) {
      const l = 2 * i + 1, r = 2 * i + 2;
      let smallest = i;
      if (l < n && this._cmp(this.arr[l], this.arr[smallest]) < 0) smallest = l;
      if (r < n && this._cmp(this.arr[r], this.arr[smallest]) < 0) smallest = r;
      if (smallest === i) break;
      [this.arr[i], this.arr[smallest]] = [this.arr[smallest], this.arr[i]];
      i = smallest;
    }
  }
  _cmp(a, b) { return (a.g + a.h) - (b.g + b.h); }
}

/**
 * @param {object} grid    含 isBlocked(x,y) / proximityDist(x,y) / getOccupyPenalty(x,y,src,tgt,dir)
 * @param {{x,y}} start    起點 grid cell
 * @param {{x,y}} goal     終點 grid cell
 * @param {string} sourceExitDir  'east'|'west'|'south'|'north'
 * @param {string} sourceId   for occupy 計算（同 source 互相不收費）
 * @param {string} targetId   同上
 * @param {object} [opts]
 * @param {number} [opts.srcCx]  source task 中心 pixel x（給 center bias 用）
 * @param {number} [opts.srcCy]  source task 中心 pixel y
 * @param {number} [opts.tgtCx]  target task 中心 pixel x
 * @param {number} [opts.tgtCy]  target task 中心 pixel y
 * @param {string} [opts.entrySide]  S22 (v1.12)：target 進入側 'left'|'right'|'top'|'bottom'，給 occupy axis funnel 用
 * @returns {Array<{x,y,dir}>|null}
 */
export function findPath(grid, start, goal, sourceExitDir, sourceId, targetId, opts = {}) {
  const open = new MinHeap();
  const closed = new Map();

  // 中點 pixel (給 center bias 計算用)。若沒給 src/tgt 中心，預設不啟用 center bias。
  const hasCenter = opts.srcCx != null && opts.srcCy != null
                 && opts.tgtCx != null && opts.tgtCy != null;
  const midX = hasCenter ? (opts.srcCx + opts.tgtCx) / 2 : 0;
  const midY = hasCenter ? (opts.srcCy + opts.tgtCy) / 2 : 0;
  const cellSize = grid.cellSize;

  // v1.8 S3：依 path 長度動態算 SKIP_RADIUS
  const pathLen = manhattan(start, goal);
  const centerSkipRadius = Math.min(
    CENTER_SKIP_RADIUS_MAX,
    Math.max(CENTER_SKIP_RADIUS_MIN, Math.floor(pathLen / 4))
  );
  // S19 (v1.10)：對「斜軸 pair candidate」關閉 Center Bias。
  // 斜軸 pair (R→T, B→L 等) 的 1-bend bend 在 corner，centerCost 必高。
  // 維度 4 (Center Bias) 設計目的是「2-bend U/S 拉中點」，對 1-bend 斜軸是
  // 反向破壞 → A* 寧可選 3-bend 繞行讓 bend 進中段。關閉解情境 1+2+4。
  const centerBiasEnabled = opts.centerBiasEnabled !== false;

  const startNode = {
    cell: start,
    dir: sourceExitDir,
    g: 0,
    h: manhattan(start, goal),
    turnCount: 0,  // S15 (v1.10) 累進 turn penalty 用
    parent: null,
  };
  open.push(startNode);

  let iterations = 0;
  const MAX_ITER = 50000;

  while (open.size > 0) {
    if (++iterations > MAX_ITER) return null;

    const cur = open.pop();

    if (cur.cell.x === goal.x && cur.cell.y === goal.y) {
      return reconstruct(cur);
    }

    const key = cellKey(cur.cell, cur.dir);
    if (closed.has(key) && closed.get(key) <= cur.g) continue;
    closed.set(key, cur.g);

    const dirOrder = [
      cur.dir,
      perpendicular(cur.dir)[0],
      perpendicular(cur.dir)[1],
      OPPOSITE[cur.dir],
    ];

    for (let i = 0; i < dirOrder.length; i++) {
      const d = dirOrder[i];
      if (cur.parent === null && d === OPPOSITE[sourceExitDir]) continue;
      const dx = DIRS[d].dx, dy = DIRS[d].dy;
      const nx = cur.cell.x + dx, ny = cur.cell.y + dy;
      const ncell = { x: nx, y: ny };

      if (!grid.inBounds(nx, ny)) continue;
      if (grid.isBlocked(nx, ny)) continue;

      const isTurn = (cur.parent !== null && d !== cur.dir);

      // cell 距 start/goal 的曼哈頓距離 (給 stub skip + center bias 共用)
      const distFromStart = Math.abs(nx - start.x) + Math.abs(ny - start.y);
      const distFromGoal  = Math.abs(nx - goal.x)  + Math.abs(ny - goal.y);

      // ─ 維度 1：障礙物距離（三段邊界，v1.11 完整）─
      //   STUB (≤2):    cost=0          ← v1.9 S8，stub 沿軸不繞行
      //   END-ZONE (3-5): bonus=6        ← v1.11 S4，endpoint 附近加強推開避箭頭擠
      //   中段 (6+):    bonus=4 (標準)   ← corridor 中央
      // 每段獨立可調，不耦合。
      const dist = grid.proximityDist ? grid.proximityDist(nx, ny) : PROXIMITY_BONUS;
      const inStub    = distFromStart <= 2 || distFromGoal <= 2;
      const inEndZone = !inStub && (distFromStart <= ENDPOINT_RADIUS || distFromGoal <= ENDPOINT_RADIUS);
      let proximityCost;
      if (inStub) {
        proximityCost = 0;
      } else if (inEndZone) {
        proximityCost = Math.max(0, ENDPOINT_BONUS - dist);
      } else {
        proximityCost = Math.max(0, PROXIMITY_BONUS - dist);
      }

      // ─ 維度 2：smart occupy（source/target/dir aware + distance-aware v1.3 + v1.12 S22 軸延伸）─
      // 傳 start/goal cell 讓 grid 算「離 port 距離」，靠近 share、遠離 spread
      // S22：傳 entrySide 讓 same-target 邊在 port 軸上 share-free，避免進 port 前 1-grid 階梯
      const occupyCost = grid.getOccupyPenalty
        ? grid.getOccupyPenalty(nx, ny, sourceId, targetId, d, start, goal, opts.entrySide)
        : 0;

      // ─ 維度 4：center bias（turn cell 偏離 path 中點時加 cost）─
      // 只對「中段」轉彎點加 cost (距 start/goal > 動態 skipRadius)
      // S19 (v1.10)：斜軸 pair candidate 整體關閉 (centerBiasEnabled=false)
      let centerCost = 0;
      if (isTurn && hasCenter && centerBiasEnabled) {
        if (distFromStart > centerSkipRadius && distFromGoal > centerSkipRadius) {
          const cellPxX = nx * cellSize;
          const cellPxY = ny * cellSize;
          const centerDistCells = (Math.abs(cellPxX - midX) + Math.abs(cellPxY - midY)) / cellSize;
          centerCost = centerDistCells * CENTER_WEIGHT;
        }
      }

      // S15 (v1.10): turn penalty 累進。新 turnCount = 父 + (isTurn ? 1 : 0)
      const newTurnCount = cur.turnCount + (isTurn ? 1 : 0);
      const turnCost = isTurn ? turnPenalty(newTurnCount) : 0;

      // Tie-break: 同方向 0.01 < perp 0.02 < perp 0.03 < opposite 0.04
      const tieBias = i * 0.01;
      const newG = cur.g + 1
        + turnCost
        + proximityCost
        + occupyCost
        + centerCost
        + tieBias;
      const newH = manhattan(ncell, goal);

      const nkey = cellKey(ncell, d);
      if (closed.has(nkey) && closed.get(nkey) <= newG) continue;

      open.push({ cell: ncell, dir: d, g: newG, h: newH, turnCount: newTurnCount, parent: cur });
    }
  }

  return null;
}

function reconstruct(endNode) {
  const path = [];
  let n = endNode;
  while (n !== null) {
    // 帶 g 值方便 router 取最後一格的總 cost 比較多個 port 候選
    path.unshift({ x: n.cell.x, y: n.cell.y, dir: n.dir, g: n.g });
    n = n.parent;
  }
  return path;
}

function perpendicular(dir) {
  if (dir === 'east' || dir === 'west') return ['south', 'north'];
  return ['east', 'west'];
}

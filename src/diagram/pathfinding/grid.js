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

// Distance-aware OCCUPY 參數（v1.3）：
//   - 同 source/target 的線在距離 port ≤ SHARE_RADIUS 內：share trunk/tail 免費
//   - 距離 > SHARE_RADIUS：spread (SHARE_PENALTY 推開)
const SHARE_RADIUS = 2;
const SHARE_PENALTY = 3;

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
    // Title bar：rows 0 到 TITLE_H/CELL
    const titleRows = LAYOUT.TITLE_H / this.cellSize;
    for (let y = 0; y < titleRows; y++) {
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
    // 下側 padding
    const bottomStart = Math.floor((svgHeight - LAYOUT.PADDING_BOTTOM) / this.cellSize);
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
   * meta = { sourceId, targetId, dir }
   */
  markOccupied(x, y, meta) {
    if (this.inBounds(x, y)) this.occupied.set(y * this.cols + x, meta);
  }

  /** 取得 occupy 在指定方向下的 penalty（distance-aware v1.3）：
   *
   * 同 source / 同 target 的 share 行為依「離 port 多遠」而定：
   *   - 距離 port ≤ SHARE_RADIUS：共享免費 (trunk/tail，視覺上看起來「從同一個 port 出入」)
   *   - 距離 port > SHARE_RADIUS：spread (SHARE_PENALTY，遠端強迫分流)
   *
   * 解決 v1.2 殘留問題：
   *   - 多 fork 共享過度 → labels 重疊：現在 trunk 共享，遠端 spread ✓
   *   - 多 merge 全程 spread → 接近 target 反而 spread：現在 tail 合流，遠端 spread ✓
   *
   * 同方向重疊：高 penalty 80（避免平行重疊）
   * 垂直交叉：低 penalty 8（允許交叉）
   */
  getOccupyPenalty(x, y, mySource, myTarget, myDir, startCell, goalCell) {
    if (!this.inBounds(x, y)) return 0;
    const stored = this.occupied.get(y * this.cols + x);
    if (!stored) return 0;

    if (stored.sourceId === mySource) {
      if (startCell) {
        const d = Math.abs(x - startCell.x) + Math.abs(y - startCell.y);
        if (d <= SHARE_RADIUS) return 0;  // 靠近 source port，trunk 共享
      }
      return SHARE_PENALTY;  // 遠離 source，spread
    }
    if (stored.targetId === myTarget) {
      if (goalCell) {
        const d = Math.abs(x - goalCell.x) + Math.abs(y - goalCell.y);
        if (d <= SHARE_RADIUS) return 0;  // 靠近 target port，tail 合流
      }
      return SHARE_PENALTY;
    }
    if (stored.dir === myDir || stored.dir === oppositeDir(myDir)) return 80;  // 同向重疊
    return 8;  // 垂直交叉
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

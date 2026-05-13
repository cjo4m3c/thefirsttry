/**
 * grid.js — 把 SVG 畫布網格化，提供 A* 用的 blocked / occupied 查詢。
 *
 * Grid cell size：CELL_SIZE px（POC 用 16，可調）
 * Blocked：任務矩形覆蓋的 cell
 * Occupied：之前 A* 算過的 edge 用過的 cell（multi-pass 用）
 */

export const CELL_SIZE = 16;

// task 周圍留多少 padding cells（避免線剛好擦到 task 邊）
const TASK_PADDING_CELLS = 0;

export class RoutingGrid {
  constructor(positions, svgWidth, svgHeight) {
    this.cellSize = CELL_SIZE;
    this.cols = Math.ceil(svgWidth / this.cellSize) + 2;
    this.rows = Math.ceil(svgHeight / this.cellSize) + 2;
    this.blocked = new Uint8Array(this.cols * this.rows);
    this.occupied = new Uint8Array(this.cols * this.rows);
    this.markTasks(positions);
  }

  markTasks(positions) {
    for (const id in positions) {
      const p = positions[id];
      const left   = Math.floor(p.left.x   / this.cellSize) - TASK_PADDING_CELLS;
      const right  = Math.ceil (p.right.x  / this.cellSize) + TASK_PADDING_CELLS;
      const top    = Math.floor(p.top.y    / this.cellSize) - TASK_PADDING_CELLS;
      const bottom = Math.ceil (p.bottom.y / this.cellSize) + TASK_PADDING_CELLS;
      for (let y = top; y < bottom; y++) {
        for (let x = left; x < right; x++) {
          if (this.inBounds(x, y)) this.blocked[y * this.cols + x] = 1;
        }
      }
    }
  }

  inBounds(x, y) { return x >= 0 && y >= 0 && x < this.cols && y < this.rows; }
  isBlocked(x, y) { return !this.inBounds(x, y) || this.blocked[y * this.cols + x] === 1; }
  isOccupied(x, y) { return this.inBounds(x, y) && this.occupied[y * this.cols + x] === 1; }

  /** Open a task's edge cell so A* can enter/exit through it */
  unblock(x, y) {
    if (this.inBounds(x, y)) this.blocked[y * this.cols + x] = 0;
  }
  /** Mark a cell as occupied by previously routed edge */
  markOccupied(x, y) {
    if (this.inBounds(x, y)) this.occupied[y * this.cols + x] = 1;
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

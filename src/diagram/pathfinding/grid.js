/**
 * grid.js — 把 SVG 畫布網格化，提供 A* 用的 blocked / occupied 查詢。
 *
 * Grid offset 設計：cellSize=8 + Y offset 讓 lane centers 精確落在 cell 邊界。
 *   lane center y = TITLE_H(66) + NODE_VOFFSET(68) = 134
 *   134 % 8 = 6 → 用 OFFSET_Y = 6 讓 134 = 16*8 + 6 對齊 cell row 16
 *   lane 2 center 270 = 33*8 + 6 ✓
 *   所有 lane center 都在 cell row 邊界（差距是 8 的倍數）
 *
 * 結果：path 的水平段 y 值會落在 lane center，**徹底消除 6px notch**。
 */

import { LAYOUT } from '../constants.js';

export const CELL_SIZE = 8;
const OFFSET_X = 0;
// (TITLE_H + LANE_H/2) % CELL_SIZE = 134 % 8 = 6
const OFFSET_Y = (LAYOUT.TITLE_H + LAYOUT.LANE_H / 2) % CELL_SIZE;

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
      const left   = Math.floor((p.left.x   - OFFSET_X) / this.cellSize) - TASK_PADDING_CELLS;
      const right  = Math.ceil ((p.right.x  - OFFSET_X) / this.cellSize) + TASK_PADDING_CELLS;
      const top    = Math.floor((p.top.y    - OFFSET_Y) / this.cellSize) - TASK_PADDING_CELLS;
      const bottom = Math.ceil ((p.bottom.y - OFFSET_Y) / this.cellSize) + TASK_PADDING_CELLS;
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

  /** Pixel coord → grid cell（含 OFFSET_X/Y 對齊 lane center）*/
  toCell(px, py) {
    return {
      x: Math.round((px - OFFSET_X) / this.cellSize),
      y: Math.round((py - OFFSET_Y) / this.cellSize),
    };
  }
  /** Grid cell → pixel coord（含 OFFSET_X/Y 對齊 lane center）*/
  toPx(c) {
    return { x: c.x * this.cellSize + OFFSET_X, y: c.y * this.cellSize + OFFSET_Y };
  }
}

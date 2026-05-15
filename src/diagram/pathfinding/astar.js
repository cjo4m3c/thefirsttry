/**
 * astar.js — A* orthogonal path finder with cost-based visual preferences.
 *
 * Cost function 由四個維度組成，每個維度透過獨立常數 tune（不寫 if-then 規則）：
 *
 *   cost = 1                                                    // 基本移動
 *        + (turn ? TURN_PENALTY : 0)                            // 轉彎
 *        + max(0, PROXIMITY_BONUS - distFromObstacle)           // 障礙物距離 (push 中央)
 *        + getOccupyPenalty(cell, dir, src, tgt)                // 占用 (smart 判斷)
 *
 * 4 個維度全是 cost function 的權重，**沒有任何 if-then 規則**。
 * 新增情境只需「加新維度 / 調權重」，不寫新分支。
 */

const TURN_PENALTY = 10;       // 每 90° 轉彎扣分
const PROXIMITY_BONUS = 4;     // cell 離障礙物距離 ≥ 此值時無 penalty
                                // (push path 走 corridor 中央，解決「貼邊」+「bend 靠 target」)
const CENTER_WEIGHT = 1.5;     // turn cell 離 path 中點越遠，加 cost 越多
                                // (解決 bend 偏 source / target 邊 → 拉到中點)

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

  const startNode = {
    cell: start,
    dir: sourceExitDir,
    g: 0,
    h: manhattan(start, goal),
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

      // ─ 維度 1：障礙物距離（PROXIMITY_BONUS - distance）─
      // 離障礙物越近 cost 越高，push path 走 corridor 中央
      const dist = grid.proximityDist ? grid.proximityDist(nx, ny) : PROXIMITY_BONUS;
      const proximityCost = Math.max(0, PROXIMITY_BONUS - dist);

      // ─ 維度 2：smart occupy（source/target/dir aware）─
      const occupyCost = grid.getOccupyPenalty
        ? grid.getOccupyPenalty(nx, ny, sourceId, targetId, d)
        : 0;

      // ─ 維度 3：center bias（turn cell 偏離 path 中點時加 cost）─
      // 只對轉彎點加 cost：路徑長度跟轉彎數對所有 2-bend 變體都相同，
      // 但 bend 位置不同會讓 turn cell 在不同位置 → 用此維度區分。
      // 結果：A* 自動選 bend 在中點的 path。
      let centerCost = 0;
      if (isTurn && hasCenter) {
        const cellPxX = nx * cellSize;
        const cellPxY = ny * cellSize;
        const centerDistCells = (Math.abs(cellPxX - midX) + Math.abs(cellPxY - midY)) / cellSize;
        centerCost = centerDistCells * CENTER_WEIGHT;
      }

      // Tie-break: 同方向 0.01 < perp 0.02 < perp 0.03 < opposite 0.04
      const tieBias = i * 0.01;
      const newG = cur.g + 1
        + (isTurn ? TURN_PENALTY : 0)
        + proximityCost
        + occupyCost
        + centerCost
        + tieBias;
      const newH = manhattan(ncell, goal);

      const nkey = cellKey(ncell, d);
      if (closed.has(nkey) && closed.get(nkey) <= newG) continue;

      open.push({ cell: ncell, dir: d, g: newG, h: newH, parent: cur });
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

/**
 * A* path finder — orthogonal grid-based.
 *
 * 用於 Phase 3g：當 Phase 3f L1 retry 仍找不到乾淨 (exit, entry) 時，
 * 對該 connection 跑 A* 在 sub-cell grid 上找路徑。
 *
 * State：(x, y, dir) — dir 用來算 bend penalty。
 * dir: 0=E, 1=W, 2=S, 3=N (對應 DX/DY)。
 * dir = -1 表示起點未走過（initialDir 沒指定時的初始狀態）。
 *
 * Cost：
 *   - 每步基礎 cost = 1
 *   - 進入 cell 的 cost 由 grid[idx] 決定（0=空、1-254=penalty、255=obstacle 跳過）
 *   - 換方向（轉彎）+ bendPenalty
 *
 * Heuristic：Manhattan distance（admissible for orthogonal grid）。
 *
 * Override 硬約束（D6）：
 *   - initialDir：第一步必須往這方向走（鎖 source 出口 port）
 *   - finalDir：最後一步必須是這方向走（鎖 target 入口 port）
 *
 * 回傳：path（[{x, y}] sub-cell 座標）或 null（找不到）。
 */

const DX = [1, -1, 0, 0];   // E, W, S, N
const DY = [0, 0, 1, -1];

class MinHeap {
  constructor() { this.items = []; }
  push(priority, value) {
    this.items.push({ priority, value });
    let i = this.items.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.items[parent].priority <= this.items[i].priority) break;
      [this.items[parent], this.items[i]] = [this.items[i], this.items[parent]];
      i = parent;
    }
  }
  pop() {
    if (this.items.length === 0) return null;
    const top = this.items[0];
    const last = this.items.pop();
    if (this.items.length > 0) {
      this.items[0] = last;
      let i = 0;
      while (true) {
        const left = 2 * i + 1, right = 2 * i + 2;
        let smallest = i;
        if (left < this.items.length && this.items[left].priority < this.items[smallest].priority) smallest = left;
        if (right < this.items.length && this.items[right].priority < this.items[smallest].priority) smallest = right;
        if (smallest === i) break;
        [this.items[i], this.items[smallest]] = [this.items[smallest], this.items[i]];
        i = smallest;
      }
    }
    return top.value;
  }
  get size() { return this.items.length; }
}

const stateKey = (x, y, dir) => ((dir + 1) << 24) | (y << 12) | x;

export function findPath(grid, cols, rows, start, end, opts = {}) {
  const {
    bendPenalty = 10,
    maxIterations = 8000,
    initialDir = -1,
    finalDir = -1,
  } = opts;

  if (start.x < 0 || start.x >= cols || start.y < 0 || start.y >= rows) return null;
  if (end.x < 0 || end.x >= cols || end.y < 0 || end.y >= rows) return null;
  if (grid[end.y * cols + end.x] >= 255) return null;

  const heap = new MinHeap();
  const gScore = new Map();
  const cameFrom = new Map();

  const heuristic = (x, y) => Math.abs(x - end.x) + Math.abs(y - end.y);

  const seedDirs = initialDir >= 0 ? [initialDir] : [0, 1, 2, 3];
  for (const d of seedDirs) {
    const k = stateKey(start.x, start.y, d);
    gScore.set(k, 0);
    heap.push(heuristic(start.x, start.y), { x: start.x, y: start.y, dir: d, key: k });
  }

  let iter = 0;
  while (heap.size > 0 && iter++ < maxIterations) {
    const cur = heap.pop();

    if (cur.x === end.x && cur.y === end.y) {
      // finalDir constraint: last direction must match. Since we stored dir
      // on each state, just check.
      if (finalDir >= 0 && cur.dir !== finalDir) continue;
      // Reconstruct path
      const path = [{ x: cur.x, y: cur.y }];
      let key = cur.key;
      while (cameFrom.has(key)) {
        const parent = cameFrom.get(key);
        path.unshift({ x: parent.x, y: parent.y });
        key = parent.key;
      }
      return path;
    }

    for (let d = 0; d < 4; d++) {
      const nx = cur.x + DX[d];
      const ny = cur.y + DY[d];
      if (nx < 0 || nx >= cols || ny < 0 || ny >= rows) continue;

      const cellCost = grid[ny * cols + nx];
      if (cellCost >= 255) continue;   // obstacle

      const moveCost = 1 + cellCost / 10;
      const bendCost = (cur.dir !== d && cur.dir !== -1) ? bendPenalty : 0;
      const newG = (gScore.get(cur.key) ?? 0) + moveCost + bendCost;

      const nk = stateKey(nx, ny, d);
      const oldG = gScore.get(nk);
      if (oldG === undefined || newG < oldG) {
        gScore.set(nk, newG);
        cameFrom.set(nk, { x: cur.x, y: cur.y, key: cur.key });
        heap.push(newG + heuristic(nx, ny), { x: nx, y: ny, dir: d, key: nk });
      }
    }
  }

  return null;
}

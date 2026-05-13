/**
 * astar.js — Lee/A* style orthogonal path finder.
 *
 * 用途：給定 grid（含障礙）、起點、終點、起點方向，找最短 ortho path。
 * 評分：每走一格 +1，每轉彎 +TURN_PENALTY，被占用 cell +OCCUPY_PENALTY。
 * Tie-break：優先沿 sourceExitDir 方向，避免左右搖擺。
 */

const TURN_PENALTY = 5;
const OCCUPY_PENALTY = 100;  // 走前一條已畫過的 path 上的 cell

const DIRS = {
  east:  { dx:  1, dy:  0 },
  west:  { dx: -1, dy:  0 },
  south: { dx:  0, dy:  1 },
  north: { dx:  0, dy: -1 },
};
const OPPOSITE = { east: 'west', west: 'east', south: 'north', north: 'south' };

function manhattan(a, b) { return Math.abs(a.x - b.x) + Math.abs(a.y - b.y); }
function cellKey(c, d) { return `${c.x},${c.y},${d}`; }

/**
 * @param {object} grid 必須有 .isBlocked(x, y) 跟 .isOccupied(x, y) 方法（佔用是 prior edge）
 * @param {{x:number,y:number}} start 起點 grid cell
 * @param {{x:number,y:number}} goal  終點 grid cell
 * @param {'east'|'west'|'south'|'north'} sourceExitDir
 * @returns {Array<{x,y,dir}>|null} cell sequence (含起終點) 或 null（找不到）
 */
export function findPath(grid, start, goal, sourceExitDir) {
  // Open set: array sorted by f. 簡易用 array sort（POC 等級，~100 nodes 沒效能問題）
  const open = [];
  const closed = new Map();  // key → bestG

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

  while (open.length > 0) {
    if (++iterations > MAX_ITER) return null;

    // Pop lowest f. 慢但 POC 夠用
    open.sort((a, b) => (a.g + a.h) - (b.g + b.h));
    const cur = open.shift();

    if (cur.cell.x === goal.x && cur.cell.y === goal.y) {
      return reconstruct(cur);
    }

    const key = cellKey(cur.cell, cur.dir);
    if (closed.has(key) && closed.get(key) <= cur.g) continue;
    closed.set(key, cur.g);

    // Expand neighbors with tie-break: preferred dir (= cur.dir if same as source)
    // Actually preferred order: continue same dir first, then perpendicular, last reverse
    const dirOrder = [
      cur.dir,
      perpendicular(cur.dir)[0],
      perpendicular(cur.dir)[1],
      OPPOSITE[cur.dir],
    ];

    for (let i = 0; i < dirOrder.length; i++) {
      const d = dirOrder[i];
      if (cur.parent === null && d === OPPOSITE[sourceExitDir]) continue;  // 第一步不准回頭
      const dx = DIRS[d].dx, dy = DIRS[d].dy;
      const nx = cur.cell.x + dx, ny = cur.cell.y + dy;
      const ncell = { x: nx, y: ny };

      if (!grid.inBounds(nx, ny)) continue;
      if (grid.isBlocked(nx, ny)) continue;

      const isTurn = (cur.parent !== null && d !== cur.dir);
      const occupyCost = grid.isOccupied(nx, ny) ? OCCUPY_PENALTY : 0;
      // Tiny preference for earlier dir-order entries (tie-break)
      const tieBias = i * 0.01;
      const newG = cur.g + 1 + (isTurn ? TURN_PENALTY : 0) + occupyCost + tieBias;
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
    path.unshift({ x: n.cell.x, y: n.cell.y, dir: n.dir });
    n = n.parent;
  }
  return path;
}

function perpendicular(dir) {
  if (dir === 'east' || dir === 'west') return ['south', 'north'];
  return ['east', 'west'];
}

import { LAYOUT } from '../constants/colors.js';

const { TITLE_H, LANE_HEADER_W, COL_W, LANE_H } = LAYOUT;

/**
 * Compute (x, y) positions for each step using topological sort.
 * Returns steps with added x, y, col, row fields, plus total svgWidth/svgHeight.
 */
export function computeLayout(lanes, steps, connections) {
  const laneIndexMap = Object.fromEntries(lanes.map((l, i) => [l.id, i]));

  // Build adjacency: predecessors list for each step
  const predecessors = Object.fromEntries(steps.map(s => [s.id, []]));
  const successors = Object.fromEntries(steps.map(s => [s.id, []]));
  for (const conn of connections) {
    predecessors[conn.to].push(conn.from);
    successors[conn.from].push(conn.to);
  }

  // Kahn's topological sort for column assignment
  const inDegree = Object.fromEntries(steps.map(s => [s.id, predecessors[s.id].length]));
  const queue = steps.filter(s => inDegree[s.id] === 0).map(s => s.id);
  const col = Object.fromEntries(steps.map(s => [s.id, 0]));

  const visited = new Set();
  while (queue.length > 0) {
    const id = queue.shift();
    if (visited.has(id)) continue;
    visited.add(id);

    for (const nextId of (successors[id] || [])) {
      // col of successor = max(col of all predecessors) + 1
      col[nextId] = Math.max(col[nextId], col[id] + 1);
      inDegree[nextId]--;
      if (inDegree[nextId] <= 0) {
        queue.push(nextId);
      }
    }
  }

  // Handle unvisited steps (cycles or disconnected nodes) — just assign incrementing cols
  let nextCol = steps.reduce((max, s) => Math.max(max, col[s.id]), 0) + 1;
  for (const s of steps) {
    if (!visited.has(s.id)) {
      col[s.id] = nextCol++;
    }
  }

  // Resolve column conflicts: if multiple steps from same lane share same col, shift later ones
  // Group by (laneId, col) and spread them out
  const colMap = {};
  for (const s of steps) {
    const key = `${s.laneId}__${col[s.id]}`;
    if (!colMap[key]) colMap[key] = [];
    colMap[key].push(s.id);
  }
  for (const ids of Object.values(colMap)) {
    if (ids.length > 1) {
      // Find max col among predecessors of ids[1..] and shift
      for (let i = 1; i < ids.length; i++) {
        const currentCol = col[ids[i]];
        let maxPredCol = -1;
        for (const predId of predecessors[ids[i]]) {
          maxPredCol = Math.max(maxPredCol, col[predId]);
        }
        col[ids[i]] = Math.max(currentCol + i, maxPredCol + 1);
      }
    }
  }

  const maxCol = Math.max(...steps.map(s => col[s.id]));
  const numCols = maxCol + 1;

  // Assign (x, y) based on (row, col)
  const layoutSteps = steps.map(s => {
    const row = laneIndexMap[s.laneId];
    const c = col[s.id];
    const x = LANE_HEADER_W + c * COL_W + COL_W / 2;
    const y = TITLE_H + row * LANE_H + LANE_H / 2;
    return { ...s, row, col: c, x, y };
  });

  const svgWidth = LANE_HEADER_W + numCols * COL_W + 20;
  const svgHeight = TITLE_H + lanes.length * LANE_H + 4;

  return { layoutSteps, svgWidth, svgHeight };
}

/**
 * Compute the border intersection point from center (cx,cy) toward target (tx,ty)
 * for a given node shape.
 */
export function getBorderPoint(step, tx, ty, layoutSteps) {
  const { x: cx, y: cy, type } = step;
  const { NODE_W, NODE_H, CIRCLE_R, DIAMOND_SIZE } = LAYOUT;

  const dx = tx - cx;
  const dy = ty - cy;
  const angle = Math.atan2(dy, dx);

  if (type === 'start' || type === 'end') {
    return {
      x: cx + CIRCLE_R * Math.cos(angle),
      y: cy + CIRCLE_R * Math.sin(angle),
    };
  }

  if (type === 'gateway') {
    // Diamond: approximate as rotated square
    const d = DIAMOND_SIZE;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);
    let t;
    if (absDx === 0 && absDy === 0) return { x: cx, y: cy };
    // Diamond half-width in direction (dx, dy)
    if (absDx + absDy === 0) return { x: cx, y: cy };
    t = d / (absDx + absDy);
    return {
      x: cx + dx * t,
      y: cy + dy * t,
    };
  }

  // Rectangle (task, activity, interaction)
  const hw = NODE_W / 2;
  const hh = NODE_H / 2;
  if (dx === 0 && dy === 0) return { x: cx, y: cy };

  const absDx = Math.abs(dx);
  const absDy = Math.abs(dy);

  let t;
  if (absDx * hh > absDy * hw) {
    // Hit left or right edge
    t = hw / absDx;
  } else {
    // Hit top or bottom edge
    t = hh / absDy;
  }

  return {
    x: cx + dx * t,
    y: cy + dy * t,
  };
}

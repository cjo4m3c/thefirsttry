import { LAYOUT } from './constants.js';

const { LANE_HEADER_W, COL_W, LANE_H: BASE_LANE_H, TITLE_H, NODE_W, NODE_H, DIAMOND_SIZE, CIRCLE_R } = LAYOUT;

const NODE_VOFFSET = BASE_LANE_H / 2; // 70px from lane top

const ROUTE_MARGIN = 12;
const ROUTE_SLOT_H = 18;
const ROUTE_BOTTOM_PAD = 8;

const MAX_SHAPE_BOTTOM_OFFSET = NODE_VOFFSET + DIAMOND_SIZE; // 70 + 38 = 108

function minLaneH(numSlots) {
  if (numSlots <= 0) return BASE_LANE_H;
  return MAX_SHAPE_BOTTOM_OFFSET + ROUTE_MARGIN + numSlots * ROUTE_SLOT_H + ROUTE_BOTTOM_PAD;
}

function halfExtent(type, axis) {
  if (type === 'gateway') return DIAMOND_SIZE;
  if (type === 'start' || type === 'end') return CIRCLE_R;
  return axis === 'x' ? NODE_W / 2 : NODE_H / 2;
}

/**
 * Gateway exit/entry side rules.
 *
 * dr = row diff, dc = col diff (target – source)
 *
 *   same row, dc=1 (adjacent forward)     → RIGHT → LEFT
 *   same row, dc≠1 (skip/backward)        → BOTTOM → BOTTOM  (slotted corridor below)
 *   target above, dc=1 (adjacent right)   → TOP   → LEFT    (L-path)
 *   target above, dc≠1                    → TOP   → TOP     (corridor above)
 *   target below, dc≥1 (any right)        → BOTTOM → LEFT   (L-path, issue-3 fix)
 *   target below, dc<1 (left/backward)    → BOTTOM → BOTTOM (corridor below)
 */
function getGatewayExitEntry(fromPos, toPos) {
  const dr = toPos.row - fromPos.row;
  const dc = toPos.col - fromPos.col;

  if (dr < 0) {
    if (dc === 1) return { exitSide: 'top', entrySide: 'left' };
    return { exitSide: 'top', entrySide: 'top' };
  }
  if (dr > 0) {
    // Fix issue 3: all rightward downward connections use simple L-path (BOTTOM→LEFT)
    if (dc >= 1) return { exitSide: 'bottom', entrySide: 'left' };
    return { exitSide: 'bottom', entrySide: 'bottom' };
  }
  if (dc === 1) return { exitSide: 'right', entrySide: 'left' };
  return { exitSide: 'bottom', entrySide: 'bottom' };
}

/**
 * Graph-based column assignment (Fix issue 1: parallel task alignment).
 *
 * Uses topological sort on FORWARD connections only (backward gateway conditions
 * are excluded to avoid cycles).  Parallel targets (multiple nextTaskIds from the
 * same source) all receive column = source_col + 1, so they appear side-by-side
 * in their respective lanes.
 */
function computeColumnMap(tasks) {
  const taskIdSet = new Set(tasks.map(t => t.id));
  const arrayIdxOf = {};
  tasks.forEach((t, i) => { arrayIdxOf[t.id] = i; });

  const fwdNext = {};   // taskId → [successorId, ...]
  const inDeg   = {};
  tasks.forEach(t => { fwdNext[t.id] = []; inDeg[t.id] = 0; });

  const addEdge = (fromId, toId) => {
    if (!toId || !taskIdSet.has(toId)) return;
    if (arrayIdxOf[toId] <= arrayIdxOf[fromId]) return; // skip backward / self
    fwdNext[fromId].push(toId);
    inDeg[toId]++;
  };

  tasks.forEach(task => {
    if (task.type === 'gateway') {
      (task.conditions || []).forEach(c => addEdge(task.id, c.nextTaskId));
    } else if (task.type !== 'end') {
      (task.nextTaskIds || []).forEach(nid => addEdge(task.id, nid));
      if (task.nextTaskId) addEdge(task.id, task.nextTaskId); // legacy
    }
  });

  const colOf = {};
  tasks.forEach(t => { colOf[t.id] = 0; });

  // Kahn's algorithm + longest-path column computation
  const queue = tasks.filter(t => inDeg[t.id] === 0).map(t => t.id);
  const rem = { ...inDeg };
  const processed = new Set();

  while (queue.length > 0) {
    const id = queue.shift();
    processed.add(id);
    fwdNext[id].forEach(nid => {
      colOf[nid] = Math.max(colOf[nid], colOf[id] + 1);
      if (--rem[nid] === 0) queue.push(nid);
    });
  }

  // Fallback for tasks not reached by forward processing (cycles / isolated nodes)
  tasks.forEach((t, i) => { if (!processed.has(t.id)) colOf[t.id] = i; });

  return colOf;
}

export function computeLayout(flow) {
  const { roles, tasks, l3Number } = flow;

  // ── 1. Role index map ───────────────────────────────────────────
const roleIndexMap = {};
  roles.forEach((r, i) => { roleIndexMap[r.id] = i; });

  // ── 2. Row lookups ─────────────────────────────────────────────
const taskRowOf = {};
  tasks.forEach(task => { taskRowOf[task.id] = roleIndexMap[task.roleId] ?? 0; });

  // ── 3. Graph-based column assignment (parallel = same col) ────
const colOf = computeColumnMap(tasks);
  const taskColOf = {};
  tasks.forEach(task => { taskColOf[task.id] = colOf[task.id]; });

  // ── 4. Pre-compute per-gateway condition routing ──────────────
// Computes exit/entry sides for every gateway condition, with exit-side
  // deduplication so that two conditions of the same gateway that would both
  // use the same exit side are given different sides (Fix issue 2).
  //
  // Key: `${taskId}::${condId}`  Value: {exitSide, entrySide}
  const condRouting = new Map();
  tasks.forEach(task => {
    if (task.type !== 'gateway' || !task.conditions?.length) return;
    const usedExits = new Set();
    task.conditions.forEach(cond => {
      if (!cond.nextTaskId || taskRowOf[cond.nextTaskId] === undefined) return;
      const fr = taskRowOf[task.id], fc = taskColOf[task.id];
      const tr = taskRowOf[cond.nextTaskId], tc = taskColOf[cond.nextTaskId];
      let { exitSide, entrySide } = getGatewayExitEntry(
        { row: fr, col: fc }, { row: tr, col: tc }
      );
      // If this exit side is already taken, flip to the opposite vertical side
      if (usedExits.has(exitSide)) {
        if (exitSide === 'bottom') { exitSide = 'top';    entrySide = 'top';    }
        else if (exitSide === 'top') { exitSide = 'bottom'; entrySide = 'bottom'; }
      }
      usedExits.add(exitSide);
      condRouting.set(`${task.id}::${cond.id}`, { exitSide, entrySide });
    });
  });

  // ── 5. Count bottom-routing slots needed per lane ─────────────
const bottomConnsByRow = roles.map(() => []);
  tasks.forEach(task => {
    if (task.type !== 'gateway') return;
    (task.conditions || []).forEach(cond => {
      if (!cond.nextTaskId || taskRowOf[cond.nextTaskId] === undefined) return;
      const routing = condRouting.get(`${task.id}::${cond.id}`);
      if (!routing) return;
      const { exitSide, entrySide } = routing;
      if (exitSide === 'bottom' && entrySide === 'bottom') {
        const fr = taskRowOf[task.id];
        const tr = taskRowOf[cond.nextTaskId];
        const fc = taskColOf[task.id];
        const tc = taskColOf[cond.nextTaskId];
        const lowerRow = Math.max(fr, tr);
        bottomConnsByRow[lowerRow].push({
          fromId: task.id,
          toId: cond.nextTaskId,
          span: Math.abs(tc - fc),
        });
      }
    });
  });

  bottomConnsByRow.forEach(arr => arr.sort((a, b) => b.span - a.span));

  // ── 6. Per-lane heights ─────────────────────────────────────────────
const laneHeights = roles.map((_, row) => {
    return Math.max(BASE_LANE_H, minLaneH(bottomConnsByRow[row].length));
  });

  // ── 7. Cumulative lane top Y ─────────────────────────────────────────
const laneTopY = [];
  let y = TITLE_H;
  roles.forEach((_, row) => { laneTopY.push(y); y += laneHeights[row]; });

  // ── 8. Slot-based laneBottomY for bottom→bottom connections ───
const bottomYMap = {};
  bottomConnsByRow.forEach((arr, row) => {
    arr.forEach((conn, slotIdx) => {
      const slotY = laneTopY[row] + laneHeights[row] - ROUTE_BOTTOM_PAD - slotIdx * ROUTE_SLOT_H;
      bottomYMap[`${conn.fromId}::${conn.toId}`] = slotY;
    });
  });

  // ── 9. Node positions ───────────────────────────────────────────────
const positions = {};
  const l4Numbers = {};
  let taskCounter = 1;

  tasks.forEach(task => {
    const row = taskRowOf[task.id] ?? 0;
    const cx  = LANE_HEADER_W + colOf[task.id] * COL_W + COL_W / 2;
    const cy  = laneTopY[row] + NODE_VOFFSET;
    const hx  = halfExtent(task.type, 'x');
    const hy  = halfExtent(task.type, 'y');

    positions[task.id] = {
      col: colOf[task.id], row, cx, cy,
      right:  { x: cx + hx, y: cy },
      left:   { x: cx - hx, y: cy },
      bottom: { x: cx,      y: cy + hy },
      top:    { x: cx,      y: cy - hy },
    };

    l4Numbers[task.id] = task.type === 'task' ? `${l3Number}-${taskCounter++}` : null;
  });

  // ── 10. Build connections ──────────────────────────────────────────
const connections = [];
  const taskIdSet = new Set(tasks.map(t => t.id));

  tasks.forEach(task => {
    const fromPos = positions[task.id];

    if (task.type === 'gateway' && task.conditions?.length > 0) {
      task.conditions.forEach(cond => {
        if (!cond.nextTaskId || !taskIdSet.has(cond.nextTaskId)) return;
        const toTask = tasks.find(t => t.id === cond.nextTaskId);
        if (!toTask) return;
        const { exitSide, entrySide } = condRouting.get(`${task.id}::${cond.id}`)
          ?? getGatewayExitEntry(fromPos, positions[toTask.id]);

        let laneBottomY;
        if (exitSide === 'bottom' && entrySide === 'bottom') {
          laneBottomY = bottomYMap[`${task.id}::${cond.nextTaskId}`]
            ?? (Math.max(fromPos.bottom.y, positions[toTask.id].bottom.y) + 24);
        }

        connections.push({ fromId: task.id, toId: toTask.id, label: cond.label, exitSide, entrySide, laneBottomY });
      });

    } else if (task.type !== 'end' && task.type !== 'gateway') {
      const nextIds = task.nextTaskIds?.length
        ? task.nextTaskIds
        : (task.nextTaskId ? [task.nextTaskId] : []);
      nextIds.forEach(nextId => {
        if (!nextId || !taskIdSet.has(nextId)) return;
        const toTask = tasks.find(t => t.id === nextId);
        if (!toTask) return;
        connections.push({ fromId: task.id, toId: toTask.id, label: '', exitSide: 'right', entrySide: 'left', laneBottomY: undefined });
      });
    }
  });

  // ── 11. SVG dimensions ──────────────────────────────────────────────
const maxCol    = Math.max(...Object.values(colOf));
  const totalH    = laneTopY[roles.length - 1] + laneHeights[roles.length - 1];
  const svgWidth  = LANE_HEADER_W + (maxCol + 1) * COL_W + LAYOUT.PADDING_RIGHT;
  const svgHeight = totalH + LAYOUT.PADDING_BOTTOM;

  return { positions, connections, l4Numbers, svgWidth, svgHeight, laneTopY, laneHeights };
}

/**
 * Returns [x,y] waypoints for a 90°-only arrow path.
 * exitSide / entrySide: 'top' | 'right' | 'bottom' | 'left'
 * laneBottomY: pre-computed routing Y for bottom→bottom paths
 */
export function routeArrow(fromPos, toPos, exitSide, entrySide, laneBottomY) {
  const sx = fromPos[exitSide].x;
  const sy = fromPos[exitSide].y;
  const tx = toPos[entrySide].x;
  const ty = toPos[entrySide].y;

  if (Math.abs(sx - tx) < 1 && Math.abs(sy - ty) < 1) return [[sx, sy], [tx, ty]];
  if (Math.abs(sy - ty) < 1) return [[sx, sy], [tx, ty]];
  if (Math.abs(sx - tx) < 1) return [[sx, sy], [tx, ty]];

  // ── bottom → bottom: slotted corridor below lower lane ───────
if (exitSide === 'bottom' && entrySide === 'bottom') {
    const routeY = laneBottomY ?? (Math.max(sy, ty) + 24);
    return [[sx, sy], [sx, routeY], [tx, routeY], [tx, ty]];
  }

  // ── top → top: corridor above higher node ──────────────────
if (exitSide === 'top' && entrySide === 'top') {
    const corridorY = Math.min(sy, ty) - 24;
    return [[sx, sy], [sx, corridorY], [tx, corridorY], [tx, ty]];
  }

  // ── top → left / top → *: 1-bend L-path ───────────────────
if (exitSide === 'top') {
    return [[sx, sy], [sx, ty], [tx, ty]];
  }

  // ── bottom → left: 1-bend L-path (fix issue 3) ──────────────
// Covers both adjacent (dc=1) and skip/multi-lane (dc>1) downward connections.
  if (exitSide === 'bottom' && entrySide === 'left') {
    return [[sx, sy], [sx, ty], [tx, ty]];
  }

  // ── right → left: sequential forward ──────────────────────
if (exitSide === 'right' && sx < tx) {
    const midX = (sx + tx) / 2;
    return [[sx, sy], [midX, sy], [midX, ty], [tx, ty]];
  }

  // ── backward sequential: route above title bar ────────────────
const topY = TITLE_H - 22;
  return [[sx, sy], [sx + 18, sy], [sx + 18, topY], [tx - 18, topY], [tx - 18, ty], [tx, ty]];
}

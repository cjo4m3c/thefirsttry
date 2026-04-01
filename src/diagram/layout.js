import { LAYOUT } from './constants.js';

const { LANE_HEADER_W, COL_W, LANE_H: BASE_LANE_H, TITLE_H, NODE_W, NODE_H, DIAMOND_SIZE, CIRCLE_R } = LAYOUT;

// Fixed vertical offset of node center from lane top (keeps nodes in upper portion)
const NODE_VOFFSET = BASE_LANE_H / 2; // 70px from lane top

// Minimum clearance below the lowest shape in a lane before routing lines begin
const ROUTE_MARGIN = 12;
// Spacing between stacked routing lines
const ROUTE_SLOT_H = 18;
// Bottom margin inside lane after last routing line
const ROUTE_BOTTOM_PAD = 8;

/** The deepest y-offset from lane top that any shape's bottom can reach (gateway = largest) */
const MAX_SHAPE_BOTTOM_OFFSET = NODE_VOFFSET + DIAMOND_SIZE; // 70 + 38 = 108

/**
 * Minimum lane height needed to fit N bottom-routing lines cleanly:
 *   lane top → NODE_VOFFSET (node center) → MAX_SHAPE_BOTTOM_OFFSET (node bottom)
 *     → ROUTE_MARGIN → slot[N-1] → … → slot[0] → ROUTE_BOTTOM_PAD → lane bottom
 */
function minLaneH(numSlots) {
  if (numSlots <= 0) return BASE_LANE_H;
  return MAX_SHAPE_BOTTOM_OFFSET + ROUTE_MARGIN + numSlots * ROUTE_SLOT_H + ROUTE_BOTTOM_PAD;
}

function halfExtent(type, axis) {
  if (type === 'gateway') return DIAMOND_SIZE;
  if (type === 'start' || type === 'end') return CIRCLE_R;
  // 'task', 'interaction', 'l3activity' — same bounding box
  return axis === 'x' ? NODE_W / 2 : NODE_H / 2;
}

/**
 * For a gateway at fromPos connecting to a target at toPos,
 * determine the correct exit and entry sides based on relative position.
 *
 * dr = row diff, dc = col diff (target – source)
 *
 *   same row, adjacent forward (dc=1)           → RIGHT  → LEFT  (simple horizontal)
 *   same row, skip/backward (dc≠1)              → BOTTOM → BOTTOM (route below lane, slotted)
 *   target above, adjacent forward (dr<0, dc=1) → TOP    → LEFT
 *   target above, backward or 2+ skip (dr<0)    → TOP    → TOP   (route above nodes)
 *   target below, adjacent forward (dr>0, dc=1) → BOTTOM → LEFT
 *   target below, backward or 2+ skip (dr>0)    → BOTTOM → BOTTOM (route below lower lane)
 */
function getGatewayExitEntry(fromPos, toPos) {
  const dr = toPos.row - fromPos.row;
  const dc = toPos.col - fromPos.col;

  if (dr < 0) {
    if (dc === 1) return { exitSide: 'top', entrySide: 'left' };
    return { exitSide: 'top', entrySide: 'top' };
  }
  if (dr > 0) {
    if (dc === 1) return { exitSide: 'bottom', entrySide: 'left' };
    return { exitSide: 'bottom', entrySide: 'bottom' };
  }
  if (dc === 1) return { exitSide: 'right', entrySide: 'left' };
  return { exitSide: 'bottom', entrySide: 'bottom' };
}

export function computeLayout(flow) {
  const { roles, tasks, l3Number } = flow;

  // ── 1. Role index map ─────────────────────────────────────────
  const roleIndexMap = {};
  roles.forEach((r, i) => { roleIndexMap[r.id] = i; });

  // Convenience lookups: taskRow / taskCol
  const taskRowOf = {};
  const taskColOf = {};
  tasks.forEach((task, colIdx) => {
    taskRowOf[task.id] = roleIndexMap[task.roleId] ?? 0;
    taskColOf[task.id] = colIdx;
  });

  // ── 2. Count bottom-routing slots needed per lane ─────────────
  // A "bottom-corridor connection" for a lane at row R is any connection where:
  //   – exitSide=BOTTOM AND entrySide=BOTTOM
  //   – and the routing line runs through R's bottom corridor
  //   For same-row connections: affects row R (= fromRow = toRow)
  //   For cross-row connections: affects the LOWER of the two rows
  //
  // We collect all such connections and sort by horizontal span so longer
  // connections get the deepest (largest Y) slot → cleaner diagram.
  const bottomConnsByRow = roles.map(() => []); // [{fromId, toId, span}]

  tasks.forEach(task => {
    if (task.type !== 'gateway') return;
    (task.conditions || []).forEach(cond => {
      if (!cond.nextTaskId || taskRowOf[cond.nextTaskId] === undefined) return;
      const fr = taskRowOf[task.id], fc = taskColOf[task.id];
      const tr = taskRowOf[cond.nextTaskId], tc = taskColOf[cond.nextTaskId];
      const { exitSide, entrySide } = getGatewayExitEntry(
        { row: fr, col: fc }, { row: tr, col: tc }
      );
      if (exitSide === 'bottom' && entrySide === 'bottom') {
        const lowerRow = Math.max(fr, tr);
        bottomConnsByRow[lowerRow].push({
          fromId: task.id,
          toId: cond.nextTaskId,
          span: Math.abs(tc - fc),
        });
      }
    });
  });

  // Sort each lane's list by span descending: longer span → lower (higher Y) slot
  bottomConnsByRow.forEach(arr => arr.sort((a, b) => b.span - a.span));

  // ── 3. Compute per-lane heights ───────────────────────────────
  const laneHeights = roles.map((_, row) => {
    const n = bottomConnsByRow[row].length;
    return Math.max(BASE_LANE_H, minLaneH(n));
  });

  // ── 4. Cumulative lane top Y positions ────────────────────────
  const laneTopY = [];
  let y = TITLE_H;
  roles.forEach((_, row) => {
    laneTopY.push(y);
    y += laneHeights[row];
  });

  // ── 5. Pre-compute slot-based laneBottomY for bottom connections ─
  // Key = `${fromId}::${toId}`, value = absolute Y coordinate
  const bottomYMap = {};
  bottomConnsByRow.forEach((arr, row) => {
    arr.forEach((conn, slotIdx) => {
      // Slot 0 = closest to lane bottom (highest Y), slot N-1 = furthest down
      const slotY = laneTopY[row] + laneHeights[row] - ROUTE_BOTTOM_PAD - slotIdx * ROUTE_SLOT_H;
      bottomYMap[`${conn.fromId}::${conn.toId}`] = slotY;
    });
  });

  // ── 6. Compute node positions ─────────────────────────────────
  const positions = {};
  const l4Numbers = {};
  let taskCounter = 1;

  tasks.forEach((task, colIdx) => {
    const row = taskRowOf[task.id] ?? 0;
    const cx = LANE_HEADER_W + colIdx * COL_W + COL_W / 2;
    // Nodes sit at a fixed offset from lane top (not dynamically centered)
    const cy = laneTopY[row] + NODE_VOFFSET;
    const hx = halfExtent(task.type, 'x');
    const hy = halfExtent(task.type, 'y');

    positions[task.id] = {
      col: colIdx, row, cx, cy,
      right:  { x: cx + hx, y: cy },
      left:   { x: cx - hx, y: cy },
      bottom: { x: cx,      y: cy + hy },
      top:    { x: cx,      y: cy - hy },
    };

    l4Numbers[task.id] = task.type === 'task' ? `${l3Number}.${taskCounter++}` : null;
  });

  // ── 7. Build connections ──────────────────────────────────────
  const connections = [];
  const taskIdSet = new Set(tasks.map(t => t.id));

  tasks.forEach(task => {
    const fromPos = positions[task.id];

    if (task.type === 'gateway' && task.conditions?.length > 0) {
      task.conditions.forEach(cond => {
        if (!cond.nextTaskId || !taskIdSet.has(cond.nextTaskId)) return;
        const toTask = tasks.find(t => t.id === cond.nextTaskId);
        if (!toTask) return;
        const toPos = positions[toTask.id];
        const { exitSide, entrySide } = getGatewayExitEntry(fromPos, toPos);

        let laneBottomY;
        if (exitSide === 'bottom' && entrySide === 'bottom') {
          // Use slot-based Y; fall back to a sensible default
          laneBottomY = bottomYMap[`${task.id}::${cond.nextTaskId}`]
            ?? (Math.max(fromPos.bottom.y, toPos.bottom.y) + 24);
        }

        connections.push({ fromId: task.id, toId: toTask.id, label: cond.label, exitSide, entrySide, laneBottomY });
      });

    } else if (task.type !== 'end' && task.type !== 'gateway') {
      // Support both legacy nextTaskId and new nextTaskIds[]
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

  // ── 8. SVG dimensions ─────────────────────────────────────────
  const totalH = laneTopY[roles.length - 1] + laneHeights[roles.length - 1];
  const svgWidth  = LANE_HEADER_W + tasks.length * COL_W + LAYOUT.PADDING_RIGHT;
  const svgHeight = totalH + LAYOUT.PADDING_BOTTOM;

  return { positions, connections, l4Numbers, svgWidth, svgHeight, laneTopY, laneHeights };
}

/**
 * Returns an array of [x, y] waypoints for a 90-degree-only arrow path.
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

  // ── bottom → bottom ───────────────────────────────────────────
  // Uses pre-computed laneBottomY (slot-based for same-lane, depth-based for cross-lane)
  if (exitSide === 'bottom' && entrySide === 'bottom') {
    const routeY = laneBottomY ?? (Math.max(sy, ty) + 24);
    return [[sx, sy], [sx, routeY], [tx, routeY], [tx, ty]];
  }

  // ── top → top: backward upper lane or 2+ skip ────────────────
  // Route through the space above the higher node (between title bar and lane top)
  if (exitSide === 'top' && entrySide === 'top') {
    const corridorY = Math.min(sy, ty) - 24;
    return [[sx, sy], [sx, corridorY], [tx, corridorY], [tx, ty]];
  }

  // ── top → left: gateway to adjacent upper lane ───────────────
  if (exitSide === 'top') {
    const midY = (sy + ty) / 2;
    return [[sx, sy], [sx, midY], [tx, midY], [tx, ty]];
  }

  // ── bottom → left: gateway to adjacent lower lane ────────────
  if (exitSide === 'bottom' && entrySide === 'left') {
    if (sx <= tx) {
      const midY = sy + (ty - sy) / 2;
      return [[sx, sy], [sx, midY], [tx, midY], [tx, ty]];
    }
    const belowY = sy + 32;
    return [[sx, sy], [sx, belowY], [tx, belowY], [tx, ty]];
  }

  // ── right → left: sequential forward ─────────────────────────
  if (exitSide === 'right' && sx < tx) {
    const midX = (sx + tx) / 2;
    return [[sx, sy], [midX, sy], [midX, ty], [tx, ty]];
  }

  // ── backward sequential: route above title bar ────────────────
  const topY = TITLE_H - 22;
  return [[sx, sy], [sx + 18, sy], [sx + 18, topY], [tx - 18, topY], [tx - 18, ty], [tx, ty]];
}

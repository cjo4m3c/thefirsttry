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
 * Gateway exit port priority table (Phase 1: smart routing).
 *
 * For a given direction (dr = rowDiff, dc = colDiff) from gateway → target,
 * returns the ordered list of preferred exit sides. The greedy assigner below
 * walks this list picking the first side not yet used by another condition.
 *
 * Legacy `getGatewayExitEntry` preserved as fallback for edge cases & tests.
 */
function getExitPriority(dr, dc) {
  if (dr === 0) {
    if (dc === 1)  return ['right',  'bottom', 'top'];   // forward adjacent
    if (dc > 1)    return ['top',    'bottom', 'right']; // forward skip (corridor above)
    return ['top',   'bottom', 'left'];                  // backward / same col
  }
  if (dr < 0) {
    if (dc === 0) return ['top',    'left',   'right'];
    if (dc > 0)   return ['top',    'right',  'bottom'];
    return ['top',   'left',   'bottom'];                // up-left backward
  }
  // dr > 0
  if (dc === 0) return ['bottom', 'left',   'right'];
  if (dc > 0)   return ['bottom', 'right',  'top'];
  return ['bottom', 'left',   'top'];                    // down-left backward
}

/**
 * Infer entry side on target given the chosen exit side and direction.
 *
 * Principle: the entry port should match the direction of approach so the
 * arrow visibly "lands" on the natural side of the target.
 *
 *   exit=right/left (horizontal)
 *     target above/below   → enter via bottom/top (arrow comes in vertically)
 *     target same row      → enter opposite horizontal (sequential flow)
 *
 *   exit=top/bottom (vertical)
 *     target same row      → enter matching vertical side (path uses corridor
 *                            above/below and approaches target from same side)
 *     target other column  → enter via left/right (path turns at target's x)
 *     target same column   → enter opposite vertical (corridor alignment)
 */
function inferEntrySide(exitSide, dr, dc) {
  if (exitSide === 'top' || exitSide === 'bottom') {
    if (dr === 0) return exitSide;        // same row: top→top, bottom→bottom
    if (dc > 0)   return 'left';
    if (dc < 0)   return 'right';
    return exitSide === 'top' ? 'bottom' : 'top';
  }
  // exitSide is 'right' or 'left'
  if (dr < 0) return 'bottom';
  if (dr > 0) return 'top';
  return exitSide === 'right' ? 'left' : 'right';
}

/**
 * Legacy single-pair rule (kept for non-gateway fallbacks & reference).
 *
 *   same row, dc=1 (adjacent forward)     → RIGHT → LEFT
 *   same row, dc≠1 (skip/backward)        → BOTTOM → BOTTOM  (slotted corridor below)
 *   target above, dc=1 (adjacent right)   → TOP   → LEFT    (L-path)
 *   target above, dc≠1                    → TOP   → TOP     (corridor above)
 *   target below, dc≥1 (any right)        → BOTTOM → LEFT   (L-path)
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

/**
 * Prevent same-row same-col collisions: if two tasks in the same swimlane land
 * at the same column (e.g. start circle + gateway both at col 0), shift the
 * later-indexed task rightward and propagate the shift forward along the graph
 * so the topological order is preserved. Iterates until stable.
 */
function resolveRowCollisions(tasks, colOf, taskRowOf) {
  const arrayIdxOf = {};
  tasks.forEach((t, i) => { arrayIdxOf[t.id] = i; });

  const taskIdSet = new Set(tasks.map(t => t.id));
  const successors = {};
  tasks.forEach(t => { successors[t.id] = []; });
  tasks.forEach(task => {
    const nexts = task.type === 'gateway'
      ? (task.conditions || []).map(c => c.nextTaskId)
      : [...(task.nextTaskIds || []), task.nextTaskId].filter(Boolean);
    nexts.forEach(nid => {
      if (!nid || !taskIdSet.has(nid)) return;
      if (arrayIdxOf[nid] <= arrayIdxOf[task.id]) return;
      successors[task.id].push(nid);
    });
  });

  const MAX_ITER = tasks.length * 2 + 2;
  for (let iter = 0; iter < MAX_ITER; iter++) {
    const cells = {};
    tasks.forEach(t => {
      const key = `${taskRowOf[t.id]}::${colOf[t.id]}`;
      (cells[key] = cells[key] || []).push(t.id);
    });

    let fixed = false;
    Object.values(cells).forEach(ids => {
      if (ids.length <= 1) return;
      const sorted = ids.slice().sort((a, b) => arrayIdxOf[a] - arrayIdxOf[b]);
      for (let i = 1; i < sorted.length; i++) {
        const id = sorted[i];
        colOf[id] = colOf[id] + 1;
        const queue = [id];
        const visited = new Set();
        while (queue.length) {
          const cur = queue.shift();
          if (visited.has(cur)) continue;
          visited.add(cur);
          successors[cur].forEach(nid => {
            if (colOf[nid] <= colOf[cur]) {
              colOf[nid] = colOf[cur] + 1;
              queue.push(nid);
            }
          });
        }
        fixed = true;
      }
    });
    if (!fixed) break;
  }
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
  resolveRowCollisions(tasks, colOf, taskRowOf);
  const taskColOf = {};
  tasks.forEach(task => { taskColOf[task.id] = colOf[task.id]; });

  // ── 4. Per-gateway condition routing (smart distribution) ─────
  //
  //   Phase 1: For each gateway, compute an ordered exit-side preference list
  //            per condition based on (dr, dc). Greedy-assign each condition
  //            to its highest-priority side not yet taken by a sibling condition.
  //
  //   Phase 2: After all gateways are processed, scan per-target incoming
  //            connections. If ≥2 connections enter the same side of the same
  //            target, bump the later ones to an alternate entry side where
  //            geometry allows.
  //
  // Key: `${taskId}::${condId}`  Value: {exitSide, entrySide}
  const condRouting = new Map();
  const incomingByTarget = {};

  tasks.forEach(task => {
    if (task.type !== 'gateway' || !task.conditions?.length) return;
    const fr = taskRowOf[task.id], fc = taskColOf[task.id];
    const usedExits = new Set();

    // Sort conditions so that the one with the most constrained direction
    // (forward-adjacent) gets its preferred side first. Conditions farther
    // away or backward yield when there's a conflict.
    const prioritized = task.conditions
      .filter(c => c.nextTaskId && taskRowOf[c.nextTaskId] !== undefined)
      .map(c => {
        const dr = taskRowOf[c.nextTaskId] - fr;
        const dc = taskColOf[c.nextTaskId] - fc;
        return { cond: c, dr, dc, priorities: getExitPriority(dr, dc) };
      });

    // Sort: forward-adjacent (dc=1, dr=0) first, then by Manhattan distance asc
    prioritized.sort((a, b) => {
      const adjA = (a.dr === 0 && a.dc === 1) ? 0 : 1;
      const adjB = (b.dr === 0 && b.dc === 1) ? 0 : 1;
      if (adjA !== adjB) return adjA - adjB;
      return (Math.abs(a.dr) + Math.abs(a.dc)) - (Math.abs(b.dr) + Math.abs(b.dc));
    });

    prioritized.forEach(({ cond, dr, dc, priorities }) => {
      let exitSide = priorities.find(p => !usedExits.has(p)) ?? priorities[0];
      let entrySide = inferEntrySide(exitSide, dr, dc);
      usedExits.add(exitSide);
      condRouting.set(`${task.id}::${cond.id}`, { exitSide, entrySide });

      (incomingByTarget[cond.nextTaskId] ||= []).push({
        key: `${task.id}::${cond.id}`, fromId: task.id, dr: -dr, dc: -dc, entrySide,
      });
    });
  });

  // Phase 2: dedup entry sides per target (only for gateway targets, which
  // reliably have 4 ports; tasks use left→right model and don't need it).
  tasks.forEach(target => {
    if (target.type !== 'gateway') return;
    const incs = incomingByTarget[target.id];
    if (!incs || incs.length < 2) return;

    const usedEntries = new Set();
    // Order: forward-adjacent-left first (dc=-1, dr=0 from target POV means source is left neighbor)
    incs.sort((a, b) => {
      const adjA = (a.dr === 0 && a.dc === -1) ? 0 : 1;
      const adjB = (b.dr === 0 && b.dc === -1) ? 0 : 1;
      if (adjA !== adjB) return adjA - adjB;
      return (Math.abs(a.dr) + Math.abs(a.dc)) - (Math.abs(b.dr) + Math.abs(b.dc));
    });

    incs.forEach(inc => {
      const { key, entrySide: preferred, dr, dc } = inc;
      // Build entry-priority: original choice first, then alternates by direction
      const entryPriorities = [preferred, ...['left', 'top', 'bottom', 'right'].filter(s => s !== preferred)];
      // Filter to geometrically sensible entries given (dr, dc) from target POV.
      //   dr>0 (source above target): top is sensible; bottom less so.
      //   dr<0 (source below): bottom sensible.
      //   dc>0 (source to right): right sensible; left less so.
      //   dc<0 (source to left): left sensible.
      // dr/dc here are FROM-TARGET-POV (source relative to target).
      //   dr < 0 → source above target → entering TOP natural, BOTTOM awkward
      //   dr > 0 → source below target → entering BOTTOM natural, TOP awkward
      //   dc < 0 → source left of target → entering LEFT natural, RIGHT awkward
      //   dc > 0 → source right of target → entering RIGHT natural, LEFT awkward
      const sensible = entryPriorities.filter(s => {
        if (s === 'top'    && dr > 0)  return false;
        if (s === 'bottom' && dr < 0)  return false;
        if (s === 'left'   && dc > 0)  return false;
        if (s === 'right'  && dc < 0)  return false;
        return true;
      });
      const finalEntry = sensible.find(s => !usedEntries.has(s)) ?? preferred;
      usedEntries.add(finalEntry);
      if (finalEntry !== preferred) {
        const r = condRouting.get(key);
        condRouting.set(key, { exitSide: r.exitSide, entrySide: finalEntry });
      }
    });
  });

  // ── 4c. Phase 3: corridor conflict detection across gateways ─────
  //
  // Phase 1+2 only consider sibling conflicts within a single gateway.
  // When two DIFFERENT gateways both route via the TOP corridor of the
  // same row with overlapping column spans, their horizontal segments
  // land on (nearly) the same y and visually overlap.
  //
  // Strategy: walk every gateway condition in deterministic order
  // (short Manhattan first — short forward flows keep their natural
  // choice, long / backward flows yield). For each condition, if its
  // chosen corridor overlaps an already-registered corridor, advance
  // through the exit-side priority list to find a non-conflicting one
  // that hasn't been taken by a sibling of the same gateway. Then
  // register the accepted corridor so later conditions see it.
  //
  // Only the TOP corridor is Phase-3-controlled here; the bottom lane
  // corridor already has a slot-allocation system (step 5/8).
  const topCorridorByRow = new Map();

  function hasTopConflict(row, minCol, maxCol) {
    const arr = topCorridorByRow.get(row) || [];
    return arr.some(([a, b]) => !(b < minCol || maxCol < a));
  }
  function registerTopCorridor(row, minCol, maxCol) {
    if (!topCorridorByRow.has(row)) topCorridorByRow.set(row, []);
    topCorridorByRow.get(row).push([minCol, maxCol]);
  }
  function topCorridorRange(exitSide, entrySide, fr, fc, tr, tc) {
    if (exitSide !== 'top') return null;
    // top→top (dr=0 same row, or corridor detour when target crosses back)
    // and top→left/right with same-row target (needsCorridor detour) both
    // occupy a horizontal segment above the min-row lane.
    if (entrySide === 'top' || fr === tr) {
      return {
        row: Math.min(fr, tr),
        minCol: Math.min(fc, tc),
        maxCol: Math.max(fc, tc),
      };
    }
    return null;
  }

  const allGatewayConds = [];
  tasks.forEach(task => {
    if (task.type !== 'gateway' || !task.conditions?.length) return;
    const fr = taskRowOf[task.id], fc = taskColOf[task.id];
    task.conditions.forEach(cond => {
      const tr = taskRowOf[cond.nextTaskId];
      const tc = taskColOf[cond.nextTaskId];
      if (tr === undefined || tc === undefined) return;
      const dr = tr - fr, dc = tc - fc;
      allGatewayConds.push({
        key: `${task.id}::${cond.id}`,
        gatewayId: task.id,
        fr, fc, tr, tc, dr, dc,
        priorities: getExitPriority(dr, dc),
      });
    });
  });

  allGatewayConds.sort((a, b) =>
    (Math.abs(a.dr) + Math.abs(a.dc)) - (Math.abs(b.dr) + Math.abs(b.dc))
  );

  const usedExitsByGateway = new Map();
  const gatewayUsed = (gid) => {
    if (!usedExitsByGateway.has(gid)) usedExitsByGateway.set(gid, new Set());
    return usedExitsByGateway.get(gid);
  };

  allGatewayConds.forEach(c => {
    const r0 = condRouting.get(c.key);
    if (!r0) return;
    const used = gatewayUsed(c.gatewayId);

    const candidates = [r0.exitSide, ...c.priorities.filter(p => p !== r0.exitSide)];

    let accepted = null;
    for (const p of candidates) {
      if (p !== r0.exitSide && used.has(p)) continue;
      const testEntry = inferEntrySide(p, c.dr, c.dc);
      const range = topCorridorRange(p, testEntry, c.fr, c.fc, c.tr, c.tc);
      if (range && hasTopConflict(range.row, range.minCol, range.maxCol)) continue;
      accepted = { exit: p, entry: testEntry, range };
      break;
    }
    if (!accepted) {
      accepted = { exit: r0.exitSide, entry: r0.entrySide, range: null };
    }

    used.add(accepted.exit);
    if (accepted.exit !== r0.exitSide || accepted.entry !== r0.entrySide) {
      condRouting.set(c.key, { exitSide: accepted.exit, entrySide: accepted.entry });
    }
    if (accepted.range) registerTopCorridor(accepted.range.row, accepted.range.minCol, accepted.range.maxCol);
  });

  // ── 4d. Phase 3b: non-gateway backward edge corridor decision ────
  //
  // A regular task's backward nextTaskId (e.g. 迴圈返回至 X) is drawn as
  // top→top by default. If the top corridor at that row is already taken
  // by a gateway condition (registered in Phase 3), route this backward
  // edge via bottom→bottom instead, so it doesn't overlap.
  //
  // Bottom→bottom edges join the existing slot-allocation pipeline
  // (step 5) so the lane auto-expands to fit.
  const taskIdSetAll = new Set(tasks.map(t => t.id));
  const taskBackwardRouting = new Map();  // key: `${fromId}::${toId}` → { exitSide, entrySide }

  tasks.forEach(task => {
    if (task.type === 'end' || task.type === 'gateway' || task.type === 'start') return;
    const nextIds = task.nextTaskIds?.length ? task.nextTaskIds : (task.nextTaskId ? [task.nextTaskId] : []);
    const fr = taskRowOf[task.id], fc = taskColOf[task.id];
    nextIds.forEach(toId => {
      if (!toId || !taskIdSetAll.has(toId)) return;
      const tr = taskRowOf[toId], tc = taskColOf[toId];
      if (tr === undefined || tc === undefined) return;
      const isBackward = (tc < fc) || (tc === fc && tr < fr);
      if (!isBackward) return;

      const row = Math.min(fr, tr);
      const minCol = Math.min(fc, tc);
      const maxCol = Math.max(fc, tc);
      if (hasTopConflict(row, minCol, maxCol)) {
        taskBackwardRouting.set(`${task.id}::${toId}`, { exitSide: 'bottom', entrySide: 'bottom' });
      } else {
        taskBackwardRouting.set(`${task.id}::${toId}`, { exitSide: 'top', entrySide: 'top' });
        registerTopCorridor(row, minCol, maxCol);
      }
    });
  });

  // ── 5. Count bottom-routing slots needed per lane ─────────────
  const bottomConnsByRow = roles.map(() => []);
  tasks.forEach(task => {
    if (task.type === 'gateway') {
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
    } else if (task.type !== 'end' && task.type !== 'start') {
      // Non-gateway backward edges that Phase 3b pushed to bottom corridor
      const nextIds = task.nextTaskIds?.length ? task.nextTaskIds : (task.nextTaskId ? [task.nextTaskId] : []);
      nextIds.forEach(toId => {
        const routing = taskBackwardRouting.get(`${task.id}::${toId}`);
        if (!routing) return;
        if (routing.exitSide === 'bottom' && routing.entrySide === 'bottom') {
          const fr = taskRowOf[task.id];
          const tr = taskRowOf[toId];
          const fc = taskColOf[task.id];
          const tc = taskColOf[toId];
          bottomConnsByRow[Math.max(fr, tr)].push({
            fromId: task.id,
            toId,
            span: Math.abs(tc - fc),
          });
        }
      });
    }
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

    // Use stored l4Number (from Excel import) whenever present so imported
    // gateways retain their `_g` suffix label; fall back to sequential counter
    // for manually-created tasks without a stored number.
    //
    // Safety net: if a gateway's stored number lacks `_g` (e.g. legacy data
    // that slipped past storage migration, or a Wizard-created gateway),
    // force append `_g` for display so the diagram consistently shows the
    // gateway naming rule.
    if (task.l4Number) {
      let label = String(task.l4Number);
      if (task.type === 'gateway' && !/_g\d*$/.test(label)) label += '_g';
      l4Numbers[task.id] = label;
    } else if (task.type === 'task') {
      l4Numbers[task.id] = `${l3Number}-${taskCounter++}`;
    } else {
      l4Numbers[task.id] = null;
    }
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
        // Forward (default right→left) / backward (Phase 3b decision: top→top
        // unless top corridor is already occupied, in which case bottom→bottom
        // via the slot-allocated lane-bottom corridor).
        const routing = taskBackwardRouting.get(`${task.id}::${nextId}`);
        let exitSide, entrySide, laneBottomY;
        if (routing) {
          exitSide = routing.exitSide;
          entrySide = routing.entrySide;
          if (exitSide === 'bottom' && entrySide === 'bottom') {
            laneBottomY = bottomYMap[`${task.id}::${nextId}`]
              ?? (Math.max(fromPos.bottom.y, positions[toTask.id].bottom.y) + 24);
          }
        } else {
          exitSide = 'right';
          entrySide = 'left';
        }
        connections.push({ fromId: task.id, toId: toTask.id, label: '', exitSide, entrySide, laneBottomY });
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

  // Degenerate: already aligned → single segment
  if (Math.abs(sx - tx) < 1 && Math.abs(sy - ty) < 1) return [[sx, sy], [tx, ty]];
  if (Math.abs(sy - ty) < 1) return [[sx, sy], [tx, ty]];
  if (Math.abs(sx - tx) < 1) return [[sx, sy], [tx, ty]];

  // ── Parallel corridors (same side in / out) ───────────────────
  if (exitSide === 'bottom' && entrySide === 'bottom') {
    const routeY = laneBottomY ?? (Math.max(sy, ty) + 24);
    return [[sx, sy], [sx, routeY], [tx, routeY], [tx, ty]];
  }
  if (exitSide === 'top' && entrySide === 'top') {
    const corridorY = Math.min(sy, ty) - 24;
    return [[sx, sy], [sx, corridorY], [tx, corridorY], [tx, ty]];
  }
  if (exitSide === 'left' && entrySide === 'left') {
    const corridorX = Math.min(sx, tx) - 24;
    return [[sx, sy], [corridorX, sy], [corridorX, ty], [tx, ty]];
  }
  if (exitSide === 'right' && entrySide === 'right') {
    const corridorX = Math.max(sx, tx) + 24;
    return [[sx, sy], [corridorX, sy], [corridorX, ty], [tx, ty]];
  }

  // ── Vertical exit (top/bottom) → any other entry ──
  // If target sits on the same side of source as the exit (ty would fall back
  // through the source shape with a naive 1-bend), use a corridor detour.
  if (exitSide === 'top' || exitSide === 'bottom') {
    const needsCorridor = (exitSide === 'top' && ty >= sy) || (exitSide === 'bottom' && ty <= sy);
    if (needsCorridor) {
      const corridorY = exitSide === 'top' ? (sy - 24) : (sy + 24);
      return [[sx, sy], [sx, corridorY], [tx, corridorY], [tx, ty]];
    }
    return [[sx, sy], [sx, ty], [tx, ty]];
  }

  // ── Horizontal exit → horizontal entry (opposite sides) ─────
  // right → left: forward midX if target is to the right; else loop above title bar
  if (exitSide === 'right' && entrySide === 'left') {
    if (sx < tx) {
      const midX = (sx + tx) / 2;
      return [[sx, sy], [midX, sy], [midX, ty], [tx, ty]];
    }
    const topY = TITLE_H - 22;
    return [[sx, sy], [sx + 18, sy], [sx + 18, topY], [tx - 18, topY], [tx - 18, ty], [tx, ty]];
  }
  if (exitSide === 'left' && entrySide === 'right') {
    // Backward loop via corridor above title bar
    const topY = TITLE_H - 22;
    return [[sx, sy], [sx - 18, sy], [sx - 18, topY], [tx + 18, topY], [tx + 18, ty], [tx, ty]];
  }

  // ── Horizontal exit → vertical entry (top/bottom): horizontal-first 1-bend ──
  return [[sx, sy], [tx, sy], [tx, ty]];
}

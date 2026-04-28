import { LAYOUT } from '../constants.js';
import { computeDisplayLabels } from '../../utils/taskDefs.js';
import {
  NODE_VOFFSET, ROUTE_MARGIN, ROUTE_SLOT_H, ROUTE_BOTTOM_PAD,
  minLaneH, halfExtent,
} from './helpers.js';
import { computeColumnMap, resolveRowCollisions } from './columnAssign.js';
import { getGatewayExitEntry } from './gatewayRouting.js';
import { runPhase1And2 } from './phase1and2.js';
import { runPhase3 } from './phase3.js';
import { runPhase3b, runPhase3c } from './phase3bc.js';
import { runPhase3d } from './phase3d.js';
import { runPhase3e } from './phase3e.js';

const { LANE_HEADER_W, COL_W, LANE_H: BASE_LANE_H, TITLE_H } = LAYOUT;

export function computeLayout(flow) {
  const { roles, tasks, l3Number } = flow;

  // ── 1. Role index map ──────────────────────────────────────
  const roleIndexMap = {};
  roles.forEach((r, i) => { roleIndexMap[r.id] = i; });

  // ── 2. Row lookups ────────────────────────────────────
  const taskRowOf = {};
  tasks.forEach(task => { taskRowOf[task.id] = roleIndexMap[task.roleId] ?? 0; });

  // ── 3. Graph-based column assignment (parallel = same col) ────
  const colOf = computeColumnMap(tasks);
  resolveRowCollisions(tasks, colOf, taskRowOf);
  const taskColOf = {};
  tasks.forEach(task => { taskColOf[task.id] = colOf[task.id]; });

  // Task-at-cell lookup is used by both Phase 3 (corridor guard against
  // future Phase 3d verticals) and Phase 3d itself.
  const cellTaskId = {};
  tasks.forEach(t => {
    const r = taskRowOf[t.id], c = taskColOf[t.id];
    if (r !== undefined && c !== undefined) cellTaskId[`${r}::${c}`] = t.id;
  });
  const taskAt = (r, c) => cellTaskId[`${r}::${c}`];
  const taskIdSetAll = new Set(tasks.map(t => t.id));

  // ── Phase 1+2 / 3 / 3b / 3c / 3d / 3e via shared mutable ctx ──
  const ctx = {
    tasks, taskRowOf, taskColOf, taskAt, taskIdSetAll,
    condRouting:           new Map(),   // `${gid}::${condId}` → { exitSide, entrySide }
    incomingByTarget:      {},
    topCorridorByRow:      new Map(),   // row → [[minCol, maxCol], ...]
    portIn:                new Map(),   // `${id}::${side}` → count
    portOut:               new Map(),
    taskBackwardRouting:   new Map(),   // `${fromId}::${toId}` → { exitSide, entrySide }
    taskForwardRouting:    new Map(),
    taskCrossLaneRouting:  new Map(),
  };

  runPhase1And2(ctx);
  runPhase3(ctx);
  runPhase3b(ctx);
  runPhase3c(ctx);
  runPhase3d(ctx);
  runPhase3e(ctx);

  const { condRouting, taskBackwardRouting, taskForwardRouting, taskCrossLaneRouting } = ctx;

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
      // Non-gateway edges pushed to bottom corridor by Phase 3b (backward),
      // Phase 3c (forward with dc>1 where top corridor was already taken),
      // or Phase 3e (user override routed to bottom→bottom).
      const nextIds = task.nextTaskIds?.length ? task.nextTaskIds : (task.nextTaskId ? [task.nextTaskId] : []);
      nextIds.forEach(toId => {
        const routing = taskBackwardRouting.get(`${task.id}::${toId}`)
                     ?? taskForwardRouting.get(`${task.id}::${toId}`)
                     ?? taskCrossLaneRouting.get(`${task.id}::${toId}`);
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

  // Slot ordering rule: user wants the reading flow to match target /
  // source column order ("依照下一個任務的順序依序連線").
  //
  // Top corridor: slotIdx 0 sits just above the lane (innermost). So
  //   smaller target col → smaller slotIdx → innermost. Ascending sort.
  //
  // Bottom corridor: slotIdx 0 sits at lane bottom (FURTHEST from tasks,
  //   i.e. outermost). So smaller target col → largest slotIdx → inner.
  //   Reverse sort.
  //
  // Tiebreaker: when targets match, shorter span goes to inner slot so
  // nested ranges don't draw crossing horizontals (wider corridor
  // surrounds the narrower one).
  const slotSortAsc = (a, b) => {
    const tDiff = taskColOf[a.toId] - taskColOf[b.toId];
    if (tDiff !== 0) return tDiff;
    const spanA = Math.abs(taskColOf[a.toId] - taskColOf[a.fromId]);
    const spanB = Math.abs(taskColOf[b.toId] - taskColOf[b.fromId]);
    return spanA - spanB;
  };
  const slotSortDesc = (a, b) => -slotSortAsc(a, b);
  bottomConnsByRow.forEach(arr => arr.sort(slotSortDesc));

  // ── 6. Per-lane heights ────────────────────────────────────────────
  const laneHeights = roles.map((_, row) => {
    return Math.max(BASE_LANE_H, minLaneH(bottomConnsByRow[row].length));
  });

  // ── 6b. Collect top-corridor connections per row for slot allocation ──
  // Any connection whose routing ends up as top→top occupies a horizontal
  // segment above the lower-row lane. When several such connections share
  // a row, they must sit on distinct y-levels (slots) so they don't stack.
  const topConnsByRow = roles.map(() => []);
  tasks.forEach(task => {
    if (task.type === 'gateway') {
      (task.conditions || []).forEach(cond => {
        if (!cond.nextTaskId || taskRowOf[cond.nextTaskId] === undefined) return;
        const routing = condRouting.get(`${task.id}::${cond.id}`);
        if (!routing) return;
        if (routing.exitSide === 'top' && routing.entrySide === 'top') {
          const fr = taskRowOf[task.id], tr = taskRowOf[cond.nextTaskId];
          const fc = taskColOf[task.id], tc = taskColOf[cond.nextTaskId];
          topConnsByRow[Math.min(fr, tr)].push({
            fromId: task.id, toId: cond.nextTaskId, span: Math.abs(tc - fc),
          });
        }
      });
    } else if (task.type !== 'end' && task.type !== 'start') {
      const nextIds = task.nextTaskIds?.length ? task.nextTaskIds : (task.nextTaskId ? [task.nextTaskId] : []);
      nextIds.forEach(toId => {
        if (!toId || taskRowOf[toId] === undefined) return;
        const routing = taskBackwardRouting.get(`${task.id}::${toId}`)
                     ?? taskForwardRouting.get(`${task.id}::${toId}`)
                     ?? taskCrossLaneRouting.get(`${task.id}::${toId}`);
        if (!routing) return;
        if (routing.exitSide === 'top' && routing.entrySide === 'top') {
          const fr = taskRowOf[task.id], tr = taskRowOf[toId];
          const fc = taskColOf[task.id], tc = taskColOf[toId];
          topConnsByRow[Math.min(fr, tr)].push({
            fromId: task.id, toId, span: Math.abs(tc - fc),
          });
        }
      });
    }
  });
  topConnsByRow.forEach(arr => arr.sort(slotSortAsc));

  // ── 7. Cumulative lane top Y ─────────────────────────────────────────
  // Reserve extra space above each lane for its top-corridor slots.
  // Row 0 expands the title-bar gap so arrows don't collide with the title.
  const laneTopY = [];
  let y = TITLE_H;
  roles.forEach((_, row) => {
    const topSlots = topConnsByRow[row].length;
    if (topSlots > 0) y += ROUTE_MARGIN + topSlots * ROUTE_SLOT_H;
    laneTopY.push(y);
    y += laneHeights[row];
  });

  // ── 8. Slot-based corridors ────────────────────────────────────────────
  //   - bottomYMap: y-level for bottom→bottom edges (below each lane)
  //   - topYMap: y-level for top→top edges (above each lane)
  const bottomYMap = {};
  bottomConnsByRow.forEach((arr, row) => {
    arr.forEach((conn, slotIdx) => {
      const slotY = laneTopY[row] + laneHeights[row] - ROUTE_BOTTOM_PAD - slotIdx * ROUTE_SLOT_H;
      bottomYMap[`${conn.fromId}::${conn.toId}`] = slotY;
    });
  });
  const topYMap = {};
  topConnsByRow.forEach((arr, row) => {
    // slot 0 sits closest to the lane top; each additional slot moves upward.
    arr.forEach((conn, slotIdx) => {
      const slotY = laneTopY[row] - ROUTE_MARGIN - slotIdx * ROUTE_SLOT_H;
      topYMap[`${conn.fromId}::${conn.toId}`] = slotY;
    });
  });

  // ── 9. Node positions + unified L4 labels ──────────────────────────────
  //
  // Labels come from `computeDisplayLabels` (src/utils/taskDefs.js) so the
  // diagram and the editor dropdowns stay in sync: start gets `-0`, end
  // gets `-99`, gateways get `${lastTask}_g` (or `_g2`, `_g3` when
  // consecutive), regular tasks count from 1.
  const positions = {};
  const l4Numbers = computeDisplayLabels(tasks, l3Number);

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
  });

  // ── 10. Build connections ────────────────────────────────────────────
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

        let laneBottomY, laneTopCorridorY;
        if (exitSide === 'bottom' && entrySide === 'bottom') {
          laneBottomY = bottomYMap[`${task.id}::${cond.nextTaskId}`]
            ?? (Math.max(fromPos.bottom.y, positions[toTask.id].bottom.y) + 24);
        } else if (exitSide === 'top' && entrySide === 'top') {
          laneTopCorridorY = topYMap[`${task.id}::${cond.nextTaskId}`];
        }

        connections.push({
          fromId: task.id, toId: toTask.id, label: cond.label,
          exitSide, entrySide, laneBottomY, laneTopCorridorY,
          // `overrideKey` tells DiagramRenderer's drag handler which slot in
          // `task.connectionOverrides` to write to on drop. For gateway
          // conditions it's cond.id (one condition may be one of several
          // pointing at the same target); for regular tasks it's toId.
          overrideKey: cond.id, condId: cond.id,
        });
      });

    } else if (task.type !== 'end' && task.type !== 'gateway') {
      const nextIds = task.nextTaskIds?.length
        ? task.nextTaskIds
        : (task.nextTaskId ? [task.nextTaskId] : []);
      nextIds.forEach(nextId => {
        if (!nextId || !taskIdSet.has(nextId)) return;
        const toTask = tasks.find(t => t.id === nextId);
        if (!toTask) return;
        // Forward short (default right→left) / backward (Phase 3b: top or
        // bottom based on top corridor occupancy) / forward long (Phase 3c:
        // top corridor to skip over intermediate elements) / cross-lane
        // with obstacle avoidance (Phase 3d: source top/bottom exit or
        // target top/bottom entry to skip around tasks at source/target rows)
        // / user override (Phase 3e: manual endpoint drag in UI).
        const routing = taskBackwardRouting.get(`${task.id}::${nextId}`)
                     ?? taskForwardRouting.get(`${task.id}::${nextId}`)
                     ?? taskCrossLaneRouting.get(`${task.id}::${nextId}`);
        let exitSide, entrySide, laneBottomY, laneTopCorridorY;
        if (routing) {
          exitSide = routing.exitSide;
          entrySide = routing.entrySide;
          if (exitSide === 'bottom' && entrySide === 'bottom') {
            laneBottomY = bottomYMap[`${task.id}::${nextId}`]
              ?? (Math.max(fromPos.bottom.y, positions[toTask.id].bottom.y) + 24);
          } else if (exitSide === 'top' && entrySide === 'top') {
            laneTopCorridorY = topYMap[`${task.id}::${nextId}`];
          }
        } else {
          exitSide = 'right';
          entrySide = 'left';
        }
        connections.push({
          fromId: task.id, toId: toTask.id, label: '',
          exitSide, entrySide, laneBottomY, laneTopCorridorY,
          overrideKey: nextId,
        });
      });
    }
  });

  // ── 11. SVG dimensions ────────────────────────────────────────────
  const maxCol    = Math.max(...Object.values(colOf));
  const totalH    = laneTopY[roles.length - 1] + laneHeights[roles.length - 1];
  const svgWidth  = LANE_HEADER_W + (maxCol + 1) * COL_W + LAYOUT.PADDING_RIGHT;
  const svgHeight = totalH + LAYOUT.PADDING_BOTTOM;

  return { positions, connections, l4Numbers, svgWidth, svgHeight, laneTopY, laneHeights };
}

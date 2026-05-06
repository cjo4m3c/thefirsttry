import { isPathClear, hasIn, hasOut, useIn, useOut } from './corridor.js';

/**
 * Phase 3f — L1 post-validation retry (preview branch 2026-05-06).
 *
 * After Phase 1+2/3/3b/3c/3d/3e have all picked routes, walk every connection
 * and check whether its current (exit, entry) actually produces a clean
 * path (rule 1 + rule 2). If not, try all 16 combinations and switch to the
 * first one that passes. Mutates `condRouting` / task*Routing maps so the
 * downstream slot allocation + routeArrow rendering pick up the new sides.
 *
 * Coverage:
 *   - Gateway conditions (condRouting): always present in map
 *   - Non-gateway forward/backward/cross-lane: routing entry exists in
 *     one of taskBackwardRouting / taskForwardRouting / taskCrossLaneRouting
 *   - **Default right→left non-gateway forwards** (no routing entry):
 *     these were the silent majority — Phase 3f now retries them too,
 *     writing alternatives into taskCrossLaneRouting so computeLayout's
 *     fallback lookup picks them up.
 *
 * Port claims for default-routed connections are pre-registered so the
 * isPathClear rule-1 check sees them. Swap order tries top→top corridor
 * first (ALL_SIDES = ['top', 'right', 'bottom', 'left']) so cross-lane
 * detours win over horizontal-cut alternatives.
 */
const ALL_SIDES = ['top', 'right', 'bottom', 'left'];

export function runPhase3f(ctx) {
  const {
    tasks, taskRowOf, taskColOf,
    condRouting, taskBackwardRouting, taskForwardRouting, taskCrossLaneRouting,
  } = ctx;

  // ── Pre-pass: register default right→left port claims for non-gateway
  // forwards that lack a routing entry. Without this, isPathClear's rule-1
  // check cannot see the implicit port usage and may permit a port-mix
  // alternative.
  tasks.forEach(task => {
    if (task.type === 'gateway' || task.type === 'end' || task.type === 'start') return;
    const nextIds = task.nextTaskIds?.length
      ? task.nextTaskIds
      : (task.nextTaskId ? [task.nextTaskId] : []);
    nextIds.forEach(toId => {
      if (!toId || taskRowOf[toId] === undefined) return;
      const key = `${task.id}::${toId}`;
      if (taskBackwardRouting.has(key) || taskForwardRouting.has(key)
          || taskCrossLaneRouting.has(key)) return;
      // Default = right→left. Claim ports so subsequent rule-1 checks see them.
      useOut(ctx, task.id, 'right');
      useIn(ctx, toId, 'left');
    });
  });

  // ── Main pass: retry violating connections.
  const trySwap = (fromId, toId, currentExit, currentEntry, applyFn) => {
    const fr = taskRowOf[fromId], fc = taskColOf[fromId];
    const tr = taskRowOf[toId],   tc = taskColOf[toId];
    if (fr === undefined || tr === undefined) return;

    if (isPathClearAfterRelease(currentExit, currentEntry, fr, fc, tr, tc,
                                ctx, fromId, toId)) return;

    for (const exit of ALL_SIDES) {
      for (const entry of ALL_SIDES) {
        if (exit === currentExit && entry === currentEntry) continue;
        if (isPathClearAfterRelease(exit, entry, fr, fc, tr, tc,
                                    ctx, fromId, toId)) {
          decUseOut(ctx, fromId, currentExit);
          decUseIn(ctx, toId, currentEntry);
          useOut(ctx, fromId, exit);
          useIn(ctx, toId, entry);
          applyFn(exit, entry);
          return;
        }
      }
    }
  };

  // Gateway conditions
  tasks.forEach(task => {
    if (task.type !== 'gateway' || !task.conditions) return;
    task.conditions.forEach(cond => {
      if (!cond.nextTaskId) return;
      const key = `${task.id}::${cond.id}`;
      const cur = condRouting.get(key);
      if (!cur) return;
      trySwap(task.id, cond.nextTaskId, cur.exitSide, cur.entrySide,
        (exit, entry) => condRouting.set(key, { exitSide: exit, entrySide: entry }));
    });
  });

  // Non-gateway forwards (with or without explicit routing entry)
  tasks.forEach(task => {
    if (task.type === 'gateway' || task.type === 'end' || task.type === 'start') return;
    const nextIds = task.nextTaskIds?.length
      ? task.nextTaskIds
      : (task.nextTaskId ? [task.nextTaskId] : []);
    nextIds.forEach(toId => {
      if (!toId || taskRowOf[toId] === undefined) return;
      const key = `${task.id}::${toId}`;
      const map = taskBackwardRouting.has(key)
        ? taskBackwardRouting
        : taskForwardRouting.has(key)
        ? taskForwardRouting
        : taskCrossLaneRouting.has(key)
        ? taskCrossLaneRouting
        : null;
      if (map) {
        const cur = map.get(key);
        trySwap(task.id, toId, cur.exitSide, cur.entrySide,
          (exit, entry) => map.set(key, { exitSide: exit, entrySide: entry }));
      } else {
        // Default right→left — write alternative to taskCrossLaneRouting
        // so computeLayout's fallback lookup sees the override.
        trySwap(task.id, toId, 'right', 'left',
          (exit, entry) => taskCrossLaneRouting.set(key, { exitSide: exit, entrySide: entry }));
      }
    });
  });
}

function isPathClearAfterRelease(exit, entry, fr, fc, tr, tc, ctx, fromId, toId) {
  const decAndKey = (mp, id, side) => {
    const k = `${id}::${side}`;
    const v = mp.get(k) || 0;
    if (v > 0) mp.set(k, v - 1);
    return { k, mp, restored: v };
  };
  const restoreClaim = (entry) => {
    if (entry.restored !== undefined) entry.mp.set(entry.k, entry.restored);
  };
  const a = decAndKey(ctx.portOut, fromId, exit);
  const b = decAndKey(ctx.portIn,  toId,   entry);

  const result = isPathClear(exit, entry, fr, fc, tr, tc, ctx, fromId, toId);

  restoreClaim(a);
  restoreClaim(b);
  return result;
}

function decUseOut(ctx, id, side) {
  const k = `${id}::${side}`;
  const v = ctx.portOut.get(k) || 0;
  if (v > 0) ctx.portOut.set(k, v - 1);
}
function decUseIn(ctx, id, side) {
  const k = `${id}::${side}`;
  const v = ctx.portIn.get(k) || 0;
  if (v > 0) ctx.portIn.set(k, v - 1);
}

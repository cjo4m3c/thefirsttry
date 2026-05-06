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
 * Conservative scope:
 *   - Skip user-overridden connections (Phase 3e set them per user intent)
 *   - Skip connections whose default sides already pass — only retry red ones
 *   - When no combination passes, leave the existing routing as-is so the
 *     violation surfaces in violations.js (red line) for the user
 *
 * `isPathClear` here uses the same predicate as Phase 1 mixed priority so
 * the two layers agree on what counts as "clean".
 */
const ALL_SIDES = ['top', 'right', 'bottom', 'left'];

export function runPhase3f(ctx) {
  const {
    tasks, taskRowOf, taskColOf,
    condRouting, taskBackwardRouting, taskForwardRouting, taskCrossLaneRouting,
  } = ctx;

  // Connections to retry: { key, fromId, toId, current: {exitSide,entrySide},
  //                        routingMap, isUserOverride }
  // Walk gateway conditions first, then non-gateway forward / backward edges.
  const trySwap = (fromId, toId, currentExit, currentEntry, applyFn) => {
    const fr = taskRowOf[fromId], fc = taskColOf[fromId];
    const tr = taskRowOf[toId],   tc = taskColOf[toId];
    if (fr === undefined || tr === undefined) return;

    // Already clean? skip.
    if (isPathClearAfterRelease(currentExit, currentEntry, fr, fc, tr, tc,
                                ctx, fromId, toId)) return;

    for (const exit of ALL_SIDES) {
      for (const entry of ALL_SIDES) {
        if (exit === currentExit && entry === currentEntry) continue;
        if (isPathClearAfterRelease(exit, entry, fr, fc, tr, tc,
                                    ctx, fromId, toId)) {
          // Update port counts: release old, claim new
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

  // Gateway conditions (condRouting)
  tasks.forEach(task => {
    if (task.type !== 'gateway' || !task.conditions) return;
    task.conditions.forEach(cond => {
      if (!cond.nextTaskId) return;
      const key = `${task.id}::${cond.id}`;
      const cur = condRouting.get(key);
      if (!cur) return;
      // Phase 3e overrides shouldn't be auto-retried; user picked them
      // intentionally. (Phase 3e currently writes to condRouting too, so we
      // can't distinguish here — accept the limitation for v1.)
      trySwap(task.id, cond.nextTaskId, cur.exitSide, cur.entrySide,
        (exit, entry) => condRouting.set(key, { exitSide: exit, entrySide: entry }));
    });
  });

  // Non-gateway forward / backward / cross-lane (single source map per pair)
  tasks.forEach(task => {
    if (task.type === 'gateway' || task.type === 'end' || task.type === 'start') return;
    const nextIds = task.nextTaskIds?.length
      ? task.nextTaskIds
      : (task.nextTaskId ? [task.nextTaskId] : []);
    nextIds.forEach(toId => {
      const key = `${task.id}::${toId}`;
      const map = taskBackwardRouting.has(key)
        ? taskBackwardRouting
        : taskForwardRouting.has(key)
        ? taskForwardRouting
        : taskCrossLaneRouting.has(key)
        ? taskCrossLaneRouting
        : null;
      if (!map) return;
      const cur = map.get(key);
      if (!cur) return;
      trySwap(task.id, toId, cur.exitSide, cur.entrySide,
        (exit, entry) => map.set(key, { exitSide: exit, entrySide: entry }));
    });
  });
}

/**
 * Wrapper around isPathClear that "releases" the current connection's port
 * usage before checking, so it doesn't see itself as causing a port-mix.
 * Re-claims after the check.
 */
function isPathClearAfterRelease(exit, entry, fr, fc, tr, tc, ctx, fromId, toId) {
  // Save and release current claims so the predicate doesn't false-flag
  // the connection's own port usage.
  // (Implementation note: the current claims are already in portIn/portOut
  // because Phase 3e and others called useIn/useOut. We need to subtract 1
  // before checking, restore after.)
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

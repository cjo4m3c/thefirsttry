/**
 * Corridor + port-mix helpers shared by Phases 3 / 3b / 3c / 3d.
 *
 * All functions operate on a `ctx` object owned by computeLayout that
 * holds the mutable state (Maps for port direction tracking, Map of
 * registered top-corridor ranges per row, the cellTaskId lookup, and the
 * tasks array).
 */

// ── Port direction tracking ──────────────────────────────────
// The user rule "一個元件的端點不能同時有進入和出發" means: for any
// taskId+side, we may have multiple INs OR multiple OUTs, but never a
// mix. These helpers count each separately so phases can detect mixing.
export const pk = (id, side) => `${id}::${side}`;
export const hasIn  = (ctx, id, side) => (ctx.portIn.get(pk(id, side))  || 0) > 0;
export const hasOut = (ctx, id, side) => (ctx.portOut.get(pk(id, side)) || 0) > 0;
export const useIn  = (ctx, id, side) => ctx.portIn.set(pk(id, side),  (ctx.portIn.get(pk(id, side))  || 0) + 1);
export const useOut = (ctx, id, side) => ctx.portOut.set(pk(id, side), (ctx.portOut.get(pk(id, side)) || 0) + 1);

// ── Top corridor registration (Phase 3 + 3b/3c) ────────────────────
export function hasTopConflict(ctx, row, minCol, maxCol) {
  const arr = ctx.topCorridorByRow.get(row) || [];
  return arr.some(([a, b]) => !(b < minCol || maxCol < a));
}
export function registerTopCorridor(ctx, row, minCol, maxCol) {
  if (!ctx.topCorridorByRow.has(row)) ctx.topCorridorByRow.set(row, []);
  ctx.topCorridorByRow.get(row).push([minCol, maxCol]);
}
// Whether `col` sits STRICTLY INSIDE any already-registered top-corridor
// range on `row`. Used by Phase 3b/3c: if a new top→top edge's endpoint
// is under an earlier corridor's horizontal segment, the new edge's
// vertical exit would cross that segment (visual X). Fall back to
// bottom corridor to avoid the crossing.
export function isColInsideTopRange(ctx, row, col) {
  const arr = ctx.topCorridorByRow.get(row) || [];
  return arr.some(([a, b]) => col > a && col < b);
}

// Range of horizontal corridor occupied by a top-exit edge. Returns null
// if the edge does not occupy a top corridor (e.g. exit=top but entry=left
// for non-same-row targets).
export function topCorridorRange(exitSide, entrySide, fr, fc, tr, tc) {
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

// ── Path obstacle predicates ─────────────────────────────────
// Does the default 1-bend path for a horizontal exit (right/left) cross
// through any task rectangle strictly between source and target?
// Used by Phase 3 to reject a fallback exit-side that would draw through
// another task — when that happens we prefer sharing the primary exit
// with a sibling (two arrows merge near the gateway) over cutting
// through a task box, per user rule priority
// "端點不混用 > 視覺不穿過任務 > sibling 不共用".
export function horizontalPathHasObstacle(ctx, fr, fc, tr, tc) {
  const rLo = Math.min(fr, tr), rHi = Math.max(fr, tr);
  const cLo = Math.min(fc, tc), cHi = Math.max(fc, tc);
  for (let r = rLo; r <= rHi; r++) {
    for (let cc = cLo + 1; cc < cHi; cc++) {
      if (r === fr && cc === fc) continue;
      if (r === tr && cc === tc) continue;
      if (ctx.taskAt(r, cc)) return true;
    }
  }
  return false;
}

// A future Phase 3d edge (same-row non-gateway task with a cross-lane
// forward next) may exit that task's TOP or BOTTOM, drawing a vertical at
// the task's own column. That vertical only lands at `col` if Phase 3d
// chooses **Option B** (exit source from top/bottom). Option A exits
// source's RIGHT with the vertical at `tc` instead, which does not cut
// our corridor.
//
// So: only treat this as a corridor conflict if Phase 3d will actually
// trigger AND fall through Option A to Option B. Mirror Phase 3d's own
// checks:
//   1. `defaultBad`: default right→left midX path has intermediate
//      task overlap — Phase 3d triggers.
//   2. `optionABlocked`: Option A horizontal-at-source-row or
//      vertical-at-tc has overlap — Phase 3d falls to Option B.
// Only when both are true does the future vertical land at `col`.
export function corridorBlockedByFuturePhase3dVertical(ctx, row, minCol, maxCol) {
  const { tasks, taskRowOf, taskColOf, taskAt } = ctx;
  for (let col = minCol + 1; col < maxCol; col++) {
    const intId = taskAt(row, col);
    if (!intId) continue;
    const intTask = tasks.find(t => t.id === intId);
    if (!intTask || intTask.type === 'gateway' || intTask.type === 'start' || intTask.type === 'end') continue;
    const nextIds = intTask.nextTaskIds?.length
      ? intTask.nextTaskIds
      : (intTask.nextTaskId ? [intTask.nextTaskId] : []);
    for (const nid of nextIds) {
      const tr = taskRowOf[nid], tc = taskColOf[nid];
      if (tr === undefined || tc === undefined) continue;
      if (tr === row) continue;   // not cross-row
      if (tc <= col) continue;    // not forward

      const rLo = Math.min(row, tr), rHi = Math.max(row, tr);

      // Step 1 — does Phase 3d's default overlap check fire?
      let defaultBad = false;
      for (let c = col + 1; c < tc && !defaultBad; c++) {
        if (taskAt(row, c) || taskAt(tr, c)) defaultBad = true;
      }
      for (let r = rLo + 1; r < rHi && !defaultBad; r++) {
        for (let c = col + 1; c < tc && !defaultBad; c++) {
          if (taskAt(r, c)) defaultBad = true;
        }
      }
      if (!defaultBad) continue;  // Phase 3d won't override → no Option B vertical

      // Step 2 — will Phase 3d's Option A also be blocked?
      let optionABlocked = false;
      for (let c = col + 1; c < tc && !optionABlocked; c++) {
        if (taskAt(row, c)) optionABlocked = true;
      }
      for (let r = rLo + 1; r < rHi && !optionABlocked; r++) {
        if (taskAt(r, tc)) optionABlocked = true;
      }
      if (!optionABlocked) continue;  // Option A will win → vertical at tc, not col

      return true;  // Option B will win → vertical at col cuts our corridor
    }
  }
  return false;
}

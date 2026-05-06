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

/**
 * isPathClear — predicts the cells a routed path will pass through given
 * (exit, entry) sides, then checks for both task obstacles and rule-1
 * port-mix violations. Used by Phase 1 mixed-priority and Phase 3f L1 retry.
 *
 * Path geometry mirrors `routeArrow.js`:
 *   - right→left  forward (fc<tc): Z via midCol; horizontal at fr cols
 *     (fc, midCol], vertical at midCol (column gap, no task cells), horizontal
 *     at tr cols [midCol, tc).
 *   - right→left  backward: routes via title-bar above row 0 → no task cells.
 *   - top→top    : corridor above min(fr,tr); vertical at fc going up from
 *     fr-1, vertical at tc going down to tr-1.
 *   - bottom→bottom: corridor below max(fr,tr); vertical at fc fr+1..max,
 *     vertical at tc tr+1..max.
 *   - top→left/right (cross-row): vertical at fc above source, horizontal in
 *     corridor, vertical at tc descending to tr.
 *   - bottom→left/right: mirror of top→left/right downward.
 *   - top→bottom / bottom→top: vertical at fc + vertical at tc through
 *     intermediate rows.
 *
 * Returns false (= path NOT clear) on any obstacle. Endpoint cells (fr,fc)
 * and (tr,tc) are excluded; an intermediate task at the same cell as the
 * endpoint can't actually obstruct.
 */
export function isPathClear(exitSide, entrySide, fr, fc, tr, tc, ctx, fromId, toId) {
  // Rule 1: source's exit port must not already have IN, target's entry
  // port must not already have OUT (we'd be adding OUT to source, IN to target).
  if (hasIn(ctx, fromId, exitSide)) return false;
  if (hasOut(ctx, toId, entrySide)) return false;

  const cells = predictPathCells(exitSide, entrySide, fr, fc, tr, tc);
  for (const [r, c] of cells) {
    if (r === fr && c === fc) continue;
    if (r === tr && c === tc) continue;
    if (ctx.taskAt(r, c)) return false;
  }
  return true;
}

function predictPathCells(exit, entry, fr, fc, tr, tc) {
  const cells = [];
  const rLo = Math.min(fr, tr), rHi = Math.max(fr, tr);

  // Parallel corridors: top→top, bottom→bottom — verticals at both fc and tc
  if (exit === 'top' && entry === 'top') {
    for (let r = rLo; r < fr; r++) cells.push([r, fc]);
    for (let r = rLo; r < tr; r++) cells.push([r, tc]);
    return cells;
  }
  if (exit === 'bottom' && entry === 'bottom') {
    for (let r = fr + 1; r <= rHi; r++) cells.push([r, fc]);
    for (let r = tr + 1; r <= rHi; r++) cells.push([r, tc]);
    return cells;
  }

  // right→left forward: Z-shape via midCol — horizontal segments at row fr
  // and row tr; vertical at column gap (no task cells crossed by vertical).
  if (exit === 'right' && entry === 'left') {
    if (fc < tc) {
      const midCol = Math.floor((fc + tc) / 2);
      for (let c = fc + 1; c <= midCol; c++) cells.push([fr, c]);
      for (let c = midCol + 1; c < tc; c++) cells.push([tr, c]);
      // For cross-row Z-shape, vertical at midCol passes through intermediate rows
      if (fr !== tr) {
        for (let r = rLo + 1; r < rHi; r++) cells.push([r, midCol]);
      }
      return cells;
    }
    // backward right→left: title-bar detour above row 0 — no task cells crossed
    return [];
  }
  if (exit === 'left' && entry === 'right') {
    // backward via title bar
    return [];
  }

  // top → left/right (cross-row): corridor detour. Vertical at fc going up
  // from source, horizontal in corridor (no tasks), vertical at tc descending
  // to target row.
  if (exit === 'top' && (entry === 'left' || entry === 'right')) {
    for (let r = rLo; r < fr; r++) cells.push([r, fc]);
    for (let r = rLo; r < tr; r++) cells.push([r, tc]);
    return cells;
  }
  if (exit === 'bottom' && (entry === 'left' || entry === 'right')) {
    for (let r = fr + 1; r <= rHi; r++) cells.push([r, fc]);
    for (let r = tr + 1; r <= rHi; r++) cells.push([r, tc]);
    return cells;
  }

  // top↔bottom (vertical): pass through all intermediate rows at fc + tc.
  if ((exit === 'top' && entry === 'bottom') || (exit === 'bottom' && entry === 'top')) {
    if (fc === tc) {
      for (let r = rLo + 1; r < rHi; r++) cells.push([r, fc]);
    } else {
      // vertical at fc to halfway, then horizontal, then vertical at tc.
      const midRow = Math.floor((fr + tr) / 2);
      for (let r = rLo + 1; r <= midRow; r++) cells.push([r, fc]);
      for (let r = midRow; r < rHi; r++) cells.push([r, tc]);
    }
    return cells;
  }

  // right/left → top/bottom: horizontal first, then vertical.
  if ((exit === 'right' || exit === 'left') && (entry === 'top' || entry === 'bottom')) {
    // horizontal at row fr from fc to tc, then vertical at tc to tr.
    const cLo = Math.min(fc, tc), cHi = Math.max(fc, tc);
    for (let c = cLo + 1; c < cHi; c++) cells.push([fr, c]);
    for (let r = rLo + 1; r < rHi; r++) cells.push([r, tc]);
    return cells;
  }

  // Fallback: bounding box (conservative — may flag false positives).
  for (let r = rLo; r <= rHi; r++) {
    for (let c = Math.min(fc, tc); c <= Math.max(fc, tc); c++) {
      cells.push([r, c]);
    }
  }
  return cells;
}

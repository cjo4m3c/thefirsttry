/**
 * Gateway exit port priority table (Phase 1: smart routing).
 *
 * For a given direction (dr = rowDiff, dc = colDiff) from gateway → target,
 * returns the ordered list of preferred exit sides. The greedy assigner
 * walks this list picking the first side not yet used by another condition.
 *
 * The base list per direction keeps the visually best 2–3 sides in order.
 * Any still-unlisted side is appended as a last-resort fallback so a gateway
 * with ≥4 conditions can still distribute onto 4 distinct ports (priority 1
 * rule: "同一端點不能同時有一進一出"; corollary: same exit side reused
 * between sibling conditions causes overlapping lines at the source).
 *
 * Legacy `getGatewayExitEntry` preserved as fallback for edge cases & tests.
 */
export function getExitPriority(dr, dc) {
  const base = _exitPriorityBase(dr, dc);
  const ALL_SIDES = ['top', 'right', 'bottom', 'left'];
  const extras = ALL_SIDES.filter(s => !base.includes(s));
  return [...base, ...extras];
}

function _exitPriorityBase(dr, dc) {
  if (dr === 0) {
    if (dc === 1)  return ['right',  'bottom', 'top'];   // forward adjacent
    if (dc > 1)    return ['top',    'bottom', 'right']; // forward skip (corridor above)
    return ['top',   'bottom', 'left'];                  // backward / same col
  }
  if (dr < 0) {
    if (dc === 0) return ['top',    'left',   'right'];
    if (dc > 0)   return ['top',    'right',  'bottom'];
    // Up-left backward (e.g. loop-back from a lower-lane gateway to an
    // earlier task in a higher lane). Bottom corridor stays local to the
    // source's lower region instead of climbing all the way above the top
    // lane, so prefer `bottom` over `top` here.
    return ['bottom', 'left', 'top'];
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
export function inferEntrySide(exitSide, dr, dc) {
  if (exitSide === 'top' || exitSide === 'bottom') {
    if (dr === 0) return exitSide;        // same row: top→top, bottom→bottom
    // Corridor-aligned cases: the path uses the corridor on `exitSide` of
    // source and descends / ascends into the target from that same side.
    // Picking entry = exitSide keeps the arrow out of target's horizontal
    // ports (left/right), which are typically already occupied by forward
    // flow or another gateway condition.
    //
    //   1. Vertical opposite (target on the opposite vertical side of source):
    //      corridor wraps around on exitSide.
    if (exitSide === 'bottom' && dr < 0) return 'bottom';
    if (exitSide === 'top'    && dr > 0) return 'top';
    //   2. Backward (dc<0, any dr): corridor goes back over source and
    //      descends (top) / ascends (bottom) into target.
    if (dc < 0) return exitSide;
    //   3. Forward-different-row (dc>0, dr≠0): 1-bend L-path into target's
    //      left port — no corridor detour needed.
    if (dc > 0) return 'left';
    // dc=0 with dr≠0: straight vertical, enter opposite vertical.
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
export function getGatewayExitEntry(fromPos, toPos) {
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

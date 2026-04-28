/**
 * Pure helpers used by the drag-endpoint state machine in the main component.
 * Kept as plain functions so they're trivially testable and don't need React.
 */

// Convert a pointer event's screen coord to SVG user-space coord.
export function screenToSvg(svg, evt) {
  if (!svg) return [0, 0];
  const pt = svg.createSVGPoint();
  pt.x = evt.clientX;
  pt.y = evt.clientY;
  const ctm = svg.getScreenCTM()?.inverse();
  if (!ctm) return [0, 0];
  const p = pt.matrixTransform(ctm);
  return [p.x, p.y];
}

// Given the anchor task's position and a cursor coord in SVG space, find
// which of the 4 side-ports (top/right/bottom/left) is closest.
export function nearestSide(taskPos, sx, sy) {
  const sides = ['top', 'right', 'bottom', 'left'];
  let best = sides[0], bestD = Infinity;
  for (const s of sides) {
    const pp = taskPos[s];
    if (!pp) continue;
    const d = Math.hypot(pp.x - sx, pp.y - sy);
    if (d < bestD) { bestD = d; best = s; }
  }
  return best;
}

// Bounding-box hit-test: return id of task whose rect contains (sx, sy),
// or null. Used by PR J target-change drag to detect drop target. Bounding
// box approximation is fine for diamonds (small false positive at corners
// is acceptable; alternatives: 30 px circle around port).
export function findTaskAtPoint(tasks, positions, sx, sy) {
  for (const t of tasks) {
    const pos = positions[t.id];
    if (!pos) continue;
    if (sx >= pos.left.x && sx <= pos.right.x
     && sy >= pos.top.y  && sy <= pos.bottom.y) return t.id;
  }
  return null;
}

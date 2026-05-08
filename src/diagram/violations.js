/**
 * violations.js — Detect user-override induced routing violations.
 *
 * PR G/J allow the user to drag a connection's endpoint to a different port
 * on the same task (override exitSide / entrySide) or to a different task
 * (change target). Auto-routing (Phase 1..3d in layout.js) already avoids
 * the design rules in CLAUDE.md §10.1:
 *   Rule 1 — 端點不混用 (port can't have both IN and OUT)
 *   Rule 2 — 視覺不重疊 (line shouldn't cross task rectangle)
 *
 * When a user override forces a routing that violates these rules, we
 * flag it here so FlowEditor's validateFlow can:
 *   - blocking: IN+OUT mix on same port → stop save
 *   - warning:  line crosses another task → let user save anyway
 *
 * Also returns the set of connection indices that are part of any
 * violation so DiagramRenderer can stroke them red in real time.
 */
import { computeLayout, routeArrow } from './layout.js';

/**
 * @param {object} flow — { tasks, roles, l3Number, ... }
 * @returns {{ blocking: string[], warnings: string[], violatingConnIdx: Set<number> }}
 */
export function detectOverrideViolations(flow) {
  const blocking = [];
  const warnings = [];
  const violatingConnIdx = new Set();

  if (!flow?.tasks?.length || !flow?.roles?.length) {
    return { blocking, warnings, violatingConnIdx };
  }

  let layout;
  try { layout = computeLayout(flow); }
  catch { return { blocking, warnings, violatingConnIdx }; }

  const { positions, connections } = layout;
  const taskById = Object.fromEntries(flow.tasks.map(t => [t.id, t]));
  const labelOf = (id) => {
    const t = taskById[id];
    if (!t) return id;
    return t.name?.trim() || t.l4Number || t.id;
  };

  // ── Rule 1: IN + OUT mix on same (task, side) ─────────────────
  // Walk all connections, bucket by port direction. If ANY port has both
  // IN > 0 and OUT > 0, it's a violation — the connections touching that
  // port are flagged.
  //
  // Multiple INs on one port is OK; multiple OUTs on one port is OK.
  // Only the MIX of directions violates rule 1 (CLAUDE.md §10.1 rule 1).
  const portUsage = new Map();          // `${taskId}::${side}` → { inIdx: [], outIdx: [] }
  const pk = (id, side) => `${id}::${side}`;
  const bump = (key, dir, idx) => {
    if (!portUsage.has(key)) portUsage.set(key, { inIdx: [], outIdx: [] });
    portUsage.get(key)[dir].push(idx);
  };
  connections.forEach((c, i) => {
    bump(pk(c.fromId, c.exitSide),  'outIdx', i);
    bump(pk(c.toId,   c.entrySide), 'inIdx',  i);
  });
  for (const [key, { inIdx, outIdx }] of portUsage) {
    if (inIdx.length > 0 && outIdx.length > 0) {
      const [taskId, side] = key.split('::');
      blocking.push(`「${labelOf(taskId)}」的 ${sideLabel(side)} 端點同時有進出連線（違反規則 1：端點不混用）`);
      inIdx.forEach(i => violatingConnIdx.add(i));
      outIdx.forEach(i => violatingConnIdx.add(i));
    }
  }

  // ── Rule 2: line crosses a task rectangle (other than its endpoints) ──
  // Reroute each connection and check every segment against every other
  // task's bounding rect. If any segment intersects, warn.
  connections.forEach((c, i) => {
    const fromPos = positions[c.fromId];
    const toPos   = positions[c.toId];
    if (!fromPos || !toPos) return;
    const pts = c.aStarPolyline
      ? c.aStarPolyline
      : routeArrow(fromPos, toPos, c.exitSide, c.entrySide,
        c.laneBottomY, c.laneTopCorridorY);

    for (const t of flow.tasks) {
      if (t.id === c.fromId || t.id === c.toId) continue;
      const pos = positions[t.id];
      if (!pos) continue;
      if (pathCrossesRect(pts, pos)) {
        warnings.push(`連線 「${labelOf(c.fromId)}」 → 「${labelOf(c.toId)}」 穿過任務 「${labelOf(t.id)}」（違反規則 2：視覺不重疊）`);
        violatingConnIdx.add(i);
        break;  // one warning per connection is enough
      }
    }
  });

  return { blocking, warnings, violatingConnIdx };
}

function sideLabel(side) {
  return { top: '上', right: '右', bottom: '下', left: '左' }[side] || side;
}

// A polyline path crosses a rect if any segment intersects or is fully
// contained within the rect. We use a small inset (2 px) on the rect so
// lines that merely graze the border aren't flagged.
function pathCrossesRect(pts, pos) {
  const INSET = 2;
  const rect = {
    x1: pos.left.x   + INSET,
    x2: pos.right.x  - INSET,
    y1: pos.top.y    + INSET,
    y2: pos.bottom.y - INSET,
  };
  if (rect.x2 <= rect.x1 || rect.y2 <= rect.y1) return false;

  for (let i = 0; i < pts.length - 1; i++) {
    if (segmentCrossesRect(pts[i][0], pts[i][1], pts[i+1][0], pts[i+1][1], rect)) {
      return true;
    }
  }
  return false;
}

// All our routed segments are axis-aligned (from `routeArrow`). Simplified
// rect-intersection for horizontal + vertical segments only.
function segmentCrossesRect(x1, y1, x2, y2, r) {
  // Horizontal segment at y = y1 = y2, x from min to max
  if (Math.abs(y1 - y2) < 0.5) {
    const y = y1;
    if (y <= r.y1 || y >= r.y2) return false;
    const xLo = Math.min(x1, x2), xHi = Math.max(x1, x2);
    // crosses if the x range overlaps [r.x1, r.x2]
    return xHi > r.x1 && xLo < r.x2;
  }
  // Vertical segment at x = x1 = x2
  if (Math.abs(x1 - x2) < 0.5) {
    const x = x1;
    if (x <= r.x1 || x >= r.x2) return false;
    const yLo = Math.min(y1, y2), yHi = Math.max(y1, y2);
    return yHi > r.y1 && yLo < r.y2;
  }
  // Diagonal (shouldn't happen with our router, but fall through safely)
  return false;
}

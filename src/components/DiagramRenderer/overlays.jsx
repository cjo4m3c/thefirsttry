import { routeArrow } from '../../diagram/layout.js';

const HOVER_STROKE = '#2563EB'; // Tailwind blue-600

/**
 * Drop-target highlight: while dragging the target handle, if the cursor is
 * over a valid different task, draw a green dashed ring around it to signal
 * "release here to change target".
 */
export function DropTargetHighlight({ pos }) {
  if (!pos) return null;
  const w = pos.right.x - pos.left.x;
  const h = pos.bottom.y - pos.top.y;
  return (
    <rect x={pos.left.x - 5} y={pos.top.y - 5}
      width={w + 10} height={h + 10}
      fill="none" stroke="#10B981" strokeWidth={3}
      strokeDasharray="6 3" rx={6} pointerEvents="none" />
  );
}

/**
 * Override indicators: a small amber dot on every manually overridden
 * endpoint (source and/or target). Visible all the time so users can spot
 * which connections have been hand-routed at a glance — unlike the handles,
 * which only show on selection.
 */
export function OverrideIndicators({ connections, positions, overrideFlagOf }) {
  return connections.map((conn, i) => {
    const flag = overrideFlagOf(conn);
    if (!flag.source && !flag.target) return null;
    const from = positions[conn.fromId];
    const to = positions[conn.toId];
    if (!from || !to) return null;
    const srcPort = from[conn.exitSide];
    const tgtPort = to[conn.entrySide];
    return (
      <g key={`ov${i}`} pointerEvents="none">
        {flag.source && srcPort && (
          <circle cx={srcPort.x} cy={srcPort.y} r={3.5}
            fill="#F59E0B" stroke="#FFFFFF" strokeWidth={1.2} />
        )}
        {flag.target && tgtPort && (
          <circle cx={tgtPort.x} cy={tgtPort.y} r={3.5}
            fill="#F59E0B" stroke="#FFFFFF" strokeWidth={1.2} />
        )}
      </g>
    );
  });
}

/**
 * Drag preview: a dashed line from the anchor task's proposed side to the
 * other endpoint, so the user sees how the path will redraw before releasing.
 */
export function DragPreview({ conn, positions, dragInfo }) {
  if (!conn) return null;
  const from = positions[conn.fromId];
  const to = positions[conn.toId];
  if (!from || !to) return null;
  const previewExit  = dragInfo.endpoint === 'source' ? dragInfo.proposedSide : conn.exitSide;
  const previewEntry = dragInfo.endpoint === 'target' ? dragInfo.proposedSide : conn.entrySide;
  const previewPts = routeArrow(from, to, previewExit, previewEntry,
    conn.laneBottomY, conn.laneTopCorridorY);
  const str = previewPts.map(p => `${p[0]},${p[1]}`).join(' ');
  return (
    <polyline points={str} fill="none" stroke={HOVER_STROKE}
      strokeWidth={2} strokeDasharray="5 4" opacity={0.8}
      markerEnd="url(#ah-dashed)" />
  );
}

/**
 * Hover tooltip — shows task.description anchored above the shape.
 * Only rendered when the user hovers a task that has a description.
 */
export function HoverTooltip({ tooltip, tasks }) {
  if (!tooltip) return null;
  const t = (tasks || []).find(x => x.id === tooltip.taskId);
  if (!t || !t.description?.trim()) return null;
  return (
    <div
      className="fixed z-30 pointer-events-none bg-white shadow-xl border border-gray-200 rounded-lg p-2.5 max-w-xs"
      style={{
        left: tooltip.x,
        top: tooltip.y - 12,
        transform: 'translate(-50%, -100%)',
      }}
    >
      <div className="text-[13px] font-semibold text-gray-700 mb-1">任務重點說明</div>
      <div className="text-[13px] text-gray-600 whitespace-pre-wrap leading-relaxed">
        {t.description}
      </div>
    </div>
  );
}

import { useRef, useLayoutEffect, useState } from 'react';
import { routeArrow } from '../../diagram/layout.js';

const HOVER_STROKE = '#2563EB'; // Tailwind blue-600
// Buffer so tooltips don't tuck under the sticky FlowEditor header.
const HEADER_SAFE_PX = 60;
// Gap between tooltip and the task shape (matches the original 12px).
const TOOLTIP_GAP = 12;

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
 * Hover tooltip — shows task.description.
 *
 * Placement: defaults above the shape (existing behavior). After mount we
 * measure the rendered tooltip height; if placing above would clip behind
 * the sticky header (top - height < HEADER_SAFE_PX), flip to below the
 * shape instead. useLayoutEffect runs synchronously before paint so the
 * user doesn't see a "flash above then jump below" frame.
 */
export function HoverTooltip({ tooltip, tasks }) {
  const ref = useRef(null);
  const [placement, setPlacement] = useState('above');

  useLayoutEffect(() => {
    if (!tooltip || !ref.current) return;
    const h = ref.current.getBoundingClientRect().height;
    const fitsAbove = (tooltip.top - h - TOOLTIP_GAP) >= HEADER_SAFE_PX;
    setPlacement(fitsAbove ? 'above' : 'below');
  }, [tooltip]);

  if (!tooltip) return null;
  const t = (tasks || []).find(x => x.id === tooltip.taskId);
  if (!t || !t.description?.trim()) return null;
  // Backward compat: older callers used `tooltip.y` as rect.top. Prefer
  // explicit top/bottom; fall back to y for both.
  const top = tooltip.top ?? tooltip.y;
  const bottom = tooltip.bottom ?? tooltip.y;
  const style = placement === 'above'
    ? { left: tooltip.x, top: top - TOOLTIP_GAP, transform: 'translate(-50%, -100%)' }
    : { left: tooltip.x, top: bottom + TOOLTIP_GAP, transform: 'translate(-50%, 0)' };
  return (
    <div
      ref={ref}
      className="fixed z-30 pointer-events-none bg-white shadow-xl border border-gray-200 rounded-lg p-2.5 max-w-xs"
      style={style}
    >
      <div className="text-[13px] font-semibold text-gray-700 mb-1">任務重點說明</div>
      <div className="text-[13px] text-gray-600 whitespace-pre-wrap leading-relaxed">
        {t.description}
      </div>
    </div>
  );
}

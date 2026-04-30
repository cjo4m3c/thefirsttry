import { COLORS } from '../../diagram/constants.js';
import { routeArrow } from '../../diagram/layout.js';
import { estimateTextWidth } from './text.jsx';

// PR H: red stroke / marker for override-induced violations.
const VIOLATION_STROKE = '#EF4444';  // Tailwind red-500

const HOVER_STROKE = '#2563EB'; // Tailwind blue-600

// Connection hover palette — distinct colors for incoming vs outgoing so the
// viewer can tell at a glance which related edge flows in which direction.
// Palette values from ui-rules.md.
const HOVER_OUT_STROKE = '#2A5598'; // primary deep blue — where this element LEADS TO
const HOVER_IN_STROKE  = '#7AB5DD'; // light blue        — what FEEDS INTO this element

export function ArrowMarkers() {
  return (
    <defs>
      <marker id="ah" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
        <polygon points="0 0, 8 3, 0 6" fill={COLORS.ARROW_COLOR} />
      </marker>
      <marker id="ah-hover" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
        <polygon points="0 0, 8 3, 0 6" fill={HOVER_STROKE} />
      </marker>
      <marker id="ah-hover-out" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
        <polygon points="0 0, 8 3, 0 6" fill={HOVER_OUT_STROKE} />
      </marker>
      <marker id="ah-hover-in" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
        <polygon points="0 0, 8 3, 0 6" fill={HOVER_IN_STROKE} />
      </marker>
      <marker id="ah-dashed" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
        <polygon points="0 0, 8 3, 0 6" fill={COLORS.ARROW_COLOR} />
      </marker>
      <marker id="ah-violation" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
        <polygon points="0 0, 8 3, 0 6" fill={VIOLATION_STROKE} />
      </marker>
    </defs>
  );
}

export function ConnectionArrow({ conn, connKey, positions, hoveredId, hoveredConnKey,
  onHover, isSelected, onSelect, editable, isViolation }) {
  const from = positions[conn.fromId];
  const to = positions[conn.toId];
  if (!from || !to) return null;

  const pts = routeArrow(from, to, conn.exitSide, conn.entrySide, conn.laneBottomY, conn.laneTopCorridorY);
  const pointsStr = pts.map(p => `${p[0]},${p[1]}`).join(' ');

  const labelPt = pts.length >= 3
    ? [(pts[1][0] + pts[2][0]) / 2, (pts[1][1] + pts[2][1]) / 2]
    : [(pts[0][0] + pts[pts.length - 1][0]) / 2, (pts[0][1] + pts[pts.length - 1][1]) / 2];

  // Highlight priority:
  //   (0) Violation (PR H: override causes IN+OUT mix or line-crosses-task)
  //       → red stroke + red marker; overrides selection / hover.
  //   (1) Selected (via click for drag) → HOVER_STROKE + thicker stroke;
  //       handles are rendered separately by the parent.
  //   (2) This connection itself is hovered → neutral HOVER_STROKE (both
  //       endpoint elements will also highlight via hoveredConnKey below).
  //   (3) An endpoint element is hovered → direction-aware coloring.
  let strokeColor = COLORS.ARROW_COLOR;
  let strokeW = 1.4;
  let markerId = 'ah';
  if (isViolation) {
    strokeColor = VIOLATION_STROKE;
    strokeW = 2.5;
    markerId = 'ah-violation';
  } else if (isSelected) {
    strokeColor = HOVER_STROKE;
    strokeW = 2.5;
    markerId = 'ah-hover';
  } else if (hoveredConnKey === connKey) {
    strokeColor = HOVER_STROKE;
    strokeW = 2.5;
    markerId = 'ah-hover';
  } else if (hoveredId != null) {
    if (conn.fromId === hoveredId) {
      strokeColor = HOVER_OUT_STROKE;
      strokeW = 2.5;
      markerId = 'ah-hover-out';
    } else if (conn.toId === hoveredId) {
      strokeColor = HOVER_IN_STROKE;
      strokeW = 2.5;
      markerId = 'ah-hover-in';
    }
  }

  return (
    <g onMouseEnter={() => onHover?.(connKey)}
       onMouseLeave={() => onHover?.(null)}
       onClick={editable ? (e) => { e.stopPropagation(); onSelect?.(connKey); } : undefined}
       style={{ cursor: editable ? 'pointer' : 'default' }}>
      {/* invisible wider stroke for easier hover / click targeting */}
      <polyline points={pointsStr} fill="none" stroke="transparent" strokeWidth={10} />
      <polyline points={pointsStr} fill="none" stroke={strokeColor}
        strokeWidth={strokeW} markerEnd={`url(#${markerId})`} />
      {conn.label && (() => {
        // Bg width hugs the rendered text instead of a fixed 40px slab —
        // long labels stop being clipped, short ones stop having a tail
        // of empty white. Padding 4px each side, height = fontSize + 4.
        const fontSize = 14;
        const labelW = estimateTextWidth(conn.label, fontSize) + 8;
        const labelH = fontSize + 4;
        return (
          <>
            <rect x={labelPt[0] - labelW / 2} y={labelPt[1] - labelH / 2}
              width={labelW} height={labelH}
              fill={COLORS.ARROW_LABEL_BG} opacity={0.9} rx={2} />
            <text x={labelPt[0]} y={labelPt[1]} textAnchor="middle" dominantBaseline="middle"
              fontSize={fontSize} fill={COLORS.ARROW_COLOR}
              fontFamily="Microsoft JhengHei, PingFang TC, sans-serif">
              {conn.label}
            </text>
          </>
        );
      })()}
    </g>
  );
}

// Handle circle drawn on a selected connection's endpoint. Drag with pointer
// events; snap to the nearest side of the anchor task on release.
export function EndpointHandle({ cx, cy, onPointerDown, isDragging }) {
  const r = isDragging ? 7 : 6;
  return (
    <g style={{ cursor: 'grab' }} onPointerDown={onPointerDown}>
      {/* Transparent wider target for easier pickup */}
      <circle cx={cx} cy={cy} r={14} fill="transparent" />
      <circle cx={cx} cy={cy} r={r}
        fill="#FFFFFF" stroke={HOVER_STROKE} strokeWidth={2.5} />
      <circle cx={cx} cy={cy} r={r - 3}
        fill={HOVER_STROKE} />
    </g>
  );
}

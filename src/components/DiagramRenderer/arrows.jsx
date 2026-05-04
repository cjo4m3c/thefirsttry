import { COLORS } from '../../diagram/constants.js';
import { routeArrow } from '../../diagram/layout.js';
import { estimateTextWidth, wrapText } from './text.jsx';

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
        // Wrap long labels onto multiple lines so they don't overflow into
        // adjacent task rectangles. maxChars is derived from the middle
        // segment's actual horizontal length (or fallback to NODE_W gap),
        // clamped to [3, 12] CJK-equivalent. Each char ≈ fontSize px wide
        // for CJK, so available chars = floor((segLen - 8px pad) / fontSize).
        // Per user 2026-05-04 後段：「閘道條件字很多的時候沒有調整寬度或自動換行」.
        const fontSize = 14;
        const lineH = fontSize + 4;
        const segLen = pts.length >= 3
          ? Math.abs(pts[2][0] - pts[1][0])
          : Math.abs(pts[pts.length - 1][0] - pts[0][0]);
        const availChars = Math.floor((segLen - 8) / fontSize);
        const maxChars = Math.max(3, Math.min(12, availChars || 3));
        const lines = wrapText(conn.label, maxChars, 24);
        const totalH = lines.length * lineH;
        return (
          <>
            {lines.map((line, i) => {
              const w = estimateTextWidth(line, fontSize) + 8;
              const y = labelPt[1] - totalH / 2 + i * lineH + lineH / 2;
              return (
                <g key={i}>
                  <rect x={labelPt[0] - w / 2} y={y - lineH / 2}
                    width={w} height={lineH}
                    fill={COLORS.ARROW_LABEL_BG} opacity={0.9} rx={2} />
                  <text x={labelPt[0]} y={y} textAnchor="middle" dominantBaseline="middle"
                    fontSize={fontSize} fill={COLORS.ARROW_COLOR}
                    fontFamily="Microsoft JhengHei, PingFang TC, sans-serif">
                    {line}
                  </text>
                </g>
              );
            })}
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

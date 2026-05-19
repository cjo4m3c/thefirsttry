import { COLORS } from '../../diagram/constants.js';
import { routeArrow } from '../../diagram/layout.js';
import { estimateTextWidth, wrapText } from './text.jsx';

// PR H: red stroke / marker for override-induced violations.
const VIOLATION_STROKE = '#EF4444';  // Tailwind red-500

const HOVER_STROKE = '#2563EB'; // Tailwind blue-600

// Connection hover palette — distinct colors for incoming vs outgoing so the
// viewer can tell at a glance which related edge flows in which direction.
// Palette values from ui-rules.md.
// SVG `stroke` attribute 不認 CSS variable、保留 hex literal；須跟 `--brand-dark` 同步。
const HOVER_OUT_STROKE = '#2A5598'; // === var(--brand-dark) — where this element LEADS TO
const HOVER_IN_STROKE  = '#7AB5DD'; // light blue        — what FEEDS INTO this element

export function ArrowMarkers() {
  // Default / dashed / violation markers 8×6 → 12×9（+50%、PR #213）— L4
  // number pill (opacity 0.6 白底) 蓋住 tip 時、加大可視範圍提升辨識度。
  // refX/refY 同比例放大保持 apex 對齊連線端點。
  //
  // Hover 變體（ah-hover / ah-hover-out / ah-hover-in）2026-05-13 起改回
  // 原本 8×6 — 使用者：「hover 過的箭頭不要跟著變大、維持原本就好」。
  // 理由：hover state 的線 stroke 已從 1.4 加粗到 2.5、若 marker 又放大
  // 整體變得過於厚重。預設箭頭保留 12×9 提升靜態辨識度，hover 仍精緻。
  return (
    <defs>
      <marker id="ah" markerWidth="12" markerHeight="9" refX="12" refY="4.5" orient="auto">
        <polygon points="0 0, 12 4.5, 0 9" fill={COLORS.ARROW_COLOR} />
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
      <marker id="ah-dashed" markerWidth="12" markerHeight="9" refX="12" refY="4.5" orient="auto">
        <polygon points="0 0, 12 4.5, 0 9" fill={COLORS.ARROW_COLOR} />
      </marker>
      <marker id="ah-violation" markerWidth="12" markerHeight="9" refX="12" refY="4.5" orient="auto">
        <polygon points="0 0, 12 4.5, 0 9" fill={VIOLATION_STROKE} />
      </marker>
    </defs>
  );
}

export function ConnectionArrow({ conn, connKey, positions, hoveredId, hoveredConnKey,
  onHover, isSelected, onSelect, editable, isViolation }) {
  const from = positions[conn.fromId];
  const to = positions[conn.toId];
  if (!from || !to) return null;

  // ELK mode 下 conn 已帶 _bendPoints；default mode 走自家 routeArrow。
  const pts = conn._bendPoints
    ?? routeArrow(from, to, conn.exitSide, conn.entrySide, conn.laneBottomY, conn.laneTopCorridorY);
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
    // 2026-05-18 對齊 spec §12：Selected 連線比 hover 再粗一階（3px vs 2.5px）
    // 區分「臨時 hover」vs「主動選中」。配套：兩端 task 同步亮 brand 色（由
    // shapes.jsx isSelectedEndpoint prop 處理）。
    strokeColor = HOVER_STROKE;
    strokeW = 3;
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

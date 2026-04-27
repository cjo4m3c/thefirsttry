import { useRef, useEffect, useState } from 'react';
import { toPng } from 'html-to-image';
import { computeLayout, routeArrow } from '../diagram/layout.js';
import { detectOverrideViolations } from '../diagram/violations.js';
import { LAYOUT, COLORS } from '../diagram/constants.js';
import { exportDrawio } from '../utils/drawioExport.js';
import { todayYmd } from '../utils/storage.js';

// PR H: red stroke / marker for override-induced violations.
const VIOLATION_STROKE = '#EF4444';  // Tailwind red-500
const { LANE_HEADER_W, COL_W, LANE_H, TITLE_H, NODE_W, NODE_H, DIAMOND_SIZE, CIRCLE_R } = LAYOUT;

const HOVER_STROKE = '#2563EB'; // Tailwind blue-600
const HOVER_TINT   = '#DBEAFE'; // Tailwind blue-100

// Connection hover palette — distinct colors for incoming vs outgoing so the
// viewer can tell at a glance which direction each related edge flows.
// Palette values from ui-rules.md.
const HOVER_OUT_STROKE = '#2A5598'; // primary deep blue — where this element LEADS TO
const HOVER_IN_STROKE  = '#7AB5DD'; // light blue        — what FEEDS INTO this element

function wrapText(text, maxChars) {
  if (!text) return [];
  // Tokenize: each CJK char / CJK-punct is its own token, each run of
  // Latin/digit chars is one token, other single non-space chars are one
  // token. Whitespace acts as separator only. This keeps English words
  // intact on line breaks instead of slicing "Sourcer" → "Sourc"+"er".
  const cjkRe = /[　-〿぀-ゟ゠-ヿ一-鿿＀-￯]/;
  const tokens = text.match(/[　-〿぀-ゟ゠-ヿ一-鿿＀-￯]|[A-Za-z0-9]+|\S/g) || [];
  // CJK occupies ~2x the horizontal space of a Latin char; treat maxChars
  // as a CJK-equivalent budget (maxWidth = maxChars * 2 Latin units).
  const tokWidth = t => [...t].reduce((s, c) => s + (cjkRe.test(c) ? 2 : 1), 0);
  const isLatin = c => /[A-Za-z0-9]/.test(c);
  const maxWidth = maxChars * 2;
  const lines = [];
  let cur = '', curW = 0;
  for (const tok of tokens) {
    const needsSpace = cur && isLatin(cur[cur.length - 1]) && isLatin(tok[0]);
    const addW = tokWidth(tok) + (needsSpace ? 1 : 0);
    if (!cur) { cur = tok; curW = tokWidth(tok); }
    else if (curW + addW <= maxWidth) { cur += (needsSpace ? ' ' : '') + tok; curW += addW; }
    else { lines.push(cur); cur = tok; curW = tokWidth(tok); }
  }
  if (cur) lines.push(cur);
  return lines;
}

function SvgLabel({ text, cx, cy, maxChars = 7, lineH = 14, fontSize = 11.5, fill = COLORS.TASK_TEXT }) {
  const lines = wrapText(text, maxChars);
  const total = (lines.length - 1) * lineH;
  return (
    <>
      {lines.map((line, i) => (
        <text key={i} x={cx} y={cy - total / 2 + i * lineH}
          textAnchor="middle" dominantBaseline="middle"
          fontSize={fontSize} fill={fill} fontFamily="Microsoft JhengHei, PingFang TC, sans-serif">
          {line}
        </text>
      ))}
    </>
  );
}

function L4Number({ number, cx, y }) {
  if (!number) return null;
  return (
    <text x={cx} y={y - 5} textAnchor="middle" fontSize={9} fill={COLORS.TASK_NUMBER}
      fontFamily="Microsoft JhengHei, PingFang TC, sans-serif">
      {number}
    </text>
  );
}

function EventLabel({ cx, y, name, desc }) {
  const fontFamily = 'Microsoft JhengHei, PingFang TC, sans-serif';
  // Events (start/end) sit in roughly one column width (168px); wrap at
  // ~14 CJK chars for the name and ~18 for the smaller description so
  // long labels don't spill past the column / lane boundary.
  const nameLines = wrapText(name || '', 14);
  const descLines = wrapText(desc || '', 18);
  const nameLineH = 13;
  const descLineH = 12;
  const gap = 3;
  let cursor = y;
  return (
    <>
      {nameLines.map((line, i) => (
        <text key={`n${i}`} x={cx} y={cursor + i * nameLineH}
          textAnchor="middle" dominantBaseline="middle"
          fontSize={10} fill={COLORS.TASK_TEXT} fontFamily={fontFamily}>
          {line}
        </text>
      ))}
      {descLines.length > 0 && descLines.map((line, i) => {
        const y0 = cursor + Math.max(nameLines.length, 1) * nameLineH + gap + i * descLineH;
        return (
          <text key={`d${i}`} x={cx} y={y0}
            textAnchor="middle" dominantBaseline="middle"
            fontSize={9} fill="#6B7280" fontFamily={fontFamily}>
            {line}
          </text>
        );
      })}
    </>
  );
}

function StartShape({ pos, l4Number, task, isHovered }) {
  const { cx, cy } = pos;
  const stroke = isHovered ? HOVER_STROKE : COLORS.START_STROKE;
  const strokeW = isHovered ? 3 : 2;
  return (
    <>
      <L4Number number={l4Number} cx={cx} y={cy - CIRCLE_R} />
      <circle cx={cx} cy={cy} r={CIRCLE_R} fill={COLORS.START_FILL} stroke={stroke} strokeWidth={strokeW} />
      <EventLabel cx={cx} y={cy + CIRCLE_R + 13} name={task.name} desc={task.description} />
    </>
  );
}

function EndShape({ pos, l4Number, task, isHovered }) {
  const { cx, cy } = pos;
  const desc = task.connectionType === 'breakpoint' && task.breakpointReason
    ? `【斷點：${task.breakpointReason}】`
    : task.description;
  const stroke = isHovered ? HOVER_STROKE : COLORS.END_FILL;
  const strokeW = isHovered ? 3 : 2;
  return (
    <>
      <L4Number number={l4Number} cx={cx} y={cy - CIRCLE_R} />
      <circle cx={cx} cy={cy} r={CIRCLE_R} fill={COLORS.END_FILL} stroke={stroke} strokeWidth={strokeW} />
      <EventLabel cx={cx} y={cy + CIRCLE_R + 13} name={task.name} desc={desc} />
    </>
  );
}

function TaskShape({ task, pos, l4Number, isHovered }) {
  const { cx, cy } = pos;
  const x = cx - NODE_W / 2;
  const y = cy - NODE_H / 2;
  const baseFill = task.type === 'interaction' ? COLORS.INTERACTION_FILL : COLORS.TASK_FILL;
  const fill = isHovered ? HOVER_TINT : baseFill;
  const stroke = isHovered ? HOVER_STROKE : COLORS.TASK_STROKE;
  const strokeW = isHovered ? 2.5 : 1.2;
  return (
    <>
      <L4Number number={l4Number} cx={cx} y={y} />
      <rect x={x} y={y} width={NODE_W} height={NODE_H}
        fill={fill} stroke={stroke} strokeWidth={strokeW} rx={3} />
      <SvgLabel text={task.name} cx={cx} cy={cy} maxChars={7} lineH={14} />
    </>
  );
}

function L3ActivityShape({ task, pos, l4Number, isHovered }) {
  const { cx, cy } = pos;
  const x = cx - NODE_W / 2;
  const y = cy - NODE_H / 2;
  const barW = 10; // bookend bar width
  const fill = isHovered ? HOVER_TINT : COLORS.L3_ACTIVITY_FILL;
  const stroke = isHovered ? HOVER_STROKE : COLORS.L3_ACTIVITY_STROKE;
  const strokeW = isHovered ? 2.5 : 1.5;
  // L3 number shown at top (via l4Number prop, which caller replaces with
  // subprocessName for subprocess calls). Inside shows [子流程] + task.name
  // as the contextual label; falls back to task.name only for plain L3
  // activity shapes with no subprocessName.
  const isSubprocess = !!task.subprocessName?.trim();
  return (
    <>
      <L4Number number={l4Number} cx={cx} y={y} />
      <rect x={x} y={y} width={NODE_W} height={NODE_H}
        fill={fill} stroke={stroke} strokeWidth={strokeW} rx={0} />
      <line x1={x + barW} y1={y} x2={x + barW} y2={y + NODE_H}
        stroke={stroke} strokeWidth={1} />
      <line x1={x + NODE_W - barW} y1={y} x2={x + NODE_W - barW} y2={y + NODE_H}
        stroke={stroke} strokeWidth={1} />
      {isSubprocess ? (
        <>
          <text x={cx} y={cy - 8} textAnchor="middle" dominantBaseline="middle"
            fontSize={10} fill="#6B7280" fontFamily="Microsoft JhengHei, PingFang TC, sans-serif">
            [子流程]
          </text>
          <SvgLabel text={task.name || ''} cx={cx} cy={cy + 10} maxChars={7} lineH={12} />
        </>
      ) : (
        <SvgLabel text={task.name} cx={cx} cy={cy} maxChars={7} lineH={14} />
      )}
    </>
  );
}

function GatewayShape({ task, pos, l4Number, isHovered }) {
  const { cx, cy } = pos;
  const d = DIAMOND_SIZE;
  const pts = `${cx},${cy - d} ${cx + d},${cy} ${cx},${cy + d} ${cx - d},${cy}`;
  const gType = task.gatewayType || 'xor';
  const sym = d * 0.42; // symbol half-size
  const fill = isHovered ? HOVER_TINT : COLORS.GATEWAY_FILL;
  const stroke = isHovered ? HOVER_STROKE : COLORS.GATEWAY_STROKE;
  const strokeW = isHovered ? 2.5 : 1.2;

  let symbol = null;
  if (gType === 'xor') {
    // X cross
    symbol = (
      <g>
        <line x1={cx - sym} y1={cy - sym} x2={cx + sym} y2={cy + sym} stroke={stroke} strokeWidth={2} />
        <line x1={cx + sym} y1={cy - sym} x2={cx - sym} y2={cy + sym} stroke={stroke} strokeWidth={2} />
      </g>
    );
  } else if (gType === 'and') {
    // + cross
    symbol = (
      <g>
        <line x1={cx} y1={cy - sym} x2={cx} y2={cy + sym} stroke={stroke} strokeWidth={2} />
        <line x1={cx - sym} y1={cy} x2={cx + sym} y2={cy} stroke={stroke} strokeWidth={2} />
      </g>
    );
  } else {
    // OR: circle
    symbol = <circle cx={cx} cy={cy} r={sym * 0.9} fill="none" stroke={stroke} strokeWidth={1.5} />;
  }

  return (
    <>
      <L4Number number={l4Number} cx={cx} y={cy - d} />
      <polygon points={pts} fill={fill} stroke={stroke} strokeWidth={strokeW} />
      {symbol}
      <SvgLabel text={task.name} cx={cx} cy={cy + d + 10} maxChars={6} lineH={13} fontSize={10.5} />
    </>
  );
}

function ArrowMarkers() {
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

function ConnectionArrow({ conn, connKey, positions, hoveredId, hoveredConnKey,
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
      {conn.label && (
        <>
          <rect x={labelPt[0] - 14} y={labelPt[1] - 9} width={28} height={16}
            fill={COLORS.ARROW_LABEL_BG} opacity={0.85} rx={2} />
          <text x={labelPt[0]} y={labelPt[1]} textAnchor="middle" dominantBaseline="middle"
            fontSize={10} fill={COLORS.ARROW_COLOR}
            fontFamily="Microsoft JhengHei, PingFang TC, sans-serif">
            {conn.label}
          </text>
        </>
      )}
    </g>
  );
}

// Handle circle drawn on a selected connection's endpoint. Drag with pointer
// events; snap to the nearest side of the anchor task on release.
function EndpointHandle({ cx, cy, onPointerDown, isDragging }) {
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

function LegendSection() {
  const items = [
    { shape: 'start',       label: '活動起點' },
    { shape: 'end',         label: '活動終點' },
    { shape: 'task',        label: 'L4 任務' },
    { shape: 'interaction', label: '外部關係人互動' },
    { shape: 'gateway-xor', label: '排他閘道 (XOR)' },
    { shape: 'gateway-and', label: '並行閘道 (AND)' },
    { shape: 'gateway-or',  label: '包容閘道 (OR)' },
    { shape: 'l3activity',  label: 'L3 活動（關聯）' },
    { shape: 'arrow',       label: '順序流' },
  ];

  return (
    <div className="mt-4 p-4 bg-white border border-gray-200 rounded-lg">
      <div className="text-sm font-semibold text-gray-700 mb-3">圖例說明</div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {items.map(item => (
          <div key={item.shape} className="flex items-center gap-2">
            <LegendIcon type={item.shape} />
            <span className="text-xs text-gray-600">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function LegendIcon({ type }) {
  const s = 36;
  const c = s / 2;
  if (type === 'start') return (
    <svg width={s} height={s}><circle cx={c} cy={c} r={12} fill={COLORS.START_FILL} stroke={COLORS.START_STROKE} strokeWidth={2} /></svg>
  );
  if (type === 'end') return (
    <svg width={s} height={s}><circle cx={c} cy={c} r={12} fill={COLORS.END_FILL} stroke={COLORS.END_FILL} strokeWidth={2} /></svg>
  );
  if (type === 'task') return (
    <svg width={s} height={s}><rect x={3} y={8} width={30} height={20} fill={COLORS.TASK_FILL} stroke={COLORS.TASK_STROKE} strokeWidth={1.2} rx={2} /></svg>
  );
  if (type === 'interaction') return (
    <svg width={s} height={s}><rect x={3} y={8} width={30} height={20} fill={COLORS.INTERACTION_FILL} stroke={COLORS.TASK_STROKE} strokeWidth={1.2} rx={2} /></svg>
  );
  if (type === 'gateway-xor') {
    const sym = 6;
    return (
      <svg width={s} height={s}>
        <polygon points={`${c},4 ${s-4},${c} ${c},${s-4} 4,${c}`} fill={COLORS.GATEWAY_FILL} stroke={COLORS.GATEWAY_STROKE} strokeWidth={1.2} />
        <line x1={c-sym} y1={c-sym} x2={c+sym} y2={c+sym} stroke={COLORS.GATEWAY_STROKE} strokeWidth={1.8} />
        <line x1={c+sym} y1={c-sym} x2={c-sym} y2={c+sym} stroke={COLORS.GATEWAY_STROKE} strokeWidth={1.8} />
      </svg>
    );
  }
  if (type === 'gateway-and') {
    const sym = 6;
    return (
      <svg width={s} height={s}>
        <polygon points={`${c},4 ${s-4},${c} ${c},${s-4} 4,${c}`} fill={COLORS.GATEWAY_FILL} stroke={COLORS.GATEWAY_STROKE} strokeWidth={1.2} />
        <line x1={c} y1={c-sym} x2={c} y2={c+sym} stroke={COLORS.GATEWAY_STROKE} strokeWidth={1.8} />
        <line x1={c-sym} y1={c} x2={c+sym} y2={c} stroke={COLORS.GATEWAY_STROKE} strokeWidth={1.8} />
      </svg>
    );
  }
  if (type === 'gateway-or') {
    return (
      <svg width={s} height={s}>
        <polygon points={`${c},4 ${s-4},${c} ${c},${s-4} 4,${c}`} fill={COLORS.GATEWAY_FILL} stroke={COLORS.GATEWAY_STROKE} strokeWidth={1.2} />
        <circle cx={c} cy={c} r={6} fill="none" stroke={COLORS.GATEWAY_STROKE} strokeWidth={1.5} />
      </svg>
    );
  }
  if (type === 'l3activity') return (
    <svg width={s} height={s}>
      <rect x={3} y={6} width={30} height={22} fill={COLORS.L3_ACTIVITY_FILL} stroke={COLORS.L3_ACTIVITY_STROKE} strokeWidth={1.5} />
      <line x1={11} y1={6} x2={11} y2={28} stroke={COLORS.L3_ACTIVITY_STROKE} strokeWidth={1} />
      <line x1={25} y1={6} x2={25} y2={28} stroke={COLORS.L3_ACTIVITY_STROKE} strokeWidth={1} />
    </svg>
  );
  if (type === 'arrow') return (
    <svg width={s} height={s}>
      <defs><marker id="leg-ah" markerWidth="6" markerHeight="5" refX="6" refY="2.5" orient="auto"><polygon points="0 0,6 2.5,0 5" fill={COLORS.ARROW_COLOR} /></marker></defs>
      <line x1={2} y1={c} x2={s-6} y2={c} stroke={COLORS.ARROW_COLOR} strokeWidth={1.5} markerEnd="url(#leg-ah)" />
    </svg>
  );
  return null;
}

export default function DiagramRenderer({ flow, showExport = true, autoExportPng = false,
  onExportDone = null, onUpdateOverride = null, onChangeTarget = null,
  onResetOverride = null, onTaskClick = null, highlightedTaskId = null }) {
  const exportRef = useRef(null);
  const svgRef = useRef(null);
  // Sticky-role-header support: when the diagram is wider than the viewport,
  // the user scrolls horizontally — but the role-header column on the left
  // should stay visible so they can always see whose lane each task is in.
  // We watch the scroll container's scrollLeft and apply a counter-translate
  // to the sticky <g> that holds the role-header rects + names + the vertical
  // separator at x=LANE_HEADER_W.
  const scrollContainerRef = useRef(null);
  const stickyHeadersRef = useRef(null);
  const [hoveredId, setHoveredId] = useState(null);
  const [hoveredConnKey, setHoveredConnKey] = useState(null);
  // Tooltip state for hover-on-task description preview.
  // { taskId, x, y } where x/y anchor the tooltip *above* the task shape.
  const [tooltip, setTooltip] = useState(null);
  // Drag-endpoint state for connection override:
  //   selectedConnKey  — which connection shows handles
  //   dragInfo         — { connKey, endpoint: 'source'|'target', pointerId,
  //                         proposedSide: 'top'|'right'|'bottom'|'left',
  //                         dropTargetId: task id under cursor (PR J), cursor:[x,y] }
  const [selectedConnKey, setSelectedConnKey] = useState(null);
  const [dragInfo, setDragInfo] = useState(null);
  const editable = !!(onUpdateOverride || onChangeTarget);

  useEffect(() => {
    if (!autoExportPng || !exportRef.current) return;
    resetStickyForExport();
    toPng(exportRef.current, { pixelRatio: 2, backgroundColor: '#ffffff' })
      .then(dataUrl => {
        const a = document.createElement('a');
        a.download = `${flow.l3Number}-${flow.l3Name}-${todayYmd()}.png`;
        a.href = dataUrl;
        a.click();
      })
      .catch(e => alert(`PNG 匯出失敗：${e?.message || e}`))
      .finally(() => onExportDone?.());
  }, [autoExportPng]);

  // Esc key cancels active drag / clears selection.
  useEffect(() => {
    if (!editable) return;
    function onKey(e) {
      if (e.key !== 'Escape') return;
      if (dragInfo) setDragInfo(null);
      else if (selectedConnKey) setSelectedConnKey(null);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [editable, dragInfo, selectedConnKey]);

  // Sticky role header: keep the left column anchored to the viewport as the
  // user scrolls horizontally. Direct DOM mutation (not React state) — runs
  // every scroll tick so we avoid forcing a re-render of the whole SVG.
  function handleScrollLeft() {
    const sl = scrollContainerRef.current?.scrollLeft || 0;
    if (stickyHeadersRef.current) {
      stickyHeadersRef.current.setAttribute('transform', `translate(${sl}, 0)`);
    }
  }

  // Before PNG export, reset sticky transform so the captured image has the
  // role header at its natural x=0 position (otherwise the export would show
  // the header offset by whatever scrollLeft the user happened to be at).
  function resetStickyForExport() {
    if (stickyHeadersRef.current) stickyHeadersRef.current.setAttribute('transform', 'translate(0, 0)');
    if (scrollContainerRef.current) scrollContainerRef.current.scrollLeft = 0;
  }

  if (!flow || !flow.roles?.length || !flow.tasks?.length) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400 text-sm border border-dashed border-gray-300 rounded-lg">
        尚無流程資料，請完成表單後產生圖表
      </div>
    );
  }

  const { positions, connections, l4Numbers, svgWidth, svgHeight, laneTopY, laneHeights } = computeLayout(flow);

  // PR H: detect override-induced violations so we can stroke the offending
  // connections red in real time. Two categories (see violations.js):
  //   - IN+OUT mix on same port  (rule 1, blocking at save time)
  //   - line crosses other task  (rule 2, warning at save time)
  const { violatingConnIdx } = detectOverrideViolations(flow);

  // PR I: compute which endpoints of each connection have been manually
  // overridden so we can draw a small indicator (🔧 dot) that's visible
  // even when the connection isn't selected. Per-connection result:
  //   { source: boolean, target: boolean }
  // A source override exists iff `fromTask.connectionOverrides[overrideKey]
  // .exitSide` is set (same for target with `.entrySide`).
  const taskById = Object.fromEntries(flow.tasks.map(t => [t.id, t]));
  const overrideFlagOf = (conn) => {
    const fromTask = taskById[conn.fromId];
    const ov = fromTask?.connectionOverrides?.[conn.overrideKey];
    return { source: !!ov?.exitSide, target: !!ov?.entrySide };
  };
  const selectedConnHasOverride = (() => {
    if (!selectedConnKey) return false;
    const idx = parseInt(selectedConnKey.slice(1), 10);
    const c = connections[idx];
    if (!c) return false;
    const f = overrideFlagOf(c);
    return f.source || f.target;
  })();

  // Convert a pointer event's screen coord to SVG user-space coord.
  function screenToSvg(evt) {
    const svg = svgRef.current;
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
  function nearestSide(taskPos, sx, sy) {
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
  function findTaskAtPoint(sx, sy) {
    for (const t of flow.tasks) {
      const pos = positions[t.id];
      if (!pos) continue;
      if (sx >= pos.left.x && sx <= pos.right.x
       && sy >= pos.top.y  && sy <= pos.bottom.y) return t.id;
    }
    return null;
  }

  function startDrag(evt, connKey, endpoint) {
    if (!editable) return;
    evt.preventDefault();
    evt.stopPropagation();
    const target = evt.currentTarget;
    const pointerId = evt.pointerId;
    try { target.setPointerCapture?.(pointerId); } catch {}
    const [sx, sy] = screenToSvg(evt);
    setDragInfo({ connKey, endpoint, pointerId, cursor: [sx, sy], proposedSide: null });
  }

  function moveDrag(evt) {
    if (!dragInfo) return;
    evt.preventDefault();
    const [sx, sy] = screenToSvg(evt);
    const idx = parseInt(dragInfo.connKey.slice(1), 10);
    const conn = connections[idx];
    if (!conn) return;
    const anchorId = dragInfo.endpoint === 'source' ? conn.fromId : conn.toId;
    const pos = positions[anchorId];
    if (!pos) return;
    const proposedSide = nearestSide(pos, sx, sy);
    // For target-handle drag, also detect drop-on-different-task (PR J) for
    // change-target. Highlighted in render so user sees where the new
    // connection will land. Reject self-loop (drop on source) and start
    // events (no incoming allowed). Drop on the original target task is
    // NOT a "change target" — that falls through to the port-snap branch.
    let dropTargetId = null;
    if (dragInfo.endpoint === 'target' && onChangeTarget) {
      const hitId = findTaskAtPoint(sx, sy);
      if (hitId && hitId !== conn.fromId && hitId !== conn.toId) {
        const hitTask = flow.tasks.find(t => t.id === hitId);
        if (hitTask && hitTask.type !== 'start') dropTargetId = hitId;
      }
    }
    setDragInfo({ ...dragInfo, cursor: [sx, sy], proposedSide, dropTargetId });
  }

  function endDrag(evt) {
    if (!dragInfo) return;
    evt.preventDefault();
    const idx = parseInt(dragInfo.connKey.slice(1), 10);
    const conn = connections[idx];
    if (!conn) { setDragInfo(null); return; }

    // Priority 1 — PR J: target handle dropped on a different valid task →
    // change the connection's target. Snap port = nearest side of new target
    // to the drop coordinate.
    if (dragInfo.dropTargetId && dragInfo.endpoint === 'target' && onChangeTarget) {
      const newTargetId = dragInfo.dropTargetId;
      const newPos = positions[newTargetId];
      const [sx, sy] = dragInfo.cursor;
      const snapSide = newPos ? nearestSide(newPos, sx, sy) : 'left';
      onChangeTarget(conn.fromId, conn.overrideKey, newTargetId, snapSide);
      setDragInfo(null);
      return;
    }

    // Priority 2 — PR G: snap to nearest port of the original anchor task.
    if (dragInfo.proposedSide && onUpdateOverride) {
      const currentSide = dragInfo.endpoint === 'source' ? conn.exitSide : conn.entrySide;
      if (dragInfo.proposedSide !== currentSide) {
        const partial = dragInfo.endpoint === 'source'
          ? { exitSide: dragInfo.proposedSide }
          : { entrySide: dragInfo.proposedSide };
        onUpdateOverride(conn.fromId, conn.overrideKey, partial);
      }
    }
    setDragInfo(null);
  }

  const selectedConn = selectedConnKey
    ? connections[parseInt(selectedConnKey.slice(1), 10)]
    : null;

  async function handleExport() {
    if (!exportRef.current) return;
    resetStickyForExport();
    try {
      const dataUrl = await toPng(exportRef.current, { pixelRatio: 2, backgroundColor: '#ffffff' });
      const a = document.createElement('a');
      a.download = `${flow.l3Number}-${flow.l3Name}-${todayYmd()}.png`;
      a.href = dataUrl;
      a.click();
    } catch (e) {
      alert(`PNG 匯出失敗：${e?.message || e}`);
    }
  }

  function handleExportDrawio() {
    try {
      exportDrawio(flow);
    } catch (e) {
      alert(`Draw.io 匯出失敗：${e?.message || e}`);
    }
  }

  return (
    <div className="flex flex-col gap-3 w-full">
      {showExport && (
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-sm text-gray-600 font-medium">
            {flow.l3Number} {flow.l3Name}
          </span>
          <div className="ml-auto flex gap-2">
            <button onClick={handleExport}
              className="px-4 py-1.5 text-sm text-white rounded transition-colors"
              style={{ background: '#3470B5' }}
              onMouseEnter={e => e.currentTarget.style.background = '#274F86'}
              onMouseLeave={e => e.currentTarget.style.background = '#3470B5'}>
              ↓ 匯出 PNG
            </button>
            <button onClick={handleExportDrawio}
              title="可用 diagrams.net（免費）或 VS Code Draw.io 擴充套件開啟編輯"
              className="px-4 py-1.5 text-sm text-white rounded transition-colors"
              style={{ background: '#2A5598' }}
              onMouseEnter={e => e.currentTarget.style.background = '#1E4677'}
              onMouseLeave={e => e.currentTarget.style.background = '#2A5598'}>
              ↓ 匯出 .drawio
            </button>
          </div>
        </div>
      )}

      {editable && (
        <div className="text-xs text-gray-500 -mt-1 flex items-center gap-2 flex-wrap">
          <span>點選連線可拖曳端點（🔵 圓點）：拖到原本任務的其他 port = 覆寫端點；拖到別的任務 = 換目標任務</span>
          {selectedConnKey && (
            <>
              <span className="text-blue-600">● 已選取連線</span>
              {/* PR I: reset button for the selected connection's override. */}
              {selectedConnHasOverride && onResetOverride && (
                <button
                  onClick={() => {
                    const idx = parseInt(selectedConnKey.slice(1), 10);
                    const c = connections[idx];
                    if (c) onResetOverride(c.fromId, c.overrideKey);
                  }}
                  className="px-2 py-0.5 text-xs rounded border border-amber-400 text-amber-700 bg-amber-50 hover:bg-amber-100">
                  重設此連線端點
                </button>
              )}
              <button
                onClick={() => setSelectedConnKey(null)}
                className="px-2 py-0.5 text-xs rounded border border-gray-300 text-gray-600 hover:bg-gray-50">
                取消選取 (Esc)
              </button>
            </>
          )}
        </div>
      )}

      <div ref={scrollContainerRef} onScroll={handleScrollLeft}
        className="overflow-auto border border-gray-300 rounded-lg bg-white w-full">
        <div ref={exportRef} style={{ display: 'inline-block', background: '#fff' }}>
        <svg ref={svgRef} width={svgWidth} height={svgHeight} xmlns="http://www.w3.org/2000/svg"
          onPointerMove={editable && dragInfo ? moveDrag : undefined}
          onPointerUp={editable && dragInfo ? endDrag : undefined}
          onPointerCancel={editable && dragInfo ? endDrag : undefined}
          onClick={editable ? () => setSelectedConnKey(null) : undefined}>
          <ArrowMarkers />

          <rect x={0} y={0} width={svgWidth} height={svgHeight} fill="#FFFFFF" />

          <rect x={0} y={0} width={svgWidth} height={TITLE_H} fill={COLORS.TITLE_BG} />
          <text x={svgWidth / 2} y={TITLE_H / 2} textAnchor="middle" dominantBaseline="middle"
            fill={COLORS.TITLE_TEXT} fontSize={16} fontWeight="bold"
            fontFamily="Microsoft JhengHei, PingFang TC, sans-serif">
            {flow.l3Number}　{flow.l3Name}　— 業務活動泳道圖
          </text>

          {/* Lane backgrounds + bottom borders. Role-header rect + name +
              the vertical separator at x=LANE_HEADER_W are split out into
              the sticky `<g>` near the end of this SVG so they stay anchored
              to the viewport during horizontal scroll. */}
          {flow.roles.map((role, i) => {
            const laneY = laneTopY[i];
            const laneH = laneHeights[i];
            const laneBg = i % 2 === 0 ? COLORS.LANE_ODD : COLORS.LANE_EVEN;
            // The top-corridor gap above this lane belongs visually to this
            // lane (arrows entering this lane use that corridor). Extend
            // header + body rects upward to absorb the gap so the swimlane
            // has no white strip when the corridor reserves extra space.
            const prevBottom = i === 0 ? TITLE_H : laneTopY[i - 1] + laneHeights[i - 1];
            const fillTop = prevBottom;
            const fillH = laneY + laneH - fillTop;
            return (
              <g key={role.id}>
                <rect x={LANE_HEADER_W} y={fillTop} width={svgWidth - LANE_HEADER_W} height={fillH}
                  fill={laneBg} />
                <line x1={0} y1={laneY + laneH} x2={svgWidth} y2={laneY + laneH}
                  stroke={COLORS.LANE_BORDER} strokeWidth={1} />
              </g>
            );
          })}

          {connections.map((conn, i) => (
            <ConnectionArrow key={i} conn={conn} connKey={`c${i}`} positions={positions}
              hoveredId={hoveredId} hoveredConnKey={hoveredConnKey}
              onHover={setHoveredConnKey}
              isSelected={selectedConnKey === `c${i}`}
              onSelect={setSelectedConnKey}
              editable={editable}
              isViolation={violatingConnIdx.has(i)} />
          ))}

          {(() => {
            // Derive endpoints of the hovered connection (if any) so we can
            // light up BOTH tasks that a hovered line connects.
            const hc = hoveredConnKey ? connections[parseInt(hoveredConnKey.slice(1), 10)] : null;
            const hoveredConnEndpoints = hc ? new Set([hc.fromId, hc.toId]) : null;
            return flow.tasks.map(task => {
            const pos = positions[task.id];
            if (!pos) return null;
            // Diagram label rule: only formal L3/L4 numbers appear on shapes.
            // Hide identifier-only suffixes (`_g*`, `-0`, `-99`).
            // L3 activity (subprocess call) shows the called L3 number instead.
            let num = l4Numbers[task.id];
            if (num && /(_g\d*|-0|-99)$/.test(num)) num = undefined;
            if (task.type === 'l3activity' && task.subprocessName?.trim()) {
              num = task.subprocessName.trim();
            }
            const isHovered = hoveredId === task.id
              || (hoveredConnEndpoints?.has(task.id) ?? false)
              || highlightedTaskId === task.id;
            const props = { pos, l4Number: num, task, isHovered };
            let shape;
            if (task.type === 'start')           shape = <StartShape {...props} />;
            else if (task.type === 'end')        shape = <EndShape {...props} />;
            else if (task.type === 'gateway')    shape = <GatewayShape {...props} />;
            else if (task.type === 'l3activity') shape = <L3ActivityShape {...props} />;
            else                                  shape = <TaskShape {...props} />;
            return (
              <g key={task.id}
                onMouseEnter={(e) => {
                  setHoveredId(task.id);
                  // Show tooltip only when the task has a description
                  // ("任務重點說明") to avoid empty popovers.
                  if (task.description?.trim()) {
                    const rect = e.currentTarget.getBoundingClientRect();
                    setTooltip({
                      taskId: task.id,
                      // Anchor center-X above the shape (stable, doesn't
                      // chase the cursor).
                      x: rect.left + rect.width / 2,
                      y: rect.top,
                    });
                  }
                }}
                onMouseLeave={() => {
                  setHoveredId(null);
                  setTooltip(null);
                }}
                onClick={onTaskClick ? (e) => {
                  // Stop propagation so the SVG's clear-selection handler
                  // doesn't fire. Pass viewport coordinates so ContextMenu
                  // can position itself near the cursor.
                  e.stopPropagation();
                  onTaskClick(task, e.clientX, e.clientY);
                } : undefined}
                style={{ cursor: 'pointer' }}>
                {shape}
              </g>
            );
          });
          })()}

          {/* PR J: drop-target highlight. While dragging the target handle,
              if the cursor is over a valid different task, draw a green
              dashed ring around it to signal "release here to change
              target". */}
          {editable && dragInfo?.dropTargetId && (() => {
            const pos = positions[dragInfo.dropTargetId];
            if (!pos) return null;
            const w = pos.right.x - pos.left.x;
            const h = pos.bottom.y - pos.top.y;
            return (
              <rect x={pos.left.x - 5} y={pos.top.y - 5}
                width={w + 10} height={h + 10}
                fill="none" stroke="#10B981" strokeWidth={3}
                strokeDasharray="6 3" rx={6} pointerEvents="none" />
            );
          })()}
                    {editable && dragInfo?.dropTargetId && (() => {
            const pos = positions[dragInfo.dropTargetId];
            if (!pos) return null;
            const w = pos.right.x - pos.left.x;
            const h = pos.bottom.y - pos.top.y;
            return (
              <rect x={pos.left.x - 5} y={pos.top.y - 5}
                width={w + 10} height={h + 10}
                fill="none" stroke="#10B981" strokeWidth={3}
                strokeDasharray="6 3" rx={6} pointerEvents="none" />
            );
          })()}

          {/* PR I: override indicators. A small amber dot on every manually
              overridden endpoint (source and/or target). Visible all the
              time so users can spot which connections have been hand-routed
              at a glance — unlike the handles, which only show on selection. */}
          {editable && connections.map((conn, i) => {
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
          })}

          {/* Drag preview: a dashed line from the anchor task's proposed
              side to the other endpoint, so the user sees how the path
              will redraw before releasing. */}
          {editable && dragInfo && dragInfo.proposedSide && (() => {
            const idx = parseInt(dragInfo.connKey.slice(1), 10);
            const conn = connections[idx];
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
          })()}

          {/* Handles for the selected connection's endpoints (render last
              so they're on top of tasks and connection lines). */}
          {editable && selectedConn && (() => {
            const from = positions[selectedConn.fromId];
            const to = positions[selectedConn.toId];
            if (!from || !to) return null;
            const srcPort = from[selectedConn.exitSide];
            const tgtPort = to[selectedConn.entrySide];
            const srcDragging = dragInfo?.endpoint === 'source';
            const tgtDragging = dragInfo?.endpoint === 'target';
            return (
              <>
                {srcPort && (
                  <EndpointHandle cx={srcPort.x} cy={srcPort.y}
                    onPointerDown={(e) => startDrag(e, selectedConnKey, 'source')}
                    isDragging={srcDragging} />
                )}
                {tgtPort && (
                  <EndpointHandle cx={tgtPort.x} cy={tgtPort.y}
                    onPointerDown={(e) => startDrag(e, selectedConnKey, 'target')}
                    isDragging={tgtDragging} />
                )}
              </>
            );
          })()}

          {/* Sticky role header column. Translated by `scrollLeft` via
              `handleScrollLeft` so it stays anchored to the left of the
              viewport while horizontal scrolling. Rendered LAST so it sits
              on top of connection lines and tasks (the column should
              visually cover anything that scrolls under it). */}
          <g ref={stickyHeadersRef} transform="translate(0, 0)">
            {flow.roles.map((role, i) => {
              const headerBg = role.type === 'external' ? COLORS.EXTERNAL_BG : COLORS.INTERNAL_BG;
              const laneY = laneTopY[i];
              const laneH = laneHeights[i];
              const prevBottom = i === 0 ? TITLE_H : laneTopY[i - 1] + laneHeights[i - 1];
              const fillTop = prevBottom;
              const fillH = laneY + laneH - fillTop;
              const lineH = 16;
              const lines = wrapText(role.name, 5);
              const total = (lines.length - 1) * lineH;
              return (
                <g key={`sticky-${role.id}`}>
                  <rect x={0} y={fillTop} width={LANE_HEADER_W} height={fillH} fill={headerBg} />
                  {lines.map((line, li) => (
                    <text key={li} x={LANE_HEADER_W / 2}
                      y={laneY + laneH / 2 - total / 2 + li * lineH}
                      textAnchor="middle" dominantBaseline="middle"
                      fill={COLORS.HEADER_TEXT} fontSize={13} fontWeight="bold"
                      fontFamily="Microsoft JhengHei, PingFang TC, sans-serif">
                      {line}
                    </text>
                  ))}
                </g>
              );
            })}
            <line x1={LANE_HEADER_W} y1={TITLE_H} x2={LANE_HEADER_W} y2={svgHeight}
              stroke={COLORS.LANE_BORDER} strokeWidth={1.5} />
          </g>
        </svg>
        </div>
      </div>

      <LegendSection />

      {/* Hover tooltip — shows task.description anchored above the shape.
          Only rendered when the user hovers a task that has a description. */}
      {tooltip && (() => {
        const t = (flow.tasks || []).find(x => x.id === tooltip.taskId);
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
            <div className="text-xs font-semibold text-gray-700 mb-1">任務重點說明</div>
            <div className="text-xs text-gray-600 whitespace-pre-wrap leading-relaxed">
              {t.description}
            </div>
          </div>
        );
      })()}
    </div>
  );
}

import { useRef, useEffect, useState } from 'react';
import { toPng } from 'html-to-image';
import { computeLayout, routeArrow } from '../diagram/layout.js';
import { LAYOUT, COLORS } from '../diagram/constants.js';
import { exportDrawio } from '../utils/drawioExport.js';
import { todayYmd } from '../utils/storage.js';

const { LANE_HEADER_W, COL_W, LANE_H, TITLE_H, NODE_W, NODE_H, DIAMOND_SIZE, CIRCLE_R } = LAYOUT;
const L3_INSET = 4; // inner border inset for L3 Activity shape

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
    </defs>
  );
}

function ConnectionArrow({ conn, connKey, positions, hoveredId, hoveredConnKey, onHover }) {
  const from = positions[conn.fromId];
  const to = positions[conn.toId];
  if (!from || !to) return null;

  const pts = routeArrow(from, to, conn.exitSide, conn.entrySide, conn.laneBottomY, conn.laneTopCorridorY);
  const pointsStr = pts.map(p => `${p[0]},${p[1]}`).join(' ');

  const labelPt = pts.length >= 3
    ? [(pts[1][0] + pts[2][0]) / 2, (pts[1][1] + pts[2][1]) / 2]
    : [(pts[0][0] + pts[pts.length - 1][0]) / 2, (pts[0][1] + pts[pts.length - 1][1]) / 2];

  // Highlight priority:
  //   (1) This connection itself is hovered → neutral HOVER_STROKE (both
  //       endpoint elements will also highlight via hoveredConnKey below).
  //   (2) An endpoint element is hovered → direction-aware coloring.
  let strokeColor = COLORS.ARROW_COLOR;
  let strokeW = 1.4;
  let markerId = 'ah';
  if (hoveredConnKey === connKey) {
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
       style={{ cursor: 'pointer' }}>
      {/* invisible wider stroke for easier hover targeting */}
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

export default function DiagramRenderer({ flow, showExport = true, autoExportPng = false, onExportDone = null }) {
  const exportRef = useRef(null);
  const [hoveredId, setHoveredId] = useState(null);
  const [hoveredConnKey, setHoveredConnKey] = useState(null);

  useEffect(() => {
    if (!autoExportPng || !exportRef.current) return;
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

  if (!flow || !flow.roles?.length || !flow.tasks?.length) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400 text-sm border border-dashed border-gray-300 rounded-lg">
        尚無流程資料，請完成表單後產生圖表
      </div>
    );
  }

  const { positions, connections, l4Numbers, svgWidth, svgHeight, laneTopY, laneHeights } = computeLayout(flow);

  async function handleExport() {
    if (!exportRef.current) return;
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

      <div className="overflow-auto border border-gray-300 rounded-lg bg-white w-full">
        <div ref={exportRef} style={{ display: 'inline-block', background: '#fff' }}>
        <svg width={svgWidth} height={svgHeight} xmlns="http://www.w3.org/2000/svg">
          <ArrowMarkers />

          <rect x={0} y={0} width={svgWidth} height={svgHeight} fill="#FFFFFF" />

          <rect x={0} y={0} width={svgWidth} height={TITLE_H} fill={COLORS.TITLE_BG} />
          <text x={svgWidth / 2} y={TITLE_H / 2} textAnchor="middle" dominantBaseline="middle"
            fill={COLORS.TITLE_TEXT} fontSize={16} fontWeight="bold"
            fontFamily="Microsoft JhengHei, PingFang TC, sans-serif">
            {flow.l3Number}　{flow.l3Name}　— 業務活動泳道圖
          </text>

          {flow.roles.map((role, i) => {
            const headerBg = role.type === 'external' ? COLORS.EXTERNAL_BG : COLORS.INTERNAL_BG;
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
                <rect x={0} y={fillTop} width={LANE_HEADER_W} height={fillH} fill={headerBg} />
                {wrapText(role.name, 5).map((line, li) => {
                  const lineH = 16;
                  const total = (wrapText(role.name, 5).length - 1) * lineH;
                  return (
                    <text key={li} x={LANE_HEADER_W / 2} y={laneY + laneH / 2 - total / 2 + li * lineH}
                      textAnchor="middle" dominantBaseline="middle"
                      fill={COLORS.HEADER_TEXT} fontSize={13} fontWeight="bold"
                      fontFamily="Microsoft JhengHei, PingFang TC, sans-serif">
                      {line}
                    </text>
                  );
                })}
                <line x1={0} y1={laneY + laneH} x2={svgWidth} y2={laneY + laneH}
                  stroke={COLORS.LANE_BORDER} strokeWidth={1} />
              </g>
            );
          })}

          <line x1={LANE_HEADER_W} y1={TITLE_H} x2={LANE_HEADER_W} y2={svgHeight}
            stroke={COLORS.LANE_BORDER} strokeWidth={1.5} />

          {connections.map((conn, i) => (
            <ConnectionArrow key={i} conn={conn} connKey={`c${i}`} positions={positions}
              hoveredId={hoveredId} hoveredConnKey={hoveredConnKey}
              onHover={setHoveredConnKey} />
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
            const isHovered = hoveredId === task.id || (hoveredConnEndpoints?.has(task.id) ?? false);
            const props = { pos, l4Number: num, task, isHovered };
            let shape;
            if (task.type === 'start')           shape = <StartShape {...props} />;
            else if (task.type === 'end')        shape = <EndShape {...props} />;
            else if (task.type === 'gateway')    shape = <GatewayShape {...props} />;
            else if (task.type === 'l3activity') shape = <L3ActivityShape {...props} />;
            else                                  shape = <TaskShape {...props} />;
            return (
              <g key={task.id}
                onMouseEnter={() => setHoveredId(task.id)}
                onMouseLeave={() => setHoveredId(null)}
                style={{ cursor: 'pointer' }}>
                {shape}
              </g>
            );
          });
          })()}
        </svg>
        </div>
      </div>

      <LegendSection />
    </div>
  );
}

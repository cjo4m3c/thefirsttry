import { useRef } from 'react';
import { toPng } from 'html-to-image';
import { computeLayout, routeArrow } from '../diagram/layout.js';
import { LAYOUT, COLORS } from '../diagram/constants.js';
import { exportVsdx } from '../utils/vsdxExport.js';

const { LANE_HEADER_W, COL_W, LANE_H, TITLE_H, NODE_W, NODE_H, DIAMOND_SIZE, CIRCLE_R } = LAYOUT;

function wrapText(text, maxChars) {
  if (!text) return [];
  const lines = [];
  for (let i = 0; i < text.length; i += maxChars) {
    lines.push(text.slice(i, i + maxChars));
  }
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

function StartShape({ pos, l4Number, task }) {
  const { cx, cy } = pos;
  return (
    <>
      <L4Number number={l4Number} cx={cx} y={cy - CIRCLE_R} />
      <circle cx={cx} cy={cy} r={CIRCLE_R} fill={COLORS.START_FILL} stroke={COLORS.START_STROKE} strokeWidth={2} />
      {task.name && (
        <text x={cx} y={cy + CIRCLE_R + 13} textAnchor="middle" dominantBaseline="middle"
          fontSize={10} fill={COLORS.TASK_TEXT}
          fontFamily="Microsoft JhengHei, PingFang TC, sans-serif">
          {task.name}
        </text>
      )}
    </>
  );
}

function EndShape({ pos, l4Number, task }) {
  const { cx, cy } = pos;
  return (
    <>
      <L4Number number={l4Number} cx={cx} y={cy - CIRCLE_R} />
      <circle cx={cx} cy={cy} r={CIRCLE_R} fill={COLORS.END_FILL} stroke={COLORS.END_FILL} strokeWidth={2} />
      {task.name && (
        <text x={cx} y={cy + CIRCLE_R + 13} textAnchor="middle" dominantBaseline="middle"
          fontSize={10} fill={COLORS.TASK_TEXT}
          fontFamily="Microsoft JhengHei, PingFang TC, sans-serif">
          {task.name}
        </text>
      )}
    </>
  );
}

function TaskShape({ task, pos, l4Number }) {
  const { cx, cy } = pos;
  const x = cx - NODE_W / 2;
  const y = cy - NODE_H / 2;
  const fill = task.type === 'interaction' ? COLORS.INTERACTION_FILL : COLORS.TASK_FILL;
  return (
    <>
      <L4Number number={l4Number} cx={cx} y={y} />
      <rect x={x} y={y} width={NODE_W} height={NODE_H}
        fill={fill} stroke={COLORS.TASK_STROKE} strokeWidth={1.2} rx={3} />
      <SvgLabel text={task.name} cx={cx} cy={cy} maxChars={7} lineH={14} />
    </>
  );
}

function GatewayShape({ task, pos, l4Number }) {
  const { cx, cy } = pos;
  const d = DIAMOND_SIZE;
  const pts = `${cx},${cy - d} ${cx + d},${cy} ${cx},${cy + d} ${cx - d},${cy}`;
  return (
    <>
      <L4Number number={l4Number} cx={cx} y={cy - d} />
      <polygon points={pts} fill={COLORS.GATEWAY_FILL} stroke={COLORS.GATEWAY_STROKE} strokeWidth={1.2} />
      <SvgLabel text={task.name} cx={cx} cy={cy} maxChars={5} lineH={13} fontSize={10.5} />
    </>
  );
}

function ArrowMarkers() {
  return (
    <defs>
      <marker id="ah" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
        <polygon points="0 0, 8 3, 0 6" fill={COLORS.ARROW_COLOR} />
      </marker>
      <marker id="ah-dashed" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
        <polygon points="0 0, 8 3, 0 6" fill={COLORS.ARROW_COLOR} />
      </marker>
    </defs>
  );
}

function ConnectionArrow({ conn, positions }) {
  const from = positions[conn.fromId];
  const to = positions[conn.toId];
  if (!from || !to) return null;

  const pts = routeArrow(from, to, conn.exitSide, conn.entrySide, conn.laneBottomY);
  const pointsStr = pts.map(p => `${p[0]},${p[1]}`).join(' ');

  // Place label at the midpoint of the longest/routing segment (pts[1]→pts[2] for 4-pt paths)
  const labelPt = pts.length >= 4
    ? [(pts[1][0] + pts[2][0]) / 2, (pts[1][1] + pts[2][1]) / 2]
    : pts[Math.floor(pts.length / 2)];

  return (
    <g>
      <polyline points={pointsStr} fill="none" stroke={COLORS.ARROW_COLOR}
        strokeWidth={1.4} markerEnd="url(#ah)" />
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
    { shape: 'start', label: '開始事件（活動起點）' },
    { shape: 'end', label: '結束事件（活動終點）' },
    { shape: 'task', label: 'L4 任務' },
    { shape: 'interaction', label: '外部關係人動作（互動）' },
    { shape: 'gateway', label: '網關（決策點）' },
    { shape: 'arrow', label: '順序流' },
    { shape: 'dashed', label: '消息流' },
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
  if (type === 'gateway') return (
    <svg width={s} height={s}><polygon points={`${c},4 ${s-4},${c} ${c},${s-4} 4,${c}`} fill={COLORS.GATEWAY_FILL} stroke={COLORS.GATEWAY_STROKE} strokeWidth={1.2} /></svg>
  );
  if (type === 'arrow') return (
    <svg width={s} height={s}>
      <defs><marker id="leg-ah" markerWidth="6" markerHeight="5" refX="6" refY="2.5" orient="auto"><polygon points="0 0,6 2.5,0 5" fill={COLORS.ARROW_COLOR} /></marker></defs>
      <line x1={2} y1={c} x2={s-6} y2={c} stroke={COLORS.ARROW_COLOR} strokeWidth={1.5} markerEnd="url(#leg-ah)" />
    </svg>
  );
  if (type === 'dashed') return (
    <svg width={s} height={s}>
      <defs><marker id="leg-ahd" markerWidth="6" markerHeight="5" refX="6" refY="2.5" orient="auto"><polygon points="0 0,6 2.5,0 5" fill={COLORS.ARROW_COLOR} /></marker></defs>
      <line x1={2} y1={c} x2={s-6} y2={c} stroke={COLORS.ARROW_COLOR} strokeWidth={1.5} strokeDasharray="4 3" markerEnd="url(#leg-ahd)" />
    </svg>
  );
  return null;
}

export default function DiagramRenderer({ flow, showExport = true }) {
  // exportRef wraps just the SVG element so toPng captures the full diagram, not the scroll window
  const exportRef = useRef(null);

  if (!flow || !flow.roles?.length || !flow.tasks?.length) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400 text-sm border border-dashed border-gray-300 rounded-lg">
        尚無流程資料，請完成表單後產生圖表
      </div>
    );
  }

  const { positions, connections, l4Numbers, svgWidth, svgHeight } = computeLayout(flow);

  async function handleExport() {
    if (!exportRef.current) return;
    try {
      const dataUrl = await toPng(exportRef.current, { pixelRatio: 2, backgroundColor: '#ffffff' });
      const a = document.createElement('a');
      a.download = `${flow.l3Number}-${flow.l3Name}.png`;
      a.href = dataUrl;
      a.click();
    } catch (e) {
      console.error('PNG 匯出失敗', e);
    }
  }

  async function handleExportVsdx() {
    try {
      await exportVsdx(flow);
    } catch (e) {
      console.error('VSDX 匯出失敗', e);
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
              className="px-4 py-1.5 text-sm bg-gray-700 text-white rounded hover:bg-gray-900 transition-colors">
              ↓ 匯出 PNG
            </button>
            <button onClick={handleExportVsdx}
              className="px-4 py-1.5 text-sm bg-indigo-700 text-white rounded hover:bg-indigo-900 transition-colors">
              ↓ 匯出 .vsdx
            </button>
          </div>
        </div>
      )}

      {/* Scroll container for viewing — does not affect export */}
      <div className="overflow-auto border border-gray-300 rounded-lg bg-white w-full">
        {/* exportRef wraps just the SVG so export is full-size */}
        <div ref={exportRef} style={{ display: 'inline-block', background: '#fff' }}>
        <svg width={svgWidth} height={svgHeight} xmlns="http://www.w3.org/2000/svg">
          <ArrowMarkers />

          {/* Background */}
          <rect x={0} y={0} width={svgWidth} height={svgHeight} fill="#FFFFFF" />

          {/* Title bar */}
          <rect x={0} y={0} width={svgWidth} height={TITLE_H} fill={COLORS.TITLE_BG} />
          <text x={svgWidth / 2} y={TITLE_H / 2} textAnchor="middle" dominantBaseline="middle"
            fill={COLORS.TITLE_TEXT} fontSize={16} fontWeight="bold"
            fontFamily="Microsoft JhengHei, PingFang TC, sans-serif">
            {flow.l3Number}　{flow.l3Name}　— 業務流程泳道圖
          </text>

          {/* Lane headers and bodies */}
          {flow.roles.map((role, i) => {
            const headerBg = role.type === 'external' ? COLORS.EXTERNAL_BG : COLORS.INTERNAL_BG;
            const laneY = TITLE_H + i * LANE_H;
            const laneBg = i % 2 === 0 ? COLORS.LANE_ODD : COLORS.LANE_EVEN;
            return (
              <g key={role.id}>
                {/* Lane body */}
                <rect x={LANE_HEADER_W} y={laneY} width={svgWidth - LANE_HEADER_W} height={LANE_H}
                  fill={laneBg} />
                {/* Header */}
                <rect x={0} y={laneY} width={LANE_HEADER_W} height={LANE_H} fill={headerBg} />
                {/* Role name (rotated or wrapped) */}
                {wrapText(role.name, 5).map((line, li) => {
                  const lineH = 16;
                  const total = (wrapText(role.name, 5).length - 1) * lineH;
                  return (
                    <text key={li} x={LANE_HEADER_W / 2} y={laneY + LANE_H / 2 - total / 2 + li * lineH}
                      textAnchor="middle" dominantBaseline="middle"
                      fill={COLORS.HEADER_TEXT} fontSize={13} fontWeight="bold"
                      fontFamily="Microsoft JhengHei, PingFang TC, sans-serif">
                      {line}
                    </text>
                  );
                })}
                {/* Lane bottom border */}
                <line x1={0} y1={laneY + LANE_H} x2={svgWidth} y2={laneY + LANE_H}
                  stroke={COLORS.LANE_BORDER} strokeWidth={1} />
              </g>
            );
          })}

          {/* Vertical header border */}
          <line x1={LANE_HEADER_W} y1={TITLE_H} x2={LANE_HEADER_W} y2={svgHeight}
            stroke={COLORS.LANE_BORDER} strokeWidth={1.5} />

          {/* Connections (rendered below shapes) */}
          {connections.map((conn, i) => (
            <ConnectionArrow key={i} conn={conn} positions={positions} />
          ))}

          {/* Shapes */}
          {flow.tasks.map(task => {
            const pos = positions[task.id];
            const num = l4Numbers[task.id];
            if (!pos) return null;
            if (task.type === 'start') return <StartShape key={task.id} pos={pos} l4Number={num} task={task} />;
            if (task.type === 'end') return <EndShape key={task.id} pos={pos} l4Number={num} task={task} />;
            if (task.type === 'gateway') return <GatewayShape key={task.id} task={task} pos={pos} l4Number={num} />;
            return <TaskShape key={task.id} task={task} pos={pos} l4Number={num} />;
          })}
        </svg>
        </div>{/* end exportRef wrapper */}
      </div>{/* end scroll container */}

      <LegendSection />
    </div>
  );
}

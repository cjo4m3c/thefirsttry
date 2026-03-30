import { useRef } from 'react';
import { toPng } from 'html-to-image';
import { COLORS, LAYOUT } from '../constants/colors.js';
import { getBorderPoint } from '../utils/layout.js';

const { NODE_W, NODE_H, CIRCLE_R, DIAMOND_SIZE, LANE_HEADER_W, LANE_H, TITLE_H } = LAYOUT;

// ─── Shape components ────────────────────────────────────────────────────────

function StartShape({ x, y }) {
  return (
    <g>
      <circle cx={x} cy={y} r={CIRCLE_R} fill={COLORS.startFill} stroke={COLORS.startStroke} strokeWidth={2} />
    </g>
  );
}

function EndShape({ x, y }) {
  return (
    <g>
      <circle cx={x} cy={y} r={CIRCLE_R} fill={COLORS.endFill} stroke={COLORS.endStroke} strokeWidth={2} />
    </g>
  );
}

function GatewayShape({ x, y, label }) {
  const d = DIAMOND_SIZE;
  const points = `${x},${y - d} ${x + d},${y} ${x},${y + d} ${x - d},${y}`;
  const lines = wrapText(label, 10);
  return (
    <g>
      <polygon points={points} fill={COLORS.gatewayFill} stroke={COLORS.gatewayStroke} strokeWidth={1.5} />
      {lines.map((line, i) => (
        <text
          key={i}
          x={x}
          y={y + (i - (lines.length - 1) / 2) * 13}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={10}
          fill="#333"
        >
          {line}
        </text>
      ))}
    </g>
  );
}

function TaskShape({ x, y, label, type }) {
  const w = NODE_W;
  const h = NODE_H;
  const fill = type === 'interaction' ? COLORS.interactionFill : COLORS.taskFill;
  const stroke = type === 'interaction' ? COLORS.interactionStroke : COLORS.taskStroke;
  const borderColor = type === 'activity' ? COLORS.activityBorder : stroke;
  const strokeWidth = type === 'activity' ? 2.5 : 1.5;
  const lines = wrapText(label, 14);
  return (
    <g>
      <rect
        x={x - w / 2}
        y={y - h / 2}
        width={w}
        height={h}
        rx={3}
        fill={fill}
        stroke={borderColor}
        strokeWidth={strokeWidth}
      />
      {lines.map((line, i) => (
        <text
          key={i}
          x={x}
          y={y + (i - (lines.length - 1) / 2) * 14}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={11}
          fill={type === 'activity' ? COLORS.activityText : '#333'}
          fontWeight={type === 'activity' ? '600' : 'normal'}
        >
          {line}
        </text>
      ))}
    </g>
  );
}

function wrapText(text, maxChars) {
  if (!text) return [''];
  const words = text.split('');
  const lines = [];
  let current = '';
  for (const ch of words) {
    current += ch;
    if (current.length >= maxChars) {
      lines.push(current);
      current = '';
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [''];
}

// ─── Arrow rendering ──────────────────────────────────────────────────────────

function Arrow({ from, to, label, dashed, stepMap }) {
  const fromStep = stepMap[from];
  const toStep = stepMap[to];
  if (!fromStep || !toStep) return null;

  const { x: tx, y: ty } = toStep;
  const { x: fx, y: fy } = fromStep;

  const start = getBorderPoint(fromStep, tx, ty);
  const end = getBorderPoint(toStep, fx, fy);

  const mx = (start.x + end.x) / 2;
  const my = (start.y + end.y) / 2;

  // Build path — use a slight curve for cross-lane arrows
  const crossLane = fromStep.row !== toStep.row;
  let d;
  if (crossLane) {
    const cpx = start.x + (end.x - start.x) * 0.5;
    const cpy = start.y;
    d = `M ${start.x} ${start.y} Q ${cpx} ${cpy} ${end.x} ${end.y}`;
  } else {
    d = `M ${start.x} ${start.y} L ${end.x} ${end.y}`;
  }

  const arrowId = `arrow-${from}-${to}`;

  return (
    <g>
      <defs>
        <marker
          id={arrowId}
          markerWidth="8"
          markerHeight="8"
          refX="6"
          refY="3"
          orient="auto"
        >
          <path d="M0,0 L0,6 L8,3 z" fill={COLORS.arrowColor} />
        </marker>
      </defs>
      <path
        d={d}
        stroke={COLORS.arrowColor}
        strokeWidth={1.5}
        fill="none"
        strokeDasharray={dashed ? '6,4' : undefined}
        markerEnd={`url(#${arrowId})`}
      />
      {label && (
        <g>
          <rect
            x={mx - label.length * 3.5 - 2}
            y={my - 8}
            width={label.length * 7 + 4}
            height={14}
            fill="white"
            opacity={0.85}
          />
          <text x={mx} y={my} textAnchor="middle" dominantBaseline="middle" fontSize={10} fill="#555">
            {label}
          </text>
        </g>
      )}
    </g>
  );
}

// ─── Main diagram ─────────────────────────────────────────────────────────────

export default function DiagramPanel({ data, svgWidth, svgHeight }) {
  const svgRef = useRef(null);

  const handleDownload = async () => {
    if (!svgRef.current) return;
    try {
      const dataUrl = await toPng(svgRef.current, { cacheBust: true, pixelRatio: 2 });
      const a = document.createElement('a');
      a.download = `${data?.title || 'swimlane'}.png`;
      a.href = dataUrl;
      a.click();
    } catch (err) {
      alert('下載失敗: ' + err.message);
    }
  };

  if (!data) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-base font-semibold text-gray-700">預覽</h2>
        </div>
        <div className="flex-1 flex items-center justify-center text-gray-400 border border-gray-200 rounded-lg bg-white">
          在左側輸入流程內容後，點擊「產生圖表」
        </div>
      </div>
    );
  }

  const { title, lanes, steps, connections } = data;
  const stepMap = Object.fromEntries(steps.map(s => [s.id, s]));

  const laneColors = [
    '#5a7a6a', '#6b7a50', '#7a6a5a', '#4a6a7a',
    '#7a5a6a', '#5a6a7a', '#6a7a5a', '#7a5a5a',
  ];

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-base font-semibold text-gray-700">預覽</h2>
        <button className="btn-secondary text-sm" onClick={handleDownload}>
          ⬇ 下載 PNG
        </button>
      </div>

      <div className="diagram-scroll flex-1">
        <svg
          ref={svgRef}
          width={svgWidth}
          height={svgHeight}
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          style={{ display: 'block', background: 'white' }}
        >
          {/* ── Title bar ── */}
          <rect x={0} y={0} width={svgWidth} height={TITLE_H} fill={COLORS.titleBar} />
          <text
            x={svgWidth / 2}
            y={TITLE_H / 2}
            textAnchor="middle"
            dominantBaseline="middle"
            fill={COLORS.titleText}
            fontSize={16}
            fontWeight="bold"
            fontFamily="Microsoft JhengHei, PingFang TC, sans-serif"
          >
            {title}
          </text>

          {/* ── Lane rows ── */}
          {lanes.map((lane, i) => {
            const laneY = TITLE_H + i * LANE_H;
            const bg = i % 2 === 0 ? COLORS.laneBg : COLORS.laneAltBg;
            const headerColor = laneColors[i % laneColors.length];
            return (
              <g key={lane.id}>
                {/* Lane body background */}
                <rect
                  x={LANE_HEADER_W}
                  y={laneY}
                  width={svgWidth - LANE_HEADER_W}
                  height={LANE_H}
                  fill={bg}
                  stroke={COLORS.laneBorder}
                  strokeWidth={1}
                />
                {/* Lane header */}
                <rect
                  x={0}
                  y={laneY}
                  width={LANE_HEADER_W}
                  height={LANE_H}
                  fill={headerColor}
                  stroke={COLORS.laneHeaderBorder}
                  strokeWidth={1}
                />
                <text
                  x={LANE_HEADER_W / 2}
                  y={laneY + LANE_H / 2}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill="white"
                  fontSize={12}
                  fontWeight="bold"
                  fontFamily="Microsoft JhengHei, PingFang TC, sans-serif"
                >
                  {lane.name}
                </text>
              </g>
            );
          })}

          {/* ── Arrows (rendered below shapes) ── */}
          {connections.map((conn, i) => (
            <Arrow
              key={i}
              from={conn.from}
              to={conn.to}
              label={conn.label}
              dashed={conn.dashed}
              stepMap={stepMap}
            />
          ))}

          {/* ── Steps ── */}
          {steps.map(step => {
            const { x, y, type, label, id } = step;
            if (type === 'start') return <StartShape key={id} x={x} y={y} />;
            if (type === 'end') return <EndShape key={id} x={x} y={y} />;
            if (type === 'gateway') return <GatewayShape key={id} x={x} y={y} label={label} />;
            return <TaskShape key={id} x={x} y={y} label={label} type={type} />;
          })}
        </svg>
      </div>

      {/* ── Legend ── */}
      <Legend />
    </div>
  );
}

function Legend() {
  const items = [
    { shape: 'start', label: '開始事件' },
    { shape: 'end', label: '結束事件' },
    { shape: 'gateway', label: '網關' },
    { shape: 'task', label: 'L4 任務' },
    { shape: 'activity', label: 'L3 活動' },
    { shape: 'interaction', label: '互動' },
  ];
  return (
    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-600 border-t pt-2">
      {items.map(({ shape, label }) => (
        <span key={shape} className="flex items-center gap-1">
          <LegendIcon shape={shape} />
          {label}
        </span>
      ))}
      <span className="flex items-center gap-1">
        <svg width="28" height="10"><line x1="2" y1="5" x2="22" y2="5" stroke="#333" strokeWidth="1.5" markerEnd="url(#leg-arrow)" /><defs><marker id="leg-arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0,0 L0,6 L6,3 z" fill="#333" /></marker></defs></svg>
        順序流
      </span>
      <span className="flex items-center gap-1">
        <svg width="28" height="10"><line x1="2" y1="5" x2="22" y2="5" stroke="#333" strokeWidth="1.5" strokeDasharray="4,3" /></svg>
        消息流
      </span>
    </div>
  );
}

function LegendIcon({ shape }) {
  if (shape === 'start') return <svg width="16" height="16"><circle cx="8" cy="8" r="6" fill="white" stroke="black" strokeWidth="1.5" /></svg>;
  if (shape === 'end') return <svg width="16" height="16"><circle cx="8" cy="8" r="6" fill="black" stroke="black" strokeWidth="1.5" /></svg>;
  if (shape === 'gateway') return <svg width="16" height="16"><polygon points="8,2 14,8 8,14 2,8" fill="white" stroke="#333" strokeWidth="1.5" /></svg>;
  if (shape === 'task') return <svg width="26" height="16"><rect x="1" y="3" width="24" height="10" rx="2" fill="white" stroke="#333" strokeWidth="1.5" /></svg>;
  if (shape === 'activity') return <svg width="26" height="16"><rect x="1" y="3" width="24" height="10" rx="2" fill="#e8f4ee" stroke={COLORS.activityBorder} strokeWidth="2" /></svg>;
  if (shape === 'interaction') return <svg width="26" height="16"><rect x="1" y="3" width="24" height="10" rx="2" fill={COLORS.interactionFill} stroke={COLORS.interactionStroke} strokeWidth="1.5" /></svg>;
  return null;
}

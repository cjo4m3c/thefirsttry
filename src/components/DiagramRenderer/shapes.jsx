import { LAYOUT, COLORS } from '../../diagram/constants.js';
import { SvgLabel, L4Number, EventLabel } from './text.jsx';

const { NODE_W, NODE_H, DIAMOND_SIZE, CIRCLE_R } = LAYOUT;

const HOVER_STROKE = '#2563EB'; // Tailwind blue-600
const HOVER_TINT   = '#DBEAFE'; // Tailwind blue-100

export function StartShape({ pos, l4Number, task, isHovered }) {
  const { cx, cy } = pos;
  const stroke = isHovered ? HOVER_STROKE : COLORS.START_STROKE;
  const strokeW = isHovered ? 3 : 2;
  return (
    <>
      <L4Number number={l4Number} cx={cx} y={cy - CIRCLE_R} />
      <circle cx={cx} cy={cy} r={CIRCLE_R} fill={COLORS.START_FILL} stroke={stroke} strokeWidth={strokeW} />
      <EventLabel cx={cx} y={cy + CIRCLE_R + 18} name={task.name} desc={task.description} />
    </>
  );
}

export function EndShape({ pos, l4Number, task, isHovered }) {
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
      <EventLabel cx={cx} y={cy + CIRCLE_R + 18} name={task.name} desc={desc} />
    </>
  );
}

export function TaskShape({ task, pos, l4Number, isHovered }) {
  const { cx, cy } = pos;
  const x = cx - NODE_W / 2;
  const y = cy - NODE_H / 2;
  const baseFill = task.shapeType === 'interaction' ? COLORS.INTERACTION_FILL : COLORS.TASK_FILL;
  const fill = isHovered ? HOVER_TINT : baseFill;
  const stroke = isHovered ? HOVER_STROKE : COLORS.TASK_STROKE;
  const strokeW = isHovered ? 2.5 : 1.2;
  return (
    <>
      <L4Number number={l4Number} cx={cx} y={y} />
      <rect x={x} y={y} width={NODE_W} height={NODE_H}
        fill={fill} stroke={stroke} strokeWidth={strokeW} rx={3} />
      <SvgLabel text={task.name} cx={cx} cy={cy} maxChars={7} lineH={24} />
    </>
  );
}

export function L3ActivityShape({ task, pos, l4Number, isHovered }) {
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
          <text x={cx} y={cy - 14} textAnchor="middle" dominantBaseline="middle"
            fontSize={14} fill="#6B7280" fontFamily="Microsoft JhengHei, PingFang TC, sans-serif">
            [子流程]
          </text>
          <SvgLabel text={task.name || ''} cx={cx} cy={cy + 14} maxChars={8} lineH={32} />
        </>
      ) : (
        <SvgLabel text={task.name} cx={cx} cy={cy} maxChars={8} lineH={32} />
      )}
    </>
  );
}

export function GatewayShape({ task, pos, l4Number, isHovered }) {
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
      <SvgLabel text={task.name} cx={cx} cy={cy + d + 14} maxChars={8} lineH={22} fontSize={14} />
    </>
  );
}

import { LAYOUT } from './constants.js';

const { LANE_HEADER_W, COL_W, LANE_H, TITLE_H, NODE_W, NODE_H, DIAMOND_SIZE, CIRCLE_R } = LAYOUT;

function halfExtent(type, axis) {
  if (type === 'gateway') return DIAMOND_SIZE;
  if (type === 'start' || type === 'end') return CIRCLE_R;
  return axis === 'x' ? NODE_W / 2 : NODE_H / 2;
}

export function computeLayout(flow) {
  const { roles, tasks, l3Number } = flow;

  const roleIndexMap = {};
  roles.forEach((r, i) => { roleIndexMap[r.id] = i; });

  const positions = {};
  const l4Numbers = {};

  // Only 'task' type gets L4 numbers
  let taskCounter = 1;
  tasks.forEach((task, colIdx) => {
    const row = roleIndexMap[task.roleId] ?? 0;
    const cx = LANE_HEADER_W + colIdx * COL_W + COL_W / 2;
    const cy = TITLE_H + row * LANE_H + LANE_H / 2;
    const hx = halfExtent(task.type, 'x');
    const hy = halfExtent(task.type, 'y');

    positions[task.id] = {
      col: colIdx,
      row,
      cx,
      cy,
      right:  { x: cx + hx, y: cy },
      left:   { x: cx - hx, y: cy },
      bottom: { x: cx, y: cy + hy },
      top:    { x: cx, y: cy - hy },
    };

    l4Numbers[task.id] = task.type === 'task' ? `${l3Number}.${taskCounter++}` : null;
  });

  const connections = [];
  const taskIdSet = new Set(tasks.map(t => t.id));

  tasks.forEach(task => {
    const fromPos = positions[task.id];

    if (task.type === 'gateway' && task.conditions?.length > 0) {
      task.conditions.forEach((cond, condIdx) => {
        if (!cond.nextTaskId || !taskIdSet.has(cond.nextTaskId)) return;
        const toTask = tasks.find(t => t.id === cond.nextTaskId);
        if (!toTask) return;
        const toPos = positions[toTask.id];
        const exitSide = condIdx === 0 ? 'right' : 'bottom';
        const entrySide = toPos.col > fromPos.col ? 'left'
          : toPos.col === fromPos.col ? 'top' : 'left';
        connections.push({ fromId: task.id, toId: toTask.id, label: cond.label, exitSide, entrySide });
      });
    } else if (task.type !== 'end' && task.type !== 'gateway' && task.nextTaskId && taskIdSet.has(task.nextTaskId)) {
      const toTask = tasks.find(t => t.id === task.nextTaskId);
      if (!toTask) return;
      connections.push({ fromId: task.id, toId: toTask.id, label: '', exitSide: 'right', entrySide: 'left' });
    }
  });

  const svgWidth = LANE_HEADER_W + tasks.length * COL_W + LAYOUT.PADDING_RIGHT;
  const svgHeight = TITLE_H + roles.length * LANE_H + LAYOUT.PADDING_BOTTOM;

  return { positions, connections, l4Numbers, svgWidth, svgHeight };
}

export function routeArrow(fromPos, toPos, exitSide, entrySide) {
  const sx = fromPos[exitSide].x;
  const sy = fromPos[exitSide].y;
  const tx = toPos[entrySide].x;
  const ty = toPos[entrySide].y;

  if (Math.abs(sy - ty) < 1) return [[sx, sy], [tx, ty]];
  if (Math.abs(sx - tx) < 1) return [[sx, sy], [tx, ty]];

  if (exitSide === 'bottom') {
    if (sx <= tx) {
      const midY = sy + (ty - sy) / 2;
      return [[sx, sy], [sx, midY], [tx, midY], [tx, ty]];
    }
    const belowY = sy + 30;
    return [[sx, sy], [sx, belowY], [tx, belowY], [tx, ty]];
  }

  if (sx < tx) {
    const midX = (sx + tx) / 2;
    return [[sx, sy], [midX, sy], [midX, ty], [tx, ty]];
  }

  const topY = TITLE_H - 22;
  return [[sx, sy], [sx + 18, sy], [sx + 18, topY], [tx - 18, topY], [tx - 18, ty], [tx, ty]];
}

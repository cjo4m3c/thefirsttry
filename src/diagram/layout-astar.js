/**
 * layout-astar.js — 戊 A*：用 main 的位置計算，A* 取代 routeArrow。
 *
 * 世界觀：
 *   - role lane、L4 column、deterministic 位置 → 100% 沿用 main
 *   - 連線路徑 → A* 自動避障，不再走 main 的 phase 1~3f
 *
 * 跟 main 的 computeLayout 差別：
 *   - skip phase 1~3f（不算 exitSide/entrySide/corridor）
 *   - skip bottomYMap/topYMap（不需要槽位算法）
 *   - 仍跑 columnAssign + role row + lane height（位置 100% main）
 *   - connections 用 router.routeAll() 一次性產出，含 _bendPoints
 *
 * 這個 router 是 sync 的（A* 同步演算法），但 interface 仍跟其他 router 對齊
 * （warmAsync 是 no-op resolved promise）。
 */
import { LAYOUT } from './constants.js';
import { computeDisplayLabels } from '../utils/taskDefs.js';
import { computeColumnMap, resolveRowCollisions } from './layout/columnAssign.js';
import { halfExtent, NODE_VOFFSET } from './layout/helpers.js';
import { routeAll } from './pathfinding/router.js';

const { LANE_HEADER_W, COL_W, LANE_H: BASE_LANE_H, TITLE_H } = LAYOUT;

// 兩層 cache：
//   1. WeakMap by flow object identity（無 hash 開銷，命中時直接回）
//   2. structural hash — 同樣結構的不同 flow object（例如 React 編輯後新 flow）
//      不重算。Hash 只看影響 layout 的欄位（id/role/nextTask/conditions/override），
//      不看 name 等顯示欄位。
const objCache = new WeakMap();   // flow → layout
const hashCache = new Map();      // structuralHash → layout
const HASH_CACHE_LIMIT = 20;

function structuralHash(flow) {
  const parts = [];
  parts.push('R');
  (flow.roles || []).forEach(r => parts.push(r.id || ''));
  parts.push('T');
  (flow.tasks || []).forEach(t => {
    parts.push(t.id, '|', t.type || '', '|', t.roleId || '', '|',
      t.shapeType || '', '|',
      (t.nextTaskIds?.join(',') || t.nextTaskId || ''), '|');
    if (t.type === 'gateway') {
      (t.conditions || []).forEach(c => {
        parts.push(c.id || '', '>', c.nextTaskId || '', ';');
      });
    }
    if (t.connectionOverrides) {
      Object.entries(t.connectionOverrides).forEach(([k, v]) => {
        parts.push('O', k, '=', v.exitSide || '', '/', v.entrySide || '', ';');
      });
    }
    parts.push('\n');
  });
  parts.push('L', flow.l3Number || '');
  return parts.join('');
}

export function computeLayout(flow) {
  if (!flow) return emptyLayout();
  if (objCache.has(flow)) return objCache.get(flow);
  const hash = structuralHash(flow);
  const cached = hashCache.get(hash);
  if (cached) {
    objCache.set(flow, cached);
    return cached;
  }
  try {
    const r = doLayout(flow);
    objCache.set(flow, r);
    hashCache.set(hash, r);
    // Trim cache to keep memory bounded
    if (hashCache.size > HASH_CACHE_LIMIT) {
      const firstKey = hashCache.keys().next().value;
      hashCache.delete(firstKey);
    }
    return r;
  } catch (e) {
    console.error('[A* router] failed:', e);
    return emptyLayout();
  }
}

export function warmAsync(_flow) {
  // sync, no warming needed
  return Promise.resolve(null);
}

export function isReady(_flow) {
  return true;  // sync router 永遠 ready
}

/** Drag preview fallback — 簡單 L-shape，使用既有 routeArrow 邏輯 */
export function routeArrow(fromPos, toPos, exitSide, entrySide, _laneBottomY, _laneTopCorridorY) {
  if (!fromPos || !toPos) return [];
  const sx = fromPos[exitSide]?.x ?? fromPos.cx;
  const sy = fromPos[exitSide]?.y ?? fromPos.cy;
  const tx = toPos[entrySide]?.x ?? toPos.cx;
  const ty = toPos[entrySide]?.y ?? toPos.cy;
  if (Math.abs(sx - tx) < 1 || Math.abs(sy - ty) < 1) return [[sx, sy], [tx, ty]];
  if (exitSide === 'top' || exitSide === 'bottom') {
    return [[sx, sy], [sx, ty], [tx, ty]];
  }
  return [[sx, sy], [tx, sy], [tx, ty]];
}

function doLayout(flow) {
  const { tasks, roles, l3Number } = flow;

  // ── 1. Reuse main 的 column + row assignment ──────────────────
  const displayLabels = computeDisplayLabels(tasks, l3Number);
  const colOf = computeColumnMap(tasks, displayLabels);
  const roleIndexMap = {};
  roles.forEach((r, i) => { roleIndexMap[r.id] = i; });
  const taskRowOf = {};
  tasks.forEach(t => { taskRowOf[t.id] = roleIndexMap[t.roleId] ?? 0; });
  resolveRowCollisions(tasks, colOf, taskRowOf);

  // ── 2. Lane 位置（沿用 main 簡化版，跳過 phase 算的 corridor 高度）──
  const laneHeights = roles.map(() => BASE_LANE_H);
  const laneTopY = [];
  let y = TITLE_H;
  roles.forEach((_, row) => {
    laneTopY.push(y);
    y += laneHeights[row];
  });

  // ── 3. Positions ─────────────────────────────────────────────
  const positions = {};
  tasks.forEach(task => {
    const row = taskRowOf[task.id] ?? 0;
    const col = colOf[task.id] ?? 0;
    const cx = LANE_HEADER_W + col * COL_W + COL_W / 2;
    const cy = laneTopY[row] + NODE_VOFFSET;
    const hx = halfExtent(task.type, 'x');
    const hy = halfExtent(task.type, 'y');
    positions[task.id] = {
      col, row, cx, cy,
      right:  { x: cx + hx, y: cy },
      left:   { x: cx - hx, y: cy },
      bottom: { x: cx,      y: cy + hy },
      top:    { x: cx,      y: cy - hy },
    };
  });

  // ── 4. 收集所有 raw connections（含 user drag override）──
  const rawConns = [];
  const taskIds = new Set(tasks.map(t => t.id));
  tasks.forEach(task => {
    const overrides = task.connectionOverrides || {};
    if (task.type === 'gateway' && task.conditions?.length) {
      task.conditions.forEach(cond => {
        if (cond.nextTaskId && taskIds.has(cond.nextTaskId)) {
          rawConns.push({
            fromId: task.id, toId: cond.nextTaskId,
            label: cond.label || '', overrideKey: cond.id, condId: cond.id,
            _override: overrides[cond.id],
          });
        }
      });
    } else if (task.type !== 'end' && task.type !== 'gateway') {
      const nextIds = task.nextTaskIds?.length
        ? task.nextTaskIds
        : (task.nextTaskId ? [task.nextTaskId] : []);
      nextIds.forEach(nextId => {
        if (nextId && taskIds.has(nextId)) {
          rawConns.push({
            fromId: task.id, toId: nextId, label: '', overrideKey: nextId,
            _override: overrides[nextId],
          });
        }
      });
    }
  });

  // ── 5. SVG size ─────────────────────────────────────────────
  const maxCol = Math.max(0, ...Object.values(colOf));
  const totalH = laneTopY[roles.length - 1] + laneHeights[roles.length - 1];
  const svgWidth = LANE_HEADER_W + (maxCol + 1) * COL_W + LAYOUT.PADDING_RIGHT;
  const svgHeight = totalH + LAYOUT.PADDING_BOTTOM;

  // ── 6. 跑 A* 多 pass route ───────────────────────────────────
  const connections = routeAll(rawConns, positions, svgWidth, svgHeight);

  return {
    positions,
    connections,
    l4Numbers: displayLabels,
    svgWidth,
    svgHeight,
    laneTopY,
    laneHeights,
  };
}

function emptyLayout() {
  return {
    positions: {},
    connections: [],
    l4Numbers: {},
    svgWidth: LANE_HEADER_W + LAYOUT.PADDING_RIGHT,
    svgHeight: TITLE_H + BASE_LANE_H + LAYOUT.PADDING_BOTTOM,
    laneTopY: [TITLE_H],
    laneHeights: [BASE_LANE_H],
  };
}

/**
 * elkAdapter.js — ELK.js (Eclipse Layout Kernel) adapter.
 *
 * 用途：把 FlowSprite 的 flow 資料餵給 ELK 的 layered+orthogonal 演算法，
 * 取得 node 位置與 edge bend points，再轉回 FlowSprite 的 layout output 形狀
 * （positions / connections / l4Numbers / svgWidth / svgHeight / laneTopY /
 * laneHeights）。
 *
 * 給 /test-elk/ 測試版用。main 走 ./layout/index.js 不變。
 *
 * 設計重點：
 *   - 用我們現有的 columnAssign（L4 ordering）給 ELK 當 input x 提示
 *   - Role idx 給 input y 提示（row * LANE_H）
 *   - ELK strategies 用 INTERACTIVE，preserve relative order，不亂搬
 *   - hierarchyHandling=INCLUDE_CHILDREN，跨 role edges ELK 一起 route
 *   - 後處理：把 ELK 的 node 位置按 role 重排成 swimlane（每個 role 一條
 *     固定 y-band）；ELK 的 edge bend points 同步 shift
 *   - 規則 3 後處理 reorder：同 corridor Y 的多條 edges 按 target col 排序
 */
import { LAYOUT } from './constants.js';
import { computeDisplayLabels } from '../utils/taskDefs.js';
import { computeColumnMap } from './layout/columnAssign.js';
import { halfExtent } from './layout/helpers.js';

const { LANE_HEADER_W, COL_W, LANE_H: BASE_LANE_H, TITLE_H } = LAYOUT;

// Dynamic import elkjs：default build (VITE_ROUTER 不是 elk) 才不會把 ~850KB
// gzipped 的 ELK runtime 拉進主 bundle。第一次 call 時才載入。
let elkInstance = null;
let elkPromise = null;
async function getElk() {
  if (elkInstance) return elkInstance;
  if (!elkPromise) {
    elkPromise = import('elkjs/lib/elk.bundled.js').then(mod => {
      const ELK = mod.default || mod;
      elkInstance = new ELK();
      return elkInstance;
    });
  }
  return elkPromise;
}

const SHARED_LAYOUT_OPTIONS = {
  'elk.algorithm': 'layered',
  'elk.direction': 'RIGHT',
  'elk.edgeRouting': 'ORTHOGONAL',
  'elk.layered.layering.strategy': 'INTERACTIVE',
  'elk.layered.crossingMinimization.strategy': 'INTERACTIVE',
  'elk.layered.crossingMinimization.semiInteractive': 'true',
  'elk.layered.nodePlacement.strategy': 'INTERACTIVE',
  'elk.layered.cycleBreaking.strategy': 'INTERACTIVE',
  'elk.layered.spacing.nodeNodeBetweenLayers': '40',
  'elk.spacing.nodeNode': '30',
  'elk.spacing.edgeNode': '20',
  'elk.spacing.edgeEdge': '12',
  'elk.layered.spacing.edgeEdgeBetweenLayers': '12',
  'elk.layered.spacing.edgeNodeBetweenLayers': '20',
};

function nodeWidth(task) { return halfExtent(task.type, 'x') * 2; }
function nodeHeight(task) { return halfExtent(task.type, 'y') * 2; }

function buildElkGraph(flow, ctx) {
  const { tasks, roles } = flow;
  const { taskRowOf, taskColOf } = ctx;

  // ELK 提示座標：col idx → x，role idx → y。INTERACTIVE 策略只取相對順序。
  const children = tasks.map(task => {
    const w = nodeWidth(task);
    const h = nodeHeight(task);
    const col = taskColOf[task.id] ?? 0;
    const row = taskRowOf[task.id] ?? 0;
    return {
      id: task.id,
      width: w,
      height: h,
      x: LANE_HEADER_W + col * COL_W,
      y: TITLE_H + row * BASE_LANE_H,
    };
  });

  // Edges: 收集所有 forward 連線（gateway conditions / next 任務）
  const edges = [];
  const taskIds = new Set(tasks.map(t => t.id));
  tasks.forEach(task => {
    if (task.type === 'gateway' && task.conditions?.length) {
      task.conditions.forEach(cond => {
        if (cond.nextTaskId && taskIds.has(cond.nextTaskId)) {
          edges.push({
            id: `${task.id}__${cond.id}`,
            sources: [task.id],
            targets: [cond.nextTaskId],
            _meta: { fromId: task.id, toId: cond.nextTaskId, label: cond.label, overrideKey: cond.id, condId: cond.id },
          });
        }
      });
    } else if (task.type !== 'end' && task.type !== 'gateway') {
      const nextIds = task.nextTaskIds?.length
        ? task.nextTaskIds
        : (task.nextTaskId ? [task.nextTaskId] : []);
      nextIds.forEach(nextId => {
        if (nextId && taskIds.has(nextId)) {
          edges.push({
            id: `${task.id}__${nextId}`,
            sources: [task.id],
            targets: [nextId],
            _meta: { fromId: task.id, toId: nextId, label: '', overrideKey: nextId },
          });
        }
      });
    }
  });

  return {
    id: 'root',
    layoutOptions: SHARED_LAYOUT_OPTIONS,
    children,
    edges: edges.map(e => ({ id: e.id, sources: e.sources, targets: e.targets })),
    _edgeMeta: edges.map(e => e._meta),
  };
}

// 直接信任 ELK 的座標 + bend points（不二次重排，避免 ortho 變形）。
// 整體平移到 SVG 座標：x 平移到 LANE_HEADER_W 之後、y 平移到 TITLE_H 之後。
function buildPositions(elkResult, taskRowOf, roles) {
  const nodePos = {};
  elkResult.children.forEach(n => {
    nodePos[n.id] = { x: n.x, y: n.y, width: n.width, height: n.height };
  });

  // 全域平移
  const allXs = elkResult.children.map(n => n.x);
  const allYs = elkResult.children.map(n => n.y);
  const minX = allXs.length ? Math.min(...allXs) : 0;
  const minY = allYs.length ? Math.min(...allYs) : 0;
  const xShift = LANE_HEADER_W + 20 - minX;
  const yShift = TITLE_H + 20 - minY;

  // 推每條 lane 的 y bounds（從 per-role tasks 的 y 範圍）
  const laneBounds = roles.map(() => ({ minY: Infinity, maxY: -Infinity }));
  elkResult.children.forEach(n => {
    const row = taskRowOf[n.id];
    if (row === undefined) return;
    const top = n.y + yShift;
    const bottom = n.y + n.height + yShift;
    laneBounds[row].minY = Math.min(laneBounds[row].minY, top);
    laneBounds[row].maxY = Math.max(laneBounds[row].maxY, bottom);
  });

  const laneTopY = [];
  const laneHeights = [];
  roles.forEach((_, row) => {
    const b = laneBounds[row];
    if (!isFinite(b.minY)) {
      // role 沒任務：放在前後 lane 之間
      const prevTop = row > 0 ? laneTopY[row - 1] + laneHeights[row - 1] : TITLE_H;
      laneTopY.push(prevTop);
      laneHeights.push(BASE_LANE_H);
      return;
    }
    laneTopY.push(b.minY - 20);
    laneHeights.push(b.maxY - b.minY + 40);
  });

  return { nodePos, laneTopY, laneHeights, xShift, yShift };
}

function buildEdges(elkResult, edgeMeta, xShift, yShift) {
  const remapped = [];
  elkResult.edges.forEach((edge, i) => {
    const meta = edgeMeta[i];
    const allPts = [];
    edge.sections.forEach(s => {
      const start = { x: s.startPoint.x + xShift, y: s.startPoint.y + yShift };
      const end = { x: s.endPoint.x + xShift, y: s.endPoint.y + yShift };
      const bends = (s.bendPoints || []).map(p => ({ x: p.x + xShift, y: p.y + yShift }));
      allPts.push(start, ...bends, end);
    });
    if (allPts.length < 2) return;

    const first = allPts[0];
    const second = allPts[1];
    const last = allPts[allPts.length - 1];
    const prev = allPts[allPts.length - 2];

    const dx0 = second.x - first.x;
    const dy0 = second.y - first.y;
    let exitSide;
    if (Math.abs(dx0) >= Math.abs(dy0)) exitSide = dx0 >= 0 ? 'right' : 'left';
    else exitSide = dy0 >= 0 ? 'bottom' : 'top';

    const dx1 = last.x - prev.x;
    const dy1 = last.y - prev.y;
    let entrySide;
    if (Math.abs(dx1) >= Math.abs(dy1)) entrySide = dx1 >= 0 ? 'left' : 'right';
    else entrySide = dy1 >= 0 ? 'top' : 'bottom';

    const cleaned = cleanOrthoPath(allPts);
    remapped.push({
      ...meta,
      exitSide,
      entrySide,
      _bendPoints: cleaned.map(p => [p.x, p.y]),
    });
  });
  return remapped;
}

// 把 polyline 清成乾淨的 ortho path：
//   1. 對任意連續三點 a→b→c，若幾乎共線（dy or dx ≤ EPS），collapse b
//   2. 對非 axis-aligned 的相鄰段（diagonal），插入 corner 強制 ortho
//   3. 移除短於 EPS 的反向 jitter
function cleanOrthoPath(pts) {
  if (pts.length < 2) return pts.slice();
  const EPS = 2;

  // Pass 1: 強制每段 axis-aligned。檢查 a→b：dx 跟 dy 哪個小就 collapse 那軸
  // （把 b 對齊到 a 的那條軸線上）。
  const aligned = [{ x: pts[0].x, y: pts[0].y }];
  for (let i = 1; i < pts.length; i++) {
    const a = aligned[aligned.length - 1];
    const b = pts[i];
    const dx = Math.abs(b.x - a.x);
    const dy = Math.abs(b.y - a.y);
    if (dx <= EPS) {
      aligned.push({ x: a.x, y: b.y });
    } else if (dy <= EPS) {
      aligned.push({ x: b.x, y: a.y });
    } else {
      // 真 diagonal — 拆成 horizontal + vertical 兩段：先走 x 後走 y
      // 保留原 b 點不變，但插入轉折避免 diagonal stroke
      aligned.push({ x: b.x, y: a.y });
      aligned.push({ x: b.x, y: b.y });
    }
  }

  // Pass 2: dedupe identical consecutive points
  const dedup = [aligned[0]];
  for (let i = 1; i < aligned.length; i++) {
    const prev = dedup[dedup.length - 1];
    if (prev.x !== aligned[i].x || prev.y !== aligned[i].y) dedup.push(aligned[i]);
  }
  if (dedup.length < 3) return dedup;

  // Pass 3: collapse collinear runs (same x or same y for 3+ points)
  const collapsed = [dedup[0]];
  for (let i = 1; i < dedup.length - 1; i++) {
    const a = collapsed[collapsed.length - 1];
    const b = dedup[i];
    const c = dedup[i + 1];
    if ((a.y === b.y && b.y === c.y) || (a.x === b.x && b.x === c.x)) continue;
    collapsed.push(b);
  }
  collapsed.push(dedup[dedup.length - 1]);
  return collapsed;
}

function portCoord(cx, cy, hx, hy, side) {
  switch (side) {
    case 'left':   return { x: cx - hx, y: cy };
    case 'right':  return { x: cx + hx, y: cy };
    case 'top':    return { x: cx, y: cy - hy };
    case 'bottom': return { x: cx, y: cy + hy };
    default: return { x: cx, y: cy };
  }
}

export async function runElkLayout(flow) {
  const { tasks, roles, l3Number } = flow;

  if (!tasks?.length || !roles?.length) {
    return emptyLayout();
  }

  // ── 1. Reuse 既有 column assignment（L4 sort）給 ELK 當 input x 提示 ──
  const displayLabels = computeDisplayLabels(tasks, l3Number);
  const colOf = computeColumnMap(tasks, displayLabels);
  const taskColOf = colOf;
  const roleIndexMap = {};
  roles.forEach((r, i) => { roleIndexMap[r.id] = i; });
  const taskRowOf = {};
  tasks.forEach(t => { taskRowOf[t.id] = roleIndexMap[t.roleId] ?? 0; });

  // ── 2. 跑 ELK ──────────────────────────────────────────────────
  const graph = buildElkGraph(flow, { taskRowOf, taskColOf });
  const edgeMeta = graph._edgeMeta;
  delete graph._edgeMeta;

  let elkResult;
  try {
    const elk = await getElk();
    elkResult = await elk.layout(graph);
  } catch (e) {
    console.error('[ELK] layout failed:', e);
    return emptyLayout();
  }

  // ── 3. 從 ELK output 推 lane y bands + 全域 shift ──
  const { nodePos, laneTopY, laneHeights, xShift, yShift } = buildPositions(
    elkResult, taskRowOf, roles
  );

  // ── 4. shift edges 用同一個 xShift / yShift ─────────────────────
  const remappedEdges = buildEdges(elkResult, edgeMeta, xShift, yShift);

  // ── 5. 組 positions（FlowSprite 的形狀） ────────────────────────
  const positions = {};
  tasks.forEach(task => {
    const np = nodePos[task.id];
    if (!np) return;
    const row = taskRowOf[task.id] ?? 0;
    const cx = np.x + np.width / 2 + xShift;
    const cy = np.y + np.height / 2 + yShift;
    const hx = halfExtent(task.type, 'x');
    const hy = halfExtent(task.type, 'y');
    positions[task.id] = {
      col: taskColOf[task.id],
      row,
      cx, cy,
      right:  { x: cx + hx, y: cy },
      left:   { x: cx - hx, y: cy },
      bottom: { x: cx,      y: cy + hy },
      top:    { x: cx,      y: cy - hy },
    };
  });

  // ── 6. 組 connections（FlowSprite 的形狀） ──────────────────────
  // NOTE: 不 override endpoints。ELK 已給出 port 在 task 邊緣上的精確
  // 座標（同 task 多條邊會分配到不同 y/x offset），覆寫會讓 path 變
  // diagonal。視覺上連線會接到 task 邊上的不同點，這正是 ELK 設計的好處。
  const connections = remappedEdges.map(e => ({
    fromId: e.fromId,
    toId: e.toId,
    label: e.label || '',
    exitSide: e.exitSide,
    entrySide: e.entrySide,
    overrideKey: e.overrideKey,
    condId: e.condId,
    _bendPoints: e._bendPoints,
  }));

  // ── 7. svgWidth / svgHeight ─────────────────────────────────────
  const maxX = Math.max(...Object.values(positions).map(p => p.right.x), LANE_HEADER_W);
  const totalH = laneTopY[roles.length - 1] + laneHeights[roles.length - 1];
  const svgWidth = maxX + LAYOUT.PADDING_RIGHT;
  const svgHeight = totalH + LAYOUT.PADDING_BOTTOM;

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

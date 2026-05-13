/**
 * layout-elk-deep-a.js — 乙 ELK 深度 A：ELK 當決策諮詢，main 畫線。
 *
 * 世界觀：
 *   - role lane、L4 column、deterministic 位置 → 100% main
 *   - 每條 edge 的 exitSide / entrySide → 用 ELK 推導取代 main 的 phase
 *   - 實際畫線 → main 的 routeArrow（不動，等於用我們既有的 8 種 case）
 *
 * 流程：
 *   1. main computeLayout 跑完，拿到 positions + connections（含 main 算的
 *      exitSide / entrySide / laneBottomY / laneTopCorridorY）
 *   2. ELK 跑一遍（input = main 的 positions），拿到每條 edge 的 bend points
 *   3. 從 ELK bend points 推出 exitSide / entrySide
 *   4. 把 main 算的 exitSide / entrySide 替換成 ELK 的
 *   5. 重新呼叫 routeArrow 算 path
 *
 * 跟 main 比的差異：只有 exitSide / entrySide 換成 ELK 決策，其他全部一樣
 * 限制：main routeArrow 只支援 8 種 case，若 ELK 決策 case 不在裡面（例如
 * 同 col 跨 lane 走 col 中間 corridor），仍會回退到 default → 可能仍違規
 */

import { computeLayout as syncComputeLayout } from './layout/index.js';
import { routeArrow as syncRouteArrow } from './layout/routeArrow.js';
import { LAYOUT } from './constants.js';

const { LANE_HEADER_W, LANE_H: BASE_LANE_H, TITLE_H } = LAYOUT;

const cache = new WeakMap();   // flow → result
const inflight = new WeakMap(); // flow → Promise

export function warmAsync(flow) {
  if (!flow) return Promise.resolve(null);
  if (cache.has(flow)) return Promise.resolve(cache.get(flow));
  if (inflight.has(flow)) return inflight.get(flow);

  const p = doAdvise(flow).then(r => {
    cache.set(flow, r);
    inflight.delete(flow);
    return r;
  }).catch(e => {
    console.error('[ELK deep-A] failed, falling back to sync layout:', e);
    const sync = safeSync(flow);
    cache.set(flow, sync);
    inflight.delete(flow);
    return sync;
  });
  inflight.set(flow, p);
  return p;
}

export function isReady(flow) {
  return !!flow && cache.has(flow);
}

export function computeLayout(flow) {
  if (!flow) return emptyLayout();
  const cached = cache.get(flow);
  if (cached) return cached;
  warmAsync(flow);
  return emptyLayout();
}

export function routeArrow(fromPos, toPos, exitSide, entrySide, laneBottomY, laneTopCorridorY) {
  return syncRouteArrow(fromPos, toPos, exitSide, entrySide, laneBottomY, laneTopCorridorY);
}

async function doAdvise(flow) {
  // ── 1. main 的 layout ─────────────────────────────────────
  const mainLayout = syncComputeLayout(flow);
  const { positions, connections: mainConns, l4Numbers, svgWidth, svgHeight, laneTopY, laneHeights } = mainLayout;

  // ── 2. 跑 ELK 拿 advise ────────────────────────────────────
  let elkAdvice;
  try {
    elkAdvice = await runElkAdvisor(flow, positions);
  } catch (e) {
    console.warn('[ELK deep-A] advisor failed, using main decisions:', e);
    return { ...mainLayout, _elkFellBack: true };
  }

  // ── 3. 對每條 connection，用 ELK 建議覆寫 exitSide/entrySide ──
  // ELK advice key 用 fromId::overrideKey 對應
  const newConnections = mainConns.map(c => {
    const key = `${c.fromId}::${c.overrideKey}`;
    const advice = elkAdvice.get(key);
    if (!advice) return c;
    return {
      ...c,
      exitSide: advice.exitSide,
      entrySide: advice.entrySide,
      // 重新 routeArrow 用既有 corridor 資料（main 計算的）
    };
  });

  return {
    positions,
    connections: newConnections,
    l4Numbers,
    svgWidth,
    svgHeight,
    laneTopY,
    laneHeights,
    _routerMode: 'elk-deep-a',
  };
}

/**
 * 餵 ELK 我們的 positions，跑一次 layered+ortho，從 bend points 推每條 edge
 * 的 exitSide / entrySide。回傳 Map<`fromId::overrideKey`, {exitSide, entrySide}>
 */
async function runElkAdvisor(flow, positions) {
  const ELKMod = await import('elkjs/lib/elk.bundled.js');
  const ELK = ELKMod.default || ELKMod;
  const elk = new ELK();

  const { tasks } = flow;

  // Children with fixed positions (input hint)
  const children = tasks.map(t => {
    const p = positions[t.id];
    if (!p) return null;
    const w = p.right.x - p.left.x;
    const h = p.bottom.y - p.top.y;
    return {
      id: t.id,
      width: w,
      height: h,
      x: p.left.x,
      y: p.top.y,
    };
  }).filter(Boolean);

  // Edges
  const edges = [];
  const edgeMeta = [];
  const taskIds = new Set(tasks.map(t => t.id));
  tasks.forEach(task => {
    if (task.type === 'gateway' && task.conditions?.length) {
      task.conditions.forEach(cond => {
        if (cond.nextTaskId && taskIds.has(cond.nextTaskId)) {
          edges.push({ id: `${task.id}__${cond.id}`, sources: [task.id], targets: [cond.nextTaskId] });
          edgeMeta.push({ fromId: task.id, overrideKey: cond.id });
        }
      });
    } else if (task.type !== 'end' && task.type !== 'gateway') {
      const nextIds = task.nextTaskIds?.length ? task.nextTaskIds : (task.nextTaskId ? [task.nextTaskId] : []);
      nextIds.forEach(nextId => {
        if (nextId && taskIds.has(nextId)) {
          edges.push({ id: `${task.id}__${nextId}`, sources: [task.id], targets: [nextId] });
          edgeMeta.push({ fromId: task.id, overrideKey: nextId });
        }
      });
    }
  });

  const graph = {
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': 'RIGHT',
      'elk.edgeRouting': 'ORTHOGONAL',
      'elk.layered.layering.strategy': 'INTERACTIVE',
      'elk.layered.crossingMinimization.strategy': 'INTERACTIVE',
      'elk.layered.crossingMinimization.semiInteractive': 'true',
      'elk.layered.nodePlacement.strategy': 'INTERACTIVE',
      'elk.layered.cycleBreaking.strategy': 'INTERACTIVE',
    },
    children,
    edges,
  };

  const result = await elk.layout(graph);

  // 推每條 edge 的 exitSide / entrySide（從 ELK bend points 第一段/最後一段方向）
  const advice = new Map();
  (result.edges || []).forEach((edge, i) => {
    const meta = edgeMeta[i];
    if (!meta) return;
    const allPts = [];
    (edge.sections || []).forEach(s => {
      if (!s || !s.startPoint || !s.endPoint) return;
      allPts.push({ x: s.startPoint.x, y: s.startPoint.y });
      (s.bendPoints || []).forEach(p => allPts.push({ x: p.x, y: p.y }));
      allPts.push({ x: s.endPoint.x, y: s.endPoint.y });
    });
    if (allPts.length < 2) return;
    const first = allPts[0], second = allPts[1];
    const last = allPts[allPts.length - 1], prev = allPts[allPts.length - 2];

    const dx0 = second.x - first.x, dy0 = second.y - first.y;
    let exitSide;
    if (Math.abs(dx0) >= Math.abs(dy0)) exitSide = dx0 >= 0 ? 'right' : 'left';
    else exitSide = dy0 >= 0 ? 'bottom' : 'top';

    const dx1 = last.x - prev.x, dy1 = last.y - prev.y;
    let entrySide;
    if (Math.abs(dx1) >= Math.abs(dy1)) entrySide = dx1 >= 0 ? 'left' : 'right';
    else entrySide = dy1 >= 0 ? 'top' : 'bottom';

    advice.set(`${meta.fromId}::${meta.overrideKey}`, { exitSide, entrySide });
  });

  return advice;
}

function safeSync(flow) {
  try {
    return { ...syncComputeLayout(flow), _elkFellBack: true };
  } catch (e) {
    console.error('[ELK deep-A fallback] sync also failed:', e);
    return emptyLayout();
  }
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

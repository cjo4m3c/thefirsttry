/**
 * layout-elk.js — ELK-based 替代 layout 的 sync 介面 + cache.
 *
 * 給 /test-elk/ 測試版用。透過 cache + warmElk hook 把 ELK 的 async API
 * 包成跟舊 layout.js 同形（sync `computeLayout` + sync `routeArrow`）。
 *
 * 工作流：
 *   1. DiagramRenderer 偵測 ELK mode，每次 flow 變更時 call `warmElk(flow)`，
 *      它會 async 跑 ELK 並把結果寫進 cache，完成後 setState 觸發 re-render。
 *   2. computeLayout(flow) 同步從 cache 拿；沒拿到就回 fallback empty layout
 *      （DiagramRenderer 會顯示 loading 狀態，等下一輪 render）。
 *   3. routeArrow(...) 仍保持原 signature；ELK mode 下 caller 應優先用
 *      conn._bendPoints，這函式只是備援（拿不到 bend points 時回 ortho L 線）。
 */
import { runElkLayout } from './elkAdapter.js';
import { LAYOUT } from './constants.js';

const { LANE_HEADER_W, LANE_H: BASE_LANE_H, TITLE_H } = LAYOUT;

const cache = new WeakMap();   // flow → result
const inflight = new WeakMap(); // flow → Promise

/**
 * Async：跑 ELK 並把結果存進 cache。重覆 call 同一個 flow 不會重跑。
 * 回 Promise<result>（即使已 cache，也會 wrap 成 resolved promise）。
 */
export function warmElk(flow) {
  if (!flow) return Promise.resolve(null);
  if (cache.has(flow)) return Promise.resolve(cache.get(flow));
  if (inflight.has(flow)) return inflight.get(flow);
  const p = runElkLayout(flow).then(r => {
    cache.set(flow, r);
    inflight.delete(flow);
    return r;
  }).catch(e => {
    console.error('[ELK warm] failed:', e);
    inflight.delete(flow);
    return null;
  });
  inflight.set(flow, p);
  return p;
}

/**
 * Sync：從 cache 拿 layout 結果。沒拿到回 fallback empty layout
 * （前端會看到「Computing layout...」狀態直到 cache 填好）。
 */
export function computeLayout(flow) {
  if (!flow) return emptyLayout();
  const cached = cache.get(flow);
  if (cached) return cached;
  // Trigger warm if not started; result will arrive on next render
  warmElk(flow);
  return emptyLayout();
}

/**
 * 是否 ELK 已經 warm 完（caller 可用來決定是否顯示 loading）
 */
export function isElkReady(flow) {
  return !!flow && cache.has(flow);
}

/**
 * Sync routeArrow 替代——ELK mode 下 connection 已經帶 _bendPoints
 * （`elkAdapter.js` 寫進去）。caller 應該優先讀 conn._bendPoints。
 * 這個 fallback 只在 caller 不知道 conn 的情況用（drag preview 等）。
 */
export function routeArrow(fromPos, toPos, exitSide, entrySide, _laneBottomY, _laneTopCorridorY) {
  if (!fromPos || !toPos) return [];
  const sx = fromPos[exitSide]?.x ?? fromPos.cx;
  const sy = fromPos[exitSide]?.y ?? fromPos.cy;
  const tx = toPos[entrySide]?.x ?? toPos.cx;
  const ty = toPos[entrySide]?.y ?? toPos.cy;
  // Simple ortho L-shape：先走 x 後走 y（或反之，依 exitSide 軸）
  if (Math.abs(sx - tx) < 1 || Math.abs(sy - ty) < 1) return [[sx, sy], [tx, ty]];
  if (exitSide === 'top' || exitSide === 'bottom') {
    return [[sx, sy], [sx, ty], [tx, ty]];
  }
  return [[sx, sy], [tx, sy], [tx, ty]];
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

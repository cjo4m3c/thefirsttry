/**
 * layout-elk.js — ELK-based 替代 layout 的 sync 介面 + cache.
 *
 * 給 /test-elk/ 測試版用。透過 cache + warmElk hook 把 ELK 的 async API
 * 包成跟舊 layout.js 同形（sync `computeLayout` + sync `routeArrow`）。
 *
 * 容錯：任何 ELK 步驟失敗時自動 fall back 到舊 layout（sync 版本），
 * 並在結果加 `_elkFellBack: true` flag。這樣使用者至少能看到流程圖，
 * console 會印出失敗原因供 debug。
 */
import { runElkLayout } from './elkAdapter.js';
import { computeLayout as syncComputeLayout } from './layout/index.js';
import { LAYOUT } from './constants.js';

const { LANE_HEADER_W, LANE_H: BASE_LANE_H, TITLE_H } = LAYOUT;

const cache = new WeakMap();   // flow → result
const inflight = new WeakMap(); // flow → Promise

/**
 * Async：跑 ELK 並把結果存進 cache。重覆 call 同一個 flow 不會重跑。
 * 失敗時回退到 sync layout，仍會 cache 結果（避免無限 retry）。
 */
// Alias for unified interface across all routers
export function warmAsync(flow) { return warmElk(flow); }
export function isReady(flow) { return isElkReady(flow); }

export function warmElk(flow) {
  if (!flow) return Promise.resolve(null);
  if (cache.has(flow)) return Promise.resolve(cache.get(flow));
  if (inflight.has(flow)) return inflight.get(flow);

  const p = runElkLayout(flow).then(r => {
    // ELK 跑完但 positions 是空（emptyLayout fallback）也算失敗，改用 sync
    if (!r || !r.positions || Object.keys(r.positions).length === 0) {
      console.warn('[ELK] empty result, falling back to sync layout');
      const sync = safeSync(flow);
      cache.set(flow, sync);
      inflight.delete(flow);
      return sync;
    }
    cache.set(flow, r);
    inflight.delete(flow);
    return r;
  }).catch(e => {
    console.error('[ELK warm] failed, falling back to sync layout:', e);
    const sync = safeSync(flow);
    cache.set(flow, sync);
    inflight.delete(flow);
    return sync;
  });
  inflight.set(flow, p);
  return p;
}

function safeSync(flow) {
  try {
    const r = syncComputeLayout(flow);
    return { ...r, _elkFellBack: true };
  } catch (e) {
    console.error('[ELK fallback] sync layout also failed:', e);
    return emptyLayout();
  }
}

/**
 * Sync：從 cache 拿 layout 結果。沒拿到回 fallback empty layout
 * （前端會看到「Computing layout...」狀態直到 cache 填好）。
 */
export function computeLayout(flow) {
  if (!flow) return emptyLayout();
  const cached = cache.get(flow);
  if (cached) return cached;
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

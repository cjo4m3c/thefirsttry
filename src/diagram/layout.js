// Layout entry point. VITE_ROUTER 切換不同 router 實作：
//   sync      → ./layout/index.js（main，預設）
//   elk-v1    → ./layout-elk.js（甲：ELK 全包）
//   elk-deep-a → ./layout-elk-deep-a.js（乙：ELK 當決策諮詢）
//   elk-deep-b → ./layout-elk-deep-b.js（丙：ELK 座標 + snap）
//   astar     → ./layout-astar.js（戊：自家 A* router）
//
// 每個 router 都需要實作同樣的 interface：
//   computeLayout(flow): LayoutResult  (sync read from cache)
//   warmAsync(flow): Promise<void>    (async warm cache; sync mode 是 no-op)
//   isReady(flow): boolean            (sync mode 永遠 true)
//   routeArrow(...)                   (給 drag preview 等的 sync fallback)
import * as syncLayout from './layout/index.js';
import * as elkV1Layout from './layout-elk.js';
import * as elkDeepALayout from './layout-elk-deep-a.js';
import * as elkDeepBLayout from './layout-elk-deep-b.js';
import * as astarLayout from './layout-astar.js';

const MODE = import.meta.env?.VITE_ROUTER || 'sync';

function pickImpl() {
  switch (MODE) {
    case 'elk-v1':     return elkV1Layout;
    case 'elk-deep-a': return elkDeepALayout;
    case 'elk-deep-b': return elkDeepBLayout;
    case 'astar':      return astarLayout;
    case 'sync':
    default:           return null;  // null = sync mode（main）
  }
}

const impl = pickImpl();

export const computeLayout = impl?.computeLayout ?? syncLayout.computeLayout;
export const routeArrow = impl?.routeArrow ?? syncLayout.routeArrow;
export const warmElk = impl?.warmAsync ?? ((_flow) => Promise.resolve(null));
export const isElkReady = impl?.isReady ?? ((_flow) => true);
export const ROUTER_MODE = MODE;
export const IS_ASYNC = MODE !== 'sync';

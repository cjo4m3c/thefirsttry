// Layout dispatcher. VITE_ROUTER 切換不同 router 實作：
//   sync   → ./layout/index.js（main，預設，rule-based phase 1~3f）
//   astar  → ./layout-astar.js（戊：自家 A* router，POC 中，未來取代 main）
//
// 兩個 router 都實作同樣的 sync 介面：
//   computeLayout(flow): LayoutResult
//   routeArrow(...)（給 drag preview 等的 fallback）
//
// 早期的 ELK 系列試驗（甲 V1 / 乙 Deep-A / 丙 Deep-B）已被 A* 取代並砍除。
import * as syncLayout from './layout/index.js';
import * as astarLayout from './layout-astar.js';

const MODE = import.meta.env?.VITE_ROUTER || 'sync';
const impl = MODE === 'astar' ? astarLayout : syncLayout;

export const computeLayout = impl.computeLayout;
export const routeArrow = impl.routeArrow;
export const ROUTER_MODE = MODE;

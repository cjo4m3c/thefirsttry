// Layout entry point. Default 走 ./layout/index.js（既有自家邏輯）；
// 當 VITE_ROUTER=elk 時切換到 ./layout-elk.js（ELK.js orthogonal routing
// 試驗版，部署在 /test-elk/）。
//
// `warmElk` 只在 ELK mode 下有意義；default mode 直接回 resolved promise，
// caller (DiagramRenderer) 可無條件 call 不會出錯。
import * as syncLayout from './layout/index.js';
import * as elkLayout from './layout-elk.js';

const USE_ELK = import.meta.env?.VITE_ROUTER === 'elk';

export const computeLayout = USE_ELK ? elkLayout.computeLayout : syncLayout.computeLayout;
export const routeArrow = USE_ELK ? elkLayout.routeArrow : syncLayout.routeArrow;
export const warmElk = USE_ELK ? elkLayout.warmElk : (_flow) => Promise.resolve(null);
export const isElkReady = USE_ELK ? elkLayout.isElkReady : (_flow) => true;
export const ROUTER_MODE = USE_ELK ? 'elk' : 'sync';

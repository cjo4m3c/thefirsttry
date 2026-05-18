/**
 * Public API for the router module.
 *
 * Internals split into:
 *   - anchorPredict.js   (S1+S6 anchor by geometry pre-compute)
 *   - pickPath.js        (multi-port trial + candidate generation + A* 包裝)
 *   - pathPostProc.js    (alignPortSegments / cleanOrtho / fallback / side helpers)
 *   - routeAll.js        (orchestrator — owns grid, runs multi-pass, builds output)
 *
 * External callers should only import { routeAll } from '../router.js' (shim) 或
 * 直接從 './router/index.js'。
 */
export { routeAll } from './routeAll.js';

/**
 * layout-elk-deep-b.js — 丙 ELK 深度 B：ELK 全 layout + snap node 回 main grid。
 *
 * 世界觀：
 *   - ELK 主導：決定 node 位置 + edge bend points
 *   - 後處理：每個 task 的 cy 強制 snap 到 main 的 lane center
 *   - Edge bend points 跟著做 per-endpoint shift（src 用 src.delta、tgt 用 tgt.delta）
 *   - 維持 ortho：snap 後 path 可能有微 diagonal，cleanOrtho 修補
 *
 * 跟 V1 的差別：V1 視覺 free-form 跟著 ELK；丙 強制把 task 拉回 lane grid，
 * 視覺結構接近 main，但 edge path 形狀仍由 ELK 決定（含其多 port slot 分配）
 */

import { runElkLayout } from './elkAdapter.js';
import { computeLayout as syncComputeLayout } from './layout/index.js';
import { LAYOUT } from './constants.js';
import { halfExtent, NODE_VOFFSET } from './layout/helpers.js';

const { LANE_HEADER_W, LANE_H: BASE_LANE_H, TITLE_H } = LAYOUT;

const cache = new WeakMap();
const inflight = new WeakMap();

export function warmAsync(flow) {
  if (!flow) return Promise.resolve(null);
  if (cache.has(flow)) return Promise.resolve(cache.get(flow));
  if (inflight.has(flow)) return inflight.get(flow);

  const p = doLayout(flow).then(r => {
    cache.set(flow, r);
    inflight.delete(flow);
    return r;
  }).catch(e => {
    console.error('[ELK deep-B] failed, falling back to sync:', e);
    const sync = { ...syncComputeLayout(flow), _elkFellBack: true };
    cache.set(flow, sync);
    inflight.delete(flow);
    return sync;
  });
  inflight.set(flow, p);
  return p;
}

export function isReady(flow) { return !!flow && cache.has(flow); }

export function computeLayout(flow) {
  if (!flow) return emptyLayout();
  const cached = cache.get(flow);
  if (cached) return cached;
  warmAsync(flow);
  return emptyLayout();
}

export function routeArrow(fromPos, toPos, exitSide, entrySide) {
  // Drag preview fallback only
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

async function doLayout(flow) {
  // ── 1. ELK 全 layout（reuse V1 的 adapter） ──────────────
  const elkResult = await runElkLayout(flow);
  if (!elkResult || !elkResult.positions || Object.keys(elkResult.positions).length === 0) {
    throw new Error('ELK returned empty');
  }

  const { roles } = flow;

  // ── 2. 計算 main 風格的 lane y bands（cumulative，不重疊）──
  const laneHeights = roles.map(() => BASE_LANE_H);
  const laneTopY = [];
  let y = TITLE_H;
  roles.forEach((_, row) => {
    laneTopY.push(y);
    y += laneHeights[row];
  });

  // ── 3. 對每個 task 算 snap delta（target cy − ELK cy）──
  const snapDelta = {};  // taskId → { dx, dy }
  const newPositions = {};
  Object.entries(elkResult.positions).forEach(([id, p]) => {
    const row = p.row ?? 0;
    const targetCy = laneTopY[row] + NODE_VOFFSET;
    const dy = targetCy - p.cy;
    // X 不 snap（保留 ELK 的 col 安排，避免 multi-fork 同 col 撞在一起）
    const dx = 0;
    snapDelta[id] = { dx, dy };
    const cx = p.cx + dx;
    const cy = p.cy + dy;
    const hx = (p.right.x - p.left.x) / 2;
    const hy = (p.bottom.y - p.top.y) / 2;
    newPositions[id] = {
      col: p.col, row,
      cx, cy,
      right:  { x: cx + hx, y: cy },
      left:   { x: cx - hx, y: cy },
      bottom: { x: cx,      y: cy + hy },
      top:    { x: cx,      y: cy - hy },
    };
  });

  // ── 4. 平移每條 edge 的 bend points（linear interp 用 src/tgt delta）──
  const newConnections = elkResult.connections.map(conn => {
    if (!conn._bendPoints || conn._bendPoints.length < 2) return conn;
    const sDelta = snapDelta[conn.fromId] || { dx: 0, dy: 0 };
    const tDelta = snapDelta[conn.toId] || { dx: 0, dy: 0 };
    const n = conn._bendPoints.length;
    const shifted = conn._bendPoints.map((p, i) => {
      const t = n === 1 ? 0 : i / (n - 1);
      const dx = sDelta.dx * (1 - t) + tDelta.dx * t;
      const dy = sDelta.dy * (1 - t) + tDelta.dy * t;
      return [p[0] + dx, p[1] + dy];
    });
    // 強制端點對齊 port 中央
    const src = newPositions[conn.fromId];
    const tgt = newPositions[conn.toId];
    if (src && conn.exitSide && src[conn.exitSide]) {
      shifted[0] = [src[conn.exitSide].x, src[conn.exitSide].y];
    }
    if (tgt && conn.entrySide && tgt[conn.entrySide]) {
      shifted[shifted.length - 1] = [tgt[conn.entrySide].x, tgt[conn.entrySide].y];
    }
    return { ...conn, _bendPoints: cleanOrtho(shifted) };
  });

  // ── 5. SVG size ────────────────────────────────────────
  const maxX = Math.max(LANE_HEADER_W, ...Object.values(newPositions).map(p => p.right.x));
  const totalH = laneTopY[roles.length - 1] + laneHeights[roles.length - 1];
  const svgWidth = maxX + LAYOUT.PADDING_RIGHT;
  const svgHeight = totalH + LAYOUT.PADDING_BOTTOM;

  return {
    positions: newPositions,
    connections: newConnections,
    l4Numbers: elkResult.l4Numbers,
    svgWidth,
    svgHeight,
    laneTopY,
    laneHeights,
    _routerMode: 'elk-deep-b',
  };
}

/** Snap → axis-aligned, dedupe, collapse collinear */
function cleanOrtho(pts) {
  if (pts.length < 2) return pts.slice();
  const EPS = 2;
  const aligned = [{ x: pts[0][0], y: pts[0][1] }];
  for (let i = 1; i < pts.length; i++) {
    const a = aligned[aligned.length - 1];
    const b = { x: pts[i][0], y: pts[i][1] };
    const dx = Math.abs(b.x - a.x);
    const dy = Math.abs(b.y - a.y);
    if (dx <= EPS) aligned.push({ x: a.x, y: b.y });
    else if (dy <= EPS) aligned.push({ x: b.x, y: a.y });
    else {
      if (dx >= dy) aligned.push({ x: b.x, y: a.y });
      else aligned.push({ x: a.x, y: b.y });
      aligned.push(b);
    }
  }
  // dedupe
  const dedup = [aligned[0]];
  for (let i = 1; i < aligned.length; i++) {
    const p = dedup[dedup.length - 1];
    if (p.x !== aligned[i].x || p.y !== aligned[i].y) dedup.push(aligned[i]);
  }
  if (dedup.length < 3) return dedup.map(p => [p.x, p.y]);
  // collapse collinear
  const result = [dedup[0]];
  for (let i = 1; i < dedup.length - 1; i++) {
    const a = result[result.length - 1];
    const b = dedup[i];
    const c = dedup[i + 1];
    if ((a.x === b.x && b.x === c.x) || (a.y === b.y && b.y === c.y)) continue;
    result.push(b);
  }
  result.push(dedup[dedup.length - 1]);
  return result.map(p => [p.x, p.y]);
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

/**
 * routeAll.js — Orchestrator：用 A* 為所有 connections 計算 paths。
 *
 * Multi-pass：依固定順序處理每條 edge，前一條已畫過的 cell 被標 occupied
 * （A* 走那些 cell 會 +OCCUPY_PENALTY，鼓勵分流）
 *
 * Port 選擇規則由 pickBestPath multi-port trial 決定 (cost-based，不寫 if-then)。
 * 為了讓 A* 能從 task port 出/入，先把 port 對應的 cell unblock。
 */

import { RoutingGrid, HALO_RADIUS } from '../grid.js';
import { predictAnchors } from './anchorPredict.js';
import { pickBestPath, pickSides } from './pickPath.js';
import { fallbackOrthoPath } from './pathPostProc.js';

/**
 * @param {Array} rawConns - connections from buildRawConnections (fromId, toId, label, overrideKey, condId)
 * @param {object} positions - { [taskId]: { cx, cy, left, right, top, bottom } }
 * @param {number} svgWidth
 * @param {number} svgHeight
 * @returns {Array} routed connections, each with _bendPoints + exitSide + entrySide
 */
export function routeAll(rawConns, positions, svgWidth, svgHeight) {
  const grid = new RoutingGrid(positions, svgWidth, svgHeight);

  // S1 (v1.8) + S6 (v1.9) Anchor by geometry pre-compute：
  // 對每 task 預測 in/out anchor side（多數方位投票，嚴格 majority），讓
  // coherence 跟 multi-pass 順序解耦。後續 reservePort 用 first-wins
  // 不會覆寫已預設 anchor。
  predictAnchors(grid, rawConns, positions);

  // Sort connections to make multi-pass deterministic
  // Order: by source col asc → target col asc → S2 (v1.8) sourceId/targetId 字典序
  // (sort 結構性穩定化，同 layout 永遠跑出同 result)
  const sorted = rawConns.slice().sort((a, b) => {
    const sa = positions[a.fromId]?.col ?? 0;
    const sb = positions[b.fromId]?.col ?? 0;
    if (sa !== sb) return sa - sb;
    const ta = positions[a.toId]?.col ?? 0;
    const tb = positions[b.toId]?.col ?? 0;
    if (ta !== tb) return ta - tb;
    if (a.fromId !== b.fromId) return a.fromId < b.fromId ? -1 : 1;
    if (a.toId !== b.toId)     return a.toId < b.toId ? -1 : 1;
    return 0;
  });

  const results = [];
  for (const conn of sorted) {
    const src = positions[conn.fromId];
    const tgt = positions[conn.toId];
    if (!src || !tgt) {
      // Skip orphan connection — won't render but won't crash either
      results.push({ ...conn, exitSide: 'right', entrySide: 'left', _bendPoints: [] });
      continue;
    }
    // 用 multi-port trial 找最佳 port 組合，純 cost-based。
    const trial = pickBestPath(grid, src, tgt, conn._override, conn.fromId, conn.toId);

    let pathPx = trial?.path;
    let sides = trial?.sides;

    if (!pathPx || pathPx.length < 2) {
      // No path or A* errored — fall back to straight L
      sides = sides || pickSides(src, tgt, conn._override);
      const srcPort = src[sides.exit] || { x: src.cx, y: src.cy };
      const tgtPort = tgt[sides.entry] || { x: tgt.cx, y: tgt.cy };
      results.push({
        ...conn,
        exitSide: sides.exit,
        entrySide: sides.entry,
        _bendPoints: fallbackOrthoPath(srcPort, tgtPort, sides),
      });
      // 即使 fallback 也要 reserve port，避免後續 edge 誤用同 port 反向
      grid.reservePort(conn.fromId, sides.exit,  'out');
      grid.reservePort(conn.toId,   sides.entry, 'in');
      continue;
    }
    // Mark path cells as occupied for next pass，含 source/target/dir metadata
    // 讓後續同 source / 同 target 的 edge 可以共享 cell（不收 penalty）
    markPathOccupied(grid, pathPx, conn.fromId, conn.toId);
    // R2 (v1.5)：reserve port — 後續 edge 算 port conflict penalty 時看得到
    grid.reservePort(conn.fromId, sides.exit,  'out');
    grid.reservePort(conn.toId,   sides.entry, 'in');
    results.push({
      ...conn,
      exitSide: sides.exit,
      entrySide: sides.entry,
      _bendPoints: pathPx,
    });
  }

  return results;
}

/** 把 path 上每段的「每個 cell」都標 occupied，含方向 metadata。
 * 注意：cleanOrtho 已合併共線中間點，所以 pathPx 通常只是 bend points。
 * 這裡要 interpolate 把每段之間的每個 cell 都展開標記，否則 multi-pass
 * 看不到「水平/垂直段內部的 occupied cells」→ 後續同 target 路徑無法 spread。
 *
 * v1.15：除了標主路徑 cells，也在 perpendicular 方向 ±HALO_RADIUS 標 halo cells，
 * 給 getOccupyPenalty 算遞減 penalty（視覺距離 unified §10.5.1）。
 */
function markPathOccupied(grid, pathPx, sourceId, targetId) {
  const cs = grid.cellSize;
  for (let i = 0; i < pathPx.length - 1; i++) {
    const [x1, y1] = pathPx[i];
    const [x2, y2] = pathPx[i + 1];
    const dir = inferDir(x1, y1, x2, y2);
    const isHorizontal = dir === 'east' || dir === 'west';
    // Walk every cell from (x1,y1) to (x2,y2). Assumes axis-aligned (cleanOrtho 已 enforce)
    const dx = Math.sign(x2 - x1);
    const dy = Math.sign(y2 - y1);
    const steps = Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1)) / cs;
    for (let s = 0; s <= steps; s++) {
      const px = x1 + dx * s * cs;
      const py = y1 + dy * s * cs;
      const c = grid.toCell(px, py);
      grid.markOccupied(c.x, c.y, { sourceId, targetId, dir });

      // v1.15: 在 perpendicular 方向 ±HALO_RADIUS cells 標 halo
      // - horizontal path → halo 在 north/south (cy ± h)
      // - vertical path   → halo 在 east/west  (cx ± h)
      for (let h = 1; h <= HALO_RADIUS; h++) {
        for (const sign of [-1, 1]) {
          const hx = isHorizontal ? c.x : c.x + sign * h;
          const hy = isHorizontal ? c.y + sign * h : c.y;
          grid.markHalo(hx, hy, { sourceId, targetId, dir, haloDist: h });
        }
      }
    }
  }
}

function inferDir(x1, y1, x2, y2) {
  if (Math.abs(x2 - x1) >= Math.abs(y2 - y1)) {
    return x2 >= x1 ? 'east' : 'west';
  }
  return y2 >= y1 ? 'south' : 'north';
}

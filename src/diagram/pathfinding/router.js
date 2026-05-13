/**
 * router.js — Orchestrator：用 A* 為所有 connections 計算 paths。
 *
 * Multi-pass：依固定順序處理每條 edge，前一條已畫過的 cell 被標 occupied
 * （A* 走那些 cell 會 +OCCUPY_PENALTY，鼓勵分流）
 *
 * Port 選擇規則（4 port，不分槽，永遠 port 中央）：
 *   - target 在 source 右下/右上：exitSide=right, entrySide=left
 *   - target 在 source 左下/左上：exitSide=left, entrySide=right
 *   - 同 col 跨 lane：exitSide=bottom 或 top, entrySide=反向
 *   - 同 lane 跨 col：上述 right/left
 *
 * 為了讓 A* 能從 task port 出/入，先把 port 對應的 cell unblock。
 */

import { RoutingGrid } from './grid.js';
import { findPath } from './astar.js';

/**
 * @param {Array} rawConns - connections from buildRawConnections (fromId, toId, label, overrideKey, condId)
 * @param {object} positions - { [taskId]: { cx, cy, left, right, top, bottom } }
 * @param {number} svgWidth
 * @param {number} svgHeight
 * @returns {Array} routed connections, each with _bendPoints + exitSide + entrySide
 */
export function routeAll(rawConns, positions, svgWidth, svgHeight) {
  const grid = new RoutingGrid(positions, svgWidth, svgHeight);

  // Sort connections to make multi-pass deterministic
  // Order: by source col asc, then target col asc
  const sorted = rawConns.slice().sort((a, b) => {
    const sa = positions[a.fromId]?.col ?? 0;
    const sb = positions[b.fromId]?.col ?? 0;
    if (sa !== sb) return sa - sb;
    const ta = positions[a.toId]?.col ?? 0;
    const tb = positions[b.toId]?.col ?? 0;
    return ta - tb;
  });

  const results = [];
  for (const conn of sorted) {
    const src = positions[conn.fromId];
    const tgt = positions[conn.toId];
    if (!src || !tgt) continue;
    const sides = pickSides(src, tgt);
    const pathPx = computePath(grid, src, tgt, sides);
    if (!pathPx) {
      // No path found — fall back to straight L (very rare)
      results.push({
        ...conn,
        exitSide: sides.exit,
        entrySide: sides.entry,
        _bendPoints: fallbackOrthoPath(src[sides.exit], tgt[sides.entry], sides),
      });
      continue;
    }
    // Mark path cells as occupied for next pass
    for (const p of pathPx) {
      const c = grid.toCell(p[0], p[1]);
      grid.markOccupied(c.x, c.y);
    }
    results.push({
      ...conn,
      exitSide: sides.exit,
      entrySide: sides.entry,
      _bendPoints: pathPx,
    });
  }

  return results;
}

function pickSides(src, tgt) {
  // Forward edge defaults: source.right → target.left
  // If target is significantly above source: source.top → target.bottom
  // If target is significantly below source: source.bottom → target.top
  // Note: "above/below" 同 col 才用 vertical entry，否則一律走 right/left
  const dx = tgt.cx - src.cx;
  const dy = tgt.cy - src.cy;
  if (Math.abs(dx) > 30) {
    // 有明顯水平距離 → 水平 port
    if (dx > 0) return { exit: 'right', entry: 'left' };
    return { exit: 'left', entry: 'right' };
  }
  // 幾乎同 col → 垂直 port
  if (dy > 0) return { exit: 'bottom', entry: 'top' };
  return { exit: 'top', entry: 'bottom' };
}

function computePath(grid, src, tgt, sides) {
  // 起點：source port 的 cell（在 task 邊緣外一格，避免被 blocked 擋住）
  const srcPortPx = src[sides.exit];
  const tgtPortPx = tgt[sides.entry];

  // Start cell：source port 外一步（沿 exit 方向走出 task）
  // Goal cell：target port 外一步（沿 entry 反方向走出 task）
  //   entry=left → 線從西邊進入 → goal cell 在 task 的 WEST = dirDelta('left')
  //   entry=top → 線從北邊進入 → goal cell 在 task 的 NORTH = dirDelta('top')
  const sd = dirDelta(sides.exit);
  const startCell = grid.toCell(srcPortPx.x + sd.dx * grid.cellSize, srcPortPx.y + sd.dy * grid.cellSize);
  grid.unblock(startCell.x, startCell.y);

  const td = dirDelta(sides.entry);  // entry side 對應到 task 外側的方向
  const goalCell = grid.toCell(tgtPortPx.x + td.dx * grid.cellSize, tgtPortPx.y + td.dy * grid.cellSize);
  grid.unblock(goalCell.x, goalCell.y);

  const startDir = sideToDir(sides.exit);
  const cells = findPath(grid, startCell, goalCell, startDir);
  if (!cells) return null;

  // Convert cells back to pixel coords, prepend source port, append target port
  const pxPath = [[srcPortPx.x, srcPortPx.y]];
  for (const c of cells) {
    const p = grid.toPx(c);
    pxPath.push([p.x, p.y]);
  }
  pxPath.push([tgtPortPx.x, tgtPortPx.y]);

  // Snap path to clean ortho: remove collinear / redundant points
  return cleanOrtho(pxPath);
}

function dirDelta(side) {
  if (side === 'right')  return { dx:  1, dy:  0 };
  if (side === 'left')   return { dx: -1, dy:  0 };
  if (side === 'bottom') return { dx:  0, dy:  1 };
  return { dx:  0, dy: -1 };
}
function reverseSide(side) {
  return { left: 'right', right: 'left', top: 'bottom', bottom: 'top' }[side];
}
function sideToDir(side) {
  return { right: 'east', left: 'west', bottom: 'south', top: 'north' }[side];
}

function fallbackOrthoPath(srcPort, tgtPort, sides) {
  // 找不到 path 時的退路：簡單 L-shape
  if (sides.exit === 'right' || sides.exit === 'left') {
    return [[srcPort.x, srcPort.y], [tgtPort.x, srcPort.y], [tgtPort.x, tgtPort.y]];
  }
  return [[srcPort.x, srcPort.y], [srcPort.x, tgtPort.y], [tgtPort.x, tgtPort.y]];
}

/** 把 path 強制 axis-aligned + 移除 collinear 中間點 */
function cleanOrtho(pts) {
  if (pts.length < 2) return pts.slice();

  // Pass 1: snap diagonals — 每相鄰兩點若 dx 跟 dy 都 > 0，插入 corner
  const aligned = [{ x: pts[0][0], y: pts[0][1] }];
  for (let i = 1; i < pts.length; i++) {
    const a = aligned[aligned.length - 1];
    const b = { x: pts[i][0], y: pts[i][1] };
    const dx = Math.abs(b.x - a.x);
    const dy = Math.abs(b.y - a.y);
    if (dx < 1 || dy < 1) {
      aligned.push(b);
    } else {
      // 真 diagonal → 插轉折（沿較大軸先走）
      if (dx >= dy) aligned.push({ x: b.x, y: a.y });
      else          aligned.push({ x: a.x, y: b.y });
      aligned.push(b);
    }
  }

  // Pass 2: dedupe identical consecutive points
  const dedup = [aligned[0]];
  for (let i = 1; i < aligned.length; i++) {
    const p = dedup[dedup.length - 1];
    if (p.x !== aligned[i].x || p.y !== aligned[i].y) dedup.push(aligned[i]);
  }

  // Pass 3: collapse collinear runs
  if (dedup.length < 3) return dedup.map(p => [p.x, p.y]);
  const result = [dedup[0]];
  for (let i = 1; i < dedup.length - 1; i++) {
    const a = result[result.length - 1];
    const b = dedup[i];
    const c = dedup[i + 1];
    if ((a.x === b.x && b.x === c.x) || (a.y === b.y && b.y === c.y)) continue;  // collinear, drop b
    result.push(b);
  }
  result.push(dedup[dedup.length - 1]);

  return result.map(p => [p.x, p.y]);
}

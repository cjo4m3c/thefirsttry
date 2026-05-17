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
    if (!src || !tgt) {
      // Skip orphan connection — won't render but won't crash either
      results.push({ ...conn, exitSide: 'right', entrySide: 'left', _bendPoints: [] });
      continue;
    }
    // 用 multi-port trial 找最佳 port 組合：
    //   - 有 user override 時尊重 override
    //   - 沒有 override 時，跑多個候選 port 組合，挑 A* 總 cost 最低的
    // 純 cost-based，不寫「同 lane 有障礙才用 bottom→bottom」這類規則。
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
 */
function markPathOccupied(grid, pathPx, sourceId, targetId) {
  const cs = grid.cellSize;
  for (let i = 0; i < pathPx.length - 1; i++) {
    const [x1, y1] = pathPx[i];
    const [x2, y2] = pathPx[i + 1];
    const dir = inferDir(x1, y1, x2, y2);
    // Walk every cell from (x1,y1) to (x2,y2). Assumes axis-aligned (cleanOrtho 已 enforce)
    const dx = Math.sign(x2 - x1);
    const dy = Math.sign(y2 - y1);
    const steps = Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1)) / cs;
    for (let s = 0; s <= steps; s++) {
      const px = x1 + dx * s * cs;
      const py = y1 + dy * s * cs;
      const c = grid.toCell(px, py);
      grid.markOccupied(c.x, c.y, { sourceId, targetId, dir });
    }
  }
}

function inferDir(x1, y1, x2, y2) {
  if (Math.abs(x2 - x1) >= Math.abs(y2 - y1)) {
    return x2 >= x1 ? 'east' : 'west';
  }
  return y2 >= y1 ? 'south' : 'north';
}

/**
 * Multi-port trial：對每條 edge 嘗試多個 port 組合，A* 跑出各自 cost，挑最低。
 *
 * 純 cost-based 決定 port：不寫 if-then 規則（例如「同 lane 有障礙才用 bottom→bottom」）。
 * 用 A* 實際算出來的成本判斷哪個 port 組合最好。
 *
 * 例：start1 → 1-0-1-2 中間有 1-0-1-1 擋路時
 *   - right→left 要繞 1-0-1-1 → 高 cost
 *   - bottom→bottom 直接走 lane 下方 corridor → 低 cost
 *   A* 自動選 bottom→bottom（不需要規則判斷）。
 *
 * 例：同 lane 直線無障礙
 *   - right→left 直線 → 最低 cost
 *   - bottom→bottom 多 2 段 vertical stub → 高 cost
 *   A* 選 right→left（不需要規則）。
 *
 * @returns {{ path, sides, cost } | null}
 */
function pickBestPath(grid, src, tgt, override, sourceId, targetId) {
  // 有 user override 時尊重，不試其他組合
  if (override?.exitSide && override?.entrySide) {
    const sides = { exit: override.exitSide, entry: override.entrySide };
    const result = computePath(grid, src, tgt, sides, sourceId, targetId);
    return result ? { path: result.path, sides, cost: result.cost } : null;
  }

  // 候選 port 組合（依 dx/dy 選合理子集，避免跑 16 種）
  const candidates = generateCandidates(src, tgt, override);

  let best = null;
  for (const sides of candidates) {
    const result = computePath(grid, src, tgt, sides, sourceId, targetId);
    if (!result) continue;
    // R2 (v1.5) 維度 5：port reservation conflict cost
    // 若 src.exit 或 tgt.entry 已被反向用 (規則 1 違規)，加 PORT_VIOLATION_PENALTY
    const portPenalty =
        grid.getPortConflictPenalty(sourceId, sides.exit,  'out')
      + grid.getPortConflictPenalty(targetId, sides.entry, 'in');
    // R3 (v1.6) 維度 6：coherence mismatch penalty
    // 同 task 同方向已有 anchor side 時，選不一致 side 加 COHERENCE_PENALTY
    const cohPenalty =
        grid.getCoherenceMismatchPenalty(sourceId, sides.exit,  'out')
      + grid.getCoherenceMismatchPenalty(targetId, sides.entry, 'in');
    const adjustedCost = result.cost + portPenalty + cohPenalty;
    if (!best || adjustedCost < best.cost) {
      best = { path: result.path, sides, cost: adjustedCost };
    }
  }
  return best;
}

function generateCandidates(src, tgt, override) {
  const dx = tgt.cx - src.cx;
  const dy = tgt.cy - src.cy;
  const T = 30;
  const candidates = [];

  // 主候選：依 dx/dy 推「最自然」的 port
  candidates.push(autoPickSides(src, tgt));

  const sameRow = Math.abs(dy) < T;
  const sameCol = Math.abs(dx) < T;

  if (sameRow && !sameCol) {
    // 同 row 跨 col：加 corridor 繞行候選（解中間有 task 阻擋時走 corridor）
    candidates.push({ exit: 'top',    entry: 'top'    });
    candidates.push({ exit: 'bottom', entry: 'bottom' });
  } else if (sameCol && !sameRow) {
    // 同 col 跨 row：加左右 corridor 繞行候選
    candidates.push({ exit: 'left',  entry: 'left'  });
    candidates.push({ exit: 'right', entry: 'right' });
  } else if (!sameRow && !sameCol) {
    // 對角象限：dy 順向 vertical pair (S-shape) + U-shape vertical 同軸
    // 不加斜軸 pair (R→T, T→L 等 8 種) — 1-bend 會屠殺同軸 2-bend 但
    // 破壞「對稱進入」期待 + 同 target slot 排序。等 coherence cost 維度落地再開。
    if (dy > 0) candidates.push({ exit: 'bottom', entry: 'top' });
    else        candidates.push({ exit: 'top',    entry: 'bottom' });
    candidates.push({ exit: 'top',    entry: 'top'    });
    candidates.push({ exit: 'bottom', entry: 'bottom' });
  }

  // Partial override：使用者只拖了 exit 或只拖了 entry。
  // 不再生多個候選讓 A* 試（會選到怪的同 side 或反 side combo），
  // 而是用「幾何自然 pair」單一候選：
  //   - 垂直 exit (top/bottom)：水平 entry，依 target 方位決定 left/right
  //   - 水平 exit (left/right)：對向水平 entry
  //   - 對 entrySide-only override 同理（互換）
  // 純幾何，不寫業務 if-then 規則。
  if (override?.exitSide && !override?.entrySide) {
    const isVertical = override.exitSide === 'top' || override.exitSide === 'bottom';
    if (isVertical) {
      const entry = (tgt.cx - src.cx) >= 0 ? 'left' : 'right';
      return [{ exit: override.exitSide, entry }];
    }
    const entry = override.exitSide === 'right' ? 'left' : 'right';
    return [{ exit: override.exitSide, entry }];
  }
  if (override?.entrySide && !override?.exitSide) {
    const isVertical = override.entrySide === 'top' || override.entrySide === 'bottom';
    if (isVertical) {
      const exit = (tgt.cx - src.cx) >= 0 ? 'right' : 'left';
      return [{ exit, entry: override.entrySide }];
    }
    const exit = override.entrySide === 'right' ? 'left' : 'right';
    return [{ exit, entry: override.entrySide }];
  }

  // 去重
  const seen = new Set();
  return candidates.filter(c => {
    const key = `${c.exit}|${c.entry}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function pickSides(src, tgt, override) {
  // user override 優先（drag endpoint 拖過）
  if (override?.exitSide && override?.entrySide) {
    return { exit: override.exitSide, entry: override.entrySide };
  }
  if (override?.exitSide) {
    // 只有 exit 被拖：entry 用自動推斷
    const auto = autoPickSides(src, tgt);
    return { exit: override.exitSide, entry: auto.entry };
  }
  if (override?.entrySide) {
    const auto = autoPickSides(src, tgt);
    return { exit: auto.exit, entry: override.entrySide };
  }
  return autoPickSides(src, tgt);
}

function autoPickSides(src, tgt) {
  // Forward edge defaults: source.right → target.left
  // 同 col 跨 lane：vertical port
  const dx = tgt.cx - src.cx;
  const dy = tgt.cy - src.cy;
  if (Math.abs(dx) > 30) {
    if (dx > 0) return { exit: 'right', entry: 'left' };
    return { exit: 'left', entry: 'right' };
  }
  if (dy > 0) return { exit: 'bottom', entry: 'top' };
  return { exit: 'top', entry: 'bottom' };
}

/**
 * @returns {{ path: number[][], cost: number } | null}
 * cost = A* 找到路徑時最後一個 cell 的 g 值（總成本，用來比較多個 port 候選）
 */
function computePath(grid, src, tgt, sides, sourceId, targetId) {
  // 起點：source port 的 cell（在 task 邊緣外一格，避免被 blocked 擋住）
  const srcPortPx = src[sides.exit];
  const tgtPortPx = tgt[sides.entry];
  if (!srcPortPx || !tgtPortPx) return null;

  // Start cell：source port 外一步（沿 exit 方向走出 task）
  // Goal cell：target port 外一步（沿 entry 反方向走出 task）
  const sd = dirDelta(sides.exit);
  const startCell = grid.toCell(srcPortPx.x + sd.dx * grid.cellSize, srcPortPx.y + sd.dy * grid.cellSize);
  grid.unblock(startCell.x, startCell.y);

  const td = dirDelta(sides.entry);
  const goalCell = grid.toCell(tgtPortPx.x + td.dx * grid.cellSize, tgtPortPx.y + td.dy * grid.cellSize);
  grid.unblock(goalCell.x, goalCell.y);

  const startDir = sideToDir(sides.exit);
  const cells = findPath(grid, startCell, goalCell, startDir, sourceId, targetId, {
    srcCx: src.cx, srcCy: src.cy, tgtCx: tgt.cx, tgtCy: tgt.cy,
  });
  if (!cells) return null;

  // A* 回傳 cells 含 g 值，取最後一個 cell 的 g 當總 cost
  const cost = cells.length > 0 ? (cells[cells.length - 1].g ?? cells.length) : Infinity;

  // Convert cells back to pixel coords, prepend source port, append target port
  const pxPath = [[srcPortPx.x, srcPortPx.y]];
  for (const c of cells) {
    const p = grid.toPx(c);
    pxPath.push([p.x, p.y]);
  }
  pxPath.push([tgtPortPx.x, tgtPortPx.y]);

  // 強制第一段沿 exitSide 方向、最後一段沿 entry 反向（避免端點段
  // 變成垂直/水平錯軸 → 視覺上「從上下方進入元件而不是側邊」）
  alignPortSegments(pxPath, sides);

  // Snap path to clean ortho: remove collinear / redundant points
  const path = cleanOrtho(pxPath);
  return { path, cost };
}

/**
 * 第一段強制跟 exitSide 同軸；最後一段強制跟 entrySide 反向同軸。
 *   exitSide=right/left → 第一段水平
 *   exitSide=top/bottom → 第一段垂直
 *   entrySide=left/right → 最後一段水平
 *   entrySide=top/bottom → 最後一段垂直
 * 做法：在 port 跟第一/最後 A* 點之間插入「對齊軸線的中介點」
 */
function alignPortSegments(pts, sides) {
  if (pts.length < 2) return;
  const srcHorizontal = sides.exit === 'right' || sides.exit === 'left';
  const tgtHorizontal = sides.entry === 'left' || sides.entry === 'right';

  // Source side：pts[0] = port, pts[1] = first A* cell
  const [sx, sy] = pts[0];
  const [s1x, s1y] = pts[1];
  if (srcHorizontal && Math.abs(s1y - sy) > 0.5) {
    // 第一段應該水平但 y 不一致 → 插入 (s1x, sy) 讓第一段純水平
    pts.splice(1, 0, [s1x, sy]);
  } else if (!srcHorizontal && Math.abs(s1x - sx) > 0.5) {
    pts.splice(1, 0, [sx, s1y]);
  }

  // Target side：pts[N-1] = port, pts[N-2] = last A* cell
  const n = pts.length;
  const [tx, ty] = pts[n - 1];
  const [t1x, t1y] = pts[n - 2];
  if (tgtHorizontal && Math.abs(t1y - ty) > 0.5) {
    pts.splice(n - 1, 0, [t1x, ty]);
  } else if (!tgtHorizontal && Math.abs(t1x - tx) > 0.5) {
    pts.splice(n - 1, 0, [tx, t1y]);
  }
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

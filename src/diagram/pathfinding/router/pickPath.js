/**
 * pickPath.js — Multi-port trial + candidate generation + A* 包裝。
 *
 * - pickBestPath: 對每條 edge 嘗試多個 port 組合 (含 cost 維度 5/6 調整)，挑最低
 * - generateCandidates: 依 9 象限 + 對角斜軸 (v1.7) 生候選 pair
 * - pickSides / autoPickSides: fallback 用的單一 port 選擇
 * - computePath: 跑 A* 並做端點對齊 + cleanOrtho
 */

import { findPath } from '../astar.js';
import { alignPortSegments, cleanOrtho, dirDelta, sideToDir } from './pathPostProc.js';

/**
 * Multi-port trial：對每條 edge 嘗試多個 port 組合，A* 跑出各自 cost，挑最低。
 *
 * 純 cost-based 決定 port：不寫 if-then 規則（例如「同 lane 有障礙才用 bottom→bottom」）。
 * 用 A* 實際算出來的成本判斷哪個 port 組合最好。
 *
 * @returns {{ path, sides, cost } | null}
 */
/** 判斷 (exit, entry) 是否為斜軸 pair (一個垂直 + 一個水平)，給 S19 用 */
function isAxisDiagonal(exit, entry) {
  const exitVertical  = exit === 'top'  || exit === 'bottom';
  const entryVertical = entry === 'top' || entry === 'bottom';
  return exitVertical !== entryVertical;
}

export function pickBestPath(grid, src, tgt, override, sourceId, targetId) {
  // 有 user override 時尊重，不試其他組合
  if (override?.exitSide && override?.entrySide) {
    const sides = {
      exit: override.exitSide,
      entry: override.entrySide,
      // S19: 拖出的 sides 若是斜軸 pair 也享受 Center Bias 關閉
      isAxisDiagonal: isAxisDiagonal(override.exitSide, override.entrySide),
    };
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

export function generateCandidates(src, tgt, override) {
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
    if (dy > 0) candidates.push({ exit: 'bottom', entry: 'top' });
    else        candidates.push({ exit: 'top',    entry: 'bottom' });
    candidates.push({ exit: 'top',    entry: 'top'    });
    candidates.push({ exit: 'bottom', entry: 'bottom' });
    // R4 (v1.7) 自然順向斜軸 pair (依 dx/dy 號決定方位的 2 種 1-bend pair)。
    // S19 (v1.10) 標 isAxisDiagonal: true → computePath 跑 A* 時關 Center Bias
    // (維度 4 設計給 2-bend U/S 拉中點，對斜軸 1-bend 反向破壞)。
    // R2 port reservation + R3 coherence 仍受控：
    //   - 反向 port 使用會被 PORT_VIOLATION(500) 屠殺
    //   - 同 target 多 incoming 由 coherence anchor 自然收斂同 side
    if (dx > 0 && dy > 0) {       // 右下
      candidates.push({ exit: 'right',  entry: 'top',    isAxisDiagonal: true });
      candidates.push({ exit: 'bottom', entry: 'left',   isAxisDiagonal: true });
    } else if (dx > 0 && dy < 0) { // 右上
      candidates.push({ exit: 'right',  entry: 'bottom', isAxisDiagonal: true });
      candidates.push({ exit: 'top',    entry: 'left',   isAxisDiagonal: true });
    } else if (dx < 0 && dy > 0) { // 左下
      candidates.push({ exit: 'left',   entry: 'top',    isAxisDiagonal: true });
      candidates.push({ exit: 'bottom', entry: 'right',  isAxisDiagonal: true });
    } else {                        // 左上
      candidates.push({ exit: 'left',   entry: 'bottom', isAxisDiagonal: true });
      candidates.push({ exit: 'top',    entry: 'right',  isAxisDiagonal: true });
    }
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
      // S19: 垂直 exit + 水平 entry = 斜軸 pair
      return [{ exit: override.exitSide, entry, isAxisDiagonal: true }];
    }
    const entry = override.exitSide === 'right' ? 'left' : 'right';
    return [{ exit: override.exitSide, entry }];  // 水平+水平 同軸
  }
  if (override?.entrySide && !override?.exitSide) {
    const isVertical = override.entrySide === 'top' || override.entrySide === 'bottom';
    if (isVertical) {
      const exit = (tgt.cx - src.cx) >= 0 ? 'right' : 'left';
      return [{ exit, entry: override.entrySide, isAxisDiagonal: true }];
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

export function pickSides(src, tgt, override) {
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
  // S19 (v1.10)：斜軸 candidate 關 Center Bias，讓 1-bend corner bend 不被誤罰
  const cells = findPath(grid, startCell, goalCell, startDir, sourceId, targetId, {
    srcCx: src.cx, srcCy: src.cy, tgtCx: tgt.cx, tgtCy: tgt.cy,
    centerBiasEnabled: !sides.isAxisDiagonal,
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

/**
 * A* routing orchestrator — Phase 3g 用。
 *
 * 對 routeArrow 仍會穿任務矩形的 connection 跑 A*。為了找最佳視覺路徑，
 * 不只照 Phase 3f 選的 (exit, entry)，會試多組 candidate combos 跑 A*、
 * 比較 cost、選最低的取代。
 *
 * 演算規則：
 *   D6 override 硬約束：使用者拖曳寫過 task.connectionOverrides[key] 的
 *      連線 only 試使用者選的 combo（A* 不換 port）
 *   非 override：試 (a) Phase 3f 選的 combo (b) 自然 default 依 dr/dc 推
 *      (c) 一些常見替代。pick lowest A* cost path that passes path-clean check
 *   D11 soft obstacle：邊跑完 cells 加入 occupiedCells，後跑的邊看到 +20 cost
 *
 * Cost tuning（2026-05-06 第二次調整）：
 *   - bendPenalty 10→30：強烈避免多餘轉彎（user 反映線段太多 bend）
 *   - airGapPenalty 5→0：col gap (1 sub-cell wide) 不該被懲罰、否則
 *      A* 找不到「在 col gap 下行」這個最優解
 *
 * 輸出：Map<connKey, { polyline, exitSide, entrySide }>。
 *      `exitSide` / `entrySide` 是 A* 最終選的 port（可能跟 connection
 *      原本的不同），DiagramRenderer 套用時要更新到 conn 上。
 */

import { findPath } from './pathFinder.js';
import {
  buildObstacleGrid, pixelToSubCell, pathToPolyline, polylineToOccupiedCells,
  SUB_CELL_W, SUB_CELL_H,
} from './obstacleMap.js';
import { routeArrow } from './routeArrow.js';
import { pathCrossesAnyTaskRect } from './pathCrossesTask.js';

const SIDE_TO_DIR = { right: 0, left: 1, bottom: 2, top: 3 };
const FINAL_DIR_FOR_ENTRY = { left: 0, right: 1, top: 2, bottom: 3 };

const A_STAR_OPTS = {
  bendPenalty: 30,
  maxIterations: 8000,
};
const GRID_OPTS = {
  airGapPenalty: 0,    // col gap 是必走通道，不該懲罰
  edgeCrossingPenalty: 20,
};

/**
 * 給定方向 (dr, dc)，回傳建議的 (exit, entry) candidate 列表。
 * 先試「自然」combo，再試 Phase 3f 可能挑的替代、最後窮盡。
 */
function candidateCombos(dr, dc, currentExit, currentEntry) {
  const combos = [];
  const seen = new Set();
  const add = (e, en, preference) => {
    const k = `${e}::${en}`;
    if (seen.has(k)) return;
    seen.add(k);
    combos.push({ exit: e, entry: en, preference });
  };

  // 1) 「自然」default 依 dr/dc — preference 0（最優）
  if (dr === 0 && dc === 1) add('right', 'left', 0);
  else if (dr === 0 && dc > 1) { add('right', 'left', 0); add('top', 'top', 0); }
  else if (dr === 0 && dc < 0) add('top', 'top', 0);
  else if (dr > 0 && dc > 0) add('right', 'left', 0);
  else if (dr > 0 && dc === 0) add('bottom', 'top', 0);
  else if (dr < 0 && dc > 0) add('right', 'left', 0);
  else if (dr < 0 && dc === 0) add('top', 'bottom', 0);

  // 2) Phase 3f / Phase 3e 選的 combo — preference 1（備援）
  add(currentExit, currentEntry, 1);

  // 3) 常見替代 — preference 2（最後手段）
  const commonAlts = [
    ['right', 'left'], ['right', 'top'], ['right', 'bottom'],
    ['bottom', 'left'], ['bottom', 'top'], ['top', 'left'], ['top', 'top'],
  ];
  commonAlts.forEach(([e, en]) => add(e, en, 2));

  return combos;
}

// 自然 combo cost 不打折；Phase 3f combo +100；其他 +200。
// 這讓「右→左」(forward 自然) 在 cost 比「右→上」高 < 100 時仍勝出。
const PREFERENCE_PENALTY = 100;

export function runAStarPhase(connections, positions, svgWidth, svgHeight, tasksWithOverrides) {
  const overrides = new Map();
  const occupiedCells = new Set();

  // 建一個 task → 是否有 override map（給「is locked」判斷）
  const overrideOf = new Map();   // `${fromId}::${overrideKey}` → true
  if (tasksWithOverrides) {
    for (const t of tasksWithOverrides) {
      const ov = t.connectionOverrides;
      if (!ov) continue;
      for (const k in ov) overrideOf.set(`${t.id}::${k}`, true);
    }
  }

  connections.forEach((conn, i) => {
    const fromPos = positions[conn.fromId];
    const toPos = positions[conn.toId];
    if (!fromPos || !toPos) return;

    // 先用 routeArrow 試現行 (exit, entry) — 若已乾淨、不需 A*
    const defaultPolyline = routeArrow(
      fromPos, toPos, conn.exitSide, conn.entrySide,
      conn.laneBottomY, conn.laneTopCorridorY
    );
    const defaultBlocking = pathCrossesAnyTaskRect(defaultPolyline, positions, conn.fromId, conn.toId);

    if (!defaultBlocking) {
      const cells = polylineToOccupiedCells(defaultPolyline);
      cells.forEach(c => occupiedCells.add(c));
      return;
    }

    // 需 A*。決定 candidate (exit, entry) 列表
    const dr = toPos.row - fromPos.row;
    const dc = toPos.col - fromPos.col;

    const overrideKey = `${conn.fromId}::${conn.overrideKey ?? conn.toId}`;
    const isUserOverride = overrideOf.has(overrideKey);

    const combos = isUserOverride
      ? [{ exit: conn.exitSide, entry: conn.entrySide }]
      : candidateCombos(dr, dc, conn.exitSide, conn.entrySide);

    let bestResult = null;
    let bestCost = Infinity;

    for (const combo of combos) {
      const exitDir = SIDE_TO_DIR[combo.exit];
      const finalDir = FINAL_DIR_FOR_ENTRY[combo.entry];
      if (exitDir === undefined || finalDir === undefined) continue;

      const sxPx = fromPos[combo.exit].x;
      const syPx = fromPos[combo.exit].y;
      const txPx = toPos[combo.entry].x;
      const tyPx = toPos[combo.entry].y;

      // step out from source / target into adjacent sub-cell
      const stepOut = (px, py, dir) => {
        const dx = [SUB_CELL_W, -SUB_CELL_W, 0, 0][dir];
        const dy = [0, 0, SUB_CELL_H, -SUB_CELL_H][dir];
        return { x: px + dx, y: py + dy };
      };
      const startPx = stepOut(sxPx, syPx, exitDir);
      // for entry, the agent's last move is finalDir; agent comes FROM the
      // opposite of finalDir, so step the OTHER way to find the cell we
      // need to reach before entering the target
      const oppositeOfFinal = [1, 0, 3, 2][finalDir];
      const endPx = stepOut(txPx, tyPx, oppositeOfFinal);

      const { grid, cols, rows } = buildObstacleGrid(positions, svgWidth, svgHeight, {
        ...GRID_OPTS,
        occupiedCells,
      });
      const start = pixelToSubCell(startPx.x, startPx.y);
      const end = pixelToSubCell(endPx.x, endPx.y);

      // Make sure start/end cells themselves are free
      if (start.y >= 0 && start.y < rows && start.x >= 0 && start.x < cols) {
        grid[start.y * cols + start.x] = 0;
      }
      if (end.y >= 0 && end.y < rows && end.x >= 0 && end.x < cols) {
        grid[end.y * cols + end.x] = 0;
      }

      const path = findPath(grid, cols, rows, start, end, {
        ...A_STAR_OPTS,
        initialDir: exitDir,
        finalDir,
      });
      if (!path) continue;

      const polyline = pathToPolyline(path, { x: sxPx, y: syPx }, { x: txPx, y: tyPx }, exitDir, finalDir);
      if (!polyline) continue;

      // 防呆：A* 結果可能撞 task（rounding edge case）
      const stillBlocking = pathCrossesAnyTaskRect(polyline, positions, conn.fromId, conn.toId);
      if (stillBlocking) continue;

      // 成本估算：路徑長 + bend 數 × 30
      let bends = 0;
      for (let p = 1; p < polyline.length - 1; p++) {
        const [px, py] = polyline[p - 1];
        const [cx, cy] = polyline[p];
        const [nx, ny] = polyline[p + 1];
        const d1 = (cx - px) === 0 ? 'V' : 'H';
        const d2 = (nx - cx) === 0 ? 'V' : 'H';
        if (d1 !== d2) bends++;
      }
      let length = 0;
      for (let p = 0; p < polyline.length - 1; p++) {
        length += Math.abs(polyline[p + 1][0] - polyline[p][0])
                + Math.abs(polyline[p + 1][1] - polyline[p][1]);
      }
      const cost = length / SUB_CELL_W + bends * 30 + (combo.preference || 0) * PREFERENCE_PENALTY;

      if (cost < bestCost) {
        bestCost = cost;
        bestResult = { polyline, exitSide: combo.exit, entrySide: combo.entry };
      }
    }

    if (!bestResult) return;   // A* 找不到 — 維持原 routeArrow（紅）

    overrides.set(`${conn.fromId}::${conn.toId}::${i}`, bestResult);
    const cells = polylineToOccupiedCells(bestResult.polyline);
    cells.forEach(c => occupiedCells.add(c));
  });

  return overrides;
}

/**
 * A* routing orchestrator — Phase 3g 用。
 *
 * 跑完 Phase 1-3f 後，挑出**仍會視覺穿任務矩形**的 connection，
 * 用 A* 找乾淨路徑取代 routeArrow 結果。輸出 polyline override map。
 *
 * 觸發條件（D5 partial replacement）：
 *   只對 routeArrow 產生會撞任務的 connection 跑 A*。簡單 case
 *   （短路徑、無障礙）仍走 routeArrow，不浪費 A* compute。
 *
 * Override 硬約束（D6）：
 *   保留 connection 的 (exit, entry) port — A* 只搜中間路徑。
 *   initialDir / finalDir 鎖住兩端方向。
 *
 * Soft obstacle（D11 + D10）：
 *   按 connection 順序跑、每條跑完把 polyline 佔的 sub-cell 加入
 *   occupiedCells，後跑的 connection 偵測時 cost +20，自然繞開。
 *
 * 輸出：Map<connKey, polyline>，連線會替換 routeArrow 的結果。
 *      若 A* 找不到清楚路徑（比 routeArrow 更糟）則跳過該 connection。
 */

import { findPath } from './pathFinder.js';
import {
  buildObstacleGrid, pixelToSubCell, pathToPolyline, polylineToOccupiedCells,
  SUB_CELL_W, SUB_CELL_H,
} from './obstacleMap.js';
import { routeArrow } from './routeArrow.js';
import { pathCrossesAnyTaskRect } from './pathCrossesTask.js';

const SIDE_TO_DIR = { right: 0, left: 1, bottom: 2, top: 3 };
const OPPOSITE = { 0: 1, 1: 0, 2: 3, 3: 2 };

/**
 * @param {Array} connections — computeLayout 產出 connections array
 * @param {Object} positions — { taskId: { left, right, top, bottom, cx, cy } }
 * @param {number} svgWidth, svgHeight
 * @param {Set} taskIds — 用來識別障礙；其實 positions 鍵就是 taskIds
 * @returns Map<connKey, polyline>
 */
export function runAStarPhase(connections, positions, svgWidth, svgHeight) {
  const overrides = new Map();
  const occupiedCells = new Set();

  connections.forEach((conn, i) => {
    const fromPos = positions[conn.fromId];
    const toPos = positions[conn.toId];
    if (!fromPos || !toPos) return;

    // Compute the routeArrow polyline first to check if it crosses any task.
    const defaultPolyline = routeArrow(
      fromPos, toPos, conn.exitSide, conn.entrySide,
      conn.laneBottomY, conn.laneTopCorridorY
    );
    const blocking = pathCrossesAnyTaskRect(defaultPolyline, positions, conn.fromId, conn.toId);

    if (!blocking) {
      // routeArrow 已乾淨 — 把它佔的 cells 標起來給後跑的邊看
      const cells = polylineToOccupiedCells(defaultPolyline);
      cells.forEach(c => occupiedCells.add(c));
      return;
    }

    // Try A* with override hard constraint
    const exitDir = SIDE_TO_DIR[conn.exitSide];
    const entryDir = SIDE_TO_DIR[conn.entrySide];
    if (exitDir === undefined || entryDir === undefined) return;

    const sxPx = fromPos[conn.exitSide].x;
    const syPx = fromPos[conn.exitSide].y;
    const txPx = toPos[conn.entrySide].x;
    const tyPx = toPos[conn.entrySide].y;

    // Step ONE sub-cell out from source / into target so start/end are not
    // inside the task obstacle.
    const stepOut = (px, py, dir, w, h) => {
      const dx = [w, -w, 0, 0][dir];
      const dy = [0, 0, h, -h][dir];
      return { x: px + dx, y: py + dy };
    };
    const startPx = stepOut(sxPx, syPx, exitDir, SUB_CELL_W, SUB_CELL_H);
    const endPx = stepOut(txPx, tyPx, entryDir, SUB_CELL_W, SUB_CELL_H);

    const { grid, cols, rows } = buildObstacleGrid(positions, svgWidth, svgHeight, {
      occupiedCells,
    });
    const start = pixelToSubCell(startPx.x, startPx.y);
    const end = pixelToSubCell(endPx.x, endPx.y);

    // Make sure start/end cells are free (rounding may have placed them on task border)
    if (start.y >= 0 && start.y < rows && start.x >= 0 && start.x < cols) {
      grid[start.y * cols + start.x] = 0;
    }
    if (end.y >= 0 && end.y < rows && end.x >= 0 && end.x < cols) {
      grid[end.y * cols + end.x] = 0;
    }

    // finalDir = same direction as entryDir (the LAST step into target moves
    // INTO the task, which we treat as "the direction perpendicular to the
    // entry side" — actually opposite of entry side since we're moving INTO it).
    // entry top = arriving from above = last move direction = down (S = 2)
    // entry bottom = arriving from below = last move = up (N = 3)
    // entry left = arriving from left = last move = right (E = 0)
    // entry right = arriving from right = last move = left (W = 1)
    const finalDirMap = { top: 2, bottom: 3, left: 0, right: 1 };
    const finalDir = finalDirMap[conn.entrySide];

    const path = findPath(grid, cols, rows, start, end, {
      initialDir: exitDir,
      finalDir,
      bendPenalty: 10,
      maxIterations: 8000,
    });

    if (!path) return;   // A* 找不到 — 維持原 routeArrow（紅）

    const polyline = pathToPolyline(path, { x: sxPx, y: syPx }, { x: txPx, y: tyPx });
    if (!polyline) return;

    // Verify A* polyline doesn't actually cross tasks (defensive)
    const stillBlocking = pathCrossesAnyTaskRect(polyline, positions, conn.fromId, conn.toId);
    if (stillBlocking) return;   // 不接受比預設更糟的結果

    overrides.set(`${conn.fromId}::${conn.toId}::${i}`, polyline);
    const cells = polylineToOccupiedCells(polyline);
    cells.forEach(c => occupiedCells.add(c));
  });

  return overrides;
}

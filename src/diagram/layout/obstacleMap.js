/**
 * 把流程圖的 task positions 轉成 sub-cell grid，給 pathFinder.js 用。
 *
 * 解析度（D2 預設 (b)）：sub-cell 46×34 px（macro col_w 184 / row_h 136 各 4 等分）。
 *
 * Cell 編碼（Uint8Array）：
 *   0       — 空（自由通行）
 *   1-254   — 軟 penalty（air-gap 或被其他邊佔）
 *   255     — 硬 obstacle（task 內部、不可走）
 *
 * Air-gap penalty（D11 soft obstacle）：
 *   緊鄰 task 1 個 sub-cell 內 → +5 penalty
 *   被 already-routed edge 佔 → +20 penalty（傳 occupiedCells 進來）
 *
 * 函式：
 *   buildObstacleGrid(positions, svgWidth, svgHeight, opts)
 *   pixelToSubCell(x, y, subCellW, subCellH)
 *   subCellToPixel(sx, sy, subCellW, subCellH)
 */

export const SUB_CELL_W = 46;
export const SUB_CELL_H = 34;

export function buildObstacleGrid(positions, svgWidth, svgHeight, opts = {}) {
  const {
    subCellW = SUB_CELL_W,
    subCellH = SUB_CELL_H,
    airGapPenalty = 5,
    edgeCrossingPenalty = 20,
    occupiedCells = null,   // Set of "x:y" keys of cells already used by other edges
  } = opts;

  const cols = Math.max(1, Math.ceil(svgWidth / subCellW));
  const rows = Math.max(1, Math.ceil(svgHeight / subCellH));
  const grid = new Uint8Array(rows * cols);

  // 1) Mark task interiors as obstacles (255)
  for (const id in positions) {
    const p = positions[id];
    if (!p) continue;
    const x1 = Math.floor((p.left.x - 1) / subCellW);
    const x2 = Math.ceil((p.right.x + 1) / subCellW);
    const y1 = Math.floor((p.top.y - 1) / subCellH);
    const y2 = Math.ceil((p.bottom.y + 1) / subCellH);
    for (let y = Math.max(0, y1); y < Math.min(rows, y2); y++) {
      for (let x = Math.max(0, x1); x < Math.min(cols, x2); x++) {
        grid[y * cols + x] = 255;
      }
    }
  }

  // 2) Air-gap penalty (1 sub-cell border around obstacles)
  if (airGapPenalty > 0) {
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        if (grid[y * cols + x] !== 0) continue;
        // Check 4 neighbors for obstacle
        const neighborObstacle =
          (x > 0 && grid[y * cols + (x - 1)] === 255) ||
          (x < cols - 1 && grid[y * cols + (x + 1)] === 255) ||
          (y > 0 && grid[(y - 1) * cols + x] === 255) ||
          (y < rows - 1 && grid[(y + 1) * cols + x] === 255);
        if (neighborObstacle) {
          grid[y * cols + x] = airGapPenalty;
        }
      }
    }
  }

  // 3) Edge-crossing penalty (D11 soft obstacle for parallel edges)
  if (occupiedCells && occupiedCells.size > 0) {
    for (const key of occupiedCells) {
      const [sx, sy] = key.split(':').map(Number);
      if (sx < 0 || sx >= cols || sy < 0 || sy >= rows) continue;
      const idx = sy * cols + sx;
      // Don't override obstacle / increase only on free or air-gap cells
      if (grid[idx] < 255) {
        grid[idx] = Math.min(254, grid[idx] + edgeCrossingPenalty);
      }
    }
  }

  return { grid, cols, rows, subCellW, subCellH };
}

export function pixelToSubCell(x, y, subCellW = SUB_CELL_W, subCellH = SUB_CELL_H) {
  return { x: Math.round(x / subCellW), y: Math.round(y / subCellH) };
}

export function subCellToPixel(sx, sy, subCellW = SUB_CELL_W, subCellH = SUB_CELL_H) {
  return { x: sx * subCellW, y: sy * subCellH };
}

/**
 * 把 path（sub-cell 座標 array）轉成 polyline pixel 座標 array，
 * 在 endpoint 跟第一/最後 sub-cell 之間插入 axis-aligned 轉折點，
 * 避免「歪歪的」對角段。
 *
 * exitDir / entryDir: 0=E, 1=W, 2=S, 3=N（路徑離開 source / 抵達 target 的方向）
 */
export function pathToPolyline(path, startPx, endPx, exitDir, entryDir, subCellW = SUB_CELL_W, subCellH = SUB_CELL_H) {
  if (!path || path.length === 0) return null;

  const subPoints = path.map(p => [p.x * subCellW, p.y * subCellH]);
  const result = [[startPx.x, startPx.y]];

  // 起點 → 第一 sub-cell：插入 axis-aligned 轉折避免對角
  if (subPoints.length > 0) {
    const firstSub = subPoints[0];
    const isHorizontalExit = exitDir === 0 || exitDir === 1;   // right or left
    if (isHorizontalExit) {
      // 第一段水平：從 (startPx.x, startPx.y) 到 (firstSub.x, startPx.y)
      // 第二段垂直：到 (firstSub.x, firstSub.y)
      if (firstSub[0] !== startPx.x) result.push([firstSub[0], startPx.y]);
      if (firstSub[1] !== startPx.y) result.push([firstSub[0], firstSub[1]]);
    } else {
      // 垂直 exit：先垂直、再水平
      if (firstSub[1] !== startPx.y) result.push([startPx.x, firstSub[1]]);
      if (firstSub[0] !== startPx.x) result.push([firstSub[0], firstSub[1]]);
    }
  }

  // 中間 sub-cell（已經是 axis-aligned，因為 A* 一次只走一格水平或垂直）
  for (let i = 1; i < subPoints.length; i++) result.push(subPoints[i]);

  // 最後 sub-cell → 終點：插入 axis-aligned 轉折
  if (subPoints.length > 0) {
    const lastSub = subPoints[subPoints.length - 1];
    const isHorizontalEntry = entryDir === 0 || entryDir === 1;
    if (isHorizontalEntry) {
      // 最後一段水平：從 (lastSub.x, lastSub.y) 經 (lastSub.x, endPx.y) 到 (endPx.x, endPx.y)
      if (lastSub[1] !== endPx.y) result.push([lastSub[0], endPx.y]);
    } else {
      if (lastSub[0] !== endPx.x) result.push([endPx.x, lastSub[1]]);
    }
  }
  result.push([endPx.x, endPx.y]);

  return smoothPolyline(result);
}

function smoothPolyline(pts) {
  if (pts.length <= 2) return pts;
  const result = [pts[0]];
  for (let i = 1; i < pts.length - 1; i++) {
    const prev = result[result.length - 1];
    const cur = pts[i];
    const next = pts[i + 1];
    const dx1 = cur[0] - prev[0], dy1 = cur[1] - prev[1];
    const dx2 = next[0] - cur[0], dy2 = next[1] - cur[1];
    // Co-linear: cross product = 0 (and same direction sign)
    if (dx1 * dy2 - dy1 * dx2 === 0) continue;
    result.push(cur);
  }
  result.push(pts[pts.length - 1]);
  return result;
}

/**
 * 把 polyline 轉成 sub-cell key set，給後續邊用 occupiedCells 做 soft obstacle。
 */
export function polylineToOccupiedCells(polyline, subCellW = SUB_CELL_W, subCellH = SUB_CELL_H) {
  const cells = new Set();
  if (!polyline || polyline.length < 2) return cells;
  for (let i = 0; i < polyline.length - 1; i++) {
    const [x1, y1] = polyline[i];
    const [x2, y2] = polyline[i + 1];
    const sx1 = Math.round(x1 / subCellW), sy1 = Math.round(y1 / subCellH);
    const sx2 = Math.round(x2 / subCellW), sy2 = Math.round(y2 / subCellH);
    // Walk segment (axis-aligned)
    if (sx1 === sx2) {
      const yLo = Math.min(sy1, sy2), yHi = Math.max(sy1, sy2);
      for (let y = yLo; y <= yHi; y++) cells.add(`${sx1}:${y}`);
    } else if (sy1 === sy2) {
      const xLo = Math.min(sx1, sx2), xHi = Math.max(sx1, sx2);
      for (let x = xLo; x <= xHi; x++) cells.add(`${x}:${sy1}`);
    }
  }
  return cells;
}

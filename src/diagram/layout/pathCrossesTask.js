/**
 * 偵測 polyline 是否穿過任何 task 矩形（除了起點 / 終點 task）。
 * 跟 violations.js 內 pathCrossesRect 同邏輯，獨立 export 給 A* phase 用。
 */

const INSET = 2;

export function pathCrossesAnyTaskRect(polyline, positions, fromId, toId) {
  if (!polyline || polyline.length < 2) return false;
  for (const id in positions) {
    if (id === fromId || id === toId) continue;
    const pos = positions[id];
    if (!pos) continue;
    if (pathCrossesRect(polyline, pos)) return true;
  }
  return false;
}

function pathCrossesRect(pts, pos) {
  const rect = {
    x1: pos.left.x + INSET,
    x2: pos.right.x - INSET,
    y1: pos.top.y + INSET,
    y2: pos.bottom.y - INSET,
  };
  if (rect.x2 <= rect.x1 || rect.y2 <= rect.y1) return false;
  for (let i = 0; i < pts.length - 1; i++) {
    if (segmentCrossesRect(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], rect)) {
      return true;
    }
  }
  return false;
}

function segmentCrossesRect(x1, y1, x2, y2, r) {
  if (Math.abs(y1 - y2) < 0.5) {
    const y = y1;
    if (y <= r.y1 || y >= r.y2) return false;
    const xLo = Math.min(x1, x2), xHi = Math.max(x1, x2);
    return xHi > r.x1 && xLo < r.x2;
  }
  if (Math.abs(x1 - x2) < 0.5) {
    const x = x1;
    if (x <= r.x1 || x >= r.x2) return false;
    const yLo = Math.min(y1, y2), yHi = Math.max(y1, y2);
    return yHi > r.y1 && yLo < r.y2;
  }
  return false;
}

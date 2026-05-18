/**
 * pathPostProc.js — Path 後處理 + side/dir 共用 helper。
 *
 * - alignPortSegments：強制第一段沿 exitSide 方向、最後一段沿 entry 反向同軸
 * - cleanOrtho：移除 collinear 中間點、snap diagonal
 * - fallbackOrthoPath：A* 找不到 path 時的退路 (簡單 L 線)
 * - dirDelta / reverseSide / sideToDir：side → 座標 / dir 字串轉換
 */

/**
 * 第一段強制跟 exitSide 同軸；最後一段強制跟 entrySide 反向同軸。
 *   exitSide=right/left → 第一段水平
 *   exitSide=top/bottom → 第一段垂直
 *   entrySide=left/right → 最後一段水平
 *   entrySide=top/bottom → 最後一段垂直
 * 做法：在 port 跟第一/最後 A* 點之間插入「對齊軸線的中介點」
 */
export function alignPortSegments(pts, sides) {
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

export function dirDelta(side) {
  if (side === 'right')  return { dx:  1, dy:  0 };
  if (side === 'left')   return { dx: -1, dy:  0 };
  if (side === 'bottom') return { dx:  0, dy:  1 };
  return { dx:  0, dy: -1 };
}

export function reverseSide(side) {
  return { left: 'right', right: 'left', top: 'bottom', bottom: 'top' }[side];
}

export function sideToDir(side) {
  return { right: 'east', left: 'west', bottom: 'south', top: 'north' }[side];
}

export function fallbackOrthoPath(srcPort, tgtPort, sides) {
  // 找不到 path 時的退路：簡單 L-shape
  if (sides.exit === 'right' || sides.exit === 'left') {
    return [[srcPort.x, srcPort.y], [tgtPort.x, srcPort.y], [tgtPort.x, tgtPort.y]];
  }
  return [[srcPort.x, srcPort.y], [srcPort.x, tgtPort.y], [tgtPort.x, tgtPort.y]];
}

/** 把 path 強制 axis-aligned + 移除 collinear 中間點 */
export function cleanOrtho(pts) {
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

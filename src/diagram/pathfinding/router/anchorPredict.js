/**
 * anchorPredict.js — S1 (v1.8) + S6 (v1.9) Anchor by geometry pre-compute。
 *
 * 對每 task 預測 in / out anchor side。對每條 edge 投票：
 *   - source 的 out anchor 投 (target 相對 source 的方位)
 *   - target 的 in  anchor 投 (source 相對 target 的方位)
 *
 * 每 task 該方向票數最多的 side 設為 anchor。
 * S6 (v1.9)：嚴格 majority (> 50%) 才設，票數分散時回退 first-wins。
 *
 * 解 multi-pass 順序敏感：anchor 不再依「哪條 edge 先 route」決定，
 * 而由 layout 結構 (所有 connected task 的相對位置) 決定。
 */

export function predictAnchors(grid, rawConns, positions) {
  const emptyCounts = () => ({ left: 0, right: 0, top: 0, bottom: 0 });
  const votes = {};
  const ensure = (id) => {
    if (!votes[id]) votes[id] = { in: emptyCounts(), out: emptyCounts() };
    return votes[id];
  };
  // 由 dx/dy 推 side：取 |dx| 跟 |dy| 大的軸為主，再依號取 side
  const vote = (dx, dy) => {
    if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? 'right' : 'left';
    return dy >= 0 ? 'bottom' : 'top';
  };
  for (const conn of rawConns) {
    const src = positions[conn.fromId];
    const tgt = positions[conn.toId];
    if (!src || !tgt) continue;
    // src 的 out anchor 投：target 相對 src 在哪個方位 → src 從那個 side 出
    ensure(conn.fromId).out[vote(tgt.cx - src.cx, tgt.cy - src.cy)]++;
    // tgt 的 in anchor 投：source 相對 tgt 在哪個方位 → tgt 從那個 side 進入
    ensure(conn.toId).in[vote(src.cx - tgt.cx, src.cy - tgt.cy)]++;
  }
  // Tie-break: right > bottom > left > top (forward-east 偏好)
  const pickMaxSide = (counts) => {
    let best = null, bestCount = 0, total = 0;
    for (const side of ['right', 'bottom', 'left', 'top']) {
      total += counts[side];
      if (counts[side] > bestCount) { bestCount = counts[side]; best = side; }
    }
    // S6 (v1.9)：嚴格 majority (> 50%) 才設 anchor。
    // 票數分散時不預測，回退 first-wins (route 時自然決定)，避免錯誤鎖死導致
    // 自然路徑被 coherence 強迫繞行 (圖五包容閘道→5-1-4-5 R→L 繞遠案例)。
    if (total >= 2 && bestCount / total > 0.5) return best;
    return null;
  };
  for (const taskId in votes) {
    const inAnchor  = pickMaxSide(votes[taskId].in);
    const outAnchor = pickMaxSide(votes[taskId].out);
    if (inAnchor || outAnchor) {
      grid.coherence[taskId] = { in: inAnchor, out: outAnchor };
    }
  }
}

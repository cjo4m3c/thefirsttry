/**
 * Column assignment — topological + L4 walk algorithm.
 *
 * 演算法（2026-05-06 重構，從 idx-driven 升級）：
 *   按 L4 sortKey 順序走訪每個任務，計算 col：
 *     col[t] = max(predBound, l4Bound, 0)
 *   其中
 *     predBound = max(forward predecessors.col) + 1   ← topological 約束
 *     l4Bound   = (t 跟 prevTask 是同 parallel source 的 siblings)
 *                 ? prevTask.col           ← 同 col 允許（fork-out 對齊）
 *                 : prevTask.col + 1       ← 嚴格大於（L4 monotonic）
 *
 * 同時滿足：
 *   1. parallel siblings 連續 contiguous 時同 col 對齊（fork-out 視覺）
 *   2. 中間有非 sibling 任務時嚴格 L4 順序（不 leapfrog）
 *   3. compact — 無空白 col（max-align overshoot 問題消失）
 *
 * 取代舊 idx-driven 版本（PR #177）。idx 順序跟 L4 編號順序在
 * Excel 匯入 + computeDisplayLabels.usedCounters skip 等場景下會分歧；
 * 新演算法直接以 L4 編號為 col 排序基準。
 *
 * `parseL4SortKey(label)`：把 display label 轉成數字排序鍵：
 *   `${pfx}-0`        → 0       (start)
 *   `${pfx}-99`       → 99      (end)
 *   `${pfx}-N`        → N       (sequence task)
 *   `${pfx}-N_g[K]`   → N + 0.001 * K
 *   `${pfx}-N_s[K]`   → N + 0.501 * K
 *   `${pfx}-N_e[K]`   → N + 0.801 * K
 */
function parseL4SortKey(label) {
  if (!label) return Infinity;
  const m = String(label).match(/^\d+-\d+-\d+-(\d+)(?:_([gse])(\d*))?$/);
  if (!m) return Infinity;
  const base = parseInt(m[1], 10);
  if (!m[2]) return base;
  const offsetUnit = { g: 0.001, s: 0.501, e: 0.801 }[m[2]];
  const k = m[3] === '' ? 1 : parseInt(m[3], 10);
  return base + offsetUnit * k;
}

export function computeColumnMap(tasks, displayLabels) {
  const taskIdSet = new Set(tasks.map(t => t.id));
  const arrayIdxOf = {};
  tasks.forEach((t, i) => { arrayIdxOf[t.id] = i; });

  const sortKeyOf = {};
  tasks.forEach(t => { sortKeyOf[t.id] = parseL4SortKey(displayLabels[t.id]); });

  // Sort tasks by sortKey (L4 order); arrayIdxOf as tiebreaker
  const sortedIds = tasks
    .map(t => t.id)
    .sort((a, b) => {
      if (sortKeyOf[a] !== sortKeyOf[b]) return sortKeyOf[a] - sortKeyOf[b];
      return arrayIdxOf[a] - arrayIdxOf[b];
    });

  // Build forward predecessor list + parallel source markers.
  // Forward = sortKey strictly greater (skip backward / self).
  // parallelSourceOf[id] = source whose multi-target fanout includes id.
  const fwdPredOf = {};
  const parallelSourceOf = {};
  tasks.forEach(t => { fwdPredOf[t.id] = []; });

  tasks.forEach(task => {
    let targets;
    if (task.type === 'gateway') {
      targets = (task.conditions || []).map(c => c.nextTaskId);
    } else if (task.type !== 'end') {
      targets = task.nextTaskIds || [];
    } else {
      return;
    }
    const fwdTargets = targets.filter(id =>
      id && taskIdSet.has(id) && sortKeyOf[id] > sortKeyOf[task.id]
    );
    fwdTargets.forEach(id => {
      fwdPredOf[id].push(task.id);
    });
    if (fwdTargets.length >= 2) {
      // Multi-target source = parallel/conditional fanout. Each target
      // belongs to this source's "sibling group" so they may share a col
      // when contiguous in L4 order.
      fwdTargets.forEach(id => { parallelSourceOf[id] = task.id; });
    }
  });

  // Walk in L4 sort order, assign col
  const colOf = {};
  let prevId = null;
  sortedIds.forEach(id => {
    let predBound = 0;
    fwdPredOf[id].forEach(pid => {
      const pcol = colOf[pid];
      if (pcol !== undefined) predBound = Math.max(predBound, pcol + 1);
    });
    let l4Bound = 0;
    if (prevId !== null) {
      const prevCol = colOf[prevId] ?? 0;
      const shareSource =
        parallelSourceOf[id] !== undefined &&
        parallelSourceOf[id] === parallelSourceOf[prevId];
      l4Bound = shareSource ? prevCol : prevCol + 1;
    }
    colOf[id] = Math.max(predBound, l4Bound, 0);
    prevId = id;
  });

  return colOf;
}

/**
 * Prevent same-row same-col collisions: if two tasks in the same swimlane
 * land at the same col (e.g. parallel branches both targeting the same
 * lane), shift the later one rightward and propagate forward along the
 * graph. Iterates until stable.
 *
 * `orderOf` defaults to col-rank (so collision resolution follows L4 /
 * topological order rather than array idx).
 */
export function resolveRowCollisions(tasks, colOf, taskRowOf) {
  const idxOf = {};
  tasks.forEach(t => { idxOf[t.id] = colOf[t.id] ?? 0; });

  const taskIdSet = new Set(tasks.map(t => t.id));
  const successors = {};
  tasks.forEach(t => { successors[t.id] = []; });
  tasks.forEach(task => {
    const nexts = task.type === 'gateway'
      ? (task.conditions || []).map(c => c.nextTaskId)
      : [...(task.nextTaskIds || []), task.nextTaskId].filter(Boolean);
    nexts.forEach(nid => {
      if (!nid || !taskIdSet.has(nid)) return;
      if (idxOf[nid] <= idxOf[task.id]) return;
      successors[task.id].push(nid);
    });
  });

  const MAX_ITER = tasks.length * 2 + 2;
  for (let iter = 0; iter < MAX_ITER; iter++) {
    const cells = {};
    tasks.forEach(t => {
      const key = `${taskRowOf[t.id]}::${colOf[t.id]}`;
      (cells[key] = cells[key] || []).push(t.id);
    });

    let fixed = false;
    Object.values(cells).forEach(ids => {
      if (ids.length <= 1) return;
      const sorted = ids.slice().sort((a, b) => idxOf[a] - idxOf[b]);
      for (let i = 1; i < sorted.length; i++) {
        const id = sorted[i];
        colOf[id] = colOf[id] + 1;
        const queue = [id];
        const visited = new Set();
        while (queue.length) {
          const cur = queue.shift();
          if (visited.has(cur)) continue;
          visited.add(cur);
          successors[cur].forEach(nid => {
            if (colOf[nid] <= colOf[cur]) {
              colOf[nid] = colOf[cur] + 1;
              queue.push(nid);
            }
          });
        }
        fixed = true;
      }
    });
    if (!fixed) break;
  }
}

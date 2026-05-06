/**
 * Index-driven column assignment (2026-05-05 重構).
 *
 * 演算法：
 *   1. 預設 `col[t] = arrayIdxOf[t]` — 編輯器 / 表格的順序就是預設欄位順序，
 *      新增的 disconnected task 會在 lane 中對應 idx 位置出現，使用者好找
 *   2. 對「並行 source」覆寫 — 一個 task 同時導向 ≥2 個前向目標時，
 *      把所有目標對齊到 `max(source.col + 1, ...targets.col)`，保留並行視覺
 *
 * 並行 source 包含：
 *   - 閘道（gateway）的 conditions[]
 *   - 一般 task 的 nextTaskIds[] 多元素（implicit parallel-branch）
 *
 * 不算 override 的情境：
 *   - 序列：source 只一個目標 → 目標 col 維持自己 idx（避免拉緊壓縮）
 *   - 反向邊（target idx ≤ source idx）→ loop-return，跳過
 *
 * `resolveRowCollisions` 仍會處理「並行 override 後同 lane 同 col」的衝突，
 * 把後來的 task 推右 + 沿 graph 傳播。
 *
 * `mode` (preview branch 2026-05-06):
 *   - 'default'  — 原 max-align 行為（含 leapfrog bug）
 *   - 'scheme1'  — max-align + 後置「idx-monotonic per lane」守則，把被
 *                  leapfrog 的孤立任務推到 sibling 之後
 *   - 'scheme2'  — min-align：parallel override 改用 min(siblings.col)，
 *                  把 idx 大的 sibling 拉左對齊到最小 sibling 的 col
 *   - 'scheme3'  — 用 L4 編號順序當 col 排序基準（不是 array idx），
 *                  解 idx ≠ L4 編號 順序時的視覺反序問題
 */

/**
 * Parse an L4 display label into a sortable numeric key.
 *
 *   `${pfx}-0`        → 0       (start)
 *   `${pfx}-99`       → 99      (end)
 *   `${pfx}-N`        → N       (sequence task)
 *   `${pfx}-N_g[K]`   → N + K*0.001  (gateway after task N)
 *   `${pfx}-N_s[K]`   → N + K*0.501  (subprocess after task N, after gateways)
 *   `${pfx}-N_e[K]`   → N + K*0.801  (interaction after task N, after _g/_s)
 *
 * Returns Infinity for unparseable labels so they sink to the end without
 * disrupting the rest.
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

export function computeColumnMap(tasks, mode = 'default', displayLabels = null) {
  const taskIdSet = new Set(tasks.map(t => t.id));
  const arrayIdxOf = {};
  tasks.forEach((t, i) => { arrayIdxOf[t.id] = i; });

  // 1. Default col = array index, OR L4-sorted rank when scheme3
  const colOf = {};
  if (mode === 'scheme3' && displayLabels) {
    const sortedIds = tasks
      .map(t => t.id)
      .sort((a, b) => {
        const ka = parseL4SortKey(displayLabels[a]);
        const kb = parseL4SortKey(displayLabels[b]);
        if (ka !== kb) return ka - kb;
        return arrayIdxOf[a] - arrayIdxOf[b];   // tiebreaker
      });
    sortedIds.forEach((id, rank) => { colOf[id] = rank; });
  } else {
    tasks.forEach(t => { colOf[t.id] = arrayIdxOf[t.id]; });
  }

  // 2. Parallel-source override: align all forward targets at a shared col
  //
  // scheme3 SKIPS this entirely — col is already in strict L4 order, and
  // any override (max or min) would break that order when siblings span
  // mixed sortKeys. The user explicitly wants L4 = visual order, even at
  // the cost of fan-out lines having unequal length.
  if (mode === 'scheme3') return colOf;

  tasks.forEach(task => {
    let targets;
    if (task.type === 'gateway') {
      targets = (task.conditions || []).map(c => c.nextTaskId);
    } else if (task.type !== 'end') {
      targets = task.nextTaskIds || [];
    } else {
      return;
    }
    // For scheme3, "forward" is defined by sortKey order rather than idx
    // so a target with smaller idx but larger L4 still counts as forward.
    const isForward = (id) => {
      if (!id || !taskIdSet.has(id)) return false;
      if (mode === 'scheme3' && displayLabels) {
        return colOf[id] > colOf[task.id];
      }
      return arrayIdxOf[id] > arrayIdxOf[task.id];
    };
    const fwdTargets = targets.filter(isForward);
    if (fwdTargets.length < 2) return;

    if (mode === 'scheme2') {
      // Min-align: pull later siblings LEFT to the smallest sibling's col
      const sharedCol = Math.max(
        colOf[task.id] + 1,
        Math.min(...fwdTargets.map(id => colOf[id]))
      );
      fwdTargets.forEach(id => { colOf[id] = sharedCol; });
    } else {
      // default / scheme1 / scheme3: max-align (original behavior)
      const sharedCol = Math.max(
        colOf[task.id] + 1,
        ...fwdTargets.map(id => colOf[id])
      );
      fwdTargets.forEach(id => {
        colOf[id] = Math.max(colOf[id], sharedCol);
      });
    }
  });

  return colOf;
}

/**
 * Scheme 1: per-lane idx-monotonic enforcement. After parallel override may
 * have leapfrogged a sibling past a non-sibling task at intermediate idx,
 * walk each lane in idx order and push later-idx tasks rightward so col
 * order matches idx order within each lane.
 *
 * Mutates colOf in place. Caller passes the same colOf returned from
 * computeColumnMap; safe to no-op when mode !== 'scheme1'.
 */
export function enforceIdxMonotonicPerLane(tasks, colOf, taskRowOf) {
  const arrayIdxOf = {};
  tasks.forEach((t, i) => { arrayIdxOf[t.id] = i; });
  const byLane = {};
  tasks.forEach(t => {
    const r = taskRowOf[t.id];
    if (r === undefined) return;
    (byLane[r] ||= []).push(t.id);
  });
  Object.values(byLane).forEach(ids => {
    ids.sort((a, b) => arrayIdxOf[a] - arrayIdxOf[b]);
    for (let i = 1; i < ids.length; i++) {
      const cur = ids[i], prev = ids[i - 1];
      if (colOf[cur] <= colOf[prev]) {
        colOf[cur] = colOf[prev] + 1;
      }
    }
  });
}

/**
 * Prevent same-row same-col collisions: if two tasks in the same swimlane land
 * at the same column (e.g. parallel branches both targeting the same lane),
 * shift the later-indexed task rightward and propagate the shift forward along
 * the graph so the topological order is preserved. Iterates until stable.
 *
 * `orderOf` (optional): map taskId → numeric "logical position". When omitted
 * defaults to array idx — the original behaviour. scheme3 passes a map derived
 * from L4 sortKey so collisions resolve in display-label order rather than
 * idx order.
 */
export function resolveRowCollisions(tasks, colOf, taskRowOf, orderOf = null) {
  const fallbackIdx = {};
  tasks.forEach((t, i) => { fallbackIdx[t.id] = i; });
  const idxOf = orderOf || fallbackIdx;

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

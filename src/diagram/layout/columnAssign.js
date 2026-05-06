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
 */
export function computeColumnMap(tasks, mode = 'default') {
  const taskIdSet = new Set(tasks.map(t => t.id));
  const arrayIdxOf = {};
  tasks.forEach((t, i) => { arrayIdxOf[t.id] = i; });

  // 1. Default col = array index
  const colOf = {};
  tasks.forEach(t => { colOf[t.id] = arrayIdxOf[t.id]; });

  // 2. Parallel-source override: align all forward targets at a shared col
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
      id && taskIdSet.has(id) && arrayIdxOf[id] > arrayIdxOf[task.id]
    );
    if (fwdTargets.length < 2) return;   // single target = sequential, no override

    if (mode === 'scheme2') {
      // Min-align: pull later siblings LEFT to the smallest sibling's col
      const sharedCol = Math.max(
        colOf[task.id] + 1,
        Math.min(...fwdTargets.map(id => colOf[id]))
      );
      fwdTargets.forEach(id => { colOf[id] = sharedCol; });
    } else {
      // Default / scheme1: max-align (original behavior)
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
 */
export function resolveRowCollisions(tasks, colOf, taskRowOf) {
  const arrayIdxOf = {};
  tasks.forEach((t, i) => { arrayIdxOf[t.id] = i; });

  const taskIdSet = new Set(tasks.map(t => t.id));
  const successors = {};
  tasks.forEach(t => { successors[t.id] = []; });
  tasks.forEach(task => {
    const nexts = task.type === 'gateway'
      ? (task.conditions || []).map(c => c.nextTaskId)
      : [...(task.nextTaskIds || []), task.nextTaskId].filter(Boolean);
    nexts.forEach(nid => {
      if (!nid || !taskIdSet.has(nid)) return;
      if (arrayIdxOf[nid] <= arrayIdxOf[task.id]) return;
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
      const sorted = ids.slice().sort((a, b) => arrayIdxOf[a] - arrayIdxOf[b]);
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

/**
 * Pure sort helpers for the Dashboard flow list.
 *
 * Pinned items always come first within their group; pinned and non-pinned
 * each independently obey the chosen sortKey.
 */

export const SORT_OPTIONS = [
  { value: 'number-asc',  label: 'L3編號 ↑' },
  { value: 'number-desc', label: 'L3編號 ↓' },
  { value: 'name-asc',    label: 'L3活動名稱 ↑' },
  { value: 'name-desc',   label: 'L3活動名稱 ↓' },
  { value: 'updated-desc', label: '更新日期（最新）' },
  { value: 'updated-asc',  label: '更新日期（最舊）' },
  { value: 'roles-desc',   label: '角色數（多 → 少）' },
  { value: 'roles-asc',    label: '角色數（少 → 多）' },
  { value: 'tasks-desc',   label: '任務數（多 → 少）' },
  { value: 'tasks-asc',    label: '任務數（少 → 多）' },
];

function roleCount(flow) {
  return Array.isArray(flow?.roles) ? flow.roles.length : 0;
}
function taskCount(flow) {
  return Array.isArray(flow?.tasks) ? flow.tasks.length : 0;
}

export function sortFlows(flows, sortKey) {
  const arr = [...flows];
  switch (sortKey) {
    case 'number-asc':
      arr.sort((a, b) => String(a.l3Number ?? '').localeCompare(String(b.l3Number ?? ''), 'zh-TW', { numeric: true }));
      break;
    case 'number-desc':
      arr.sort((a, b) => String(b.l3Number ?? '').localeCompare(String(a.l3Number ?? ''), 'zh-TW', { numeric: true }));
      break;
    case 'name-asc':
      arr.sort((a, b) => String(a.l3Name ?? '').localeCompare(String(b.l3Name ?? ''), 'zh-TW'));
      break;
    case 'name-desc':
      arr.sort((a, b) => String(b.l3Name ?? '').localeCompare(String(a.l3Name ?? ''), 'zh-TW'));
      break;
    case 'updated-desc':
      arr.sort((a, b) => (b.updatedAt ?? b.createdAt ?? '').localeCompare(a.updatedAt ?? a.createdAt ?? ''));
      break;
    case 'updated-asc':
      arr.sort((a, b) => (a.updatedAt ?? a.createdAt ?? '').localeCompare(b.updatedAt ?? b.createdAt ?? ''));
      break;
    case 'roles-desc':
      arr.sort((a, b) => (roleCount(b) - roleCount(a))
        || String(a.l3Number ?? '').localeCompare(String(b.l3Number ?? ''), 'zh-TW', { numeric: true }));
      break;
    case 'roles-asc':
      arr.sort((a, b) => (roleCount(a) - roleCount(b))
        || String(a.l3Number ?? '').localeCompare(String(b.l3Number ?? ''), 'zh-TW', { numeric: true }));
      break;
    case 'tasks-desc':
      arr.sort((a, b) => (taskCount(b) - taskCount(a))
        || String(a.l3Number ?? '').localeCompare(String(b.l3Number ?? ''), 'zh-TW', { numeric: true }));
      break;
    case 'tasks-asc':
      arr.sort((a, b) => (taskCount(a) - taskCount(b))
        || String(a.l3Number ?? '').localeCompare(String(b.l3Number ?? ''), 'zh-TW', { numeric: true }));
      break;
    default:
      break;
  }
  // Pinned items always come first; pinned and non-pinned each keep above sort order.
  return [...arr.filter(f => f.pinned), ...arr.filter(f => !f.pinned)];
}

/**
 * 篩選 flows — 三條件 AND 結合（PR #235 加）：
 *   - keyword：在 L3 名稱 / L3 編號 / L4 任務名稱 中 substring 比對（大小寫不敏感）
 *   - l2：L3 編號的前 2 段（例 `2-1`）prefix match、空字串視為「全部」
 *   - roles：角色名陣列、AND 結合（必須同時含這些角色才命中）、空陣列視為「全部」
 */
export function filterFlows(flows, { keyword = '', l2 = '', roles = [] } = {}) {
  const kw = keyword.trim().toLowerCase();
  const l2Pre = l2.trim();
  const roleSet = new Set(roles);
  return flows.filter(f => {
    if (kw) {
      const hay = [
        String(f.l3Number ?? ''),
        String(f.l3Name ?? ''),
        ...(Array.isArray(f.tasks) ? f.tasks.map(t => String(t.taskName ?? '')) : []),
      ].join('\n').toLowerCase();
      if (!hay.includes(kw)) return false;
    }
    if (l2Pre) {
      const num = String(f.l3Number ?? '');
      const parts = num.split('-');
      const flowL2 = parts.length >= 2 ? `${parts[0]}-${parts[1]}` : '';
      if (flowL2 !== l2Pre) return false;
    }
    if (roleSet.size > 0) {
      const flowRoleNames = new Set((f.roles ?? []).map(r => r.name));
      for (const need of roleSet) {
        if (!flowRoleNames.has(need)) return false;
      }
    }
    return true;
  });
}

// 掃出所有現存 L2 prefix（例 `1-1` / `1-2` / `2-1`）+ 每個的 count、給 dropdown 用
export function extractL2Options(flows) {
  const counts = new Map();
  for (const f of flows) {
    const parts = String(f.l3Number ?? '').split('-');
    if (parts.length >= 2) {
      const key = `${parts[0]}-${parts[1]}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  return Array.from(counts.entries())
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => a.value.localeCompare(b.value, 'zh-TW', { numeric: true }));
}

// 掃出所有去重角色名 + 每個 count、給角色 dropdown 用
export function extractRoleOptions(flows) {
  const counts = new Map();
  for (const f of flows) {
    for (const r of f.roles ?? []) {
      const name = r.name;
      if (!name) continue;
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }
  }
  return Array.from(counts.entries())
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => a.value.localeCompare(b.value, 'zh-TW'));
}

// 24h 制（hour12: false）對齊全站日期格式：「2026/05/19 15:23」
// 而非 zh-TW default 12h「2026/05/19 下午03:23」、節省 ~32px 寬度
export function fmtDateTime(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('zh-TW', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  });
}

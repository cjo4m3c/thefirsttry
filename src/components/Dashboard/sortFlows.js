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

// 24h 制（hour12: false）對齊全站日期格式：「2026/05/19 15:23」
// 而非 zh-TW default 12h「2026/05/19 下午03:23」、節省 ~32px 寬度
export function fmtDateTime(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('zh-TW', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  });
}

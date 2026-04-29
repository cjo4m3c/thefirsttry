// Sort options + pure sort function for the Dashboard L3 list.
// Pinned items always come first; pinned and non-pinned each keep the
// requested sort order independently.

export const SORT_OPTIONS = [
  { value: 'number-asc',  label: 'L3 編號 ↑' },
  { value: 'number-desc', label: 'L3 編號 ↓' },
  { value: 'updated-desc', label: '更新日期（最新）' },
  { value: 'updated-asc',  label: '更新日期（最舊）' },
  { value: 'roles-desc',   label: '角色數（多 → 少）' },
  { value: 'roles-asc',    label: '角色數（少 → 多）' },
  { value: 'tasks-desc',   label: '任務數（多 → 少）' },
  { value: 'tasks-asc',    label: '任務數（少 → 多）' },
];

const roleCount = (flow) => Array.isArray(flow?.roles) ? flow.roles.length : 0;
const taskCount = (flow) => Array.isArray(flow?.tasks) ? flow.tasks.length : 0;
const byNumberAsc  = (a, b) => String(a.l3Number ?? '').localeCompare(String(b.l3Number ?? ''), 'zh-TW', { numeric: true });
const byNumberDesc = (a, b) => String(b.l3Number ?? '').localeCompare(String(a.l3Number ?? ''), 'zh-TW', { numeric: true });

export function sortFlows(flows, sortKey) {
  const arr = [...flows];
  switch (sortKey) {
    case 'number-asc':   arr.sort(byNumberAsc); break;
    case 'number-desc':  arr.sort(byNumberDesc); break;
    case 'updated-desc': arr.sort((a, b) => (b.updatedAt ?? b.createdAt ?? '').localeCompare(a.updatedAt ?? a.createdAt ?? '')); break;
    case 'updated-asc':  arr.sort((a, b) => (a.updatedAt ?? a.createdAt ?? '').localeCompare(b.updatedAt ?? b.createdAt ?? '')); break;
    case 'roles-desc':   arr.sort((a, b) => (roleCount(b) - roleCount(a)) || byNumberAsc(a, b)); break;
    case 'roles-asc':    arr.sort((a, b) => (roleCount(a) - roleCount(b)) || byNumberAsc(a, b)); break;
    case 'tasks-desc':   arr.sort((a, b) => (taskCount(b) - taskCount(a)) || byNumberAsc(a, b)); break;
    case 'tasks-asc':    arr.sort((a, b) => (taskCount(a) - taskCount(b)) || byNumberAsc(a, b)); break;
    default: break;
  }
  return [...arr.filter(f => f.pinned), ...arr.filter(f => !f.pinned)];
}

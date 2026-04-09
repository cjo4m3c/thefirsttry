/**
 * Excel export utility for flow data.
 * Generates the standard 10-column L4 task spreadsheet.
 */
import * as XLSX from 'xlsx';

export const EXCEL_HEADERS = [
  'L3 活動編號',
  'L3 活動名稱',
  'L4 任務編號',
  'L4 任務名稱',
  '任務重點說明',
  '任務重要輸入',
  '任務負責角色',
  '任務產出成品',
  '任務關聯說明（BPMN Sequence Flow）',
  '參考資料來源文件名稱',
];

const COL_WIDTHS = [
  { wch: 14 }, // L3 編號
  { wch: 24 }, // L3 名稱
  { wch: 14 }, // L4 編號
  { wch: 24 }, // L4 名稱
  { wch: 30 }, // 重點說明
  { wch: 25 }, // 重要輸入
  { wch: 14 }, // 負責角色
  { wch: 25 }, // 產出成品
  { wch: 36 }, // 關聯說明
  { wch: 25 }, // 參考資料
];

/**
 * Build a map from task ID → L4 task number.
 * Uses stored task.l4Number (from import) when available,
 * otherwise assigns sequential numbers to ALL tasks (including start/end/gateway).
 */
export function buildTableL4Map(l3Number, tasks) {
  const map = {};
  let counter = 1;
  tasks.forEach(task => {
    map[task.id] = task.l4Number || `${l3Number}.${counter++}`;
  });
  return map;
}

/**
 * Auto-generate 任務關聯說明 text from a task's outgoing connections.
 * Returns a human-readable annotation string.
 */
export function generateFlowAnnotation(task, tasks, l4Map) {
  const taskById = {};
  tasks.forEach(t => { taskById[t.id] = t; });

  // Count incoming connections per task (to detect merge nodes)
  const incomingCount = {};
  tasks.forEach(t => {
    const outs = t.type === 'gateway'
      ? (t.conditions || []).map(c => c.nextTaskId)
      : (t.nextTaskIds || []);
    outs.filter(Boolean).forEach(id => {
      incomingCount[id] = (incomingCount[id] || 0) + 1;
    });
  });

  if (task.type === 'end') return '流程結束';

  if (task.type === 'start') {
    const nexts = (task.nextTaskIds || [])
      .filter(id => taskById[id])
      .map(id => l4Map[id]).filter(Boolean);
    return nexts.length ? `流程開始，序列流向 ${nexts.join('、')}` : '流程開始';
  }

  if (task.type === 'gateway') {
    const conds = task.conditions || [];
    const isMergeNode = (incomingCount[task.id] || 0) > 1 && conds.length <= 1;
    const gType = task.gatewayType || 'xor';

    const outNums = conds.map(c => {
      if (!c.nextTaskId || !taskById[c.nextTaskId]) return null;
      return l4Map[c.nextTaskId] || null;
    }).filter(Boolean);

    if (gType === 'and') {
      // AND join: single outgoing
      if (isMergeNode && outNums.length === 1) {
        return `並行合併來自多個分支，序列流向 ${outNums[0]}`;
      }
      // AND fork: parallel branches
      return outNums.length ? `並行分支至 ${outNums.join('、')}` : '';
    }

    // XOR / OR gateway
    const outParts = conds.map(c => {
      if (!c.nextTaskId || !taskById[c.nextTaskId]) return null;
      if (taskById[c.nextTaskId].type === 'end') {
        return c.label ? `流程結束（${c.label}）` : '流程結束';
      }
      const num = l4Map[c.nextTaskId];
      if (!num) return null;
      return c.label ? `${num}（${c.label}）` : num;
    }).filter(Boolean);

    if (isMergeNode && outParts.length === 1) {
      return `條件合併來自多個分支，序列流向 ${outParts[0]}`;
    }
    return outParts.length ? `條件分支至 ${outParts.join('、')}` : '';
  }

  // Regular task / interaction / l3activity
  const nexts = (task.nextTaskIds || []).filter(id => taskById[id]);
  if (nexts.length === 0) return '';

  const toOther = nexts.filter(id => taskById[id].type !== 'end');
  if (toOther.length === 0) return '流程結束';

  if (nexts.length === 1) {
    const num = l4Map[nexts[0]];
    return num ? `序列流向 ${num}` : '';
  }

  // Multiple outgoing (parallel)
  const parts = nexts.map(id => {
    if (taskById[id].type === 'end') return '流程結束';
    return l4Map[id];
  }).filter(Boolean);
  return parts.length ? `並行分支至 ${parts.join('、')}` : '';
}

/**
 * Build the 2D array of rows (no header) for the Excel sheet.
 * Uses the task's stored metadata fields when available.
 */
export function buildExcelRows(flow) {
  const { l3Number, l3Name, roles, tasks } = flow;
  const roleById = {};
  (roles || []).forEach(r => { roleById[r.id] = r.name; });

  const l4Map = buildTableL4Map(l3Number, tasks);

  return (tasks || []).map(task => {
    const annotation = task.flowAnnotation || generateFlowAnnotation(task, tasks, l4Map);
    return [
      l3Number,
      l3Name,
      l4Map[task.id] || '',
      task.name || '',
      task.description || '',
      task.inputItems || '',
      roleById[task.roleId] || '',
      task.outputItems || '',
      annotation,
      task.reference || '',
    ];
  });
}

/**
 * Download the flow as an Excel file (.xlsx).
 */
export function exportFlowToExcel(flow) {
  const rows = buildExcelRows(flow);
  const ws = XLSX.utils.aoa_to_sheet([EXCEL_HEADERS, ...rows]);
  ws['!cols'] = COL_WIDTHS;

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'L4流程');
  XLSX.writeFile(wb, `${flow.l3Number}-${flow.l3Name}.xlsx`);
}

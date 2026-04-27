/**
 * Excel export utility for flow data.
 * Generates the standard 10-column L4 task spreadsheet.
 */
import * as XLSX from 'xlsx';
import { todayYmd } from './storage.js';
import { computeDisplayLabels } from './taskDefs.js';

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
 *
 * Single source of truth: defers to `computeDisplayLabels` (taskDefs.js) so
 * Excel export, FlowTable display, and the on-canvas labels all use the same
 * numbering rule:
 *   - start event   → L3-0
 *   - end event     → L3-99
 *   - gateway       → ${prevTask}_g (or _g2, _g3 for consecutive)
 *   - regular task  → L3-{counter}, counter only increments on regular tasks
 *   - stored task.l4Number wins (preserves imported numbering)
 *
 * Before 2026-04-27 this was a separate `counter++` loop that gave EVERY task
 * a sequential number including start/end/gateway, producing wrong labels
 * (e.g. start=L3-1 instead of L3-0) in any flow without stored l4Number.
 */
export function buildTableL4Map(l3Number, tasks) {
  return computeDisplayLabels(tasks, l3Number);
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

  const ct = task.connectionType;

  if (ct === 'breakpoint' || task.type === 'end') {
    if (ct === 'breakpoint') {
      const reason = task.breakpointReason?.trim();
      return reason ? `【流程斷點：${reason}】` : '【流程斷點】';
    }
    return '流程結束';
  }

  if (ct === 'subprocess') {
    const subName = task.subprocessName?.trim() || '子流程';
    const nextId = (task.nextTaskIds || []).find(id => taskById[id]);
    const nextNum = nextId ? l4Map[nextId] : '';
    return nextNum ? `調用子流程 ${subName}，返回後序列流向 ${nextNum}` : `調用子流程 ${subName}`;
  }

  if (ct === 'loop-return') {
    const backId = task.nextTaskIds?.[0];
    const backNum = backId && taskById[backId] ? l4Map[backId] : '';
    const desc = task.loopDescription?.trim();
    const base = backNum ? `迴圈返回，序列流向 ${backNum}` : '迴圈返回';
    return desc ? `${base}（${desc}）` : base;
  }

  if (task.type === 'end') return '流程結束';

  if (ct === 'start' || task.type === 'start') {
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

    // Build labelled fork parts (every gateway type uses the same shape now —
    // condition labels are optional but always rendered if present).
    const outParts = conds.map(c => {
      if (!c.nextTaskId || !taskById[c.nextTaskId]) return null;
      if (taskById[c.nextTaskId].type === 'end') {
        return c.label ? `流程結束（${c.label}）` : '流程結束';
      }
      const num = l4Map[c.nextTaskId];
      if (!num) return null;
      return c.label ? `${num}（${c.label}）` : num;
    }).filter(Boolean);

    if (gType === 'and') {
      if (isMergeNode && outNums.length === 1) {
        return `並行合併來自多個分支，序列流向 ${outNums[0]}`;
      }
      return outParts.length ? `並行分支至 ${outParts.join('、')}` : '';
    }

    if (gType === 'or') {
      if (isMergeNode && outNums.length === 1) {
        return `包容合併來自多個分支，序列流向 ${outNums[0]}`;
      }
      return outParts.length ? `包容分支至 ${outParts.join('、')}` : '';
    }

    // XOR
    if (isMergeNode && outParts.length === 1) {
      return `條件合併來自多個分支，序列流向 ${outParts[0]}`;
    }
    return outParts.length ? `條件分支至 ${outParts.join('、')}` : '';
  }

  // Regular task / interaction / l3activity
  const nexts = (task.nextTaskIds || []).filter(id => taskById[id]);
  if (nexts.length === 0) return '';

  const toOther = nexts.filter(id => taskById[id].type !== 'end' && taskById[id].connectionType !== 'end' && taskById[id].connectionType !== 'breakpoint');
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
function buildExcelRows(flow) {
  const { l3Number, l3Name, roles, tasks } = flow;
  const roleById = {};
  (roles || []).forEach(r => { roleById[r.id] = r.name; });

  const l4Map = buildTableL4Map(l3Number, tasks);

  return (tasks || []).map(task => {
    // Always recompute the annotation from the latest task graph instead of
    // honoring `task.flowAnnotation` (the stored Excel-import string).
    // Previously `task.flowAnnotation || generateFlowAnnotation(...)` made
    // imported flows freeze their original annotation text, so editing a
    // connection would update the diagram + FlowTable but NOT the Excel
    // download — three views, two truths. FlowTable already always
    // recomputes; this aligns Excel export with it.
    const annotation = generateFlowAnnotation(task, tasks, l4Map);
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
  XLSX.writeFile(wb, `${flow.l3Number}-${flow.l3Name}-${todayYmd()}.xlsx`);
}

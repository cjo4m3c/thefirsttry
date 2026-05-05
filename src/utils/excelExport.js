/**
 * Excel export utility for flow data.
 * Generates the L4 task spreadsheet — 10 core columns (A~J) + 20 auxiliary
 * columns (K~AD) driven by AUX_FIELDS. Aux content lives in `task.meta` and
 * never participates in flow logic; export just reads it through.
 */
import * as XLSX from 'xlsx';
import { todayYmd } from './storage.js';
import { computeDisplayLabels } from './taskDefs.js';
import { formatConnection } from '../model/connectionFormat.js';
import { AUX_FIELDS } from './auxFieldDefs.js';

const CORE_HEADERS = [
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

const CORE_WIDTHS = [
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

// Auxiliary columns: separator → empty header + narrow width; real field →
// header text from AUX_FIELDS + 18 wch default. Keep this derivation pure so
// AUX_FIELDS edits propagate without touching this file.
const AUX_HEADERS = AUX_FIELDS.map(f => f.separator ? '' : f.header);
const AUX_WIDTHS  = AUX_FIELDS.map(f => f.separator ? { wch: 3 } : { wch: 18 });

export const EXCEL_HEADERS = [...CORE_HEADERS, ...AUX_HEADERS];
const COL_WIDTHS = [...CORE_WIDTHS, ...AUX_WIDTHS];

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
 * Backward-compat alias — implementation now lives in `src/model/connectionFormat.js`.
 * View-layer code should import `formatConnection` from the model directly.
 */
export const generateFlowAnnotation = formatConnection;

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
    const meta = task.meta || {};
    const auxCells = AUX_FIELDS.map(f =>
      f.separator ? '' : (meta[f.key] ?? '')
    );
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
      ...auxCells,
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

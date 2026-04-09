import * as XLSX from 'xlsx';
import { generateId } from './storage.js';

// Column indices (0-based) for the expected Excel format
const COL_L3_NUMBER = 0;  // L3 活動編號
const COL_L3_NAME   = 1;  // L3 活動名稱
const COL_L4_NUMBER = 2;  // L4 任務編號
const COL_L4_NAME   = 3;  // L4 任務名稱
// COL_L4_DESC     = 4   // 任務重點說明 (not used in schema currently)
// COL_L4_INPUT    = 5   // 任務重要輸入 (not used in schema currently)
const COL_L4_ROLE   = 6;  // 任務負責角色
// COL_L4_OUTPUT   = 7   // 任務產出成品 (not used in schema currently)
const COL_L4_FLOW   = 8;  // 任務關聯說明（BPMN Sequence Flow）
// COL_L4_REF      = 9   // 參考資料來源文件名稱 (not used in schema currently)

/**
 * Convert L3 number from `1-1-1` format to `1.1.1`.
 */
function normalizeL3Number(raw) {
  return String(raw ?? '').trim().replace(/-/g, '.');
}

/**
 * Parse 任務關聯說明 text to extract L4 task numbers that are next steps.
 * Handles patterns like "序列流向 5.1.1.3" or "序列流向5.1.1.3".
 * Returns an array of L4 number strings (e.g. ["5.1.1.3"]).
 */
function parseNextTaskNumbers(flowText) {
  if (!flowText) return [];
  const text = String(flowText);
  const matches = [...text.matchAll(/序列流向\s*([\d.]+)/g)];
  return matches.map(m => m[1].trim());
}

/**
 * Parse an Excel file ArrayBuffer and return a flow object compatible with
 * the existing bpm_flows_v1 schema.
 *
 * @param {ArrayBuffer} arrayBuffer
 * @returns {{ id, l3Number, l3Name, roles, tasks }}
 */
export function parseExcelToFlow(arrayBuffer) {
  const workbook = XLSX.read(arrayBuffer, { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];

  // sheet_to_json with header:1 gives raw rows as arrays; defval:'' fills blanks
  const allRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

  // Drop the header row and filter to rows that have an L4 task number
  const dataRows = allRows.slice(1).filter(row => String(row[COL_L4_NUMBER] ?? '').trim());

  if (dataRows.length === 0) {
    throw new Error('找不到有效的 L4 任務資料（請確認欄位順序正確，且 Excel 首列為標題列）');
  }

  // ── L3 metadata from first data row ──────────────────────────────────────
  const firstRow = dataRows[0];
  const l3Number = normalizeL3Number(firstRow[COL_L3_NUMBER]);
  const l3Name   = String(firstRow[COL_L3_NAME] ?? '').trim();

  // ── Roles: unique, in order of first appearance ───────────────────────────
  const roleNameToId = {};
  const roles = [];
  dataRows.forEach(row => {
    const name = String(row[COL_L4_ROLE] ?? '').trim();
    if (name && !roleNameToId[name]) {
      const id = generateId();
      roleNameToId[name] = id;
      roles.push({ id, name, type: 'internal' });
    }
  });

  if (roles.length === 0) {
    throw new Error('找不到任務負責角色資料（第 7 欄）');
  }

  // ── Build tasks from data rows ────────────────────────────────────────────
  const taskByNumber = {};
  const taskList = [];

  dataRows.forEach(row => {
    const l4Num  = String(row[COL_L4_NUMBER] ?? '').trim();
    const l4Name = String(row[COL_L4_NAME]   ?? '').trim();
    const roleName = String(row[COL_L4_ROLE] ?? '').trim();
    const roleId   = roleNameToId[roleName] ?? roles[0].id;

    const task = {
      id: generateId(),
      name: l4Name || l4Num,
      type: 'task',
      roleId,
      nextTaskIds: [],
      _l4Number: l4Num,
      _flowText: String(row[COL_L4_FLOW] ?? ''),
    };

    taskByNumber[l4Num] = task;
    taskList.push(task);
  });

  // ── Resolve nextTaskIds from 任務關聯說明 ─────────────────────────────────
  taskList.forEach(task => {
    const nextNums = parseNextTaskNumbers(task._flowText);
    task.nextTaskIds = nextNums
      .map(n => taskByNumber[n]?.id)
      .filter(Boolean);
  });

  // ── Auto-generate start event (role = first task's role) ──────────────────
  const startTask = {
    id: generateId(),
    name: '開始',
    type: 'start',
    roleId: taskList[0]?.roleId ?? roles[0].id,
    nextTaskIds: taskList[0] ? [taskList[0].id] : [],
  };

  // ── Auto-generate end event (role = last task's role) ────────────────────
  const endTask = {
    id: generateId(),
    name: '結束',
    type: 'end',
    roleId: taskList[taskList.length - 1]?.roleId ?? roles[0].id,
    nextTaskIds: [],
  };

  // Tasks with no explicit next step → connect to end event
  taskList.forEach(task => {
    if (task.nextTaskIds.length === 0) {
      task.nextTaskIds = [endTask.id];
    }
  });

  // ── Clean up internal fields and assemble final tasks array ───────────────
  const tasks = [startTask, ...taskList, endTask].map(({ _l4Number, _flowText, ...t }) => t);

  return {
    id: generateId(),
    l3Number,
    l3Name,
    roles,
    tasks,
  };
}

import * as XLSX from 'xlsx';
import { generateId } from './storage.js';

// Column indices (0-based) for the expected Excel format
const COL_L3_NUMBER = 0;  // L3 活動編號
const COL_L3_NAME   = 1;  // L3 活動名稱
const COL_L4_NUMBER = 2;  // L4 任務編號
const COL_L4_NAME   = 3;  // L4 任務名稱
// COL_L4_DESC     = 4   // 任務重點說明
// COL_L4_INPUT    = 5   // 任務重要輸入
const COL_L4_ROLE   = 6;  // 任務負責角色
// COL_L4_OUTPUT   = 7   // 任務產出成品
const COL_L4_FLOW   = 8;  // 任務關聯說明（BPMN Sequence Flow）
// COL_L4_REF      = 9   // 參考資料來源文件名稱

/**
 * Convert L3 number from `1-1-1` format to `1.1.1`.
 */
function normalizeL3Number(raw) {
  return String(raw ?? '').trim().replace(/-/g, '.');
}

/**
 * Parse 任務關聯說明 text into structured annotations.
 *
 * Supported keywords:
 *   流程開始           → isStart: true  (start event connects to this task)
 *   流程結束           → isEnd: true    (this task connects to end event)
 *   序列流向 X.X.X.X   → nextTaskNumbers (direct sequential connections)
 *   條件分支至 X, Y    → branchToNumbers (gateway: multiple outgoing conditions)
 *   條件合併來自多個分支 → isMerge: true  (informational only; no outgoing change)
 */
function parseFlowAnnotations(flowText) {
  const text = String(flowText ?? '');

  // Sequential targets: 序列流向 X.X.X.X (multiple matches allowed)
  const nextTaskNumbers = [...text.matchAll(/序列流向\s*([\d.]+)/g)]
    .map(m => m[1].trim());

  // Branch targets: 條件分支至 X.X.X.X[,、 Y.Y.Y.Y ...]
  let branchToNumbers = [];
  const branchMatch = text.match(/條件分支至\s*([\d.,、\s]+)/);
  if (branchMatch) {
    branchToNumbers = branchMatch[1]
      .split(/[,、\s]+/)
      .map(s => s.trim())
      .filter(s => /^[\d.]+$/.test(s));
  }

  return {
    isStart:        /流程開始/.test(text),
    isEnd:          /流程結束/.test(text),
    isMerge:        /條件合併/.test(text),
    nextTaskNumbers,
    branchToNumbers,
  };
}

/**
 * Build one flow object from a group of rows sharing the same L3.
 */
function buildFlow(rows) {
  const firstRow = rows[0];
  const l3Number = normalizeL3Number(firstRow[COL_L3_NUMBER]);
  const l3Name   = String(firstRow[COL_L3_NAME] ?? '').trim();

  // ── Roles: unique, in order of first appearance ───────────────────────────
  const roleNameToId = {};
  const roles = [];
  rows.forEach(row => {
    const name = String(row[COL_L4_ROLE] ?? '').trim();
    if (name && !roleNameToId[name]) {
      const id = generateId();
      roleNameToId[name] = id;
      roles.push({ id, name, type: 'internal' });
    }
  });
  if (roles.length === 0) {
    throw new Error(`L3「${l3Name}」：找不到任務負責角色資料（第 7 欄）`);
  }

  // ── First pass: create task stubs ─────────────────────────────────────────
  const taskByNumber = {};
  const taskList     = [];
  const annotationOf = {};

  rows.forEach(row => {
    const l4Num    = String(row[COL_L4_NUMBER] ?? '').trim();
    const l4Name   = String(row[COL_L4_NAME]   ?? '').trim();
    const roleName = String(row[COL_L4_ROLE]   ?? '').trim();
    const roleId   = roleNameToId[roleName] ?? roles[0].id;
    const flowText = String(row[COL_L4_FLOW]   ?? '');

    const ann = parseFlowAnnotations(flowText);
    const isGateway = ann.branchToNumbers.length > 0;

    const task = {
      id: generateId(),
      name: l4Name || l4Num,
      type: isGateway ? 'gateway' : 'task',
      roleId,
      ...(isGateway ? { conditions: [] } : { nextTaskIds: [] }),
    };

    taskByNumber[l4Num] = task;
    taskList.push(task);
    annotationOf[task.id] = ann;
  });

  // ── Second pass: resolve outgoing connections ──────────────────────────────
  taskList.forEach(task => {
    const ann = annotationOf[task.id];

    if (task.type === 'gateway') {
      // 條件分支至 → conditions
      const seen = new Set();
      const addCondition = (toId) => {
        if (!toId || seen.has(toId)) return;
        seen.add(toId);
        task.conditions.push({ id: generateId(), label: '', nextTaskId: toId });
      };
      ann.branchToNumbers.forEach(n => addCondition(taskByNumber[n]?.id));
      // Additional 序列流向 on a gateway row also become conditions
      ann.nextTaskNumbers.forEach(n => addCondition(taskByNumber[n]?.id));
    } else {
      task.nextTaskIds = ann.nextTaskNumbers
        .map(n => taskByNumber[n]?.id)
        .filter(Boolean);
    }
  });

  // ── Start event ───────────────────────────────────────────────────────────
  // Tasks explicitly marked 流程開始 are the start-event targets.
  // Fall back to the first task in the list if none are marked.
  const startTargets = taskList.filter(t => annotationOf[t.id].isStart);
  if (startTargets.length === 0 && taskList[0]) startTargets.push(taskList[0]);

  const startTask = {
    id: generateId(),
    name: '開始',
    type: 'start',
    roleId: startTargets[0]?.roleId ?? roles[0].id,
    nextTaskIds: startTargets.map(t => t.id),
  };

  // ── End event ─────────────────────────────────────────────────────────────
  const endTask = {
    id: generateId(),
    name: '結束',
    type: 'end',
    roleId: taskList[taskList.length - 1]?.roleId ?? roles[0].id,
    nextTaskIds: [],
  };

  // Connect to end: tasks marked 流程結束, or tasks with no outgoing connections
  taskList.forEach(task => {
    const ann = annotationOf[task.id];

    if (task.type === 'gateway') {
      if (ann.isEnd) {
        task.conditions.push({ id: generateId(), label: '', nextTaskId: endTask.id });
      }
      // Gateways with zero conditions and no isEnd also get an end connection
      if (task.conditions.length === 0) {
        task.conditions.push({ id: generateId(), label: '', nextTaskId: endTask.id });
      }
    } else {
      const hasOutgoing = task.nextTaskIds.length > 0;
      if (ann.isEnd || !hasOutgoing) {
        if (!task.nextTaskIds.includes(endTask.id)) {
          task.nextTaskIds.push(endTask.id);
        }
      }
    }
  });

  // ── Assemble ──────────────────────────────────────────────────────────────
  return {
    id: generateId(),
    l3Number,
    l3Name,
    roles,
    tasks: [startTask, ...taskList, endTask],
  };
}

/**
 * Parse an Excel ArrayBuffer and return an array of flow objects
 * (one per distinct L3 活動編號 found in the sheet).
 *
 * Rows where L3 活動編號 is blank inherit the value from the nearest
 * preceding row that had one, supporting the common spreadsheet convention
 * of only filling the first row of a merged-cell group.
 */
export function parseExcelToFlow(arrayBuffer) {
  const workbook  = XLSX.read(arrayBuffer, { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  const sheet     = workbook.Sheets[sheetName];
  const allRows   = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

  // Skip header row; keep only rows that have an L4 task number
  const dataRows = allRows.slice(1).filter(row =>
    String(row[COL_L4_NUMBER] ?? '').trim()
  );

  if (dataRows.length === 0) {
    throw new Error('找不到有效的 L4 任務資料（請確認欄位順序正確，且 Excel 首列為標題列）');
  }

  // ── Group rows by L3 number ───────────────────────────────────────────────
  // Carry forward L3 number + name when blank (merged-cell pattern).
  const groups = [];
  let currentKey  = '';
  let currentName = '';
  let currentGroup = [];

  dataRows.forEach(rawRow => {
    const row = [...rawRow]; // shallow copy so we can patch inherited cells
    const l3Raw = String(row[COL_L3_NUMBER] ?? '').trim();

    if (l3Raw) {
      // New L3 group
      if (l3Raw !== currentKey) {
        if (currentGroup.length > 0) groups.push(currentGroup);
        currentGroup = [];
        currentKey   = l3Raw;
        currentName  = String(row[COL_L3_NAME] ?? '').trim();
      }
    } else {
      // Inherit L3 info from current group
      row[COL_L3_NUMBER] = currentKey;
      row[COL_L3_NAME]   = currentName;
    }

    if (currentKey) currentGroup.push(row);
  });
  if (currentGroup.length > 0) groups.push(currentGroup);

  if (groups.length === 0) {
    throw new Error('無法識別 L3 活動編號（第 1 欄）');
  }

  return groups.map(buildFlow);
}

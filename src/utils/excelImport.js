import * as XLSX from 'xlsx';
import { generateId } from './storage.js';

// Column indices (0-based)
const COL_L3_NUMBER = 0;
const COL_L3_NAME   = 1;
const COL_L4_NUMBER = 2;
const COL_L4_NAME   = 3;
const COL_L4_ROLE   = 6;
const COL_L4_FLOW   = 8;

function normalizeL3Number(raw) {
  return String(raw ?? '').trim().replace(/\./g, '-');
}

function parseFlowAnnotations(flowText) {
  const text = String(flowText ?? '');

  const nextTaskNumbers = [
    ...[...text.matchAll(/序列流向\s*([\d.-]+)/g)].map(m => m[1].trim()),
    ...[...text.matchAll(/返回後序列流向\s*([\d.-]+)/g)].map(m => m[1].trim()),
  ].filter((v, i, a) => a.indexOf(v) === i);

  const branchToNumbers = [];
  const branchLabels    = [];
  const branchSection = text.match(/條件分支至\s*([^\n]+)/);
  if (branchSection) {
    branchSection[1].split(/[,、]/).forEach(entry => {
      const numM   = entry.trim().match(/^([\d.-]+)/);
      const lblM   = entry.match(/[（(]([^）)]+)[）)]/);
      if (numM) {
        branchToNumbers.push(numM[1]);
        branchLabels.push(lblM ? lblM[1].trim() : '');
      }
    });
  }

  let parallelToNumbers = [];
  const parallelForkM = text.match(/並行分支至\s*([\d.,、\s]+)/);
  if (parallelForkM) {
    parallelToNumbers = parallelForkM[1]
      .split(/[,、\s]+/).map(s => s.trim()).filter(s => /^[\d.-]+$/.test(s) && s !== '-');
  }

  let parallelMergeNextNums = [];
  const parallelMergeM = text.match(/並行合併來自[^，,\n]*[，,]\s*序列流向\s*([\d.-]+)/);
  if (parallelMergeM) parallelMergeNextNums = [parallelMergeM[1].trim()];

  let condMergeNextNums = [];
  const condMergeM = text.match(/條件合併來自多個分支[^，,\n]*[，,]\s*序列流向\s*([\d.-]+)/);
  if (condMergeM) condMergeNextNums = [condMergeM[1].trim()];

  const loopConditions = [];
  const loopM = text.match(/若未通過則返回\s*([\d.-]+)[^若]*若通過則序列流向\s*([\d.-]+)/);
  if (loopM) {
    loopConditions.push({ label: '若未通過', nextNum: loopM[1].trim() });
    loopConditions.push({ label: '若通過',   nextNum: loopM[2].trim() });
  }

  return {
    isStart:             /流程開始/.test(text),
    isEnd:               /流程結束/.test(text) || /【流程斷點/.test(text),
    nextTaskNumbers,
    branchToNumbers,
    branchLabels,
    parallelToNumbers,
    parallelMergeNextNums,
    condMergeNextNums,
    loopConditions,
  };
}

function detectGatewayType(ann) {
  if (ann.parallelToNumbers.length > 0 || ann.parallelMergeNextNums.length > 0) return 'and';
  if (ann.branchToNumbers.length > 0 || ann.loopConditions.length > 0 || ann.condMergeNextNums.length > 0) return 'xor';
  return null;
}

function buildFlow(rows) {
  const firstRow = rows[0];
  const l3Number = normalizeL3Number(firstRow[COL_L3_NUMBER]);
  const l3Name   = String(firstRow[COL_L3_NAME] ?? '').trim();

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
  if (roles.length === 0) throw new Error(`L3「${l3Name}」：找不到任務負責角色資料（第 7 欄）`);

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
    const gType = detectGatewayType(ann);
    const isGateway = gType !== null;

    const task = {
      id: generateId(),
      name: l4Name || l4Num,
      type: isGateway ? 'gateway' : 'task',
      roleId,
      ...(isGateway
        ? { gatewayType: gType, conditions: [] }
        : { nextTaskIds: [] }),
      l4Number:       l4Num,
      description:    String(row[4] ?? '').trim(),
      inputItems:     String(row[5] ?? '').trim(),
      outputItems:    String(row[7] ?? '').trim(),
      reference:      String(row[9] ?? '').trim(),
      flowAnnotation: flowText,
    };

    taskByNumber[l4Num] = task;
    taskList.push(task);
    annotationOf[task.id] = ann;
  });

  taskList.forEach(task => {
    const ann = annotationOf[task.id];

    if (task.type === 'gateway') {
      const seen = new Set();
      const addCond = (toId, label = '') => {
        if (!toId || seen.has(toId)) return;
        seen.add(toId);
        task.conditions.push({ id: generateId(), label, nextTaskId: toId });
      };

      if (task.gatewayType === 'and') {
        ann.parallelToNumbers.forEach(n => addCond(taskByNumber[n]?.id));
        ann.parallelMergeNextNums.forEach(n => addCond(taskByNumber[n]?.id));
      } else {
        ann.branchToNumbers.forEach((n, i) => addCond(taskByNumber[n]?.id, ann.branchLabels[i] || ''));
        ann.loopConditions.forEach(lc => addCond(taskByNumber[lc.nextNum]?.id, lc.label));
        ann.condMergeNextNums.forEach(n => addCond(taskByNumber[n]?.id));
      }
      ann.nextTaskNumbers.forEach(n => addCond(taskByNumber[n]?.id));

    } else {
      task.nextTaskIds = ann.nextTaskNumbers.map(n => taskByNumber[n]?.id).filter(Boolean);
    }
  });

  const startTargets = taskList.filter(t => annotationOf[t.id].isStart);
  if (startTargets.length === 0 && taskList[0]) startTargets.push(taskList[0]);

  const startTask = {
    id: generateId(), name: '開始', type: 'start',
    roleId: startTargets[0]?.roleId ?? roles[0].id,
    nextTaskIds: startTargets.map(t => t.id),
  };

  const endTask = {
    id: generateId(), name: '結束', type: 'end',
    roleId: taskList[taskList.length - 1]?.roleId ?? roles[0].id,
    nextTaskIds: [],
  };

  taskList.forEach(task => {
    const ann = annotationOf[task.id];
    if (task.type === 'gateway') {
      if (ann.isEnd) task.conditions.push({ id: generateId(), label: '', nextTaskId: endTask.id });
      if (task.conditions.length === 0) task.conditions.push({ id: generateId(), label: '', nextTaskId: endTask.id });
    } else {
      if (ann.isEnd || task.nextTaskIds.length === 0) {
        if (!task.nextTaskIds.includes(endTask.id)) task.nextTaskIds.push(endTask.id);
      }
    }
  });

  return {
    id: generateId(), l3Number, l3Name, roles,
    tasks: [startTask, ...taskList, endTask],
  };
}

export function parseExcelToFlow(arrayBuffer) {
  const workbook  = XLSX.read(arrayBuffer, { type: 'array' });
  const sheet     = workbook.Sheets[workbook.SheetNames[0]];
  const allRows   = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

  const dataRows = allRows.slice(1).filter(row => String(row[COL_L4_NUMBER] ?? '').trim());
  if (dataRows.length === 0) throw new Error('找不到有效的 L4 任務資料（請確認欄位順序正確，且 Excel 首列為標題列）');

  const groups = [];
  let currentKey = '', currentName = '', currentGroup = [];

  dataRows.forEach(rawRow => {
    const row   = [...rawRow];
    const l3Raw = String(row[COL_L3_NUMBER] ?? '').trim();
    if (l3Raw) {
      if (l3Raw !== currentKey) {
        if (currentGroup.length > 0) groups.push(currentGroup);
        currentGroup = [];
        currentKey   = l3Raw;
        currentName  = String(row[COL_L3_NAME] ?? '').trim();
      }
    } else {
      row[COL_L3_NUMBER] = currentKey;
      row[COL_L3_NAME]   = currentName;
    }
    if (currentKey) currentGroup.push(row);
  });
  if (currentGroup.length > 0) groups.push(currentGroup);
  if (groups.length === 0) throw new Error('無法識別 L3 活動編號（第 1 欄）');

  return groups.map(buildFlow);
}

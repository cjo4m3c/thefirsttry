import * as XLSX from 'xlsx';
import { generateId } from './storage.js';
import {
  L3_NUMBER_PATTERN, L4_NUMBER_PATTERN,
  L4_START_PATTERN, L4_END_PATTERN, L4_GATEWAY_PATTERN,
} from './taskDefs.js';

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

/**
 * Parse 任務關聯說明 text into structured routing annotations.
 *
 * Supported keywords:
 *   流程開始，序列流向 X          → isStart, nextTaskNumbers
 *   流程結束                       → isEnd
 *   【流程斷點：...】               → isEnd (breakpoint)
 *   序列流向 X                     → nextTaskNumbers
 *   條件分支至 X（條件A）、Y（條件B）→ branchToNumbers / branchLabels  [XOR gateway]
 *   並行分支至 X、Y、Z             → parallelToNumbers                 [AND gateway]
 *   並行合併來自 X、Y，序列流向 Z  → parallelMergeNextNums             [AND join]
 *   條件合併來自多個分支，序列流向 Z→ condMergeNextNums                [XOR/OR join]
 *   條件判斷：若未通過則返回 X，若通過則序列流向 Y → loopConditions    [XOR loop]
 *   調用子流程 A，返回後序列流向 X → nextTaskNumbers (return leg only) [treated as task]
 */
function parseFlowAnnotations(flowText) {
  const text = String(flowText ?? '');

  // ── 序列流向 (also covers 返回後序列流向) ─────────────────────────────
  const nextTaskNumbers = [
    ...[...text.matchAll(/序列流向\s*([\d.-]+(?:_g\d*)?)/g)].map(m => m[1].trim()),
    ...[...text.matchAll(/返回後序列流向\s*([\d.-]+(?:_g\d*)?)/g)].map(m => m[1].trim()),
  ].filter((v, i, a) => a.indexOf(v) === i); // deduplicate

  // ── 條件分支至 X（條件A）、Y（條件B） ────────────────────────
  const branchToNumbers = [];
  const branchLabels    = [];
  const branchSection = text.match(/條件分支至\s*([^\n]+)/);
  if (branchSection) {
    branchSection[1].split(/[,、]/).forEach(entry => {
      const numM   = entry.trim().match(/^([\d.-]+(?:_g\d*)?)/);
      const lblM   = entry.match(/[（(]([^）)]+)[）)]/);
      if (numM) {
        branchToNumbers.push(numM[1]);
        branchLabels.push(lblM ? lblM[1].trim() : '');
      }
    });
  }

  // ── 並行分支至 X、Y、Z ─────────────────────────────────────
  let parallelToNumbers = [];
  const parallelForkM = text.match(/並行分支至\s*([\d.,、\s_g]+)/);
  if (parallelForkM) {
    parallelToNumbers = parallelForkM[1]
      .split(/[,、\s]+/).map(s => s.trim()).filter(s => /^[\d.-]+(?:_g\d*)?$/.test(s) && s !== '-');
  }

  // ── 並行合併來自 ...，序列流向 Z ───────────────────────────
  let parallelMergeNextNums = [];
  const parallelMergeM = text.match(/並行合併來自[^，,\n]*[，,]\s*序列流向\s*([\d.-]+(?:_g\d*)?)/);
  if (parallelMergeM) parallelMergeNextNums = [parallelMergeM[1].trim()];

  // ── 條件合併來自多個分支，序列流向 Z ─────────────────────────
  let condMergeNextNums = [];
  const condMergeM = text.match(/條件合併來自多個分支[^，,\n]*[，,]\s*序列流向\s*([\d.-]+(?:_g\d*)?)/);
  if (condMergeM) condMergeNextNums = [condMergeM[1].trim()];

  // ── 條件判斷：若未通過則返回 X，若通過則序列流向 Y ─────────────
  const loopConditions = [];
  const loopM = text.match(/若未通過則返回\s*([\d.-]+(?:_g\d*)?)[^若]*若通過則序列流向\s*([\d.-]+(?:_g\d*)?)/);
  if (loopM) {
    loopConditions.push({ label: '若未通過', nextNum: loopM[1].trim() });
    loopConditions.push({ label: '若通過',   nextNum: loopM[2].trim() });
  }

  return {
    isStart:             /流程開始/.test(text),
    isEnd:               /流程結束/.test(text) || /【流程斷點/.test(text),
    nextTaskNumbers,
    branchToNumbers,    // XOR gateway fork targets
    branchLabels,       // XOR condition labels (parallel array)
    parallelToNumbers,  // AND gateway fork targets
    parallelMergeNextNums, // AND join: outgoing target
    condMergeNextNums,  // XOR/OR join: outgoing target
    loopConditions,     // XOR loop conditions [{label, nextNum}]
  };
}

/** Determine gateway type from annotation. Returns null if not a gateway. */
function detectGatewayType(ann) {
  if (ann.parallelToNumbers.length > 0 || ann.parallelMergeNextNums.length > 0) return 'and';
  if (ann.branchToNumbers.length > 0 || ann.loopConditions.length > 0 || ann.condMergeNextNums.length > 0) return 'xor';
  return null;
}

function buildFlow(rows) {
  const firstRow = rows[0];
  const l3Number = normalizeL3Number(firstRow[COL_L3_NUMBER]);
  const l3Name   = String(firstRow[COL_L3_NAME] ?? '').trim();

  // ── Roles ───────────────────────────────────────────────────
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

  // ── First pass: stubs ──────────────────────────────────────
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
    const isStartEvent = /開始事件/.test(l4Name);
    const isEndEvent   = /結束事件/.test(l4Name);

    let taskType;
    if (isStartEvent)      taskType = 'start';
    else if (isEndEvent)   taskType = 'end';
    else if (isGateway)    taskType = 'gateway';
    else                   taskType = 'task';

    const task = {
      id: generateId(),
      name: l4Name || l4Num,
      type: taskType,
      roleId,
      ...(taskType === 'gateway'
        ? { gatewayType: gType, conditions: [] }
        : { nextTaskIds: [] }),
      ...(taskType === 'start' ? { connectionType: 'start' } : {}),
      ...(taskType === 'end'   ? { connectionType: 'end'   } : {}),
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

  // ── Second pass: resolve outgoing connections ────────────────────────────
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

    } else if (task.type !== 'end') {
      task.nextTaskIds = ann.nextTaskNumbers.map(n => taskByNumber[n]?.id).filter(Boolean);
    }
  });

  // ── Start / End event handling ─────────────────────────────────────
  // If the Excel has rows explicitly marked "開始事件"/"結束事件", use them as the
  // start/end node directly. Otherwise fall back to auto-creating synthetic nodes.
  const explicitStart = taskList.find(t => t.type === 'start');
  const explicitEnd   = taskList.find(t => t.type === 'end');

  let syntheticStart = null;
  if (!explicitStart) {
    const startTargets = taskList.filter(t => annotationOf[t.id].isStart);
    if (startTargets.length === 0 && taskList[0]) startTargets.push(taskList[0]);
    syntheticStart = {
      id: generateId(), name: '開始', type: 'start', connectionType: 'start',
      roleId: startTargets[0]?.roleId ?? roles[0].id,
      nextTaskIds: startTargets.map(t => t.id),
    };
  }

  let syntheticEnd = null;
  if (!explicitEnd) {
    syntheticEnd = {
      id: generateId(), name: '結束', type: 'end', connectionType: 'end',
      roleId: taskList[taskList.length - 1]?.roleId ?? roles[0].id,
      nextTaskIds: [],
    };
  }

  // Connect dangling tasks: only add edges to synthetic end if it exists
  const endFallbackId = syntheticEnd?.id ?? explicitEnd?.id ?? null;
  if (endFallbackId) {
    taskList.forEach(task => {
      if (task.id === endFallbackId) return;
      const ann = annotationOf[task.id];
      if (task.type === 'gateway') {
        if (ann.isEnd) task.conditions.push({ id: generateId(), label: '', nextTaskId: endFallbackId });
        if (task.conditions.length === 0) task.conditions.push({ id: generateId(), label: '', nextTaskId: endFallbackId });
      } else if (task.type !== 'end' && task.type !== 'start') {
        if (ann.isEnd || task.nextTaskIds.length === 0) {
          if (!task.nextTaskIds.includes(endFallbackId)) task.nextTaskIds.push(endFallbackId);
        }
      }
    });
  }

  const finalTasks = [];
  if (syntheticStart) finalTasks.push(syntheticStart);
  finalTasks.push(...taskList);
  if (syntheticEnd) finalTasks.push(syntheticEnd);

  return {
    id: generateId(), l3Number, l3Name, roles,
    tasks: finalTasks,
  };
}

/** Detect gateway type from flow annotation keywords. Returns 'xor' | 'and' | null. */
function detectGatewayFromText(flowText) {
  if (/並行分支至/.test(flowText) || /並行合併來自/.test(flowText)) return 'and';
  if (/條件分支至/.test(flowText)
   || /若未通過則返回[\s\S]*若通過則序列流向/.test(flowText)
   || /條件合併來自多個分支/.test(flowText)) return 'xor';
  return null;
}

/**
 * Validate L3 / L4 number formats. Throws a detailed multi-line error if any
 * row has a malformed number. Patterns come from taskDefs.js so the spec
 * stays single-sourced.
 *
 * Checks:
 *   - L3 / L4 base format (dash only)
 *   - 開始事件 → suffix must be -0
 *   - 結束事件 → suffix must be -99
 *   - 閘道 (XOR / AND / OR) → must have _g / _g1 / _g2 / ... suffix
 *   - Gateway prefix (d-d-d-d without _g*) must match an existing L4 task
 */
function validateNumbering(allRows) {
  const errors = [];

  // First pass: collect base L4 task numbers (no _g variant) for prefix lookup
  const l4TaskSet = new Set();
  for (let i = 1; i < allRows.length; i++) {
    const l4 = String(allRows[i][COL_L4_NUMBER] ?? '').trim();
    if (l4 && !/_g\d*$/.test(l4)) l4TaskSet.add(l4);
  }

  // Second pass: validate each row
  for (let i = 1; i < allRows.length; i++) {
    const row = allRows[i];
    const l4 = String(row[COL_L4_NUMBER] ?? '').trim();
    if (!l4) continue; // skip empty rows (filtered out later anyway)
    const l3       = String(row[COL_L3_NUMBER] ?? '').trim();
    const l4Name   = String(row[COL_L4_NAME]   ?? '').trim();
    const flowText = String(row[COL_L4_FLOW]   ?? '');
    const excelRow = i + 1; // 1-indexed

    if (l3 && !L3_NUMBER_PATTERN.test(l3)) {
      errors.push(`• 第 ${excelRow} 列 L3 編號「${l3}」格式錯誤（應為 1-1-1，僅接受「-」分隔）`);
    }
    if (!L4_NUMBER_PATTERN.test(l4)) {
      errors.push(`• 第 ${excelRow} 列 L4 編號「${l4}」格式錯誤（僅接受「-」分隔；閘道為 1-1-1-1_g 或 _g1/_g2…）`);
      continue; // suffix checks meaningless if base is wrong
    }

    const isStart     = /開始事件/.test(l4Name);
    const isEnd       = /結束事件/.test(l4Name);
    const gatewayType = detectGatewayFromText(flowText); // 'xor' | 'and' | null
    const hasGTag     = /_g\d*$/.test(l4);

    if (isStart && !L4_START_PATTERN.test(l4)) {
      errors.push(`• 第 ${excelRow} 列為「開始事件」，L4 編號「${l4}」尾碼應為 0（範例:1-1-7-0）`);
    }
    if (isEnd && !L4_END_PATTERN.test(l4)) {
      errors.push(`• 第 ${excelRow} 列為「結束事件」，L4 編號「${l4}」尾碼應為 99（範例:1-1-7-99）`);
    }
    if (gatewayType && !L4_GATEWAY_PATTERN.test(l4)) {
      const label = gatewayType === 'and' ? 'AND（並行）' : 'XOR（排他）';
      errors.push(`• 第 ${excelRow} 列為閘道 ${label}，L4 編號「${l4}」應加「_g」後綴（單一 _g；連續多個用 _g1/_g2/_g3… 範例:1-1-9-5_g 或 1-1-9-5_g1）`);
    }
    // Gateway prefix-must-match-task: 1-1-9-5_g / _g1 / _g2… 的前綴 1-1-9-5 必為 L4 任務
    if (hasGTag) {
      const baseNum = l4.replace(/_g\d*$/, '');
      if (!l4TaskSet.has(baseNum)) {
        errors.push(`• 第 ${excelRow} 列「閘道」 ${l4}：找不到前置任務 ${baseNum}（閘道編號前綴必為對應 L4 任務）`);
      }
    }
  }
  if (errors.length === 0) return;

  const show = errors.slice(0, 15).join('\n');
  const more = errors.length > 15 ? `\n… 另有 ${errors.length - 15} 筆未顯示` : '';
  throw new Error(
    `Excel 編號格式檢核未通過（共 ${errors.length} 筆），請修正檔案後再上傳：\n\n${show}${more}\n\n` +
    `編號規則（僅接受「-」分隔，不接受「.」分隔）：\n` +
    `  • L3：1-1-1（三段）\n` +
    `  • L4：1-1-1-1（四段）\n` +
    `  • 開始事件：尾碼為 0，例如 1-1-7-0\n` +
    `  • 結束事件：尾碼為 99，例如 1-1-7-99\n` +
    `  • 閘道（XOR / AND / OR）：加「_g」後綴，例如 1-1-9-5_g；連續多個用 1-1-9-5_g1、1-1-9-5_g2、1-1-9-5_g3…\n` +
    `    閘道編號前綴必為對應 L4 任務（例：1-1-9-5_g 前面必有 1-1-9-5）`
  );
}

export function parseExcelToFlow(arrayBuffer) {
  const workbook  = XLSX.read(arrayBuffer, { type: 'array' });
  const sheet     = workbook.Sheets[workbook.SheetNames[0]];
  const allRows   = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

  // Validate L3 / L4 number formats BEFORE any processing
  validateNumbering(allRows);

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

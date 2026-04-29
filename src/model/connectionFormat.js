/**
 * Connection-format model layer (PR-5).
 *
 * Single source of truth for converting between a task's connection
 * structure and its Chinese annotation string ("任務關聯說明" /
 * BPMN Sequence Flow text). Both Excel export and Excel import flow
 * through this module so a wording change is one edit.
 *
 * Forward (formatConnection)  : task + allTasks + l4Map → annotation string
 * Reverse (parseConnection)   : annotation string       → structured fields
 *
 * Pure functions only — no React, no I/O, no view-layer imports.
 *
 * Whitelist note: HelpPanel.jsx (rule docs) and Dashboard.jsx (landing
 * hint card) keep their hard-coded sample strings for readability.
 * `/sync-views` skill enforces this via grep guard.
 */
import { getTaskIncoming } from './flowSelectors.js';

// ── PHRASE: every Chinese fragment used by forward AND reverse ─────────────
// Changing any value here updates both directions automatically; the regexes
// below are built from these constants.
export const PHRASE = {
  SEQUENCE_FLOW:   '序列流向',
  RETURN_FLOW:     '返回後序列流向',
  XOR_FORK:        '條件分支至',
  AND_FORK:        '並行分支至',
  OR_FORK:         '包容分支至',
  OR_FORK_LEGACY:  '可能分支至',     // accepted on import, never produced on export
  XOR_MERGE:       '條件合併來自多個分支',
  AND_MERGE_PFX:   '並行合併來自',
  OR_MERGE_PFX:    '包容合併來自',
  LOOP_RETURN:     '迴圈返回',
  SUBPROCESS_CALL: '調用子流程',
  FLOW_START:      '流程開始',
  FLOW_END:        '流程結束',
  BREAKPOINT_OPEN: '【流程斷點',
};

// ────────────────────────────────────────────────────────────────────────────
// Forward: formatConnection (formerly excelExport.js::generateFlowAnnotation)
// ────────────────────────────────────────────────────────────────────────────

/**
 * Build the human-readable annotation for a task's outgoing connections.
 * Pure function — same inputs always yield the same string.
 *
 * @param {object} task    The task to format
 * @param {object[]} tasks All tasks in the flow (for incoming-count lookups)
 * @param {Record<string,string>} l4Map  Task id → L4 number string
 * @returns {string} annotation text (empty string if no outgoing)
 */
export function formatConnection(task, tasks, l4Map) {
  const taskById = {};
  tasks.forEach(t => { taskById[t.id] = t; });

  const incomingCount = getTaskIncoming(tasks);

  const ct = task.connectionType;

  if (ct === 'breakpoint' || task.type === 'end') {
    if (ct === 'breakpoint') {
      const reason = task.breakpointReason?.trim();
      return reason ? `【流程斷點：${reason}】` : '【流程斷點】';
    }
    return PHRASE.FLOW_END;
  }

  if (ct === 'subprocess') {
    const subName = task.subprocessName?.trim() || '子流程';
    const nextId = (task.nextTaskIds || []).find(id => taskById[id]);
    const nextNum = nextId ? l4Map[nextId] : '';
    return nextNum
      ? `${PHRASE.SUBPROCESS_CALL} ${subName}，${PHRASE.RETURN_FLOW} ${nextNum}`
      : `${PHRASE.SUBPROCESS_CALL} ${subName}`;
  }

  if (ct === 'loop-return') {
    const backId = task.nextTaskIds?.[0];
    const backNum = backId && taskById[backId] ? l4Map[backId] : '';
    const desc = task.loopDescription?.trim();
    const base = backNum
      ? `${PHRASE.LOOP_RETURN}，${PHRASE.SEQUENCE_FLOW} ${backNum}`
      : PHRASE.LOOP_RETURN;
    return desc ? `${base}（${desc}）` : base;
  }

  if (task.type === 'end') return PHRASE.FLOW_END;

  if (ct === 'start' || task.type === 'start') {
    const nexts = (task.nextTaskIds || [])
      .filter(id => taskById[id])
      .map(id => l4Map[id]).filter(Boolean);
    return nexts.length
      ? `${PHRASE.FLOW_START}，${PHRASE.SEQUENCE_FLOW} ${nexts.join('、')}`
      : PHRASE.FLOW_START;
  }

  if (task.type === 'gateway') {
    const conds = task.conditions || [];
    const isMergeNode = (incomingCount[task.id] || 0) > 1 && conds.length <= 1;
    const gType = task.gatewayType || 'xor';

    const outNums = conds.map(c => {
      if (!c.nextTaskId || !taskById[c.nextTaskId]) return null;
      return l4Map[c.nextTaskId] || null;
    }).filter(Boolean);

    const outParts = conds.map(c => {
      if (!c.nextTaskId || !taskById[c.nextTaskId]) return null;
      if (taskById[c.nextTaskId].type === 'end') {
        return c.label ? `${PHRASE.FLOW_END}（${c.label}）` : PHRASE.FLOW_END;
      }
      const num = l4Map[c.nextTaskId];
      if (!num) return null;
      return c.label ? `${num}（${c.label}）` : num;
    }).filter(Boolean);

    if (gType === 'and') {
      if (isMergeNode && outNums.length === 1) {
        return `並行合併來自多個分支，${PHRASE.SEQUENCE_FLOW} ${outNums[0]}`;
      }
      return outParts.length ? `${PHRASE.AND_FORK} ${outParts.join('、')}` : '';
    }

    if (gType === 'or') {
      if (isMergeNode && outNums.length === 1) {
        return `包容合併來自多個分支，${PHRASE.SEQUENCE_FLOW} ${outNums[0]}`;
      }
      return outParts.length ? `${PHRASE.OR_FORK} ${outParts.join('、')}` : '';
    }

    // XOR
    if (isMergeNode && outParts.length === 1) {
      return `${PHRASE.XOR_MERGE}，${PHRASE.SEQUENCE_FLOW} ${outParts[0]}`;
    }
    return outParts.length ? `${PHRASE.XOR_FORK} ${outParts.join('、')}` : '';
  }

  // Regular task / interaction / l3activity
  const nexts = (task.nextTaskIds || []).filter(id => taskById[id]);
  if (nexts.length === 0) return '';

  const toOther = nexts.filter(id =>
    taskById[id].type !== 'end'
    && taskById[id].connectionType !== 'end'
    && taskById[id].connectionType !== 'breakpoint'
  );
  if (toOther.length === 0) return PHRASE.FLOW_END;

  if (nexts.length === 1) {
    const num = l4Map[nexts[0]];
    return num ? `${PHRASE.SEQUENCE_FLOW} ${num}` : '';
  }

  // Multiple outgoing (parallel without explicit gateway)
  const parts = nexts.map(id => {
    if (taskById[id].type === 'end') return PHRASE.FLOW_END;
    return l4Map[id];
  }).filter(Boolean);
  return parts.length ? `${PHRASE.AND_FORK} ${parts.join('、')}` : '';
}

// ────────────────────────────────────────────────────────────────────────────
// Reverse: parseConnection (formerly excelImport.js::parseFlowAnnotations)
// ────────────────────────────────────────────────────────────────────────────

// Number-fragment matcher: digits/dots/dashes, optional `_g` or `_g\d` suffix
const NUM = '([\\d.-]+(?:_g\\d*)?)';

const RE_SEQUENCE       = new RegExp(`${PHRASE.SEQUENCE_FLOW}\\s*${NUM}`, 'g');
const RE_RETURN         = new RegExp(`${PHRASE.RETURN_FLOW}\\s*${NUM}`, 'g');
const RE_XOR_FORK       = new RegExp(`${PHRASE.XOR_FORK}\\s*([^\\n]+)`);
const RE_AND_FORK       = new RegExp(`${PHRASE.AND_FORK}\\s*([^\\n]+)`);
// OR fork tolerates two verbs: 包容分支至 (spec) and 可能分支至 (legacy import)
const RE_OR_FORK        = new RegExp(`(?:包容|可能)分支至\\s*([^\\n]+)`);
const RE_AND_MERGE      = new RegExp(`${PHRASE.AND_MERGE_PFX}[^，,\\n]*[，,]\\s*${PHRASE.SEQUENCE_FLOW}\\s*${NUM}`);
const RE_XOR_MERGE      = new RegExp(`${PHRASE.XOR_MERGE}[^，,\\n]*[，,]\\s*${PHRASE.SEQUENCE_FLOW}\\s*${NUM}`);
const RE_OR_MERGE       = new RegExp(`${PHRASE.OR_MERGE_PFX}[^，,\\n]*[，,]\\s*${PHRASE.SEQUENCE_FLOW}\\s*${NUM}`);
const RE_SUBPROCESS     = new RegExp(`${PHRASE.SUBPROCESS_CALL}\\s*(\\d+-\\d+-\\d+)`);
// 迴圈返回，序列流向 X / 迴圈返回至 X / 迴圈返回：X / 迴圈返回 X
const RE_LOOP_BACK      = new RegExp(`${PHRASE.LOOP_RETURN}(?:[，,]\\s*${PHRASE.SEQUENCE_FLOW}|至|：|:)?[\\s\\u3000]*${NUM}`, 'g');
const RE_LOOP_LEGACY    = /若未通過則返回\s*([\d.-]+(?:_g\d*)?)[^若]*若通過則序列流向\s*([\d.-]+(?:_g\d*)?)/;

const NUM_HEAD = /^([\d.-]+(?:_g\d*)?)/;
const LABEL_PAREN = /[（(]([^）)]+)[）)]/;

function splitForkEntries(section) {
  const numbers = [];
  const labels  = [];
  section.split(/[,、]/).forEach(entry => {
    const numM = entry.trim().match(NUM_HEAD);
    const lblM = entry.match(LABEL_PAREN);
    if (numM) {
      numbers.push(numM[1]);
      labels.push(lblM ? lblM[1].trim() : '');
    }
  });
  return { numbers, labels };
}

/**
 * Parse 任務關聯說明 text into structured routing annotations.
 *
 * Supported keywords (mirrors PHRASE):
 *   流程開始，序列流向 X          → isStart, nextTaskNumbers
 *   流程結束                       → isEnd
 *   【流程斷點：…】                → isEnd
 *   序列流向 X                     → nextTaskNumbers
 *   條件分支至 X（A）、Y（B）       → branchToNumbers / branchLabels   [XOR]
 *   並行分支至 X、Y                → parallelToNumbers                 [AND]
 *   包容/可能分支至 X（A）、Y（B）  → inclusiveToNumbers / labels      [OR]
 *   條件合併來自多個分支，序列流向 Z→ condMergeNextNums                 [XOR join]
 *   並行合併來自 …，序列流向 Z      → parallelMergeNextNums             [AND join]
 *   包容合併來自 …，序列流向 Z      → inclusiveMergeNextNums            [OR join]
 *   迴圈返回 / 迴圈返回至 X         → loopBackNumbers
 *   若未通過則返回 X，若通過則序列流向 Y → loopConditions (legacy)
 *   調用子流程 5-3-2，返回後序列流向 X → subprocessL3 + nextTaskNumbers
 *
 * 迴圈返回 is NOT a gateway; it's a back-edge on a regular task.
 */
export function parseConnection(flowText) {
  const text = String(flowText ?? '');

  // 序列流向 + 返回後序列流向 (deduplicated)
  const nextTaskNumbers = [
    ...[...text.matchAll(RE_SEQUENCE)].map(m => m[1].trim()),
    ...[...text.matchAll(RE_RETURN)].map(m => m[1].trim()),
  ].filter((v, i, a) => a.indexOf(v) === i);

  // XOR / AND / OR fork sections
  const xorM = text.match(RE_XOR_FORK);
  const xor  = xorM ? splitForkEntries(xorM[1]) : { numbers: [], labels: [] };

  const andM = text.match(RE_AND_FORK);
  const and  = andM ? splitForkEntries(andM[1]) : { numbers: [], labels: [] };

  const orM  = text.match(RE_OR_FORK);
  const or   = orM ? splitForkEntries(orM[1]) : { numbers: [], labels: [] };

  // Merge forms (single outgoing target)
  const andMergeM = text.match(RE_AND_MERGE);
  const xorMergeM = text.match(RE_XOR_MERGE);
  const orMergeM  = text.match(RE_OR_MERGE);

  // Subprocess
  const subM = text.match(RE_SUBPROCESS);

  // Loop back (new simple syntax)
  const loopBackNumbers = [...text.matchAll(RE_LOOP_BACK)]
    .map(m => m[1].trim())
    .filter((v, i, a) => a.indexOf(v) === i);

  // Loop conditions (legacy two-leg syntax)
  const loopConditions = [];
  const loopM = text.match(RE_LOOP_LEGACY);
  if (loopM) {
    loopConditions.push({ label: '若未通過', nextNum: loopM[1].trim() });
    loopConditions.push({ label: '若通過',   nextNum: loopM[2].trim() });
  }

  return {
    isStart:                new RegExp(PHRASE.FLOW_START).test(text),
    isEnd:                  new RegExp(PHRASE.FLOW_END).test(text)
                              || new RegExp(PHRASE.BREAKPOINT_OPEN).test(text),
    nextTaskNumbers,
    branchToNumbers:        xor.numbers,
    branchLabels:           xor.labels,
    parallelToNumbers:      and.numbers,
    parallelLabels:         and.labels,
    inclusiveToNumbers:     or.numbers,
    inclusiveLabels:        or.labels,
    parallelMergeNextNums:  andMergeM ? [andMergeM[1].trim()] : [],
    condMergeNextNums:      xorMergeM ? [xorMergeM[1].trim()] : [],
    inclusiveMergeNextNums: orMergeM  ? [orMergeM[1].trim()]  : [],
    loopBackNumbers,
    loopConditions,
    subprocessL3:           subM ? subM[1] : '',
  };
}

/**
 * Detect gateway type from raw flow-text. Used by validation when we don't
 * have a parsed structure yet (Excel import L4 number checks).
 *
 * Returns 'xor' | 'and' | 'or' | null. ONLY fork patterns make a row an
 * independent gateway element — merges describe an incoming-side annotation
 * on a regular task and don't qualify here.
 */
export function detectGatewayFromText(flowText) {
  const text = String(flowText ?? '');
  if (new RegExp(PHRASE.AND_FORK).test(text))                            return 'and';
  if (new RegExp(`(?:包容|可能)分支至`).test(text))                       return 'or';
  if (new RegExp(PHRASE.XOR_FORK).test(text))                            return 'xor';
  return null;
}

import * as XLSX from 'xlsx';
import { generateId } from './storage.js';
import {
  L3_NUMBER_PATTERN, L4_NUMBER_PATTERN,
  L4_START_PATTERN, L4_END_PATTERN,
  L4_GATEWAY_PATTERN, L4_SUBPROCESS_PATTERN, L4_INTERACTION_PATTERN,
  computeDisplayLabels,
} from './taskDefs.js';
import {
  parseConnection,
  detectGatewayFromText,
} from '../model/connectionFormat.js';
import { validateFlow } from '../model/validation.js';
import { getTaskIncoming } from '../model/flowSelectors.js';

// Backward-compat alias — use parseConnection in new code.
export const parseFlowAnnotations = parseConnection;

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
 * Determine gateway type from a parsed annotation. Returns null when the row
 * is not an independent gateway element — only fork patterns qualify (see
 * `detectGatewayFromText` in `src/model/connectionFormat.js` for the
 * phrase-level rule). Merges and loop-returns are regular tasks.
 */
function detectGatewayType(ann) {
  if (ann.parallelToNumbers.length > 0)  return 'and';
  if (ann.inclusiveToNumbers.length > 0) return 'or';
  if (ann.branchToNumbers.length > 0)    return 'xor';
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

    const isSubprocess = Boolean(ann.subprocessL3);
    // 2026-04-30: `_w` suffix → external interaction (shapeType only;
    // type stays 'task'). Per user spec, internal-lane interaction is
    // ALLOWED (validation 3e warns at save time, doesn't block import).
    const isInteraction = /_w\d*$/.test(l4Num);

    let taskType;
    if (isStartEvent)       taskType = 'start';
    else if (isEndEvent)    taskType = 'end';
    else if (isGateway)     taskType = 'gateway';
    else if (isSubprocess)  taskType = 'l3activity';  // 調用子流程 → render as bookend rectangle
    else                    taskType = 'task';

    const task = {
      id: generateId(),
      name: l4Name || l4Num,
      type: taskType,
      roleId,
      ...(isInteraction && taskType === 'task' ? { shapeType: 'interaction' } : {}),
      ...(taskType === 'gateway'
        ? { gatewayType: gType, conditions: [] }
        : { nextTaskIds: [] }),
      ...(taskType === 'start' ? { connectionType: 'start' } : {}),
      ...(taskType === 'end'   ? { connectionType: 'end'   } : {}),
      ...(isSubprocess ? { connectionType: 'subprocess', subprocessName: ann.subprocessL3 } : {}),
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
        ann.parallelToNumbers.forEach((n, i) => addCond(taskByNumber[n]?.id, ann.parallelLabels[i] || ''));
        ann.parallelMergeNextNums.forEach(n => addCond(taskByNumber[n]?.id));
      } else if (task.gatewayType === 'or') {
        ann.inclusiveToNumbers.forEach((n, i) => addCond(taskByNumber[n]?.id, ann.inclusiveLabels[i] || ''));
        ann.inclusiveMergeNextNums.forEach(n => addCond(taskByNumber[n]?.id));
      } else {
        ann.branchToNumbers.forEach((n, i) => addCond(taskByNumber[n]?.id, ann.branchLabels[i] || ''));
        ann.condMergeNextNums.forEach(n => addCond(taskByNumber[n]?.id));
      }
      ann.nextTaskNumbers.forEach(n => addCond(taskByNumber[n]?.id));

    } else if (task.type !== 'end') {
      // Regular task: merge sequential + loop-back targets into nextTaskIds.
      //   loopConditions yields [backTarget, forwardTarget] (legacy)
      //   loopBackNumbers yields [backTarget] (new simple syntax)
      const loopNums = [
        ...ann.loopConditions.map(lc => lc.nextNum),
        ...ann.loopBackNumbers,
      ];
      const combined = [...ann.nextTaskNumbers, ...loopNums]
        .filter((v, i, a) => a.indexOf(v) === i);
      task.nextTaskIds = combined.map(n => taskByNumber[n]?.id).filter(Boolean);
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
 *   - 子流程調用 (調用子流程 X-Y-Z) → must have _s / _s1 / _s2 / ... suffix
 *   - _g / _s prefix (d-d-d-d without suffix) must match an existing L4 task
 *     (or `-0` start event when the gateway / subprocess is the first element)
 */
function validateNumbering(allRows) {
  const errors = [];

  // First pass: collect base L4 task numbers (no _g / _s variant) for prefix
  // lookup. Start events (`-0`) are valid anchors per spec §2 (4) example
  // `X-Y-Z-0 → X-Y-Z-0_g → X-Y-Z-1`, so they're included.
  const l4TaskSet = new Set();
  for (let i = 1; i < allRows.length; i++) {
    const l4 = String(allRows[i][COL_L4_NUMBER] ?? '').trim();
    if (l4 && !/(_g\d*|_s\d*|_w\d*)$/.test(l4)) l4TaskSet.add(l4);
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
      errors.push(`• 第 ${excelRow} 列 L4 編號「${l4}」格式錯誤（僅接受「-」分隔；閘道為 1-1-1-1_g、子流程為 1-1-1-1_s、外部互動為 1-1-1-1_w）`);
      continue; // suffix checks meaningless if base is wrong
    }

    const isStart     = /開始事件/.test(l4Name);
    const isEnd       = /結束事件/.test(l4Name);
    const gatewayType = detectGatewayFromText(flowText); // 'xor' | 'and' | null
    const isSubprocessRow = /調用子流程\s*\d+-\d+-\d+/.test(flowText);
    const hasGTag     = /_g\d*$/.test(l4);
    const hasSTag     = /_s\d*$/.test(l4);
    const hasWTag     = /_w\d*$/.test(l4);

    if (isStart && !L4_START_PATTERN.test(l4)) {
      errors.push(`• 第 ${excelRow} 列為「開始事件」，L4 編號「${l4}」尾碼應為 0（範例:1-1-7-0）`);
    }
    if (isEnd && !L4_END_PATTERN.test(l4)) {
      errors.push(`• 第 ${excelRow} 列為「結束事件」，L4 編號「${l4}」尾碼應為 99（範例:1-1-7-99）`);
    }
    if (gatewayType && !L4_GATEWAY_PATTERN.test(l4)) {
      const label = gatewayType === 'and' ? 'AND（並行）'
                  : gatewayType === 'or'  ? 'OR（包容）'
                  : 'XOR（排他）';
      errors.push(`• 第 ${excelRow} 列為閘道 ${label}，L4 編號「${l4}」應加「_g」後綴（單一 _g；連續多個用 _g1/_g2/_g3… 範例:1-1-9-5_g 或 1-1-9-5_g1）`);
    }
    if (isSubprocessRow && !L4_SUBPROCESS_PATTERN.test(l4)) {
      errors.push(`• 第 ${excelRow} 列為「子流程調用」，L4 編號「${l4}」應加「_s」後綴（單一 _s；連續多個用 _s1/_s2/_s3… 範例:1-1-9-5_s 或 1-1-9-5_s1）`);
    }
    // _g / _s / _w prefix-must-match-task: 前綴必為既有 L4 任務（含 -0 開始事件）
    if (hasGTag || hasSTag || hasWTag) {
      const baseNum = l4.replace(/(_g\d*|_s\d*|_w\d*)$/, '');
      if (!l4TaskSet.has(baseNum)) {
        const kind = hasGTag ? '閘道' : hasSTag ? '子流程' : '外部互動';
        errors.push(`• 第 ${excelRow} 列「${kind}」 ${l4}：找不到前置任務 ${baseNum}（${kind}編號前綴必為對應 L4 任務或 -0 開始事件）`);
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
    `  • 閘道（XOR / AND / OR）：加「_g」後綴，例如 1-1-9-5_g；連續多個用 1-1-9-5_g1、1-1-9-5_g2…\n` +
    `  • 子流程調用：加「_s」後綴，例如 1-1-9-5_s；連續多個用 1-1-9-5_s1、1-1-9-5_s2…\n` +
    `  • 外部關係人互動：加「_w」後綴，例如 1-1-9-5_w；連續多個用 1-1-9-5_w1、1-1-9-5_w2…\n` +
    `    _g / _s / _w 前綴必為對應 L4 任務（含 -0 開始事件）`
  );
}

/**
 * Soft-validate gateway chain semantics (warnings, not errors).
 *
 * User rule: `X_g` is the gateway immediately AFTER task X;
 *            `X_g{n+1}` is the gateway immediately after `X_g{n}`.
 *
 * For each `X_g\\d*` row, verify the expected predecessor exists AND its
 * 任務關聯說明 text mentions this gateway's number. Any mismatch is
 * returned as a warning string so the UI can show it without blocking.
 */
function collectGatewayChainWarnings(allRows) {
  const warnings = [];
  const rowByL4 = {};
  for (let i = 1; i < allRows.length; i++) {
    const l4 = String(allRows[i][COL_L4_NUMBER] ?? '').trim();
    if (!l4) continue;
    rowByL4[l4] = {
      excelRow: i + 1,
      flowText: String(allRows[i][COL_L4_FLOW] ?? ''),
    };
  }

  for (const [l4, info] of Object.entries(rowByL4)) {
    const m = l4.match(/^(\d+-\d+-\d+-\d+)_g(\d*)$/);
    if (!m) continue;
    const base = m[1];
    const n = m[2] === '' ? 1 : parseInt(m[2], 10);
    const predecessor = n <= 1 ? base : `${base}_g${n - 1}`;
    const predInfo = rowByL4[predecessor];
    if (!predInfo) {
      warnings.push(
        `• 第 ${info.excelRow} 列閘道 ${l4}：找不到預期的前置元件 ${predecessor}（規則：${l4} 應接在 ${predecessor} 之後）`
      );
      continue;
    }
    if (!predInfo.flowText.includes(l4)) {
      warnings.push(
        `• 第 ${info.excelRow} 列閘道 ${l4}：前置元件 ${predecessor}（第 ${predInfo.excelRow} 列）的任務關聯說明未指向 ${l4}（建議補「序列流向 ${l4}」或對應的分支標記）`
      );
    }
  }
  return warnings;
}

/**
 * Auto-fix stored l4Number per spec §2 (post-2026-04-29 rules).
 *
 * Strategy: strip every task.l4Number, run computeDisplayLabels in fully-
 * generated mode (auto sequential 1..N for regular tasks; -0 / -99 for
 * start/end; `_g` / `_g1+_g2+...` for gateways; `_s` / `_s1+_s2+...` for
 * subprocesses), then compare to the original and write back the
 * normalized number. Differences become user-visible warnings on the
 * import banner.
 *
 * Why strip first: computeDisplayLabels respects stored l4Number when
 * present, so leaving the user's possibly-wrong value in place would just
 * pass it through unchanged. Stripping forces it to recompute, which is
 * exactly the "正規化" behavior we want.
 *
 * Returns { tasks: normalizedTasks, fixes: [{ before, after, name }] }.
 */
function normalizeL4Numbers(tasks, l3Number) {
  const stripped = tasks.map(t => {
    if (!t.l4Number) return t;
    const { l4Number, ...rest } = t;
    return rest;
  });
  const generated = computeDisplayLabels(stripped, l3Number);
  const fixes = [];
  const next = tasks.map(t => {
    const expected = generated[t.id];
    if (expected && t.l4Number && t.l4Number !== expected) {
      fixes.push({ before: t.l4Number, after: expected, name: t.name || '（未命名）' });
      return { ...t, l4Number: expected };
    }
    if (!t.l4Number && expected) {
      // Synthetic start/end (no l4Number on Excel row) — fill it in.
      return { ...t, l4Number: expected };
    }
    return t;
  });
  return { tasks: next, fixes };
}

/**
 * Detect tasks whose Excel flowAnnotation declares a merge ("並行合併" /
 * "條件合併" / "包容合併") but whose graph incoming-edge count is < 2 —
 * meaning the source tasks didn't actually point at this merge target.
 * formatConnection auto-derives merge text from incoming, so without
 * the wiring the rendered annotation will be empty / wrong.
 *
 * Common cause: Excel uses the legacy "X合併來自多個分支，序列流向 Z"
 * wording without listing the source numbers, and the source tasks'
 * 任務關聯說明 didn't reference Z. Importer can't infer the missing
 * sources, so it warns the user to manually add "序列流向 Z" on each
 * source row (or remove the merge wording if it was wrong).
 */
function collectMergeIncomingWarnings(tasks, l3Number, l4Map) {
  const incomingCount = getTaskIncoming(tasks);
  const warnings = [];
  const MERGE_RE = /(?:並行|條件|包容)合併/;
  tasks.forEach(t => {
    const text = t.flowAnnotation || '';
    if (!MERGE_RE.test(text)) return;
    const incoming = incomingCount[t.id] || 0;
    if (incoming < 2) {
      const num = l4Map[t.id] || t.l4Number || '';
      warnings.push(
        `[L3 ${l3Number}] 任務「${t.name || '（未命名）'}」(${num}) 標記為合併目標，但實際只有 ${incoming} 個前置任務指向。請補上 source 任務「序列流向 ${num}」，或檢查連線是否正確。`
      );
    }
  });
  return warnings;
}

export function parseExcelToFlow(arrayBuffer) {
  const workbook  = XLSX.read(arrayBuffer, { type: 'array' });
  const sheet     = workbook.Sheets[workbook.SheetNames[0]];
  const allRows   = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

  // Validate L3 / L4 number formats BEFORE any processing
  validateNumbering(allRows);

  // Soft chain-integrity warnings (non-blocking)
  const warnings = collectGatewayChainWarnings(allRows);

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

  const flows = groups.map(buildFlow);

  // 2026-04-29: Auto-normalize l4Number to match spec §2 (順號從 1 起;
  // 連續 _g1/_g2 vs single _g; same for _s). Collect every change and
  // surface them as warnings so the user sees what was auto-adjusted.
  const normalizeWarnings = [];
  flows.forEach(flow => {
    const { tasks, fixes } = normalizeL4Numbers(flow.tasks, flow.l3Number);
    flow.tasks = tasks;
    if (fixes.length > 0) {
      const pfx = flows.length > 1 ? `[L3 ${flow.l3Number}] ` : '';
      normalizeWarnings.push(`${pfx}已自動調整 ${fixes.length} 個 L4 編號以符合規則：`);
      fixes.forEach(f => {
        normalizeWarnings.push(`  • 「${f.name}」 ${f.before} → ${f.after}`);
      });
    }
  });

  // 2026-04-29: Detect merge-target tasks whose incoming wiring is missing,
  // typically because the Excel used the legacy "X合併來自多個分支" wording
  // without listing source numbers. formatConnection now derives the merge
  // text from incoming edges, so missing wiring → empty / wrong rendering.
  const mergeWarnings = flows.flatMap(flow => {
    const l4Map = computeDisplayLabels(flow.tasks, flow.l3Number);
    return collectMergeIncomingWarnings(flow.tasks, flow.l3Number, l4Map);
  });

  // PR-7: surface model-layer validation warnings on the Dashboard banner
  // since import skips the editor's save gate. Blocking-tier prefixed with
  // ❌; multi-L3 imports prefix each line with the L3 number.
  const validationLines = flows.flatMap(flow => {
    const { blocking: vB, warnings: vW } = validateFlow(flow);
    const pfx = flows.length > 1 ? `[L3 ${flow.l3Number}] ` : '';
    return [...vB.map(b => `${pfx}❌ ${b}`), ...vW.map(w => `${pfx}${w}`)];
  });

  return {
    flows,
    warnings: [...normalizeWarnings, ...mergeWarnings, ...warnings, ...validationLines],
  };
}

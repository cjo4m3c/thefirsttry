/**
 * Excel number-format validation + L4 normalization.
 *
 * `validateNumbering` is the pre-import blocker — wrong format throws and
 * the user must fix the file. `normalizeL4Numbers` runs after build and
 * silently auto-corrects mismatched stored l4Number values to match the
 * derived (per-spec) labels, surfacing each correction as a non-blocking
 * warning so the user can audit them.
 */
import {
  L3_NUMBER_PATTERN, L4_NUMBER_PATTERN,
  L4_START_PATTERN, L4_END_PATTERN,
  L4_GATEWAY_PATTERN, L4_SUBPROCESS_PATTERN,
  computeDisplayLabels,
} from '../taskDefs.js';
import { detectGatewayFromText } from '../../model/connectionFormat.js';

const COL_L3_NUMBER = 0;
const COL_L4_NUMBER = 2;
const COL_L4_NAME   = 3;
const COL_L4_FLOW   = 8;

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
export function validateNumbering(allRows) {
  const errors = [];

  // First pass: collect base L4 task numbers (no _g / _s variant) for prefix
  // lookup. Start events (`-0`) are valid anchors per spec §2 (4) example
  // `X-Y-Z-0 → X-Y-Z-0_g → X-Y-Z-1`, so they're included.
  const l4TaskSet = new Set();
  for (let i = 1; i < allRows.length; i++) {
    const l4 = String(allRows[i][COL_L4_NUMBER] ?? '').trim();
    if (l4 && !/(_g\d*|_s\d*|_e\d*)$/.test(l4)) l4TaskSet.add(l4);
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
      errors.push(`• 第 ${excelRow} 列 L4 編號「${l4}」格式錯誤（僅接受「-」分隔；閘道為 1-1-1-1_g、子流程為 1-1-1-1_s、外部互動為 1-1-1-1_e）`);
      continue; // suffix checks meaningless if base is wrong
    }

    const isStart     = /開始事件/.test(l4Name);
    const isEnd       = /結束事件/.test(l4Name);
    const gatewayType = detectGatewayFromText(flowText); // 'xor' | 'and' | null
    const isSubprocessRow = /調用子流程\s*\d+-\d+-\d+/.test(flowText);
    const hasGTag     = /_g\d*$/.test(l4);
    const hasSTag     = /_s\d*$/.test(l4);
    const hasWTag     = /_e\d*$/.test(l4);

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
    // PR-D10 (decision 4): conflicting kind signals → block. L4 says one
    // element type, body says a different one.
    if (hasGTag && isSubprocessRow) {
      errors.push(`• 第 ${excelRow} 列衝突：L4「${l4}」帶「_g」（閘道）但任務關聯說明寫「調用子流程」（子流程）— 請統一兩處`);
    }
    if (hasSTag && gatewayType) {
      const label = gatewayType === 'and' ? '並行' : gatewayType === 'or' ? '包容' : '條件';
      errors.push(`• 第 ${excelRow} 列衝突：L4「${l4}」帶「_s」（子流程）但任務關聯說明寫「${label}分支至」（閘道）— 請統一兩處`);
    }
    // Decision 4: L4 _s requires body's "調用子流程 X-Y-Z" reference (need
    // the L3 number to know which subprocess is called).
    if (hasSTag && !isSubprocessRow) {
      errors.push(`• 第 ${excelRow} 列：L4「${l4}」帶「_s」（子流程）但任務關聯說明缺少「調用子流程 X-Y-Z」— 請補上要呼叫的 L3 編號`);
    }
    // _g / _s / _e prefix-must-match-task: 前綴必為既有 L4 任務（含 -0 開始事件）
    if (hasGTag || hasSTag || hasWTag) {
      const baseNum = l4.replace(/(_g\d*|_s\d*|_e\d*)$/, '');
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
    `  • 外部關係人互動：加「_e」後綴，例如 1-1-9-5_e；連續多個用 1-1-9-5_e1、1-1-9-5_e2…\n` +
    `    _g / _s / _e 前綴必為對應 L4 任務（含 -0 開始事件）`
  );
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
export function normalizeL4Numbers(tasks, l3Number, excelRowByL4 = {}) {
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
      // PR-D12: include excelRow so users can find the offending row in
      // their original Excel without grepping by name.
      fixes.push({
        before: t.l4Number,
        after: expected,
        name: t.name || '（未命名）',
        excelRow: excelRowByL4[t.l4Number] || null,
      });
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

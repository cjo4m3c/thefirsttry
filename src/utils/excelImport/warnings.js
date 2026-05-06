/**
 * Soft (non-blocking) Excel import warnings.
 *
 * Three collectors produce user-visible advisories that surface in the
 * Dashboard import banner + per-flow editor banner. They never throw —
 * blocking errors live in `validators.js`.
 */
import { detectGatewayFromText } from '../../model/connectionFormat.js';
import { getTaskIncoming } from '../../model/flowSelectors.js';
import { detectGatewayFromName } from './detectors.js';

const COL_L4_NUMBER = 2;
const COL_L4_NAME   = 3;
const COL_L4_FLOW   = 8;

/**
 * PR-D10 (2026-05-05): non-blocking cross-check between L4 suffix, L4 name,
 * and 任務關聯說明 body. Surfaces inconsistencies the user can fix in the
 * editor (validateNumbering already blocks the hard structural errors).
 *
 * Rules:
 *   • L4 `_g` + body has no fork keyword → default XOR + warn (decision 2)
 *   • Name `[XX閘道]` ≠ body fork keyword → warn (decision 6 / F2 寬鬆)
 *   • L4 `-0` + name doesn't say「開始事件」 → suggest name prefix
 *   • L4 `-99` + name doesn't say「結束事件」 → suggest name prefix
 */
export function collectCrossCheckWarnings(allRows) {
  const warnings = [];
  for (let i = 1; i < allRows.length; i++) {
    const row = allRows[i];
    const l4 = String(row[COL_L4_NUMBER] ?? '').trim();
    if (!l4) continue;
    const l4Name = String(row[COL_L4_NAME] ?? '').trim();
    const flowText = String(row[COL_L4_FLOW] ?? '');
    const excelRow = i + 1;
    // 2026-05-05: dropped the 「流程斷點」 mention warning per user — the
    // editor / Excel ecosystem has fully retired the breakpoint element so
    // surfacing it on every legacy row was noise, not signal.

    const hasGTag    = /_g\d*$/.test(l4);
    const isStartL4  = /-0$/.test(l4);
    const isEndL4    = /-99$/.test(l4);
    const gtFromText = detectGatewayFromText(flowText);
    const gtFromName = detectGatewayFromName(l4Name);
    const labelOf = (g) => g === 'and' ? '並行閘道' : g === 'or' ? '包容閘道' : '排他閘道';

    if (hasGTag && !gtFromText) {
      warnings.push(
        `• 第 ${excelRow} 列：L4「${l4}」帶「_g」後綴但任務關聯說明沒寫分支詞彙，系統預設為「排他閘道（XOR）」— 若實際是 OR / AND，請在 I 欄補「條件分支至 / 並行分支至 / 包容分支至 ...」`
      );
    }
    if (gtFromText && gtFromName && gtFromText !== gtFromName) {
      warnings.push(
        `• 第 ${excelRow} 列閘道類型不一致：L4 名稱寫「[${labelOf(gtFromName)}]」但任務關聯說明用「${labelOf(gtFromText)}」的詞彙 — 系統依任務關聯說明判定為「${labelOf(gtFromText)}」，若不對請改 I 欄詞彙`
      );
    }
    if (isStartL4 && !/開始事件/.test(l4Name)) {
      warnings.push(
        `• 第 ${excelRow} 列：L4「${l4}」結尾「-0」（開始事件），建議名稱補「[開始事件]」前綴以利辨識`
      );
    }
    if (isEndL4 && !/結束事件/.test(l4Name)) {
      warnings.push(
        `• 第 ${excelRow} 列：L4「${l4}」結尾「-99」（結束事件），建議名稱補「[結束事件]」前綴以利辨識`
      );
    }
  }
  return warnings;
}

/**
 * Soft-validate gateway chain semantics (warnings, not errors).
 *
 * User rule: `X_g` is the gateway immediately AFTER task X;
 *            `X_g{n+1}` is the gateway immediately after `X_g{n}`.
 *
 * For each `X_g\d*` row, verify the expected predecessor exists AND its
 * 任務關聯說明 text mentions this gateway's number. Any mismatch is
 * returned as a warning string so the UI can show it without blocking.
 */
export function collectGatewayChainWarnings(allRows) {
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
export function collectMergeIncomingWarnings(tasks, l3Number, l4Map) {
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

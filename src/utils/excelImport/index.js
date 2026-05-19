/**
 * Excel → flow import orchestrator.
 *
 * Public API (the only function consumers should call):
 *   parseExcelToFlow(arrayBuffer) → { flows, warnings }
 *
 * Pipeline:
 *   1. Read Excel → 2D rows array
 *   2. validators.validateNumbering → throw on hard format errors
 *   3. warnings.collectCrossCheckWarnings + collectGatewayChainWarnings → soft
 *   4. aux.buildAuxColMap → header-driven column map
 *   5. Group rows by L3 → buildFlow per group
 *   6. validators.normalizeL4Numbers → auto-fix mismatched l4Number, surface fixes
 *   7. Regenerate stored flowAnnotation with formatConnection (post-normalize)
 *   8. warnings.collectMergeIncomingWarnings + validateFlow per flow
 *   9. Per-flow importWarnings + global warnings array
 *
 * The shim `src/utils/excelImport.js` re-exports `parseExcelToFlow` so
 * existing `import { parseExcelToFlow } from '../utils/excelImport.js'`
 * keeps working.
 */
import * as XLSX from 'xlsx';
import { parseConnection, formatConnection } from '../../model/connectionFormat.js';
import { validateFlow } from '../../model/validation.js';
import { computeDisplayLabels } from '../taskDefs.js';
import { buildAuxColMap } from './aux.js';
import { validateNumbering, normalizeL4Numbers } from './validators.js';
import {
  collectCrossCheckWarnings,
  collectGatewayChainWarnings,
  collectMergeIncomingWarnings,
} from './warnings.js';
import { buildFlow } from './buildFlow.js';

const COL_L3_NUMBER = 0;
const COL_L3_NAME   = 1;
const COL_L4_NUMBER = 2;

// Backward-compat alias — use parseConnection in new code.
export const parseFlowAnnotations = parseConnection;

export function parseExcelToFlow(arrayBuffer) {
  const workbook  = XLSX.read(arrayBuffer, { type: 'array' });
  const sheet     = workbook.Sheets[workbook.SheetNames[0]];
  const allRows   = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

  // Validate L3 / L4 number formats BEFORE any processing
  validateNumbering(allRows);

  // PR-D12: build L4 → Excel row index map for fix message attribution.
  // PR #236：同一 L4 編號（例 multi-end `5-2-6-99` × 2 列）改成 array、
  // normalizeL4Numbers 按 task 出現順序 + counter 配對正確 excelRow。
  // Map: L4 → Array<excelRow>（同編號多列依序排列）
  const excelRowsByL4 = {};
  const l3OfRow = {};   // excelRow → L3 number string
  for (let i = 1; i < allRows.length; i++) {
    const l4 = String(allRows[i][COL_L4_NUMBER] ?? '').trim();
    const l3 = String(allRows[i][COL_L3_NUMBER] ?? '').trim();
    const xlRow = i + 1;
    if (l4) (excelRowsByL4[l4] ||= []).push(xlRow);
    if (l3) l3OfRow[xlRow] = l3;
  }

  // Soft chain-integrity warnings (non-blocking).
  // PR-D12: per-warning attribution: keep row's L3 so we can split into
  // each flow's importWarnings. Strip the leading L3 prefix added at the
  // global-warning aggregation step.
  const warnings = [
    ...collectCrossCheckWarnings(allRows),  // PR-D10 cross-checks
    ...collectGatewayChainWarnings(allRows),
  ];

  // Resolve auxiliary column positions from the header row. Optional and
  // forgiving — missing headers stay absent from the map and corresponding
  // task.meta keys remain unset (rendered as '' downstream).
  const auxColMap = buildAuxColMap(allRows[0]);

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

  const flows = groups.map(group => buildFlow(group, auxColMap));

  // PR #236：訊息結構從 flat string array → nested group array。
  // `flow.importFixes` / `flow.importNotices` 都是 Array<Group>：
  //   Group = { l3: string, headline: string, details: string[] }
  // Banner 渲染時 headline 一級、details 縮排二級。同 L3 多種類型 fix（如
  // auto-sub + normalize）會產生多個 group、l3 相同 headline 不同。
  // 移除所有 ❌ / ⚠ emoji（使用者：「不要 icon / emoji、純文字表達」）。
  // 舊 flat string 格式由 storage/migrations.js migrateImportWarningsToFixes
  // 一次性清空（使用者：「以新為主、不要並存」）。
  flows.forEach(flow => { flow.importFixes = []; flow.importNotices = []; });

  // helper：build group + push 到 flow 對應 bucket + 同時收集到 global aggregator
  const mkGroup = (l3, headline, details) => ({ l3, headline, details });

  // === A. auto-sub adds：閘道分支寫「調用子流程」但 Excel 沒對應 _s 列 ===
  const autoSubGroups = [];
  flows.forEach(flow => {
    const adds = flow.__autoSubAdds || [];
    delete flow.__autoSubAdds;
    if (adds.length === 0) return;
    const headline = `已自動補上 ${adds.length} 個子流程元件（閘道分支寫了「調用子流程」但 Excel 沒對應的 _s 列，依規則自動建立）：`;
    const details = adds.map(a => {
      const branchTag = a.branchLabel ? `「${a.branchLabel}」分支` : '分支';
      return `${a.sub}（調用 ${a.calledL3}）— 由閘道 ${a.gateway} 的${branchTag}建立`;
    });
    const g = mkGroup(flow.l3Number, headline, details);
    autoSubGroups.push(g);
    flow.importFixes.push(g);
  });

  // === B. normalize L4 numbers：自動調整 L4 編號以符合規則 ===
  const normalizeGroups = [];
  flows.forEach(flow => {
    const { tasks, fixes } = normalizeL4Numbers(flow.tasks, flow.l3Number, excelRowsByL4);
    flow.tasks = tasks;
    if (fixes.length === 0) return;
    const headline = `已自動調整 ${fixes.length} 個 L4 編號以符合規則：`;
    const details = fixes.map(f => {
      const rowTag = f.excelRow ? `第 ${f.excelRow} 列` : '';
      return rowTag
        ? `${rowTag}「${f.name}」 ${f.before} → ${f.after}`
        : `「${f.name}」 ${f.before} → ${f.after}`;
    });
    const g = mkGroup(flow.l3Number, headline, details);
    normalizeGroups.push(g);
    flow.importFixes.push(g);
  });

  // PR-D12: regenerate stored flowAnnotation post-normalize so localStorage
  // strings match the displayed (formatConnection-derived) numbers.
  flows.forEach(flow => {
    const l4Map = computeDisplayLabels(flow.tasks, flow.l3Number);
    flow.tasks = flow.tasks.map(t => ({
      ...t,
      flowAnnotation: formatConnection(t, flow.tasks, l4Map),
    }));
  });

  // === C. merge incoming 不足 ===
  // collectMergeIncomingWarnings 訊息已含 `[L3 N] ` prefix、改 group 時要拆掉
  const stripL3 = (line) => line.replace(/^\[L3 [^\]]+\]\s*/, '');
  const mergeGroups = [];
  flows.forEach(flow => {
    const l4Map = computeDisplayLabels(flow.tasks, flow.l3Number);
    const lines = collectMergeIncomingWarnings(flow.tasks, flow.l3Number, l4Map);
    if (lines.length === 0) return;
    const headline = lines.length === 1 ? '合併目標的前置任務不足：' : `${lines.length} 個合併目標的前置任務不足：`;
    const details = lines.map(stripL3);
    const g = mkGroup(flow.l3Number, headline, details);
    mergeGroups.push(g);
    flow.importNotices.push(g);
  });

  // === D. validation blocking + warnings（移除 ❌ emoji） ===
  // Connection violations 已 filter 掉（編輯器內紅框 + save modal 處理）
  const isConnectionViolation = (msg) =>
    /連線被任務矩形擋住/.test(msg)
    || /端點同時有進出連線/.test(msg)
    || /違反規則 1：端點不混用/.test(msg)
    || /穿過任務 「.*」（違反規則 2/.test(msg);
  const validationGroups = [];
  flows.forEach(flow => {
    const { blocking: vB, warnings: vW } = validateFlow(flow);
    const filteredB = vB.filter(b => !isConnectionViolation(b));
    const filteredW = vW.filter(w => !isConnectionViolation(w));
    if (filteredB.length === 0 && filteredW.length === 0) return;
    const details = [...filteredB, ...filteredW];
    const headline = filteredB.length > 0
      ? `${details.length} 個結構問題（${filteredB.length} 個阻擋、${filteredW.length} 個建議）：`
      : `${details.length} 個建議檢視：`;
    const g = mkGroup(flow.l3Number, headline, details);
    validationGroups.push(g);
    flow.importNotices.push(g);
  });

  // === E. cross-row warnings（cross-check + gateway chain）===
  // 按 L3 group、同 L3 多條合一個 group。訊息保留「第 N 列」前綴（detail 內仍需）
  const crossByL3 = {};
  warnings.forEach(line => {
    const m = line.match(/第 (\d+) 列/);
    const xlRow = m ? parseInt(m[1], 10) : null;
    const l3 = xlRow ? l3OfRow[xlRow] : null;
    if (!l3) return;
    (crossByL3[l3] ||= []).push(line);
  });
  const crossGroups = [];
  Object.entries(crossByL3).forEach(([l3, lines]) => {
    const headline = `${lines.length} 個提醒：`;
    const g = mkGroup(l3, headline, lines);
    crossGroups.push(g);
    const target = flows.find(f => f.l3Number === l3);
    if (target) target.importNotices.push(g);
  });

  return {
    flows,
    // Dashboard banner 分兩個 section 顯示。Group 結構（PR #236）：
    // - fixes：系統實際改過的（自動補 / 自動調整）
    // - notices：純提醒（merge / cross-row / validation）
    fixes:   [...autoSubGroups, ...normalizeGroups],
    notices: [...mergeGroups, ...crossGroups, ...validationGroups],
  };
}

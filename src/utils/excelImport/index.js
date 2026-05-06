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
  // Use original (pre-normalize) L4 strings to look up where the user wrote
  // them in their source Excel. Built before grouping so we don't lose the
  // global row index when the rows go through filter/group steps.
  // Map is excelRow = i + 1 (1-indexed, header at row 1).
  // Also map by base L3 to attribute cross-row warnings to specific flows.
  const excelRowByL4 = {};
  const l3OfRow = {};   // excelRow → L3 number string
  for (let i = 1; i < allRows.length; i++) {
    const l4 = String(allRows[i][COL_L4_NUMBER] ?? '').trim();
    const l3 = String(allRows[i][COL_L3_NUMBER] ?? '').trim();
    const xlRow = i + 1;
    if (l4 && !excelRowByL4[l4]) excelRowByL4[l4] = xlRow;
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

  // PR-D12: per-flow importWarnings 用於 (a) Dashboard banner 集中顯示
  // (b) FlowEditor 開啟流程時頂部 banner、可使用者主動 dismiss。
  // 每個 flow 自己累積；最後 flatMap 成全域 warnings 給 Dashboard。
  flows.forEach(flow => { flow.importWarnings = []; });

  const normalizeWarnings = [];
  flows.forEach(flow => {
    const { tasks, fixes } = normalizeL4Numbers(flow.tasks, flow.l3Number, excelRowByL4);
    flow.tasks = tasks;
    if (fixes.length > 0) {
      const pfx = flows.length > 1 ? `[L3 ${flow.l3Number}] ` : '';
      const headlineGlobal = `${pfx}已自動調整 ${fixes.length} 個 L4 編號以符合規則：`;
      const headlineFlow = `已自動調整 ${fixes.length} 個 L4 編號以符合規格：`;
      normalizeWarnings.push(headlineGlobal);
      flow.importWarnings.push(headlineFlow);
      fixes.forEach(f => {
        // PR-D12: include Excel row number so user can locate the offending
        // row in their source file (was `「name」 X → Y` only).
        // PR (2026-05-06): dropped leading `  • ` prefix — the banner's
        // <ul list-disc> renders the bullet visually, so a text-bullet here
        // would double up. Indent via banner CSS if sub-hierarchy needed.
        const rowTag = f.excelRow ? `第 ${f.excelRow} 列` : '';
        const line = rowTag
          ? `${rowTag}「${f.name}」 ${f.before} → ${f.after}`
          : `「${f.name}」 ${f.before} → ${f.after}`;
        normalizeWarnings.push(line);
        flow.importWarnings.push(line);
      });
    }
  });

  // PR-D12: regenerate stored flowAnnotation post-normalize so localStorage
  // strings match the displayed (formatConnection-derived) numbers. Stored
  // strings are otherwise leftover Excel raw text and cause confusion when
  // inspecting task objects in DevTools or via 3rd-party localStorage readers.
  flows.forEach(flow => {
    const l4Map = computeDisplayLabels(flow.tasks, flow.l3Number);
    flow.tasks = flow.tasks.map(t => ({
      ...t,
      flowAnnotation: formatConnection(t, flow.tasks, l4Map),
    }));
  });

  const mergeWarnings = [];
  flows.forEach(flow => {
    const l4Map = computeDisplayLabels(flow.tasks, flow.l3Number);
    const lines = collectMergeIncomingWarnings(flow.tasks, flow.l3Number, l4Map);
    if (lines.length > 0) {
      mergeWarnings.push(...lines);
      flow.importWarnings.push(...lines);
    }
  });

  // 2026-05-06 per user: drop ALL connection-violation messages from Excel
  // import banner. They surface in the editor (red borders + save modal),
  // but on the upload screen the user can't act on them — the banner stays
  // focused on data / structural issues.
  // Connection violations come from `detectOverrideViolations` and surface
  // as either:
  //   blocking: 端點不混用 (Rule 1) — `「name」的 X 端點同時有進出連線`
  //   warning:  視覺重疊 (Rule 2 summary) — `連線被任務矩形擋住`
  //   warning:  視覺重疊 (per-line) — `連線「A」→「B」穿過任務「C」`
  // 2026-05-05 already filtered the summary; 2026-05-06 expanded to also
  // drop the per-line variant + the IN+OUT-mix blocking text.
  const isConnectionViolation = (msg) =>
    /連線被任務矩形擋住/.test(msg)
    || /端點同時有進出連線/.test(msg)
    || /違反規則 1：端點不混用/.test(msg)
    || /穿過任務 「.*」（違反規則 2/.test(msg);
  const validationLines = [];
  flows.forEach(flow => {
    const { blocking: vB, warnings: vW } = validateFlow(flow);
    const filteredB = vB.filter(b => !isConnectionViolation(b));
    const filteredW = vW.filter(w => !isConnectionViolation(w));
    const pfx = flows.length > 1 ? `[L3 ${flow.l3Number}] ` : '';
    const blocked = filteredB.map(b => `${pfx}❌ ${b}`);
    const warned  = filteredW.map(w => `${pfx}${w}`);
    validationLines.push(...blocked, ...warned);
    if (filteredB.length || filteredW.length) {
      flow.importWarnings.push(...filteredB.map(b => `❌ ${b}`), ...filteredW);
    }
  });

  // PR-D12: cross-row warnings (cross-check + chain) — attribute each line
  // to its flow by extracting "第 N 列" → l3OfRow[N] → flow.l3Number.
  warnings.forEach(line => {
    const m = line.match(/第 (\d+) 列/);
    const xlRow = m ? parseInt(m[1], 10) : null;
    const l3 = xlRow ? l3OfRow[xlRow] : null;
    const target = l3 ? flows.find(f => f.l3Number === l3) : null;
    if (target) target.importWarnings.push(line);
  });

  return {
    flows,
    warnings: [...normalizeWarnings, ...mergeWarnings, ...warnings, ...validationLines],
  };
}

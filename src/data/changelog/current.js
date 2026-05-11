/**
 * Changelog "current tip" — new entries since last freeze land here.
 * When this file grows beyond ~7KB, freeze: rename to c{next}.js + reset to [].
 * Entries are newest-first within file.
 */
export default [
  {
    date: '2026-05-11',
    title: '拆檔 PR-2：storage.js 15.5KB → 5.9KB（抽 migration helpers 到 storage/migrations.js）+ 凍結 c27',
    items: [
      '**緣由**：PR #199（複製功能）加 `cloneFlow` 後 storage.js 從 12KB → 15.5KB 剛過 15KB 軟上限。拆檔輪第 2 個 PR — 抽 migration helpers（7 個純函式 + `normalizeNumber`）到 `src/utils/storage/migrations.js`。同 PR 順手凍結 current.js（pre-PR 已 ~10KB 過 7KB 門檻）為 c27.js。',
      '**拆法**：建 `src/utils/storage/` subdir + `migrations.js` 子檔（沿用 `excelImport.js + excelImport/` shim+subdir pattern）。`migrations.js` 收 `normalizeNumber` + 7 個 `migrateXxx` helpers（`migrateGatewaySuffix` / `migrateSubprocessSuffix` / `migrateInteractionSuffix` / `migrateMergeConnectionType` / `migrateTaskMeta` / `migrateTypeFromL4Suffix` / `cleanStaleOverrides`）+ `ensureMeta` import；storage.js 留 `migrateFlow` orchestrator / `loadFlows` / `saveFlow` / `deleteFlow` / `generateId` / `cloneFlow` / `todayYmd`。外部 import 路徑不變（仍從 `./storage.js` import）— 零回歸風險。',
      '**結果**：storage.js 15.5KB → 5.9KB（-62%）/ migrations.js 9.9KB（新檔）/ 合計 16.1KB（+0.5KB 多在 file header + import statements，可忽略）。',
      '**Changelog freeze**：current.js (pre-PR 5 條 entries ~10KB) → c27.js；current.js 重置成只含本條。`index.js` 加 c27 import + spread 放在 c26 之前。',
      '**動到的檔案（4 個 + 2 新檔）**：`src/utils/storage.js`（slim 成 orchestrator + cloneFlow / public API）/ `src/utils/storage/migrations.js`（新檔，7 個 helpers + normalizeNumber + ensureMeta import）/ `src/data/changelog/c27.js`（新檔，凍結 5 條 entries）/ `src/data/changelog/current.js`（reset + 本條）/ `src/data/changelog/index.js`（import c27）/ `.claude/backlog.md`（「後續批次拆檔」段加 storage.js 到「已解」）。',
      '**驗證**：`npm run build` pass。Mental trace：`loadFlows()` 流程 — localStorage 拿 raw → `JSON.parse` → `map(migrateFlow)` → migrateFlow 跑 7 個 helpers 依原順序（migrateTypeFromL4Suffix → Gateway → Subprocess → Interaction → MergeConnectionType → TaskMeta → cleanStaleOverrides）→ applyExternalPrefixToRoles → return。等價於拆檔前。',
    ],
  },
];

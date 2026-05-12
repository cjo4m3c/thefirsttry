/**
 * Changelog "current tip" — new entries since last freeze land here.
 * When this file grows beyond ~7KB, freeze: rename to c{next}.js + reset to [].
 * Entries are newest-first within file.
 */
export default [
  {
    date: '2026-05-11',
    title: 'fix: parseL4SortKey 公式溢位 — `_s2` / `_e2+` 視覺跑到下個 sequence 後面',
    items: [
      '**緣由**：使用者匯入 5-1-1 流程後發現 `5-1-1-2_s1` / `5-1-1-2_s2` / `5-1-1-3` 編輯器順序對、但流程圖視覺變成 `_s1 → 5-1-1-3 → _s2`（-3 夾在兩個 _s 中間）。Trace parseL4SortKey：舊公式 `base + offsetUnit × K` 對 _s 用 `0.501×K`、_e 用 `0.801×K`、K=2 時就會撞下個 sequence base — `_s2 = 2 + 0.501×2 = 3.002 > 3 = 5-1-1-3` → 排序錯亂。',
      '**Root cause**：sortKey 設計當初假設 K=1，沒考慮同 anchor 多個 _s / _e 元件（業務上閘道分支寫多條「調用子流程」會產生 _s2 _s3）。`_g` 用 0.001×K 安全（K 999 才會出問題）；`_s` / `_e` 的 0.501 / 0.801 是 base offset、不該乘 K。',
      '**修法（Option A）**：parseL4SortKey 公式改成 `base + baseOffset[type] + 0.001 × K`，其中 `baseOffset = { g: 0, s: 0.25, e: 0.5 }`。三 type 各佔 [N, N+1) 內一段（_g 在 [0, 0.25)、_s 在 [0.25, 0.5)、_e 在 [0.5, 1)），K 達 249 才會跨區段、業務上 K 通常 1-5 完全安全。',
      '**為什麼選 A 不選 B**：B 是把 sortKey 從 number 改成 tuple `[base, typeOrder, k]`、需要新增 compareSortKeys helper + 改寫 2 處比較邏輯（`sort()` comparator 跟 `>` 過濾）+ 規格文件加解釋 lexicographic ordering、心智負擔轉嫁未來新人。A 只改 4 行公式、其他不動、規格文件對應度高、K 上限 249 對業務遠超夠用。',
      '**驗證**：trace 三個情境 (a) 阿明 case：`_s1`=2.251 / `5-1-1-3`=3.000 / `_s2`=2.252 → 順序對 (b) 混合 K=1 場景：`_g1`=3.001 / `_s1`=3.251 / `_e1`=3.501 / `_4`=4 順序仍對 (c) 沒中 bug 的舊流程（單 _s1）：絕對 sortKey 從 3.501 變 3.251、相對順序不變、視覺位置完全相同。`npm run build` 通過。',
      '**動到的檔案（3 個）**：`src/diagram/layout/columnAssign.js`（parseL4SortKey 公式 4 行 + docstring）/ `docs/business-spec.md` §5.2（sortKey 公式說明改寫 + 修正歷史說明）/ `src/data/changelog/current.js`（本條）。',
    ],
  },
  {
    date: '2026-05-11',
    title: '首頁卡片按鈕拉齊 + 編輯頁 L3 名稱欄位加寬 50%',
    items: [
      '**FlowCard 按鈕統一樣式**（使用者：「除了刪除之外，其他所有的按鈕樣式顏色要拉齊」）：抽 `ACTION_BTN` const = `rounded border border-blue-300 text-blue-700 hover:bg-blue-50 transition-colors font-medium`，套用到 5 個非刪除按鈕（編輯 / 複製 / 下載 PNG / 下載 Drawio / 下載 Excel）。原本「複製」是 blue-200/600（比其他輕一階）、下載 ×3 沒 font-medium，現在 5 顆完全一致。刪除按鈕保留紅色維持視覺辨識度。',
      '**編輯頁 L3 名稱欄位加寬 50%**（使用者：「加大編輯頁面中，編輯 L3 流程名稱的欄位寬度（加大 50%）」）：`FlowEditor/Header.jsx` 中 L3 活動名稱 input 從 `flex-1 min-w-0`（實際 ~200px，因為 parent div 沒 flex-grow，flex-1 沒生效）改為 `w-80`（320px 固定寬，比原 +50%+）。「確認客戶需求-會後更新」這類稍長的名稱不再被截。',
      '**動到的檔案（3 個）**：`src/components/Dashboard/FlowCard.jsx`（加 ACTION_BTN const、5 顆按鈕換 className）/ `src/components/FlowEditor/Header.jsx`（L3 名稱 input 寬度）/ `src/data/changelog/current.js`（本條）。',
      '**驗證**：`npm run build` pass。純 UI 樣式，零邏輯變更。',
    ],
  },
  {
    date: '2026-05-11',
    title: '拆檔 PR-3：ContextMenu/index.jsx 17.5KB → 13.6KB（抽 position / drag hook 到 useContextMenuPosition.js）',
    items: [
      '**緣由**：backlog「後續批次拆檔」最後一項。ContextMenu/index.jsx 17.5KB 過 15KB 軟上限 2.5KB — pop-up menu 已經拆過一輪（PR-0 抽 subforms.jsx），剩下的 state hub + JSX 仍偏大。',
      '**拆法**：抽 positioning / drag / dismiss 邏輯（4 種 cross-cutting 行為：初始定位、ResizeObserver reclamp、☰ pointer drag、click-outside / Esc）成 `useContextMenuPosition({ x, y, taskId, onClose })` custom hook，跟 ContextMenu 業務 state（sub-form 切換、submit handlers）脫鉤。Hook 回傳 `{ ref, adjusted, dragging, startDrag }`，caller 直接用即可。',
      '**結果**：index.jsx 17.5KB → 13.6KB（-22%，過 15KB 軟上限的 2.5KB 全砍進 hook）/ useContextMenuPosition.js 5.8KB（新檔，純 hook）。剩下的 index.jsx 邏輯（state hub / JSX / handlers）耦合度高，再拆會 prop-drilling，留著當 state hub 即可。',
      '**動到的檔案（2 個 + 1 新檔）**：`src/components/ContextMenu/index.jsx`（移除 80 行 position/drag/dismiss code + `useRef` / `useCallback` import + 換成 hook call）/ `src/components/ContextMenu/useContextMenuPosition.js`（新檔，5.8KB）/ `src/data/changelog/current.js`（本條）/ `.claude/backlog.md`（後續批次拆檔段加 ContextMenu 到「已解」）。',
      '**驗證**：`npm run build` pass。Mental trace：hook 把原本散在 component 內的 4 個 effect + 2 個 callback + 2 個 state + 2 個 ref 整包移出，行為等價（同 dependencies、同 cleanup）。Caller 只需把 `ref` 接到 `<div>` + `startDrag` 接到 ☰ button + 讀 `adjusted` / `dragging` 即可。',
      '**拆檔輪收尾**：PR-1 (c13.js)、PR-2 (storage.js)、PR-3 (ContextMenu) 全部完成，backlog「後續批次拆檔」段 3 個明確項目全部消解。',
    ],
  },
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

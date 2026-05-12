/**
 * Changelog "current tip" — new entries since last freeze land here.
 * When this file grows beyond ~7KB, freeze: rename to c{next}.js + reset to [].
 * Entries are newest-first within file.
 */
export default [
  {
    date: '2026-05-12',
    title: 'FlowTable 欄寬可拖曳調整 — 每 user 跨流程記住偏好 + 一鍵重設',
    items: [
      '**緣由**：使用者「下方表格可以自己調整欄寬」+「Q4 採用 a 重設欄寬」（只 toolbar 按鈕、不雙擊邊）。FlowTable 30 欄、固定 sticky width / min-w-260 / min-w-140，內容多時擠到看不清。',
      '**實作（方案 B：自製 drag handle + colgroup）**：(1) 新增 `src/components/FlowTable/useColumnWidths.js` hook — state + localStorage I/O + min 60 / max 600 clamp + 「user override 才存」sparse 格式 (2) `<table>` 改 `tableLayout: fixed` + 加 `<colgroup>` 每欄一個 `<col style.width>`、widths 從 hook 來、user 改 → col 改 → 整欄（th + td）跟著縮放 (3) `ColResizeHandle` 8px 透明 strip on th 右邊緣，hover 變藍、pointerDown 開始 drag、window-level pointermove/pointerup 處理（防止 cursor 離開 th 失去事件）(4) Toolbar 加「重設欄寬」按鈕 — only `hasOverrides` 時顯示、一鍵清掉所有 user override (5) `getStickyMap` 改成吃 current widths、user resize 後 sticky 欄 left offset 自動重算。',
      '**Per-user localStorage 跨流程**：key `bpm_flow_table_col_widths`、儲存格式 sparse object `{ "3": 320, "5": 180 }` 只記改過的、未改的維持 defaults。schema 改動（加減 column）user override 仍對得上（用 index 當 key）。',
      '**Default widths**：sticky 4 欄維持原值 100/160/110/260；wide 欄 260（任務名稱 / 重點 / 重要輸入 / 任務關聯說明）；narrow 欄 140（任務角色 / 產出 / 參考文件）；aux 欄 separator 24px（不可拉）/ 非 separator 140px。',
      '**對其他 toggle 不影響**：(a) 「適應內容高度」開啟 + user 縮窄欄寬 → textarea 換行更多 → row 變高（user 自負，trade-off acceptable）(b) 「隱藏輔助欄位 / L3」隱藏的 column 不在 colgroup 渲染、widths state 仍保留供再開時用 (c) 匯出 PNG / Excel 不受影響（兩者跟網頁 col widths 無關）。',
      '**驗證**：`npm run build` 通過。FlowTable.jsx 從 16.6KB → 19.5KB（仍在 20KB 硬上限內、但接近、後續若再大需拆檔）。useColumnWidths 獨立檔 2KB。',
      '**動到的檔案（3 個）**：`src/components/FlowTable/useColumnWidths.js`（新檔 hook）/ `src/components/FlowTable.jsx`（DEFAULT_COL_WIDTHS + ColResizeHandle + colgroup + toolbar 按鈕 + 改 getStickyMap）/ `src/data/changelog/current.js`（本條）。',
    ],
  },
  {
    date: '2026-05-12',
    title: '移除錯落 toggle 功能（含 staggerLanes 底層邏輯）+ 補 PR #204 日期',
    items: [
      '**緣由**：使用者：「錯落 toggle 功能請移除，測試後確定不要錯落了」。錯落是 preview branch 的視覺實驗（奇數泳道右移 COL_W/2 = 92px）— Header 按鈕在 PR #197 已隱藏、底層 staggerLanes / laneXOffset 邏輯保留至今、確定不採用後一併清除避免 dead code。',
      '**移除內容**：(1) `computeLayout.js` 拿掉 `flow.staggerLanes` 解構 + `laneXOffset` array + `maxLaneXOffset` reduce + cx 計算的 offset 加項 + svgWidth 的 maxLaneXOffset 加項 (2) `Header.jsx` 清掉「未來決定 ship 時把按鈕加回來」comment block (3) **不需 migration**：舊有 stored data 若帶 `flow.staggerLanes: true` 在新版會被自動忽略（computeLayout 不再解構）、無視覺差。',
      '**順手補 PR #204 日期**：上輪 fix `parseL4SortKey` PR #204 寫條目時用 local 日期 `2026-05-11`、但實際 merge 在 UTC `2026-05-12T06:04:53Z`（跨 UTC 日界）— 違反 CLAUDE.md §4 規則 5「date 對齊 merged_at」。此 PR 把該條目 date 改成 `2026-05-12`。',
      '**驗證**：`grep staggerLanes\\|laneXOffset\\|maxLaneXOffset src/` 只剩凍結 `c27.js` 歷史記錄（不動）。`npm run build` 通過。',
      '**動到的檔案（4 個）**：`src/diagram/layout/computeLayout.js`（拿掉 stagger 邏輯）/ `src/components/FlowEditor/Header.jsx`（清 stale comment）/ `.claude/backlog.md`（錯落 OBSOLETED 條目）/ `src/data/changelog/current.js`（本條 + PR #204 日期修正）。',
    ],
  },
  {
    date: '2026-05-12',
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

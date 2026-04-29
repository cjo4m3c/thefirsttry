/**
 * Changelog "current tip" — new entries since last freeze land here.
 * When this file grows beyond ~7KB, freeze: rename to c{next}.js + reset to [].
 * Entries are newest-first within file.
 */
export default [
  {
    date: '2026-04-29',
    title: '表格欄寬統一 + L3 欄位可隱藏（預設隱藏）',
    items: [
      '**緣由**：使用者：「(1) L3 編號 / L3 名稱在頁面上方已有，瀏覽時不需要，但下載 Excel 時需要。請設成正常寬度（≥ 5-7 中文字）並加 toggle 控制 (2) L4 任務編號 / 任務負責角色 / 任務產出成品三欄寬度應一致，至少 5-7 中文字」。',
      '**ReadCell 寬度策略一致化**：移除 `max-w-[180px]` 上限改成 `min-w-[140px]`（≈ 8-9 中文字，滿足 5-7 字下限）。所有 ReadCell（L3 編號 / L3 名稱 / L4 任務編號）統一最小寬度 140px，內容多自然撐開。`wide` ReadCell（任務關聯說明）`min-w-[260px]` 不變。',
      '**RoleCell 寬度提升**：`min-w-[100px]` → `min-w-[140px]`，跟 L4 任務編號 / 任務產出成品（EditCell 預設 140）三欄統一。',
      '**L3 欄位可隱藏 toggle**：`FlowTable.jsx` 加 `showL3` state + localStorage 持久化（key `bpm_flow_table_show_l3`，預設 `false`）。標題列右側加按鈕「顯示 L3 欄位 ▼」/「隱藏 L3 欄位 ▲」，藍色 outlined 風格，hover 淡藍。thead `<th>` 過濾 i=0/1；tbody 條件 render。',
      '**Excel 匯出仍包含全部 10 欄**：toggle 只影響畫面顯示，匯出資料完整（使用者明確要求）。`EXCEL_HEADERS` 結構不動。',
      '**動到的檔案**：`src/components/FlowTable.jsx`（ReadCell 寬度 / RoleCell 寬度 / showL3 state + toggle button + thead/tbody 條件 render）/ `src/data/changelog/current.js`（本條）。`build` 通過。',
    ],
  },
  {
    date: '2026-04-29',
    title: '捲動操作優化：表格預設 2 行 + Toolbar/Thead 互斥 sticky',
    items: [
      '**緣由**：使用者：「(1) 下方表格的預設高度調整為 2 行 (2) 網頁向下捲動時，流程圖的標題列可以一直置頂 (3) 捲動到表格的時候，換表格標題列位置固定」。主要使用瀏覽器 Chrome / Edge（同 Chromium 引擎）。',
      '**FlowTable textarea rows 3→2**：每筆任務的編輯欄預設高度從 ~72px 降到 ~48px，畫面密度提升一倍；保留 `resize-y` 讓使用者按需手動拉高。',
      '**Toolbar sticky（流程圖標題列置頂）**：`DiagramRenderer/index.jsx` 把 `<DiagramToolbar>` 包進 `sticky top-[56px] z-10 bg-[#F5F8FC] border-b border-gray-200 shadow-sm pb-1` wrapper。`top-[56px]` = Header 實際渲染高度（深藍 Header `px-6 py-3` + 內容 input/button ~32px = 56-58px）。Toolbar 的 sticky 容器 = DiagramRenderer wrapper（非 window），所以 SVG 區結束就自然釋放，不需 JS。',
      '**Thead sticky（表格標題列置頂）**：`FlowTable.jsx` thead 內每個 `<th>` 加 `sticky top-[56px] z-[5] bg-gray-100`。把背景 `bg-gray-100` 從 `<tr>` 移到 `<th>`（sticky 元素必須自帶不透明背景，不然下方 tbody 會穿透；瀏覽器對 `<tr>` sticky 支援不一致，套在 `<th>` 最穩）。',
      '**互斥行為「零 JS」**：靠 CSS sticky 的天然容器邊界 — Toolbar 的 sticky 容器 = DiagramRenderer wrapper（高度 = SVG + Toolbar），當頁面捲過 SVG 進入表格區，wrapper 邊界已過 → Toolbar 釋放隨內容捲走；同瞬間 Thead 進入 viewport，sticky top:56 接手。中間 0 px 空檔，視覺平滑。',
      '**Chrome / Edge 相容**：`overflow-x-auto` 容器內的垂直 sticky 在 Chromium 完全依規範運作（sticky 找 relevant axis 的 scrolling ancestor，垂直 sticky 不被祖先 horizontal overflow 干擾）。Safari / Firefox 未列為優先支援。',
      '**業務規格文件 §13.8「sticky 浮層 offset」新增**：`docs/business-spec.md` §13 末加 §13.8，含 Header 高度 ≈ 56px 量測值、3 個 sticky 元素位置表（Header / Toolbar / Thead）、互斥邏輯說明、**Header 高度漂移防護**清單（改 Header 前 grep `top-\\[56px\\]` 同步調整下游）、目標瀏覽器宣告。CLAUDE.md 標題列指引更新「13 章」。',
      '**動到的檔案（4 個）**：`src/components/FlowTable.jsx`（rows + thead sticky）/ `src/components/DiagramRenderer/index.jsx`（toolbar wrapper）/ `docs/business-spec.md`（+§13.8）/ `CLAUDE.md`（章節數更新 + sticky 提示）/ `src/data/changelog/current.js`（本條）。`build` 通過。',
      '**驗證**：build 通過。視覺驗證待部署 — 三個情境：(1) 整頁頂端：Header + Toolbar 都黏住 (2) 捲到 SVG 中段：兩者都黏住 (3) 捲到表格：Toolbar 已捲走、Thead 接手在 top-56 處。',
    ],
  },
  {
    date: '2026-04-29',
    title: '編號規則新增 `_s` 後綴（子流程調用不佔順號）+ start anchor `-0_g` 修正',
    items: [
      '**緣由**：使用者：「L4 編號規則想統一改用四段式 + 特殊規則」，要點：(4) 閘道為第一個任務時編號順序應為 `X-Y-Z-0 → X-Y-Z-0_g → X-Y-Z-1`；(6) 子流程調用編號用 `X-Y-Z-N_s`（不佔獨立 N 數字編號）；(7) 連續子流程 `_s1`、`_s2`…，且 `_s1 → _g → _s2` 中間閘道不打斷 `_s` 連續性。',
      '**問題 1（小）— start 後接閘道編號錯誤**：現況 `computeDisplayLabels` `lastTaskBase` 在 start 時不更新（只在 regular task 後更新），閘道接 start 會 fallback 到 `${prefix}-${taskCounter}` 即 `-1_g`，違反規格 §2 (4)「`-0 → -0_g → -1`」順序。修正：start 也設 `lastTaskBase = ${prefix}-0`，重置 `gwConsec` / `spConsec`。',
      '**問題 2（大）— 子流程 `_s` 後綴全新概念**：現況 subprocess 任務（`type === l3activity` 或 `connectionType === subprocess`）走 regular task 邏輯**佔用 `taskCounter`**。新規格要求不佔順號 + 用 `_s` 後綴。新增 `L4_SUBPROCESS_PATTERN /^\\d+-\\d+-\\d+-\\d+_s\\d*$/`；`L4_NUMBER_PATTERN` 擴充接受 `_s\\d*`；`computeDisplayLabels` 加 isSubprocess 判斷 + `spConsec` 計數器（`_s` 不佔 `taskCounter`，不重置 `gwConsec`）。',
      '**問題 3（小，連帶 #2）— `_g` / `_s` 連續性互不打斷**：規格 §2 (7) 範例 `_s1 → _g → _s2` — 中間閘道在計數上不打斷 `_s`。修正：subprocess 走獨立分支不重置 `gwConsec`；同理 gateway 也不重置 `spConsec`。stored l4Number 處理一致：`mGW` / `mSP` 各自只更新對應計數器，另一個保留。',
      '**子流程調用 = 現有 l3activity 元件改編號**（解讀 a）：使用者確認「子流程調用」就是現有的「L3 活動（子流程調用）」元件（`type === l3activity` + `connectionType === subprocess`），不是新增元件。**圖上元件仍顯示所調用的 L3 編號**（不變），只改 L4 編號欄位用 `_s`。元件繪製、顏色、形狀全部不動。',
      '**舊資料 migration**：`storage.js` 新增 `migrateSubprocessSuffix`（mirror `migrateGatewaySuffix`）— 載入時掃 `type === l3activity` 任務，l4Number 不含 `_s` → 改寫為 `${predecessor}_s` 或 `_s2/_s3`（sibling-aware）。`computeDisplayLabels` 對 stored l4Number 缺 `_s` 的 subprocess 採「skip stored, fall through to generated」防禦邏輯（migration 沒跑到的情況下也會自動算對）。',
      '**Excel 匯入檢核加強**：`validateNumbering` 加「subprocess row 必有 `_s` 後綴」檢核（同既有 `_g` 邏輯）；`hasGTag || hasSTag` 統一檢核前綴必對應既有 L4（**含 `-0` 開始事件**作為 anchor）；錯誤訊息列出 `_s` 範例。`l4TaskSet` 收集時排除 `_g\\d*|_s\\d*` 兩種後綴。',
      '**圖層 hide 後綴**：`TasksLayer.jsx` line 22 hide pattern 加 `_s\\d*`（規則 4：`_s` 編號不顯示在元件上，但 l3activity 已用 `subprocessName` 取代，所以實質沒視覺變化，這是 fallback 防禦）。',
      '**connectionFormat NUM 規範擴充**：`NUM` / `NUM_HEAD` / `RE_LOOP_LEGACY` 三個 regex 加 `_s\\d*` 變體，讓「序列流向 1-1-1-1_s」這類 flowText 能正確 parse。',
      '**業務規格文件 §2 大改**：原 5 小節擴成 7 小節 — §2.1 表格加 2 列子流程後綴 / §2.2 加「第一個非閘道任務 = `${L3}-1`」明文 / §2.3 改「`_g` / `_s` 共用前綴規則」+ 加閘道為第一元素時用 `-0` 範例 / §2.4 新增「連續性判定」`_g` / `_s` 互不打斷 / §2.5 新增「禁止英文字母結尾」明文表 / §2.6 舊資料相容加 `migrateSubprocessSuffix` / §2.7 對應實作 6 個 regex 常數 + flowSelectors 路徑更新。',
      '**helpPanelData 同步**：NUMBERING array 加閘道接 `-0` 範例 + 子流程 `_s` 規則明寫 / IMPORT_RULES 拆成「閘道 `_g` 必填」「子流程 `_s` 必填」「`_g`/`_s` 前綴必對應既有 L4」三條 / VALIDATION 條目「L4 編號規則」加子流程 `_s` 範例 / ELEMENTS 中 L3活動條目加 `_s` 編號規則。',
      '**CLAUDE.md §3 同步**：規則摘要加 `_s` 後綴 / `_g`/`_s` 共用 anchor 原則 / 子流程關鍵字 `調用子流程 X-Y-Z` / regex 單一來源加 `L4_SUBPROCESS_PATTERN` / migration 同步加 `migrateSubprocessSuffix`。',
      '**動到的檔案（10 個）**：`src/utils/taskDefs.js`（regex + 註解）/ `src/model/flowSelectors.js`（computeDisplayLabels 大改）/ `src/model/connectionFormat.js`（NUM regex）/ `src/utils/storage.js`（+migrateSubprocessSuffix）/ `src/utils/excelImport.js`（validateNumbering 擴充）/ `src/components/DiagramRenderer/TasksLayer.jsx`（hide regex）/ `docs/business-spec.md`（§2 重寫）/ `src/data/helpPanelData.js`（4 處）/ `CLAUDE.md`（§3）/ `src/data/changelog/current.js`（本條 + freeze c17）。',
      '**驗證 — 七視圖一致性 trace**：所有 7 個視圖（編輯器下拉、FlowTable、Excel 匯入、Excel 匯出、drawio、PNG export、流程圖 on-canvas）都透過 `computeDisplayLabels` 取得 `l4Numbers`（七視圖唯一 source of truth），單點修改自動同步。`build` 通過。',
      '**Changelog freeze**：current.js 加完此條後 12KB（超 7KB 軟上限），凍結 PR #88 + PR #89 兩條到 `c17.js`；`index.js` 加 c17 import；current.js 重置只留本 PR 條目。',
    ],
  },
];

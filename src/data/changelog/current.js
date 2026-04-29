/**
 * Changelog "current tip" — new entries since last freeze land here.
 * When this file grows beyond ~7KB, freeze: rename to c{next}.js + reset to [].
 * Entries are newest-first within file.
 */
export default [
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

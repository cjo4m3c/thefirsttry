/**
 * Changelog "current tip" — new entries since last freeze land here.
 * When this file grows beyond ~7KB, freeze: rename to c{next}.js + reset to [].
 * Entries are newest-first within file.
 */
export default [
  {
    date: '2026-05-05',
    title: '外部關係人互動編號後綴 `_w` → `_e` 全 codebase rename + 凍結 c24',
    items: [
      '**緣由**：使用者：「外部互動、外部角色重構」— 2026-04-30 引入時用 `_w`（取自 external 一字「w」rld 的隨意命名），但 `_e` 更直觀對應 external interaction，且跟其他後綴（`_g` gateway / `_s` subprocess）的字母縮寫邏輯一致。趁輔助欄位 PR-A/B/C 落地後 codebase 相對穩定，把 `_w` 全面改名為 `_e`，避免日後越積越多 reference 難改。',
      '**Step 1 — Regex SOT（`utils/taskDefs.js`）**：`L4_NUMBER_PATTERN` / `L4_INTERACTION_PATTERN` 從 `_w\\d*` 改為 `_e\\d*`。註解明確標記「Renamed from `_w` to `_e` in 2026-05-05」+ legacy migration 入口參考。',
      '**Step 2 — Display label SOT（`model/flowSelectors.js`）**：`computeDisplayLabels` interaction branch 全套改 `_e`（counter `intConsec` / regex `/^(\\d+-\\d+-\\d+-\\d+)_e(\\d*)$/` / strip pattern `(_g\\d*|_s\\d*|_e\\d*)$` / output `${base}_e${intConsec}` / post-process run-length-1 → drop index）。`_e1 → _g → _e2` 連續性與 `_w` 時代行為一致。',
      '**Step 3 — Excel I/O（`utils/excelImport.js`）**：parser 嚴格只接受 `_e`（`isInteraction = /_e\\d*$/`）；`validateNumbering` 錯誤訊息與輔助範例改用「外部互動為 1-1-1-1_e」；前綴對應檢查 strip pattern 同步加 `_e\\d*`。**舊 `_w` Excel 檔不再被接受**（會在 `validateNumbering` 階段以「格式錯誤」擋下）— 想匯入舊檔請先用 localStorage 載入觸發 migration、再重新匯出。',
      '**Step 4 — Migration（`utils/storage.js`）**：`migrateInteractionSuffix` 強化為兩段式 — (a) 既有「`shapeType=interaction` 但無後綴」的 pre-2026-04-30 資料 strip 重推 (b) 既有 `_w\\d*$` 後綴的 2026-04-30~2026-05-04 資料同樣 strip 讓 `computeDisplayLabels` 重推為 `_e`。Idempotent — 已是 `_e` 的 task 不動。',
      '**Step 5 — UI / 顯示**：`DiagramRenderer/TasksLayer.jsx` hide regex `(_g\\d*|_s\\d*|_e\\d*|-0|-99)`、`utils/elementTypes.js` 註解與 `applyRoleChange` / `syncTasksToRoles` 的 strip 邏輯註解全更新、`model/validation.js` rule 3e 註解與 displayLabels 範例註解同步改 `_e`。',
      '**Step 6 — 文件三件組同步**：(a) `docs/business-spec.md §2.1 / §2.4 / §2.5 / §3 / §3.1` 編號表 / 連續性 / 字母結尾例外 / 元件表 / 不對稱 sync 章節全改 `_e` — 章節標題「外部關係人互動 — 不對稱 sync + `_e` 編號」 (b) `src/data/helpPanelData.js` NUMBERING / VALIDATION / ELEMENTS 含 `_w` 條目全改 (c) `CLAUDE.md §3` 三後綴 family 共用 anchor 規則範例改用 `_e`。',
      '**Step 7 — 凍結 c24**：current.js 累積到 76KB（PR #153 後沒再 freeze），遠超 7KB 軟上限。`current.js` → `c24.js` rename（內含 PR #153 / #154 / #155 / #156 / #157 / #158），`current.js` reset 成本條，`index.js` 加 c24 import。',
      '**驗證**：`npm run build` 通過，bundle size 不變（rename 不增邏輯）。grep audit 確認 src/ 內 `_w` 只剩 (a) `storage.js` 既有 legacy 偵測 regex (b) `taskDefs.js` 註解描述 rename 歷程 — 流程邏輯本身已完全切到 `_e`。',
      '**動到的檔案（11 個）**：`src/utils/taskDefs.js`（regex）/ `src/utils/storage.js`（migration 強化）/ `src/utils/excelImport.js`（嚴格 `_e`）/ `src/utils/elementTypes.js`（註解）/ `src/model/flowSelectors.js`（display label SOT）/ `src/model/validation.js`（註解）/ `src/components/DiagramRenderer/TasksLayer.jsx`（hide regex）/ `src/data/helpPanelData.js`（user-facing 文字）/ `docs/business-spec.md`（§2.1 / §2.4 / §2.5 / §3 / §3.1）/ `CLAUDE.md §3`（三後綴 family 範例）/ `src/data/changelog/current.js`（freeze + 本條）+ 新檔 `src/data/changelog/c24.js`（freeze 過去條目）/ `src/data/changelog/index.js`（加 c24 import）。',
    ],
  },
];

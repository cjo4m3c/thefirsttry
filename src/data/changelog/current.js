/**
 * Changelog "current tip" — new entries since last freeze land here.
 * When this file grows beyond ~7KB, freeze: rename to c{next}.js + reset to [].
 * Entries are newest-first within file.
 */
export default [
  {
    date: '2026-05-13',
    title: 'feat: 多結束事件編號用 `_x{K}` 後綴 — 拉齊外部 BPMN 連線 / Excel 公式規則',
    items: [
      '**緣由**：使用者比對 (1) BPMN 連線編號規範 (2) Excel 公式 (`LET(...xSuffix, IF(xTotal<=1,"","-99_x"&xCount)...)`) (3) FlowSprite 三方規則，發現 FlowSprite 缺「多結束事件 `_x` 後綴」邏輯：原本 `computeDisplayLabels` 多 end 全部 label 成 `-99`、撞 sortKey、視覺/編輯器/匯出都無法分辨。',
      '**情境決策**（使用者拍板 7 題）：(1) 多 end 用 `-99_x1` / `-99_x2`（不用字母）(2) 單一 end 保持 `-99`（不加 `_x1`，與 `_g`/`_s`/`_e` 單一不加數字慣例對齊）(3) `end` 與 `breakpoint` 合併計數器（同 `validation.isEnd` 既有定義）(4) `_x` 順序依 task list reduce 順序（與 `gwConsec`/`spConsec` 一致）(5) 流程圖完全隱藏（同 `-99`、`-0`、`_g*`、`_s*`、`_e*` 規則）(6) 舊資料缺 `_x` 或跳號自動補正 + Dashboard banner 提示一次 (7) 多開始事件保持全 `-0`（規則 1 §1 明文，不對稱但拉齊外部）。',
      '**核心改動**：(a) `src/utils/taskDefs.js` — `L4_END_PATTERN` 接受 `_x\\d+`、新增 `L4_END_X_PATTERN`、`L4_NUMBER_PATTERN` 加分支容納 `-99_x*` (b) `src/model/flowSelectors.js` — `computeDisplayLabels` pre-scan endTotal + 新增 `endConsec` 計數器，end 編號 position-derived 不 honor stored l4Number (c) `src/diagram/layout/columnAssign.js` — `parseL4SortKey` 接受 `x`、sortKey `99 + 0.001×K` (d) `src/components/DiagramRenderer/TasksLayer.jsx` — hide regex 加 `-99(_x\\d+)?` (e) `src/utils/excelImport/validators.js` — l4TaskSet 排除 `_x`（避免 `_g`/`_s`/`_e` 把 end 當 anchor）、錯誤訊息 + 規則說明加多 end 範例。',
      '**舊資料 migration**：新增 `migrateEndSuffix(tasks, l3Number)` in `src/utils/storage/migrations.js`，三類情況自動補正：(a) 舊 multi-end 全在 `-99` → 寫成 `_x1`/`_x2` (b) `_x` 跳號（`_x3` 但只 2 個）→ renumber 連續 (c) 單 end 但 stored `-99_x1` → 退回 `-99`。`storage.migrateFlow` 把 fixes 暫存在 `_endMigrationFixes`、`loadFlows` 轉成 `importWarnings` 條目「🔧 結束事件編號已自動更新（多結束事件對齊 BPMN 規則）：A → B」並 saveFlow 持久化 — 用戶看見 banner 一次，下次重新整理就消失。',
      '**規格同步**：`docs/business-spec.md` §2.1 加結束事件多個 row + 範例、§2.6 補 `migrateEndSuffix` 條目、§2.7 SOT 數量從 6 升到 7 個 regex 常數、§3 SOT 規則加 `-99_x\\d+` 推導、§6 顯示分層加完整後綴列表。`src/data/helpPanelData.js` NUMBERING_FORMAT 加「結束事件（多個）」條目（單一保留）、ELEMENTS 結束事件 purpose 補多 end 範例。',
      '**配套凍結**：current.js 在 PR 前已 17.5KB（超 §4 「>7KB 就凍結」門檻），本 PR 把 PR 前的所有條目搬到新 `c28.js`、current.js 重置只含本條，`index.js` 補 c28 import。',
      '**動到的檔案（8 個 src + 2 個 docs + changelog freeze）**：`src/utils/taskDefs.js` / `src/model/flowSelectors.js` / `src/diagram/layout/columnAssign.js` / `src/utils/storage.js` / `src/utils/storage/migrations.js` / `src/components/DiagramRenderer/TasksLayer.jsx` / `src/utils/excelImport/validators.js` / `src/data/helpPanelData.js` / `docs/business-spec.md` / `CLAUDE.md` §3 / `src/data/changelog/{current,c28,index}.js`（本條 + 凍結）。',
      '**驗證點**：(a) 單 end 流程仍顯示 `-99`、舊圖無感 (b) 兩 end 圖載入後 Dashboard banner 提示「結束事件編號已自動更新：-99 → -99_x1、-99 → -99_x2」(c) Excel 含 `1-1-1-99_x1`/`_x2` 匯入不被擋 (d) sortKey `99.001 < 99.002`，FlowTable / 流程圖排序穩定 (e) 流程圖兩個結束圓都不顯示編號（hide regex 命中）但編輯器 + 表格顯示完整 `_x1` / `_x2`。',
    ],
  },
];

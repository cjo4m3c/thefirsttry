/**
 * Changelog "current tip" — new entries since last freeze land here.
 * When this file grows beyond ~7KB, freeze: rename to c{next}.js + reset to [].
 * Entries are newest-first within file.
 */
export default [
  {
    date: '2026-05-13',
    title: '流程圖箭頭尖端 +50% — 提升與 L4 編號 pill 重疊時的辨識度（試 Option A）',
    items: [
      '**緣由**：使用者「箭頭的前端三角形位置跟編號重疊，還是會看不清楚」。根因：`TasksLayer` 在 `ConnectionArrow` 之後渲染（index.jsx line 319 → 328），L4 number pill (opacity 0.6 白底) 蓋在箭頭尖端上方、tip 被淡化 60% 看不清。',
      '**討論的 4 個方案**：(A) 放大 marker +50% (B) 降 pill opacity 0.6→0.4 (C) A+B 複合 (D) 拆 ArrowTipsLayer 到 TasksLayer 之後渲染。使用者選擇先試 A、最小改動可逆。',
      '**修法**：`src/components/DiagramRenderer/arrows.jsx` 6 個 marker 同比例放大：`markerWidth 8→12` / `markerHeight 6→9` / `refX 8→12` / `refY 3→4.5` / polygon points `"0 0, 8 3, 0 6"` → `"0 0, 12 4.5, 0 9"`。所有變體（ah / ah-hover / ah-hover-out / ah-hover-in / ah-dashed / ah-violation）統一放大維持 hover / violation 切色一致性。refX 同比例縮放確保 apex 仍對齊連線端點。',
      '**動到的檔案（2 個）**：`src/components/DiagramRenderer/arrows.jsx`（6 個 marker、加 3 行歷史註解）/ `src/data/changelog/current.js`（本條）。',
      '**驗證**：`npm run build` 通過。手動驗證點：(a) 一般連線箭頭尖端比原本明顯（佔 12×9 像素 vs 8×6）(b) hover 連線時藍色箭頭也跟著大 (c) 違規紅線箭頭也跟著大 (d) PNG / drawio 匯出仍正常 (e) 跟 L4 pill 重疊時辨識度提升、若仍不夠下一輪可考慮 D（ArrowTipsLayer 分層）。',
    ],
  },
  {
    date: '2026-05-13',
    title: '移除多 start / 多 end 儲存警告 — 合法 BPMN 拓樸不該每次跳 modal',
    items: [
      '**緣由**：使用者「上傳及儲存時，有多個開始事件不跳提醒（現在會提示）」+「有多個結束事件不跳提醒（現在會提示）」。原 rule 7 / 8（2026-04-29 加）跳的「BPMN 一般建議單一起點，建議確認是否刻意設計多個入口」/「多個終點可接受（不同情境收尾），建議確認」每次儲存都打斷流程。',
      '**研究結論**：審計 38 條規則後確認 — (a) 多 start / end 是合法 BPMN 拓樸（PR #210 剛加的 `_x{K}` 後綴就是為多 end 而設）(b) 移除這兩條 warning 不影響「必須要有 start / end」「start 不能有 incoming」「end 必須有 incoming」等 6 條 blocking 規則。',
      '**修法**：(1) 刪 `src/model/validation.js` 第 80-88 行（9 行 multi-start / multi-end warnings block）+ 留 4 行註解說明歷史 (2) 刪 `src/data/helpPanelData.js` 第 250-258 行對應規則描述條目。「上傳路徑」沒有直接觸發這兩條警告 — 但使用者匯入單一 L3 後自動進 FlowEditor、習慣性點儲存就會中 → 移除後同步消失。',
      '**動到的檔案（3 個）**：`src/model/validation.js`（移除 9 行 + 加 4 行歷史註解）/ `src/data/helpPanelData.js`（移除 1 個規則條目）/ `src/data/changelog/current.js`（本條）。docs/business-spec.md 沒提到這兩條 warning、不用改。',
      '**驗證**：`npm run build` 通過。手動驗證點：(a) 建有 2 個 start 的流程、儲存 → 不再跳 warning modal、直接存 (b) 建有 2 個 end 的流程、儲存 → 同上 (c) 沒有 start 的流程仍 block 儲存（rule 1）(d) start 被連入仍 block 儲存（rule 4） — blocking 規則完整保留。',
    ],
  },
  {
    date: '2026-05-12',
    title: 'fix: 開始事件連線兩端點都拉不動 — phase3e 漏處理 start',
    items: [
      '**緣由**：使用者「我發現連到開始事件元件的線段不能自主拖曳選擇要連線的出發端點，及連過去其他元件的結束端點」。從 start 出發的連線、任一端點拖了沒效。',
      '**Root cause**：`src/diagram/layout/phase3e.js` line 46 排除 start：`else if (task.type !== "end" && task.type !== "start")`。phase3e 是把 `task.connectionOverrides` apply 到 routing map 的階段。`useDragEndpoint` → `updateConnectionOverride` 把 override **儲存** 到 `startTask.connectionOverrides[nextTaskId]` 是 OK 的、但下次 render `runPhase3e` 跳過 start → routing map 沒拿到 override → 視覺上仍是預設 `right` / `left`。',
      '**兩個端點同 bug**：source 端拖（exitSide on start）和 target 端拖（entrySide on next-task）都被同一個 gate 擋 — 因為 override 都存在 `start.connectionOverrides`（fromId = start.id）。',
      '**修法**：拿掉 `&& task.type !== "start"`，讓 start 走跟一般 task / l3activity / interaction 同一個 override apply 路徑（一行 + 三行註解）。`end` 排除保留 — end 沒有 outgoing → 永遠不會有 override，是 defensive dead code。',
      '**動到的檔案（2 個）**：`src/diagram/layout/phase3e.js`（一行 + 註解）/ `src/data/changelog/current.js`（本條）。',
      '**驗證**：`npm run build` 通過。手動驗證點：(a) 點「start → 5-1-1-1」連線、看到兩端點 (b) 拖 source 端從 right → bottom、連線從 start 底部出 (c) 拖 target 端從 left → top、連線進 next task 頂部 (d) 「重設此連線端點」清掉 override。',
    ],
  },
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

/**
 * Changelog "current tip" — new entries since last freeze land here.
 * When this file grows beyond ~7KB, freeze: rename to c{next}.js + reset to [].
 * Entries are newest-first within file.
 */
export default [
  {
    date: '2026-05-06',
    title: 'changelog freeze c26（current.js 28KB → 0）+ backlog log PR #196',
    items: [
      '**緣由**：使用者「請執行並合併在 197」— PR #197 原本只 log PR #196 done，順手把已過 7KB 凍結門檻 4 倍的 `current.js`（28KB）一起凍結成 c26，避免之後每個 PR 改 changelog 都更慢。',
      '**Freeze 步驟**：(1) `git mv src/data/changelog/current.js src/data/changelog/c26.js` (2) 改 c26.js 檔頭 doc-comment 標明 frozen 日期 + 涵蓋範圍 (3) 新建空 `current.js`（只含 `export default []`） (4) `index.js` 加 `import c26 from \'./c26.js\'` + spread 順序放在 c25 之前。',
      '**Backlog 更新（已隨 PR #197 commit）**：item #2「自動連線優化、閘道避開」更新為 Phase A + B 已 DONE（PR #196 涵蓋）+ Phase C grid-based path-finder 仍 open；2026-05-06 已完成段落新增 PR #196 條目。',
      '**動到的檔案（4 個）**：`src/data/changelog/c26.js`（新檔，從 current.js rename + 改檔頭）/ `src/data/changelog/current.js`（reset）/ `src/data/changelog/index.js`（import c26 + spread）/ `.claude/backlog.md`（PR #196 done + item #2 更新）。',
    ],
  },
  {
    date: '2026-05-06',
    title: '隱藏 Header「錯落」按鈕（保留 staggerLanes 邏輯，未確定的功能不在正式站曝光）',
    items: [
      '**緣由**：使用者：「在正式站裡不可以有錯落這個按鈕，請保留錯落的設計，但是先不要出現任何按鈕，這是還沒有確定要的功能」。錯落排列是 preview branch 的視覺實驗（奇數泳道右移 COL_W/2 = 92px）— 上線測試後使用者尚未決定要不要 ship、所以從 UI 拿掉但底層保留。',
      '**修法**：(1) `Header.jsx` 移除「錯落」按鈕 + 對應 props (staggerLanes / onToggleStagger) (2) `FlowEditor/index.jsx` 移除 `toggleStagger()` function + 對 Header 的 props pass (3) **不動** `computeLayout.js`：`flow.staggerLanes` 仍會從 stored data 讀進來（早期 preview 開過的 flow 會 honor 這個 flag）+ `laneXOffset` 計算邏輯完整保留。未來決定 ship 時把 Header 按鈕加回來即可、無需重做底層。',
      '**動到的檔案（3 個）**：`src/components/FlowEditor/Header.jsx`（移除按鈕 + props）/ `src/components/FlowEditor/index.jsx`（移除 toggleStagger + props pass）/ `src/diagram/layout/computeLayout.js`（更新註解標明邏輯保留 + UI 暫隱藏）。',
    ],
  },
];

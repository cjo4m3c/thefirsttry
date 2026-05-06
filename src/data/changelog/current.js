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
      '**動到的檔案（4 個）**：`src/data/changelog/c26.js`（新檔，從 current.js rename + 改檔頭）/ `src/data/changelog/current.js`（reset 成 `[]`）/ `src/data/changelog/index.js`（import c26 + spread）/ `.claude/backlog.md`（PR #196 done + item #2 更新）。',
    ],
  },
];

/**
 * Changelog "current tip" — new entries since last freeze land here.
 * When this file grows beyond ~7KB, freeze: rename to c{next}.js + reset to [].
 * Entries are newest-first within file.
 */
export default [
  {
    date: '2026-04-30',
    title: 'changelog freeze c23 — current.js reset 避免並行 PR 衝突',
    items: [
      '**緣由**：current.js 累積到 ~19KB（PR #122 / #123 / #124 / PR-A #126 / PR-B #127 / PR-C #128 六條合計），遠超 CLAUDE.md §4 訂的 7KB freeze threshold。歷史教訓：PR #119 vs #118 在 current.js 撞 conflict 過、要手動 rebase。先 freeze c23，避免下次兩個 feature 並行 PR 同樣再撞一次。',
      '**動到的檔案（3 個）**：`src/data/changelog/c23.js` 新（六條 entry frozen）/ `src/data/changelog/current.js` reset 成空陣列 + 本條 / `src/data/changelog/index.js` 加 c23 import。`build` 通過。',
    ],
  },
];

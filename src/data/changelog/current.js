/**
 * Changelog "current tip" — new entries since last freeze land here.
 * When this file grows beyond ~7KB, freeze: rename to c{next}.js + reset to [].
 * Entries are newest-first within file.
 */
export default [
  {
    date: '2026-05-19',
    title: 'Dashboard 表格 view 優化 — segment 對齊、表頭 checkbox 全選、5 欄可排序、動作 6 顆展開、日期不折行',
    items: [
      '**緣由**：使用者提 5 項表格 view 優化 — (1) 切換 segment 高度跟右側按鈕/下拉一樣 (2) 點標題列 checkbox 全選 (3) 除動作外都可排序 (4) 動作按鈕全展開不收合 (5) 兩列日期螢幕 100% 不能折成 4 列。',
      '**1. ViewSwitcher 高度對齊**（`Dashboard/ViewSwitcher.jsx`）：segmented control 從 `py-1 text-xs`（~28px）對齊到 `h-[38px]` + `p-0.5` + inner `h-full px-3 text-xs`，跟右側 sort dropdown / 上傳 / 新增 button（py-2 + text-sm ≈ 36-38px）同高。',
      '**2. 表頭 checkbox 全選**（`Dashboard/FlowListTable.jsx`）：新 `HeaderCheckbox` 元件 — 沿用 Dashboard 既有 `selectAll` / `clearSelected` callback、用 ref + useEffect 設 `HTMLInputElement.indeterminate` 處理部分選中態。total=0 disabled、全選 → `checked`、部分 → `indeterminate`、未選 → `unchecked`。點擊：if 全選 → 清空，否則 → 全選。',
      '**3. 5 欄表頭可排序**（編號 / 名稱 / 角色 / 任務 / 日期）：新 `SortableHeader` 元件 — 點擊在 `column-asc` / `column-desc` 之間切換。跟外面 sort dropdown 共享同一個 `sortKey` state（完全同步、雙向）— Dashboard 把 `sortKey` + `setSortKey` 透傳給 FlowListTable。Active 欄顯示 `↑` / `↓`、非 active 欄 `opacity-30` 提示可排序。`sortFlows.js` 新增 `name-asc` / `name-desc` case + SORT_OPTIONS 兩條 `L3 名稱 ↑↓`。checkbox / pin / 主要角色 三欄不排序（per 使用者選 A）。',
      '**4. 動作 6 顆全展開**：拆掉 `DownloadMenu` dropdown、展成 6 顆 `<Button size="xs">`：編輯 / 複製 / PNG / Drawio / Excel / 刪除。動作欄寬從 `w-72` (288px) → `w-[22rem]` (352px) 容納 6 顆。',
      '**5. 日期欄不折行**：日期 `<td>` 加 `whitespace-nowrap`、欄寬從 `w-44` (176px) → `w-64` (256px) 確保 `建立：2026/05/18 下午02:30` / `更新：...` 兩列在常見視窗（1280+）不會折成 4 列。主要角色欄相應從 `w-56` 收到 `w-48` (192px) 釋放空間。',
      '**Changelog freeze**：current.js 累積到 49KB（11 條未凍）、本 PR 凍結為 `c29.js`、`index.js` 加 import、current.js 重置（之後維護要確實在 7KB 凍結）。',
      '**動到的檔案（6 個）**：`src/components/Dashboard/ViewSwitcher.jsx`（高度對齊）/ `src/components/Dashboard/FlowListTable.jsx`（HeaderCheckbox + SortableHeader + 6 顆展開 + 日期 nowrap + 欄寬重排）/ `src/components/Dashboard/sortFlows.js`（name-asc/desc）/ `src/components/Dashboard/index.jsx`（透傳新 props）/ `src/data/changelog/c29.js`（新、凍結之前累積）/ `src/data/changelog/index.js`（加 c29 import）/ `src/data/changelog/current.js`（重置 + 本條）。',
      '**驗證**：`npm run build` 通過。手動驗證：(a) 卡片/表格 segment 高度跟旁邊 dropdown / button 平齊 (b) 表頭 checkbox 點擊全選 / 取消、部分選中時 indeterminate (c) 點編號/名稱/角色/任務/日期 表頭排序、會切 ↑↓、跟右上 sort dropdown 同步 (d) 動作欄 6 顆按鈕全部可見不收合 (e) 螢幕 100% (1280+) 日期欄兩列不折成四列。',
    ],
  },
];

export default [
  {
    date: '2026-05-19',
    title: 'Dashboard 表格 view 再優化 — 字級 spec 13px、列高同高、名稱加寬、動作加大 + DesignGuidelinePanel 移除文件位置',
    items: [
      '**緣由**：使用者三項表格 view 優化 + 一項 panel 調整：(1) ViewSwitcher 字級拉齊右側按鈕/下拉、是否違反 spec？ (2) 每列高度相同 (3) 螢幕 100% 時 L3 名稱加寬、動作按鈕加大 (4) 設計規範彈窗移除「文件位置」section。',
      '**設計規範檢視**：spec §13.9.3 規定字級 7 階 `32/22/17/15/13/12/11`、明文「預設 UI · 按鈕 · 表格 = fs-body 13px」。Audit 後發現 sort dropdown (text-sm 14px) / 上傳 (text-base 16px) / 新增 (text-base 16px) / 表格列 (text-sm 14px) 早已違規不在 7 階。**使用者選整批拉齊到 13px**（最符合 spec、順便修既有違規）。',
      '**1. 字級拉齊 spec 13px**：`ViewSwitcher` inner button `text-xs` → `text-[13px]`、Dashboard `sort select` `text-sm` → `text-[13px]`、`上傳 Excel / + 新增 L3` 加 `text-[13px]`、`FlowListTable` table `text-sm` → `text-[13px]`、日期 cell `text-xs` → `text-[11px]` (fs-caption)。',
      '**2. 列高同高策略**：truncate `…` + hover tooltip — (a) L3 名稱 cell 包 `<div className="truncate" title={name}>`、超出顯示 `…`，hover 看全名 (b) `RolesPreview` 從 `flex-wrap` → `flex-nowrap overflow-hidden`、cap 從 2 chips → **1 chip + N**（順帶釋出欄寬給名稱）(c) 動作 `flex-wrap` → `flex-nowrap`。table 加 `table-fixed` 讓 truncate 在明確欄寬下生效。',
      '**3. 名稱欄加寬 + 動作 button 加大**：動作 6 顆 `size="xs"` → `size="sm"`（11px → 12px、padding `py-0.5` → `py-1`）；主要角色欄 `w-48` → `w-32` 釋出 64px 給名稱；名稱欄從 ~136px → ~200px（1280 視窗）。動作欄維持 `w-[22rem]` 容納 sm 6 顆（~308px + buffer）。',
      '**4. DesignGuidelinePanel 移除「文件位置」section**：使用者：「設計規範 popup 裡面不要放文件位置資訊」— 移除 `Section title="文件位置"` 整段（原列出 tokens.css / ui/ / elementTypes.js / business-spec.md / tailwind.config.js 5 個路徑）。Panel header subtitle 仍有 `docs/business-spec.md §13.9` 引用作為連結提示、不重複。',
      '**動到的檔案（5 個）**：`src/components/Dashboard/ViewSwitcher.jsx`（字級 13px）/ `src/components/Dashboard/index.jsx`（sort/上傳/新增 字級 13px）/ `src/components/Dashboard/FlowListTable.jsx`（table-fixed + 字級 13px + truncate + 主要角色 1 chip+N + 動作 sm + 欄寬重排）/ `src/components/DesignGuidelinePanel.jsx`（移除文件位置 section）/ `src/data/changelog/current.js`（本條）。',
      '**全站 audit 警告**：跑完字級 audit 全站還有 **162 處違規**（text-sm 80 / text-base 57 / text-lg 10 / text-xl 8 / text-2xl 6 / text-5xl 1）— FlowEditor Header (22 處)、ConnectionSection (28)、FlowTable (15)、Wizard (13) 為大宗。本 PR 只處理 Dashboard 表格 view 範圍、其他違規列入下批處理 backlog。',
      '**驗證**：`npm run build` 通過。手動：(a) 卡片/表格 segment + sort + 上傳 + 新增 + 表格列字 視覺一致 13px (b) 名稱超長顯示 `…`、hover 看到 tooltip 全名 (c) 主要角色 1 chip + N (d) 動作 6 顆比之前大、不 wrap (e) 列高一致 (f) 點「設計規範 ▾」彈窗、底部沒有「文件位置」section。',
    ],
  },
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

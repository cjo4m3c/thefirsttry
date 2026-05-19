/**
 * Changelog "current tip" — new entries since last freeze land here.
 * When this file grows beyond ~7KB, freeze: rename to c{next}.js + reset to [].
 * Entries are newest-first within file.
 */
export default [
  {
    date: '2026-05-19',
    title: 'Dashboard 拆 useDashboardFilters / useBulkActions hook + Wizard / RightDrawer / ChangelogPanel / HelpPanel inline Tailwind 色全清',
    items: [
      '**緣由**：使用者「依推薦修正」— 4 個待處理 design system 收尾：(R4) Dashboard/index.jsx 16KB 軟超 (R1) Wizard inline tailwind ~12 處 (R2b) RightDrawer ~8 處 (R2c) ChangelogPanel + HelpPanel ~16 處。DrawerContent 2 hover badge 不動（特殊定位、不適合 Chip variant）。',
      '**A. Dashboard 拆 2 個 hook**（解決 R4 軟超）：',
      '  - **新檔 `src/components/Dashboard/useDashboardFilters.js`**（3.3KB / 87 行）— 抽 5 個 state（sortKey / view / keyword / l2 / filterRoles / page）+ localStorage / sessionStorage 持久化 + filter 改變 reset page useEffect + clearAllFilters helper。',
      '  - **新檔 `src/components/Dashboard/useBulkActions.js`**（3.4KB / 86 行）— 抽 4 個 state（selectedIds / bulkFormats / pngQueue / pngTotal）+ 6 個 handler（toggleSelected / selectAll / clearSelected / handleBulkDownload / handleBulkDelete / removeFromSelection）。',
      '  - `Dashboard/index.jsx` 從 **15216 → 11149 bytes**（15.2KB → 11.1KB、軟 15 內 buffer 充足）；368 → 281 行。',
      '**B. Wizard inline tailwind → token（~12 處）**：`text-gray-800` → `text-ink` / `text-gray-500` → `text-ink-soft` / `text-gray-400` → `text-ink-faint` / `border-gray-300` → `border-line` / `bg-gray-50` → `bg-paper-2` / `text-red-500` → `text-danger` / `focus:ring-blue-400` → `focus:ring-brand` / `bg-blue-50 border-blue-200 text-blue-700` (預覽框) → `bg-info-soft border-info text-info-ink` / `border-dashed border-blue-400 text-blue-600 hover:bg-blue-50` (新增角色 button) → `border-dashed border-info text-info hover:bg-info-soft` / `bg-red-50 border-red-200 text-red-700 text-red-600` (errors block) → `bg-danger-soft border-danger text-danger-ink text-danger`。Wizard 內 input focus ring 跟 spec brand 一致、預覽藍框跟 spec info 一致。',
      '**C. RightDrawer inline tailwind → token（~8 處）**：`border-gray-200` → `border-line` / `bg-gray-50` → `bg-paper-2` / `text-gray-700` → `text-ink` / `text-gray-500` → `text-ink-soft` / `hover:bg-gray-200` → `hover:bg-paper-2` / **tab active state** `border-blue-600 text-blue-700 bg-blue-50` → `border-brand text-brand bg-brand-soft`（編輯頁右側 sidebar tab 「設定流程」/「任務細節」切換顏色跟 brand 一致）。',
      '**D. ChangelogPanel inline tailwind → token（~6 處）**：`border-gray-100` → `border-line-dim` / `hover:bg-gray-50` → `hover:bg-paper-2` / `text-gray-800` → `text-ink` / `text-gray-600` → `text-ink-soft` / `text-gray-400` → `text-ink-faint` / `text-gray-300` → `text-ink-faint`。',
      '**E. HelpPanel inline tailwind → token（~14 處）**：(1) 灰階：`text-gray-800` → `text-ink` / `text-gray-700` → `text-ink` / `text-gray-600` → `text-ink-soft` / `text-gray-500` → `text-ink-soft` / `text-gray-400` → `text-ink-faint` / `bg-gray-50` → `bg-paper-2` (2) 規則 visual cue：blocking `bg-red-50 border-red-100 text-red-800` → `bg-danger-soft border-danger text-danger-ink` / warning `bg-amber-50 border-amber-100 text-amber-800` → `bg-warning-soft border-warning text-warning-ink` (3) 可編輯操作 hint `bg-blue-50 border-blue-100 text-blue-800` → `bg-info-soft border-info text-info-ink` (4) 編號 mono 字 `text-indigo-600` → `text-brand`。',
      '**結果**：4 panel + Wizard 共清掉 ~50 處 inline Tailwind 色。改 brand / info / warning / danger 色改 tokens.css 自動同步。token 系統 SOT 在主流程使用路徑全到位。',
      '**仍待處理 backlog**：(1) BulkToolbar 內 `text-blue-700` 已遷（PR #240）、剩餘檔案 inline 色基本清完 (2) DrawerContent 2 hover badge inline pill（特殊絕對定位、不遷）(3) 部分 `bg-amber-50` 在 SaveModals 內為 warning 視覺 cue、已 token 化（之前 PR）。',
      '**動到的檔案（7 個）**：`src/components/Dashboard/useDashboardFilters.js`（**新**）/ `src/components/Dashboard/useBulkActions.js`（**新**）/ `src/components/Dashboard/index.jsx`（套 2 hook、削減 ~120 行）/ `src/components/Wizard.jsx`（~12 處 token）/ `src/components/RightDrawer.jsx`（~8 處 token）/ `src/components/ChangelogPanel.jsx`（~6 處 token）/ `src/components/HelpPanel.jsx`（~14 處 token）+ `src/data/changelog/current.js`。',
      '**驗證**：`npm run build` 通過。Dashboard/index.jsx 11.1KB（軟 15 內 buffer 充足）。手動：(a) 新增 L3 嚮導頁、input focus ring 變 brand 亮藍（不再 blue-400）、預覽框跟 spec info 系藍一致 (b) 編輯頁打開 sidebar、tab active 用 brand-soft 底 (c) 首頁說明 ▾ → 業務規則彈窗 blocking / warning rule card 顏色用 spec semantic token (d) ChangelogPanel hover 灰跟 spec paper 系一致 (e) Dashboard 篩選 + 排序 + 批量下載 / 刪除 等所有功能仍正常 (f) 重整網頁 sortKey / view / search 持久化仍 work。',
    ],
  },
];

/**
 * Changelog "current tip" — new entries since last freeze land here.
 * When this file grows beyond ~7KB, freeze: rename to c{next}.js + reset to [].
 * Entries are newest-first within file.
 */
export default [
  {
    date: '2026-05-19',
    title: '所有 emoji 全清 + spec 化 / 3 dropdown 箭頭飽和實心 / Wizard step indicator brand token / BulkToolbar 色 token / Chip filter variant',
    items: [
      '**緣由**：使用者「所有 emoji 都移除、把不要用 emoji 寫進規範」+ 待決議 7 項挑 5 個執行（5 dropdown 箭頭 / 5 Wizard step / 4 Tailwind 色 / 1 dropdown menu / 2 Chip）。Dashboard 拆 hook 留下個 PR、3 留評估。',
      '**A. 移除全站 UI emoji（5 處）+ spec 化**：(1) `Dashboard/index.jsx` 空狀態 `📋` 移、純文字「尚無活動，點選右上角新增 L3 工作流或上傳 Excel 開始」(2) `SaveModals.jsx` `⛔ 必要條件未達` + `⚠️ 有建議改善項目` + `⚠️ 重設所有手動端點` 三 modal title 移 emoji (3) `useFlowActions/taskOps.js` alert 內 `✏️` 改純文字「編輯」(4) `helpPanelData.js` 「✏️ 編輯」改「編輯」。+ `docs/business-spec.md §13.9.3` 加新條目「**不用 emoji**：UI 文字 / 按鈕 / 標題 / banner 一律不使用 emoji（如 📋 / ⚠️ / ❌ / ✓ / 🔍 / ⛔ 等）。語意應透過 token 色 + 文字傳達。例外：功能性 unicode 符號保留（✕ 關閉 / ▾ dropdown / ▲▼ 排序 / ↶↷ undo/redo / → 流向）。**Logo 圖檔不算 emoji** — 使用者：「logo 不算 emoji 請不要動」（保留 `<img src="logo.png">`）。',
      '**B. 3 dropdown 箭頭一致化（飽和實心）**：原 L2 / sort 用 native `<select>` 箭頭（OS 渲染）、角色用 SVG `opacity-60` 半透明。新做法：`<SelectWithChevron>` wrapper 元件 — `<select>` 加 `appearance-none` 隱藏 native arrow、外層 `<div>` 絕對定位 overlay 自繪 SVG chevron（**飽和實心、移除 opacity-60**）。L2 dropdown 用 `<SelectWithChevron>` 重寫、Dashboard 內 sort dropdown 也用同 wrapper（從 `SearchBar.jsx` export）。角色 dropdown trigger 內 chevron 拿掉 opacity-60。3 個 dropdown 視覺**完全一致飽和實心三角**。',
      '**C. Wizard step indicator 用 brand token**：`StepIndicator` 內所有 hardcoded `bg-blue-600` / `ring-blue-100` / `text-blue-600` / `bg-gray-200` / `text-gray-500` → `bg-brand` / `ring-brand-soft` / `text-brand` / `bg-paper-2` / `text-ink-faint`。未來改 brand 主色自動同步。',
      '**D. BulkToolbar + PngProgressBanner Tailwind 色 → token**：(1) BulkToolbar `bg-blue-50 border-blue-300 text-blue-800 text-blue-700` → `bg-info-soft border-info text-info-ink` (2) PngProgressBanner `bg-yellow-50 border-yellow-300 text-yellow-800 border-yellow-500` → `bg-warning-soft border-warning text-warning-ink border-warning`。語意對齊 spec semantic token（info / warning）。',
      '**E. 下載 dropdown menu items 拉齊**（`FlowEditor/Header.jsx`）：3 個 menu item「下載 PNG / Drawio / Excel」從 `text-base text-gray-700 hover:bg-blue-50` → `text-sm text-ink hover:bg-paper-2`。字級 16 → 14（合 spec body）+ hover 色從藍變灰（跟其他 dropdown menu 一致）。',
      '**F. Chip 加 `variant="filter"` + SearchBar FilterChip 遷**：`ui/Chip.jsx` 新增 `filter: "bg-brand-soft border-brand-soft text-brand-dark gap-1"` variant。`SearchBar.jsx FilterChip` 從 inline `<span className="...">` 內容包成 `<Chip variant="filter">`。改 chip 樣式從多處改 → `ui/Chip.jsx` 一處。',
      '**動到的檔案（10 個）**：`docs/business-spec.md`（emoji spec）/ `src/components/Dashboard/index.jsx`（空狀態無 emoji + sort 用 SelectWithChevron）/ `src/components/FlowEditor/SaveModals.jsx`（3 modal title 無 emoji）/ `src/components/FlowEditor/useFlowActions/taskOps.js`（alert 無 emoji）/ `src/data/helpPanelData.js`（無 emoji）/ `src/components/Dashboard/SearchBar.jsx`（SelectWithChevron + L2 + RolesDropdown 拿掉 opacity-60 + FilterChip 改 Chip variant）/ `src/components/Wizard.jsx`（step indicator brand token）/ `src/components/Dashboard/BulkToolbar.jsx`（info-soft / warning-soft token）/ `src/components/FlowEditor/Header.jsx`（dropdown items 拉齊）/ `src/components/ui/Chip.jsx`（filter variant）+ `src/data/changelog/current.js`。',
      '**仍待處理 backlog**：(1) Wizard 內其他 tailwind 色（input ring-blue-400 / 角色卡 bg-gray-50 等）+ ChangelogPanel hover bg-gray-50 / RightDrawer / HelpPanel 仍有 inline Tailwind 色、~15 處（非主流程使用、暫保留）(2) DrawerContent 2 個 hover badge 仍 inline pill（visual 特殊定位、不適合 Chip variant、保留）(3) Dashboard/index.jsx 16KB 軟超 — **下 PR 拆 `useDashboardFilters` + `useBulkActions` hook**。',
      '**驗證**：`npm run build` 通過。手動：(a) Dashboard 沒流程時不顯示 📋、純文字提示 (b) FlowEditor 試圖儲存 blocking、modal title「必要條件未達、無法儲存」無 ⛔ (c) Dashboard 篩選列 3 dropdown 箭頭視覺完全一致（飽和實心黑三角）(d) Wizard step indicator 圓圈用 brand 亮藍 (e) BulkToolbar 工具列改用 info-soft 藍底 (f) PngProgressBanner 用 warning-soft 黃底 (g) FlowEditor 下載 ▾ menu items 字較小 + hover 灰 (h) Dashboard 篩選「篩選中」chip 視覺跟其他 Chip 一致 (i) 點「設計規範 ▾」彈窗看 §13.9.3 多了「不用 emoji」條目。',
    ],
  },
];

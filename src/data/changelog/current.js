/**
 * Changelog "current tip" — new entries since last freeze land here.
 * When this file grows beyond ~7KB, freeze: rename to c{next}.js + reset to [].
 * Entries are newest-first within file.
 */
export default [
  {
    date: '2026-05-19',
    title: 'FlowTable.jsx 拆檔（20.4 → 13.3KB）+ 首頁 6 項優化（移副標 / view+sort 整併篩選列 / 去 emoji / native arrow）',
    items: [
      '**緣由**：FlowTable.jsx 20.4KB 已超 CLAUDE.md §6 硬 20KB 上限、spec「擋邏輯改動、先拆檔」。+ 使用者 6 項首頁優化：(1) 刪標題副標 (2) L2 dropdown 移 ▾ 字 (3) 「+」prefix 移除 (4) 角色 dropdown 箭頭跟 native select 一致 (5) view/sort 整併到 SearchBar 同列置右、無內容隱藏 (6) 移「共 N 個」count。',
      '**A. FlowTable 拆檔**（PR #237）：原 `src/components/FlowTable.jsx` 20.4KB / 474 行 → 拆 5 個 sub-file + shim re-export：(1) `FlowTable/index.jsx` 13.3KB — 主元件 + toolbar + table 渲染 (2) `FlowTable/cells.jsx` 3.6KB — EditCell / ReadCell / RoleCell (3) `FlowTable/ColResizeHandle.jsx` 1.7KB — 欄寬拖曳 handle (4) `FlowTable/sticky.js` 1.1KB — getStickyMap / cellStickyStyle / STICKY_COLS_* (5) `FlowTable/widthDefaults.js` 2.2KB — DEFAULT_COL_WIDTHS / CORE_HEADER_COUNT / L3_VISIBLE_KEY / AUX_VISIBLE_KEY / AUX_SEP_WIDTH (6) `useColumnWidths.js`（已存）。`FlowTable.jsx` 232 bytes shim `export { default } from "./FlowTable/index.jsx"`、外部 import 路徑不變。',
      '**B1. 移除標題副標題**（`Dashboard/index.jsx`）：刪「點星星可置頂、勾選可批量下載」`<p>`、頁標只剩 `<h1>L3 工作流</h1>`。',
      '**B2. L2 dropdown 移 ▾ 字**（`SearchBar.jsx L2Dropdown`）：`<option>L2 ▾ 全部</option>` → `<option>全部 L2</option>`。dropdown 用 native HTML `<select>` 已有原生箭頭、不需文字 ▾。',
      '**B3. 「+ 新增 L3 工作流」→「新增 L3 工作流」**（`Dashboard/index.jsx`）：移除「+」prefix、純文字。',
      '**B4. 角色 dropdown 箭頭 SVG chevron**（`SearchBar.jsx RolesDropdown`）：button trigger 內 `▾` 字符 → 自繪 SVG `<polygon points="0,0 10,0 5,6">` chevron-down + `opacity-60`、視覺跟 native `<select>` arrow 一致。trigger 文字也微調：`角色 ▾ (2)` → `角色 (2)`（無選擇時：`全部角色`）。',
      '**B5. view + sort 整併到 SearchBar 同列置右**（`SearchBar.jsx` + `Dashboard/index.jsx`）：SearchBar 加 `viewSwitcher` / `sortControl` props（React node 注入）。Dashboard 把 `<ViewSwitcher>` + `<select sortKey>` 從頁面標題列移到 SearchBar、`ml-auto` 置右。`flows.length === 0` 時 SearchBar 整列不渲染（含 view/sort）— 沒內容時頁面只剩 header + 標題列（含上傳 / 新增 CTA）+ 空狀態。',
      '**B6. 移除「共 N 個」count**（`SearchBar.jsx`）：右上「共 N 個結果（總 M）」/「共 N 個」span 整段移除。`resultCount` / `totalCount` props 棄用。',
      '**EmptyState 移 🔍 emoji**：SearchBar.jsx `EmptyState` 內 `<div className="text-4xl">🔍</div>` 移除、純文字呈現（沿 PR #236 移 emoji 原則）。',
      '**動到的檔案（10 個）**：`src/components/FlowTable.jsx`（→ shim）/ `src/components/FlowTable/index.jsx`（新、主元件）/ `src/components/FlowTable/cells.jsx`（新）/ `src/components/FlowTable/ColResizeHandle.jsx`（新）/ `src/components/FlowTable/sticky.js`（新）/ `src/components/FlowTable/widthDefaults.js`（新）/ `src/components/Dashboard/index.jsx`（移 view/sort、刪副標、移 + 字）/ `src/components/Dashboard/SearchBar.jsx`（view/sort props + chevron + 移 ▾ + 移 count + 移 🔍）+ `src/data/changelog/{current,c34,index}.js`（c34 凍結 PR #236 條目）。',
      '**驗證**：`npm run build` 通過。檔案 size：FlowTable.jsx 20.4KB → 232 bytes shim + sub 5 個（最大 index.jsx 13.3KB 軟 15KB 內）✓。手動：(a) FlowEditor 進入流程、表格仍正常編輯 / 欄寬拖曳 / sticky / 4 顆 toolbar button 都 work (b) Dashboard 沒內容時只見 header + 標題 + 兩顆 CTA + 空狀態 (c) 有內容時 SearchBar 列含搜尋 + L2 + 角色 + view + sort、view/sort 置右 (d) L2 dropdown 文字「全部 L2」(e) 角色 button 顯示 SVG chevron 跟 select 箭頭一致 (f) 新增按鈕無「+」(g) 無「共 N 個」count。',
    ],
  },
];

/**
 * Changelog "current tip" — new entries since last freeze land here.
 * When this file grows beyond ~7KB, freeze: rename to c{next}.js + reset to [].
 * Entries are newest-first within file.
 */
export default [
  {
    date: '2026-05-19',
    title: 'Design system 一致性 — 4 panel 改 Modal base + InfoDropdown / 儲存 button / 8 CTA 全遷 Button base + primary CTA 改亮藍',
    items: [
      '**緣由**：使用者要求「先檢查全站設計跟 design guideline 是否一致、列不一致 + 根因」、確認後執行。Audit 結果 4 根因：(R1) Primary CTA 顏色未定（spec brand 亮藍 vs 實際 brand-dark 深藍）(R2) PR #232 漏遷 InfoDropdown + 儲存 button (R3) 4 panel 歷史遺留沒走 Modal base (R4) base 元件 variant 不夠。使用者決策：**primary CTA 改亮藍（spec brand `#006EBC`）**、視覺看完不喜歡可一行 revert。',
      '**1. 4 panel 全遷 Modal base**（R3）：`HelpPanel` / `ChangelogPanel` / `DesignGuidelinePanel` / `DiagramRenderer/legend` 從各自手寫 `<div className="fixed inset-0 z-50 ...">` backdrop → 用 `<Modal isOpen onClose title subtitle>`。每個 panel 自帶 ESC 關閉邏輯（HelpPanel x、legend useEffect onKey）也移除、Modal base 統一處理。改 modal 樣式從 4 處改 → 1 處改。',
      '**2. InfoDropdown 遷 Button variant="dark-bar"**（R2）：首頁右上「說明 ▾」從 inline `<button className="px-3 py-1.5 text-base rounded border border-white border-opacity-40 ...">` → `<Button variant="dark-bar">`。字級 16 → 14 / 圓角 4 → 6 / 字重 normal → medium、視覺跟編輯頁 7 顆 dark-bar button **完全一致**（解決使用者「首頁說明跟編輯頁按鈕樣式同但跟 header 7 button 不同」問題）。',
      '**3. SaveButton 拆子元件**（R2）：`FlowEditor/Header.jsx` 儲存 button 4 狀態（saveCelebrate / savePulse / hasChanges / default）三層條件 className → 抽 `src/components/FlowEditor/SaveButton.jsx`、4 個 STATE_CLASS object 集中。Header.jsx 從 ~30 行 inline 條件 → `<SaveButton .../>` 6 行 prop。',
      '**4. 8 個 inline confirm button 全遷 `<Button variant="primary">`**（R1 + R3）：Dashboard 上傳 Excel / 新增 L3 / Wizard 下一步 / Wizard 進入編輯流程 / CloneFlowModal 複製並開啟 / DuplicateImportModal 都保留 / BulkToolbar 批量下載 + 批量刪除 → primary（亮藍 `#006EBC`）/ danger（白底紅字）。8 處 inline hex `#2A5598` / `#3470B5` + onMouseEnter/Leave 全清。',
      '**結果**：全站 **0 處 inline confirm button**（之前 8 處）/ **0 處 inline modal backdrop**（之前 4 處）/ **0 處 inline hex hover button**（之前 8 處）。改 primary CTA 色現在改 `ui/Button.jsx` 一行：`primary: "bg-brand ..."` → 全動。**未來想換回 brand-dark 深藍 1 分鐘的事**。',
      '**視覺變化**：8 個 CTA 從深藍 `#2A5598` → **亮藍 `#006EBC`**（spec 既有 primary 色）。Header bar / 編輯頁 dark-bar button 仍 brand-dark 不變、跟 CTA 視覺對比強。',
      '**新檔 + 動到的檔案（11 個）**：`src/components/FlowEditor/SaveButton.jsx`（**新**）/ `src/components/HelpPanel.jsx`（→ Modal）/ `src/components/ChangelogPanel.jsx`（→ Modal）/ `src/components/DesignGuidelinePanel.jsx`（→ Modal）/ `src/components/DiagramRenderer/legend.jsx`（→ Modal、移 useEffect onKey）/ `src/components/InfoDropdown.jsx`（→ Button dark-bar）/ `src/components/FlowEditor/Header.jsx`（→ SaveButton）/ `src/components/Wizard.jsx`（3 個 button → Button variant）/ `src/components/Dashboard/index.jsx`（2 CTA → Button primary）/ `src/components/Dashboard/CloneFlowModal.jsx`（→ Button primary）/ `src/components/Dashboard/DuplicateImportModal.jsx`（→ Button primary）/ `src/components/Dashboard/BulkToolbar.jsx`（→ Button primary + danger）+ `src/data/changelog/current.js`。',
      '**驗證**：`npm run build` 通過。audit：0 inline backdrop / 0 inline confirm hex / source 無 >20KB 違規。手動：(a) Dashboard 上傳 / 新增 CTA 變亮藍 (b) Wizard 下一步 / 儲存變亮藍 (c) modal confirm button 全亮藍 (d) BulkToolbar 下載亮藍、刪除白底紅 (e) 首頁說明跟編輯頁圖例 button 視覺完全一致（14px / 圓角 6 / medium）(f) 儲存 button 4 狀態正常切換 (g) 4 panel ESC 鍵 / backdrop 點關閉正常 (h) Modal 標題 / 副標題正確顯示。',
    ],
  },
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

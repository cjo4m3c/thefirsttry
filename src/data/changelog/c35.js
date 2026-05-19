export default [
  {
    date: '2026-05-19',
    title: 'Design system 一致性 — 4 panel 改 Modal base + InfoDropdown / 儲存 button / 8 CTA 全遷 Button base + primary CTA 改亮藍',
    items: [
      '**緣由**：使用者要求「先檢查全站設計跟 design guideline 是否一致、列不一致 + 根因」、確認後執行。Audit 結果 4 根因：(R1) Primary CTA 顏色未定（spec brand 亮藍 vs 實際 brand-dark 深藍）(R2) PR #232 漏遷 InfoDropdown + 儲存 button (R3) 4 panel 歷史遺留沒走 Modal base (R4) base 元件 variant 不夠。使用者決策：**primary CTA 改亮藍（spec brand `#006EBC`）**、視覺看完不喜歡可一行 revert。',
      '**1. 4 panel 全遷 Modal base**（R3）：`HelpPanel` / `ChangelogPanel` / `DesignGuidelinePanel` / `DiagramRenderer/legend` 從各自手寫 `<div className="fixed inset-0 z-50 ...">` backdrop → 用 `<Modal isOpen onClose title subtitle>`。每個 panel 自帶 ESC 關閉邏輯也移除、Modal base 統一處理。改 modal 樣式從 4 處改 → 1 處改。',
      '**2. InfoDropdown 遷 Button variant="dark-bar"**（R2）：首頁右上「說明 ▾」從 inline 改 `<Button variant="dark-bar">`。視覺跟編輯頁 7 顆 dark-bar button 完全一致。',
      '**3. SaveButton 拆子元件**（R2）：FlowEditor 儲存 button 4 狀態三層條件 className → 抽 `SaveButton.jsx`。',
      '**4. 8 個 inline confirm button 全遷 `<Button variant="primary">`**：Dashboard 上傳 / 新增 / Wizard 下一步 / 儲存 / CloneFlowModal / DuplicateImportModal / BulkToolbar 全清 inline hex。',
      '**結果**：全站 0 inline confirm button / 0 inline modal backdrop / 0 inline hex hover button。改 primary 色改 `ui/Button.jsx` 一行全動。',
      '**動到的檔案（11 個）**：見 PR #238 描述。',
    ],
  },
  {
    date: '2026-05-19',
    title: 'FlowTable.jsx 拆檔（20.4 → 13.3KB）+ 首頁 6 項優化（移副標 / view+sort 整併篩選列 / 去 emoji / native arrow）',
    items: [
      '**緣由**：FlowTable.jsx 20.4KB 已超 CLAUDE.md §6 硬 20KB 上限、spec「擋邏輯改動、先拆檔」。+ 使用者 6 項首頁優化。',
      '**A. FlowTable 拆檔**：原 20.4KB / 474 行 → 拆 5 個 sub-file + shim re-export。`FlowTable.jsx` 232 bytes shim、外部 import 路徑不變。',
      '**B. 6 項首頁優化**：(1) 刪標題副標 (2) L2「L2 ▾ 全部」→「全部 L2」 (3) 「+ 新增 L3」→「新增 L3」 (4) 角色 dropdown ▾ → SVG chevron (5) view + sort 整併到 SearchBar 同列置右、無內容時隱藏 (6) 移「共 N 個」count + EmptyState 🔍 emoji。',
      '**動到的檔案（10 個）**：見 PR #237 描述。',
    ],
  },
];

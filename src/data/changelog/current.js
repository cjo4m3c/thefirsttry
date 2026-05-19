/**
 * Changelog "current tip" — new entries since last freeze land here.
 * When this file grows beyond ~7KB, freeze: rename to c{next}.js + reset to [].
 * Entries are newest-first within file.
 */
export default [
  {
    date: '2026-05-19',
    title: 'Header bg 改最深輔色 brand-darker + Header 4 button 拉齊（返回 / 置頂 / SaveButton baseCls）',
    items: [
      '**緣由**：使用者「header 改為品牌最深輔色樣式」+「發現 header 按鈕還是沒拉齊、一併規劃」。Audit 找到 4 個 button 沒對齊 dark-bar 標準（PR #232 + #238 漏的細項）。',
      '**A. Header bg → `--brand-darker`**（3 處）：Dashboard / FlowEditor / Wizard 三個 header inline style 從 `var(--brand-dark)` (#2A5598) → `var(--brand-darker)` (#1B2E4C 最深 navy)。其他用 brand-dark 的地方（BackToTop / SVG hover stroke / 開始結束事件 pill）維持不變。',
      '**B1. 「← 返回」button 遷 dark-bar**（FlowEditor + Wizard）：原 inline `<button className="opacity-70 hover:opacity-100 text-base">` → `<Button variant="dark-bar">`。字級 16 → 14 / 加 border + hover bg-white/10 / 字重 medium、跟其他 7 button 視覺**完全一致**。',
      '**B2. 置頂 ★ icon button 拉齊**（FlowEditor）：原 inline `<button className="p-1.5 rounded transition-transform hover:scale-110">` → 加 `border border-white border-opacity-40 hover:bg-white hover:bg-opacity-10` 跟其他 button 同 hover 風格。stroke 從硬編 `white` 改 `currentColor`。SVG 18px / padding px-2 py-1.5 維持 icon-only 緊湊。',
      '**B3. SaveButton baseCls 拉齊 dark-bar 規格**：原 `px-3 py-1.5 text-base rounded border font-semibold` → `px-3 py-1.5 text-sm rounded-md border font-medium`。字級 16 → 14 / 圓角 4 → 6 / 字重 semibold → medium、default 狀態跟其他 7 button 完全一致。hasChanges 狀態用 `font-semibold` override 強調主動作（白底實心）。',
      '**結果**：Header 內 **9 個 button 全部 dark-bar 同款**（返回 / 圖例 / 密度 / undo / redo / 重設端點 / 打開編輯器 / 下載 ▾ / 置頂 ★）+ 儲存 button 同 baseCls 規格、視覺一致。Header bg 改最深 navy、跟亮藍 brand CTA 對比更強。',
      '**動到的檔案（6 個）**：`src/components/Dashboard/index.jsx`（header bg）/ `src/components/FlowEditor/Header.jsx`（header bg + 返回 + 置頂）/ `src/components/Wizard.jsx`（header bg + 返回）/ `src/components/FlowEditor/SaveButton.jsx`（baseCls + STATE_CLASS hasChanges 加 semibold）+ `src/data/changelog/{current,c35,index}.js`（c35 凍結 PR #237 + #238）。',
      '**驗證**：`npm run build` 通過。手動：(a) 三個 header bg 從中藍 → 深 navy（明顯變深）(b) FlowEditor 返回 + 置頂 + 7 dark-bar button + 儲存 default 視覺完全一致 14px/rounded-md/medium (c) 儲存 hasChanges 仍是白底實心強調 (d) 置頂 ★ hover 出現 border + bg-white/10、icon 仍顯示 (e) Wizard 返回字級從 16 → 14 跟其他按鈕一致。',
      '**仍待決議的不一致項目（清單）**：(1) 下載 dropdown menu items 用 `text-base text-gray-700 hover:bg-blue-50`、字級 16 非 spec / hover 色 tailwind 而非 token (2) 3 處 inline pill chip（DrawerContent x2 hover badge / SearchBar FilterChip）需 Chip variant 擴充才能遷 (3) 3 dropdown 箭頭視覺：L2/sort native arrow vs 角色 SVG chevron（角色多選不能用 `<select>`、解法只能改全部 button+SVG）(4) 多處 inline Tailwind 色（`bg-blue-50` / `text-blue-800` / `text-amber-950` 等）未走 semantic token (5) Wizard step indicator + 大標仍 inline 字級（從 PR #229 後已 OK 不違規但仍非 base 元件）(6) Emoji / icon 使用準則 spec 沒明文（哪些保留 emoji vs 全去）(7) Dashboard/index.jsx 15.9KB 軟超 15KB 硬 20KB 內。',
    ],
  },
];

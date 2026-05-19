/**
 * Changelog "current tip" — new entries since last freeze land here.
 * When this file grows beyond ~7KB, freeze: rename to c{next}.js + reset to [].
 * Entries are newest-first within file.
 */
export default [
  {
    date: '2026-05-19',
    title: 'Inline `#2A5598` 全站 → `var(--brand-dark)` token migration（design system 漸進拉齊 PR 1/4）',
    items: [
      '**緣由**：spec §13.9.1 規定 token 是 SOT、改 hex 改 tokens.css 不改 inline；但全站還有 24 處 hex literal `#2A5598`（Header bg / button bg / 各種 modal 確認按鈕）+ 9 處 hover hex `#1E4677` 散落。痛點：改色要 grep 替換全站、違反 token SOT 原則。本 PR 為「design system 漸進拉齊」4-PR 系列第 1 棒（最低風險純機械替換）。',
      '**新增 token `--brand-dark-hover: #1E4677`**：原本 hover 色散落各處沒 token、`tokens.css` 加 + `tailwind.config.js` 加 `bg-brand-dark-hover` / `text-brand-dark-hover` utility。',
      '**機械替換 9 個檔案**：(1) `DesignGuidelinePanel.jsx` 關閉 button (2) `HelpPanel.jsx` 關閉 button (3) `ChangelogPanel.jsx` 關閉 button (4) `Wizard.jsx` header bg + 儲存 button (5) `Dashboard/BulkToolbar.jsx` BTN_BLUE / BTN_BLUE_HOVER 常數 (6) `BackToTop.jsx` 浮按鈕 bg (7) `Dashboard/CloneFlowModal.jsx` 確認 button (8) `ContextMenu/subforms.jsx` 3 個確認 button (9) `FlowEditor/DrawerContent.jsx` 確認新增 button (10) `Dashboard/index.jsx` Header bg (11) `FlowEditor/Header.jsx` 儲存 button `text-[#1E4677]` → `text-brand-dark-hover` (12) `src/index.css` save-celebrate-flash keyframe。共 24 處 hex 替換為 `var(--brand-dark)` / `var(--brand-dark-hover)` 或 Tailwind utility。',
      '**SVG 例外處理**：`DiagramRenderer/arrows.jsx HOVER_OUT_STROKE` 是 SVG `stroke` attribute、不認 CSS variable、保留 hex `#2A5598`、但加註解 `// === var(--brand-dark)` 標記同步。',
      '**Dashboard 上傳/新增 CTA 保留**：使用者指示「Dashboard 上傳/新增 CTA」這次跳過、留給未來「Button variant primary 遷移」一起做（design system 系列 PR 3）。`Dashboard/index.jsx` line 242-252 共 6 處 hex 維持不動。',
      '**結果**：source `#2A5598` 從 18 處 → 2 處（Dashboard CTA × 2 = 6 行）；`#1E4677` 從 9 處 → 3 處（Dashboard CTA × 2 = 6 行 + tokens.css 定義 + arrows.jsx 同步註解）。改 brand-dark 色未來只要動 tokens.css 一處（除 Dashboard CTA 仍要手動之外）。',
      '**動到的檔案（13 個）**：`src/styles/tokens.css`（加 `--brand-dark-hover`）/ `tailwind.config.js`（加 utility）/ `src/index.css`（keyframe）/ `src/components/{DesignGuidelinePanel,HelpPanel,ChangelogPanel,Wizard,BackToTop}.jsx` / `src/components/Dashboard/{BulkToolbar,CloneFlowModal,index}.jsx` / `src/components/ContextMenu/subforms.jsx` / `src/components/FlowEditor/{DrawerContent,Header}.jsx` / `src/components/DiagramRenderer/arrows.jsx`（註解）+ `src/data/changelog/current.js`（本條）。',
      '**驗證**：`npm run build` 通過。手動：(a) Dashboard / Wizard / FlowEditor Header 三個深藍 header bg 視覺一致（皆 `--brand-dark`）(b) 各 panel 關閉按鈕 hover 漸深 (c) Dashboard 上傳/新增 CTA 視覺保持不變（hex 未動）(d) 流程圖 hover task 下游箭頭仍為 #2A5598 深藍。',
    ],
  },
  {
    date: '2026-05-19',
    title: '字級 spec 7 階重新校準 — 以實際網頁字級反推、新 11/12/14/16/18/20/24 + display 48',
    items: [
      '**緣由**：PR #228 audit 揭露全站 162 處字級違反舊 spec 7 階 (11/12/13/15/17/22/32)。盤點實際使用：12px 121 處 ⭐ / 14px 72 處 ⭐ / 16px 51 處 ⭐ / 18px 8 / 20px 6 / 24px 5 / 48px 1、舊 spec 的 15/17/22/32 幾乎沒人用（0-4 處）。使用者：「以現在網頁字級為基準，做七階層字級設計後，反過頭來拉齊網頁中所有不合規的內容」→ 反推新 spec 而非拉齊到舊 spec。',
      '**新 spec 7 階 + display 外掛**：`--fs-h1:24` / `--fs-h2:20` / `--fs-h3:18` / `--fs-ui:16`（**新增階**、主要 button / Form input / Header）/ `--fs-body:14` / `--fs-label:12` / `--fs-caption:11` + `--fs-display:48`（裝飾外掛、空狀態 emoji）。Tailwind 對應：text-2xl=24 / text-xl=20 / text-lg=18 / text-base=16 / text-sm=14 / text-xs=12。',
      '**動到的 spec 文件 3 處**：(1) `src/styles/tokens.css` — 改 7 階 CSS variables + 新增 `.t-ui` class (2) `docs/business-spec.md §13.9.3` — 改字級表 + Tailwind 對照 (3) `src/components/DesignGuidelinePanel.jsx` — 字級 demo data + section title 改「7 階 + display 裝飾」。',
      '**Outliers 機械替換 11 處**：(a) `text-[10px]` × 2 → `text-[11px]`（HelpPanel pill badge / FlowListTable pin icon）(b) `text-[13px]` × 9 → `text-sm`：`ui/Button.jsx` md size（影響全站所有 `<Button size="md">`）/ `DiagramRenderer/overlays.jsx` 任務 tooltip × 2 / **PR #228 revert** ViewSwitcher + sort + 上傳 + 新增 + 表格本體 × 5（13→14、視覺差 1px 幾乎看不出）(c) `ui/Button.jsx` sm size `text-[12px]` → `text-xs`、`ui/Chip.jsx` `text-[12px]` → `text-xs`（值不變、統一用 tailwind 別名）。',
      '**自動連動的 11 處 `.t-*` class 用法**：`ui/Modal.jsx` `t-h1` 22→24、`t-caption` 維持 11、`ui/Callout.jsx` 用 `var(--fs-body)` 13→14、`ui/Chip.jsx` id variant 用 `var(--fs-caption)` 維持 11 — 全部自動跟新 spec value、不用改程式碼。',
      '**結果**：全站 162 處字級「違反舊 spec」→ **0 處違反新 spec**。`text-sm` 14px 從「違規」變「body 階」、`text-base` 16px 變「ui 階」、`text-lg` 18px 變「h3」、`text-xl` 20 變「h2」、`text-2xl` 24 變「h1」、`text-5xl` 48 變「display」— 既有視覺保持不變、只是 spec 改成符合現況。',
      '**動到的檔案（11 個）**：`src/styles/tokens.css` / `docs/business-spec.md` / `src/components/DesignGuidelinePanel.jsx` / `src/components/ui/Button.jsx` / `src/components/ui/Chip.jsx` / `src/components/HelpPanel.jsx` / `src/components/DiagramRenderer/overlays.jsx` / `src/components/Dashboard/{ViewSwitcher,index,FlowListTable}.jsx`（3 個 sub）+ `src/data/changelog/{current,c30,index}.js`（c30 凍結之前的 PR #227/#228 兩條、current.js 從 10.3KB 降回 ~5KB）。',
      '**驗證**：`npm run build` 通過。audit script 確認無 `text-[10/13/15/17/22/32]px` 殘留。手動：(a) 點「設計規範 ▾」彈窗看字級階是新 7 階 + display (b) Dashboard 上傳/新增/sort 字回到 14px (c) Modal 標題視覺與之前一致（24/20px 來自既有 text-2xl/text-xl）。',
    ],
  },
];

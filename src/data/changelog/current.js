/**
 * Changelog "current tip" — new entries since last freeze land here.
 * When this file grows beyond ~7KB, freeze: rename to c{next}.js + reset to [].
 * Entries are newest-first within file.
 */
export default [
  {
    date: '2026-05-20',
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

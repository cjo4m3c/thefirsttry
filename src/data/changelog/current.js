/**
 * Changelog "current tip" — new entries since last freeze land here.
 * When this file grows beyond ~7KB, freeze: rename to c{next}.js + reset to [].
 * Entries are newest-first within file.
 */
export default [
  {
    date: '2026-05-19',
    title: 'FlowEditor Header 7 顆 button → `<Button variant="dark-bar">`（design system 漸進拉齊 PR 2/4）',
    items: [
      '**緣由**：FlowEditor 深藍 Header 上 8 顆 button 都重複一樣的 inline class `px-3 py-1.5 text-base rounded border border-white border-opacity-40 text-white hover:bg-white hover:bg-opacity-10 ...`、改 hover 顏色要動 8 處、容易漏。spec §13.9.4「新增 UI 優先用 base 元件」明文反對 inline。本 PR 為「design system 漸進拉齊」4-PR 系列第 2 棒。',
      '**新增 `variant="dark-bar"` 到 `src/components/ui/Button.jsx`**：`bg-transparent border-white border-opacity-40 text-white hover:bg-white hover:bg-opacity-10`、跑在 `--brand-dark` Header bg 上的透明白邊白字 button。未來 Dashboard / Wizard 三個深藍 header 共用同 variant。',
      '**FlowEditor/Header.jsx 替換 7 顆 button**：(1) 圖例 (2) 密度 toggle (3) ↶ 復原 (4) ↷ 重做 (5) 重設所有端點（條件渲染）(6) 打開編輯器 (7) 下載 ▾。全部 `<button className="px-3 py-1.5 text-base rounded border ...">` → `<Button variant="dark-bar">`、保留 onClick / disabled / title。Button size 預設 `md` 對應新 spec fs-body 14px（舊是 text-base 16px、PR #229 spec 校準後變 14px）。',
      '**儲存 button 保留 inline**：第 8 顆「儲存」button 有 4 種狀態（saveCelebrate flash 動畫 / savePulse amber / hasChanges 白底 + brand-dark-hover 字 / default 透明白邊）、用三層條件 className 切換。狀態複雜度高、本 PR 暫不換、留 inline。未來如要遷移要先在 Button 加 multi-state 機制（或拆 SaveButton 子元件）。',
      '**結果**：Header.jsx 從 8 處 inline dark-bar class → 1 處（儲存 default 殘留）。改 dark-bar 樣式現在改 Button.jsx 一處。',
      '**動到的檔案（5 個）**：`src/components/ui/Button.jsx`（加 dark-bar variant）/ `src/components/FlowEditor/Header.jsx`（import + 7 顆替換）/ `src/data/changelog/{current,c31,index}.js`（c31 凍結 PR #231 + #229 兩條、current.js 從 9KB 降回 ~3KB）。',
      '**驗證**：`npm run build` 通過。手動：(a) FlowEditor 8 顆 button 視覺一致（除儲存）(b) hover bg-white bg-opacity-10 漸亮 (c) undo/redo disabled 時 opacity-30 變透明 (d) 下載 ▾ 點開 dropdown 仍能用 (e) 字級從 16 → 14（PR #229 spec 校準預期）。',
    ],
  },
];

/**
 * Changelog "current tip" — new entries since last freeze land here.
 * When this file grows beyond ~7KB, freeze: rename to c{next}.js + reset to [].
 * Entries are newest-first within file.
 */
export default [
  {
    date: '2026-05-19',
    title: 'Dashboard 表格欄寬 / 命名 / 24h 日期 / 排序持久化 / 名稱點擊進編輯',
    items: [
      '**緣由**：使用者 4 項首頁優化 — (1) 擴名稱 + 主要角色、減日期欄寬 (2) 欄位命名加 L3 前綴更明確 (3) sortKey 跨 session 記憶 (4) 表格 + 卡片名稱可點擊進編輯。+ 補一致性要求「日期格式調整全站要一致」。',
      '**1. 欄寬重排**（`FlowListTable.jsx`）：日期 `w-64` (256) → `w-40` (160) 釋出 96px、主要角色 `w-32` (128) → `w-48` (192) 多 64px、名稱 auto 多 32px (1280 視窗 ~248 → ~280px、長活動名稱不再 truncate)。`RolesPreview` cap 1 chip + N → **cap 2 chips + N**（多 1 個 chip 可見）。',
      '**2. 24h 日期格式（全站一致）**（`sortFlows.js fmtDateTime`）：加 `hour12: false` option。格式從 `2026/05/19 下午03:23` → `2026/05/19 15:23`、節省 ~32px 寬度。`fmtDateTime` 是唯一日期 helper、自動同步表格 + 卡片兩 view（FlowCard.jsx 不用改）。Audit 全站無其他自寫 `toLocaleString`。',
      '**3. 欄位命名加 L3 前綴**：(a) thead「編號」→「**L3編號**」/「名稱」→「**L3活動名稱**」更明確（避免誤解為任務編號 / 角色名稱）(b) sort dropdown 同步：`L3 編號 ↑/↓` → `L3編號 ↑/↓`（去空格）+ `L3 名稱 ↑/↓` → `L3活動名稱 ↑/↓`（加「活動」字、去空格）。風格一致無空格。',
      '**4. sortKey localStorage 持久化**（`Dashboard/index.jsx`）：新 const `SORT_PREF_KEY = "flowsprite.dashboardSortKey"`、跟 `VIEW_PREF_KEY` 同 pattern。初始 `try localStorage.getItem` + `VALID_SORT_KEYS.has(v)` 驗證 fallback `number-asc`、`useEffect` 寫入。使用者從編輯頁回 Dashboard 排序保留。',
      '**5. L3 活動名稱可點擊進編輯**（兩 view）：(a) 表格 `<div className="truncate">{name}</div>` → `<button onClick={() => onEdit(flow.id)} className="w-full text-left truncate hover:text-brand">`、保留 truncate `…` + title tooltip (b) 卡片 `<span>{name}</span>` → `<button onClick={() => onEdit(flow.id)} className="text-left line-clamp-2 hover:text-brand">`。hover 變亮藍 + cursor pointer、不加 underline（避免跟 URL link 混淆）。鍵盤 Tab focus + Enter 觸發。「編輯」按鈕保留為 dual entry。L3 編號 chip 不變（識別 vs 進入分工）。',
      '**動到的檔案（5 個）**：`src/components/Dashboard/sortFlows.js`（24h fmtDateTime + SORT_OPTIONS 文字）/ `src/components/Dashboard/FlowListTable.jsx`（欄寬 + thead + 名稱 button + RolesPreview cap 2）/ `src/components/Dashboard/FlowCard.jsx`（標題 button）/ `src/components/Dashboard/index.jsx`（sortKey localStorage）+ `src/data/changelog/current.js`（本條）。',
      '**驗證**：`npm run build` 通過。手動：(a) 表格表頭顯示「L3編號 / L3活動名稱」(b) sort dropdown 文字統一無空格 (c) 日期顯示 24h「2026/05/19 15:23」、表格 + 卡片一致 (d) 名稱欄變寬、長名稱不再 `…` (e) 主要角色 chip 顯示 2 + N (f) 點名稱 cell 進編輯、hover 變亮藍 (g) 排序選後進編輯頁回來、排序保留 (h) 刷新瀏覽器排序仍保留。',
    ],
  },
  {
    date: '2026-05-19',
    title: '4 個 modal → `<Modal>` base 元件 + Modal variant 擴充 + Button warning/danger-fill（design system 漸進拉齊 PR 3/4）',
    items: [
      '**緣由**：4 個 modal（SaveModal blocking / SaveModal warning / ResetAllModal / CloneFlowModal / DuplicateImportModal）各自手寫 `<div className="fixed inset-0 z-50 flex ..." style={{ background: "rgba(0,0,0,0.45)" }}>` backdrop + 內框、4 份重複的 scaffolding。spec §13.9.4 推 base 元件、但 `ui/Modal.jsx` 之前只 1 處用到。本 PR 為「design system 漸進拉齊」4-PR 系列第 3 棒。',
      '**Modal base 擴充 `variant` prop**（`src/components/ui/Modal.jsx`）：加 `variant="default|warning|danger"`、driver header bg / border / title color。default 中性 line-dim、warning 黃 (`bg-warning-soft border-warning text-warning-ink`)、danger 紅 (`bg-danger-soft border-danger text-danger-ink`)。給 SaveModal blocking → variant="danger"、SaveModal warning + ResetAllModal → variant="warning"。',
      '**Button base 新增 2 個 filled variant**（`src/components/ui/Button.jsx`）：`warning`（`bg-warning border-warning text-white hover:opacity-90`、給「仍然儲存」/「確定重設」用）+ `danger-fill`（`bg-danger border-danger text-white`、給 DuplicateImport「覆蓋」真正破壞性的 confirm 用）。既有 `danger` variant 是「白底紅字」次要按鈕、新 `danger-fill` 是「紅底白字」主要破壞按鈕、語意分明。',
      '**SaveModals.jsx 重寫**：`SaveModal` + `ResetAllModal` 從 80 行 inline `<div className="fixed inset-0 z-50 ...">` 結構 → 用 `<Modal variant="danger|warning">` 包、 `<ModalBody>` 內塞 list、`<ModalFoot>` 兩顆 Button。SaveModal blocking 只有「知道了」一顆 default Button；warning 有「取消」+「仍然儲存」（warning variant）。ResetAllModal 兩顆「取消」+「確定重設」(warning)。從 80 行精簡到 ~55 行、移除所有 inline hex `#D97706`/`#B45309`。',
      '**CloneFlowModal.jsx 重寫**：用 `<Modal title="複製工作流" width={480}>` 包、ModalBody 內保留 input/label 邏輯不變、ModalFoot 兩顆 button。「取消」改 `<Button>` default、「複製並開啟」保留 inline（因為 brand-dark token 已是合 spec、且 disabled state 用 hex `#9CA3AF` 需配合）— Modal scaffolding 已用 base、button 樣式留下次處理。從 ~110 行精簡到 ~95 行。',
      '**DuplicateImportModal.jsx 重寫**：用 `<Modal title="偵測到重複的 L3 編號" width={560}>` 包、3 顆 button：「取消匯入」default Button / 「都保留」inline 中藍（`#3470B5` 沒 token、保 inline）/「覆蓋」`<Button variant="danger-fill">` 紅。從 ~55 行精簡到 ~45 行。',
      '**好處**：(a) ESC 鍵關閉 / backdrop 點擊關閉 / body scroll lock 三件事全部由 Modal 統一處理、不用 4 份各寫一次 (b) Modal 動畫 / shadow / radius 統一 (c) 改 modal 樣式改 ui/Modal 一處 (d) 4 個 modal 從 ~300 行 → ~200 行。',
      '**動到的檔案（6 個）**：`src/components/ui/Modal.jsx`（加 variant prop）/ `src/components/ui/Button.jsx`（加 warning + danger-fill variants）/ `src/components/FlowEditor/SaveModals.jsx`（重寫兩個 modal）/ `src/components/Dashboard/CloneFlowModal.jsx`（重寫）/ `src/components/Dashboard/DuplicateImportModal.jsx`（重寫）+ `src/data/changelog/current.js`（本條）。',
      '**驗證**：`npm run build` 通過。手動：(a) FlowEditor 儲存遇 blocking 跳紅 header modal、warning 跳黃 header (b) 點 ESC 關閉、點背景關閉 (c) Dashboard 複製 modal 看 input + 取消/複製並開啟 (d) Excel 匯入重複時跳 modal、三個 button 視覺正常。',
    ],
  },
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

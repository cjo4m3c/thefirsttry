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
      '**動到的檔案（7 個）**：`src/components/Dashboard/sortFlows.js`（24h fmtDateTime + SORT_OPTIONS 文字）/ `src/components/Dashboard/FlowListTable.jsx`（欄寬 + thead + 名稱 button + RolesPreview cap 2）/ `src/components/Dashboard/FlowCard.jsx`（標題 button）/ `src/components/Dashboard/index.jsx`（sortKey localStorage）+ `src/data/changelog/{current,c32,index}.js`（c32 凍結 PR #233 + #232 兩條、current.js 從 9.7KB 降回 ~3KB）。',
      '**驗證**：`npm run build` 通過。手動：(a) 表格表頭顯示「L3編號 / L3活動名稱」(b) sort dropdown 文字統一無空格 (c) 日期顯示 24h「2026/05/19 15:23」、表格 + 卡片一致 (d) 名稱欄變寬、長名稱不再 `…` (e) 主要角色 chip 顯示 2 + N (f) 點名稱 cell 進編輯、hover 變亮藍 (g) 排序選後進編輯頁回來、排序保留 (h) 刷新瀏覽器排序仍保留。',
    ],
  },
];

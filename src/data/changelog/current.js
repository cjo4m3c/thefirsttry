/**
 * Changelog "current tip" — new entries since last freeze land here.
 * When this file grows beyond ~7KB, freeze: rename to c{next}.js + reset to [].
 * Entries are newest-first within file.
 */
export default [
  {
    date: '2026-05-19',
    title: 'Dashboard 搜尋 + 篩選 + 分頁 — 支援上百個 L3 活動',
    items: [
      '**緣由**：使用者「未來可能會有上百個 L3 活動會被放入管理、新增搜尋 + 分頁功能、規劃支援」。需求：(1) 關鍵字搜尋 (2) L2 編號前綴篩 (3) 角色多選篩 (4) 分頁。',
      '**1. 關鍵字搜尋（範圍 A2）**：在 L3 名稱 + L3 編號 + L4 任務名稱 中 substring 比對（大小寫不敏感）。覆蓋「忘記 L3 但記得任務名」這個 100+ 流程最常見需求。不含任務子欄位（說明/輸入/輸出/資料）避免誤命中「服務」「處理」等通用詞。',
      '**2. L2 篩選 UI（B1 dropdown）**：系統掃出 `extractL2Options` 所有現存 L2 prefix + count（如「1-1 (12)」/「2-1 (5)」）、單選 dropdown。使用者不用記 L2 編號。',
      '**3. 角色篩選 UI（C1 dropdown 多選）**：系統掃出 `extractRoleOptions` 全站去重角色 + count、checkbox 多選。多選 AND 結合（流程必須同時含這些角色才命中）。多選後 dropdown trigger 顯示「角色 ▾ (2)」。',
      '**4. 分頁（D1 fixed 25/頁）+ sticky thead**：`PAGE_SIZE = 25`、上百流程 → 4 頁。`Pagination` 顯示「‹ 1 2 3 ... 4 › 第 N / M 頁、共 N 個」、totalPages > 7 用 ellipsis。`FlowListTable thead` 加 `sticky top-0 z-10`、表格往下滑表頭凍結。',
      '**Pipeline**：filter → sort → paginate（清晰分層）。Filter 改變 → page 自動 reset 到 1（避免「第 3 頁 filter 後只剩 2 頁」錯誤）。sortKey 仍 localStorage 持久（PR #234）、search query 用 **sessionStorage**（跨 page navigate 保留、不跨瀏覽器 session）。',
      '**Active filter chips + clear**：頂部 search bar 下方顯示「篩選中：關鍵字「...」/ L2 = 1-1 / 角色 = ...」chip、每個 chip 可單獨「✕」清除、「✕ 清除全部」一鍵清。0 結果跳 `EmptyState`「🔍 沒有符合篩選的流程」+ 清除按鈕。',
      '**動到的檔案（6 個）**：`src/components/Dashboard/sortFlows.js`（加 filterFlows / extractL2Options / extractRoleOptions 3 個 helper）/ `src/components/Dashboard/SearchBar.jsx`（**新檔**、SearchBar + L2 Dropdown + RolesDropdown + FilterChip + EmptyState）/ `src/components/Dashboard/Pagination.jsx`（**新檔**、page controls + visiblePages ellipsis）/ `src/components/Dashboard/index.jsx`（state + pipeline + render 改 pagedFlows）/ `src/components/Dashboard/FlowListTable.jsx`（thead sticky）+ `src/data/changelog/current.js`。',
      '**驗證**：`npm run build` 通過（Dashboard/index.jsx 18.3KB、軟 15KB 超但硬 20KB 內）。手動：(a) 搜尋打字即時 filter (b) L2 dropdown 列出現存 L2 + count、選後篩 (c) 角色 dropdown 多選、(2) 計數顯示在 trigger (d) 三 filter AND 結合 (e) 0 結果跳 EmptyState (f) 分頁切換、`<` `>` 上下頁 (g) 表格滑動時表頭凍結 (h) 進編輯回 Dashboard 篩選保留、頁碼 reset 1 (i) 刷新瀏覽器篩選保留（sessionStorage）(j) 關閉瀏覽器重開、篩選 reset（不 localStorage）。',
    ],
  },
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

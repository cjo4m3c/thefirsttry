/**
 * Changelog "current tip" — new entries since last freeze land here.
 * When this file grows beyond ~7KB, freeze: rename to c{next}.js + reset to [].
 * Entries are newest-first within file.
 */
export default [
  {
    date: '2026-04-29',
    title: 'PR-8：拆 Dashboard.jsx 26KB → 7 檔 + Git push 規則 §2 校正（依 API 分流）',
    items: [
      '**動機**：使用者「15kb 邊界值會一直 timeout，請提出解決方法」。實況觀察：`mcp__github__push_files`（多檔 batch）26KB 才會 timeout，但 `mcp__github__create_or_update_file`（單檔 API）推 15.5KB 順利完成。原本兩種 API 共用 15KB 閥值，誤把單檔的安全範圍當成 batch 的安全範圍，導致一推 batch 就觸發。',
      '**CLAUDE.md §2 改成依 API 分流的矩陣**：`push_files` 多檔 batch 安全 ≤10KB / 邊界 10–15KB / >15KB 手動；`create_or_update_file` 單檔 安全 ≤15KB / 邊界 15–18KB / >18KB 手動。瓶頸是**單次 API 呼叫的總 payload**，不是個別檔案大小。',
      '**根除潛在受害者：拆 Dashboard.jsx**（549 行 26KB）→ `src/components/Dashboard/` 7 檔，全部 ≤12.4KB（落在 `create_or_update_file` 安全帶）。Dashboard 是 backlog 短期會碰的檔案（M-1 頁首按鈕統一 / F Excel 部分匯入 / H 批次下載），先拆掉避開未來 timeout 連鎖。',
      '**拆檔結構**：`Dashboard.jsx` 5 行 shim → `Dashboard/index.jsx`（12.4KB orchestrator + state + handlers）/ `sortFlows.js`（2.1KB SORT_OPTIONS + sortFlows 純函式）/ `ImportBanners.jsx`（2.3KB 三條 banner）/ `BulkToolbar.jsx`（2.5KB 批量工具列）/ `FlowCard.jsx`（4.2KB 單張卡片）/ `DuplicateImportModal.jsx`（3.0KB 重複編號 modal）/ `PngRenderers.jsx`（1.2KB 隱藏 PNG renderer）。所有 state 留在 index.jsx，子元件純 props/handlers，可獨立 review / 改寫。',
      '**外部 import 路徑零變更**：唯一 importer `src/App.jsx` 的 `import Dashboard from \'./components/Dashboard.jsx\'` 一行不動。子元件 import 自動跟著 `src/components/Dashboard/` 一層深調整（`../HelpPanel.jsx` / `../../utils/excelImport.js` 等）。',
      '**HelpPanel.jsx 26KB 暫不拆**：歷史 8 commits 都是業務規則同步觸發（中低頻），且短期 backlog 沒有規則改動排程，繼續走手動 push SOP（>18KB 區間）即可。',
      '**驗證**：`npm run build` 通過（117 modules transformed，比拆前 +6 因新增 6 個子模組）。`find src -name "*.jsx" -size +15k` Dashboard 範圍空輸出。',
      '**Changelog freeze**：current.js 加完條目超 7KB → 凍結 PR-5/PR-6 兩條到 `c15.js`，`index.js` 加 c15 import，current.js 只留本 PR 條目。',
      '**Backlog**：「後續批次拆檔」條目移除 `Dashboard.jsx`（本 PR 拆完）和 `taskDefs.js`（PR-6 解掉）；剩 `HelpPanel.jsx` 26KB / `ContextMenu.jsx` 19KB / 凍結 `c13.js` 17KB 三項待處理。',
    ],
  },
];

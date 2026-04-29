/**
 * Changelog "current tip" — new entries since last freeze land here.
 * When this file grows beyond ~7KB, freeze: rename to c{next}.js + reset to [].
 * Entries are newest-first within file.
 */
export default [
  {
    date: '2026-04-29',
    title: 'backlog 合併 + 交接文件 + changelog 凍結 c15',
    items: [
      '**緣由**：使用者一次提了 13 條待辦（部分重複舊條），順手請求補交接文件給下個 session。',
      '**backlog 合併**：6 條真新加入（**X** 字級放大版面修補 / **Y** tooltip 編輯既有閘道分流條件 / **Z** 閘道 fork+merge auto-fill 任務關聯說明 / **AA** 新增任務自動帶入泳道角色 / **AB** 任務連線到閘道自動新增分支欄位[待確認] / **AC** 複製整個 L3 工作流），6 條跟既有條目（F / M-1 / U / V / B / E）合併不重複新增。Phase 2 PR-5/6/7 從「進行中」標 ✅ 已完成；後續批次拆檔表移除已解的 `HelpPanel.jsx` 26KB（PR #84 已抽 helpPanelData）。',
      '**新檔 `.claude/handover-2026-04-29.md` 7.2KB**：給下個 session 的時點性快照 — 當前 git 狀態、本次完成的 4 commits、新建立的 3 條約定（三件組同步 / 對應實作目錄+符號名 / business-rules.md 不放業務規則）、6 條已知陷阱、優先序建議。下個 session 讀完可以刪。',
      '**Changelog freeze**：current.js 達 9.97KB（已超 7KB 軟上限），凍結到 `c15.js`（業務規格 refactor + PR-5/6/7 共 4 條）；`index.js` 加 c15 import；current.js 重置只留本 PR 條目。',
    ],
  },
];

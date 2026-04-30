/**
 * Changelog "current tip" — new entries since last freeze land here.
 * When this file grows beyond ~7KB, freeze: rename to c{next}.js + reset to [].
 * Entries are newest-first within file.
 */
export default [
  {
    date: '2026-04-30',
    title: '規則文件同步 + HelpPanel 移除「連線規則」段落',
    items: [
      '**緣由**：使用者：「請收尾，並確保目前業務規則文件、changelog、handover、readme等都有更新到最新。並更新首頁右上角的規則說明，我希望這個說明內不要顯示『連線規則』這個段落」。PR #110 / #111 / #112 三個 PR 連動更動 UI 互動模型（衍生關聯說明 preview / 元件類型統一選單 / 拖曳改 ▲ ▼ 按鈕），規則文件需同步。',
      '**Step 1 — `HelpPanel.jsx` 移除「連線規則 Connections」段落**：使用者要求移除該章節（連線型態現在由「元件類型」單一選單自動衍生，使用者不再需要手動選連線型態，這段對使用者來說已是冗餘）。砍掉 Section block + `CONNECTIONS` import。完整連線規則仍在 `docs/business-spec.md §4`（給協作者 / 開發者看）。',
      '**Step 2 — `helpPanelData.js`**：(a) 移除 `CONNECTIONS` array 全部 10 條（180 行）(b) 「拖曳排序任務 / 拖曳排序泳道角色」改成「▲ ▼ 排序任務 / ▲ ▼ 排序泳道角色」(c) 檔頭 doc comment 加上「連線規則 §4 不在 HelpPanel 顯示」備註，方便未來維運者看到不會誤以為被遺漏。',
      '**Step 3 — `docs/business-spec.md §4` 章節重寫**：(a) 章節 intro 改寫成「使用者不直接選連線型態，而是選元件類型，連線型態由元件類型自動衍生」(b) 「流程設定」表格欄改名為「連線型態」+「由哪個元件類型衍生」雙欄 (c) 「對應實作」段加 `src/utils/elementTypes.js` 路徑。',
      '**Step 4 — `docs/business-spec.md §8.2` 編輯器操作表**：(a) 拖曳排序兩條 → 「▲ ▼ 排序」(b) 加新條目「元件類型切換」+「任務關聯說明 preview」反映 PR #110 / #111 (c) §8.3 對應實作加 `src/components/reorderButtons.jsx` 路徑。',
      '**Step 5 — `README.md` + `HANDOVER.md` 樹狀圖**：`dragReorder.jsx` → `reorderButtons.jsx`（檔已刪 / 加 PR #112），加 `src/utils/elementTypes.js` 條目（PR #111）。',
      '**Step 6 — `.claude/backlog.md` 整理**：(a) 「N. 泳道角色拖曳視覺提示」標 OBSOLETED（drag 砍了，DropLine 不存在）(b) 新增「2026-04-30 出清」段落列出 PR #110 / #111 / #112 / #113 摘要。',
      '**Step 7 — changelog freeze**：current.js 累積到 8.7KB > 7KB threshold → freeze 成 `c21.js`（含 PR #111 + #112 兩條），current.js reset 後加本條，`index.js` 加 c21 import。',
      '**動到的檔案（10 個）**：`src/components/HelpPanel.jsx`（移 Section + import）/ `src/data/helpPanelData.js`（砍 CONNECTIONS + 改 drag→arrow 文字）/ `docs/business-spec.md` §4 / §8.2 / §8.3 / `README.md`（樹狀）/ `HANDOVER.md`（樹狀）/ `.claude/backlog.md`（標 N obsolete + 出清段）/ `src/data/changelog/c21.js`（新 freeze）/ `current.js`（reset + 本條）/ `index.js`（加 c21 import）。`build` 通過。',
      '**驗證情境**：(a) 首頁右上角點「規則說明」→ 6 個 Section（層級架構 / 編號規則 / 流程圖元件定義 / 驗證規則 / 可編輯操作 / 匯出格式），「連線規則」消失 ✓ (b) 「可編輯操作」第一條改成「▲ ▼ 排序任務」(c) `docs/business-spec.md` §4 反映新 UX (d) README / HANDOVER 檔案樹反映 reorderButtons.jsx + elementTypes.js',
    ],
  },
];

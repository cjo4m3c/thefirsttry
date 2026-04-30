/**
 * Changelog "current tip" — new entries since last freeze land here.
 * When this file grows beyond ~7KB, freeze: rename to c{next}.js + reset to [].
 * Entries are newest-first within file.
 */
export default [
  {
    date: '2026-04-30',
    title: '修外部互動底色從未生效（renderer 判斷 task.type 而非 shapeType）',
    items: [
      '**緣由**：使用者：「發現外部互動的UI顯示還是跟任務一樣，我希望外部互動的元件，UI的底色是#a0a0a0（灰）」。PR #119 把 `INTERACTION_FILL` 改成 `#A0A0A0`，但畫面跟匯出仍然顯示白底 — 因為渲染端判斷條件寫錯。',
      '**Root cause**：「外部互動」任務的資料 model 是 `type=\'task\'` + `shapeType=\'interaction\'`（PR #111 起的設計：interaction 是 task 的 shape 變體，不是獨立 type）。但 `shapes.jsx:42` 跟 `drawioExport.js:104` 兩個渲染點都檢查 `task.type === \'interaction\'`，永遠 false → 灰底常數從未實際套用過。這個 bug 早就存在於 model 重構時，PR #119 沒注意到，改 constants 不會修這個 path。',
      '**修法**：兩處 `task.type === \'interaction\'` → `task.shapeType === \'interaction\'`。一行改、零風險（已是 PR #119 所有觸發點 / `detectElementKind` / validation rule 3e 過去用的判斷）。',
      '**保留**：`taskDefs.js:154` 的 `task.type === \'interaction\'` 在 `normalizeTask` 內，是**舊資料 migration**（pre-PR #111 model 把 type=\'interaction\' 自動轉成新的 shapeType=\'interaction\'）— 不能動。',
      '**動到的檔案（3 個）**：`src/components/DiagramRenderer/shapes.jsx`（畫面 fill）/ `src/utils/drawioExport.js`（匯出 fill）/ `src/data/changelog/current.js`（本條）。`build` 通過。',
      '**驗證**：(a) 流程圖上外部角色泳道的任務應該顯示灰底 `#A0A0A0` ✓ (b) 匯出 .drawio 開到 diagrams.net 也是灰底 ✓ (c) 一般任務維持白底（`#FFFFFF`）✓',
    ],
  },
  {
    date: '2026-04-30',
    title: '外部關係人互動元件 — 角色驅動的自動切換 + 灰底配色 #A0A0A0',
    items: [
      '**緣由**：使用者：「我希望下一步來優化全站「外部關係人互動」的規則。規則是在外部角色泳道做的「任務」，都要使用「外部關係人互動」這個元件，不能使用原本的「L4任務」元件...被移到外部角色泳道的任務，要自動使用「外部關係人互動」這個元件，換到內部角色時會自動變回「L4任務」元件，其他閘道、開始結束、L3元件則適用於所有泳道」+「依照你的建議方案執行，excel匯入的角色默認為內部角色，使用者自行更改即可」。',
      '**Step 1 — 純函式 helpers（`elementTypes.js`）**：(a) `applyRoleChange(task, newRoleId, roles)` 處理「任務換泳道」 — 若 task 是 lane-sensitive（`type === \'task\'` 且 shapeType 屬 task / interaction），依新泳道的 role.type 自動 sync shapeType（external → interaction、internal → task）。閘道 / 開始 / 結束 / L3 不動。 (b) `syncTasksToRoles(tasks, roles)` 是純函式 cascade — 給定任務 + 角色清單，回傳所有任務 shapeType 已 sync 的新陣列，idempotent。 (c) `isLaneSensitive(task)` private helper 判斷 task 是否該 lane-driven。',
      '**Step 2 — 觸發點**：(1) `TaskCard.jsx` 角色 select onChange → `applyRoleChange`；(2) `ContextMenu/index.jsx` 角色 select onChange → 同；(3) `DrawerContent.jsx` 角色泳道列表 type select onChange → cascade `syncTasksToRoles`（一次 sync 所有該泳道任務）；(4) `Wizard.jsx` Step 2 角色 type 變更 → 同 cascade；(5) `storage.js` `migrateFlow` 載入時一次性 fixup（idempotent — 已 sync 過 return same ref）。',
      '**Step 3 — Excel 匯入維持原行為**：parser 不動，預設「內部角色 + L4 任務」。使用者匯入後若要改成外部，手動把該泳道 role.type 改成 external 即觸發 cascade。',
      '**Step 4 — 視覺**：`diagram/constants.js` `INTERACTION_FILL` 從 `#D1D5DB` → `#A0A0A0`（使用者規範灰底）。',
      '**Step 5 — 拿掉 validation rule 3e**：原本「shapeType=interaction 但 role=internal 跳 warning」，現在 auto-sync 後永遠不會發生，註解保留說明歷史。helpPanelData VALIDATION 對應條目同步移除。',
      '**Step 6 — 文件同步**：`docs/business-spec.md §3` 表格「互動任務」改名「外部關係人互動」+ 灰底 + auto-sync 說明；新增 §3.1 細則章節（觸發表 / 範圍限制 / Excel 匯入 / 對應實作）；`helpPanelData.js` ELEMENTS 對應條目改寫。',
      '**動到的檔案（10 個）**：`src/utils/elementTypes.js`（+helpers）/ `src/utils/storage.js`（+load fixup）/ `src/components/FlowEditor/TaskCard.jsx`（role select）/ `src/components/ContextMenu/index.jsx`（同）/ `src/components/FlowEditor/DrawerContent.jsx`（cascade）/ `src/components/Wizard.jsx`（cascade）/ `src/diagram/constants.js`（color）/ `src/model/validation.js`（移 3e）/ `src/data/helpPanelData.js`（ELEMENTS + VALIDATION）/ `docs/business-spec.md` §3 + 3.1 / `src/data/changelog/current.js`（本條）。`build` 通過。',
      '**驗證情境**：(a) TaskCard 把任務從內部泳道角色換到外部角色 → shapeType 自動變 interaction，圖上底色變灰 ✓ (b) 換回內部角色 → 變回 task 白底 ✓ (c) DrawerContent 把整個泳道 role.type 從 internal 翻成 external → 該泳道所有任務 cascade 變 interaction ✓ (d) 重新整理頁面 → 載入時 fixup 確保 mismatch 修正 ✓ (e) 閘道 / 開始 / 結束 / L3 在外部泳道不被動 ✓ (f) Excel 匯入後手動改 role.type → cascade 觸發 ✓ (g) 儲存不再跳「外部互動建議放外部角色泳道」warning ✓',
    ],
  },
  {
    date: '2026-04-30',
    title: '編輯器 TaskCard：「元件類型」label 字級放大對齊「下一步」/「任務重點說明」',
    items: [
      '**緣由**：使用者：「我希望在編輯器每個編輯區塊中，「元件類型」的字級變得跟「下一步」「任務重點說明」一樣大」。Row 2 的 label 用 `text-xs text-gray-500`，跟其他 row 的 label（`text-sm text-gray-600`）視覺上比例不一致 — 看起來像「附屬欄位」而不是同等重要的元件選擇。',
      '**改動**：`TaskCard.jsx` Row 2「元件類型」label：`text-xs text-gray-500` → `text-sm text-gray-600`，跟 ConnectionSection（下一步 / L3 編號 / 條件 N → / 返回至 ↺）+ 展開區塊（任務重點說明 / 任務重要輸入 / 任務產出成品 / 參考資料來源文件名稱）字級完全一致。',
      '**動到的檔案（2 個）**：`src/components/FlowEditor/TaskCard.jsx`（單行 className 改）+ `src/data/changelog/current.js`（本條）。`build` 通過。',
    ],
  },
  {
    date: '2026-04-30',
    title: '編輯器 TaskCard 佈局修正：col 2 收緊 + Row 3 單目標欄位左對齊',
    items: [
      '**緣由**：使用者：「下一步後面要選擇目標任務的地方，可以把要選的任務指向靠左對齊，這樣下一步跟後面的下拉選單中間才不會空空的」+「左側第一欄的資訊都跟中間欄的資訊有一大片空白，希望可以把空白縮小一點讓每個資訊都能有足夠的空間顯示」。',
      '**Step 1 — col 2 寬度 `w-[120px]` → `w-24`（96px，省 24px）**：TaskCard 三列（Row 1 badge / Row 2「元件類型」label / Row 3 ConnectionSection / Row 4 「關聯說明」label）+ DrawerContent InsertPicker 全部用 `w-24`。多出的 24px 給 col 3+4。',
      '**Step 2 — ConnectionSection 單目標欄位左對齊**：原本 `sequence / start / subprocess / loop-return / breakpoint` 五種型態的 Row 3 都用「label `w-[120px]` + spacer `w-40` + select `flex-1`」三段，spacer 在「下一步 →」label 跟 select 中間留下尷尬空白（使用者圖中可見）。改成 label `w-24` + select `flex-1`（跨原本的 col 3+4），dropdown 緊貼 label 後面顯示。**branch 系列**（`conditional-branch / parallel-branch / inclusive-branch`）的 col 3 是條件標籤 input 不能砍，保持原 layout。',
      '**Step 3 — 長 label 縮短避免被 truncate**：col 2 從 120px 收緊到 96px 後原 label 會被 `truncate` 截斷。`子流程 L3 編號` → `L3 編號`（context 已經很清楚這是子流程）；`迴圈返回至 ↺` → `返回至 ↺`（紅色字 + ↺ icon 已表達迴圈含義）。',
      '**動到的檔案（4 個）**：`src/components/ConnectionSection.jsx`（lbl 寬度 + 5 種非 branch 型態砍 spacer + 兩個 label 縮短）/ `src/components/FlowEditor/TaskCard.jsx`（4 處 w-[120px] → w-24 + 註解同步）/ `src/components/FlowEditor/DrawerContent.jsx`（InsertPicker 同樣換）/ `src/data/changelog/current.js`（本條）。`build` 通過。',
      '**驗證情境**：(a) 一般任務 Row 3 「下一步 →」緊接 dropdown，無中間空白 ✓ (b) 排他閘道 Row 3 「條件 1 →」+ 標籤 input + 目標 select 三段保留（branch 系列原 layout）✓ (c) 子流程 Row 3 「L3 編號」label 顯示完整（不會被截斷）✓ (d) 迴圈返回 Row 3 「返回至 ↺」紅色 label 完整 ✓ (e) col 2 整體更緊湊，Row 1 ▲▼ 跟 1-0-1-3 編號間距變小 ✓',
    ],
  },
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

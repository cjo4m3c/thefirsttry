/**
 * Changelog archive chunk c13b (frozen — do not edit).
 * Split from c13.js (17.7KB → c13a 9KB + c13b 9KB, 2026-05-11) so neither
 * half exceeds the 15KB soft cap. Contains the older half (entries dated
 * 2026-04-27); c13a holds the newer half (2026-04-28).
 * See ChangelogPanel.jsx for the full UI.
 */
export default [
  {
    date: '2026-04-27',
    title: '閘道種類切換 + FlowTable 同步修 + 四視圖一致性 invariant + skill 整理',
    items: [
      '**閘道種類切換**（使用者：「在既有的閘道上可以點選後在編輯元件 tooltip 中，可以換成其他種類的閘道」）：`ContextMenu` 加「換閘道種類」sub-form（task.type === "gateway" 時才顯示），radio 三選一 XOR / AND / OR，確認後改 `gatewayType` + 對應 `connectionType`（fork↔fork or merge↔merge），保留現有 conditions / 連線目標',
      '**閘道任務名稱前綴**（使用者：「新增閘道元件時，下方 excel 的「L4 任務名稱」欄位，自動依照格式 [OO閘道] 任務名稱 填入」）：`taskDefs.js` 加 `GATEWAY_LABELS / gatewayPrefix() / applyGatewayPrefix()` 三個 helper（單一來源）；`FlowEditor.insertGatewayAfter` 新閘道 name 預填 `[排他閘道] ` / `[並行閘道] ` / `[包容閘道] `；`ContextMenu` 切換閘道種類時自動 strip 舊 prefix 加新 prefix，保留使用者填的後段',
      '**修 FlowTable 同步 bug**（使用者：「下方 excel 的欄位也要在同樣順序的地方，同步新增一列」）：root cause = `FlowTable.jsx:60` `useEffect` 只 watch `flow.id`，新增任務 / 拖曳重排時 `flow.id` 不變、`flow.tasks` 變了 → 內部 `tasks` state 不重新 sync。修法：deps 加 `flow.tasks`',
      '**四視圖一致性 invariant**：使用者明確要求「每次更新時檢查」流程圖 / drawer / FlowTable / 下載資料四者同步。寫進 `.claude/skills/doc-audit.md` §5 + `.claude/skills/ship-feature.md` §3.5 為硬性檢核點，未來操作 task 後必跑',
      '**Skill 整理**：',
      '　• 新增 `/preview-branch` skill — 高風險 / 視覺敏感改動先在 `https://cjo4m3c.github.io/FlowSprite/preview-<slug>/` 部署預覽；含 deploy-preview.yml 模板 + GitHub Pages environment 設定步驟 + merge 後刪 workflow 的 cleanup 流程',
      '　• 新增 `/wrap-pr` skill — 累積多 commits 的整理 SOP（掃 redundant → doc-audit → 評估順帶技術債 → 一筆 consolidated changelog → ship）',
      '　• 更新 `/doc-audit` — 移除 ROUTING / CORRIDOR（已搬到 HANDOVER）；加 `EDITABLE_ACTIONS` / `FORBIDDEN_RULES`；加 §5 四視圖 invariant 檢核；VALIDATION 從 Wizard.jsx 改成 FlowEditor.jsx（修舊錯）',
      '　• 更新 `/ui-rules` §10 — 加 RightDrawer / ContextMenu / DropLine 三種浮動元件 pattern（給未來新增類似元件 reuse）',
      '　• 更新 `/ship-feature` §3 對照表 — 新增/刪除元件需同步 README + HANDOVER；新增 skill 需同步清單；§3.5 加四視圖 invariant 強制檢核',
    ],
  },
  {
    date: '2026-04-27',
    title: '編輯體驗大改造：drawer + ContextMenu + hover tooltip + 拖曳線條 + 文件整理',
    items: [
      '**版面重構**：流程圖下方原 3 tab（設流程 / Excel 清單 / 設角色）改成「流程圖 + Excel 表格直顯」+ 右側 drawer（點 ✏️ 編輯按鈕滑出，內含「設定流程」「設定泳道角色」兩個 tab）。Excel 表格不再藏在 tab 裡',
      '**ContextMenu**（點任務元件出編輯選單）：使用者：「點選流程圖上的所有元件時，可以出現一個小選單」。可 inline 編輯名稱 / 角色 / 任務重點說明，以及前後插入任務、新增一條連線、新增閘道（XOR/AND/OR + 兩條連線目標）、刪除元件。新元件自動 reconnect 避免孤兒（addTaskBefore / addTaskAfter / insertGatewayAfter）',
      '**Hover tooltip**（hover 任務看重點說明）：使用者：「hover 到任務時可顯示任務重點說明」。`DiagramRenderer` 加 tooltip state，hover task shape 上方彈出（只有有填 description 才顯示），訪談快查 / 詳細編輯雙場景滿足（持續顯示走 ContextMenu）',
      '**Click 任務時亮起**：使用者：「希望編輯元件點開來時，要編輯的那個元件也會亮起來」。FlowEditor 把 `contextMenu.task.id` 傳 `highlightedTaskId` 給 DiagramRenderer，reuse hover 樣式',
      '**拖曳 drop indicator 升級**：使用者：「拖曳到哪裡就哪裡的中間位置亮起來」。`useDragReorder` hook 加 `dropAfter`（依滑鼠 Y 對 row 中線判定）；TaskCard 改 `dropEdge` prop（top/bottom/null），讓**插入位置上下兩 row 都亮藍邊** + 中間插入明顯藍色 DropLine 條',
      '**Drawer 角色拖曳**：drawer「設定泳道角色」tab 接 `useDragReorder`，可拖排序泳道；`Wizard` 同步接 `dropAfter` indicator',
      '**TaskCard 2-row layout**（drawer 名稱欄擠扁修復）：drawer 寬度 ~528px 下原本一行排 7 個元素導致 name input 被擠到 ~50px。改成 Row 1（drag + badge + role + name + actions）+ Row 2（連線類型 + 形狀），name 有 ~280px 寬',
      '**ContextMenu 加 description textarea**：menu 內可直接編輯任務重點說明（rows=3，可 resize）',
      '**Excel 匯出 annotation 一致性（技術債 D）**：`buildExcelRows` 從 `task.flowAnnotation || generateFlowAnnotation()` 改成永遠重算，匯入後改連線下載 Excel 不再用舊文字',
      '**HelpPanel 規則改寫**：移除「判斷框指向規則 Gateway Routing + Corridor slot」table（這些是內部 layout 細節，使用者已能直接拖端點不需要看）→ 改成「可編輯操作 Editable Actions」+「不能違反的規則 Forbidden Rules」（IN+OUT 混用 / 線跨任務 / 開始結束必須有連線 / L4 編號規則）。原 ROUTING / CORRIDOR 表搬到 `HANDOVER.md` §2.5 作為內部開發者參考',
      '**Cosmetic 黏行清理（技術債 A）**：FlowEditor.jsx:106 `// 4.` 兩行擠成一行修正；HelpPanel.jsx:145 `},  },` 黏行修正',
      '**清理死 workflow**：刪 `.github/workflows/deploy-preview.yml`（trigger 是已 merge 的 `claude/drawer-experiment` branch，永遠不會跑）。`vite.config.js` `VITE_BASE_PATH` env override 保留（給未來 preview branch 重用）',
      '**README + HANDOVER 更新**：加入 `RightDrawer.jsx` / `ContextMenu.jsx` 元件、`paste-bundle.md` skill；HANDOVER §2.5 加 `layout.js` 內部路由規則參考；§3.2 加 OR fork 關鍵字；§3.3 加 OR join 關鍵字',
      '本 PR 涵蓋 4 個 merged PR（#66 drawer 重構 → #67 drawer 名稱欄寬 + 拖曳線條 + tooltip + ContextMenu desc → #68 drawer 角色拖曳）的 changelog 補登 + 本次「flow tab DropLine 升級 + 文件整理 + 技術債」一次發。下次按 §4 規則一 PR 一筆',
    ],
  },
  {
    date: '2026-04-27',
    title: '修復 Excel 下載編號不符規則（單一 source of truth）',
    items: [
      '**情境**：使用者：「我希望先修正現在下載出來的 excel 沒有遵守編號規則的問題，畫面上的編號規則是對的」',
      '**Root cause**：`excelExport.js` 的 `buildTableL4Map` 是**自己一套** counter 邏輯（純流水給每一個 task 包含 start/end/gateway 通通遞增），跟 `computeDisplayLabels`（畫面 / 流程圖 / 編輯下拉用的）兩套並存。當 task 沒 stored `l4Number`（純新增流程）時，Excel L4 編號欄就完全沒套規則 → 例如 `start=L3-1`（應為 `-0`）、`end=L3-6`（應為 `-99`）、閘道 `L3-3`（應為 `_g`）',
      '**影響範圍**：①Excel 下載的「L4 任務編號」欄位 ②Excel 下載的「任務關聯說明」欄裡引用的編號（`generateFlowAnnotation` 用同一個 l4Map）③ FlowTable Tab 顯示的編號（`FlowTable.jsx:63`）— 都是錯的',
      '**修正**：`buildTableL4Map(l3Number, tasks)` 直接 wrap `computeDisplayLabels(tasks, l3Number)`，移除自己的 counter 邏輯。從此**整個系統只有一個編號函式**，畫面 / 流程圖 / Excel / FlowTable 共用同一個 source of truth',
      '**保留行為**：stored `task.l4Number` 仍然優先（不破壞 Excel 匯入時保留原始編號的設計）；只有純新增 / 拖曳重排後的純動態編號路徑被修正',
      '驗證 3 trace 情境：① 純新增（start=-0, gw=_g, end=-99 ✓）② 連續閘道 _g/_g2 ✓ ③ 匯入有 stored l4Number 不變 ✓',
      '**順帶發現（未修，留下次 PR）**：`buildExcelRows` 仍用 `task.flowAnnotation || generateFlowAnnotation(...)`，匯入過的 task 即使後來改連線，匯出仍用 stored 原始文字 → FlowTable 顯示（永遠重算）跟 Excel 匯出（優先 stored）不一致。建議下次改成永遠重算',
    ],
  },
];

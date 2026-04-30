/**
 * Changelog c21 — frozen archive chunk (oldest entries first).
 * Frozen on 2026-04-30 when current.js reached ~8.7KB (>7KB threshold).
 * Contains PR #111 (元件類型 unified) + PR #112 (drag → ▲ ▼ buttons).
 */
export default [
  {
    date: '2026-04-30',
    title: '編輯器：拖曳改順序改用 ▲ ▼ 按鈕（HTML5 drag 三度修不好，砍掉重來）',
    items: [
      '**緣由**：使用者：「現在編輯器內拖曳功能還是不能用，我想討論看看哪種比較好操作和好維運。方案一：拖曳修到好，操作最直覺。方案二：使用者點擊任務編輯區塊後，可以由使用者自己點選向上移動或向下移動。」三次修 HTML5 native drag（PR #104 拆 rowProps/handleProps、PR #106 SVG pointer-events、PR #108 SVG → div+spans）依然在不同瀏覽器 / 觸控裝置 / Tailwind 版本碰到 edge case，使用者實測仍不能用。判斷 HTML5 drag 在含 `<input>` / `<select>` 的 row 裡本質上不可靠，砍掉重來。',
      '**選方案二（▲ ▼ 按鈕）的理由**：(1) 100% 可靠跨瀏覽器 / 觸控 / 鍵盤 (2) 零 deps（不引入 @dnd-kit ~30KB）(3) 砍掉 ~80 行 fragile drag plumbing（dragIdx / overIdx / dropAfter state、DropLine 渲染、rowProps/handleProps split、useDragReorder hook 全砍）(4) accessibility 預設友善 (5) 觸控裝置友善（手機平板拖曳本來就笨）。代價是「跨多列移動需多次點擊」，但 L3 流程通常 5-10 個任務，兩三點不是問題。',
      '**Step 1 — 新增 `src/components/reorderButtons.jsx`**：`ReorderButtons` 元件兩顆堆疊 ▲ ▼，用 `disabled={!canUp/canDown}` 在列表頭尾灰掉。佔 w-5 同 slot 維持 5-col 對齊。`moveItem(items, fromIdx, dir)` 純函式 helper：算 toIdx，越界回原 array（no-op），其餘 splice 後回新 array。',
      '**Step 2 — `FlowEditor/index.jsx` 砍 useDragReorder**：兩個 hook instance（taskDrag / roleDrag）整段砍，換成 `moveTask(idx, dir)` / `moveRole(idx, dir)` callback。`moveTask` 保留 strip stored l4Number 邏輯（讓 computeDisplayLabels 重排）。',
      '**Step 3 — `DrawerContent.jsx` 砍 drag plumbing**：移除 dragIdx/overIdx/dropAfter 推導、DropLine 元件、isDragging 守衛（拖曳時隱藏 InsertSlot 的邏輯不再需要）、所有 rowProps/handleProps spread。task tab 改傳 `onMoveUp` / `onMoveDown` 給 TaskCard；role tab 直接 inline render `ReorderButtons`。',
      '**Step 4 — `TaskCard.jsx` props 重整**：`dragHandlers` / `dragHandleProps` / `isDragging` / `dropEdge` 四個 prop 砍掉，換成 `canMoveUp` / `canMoveDown` / `onMoveUp` / `onMoveDown` 四個。Row 1 第一格 `<DragHandle ... />` → `<ReorderButtons canUp={canMoveUp} ... />`。`dropEdge` 樣式邏輯（border-t-2 / border-b-2 highlight）整段砍。',
      '**Step 5 — `Wizard.jsx` Step 2 同樣換**：`useDragReorder` hook → `moveRole(idx, dir)` 函式（用 `moveItem` helper）。每 row 用 `<ReorderButtons />`。提示文字從「可拖曳左側圓點」→「點左側 ▲ ▼ 改變泳道順序」。',
      '**Step 6 — 刪除 `src/components/dragReorder.jsx`**：此檔（109 行）整個沒人用了，刪除。',
      '**動到的檔案（6 個）**：`src/components/reorderButtons.jsx`（新增）/ `src/components/dragReorder.jsx`（刪除）/ `src/components/FlowEditor/index.jsx`（useDragReorder → moveTask/moveRole）/ `src/components/FlowEditor/DrawerContent.jsx`（砍 drag plumbing）/ `src/components/FlowEditor/TaskCard.jsx`（drag props → move callbacks）/ `src/components/Wizard.jsx`（Step 2 改用 ReorderButtons）/ `src/data/changelog/current.js`（本條）。`build` 通過，bundle 略小（-0.6KB gzipped）。',
      '**驗證情境**：(a) 編輯器任務列表 row 0 ▲ disabled、最後一列 ▼ disabled ✓ (b) 點 ▼ task 往下移一格、編號自動重排 ✓ (c) 角色 tab 同樣 ▲ ▼ 可改泳道順序 ✓ (d) Wizard Step 2 角色設定同樣可用 ✓ (e) 鍵盤 Tab 可聚焦到 ▲ ▼，Enter 觸發（accessibility）✓',
    ],
  },
  {
    date: '2026-04-30',
    title: '編輯器 TaskCard：Row 2 統一為「元件類型」單一選單；閘道命名一致性修正',
    items: [
      '**緣由**：使用者：「但是新增後顯示的元件編輯區塊，我希望拉齊操作的邏輯。在任務元件的第二列，是直接編輯對應「任務關聯說明」的內容，反而不能選擇「元件」，但是其實我們現在操作的邏輯都統一為選擇元件，例如選擇「排他閘道」，並且由系統自動填入排他閘道對應的任務關聯說明標準文字。」+「跟 InsertPicker 一致：任務 / 排他 / 並行 / 包容 / 開始 / 結束 / L3 / 外部互動。這之外，請也確保流程圖tooltip、編輯器中的名稱是一致的（現在也發現在tooltip新增閘道時，顯示的文字是「條件」而非正確的「排他」，請統一檢查）。」',
      '**Step A — 抽純函式 `makeTypeChange` / `detectElementKind` / `ELEMENT_TYPES`**：新增 `src/utils/elementTypes.js` 當「元件類型」單一來源（8 種：L4 任務 / 排他閘道（XOR）/ 並行閘道（AND）/ 包容閘道（OR）/ 開始事件 / 結束事件 / L3 流程（子流程調用）/ 外部互動）。`makeTypeChange(task, kind)` 是 pure transform（從 `useFlowActions/converters.js` 的 `convertTaskType` 中抽出邏輯，不再 touch flow store），TaskCard 跟 ContextMenu 都呼叫同一個。`detectElementKind(task)` 是反向：從 task.type/shapeType/connectionType/gatewayType 推回 kind。',
      '**Step B — TaskCard Row 2 重寫**：移除原本「連線型態 select + shapeType select」雙下拉（`CONNECTION_TYPES` / `SHAPE_TYPES`），改成單一「元件類型」select 列出 8 種選項，跟 InsertPicker / ConvertSubForm 完全一致。`onChange` 直接呼叫 `onUpdate(makeTypeChange(task, e.target.value))`，連線文字（`flowAnnotation`）由 `formatConnection` 自動衍生（PR-2 加的 preview 即時更新）。',
      '**Step C — 舊資料相容**：`connectionType: "breakpoint"` 已於 2026-04-29 從 UI 移除（無法新建）。但既有 localStorage 資料可能有 breakpoint 任務 → `detectElementKind` 偵測 breakpoint 時動態多塞一個第 9 個 option「流程斷點（停用，僅相容舊資料）」讓使用者看到正確類型；改成其他類型後就消失（無法回到 breakpoint）。',
      '**Step D — 閘道命名一致性 audit**：',
      '  • `src/components/ContextMenu/subforms.jsx:93`：`GatewaySubForm`（新增閘道 sub-form）radio label `"條件 ◇×"` → `"排他 ◇×"`（使用者明確指出此處 bug）',
      '  • `src/components/DiagramRenderer/legend.jsx:10-12`：「闘道」typo（誤字「闘」）→「閘道」（XOR/AND/OR 三行）',
      '  • 其他檢查通過：`subforms.jsx:187-189` GatewayEditorSubForm 已正確（"排他 ◇×"）/ `subforms.jsx:270-272` ConvertSubForm 已正確（"排他閘道 ◇×"）/ `DrawerContent.jsx:102-104` InsertPicker 已正確（"排他閘道（XOR）"）/ `model/connectionFormat.js` 的 `XOR_FORK = 條件分支至` 是**連線文字格式**（不是閘道類型名稱）保留不動 / `ContextMenu/index.jsx:259` `"編輯閘道（種類 / 條件）"` 此處「條件」指 branch conditions 不是閘道類型，保留不動',
      '**Step E — converters.js 簡化**：`convertTaskType` 從 50 行邏輯壓到 5 行（呼叫 `makeTypeChange`）。檔案少 ~1.5KB。',
      '**Step F — changelog freeze**：`current.js` 累積到 ~40KB（PR-1 / PR-2 / 之前一連串大條目）→ freeze 成 `c20.js`，`current.js` reset 後加本條，`index.js` 加 c20 import。',
      '**動到的檔案（7 個）**：`src/utils/elementTypes.js`（新增）/ `src/components/FlowEditor/useFlowActions/converters.js`（refactor convertTaskType 用 makeTypeChange）/ `src/components/FlowEditor/TaskCard.jsx`（Row 2 重寫）/ `src/components/ContextMenu/subforms.jsx`（"條件 ◇×" → "排他 ◇×"）/ `src/components/DiagramRenderer/legend.jsx`（"闘道" typo → "閘道"）/ `src/data/changelog/c20.js` + `current.js` + `index.js`（freeze）。`build` 通過。',
      '**驗證情境**：(a) 新建 task → Row 2 顯示「L4 任務」 ✓ (b) Row 2 切到「排他閘道（XOR）」→ task 自動加 `[排他閘道]` 前綴 + connectionType 變 `conditional-branch` + 跑出 conditions 子表單，「關聯說明」preview 即時更新成「條件分支至 ...」 ✓ (c) ContextMenu 點「新增閘道」→ 種類 radio 顯示「排他 ◇×」（不再是「條件」）✓ (d) 圖例 modal 顯示「排他閘道 (XOR)」✓',
    ],
  },
];

/**
 * Frozen changelog chunk c19 (2026-04-29).
 * PR-0 + PR-A from current.js when it crossed the 7KB freeze threshold
 * (11.1KB at freeze time). Newest first within file.
 */
export default [
  {
    date: '2026-04-29',
    title: 'PR-A：ContextMenu 操作整合 — 順序重排 / 新增其他 / 轉換為 / 閘道 inline 編輯 / 拖端點到閘道自動加 condition',
    items: [
      '**緣由**：使用者 epic「整合所有的操作 — 流程圖上可以做的操作 = 編輯器可以做的操作」需求 1-5 + 補充說明（連線拖到閘道時自動加 condition + 順序按元件類型不同）。',
      '**Step A — roleId 補漏**：`useFlowActions.js` 的 `addTaskAfter` 跟 `addTaskBefore` 原本用 `makeTask()` default `roleId: \'\'`，跟 `addL3ActivityAfter` / `insertGatewayAfter` 不一致 — 修正為 `makeTask({ roleId: anchor.roleId || \'\' })`。',
      '**Step B — ContextMenu 順序重排**：actions list 改成「常用程度由上往下」。非閘道：1.新增任務 / 2.新增閘道 / 3.新增連線 / 4.新增 L3 流程 / 5.新增其他 / 6b.轉換為 / 7.刪除。閘道：1-4 同 / 6.編輯閘道 / 5.新增其他 / 7.刪除。',
      '**Step C — 新增其他 sub-menu**：`subforms.jsx` 加 `OtherSubForm`，4 個按鈕（開始 / 結束 / 流程斷點 / 外部互動）。`useFlowActions` 加 `addOtherAfter(anchorId, kind)`：start/interaction 繼承 anchor downstream；end/breakpoint 不要 outgoing；繼承 anchor.roleId。',
      '**Step D — 轉換為 sub-menu**：`subforms.jsx` 加 `ConvertSubForm`，9 個目標選項。`useFlowActions` 加 `convertTaskType(taskId, kind)`：保留 id / name / role / description；連線結構盡力保留；轉換時 stored l4Number 跟 connectionOverrides 都清掉。',
      '**Step E — 既有閘道 inline 編輯**：`subforms.jsx` 加 `GatewayEditorSubForm` 取代原 `GatewaySwitchSubForm`。內含閘道類型 radio + conditions 列表 + 「+ 新增分支」。auto-save。**修了「閘道條件只能新增不能編輯」反饋**。',
      '**Step F — 拖連線到閘道自動加 condition**：`useDragEndpoint.js` 拖 target endpoint 落在 gateway 上時，呼叫 `onWireThroughGateway`：A→B 變 A→gateway，**閘道加 condition 指向原 target B**。等於 A→C→B 一次完成。',
      '**檔案大小管理**：useFlowActions.js 加 3 個 actions 後 20.4KB 超硬上限。3 個 actions 抽到 `useFlowActions/converters.js`（factory pattern）。主檔降回 13.3KB；新檔 7.3KB。',
      '**動到的檔案**：`useFlowActions.js` / `useFlowActions/converters.js`（新檔） / `ContextMenu/index.jsx` / `ContextMenu/subforms.jsx` / `useDragEndpoint.js` / `DiagramRenderer/index.jsx` / `FlowEditor/index.jsx` / `CLAUDE.md`（拆檔表）。`build` 通過。',
    ],
  },
  {
    date: '2026-04-29',
    title: 'PR-0：拆 ContextMenu.jsx 19KB → 2 檔（純 refactor，PR-A 鋪路）',
    items: [
      '**緣由**：使用者規劃「整合所有操作」epic，PR-A（ContextMenu 操作大改）動到 ContextMenu.jsx 19KB 即將破 20KB 硬上限。先做拆檔讓 PR-A 改動安全。本 PR 是純 refactor，user-visible 無變化。',
      '**拆法**：`src/components/ContextMenu.jsx` 19KB → `src/components/ContextMenu/index.jsx` 13KB（主框架 + state hub + edit fields + actions list）+ `src/components/ContextMenu/subforms.jsx` 8KB（4 個 sub-form：L3 / Connection / Gateway / GatewaySwitch）。原 `ContextMenu.jsx` 改成 shim re-export，外部 import 路徑不變。',
      '**動到的檔案**：`ContextMenu.jsx`（19KB → 213B shim）/ `ContextMenu/index.jsx`（新檔 13KB）/ `ContextMenu/subforms.jsx`（新檔 8KB）/ `CLAUDE.md` §6 拆檔表加 ContextMenu。`build` 通過。',
    ],
  },
];

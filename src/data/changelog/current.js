/**
 * Changelog "current tip" — new entries since last freeze land here.
 * When this file grows beyond ~7KB, freeze: rename to c{next}.js + reset to [].
 * Entries are newest-first within file.
 */
export default [
  {
    date: '2026-04-28',
    title: '規則更新：單檔 ≤15KB / changelog 凍結門檻降到 7KB / 新增 /sync-views skill',
    items: [
      '**承接前三個拆檔 PR（layout / DiagramRenderer / FlowEditor）的硬性規則**：把「單檔大小上限」明文寫進 `CLAUDE.md` §6，避免下次再養出 40KB+ 怪物檔案。',
      '**CLAUDE.md §6 新規則**：軟上限 15KB / 硬上限 20KB。靠近 15KB 主動拆檔；> 20KB 直接擋下任何邏輯改動，先拆檔再說。拆檔走「shim re-export + 子目錄」pattern，importer 一律不動。',
      '**CLAUDE.md §4 changelog 凍結門檻 10KB → 7KB**（使用者觀察「c13 一次衝到 17KB 直接超過 MCP 推送臨界值」），下調留 buffer。',
      '**新增 `/sync-views` skill**（`.claude/skills/sync-views.md`）：跑 `find src -size +15k` size check + grep 確認共用層字串沒散到視圖層 + 七視圖 walk 清單。`/ship-feature` 改成呼叫它。',
      '**CLAUDE.md 自身大瘦身（23KB → 7.2KB）**：原本 23KB 自己違反 15KB 規則。再加一條「CLAUDE.md 軟上限 10KB / 硬上限 12KB」（更嚴於 source 因每 PR 都動且不能 shim）。詳細內容拆到外部檔：`.claude/business-rules.md`（5 條核心規則 + 閘道分類 + 工程慣例 + 協作偏好）、`.claude/orphans.md`（已清理孤兒檔案）、`.claude/backlog.md`（跨 session 待辦）。CLAUDE.md 留 1 行 pointer + 規則摘要表。',
      '**已知 follow-up（規則生效後現存的命中）**：`HelpPanel.jsx` 26KB / `Dashboard.jsx` 26KB / `excelImport.js` 23KB / `ContextMenu.jsx` 19KB / `taskDefs.js` 17KB / `c13.js` 17KB — 列入 backlog 後續批次拆檔。',
      '**Phase 1 拆檔三部曲總結**：layout.js 58→14.6KB / DiagramRenderer.jsx 44→12.9KB / FlowEditor.jsx 43→12.5KB；MCP push 全部成功無 timeout。Phase 2 將抽出 `src/model/` 共用層解決「改一處要追多檔」。',
    ],
  },
  {
    date: '2026-04-28',
    title: '重構：拆解 FlowEditor.jsx（43KB → 8 個 ≤13KB 檔案）',
    items: [
      '**承接前 PR**：layout.js + DiagramRenderer.jsx 拆完後第三大檔換成 `FlowEditor.jsx` 43KB / 939 行，同樣超過 MCP 推送臨界值（15KB）。',
      '**解法**：拆成 7 個專職模組放在 `src/components/FlowEditor/`，每檔 < 15KB。對外 API 不變（`src/components/FlowEditor.jsx` 變成 thin shim re-export `default`）。',
      '**新檔結構**：`validateFlow.js`（儲存前 blocking + warning 兩層檢核）、`TaskCard.jsx`（drawer 內單一任務行 UI）、`useFlowActions.js`（`addTask` / `addTaskAfter` / `insertGatewayAfter` / `addL3ActivityAfter` / `removeTask` / `updateConnectionOverride` / `changeConnectionTarget` / `resetConnectionOverride` / `resetAllOverrides` 等 12 個圖形變更函式打包成 hook）、`Header.jsx`（頂部 bar：返回 / logo / 編號 / 編輯 / 儲存 / 釘選 / 重設端點）、`DrawerContent.jsx`（drawer flow tab + roles tab + DropLine 拖曳指示）、`SaveModals.jsx`（儲存前 warning 跟全部重設端點兩個 modal）、`index.jsx`（orchestrator state + render）。',
      '**未動到**：`App.jsx` 一行未改（仍 `import FlowEditor from \'./components/FlowEditor.jsx\'`，由 shim 透傳）；所有 useState / useMemo / useEffect / useDragReorder hook 順序與依賴 array 完全保留，避免 React 規則破壞。',
      '**驗證**：`npm run build` 通過（107 modules transformed，原本 100）；validateFlow / drag-reorder / context menu 邏輯逐行保留。',
    ],
  },
  {
    date: '2026-04-28',
    title: '重構：拆解 DiagramRenderer.jsx（44KB → 11 個 ≤13KB 檔案）',
    items: [
      '**承接前 PR**：layout.js 拆完後第二大檔換成 `DiagramRenderer.jsx` 44KB。同樣超過 MCP 推送臨界值（15KB），每次改流程圖就 timeout。',
      '**解法**：把 1023 行的單檔 React 元件拆成 11 個專職模組放在 `src/components/DiagramRenderer/`，每檔 < 15KB。對外 API 不變（`src/components/DiagramRenderer.jsx` 變成 thin shim re-export `default`）。',
      '**新檔結構**：`text.jsx`（wrapText / SvgLabel / L4Number / EventLabel）、`shapes.jsx`（5 種任務形狀）、`arrows.jsx`（ArrowMarkers / ConnectionArrow / EndpointHandle）、`legend.jsx`（圖例）、`Toolbar.jsx`（匯出按鈕 + 編輯提示 banner）、`StickyHeader.jsx`（凍結角色欄）、`overlays.jsx`（DropTargetHighlight / OverrideIndicators / DragPreview / HoverTooltip）、`TasksLayer.jsx`（任務 hover/click 圖層）、`useDragEndpoint.js`（端點拖曳 state machine 自訂 hook）、`dragHelpers.js`（screenToSvg / nearestSide / findTaskAtPoint 純函式）、`index.jsx`（orchestrator）。',
      '**未動到**：`FlowEditor.jsx` / `Dashboard.jsx` 兩個 importer 一行未改（仍 `import DiagramRenderer from \'./DiagramRenderer.jsx\'`，由 shim 透傳）。',
      '**驗證**：`npm run build` 通過（100 modules transformed，原本 89）；既有 hover tooltip / drag endpoint / drop-target highlight / override indicator / sticky header / 匯出 PNG/drawio 邏輯逐行保留。',
    ],
  },
  {
    date: '2026-04-28',
    title: '重構：拆解 layout.js（58KB → 11 個 ≤15KB 檔案）',
    items: [
      '**痛點**：使用者：「常常因為檔案大推不上去，很長 timeout 中斷執行」。`src/diagram/layout.js` 58KB 超過 MCP 推送臨界值（15KB），每次改 routing 都得手動貼。',
      '**解法**：把單一 `computeLayout` 函式拆成 11 個專職檔案放在 `src/diagram/layout/`，每檔 < 15KB。對外 API 不變（`src/diagram/layout.js` 變成 thin shim re-export）。',
      '**新檔結構**：`helpers.js`（常數與 halfExtent / minLaneH）、`gatewayRouting.js`（exit-priority 表 + entry-side 推論）、`columnAssign.js`（DAG 拓撲欄位）、`corridor.js`（top-corridor + port-mix 共用 helper）、`phase1and2.js`、`phase3.js`、`phase3bc.js`、`phase3d.js`、`phase3e.js`、`computeLayout.js`（orchestrator）、`routeArrow.js`、`index.js`。',
      '**ctx 共享狀態**：原本 phase 之間透過 closure 共用的 Maps（condRouting / portIn / portOut / topCorridorByRow / taskBackwardRouting / taskForwardRouting / taskCrossLaneRouting）改放在 `ctx` 物件，每個 phase 函式接 `ctx` 並 mutate，行為與 closure 版完全等價。',
      '**驗證**：`/tmp/trace-layout.mjs` 對 6 個 fixture（linear / 3-cond gateway / loop-back / cross-lane / forward-skip / manual override）跑拆前 / 拆後 snapshot，diff 完全一致；`npm run build` 通過。',
      '**未動到**：`DiagramRenderer.jsx` / `drawioExport.js` / `violations.js` 三個 importer 一行未改（仍 import `from \'../diagram/layout.js\'`，由 shim 透傳）。',
    ],
  },
];

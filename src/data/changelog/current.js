/**
 * Changelog "current tip" — new entries since last freeze land here.
 * When this file grows beyond ~10KB, freeze: rename to c{next}.js + reset to [].
 * Entries are newest-first within file.
 */
export default [
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

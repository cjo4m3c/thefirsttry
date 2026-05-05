/**
 * Changelog "current tip" — new entries since last freeze land here.
 * When this file grows beyond ~7KB, freeze: rename to c{next}.js + reset to [].
 * Entries are newest-first within file.
 */
export default [
  {
    date: '2026-05-05',
    title: 'PR-D3：lane / 元件 shape 違規紅框警示（含 FlowTable + PNG / drawio 排除）',
    items: [
      '**緣由**：PR-D2 把 lane↔shape sync 改為對稱、且 load-time 不再強制 cascade — 既有違規（內部泳道的 interaction、外部泳道的 task）需要視覺方式提醒使用者。本 PR 落地紅框 UI（規則 9 + backlog AJ 配套）。',
      '**`model/flowSelectors.js`** 加 `getLaneShapeViolations(tasks, roles)` — 純函式回傳違規 task id Set。內部泳道 + interaction 或外部泳道 + task 命中違規；start / end / gateway / l3activity / role-less task 一律放行。同一份 SOT 餵流程圖跟 FlowTable，避免兩處邏輯各寫各的（吃過 buildTableL4Map vs displayLabels 的虧）。',
      '**`DiagramRenderer/shapes.jsx TaskShape`** 加 `isViolation` prop — 違規時在原本矩形外圍多畫一層 `<rect>` red overlay（紅 `#EF4444`、stroke 2.5、`pointerEvents="none"` 不擋滑鼠、外擴 1.5px 讓邊框可見）。**附 `data-export-skip="1"` 屬性**。`pointerEvents="none"` 確保 hover / click 不被搶掉。',
      '**`DiagramRenderer/TasksLayer.jsx`** 接 `violationIds` prop 透傳到 TaskShape；`DiagramRenderer/index.jsx` 在 render 階段呼叫 `getLaneShapeViolations(flow.tasks, flow.roles)` 算出 set 傳下去。',
      '**`DiagramRenderer/index.jsx`** 加 `pngExportFilter` module-level helper：`node => !(node?.dataset && node.dataset.exportSkip === \'1\')`。傳給 `toPng` 兩個觸發點（auto-export `useEffect` + 手動 `handleExportPng`）的 options。drawio 不需要動 — `drawioExport.js` 自己構造 XML，本來就不會輸出 React-rendered 紅框 overlay。',
      '**`FlowTable.jsx` (backlog AJ)**：對應 row 加 `outline outline-2 -outline-offset-2 outline-red-500` Tailwind classes + `title` tooltip 描述違規原因。同樣呼叫 `getLaneShapeViolations` 計算 violationIds（`useMemo` deps `[tasks, flow.roles]`），跟流程圖紅框完全同步。',
      '**`docs/business-spec.md §3.1`**：標題從「不對稱」改為「對稱」、Sync 規則表格擴成 6 row（含 internal cascade / 載入舊資料保留 / 手動切換）+ 新增「紅框警示」段落明確 PNG / drawio 排除機制 + 對應實作 list 更新。',
      '**`src/data/helpPanelData.js`**：ELEMENTS「外部關係人互動」purpose 條目改成 enforced 雙向強制、明確紅框警示與匯出排除；VALIDATION 對應條目重寫為「泳道角色類型與元件形狀必須對應（雙向強制）」涵蓋 6 個 detail 子點。',
      '**驗證**：`npm run build` 通過；bundle 從 945KB → 947KB（純 helper 函式 + JSX 條件 render，純函式可以 tree-shake friendly）。功能驗證點：(a) 內部泳道任務手動選「外部互動」型 → 元件外圍紅框 + FlowTable row 紅框 (b) 角色從外部翻內部 → cascade 成 task，紅框消失 (c) PNG 匯出 → 紅框不出現 (d) drawio 匯出 → 紅框不出現 (e) 違規元件可正常 hover / click（pointerEvents none 保留交互）。',
      '**動到的檔案（7 個）**：`src/model/flowSelectors.js`（new selector）/ `src/components/DiagramRenderer/{shapes,TasksLayer,index}.jsx`（紅框 overlay + filter）/ `src/components/FlowTable.jsx`（row 紅框）/ `docs/business-spec.md`（§3.1 改寫）/ `src/data/helpPanelData.js`（ELEMENTS + VALIDATION）/ `.claude/backlog.md`（AJ 移除）/ `src/data/changelog/current.js`（本條）。',
      '**接下來**：PR-D4 `[外部角色]` 前綴自動補 + 儲存檢核（規則 5 / 6 / I）/ PR-D5 Excel 智慧角色 type 偵測（規則 7 / 8）。',
    ],
  },
  {
    date: '2026-05-05',
    title: 'PR-D2：外部互動 / 外部角色對稱 cascade（internal lane → task 也強制）',
    items: [
      '**緣由**：PR-D1 完成 `_w → _e` rename 後，使用者進一步明確：外部角色泳道「不能用任務」、內部角色泳道「不能用外部互動」（規則 2 + 4）。原本 `targetShapeFor` 只強制 external→interaction（不對稱），internal lane 允許 interaction（由 validation 3e 跳 warning）— 不符合新規格。本 PR 切到對稱規則：兩邊 lane 都強制對應 shape，cascade 在使用者顯式切換 role.type / roleId 時觸發。',
      '**`utils/elementTypes.js` `targetShapeFor`**：external → `interaction` / **internal → `task`**（新增）/ unspecified → preserve。註解更新為「Symmetric strict rule」。`applyRoleChange` / `syncTasksToRoles` 邏輯不變（純函式），自動套用對稱規則 — strip `l4Number` 讓 `computeDisplayLabels` 重推（`_e` ↔ regular L4）。',
      '**`utils/storage.js` `migrateFlow`**：拿掉 load-time 的 `syncTasksToRoles` 呼叫（連同 import）。原本是給「不對稱時代」的 fixup（避免 external lane 殘留 task），現在改成讓既有違規以「紅框警示」方式 surface（PR-D3 會落地紅框 UI），而非 silent auto-convert。Cascade 仍保留在使用者顯式編輯 role.type / roleId 的觸發點（Wizard / DrawerContent / TaskCard / ContextMenu）。',
      '**`model/validation.js` rule 3e**：對稱化警示文字 — internal lane + interaction 與 external lane + task 雙向偵測，均跳 warning（仍可儲存）。原訊息「建議改放外部角色泳道」改為「畫面上有紅框」（前指 PR-D3）— 文字提示與紅框視覺 reinforce。',
      '**Edge case 行為**：(F) 載入舊 localStorage 資料若有違規 → 不自動修，保持資料原貌等使用者決定（紅框 in PR-D3）(B) external→internal cascade 後 `_e1/_e2/_e3` 重編成正式 L4 順號 → 後續任務編號自然 shift，使用者已確認接受 (C) TaskCard 元件類型 picker 仍允許自由選擇（不擋）— 違規由紅框提醒。',
      '**驗證**：`npm run build` 通過，bundle size 不變。隔離保證 — `applyRoleChange` / `syncTasksToRoles` 都是純函式，存量 callers 不需要改動（觸發點 audit 確認 Wizard / DrawerContent / TaskCard / ContextMenu 走相同 API）。',
      '**動到的檔案（4 個）**：`src/utils/elementTypes.js`（targetShapeFor 對稱）/ `src/utils/storage.js`（migrateFlow drop syncTasksToRoles）/ `src/model/validation.js`（rule 3e 對稱）/ `src/data/changelog/current.js`（本條）。',
      '**接下來**：PR-D3 加紅框違規顯示（含 PNG / drawio export 過濾） + FlowTable 紅框（backlog AJ）/ PR-D4 `[外部角色]` 前綴自動補 + 儲存檢核（規則 5/6/I）/ PR-D5 Excel 智慧角色 type 偵測（規則 7/8）。',
    ],
  },
  {
    date: '2026-05-05',
    title: '外部關係人互動編號後綴 `_w` → `_e` 全 codebase rename + 凍結 c24',
    items: [
      '**緣由**：使用者：「外部互動、外部角色重構」— 2026-04-30 引入時用 `_w`（取自 external 一字「w」rld 的隨意命名），但 `_e` 更直觀對應 external interaction，且跟其他後綴（`_g` gateway / `_s` subprocess）的字母縮寫邏輯一致。趁輔助欄位 PR-A/B/C 落地後 codebase 相對穩定，把 `_w` 全面改名為 `_e`，避免日後越積越多 reference 難改。',
      '**Step 1 — Regex SOT（`utils/taskDefs.js`）**：`L4_NUMBER_PATTERN` / `L4_INTERACTION_PATTERN` 從 `_w\\d*` 改為 `_e\\d*`。註解明確標記「Renamed from `_w` to `_e` in 2026-05-05」+ legacy migration 入口參考。',
      '**Step 2 — Display label SOT（`model/flowSelectors.js`）**：`computeDisplayLabels` interaction branch 全套改 `_e`（counter `intConsec` / regex `/^(\\d+-\\d+-\\d+-\\d+)_e(\\d*)$/` / strip pattern `(_g\\d*|_s\\d*|_e\\d*)$` / output `${base}_e${intConsec}` / post-process run-length-1 → drop index）。`_e1 → _g → _e2` 連續性與 `_w` 時代行為一致。',
      '**Step 3 — Excel I/O（`utils/excelImport.js`）**：parser 嚴格只接受 `_e`（`isInteraction = /_e\\d*$/`）；`validateNumbering` 錯誤訊息與輔助範例改用「外部互動為 1-1-1-1_e」；前綴對應檢查 strip pattern 同步加 `_e\\d*`。**舊 `_w` Excel 檔不再被接受**（會在 `validateNumbering` 階段以「格式錯誤」擋下）— 想匯入舊檔請先用 localStorage 載入觸發 migration、再重新匯出。',
      '**Step 4 — Migration（`utils/storage.js`）**：`migrateInteractionSuffix` 強化為兩段式 — (a) 既有「`shapeType=interaction` 但無後綴」的 pre-2026-04-30 資料 strip 重推 (b) 既有 `_w\\d*$` 後綴的 2026-04-30~2026-05-04 資料同樣 strip 讓 `computeDisplayLabels` 重推為 `_e`。Idempotent — 已是 `_e` 的 task 不動。',
      '**Step 5 — UI / 顯示**：`DiagramRenderer/TasksLayer.jsx` hide regex `(_g\\d*|_s\\d*|_e\\d*|-0|-99)`、`utils/elementTypes.js` 註解與 `applyRoleChange` / `syncTasksToRoles` 的 strip 邏輯註解全更新、`model/validation.js` rule 3e 註解與 displayLabels 範例註解同步改 `_e`。',
      '**Step 6 — 文件三件組同步**：(a) `docs/business-spec.md §2.1 / §2.4 / §2.5 / §3 / §3.1` 編號表 / 連續性 / 字母結尾例外 / 元件表 / 不對稱 sync 章節全改 `_e` — 章節標題「外部關係人互動 — 不對稱 sync + `_e` 編號」 (b) `src/data/helpPanelData.js` NUMBERING / VALIDATION / ELEMENTS 含 `_w` 條目全改 (c) `CLAUDE.md §3` 三後綴 family 共用 anchor 規則範例改用 `_e`。',
      '**Step 7 — 凍結 c24**：current.js 累積到 76KB（PR #153 後沒再 freeze），遠超 7KB 軟上限。`current.js` → `c24.js` rename（內含 PR #153 / #154 / #155 / #156 / #157 / #158），`current.js` reset 成本條，`index.js` 加 c24 import。',
      '**驗證**：`npm run build` 通過，bundle size 不變（rename 不增邏輯）。grep audit 確認 src/ 內 `_w` 只剩 (a) `storage.js` 既有 legacy 偵測 regex (b) `taskDefs.js` 註解描述 rename 歷程 — 流程邏輯本身已完全切到 `_e`。',
      '**動到的檔案（11 個）**：`src/utils/taskDefs.js`（regex）/ `src/utils/storage.js`（migration 強化）/ `src/utils/excelImport.js`（嚴格 `_e`）/ `src/utils/elementTypes.js`（註解）/ `src/model/flowSelectors.js`（display label SOT）/ `src/model/validation.js`（註解）/ `src/components/DiagramRenderer/TasksLayer.jsx`（hide regex）/ `src/data/helpPanelData.js`（user-facing 文字）/ `docs/business-spec.md`（§2.1 / §2.4 / §2.5 / §3 / §3.1）/ `CLAUDE.md §3`（三後綴 family 範例）/ `src/data/changelog/current.js`（freeze + 本條）+ 新檔 `src/data/changelog/c24.js`（freeze 過去條目）/ `src/data/changelog/index.js`（加 c24 import）。',
    ],
  },
];

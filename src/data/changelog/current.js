/**
 * Changelog "current tip" — new entries since last freeze land here.
 * When this file grows beyond ~7KB, freeze: rename to c{next}.js + reset to [].
 * Entries are newest-first within file.
 */
export default [
  {
    date: '2026-05-03',
    title: 'Undo / Redo（50 步 snapshot stack，儲存後清空，Ctrl+Z / Ctrl+Y）',
    items: [
      '**緣由**：使用者：「請評估能不能做 undo 功能？會有什麼影響？」+「允許 undo 一步和 undo 50 步會有差別嗎」+「已儲存的內容 undo 後再儲存 → 改成存過就要有再編輯才能 undo」。背景：刪線 / 刪任務 / 拖端點都是無聲破壞性操作，誤觸無法回復。對應 backlog 條目 AI。',
      '**Step 1 — `src/utils/undoStack.js` 純函式**：50 LOC，提供 `createStack` / `push` / `undo` / `redo` / `canUndo` / `canRedo`。snapshot-based（不是 action-diff），每次 mutation 把當前 liveFlow `structuredClone` 後推入 stack。設計三個關鍵：(a) 50 步 ring buffer 上限 (b) 500ms debounce — 連續打字一陣子後 push 多次只算 1 步（mid-typing collapse；典型「打 Hello 5 個字 → 1 步」）(c) 新 push 自動清 redo stack（forward branch 失效）。',
      '**Step 2 — `FlowEditor/index.jsx` 整合**：(a) 加 `useState(createUndoStack)` (b) wrap `patch()`：`setUndoStack(prev => pushUndo(prev, structuredClone(liveFlow)))` 在 `setLiveFlow` 之前 — 這樣 stack 存的是 BEFORE state、undo 把它復原 (c) 新 `handleUndo` / `handleRedo` 函式 (d) `doSave` 加 `setUndoStack(createUndoStack())` — 使用者規格「存過要再編輯才能 undo」(e) `useEffect` 加 keydown listener：Ctrl+Z / Cmd+Z = undo、Ctrl+Y or Ctrl+Shift+Z = redo；偵測 `INPUT/TEXTAREA/SELECT/contentEditable` focused 時略過（讓瀏覽器原生文字復原接管，不打斷打字）；偵測 `saveModal/resetAllModal` 開啟時略過。',
      '**Step 3 — `FlowEditor/Header.jsx` 按鈕**：在「圖例」後面加「↶ 復原」「↷ 重做」兩個按鈕。`disabled = !canUndo / !canRedo`，灰色 + cursor-not-allowed 表示無可復原；title tooltip 提示快捷鍵；hover 跟其他 header 按鈕一樣 white border + bg-opacity-10。',
      '**Step 4 — 文件 + backlog**：`helpPanelData.js EDITABLE_ACTIONS` 加新條目「↶ 復原 / ↷ 重做」5 子項列點說明（按鈕 + 鍵盤 / 50 步 / 打字 debounce / 儲存清空 / session-only）。`.claude/backlog.md` 把 AI 從「長期待辦」搬到已完成段，順便補上 PR #123-134 缺漏。',
      '**動到的檔案（5 個）**：`src/utils/undoStack.js`（新，50 LOC）/ `src/components/FlowEditor/index.jsx`（+useState + patch wrap + handleUndo/Redo + keydown listener + doSave clear）/ `src/components/FlowEditor/Header.jsx`（+canUndo/Redo props + 兩個按鈕）/ `src/data/helpPanelData.js`（EDITABLE_ACTIONS 新條目）/ `.claude/backlog.md`（AI done + PR roll-up）/ `src/data/changelog/current.js`（本條）。`build` 通過。',
      '**驗證情境**：(a) 編輯一個任務名稱 → Ctrl+Z 復原 ✓ (b) 連續打 5 個字後 Ctrl+Z → 一次退回打字前（debounce 合併）✓ (c) 刪掉一條線 → Ctrl+Z 線回來 ✓ (d) 刪掉一個任務 → Ctrl+Z 任務 + 連線都回來 ✓ (e) 按儲存 → 復原 / 重做按鈕 disable + Ctrl+Z 沒反應（stack 清空）✓ (f) 儲存後再編輯一次 → 復原按鈕 enable，可退回剛 save 完狀態 ✓ (g) 在 input / textarea 內按 Ctrl+Z → 走瀏覽器文字復原（不打斷打字）✓ (h) save modal 開啟時 Ctrl+Z 沒反應 ✓ (i) Header 按鈕跟鍵盤行為一致 ✓',
    ],
  },
  {
    date: '2026-05-03',
    title: 'HelpPanel 列點化 + 補齊驗證規則 + 日期補正 + PNG 匯出隱藏 override 橘點',
    items: [
      '**緣由**：使用者四個訴求合併到本 PR — (a)「規則說明那裡，內容比較多的段落用列點顯示」(b)「changelog 5/3 改的都發成 4/30」(c)「列點列出所有 excel 檢核條件、儲存檢核條件」(d)「下載的 png 會顯示有編輯過的橘色圓點點，可以不要有嗎」。',
      '**Step 1 — `HelpPanel.jsx` 加 `<Content>` 組件**：value 是 string → render `<div>{text}</div>`（既有行為），value 是 array → render `<ul class="list-disc pl-5 space-y-1">`。Wire 到 ELEMENTS.purpose / VALIDATION.detail / EDITABLE_ACTIONS.desc / FORBIDDEN_RULES.desc / EXPORTS.note 五處。資料端決定列點 or 段落。',
      '**Step 2 — `helpPanelData.js` 內容列點化**：把長且帶子項的條目改成陣列：(a) ELEMENTS — 外部關係人互動 / L3 活動 / 排他 / 並行 / 包容閘道 共 5 項 (b) VALIDATION — 開始事件不能被連接 / 多個開始結束 / 閘道 ≥2 條分支 / 外部互動建議 / 合併目標自動偵測 / 連線端點不能 IN+OUT / Excel 編號規則系列 共 9 項 (c) EDITABLE_ACTIONS — 點任務元件 / 刪除連線 共 2 項 (d) FORBIDDEN_RULES — L4 編號規則 1 項。短條目維持單行。',
      '**Step 3 — VALIDATION 補齊**：audit 既有 helpPanelData 跟 `model/validation.js` 程式邏輯，補上 4 條：(a) blocking「連線端點不能同時有進入與出發」(b) warning「多個開始 / 結束事件」(c) warning「閘道未指定泳道角色」(d) warning「迴圈返回必須指定目標」。Import 段把單一「閘道 / 子流程前綴必對應」拆成完整的「L3/L4 編號格式」+「開始/結束編號」+ `_g` / `_s` / `_w` 三個獨立條目 + 共用前綴對應條目。`連線不能跨過任務矩形` 補進 warning。**共 22 條**，分 blocking / warning / import 三層。',
      '**Step 4 — Changelog 日期補正 4/30→5/3**：實際是 2026-05-03 開發但 13 條 entry 都寫成 2026-04-30。`current.js` (5) + `c23.js` (8) 全部 sed 替換 + freeze header comment 也補上。',
      '**Step 5 — PNG 匯出隱藏 override 橘點（`DiagramRenderer/index.jsx`）**：使用者下載 PNG 時不需看到「編輯過」的元素標記。`OverrideIndicators` 包進新的 `<g ref={overrideIndicatorsRef}>` 容器，`doPngExport` 在 `toPng` 前把 `style.display = "none"`，匯出後 `finally` 還原。Dashboard 那邊 PNG 預覽是 `editable=false`，本來就不渲染 OverrideIndicators，不受影響。',
      '**動到的檔案（5 個）**：`src/components/HelpPanel.jsx`（+`<Content>` helper + 5 處呼叫）/ `src/data/helpPanelData.js`（ELEMENTS / VALIDATION / EDITABLE_ACTIONS / FORBIDDEN_RULES 多項列點化 + VALIDATION 補 4 條 + import 細項）/ `src/components/DiagramRenderer/index.jsx`（+overrideIndicatorsRef + 包 `<g>` + doPngExport 隱藏 / 還原）/ `src/data/changelog/current.js`（5 條 4/30→5/3 + 本條）/ `src/data/changelog/c23.js`（8 條 + freeze header 4/30→5/3）。`build` 通過。',
      '**驗證情境**：(a) 規則說明 ELEMENTS 5 個元件 purpose 列點顯示 ✓ (b) VALIDATION 22 條（6 blocking + 9 warning + 7 import）長 detail 列點 ✓ (c) EDITABLE_ACTIONS「刪除連線」7 子項 bullet ✓ (d) ChangelogPanel 13 條 entry 顯示 2026-05-03 ✓ (e) 編輯頁下載 PNG → 圖中無橘色 override 點點，網頁畫面 override 點仍然在 ✓',
    ],
  },
  {
    date: '2026-05-03',
    title: '流程圖 3 個微調：start/end 不再下方顯示說明 / start label 防壓泳道頭 / L4 編號白底降透明度',
    items: [
      '**緣由**：使用者：「(1) 開始事件、結束事件現在下方也會顯示任務重點說明，但是 hover 也會顯示，我希望保留 hover 就好，下方的說明移除 (2) 開始事件的說明文字很容易跟左側角色區塊重疊、導致看不到字 (3) 每個任務上編號，在有跟端點重疊的時候，現行有一個白色底色，但是會有點看不見箭頭，因此我希望可以提高一點透明度」。',
      '**#1 修法（`shapes.jsx StartShape / EndShape`）**：StartShape 不再傳 `desc` 給 `EventLabel`（下方只剩 name）。EndShape 只在 connectionType=breakpoint 且有 breakpointReason 時傳 desc（保留斷點原因 — 結構性 marker，非 description）；其他情況 desc=undefined。Hover tooltip（在 `TasksLayer`）走 `task.description?.trim()` 邏輯不變，所以 hover 仍能看到說明。',
      '**#2 修法（`text.jsx EventLabel`）**：加 `minX` prop（預設 0），用 `estimateTextWidth` 算最寬一行文字的寬度，若 `cx - widestLine/2 < minX` 把 cx 往右推 `minX - leftEdge` 距離。`textAnchor="middle"` 不變，所以視覺上仍是「居中於可見範圍」，只是基準點位移了。`shapes.jsx` 加 `EVENT_LABEL_MIN_X = LANE_HEADER_W + 6` 常數傳給 EventLabel。第一欄 start 事件文字不會再壓進左邊的 sticky 角色泳道區塊。',
      '**#3 修法（`text.jsx L4Number`）**：白底 pill 的 `opacity` 從 0.9 降到 0.6 — 半透明，數字仍清楚（深色字 + 白底反差大），但底下箭頭線段透出來，使用者一眼看得到「這個編號旁邊有線進/出」。',
      '**動到的檔案（3 個）**：`src/components/DiagramRenderer/text.jsx`（EventLabel +minX clamp + L4Number opacity 0.9→0.6）/ `src/components/DiagramRenderer/shapes.jsx`（StartShape 不傳 desc + EndShape desc 改成只傳 breakpointReason + 兩個 shape 都傳 minX 常數）/ `src/data/changelog/current.js`（本條）。`build` 通過。',
      '**驗證情境**：(a) StartShape 圈下方只顯示 task.name，無 description ✓ (b) EndShape 圈下方一般情況只顯示 name；breakpoint 顯示「【斷點：原因】」 ✓ (c) hover start/end 元件，描述仍出現在 tooltip ✓ (d) 第一欄 start 事件名稱不會往左壓進左側 sticky 角色泳道 (e) 任務上方端點有箭頭時，編號白底半透明，箭頭線段可見、編號文字依然清楚 ✓',
    ],
  },
  {
    date: '2026-05-03',
    title: '外部關係人互動 `_w` 編號 + 不對稱 sync + 流程圖隱藏編號（一致業務規則重整）',
    items: [
      '**緣由**：使用者：「我希望調整『外部關係人互動』的編號方式與規則 — 跟現在閘道的編號邏輯一樣用『前一個L4編號＋後綴』的方式，後綴為 `_w`」+「Excel 匯入有 `_w` 但對應角色 internal → 改為跳提醒讓使用者檢查，仍然可以匯入」+「外部互動在流程圖上不顯示編號，但會顯示在表格中」。把 `_w` 加進跟 `_g`/`_s` 同一個後綴 family。',
      '**Step 1 — Regex SOT（`utils/taskDefs.js`）**：(a) 新增 `L4_INTERACTION_PATTERN = /^\\d+-\\d+-\\d+-\\d+_w\\d*$/` (b) `L4_NUMBER_PATTERN` 加入 `_w\\d*` 接受 (c) Excel `validateNumbering` 加 `hasWTag` 偵測 + 前綴必對應既有 L4 任務或 `-0` 規則（與 `_g`/`_s` 一致）。',
      '**Step 2 — `computeDisplayLabels`（`model/flowSelectors.js`）**：加 `intConsec` counter + interaction branch（`isInteraction = shapeType === \'interaction\' && type === \'task\'`）。anchor 取 `lastTaskBase`、編號形如 `${base}_w${intConsec}`、跟 `_g`/`_s` 共用 anchor、互不重置。`usedCounters` 預掃 strip 也加 `_w\\d*`。Post-process 加 `_w` run-length-1 → drop index（單一 `_w`、連續 `_w1`/`_w2`/`_w3`）。',
      '**Step 3 — 流程圖隱藏編號（`DiagramRenderer/TasksLayer.jsx`）**：hide regex 從 `(_g\\d*|_s\\d*|-0|-99)` 加上 `_w\\d*`。流程圖只顯示 L4 任務編號；編輯器 + 表格仍顯示完整含後綴的編號（SOT 是同一個 displayLabels，只在 TasksLayer 隱藏）。',
      '**Step 4 — 載入 migration（`utils/storage.js`）**：新增 `migrateInteractionSuffix` — 任務 `shapeType=interaction` 但 l4Number 沒 `_w` 後綴 → strip l4Number 讓 computeDisplayLabels 重推。Idempotent。',
      '**Step 5 — 復原 validation rule 3e（`model/validation.js`）**：當初 PR #119 拿掉的「shapeType=interaction 在 internal lane → warning」規則，這次依使用者新規格復活（內部允許但要警示檢查）。warning 文字加「（仍可儲存）」明確化。',
      '**Step 6 — 復原 PR-A 對 interaction 的降級邏輯（`useFlowActions/converters.js`）**：原本 `addOtherAfter/Before(\'interaction\')` 在 internal lane 上自動降成 `shapeType=task`，因為使用者新規格允許 interaction，現一律 honor `shapeType=interaction`。internal lane 由 validation 3e 跳 warning 接手。',
      '**Step 7 — 不對稱 sync（`utils/elementTypes.js`）**：抽 `targetShapeFor(currentShape, role)` helper — `external` → 強制 `interaction`（外部角色「不能用任務」）；`internal` → 保留現狀（不強制 task；preserve user choice）。`applyRoleChange` / `syncTasksToRoles` 套用此規則 + shape 改變時順手 strip `l4Number`，讓編號跟新 shape 對齊（`_w` ↔ regular L4）。',
      '**Step 8 — Excel 匯入偵測（`utils/excelImport.js`）**：parser 偵測 row 的 L4 編號 `_w\\d*$` → set `shapeType=interaction`（type 仍為 task）。**不強制翻角色 type**（不 cascade，per spec「跳提醒讓使用者檢查」）。已配合 validation 3e 在儲存時警示 internal lane + interaction 的不一致。',
      '**Step 9 — 文件三件組同步**：(a) `docs/business-spec.md §2.1` 編號表加 `_w` 兩列（單一 / 連續）+ `§2.4` 連續性判定改為「`_g` / `_s` / `_w` 共用規則」+ `§2.5` 字母結尾例外加 `_w` + `§3` 元件表「外部關係人互動」row 重寫 + `§3.1` 全章重寫成「不對稱 sync + `_w` 編號」(b) `helpPanelData NUMBERING` 加「外部關係人互動」row + `ELEMENTS` 同步 + `VALIDATION` 加「外部互動建議放外部角色泳道」warning 條目 (c) `CLAUDE.md §3` 加 `_w` + 三後綴 family 共用 anchor 規則 + 流程圖顯示分層註解。',
      '**動到的檔案（10 個）**：`src/utils/taskDefs.js` / `src/model/flowSelectors.js` / `src/components/DiagramRenderer/TasksLayer.jsx` / `src/utils/storage.js` / `src/model/validation.js` / `src/components/FlowEditor/useFlowActions/converters.js` / `src/utils/elementTypes.js` / `src/utils/excelImport.js` / `src/data/helpPanelData.js` / `docs/business-spec.md` + `CLAUDE.md` + `src/data/changelog/current.js`（本條）。`build` 通過。',
      '**Edge case 處理**：(E1) T1→Int→T2 = `1-1-5-1` / `1-1-5-1_w` / `1-1-5-2`（`_w` 不佔順號）✓ (E2) 連續 N 個 Int = `_w1` / `_w2` / `_w3` ✓ (E3) `_w` / `_g` / `_s` 混合不重置計數器 ✓ (E4) Int 為流程第一元素 → anchor 退到 `-0`：`-0_w` ✓ (E5) 既有 localStorage interaction 編號為 `1-1-5-3` → migration strip → 重推為 `1-1-5-2_w`（**使用者會看到顯示變動**） ✓ (E6) internal→external 切換：cascade 強制 interaction + strip 重編 ✓ (E7) external→internal 切換：保留 shape，由 warning 提醒 ✓ (E8) Excel `_w` row + internal lane → import OK + warning 不擋 ✓',
    ],
  },
  {
    date: '2026-05-03',
    title: '修連線刪除 ✕ 按鈕對長連線飄太遠 — 改用 polyline 真實中點',
    items: [
      '**緣由**：使用者：「跨很多任務或是跨比較多泳道的線，顯示出的delete icon 會離線段很遠，很不直覺，使用者也很難找到。我希望可以在線段的正中間」。PR #130 用 srcPort 與 tgtPort 的幾何中點當 ✕ 位置，對短直線 OK，但跨欄 / 跨列 / 走 top-bottom corridor 的路徑會大幅繞路 — geometric 直線中點落在實際 polyline 之外，使用者要在線旁找一個飄走的 ✕。',
      '**修法**：`DiagramRenderer/index.jsx` 加 `polylineMidpoint(pts)` 純函式 — 算每段 segment 長度、累加、找到 total/2 那一段、線性插值得到真實「半長處」座標。等於 SVG `getTotalLength + getPointAtLength` 的純計算版（不需要 DOM ref）。',
      '**整合**：選中連線時直接呼叫已 export 的 `routeArrow(from, to, exitSide, entrySide, laneBottomY, laneTopCorridorY)` 取得 polyline pts → `polylineMidpoint(pts)` 算出 ✕ 位置。`arrows.jsx ConnectionArrow` 內部也呼叫 routeArrow，這裡再算一次屬重複計算（< 1ms / 連線、僅在「選中時」執行）— 為避免 prop drilling 把 polyline 從 ConnectionArrow 暴露上來，可接受。',
      '**動到的檔案（2 個）**：`src/components/DiagramRenderer/index.jsx`（+`polylineMidpoint` helper 30 行 + 改 `deletePt` 計算路徑 + import `routeArrow`）/ `src/data/changelog/current.js`（本條）。`build` 通過。',
      '**驗證情境**：(a) 同泳道短直線 → ✕ 在線中點 ✓（行為跟以前一樣）(b) 跨 3 欄走 top corridor → ✕ 在 corridor 段中央，不在 src-tgt 連線外 ✓ (c) 跨 4 列走 bottom corridor → 同上 ✓ (d) loop-return 反向邊 → ✕ 在繞路中段 ✓ (e) 不影響 endpoint handle / 拖端點 / 紅 ✕ 點擊邏輯 ✓',
    ],
  },
  {
    date: '2026-05-03',
    title: '流程圖點選線段刪除 + 閘道 <2 分支 warning + undo 列入長期 backlog',
    items: [
      '**緣由**：使用者：「我想要新增一個功能，是使用者可以點選流程圖上的線段後刪除」。既有基礎建設（連線選取 + 端點 handle）已有，補上刪除 action + UI 觸發點即可。',
      '**Action（`useFlowActions.removeConnection(fromTaskId, key)`）**：regular task / l3activity 走 `task.nextTaskIds.filter(id => id !== key)`；gateway 走 `task.conditions.filter(c => c.id !== key)`（**整條 condition 移除**含 label，使用者直覺等於「這個分支不要了」；想換 target 用拖端點，不該按 Delete）。同步清 `task.connectionOverrides[key]`。',
      '**UI 觸發 1（按鈕）**：`DiagramRenderer/index.jsx` 選中連線時，在來源 / 目標 port 中點畫紅色 ✕ 圓形按鈕（r=11、white fill、red stroke），點擊呼叫 `onRemoveConnection` + 清 `selectedConnKey`。SVG `<g>` 含 `<title>` 提供 tooltip「刪除這條連線（或按 Delete 鍵）」。',
      '**UI 觸發 2（鍵盤）**：擴充既有 `Esc` keydown listener 加 `Delete` / `Backspace`。同 effect 內處理（避免額外 listener）。**Bonus 防誤觸**：先檢查 `e.target.tagName` 是 INPUT / TEXTAREA / SELECT / contentEditable，是的話跳過 — 使用者在編輯器打字時按 backspace 不會誤刪選中連線。',
      '**新 validation rule（`model/validation.js` 3c-bis）**：閘道應有至少 2 條分支條件，否則跳 warning「（{排他/並行/包容}閘道）：閘道應有至少 2 條分支，目前只有 N 條」。對齊使用者「為什麼這個菱形怪怪的」直覺。`helpPanelData.js` VALIDATION 同步加對應條目。',
      '**`helpPanelData.js EDITABLE_ACTIONS`**：加新條目「刪除連線（點選後按 Delete 或紅 ✕ 按鈕）」，文中提及三個副作用（start 沒 outgoing 擋儲存 / 終點變孤兒 warning / 閘道 < 2 條 warning）+ 「無 undo，誤刪要手動拖新的」警告。',
      '**Backlog AI 加長期待辦**：使用者：「把 undo 列進長期待辦中」。`.claude/backlog.md` 新「長期待辦（架構級）」段落，列 undo / redo stack 設計方向（純函式 stack、Ctrl+Z/Y、stack 大小、cross-session 持久 vs session-only 三個待確認問題）。',
      '**動到的檔案（6 個）**：`src/components/FlowEditor/useFlowActions.js`（+removeConnection + return list 加 export）/ `src/components/DiagramRenderer/index.jsx`（+onRemoveConnection prop + Delete/Backspace listener + 紅 ✕ SVG 按鈕）/ `src/components/FlowEditor/index.jsx`（DiagramRenderer 加 prop wiring）/ `src/model/validation.js`（gateway-arity warning rule）/ `src/data/helpPanelData.js`（VALIDATION + EDITABLE_ACTIONS）/ `.claude/backlog.md`（AI undo 條目）/ `src/data/changelog/current.js`（本條）。`build` 通過。',
      '**驗證情境**：(a) 點選連線 → 中點紅 ✕ 顯示 → 點 ✕ 線消失 ✓ (b) 點選連線 → 按 Delete 線消失 ✓ (c) 在編輯器 input 打字按 Backspace 刪字符不誤觸刪線 ✓ (d) 閘道刪到剩 1 條分支 → 儲存跳 warning ✓ (e) 刪 start 唯一 outgoing → 儲存跳 blocking ✓ (f) 刪後讓終點變孤兒 → 儲存跳 warning ✓ (g) 連線有 connectionOverride → 刪線後 override 同步清空，無殘留 ✓',
    ],
  },
  {
    date: '2026-05-03',
    title: 'changelog freeze c23 — current.js reset 避免並行 PR 衝突',
    items: [
      '**緣由**：current.js 累積到 ~19KB（PR #122 / #123 / #124 / PR-A #126 / PR-B #127 / PR-C #128 六條合計），遠超 CLAUDE.md §4 訂的 7KB freeze threshold。歷史教訓：PR #119 vs #118 在 current.js 撞 conflict 過、要手動 rebase。先 freeze c23，避免下次兩個 feature 並行 PR 同樣再撞一次。',
      '**動到的檔案（3 個）**：`src/data/changelog/c23.js` 新（六條 entry frozen）/ `src/data/changelog/current.js` reset 成空陣列 + 本條 / `src/data/changelog/index.js` 加 c23 import。`build` 通過。',
    ],
  },
];

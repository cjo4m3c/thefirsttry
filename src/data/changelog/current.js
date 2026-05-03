/**
 * Changelog "current tip" — new entries since last freeze land here.
 * When this file grows beyond ~7KB, freeze: rename to c{next}.js + reset to [].
 * Entries are newest-first within file.
 */
export default [
  {
    date: '2026-04-30',
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
    date: '2026-04-30',
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
    date: '2026-04-30',
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
    date: '2026-04-30',
    title: 'changelog freeze c23 — current.js reset 避免並行 PR 衝突',
    items: [
      '**緣由**：current.js 累積到 ~19KB（PR #122 / #123 / #124 / PR-A #126 / PR-B #127 / PR-C #128 六條合計），遠超 CLAUDE.md §4 訂的 7KB freeze threshold。歷史教訓：PR #119 vs #118 在 current.js 撞 conflict 過、要手動 rebase。先 freeze c23，避免下次兩個 feature 並行 PR 同樣再撞一次。',
      '**動到的檔案（3 個）**：`src/data/changelog/c23.js` 新（六條 entry frozen）/ `src/data/changelog/current.js` reset 成空陣列 + 本條 / `src/data/changelog/index.js` 加 c23 import。`build` 通過。',
    ],
  },
];

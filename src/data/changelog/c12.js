/**
 * Changelog archive chunk c12 (frozen — do not edit).
 * See ChangelogPanel.jsx for the full UI.
 */
export default [
  {
    date: '2026-04-27',
    title: '包容閘道（OR）完整支援 + 並行閘道條件標籤可選填 + 閘道下拉可見性修正',
    items: [
      '**情境**：使用者：「我現在測試可以顯示並行閘道，但並行閘道似乎無法正確編號，所以在新增的時候沒辦法從其他任務連過去；另外，包容閘道現在完全無法使用」+「condition label 都顯示、不強制要寫內容」',
      '**Bug 1 — OR 閘道完全無支援**：`taskDefs.js` `CONNECTION_TYPES` / `applyConnectionType` 都沒有 inclusive；`excelImport.js` `detectGatewayType` 只看「並行分支至 / 條件分支至」，使用者實際 Excel 用的「**可能分支至**」整段不被識別 → 任務變成普通矩形 task 但 `l4Number` 還是 `_g` 後綴，畫面上錯亂',
      '**Bug 2 — 閘道在下拉選單看不到**：`ConnectionSection.jsx:11` `opts.filter(t => t.roleId)` 排除沒設角色的任務。閘道剛建立 `roleId=""` → 從其他任務的「下一步」下拉看不到 → 使用者無法連線',
      '**修正 1（資料層）**：`taskDefs.js` 加 `inclusive-branch` / `inclusive-merge` connection types、CONN_BADGE（OR / ◇⊙）、`applyConnectionType` typeMap/gwMap、`taskOptionLabel`、`normalizeTask` `gatewayType==="or"` 推 connectionType、`computeDisplayLabels` `GATEWAY_CTS` 加 inclusive',
      '**修正 2（Excel I/O）**：`excelImport.js` `parseFlowAnnotations` 加 `inclusiveToNumbers/Labels`（regex 同時吃「包容分支至」和「可能分支至」兩種動詞）、`inclusiveMergeNextNums`、`detectGatewayType`/`detectGatewayFromText` 加 `or` 分支、`buildFlow` gatewayType `or` 走新分支；`excelExport.js` `generateFlowAnnotation` 加 OR fork（包容分支至 X（A）、Y（B））、OR merge（包容合併來自多個分支，序列流向 Z），AND fork 同步支援帶括號 label',
      '**修正 3（UI label 規格）**：使用者：「condition label 都顯示、不強制要寫內容」。`ConnectionSection.jsx` AND 分支加上 label input（之前隱藏）；新增 inclusive-branch / inclusive-merge 兩個區塊（複製 XOR 結構，icon ◇⊙、色 amber）',
      '**修正 4（下拉可見性）**：`ConnectionSection.jsx:11` filter 對 gateway 例外 `(t.type === "gateway" || t.roleId)`；`FlowEditor.validateFlow` 補一條 warning「閘道未指定泳道角色」',
      '**修正 5（驗證規則）**：`validateFlow` 加 inclusive-merge < 2 incoming、inclusive-branch < 2 conditions 兩條 warning（對稱現有 parallel/conditional-merge 規則）',
      '**GatewayShape 已支援**：`DiagramRenderer.jsx:219-222` 早就為非 xor/and 的 gatewayType 畫 ○ 圓圈，所以資料層修完後 OR 閘道自動以 ◇⊙ 形渲染',
      '**Help/規則文件**：`HelpPanel.jsx` AND/OR 區塊更新顏色、Excel 標記、condition label 行為說明；驗證規則表「條件分支標籤必填」改成「可選填」',
      '驗證 5 trace 情境：① applyConnectionType OR fork/merge 結構 ② normalizeTask 舊 OR 資料推 connectionType ③ generateFlowAnnotation 三類 fork 帶 label ④ OR Excel 文字 import regex（「可能分支至」+ 括號 label）⑤ AND/OR/XOR 編號 _g/_g2 連續',
      '**未動範圍（Phase 3 獨立 PR）**：layout.js 同欄垂直對齊（並行/包容多 next 同 column 堆疊）、閘道 condition obstacle 避障（1-1-7 case）',
    ],
  },
  {
    date: '2026-04-27',
    title: '拖曳重排任務時自動重新編號',
    items: [
      '**情境**：使用者：「我發現新增任務之後，當任務移動改變順序時，編號沒有同步調整」',
      '**Root cause**：`computeDisplayLabels` 對有 stored `task.l4Number` 的任務直接使用儲存值（為了保留 Excel 匯入的原始編號），不依當前陣列順序重排。匯入過 + 新增的混合情境拖曳後，stored 編號保持不動 → 顯示順序與編號順序對不上（如：拖 NEW 到 B 之前後仍顯示 `A=-0, NEW=-4, B=-1, C=-2, D=-3`）',
      '**修正**：`FlowEditor.jsx` 的 `useDragReorder` callback 在套用 `applySequentialDefaults` 之前，先把每個 task 的 `l4Number` 屬性 strip 掉，讓 `computeDisplayLabels` 全部走動態 auto-generation 路徑',
      '**Trade-off**：拖曳一次後，所有匯入時保留的「跳號編號」（如 1, 3, 7）會被磨平成連續編號（1, 2, 3）。換取「拖曳就是順序意圖，編號跟著走」的一致直覺。若要保留特定編號，使用者可在 Wizard 手動填回',
      '**未動範圍**：純新增、Excel 匯入後未拖曳、`addTask`、`removeTask` 行為不變；只在使用者主動拖曳時觸發清除',
      '驗證 5 trace 情境：① 純新增拖曳 ② 匯入 + 新增 + 拖曳（主 bug 場景）③ 閘道 `_g` 跟隨前置 task 重編 ④ 多閘道 `_g`/`_g2` 連續 ⑤ 開始/結束事件 `-0`/`-99` 不受影響',
    ],
  },
  {
    date: '2026-04-25',
    title: '凍結流程圖角色 header 欄位（橫向 scroll 時保持可見）',
    items: [
      '**情境**：使用者：「凍結流程圖角色欄位，這樣左右滑動的時候就可以一直知道這個泳道是誰的」',
      '**作法**：DiagramRenderer 把每個 lane 的「左側 header bg + 角色名字」+ 垂直分隔線（x=LANE_HEADER_W）抽到一個 `<g ref={stickyHeadersRef}>`，渲染在 SVG 最後（疊在連線、任務之上）；scroll 容器加 `onScroll` listener，直接寫 `transform=translate(scrollLeft, 0)` 到那個 `<g>` 上 — 不走 React state 避免每次 scroll 都 re-render',
      '**Lane body 維持原狀**：lane 背景 rect（x=LANE_HEADER_W, width=svgWidth-LANE_HEADER_W）跟底部 lane 分隔線都還在原本的 roles map 裡，跟著內容滾動',
      '**PNG 匯出**：`handleExport` / `autoExportPng` 在呼叫 `toPng` 之前先 `resetStickyForExport()` — 把 sticky `<g>` transform 歸 0、scroll container 歸 0，避免 PNG 截到 sticky 偏移後的 header（看起來會在錯位）',
      '**.drawio 匯出**：`drawioExport.js` 用 `computeLayout` 直出元件座標，沒經過 SVG sticky transform，匯出檔案不受影響',
      '視覺優先序：sticky header（最上）> 拖曳 handle / drop-target highlight > 連線 / 任務 > lane body 底色',
    ],
  },
  {
    date: '2026-04-24',
    title: '拖曳連線：違規檢核 + 自動清除 + 視覺指示 + 重設工具（PR H + PR I）',
    items: [
      '**情境**：PR G+J 讓使用者可以拖曳端點 / 換目標，但沒有規則檢核、沒有視覺指示、沒有還原工具 → 拖錯了沒人提醒、事後也不知道哪些連線被動過',
      '**新檔 `src/diagram/violations.js`**：`detectOverrideViolations(flow)` 回傳 `{ blocking, warnings, violatingConnIdx }`。Blocking = 同 port 同時有 IN+OUT；Warning = 路由線段跨過其他任務矩形。IN+IN 或 OUT+OUT 同 port 不算違反（符合規則 1 原定義）',
      '**FlowEditor `validateFlow` 擴充**：儲存前把 override 違規併進現有 blocking / warnings，接現有兩層檢核 UI — IN+OUT 混用會擋儲存（紅 modal）、穿越任務會跳黃 modal 由使用者決定',
      '**DiagramRenderer 即時紅高亮**：每次 render 呼叫 detector，違規連線 stroke 改紅（`#EF4444` Tailwind red-500）+ 紅色箭頭 marker，讓使用者拖完當下就看到問題',
      '**PR I — override 視覺指示**：被手動拖過的端點顯示 🟡 琥珀色小圓點（固定顯示，不用選取連線），來源端／目標端各自獨立標記。視覺優先序：violation 紅線 > selected 藍粗線 > hover > override 小圓點（固定）',
      '**PR I — 個別重設**：選中帶 override 的連線時，提示列多出「重設此連線端點」按鈕；清除該連線的 `connectionOverrides[overrideKey]`，兩側同時還原成 auto routing',
      '**PR I — 全域重設**：FlowEditor 頁首多一顆「重設所有手動端點」按鈕（僅當此 flow 有 override 時顯示），按下跳確認 modal → 確認後清空所有 task 的 `connectionOverrides`',
      '**自動清除 override（必清情境）**：① `removeTask` 一併刪掉其他 task 指向被刪任務的 override 鍵；② `applyConnectionType` 改連線類型時清空該 task 的所有 override（key 語意從 targetId 翻成 condId）；③ `storage.loadFlows` 載入時 `cleanStaleOverrides` sanity check — 移除指向已不存在任務 / condId 的 key',
      '**路徑交叉判定**：路由線段都是軸對齊（`routeArrow` 輸出 L-path），水平段檢查 y 跟 rect 的 y 範圍 + x 跨越 rect 寬度、垂直段反之。Rect 兩邊 inset 2 px 避免「剛好擦到邊」的誤判',
      '驗證 4 違規情境 pass：無 override 無違規、IN+OUT 混用被抓到、線穿過 B 被抓到、兩條 IN 共用同 port 不誤判',
      '**保留情境**（不清除 override）：改目標任務（`changeConnectionTarget` 已在 PR J 遷移 key）、改角色 / 順序 / 名稱 / 任務內容 — override 仍跟著同一 task / condId / targetId 走',
    ],
  },
  {
    date: '2026-04-24',
    title: '拖曳連線：覆寫端點 + 換目標任務（PR G + PR J）',
    items: [
      '**情境**：使用者：「使用者可以在流程圖上直接拖曳連線的起點/終點到任務元件的其他 port，覆寫自動路由」+「如果是把連線換目標」',
      '**資料模型**：task 新增 `connectionOverrides`；key 為 target task id（一般連線）或 condition.id（閘道條件），value 為 `{ exitSide?, entrySide? }`，兩側可獨立覆寫',
      '**layout.js Phase 3e**：所有 auto-phase（1 / 2 / 3 / 3b / 3c / 3d）完成後套用 override，把結果寫回 `condRouting` / `taskCrossLaneRouting`；slot allocation（sections 5 / 6b）也同步擴充為讀取 `taskCrossLaneRouting`，讓 override 改成 top→top / bottom→bottom 時進入 corridor slot 分配',
      '**連線物件新增 `overrideKey`**：一般連線 = toId、閘道條件 = cond.id，供 DiagramRenderer 拖曳結束後寫回正確 slot',
      '**DiagramRenderer 拖曳 UX**：點選連線 → 端點顯示藍色 handle → Pointer Events 拖曳;放開時 hit-test：①拖到原任務的其他 port → 覆寫端點（PR G）、②拖到別的任務（target handle 限定）→ 換目標任務（PR J）；綠色虛線框提示候選 drop target，藍色虛線預覽路徑；Esc 取消、點 SVG 空白清除選取',
      '**FlowEditor wire up**：`updateConnectionOverride(taskId, key, partial)` 處理端點覆寫；`changeConnectionTarget(fromTaskId, oldKey, newTargetId, snapSide)` 改 `task.nextTaskIds` / `task.conditions[i].nextTaskId`，並遷移 override key（一般任務）或更新 entrySide（閘道用 condId 不變），自動拒絕自連與 start event 當 target',
      '**Downstream sync 確認**：FlowTable、Excel 匯出（`generateFlowAnnotation`）、drawio 匯出全部從 `nextTaskIds` / `conditions[].nextTaskId` 衍生 → 拖曳改連線後「序列流向 X」、「條件分支至 Y」等敘述自動跟著變，不用另寫同步',
      '**Fix（順帶）**：使用者：「新增任務的編號一直保持「5-1-1-1」，會變成有兩個 5-1-1-1 任務」。`computeDisplayLabels` 原本 auto-generate 時 `taskCounter=1` 起跳，沒避開已匯入 `l4Number` 佔的號碼。修正：pre-scan 收集 used counters → auto-generate 時 `while (usedCounters.has(taskCounter)) taskCounter++` 跳過。驗證 5 情境（新在後 / 新在前 / 有 gap 補最低空位 / 純 auto / 閘道 _g 混合）',
      '**CLAUDE.md 新規則**：§4 加「一 PR 一條 changelog」—— 同 PR 內 feature + bug fix + UI 調整合併同筆，用 `**主題**：...` 分段',
      '此 PR 範圍：拖曳互動 + 換目標 + 上述 fix；violation 檢核（IN+OUT 混用 blocking、線穿過任務 warning）、自動清除 override、重設按鈕、override 小圖示等留給 PR H / PR I',
    ],
  },
  {
    date: '2026-04-24',
    title: 'Phase 3d 跨邊連線重疊偵測（保守擴充規則 2）',
    items: [
      '**情境**：使用者：「1-1-7-5 出發要連到 1-1-7-9 的連線，會跟從 1-1-7-8 相關的兩條連線重疊」',
      '**原因**：Phase 3d 的 `defaultBad` 原本只檢查「任務矩形」擋住 default midX 路徑，沒檢查「另一條 Phase 3d 連線的垂直段」會不會與我的 default 橫向段交叉',
      '**保守擴充**：pre-collect 所有 Phase 3d-eligible 邊 → 新增 `defaultPathCrossesOtherEdge` 檢查：若其他邊的 midX col 落在我的 [fc, tc] 範圍內，且其 row 範圍覆蓋我的 fr 或 tr（或反之），視為交叉；觸發 Option A / B',
      '**規則 2 擴充**：CLAUDE.md 規則 10.1 的規則 2 加上「也不應與其他連線的垂直/橫向段交叉」；10.2 技術慣例加實作說明',
      '驗證 1-1-7：`1-1-7-5 → 1-1-7-9`、`1-1-7-8 → 1-1-7-99`、`1-1-7-9 → 1-1-7-99` 三條各自用 Option A（垂直段在 tc），不再共用 midX；5-3-3 / 5-2-6 / 5-7-2 無 regression',
      '不動「先發生優先」原則（保守方案，低風險）；未來若需要 backtracking 可再擴充',
    ],
  },
];

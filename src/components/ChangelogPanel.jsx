import { useState } from 'react';

/**
 * ChangelogPanel — 版本更新紀錄
 *
 * MAINTENANCE GUIDE:
 * 每次功能更新後，在 CHANGELOG 陣列最前面新增一筆記錄（newest first）。
 * 格式：{ date: 'YYYY-MM-DD', title: '簡短標題', items: ['...', '...'] }
 */

const CHANGELOG = [
  {
    date: '2026-04-22',
    title: 'Hover 高亮：方向色分流 + 連線反向高亮端點',
    items: [
      '**連線方向感知配色**：hover 元件時，**Outgoing（此元件指出去）**用 primary 深藍 `#2A5598`；**Incoming（指進此元件）**用 light 淡藍 `#7AB5DD`；方向一眼看清',
      '**反向：hover 連線也會高亮端點任務** — 滑鼠移到線段上，整條線變主藍 `#2563EB` 加粗，兩端的 task / gateway / event 也同步亮起藍邊框 + 淡藍底',
      '連線 hit area 擴大：額外加一條 transparent 10px 寬的 stroke 包住實線，讓滑鼠不用完全壓在細線上也能 hover 到',
      '新增 `ah-hover-out` / `ah-hover-in` 兩個 SVG marker，箭頭尖端跟線段同色',
      '`ui-rules.md` 新增「連線 hover 色」段落，兩色納入標準色票',
    ],
  },
  {
    date: '2026-04-22',
    title: 'Hover 時同步高亮相關連線',
    items: [
      '滑過任何元件（task / gateway / start / end / L3 活動）時，除了元件本身變藍，**指向它的 incoming 連線**與**它指出去的 outgoing 連線**也一起改為藍色加粗',
      '實作：`ConnectionArrow` 接收 `hoveredId` prop，連線兩端有一端為 hovered 元件即觸發高亮（stroke 改 `#2563EB`、寬度 1.4 → 2.5、箭頭 marker 改同色）',
      '新增 `ah-hover` SVG marker 讓箭頭尖端也跟著變色',
    ],
  },
  {
    date: '2026-04-22',
    title: '文件同步 + 新增 3 個 AI skill',
    items: [
      '`HelpPanel` 規則對齊最新 routing：ROUTING 表格合併出入口欄、補「Corridor slot 系統」小節說明 top / bottom 通道規則',
      '`HANDOVER.md` 更新：`layout.js` 行數 ~500 → ~800；風險章節補 Phase 3b / 3c / corridor slot 相關說明；Backlog 更新',
      '`README.md` 補 `layout.js` corridor slot 說明',
      '新增 `.claude/skills/sync-main.md`：使用者合併 PR 後本地同步的通用流程',
      '新增 `.claude/skills/doc-audit.md`：四份文件對齊性檢查清單',
      '新增 `.claude/skills/trace-layout.md`：跑 node trace 腳本驗證 `computeLayout` 輸出的樣板',
      '新增 `.claude/skills/ui-rules.md`：藍色主題色票、按鈕 / banner / modal / 頁首 / 表單 pattern，UI 異動前必讀',
    ],
  },
  {
    date: '2026-04-22',
    title: '上方 corridor slot 化 + forward 長跳欄避開中間元件',
    items: [
      '**Phase 3c**：task → task 的 forward 連線若同列 `dc>1`（跳欄），改走 **top corridor**，避免直線穿過中間 task',
      '**Top corridor slot 系統**：模仿現有 bottom corridor 的 slot，任何 `top → top` 連線（閘道 top-skip / 任務 backward / 任務 forward-skip）都進 `topConnsByRow`，每條自動分配不同 y-level',
      'Row 0 上方預留空間：`laneTopY[0]` 根據該列 top corridor 數量動態加高（原本只有 54px 到任務，現在會按需擴張），讓箭頭不會壓到標題列',
      '處理使用者提報的兩個情境：(1) `5-1-2-7/8/9 → end` 多條連線現在各自一條水平線堆疊；(2) `5-1-2-11 → end` 跳過 `5-1-2-12` 不再被擋住',
      'Phase 3 / 3b 取消 top corridor 衝突檢查（改由 slot 系統處理），邏輯簡化',
      '`routeArrow` 新增 `laneTopCorridorY` 參數，跟 `laneBottomY` 對稱',
    ],
  },
  {
    date: '2026-04-22',
    title: '規則說明同步 + 更新紀錄日期校正',
    items: [
      '`HelpPanel` 規則說明依最新規則改寫：新增「編號規則」章節（開始 `-0` / 結束 `-99` / 閘道 `_g` / 任務流水號）',
      'ELEMENTS 更新：`L3 活動（子流程調用）` 明確說明用於 `調用子流程 X-Y-Z`，圖上顯示 `[子流程] + L3 編號`',
      'CONNECTIONS 更新：「迴圈返回」改為單一目標（不是閘道）、「子流程調用」改為繪成 L3 活動元件',
      'VALIDATION 新增 4 條新規則（迴圈目標必填、閘道 `_g` 尾碼、閘道前綴對應 L4 任務）',
      'ROUTING 更新：描述 smart routing 多階段（Phase 1 sibling 分配、Phase 3 corridor 衝突讓步、incoming 端點避開）',
      '修正更新紀錄日期錯誤：本 session（4/22）所有條目原本標注為 4/21，批次改成 4/22',
    ],
  },
  {
    date: '2026-04-22',
    title: '子流程用 L3 活動元件 + 修正 same-row 平行 corridor 直線 bug',
    items: [
      '**子流程調用**：解析 Excel「調用子流程 5-3-2」取出 L3 編號，任務 `type` 設為 `l3activity`，繪成雙邊書擋矩形，上面顯示 `[子流程] 5-3-2`',
      'Wizard UI 的「子流程名稱」欄改為「子流程 L3 編號」（範例 `5-3-2`）',
      '**修正 routeArrow 直線 bug**：同列的 bottom→bottom（或同欄 top→top 等）連線原本會因為 `sy === ty` 被「degenerate-alignment shortcut」誤判為直線，穿過中間所有元件',
      '新行為：先檢查 exitSide === entrySide（parallel corridor）**再**處理 degenerate alignment，所以平行 corridor 一定走正確的 3-段繞行路徑',
      'Draw.io 匯出版本本來就正確（用 draw.io 自己的 orthogonalEdgeStyle），只有網頁 SVG 受影響',
    ],
  },
  {
    date: '2026-04-22',
    title: '閘道出口避開自身 incoming 端點',
    items: [
      '新增 incoming-port 感知：閘道選 outgoing 出口時，自動避開這個閘道**自身已被 incoming 佔用**的端點',
      '使用者情境：`5-3-1-3 → 5-3-1-3_g1` forward 進 g1 的 left；原本 g1 的「未核准」loop-back 也挑 left 出口，兩條線在 g1 的 left port 重疊',
      '修正後：未核准換成 bottom 出口 + right 入口（繞下方 corridor 指回 5-3-1-2 的右側），跟 incoming 完全分開',
      '計算來源：gateway→gateway 用 condRouting 決定的 entry；regular task→gateway 預設 `left`',
    ],
  },
  {
    date: '2026-04-22',
    title: 'L4 編號規則一致化：編輯工具 / 流程圖顯示同步',
    items: [
      '**使用者規則**：開始事件 `-0`、結束事件 `-99`、閘道 `${前置任務}_g`（連續多個 `_g2`、`_g3`…）、中間任務從 1 開始只對**一般任務**順編（閘道不佔號）',
      '修正前：Wizard / FlowEditor 的 `computeDisplayLabels` 是純 counter，把 start / end / gateway 都算進順編（顯示 1、2、3…），跟流程圖上的編號不一致',
      '修正後：`computeDisplayLabels` 按規則補尾碼，**僅一般任務遞增 counter**；stored `task.l4Number` 優先，legacy 閘道無 `_g` 也會在顯示時補上',
      '`layout.l4Numbers` 改直接呼叫 `computeDisplayLabels`，編輯工具下拉選單跟流程圖 100% 顯示一致的編號',
    ],
  },
  {
    date: '2026-04-22',
    title: '開始 / 結束事件 label 長文字自動換行',
    items: [
      '原本 `EventLabel` 把 name 與 description 各畫成一個 `<text>`，長字串會溢出泳道欄位邊界',
      '改用 `wrapText` 換行：name 每行 14 字、description 每行 18 字，多行堆疊',
      '名稱與說明之間加 3px gap，避免擠在一起',
    ],
  },
  {
    date: '2026-04-22',
    title: '迴圈返回 UI 對齊新規則：單一目標欄位',
    items: [
      'Wizard / FlowEditor 的「迴圈返回」連線類型原本用「若未通過 / 若通過」兩個條件欄位（舊的閘道式模型）',
      '改為**單一「迴圈返回至」目標欄位**，對齊 Excel 語法 `迴圈返回至 X`',
      'Task type 從 `gateway` 改回 `task`（不再是菱形閘道，保持矩形）',
      '資料模型：`conditions: []` + `nextTaskIds: [backTarget]`（單一 back-edge）',
      '舊資料自動遷移：載入時 `normalizeTask` 會把 legacy `gateway + 2 conditions` 轉成 `task + nextTaskIds`',
      'Excel 匯出：`generateFlowAnnotation` 輸出 `迴圈返回至 X` 取代舊的「條件判斷：若未通過則返回…若通過則序列流向…」',
      'Wizard 驗證：只檢查 `nextTaskIds[0]` 存在（不再要求兩個分支）',
    ],
  },
  {
    date: '2026-04-22',
    title: 'Phase 3b：task backward 也避開 top corridor 衝突',
    items: [
      '原本 Phase 3 corridor 衝突偵測只管閘道（gateway→X），不看 task→task 的 backward 連線',
      '使用者 case：`5-4-11-4 → 5-4-11-2` 的迴圈返回跟 `5-4-11-2_g → 5-4-11-5` 的「正常」top-skip 兩條都走上方 corridor，重疊',
      '新增 **Phase 3b**：task 的 backward edge 先檢查 top corridor 是否已被閘道佔用；衝突時改走 bottom→bottom 通道（slot 系統自動處理不疊）',
      'Bottom 通道用現有的 lane-bottom slot allocation，lane 高度自動擴張',
      '保持不變：無衝突時簡單 loop-back 仍走 top（在 title bar 與任務間的空隙清楚可見）',
    ],
  },
  {
    date: '2026-04-22',
    title: 'README 聚焦：本地建置流程 + 專案架構',
    items: [
      '重寫 `README.md`：只保留「本地建置流程（環境需求、套件、安裝步驟）」與「專案架構說明」兩大區塊',
      '移除 live demo link、功能特色、編號規則摘要等——這些改由 `HANDOVER.md` 與 `CLAUDE.md` 承擔',
      '套件表分 runtime 與 dev 兩欄列出，標示每個套件的用途',
      '專案結構樹加入每個檔案的一行說明 + 標示關鍵檔案',
    ],
  },
  {
    date: '2026-04-22',
    title: '文件：新增 README.md + HANDOVER.md',
    items: [
      'Repo 根目錄新增 `README.md`：專案簡介、快速開始、部署、編號規則摘要',
      '新增 `HANDOVER.md`：環境盤點、程式碼結構、交接情境（AI / 純人工 / 轉 hosting / 轉後端）+ checklist',
      '讓新接手人 clone 後第一眼就能看到完整脈絡，不用翻對話歷史',
    ],
  },
  {
    date: '2026-04-22',
    title: '閘道編號強制 `_g`：舊資料自動遷移 + 匯入鏈警告',
    items: [
      '**storage 載入遷移**：舊 localStorage 若有 `type=gateway` 但 L4 編號缺 `_g`（例：`1-1-1-3`），載入時自動改成 `${前置任務編號}_g`（連續多個依序 `_g2`、`_g3`…）',
      '**layout 顯示保底**：即使 stored 缺 `_g`（Wizard 建的閘道或遷移漏掉的角落），diagram 顯示時強制補 `_g`',
      '**閘道鏈完整性警告**：Excel 匯入後，若 `X_g` 找不到前置任務 X 或 X 沒連向 `X_g`，首頁跳出黃色警告橫條（不擋匯入）',
      '`X_g{n}`（n≥2）的前置為 `X_g{n-1}`，同樣會檢查',
      '`parseExcelToFlow` 回傳格式改為 `{ flows, warnings }`',
    ],
  },
  {
    date: '2026-04-22',
    title: '合併點不再視為閘道：只有 fork 關鍵字要 `_g`',
    items: [
      '修正 validator 誤把「條件合併來自多個分支」「並行合併來自」的任務當閘道而要求 `_g` 尾碼',
      '這兩個標記的語意是：**該任務自身是 merge target**（收到 ≥2 條分支匯入），forward 目標由同句的 `序列流向 Z` 自動解析',
      '**閘道判定範圍精簡為 2 個 fork 關鍵字**：`條件分支至`、`並行分支至`（其他都是一般任務）',
      'Parser `detectGatewayType` 同步調整：只有 fork 類觸發 gateway 分類；merge 任務保持矩形',
      'CLAUDE.md 規則 3 完整整理「哪些是閘道、哪些不是」，列出 5 種情境',
    ],
  },
  {
    date: '2026-04-22',
    title: '流程圖 Phase 3：跨閘道 corridor 衝突偵測 + 首頁清理',
    items: [
      '**新增 Phase 3 corridor 衝突偵測**：當兩個不同閘道的條件都想走同一條上方通道且欄位範圍重疊時，後處理的那條自動切到下一順位出口（例如原本走 top corridor → 切到 bottom corridor）',
      '處理順序：Manhattan 距離短的先處理（保留自然路徑），長距離 / loop-back 類型的連線讓步',
      '套用範圍：上方通道（top corridor）；下方通道已有 slot 系統不會重疊所以不需要',
      '移除首頁底部「系統層級架構」提示區塊',
    ],
  },
  {
    date: '2026-04-22',
    title: '流程圖修正：閘道顯示 _g 編號 + 迴圈返回連線可見',
    items: [
      '**閘道現在會顯示 L4 編號（含 `_g` 尾碼）**：原本 `layout.l4Numbers` 只對 task 指派，閘道被跳過；改為優先用 `task.l4Number`，手動建立的 task 才 fallback 到 counter',
      '**一般任務的 backward 連線（迴圈返回）改走上方 corridor**：原本走 title-bar 上方 y=32 會被藍色 title 蓋住視覺隱形；現在改 top→top 走 title bar 與任務之間的空隙，清楚可見',
      '`迴圈返回至` regex 放寬：接受「至」「：」「:」或直接空格，容忍全/半形空格',
      '舊行為：start/end 事件原本不顯示 L4 編號，現在也會顯示（stored value）',
    ],
  },
  {
    date: '2026-04-22',
    title: '迴圈返回：不再視為閘道，只是帶 back-edge 的一般任務',
    items: [
      '重新定義「迴圈返回」語意：**不是獨立閘道元件**，而是一般任務 + 往前任務的連線',
      '新增簡化語法 **`迴圈返回至 5-5-5-4`**，代表此任務指向 5-5-5-4（單一 back-edge）',
      '舊語法 `迴圈返回：若未通過則返回 X，若通過則序列流向 Y` 向後相容，解析後任務的 `nextTaskIds` 會同時包含 Y 與 X',
      'Validator 不再要求迴圈返回的 L4 加 `_g` 後綴（原本會誤判成 XOR 閘道）',
      '流程圖渲染：迴圈返回的任務保持矩形（不再變成菱形），back-edge 由 smart routing 的 top/bottom 通道處理，不會跟其他連線撞 port',
    ],
  },
  {
    date: '2026-04-22',
    title: '流程圖連線：端點進入點對齊通道方向',
    items: [
      '閘道用 top/bottom 通道到同列目標時，進入點改為 target 的 top / bottom **正中央**（原本一律進 left）',
      '修正兩類視覺問題：(1) fork 同列有 3 個條件時，3 條線都擠在 target 的左側；(2) loop-back 繞回起點任務時，進入點跟起點任務的 outgoing port 撞在一起',
      '規則：vertical exit (top/bottom) + 同列目標 → entry 跟 exit 同側（通道對齊）',
      '其他方向（異列、同列 horizontal exit）保持原 smart routing 邏輯不變',
    ],
  },
  {
    date: '2026-04-22',
    title: '流程圖連線：複雜情境智慧端點分配',
    items: [
      '閘道有多個 outgoing 條件時，依每個條件目標的相對位置自動挑選不同出口端點（top / right / bottom / left），避免同側多條線重疊',
      '規則：forward-adjacent 優先 right、forward-skip 優先 top（上方通道）、down-right 優先 bottom、backward/loop-back 優先 top（上方繞回）',
      '當閘道被多條 incoming 打到時，也依來源方向在 4 個入口端點間重新分配（Phase 2）',
      '`routeArrow` 擴充支援完整 16 種 (exit, entry) 組合：corridor（平行）、1-bend（垂直↔水平）、L-path（多層泳道）',
      '簡單案例（單一 fork、線性 task）行為保持不變，只在複雜閘道場景產生新的路由決策',
    ],
  },
  {
    date: '2026-04-22',
    title: '全站視覺改版：藍色主題',
    items: [
      '套用統一藍色設計系統，取代原本的墨綠標題列 + 雜色按鈕',
      '色票：主色 `#2A5598`、中藍 `#3470B5`、淡藍 `#7AB5DD`、極淡藍底 `#E8F1F9`、頁面背景 `#F5F8FC`',
      '所有頁首（Dashboard / FlowEditor / Wizard）改為主色藍底',
      '「規則說明」「更新紀錄」按鈕改為中藍實心底，hover 轉淡藍——不再需要 hover 才能找到',
      '主要按鈕（新增 L3 活動、儲存、儲存並完成、批量下載）改用主色藍',
      '次要按鈕（上傳 Excel、下載 Excel、下一步、匯出 PNG）改用中藍',
      '活動卡片內 PNG / drawio / Excel 三色按鈕改為 sky / blue / cyan 三層藍區分',
      '泳道圖內部色（內外角色頭、標題列）同步調整：內部 `#2A5598`、外部 `#5B8AC9`、淡藍泳道 `#F0F6FB`',
      '捲軸顏色改為藍色系（`#7AB5DD` → `#3470B5`）',
      '狀態色保留：刪除紅、星星黃、未儲存橘、PNG 進度黃',
    ],
  },
  {
    date: '2026-04-22',
    title: '程式碼清理 + UX 小修',
    items: [
      '移除未使用的 `js-yaml`、`jszip` 兩個 runtime 依賴，縮小安裝體積',
      'Wizard L3 編號檢核改用 `taskDefs.js` 的 `L3_NUMBER_PATTERN`（嚴格 `1-1-1` 三段橫線分隔），移除原本的寬鬆 inline regex，同時順手修掉「`1-1` 兩段也能通過檢核」的隱性 bug',
      'PNG / Draw.io 匯出失敗時改以 alert 告知使用者，取代原本只有 `console.error` 的無感失敗',
      'CLAUDE.md 規則 9 同步更新：標記 `js-yaml`、`jszip` 已移除',
    ],
  },
  {
    date: '2026-04-22',
    title: '編號規則強化 + 置頂 + 標題改名',
    items: [
      '編號格式**只接受「-」分隔**（不再接受點分隔），validateNumbering 強制 dash-only；parser 仍相容點分隔避免解析斷裂',
      '開始事件 L4 編號必為 `-0` 結尾（範例 `1-1-7-0`）',
      '結束事件 L4 編號必為 `-99` 結尾（範例 `1-1-7-99`）',
      '**閘道（XOR / AND / OR 皆適用）**：L4 編號加 `_g` 後綴（單一時），連續多個用 `_g1`、`_g2`、`_g3`…（範例 `1-1-9-5_g`、`1-1-9-5_g1`），**前綴必對應既有 L4 任務**',
      'Excel 上傳時若違反任一規則，列出所有錯誤列 + 完整規則說明',
      'Parser 同步放寬：`序列流向`、`條件分支至`、`並行分支至` 等所有語法都能識別 `_g`/`_g1`/`_g2`… 後綴',
      '新增 L4_START_PATTERN / L4_END_PATTERN / L4_GATEWAY_PATTERN 三個常數於 taskDefs.js（單一來源，閘道規則更新只需改此處）',
      '首頁新增**置頂功能**：每張卡片左上有星星 icon，點擊填色即置頂；置頂永遠在最上方，內部仍按當前排序規則',
      '首頁標題由「L3 活動管理」改為「L3 工作流」',
      'CLAUDE.md 規則 3 完整記錄新編號規則（dash-only + 連續閘道 `_g\\d*`）',
      '所有下載檔名加上下載當日日期（yyyymmdd），例如 `1-1-7-OOXX-20260422.png` / `.drawio` / `.xlsx`',
    ],
  },
  {
    date: '2026-04-21',
    title: '批量操作 + UI 動態強化 + Excel 欄位檢核',
    items: [
      '首頁新增批量選取：每張活動卡片左上 checkbox，選取後浮出工具列（已選數 / 全選 / 取消）',
      '批量下載：可勾選 PNG / drawio / Excel 任意組合；PNG 依佇列渲染並顯示「X / N」進度',
      '批量刪除：紅色按鈕，彈出確認視窗列出前 10 筆名稱，確認後一次刪除並清空選取',
      '流程圖元件 hover 效果：滑到任務 / 網關 / 起訖點顯示藍色邊框 + 淡藍底，方便指認目前討論元件',
      'Logo 動態設計：hover 時旋轉 + 跳躍 + 藍色光暈（spin+bounce+glow）',
      'Logo 智慧反應：儲存成功揮手、Excel 匯入成功閃黃光、刪除活動短暫暗下',
      'Excel 匯入欄位檢核：上傳時先驗證 L3 / L4 編號格式（`1-1-1` / `1-1-1-1`，相容點分隔），不合則列出所有錯誤列供修正',
      '檢核 regex 集中定義於 `src/utils/taskDefs.js`（L3_NUMBER_PATTERN / L4_NUMBER_PATTERN），未來編號規則變更只需更新此處',
    ],
  },{
    date: '2026-04-20',
    title: 'L3/L4 編號修復 + 清理孤兒程式碼',
    items: [
      '修復泳道圖顯示「1-1-1.2」混合格式：layout.js 改為使用橫線分隔（1-1-1-2）',
      '修復 Excel 匯出 L4 編號沿用點分隔：buildTableL4Map 改用橫線，並把讀到的 l4Number 自動轉為橫線',
      '首頁舊資料自動遷移：loadFlows 載入時將 localStorage 中的點分隔編號（l3Number 與 task.l4Number）轉為橫線',
      '清理 9 個孤兒檔案：FlowViewer.jsx、InputPanel.jsx、DiagramPanel.jsx、utils/parser.js、utils/layout.js、utils/vsdxExport.js、constants/colors.js、constants/defaultInput.js、swimlane.html',
    ],
  },{
    date: '2026-04-17',
    title: 'L3/L4 編號格式統一：改為「-」分隔',
    items: [
      'L3 編號格式由點分隔（1.1.1）改為橫線分隔（1-1-1），與 Excel 匯入格式一致',
      'L4 任務編號由「L3編號.序號」改為「L3編號-序號」，例如 1-1-1-1',
      'Wizard 精靈：L3 編號輸入驗證與 placeholder 同步更新；仍相容舊點分隔格式（自動接受）',
      'Excel 匯入：若原始資料使用點分隔，系統會自動正規化為橫線分隔',
      'HelpPanel 規則說明同步更新範例',
    ],
  },
  {
    date: '2026-04-10',
    title: '首頁下載按鈕整合：直接下載 PNG / draw.io / Excel',
    items: [
      '活動卡片按鈕重整：移除「檢視/下載」，改為四個獨立操作',
      '「編輯」：直接進入流程圖統一編輯介面',
      '「↓ PNG」：在背景靜默渲染後直接下載流程圖圖檔，無需進入編輯頁',
      '「↓ draw.io」：直接下載可編輯的 .drawio 檔案',
      '「↓ Excel」：直接下載 L4 任務明細 Excel 清單',
      '「刪除」按鈕保留，與編輯按鈕並排於第一行',
    ],
  },
  {
    date: '2026-04-10',
    title: '統一編輯介面（FlowEditor）：流程圖即時預覽 + 頁籤式編輯',
    items: [
      '「新增 L3 活動」仍使用步驟精靈設定基本資訊；精靈儲存後直接進入統一編輯介面',
      '既有活動與 Excel 匯入的活動，點「編輯」直接進入統一編輯介面，不再經過精靈',
      '流程圖顯示於頁面上方，即時反映所有編輯變更',
      '下方分三個橫向頁籤：「設定流程」（任務清單）、「詳細 Excel 清單」、「設定泳道角色」',
      '「設定流程」頁籤：可新增/刪除任務、拖曳排序、設定 BPMN 連接類型、展開詳細欄位',
      '頂部標題列支援直接編輯 L3 編號與活動名稱，有未儲存變更時顯示「● 未儲存」提示',
    ],
  },
  {
    date: '2026-04-09',
    title: 'Logo 新增、規則更新與部署確認',
    items: [
      '左上角標題列新增 FlowSprite 品牌 Logo 圖示（圓形，自動隱藏若圖片尚未上傳）',
      '規則說明（HelpPanel）完整更新：元件定義擴充至 8 種（含三種閘道與書端 L3 活動）、連線規則增至 10 種 BPMN 連接類型、驗證規則擴充至 7 條（含合併節點多來源驗證）',
      '精靈（Wizard）10 種流程設定類型確認部署至正式環境',
      '更新紀錄（本頁）同步反映所有歷史更新',
    ],
  },

  {
    date: '2026-04-09',
    title: '系統更名為 FlowSprite',
    items: [
      '系統名稱由「DoReMiSo」更名為「FlowSprite」',
      '網頁標題改為「FlowSprite — BPM Flow Designer」',
      '左上角品牌名稱與 package.json 同步更新為 flowsprite',
      '規則說明（HelpPanel）同步更新，反映 BPMN 10 種連接類型與三種閘道的最新規則',
    ],
  },
  {
    date: '2026-04-09',
    title: 'L4 任務輸入：10 種 BPMN 流程設定類型 + L3 活動書端圖形',
    items: [
      '「類型」與「下一步」欄位合併為統一的「流程設定」下拉選單，共 10 種 BPMN 連接類型',
      '序列流向：單一下一步選擇',
      '條件分支（XOR 閘道）：可新增多個條件+目標任務，每個條件需填寫標籤',
      '並行分支（AND 閘道）：同時啟動多個並行目標，無需條件標籤',
      '並行合併（AND 合併）：設定合併後下一步，驗證時確認有 2 個以上來源',
      '條件合併（XOR 合併）：設定合併後下一步，驗證時確認有 2 個以上條件分支來源',
      '流程開始：設定起始後的第一個目標任務',
      '流程結束：無需設定下一步',
      '流程斷點：下一步為選填，可附加斷點說明',
      '子流程調用：填寫子流程名稱及返回後的下一步',
      '迴圈返回（XOR 迴圈）：分別設定「若未通過返回」與「若通過繼續」目標，可加條件說明',
      'L3 活動圖形改為書端（bookend）樣式：左右兩側垂直分隔線，與 BPMN 活動規範一致',
      '任務關聯說明欄位自動產生對應各類型的標準 BPMN 文字（流程斷點、子流程調用、迴圈返回）',
    ],
  },
  {
    date: '2026-04-09',
    title: 'BPMN 閘道合規：排他 / 並行 / 包容三種閘道',
    items: [
      '判斷框升級為三種 BPMN 閘道：排他閘道 (XOR，×符號)、並行閘道 (AND，+符號)、包容閘道 (OR，○符號)',
      '精靈（Wizard）閘道設定新增「閘道類型」下拉選單，可在排他/並行/包容間切換',
      '並行閘道（AND）的分支目標不需要填寫條件標籤，驗證邏輯已調整',
      '流程圖符號更新：閘道菱形內顯示對應符號（×/+/○），文字標籤移至菱形下方',
      '圖例說明更新為三種閘道類型各自的圖例項目',
      '任務關聯說明欄位對應規則更新：AND 閘道自動產生「並行分支至」/ 「並行合併來自多個分支，序列流向」；XOR/OR 仍使用「條件分支至」/ 「條件合併來自多個分支，序列流向」',
      'Excel 匯入支援完整 BPMN 標記詞彙：並行分支至、並行合併來自...序列流向、條件判斷：若未通過則返回...若通過則、【流程斷點】、調用子流程...返回後序列流向',
      '匯出 .drawio 檔案時，閘道菱形標籤包含類型符號（×/+/○）以便識別',
    ],
  },
  {
    date: '2026-04-09',
    title: 'L4 任務明細表：檢視、編輯、下載 Excel',
    items: [
      '流程圖檢視頁面下方新增「L4 任務明細表」，顯示所有任務的 10 欄資料',
      '可直接在表格內編輯：L4 任務名稱、任務重點說明、任務重要輸入、任務負責角色（下拉選單）、任務產出成品、參考資料來源文件名稱',
      '「任務關聯說明」欄位根據流程連線自動產生（唯讀，從圖形結構推導）',
      '表格右上角「↓ 下載 Excel」可下載目前最新狀態的 .xlsx 檔案（含所有 10 欄）',
      '從 Excel 匯入的資料（重點說明、重要輸入、產出成品、參考資料）會完整保存並顯示在表格中',
      '儲存按鈕在有未儲存變更時亮起，儲存後同步更新流程圖',
      '匯入或手動新增時，若 L3 編號與系統中現有活動重複，會跳出確認提示',
    ],
  },
  {
    date: '2026-04-09',
    title: 'Excel 匯入：多 L3、條件分支/合併支援',
    items: [
      '新增「上傳 Excel」按鈕，支援單一檔案匯入多個 L3 活動（每個 L3 產生一張獨立泳道圖）',
      'Excel 中 L3 活動編號留空的列，自動繼承上方最近一列的 L3 資訊（支援合併儲存格慣例）',
      '任務關聯說明新增四種標記：流程開始（指定起始任務）、流程結束（接到結束事件）、條件分支至（轉為判斷框，支援逗號/頓號分隔多個目標）、條件合併來自多個分支（提示用，不影響連線）',
      '條件分支至的任務自動轉為菱形判斷框（gateway），同列的序列流向也一併轉為條件出口',
      '匯入單一 L3 時直接開啟流程圖預覽；匯入多個 L3 時返回首頁並顯示成功訊息',
    ],
  },
  {
    date: '2026-04-02',
    title: '流程圖連接線與版面三項修正',
    items: [
      '【並行任務對齊】並行任務（同一來源的多個下一步）現在使用圖論拓撲排序分配欄位，確保並行任務在各自泳道中上下對齊同一 X 位置，不再前後錯開',
      '【判斷框多出口去重】同一判斷框的多個條件若原本都要從同一端點（如下方）出發，第二條會自動切換到上方端點，避免線條從同側出發重疊',
      '【跨多泳道向下 L 形路由】判斷框指向下方泳道（任意欄距 dc≥1）的條件，改用單次轉折的 L 形路徑（下方端點→直行到目標高度→右轉進入目標左側），取代原本三段繞行路徑',
      '向下 L 形路由同樣適用於圖片三的情境：判斷框連接兩個泳道外的任務，改為從下方端點出發，直接一次轉彎連到目標左側',
    ],
  },
  {
    date: '2026-04-01',
    title: '下一步自動帶入與並行任務體驗優化',
    items: [
      '每個非結束/非判斷框元件在「下一步」欄位一律顯示至少一個選單（不再可能出現空白）',
      '載入既有流程時，若任何任務的「下一步」為空，系統自動帶入序列中下一個任務',
      '拖曳重排後：已明確指定下一步的元件保持原設定；未設定者自動帶入新順序的下一個任務',
      '新增任務至末尾時，若原末尾任務未設定下一步，自動指向新增的任務',
      '「並行任務」按鈕文字改為「+ 新增並行任務」，語意更清楚',
    ],
  },
  {
    date: '2026-04-01',
    title: '系統更名、匯出修正與版本紀錄',
    items: [
      '系統名稱由「業務活動管理系統」改為「DoReMiSo」',
      '新增版本更新紀錄面板（本頁），方便日後查閱歷史修改',
      '修正 .drawio 匯出亂碼：L4 編號與任務名稱改以「-」連接（原 &#xa; 被 XML 跳脫後顯示為字面文字）',
      '修正 .drawio 匯出泳道角色名稱顯示為直式問題：移除 rotation=-90，改為橫向顯示',
    ],
  },
  {
    date: '2026-04-01',
    title: '連接線路由與標籤修正',
    items: [
      '修正判斷框→上方泳道相鄰任務（top→left）路由：改為 L 形單次轉折，避免連接線穿過目標任務框',
      '修正連接線標籤位置：所有連接線的標籤移至路徑第二段中點，不再蓋住箭頭尖端',
      '解決「箭頭跳過中間節點」視覺問題（標籤蓋住箭頭導致使用者誤判路由終點）',
    ],
  },
  {
    date: '2026-04-01',
    title: '排序功能',
    items: [
      '首頁 L3 活動列表新增排序下拉選單',
      '支援依 L3 編號升冪/降冪、依更新日期最新/最舊排序',
      '預設依 L3 編號升冪排序，支援數字自然排序（1 < 2 < 10）',
    ],
  },
  {
    date: '2026-04-01',
    title: '規則說明面板',
    items: [
      '首頁標題列新增「規則說明」按鈕，點擊開啟 Modal',
      '說明內容涵蓋：層級架構（L1–L5）、流程圖元件定義、驗證規則、連線規則、判斷框路由規則、匯出格式',
      '規則以資料常數定義，方便未來同步更新',
    ],
  },
  {
    date: '2026-04-01',
    title: '驗證規則與動態泳道高度',
    items: [
      '新增流程驗證：必須有開始事件、必須有結束事件',
      '新增連通性驗證：每個非開始節點必須被至少一條連線指向（孤立節點無法通過）',
      '新增完整性驗證：非結束、非判斷框節點必須設定至少一個有效下一步',
      '泳道高度動態調整：同角色多條下方繞行連線以 slot 制排列，避免連接線重疊',
      '下方繞行連線按跨欄距排序（長距離排最外側），泳道自動擴展',
    ],
  },
  {
    date: '2026-04-01',
    title: 'Draw.io 匯出修正',
    items: [
      '修正 .drawio 檔案無法開啟（顯示「非繪圖文件」）問題',
      '加入 mxfile → diagram 包裝層（現代版 Draw.io 必要結構）',
      '修正 XML 屬性跳脫：使用 html=0 搭配純文字換行，避免 HTML 標籤跳脫問題',
    ],
  },
  {
    date: '2026-04-01',
    title: 'L4 主要功能批次更新',
    items: [
      '術語修正：L1 業務領域、L2 價值流、L3 活動、L4 任務、L5 步驟',
      '首頁卡片新增「檢視/下載」快速預覽，不需進入編輯精靈',
      '新增 FlowViewer 獨立檢視頁面',
      '圖例移除「消息流」，新增「L3 活動（關聯）」',
      '新增 L3 活動元件（雙框矩形，Call Activity 樣式）',
      '支援並行任務：一個節點可設定多個下一步（nextTaskIds[]）',
      '相容舊格式：自動將 nextTaskId 字串遷移至 nextTaskIds 陣列',
    ],
  },
  {
    date: '2026-04-01',
    title: '匯出格式：從 VSDX 改為 Draw.io',
    items: [
      '評估 VSDX 格式因 Visio XML schema 嚴格要求難以實作，改採 Draw.io XML 格式',
      '匯出檔案副檔名改為 .drawio，可用 diagrams.net 或 VS Code 擴充套件開啟編輯',
      '保留 PNG 匯出功能',
    ],
  },
  {
    date: '2026-04-01',
    title: '判斷框路由、全寬預覽、PNG 匯出',
    items: [
      '判斷框智慧路由：依 dr/dc（列差/欄差）自動決定出口/入口方向（6 種路由情境）',
      '圖表預覽改為全寬顯示並支援橫向捲動',
      'PNG 匯出以完整 SVG 為基礎（高解析度，pixelRatio=2）',
    ],
  },
  {
    date: '2026-04-01',
    title: 'L4 使用體驗：拖曳排序、下一步設定、驗證',
    items: [
      '精靈中的 L4 任務列表支援拖曳排序（自動更新 nextTaskIds 為順序排列）',
      '每個任務可明確設定下一個任務',
      '新增開始/結束事件基本驗證',
    ],
  },
  {
    date: '2026-03-31',
    title: '重建應用程式：精靈表單、泳道渲染、Dashboard',
    items: [
      '以 React + Vite + Tailwind CSS 重建整個應用',
      '新增四步驟精靈：L3 活動資訊 → 泳道角色 → L4 任務 → 圖表預覽',
      '泳道圖以 SVG 渲染，節點依角色分配泳道',
      '資料以 localStorage（bpm_flows_v1）持久化',
      '首頁 Dashboard 支援新增、編輯、刪除 L3 活動',
      '設定 GitHub Actions 自動部署至 GitHub Pages',
    ],
  },
  {
    date: '2026-03-30',
    title: '初始版本',
    items: [
      '建立泳道圖產生器 Web App 專案（React + Vite）',
      '提供免安裝的獨立 HTML 版本（可直接用瀏覽器開啟）',
    ],
  },
];

function Section({ entry, isFirst }) {
  const [open, setOpen] = useState(isFirst);
  return (
    <div className="border-b border-gray-100 last:border-0">
      <button
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors"
        onClick={() => setOpen(o => !o)}>
        <span className="text-xs font-mono text-gray-400 flex-shrink-0 w-24">{entry.date}</span>
        <span className="flex-1 text-sm font-medium text-gray-800">{entry.title}</span>
        <span className="text-gray-400 text-xs">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <ul className="px-4 pb-3 space-y-1 ml-24">
          {entry.items.map((item, i) => (
            <li key={i} className="text-xs text-gray-600 flex gap-2">
              <span className="text-gray-300 flex-shrink-0 mt-0.5">•</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function ChangelogPanel() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="px-3 py-2 rounded-lg text-white text-sm font-medium transition-colors"
        style={{ background: '#3470B5' }}
        onMouseEnter={e => e.currentTarget.style.background = '#5B8AC9'}
        onMouseLeave={e => e.currentTarget.style.background = '#3470B5'}
        title="查看版本更新紀錄">
        更新紀錄
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.45)' }}
          onClick={e => { if (e.target === e.currentTarget) setOpen(false); }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <div>
                <h2 className="text-lg font-bold text-gray-800">版本更新紀錄</h2>
                <p className="text-xs text-gray-400 mt-0.5">最新更新排列在最上方，點選標題可展開/收合明細</p>
              </div>
              <button onClick={() => setOpen(false)}
                className="text-gray-400 hover:text-gray-600 text-xl font-bold leading-none px-2">
                ×
              </button>
            </div>

            {/* List */}
            <div className="overflow-y-auto flex-1">
              {CHANGELOG.map((entry, i) => (
                <Section key={i} entry={entry} isFirst={i === 0} />
              ))}
            </div>

            {/* Footer */}
            <div className="px-6 py-3 border-t border-gray-100 flex justify-end">
              <button onClick={() => setOpen(false)}
                className="px-5 py-2 rounded-lg text-white text-sm font-medium transition-colors"
                style={{ background: '#2A5598' }}
                onMouseEnter={e => e.currentTarget.style.background = '#1E4677'}
                onMouseLeave={e => e.currentTarget.style.background = '#2A5598'}>
                關閉
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

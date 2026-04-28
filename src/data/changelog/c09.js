/**
 * Changelog archive chunk c09 (frozen — do not edit).
 * See ChangelogPanel.jsx for the full UI.
 */
export default [
  {
    date: '2026-04-22',
    title: '閘道多條件端點分散 + corridor 優先端點不混用 + 同 target 巢狀 slot + 泳道色塊補滿',
    items: [
      '**閘道 4 個以上條件的 fan-out 重疊**（使用者：「指向 5-1-2-7 和 5-1-2-10 的連線幾乎完全重疊」）：原因是 `getExitPriority` 對多數方向只回傳 3 個優先端點（top/right/bottom），第 4 條件 fallback 回第一個（重複佔用 top），從閘道發出的兩條線疊在同一個 port',
      '修正：`getExitPriority` 追加所有未列出的側邊為末尾 fallback，確保 4 條件下可分到 4 個不同 port；5 條以上仍會重複（需 port 子位置偏移架構，列 backlog）',
      '**Phase 3b / 3c bottom fallback 缺少混用檢查**：top corridor 衝突時回退到 bottom，卻沒檢查 bottom 是否已有反向端點在用。典型案例：t8 從閘道入 bottom，再 Phase 3c 把 t8 → end 排到 bottom OUT → 同 port 一進一出（違反使用者第一優先規則）',
      '修正：bottom 回退前先檢查 `hasIn(source, bottom) || hasOut(target, bottom)`；若會混用則寧可使用 top（視覺交叉屬規則 2、端點混用屬規則 1，規則 1 優先）',
      '**Top / bottom corridor 同 target 的 slot 順序**：原本 tiebreaker 用 source col 升冪，導致 range [2,6] 排在內側、contained 的 [4,6] 排外側（橫線交叉）。改以 span 升冪為 tiebreaker：窄的在內、寬的在外，巢狀 range 不再交叉',
      'Trace 驗證使用者情境：4 條件分別走 top/right/bottom/left，t7/t8/t9 → end 都走 top corridor 且無混用，t10 → end 用 default 直達',
      '**泳道左側角色欄出現白色缺口**：當一個 lane 需要預留多個 top corridor slot（例如一角色做多件事、連線被抬高）時，step 7 把 corridor 空間加在 lane 之上，但 header / body rect 只覆蓋 `laneTopY ~ laneTopY + laneH`，corridor 那段就變成白條',
      '修正：DiagramRenderer 畫 header / body 時改從「上一 lane 底部」（或 `TITLE_H`）開始，吃掉 corridor 預留空間。概念上 corridor 屬於下方那個 lane 的進入走廊，顏色跟該 lane 一致合理',
    ],
  },
  {
    date: '2026-04-22',
    title: 'Phase 3d 端點混用判斷修正 + 文件同步',
    items: [
      '**Phase 3d 端點混用檢查方向錯誤**：原本寫「port 已有同方向」而非「已有相反方向」，導致 t9 → end 在 end 的 bottom 已被 t7 / t8 用作 IN 時會被誤擋（還是走預設 right→left 穿過中間任務）',
      '修正為檢查相反方向：新增 OUT 時擋「該 port 已有 IN」、新增 IN 時擋「該 port 已有 OUT」，對齊 Phase 3b / 3c 的寫法與使用者規則「端點不可同時進入和出發」',
      '**HelpPanel 文件同步**：L3 活動元件說明改寫（頂端顯示 L3 編號、內部顯示 `[子流程] + 任務名稱`）；ROUTING 表修正跨列 forward 預設值（`右 → 左` 而非 `上 → 左`），並新增 Phase 3d 條目',
      '**HANDOVER 更新**：第 7 節的 phase 清單加入 Phase 3d，建議閱讀 PR 範圍延伸至 #40',
      'layout.js 內部註解提到「Phase 3b / 3c」的地方補上 3d',
    ],
  },
  {
    date: '2026-04-22',
    title: '流程圖編號規則：只顯示 L3 / L4；迴圈返回改新標準文字',
    items: [
      '**流程圖上的編號顯示規則重新釐清**：只有 L3 活動與 L4 任務的「正式編號」才會印在形狀上；開始（尾碼 `-0`）、結束（`-99`）、閘道（`_g` / `_g1`…）的編號僅作辨識用，不顯示在流程圖上',
      '編輯介面（task card、下拉選單）維持顯示全部編號（辨識用途），本次變動不影響',
      '**L3 活動（子流程調用）形狀改顯示所調用的 L3 編號**（取代原本顯示自己的 L4 編號），內部改顯示 `[子流程] + 任務名稱`，統一視覺慣例',
      '**迴圈返回標準文字改為「迴圈返回，序列流向 X」**（使用者：「一樣代表這個 L4 任務將指向 X」）',
      'Excel 匯出：`generateFlowAnnotation` 產出新格式；FlowTable 任務關聯說明欄同步改顯示新文字',
      'Excel 匯入：regex 放寬到同時接受新格式「迴圈返回，序列流向 X」與舊格式（`至 X` / `：X` / 空格 X），向後相容',
      'HelpPanel 範例、說明文字同步更新',
      '**流程圖文字換行改 token-aware**：原本按字元數切會把 `Sourcer` 切成 `Sourc` + `er`、`Purchasing Supervisor` 切成 `Purch` / `asing` / `Supe` / `rvisor`，現在英文單字、數字串視為不可分 token，CJK 字仍可逐字換行（使用者：「似乎會自動在單字的中間換行」）',
      '新的寬度計算視 CJK 為 2 倍寬、Latin 為 1 倍寬，maxChars 解讀為 CJK 等效寬度，泳道標題、任務名、事件名、描述欄位共用此邏輯',
      '**跨泳道連線重疊偵測（Phase 3d）**：原本 task → task / task → end 的跨列 forward 連線用 midX 路徑（中間直線），若中間剛好有任務 (如 1-1-5-9 → 1-1-5-99 穿過 1-1-5-10、1-1-9-6 → 1-1-9-99 穿過 1-1-9-7) 會視覺重疊',
      '新增對策：偵測到預設路徑會跨過任務矩形時，優先改走 ① 進入 target 的上/下端點（垂直段放 target 欄）或 ② 從 source 上/下端點出發（垂直段放 source 欄），兩者 source / target 欄本來就沒有其他任務，可避開障礙',
      '依序嘗試 A（改 entry）→ B（改 exit）→ fallback 預設，配合 portIn / portOut 混用防呆（端點不可同時收 / 發）',
    ],
  },
  {
    date: '2026-04-22',
    title: '端點不混用 + Slot 依 target 順序排',
    items: [
      '**規則：元件任一端點不可同時接收與發出連線**（使用者：「不能讓一個元件的端點同時有進入和出發」）',
      '新增 `portIn` / `portOut` map 追蹤每個 `(task, side)` 的方向使用；Phase 1 閘道條件指派時註冊，Phase 3b（task backward）與 Phase 3c（task forward）指派前檢查',
      '條件：若 source 對應 corridor side 已有 incoming，或 target 的該 side 已有 outgoing → 走 bottom corridor 避開',
      '**Slot 排序依 target 順序**（原本按 span 長短）：smaller target col = 內側 slot（top corridor）/ 相對內側（bottom corridor），使用者讀圖時連線順序跟任務左右順序一致',
      'Top / bottom corridor 方向不同：top 的 slot 0 在內（近 task），bottom 的 slot 0 在外（遠 task）→ 排序方向也相反，程式碼用 `slotSortAsc` / `slotSortDesc` 區分',
      '驗證 1-1-5 / 5-3-3 / 5-1-4 三個使用者回報情境均 0 個 mixed port',
    ],
  },
  {
    date: '2026-04-22',
    title: 'Top corridor 跨越偵測：後發生連線會讓路避免視覺 X',
    items: [
      '使用者 case：`5-1-4-2_g`「不可達成」top-skip 到 `5-1-4-4`（col [3..5]）已登記；後處理的 `5-1-4-3 → end`（source col=4）若也走 top，vertical exit 會跟先前的水平 corridor 交叉成 X',
      '新規則：Phase 3b / 3c 處理新 top→top 前，先查 source 或 target col 是否**嚴格在**既有 top corridor 範圍內；若是，改走 bottom corridor',
      '先發生連線（gateway conditions → Phase 1 → Phase 3 已登記）永遠不動；後發生的 task backward / forward 在有衝突時讓路',
      '沒衝突時行為不變，slot 系統繼續把多條 top corridor 分到不同 y-level',
    ],
  },
  {
    date: '2026-04-22',
    title: 'Loop-back 從 backward-up 優先走下方 corridor',
    items: [
      '修正 `5-3-1-3_g1 → 5-3-1-2` 類型的 loop-back 原本走上方 corridor 繞到最高再下來，且進入點用 right 會撞到 target 已佔用的端點',
      '改法 1：`getExitPriority` 對 `(dr<0, dc<0)` backward-up 情境優先 bottom（讓 path 在 source 附近就近繞回，不用爬到頂部）',
      '改法 2：`inferEntrySide` 將「backward + vertical exit」一般化為 `entry = exitSide`（走 corridor 後從同側進入目標），避開 target 的 horizontal ports',
    ],
  },
];

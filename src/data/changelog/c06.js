/**
 * Changelog archive chunk c06 (frozen — do not edit).
 * See ChangelogPanel.jsx for the full UI.
 */
export default [
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
];

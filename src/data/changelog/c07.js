/**
 * Changelog archive chunk c07 (frozen — do not edit).
 * See ChangelogPanel.jsx for the full UI.
 */
export default [
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
];

/**
 * Changelog archive chunk c10 (frozen — do not edit).
 * See ChangelogPanel.jsx for the full UI.
 */
export default [
  {
    date: '2026-04-23',
    title: 'Excel 匯入遇重複 L3 編號時新增「覆蓋」選項',
    items: [
      '**情境**：使用者：「我希望跳出提醒後可以讓使用者選擇要都保留還是要用新的覆蓋 N 個舊的（如果有多於一個舊的重複編號，要提醒有多少個）」',
      '原本 `window.confirm` 只有 是/否（是 = 都保留並共存、否 = 取消），改成 modal 三個按鈕：**都保留**（維持舊行為）/ **覆蓋**（刪除所有同編號舊活動）/ **取消**',
      'Modal 會列出每個重複的 L3 編號和對應已存在幾個活動（例：`5-3-3：已有 2 個 → 將匯入 1 個新的`），覆蓋按鈕顯示「刪除 N 個舊的」幫助使用者衡量',
      '`App.jsx` 的 `handleImportExcel` 新增 `mode` 參數（`keep` / `overwrite`）：`overwrite` 模式先依匯入檔案的 L3 編號過濾出本次要覆蓋的既有活動並刪除（只刪同編號的，其他活動不動）',
    ],
  },
  {
    date: '2026-04-23',
    title: '回退情境 3：允許兩條 IN 共用同一端點',
    items: [
      '**規則澄清**：使用者：「還是可以維持原規則，讓同一個端點同時有進入，所以以這個情境為例，從排他閘道『一般出貨』條件指向 5-7-2-4 的連線，還是可以跟從 5-7-2-7 任務來的連線，從 5-7-2-4 的上方端點進入」',
      '「端點不能同時有進有出」的規則**只禁止 IN + OUT 混用**；**兩條 IN 共用同一端點是 OK 的**。情境 3 的 `expectedBackwardTopEntry` pre-scan 會把 gateway forward 條件的 entry 從 `top` 強制改成 `left`，反而讓兩條 IN 分岔；回退這個行為',
      '**移除 `expectedBackwardTopEntry` 集合與 Phase 3 內的 `testEntry = \'left\'` 覆寫**，恢復 Phase 3 的 `inferEntrySide` 自然判斷',
      '驗證 5-7-2：`5-7-2-1_g → 5-7-2-4` 回到 `top → top`，與 `5-7-2-7 → 5-7-2-4` 共用 TOP port；1-1-7 情境 1 sibling-sharing 無影響',
    ],
  },
  {
    date: '2026-04-23',
    title: '連線路由優化（sibling 共用 / corridor 降級 / backward 預掃描）+ 批量下載序列化 + 回到頂端按鈕',
    items: [
      '**情境 1（sibling 共用同一端點）**：使用者：「第二條件連線時會被 1-1-7-4 擋住，我希望這種情況下可以容許部分線段重疊，讓連線走閘道的下方端點出發，並連到 1-1-7-5 的左側端點」。Phase 3 在 sibling-sharing fallback 前會先拒絕「會穿過任務的 `right`/`left`」和「垂直跨距 >1 列的 `top`/`bottom`」，走投無路時就回退到「共用第一優先端點、entry=left（forward）」，兩條線在閘道端共用一段、再各自彎向 target',
      '**情境 2（corridor 與未來垂直衝突）**：使用者：「駁回現在走上方會遇到後發生的線條」。Phase 3 選擇 top corridor 時新增 `corridorBlockedByFuturePhase3dVertical` 檢查：掃描 corridor 內側欄位是否有任務即將用 Phase 3d 從 TOP/BOTTOM 出發（如 5-2-6-4 → end event），若會衝突就降級這個 gateway 條件到 bottom（駁回改走 bottom corridor）',
      '**情境 3（同 TOP 端點兩條 IN 會師）**：使用者：「違反了「同一個端點不能同時有進有出」……我希望從排他閘道的連線可以連到 5-7-2-4 的左側端點，而從 5-7-2-7 任務來的連線可以保持原本的從 5-7-2-4 的上方端點進入」。Phase 3 之前加 `expectedBackwardTopEntry` pre-scan，預先偵測會進入 target TOP 的 backward edge；Phase 3 若 forward 條件會同樣落在 target TOP 中心點，自動把 entry 改成 `left`（同一 corridor、落點改在 target 左緣，兩箭頭 x 錯開）',
      '**批量下載掉包修正**：使用者：「一次點 30 個要下載，常常會只下載 25, 26 個，甚至 20 個」。原本 drawio/excel 兩格式用 `i*220` 同 slot 排程，30 個 × 2 格式會在 6.5s 內觸發 60 個下載，Chrome 會丟包。改成序列化：每個下載獨佔一個 slot、間距 450ms，30 個全格式需 ~27s 但全部成功',
      '**新增回到頂端浮動按鈕（`BackToTop.jsx`）**：Dashboard / FlowEditor 右下角顯示，捲動 >240px 才出現，點擊平滑捲回頂端',
      '**Dashboard 新增兩組排序**：使用者：「排序方式可以照角色多寡排列」「還有照任務數量排列」。新增「角色數（多 → 少）/（少 → 多）」「任務數（多 → 少）/（少 → 多）」共四個選項，同數量再退用 L3 編號排序當 tiebreaker',
      '`layout.js` 新增三個 helper（`horizontalPathHasObstacle`、`corridorBlockedByFuturePhase3dVertical`、`expectedBackwardTopEntry` 集合），`taskAt` / `cellTaskId` 往前移到 Phase 3 之前供共用',
    ],
  },
  {
    date: '2026-04-23',
    title: '流程圖標題列改深灰、內外泳道調整為指定 HEX',
    items: [
      '**`TITLE_BG` 從 `#111827`（近黑）改成 `#374151`（Tailwind gray-700 深灰）**，視覺柔和一些，白字對比仍清楚',
      '**`INTERNAL_BG` 從 `#2A5598`（主題深藍）改成 `#0066CC`（指定中藍）**，使用者指定色碼',
      '**`EXTERNAL_BG` 從 `#4CAF50`（Material 綠）改成 `#009900`（指定純綠）**，使用者指定色碼',
      '三個管道（網頁 SVG / PNG 下載 / drawio 下載）都共用 `COLORS` 常數，同步生效',
      'Wizard / FlowEditor / Dashboard 的角色徽章與下拉選單顏色也同步更新',
      'ui-rules.md 色彩標準表同步更新',
    ],
  },
  {
    date: '2026-04-23',
    title: '流程圖標題列改為黑底',
    items: [
      '**`TITLE_BG` 從 `#2A5598`（深藍）改成 `#111827`（黑）**，跟主題深藍頁首區分，流程圖標題更突顯',
      '三個管道（網頁 SVG / PNG 下載 / drawio 下載）都共用 `COLORS.TITLE_BG`，同步生效',
      'ui-rules.md 色彩標準表同步更新',
    ],
  },
  {
    date: '2026-04-23',
    title: '外部角色泳道改回綠色（跟內部藍色對比）',
    items: [
      '**`EXTERNAL_BG` 從 `#5B8AC9`（淡藍）改回 `#4CAF50`（綠色）**，內部角色維持 `#2A5598`（深藍）；兩者色相對比明顯，使用者一眼分辨內外',
      '同步更新：`src/diagram/constants.js`、Wizard / FlowEditor / Dashboard 的角色下拉選單與徽章顏色、`.claude/skills/ui-rules.md` 色彩標準表',
    ],
  },
];

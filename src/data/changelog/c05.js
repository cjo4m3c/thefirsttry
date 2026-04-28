/**
 * Changelog archive chunk c05 (frozen — do not edit).
 * See ChangelogPanel.jsx for the full UI.
 */
export default [
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
      '次要按鈕(上傳 Excel、下載 Excel、下一步、匯出 PNG)改用中藍',
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
  },
];

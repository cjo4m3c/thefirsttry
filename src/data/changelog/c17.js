/**
 * Frozen changelog chunk c17 (2026-04-29).
 * Two entries from current.js when it crossed the 7KB freeze threshold.
 * Newest first within file.
 */
export default [
  {
    date: '2026-04-29',
    title: 'M-1 按鈕風格統一 + 任務元件行距/padding 收緊 + 業務規格 §13 視覺章',
    items: [
      '**緣由**：使用者：「M-1 統一包含 header 按鈕及編輯區塊的匯出下載按鈕」+「任務元件字到框邊還有空間且行距偏緊，希望行距至少是單行間距、padding 縮小」。',
      '**任務元件字級行距優化**：`SvgLabel` lineH 30→**32**（兩行間隙 = 32-16 = 16px = 一行字高，達到「單行間距」標準）；`LAYOUT.NODE_H` 88→**84**（3 行 × 32 + 字高 16 + 上下 padding 各 2 = 84，padding 從 6→2 收斂視覺）。Layout ripple 安全：shape top/bottom = 34/118，LANE_H 152 - MAX_SHAPE_BOTTOM_OFFSET 130 仍留 22px buffer；`minLaneH(slots)` / drawio / PNG export 自動跟。',
      '**M-1 編輯頁 Header 4 顆按鈕統一**（B 方案 — 保留 `#2A5598` 深藍 Header 底）：全部統一 `px-3 py-1.5 text-base rounded border border-white border-opacity-40 text-white hover:bg-white hover:bg-opacity-10`。順序左→右：[重設所有端點][打開編輯器][儲存][★ 置頂]。文字調整：「重設所有手動端點」→「重設所有端點」、「編輯」→「打開編輯器」（去 icon）；★ 從中間移到最右側。儲存按鈕 `hasChanges` 時用實白底 + `#1E4677` 深藍字 + `font-semibold` 強調，無變更時跟其他按鈕同樣的透明白邊白字。',
      '**M-1 Toolbar 三顆下載統一同色**：PNG / drawio / Excel 全改 `#2A5598` / hover `#1E4677`（本來是 `#3470B5` / `#2A5598` / `#1A3D69` 三色階），跟首頁按鈕 + 編輯頁 Header 主題藍一致。順序保留 PNG → drawio → Excel。',
      '**業務規格文件 §13「視覺與字級規格」新增**：`docs/business-spec.md` 在 §12 後加 §13，含 7 小節：13.1 LAYOUT 常數 / 13.2 字級三層 / 13.3 行距 lineH / 13.4 wrap maxChars / 13.5 任務元件 padding / 13.6 按鈕色系 / 13.7 對應實作。把分散在 `constants.js` / `text.jsx` 等檔的數字和設計原則集中為單一來源；之後改字級或框尺寸先改 spec doc 數字再同步實作。',
      '**動到的檔案**：`src/diagram/constants.js`（NODE_H 一項）/ `src/components/DiagramRenderer/text.jsx`（SvgLabel lineH 預設）/ `src/components/DiagramRenderer/Toolbar.jsx`（三鍵同色）/ `src/components/FlowEditor/Header.jsx`（4 顆按鈕統一）/ `docs/business-spec.md`（+§13 約 80 行）。`build` 通過。',
      '**Backlog**：M-1 標完成。',
    ],
  },
  {
    date: '2026-04-29',
    title: '全頁儲存連動修復 + Excel Tab 內嵌編輯 + 流程圖頂部下載統一（收掉 P / E / M-2）',
    items: [
      '**緣由**：使用者：「儲存要整頁一起存，不能下方 excel 編輯後上方的調整都不見了，應該要是不管在哪裡編輯後所有內容都要連動修正（編輯器、流程圖、下方表格）」+「下載 excel 移到匯出 PNG／drawio 旁邊」+「點下載也檢核並儲存，不符合就不能下載」+「Drawer 不可以有第二個儲存按鈕，整頁共用一個」+「編輯方塊高度容納 3 行，4 個關鍵欄位（L4 任務名稱／重點說明／重要輸入／關聯說明）寬度加大」+「table 標題列容許 2 行字，L3 重複欄位變窄」。',
      '**根因**：FlowTable 用本地 `useState(tasks)` 快照（FlowTable.jsx:53-65），`useEffect` 在 `flow.tasks` 引用變動時把本地 state 強制重置 → 流程圖 / FlowEditor 改 → liveFlow 變 → FlowTable 未存的本地修改被覆蓋；FlowTable 跟 FlowEditor 各有獨立 `hasChanges`，互不同步；儲存按鈕散在 3 處（Header / FlowTable / 對應 export 都不 validate）。',
      '**P 修復 — FlowTable 轉受控元件**：移除本地 `tasks` / `hasChanges` state，改直接讀 `props.flow.tasks`；EditCell 改 `<textarea rows={3}>` + 內部 local buffer + onBlur 才呼叫 `onUpdateTask`（避免每按一鍵就觸發 layout 重算）；外層 `useEffect` 在 prop value 變動時同步 buffer。FlowEditor 改傳 `actions.updateTask` 為 `onUpdateTask` prop，移除 `handleTableSave`。',
      '**E（Excel Tab 內嵌編輯）+ Q4 視覺**：cell 從 `<input>` 升級 `<textarea rows={3}>`（容納 3 行 + 使用者可自行 resize-y）；4 個關鍵欄位（L4 任務名稱／重點說明／重要輸入／關聯說明）統一寬度 `min-w-[260px]`，其他編輯欄位 `min-w-[140px]`，唯讀 L3 / L4 編號欄 `max-w-[180px]`；表頭移除 `whitespace-nowrap` 容許 2 行（L3 重複欄位較窄、長 header「任務關聯說明（BPMN Sequence Flow）」自動 wrap）。Header 改成「任務表格 (N 筆)」+ 提示「離開欄位即同步」。',
      '**M-2 流程圖頂部下載統一**：DiagramRenderer Toolbar 加第 3 顆「↓ 下載 Excel」（藍系第 3 階 #1A3D69 / hover #122A4A），順序 PNG → drawio → Excel；移除 FlowTable 內的「儲存」與「下載 Excel」按鈕；整頁只剩 Header 一顆「儲存」（Drawer audit 確認無獨立儲存按鈕）。',
      '**儲存即下載 — 三個 export 串接 saveAndValidate**：FlowEditor 抽出 `saveAndValidate(onSuccess?)`，blocking 錯誤直接擋（無法存也無法下載），warning 顯示 modal 由使用者「仍然儲存」決定；handleSave 也走 saveAndValidate；DiagramRenderer 收 `onBeforeExport` prop，PNG / drawio / Excel 三個 handler 都先呼叫 `onBeforeExport(downloadCallback)`。SaveModal state 加 `onSuccess` 欄位讓 warning 路徑也能 chain 下載。',
      '**動到的檔案**：`src/components/FlowEditor/index.jsx`（saveAndValidate 抽出 / SaveModal callback / props 改名）/ `src/components/FlowTable.jsx`（重寫，轉受控）/ `src/components/DiagramRenderer/index.jsx`（onBeforeExport prop + Excel handler）/ `src/components/DiagramRenderer/Toolbar.jsx`（第 3 顆按鈕）。`build` 通過。',
      '**現在的同步流向**：流程圖 / Drawer / FlowTable 任一處編輯 → liveFlow 即時更新 → 其他兩處即時反映 ✅；按頂部「儲存」一次存全部 ✅；按 PNG / drawio / Excel 任一下載按鈕 → 先 validate → 通過則存全部 + 下載 / 不通過則 modal 阻擋 ✅。',
      '**Changelog freeze**：current.js 達 10.4KB（超 7KB 軟上限），凍結到 `c16.js`（PR #85 backlog 合併 + PR #86 字級三層化 + PR #87 NODE_H 88 共 3 條）；`index.js` 加 c16 import；current.js 重置只留本 PR 條目。',
      '**Backlog**：條目 **P** / **E** / **M-2** 三條一起標完成。',
    ],
  },
];

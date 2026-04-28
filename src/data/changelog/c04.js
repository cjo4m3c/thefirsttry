/**
 * Changelog archive chunk c04 (frozen — do not edit).
 * See ChangelogPanel.jsx for the full UI.
 */
export default [
  {
    date: '2026-04-20',
    title: 'L3/L4 編號修復 + 清理孤兒程式碼',
    items: [
      '修復泳道圖顯示「1-1-1.2」混合格式：layout.js 改為使用橫線分隔（1-1-1-2）',
      '修復 Excel 匯出 L4 編號沿用點分隔：buildTableL4Map 改用橫線，並把讀到的 l4Number 自動轉為橫線',
      '首頁舊資料自動遷移：loadFlows 載入時將 localStorage 中的點分隔編號（l3Number 與 task.l4Number）轉為橫線',
      '清理 9 個孤兒檔案：FlowViewer.jsx、InputPanel.jsx、DiagramPanel.jsx、utils/parser.js、utils/layout.js、utils/vsdxExport.js、constants/colors.js、constants/defaultInput.js、swimlane.html',
    ],
  },
  {
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
];

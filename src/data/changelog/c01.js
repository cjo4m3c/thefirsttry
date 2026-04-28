/**
 * Changelog archive chunk c01 (frozen — do not edit).
 * See ChangelogPanel.jsx for the full UI.
 */
export default [
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

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
        className="px-3 py-2 rounded-lg border border-gray-300 text-gray-600 text-sm hover:bg-gray-100 transition-colors"
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
                className="px-5 py-2 rounded-lg text-white text-sm font-medium"
                style={{ background: '#4A5240' }}>
                關閉
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

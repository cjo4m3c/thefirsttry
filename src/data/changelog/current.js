/**
 * Changelog "current tip" — new entries since last freeze land here.
 * When this file grows beyond ~7KB, freeze: rename to c{next}.js + reset to [].
 * Entries are newest-first within file.
 */
export default [
  {
    date: '2026-04-29',
    title: '操作體驗 8 項：角色 InsertSlot、role 寬度+對齊、下載文字、Tooltip 去 icon、LegendModal、卡片對齊',
    items: [
      '**緣由**：使用者批次 8 項：(1) 設定泳道角色加 InsertSlot + 移除底部新增按鈕 (2) 角色下拉拉寬 (3) 任務名稱 vs 序列流向左對齊 (4) Header 下載文字統一 (5) 首頁卡片下載文字統一 (6) Tooltip 內選單去 icon (7) LegendModal 去重複框 (8) 卡片角色固定 2 行 + 檢查對齊問題。',
      '**1 — Role InsertSlot**：`DrawerContent.jsx` role 區塊改用跟 task 一樣的 hover-between-rows InsertSlot（共用元件加 `label` / `title` props），點擊呼叫 `addRoleAt(index)`。底部「+ 新增角色」按鈕移除，改成上方「+ 新增角色（加到最後）」（跟 task 風格一致）。',
      '**2 — Role select 拉寬**：`TaskCard.jsx` Row 1 角色 select 從 `w-24` (96px) → **`w-40`** (160px)，多 64px 收編號 badge 跟角色之間的「空白」。',
      '**3 — 任務名稱 vs 序列流向左對齊**：原本 ConnectionSection 從 `px-3` (12px) 起，跟 Row 1 任務名稱起點（drag + badge + role + gaps ≈ 300px）差很多。**ConnectionSection 改包進跟 Row 2 一樣的 spacer 結構** `<div className="flex"><div w-[300px] /><div flex-1>{ConnectionSection}</div></div>`，讓「序列流向 → 目標」這類 control 跟上方任務名稱左側對齊。Row 2 spacer 也從 240→300 配合新 role 寬度。',
      '**4 — Header 下載文字**：dropdown 三項從「匯出 PNG / 匯出 .drawio / 下載 Excel 表格」→ **「下載 PNG / 下載 Drawio / 下載 Excel」**（統一動詞 + 簡稱）。',
      '**5 — 首頁卡片下載文字**：`Dashboard.jsx` 三按鈕從「PNG / draw.io / Excel」→ **「下載 PNG / 下載 Drawio / 下載 Excel」**（跟 Header 一致）。',
      '**6 — ContextMenu 去 icon**：移除 actions list 前綴 emoji（`⬇️ ◇ ➕ 📚 🔁 🧩 ↔ 🗑️`），ActionToggle 元件 drop 掉 icon prop。各 sub-form 內元件符號（`○ ● ▭ ◇× ◇+ ◇⊙`）保留作為元件類型 visual identifier。Header `✕` 關閉按鈕保留（標準 functional UI）；右側 `▴/▾` chevron 保留作為 dropdown 指示。',
      '**7 — LegendModal 去重複**：`legend.jsx` `LegendSection` 移除外層白底卡片（`mt-4 p-4 bg-white border rounded-lg`）+ 內部「圖例說明」標題（modal 已提供）。剩下 9 項 grid 直接 render，跟 modal 框框只一層。',
      '**8 — 首頁卡片對齊**：`Dashboard.jsx` 兩處 min-h 修正：(a) Header L3 名稱列加 `min-h-[3rem]` + `line-clamp-2`（最多 2 行，1 行短標題仍佔 2 行高度）(b) Roles preview 加 `style={{ minHeight: \'3rem\', maxHeight: \'3rem\' }}` + `content-start overflow-hidden`，固定 2 行高度。其他區塊（Stats 1 行 / DateInfo 2 行 / Actions mt-auto）已對齊。**還可能不對齊的情境**：DateInfo 若 flow 只有 createdAt 缺 updatedAt（剛建立未存）會 1 行高，實務罕見；如有需要可再加 min-h-[2rem]。',
      '**動到的檔案（5 個）**：`src/components/FlowEditor/DrawerContent.jsx`（role InsertSlot + 上方按鈕）/ `src/components/FlowEditor/TaskCard.jsx`（role w-24→w-40 / Row 2 spacer 240→300 / ConnectionSection 包 spacer 對齊）/ `src/components/FlowEditor/Header.jsx`（dropdown 三項文字）/ `src/components/Dashboard.jsx`（卡片下載文字 + min-h 對齊）/ `src/components/ContextMenu/index.jsx`（icons 全清）/ `src/components/DiagramRenderer/legend.jsx`（去重複）/ `src/data/changelog/current.js`（本條）。`build` 通過。',
    ],
  },
  {
    date: '2026-04-29',
    title: '業務邏輯：移除流程斷點/迴圈返回入口、加外部互動編輯入口+lane 警告、連續閘道改 _g1/_g2/_g3',
    items: [
      '**緣由**：使用者：「(1) 圖上沒有流程斷點 (2) 編輯器下拉不能選流程斷點/迴圈返回 (3) 編輯器要可新增外部互動，使用灰色底元件，儲存時若放內部角色泳道要跳警告但仍可存 (4) 連續閘道編號 _g1 _g2 _g3，單一才 _g」',
      '**Step 1 — 移除流程斷點 / 迴圈返回入口**：`taskDefs.js` `CONNECTION_TYPES` 9→7（去掉 `breakpoint` / `loop-return`），剩下序列/條件/並行/包容/開始/結束/子流程。`ContextMenu/subforms.jsx` `OtherSubForm` 移除「流程斷點」按鈕（剩開始/結束/外部互動）；`ConvertSubForm` 移除「流程斷點」目標選項。**舊資料的 breakpoint / loop-return 連線型仍可正常 render**（CONN_BADGE / CONN_ROW_BG / 渲染邏輯保留），只是新建入口移除。',
      '**Step 2 — 編輯器加「+ 新增外部互動」按鈕**：`DrawerContent.jsx` 上方原本只有「+ 新增任務（加到最後）」一顆，加並排的「+ 新增外部互動」（紫底 #FAF5FF + 紫框，跟元件圖例一致）。`FlowEditor/index.jsx` 加 `onAddInteraction` callback，呼叫 `actions.addOtherAfter(lastTaskId, \'interaction\')` 沿用既有 ContextMenu 「新增其他」的 interaction kind 邏輯。',
      '**Step 3 — 外部互動 lane 警告**：`validation.js` 加新 warning 3e — 任務 `shapeType === \'interaction\'` 且其 `roleId` 對應的 `role.type === \'internal\'` 時，儲存跳 warning「外部互動任務 X 放在內部角色泳道 Y，建議改放外部角色泳道」（**非 blocking，使用者可選「仍然儲存」**）。',
      '**Step 4 — 連續閘道編號改 `_g1 / _g2 / _g3`（單一仍 `_g`）**：`flowSelectors.computeDisplayLabels` 改採兩階段做法：(a) generation phase 一律輸出 `_g${n}` / `_s${n}`（含下標）；(b) **post-process phase** 統計每個 base 的 gateway / subprocess run length，run = 1 時把 `_g1` / `_s1` 改回 `_g` / `_s`。stored l4Number 為 `_g`（無下標）的舊資料不會被誤改（regex `\\\\d+` 不 match 空字串）。符合 spec §2 (5)/(7)「單一 `_g`、連續 `_g1 _g2 _g3`」官方規則，修正先前 PR #90 實作偏差（先前是 `_g, _g2, _g3`）。',
      '**業務規格 §2 / §4 同步**：§2.1 表格「閘道 L4 連續多個」例子加註「**從 1 開始**」；§4 流程設定型態從 9 種降到 7 種（移除流程斷點 / 迴圈返回兩項，含說明「2026-04-29 移除編輯器選項，舊資料仍可 render」）。`helpPanelData.js`：NUMBERING 迴圈返回條目改成「舊資料兼容」說明；ELEMENTS L4 任務 purpose 移除「迴圈返回」選項；VALIDATION 「迴圈返回必須指定目標」改成「外部互動建議放外部角色泳道」。',
      '**動到的檔案（8 個）**：`src/utils/taskDefs.js`（CONNECTION_TYPES 縮短）/ `src/components/ContextMenu/subforms.jsx`（OtherSubForm + ConvertSubForm 移除 breakpoint）/ `src/components/FlowEditor/DrawerContent.jsx`（新增外部互動按鈕）/ `src/components/FlowEditor/index.jsx`（onAddInteraction wiring）/ `src/model/validation.js`（warning 3e）/ `src/model/flowSelectors.js`（two-phase post-process）/ `docs/business-spec.md` §2.1 + §4 / `src/data/helpPanelData.js`（4 處）/ `src/data/changelog/current.js`（本條）。`build` 通過。',
    ],
  },
  {
    date: '2026-04-29',
    title: '編輯頁優化：FlowTable 橫向 sticky-left / 閘道標籤中文 / Drawer 上方+插入槽 / Role DropLine',
    items: [
      '**緣由**：使用者：「(1) 表格左右捲動時固定 L4 編號 / L4 名稱（顯示 L3 時也固定到 L4 名稱）(2) 編輯器把 XOR/AND/OR 改中文，子流→子流程 (3) 新增任務按鈕移上方 + 滑鼠點兩元件中間顯示線可插入 (4) 泳道角色拖曳要跟任務拖曳一樣顯示插入線」。',
      '**Step 1 — FlowTable 橫向 sticky-left**：`FlowTable.jsx` 加 `getStickyMap(showL3)` helper，動態計算每欄 sticky `left` offset：showL3 off 時 L4 編號 left:0 (110px) / L4 名稱 left:110 (260px)；showL3 on 時 L3 編號 left:0 (100px) / L3 名稱 left:100 (160px) / L4 編號 left:260 (110px) / L4 名稱 left:370 (260px)。ReadCell / EditCell 收 `sticky={ left, width }` prop，用 inline style 套 `position:sticky` + 不透明 bg。thead `<th>` 也對應加 sticky-left；左上角 cell（top + left 雙 sticky）z-index 7 防被其他 sticky 蓋。',
      '**Step 2 — 閘道標籤中文 + 子流程寬度**：`taskDefs.js` `CONN_BADGE` 改成 `排他 / 並行 / 包容`（取代 `XOR / AND / OR`）/ `子流程`（取代 `子流`）/ `迴圈`（取代 `↺`）；`taskOptionLabel` dropdown 三個 case 改 `排他/並行/包容`。`TaskCard.jsx` badge container width `100px → 120px` 容納 `子流程` 三個中文字。',
      '**Step 3 — Drawer 新增任務按鈕移上 + 點擊插入槽**：`DrawerContent.jsx`「+ 新增任務」按鈕從 list 底部 → 移到 list **上方**（命名「新增任務（加到最後）」明示行為）。新增 `InsertSlot` 元件 — 介於每兩 TaskCard 之間 + list 開頭，hover 時顯示藍色淺線 + 「+ 插入任務」按鈕，點擊呼叫 `onAddTaskAt(index)`。`FlowEditor/index.jsx` 加 `onAddTaskAt` callback：`index 0 → addTaskBefore(tasks[0])` / `index N → addTaskAfter(tasks[N-1])` / `index ≥ len → addTask`。已重用既有 actions 不需新加 hook 邏輯。drag 進行時隱藏 InsertSlot 避免跟 DropLine 視覺衝突。',
      '**Step 4 — Role DropLine 一致化**：`DrawerContent.jsx` role 區塊原本用 row 自身 `border-t-2 / border-b-2 border-blue-500` 高亮拖曳目標位置；改成跟 task 一樣用獨立 `<DropLine>` 元件介於 row 之間。`DropLine` 抽到檔案頂端共用（task drag 跟 role drag 都用）。視覺一致性提升。',
      '**動到的檔案（5 個）**：`src/components/FlowTable.jsx`（重寫加 sticky-left）/ `src/utils/taskDefs.js`（CONN_BADGE + taskOptionLabel）/ `src/components/FlowEditor/TaskCard.jsx`（badge width 100→120）/ `src/components/FlowEditor/DrawerContent.jsx`（重寫加 InsertSlot + DropLine 共用 + role DropLine）/ `src/components/FlowEditor/index.jsx`（onAddTaskAt prop wiring）/ `src/data/changelog/current.js`（本條）。`build` 通過。',
    ],
  },
  {
    date: '2026-04-29',
    title: '首頁體驗優化：刪 Excel 格式 banner / 下載按鈕同色去 icon / Actions 推底 / max-w-7xl + 4 欄',
    items: [
      '**緣由**：使用者：「(1) 刪除上方 Excel 上傳格式 / 任務關聯說明標記區塊（規則說明已涵蓋，重複）(2) 卡片下載按鈕去 icon 同色，跟編輯頁文字風格一致 (3) 內容少時 actions 跟著上移留底部空白，希望固定置底 (4) 三欄佈局兩側留白太多，希望拉寬或變四格」。',
      '**Step 1 — 刪 Excel 格式 banner**：移除 `Dashboard.jsx` line 356-375 sky 底色 banner（含 Excel 上傳格式 + 任務關聯說明支援標記列表）。同樣資訊已在「規則說明」HelpPanel 內，不需要重複。',
      '**Step 2 — 下載按鈕統一**：三個下載按鈕（PNG / draw.io / Excel）原本三色混搭（sky-300 / blue-300 / cyan-300）+ `↓` icon。**統一改 `border-blue-300 text-blue-700 hover:bg-blue-50`**（跟「編輯」按鈕同色系），**去 `↓` icon**（純文字 `PNG` / `draw.io` / `Excel`，跟編輯頁 Header 下載 dropdown 風格一致）。',
      '**Step 3 — Actions 固定置底**：卡片 `flex flex-col gap-3` 內容流動，當標題/角色少時，Actions 區塊跟著上移留下方空白。Actions wrapper 加 **`mt-auto`** 推到 flex column 底部。Grid `stretch` (default) 同列卡片等高，加 `mt-auto` 後同列 Actions 對齊在同一水平線上 — 視覺整齊。',
      '**Step 4 — main 寬度 + 4 欄**：`max-w-5xl` (1024px) → **`max-w-7xl`** (1280px)，多 256px 可視寬度（兩側留白減少 ~25%）。Grid 加 **`xl:grid-cols-4`** breakpoint：≥1280px 螢幕 4 欄、1024-1279px 仍 3 欄、640-1023px 2 欄、< 640px 1 欄。1280px+ 螢幕（常見 14" 筆電 1440 / 桌機 1920）會看到 4 卡片 / 列。',
      '**動到的檔案（2 個）**：`src/components/Dashboard.jsx`（4 處：移 banner / actions mt-auto / 3 download buttons 同色去 icon / max-w-5xl→7xl + 4-col grid）/ `src/data/changelog/current.js`（本條）。`build` 通過。',
    ],
  },
  {
    date: '2026-04-29',
    title: '修任務元件文字 lineH 22→32（spec 早已訂的「單行間距」之前沒套用）',
    items: [
      '**緣由**：使用者 PR #98 部署後反饋「任務元件內的文字還是可以擴充為至少單行間距」，截圖示意兩行字之間擠在一起。**根因是 bug**：spec doc §13.3 早已訂「`SvgLabel` lineH = 32（兩行間隙 = 一行字高 = 單行間距）」，但 `shapes.jsx` 兩處 SvgLabel 顯式覆寫成 `lineH={22}` / `lineH={20}`，沒同步到 spec 期望值。',
      '**修法**：`src/components/DiagramRenderer/shapes.jsx` line 84 (subprocess `[子流程]` 下方 task name) lineH `20→32` / line 87 (一般 task) lineH `22→32`。SvgLabel default 已是 32，這兩處改完就一致。',
      '**為何 NODE_H 84 容得下 lineH 32**：SVG `<text>` multi-line 算法是「(n-1) × lineH + 字高」。3 行 lineH 32 = 2×32 + 16 = 80。NODE_H 84 - 80 = 4，上下 padding 各 2。**剛好 fit，spec doc §13.1 設計時就是這個算式**。subprocess + 3 行 task name 是罕見 worst case 會略超（cy+14 偏移 + 3×32 = 96 > 84），實務 task name 多為 1-2 行，可接受。',
      '**為何之前 lineH 22 是錯的**：應該是 PR #87 (NODE_H 60→88) / PR #89 (NODE_H 88→84 / SvgLabel default lineH 30→32) 期間 shapes.jsx 沒同步覆寫值。spec doc §13.3 寫「lineH 32 兩行間隙 16」與 default 32 一致，但 shapes.jsx 本地覆寫蓋掉了。',
      '**結果**：`PR #98 LAYOUT -10%`（NODE_W 156→140 / COL_W 184→164 等）+ `PR #99 lineH 22→32` 組合 = 元件變窄但行距變寬，task name 「擠在一起」感消失。',
      '**動到的檔案（2 個）**：`src/components/DiagramRenderer/shapes.jsx`（兩處 lineH 數字）/ `src/data/changelog/current.js`（本條）。`build` 通過。spec doc §13.3 / §13.1 / §13.5 已早就寫對 lineH 32，不需修。',
    ],
  },
  {
    date: '2026-04-29',
    title: 'LAYOUT -10% 密度調整（字級不動，解使用者「需瀏覽器縮放 80%」訴求）',
    items: [
      '**緣由**：使用者：「電腦上測試要用瀏覽器縮放 80% 比較符合期望的版面比例，但這樣字會太小」。問題本質是「版面密度」vs「字級可讀性」分離訴求 — 瀏覽器縮放等比縮一切沒法挑字不縮。解法是直接改 source 縮 LAYOUT 但字級全部不動。',
      '**LAYOUT 常數 -10%**（除 NODE_H 外）：`TITLE_H` 74→66 / `LANE_HEADER_W` 108→96 / `COL_W` 184→164 / `LANE_H` 152→136 / `NODE_W` 156→140 / `DIAMOND_SIZE` 54→48 / `CIRCLE_R` 32→28 / `PADDING_RIGHT/BOTTOM` 56→48。**`NODE_H` 84 不動** — 字級不變必須保留 3 行字空間（3×lineH 32 + 字高 16 + padding 4 = 84）。',
      '**Wrap maxChars 10→8 連動**：NODE_W 156→140 後，原本 maxChars 10×16px=160px 會 overflow 140px 框。改 8×16=128 ≤ 140，左右各 6px buffer。`shapes.jsx` 兩處（subprocess l3activity / 一般 task）maxChars 改成 8。',
      '**字級 / lineH 完全不動**：`text.jsx` lineH 32 / 三層字級 16/14/13 / Header text-base text-sm / FlowTable text-base 全部保持。確保使用者「不縮放」狀態看到的版面 ≈「縮放 90%」的密度，但字仍是 100% 可讀大小。',
      '**LANE_H buffer 縮減**：原本 LANE_H 152 - MAX_SHAPE_BOTTOM_OFFSET 130 留 22px buffer；現在 LANE_H 136 - MAX_SHAPE_BOTTOM_OFFSET (NODE_VOFFSET 76 + DIAMOND_SIZE 48 = 124) 留 12px buffer，仍夠 (`minLaneH(slots)` 在 routing slot 多時會自動撐高)。',
      '**業務規格 §13.1 / §13.4 / §13.5 同步**：表格數字更新；§13.1 加 -10% 密度調整 設計筆記；§13.4 maxChars 改 8 + 加 8×16=128 ≤ 140 計算說明；§13.5 padding 計算更新。',
      '**動到的檔案（4 個）**：`src/diagram/constants.js`（9 個 LAYOUT 數值）/ `src/components/DiagramRenderer/shapes.jsx`（2 處 maxChars 10→8）/ `docs/business-spec.md`（§13.1 / §13.4 / §13.5 表格 + 設計筆記）/ `src/data/changelog/current.js`（本條）。`build` 通過。',
      '**驗證重點**：部署後不縮放看版面是否密度 OK；字仍是清楚 16px。如果還太鬆可再縮 5-10%（可調回 -15% 或 -20%）。',
    ],
  },
  {
    date: '2026-04-29',
    title: '圖例移到 Header 彈窗 + 下載按鈕去 icon（頁面只剩流程圖 + 表格）',
    items: [
      '**緣由**：使用者：「(1) Header 上的下載按鈕不要有 icon、純文字就好 (2) 把圖例也整合到 Header，點選後彈窗或下拉抽屜顯示，這樣頁面中就只會有流程圖和表格兩個區塊」。',
      '**圖例移到 Header 彈窗**：`DiagramRenderer/legend.jsx` 加 `LegendModal` wrapper（`fixed inset-0 + bg-black/40 backdrop` + 居中 `max-w-2xl max-h-[85vh]` panel + ESC / 背景點擊關閉）。`Header.jsx` 在 actions 區塊**最左邊**加「圖例」按鈕（在「重設所有端點 / 打開編輯器」之前）。`DiagramRenderer/index.jsx` 移除 `<LegendSection />` 渲染 + 移除 import — 流程圖區塊現在純粹只有 SVG，整頁只剩「流程圖」+「任務表格」兩個區塊。',
      '**下載按鈕 icon 整理**：`Header.jsx` 移除「↓」前綴 icon（純粹裝飾）；右側「▾」(U+25BE small triangle 看起來像點) 換成 SVG 倒三角（`<svg width=10 height=6 viewBox="0 0 10 6"><polygon points="0,0 10,0 5,6"/></svg>`），明顯許多且尺寸可控。',
      '**動到的檔案（4 個）**：`src/components/DiagramRenderer/legend.jsx`（+`LegendModal`，含 ESC keyboard handler）/ `src/components/FlowEditor/Header.jsx`（+ legend button + legendOpen state + download icon 改 SVG）/ `src/components/DiagramRenderer/index.jsx`（移除 `<LegendSection />` + 移除 import）/ `src/data/changelog/current.js`（本條）。`build` 通過。',
    ],
  },
  {
    date: '2026-04-29',
    title: 'PR-B：移除 3 個合併連線型 + 自動偵測合併文字（列出 source 編號）',
    items: [
      '**緣由**：使用者 epic 需求 3.3 + 3.4：「閘道後的任務若收 ≥2 個 incoming，「任務關聯說明」自動產生「並行/條件/包容合併 X、Y，序列流向 Z」（列出 source 編號，跟 Excel 匯入格式一致）」+「編輯器選單**移除**並行合併 / 條件合併 / 包容合併三個項目（合併不是元件型，是衍生狀態）」。',
      '**Step 1 — formatConnection 改寫**：(a) `flowSelectors.js` 新增 `getTaskIncomingSources(tasks) → {taskId: [sourceTaskId,...]}` helper；(b) `connectionFormat.js` PHRASE 從 `XOR_MERGE: \'條件合併來自多個分支\'` 改成 `XOR_MERGE_PFX: \'條件合併\'` 配合自動列 source；(c) 加 `inferMergeType` / `buildMergePrefix` helper；(d) **一般 task** 收 ≥2 incoming 也會產合併文字（不再只限 gateway）；(e) gateway 作為 join 時用自身 gatewayType 直接決定合併種類（覆蓋上游推斷）；(f) 一般 task 的合併文字插入到 outgoing 之前：「並行合併 X、Y，序列流向 Z」。',
      '**Step 2 — 移除 3 個合併型**：`taskDefs.js`：CONNECTION_TYPES 從 12 → 9 種（移除 parallel-merge / conditional-merge / inclusive-merge）；CONN_BADGE / CONN_ROW_BG 對應 entry 移除；`taskOptionLabel` 移除三個 case；`applyConnectionType` typeMap / gwMap 簡化（gateway 一律對應 -branch）；`normalizeTask` 對舊資料 gateway 不再產 merge type（一律用 -branch）。',
      '**Step 3 — 舊資料 migration**：`storage.js` 新增 `migrateMergeConnectionType`：載入時把 connectionType in {parallel-merge, conditional-merge, inclusive-merge} 的 task 改成 -branch（gateway）或 sequence（非 gateway）。conditions 結構保留，formatConnection 自動偵測 ≥2 incoming 產出合併文字。',
      '**Step 4 — 連帶清理**：`ConnectionSection.jsx` 移除 merge type 的 UI 區塊（unreachable code，因 migration 後不存在）；`validation.js` 移除 3 個「需要 ≥2 incoming」warning（merge 既然從 incoming 衍生，自然滿足）。`connectionFormat.js` parse 端 RE_AND/XOR/OR_MERGE regex 寬鬆吃新舊兩種格式（新「X合併 5-1-3-3、5-1-3-4，序列流向」+ 舊「X合併來自多個分支，序列流向」）。',
      '**業務規格 §4 重寫**：原 12 種流程設定改成 9 種；新增 §4.1「合併（merge）= 自動偵測，不是流程設定」說明合併類型推斷規則（AND/OR/XOR 看上游 source，混合或一般任務預設條件合併）；§4.2 表格「不是獨立閘道元件」更新合併文字格式（含 source 編號）。`helpPanelData.js`：CONNECTIONS array 三個合併條目合併成一條「合併（merge）= 自動偵測」；VALIDATION 移除「並行合併需 ≥2 來源」/「條件合併需 ≥2 條件分支來源」兩條，改成「合併目標自動偵測」一條。',
      '**未做（範圍調整）**：使用者原描述「flowAnnotation 為空時自動填、非空跳 modal 詢問插入到前面」— 但 trace 後發現 `task.flowAnnotation` 是 stored value（只用於 Excel 匯入），FlowTable 跟 Excel 匯出實際**都用衍生計算 `formatConnection`**（排除 stored value 不顯示）。所以「為空 / 非空」不適用於現有 UI — 衍生欄位每次儲存自動同步，不需要 modal。本 PR 只改衍生計算，不改 stored value 流程。',
      '**動到的檔案（8 個）**：`src/model/flowSelectors.js`（+getTaskIncomingSources）/ `src/model/connectionFormat.js`（PHRASE / formatConnection / regex）/ `src/utils/taskDefs.js`（CONNECTION_TYPES / CONN_BADGE / CONN_ROW_BG / applyConnectionType / normalizeTask / taskOptionLabel）/ `src/utils/storage.js`（+migrateMergeConnectionType）/ `src/components/ConnectionSection.jsx`（移 merge UI）/ `src/model/validation.js`（移 merge warnings）/ `docs/business-spec.md` §4（重寫）/ `src/data/helpPanelData.js`（CONNECTIONS + VALIDATION 同步）/ `src/data/changelog/current.js`（本條）。`build` 通過。',
      '**「整合所有的操作」epic 收尾**：PR-0（拆 ContextMenu）→ PR-A（操作整合 6 個 step）→ **PR-B（合併型移除 + 自動文字）**。三個 PR 完成使用者所有需求 1-5。',
    ],
  },
];

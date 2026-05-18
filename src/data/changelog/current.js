/**
 * Changelog "current tip" — new entries since last freeze land here.
 * When this file grows beyond ~7KB, freeze: rename to c{next}.js + reset to [].
 * Entries are newest-first within file.
 */
export default [
  {
    date: '2026-05-18',
    title: 'Design system PR-1 — Token layer + 品牌色對齊 spec hex',
    items: [
      '**緣由**：使用者提供 `design_handoff_flowsprite` 設計手冊 + tokens.css + components.css。FlowSprite 現況散落寫死 hex（Header `#2A5598` / scrollbar `#7AB5DD` / 編輯器各處）+ 字級用 Tailwind 預設、與 spec 不一致。Audit 後拍板 6 個 PR 漸進對齊（token / Button / Modal+Callout / Chip / 8 種節點分色 / Selected vs hover）。本 PR 是 PR-1 基礎。',
      '**新增**：`src/styles/tokens.css`（~170 行）— 對齊 spec tokens.css、含 FlowSprite 專有 canvas state tokens。涵蓋品牌 3 色 + 角色 2 色 + 語意 4 色（每色含 -soft / -ink 變體）+ 編輯器類型 3 色 + 中性 8 色 + accent / star / highlight + 字型 / 字級 7 階 / 間距 9 階 / 圓角 5 階 / 陰影 2 階 + 行高 3 階 + canvas state（hover-fill / hover-out / hover-in / select / violation）。`.t-display` 等 typography utility classes 同時定義。',
      '**修改 tailwind.config.js**：`theme.extend.colors` 加入 36 個 token reference（`brand` / `brand-dark` / `internal` / `warning` / `paper` / `ink-soft` 等）。改 hex 一律改 `tokens.css` 不改這裡；這裡只是 Tailwind utility class（如 `bg-brand`）的對應層。',
      '**修改 index.css**：頂部 `@import "./styles/tokens.css"`、body / scrollbar / SVG font 全部改用 `var(--*)`。body bg 從寫死 `#F5F8FC` → `var(--paper)`（hex 巧合相同、視覺無變化），scrollbar thumb `#7AB5DD` → `var(--brand-light)`（**視覺變化**：`#5EC7E8` 更亮 sky）/ track `#E8F1F9` → `var(--brand-light-soft)` (`#E0F4FB`) / hover `#3470B5` → `var(--brand)` (`#006EBC`)。',
      '**修改 Header.jsx**：`background: "#2A5598"` → `background: "var(--brand-dark)"`。**這是本 PR 視覺上最明顯的改動** — Header 從現況的中藍 (#2A5598) 變成 spec 的深 navy (#1B2E4C)。Header text 仍白、可讀性更高。',
      '**Backlog cleanup**：刪除 `.claude/backlog.md` 條目 #2「Phase C grid-based path-finder」（使用者：「可刪除」）。Phase A + B 已 ship（PR #196）足以應付實務、Phase C 多月工作 / 高回歸風險、無業務需求。其餘 backlog #3 / #4 升格為 #2 / #3。',
      '**動到的檔案（5 個 + 2 新檔）**：`src/styles/tokens.css`（新）/ `tailwind.config.js`（theme.extend.colors）/ `src/index.css`（import + 換 var）/ `src/components/FlowEditor/Header.jsx`（bg 換 var）/ `.claude/backlog.md`（刪 Phase C）/ `src/data/changelog/current.js`（本條）。',
      '**驗證**：`npm run build` 通過、bundle CSS 從 ~34KB → 37.6KB（增 token 定義屬正常）。手動驗證點：(a) Header 視覺從中藍變深 navy ✓ (b) scrollbar 從中淺藍變亮 sky ✓ (c) 流程圖 / FlowTable / Dashboard 卡片配色不變（COLORS 維持 hex literal、後續 PR 配套對齊）(d) 編輯 textarea / input 字級暫保持現況 — 後續 PR-2/3 抽元件時統一。',
      '**設計取捨**：`src/diagram/constants.js COLORS` **保留 hex literal 不換 var**。原因：SVG `fill` / `stroke` attribute 不認 `var(--*)`（CSS variables 只在 CSS context 生效、不能塞給 SVG attribute）。tokens.css 內已加註解標明「SVG 用 hex mirror、改 token 同步改 mirror」。`COLORS.INTERNAL_BG/EXTERNAL_BG` 已 plain `#0066CC/#009900` 與 spec 一致、無需動。',
      '**接下來**：PR-2 Button 元件化 → PR-3 Modal + Callout → PR-4 Chip → PR-5 TaskCard 8 種節點分色 → PR-6 Canvas Selected 區分 hover。',
    ],
  },
  {
    date: '2026-05-18',
    title: '中英混排自動間距（display-only）— 流程圖 / FlowTable / Dashboard 統一插空格',
    items: [
      '**緣由**：使用者「我在 Excel 中輸入正常的文字後、你讓使用者在頁面上可以看到有調整過間距的舒服閱讀版、特別是流程圖上、流程圖元件內的文字、線段上的文字是必要的」。',
      '**設計**：display-only 處理、不動 raw data（Excel / drawio / localStorage 一律保持原文）。helper `autoSpace(text)` 在 CJK ↔ ASCII 英數字相鄰處插入半形空格（2 條 regex：CJK→英數 / 英數→CJK），已有空格不重複插入。**不引入 pangu lib**（FlowSprite 只需 2 條 rule、+10KB bundle 不划算）。',
      '**核心改動**：(a) 新增 `src/utils/autoSpace.js` helper（~50 行含 JSDoc） + `src/utils/autoSpace.test.js`（14 個 unit tests，用 Node 18+ 內建 `node:test`、零 dep）。(b) `src/components/DiagramRenderer/text.jsx` `wrapText` 在現有「Latin↔Latin join space」邏輯加入「CJK→Latin」/「Latin→CJK」分支 — 整合到 token 拼接、不被 tokenize regex 吃掉。SvgLabel / EventLabel / arrows.jsx ConnectionArrow label / StickyHeader 角色名稱都自動受益（這些都走 wrapText）。(c) `src/components/FlowTable.jsx` ReadCell value 套 `autoSpace`（覆蓋任務名稱 / 任務關聯說明等 read-only 欄位）。(d) `src/components/Dashboard/FlowCard.jsx` `l3Name` 標題 + role chips 套 `autoSpace`。(e) `src/components/DiagramRenderer/index.jsx` 流程圖頂部標題 `l3Name` 套 `autoSpace`。',
      '**不套用的地方**（避免游標跳動 / 維持資料完整性）：所有 `<input>` / `<textarea>`（TaskCard / FlowTable EditCell / ContextMenu / Wizard / Header / Drawer L3 inputs）、L4Number pill（純 ASCII 結構字串）、Excel 匯出（raw）、drawio 匯出（raw、由 draw.io 自行渲染）、localStorage 儲存（raw、與 Excel 一致、搜尋 / 比對不受影響）。',
      '**結構性字串安全**：`1-1-1-1_g` 等 L4 編號為純 ASCII、autoSpace 無變化；`[排他閘道] 確認需求` 已有空格、無變化；`序列流向 5-1-1-2` 自動生成已含空格、無變化；`[排他閘道]確認` `]` 非英數字、不觸發。',
      '**動到的檔案（5 個 + 2 新檔）**：`src/utils/autoSpace.js`（新）/ `src/utils/autoSpace.test.js`（新）/ `src/components/DiagramRenderer/text.jsx` / `src/components/DiagramRenderer/index.jsx` / `src/components/FlowTable.jsx` / `src/components/Dashboard/FlowCard.jsx` / `src/data/changelog/current.js`。',
      '**驗證**：(a) `npm run build` 通過 (b) `node --test src/utils/autoSpace.test.js` → 14/14 pass，涵蓋純中文 / 純英文 / 中英邊界 / 已有空格 idempotency / L4 編號不動 / falsy / 非 string / bracket prefix 等情境 (c) 手動：開啟有 `確認GitHub` 類任務名稱的流程 → 流程圖顯示「確認 GitHub」、編輯器 input 維持 raw「確認GitHub」。',
    ],
  },
  {
    date: '2026-05-13',
    title: '匯入提醒拆成「已自動調整」+「建議檢視」兩段顯示 — Dashboard + FlowEditor 兩 banner 共用',
    items: [
      '**緣由**：使用者「現在匯入提醒中、會把有修改的和提醒事項都綜合再一起計算 — 例如顯示『匯入時自動調整了 22 筆內容』但實際上只有其中 4 筆有修改、其他都是沒改動的提醒」。要求兩種訊息視覺區別、計數分開。',
      '**選項討論**（拍 1 不拍 2）：1. 拆兩個 array（schema 改 + migration、長期顯式好維護）2. 用 pattern 分類（不動 schema、helper 分類、改動小但 fragile）。使用者選「一次改對」=> 選項 1。',
      '**Schema 改動**：`flow.importWarnings` (legacy 單一 array) → `flow.importFixes` + `flow.importNotices` 兩個 array。fixes = 系統實際改過的（已自動補子流程 / 已自動調整 L4 編號 / 🔧 結束事件 _x 自動更新）、notices = 純提醒（merge incoming 不足 / validation / cross-row / 閘道鏈 / ❌ blocking）。',
      '**Producer 改動**：(a) `src/utils/excelImport/index.js` — 每個 flow 初始化兩個 array、autoSubWarnings + normalizeWarnings 推進 importFixes、mergeWarnings + validation + cross-row 推進 importNotices。Return value `{ warnings: [...] }` → `{ fixes, notices }`。(b) `src/utils/storage.js loadFlows` — 🔧 結束事件訊息推進 importFixes。',
      '**Consumer 改動**：(a) `src/components/FlowEditor/index.jsx` banner 拆兩個 section、標題「系統已自動調整 X 筆內容；另有 Y 筆建議檢視（未自動處理）」、各區塊各自 max-h-48 overflow scroll、dismiss 一鍵清空兩 array。(b) `src/components/Dashboard/Banners.jsx ImportWarningsBanner` 同樣兩 section、notices 維持原 20 筆 collapse + 展開 + 複製全部行為（fixes 通常數量少不 collapse）。(c) `src/components/Dashboard/index.jsx` state 從 `importWarnings` 拆成 `importFixes` + `importNotices`。',
      '**Migration（backward compat）**：`src/utils/storage/migrations.js` 新增 `migrateImportWarningsToFixes(flow)` — 舊版單一 importWarnings array 由 `loadFlows` 一次性拆成兩 array、寫回 localStorage、舊欄位 strip。Heuristic：「已自動補上」/「已自動調整」 headline 後續 detail lines 跟著進 fix；「🔧」單行進 fix；其他（`❌` / `[L3 ...]` / `第 N 列` / `任務 X 未連接` 等）進 notice。Idempotent — 已拆過的 flow 不重做。',
      '**動到的檔案（7 個）**：`src/utils/excelImport/index.js`（producer 拆兩 bucket + return shape）/ `src/utils/storage.js`（loadFlows 🔧 → importFixes、migrate flow shape、cloneFlow reset 兩 array）/ `src/utils/storage/migrations.js`（新增 migrateImportWarningsToFixes）/ `src/components/FlowEditor/index.jsx`（banner 拆兩 section + dismiss 清兩 array）/ `src/components/Dashboard/Banners.jsx`（ImportWarningsBanner 接 fixes/notices props）/ `src/components/Dashboard/index.jsx`（state 拆 + finalizeImport signature）/ `src/data/changelog/current.js`（本條）。',
      '**驗證**：`npm run build` 通過。手動驗證點：(a) 上傳 4 fix + 18 notice Excel → Dashboard banner 顯示「已自動調整 4 / 建議檢視 18」(b) 進編輯器 → FlowEditor banner 同樣兩段 (c) 按 ✕ → 兩段都消失 (d) localStorage 有舊版單一 importWarnings 的 flow → 載入後自動拆兩 array、舊欄位被砍 (e) cloneFlow 複製出來的新 flow 兩個 array 都空 ✓。',
    ],
  },
  {
    date: '2026-05-13',
    title: 'fix: 多 end 事件 (`-99_x{K}`) 在 Excel 匯入 + 載入 migration 被誤判為 task',
    items: [
      '**緣由**：使用者「上傳兩個結束事件的資料時，結束事件被自動改成了任務」+ 要求全面 audit 上傳 / 圖面 / 表單 / 編輯器 / 儲存五個路徑與 PR #210 多 end `-99_x{K}` 規則一致性。',
      '**Root cause**：PR #210（2026-05-13）加多 end `_x{K}` 後綴規則時、漏修 3 個用 bare `/-99$/` 偵測結束事件的地方 — 該 regex 不接 `_x` 變體 → 多 end 元件分類錯誤。',
      '**Audit 完整結果**：審計 12 處 -99 / 結束事件偵測，**只 3 處有 bug**、其他 9 處都已用 `L4_END_PATTERN`（taskDefs.js SOT、含 `_x`）或 `type === "end"`（pure type-based、不關 pattern）。一旦 type 在 import 端設對、所有下游（validation / ContextMenu / TaskCard / DrawerContent / FlowTable / drawio / PNG export）自動正確。',
      '**修法（3 行 + 註解）**：(a) `src/utils/excelImport/detectors.js detectKindFromL4` line 42 `/-99$/` → `/-99(_x\\d+)?$/` — **主因**、Excel 匯入多 end 從 task 修回 end (b) `src/utils/storage/migrations.js migrateTypeFromL4Suffix` line 316 同樣修改 — 載入時 backfill 舊資料中被誤類為 task 的多 end (c) `src/utils/excelImport/warnings.js` line 42 isEndL4 同樣修改 — 多 end 名稱沒寫「結束事件」時也跳「建議補前綴」warning。三處統一加 inline 註解標示 PR #210 規則來源。',
      '**動到的檔案（4 個）**：`src/utils/excelImport/detectors.js` / `src/utils/storage/migrations.js` / `src/utils/excelImport/warnings.js` / `src/data/changelog/current.js`。',
      '**驗證**：`npm run build` 通過。手動驗證點：(a) Excel 2 個 end (`-99_x1` + `-99_x2`) 匯入 → type=end ✓（修前 type=task）(b) 1 個 end (`-99`) 匯入 → 行為不變 (c) localStorage 有舊資料 type=task + l4=`-99_x1` → 載入後 type=end ✓ (d) 多 end Excel 名稱沒寫「結束事件」→ 跳 warning ✓。',
    ],
  },
  {
    date: '2026-05-13',
    title: 'fix: 「← 返回」refresh App.flows — 修 dismiss 過的 import warning 重複出現',
    items: [
      '**緣由**：使用者「我發現這個提示資訊每次點開編輯畫面都會出現」— `🔧 結束事件編號已自動更新（多結束事件對齊 BPMN 規則）：5-1-5-99 → 1-1-2-99` 即使按 ✕ dismiss 後、重新進編輯器又出現。',
      '**Root cause**：`src/App.jsx handleCancel` 沒呼叫 `refreshFlows()`。`useState(() => loadFlows())` 只在 App mount 時跑一次、之後 App.flows state 變 stale snapshot。FlowEditor 內部 `handleDismissImportWarnings` 直接呼叫 `saveFlow` 寫進 localStorage、但**沒通知 App refresh**。結果：localStorage 已乾淨（importWarnings: []）但 App.flows[i].importWarnings 仍是 mount 時的舊值。點「返回」→ 重新進編輯器 → `activeFlow = flows.find(...)` 拿 stale snapshot → liveFlow init 仍含舊 warning → banner 又顯示。',
      '**為什麼診斷時看不到**：reload 整個分頁 / F5 → App 重新 mount → `loadFlows` 重跑 → 拿乾淨資料 → banner 不顯示。只有「在 SPA 內進出 FlowEditor 不 reload」這個 case 中招。',
      '**修法**：`handleCancel` 加一行 `refreshFlows()`。這同時治理 stale snapshot 的通用問題 — FlowEditor 內任何不走 onSave 的 saveFlow 都會在返回時自動同步（dismiss / connection override 持久化 / 未來新增的內部 saveFlow 等）。',
      '**動到的檔案（2 個）**：`src/App.jsx`（handleCancel 加 refreshFlows + 4 行註解）/ `src/data/changelog/current.js`（本條）。',
      '**驗證**：`npm run build` 通過。手動驗證：(a) 開有 import warning 的流程 → banner 顯示 (b) 按 ✕ dismiss → banner 消失 (c) 點「← 返回」回 Dashboard (d) 重新點進同個流程 → banner **不再出現** ✓。F5 reload 行為不變。',
      '**未做的優化（D 預防性）**：使用者改 L3 編號時自動 regenerate end 任務的 l4Number、避免事後 warning 一開始就產生。延後到使用者實測 A 後再決定是否需要。',
    ],
  },
  {
    date: '2026-05-13',
    title: 'fix: overwrite 匯入保留原始 createdAt — 只更新 updatedAt',
    items: [
      '**緣由**：使用者「上傳一個已經有該 L3 的新流程、覆蓋的話產出日期和編輯日期會是新的還是舊的？」追蹤後發現：overwrite 模式下、舊 flow 整筆 `deleteFlow`、匯入的 flow 帶新 id 進 `saveFlow` → 走 `else` branch → `createdAt: now`。**原本的建立日期完全遺失**、Dashboard 卡片「建立：YYYY/MM/DD」會被洗成上傳日期。',
      '**修法（2 個檔案）**：(a) `src/App.jsx handleImportExcel` overwrite 模式 — 在 `deleteFlow` 前先用 `Map(l3Number → createdAt)` 捕獲舊 createdAt、匯入時 inject 回 flow 物件。(b) `src/utils/storage.js saveFlow` else branch — 從 `createdAt: now` 改成 `createdAt: flow.createdAt || now`、尊重 caller 帶的值，真正新建才用 now。',
      '**結果**：overwrite 匯入後 `createdAt = 舊值`、`updatedAt = now`（這次上傳時間）。Dashboard 卡片「建立日期」反映 L3 真實建立時間、不再被沖掉。keep 模式不受影響（不刪舊 flow，邏輯零變動）。',
      '**動到的檔案（3 個）**：`src/App.jsx`（handleImportExcel +10 行 createdAt 保留）/ `src/utils/storage.js`（saveFlow 一行 + 註解）/ `src/data/changelog/current.js`（本條）。',
      '**驗證**：`npm run build` 通過。手動驗證：(a) 已存在 5-1-1 createdAt=2026-04-01 → 重新匯入 overwrite → createdAt 仍 2026-04-01、updatedAt 變 now (b) 全新 L3 匯入 → createdAt + updatedAt 都是 now（行為不變）(c) keep 模式匯入 → 舊 flow 不動、新 flow createdAt + updatedAt 都是 now（行為不變）。',
    ],
  },
  {
    date: '2026-05-13',
    title: 'hover 箭頭恢復原尺寸（8×6）— 預設 / 違規 / dashed 仍維持 PR #213 的 12×9',
    items: [
      '**緣由**：使用者「hover 過的箭頭不要跟著變大、維持原本就好」。PR #213 把 6 個 marker 全部 +50% 後、hover 連線（藍色）的箭頭跟著放大，但 hover state 的線 stroke 本來就從 1.4 加粗到 2.5 — 線粗 + marker 大兩個一起、整體變得過於厚重。',
      '**修法**：`src/components/DiagramRenderer/arrows.jsx` 只把 3 個 hover 變體（`ah-hover` / `ah-hover-out` / `ah-hover-in`）revert 回原本 8×6 / refX=8 / refY=3。保留：`ah`（預設）/ `ah-dashed`（虛線）/ `ah-violation`（紅色違規）仍是 +50% 後的 12×9 — 這 3 個是「靜態」狀態、加大提升辨識度有意義。hover 是「臨時」狀態、保持精緻。',
      '**動到的檔案（2 個）**：`src/components/DiagramRenderer/arrows.jsx`（3 個 hover marker 尺寸 + 註解更新）/ `src/data/changelog/current.js`（本條）。',
      '**驗證**：`npm run build` 通過。手動驗證點：(a) 沒 hover 時箭頭是大的（12×9 = PR #213 效果）(b) hover 連線時箭頭變藍 + 線變粗、但箭頭尺寸回到原本 8×6（不再放大）(c) hover 任務看「進」「出」雙色箭頭：兩個都是 8×6 (d) 違規紅線箭頭仍 12×9（突出顯示）。',
    ],
  },
  {
    date: '2026-05-13',
    title: '流程圖箭頭尖端 +50% — 提升與 L4 編號 pill 重疊時的辨識度（試 Option A）',
    items: [
      '**緣由**：使用者「箭頭的前端三角形位置跟編號重疊，還是會看不清楚」。根因：`TasksLayer` 在 `ConnectionArrow` 之後渲染（index.jsx line 319 → 328），L4 number pill (opacity 0.6 白底) 蓋在箭頭尖端上方、tip 被淡化 60% 看不清。',
      '**討論的 4 個方案**：(A) 放大 marker +50% (B) 降 pill opacity 0.6→0.4 (C) A+B 複合 (D) 拆 ArrowTipsLayer 到 TasksLayer 之後渲染。使用者選擇先試 A、最小改動可逆。',
      '**修法**：`src/components/DiagramRenderer/arrows.jsx` 6 個 marker 同比例放大：`markerWidth 8→12` / `markerHeight 6→9` / `refX 8→12` / `refY 3→4.5` / polygon points `"0 0, 8 3, 0 6"` → `"0 0, 12 4.5, 0 9"`。所有變體（ah / ah-hover / ah-hover-out / ah-hover-in / ah-dashed / ah-violation）統一放大維持 hover / violation 切色一致性。refX 同比例縮放確保 apex 仍對齊連線端點。',
      '**動到的檔案（2 個）**：`src/components/DiagramRenderer/arrows.jsx`（6 個 marker、加 3 行歷史註解）/ `src/data/changelog/current.js`（本條）。',
      '**驗證**：`npm run build` 通過。手動驗證點：(a) 一般連線箭頭尖端比原本明顯（佔 12×9 像素 vs 8×6）(b) hover 連線時藍色箭頭也跟著大 (c) 違規紅線箭頭也跟著大 (d) PNG / drawio 匯出仍正常 (e) 跟 L4 pill 重疊時辨識度提升、若仍不夠下一輪可考慮 D（ArrowTipsLayer 分層）。',
    ],
  },
  {
    date: '2026-05-13',
    title: '移除多 start / 多 end 儲存警告 — 合法 BPMN 拓樸不該每次跳 modal',
    items: [
      '**緣由**：使用者「上傳及儲存時，有多個開始事件不跳提醒（現在會提示）」+「有多個結束事件不跳提醒（現在會提示）」。原 rule 7 / 8（2026-04-29 加）跳的「BPMN 一般建議單一起點，建議確認是否刻意設計多個入口」/「多個終點可接受（不同情境收尾），建議確認」每次儲存都打斷流程。',
      '**研究結論**：審計 38 條規則後確認 — (a) 多 start / end 是合法 BPMN 拓樸（PR #210 剛加的 `_x{K}` 後綴就是為多 end 而設）(b) 移除這兩條 warning 不影響「必須要有 start / end」「start 不能有 incoming」「end 必須有 incoming」等 6 條 blocking 規則。',
      '**修法**：(1) 刪 `src/model/validation.js` 第 80-88 行（9 行 multi-start / multi-end warnings block）+ 留 4 行註解說明歷史 (2) 刪 `src/data/helpPanelData.js` 第 250-258 行對應規則描述條目。「上傳路徑」沒有直接觸發這兩條警告 — 但使用者匯入單一 L3 後自動進 FlowEditor、習慣性點儲存就會中 → 移除後同步消失。',
      '**動到的檔案（3 個）**：`src/model/validation.js`（移除 9 行 + 加 4 行歷史註解）/ `src/data/helpPanelData.js`（移除 1 個規則條目）/ `src/data/changelog/current.js`（本條）。docs/business-spec.md 沒提到這兩條 warning、不用改。',
      '**驗證**：`npm run build` 通過。手動驗證點：(a) 建有 2 個 start 的流程、儲存 → 不再跳 warning modal、直接存 (b) 建有 2 個 end 的流程、儲存 → 同上 (c) 沒有 start 的流程仍 block 儲存（rule 1）(d) start 被連入仍 block 儲存（rule 4） — blocking 規則完整保留。',
    ],
  },
  {
    date: '2026-05-12',
    title: 'fix: 開始事件連線兩端點都拉不動 — phase3e 漏處理 start',
    items: [
      '**緣由**：使用者「我發現連到開始事件元件的線段不能自主拖曳選擇要連線的出發端點，及連過去其他元件的結束端點」。從 start 出發的連線、任一端點拖了沒效。',
      '**Root cause**：`src/diagram/layout/phase3e.js` line 46 排除 start：`else if (task.type !== "end" && task.type !== "start")`。phase3e 是把 `task.connectionOverrides` apply 到 routing map 的階段。`useDragEndpoint` → `updateConnectionOverride` 把 override **儲存** 到 `startTask.connectionOverrides[nextTaskId]` 是 OK 的、但下次 render `runPhase3e` 跳過 start → routing map 沒拿到 override → 視覺上仍是預設 `right` / `left`。',
      '**兩個端點同 bug**：source 端拖（exitSide on start）和 target 端拖（entrySide on next-task）都被同一個 gate 擋 — 因為 override 都存在 `start.connectionOverrides`（fromId = start.id）。',
      '**修法**：拿掉 `&& task.type !== "start"`，讓 start 走跟一般 task / l3activity / interaction 同一個 override apply 路徑（一行 + 三行註解）。`end` 排除保留 — end 沒有 outgoing → 永遠不會有 override，是 defensive dead code。',
      '**動到的檔案（2 個）**：`src/diagram/layout/phase3e.js`（一行 + 註解）/ `src/data/changelog/current.js`（本條）。',
      '**驗證**：`npm run build` 通過。手動驗證點：(a) 點「start → 5-1-1-1」連線、看到兩端點 (b) 拖 source 端從 right → bottom、連線從 start 底部出 (c) 拖 target 端從 left → top、連線進 next task 頂部 (d) 「重設此連線端點」清掉 override。',
    ],
  },
  {
    date: '2026-05-13',
    title: 'feat: 多結束事件編號用 `_x{K}` 後綴 — 拉齊外部 BPMN 連線 / Excel 公式規則',
    items: [
      '**緣由**：使用者比對 (1) BPMN 連線編號規範 (2) Excel 公式 (`LET(...xSuffix, IF(xTotal<=1,"","-99_x"&xCount)...)`) (3) FlowSprite 三方規則，發現 FlowSprite 缺「多結束事件 `_x` 後綴」邏輯：原本 `computeDisplayLabels` 多 end 全部 label 成 `-99`、撞 sortKey、視覺/編輯器/匯出都無法分辨。',
      '**情境決策**（使用者拍板 7 題）：(1) 多 end 用 `-99_x1` / `-99_x2`（不用字母）(2) 單一 end 保持 `-99`（不加 `_x1`，與 `_g`/`_s`/`_e` 單一不加數字慣例對齊）(3) `end` 與 `breakpoint` 合併計數器（同 `validation.isEnd` 既有定義）(4) `_x` 順序依 task list reduce 順序（與 `gwConsec`/`spConsec` 一致）(5) 流程圖完全隱藏（同 `-99`、`-0`、`_g*`、`_s*`、`_e*` 規則）(6) 舊資料缺 `_x` 或跳號自動補正 + Dashboard banner 提示一次 (7) 多開始事件保持全 `-0`（規則 1 §1 明文，不對稱但拉齊外部）。',
      '**核心改動**：(a) `src/utils/taskDefs.js` — `L4_END_PATTERN` 接受 `_x\\d+`、新增 `L4_END_X_PATTERN`、`L4_NUMBER_PATTERN` 加分支容納 `-99_x*` (b) `src/model/flowSelectors.js` — `computeDisplayLabels` pre-scan endTotal + 新增 `endConsec` 計數器，end 編號 position-derived 不 honor stored l4Number (c) `src/diagram/layout/columnAssign.js` — `parseL4SortKey` 接受 `x`、sortKey `99 + 0.001×K` (d) `src/components/DiagramRenderer/TasksLayer.jsx` — hide regex 加 `-99(_x\\d+)?` (e) `src/utils/excelImport/validators.js` — l4TaskSet 排除 `_x`（避免 `_g`/`_s`/`_e` 把 end 當 anchor）、錯誤訊息 + 規則說明加多 end 範例。',
      '**舊資料 migration**：新增 `migrateEndSuffix(tasks, l3Number)` in `src/utils/storage/migrations.js`，三類情況自動補正：(a) 舊 multi-end 全在 `-99` → 寫成 `_x1`/`_x2` (b) `_x` 跳號（`_x3` 但只 2 個）→ renumber 連續 (c) 單 end 但 stored `-99_x1` → 退回 `-99`。`storage.migrateFlow` 把 fixes 暫存在 `_endMigrationFixes`、`loadFlows` 轉成 `importWarnings` 條目「🔧 結束事件編號已自動更新（多結束事件對齊 BPMN 規則）：A → B」並 saveFlow 持久化 — 用戶看見 banner 一次，下次重新整理就消失。',
      '**規格同步**：`docs/business-spec.md` §2.1 加結束事件多個 row + 範例、§2.6 補 `migrateEndSuffix` 條目、§2.7 SOT 數量從 6 升到 7 個 regex 常數、§3 SOT 規則加 `-99_x\\d+` 推導、§6 顯示分層加完整後綴列表。`src/data/helpPanelData.js` NUMBERING_FORMAT 加「結束事件（多個）」條目（單一保留）、ELEMENTS 結束事件 purpose 補多 end 範例。',
      '**配套凍結**：current.js 在 PR 前已 17.5KB（超 §4 「>7KB 就凍結」門檻），本 PR 把 PR 前的所有條目搬到新 `c28.js`、current.js 重置只含本條，`index.js` 補 c28 import。',
      '**動到的檔案（8 個 src + 2 個 docs + changelog freeze）**：`src/utils/taskDefs.js` / `src/model/flowSelectors.js` / `src/diagram/layout/columnAssign.js` / `src/utils/storage.js` / `src/utils/storage/migrations.js` / `src/components/DiagramRenderer/TasksLayer.jsx` / `src/utils/excelImport/validators.js` / `src/data/helpPanelData.js` / `docs/business-spec.md` / `CLAUDE.md` §3 / `src/data/changelog/{current,c28,index}.js`（本條 + 凍結）。',
      '**驗證點**：(a) 單 end 流程仍顯示 `-99`、舊圖無感 (b) 兩 end 圖載入後 Dashboard banner 提示「結束事件編號已自動更新：-99 → -99_x1、-99 → -99_x2」(c) Excel 含 `1-1-1-99_x1`/`_x2` 匯入不被擋 (d) sortKey `99.001 < 99.002`，FlowTable / 流程圖排序穩定 (e) 流程圖兩個結束圓都不顯示編號（hide regex 命中）但編輯器 + 表格顯示完整 `_x1` / `_x2`。',
    ],
  },
];

/**
 * Changelog "current tip" — new entries since last freeze land here.
 * When this file grows beyond ~7KB, freeze: rename to c{next}.js + reset to [].
 * Entries are newest-first within file.
 */
export default [
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

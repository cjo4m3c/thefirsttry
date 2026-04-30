# FlowSprite

BPM 業務活動泳道圖設計工具（純前端 React SPA）。

---

## 本地建置

### 環境需求

| 項目 | 版本 |
|---|---|
| Node.js | 22（部署 workflow 也鎖在 22）|
| npm | 10+（Node 22 內建）|
| 作業系統 | 任意（macOS / Linux / Windows）|
| 瀏覽器（執行時）| 任何支援 ES2020 + `crypto.randomUUID` 的現代瀏覽器 |

### Runtime 套件（`dependencies`）

| 套件 | 版本 | 用途 |
|---|---|---|
| `react` | ^18.3.1 | UI framework |
| `react-dom` | ^18.3.1 | React DOM renderer |
| `xlsx` | ^0.18.5 | Excel (.xlsx) 讀寫 |
| `html-to-image` | ^1.11.11 | 泳道圖匯出 PNG |

### 開發套件（`devDependencies`）

| 套件 | 版本 | 用途 |
|---|---|---|
| `vite` | ^5.4.10 | Dev server + build |
| `@vitejs/plugin-react` | ^4.3.1 | Vite React 支援 |
| `tailwindcss` | ^3.4.14 | Utility-first CSS |
| `postcss` | ^8.4.47 | CSS 處理 pipeline |
| `autoprefixer` | ^10.4.20 | CSS vendor prefix |

### 安裝步驟

```bash
# 1. Clone
git clone https://github.com/cjo4m3c/FlowSprite.git
cd FlowSprite

# 2. 安裝套件（會同時裝 runtime + dev deps）
npm install

# 3. 啟動本地 dev server（預設 http://localhost:5173/FlowSprite/）
npm run dev

# 4. 產生 production build（輸出到 dist/）
npm run build

# 5. 預覽 production build
npm run preview
```

`npm run dev` 啟動後改原始碼會自動熱更新；`npm run build` 會跑 Vite build + Tailwind 產生最終靜態檔。

---

## 專案架構

```
FlowSprite/
├── README.md                      ← 本檔案
├── HANDOVER.md                    ← 完整交接手冊（環境、業務規則、交接情境）
├── CLAUDE.md                      ← 長期規則 / AI 工作 SOP
├── package.json                   ← deps + scripts
├── package-lock.json              ← 鎖版
├── vite.config.js                 ← Vite 設定（含 base = '/FlowSprite/'）
├── tailwind.config.js             ← Tailwind 設定
├── postcss.config.js              ← PostCSS 設定
├── index.html                     ← SPA entry HTML
├── .github/
│   └── workflows/
│       └── deploy.yml             ← push main 自動部署到 GitHub Pages
├── docs/
│   └── business-spec.md           ← 業務規則單一來源（13 章；HelpPanel / changelog 都對齊這份）
├── .claude/
│   ├── business-rules.md          ← Claude 工作流慣例
│   ├── backlog.md                 ← 跨 session 待辦
│   ├── orphans.md                 ← 已刪檔案清單
│   └── skills/                    ← AI 重用流程（/<skill-name> 觸發）
│       ├── ship-feature.md        ← PR 前檢查清單 + squash merge + 回報
│       ├── sync-main.md           ← 使用者合併後本地同步 + 清 branch
│       ├── sync-views.md          ← 七視圖一致性 walk + size check
│       ├── doc-audit.md           ← Changelog / HelpPanel / README / HANDOVER 對齊性檢查
│       ├── trace-layout.md        ← 流程圖路由 node trace 樣板
│       ├── ui-rules.md            ← 藍色主題色票、按鈕 / banner / modal pattern
│       ├── paste-bundle.md        ← 大檔（>15KB）走 GitHub 網頁手工貼上的 SOP
│       ├── preview-branch.md      ← 開預覽分支（VITE_BASE_PATH 子路徑）
│       └── wrap-pr.md             ← PR 收尾 / 描述模板
├── public/                        ← 靜態資源（logo 等）
└── src/
    ├── main.jsx                   ← React entry point
    ├── App.jsx                    ← 頂層路由：Dashboard / Wizard / FlowEditor
    ├── index.css                  ← Tailwind directives + logo 動畫 + 捲軸樣式
    ├── components/
    │   ├── Dashboard.jsx          ← 首頁：L3 清單、Excel 上傳、批量操作
    │   ├── Wizard.jsx             ← 新增 L3 的 2 步驟精靈（L3 資訊 → 角色 → 進入 FlowEditor）
    │   ├── FlowEditor/            ← 編輯 L3 主控（PR-3 拆 7 檔；index + Header / DrawerContent / TaskCard / SaveModals / useFlowActions / validateFlow）
    │   ├── FlowTable.jsx          ← L4 任務明細表（流程圖下方常駐顯示）
    │   ├── DiagramRenderer/       ← SVG 泳道圖 + PNG / Draw.io 匯出 + hover tooltip + onTaskClick（PR-2 拆 10+ 檔）
    │   ├── RightDrawer.jsx        ← 右側滑出面板（hosts 設定流程 + 設定泳道角色 tabs）
    │   ├── ContextMenu/           ← 點任務元件彈出的編輯選單（PR-0 拆 2 檔；index + subforms）
    │   ├── ConnectionSection.jsx  ← 任務卡片內的連線設定 UI
    │   ├── BackToTop.jsx          ← 右下角浮動回到頂端按鈕
    │   ├── reorderButtons.jsx     ← `ReorderButtons` ▲ ▼ 排序按鈕 + `moveItem` 純函式（2026-04-30 取代 HTML5 drag）
    │   ├── HelpPanel.jsx          ← 規則說明 Modal（data 來自 helpPanelData.js）
    │   └── ChangelogPanel.jsx     ← 版本更新紀錄 Modal（讀 src/data/changelog/index.js）
    ├── data/
    │   ├── helpPanelData.js       ← HelpPanel 規則摘要 data，每個 array 對應 docs/business-spec.md 章節
    │   └── changelog/             ← current.js（tip）+ c01.js…c21.js（凍結）+ index.js 串接
    ├── model/                     ← 純函式共用層（Phase 2 抽出）
    │   ├── connectionFormat.js    ← task ↔ 中文字串雙向轉換 + auto-merge 偵測
    │   ├── flowSelectors.js       ← computeDisplayLabels / getTaskIncoming / 等 derived selectors
    │   └── validation.js          ← 儲存前 blocking + warning 檢核
    ├── diagram/
    │   ├── constants.js           ← LAYOUT 尺寸 + COLORS 主題色
    │   ├── violations.js          ← routing-aware 違規偵測
    │   └── layout/                ← 核心：DAG 欄位分配 + smart routing + corridor slot（PR-1 拆 11 檔）
    └── utils/
        ├── taskDefs.js            ← 編號 regex、connectionType 常數、工廠函式
        ├── elementTypes.js        ← `ELEMENT_TYPES` 8 種元件 catalog + `detectElementKind` / `makeTypeChange` / `applyRoleChange` / `syncTasksToRoles`
        ├── storage.js             ← localStorage I/O + 載入時 5 個 migration（點→橫線 / 閘道 _g / 子流程 _s / merge type / 外部互動 shape）
        ├── excelImport.js         ← 解析 Excel → flow 物件 + validator + 軟警告
        ├── excelExport.js         ← 匯出 .xlsx
        └── drawioExport.js        ← 匯出 .drawio
```

### 關鍵檔案

- `src/diagram/layout/` — 複雜度最高（PR-1 拆成 11 檔但總邏輯仍龐大）。負責把 flow 物件轉成 SVG 座標、計算連線路由。改前先讀 `HANDOVER.md §2.5`
- `src/utils/taskDefs.js` — 所有編號 regex 的單一來源（修改編號規則只改這裡的常數）
- `src/utils/storage.js` — localStorage 為唯一儲存層；載入時自動跑 5 個 migration
- `src/utils/excelImport.js` — Excel 匯入的 parser + validator，是業務規則落地的地方
- `docs/business-spec.md` + `CLAUDE.md` — 業務規則完整版 + AI 工作流 SOP；動任何程式碼前建議先讀

### 無後端 / 無測試套件

- 所有資料存在使用者瀏覽器的 `localStorage`（key = `bpm_flows_v1`）
- 沒有 test / lint script；驗證靠 `npm run build` + 手動瀏覽器測試
- 部署：push `main` 會觸發 `.github/workflows/deploy.yml` 自動發佈到 GitHub Pages

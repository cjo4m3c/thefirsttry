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
├── .claude/
│   └── skills/
│       └── ship-feature.md        ← AI 工作 skill（PR 前檢查清單）
├── public/                        ← 靜態資源（logo 等）
└── src/
    ├── main.jsx                   ← React entry point
    ├── App.jsx                    ← 頂層路由：Dashboard / Wizard / FlowEditor
    ├── index.css                  ← Tailwind directives + logo 動畫 + 捲軸樣式
    ├── components/
    │   ├── Dashboard.jsx          ← 首頁：L3 清單、Excel 上傳、批量操作
    │   ├── Wizard.jsx             ← 新增 L3 的四步驟精靈
    │   ├── FlowEditor.jsx         ← 編輯既有 L3（流程圖 + 頁籤式編輯）
    │   ├── FlowTable.jsx          ← L4 任務明細表（詳細 Excel 清單頁籤）
    │   ├── DiagramRenderer.jsx    ← SVG 泳道圖 + PNG / Draw.io 匯出按鈕
    │   ├── ConnectionSection.jsx  ← 任務卡片內的連線設定 UI
    │   ├── HelpPanel.jsx          ← 規則說明 Modal
    │   └── ChangelogPanel.jsx     ← 版本更新紀錄 Modal（功能後新增條目）
    ├── diagram/
    │   ├── constants.js           ← LAYOUT 尺寸 + COLORS 主題色
    │   └── layout.js              ← 核心：DAG 欄位分配 + 連線 smart routing
    └── utils/
        ├── taskDefs.js            ← 編號 regex、connectionType 常數、工廠函式
        ├── storage.js             ← localStorage I/O + 載入時遷移（點→橫線、閘道補 _g）
        ├── excelImport.js         ← 解析 Excel → flow 物件 + validator + 軟警告
        ├── excelExport.js         ← 匯出 .xlsx
        └── drawioExport.js        ← 匯出 .drawio
```

### 關鍵檔案

- `src/diagram/layout.js` — 複雜度最高的檔案（~500 行）。負責把 flow 物件轉成 SVG 座標、計算連線路由
- `src/utils/taskDefs.js` — 所有編號 regex 的單一來源（修改編號規則只改這裡的常數）
- `src/utils/storage.js` — localStorage 為唯一儲存層；載入時自動遷移舊資料格式
- `src/utils/excelImport.js` — Excel 匯入的 parser + validator，是業務規則落地的地方
- `CLAUDE.md` — 業務規則、工作流程 SOP；動任何程式碼前建議先讀

### 無後端 / 無測試套件

- 所有資料存在使用者瀏覽器的 `localStorage`（key = `bpm_flows_v1`）
- 沒有 test / lint script；驗證靠 `npm run build` + 手動瀏覽器測試
- 部署：push `main` 會觸發 `.github/workflows/deploy.yml` 自動發佈到 GitHub Pages

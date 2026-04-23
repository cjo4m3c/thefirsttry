# HANDOVER.md — 交接手冊

完整說明 FlowSprite 目前的執行環境、程式碼結構、開發流程，方便任何接手者（人或 AI）銜接。

---

## 1. 當前環境盤點

### 1.1 最終使用者端（Production）

| 項目 | 現況 |
|---|---|
| 執行位置 | 使用者瀏覽器（純前端 SPA，無後端）|
| 部署平台 | GitHub Pages（自動化）|
| 網址 | `https://cjo4m3c.github.io/FlowSprite/` |
| 帳號系統 | **無**（沒有登入，每個瀏覽器獨立）|
| 資料儲存 | 瀏覽器本機 `localStorage`，key = `bpm_flows_v1` |
| 跨裝置同步 | **無**（清瀏覽器 / 換裝置資料會遺失）|

### 1.2 程式碼倉庫

| 項目 | 現況 |
|---|---|
| GitHub repo | `https://github.com/cjo4m3c/FlowSprite` |
| 主分支 | `main`（squash merge only）|
| CI / CD | `.github/workflows/deploy.yml`：push `main` 自動 build + deploy 到 Pages |
| 部署延遲 | 約 1–2 分鐘 |

### 1.3 技術堆疊

| 類別 | 版本 |
|---|---|
| Framework | React 18.3.1 |
| Build | Vite 5.4.10 |
| Styling | Tailwind CSS 3.4.14 + 少量 inline style |
| Runtime deps | `html-to-image`（PNG 匯出）、`xlsx`（Excel 讀寫）|
| Node | 22 |
| Package mgr | npm（有 `package-lock.json`）|
| 無 | 測試套件、lint script、型別系統（純 JSX / JS）|

### 1.4 協作模式（目前）

| 角色 | 負責 |
|---|---|
| AI（Claude Code）| 改碼、`npm run build` 驗證、用 node 跑 trace 測試、`git push` 分支、維護 `ChangelogPanel.jsx` 與 `CLAUDE.md` |
| 人類使用者 | 提出需求、截圖回報、在 GitHub 網頁建 PR + squash merge、驗證部署結果 |

每個功能走以下流程：
1. 使用者描述需求（可能含截圖）
2. AI 提出 root cause + 修正計畫 → 等 OK
3. AI 切新分支 `claude/<feature-name>` 改碼 + build 驗證
4. AI 在 `ChangelogPanel.jsx` 最前面新增 changelog 條目（newest first）
5. AI `git push -u origin <branch>`
6. 使用者在 GitHub 網頁建 PR → **Squash and merge**
7. AI 同步本地 `git reset --hard origin/main`

---

## 2. 程式碼結構

```
FlowSprite/
├── README.md                      # 專案入口說明
├── HANDOVER.md                    # 本檔案
├── CLAUDE.md                      # 長期規則 / 業務規則 / SOP（最重要）
├── package.json                   # deps + scripts
├── vite.config.js                 # base = '/FlowSprite/' 跟 repo 名稱綁定
├── tailwind.config.js / postcss.config.js / index.html
├── .github/workflows/deploy.yml   # GitHub Actions 自動部署
├── .claude/
│   └── skills/                # AI 重用流程（/<skill-name> 可觸發）
│       ├── ship-feature.md    # PR 前檢查清單 + squash merge + 回報
│       ├── sync-main.md       # 使用者合併後本地同步 + 清 branch
│       ├── doc-audit.md       # Changelog / HelpPanel / README / HANDOVER 對齊性檢查
│       ├── trace-layout.md    # 流程圖路由 node trace 樣板
│       └── ui-rules.md        # 藍色主題色票、按鈕 / banner / modal pattern
└── src/
    ├── main.jsx                   # React entry
    ├── App.jsx                    # Route: Dashboard / Wizard / FlowEditor
    ├── index.css                  # Tailwind + logo 動畫 + scrollbar
    ├── components/
    │   ├── Dashboard.jsx          # 首頁清單、Excel 上傳、批量操作
    │   ├── Wizard.jsx             # 新增 L3 的四步驟精靈
    │   ├── FlowEditor.jsx         # 編輯已存在 L3（流程圖 + 頁籤式編輯）
    │   ├── FlowTable.jsx          # L4 任務明細表
    │   ├── DiagramRenderer.jsx    # SVG 泳道圖 + PNG/drawio 按鈕
    │   ├── ConnectionSection.jsx  # 任務卡的連線設定 UI
    │   ├── BackToTop.jsx          # 右下角浮動回到頂端按鈕
    │   ├── HelpPanel.jsx          # 規則說明 Modal
    │   └── ChangelogPanel.jsx     # 版本更新紀錄 Modal（每次功能後加一筆）
    ├── diagram/
    │   ├── constants.js           # LAYOUT 尺寸 + COLORS 主題色
    │   └── layout.js              # 核心：DAG 欄位分配 + smart routing + corridor slot 系統（~1000 行，複雜度最高）
    └── utils/
        ├── taskDefs.js            # 編號 regex、connectionType 常數、makeTask 等工廠函式
        ├── storage.js             # localStorage 讀寫 + 載入時遷移（點→橫線、閘道補 _g）
        ├── excelImport.js         # parseExcelToFlow：解析 Excel → flow 物件 + validator + 軟警告
        ├── excelExport.js         # 匯出 .xlsx
        └── drawioExport.js        # 匯出 .drawio
```

---

## 3. 核心業務規則

> **單一來源**：`src/utils/taskDefs.js` 的 5 個 regex 常數；`CLAUDE.md` 規則 3 有完整文字說明。

### 3.1 編號格式

| 元件 | 格式 | 範例 |
|---|---|---|
| L3 活動 | `\d+-\d+-\d+` | `1-1-1` |
| L4 任務 | `\d+-\d+-\d+-\d+` | `1-1-1-1` |
| 開始事件 | 尾碼 `0` | `1-1-1-0` |
| 結束事件 | 尾碼 `99` | `1-1-1-99` |
| 閘道 | 前置任務 + `_g`（單一）或 `_g1` / `_g2` / `_g3`（連續）| `1-1-1-4_g`、`1-1-1-4_g1` |

- **只接受 `-` 分隔**（載入舊資料時自動把 `.` 轉成 `-`）
- **閘道前綴必為既有 L4 任務**（`1-1-1-4_g` → 同 Excel 必有 `1-1-1-4` 任務列）
- **連續閘道編號鏈**：`X_g1` 接在 X 後、`X_g2` 接在 `X_g1` 後，依此類推

### 3.2 哪些算獨立閘道（需要 `_g` 尾碼）

| 關鍵字 | 類型 |
|---|---|
| `條件分支至 A、B、C` | XOR fork |
| `並行分支至 A、B、C` | AND fork |

### 3.3 哪些**不是**獨立閘道（是一般任務，不用 `_g`）

| 關鍵字 | 語意 |
|---|---|
| `條件合併來自多個分支、序列流向 Z` | 該任務是 XOR merge target，收到 ≥2 條分支匯入 |
| `並行合併來自 X、Y、序列流向 Z` | 該任務是 AND join target |
| `迴圈返回至 X`（新）| 該任務有 back-edge 指回 X |
| `若未通過則返回 X，若通過則序列流向 Y`（舊）| 同上，legacy 語法 |

---

## 4. 部署 & 環境變數

- **觸發條件**：push `main` 分支
- **流程**：`actions/checkout@v4` → Node 22 → `npm install` → `npm run build` → upload `dist/` → Pages
- **Vite base path**：`/FlowSprite/`（跟 repo 名稱綁定；repo 改名須同步改 `vite.config.js`）
- **無環境變數**：所有設定都在程式碼裡，部署不需要 secrets

---

## 5. 交接情境

### 5.1 **換人、仍用 Claude Code 或其他 AI Agent**

最省事。步驟：

1. GitHub `cjo4m3c/FlowSprite` 新增接手人為 collaborator（或 transfer ownership）
2. 接手人安裝 Claude Code 或同類工具
3. 把 `CLAUDE.md` + `HANDOVER.md` + `src/components/ChangelogPanel.jsx`（變更歷史）給他
4. 提醒他 `.claude/skills/` 底下的 5 個重用流程（`/ship-feature`、`/sync-main`、`/doc-audit`、`/trace-layout`、`/ui-rules`）

**限制**：他的 AI 設定中應保留「只能操作 `cjo4m3c/FlowSprite`」的 scope 限制、squash merge 預設、不改 deploy workflow。

### 5.2 **換人、純人工開發（不用 AI）**

他需會 React + Git。步驟：

1. GitHub collaborator 授權
2. 本地設定：
   ```bash
   git clone https://github.com/cjo4m3c/FlowSprite.git
   cd FlowSprite
   npm install
   npm run dev        # http://localhost:5173/FlowSprite/
   ```
3. 依序讀這三個檔建立脈絡：
   - `CLAUDE.md` 規則 3（業務規則、編號格式）
   - `src/components/ChangelogPanel.jsx` 的 `CHANGELOG` 陣列（變更歷史+脈絡）
   - `src/diagram/layout.js`（核心複雜度所在）
4. 開發流程：`git checkout -b feature/xxx` → 改碼 → push → 網頁建 PR → squash merge
5. **建議閱讀最近 10 筆 merged PR 的 description**（每個都有寫 root cause + fix 解說，是重要脈絡）

### 5.3 **遷移到其他 static hosting（Vercel / Netlify / S3）**

因為是純靜態 SPA，任何 hosting 都吃得下。改動：

1. `vite.config.js` 的 `base: '/FlowSprite/'` 改成該平台的路徑（Vercel 用根路徑 `'/'`）
2. 移除 `.github/workflows/deploy.yml`
3. 在新平台設定 build command = `npm run build`、output dir = `dist`

---

## 6. 交接 Checklist

打勾照著做：

- [ ] GitHub `cjo4m3c/FlowSprite` 新增 collaborator 或 transfer ownership
- [ ] 確認 GitHub Pages 設定（Settings → Pages → Source = **GitHub Actions**）
- [ ] 把這份 HANDOVER.md 交給接手人（repo 裡已有）
- [ ] 告知「此工具無後端 / 無帳號 / 無同步」，最終使用者備份唯一管道是 Excel 下載
- [ ] 告知 `main` push 自動部署、只能 squash merge
- [ ] 告知 backlog：
  - 閘道 >4 條件分支時 port 共享（需要 port 子位置偏移架構）

---

## 7. 風險與限制（讓接手人知道）

- **無後端**：資料無法跨裝置、無版本歷史（只有使用者自己下載 Excel 當備份）
- **瀏覽器限制**：Excel/PNG 匯出受 `html-to-image` + browser memory 限制，非常大的流程圖可能產出失敗
- **`layout.js` 龐大**：連線路由有多個 phase（Phase 1 sibling 分配 → Phase 2 target entry 分配 → Phase 2b 預掃描 backward edge 目標 → Phase 3 跨閘道衝突 + sibling-sharing fallback → Phase 3b 任務 backward → Phase 3c 任務 forward 長跳欄 → Phase 3d 跨列 forward 障礙避開 → 上下 corridor slot 分配），改動容易牽一髮動全身；改前先讀 PR #16~#40 的 description 建立脈絡
- **中文 regex 敏感**：`excelImport.js` 用中文關鍵字（`條件分支至` 等），對全形/半形、多餘空白、標點符號變體敏感
- **無自動化測試**：驗證靠 `npm run build` + 手動瀏覽器測試 + `node trace.mjs` 臨時腳本

---

## 8. 歷史參考資料

- `src/components/ChangelogPanel.jsx` 的 `CHANGELOG` 陣列：使用者可見的變更紀錄（按日期 newest first）
- GitHub `Closed PRs`：每個 PR description 都有 root cause + fix 解說
- `CLAUDE.md`：AI 長期記憶，含 regex 單一來源、已清理孤兒檔案清單、每次 PR 前的檢查步驟

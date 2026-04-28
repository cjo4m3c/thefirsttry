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
4. AI 在 `src/data/changelog/current.js` 最前面新增 changelog 條目（newest first）
5. AI `git push -u origin <branch>`
6. 使用者在 GitHub 網頁建 PR → **Squash and merge**
7. AI 同步本地 `git fetch origin main && git reset --hard origin/main`

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
│       ├── ui-rules.md        # 藍色主題色票、按鈕 / banner / modal pattern
│       └── paste-bundle.md    # 大檔（>15KB）走 GitHub 網頁手工貼上的 SOP
└── src/
    ├── main.jsx                   # React entry
    ├── App.jsx                    # Route: Dashboard / Wizard / FlowEditor
    ├── index.css                  # Tailwind + logo 動畫 + scrollbar
    ├── components/
    │   ├── Dashboard.jsx          # 首頁清單、Excel 上傳、批量操作
    │   ├── Wizard.jsx             # 新增 L3 的 2 步驟精靈（L3 資訊 → 角色），完成後進 FlowEditor
    │   ├── FlowEditor.jsx         # 編輯 L3（流程圖 + 右側 drawer 編輯 + ContextMenu + 儲存前檢核兩層）
    │   ├── FlowTable.jsx          # L4 任務明細表（流程圖下方常駐顯示）
    │   ├── DiagramRenderer.jsx    # SVG 泳道圖 + PNG/drawio 按鈕 + hover tooltip + onTaskClick
    │   ├── RightDrawer.jsx        # 右側滑出面板（hosts 設定流程 + 設定泳道角色 tabs）
    │   ├── ContextMenu.jsx        # 點任務元件彈出的編輯選單（inline name/role/desc + 新增/刪除/連線/閘道）
    │   ├── ConnectionSection.jsx  # 任務卡的連線設定 UI（drawer flow tab 內）
    │   ├── BackToTop.jsx          # 右下角浮動回到頂端按鈕
    │   ├── dragReorder.jsx        # 共用的 useDragReorder hook + DragHandle（Wizard / FlowEditor 共用）
    │   ├── HelpPanel.jsx          # 規則說明 Modal
    │   └── ChangelogPanel.jsx     # 版本更新紀錄 Modal UI 殼層（import 自 ../data/changelog/）
    ├── data/
    │   └── changelog/
    │       ├── current.js         # 本期 changelog 條目（未來新功能只改這裡，<1KB）
    │       ├── index.js           # re-export CHANGELOG = [...current, ...c13, ..., ...c01]
    │       └── c01.js ～ c13.js   # 凍結歸檔塊（勿修改）
    ├── diagram/
    │   ├── constants.js           # LAYOUT 尺寸 + COLORS 主題色
    │   └── layout.js              # 核心：DAG 欄位分配 + smart routing + corridor slot 系統（~1262 行）
    └── utils/
        ├── taskDefs.js            # 編號 regex、connectionType 常數、makeTask 等工廠函式
        ├── storage.js             # localStorage 讀寫 + 載入時遷移（點→橫線、閘道補 _g）
        ├── excelImport.js         # parseExcelToFlow：解析 Excel → flow 物件 + validator + 軟警告
        ├── excelExport.js         # 匯出 .xlsx
        └── drawioExport.js        # 匯出 .drawio
```

### 2.5 layout.js 內部路由規則（開發者參考）

**dr / dc 定義**
- `dr = 目標角色列 − 來源角色列`（正 = 下方角色, 負 = 上方角色）
- `dc = 目標欄 − 來源欄`（正 = 右側往後, 負 = 左側往前）

**Routing 條件 → exit/entry 決策表**

| 條件 | 出口 → 入口 | 備註 |
|---|---|---|
| dr=0, dc=1（同列相鄰向右）| 右 → 左 | 主要順向連線，水平 midX 折線 |
| dr=0, dc>1（同列跳欄向右）| 上 → 上 | 走上方 corridor 跳過中間元件 |
| dr=0, dc<0（同列往前 / loop-back）| 上 → 上 | 走上方 corridor 回到前面任務 |
| dr≠0（跨列）| 依方向 L 形繞行 | Phase 3d 偵測障礙時改 target/source 上下端點 |
| 同閘道多出口衝突 | 依優先順序分散 | Phase 1：每條件挑未被 sibling 佔用的側 |
| 目標閘道有多條 incoming | 入口分散 | Phase 2：按來源方向分到 4 個 port |
| Top/bottom corridor 回退衝突 | 擇優先 rule 1 | 端點混用屬規則 1 > 視覺交叉屬規則 2 |

**規則 1 / 規則 2**（CLAUDE.md §10.1）
- 規則 1：端點不能 IN+OUT 混用（blocking）
- 規則 2：避免線段穿過任務矩形（warning）

---

## 3. 核心業務規則

> **單一來源**：`src/utils/taskDefs.js` 的 5 個 regex 常數；`CLAUDE.md` 規則 3 有完整說明。

### 3.1 編號格式

| 元件 | 格式 | 範例 |
|---|---|---|
| L3 活動 | `\d+-\d+-\d+` | `1-1-1` |
| L4 任務 | `\d+-\d+-\d+-\d+` | `1-1-1-1` |
| 開始事件 | 尾碼 `0` | `1-1-1-0` |
| 結束事件 | 尾碼 `99` | `1-1-1-99` |
| 閘道 | 前置任務 + `_g` / `_g1` / `_g2`… | `1-1-1-4_g` |

- **只接受 `-` 分隔**（載入舊資料時自動把 `.` 轉成 `-`）
- **閘道前綴必為既有 L4 任務**

### 3.2 獨立閘道關鍵字（需要 `_g` 尾碼）

`條件分支至`、`並行分支至`、`包容分支至`

### 3.3 非獨立閘道（一般任務，不用 `_g`）

`條件合併來自多個分支`、`並行合併來自 X、Y`、`迴圈返回至 X` 等

---

## 4. 部署 & 環境變數

- **觸發條件**：push `main` 分支
- **流程**：`actions/checkout@v4` → Node 22 → `npm install` → `npm run build` → upload `dist/` → Pages
- **Vite base path**：`/FlowSprite/`（repo 改名須同步改 `vite.config.js`）
- **無 secrets**：所有設定都在程式碼裡，部署不需要

---

## 5. 交接情境

### 5.1 換人、仍用 Claude Code

1. GitHub 新增接手人為 collaborator
2. 把 `CLAUDE.md` + `HANDOVER.md` + `src/data/changelog/current.js` + `c13.js` 給他
3. 提醒 `.claude/skills/` 底下 6 個重用流程（`/ship-feature`、`/sync-main`、`/doc-audit`、`/trace-layout`、`/ui-rules`、`/paste-bundle`）

### 5.2 換人、純人工開發

```bash
git clone https://github.com/cjo4m3c/FlowSprite.git
cd FlowSprite && npm install && npm run dev
```

依序讀：`CLAUDE.md` 規則 3 → `src/data/changelog/current.js` + `c13.js` → `layout.js`

### 5.3 遷移到其他 static hosting

改 `vite.config.js` base 路徑、移除 `.github/workflows/deploy.yml`、新平台設 build = `npm run build`、output = `dist`

---

## 6. 交接 Checklist

- [ ] GitHub 新增 collaborator 或 transfer ownership
- [ ] 確認 GitHub Pages（Settings → Pages → Source = **GitHub Actions**）
- [ ] 告知「無後端 / 無帳號 / 無同步」，備份只能靠 Excel 下載
- [ ] 告知 `main` push 自動部署、只能 squash merge
- [ ] 告知 backlog（`CLAUDE.md` §當前待辦狀態）

---

## 7. 風險與限制

- **無後端**：資料無法跨裝置、無版本歷史
- **`layout.js` 龐大（~1262 行）**：phase-based routing，改動前先讀 §2.5 + 最近 10 筆 PR description
- **中文 regex 敏感**：`excelImport.js` 用中文關鍵字，對全形/半形、多餘空白敏感
- **無自動化測試**：驗證靠 `npm run build` + 手動瀏覽器 + `node trace.mjs`

---

## 8. 歷史參考資料

- `src/data/changelog/current.js`：本期條目（未來功能往這裡加）
- `src/data/changelog/c01.js` ～ `c13.js`：凍結歸檔塊（只讀）
- `src/components/ChangelogPanel.jsx`：UI 殼層（~100 行）
- GitHub Closed PRs：每個 PR description 有 root cause + fix 解說
- `CLAUDE.md`：AI 長期記憶，含 regex 單一來源、孤兒檔案清單、PR 前檢查步驟

---

## 9. 最新重要變更（截止：2026-04-28，PR #72–#75）

| PR | 重點 |
|---|---|
| #72 | `paste-bundle.md` 禁用 `git reset --hard`，改 `git rebase`；`~~~` 外層圍欄解巢狀 backtick 問題 |
| #73 | **Q**：連線下拉切閘道類型自動補前綴（`applyGatewayPrefix(name,null)` = strip-only）。**T**：右鍵新增閘道 sub-form 加條件一/二 label input |
| #74 | **R+S**：L3 活動可出現在連線下拉（`ConnectionSection.jsx:14`）；L3 無連線顯示專屬 warning；ContextMenu 新增「新增 L3 活動」按鈕 + inline L3 編號編輯；移除「在前面新增任務」按鈕 |
| #75 | **ChangelogPanel 拆塊**：84KB monolith → UI 殼層 ~100 行 + `src/data/changelog/{current.js,index.js,c01–c13.js}`。**未來只改 `current.js`（<1KB）**，MCP push 不再超時 |

### 待使用者手動驗證

- [ ] **#73 T**：右鍵新增閘道 → 條件一/二有帶入任務名稱
- [ ] **#74 R**：右鍵新增 L3 活動 → 插入正確；L3 編號 inline 可改；L3 出現在連線下拉
- [ ] **#75**：Changelog modal 所有條目正常顯示

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
| AI（Claude Code）| 改碼、`npm run build` 驗證、用 node 跑 trace 測試、`git push` 分支、維護 `src/data/changelog/current.js` 與 `CLAUDE.md` |
| 人類使用者 | 提出需求、截圖回報、在 GitHub 網頁建 PR + squash merge、驗證部署結果 |

每個功能走以下流程：
1. 使用者描述需求（可能含截圖）
2. AI 提出 root cause + 修正計畫 → 等 OK
3. AI 切新分支 `claude/<feature-name>` 改碼 + build 驗證
4. AI 在 `src/data/changelog/current.js` 最前面新增 changelog 條目（newest first；>7KB 凍結成 `c{N}.js`）
5. AI 用 `mcp__github__create_pull_request` 開 PR + 立即 `mcp__github__subscribe_pr_activity` 訂閱 CI / review 事件
6. 使用者在 GitHub 網頁 **Squash and merge**
7. AI 同步本地：`git checkout main && git pull origin main` + `git branch -d claude/<feature-name>`

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
├── docs/
│   └── business-spec.md           # 業務規則單一來源（13 章；給協作者看，HelpPanel data 對應這份）
├── .claude/
│   ├── business-rules.md          # Claude 工作流慣例（trace 驗證 / Excel I/O / CJK wrap / 文件同步）
│   ├── backlog.md                 # 跨 session 待辦（4 分類 + 已完成）
│   ├── orphans.md                 # 已清理檔案清單（勿再建立同名）
│   └── skills/                    # AI 重用流程（/<skill-name> 可觸發）
│       ├── ship-feature.md        # PR 前檢查清單 + squash merge + 回報
│       ├── sync-main.md           # 使用者合併後本地同步 + 清 branch
│       ├── sync-views.md          # 七視圖一致性 walk + size check
│       ├── doc-audit.md           # Changelog / HelpPanel / README / HANDOVER 對齊性檢查
│       ├── trace-layout.md        # 流程圖路由 node trace 樣板
│       ├── ui-rules.md            # 藍色主題色票、按鈕 / banner / modal pattern
│       ├── paste-bundle.md        # 大檔（>15KB）走 GitHub 網頁手工貼上的 SOP
│       ├── preview-branch.md      # 開預覽分支（VITE_BASE_PATH 子路徑部署）
│       └── wrap-pr.md             # PR 收尾 / 描述模板
└── src/
    ├── main.jsx                   # React entry
    ├── App.jsx                    # Route: Dashboard / Wizard / FlowEditor
    ├── index.css                  # Tailwind + logo 動畫 + scrollbar
    ├── components/
    │   ├── Dashboard.jsx          # 首頁清單、Excel 上傳、批量操作（單檔 26KB，仍在拆檔 backlog）
    │   ├── Wizard.jsx             # 新增 L3 的 2 步驟精靈（L3 資訊 → 角色），完成後進 FlowEditor
    │   ├── FlowEditor/            # 編輯 L3 主控（PR-3 拆 7 檔；index.jsx + Header / DrawerContent / TaskCard / SaveModals / useFlowActions / validateFlow）
    │   ├── FlowTable.jsx          # L4 任務明細表（流程圖下方常駐顯示）
    │   ├── DiagramRenderer/       # SVG 泳道圖 + 圖例 modal + hover tooltip + onTaskClick（PR-2 拆 10+ 檔；shapes / overlays / legend / 等）
    │   ├── RightDrawer.jsx        # 右側滑出面板（hosts 設定流程 + 設定泳道角色 tabs）
    │   ├── ContextMenu/           # 點任務元件彈出的編輯選單（PR-0 拆 2 檔；index.jsx + subforms.jsx）
    │   ├── ConnectionSection.jsx  # 任務卡的連線設定 UI（drawer flow tab 內）
    │   ├── BackToTop.jsx          # 右下角浮動回到頂端按鈕
    │   ├── reorderButtons.jsx     # ReorderButtons ▲ ▼ 排序按鈕 + moveItem 純函式（Wizard / FlowEditor 共用，2026-04-30 取代 HTML5 drag）
    │   ├── HelpPanel.jsx          # 規則說明 Modal（使用者可編輯操作 + 不能違反的規則；data 來自 helpPanelData.js）
    │   └── ChangelogPanel.jsx     # 版本更新紀錄 Modal（讀 src/data/changelog/index.js）
    ├── data/
    │   ├── helpPanelData.js       # HelpPanel 規則摘要 data，每個 array 對應 docs/business-spec.md 章節
    │   └── changelog/
    │       ├── current.js         # 「tip」當前 PR 條目寫這裡（>7KB 就凍結成 c{N}.js）
    │       ├── c01.js…c21.js      # 凍結 chunks（newest first 順序由 index.js 串接）
    │       └── index.js           # 串接 current + 所有 frozen chunks
    ├── model/                     # 純函式共用層（Phase 2 PR #80/#81/#82 抽出，視圖層只 import 不重複實作）
    │   ├── connectionFormat.js    # task ↔ 中文字串（「條件分支至 X、Y」）正反向轉換 + auto-merge 偵測
    │   ├── flowSelectors.js       # computeDisplayLabels / getTaskIncoming / 等 derived selectors
    │   └── validation.js          # 儲存前 blocking + warning 檢核（FlowEditor + Excel 匯入共用）
    ├── diagram/
    │   ├── constants.js           # LAYOUT 尺寸 + COLORS 主題色
    │   ├── violations.js          # routing-aware 違規偵測（端點混用 / 線跨任務矩形）
    │   └── layout/                # 核心：DAG 欄位分配 + smart routing + corridor slot 系統（PR-1 拆 11 檔，~58KB → 各 ≤15KB）
    └── utils/
        ├── taskDefs.js            # 編號 regex、connectionType 常數、makeTask 等工廠函式
        ├── elementTypes.js        # ELEMENT_TYPES 8 種元件類型 catalog + detectElementKind / makeTypeChange / applyRoleChange / syncTasksToRoles（TaskCard / ContextMenu / convertTaskType / Excel migration 共用）
        ├── storage.js             # localStorage 讀寫 + 載入時 4 個 migration（點→橫線、閘道補 _g、子流程補 _s、merge type→branch、外部互動 shape sync）
        ├── excelImport.js         # parseExcelToFlow：解析 Excel → flow 物件 + validator + 軟警告
        ├── excelExport.js         # 匯出 .xlsx
        └── drawioExport.js        # 匯出 .drawio
```

### 2.5 routing 內部規則（開發者參考）

> 這段內容原本在 HelpPanel.jsx，後來改成讓使用者可以直接拖端點 / 換目標，所以從使用者面板搬到這裡作為內部技術參考。動 `src/diagram/layout/` 前要先讀懂這部分。

**dr / dc 定義**
- `dr = 目標角色列 − 來源角色列`（正 = 下方角色, 負 = 上方角色）
- `dc = 目標欄 − 來源欄`（正 = 右側往後, 負 = 左側往前）

**Routing 條件 → exit/entry 決策表**

| 條件 | 出口 → 入口 | 備註 |
|---|---|---|
| dr=0, dc=1（同列相鄰向右）| 右 → 左 | 主要順向連線，水平 midX 折線 |
| dr=0, dc>1（同列跳欄向右）| 上 → 上 | 走上方 corridor 跳過中間元件；slot 系統分配不同 y-level |
| dr=0, dc<0（同列往前 / loop-back）| 上 → 上 | 走上方 corridor 回到前面任務；slot 系統避免與其他 top 連線重疊 |
| dr<0, dc=0 / 相鄰（目標在上方同欄）| 上 → 對側 | 簡單 1-bend 折線 |
| dr<0, dc>0（上方右側）| 右 → 左 | L 形繞上 |
| dr>0, dc=0 / 相鄰（目標在下方同欄）| 下 → 對側 | 簡單 1-bend 折線 |
| dr>0, dc>0（下方右側）| 右 → 左 | L 形繞下 |
| 同閘道多出口衝突 | 依優先順序分散 | Phase 1：每條件挑第一個未被 sibling 佔用的側；4 條件以上會補上未列側邊避免同 port 重疊 |
| 目標閘道有多條 incoming | 入口分散 | Phase 2：按來源方向把 entry 分到 4 個 port |
| 閘道自身 incoming 端點已被佔用 | 避開 | outgoing 會跳過 incoming 已佔的側，避免共用 port |
| 跨列 forward 預設路徑會穿過任務矩形 | 改端點避障 | Phase 3d：優先改 target 上/下端點（垂直段放 target 欄）；失敗改 source 上/下端點（垂直段放 source 欄）|
| Top / bottom corridor 回退衝突 | 擇優先 rule 1 | Top 交叉時退到 bottom 前先檢查是否會混用；若 top 和 bottom 都有問題，優先 top（視覺交叉屬規則 2、端點混用屬規則 1）|

**Corridor slot 系統**

| 通道 | 適用情境 | Slot 規則 |
|---|---|---|
| 上方 corridor（top→top）| 閘道 top-skip、task backward（迴圈返回）、task forward 長跳欄（dc>1 同列）| 自動 slot：每條連線一個 y-level，最長 span 放最外側；row 0 會動態預留空間避免壓到標題列 |
| 下方 corridor（bottom→bottom）| 同列跨欄下方繞行（少數情境）| 自動 slot：在泳道底部往上堆疊，最長 span 放最外側，泳道高度自動擴張 |
| 平行走廊（left→left / right→right）| 較罕見，用於特殊反向或跨區位連線 | 目前未做 slot，依 min/max 座標加固定偏移 |

**規則 1 / 規則 2**（CLAUDE.md §10.1）
- 規則 1：端點不能 IN+OUT 混用（violation detector blocking）
- 規則 2：避免線段穿過任務矩形（violation detector warning）

使用者拖曳端點 / 換目標時 violation detector 會即時抓出問題並紅色高亮。

---

## 3. 核心業務規則

> **單一來源**：完整版在 `docs/business-spec.md`（13 章；給協作者看）+ `src/data/helpPanelData.js`（給使用者看）+ `src/utils/taskDefs.js` 6 個 regex 常數（程式驗證）。本節是索引摘要，**改規則絕對不在這裡改**，去 spec doc。

### 3.1 編號格式

| 元件 | 格式 | 範例 |
|---|---|---|
| L3 活動 | `\d+-\d+-\d+` | `1-1-1` |
| L4 任務 | `\d+-\d+-\d+-\d+` | `1-1-1-1` |
| 開始事件 | 尾碼 `0` | `1-1-1-0` |
| 結束事件 | 尾碼 `99` | `1-1-1-99` |
| 閘道 | 前置任務 + `_g`（單一）或 `_g1` / `_g2` / `_g3`（連續）| `1-1-1-4_g`、`1-1-1-4_g1` |
| 子流程調用 | 前置任務 + `_s`（單一）或 `_s1` / `_s2`（連續）| `1-1-1-4_s`、`1-1-1-4_s1` |

- **只接受 `-` 分隔**（載入舊資料時自動把 `.` 轉成 `-`）
- **閘道 / 子流程前綴必為既有 L4 任務**（或 `-0` 開始事件，例 `1-1-1-0_g`）
- **`_g` 與 `_s` 共用 anchor**：兩者都不佔流水順號，連續計數器互不重置（規格範例 `_s1 → _g → _s2`，中間 `_g` 不打斷 `_s` 連續性）
- **連續閘道編號鏈**：`X_g1` 接在 X 後、`X_g2` 接在 `X_g1` 後

### 3.2 哪些算獨立閘道（需要 `_g` 尾碼）

| 關鍵字 | 類型 |
|---|---|
| `條件分支至 A、B、C` | XOR fork |
| `並行分支至 A、B、C` | AND fork |
| `包容分支至 A、B、C` 或 `可能分支至 A、B、C` | OR fork |

### 3.3 哪些**不是**獨立閘道（是一般任務，不用 `_g`）

| 關鍵字 | 語意 |
|---|---|
| `條件合併來自多個分支、序列流向 Z` | 該任務是 XOR merge target，收到 ≥2 條分支匯入 |
| `並行合併來自 X、Y、序列流向 Z` | 該任務是 AND join target |
| `包容合併來自多個分支，序列流向 Z` | 該任務是 OR join target |
| `迴圈返回至 X`（新）| 該任務有 back-edge 指回 X |
| `若未通過則返回 X，若通過則序列流向 Y`（舊）| 同上，legacy 語法 |

---

## 4. 部署 & 環境變數

- **觸發條件**：push `main` 分支
- **流程**：`actions/checkout@v4` → Node 22 → `npm install` → `npm run build` → upload `dist/` → Pages
- **Vite base path**：`/FlowSprite/`（跟 repo 名稱綁定；repo 改名須同步改 `vite.config.js`）
- **`VITE_BASE_PATH` 環境變數**：可選 override；給未來 preview branch 部署到子路徑用（例如 `/FlowSprite/preview-foo/`）
- **無 secrets**：所有設定都在程式碼裡，部署不需要

---

## 5. 交接情境

### 5.1 **換人、仍用 Claude Code 或其他 AI Agent**

最省事。步驟：

1. GitHub `cjo4m3c/FlowSprite` 新增接手人為 collaborator（或 transfer ownership）
2. 接手人安裝 Claude Code 或同類工具
3. 把 `CLAUDE.md` + `HANDOVER.md` + `src/components/ChangelogPanel.jsx`（變更歷史）給他
4. 提醒他 `.claude/skills/` 底下的 6 個重用流程（`/ship-feature`、`/sync-main`、`/doc-audit`、`/trace-layout`、`/ui-rules`、`/paste-bundle`）

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
   - `docs/business-spec.md`（業務規則完整版，13 章）+ `CLAUDE.md`（長期規則 / SOP / 編號 regex 索引）
   - `src/data/changelog/` 內 `index.js` 串接的 `CHANGELOG` 陣列（變更歷史+脈絡，newest first）
   - `src/diagram/layout/`（核心複雜度所在；先看 `index.js` 串起的 phase 順序）
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
- [ ] 告知 backlog（`.claude/backlog.md`）+ 變更歷史（`src/data/changelog/`）+ GitHub Closed PRs

---

## 7. 風險與限制（讓接手人知道）

- **無後端**：資料無法跨裝置、無版本歷史（只有使用者自己下載 Excel 當備份）
- **瀏覽器限制**：Excel/PNG 匯出受 `html-to-image` + browser memory 限制，非常大的流程圖可能產出失敗
- **`src/diagram/layout/` 龐大**：PR-1 拆成 11 檔但總邏輯仍 ~58KB。連線路由有多個 phase（Phase 1 sibling 分配 → Phase 2 target entry 分配 → Phase 3 跨閘道衝突 + Pass 2 sibling-sharing fallback + corridor guard → Phase 3b 任務 backward → Phase 3c 任務 forward 長跳欄 → Phase 3d 跨列 forward 障礙避開 + cross-edge 重疊偵測 → **Phase 3e 使用者手動 override** → 上下 corridor slot 分配），改動容易牽一髮動全身；改前先讀 §2.5 內部路由規則 + 最近 10 筆 PR 的 description
- **中文 regex 敏感**：`excelImport.js` 用中文關鍵字（`條件分支至` 等），對全形/半形、多餘空白、標點符號變體敏感
- **無自動化測試**：驗證靠 `npm run build` + 手動瀏覽器測試 + `node trace.mjs` 臨時腳本

---

## 8. 歷史參考資料

- `src/data/changelog/`（`index.js` 串接 `current.js` + `c01.js`…`c21.js`）：使用者可見的變更紀錄（newest first）。動程式時先看最近幾條了解 in-flight 規則演進
- GitHub `Closed PRs`：每個 PR description 都有 root cause + fix 解說
- `CLAUDE.md`：AI 長期規則（regex 索引、PR SOP、CI 追蹤、單檔大小上限）
- `docs/business-spec.md`：業務規則完整版（13 章），跟 `src/data/helpPanelData.js` 一一對應
- `.claude/business-rules.md`：Claude 工作流慣例（trace 驗證、Excel I/O、CJK wrap）
- `.claude/backlog.md`：跨 session 待辦
- `.claude/orphans.md`：已刪檔案清單（不要再建同名）

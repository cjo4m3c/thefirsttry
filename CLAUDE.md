# CLAUDE.md — FlowSprite 專案長期規則

本檔案由 Claude 自動維護，記錄所有跨對話的長期規則與慣例。
每次調整規則後須同步更新此檔並 push 到 remote。

---

## 1. 儲存庫與分支

- **GitHub repo**：`cjo4m3c/FlowSprite`
- **工作流程**：每個功能從最新 `main` 切新分支（例如 `claude/<feature-name>`）→ push → 開 PR → **squash merge** 到 `main`；`main` push 會觸發 `.github/workflows/deploy.yml` 自動部署 GitHub Pages
- **部署網址**：`https://cjo4m3c.github.io/FlowSprite/`
- **MCP scope**：GitHub MCP tools 僅允許 `cjo4m3c/flowsprite`；不得操作其他 repo

## 2. Git 推送規則

- `git push` 會被 local proxy 擋下（HTTP 503），**不可使用**
- 推送主要透過 `mcp__github__push_files`（小檔案 <7KB 最穩）
- **一次只推 1 個檔案**，避免 stream idle timeout；每推完一個回報一次
- **大檔案（>15KB）時常 timeout**：這種情況改由**使用者在 GitHub 網頁編輯器**手動貼上內容
  - URL 範本：`https://github.com/cjo4m3c/FlowSprite/edit/<branch>/<path>`
  - Claude 只提供要貼上的文字片段，不自己串流
- **刪除檔案**用 `mcp__github__delete_file`（快，無 content 傳輸）
- commit message 用英文為主，描述變更原因而非細節
- 絕不 push 到其他分支，也不建 PR（除非使用者明確要求）

## 3. L3 / L4 編號格式（核心業務規則）

- **僅接受「-」分隔，不接受「.」分隔**（特殊類型才有 `_g` 後綴例外）
- **L3 編號**：`1-1-1`（三層橫線分隔，恰好 3 段）
- **L4 編號**：`1-1-1-1`（L3 編號 + `-` + 序號，恰好 4 段）
- **特殊類型 L4 後綴**：
  - 開始事件：尾碼必為 `0`（範例 `1-1-7-0`）
  - 結束事件：尾碼必為 `99`（範例 `1-1-7-99`）
  - 閘道（XOR / AND / OR 皆適用）：基本 L4 編號後加 `_g`（單一時），連續多個用 `_g1`、`_g2`、`_g3`…（範例 `1-1-9-5_g`、`1-1-9-5_g1`），且**前綴必為一個既有 L4 任務**（即 `1-1-9-5_g` 或 `1-1-9-5_g1` 必有對應 `1-1-9-5` 任務存在）
  - **閘道判定範圍（僅以下 fork 關鍵字視為獨立閘道元件，需要 `_g` 尾碼）**：`條件分支至`、`並行分支至`
  - **不是獨立閘道元件**（皆為一般任務，不用 `_g`）：
    - `條件合併來自多個分支、序列流向 Z` / `並行合併來自 X、Y、序列流向 Z`：這個任務自身是 merge target，收到多條 incoming；forward 目標由 `序列流向 Z` 解析
    - `迴圈返回至 X` / `若未通過則返回 X、若通過則序列流向 Y`：back-edge 合併進 `nextTaskIds`，保持矩形
- 格式驗證 regex 的**單一來源**在 `src/utils/taskDefs.js`：
  - `L3_NUMBER_PATTERN = /^\d+-\d+-\d+$/`
  - `L4_NUMBER_PATTERN = /^\d+-\d+-\d+-\d+(_g\d*)?$/`
  - `L4_START_PATTERN = /^\d+-\d+-\d+-0$/`
  - `L4_END_PATTERN = /^\d+-\d+-\d+-99$/`
  - `L4_GATEWAY_PATTERN = /^\d+-\d+-\d+-\d+_g\d*$/`
  - **編號規則若變更，只改這幾個常數**；其他檔案透過 import 引用
- Excel 匯入：
  - **Parser 保留寬鬆**（`[\d.-]+(?:_g\d*)?` 捕捉號碼，容忍點分隔避免解析斷裂）
  - **validateNumbering 強制 dash-only**：L3/L4 基本格式 + 開始/結束 尾碼 + 閘道 `_g`/`_g\d+` 尾碼 + 閘道前綴對應檢查，不合會列出所有錯誤列
- 舊 localStorage 資料中若有點分隔，仍會在 `storage.normalizeNumber` 載入時自動轉為橫線（資料遷移用）
- 所有新範例、placeholder、錯誤訊息都必須使用橫線格式
- 已套用此規則的位置：
  - `src/utils/excelImport.js`：`normalizeL3Number` (commit 4ef7d66)
  - `src/utils/taskDefs.js`：`computeDisplayLabels` (commit 4ef7d66)
  - `src/utils/excelExport.js`：`buildTableL4Map` 改用橫線 + 正規化 stored l4Number (commit 7606d16)
  - `src/utils/storage.js`：`loadFlows` 載入時自動把舊 localStorage 資料轉為橫線 (commit cbc90e0)
  - `src/diagram/layout.js`：L4 `l4Numbers` 產生用橫線 (commit a48c71c)
  - `src/components/Wizard.jsx`：regex、placeholder、preview、錯誤訊息 (commit 643a3d5)
  - `src/components/HelpPanel.jsx`：文件範例 (commit ef370c2)
  - `src/components/ChangelogPanel.jsx`：2026-04-17 / 2026-04-20 條目

## 4. Changelog 維護（`src/components/ChangelogPanel.jsx`）

- `CHANGELOG` 陣列採 **newest first**（最新的放在最前面）
- 條目格式：
  ```js
  {
    date: 'YYYY-MM-DD',
    title: '簡短標題',
    items: ['...', '...'],
  },
  ```
- 每次功能更新後必須新增一筆

## 5. 編碼與語言

- 所有中文內容使用 **raw UTF-8**，不得用 `\uXXXX` 跳脫
- 註解與文件以使用者的語言（繁體中文）為主

## 6. 編輯原則

- 優先使用 `Edit` 改既有檔案，避免新增多餘檔案
- 除非使用者明確要求，不新增文件檔 (*.md)
- 不添加無意義註解（只在 WHY 非顯而易見時才加）
- 任務若太大會造成 timeout，**先用 TodoWrite 拆成多個小步驟**再執行

## 7. 對話狀態維護

- 每次更新後同步維護此 CLAUDE.md
- 定期輸出進度摘要，保留關鍵 commit SHA 與待辦狀態
- 若切換環境（如 sandbox 重置），以 remote 分支為真實來源

## 8. 功能完成檢查表（每次合併 PR 前必跑）

每次完成一個功能、準備合併到 `main` 前，依序確認：

1. **Changelog 條目**：`src/components/ChangelogPanel.jsx` 最前面新增今天日期的記錄（格式見規則 4）
2. **CLAUDE.md 同步**：若本次變動涉及下列規則範圍，更新對應章節：
   - 改動編號格式 / regex → 規則 3（同步調整 regex 常數）
   - 新增/刪除檔案 → 規則 9（孤兒檔案清單）
   - 更改工作流程 / push 方式 → 規則 1 / 2
3. **程式碼品質**：本次變動是否引入了新的孤兒檔案？package.json 是否有新的未使用 deps？若有，列入 TODO 或當次清理
4. **git 狀態**：`git status` working tree clean、無未 push commit
5. **PR 流程**：用 `mcp__github__create_pull_request` 建 PR → `mcp__github__merge_pull_request` 以 **squash** 合併
6. **本地同步**：`git fetch origin main && git reset --hard origin/main`（或切到 main 後 reset）
7. **回報給使用者**：commit SHA、部署網址、驗證清單、可能的後續調整

也可以直接叫 `/ship-feature` skill（定義於 `.claude/skills/ship-feature.md`），會按此檢查表一步步跑。

## 9. 已清理的孤兒檔案（勿再建立）

以下檔案已於 2026-04-20 從 repo 移除（commits 61f5ca0 → 2b27af6），功能已由其他檔案取代，請勿再新增這些名稱的檔案：

| 已刪檔案 | 取代者 / 原因 |
|---|---|
| `src/components/FlowViewer.jsx` | 功能併入 `FlowEditor.jsx` |
| `src/components/InputPanel.jsx` | 舊版 YAML 輸入面板，已棄用 |
| `src/components/DiagramPanel.jsx` | 被 `DiagramRenderer.jsx` 取代 |
| `src/utils/parser.js` | 舊版 YAML parser，棄用 |
| `src/utils/layout.js` | 與 `src/diagram/layout.js` 無關，舊版孤兒 |
| `src/utils/vsdxExport.js` | 未使用；`drawioExport.js` 為唯一匯出 |
| `src/constants/colors.js` | 被 `src/diagram/constants.js` 取代 |
| `src/constants/defaultInput.js` | 只給已刪的 InputPanel 用 |
| `swimlane.html` | 舊版獨立 HTML，已遷移至 React + Vite |

相關可移除 deps：`js-yaml`、`jszip` 已於 2026-04-21 移除（伴隨孤兒檔案清理）。

## 10. 協作共同規則與 Insight（從歷次協作歸納，持續累積）

### 10.1 業務 / 設計規則（按重要性）

1. **規則 1：端點不混用** — 任一元件的 port 不可同時 IN + OUT。違反規則 1 比線段交叉更嚴重。
2. **規則 2：避免視覺重疊** — 線段不可跨過任務矩形；重疊時**優先改端點（source 上下、target 上下），其次改路徑**。
3. **規則 3：依 target 順序排列 slot** — 多條連線並存時，按 target 欄位由左到右決定 slot 內外順序（top 最內 = slot 0；bottom 最外 = slot 0，方向相反）。
4. **規則 4：編號顯示分層** — 流程圖上只顯示 L3 / L4 的「正式編號」；start（`-0`）、end（`-99`）、閘道（`_g*`）的編號僅作辨識用，**不顯示在流程圖上**。編輯介面（task card、下拉選單）仍顯示全部編號。

### 10.2 技術 / 工程慣例

- **`src/diagram/layout.js` 是路由主腦**：phase-based（Phase 1 sibling → Phase 2 target entry → Phase 3 跨閘道衝突 → Phase 3b 任務 backward → Phase 3c 任務 forward 長跳欄 → Phase 3d 跨列 forward 障礙避開 → 上下 corridor slot 分配）。每個 phase 只處理一種情境，改動前先認清影響範圍。新 phase 要 reuse `hasIn / hasOut / isColInsideTopRange / useIn / useOut / taskAt` 等共用 helper，不要重複實作。
- **改 routing 必做 trace 驗證**：寫個 `/tmp/trace-*.mjs` 小腳本 mock flow 呼叫 `computeLayout`，印出所有 `connections` 的 `exitSide / entrySide`。**千萬別假設「build 過 = 邏輯對」**。歷史教訓：Phase 3d 混用判斷方向寫反、corridor 降級忘了檢查混用，兩次都是沒 trace 就報「完成」造成來回。
- **端點混用檢查方向要對**：新增 OUT 時檢查 `hasIn`（source 同 port 是否已有 IN）；新增 IN 時檢查 `hasOut`（target 同 port 是否已有 OUT）。**同方向多條並不算混用**。
- **Corridor 降級也要再檢查一次混用**：top 不行退到 bottom 前要檢查 bottom 是否也會混用；top / bottom 都會混用時，優先 top（視覺交叉屬規則 2、端點混用屬規則 1）。
- **Excel I/O 向後相容**：匯出只產新格式；匯入用放寬的 regex 同時吃新舊格式（例如迴圈返回同時吃「迴圈返回，序列流向 X」、「迴圈返回至 X」、「迴圈返回 X」）。
- **CJK / Latin 混合文字**：任何 wrap / truncate 都要 token-aware（CJK 逐字、Latin 整字不切），權重用 CJK = 2 / Latin = 1，maxChars 解讀為 CJK 等效寬度。
- **文件同步三件組**：程式邏輯改動 → `ChangelogPanel.jsx` 加條目 + `HelpPanel.jsx` 改規則表 + `HANDOVER.md` 改 phase 清單 / PR 範圍。三者漏一都算沒做完。
- **日期用 `date +%Y-%m-%d` 取**，不要依賴記憶或 session context（04-22 被寫成 04-23 的教訓）。

### 10.3 協作流程

- **小改動 / 明確需求**：直接動手。
- **大改動 / 多種解法 / 跨檔案影響**：先提**計畫 + 主要 tradeoff（2–3 句）**，使用者點頭再執行。
- **PR 走 branch → squash merge**：Claude 開分支 push → 使用者在 GitHub 網頁建 PR + merge → Claude 合後 `git fetch origin main && git reset --hard origin/main` 清乾淨 + 刪掉已合併的本地分支。
- **分支衝突解法**：Claude 的分支若基於前一個未合併的 PR，等前面 PR 合併後直接 `git rebase origin/main`（git 會自動偵測 squash 後相同內容的 commit 並 skip）。
- **使用者回報「還是有同樣問題」**：不是重新想辦法，**先 trace 原始 fix 是否真的生效**。90% 是條件寫反 / 漏檢查某情境 / 順序依賴造成沒套用。

### 10.4 使用者偏好

- 回應**簡潔**，不要長篇大論複述思路。
- 大改動前提**計畫讓使用者核可**，不要「先做再說」。
- Changelog 條目**引用使用者原話**當規則來源錨點（例：「使用者：「不能讓一個元件的端點同時有進入和出發」」），比乾巴巴的技術描述更有價值。

---

## 當前待辦狀態

（由 TodoWrite 即時管理，此處僅記錄跨 session 需要保留的項目）

- 目前無待辦（`js-yaml`、`jszip` 已於 2026-04-21 從 package.json 移除）

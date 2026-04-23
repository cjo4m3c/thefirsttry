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

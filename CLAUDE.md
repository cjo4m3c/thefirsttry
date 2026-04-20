# CLAUDE.md — FlowSprite 專案長期規則

本檔案由 Claude 自動維護，記錄所有跨對話的長期規則與慣例。
每次調整規則後須同步更新此檔並 push 到 remote。

---

## 1. 儲存庫與分支

- **GitHub repo**：`cjo4m3c/FlowSprite`
- **開發分支**：`claude/push-swimlane-files-Jd8k1`（所有修改都推到此分支）
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

- **L3 編號**：`1-1-1`（三層橫線分隔）
- **L4 編號**：`1-1-1-1`（L3 編號 + `-` + 序號）
- 格式驗證 regex 同時相容點與橫線：`/^\d+([.-]\d+)*$/`
- Excel 匯入：若原始資料用點分隔，系統自動正規化為橫線
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

## 8. 已清理的孤兒檔案（勿再建立）

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

相關可移除 deps（尚未移除，因 package.json 手動更新才保險）：`js-yaml`（被 parser.js 使用）、`jszip`（被 vsdxExport.js 使用）。

---

## 當前待辦狀態

（由 TodoWrite 即時管理，此處僅記錄跨 session 需要保留的項目）

- [可選] 手動移除 `package.json` 的 `js-yaml`、`jszip`（清理孤兒檔案後已無引用）

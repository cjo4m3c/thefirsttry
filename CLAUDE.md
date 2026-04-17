# FlowSprite — Claude Code 開發規則

> 每次開新對話時，Claude Code 會自動讀取本檔案，請將所有長期規則寫在這裡，
> 避免每次都要重新說明。

---

## 專案概覽

- **專案名稱**：FlowSprite — BPM Flow Designer
- **Repo**：`cjo4m3c/thefirsttry`（GitHub Pages 部署）
- **技術棧**：React + Vite + Tailwind CSS（SPA）
- **儲存**：localStorage（key: `bpm_flows_v1`）
- **部署**：GitHub Actions → GitHub Pages（push 到 main 自動觸發）

---

## 分支策略

- **開發分支**：`claude/swimlane-diagram-generator-M1PcC`
- **所有修改 commit 到此分支**；除非使用者明確要求，不要 push 到 `main`
- **不要主動建立 PR**（使用者會自己決定什麼時候開）

---

## 編號格式（重要）

- **L3 活動編號**：橫線分隔，例 `1-1-1`、`2-3-4`（**不是**點分隔）
- **L4 任務編號**：橫線分隔，例 `1-1-1-1`
- Excel 匯入同時相容新舊格式（橫線或點分隔），但輸出一律用橫線
- 相關檔案：`src/utils/taskDefs.js`、`src/utils/excelImport.js`、`src/utils/excelExport.js`、`src/diagram/layout.js`、`src/components/Wizard.jsx`

---

## 更新紀錄（重要）

**每次功能更新都必須在 `src/components/ChangelogPanel.jsx` 的 `CHANGELOG` 陣列最前面新增一筆**：

```javascript
{
  date: 'YYYY-MM-DD',
  title: '簡短標題',
  items: [
    '條列說明 1',
    '條列說明 2',
  ],
},
```

- 最新的放最上面（newest first）
- 日期以實際修改當天為準
- 修 bug、調樣式、重構都要記錄

---

## Git 操作注意事項

### git push 被封鎖

本機 `git push` 會被 proxy 攔截，回傳 **HTTP 503**。
**不要嘗試用 `git push`**，改用下列方式：

### 推檔案到 remote 的正確方式

使用 MCP 工具 `mcp__github__push_files`：

```
owner: cjo4m3c
repo: thefirsttry
branch: claude/swimlane-diagram-generator-M1PcC
files: [{ path, content }]
message: 'commit message'
```

- **一次只推 1–2 個檔案**，避免 stream idle timeout
- 中文用 raw UTF-8，不要 `\uXXXX` 跳脫（payload 大 6 倍）
- 每個檔案內容要完整（MCP 是覆蓋式寫入）

### 本機 commit 正常

`git add` / `git commit` 沒問題，只有 push 不行。

---

## 避免 Stream Idle Timeout 的做法

**症狀**：`API Error: Stream idle timeout - partial response received`

**原因**：對話 context 太長 + 大檔案（300+ 行）+ 中文字 → 模型推論變慢 → 閒置上限觸發。

**做法**：

1. **小步快跑**：每個任務只做一件事，做完就回報，不要連鎖一堆動作
2. **一次推一個檔案**：不要批次 push 多個 300+ 行 JSX
3. **對話過長就開新的**：CLAUDE.md 會自動帶規則，不怕丟失
4. `/compact` 本身在超長對話也可能 timeout，這時直接開新對話更快

---

## 程式碼風格

- 不要加沒必要的註解（識別字命名良好就不用解釋 what）
- 只在 WHY 非顯而易見時寫短註解（特殊約束、workaround、隱性不變式）
- 不要建立額外文件檔（`*.md`、README）除非使用者要求
- 不要引入沒用到的抽象（過早抽象比重複更糟）
- 不要為假想情境加 error handling / fallback

---

## 檔案位置速查

| 功能 | 檔案 |
|------|------|
| 編號生成 / L4 編號 | `src/utils/taskDefs.js`、`src/diagram/layout.js` |
| Excel 匯入 | `src/utils/excelImport.js` |
| Excel 匯出 | `src/utils/excelExport.js` |
| draw.io 匯出 | `src/utils/drawioExport.js` |
| 精靈表單 | `src/components/Wizard.jsx` |
| 流程圖渲染 | `src/components/DiagramRenderer.jsx`、`src/diagram/layout.js` |
| 統一編輯介面 | `src/components/FlowEditor.jsx` |
| 首頁 | `src/components/Dashboard.jsx` |
| 更新紀錄 | `src/components/ChangelogPanel.jsx` |
| 規則說明 | `src/components/HelpPanel.jsx` |

---

## 目前待推送檔案（2026-04-17）

下列本機已修改但尚未推到 `claude/swimlane-diagram-generator-M1PcC` 的檔案：

- [ ] `src/components/ChangelogPanel.jsx`
- [ ] `src/components/Wizard.jsx`
- [ ] `src/components/HelpPanel.jsx`
- [ ] `src/components/DiagramRenderer.jsx`
- [ ] `src/components/FlowEditor.jsx`

推完請把這段清單刪掉。

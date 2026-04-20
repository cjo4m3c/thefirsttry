---
name: ship-feature
description: Complete a feature branch and deploy to production. Runs the feature-completion checklist, creates PR, squash-merges to main, syncs local. Use when the user says "ship"/"merge"/"deploy" or confirms a feature is ready to go live.
---

# /ship-feature — 功能完成並部署

把當前 feature 分支走完 PR → squash merge → 同步 local → 回報，遵循 CLAUDE.md 規則 8 的檢查表。

## 執行步驟

### 1. 確認狀態

- `git status`：working tree 應為 clean
- `git log` + `git branch --show-current`：確認在正確的 feature 分支上、所有 commit 已推到 remote
- 若有未 commit / 未推的變更 → **先停下來問使用者怎麼處理**

### 2. 跑 Changelog 檢查

- 讀 `src/components/ChangelogPanel.jsx` 最前面的條目
- 看日期是不是今天（使用者系統日期）；若不是 → 提醒使用者新增條目後再繼續
- 條目格式：
  ```js
  { date: 'YYYY-MM-DD', title: '簡短標題', items: ['...', '...'] }
  ```

### 3. CLAUDE.md 同步檢查

本次 feature 動了哪些檔案？根據以下對照表決定要不要更新 CLAUDE.md：

| 變動類型 | 需更新的 CLAUDE.md 章節 |
|---|---|
| 改編號格式 / regex | 規則 3（單一來源：`src/utils/taskDefs.js`） |
| 新增/刪除檔案 | 規則 9（孤兒清單） |
| 改 Git push / 工作流程 | 規則 1 / 2 |
| 其他核心業務規則 | 規則 3–6 對應章節 |

若 CLAUDE.md 要改，先改再進下一步。

### 4. 建 PR

呼叫 `mcp__github__create_pull_request`：
- `base`: `main`
- `head`: 當前 feature 分支
- `title`: 簡短功能描述
- `body`: 含 Summary + Test plan

### 5. 合併 PR

呼叫 `mcp__github__merge_pull_request`：
- `merge_method`: `squash`
- `commit_title`: 格式 `<feature summary> (#<PR number>)`

若回應 `Pull Request is not mergeable` → 分支與 main 有衝突，建議：
1. 關閉 PR
2. 從 main 開新分支
3. 只推本 feature 的差異檔到新分支
4. 重開 PR → merge

### 6. 同步 local

```bash
git fetch origin main
git checkout main
git reset --hard origin/main
```

### 7. 回報使用者

輸出以下資訊：
- ✅ main commit SHA
- 📍 Actions 連結：`https://github.com/cjo4m3c/FlowSprite/actions`
- 🌐 部署網址：`https://cjo4m3c.github.io/FlowSprite/`（記得 Ctrl+Shift+R 清快取）
- 🔍 本次功能的驗證清單（條列 3–5 項關鍵測試）
- ⚠️ 若有任何已知限制 / 需後續處理的，一併列出

## 注意

- 整個流程中若任何步驟失敗 → 停下來問使用者，**不要繼續**
- 使用者若說「先合併，changelog 晚點補」→ 可略過步驟 2，但完成後要提醒
- 使用者若說「只推改動不要 merge」→ 只做步驟 1、建 PR，不合併

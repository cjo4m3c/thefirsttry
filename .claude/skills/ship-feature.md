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

| 變動類型 | 需更新的章節 |
|---|---|
| 改編號格式 / regex | `CLAUDE.md` 規則 3（單一來源：`src/utils/taskDefs.js`）|
| 新增/刪除檔案 | `CLAUDE.md` 規則 9（孤兒清單） |
| 改 Git push / 工作流程 | `CLAUDE.md` 規則 1 / 2 |
| **新增/刪除 元件**（`src/components/*.jsx`）| 同步更新 `README.md` + `HANDOVER.md` 元件清單樹 |
| **新增 / 刪除 skill**（`.claude/skills/*.md`）| 同步更新 `README.md` + `HANDOVER.md` skill 清單 |
| **新增浮動 UI**（drawer / popup / tooltip）| 同步更新 `.claude/skills/ui-rules.md` §10 浮動元件 pattern |
| 其他核心業務規則 | `CLAUDE.md` 規則 3–6 對應章節 |

若任何文件要改，先改再進下一步。

### 3.5 七視圖一致性 + 單檔大小檢核（每次 PR 必跑）

跑 **`/sync-views` skill**（定義於 `.claude/skills/sync-views.md`），它會：

1. `find src -type f \( -name "*.js" -o -name "*.jsx" \) -size +15k` — 確認無超大檔案
2. `grep` 確認沒有把 `src/model/` 該共用的邏輯寫死在視圖層
3. 列出七視圖人工 walk 清單

若 size check 命中 > 20KB → **停下來開拆檔 PR**，本功能 PR 等拆檔合併後 rebase 再繼續。

至少在本地 `npm run dev` 驗證最關鍵 4 view：流程圖（DiagramRenderer）/ drawer 設定流程 tab / 下方 Excel 表格（FlowTable）/ 下載 Excel L4 編號。詳見 `sync-views.md`。

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

### 6.5. Changelog 日期 audit（新規 2026-05-06，CLAUDE.md §4 第 5 條對應實作）

跨 UTC 日界 merge 容易踩到 changelog `date` 跟 PR `merged_at` 不一致的雷（例：使用者本地時間 11:00 寫條目 = 跑「今天日期」；merge 在 04:00 UTC = `merged_at` 是同一天；但若 23:30 寫條目然後跨日 merge → 日期會差一天）。每次 ship 自動跑 audit 防止漏。

執行：

1. 從步驟 5 的 `mcp__github__merge_pull_request` 回應 / 步驟 4 建 PR 的 PR number 取 `merged_at`：呼叫 `mcp__github__pull_request_read` action `get` 拿 `merged_at` ISO 字串前 10 字（`YYYY-MM-DD`）
2. 讀 `src/data/changelog/current.js`，抓第一筆 entry（已 sync main，所以是剛 merge 的內容）的 `date: 'YYYY-MM-DD'`
3. 比對：
   - **一致**：✅ 通過，繼續步驟 7
   - **不一致**：⚠️ 列出兩個日期 + 對應 PR 號，告訴使用者「請開一個 follow-up PR 修 changelog date：把第一筆 `date` 從 `<written>` 改成 `<merged_at>`」。**不要自動 push 到 main**（main 通常 protected；違反一 PR 一變更的慣例）；也**不要繼續步驟 7 的回報**直到使用者確認要不要開修正 PR

實作提示：

```
PR_NUMBER = (從步驟 4 / 5 取得)
merged_at = mcp__github__pull_request_read({ method: 'get', pullNumber: PR_NUMBER }).merged_at[:10]
changelog_date = (Read src/data/changelog/current.js → 第一筆 date 欄位)
if merged_at !== changelog_date:
  output("⚠️ Changelog date mismatch: written `${changelog_date}`, PR merged at `${merged_at}`. 建議開 follow-up PR 修正。")
  STOP — 不繼續到步驟 7
else:
  continue
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

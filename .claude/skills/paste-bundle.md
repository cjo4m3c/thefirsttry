---
name: paste-bundle
description: Generate manual-paste instructions for files that can't be pushed via MCP (>15KB timeout-prone). Use when local `git push` is blocked (proxy 503) AND `mcp__github__create_or_update_file` times out or is expected to time out due to file size. Produces file-by-file, hunk-by-hunk guides with GitHub edit URLs, search anchors, and before/after snippets.
---

# /paste-bundle — 手動貼上流程（檔案 >15KB 時的備援）

當 MCP push 會 timeout（歷史上 >15KB 大檔常卡住），走這個流程讓使用者在 GitHub 網頁編輯器逐檔、逐 hunk 手動貼。

## 前置條件

- 當前在 feature branch，工作區有未推的修改
- `npm run build` 已 pass（確認本地改動無誤）
- 至少一個 trace script `/tmp/trace-*.mjs` 已驗證邏輯（改 layout 或資料層邏輯時必跑）

## 執行步驟

### 1. 分檔策略

用 `git diff --stat origin/<current-branch>` 或 `origin/main` 看每檔大小：

| 檔案目前大小 | 推送方式 |
|---|---|
| <7KB | `mcp__github__create_or_update_file` 最穩（含 auto-fetch SHA） |
| 7-15KB | 可試 MCP，失敗退回手動貼 |
| >15KB | **直接走手動貼，不要試 MCP**（歷史上幾乎都 timeout） |

**注意**：MCP 需要檔案 **在 remote 當前的 blob SHA**（不是本地 main 的）。用 `mcp__github__get_file_contents` 先抓 SHA，不要假設本地 `git rev-parse main:<path>` 就是對的 — remote 可能因 line-ending / 編碼正規化產生不同 SHA。

### 2. 手動貼上指引格式（一檔一份）

對每個需手動貼的檔案，產出這個結構：

```markdown
## N / 共 M 步：<filename>（<hunk 數> 處改動）

**URL**：https://github.com/cjo4m3c/FlowSprite/edit/<branch>/<path>

### 步驟 A — 找位置（hunk 1）

按 `Ctrl+F` / `Cmd+F` 搜尋：

`<unique anchor string that appears exactly once in the file>`

會看到：
` ``jsx
<current code showing 2-3 lines before + matching line + 2-3 lines after>
` ``

### 步驟 B — 改成

` ``jsx
<new code with the same surrounding context, changes obvious>
` ``

（repeat for each hunk）

### 步驟 C — 預覽 + Commit

1. 點「Preview changes」— 應該只看到綠色新增 / 替換，**不應有意外大塊紅色刪除**
2. Commit message 標題：`<short imperative description>`
3. 確認選「Commit directly to `<branch>`」（不要新建 branch）
4. 按「Commit changes」
```

### 3. hunk 切分原則

- **小檔（1-2 hunk）**：一則訊息給全部，使用者一次做完
- **中檔（3-5 hunk）**：一則訊息給全部，但**排列從最簡單到最複雜**，給使用者信心
- **大檔（>5 hunk）**：選一種:
  - **(a)** 一則訊息全給，使用者自己跟節奏（適合經驗使用者）
  - **(b)** 一次給 1-3 hunk，使用者說 OK 再下一批（適合新手 / 複雜 JSX 改動）

預設走 (b) — 複雜 JSX 貼錯機率高。使用者要 (a) 的話會主動說「一次給我全部」。

### 4. 常見貼錯 + 預防

| 錯誤 | 預防 |
|---|---|
| 多 / 少 `}` / `)` / `</div>` | 改動點前後多引 2-3 行 context，貼上後叫使用者比對閉括號 |
| 搜尋錨點不唯一，找錯位置 | 挑**檔案內只出現一次**的字串當錨點（function name、comment 標記、特定變數） |
| 縮排跑掉（tab vs space） | 在貼上指引最後加「⚠️ 注意縮排用 2 空格，不是 tab」 |
| 漏掉「Preview」一步就 Commit | 每檔步驟 C 都明寫要先 Preview |
| **重複貼**（常見）：使用者「整段換成」時，把舊行留著 + 又插入新行 → 同一 prop / 同一 tag 出現兩次 | **Before / After 必須完整閉合**：每個 `**搜尋** anchor` + `會看到：`（before 完整片段）+ `改成：`（after 完整片段）。**before 跟 after 的「頭尾」要相同錨點**（例如兩者都從 `function X({` 開頭、都從 `}) {` 結尾），讓使用者能明確圈選前者、整體覆寫成後者。不要只給「改從這行起」的開放結尾 |
| **被誤刪的分支**：使用者 find-replace 範圍比我給的 before 大，把下一個 `} else if` / `</tag>` 一併刪掉 | Before 片段**必須涵蓋到下一個穩定錨點**（下一個空行、下一個 function 開頭、下一個 `</Component>`）。不要只給「到第 X 行為止」這種可能被誤讀的界線。如果 after 不需要改後面的部分，在 after 片段結尾把後面那 1-2 行**原樣重複**，當 boundary marker |
| 貼完後**一次**出 6 個 syntax 錯（同一輪） | 每個大 hunk 貼完後讓使用者說 `OK` 再下一個 — 發現時是單點錯，不是複合錯。**不要一次把所有 hunk 都放進一則訊息**（除非檔案很小） |

### 5. 檔案之間的排序

**從最簡單最小檔先推**（增加使用者信心，且早點發現是否能順利貼）：

1. 設定類 / Changelog / 文件（純文字插入，風險低）
2. Data model / 函式 / helper（邏輯改動，單一檔）
3. UI / 複雜 JSX / 路由邏輯（最後做，最容易貼錯）

### 6. 互動模式

預設走「逐檔引導」:

1. 「從最小的開始。一次一檔，每檔完成說 `OK`，我再帶下一檔。」
2. 每檔前：給 URL + 該檔所有 hunk
3. 使用者說 OK → 立刻 `git fetch origin <branch>` + 比對 remote 跟本地差異
4. 若 remote 對了 → 帶下一檔
5. 若 remote 有錯（如 JSX syntax） → 跑 `npm run build` 抓錯、提供 1 行修正指引、commit 後繼續

### 7. 全部貼完後的收尾

1. `git fetch origin <branch>`
2. `git reset --hard origin/<branch>`
3. `npm run build` 驗證
4. 跑所有 `/tmp/trace-*.mjs` 再驗一次（確認貼上過程沒弄壞邏輯）
5. 若有 stash 備份（working-tree diff 用的）→ `git stash drop` 清掉
6. 給使用者：
   - 最終 commit SHA
   - 驗證清單（該功能該怎麼手動測）
   - PR 連結範本：`https://github.com/cjo4m3c/FlowSprite/compare/main...<branch>`

## 常見觸發時機

- 使用者回報 "MCP 推一直 timeout"
- 本地有 >15KB 檔要推，確定不試 MCP
- 多檔合併成一個 PR，MCP 一次一檔太繁瑣
- 使用者明確說「我手動貼」

## 反模式（不要這樣做）

- ❌ **給使用者整檔內容叫他全選替換**：CLAUDE.md §2 明禁（「錯誤率太高」）
- ❌ **多檔同時進行**：使用者會亂、我會忘記順序。一次一檔
- ❌ **沒給搜尋錨點就說「找第 XXX 行」**：行號會因前面改動而偏移
- ❌ **沒提醒 Preview changes 就叫 Commit**：JSX syntax 錯會直接進 remote
- ❌ **貼上後不跑 `git fetch + build` 驗證**：typo 可能擋 GitHub Pages 部署

## 備註：本 skill 誕生於 PR G+J（2026-04-24）

PR G+J 合併過程做 5 個檔的手動貼上（CLAUDE.md 小、ChangelogPanel / FlowEditor / layout / DiagramRenderer 大），反覆走同樣的 pattern。DiagramRenderer 貼錯一個 `</div>` 擋 build，reinforce 了「每檔結束要 `git fetch + build` 驗證」的必要。

## 2026-04-24 更新：PR H+I 的 6 次 paste 失誤歸納

PR H+I 一輪貼了 3 個大檔，build 連續失敗 6 次，每次都是同一類型的結構錯誤。所有錯誤可歸成兩個 root cause：

1. **「整段換成」被使用者讀成「整段接在後面」**（5/6 案例） — 出現 duplicate：
   - `onUpdateOverride={...}` 被貼 2 行
   - `updateTask(fromTaskId, updated);` + `}` 被貼 2 次
   - `</defs>` 兩個
   - `ConnectionArrow({...})` 簽名 2 行
   - `{selectedConnKey && (` + `<>` 貼 2 次
2. **Before 範圍不完整 → 下個穩定錨點被吞掉**（1/6 案例） — `} else if (hoveredConnKey === connKey) {` 整個分支被誤刪；`</div>` + `)}` 結尾被吞

**新增的防禦措施**（見 §4 表格）：
- Before / After 必須完整閉合（頭尾錨點相同）
- Before 涵蓋到下個穩定錨點（空行 / function 開頭 / `</Component>`）
- After 不改後面部分時，把後面 1-2 行原樣重複當 boundary
- 大檔案 hunk 要一次一個（等 `OK` 再下一個），避免失誤複合成 6 個錯

回顧這輪：若當時走「一 hunk 一訊息 + 等 OK」 + before/after 都完整閉合，應該不會全壞。

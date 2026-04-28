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
- 推送主要透過 `mcp__github__push_files` 或 `mcp__github__create_or_update_file`（單檔 <7KB 最穩）
- **一次只推 1 個檔案**，避免 stream idle timeout；每推完一個回報一次
- **大檔案 timeout 處理 SOP（硬性規則，每次遵循）**：
  1. 先用 `wc -c <path>` 算大小；**> 15KB 就直接走手動**，不要試 MCP push
  2. 若不確定大小或 < 15KB 邊界值，**MCP push 試一次**；若 timeout / 失敗 → **立即切手動，禁止重試**（重試只會再 timeout 浪費時間）
  3. 手動步驟給使用者：
     - 提供 GitHub edit URL：`https://github.com/cjo4m3c/FlowSprite/edit/<branch>/<path>`
     - 提供完整檔案內容（用 fenced code block 或 attachment）
     - 提供 commit message 範本
     - 說明：使用者貼上 → Commit changes → 回報完成
  4. 使用者回報手動完成後，本地 `git fetch origin <branch> && git reset --hard origin/<branch>` 同步
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
- 每次功能更新後必須新增一筆
- **一 PR 一條 changelog**：同一個 PR 內一起手動更新 / 一起推 / 一起發的改動（feature + 修 bug + 調 UI 等），**合併成同一筆 changelog** — 不拆成多筆。在 `items` 內用 `**主題**：...` 分段；搭配次的 bug fix 單獨列一項（例如「**Fix（順帶）**：...」）即可，不另開一筆

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

1. **七視圖一致性檢核（每次修正後立即跑，不限 PR 前）** — 使用者明確要求：「現在開始所有的更新都要再更新後，同步確認包含網頁中流程圖、網頁首頁、網頁表格欄位、編輯器、下載的三種資料，都有同步資訊」。動到 task / role / connection / 編號 / 顯示文字後，**逐項勾**七個視圖都用同一份 `liveFlow.tasks` + `computeDisplayLabels`：

   | # | 視圖 | 入口檔案 |
   |---|---|---|
   | ① | 網頁首頁卡片 | `Dashboard.jsx`（L3 列表 + 摘要） |
   | ② | 網頁中流程圖 | `DiagramRenderer.jsx` + `src/diagram/layout.js` |
   | ③ | 編輯器（drawer flow tab + roles tab + Wizard） | `FlowEditor.jsx` + `RightDrawer.jsx` + `Wizard.jsx` |
   | ④ | 網頁表格欄位（流程圖下方 Excel 表） | `FlowTable.jsx` |
   | ⑤ | 下載資料：Excel | `excelExport.js` |
   | ⑥ | 下載資料：drawio | `drawioExport.js` |
   | ⑦ | 下載資料：PNG | `DiagramRenderer.handleExport`（`html-to-image`） |

   重點檢查：編號（`computeDisplayLabels` 是唯一 source of truth）、任務名稱、角色順序、連線目標、閘道種類，**任何一個視圖殘留舊值就算這次修正未完成**。歷史教訓：FlowTable `useEffect` deps 漏掉 `flow.tasks`（PR #70）→ 流程圖更新但表格不動；`buildTableL4Map` 自己一套 counter（commit 7606d16 之前）→ Excel 編號跟畫面對不上。

2. **Changelog 條目**：`src/components/ChangelogPanel.jsx` 最前面新增今天日期的記錄（格式見規則 4）
3. **CLAUDE.md 同步**：若本次變動涉及下列規則範圍，更新對應章節：
 - 改動編號格式 / regex → 規則 3（同步調整 regex 常數）
 - 新增/刪除檔案 → 規則 9（孤兒檔案清單）
 - 更改工作流程 / push 方式 → 規則 1 / 2
4. **程式碼品質**：本次變動是否引入了新的孤兒檔案？package.json 是否有新的未使用 deps？若有，列入 TODO 或當次清理
5. **git 狀態**：`git status` working tree clean、無未 push commit
6. **PR 流程**：用 `mcp__github__create_pull_request` 建 PR → `mcp__github__merge_pull_request` 以 **squash** 合併
7. **本地同步**：`git fetch origin main && git reset --hard origin/main`（或切到 main 後 reset）
8. **回報給使用者**：commit SHA、部署網址、驗證清單、可能的後續調整

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
5. **規則 5：流程儲存檢核兩層（FlowEditor `validateFlow`）** — **Blocking（擋儲存）**：必須有開始事件、必須有結束事件、開始事件必須有 outgoing、結束事件必須有 incoming。**Warning（跳 modal 由使用者決定）**：① 非結束節點必須設定下一步、② 並行合併 ≥2 來源、③ 條件合併 ≥2 來源、④ 每個節點必須被連接（除開始外）、⑤ 迴圈返回必須指定目標。新增其他規則時照此分層，blocking 寧缺勿濫（只放「結構不合法、儲存了也不能用」的規則）。

### 10.2 技術 / 工程慣例

- **`src/diagram/layout.js` 是路由主腦**：phase-based（Phase 1 sibling → Phase 2 target entry → Phase 3 跨閘道衝突 + sibling-sharing fallback → Phase 3b 任務 backward → Phase 3c 任務 forward 長跳欄 → Phase 3d 跨列 forward 障礙避開 → 上下 corridor slot 分配）。每個 phase 只處理一種情境，改動前先認清影響範圍。新 phase 要 reuse `hasIn / hasOut / isColInsideTopRange / taskAt / horizontalPathHasObstacle / corridorBlockedByFuturePhase3dVertical / useIn / useOut` 等共用 helper，不要重複實作。
- **改 routing 必做 trace 驗證**：寫個 `/tmp/trace-*.mjs` 小腳本 mock flow 呼叫 `computeLayout`，印出所有 `connections` 的 `exitSide / entrySide`。**千萬別假設「build 過 = 邏輯對」**。歷史教訓：Phase 3d 混用判斷方向寫反、corridor 降級忘了檢查混用，兩次都是沒 trace 就報「完成」造成來回。
- **端點混用檢查方向要對**：新增 OUT 時檢查 `hasIn`（source 同 port 是否已有 IN）；新增 IN 時檢查 `hasOut`（target 同 port 是否已有 OUT）。**同方向多條並不算混用**。
- **Corridor 降級也要再檢查一次混用**：top 不行退到 bottom 前要檢查 bottom 是否也會混用；top / bottom 都會混用時，優先 top（視覺交叉屬規則 2、端點混用屬規則 1）。
- **Sibling 共用 > 穿過任務 > 長垂直 corridor**：當 sibling 已佔用第一優先 exit，後續 sibling 優先用「橫向 L-path 不穿過任務」(`horizontalPathHasObstacle`) + 「top/bottom 垂直跨距 ≤1 列」檢查；都不成立走 Pass 2 sibling-sharing priority walk（照 priority list 再走一次、允許共用 sibling 已佔用的 port、仍擋 port-mix / 橫向 obstacle / 長垂直）；Pass 2 也不成立才退回 Pass 3 legacy fallback（`priorities[0]` + `entry=left`/`right`/`top`/`bottom`）。
- **Phase 3 corridor guard 要真實模擬 Phase 3d**：`corridorBlockedByFuturePhase3dVertical` 不能只看「內側有任務的 cross-row forward next」就擋，因為 Phase 3d 可能走預設（垂直在 midX）或 Option A（垂直在 tc），都不切 corridor。必須同時滿足 `defaultBad`（Phase 3d 會觸發）+ `optionABlocked`（fall through 到 Option B）才判定 corridor 被切。
- **Corridor 要考慮「未來垂直」會不會切斷橫向段**：top corridor 內側欄位若有任務在 Phase 3d 會用 TOP/BOTTOM 垂直出發，這個 corridor 的橫向段會被切。用 `corridorBlockedByFuturePhase3dVertical` 在 Phase 3 acceptance loop 裡先擋。
- **兩條 IN 共用同一端點 OK**：「端點不能同時有進有出」只禁止 IN + OUT 混用；IN + IN 是允許的（2026-04-23 回退 `expectedBackwardTopEntry` pre-scan 的原因）。Phase 3 選 entry 時不必刻意閃 backward edge 的同 port。
- **Phase 3d cross-edge 重疊偵測**：除了任務矩形 obstacle，也要檢查「default midX 路徑會不會跟其他 Phase 3d 連線的 midX 垂直段交叉」。做法：pre-collect 所有 Phase 3d-eligible 邊 → 對每條邊的 default，檢查其他邊的 midX 垂直段是否落在我的橫向範圍內，且其他邊的 row 範圍覆蓋我的 fr / tr（反之亦然）。若會交叉 → `defaultBad = true` 觸發 Option A / B，避開視覺交叉。
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

（由 TodoWrite 即時管理；此處保留跨 session 需要記得的 backlog，來源：2026-04-28 交接 §5 + 同日 K/L PR 收尾新增）

### 立即可動 / Bug

- **B. layout 同欄對齊** — fork 兩分支步數不等時，短分支末段對齊到長分支同欄；含使用者要求的「包容、並行閘道後方任務對齊」。推薦解法 A（`alignForkBranches` post-pass），先開 `claude/preview-layout-same-column` 預覽分支驗證。動手前須跟使用者確認 §10.6 四個問題
- **P. 全頁儲存連動 BUG**（使用者：「儲存要整頁一起存，不能下方 excel 編輯後 上方的調整都不見了，應該要是不管在哪裡編輯後所有內容都要連動修正（編輯器、流程圖、下方表格）」）— FlowEditor / DiagramRenderer 互動 / FlowTable 三處互改後內容要連動，目前 FlowTable 編輯後上方未儲存的調整會被覆蓋。需把 hasChanges + source-of-truth 整合到頂層 state
- **S. tooltip 新增連線無法選 L3 BUG**（使用者：「現在 tooltip 新增連線無法選到圖上的 L3」）— `ContextMenu` 連線下拉漏掉 L3 activity 任務；`ConnectionSection.jsx:11` filter 已對 gateway 例外，需同樣對 L3 activity 例外

### 規格已明確、可排程

- **Q. 新增閘道時自動補閘道名稱到任務說明**（使用者：「新增閘道時，任務說明自動補上閘道名稱」）— 已有 `applyGatewayPrefix` 補 `task.name`；需同步補 `task.description`（如「[並行閘道] 用於同時處理多個分支」自動填入）
- **R. 新增 L3 流程顯示編號規則**（使用者：「新增 L3 流程的時候，要直接顯示 L3 編號，不可以有 L4 編號出現」）— Wizard 新增頁應只顯示 L3 編號，目前混入 L4 編號預覽要去掉
- **T. 新增閘道時可同步編輯分支條件**（使用者：「新增閘道時，要可以同步編輯分支條件（現在不行）」）— `ContextMenu` 新增閘道 sub-form 加 condition 編輯欄位（目前只能新增閘道殼，再去主編輯區改條件）
- **U. 插入閘道操作邏輯拉齊**（使用者：「拉齊插入閘道的操作邏輯（現在圖上是插入閘道、編輯器是序列規則）」）— `DiagramRenderer` ContextMenu「插入閘道」與 `FlowEditor` 編輯器內的插入流程不一致，要統一
- **V. 儲存事件閃亮提醒**（使用者：「新增儲存事件閃亮提醒」）— 儲存按鈕被按下後加 logo 閃光 / 按鈕短暫變綠等視覺回饋（取代原 J「儲存提醒優化」的待選方向）
- **C. Phase 3.5 gateway obstacle avoidance**（`src/diagram/layout.js`）— 閘道作為跨列 forward obstacle 時走 vertical-detour
- **E. Excel Tab 內嵌編輯**（`FlowTable.jsx`）— textarea + auto-resize（與 P 一起做最順）
- **M-1. 頁首四顆按鈕風格統一**（使用者：「拉齊編輯頁右上按鈕規格」）— 儲存 / 編輯流程 / 重設手動端點 / ★
- **M-2. 流程圖頂部下載按鈕統一 + 加 Excel 鍵** — PNG / drawio / Excel 三鍵，照 `ui-rules` §2.5 三色藍
- **N. 泳道角色拖曳視覺提示** — 複用 `useDragReorder` 的 `dropAfter` + DropLine pattern

### 規格待確認、不能直接動手

- **F. Excel 部分匯入**（使用者：「只匯入＋覆蓋 excel 部分內容欄位、或自動略過部分欄位」）— 單一欄位 / 部分行覆蓋邏輯
- **G. 匯出圖等比寬度**（使用者：「匯出的圖檔要符合 ISO 文件適用寬度」）— PNG 匯出規格 / ISO A4 等比

### Nice-to-have / 有空再修

- **H. 邊側批量下載缺檔**（使用者：「批量下載數量太多時比較後面的編號會漏檔案 → 目前排解只有 edge 瀏覽器有，晚點再修」）

### 已完成（本 PR 出清，2026-04-28）

- **K. 標題 em-dash 間距修** — DONE，`DiagramRenderer.jsx:751` 改成 `　—　`（兩側全形）
- **L. 編輯頁字級放大一級** — DONE，擴大為流程圖 +40% + 編輯頁 Tailwind +1 step
- **J. 儲存提醒優化（規格不明）** — 由 V 取代

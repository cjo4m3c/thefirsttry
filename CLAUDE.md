# CLAUDE.md — FlowSprite 專案長期規則

本檔案由 Claude 自動維護，跨對話的長期規則與慣例。每次調整規則須同步更新此檔並 push 到 remote。

**詳細展開的內容拆到外部檔**（避免 CLAUDE.md 自己膨脹）：
- `docs/business-spec.md` — **業務規則單一來源**（5 條核心規則 / 閘道分類 / 編號規則 / 元件類型 / 連線型態 / 儲存檢核 / 編輯操作 / 匯出格式 / 七視圖一致性，12 章）
- `src/data/helpPanelData.js` — HelpPanel 規則摘要 data，每個 array 加 `// 對應 docs/business-spec.md §X` 章節錨點
- `.claude/business-rules.md` — Claude 工作流慣例（trace 驗證、Excel I/O 相容、CJK wrap、文件同步、協作偏好）
- `.claude/orphans.md` — 已清理的孤兒檔案
- `.claude/backlog.md` — 跨 session 待辦清單
- `HANDOVER.md` §2.5 — `src/diagram/layout/` routing 細節（dr/dc / phase / corridor）

---

## 1. 儲存庫與分支

- **GitHub repo**：`cjo4m3c/FlowSprite`
- **工作流程**：feature 分支 `claude/<name>` → push → 開 PR → **squash merge** 到 `main`；`main` push 觸發 `.github/workflows/deploy.yml` 自動部署 GitHub Pages
- **部署網址**：`https://cjo4m3c.github.io/FlowSprite/`
- **MCP scope**：GitHub MCP tools 僅允許 `cjo4m3c/flowsprite`；不得操作其他 repo

## 2. Git 推送規則

- `git push` 被 local proxy 擋下（HTTP 503），**不可使用**
- 推送主要用 `mcp__github__push_files` 或 `mcp__github__create_or_update_file`（單檔 <7KB 最穩）
- **一次只推 1 個檔案 / batch 3-4 個小檔**，避免 stream idle timeout
- **大檔案 timeout SOP（硬性）**：
  1. `wc -c <path>` 算大小；> 15KB **直接走手動**，不試 MCP push
  2. 邊界值（7-15KB）試 MCP **一次**；timeout 立即切手動，**禁止重試**（重試只會再 timeout）
  3. 手動：給使用者 `https://github.com/cjo4m3c/FlowSprite/edit/<branch>/<path>` + 完整內容 + commit message → 使用者貼上 commit
  4. 手動完成後本地 `git fetch origin <branch> && git reset --hard origin/<branch>` 同步
- **刪檔**用 `mcp__github__delete_file`（快，無 content 傳輸）
- commit message 用英文，描述變更原因
- 絕不 push 到其他分支或建 PR（除非使用者明確要求）

## 3. L3 / L4 編號格式（核心業務規則）

- **僅接受「-」分隔，不接受「.」分隔**（特殊類型才有 `_g` / `_s` 後綴）
- **L3**：`1-1-1`（三層橫線，恰好 3 段）
- **L4**：`1-1-1-1`（L3 + `-` + 序號，恰好 4 段）
- **特殊 L4 後綴**：開始 `-0` / 結束 `-99` / 閘道 `_g` 或 `_g\d+` / 子流程調用 `_s` 或 `_s\d+`（前綴必為既有 L4 任務或 `-0` 開始事件）
- **`_g` 與 `_s` 共用 anchor**：兩者都不佔順號，連續計數器互不重置（規格範例 `_s1 → _g → _s2`）
- **閘道 fork 關鍵字**（需 `_g`）：`條件分支至` / `並行分支至` / `包容分支至`
- **子流程關鍵字**（需 `_s`）：`調用子流程 X-Y-Z`（X-Y-Z 為被調用的 L3 編號）
- **不是獨立閘道**（一般任務，不用 `_g`）：merge target（`X 合併來自...`）/ `迴圈返回至 X`。詳見 `docs/business-spec.md` §4.1
- 格式驗證 regex 的**單一來源**在 `src/utils/taskDefs.js`（`L3_NUMBER_PATTERN` / `L4_NUMBER_PATTERN` / `L4_START_PATTERN` / `L4_END_PATTERN` / `L4_GATEWAY_PATTERN` / `L4_SUBPROCESS_PATTERN`）。**編號規則變更只改這幾個常數**
- Excel parser 寬鬆（容忍點分隔避免解析斷裂）；`validateNumbering` 強制 dash-only + `_g` / `_s` 前綴對應，列出所有錯誤列
- 舊 localStorage 點分隔資料在 `storage.normalizeNumber` 載入時自動轉橫線；舊閘道缺 `_g` / 舊子流程缺 `_s` 自動補（`migrateGatewaySuffix` / `migrateSubprocessSuffix`）

## 4. Changelog 維護

- 檔案：`src/data/changelog/current.js`（tip）+ `c01.js` … `cN.js`（凍結 chunks）
- `current.js` **>7KB 就凍結**：rename 成 `c{next}.js`、reset `current.js`、`index.js` 加 import。歷史教訓：原 10KB 門檻，c13 衝到 17KB，下調到 7KB 留 buffer
- `current.js` 陣列 **newest first**
- 條目格式：`{ date: 'YYYY-MM-DD', title: '簡短標題', items: ['...'] }`
- **一 PR 一條 changelog**：feature + bug fix + UI 調整合成同一筆，在 items 用 `**主題**：...` 分段
- 引用使用者原話當錨點（例：「使用者：「不能讓端點同時有進有出」」）

## 5. 編碼與語言

- 中文用 **raw UTF-8**，不得用 `\uXXXX` 跳脫
- 註解 / 文件用繁體中文

## 6. 編輯原則

- 優先用 `Edit` 改既有檔案，不新增多餘檔案
- 不新增 `*.md` 文件檔（除非使用者明確要求）
- 不加無意義註解（只在 WHY 非顯而易見才加）
- 任務太大會 timeout → 先用 TodoWrite 拆步驟
- **單檔大小上限（2026-04-28 立，源於使用者：「常常因為檔案大推不上去，很長 timeout 中斷執行」）**：
  - **Source（`.js` / `.jsx`）**：軟 15KB / 硬 20KB。> 20KB 直接擋邏輯改動，先拆檔
  - **CLAUDE.md 自身**：軟 10KB / 硬 12KB（更嚴，因為每個 PR 都動且不能 shim）— **超過就把詳細內容搬到 `.claude/<topic>.md`，CLAUDE.md 留 1 行 pointer**
  - 拆檔走「shim re-export + 子目錄」pattern，外部 import 路徑不變
  - 已拆解：`src/diagram/layout/`（11 檔）/ `src/components/DiagramRenderer/`（11 檔）/ `src/components/FlowEditor/`（7 檔）/ `src/components/HelpPanel.jsx` 26KB → 11.3KB（data 抽到 `src/data/helpPanelData.js`）
  - PR 前 `find src -type f \( -name "*.js" -o -name "*.jsx" \) -size +15k`；命中需在 PR 描述列原因或開拆檔 follow-up（`/ship-feature` / `/sync-views` 自動跑）
- **文件批次更新**：純文件類（changelog / CLAUDE.md / README / HANDOVER）累積 3-5 個小修改後一起推；程式邏輯仍是一個 feature 一個 PR

## 7. 對話狀態維護

- 每次更新後同步維護此 CLAUDE.md
- 切換環境（sandbox 重置）以 remote 分支為真實來源

## 8. 功能完成檢查表（每次 PR 前）

1. **七視圖一致性 + 單檔大小** — 跑 `/sync-views` skill。動到 task / role / connection / 編號 / 顯示文字後立即跑
2. **Changelog 條目**：`src/data/changelog/current.js` 最前面加今天日期記錄
3. **CLAUDE.md / 外部規則檔同步**：改 regex = §3、改 push 流程 = §1 / §2、改檔案結構 = §6 拆檔表、**改業務規則 = `docs/business-spec.md` + `src/data/helpPanelData.js` + changelog 三件組**、改 Claude 工作流慣例 = `.claude/business-rules.md`、孤兒清理 = `.claude/orphans.md`
4. **程式碼品質**：新孤兒 / 未使用 deps → 列入 `.claude/backlog.md` 或當次清理
5. **git + PR + 同步**：clean → `mcp__github__create_pull_request` → squash merge → `git fetch origin main && git reset --hard origin/main`
6. **回報**：commit SHA、部署網址、驗證清單、後續調整

直接叫 `/ship-feature` skill 會按此跑。

## 9. 孤兒檔案

清單在 `.claude/orphans.md`。新增孤兒清理紀錄請加到那邊，不要塞回 CLAUDE.md。

## 10. 業務規則與工程 Insight

**業務規則完整描述在 `docs/business-spec.md`**（單一來源，12 章，給協作者看）；HelpPanel 規則摘要 data 在 `src/data/helpPanelData.js`（給使用者看）。

CLAUDE.md 只列 5 條核心規則編號摘要當索引：

| # | 名稱 | 一句話 | spec 章節 |
|---|---|---|---|
| 1 | 端點不混用 | 任一 port 不可同時 IN+OUT。違反比線交叉嚴重。 | §5 規則 1 |
| 2 | 避免視覺重疊 | 線不可跨任務矩形。優先改端點 > 改路徑 | §5 規則 2 |
| 3 | target 順序排 slot | 多條連線並存時 slot 內外順序按 target 欄左→右 | §5 規則 3 |
| 4 | 編號顯示分層 | 流程圖只顯示正式 L3/L4；`-0` / `-99` / `_g*` 不顯示 | §6 |
| 5 | 兩層儲存檢核 | Blocking（結構不合法擋儲存）+ Warning（跳 modal 由使用者決定） | §7 |

工程慣例（trace 驗證、Excel I/O 相容、CJK wrap、文件同步、協作偏好）→ `.claude/business-rules.md`。

## 11. Backlog

跨 session 待辦在 `.claude/backlog.md`（4 個分類 + Phase 2 計畫 + 已完成清單）。

每個 PR 收尾把 backlog 對應條目搬到「已完成」區，新發現的待辦加進對應分類，**搬移動作放在 changelog 同一個 commit**。

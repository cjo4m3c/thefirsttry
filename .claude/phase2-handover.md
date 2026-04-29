# Phase 2 交接：抽出 `src/model/` 共用層

> 寫於 2026-04-28，承接 Phase 1 拆檔三部曲（layout / DiagramRenderer / FlowEditor 已 merged）。本檔給接手 Phase 2 的 session 用，含完整動機 / 架構設計 / 三個 PR 的逐檔內容 / 驗證方法。

---

## 1. 為什麼要做這件事

使用者明確要求（2026-04-28）：

> 「我希望在修改操作邏輯的時候，確保同一筆資料的改動可以同步在所有同資料的地方，包含首頁、流程圖介面、表格介面、下載的三種檔案、側邊拉開的編輯器，改一個，所有地方同步都要顯示對的資料，不要改一個後還要去改很多檔案重新找問題」

七視圖（Dashboard / DiagramRenderer / Editor drawer / FlowTable / Excel / drawio / PNG）目前**靠人工檢核保持一致**。歷史上吃過兩次大虧：

1. **PR #70**：FlowTable `useEffect` deps 漏 `flow.tasks` → 流程圖更新但下方表格不動，使用者連續回報「資料不一致」3 次才被發現
2. **commit 7606d16 之前**：`buildTableL4Map` 自己一套 counter（純流水給每個 task 遞增）→ Excel 編號跟畫面對不上（start 應是 `-0` 卻顯示 `-1`、結束應是 `-99` 卻顯示流水號、閘道沒 `_g` 後綴）

兩個 bug 都是「同樣的衍生邏輯在多個檔案各寫一次」造成的。**Phase 2 要把這類共用邏輯抽到 `src/model/`，從根源消滅機會**。

## 2. 架構設計

### 目錄結構（要建）

```
src/model/
├── connectionFormat.js   # PR-5：連線中文字串 ↔ 結構互轉的單一來源
├── flowSelectors.js      # PR-6：從 flow 衍生的所有資料
└── validation.js         # PR-7：儲存前 blocking + warning 檢核
```

### 設計原則

1. **純函式**：`src/model/` 全部是純函式，不依賴 React、不可有 useState 等 hook（hooks 留在 component 層）
2. **單向依賴**：視圖層 import `model`；`model` 不 import 視圖層或 components
3. **取代不重複**：抽出後**移除原視圖層的對應實作**，import 新位置；不留兩套
4. **行為等價**：所有抽出的函式對既有測試 case / 既有 flow 必須產生**完全相同的輸出**（含 edge case）

### 視圖如何使用

抽出後，每個視圖都這樣讀資料：

```js
// 視圖 (任何之一)
import { formatConnection } from '../model/connectionFormat.js';
import { getDisplayLabels, getL3Summary } from '../model/flowSelectors.js';
import { validateFlow } from '../model/validation.js';

const displayLabels = getDisplayLabels(flow.tasks, flow.l3Number);
const connText = formatConnection(task, flow.tasks);
```

未來改「條件分支至」措辭、加新閘道種類、改 validation 規則，**只動 `src/model/` 一個檔，所有視圖自動同步**。

## 3. PR-5：`src/model/connectionFormat.js`（最關鍵）

### 目標

把「`task` ↔ 中文字串（如『條件分支至 A、B、C』）」的互轉邏輯集中到一個檔。

### 目前散在哪裡（PR-5 抽完後這幾處要改 import）

| 位置 | 做什麼 | 函式名（如有） |
|---|---|---|
| `src/utils/excelExport.js` | 匯出 Excel 時把 task 轉成中文字串放第 5 欄 | `buildExcelRows` 內 |
| `src/utils/drawioExport.js` | drawio edge label / merge target 註解 | inline |
| `src/components/FlowTable.jsx` | 表格第 5 欄「任務關聯說明」顯示 | inline |
| `src/components/DiagramRenderer/overlays.jsx` | tooltip（hover task 顯示文字） | inline |
| `src/utils/excelImport.js` | 匯入時 parse 中文字串回 connectionType + nextTaskIds（**反向**） | `parseConnectionPhrase` |

### 要做的事

1. 新增 `src/model/connectionFormat.js`
2. 抽出**正向**：`formatConnection(task, allTasks, displayLabels)` → 中文字串
3. 抽出**反向**：`parseConnection(text, knownTasks)` → `{ connectionType, nextTaskIds, conditions }`（從 excelImport.js 搬出來）
4. 5 個既有位置改 import 新函式，刪除自己的實作
5. 加 grep guard 到 `/sync-views`：除 `model/`、`changelog/`、`excelImport.js`（保留中文 regex）外，不可再 grep 到「條件分支至」「並行分支至」等

### 驗證

1. **Excel round-trip**：抽前匯出一份 Excel → 抽後再匯出 → diff 兩份 .xlsx 內容（用 unzip 把 sheet1.xml 比一比）必須完全相同
2. **drawio round-trip**：類似
3. **Import 測試**：找一份既有 Excel（從 production 抓）匯入 → 抽前 / 抽後 flow JSON diff 必須相同
4. `npm run build` 通過
5. Grep check：`grep -rn '條件分支至' src/ --exclude-dir=model --exclude-dir=changelog --exclude=excelImport.js` 應為空

### 預估大小

- `src/model/connectionFormat.js`：~6-8KB
- 動到 5 個視圖檔（每檔小修改），總 diff 約 200 行

## 4. PR-6：`src/model/flowSelectors.js`

### 目標

把「從 `flow` 衍生的所有資料」集中。

### 要抽的 selectors

```js
// 從現有 src/utils/taskDefs.js 搬過來：
export function getDisplayLabels(tasks, l3Number) { ... }  // 已存在 = computeDisplayLabels

// 新建（給 Dashboard / 各視圖共用）：
export function getL4Index(tasks) { ... }                   // tasks indexed by l4Number
export function getL3Summary(flow) { ... }                  // Dashboard 卡片摘要
export function getSwimlaneRows(roles, tasks) { ... }       // 角色分組
export function getTaskIncoming(tasks) { ... }              // 反向索引：每個 task 的 incoming 清單
```

### 目前散在哪裡

| 位置 | 內容 |
|---|---|
| `src/utils/taskDefs.js` | `computeDisplayLabels`（這個已是單一來源，搬到 model 後改 re-export） |
| `src/components/Dashboard.jsx` | 算 L3 卡片摘要的 inline 邏輯 |
| `src/components/FlowEditor/validateFlow.js` | 算 incoming map 的 inline 邏輯 |
| `src/diagram/layout/computeLayout.js` | 角色 row index 的 inline 邏輯 |

### 注意

`computeDisplayLabels` 是現有的「sole source of truth」，**不要破壞向後相容**：
- `taskDefs.js` 保留 re-export `computeDisplayLabels`，內部改 `from '../model/flowSelectors.js'`
- 既有 importers（layout / FlowEditor / excelExport / Dashboard）一行不動
- 加新 selector 即可

### 驗證

- 七視圖手動 walk（`/sync-views` skill）
- `npm run build` 通過
- 對 6 個 fixture 跑 `getDisplayLabels` 抽前 / 抽後比對（沿用 `/tmp/trace-layout.mjs` 模式）

## 5. PR-7：`src/model/validation.js`

### 目標

把 `src/components/FlowEditor/validateFlow.js` 升級到 model 層，讓 Excel 匯入也能跑同一套規則。

### 做的事

1. 把 `src/components/FlowEditor/validateFlow.js` 的內容搬到 `src/model/validation.js`
2. 簽名不變：`validateFlow(flow) → { blocking: string[], warnings: string[] }`
3. `FlowEditor/validateFlow.js` 變成 thin shim re-export（保留 backwards compat），或直接改 `FlowEditor/index.jsx` import 新位置（任選）
4. **新用法**：`src/utils/excelImport.js` 載入 Excel 後跑一次 `validateFlow(parsedFlow)`，把 warnings 顯示給使用者（目前匯入是黑盒，匯入後才在 FlowEditor 看到 warning，使用者體驗不好）

### 驗證

- 既有 `FlowEditor` 儲存流程的 blocking / warning 行為**完全不變**
- 新增：匯入時若有 warning，跳 modal 顯示（取 list 給使用者）
- `npm run build` 通過

### 預估大小

- `src/model/validation.js`：~5KB（直接搬，不改邏輯）
- `excelImport.js` 多 ~30 行（呼叫 validate + UI 通知）

## 6. PR 順序與依賴

```
PR-5（connectionFormat）  ──┐
                            ├──→  PR-6（flowSelectors）  ──→  PR-7（validation）
                            └──→  /sync-views skill 加 grep guard
```

- **PR-5 先做**：因為它是最分散、踩雷最多的（5 處重複實作）。完成後其他 PR 可以引用 `formatConnection` 把連線顯示文字統一
- **PR-6 接著**：相對簡單，主要是新建 + 既有 `computeDisplayLabels` 不動
- **PR-7 最後**：依賴前兩個（validation 內部會用到 connectionFormat 的反向 parser 跟 flowSelectors 的 incoming map）

每個 PR 推完一個再做下一個，不要並行。

## 7. 共通驗證 SOP

每個 Phase 2 PR 完成前必跑：

1. `npm run build` ✅
2. `find src -size +15k`（CLAUDE.md §6 size check）
3. **行為等價驗證**：
   - PR-5：Excel / drawio 匯出 round-trip diff
   - PR-6：6 個 fixture 跑 `computeDisplayLabels` 比對
   - PR-7：既有 FlowEditor 儲存流程 blocking / warning 不變
4. 七視圖手動 walk（用 dev server）
5. Grep guard：抽出後不可再有殘留實作

## 8. Phase 2 完成後，CLAUDE.md / 規則檔要更新

PR-7 合併後，把以下規則加進 `CLAUDE.md` §6 或 `business-rules.md`：

> **跨視圖共用邏輯一律放 `src/model/`**。視圖層只負責呈現，不可自己重算編號 / 格式化連線文字 / 跑 validation。新增視圖第一件事是看 `model/` 有沒有現成 selector 可用。

加 grep guard 到 `/sync-views`：

```bash
# 禁止視圖層寫死「條件分支至」「並行分支至」等字串
grep -rn '條件分支至\|並行分支至\|包容分支至' src/ \
  --include="*.js" --include="*.jsx" \
  --exclude-dir=model --exclude-dir=changelog \
  --exclude=excelImport.js
# 期待空輸出
```

## 9. 接手第一步

1. 先確認 PR-4 已 merged（看 `git log origin/main`）
2. 從最新 main 切新分支：
   ```bash
   git checkout main && git pull origin main
   git checkout -b claude/phase2-connection-format
   ```
3. 先 grep 確認目前哪裡有「條件分支至」這類字串：
   ```bash
   grep -rn '條件分支至\|並行分支至\|包容分支至' src/ \
     --include="*.js" --include="*.jsx" \
     --exclude-dir=changelog
   ```
4. 一一讀過這些位置，把共通實作整理出來放進新檔
5. 寫 trace baseline 腳本（仿照 PR-1 的 `/tmp/trace-layout.mjs`），對 5+ 個 fixture 跑 round-trip
6. 抽到 `src/model/connectionFormat.js`、改 5 個視圖層 import
7. 跑 trace 比對抽前抽後 → 必須 byte-identical
8. push、開 PR、merge

## 10. 常見陷阱（避免重蹈）

- **不要動 layout routing 邏輯**：那是 Phase 1 的範圍，本階段純抽 model 層
- **不要 over-engineer**：如果 5 個視圖的字串組裝邏輯有微小差異，**確認那些差異是 bug 還是 feature**。歷史上 `buildTableL4Map` 的差異就是 bug → 統一到 `computeDisplayLabels`
- **不要破壞向後相容**：既有 importer 一行不動是首要原則。新加的視圖才用新 path
- **重要：純文字搬移先做，邏輯重構不做**：每個 PR 只做「搬到新位置 + 改 import」，不在同個 PR 順手清理或優化邏輯

---

## 附錄：未推 PR-4 檔案清單（用於還原）

PR-4 還在 push 中時 token expired。已推：`.claude/orphans.md`、`.claude/backlog.md`。未推 5 檔：

- `.claude/business-rules.md`（4.9KB，新檔）— 內容在 PR-4 session 的 conversation log 裡
- `.claude/skills/sync-views.md`（4.5KB，新檔）— 同上
- `.claude/skills/ship-feature.md`（3.8KB，modified）— 同上
- `CLAUDE.md`（7.2KB，modified）— 同上
- `src/data/changelog/current.js`（6.8KB，modified）— 同上

接手後先把這 5 個推上去（同個 branch `claude/refactor-rules-and-skills`）讓 PR-4 可以 merge，再開新分支做 Phase 2。

# Backlog — 跨 session 待辦

由 TodoWrite 即時管理當前 session 任務；此檔保留跨 session 需要記得的 backlog。

來源：2026-04-28 交接 §5 + 同日 K/L PR 收尾新增 + 2026-04-29 使用者新提待辦合併（PR #85）。

## 立即可動 / Bug

- **P. 全頁儲存連動 BUG**（使用者：「儲存要整頁一起存，不能下方 excel 編輯後 上方的調整都不見了，應該要是不管在哪裡編輯後所有內容都要連動修正（編輯器、流程圖、下方表格）」）— FlowEditor / DiagramRenderer 互動 / FlowTable 三處互改後內容要連動，目前 FlowTable 編輯後上方未儲存的調整會被覆蓋。需把 hasChanges + source-of-truth 整合到頂層 state

## 規格已明確、可排程

- **W. 泳道高度調整視覺改動**（使用者：「接下來有個任務是要調整視覺呈現，可能跟泳道高度調整有關」） — 動到的位置：`src/diagram/constants.js` `LAYOUT.LANE_H`/`NODE_H` 常數、`src/diagram/layout/helpers.js` `minLaneH(n)` / `ROUTE_SLOT_H` / `ROUTE_BOTTOM_PAD` 槽位、`src/diagram/layout/computeLayout.js` 末段 `laneTopY` / `laneHeights` 算法、`DiagramRenderer/index.jsx` + `StickyHeader.jsx` 渲染同步、`drawioExport.js` 吃 `laneHeights`。若做「使用者手動指定某泳道高度」需在 `flow.roles[i]` 加新欄位（例 `customHeight`），computeLayout 取 override 蓋過動態算出的值。**跟 Phase 2 抽出的 selector 幾乎無關**——lane 高度是 routing 算法衍生狀態，不是 model 層的純資料 selector。
- **U. 插入閘道操作邏輯拉齊**（使用者：「拉齊插入閘道的操作邏輯（現在圖上是插入閘道、編輯器是序列規則）」）— `DiagramRenderer` ContextMenu「插入閘道」與 `FlowEditor` 編輯器內的插入流程不一致，要統一
- **V. 儲存事件閃亮提醒**（使用者：「新增儲存事件閃亮亮動態提醒」）— 儲存按鈕被按下後加 logo 閃光 / 按鈕短暫變綠等視覺回饋（取代原 J「儲存提醒優化」的待選方向）
- **C. Phase 3.5 gateway obstacle avoidance**（`src/diagram/layout/`）— 閘道作為跨列 forward obstacle 時走 vertical-detour
- **E. Excel Tab 內嵌編輯**（使用者：「優化 excel tab 可編輯性」）— `FlowTable.jsx` textarea + auto-resize（與 P 一起做最順）
- **M-1. 頁首四顆按鈕風格統一**（使用者：「拉齊編輯頁右上按鈕規格」）— 儲存 / 編輯流程 / 重設手動端點 / ★
- **M-2. 流程圖頂部下載按鈕統一 + 加 Excel 鍵** — PNG / drawio / Excel 三鍵，照 `ui-rules` §2.5 三色藍
- **N. 泳道角色拖曳視覺提示** — 複用 `useDragReorder` 的 `dropAfter` + DropLine pattern
- **Y. tooltip 上編輯既有閘道分流條件**（使用者：「各種閘道：要可以在 tooltip 上編輯分流點」）— T 已做新增閘道時的條件標籤輸入；本項補**既有閘道**的 inline 編輯。動到 `ContextMenu`：對既有閘道展開 sub-form 加 label inputs，state 寫回 `task.connections[].label`
- **Z. 閘道 fork + merge 自動填入任務關聯說明**（使用者：「閘道的自動填入說明，新增填入任務關聯說明欄的『條件分支、並行分支、包容分支』」+「條件合併、包容合併、並行合併也要出現在任務關聯說明，看能不能自動補」）— `src/model/connectionFormat.js` `formatConnection` 已能產生對應字串，但**任務關聯說明欄**（task.description / task.notes）目前不自動寫入；要在 `taskDefs.applyConnectionType` 或 save flow 時 sync。注意：使用者手動編輯過的 description 不能被覆蓋
- **AA. 新增任務時自動帶入泳道角色**（使用者：「在哪裡點新增任務，就會自動帶入該泳道角色，無主的自動放當下泳道第一個角色」）— `src/components/FlowEditor/useFlowActions.js` `addTask` / `addTaskAfter` 加 default `roleId` 邏輯：若呼叫端有上下文（例 ContextMenu 在某泳道按右鍵）→ 該泳道；否則 → `flow.roles[0].id`
- **AC. 複製整個 L3 工作流**（使用者：「可以在頁面上複製一整個工作流」）— Dashboard 卡片加「複製」按鈕，複製後產生新 flow（編號自動 +1 或讓使用者改），tasks / roles / connections 全套複製。動到 `Dashboard` + `src/utils/storage.js` 加 `cloneFlow` 函式

## 規格待確認、不能直接動手

- **F. Excel 部分匯入**（使用者：「只匯入＋覆蓋 excel 部分內容欄位、或自動略過部分欄位」）— 單一欄位 / 部分行覆蓋邏輯
- **G. 匯出圖等比寬度**（使用者：「匯出的圖檔要符合 ISO 文件適用寬度」）— PNG 匯出規格 / ISO A4 等比
- **AB. 任務連線到閘道自動新增分支欄位**（使用者：「任務也可以藉由連線連到閘道，自動新增分支欄位（待確認）」）— 拖曳連線端點到既有閘道時，閘道會自動加一條分支條件欄位。需先確認規格：(1) 加完之後 label 留空還是給預設值（推測「分支 N」）(2) merge 閘道也適用嗎（推測不適用，merge 沒分支條件）(3) 多個 source 連到同個 fork 閘道時行為

## Nice-to-have / 有空再修

- **B. layout 同欄對齊**（使用者：「先放成 nice-to-have」）— fork 兩分支步數不等時，短分支末段對齊到長分支同欄；含使用者要求的「包容、並行閘道後方任務對齊」。推薦解法 A（`alignForkBranches` post-pass），先開 `claude/preview-layout-same-column` 預覽分支驗證。動手前須跟使用者確認 §10.6 四個問題
- **H. 邊側批量下載缺檔**（使用者：「批量下載數量太多時比較後面的編號會漏檔案 → 目前排解只有 edge 瀏覽器有，晚點再修」）
- **後續批次拆檔（PR-4 size check 命中）**：`Dashboard.jsx` 26KB / `ContextMenu.jsx` 19KB / 凍結 `c13.js` 拆成 c13a + c13b（17KB）/ `excelImport.js` 15.5KB（PR-7 加完 validateFlow 又超 15KB 軟上限）。已解：`HelpPanel.jsx` 26KB → 11.3KB（PR #84 抽 helpPanelData）/ `taskDefs.js` 17.4KB → 14.3KB（PR #81 抽 selector）/ `excelImport.js` 17.2 → 14.9KB（PR #80）

## Phase 2（model 共用層抽出）— 全部完成

- ~~**PR-5**：`src/model/connectionFormat.js`~~ ✅ DONE（PR #80）
- ~~**PR-6**：`src/model/flowSelectors.js`~~ ✅ DONE（PR #81，`getL4Index` / `getL3Summary` / `getSwimlaneRows` 暫不抽，等真需要再補）
- ~~**PR-7**：`src/model/validation.js`~~ ✅ DONE（PR #82）

## 已完成（2026-04-28 至 2026-04-29 出清）

- **X. 字級放大後版面修補** — DONE，框體縮減（NODE 180×72→156×60 / COL_W 224→184 / LANE_H 196→152 / LANE_HEADER_W 180→108）+ 字級三層化（L1 16/18/22 / L2 14 / L3 13，L4 編號從 13 升 L2 14、tooltip 從 12 升 13）+ 行距拉開（SvgLabel 22→24 / 角色 22→26 / Event name 18→20 / desc 17→19 / 閘道下標 20→22）+ wrap maxChars 連動收緊。跨場景縮放交給瀏覽器 Ctrl+/Ctrl-，不自製 slider。
- **K. 標題 em-dash 間距修** — DONE，DiagramRenderer 改成 `　—　`（兩側全形）
- **L. 編輯頁字級放大一級** — DONE，流程圖 +40% + 編輯頁 Tailwind +1 step（後續修補列為 X）
- **J. 儲存提醒優化（規格不明）** — 由 V 取代
- **Q. 編輯器路徑閘道前綴補齊** — DONE，`taskDefs.applyConnectionType` 加 name auto-prefix
- **T. tooltip 新增閘道時可同步編輯條件標籤** — DONE，`ContextMenu` 新增閘道 sub-form 加兩個 label input（編輯既有閘道列為 Y）
- **R. L3 活動操作優化（含 S）** — DONE：`ConnectionSection` filter 加 l3activity 例外、`validateFlow` L3 專屬 warning、`ContextMenu` L3 編號 inline input、`ContextMenu` 新增 L3 活動按鈕、`ContextMenu` 移除「在前面新增任務」
- **PR-1**：拆 `src/diagram/layout.js` 58KB → 11 個 ≤15KB 檔案
- **PR-2**：拆 `src/components/DiagramRenderer.jsx` 44KB → 11 個 ≤13KB 檔案
- **PR-3**：拆 `src/components/FlowEditor.jsx` 43KB → 8 個 ≤13KB 檔案
- **PR-4**：rules and skills 重整（PR #79）
- **PR-5 / -6 / -7**：Phase 2 model 層抽出（PR #80 / #81 / #82）
- **業務規格文件單一來源 refactor**（PR #84）：新增 `docs/business-spec.md` 12 章 + `src/data/helpPanelData.js`；HelpPanel.jsx 26KB → 11.3KB；`.claude/business-rules.md` 縮成 Claude 工作流慣例；CLAUDE.md §3 / §6 / §8 / §10 同步指向 spec doc

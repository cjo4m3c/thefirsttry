# Backlog — 跨 session 待辦

由 TodoWrite 即時管理當前 session 任務；此檔保留跨 session 需要記得的 backlog。

來源：2026-04-28 交接 §5 + 同日 K/L PR 收尾新增。

## 立即可動 / Bug

- **P. 全頁儲存連動 BUG**（使用者：「儲存要整頁一起存，不能下方 excel 編輯後 上方的調整都不見了，應該要是不管在哪裡編輯後所有內容都要連動修正（編輯器、流程圖、下方表格）」）— FlowEditor / DiagramRenderer 互動 / FlowTable 三處互改後內容要連動，目前 FlowTable 編輯後上方未儲存的調整會被覆蓋。需把 hasChanges + source-of-truth 整合到頂層 state

## 規格已明確、可排程

- **W. 泳道高度調整視覺改動**（使用者：「接下來有個任務是要調整視覺呈現，可能跟泳道高度調整有關」） — 動到的位置：`src/diagram/constants.js` `LAYOUT.LANE_H`/`NODE_H` 常數、`src/diagram/layout/helpers.js` `minLaneH(n)` / `ROUTE_SLOT_H` / `ROUTE_BOTTOM_PAD` 槽位、`src/diagram/layout/computeLayout.js` 末段 `laneTopY` / `laneHeights` 算法、`DiagramRenderer/index.jsx` + `StickyHeader.jsx` 渲染同步、`drawioExport.js` 吃 `laneHeights`。若做「使用者手動指定某泳道高度」需在 `flow.roles[i]` 加新欄位（例 `customHeight`），computeLayout 取 override 蓋過動態算出的值。**跟 Phase 2 抽出的 3 個 selector（getL4Index / getL3Summary / getSwimlaneRows）幾乎無關**——lane 高度是 routing 算法衍生狀態，不是 model 層的純資料 selector。
- **U. 插入閘道操作邏輯拉齊**（使用者：「拉齊插入閘道的操作邏輯（現在圖上是插入閘道、編輯器是序列規則）」）— `DiagramRenderer` ContextMenu「插入閘道」與 `FlowEditor` 編輯器內的插入流程不一致，要統一
- **V. 儲存事件閃亮提醒**（使用者：「新增儲存事件閃亮提醒」）— 儲存按鈕被按下後加 logo 閃光 / 按鈕短暫變綠等視覺回饋（取代原 J「儲存提醒優化」的待選方向）
- **C. Phase 3.5 gateway obstacle avoidance**（`src/diagram/layout/`）— 閘道作為跨列 forward obstacle 時走 vertical-detour
- **E. Excel Tab 內嵌編輯**（`FlowTable.jsx`）— textarea + auto-resize（與 P 一起做最順）
- **M-1. 頁首四顆按鈕風格統一**（使用者：「拉齊編輯頁右上按鈕規格」）— 儲存 / 編輯流程 / 重設手動端點 / ★
- **M-2. 流程圖頂部下載按鈕統一 + 加 Excel 鍵** — PNG / drawio / Excel 三鍵，照 `ui-rules` §2.5 三色藍
- **N. 泳道角色拖曳視覺提示** — 複用 `useDragReorder` 的 `dropAfter` + DropLine pattern

## 規格待確認、不能直接動手

- **F. Excel 部分匯入**（使用者：「只匯入＋覆蓋 excel 部分內容欄位、或自動略過部分欄位」）— 單一欄位 / 部分行覆蓋邏輯
- **G. 匯出圖等比寬度**（使用者：「匯出的圖檔要符合 ISO 文件適用寬度」）— PNG 匯出規格 / ISO A4 等比

## Nice-to-have / 有空再修

- **B. layout 同欄對齊**（使用者：「先放成 nice-to-have」） — fork 兩分支步數不等時，短分支末段對齊到長分支同欄；含使用者要求的「包容、並行閘道後方任務對齊」。推薦解法 A（`alignForkBranches` post-pass），先開 `claude/preview-layout-same-column` 預覽分支驗證。動手前須跟使用者確認 §10.6 四個問題
- **H. 邊側批量下載缺檔**（使用者：「批量下載數量太多時比較後面的編號會漏檔案 → 目前排解只有 edge 瀏覽器有，晚點再修」）
- **後續批次拆檔（PR-4 size check 命中）**：`HelpPanel.jsx` 26KB / `ContextMenu.jsx` 19KB / 凍結 `c13.js` 拆成 c13a + c13b（17KB）。已解：`Dashboard.jsx`（PR-8 拆 7 檔）/ `taskDefs.js`（PR-6 抽 selector）/ `excelImport.js`（PR-5/6 各砍 ~2KB；PR-7 加 validateFlow call 後 15.1KB）

## Phase 2（model 共用層抽出）— 進行中

- ~~**PR-5**：`src/model/connectionFormat.js`~~ ✅ DONE（PR #80）
- ~~**PR-6**：`src/model/flowSelectors.js`~~ ✅ DONE（PR #81，`getL4Index` / `getL3Summary` / `getSwimlaneRows` 暫不抽，等真需要再補）
- **PR-7**：`src/model/validation.js` — 把 `FlowEditor/validateFlow.js` 搬出，Excel 匯入也跑同一套 warning（進行中）

## 已完成（2026-04-28 出清）

- **K. 標題 em-dash 間距修** — DONE，DiagramRenderer 改成 `　—　`（兩側全形）
- **L. 編輯頁字級放大一級** — DONE，流程圖 +40% + 編輯頁 Tailwind +1 step
- **J. 儲存提醒優化（規格不明）** — 由 V 取代
- **Q. 編輯器路徑閘道前綴補齊** — DONE，`taskDefs.applyConnectionType` 加 name auto-prefix
- **T. tooltip 新增閘道時可同步編輯條件標籤** — DONE，`ContextMenu` 新增閘道 sub-form 加兩個 label input
- **R. L3 活動操作優化（含 S）** — DONE：`ConnectionSection` filter 加 l3activity 例外、`validateFlow` L3 專屬 warning、`ContextMenu` L3 編號 inline input、`ContextMenu` 新增 L3 活動按鈕、`ContextMenu` 移除「在前面新增任務」
- **PR-1**：拆 `src/diagram/layout.js` 58KB → 11 個 ≤15KB 檔案
- **PR-2**：拆 `src/components/DiagramRenderer.jsx` 44KB → 11 個 ≤13KB 檔案
- **PR-3**：拆 `src/components/FlowEditor.jsx` 43KB → 8 個 ≤13KB 檔案
- **PR-8**：拆 `src/components/Dashboard.jsx` 26KB → 7 個 ≤12.4KB 檔案；同 PR 校正 CLAUDE.md §2 push 規則為 API-aware 矩陣

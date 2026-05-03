# Backlog — 跨 session 待辦

由 TodoWrite 即時管理當前 session 任務；此檔保留跨 session 需要記得的 backlog。

來源：2026-04-28 交接 §5 + 同日 K/L PR 收尾新增 + 2026-04-29 使用者新提待辦合併（PR #85）+ 2026-04-30 使用者整合（本次）。

## 立即可動 / Bug

（無）

## 規格已明確、可排程

- **AD. 迴圈返回自動偵測**（使用者：「迴圈返回無法自動判斷」）— 任意 task 的 `nextTaskIds` 指向上游 task（DAG 反向邊）時自動標記成 loop-return 連線型，行為比照 auto-merge 偵測。動到 `src/model/connectionFormat.js` formatConnection 加反向邊判斷 + `src/model/flowSelectors.js` 加 `isBackEdge(task, allTasks)` selector。**注意**：(1) 編輯器已移除「迴圈返回」入口（PR-2026-04-29），這裡是衍生顯示不是手動標記 (2) 跟 backlog AC 複製工作流 / AG 表格無依賴，可獨立做
- **AE. 儲存檢核補強**（使用者：「更新儲存時檢核/提醒條件（連線錯誤、元件未連線、多個開始結束、未寫任務名稱）」）— 既有實作清單（`src/model/validation.js`）：`detectOverrideViolations` 偵測連線錯誤 ✓ / rule 4 孤立節點 ✓ / multi-start / multi-end warnings ✓。**待補**：任務名稱必填 warning（rule 6 新增 `if (!t.name?.trim() && t.type === 'task') warnings.push(...)`，非 blocking）。同時 audit 現有 warning UX modal 是否清楚分群顯示
- **AF. Excel 匯入檢核補強**（使用者：「更新匯入excel檢核/提醒條件（編號規則、跳行等）」）— 既有 `validateNumbering` 已強制 dash-only + `_g` / `_s` 前綴對應，列出所有錯誤列。**待補**：(a) 跳行偵測（連續行間 L4 順序跳號）(b) 空列偵測（中間有完全空的 row）(c) Header 行驗證（前幾欄必須是預期欄位）。動到 `src/utils/excelImport.js`
- **V. 儲存事件閃亮提醒**（使用者：「新增儲存事件閃亮亮閃亮亮動態提醒」）— 儲存按鈕被按下後加 logo 閃光 / 按鈕短暫變綠等視覺回饋（取代原 J「儲存提醒優化」的待選方向）。動到 `src/components/FlowEditor/Header.jsx`
- **AC. 複製整個 L3 工作流**（使用者：「可以在頁面上複製一整個工作流」）— Dashboard 卡片加「複製」按鈕，複製後產生新 flow（編號自動 +1 或讓使用者改），tasks / roles / connections 全套複製。動到 `Dashboard` + `src/utils/storage.js` 加 `cloneFlow` 函式
- **AG. 表格一鍵適應文字高度**（使用者：「表格可以一鍵讓他適應文字高度嗎？」）— FlowTable 預設或 toolbar 加按鈕，textarea 從 fixed-height 改成 auto-grow（`field-sizing: content` 或 JS 計算 scrollHeight）。動到 `src/components/FlowTable.jsx`
- **W. 泳道高度調整視覺改動**（使用者：「接下來有個任務是要調整視覺呈現，可能跟泳道高度調整有關」）— 動到的位置：`src/diagram/constants.js` `LAYOUT.LANE_H`/`NODE_H` 常數、`src/diagram/layout/helpers.js` `minLaneH(n)` / `ROUTE_SLOT_H` / `ROUTE_BOTTOM_PAD` 槽位、`src/diagram/layout/computeLayout.js` 末段 `laneTopY` / `laneHeights` 算法、`DiagramRenderer/index.jsx` + `StickyHeader.jsx` 渲染同步、`drawioExport.js` 吃 `laneHeights`。若做「使用者手動指定某泳道高度」需在 `flow.roles[i]` 加新欄位（例 `customHeight`），computeLayout 取 override 蓋過動態算出的值
- ~~**N. 泳道角色拖曳視覺提示**~~ — **OBSOLETED 2026-04-30**：HTML5 drag 整個被砍（PR #112 改用 ▲ ▼ 按鈕），`useDragReorder` / DropLine 都不存在了

## 規格待確認、不能直接動手

- **AH. 線段上的字被任務矩形擋住的處理**（使用者：「線段上的字如果被擋到，可以提醒或手動調整嗎？暫定先調整線段指向，看要不要調整 hover 顯示」）— 規格不明確，需先回答：(1)「提醒」是儲存檢核 warning rule、modal、還是畫面紅框視覺 indicator？(2)「手動調整」是讓使用者拖連線端點 / 重新 routing 嗎？(3) hover 顯示什麼？放大 label / float tooltip / 整段 lift？(4) 偵測判定：被任何 task rect 完全 / 部分覆蓋都算？範圍 padding？
- **F. Excel 部分匯入**（使用者：「只匯入＋覆蓋 excel 部分內容欄位、或自動略過部分欄位」）— 單一欄位 / 部分行覆蓋邏輯
- **G. 匯出圖等比寬度**（使用者：「匯出的圖檔要符合 ISO 文件適用寬度」）— PNG 匯出規格 / ISO A4 等比

## Nice-to-have / 有空再修

- **B. layout 同欄對齊**（使用者：「先放成 nice-to-have」+「包容、並行閘道後方任務對齊」）— fork 兩分支步數不等時，短分支末段對齊到長分支同欄；含使用者要求的「包容、並行閘道後方任務對齊」。推薦解法 A（`alignForkBranches` post-pass），先開 `claude/preview-layout-same-column` 預覽分支驗證。動手前須跟使用者確認 §10.6 四個問題
- **C. 線段邏輯 / Phase 3.5 gateway obstacle avoidance**（`src/diagram/layout/`）— 閘道作為跨列 forward obstacle 時走 vertical-detour
- **H. 邊側批量下載缺檔**（使用者：「批量下載數量太多時比較後面的編號會漏檔案 → 目前排解只有 edge 瀏覽器有，晚點再修」）
- **後續批次拆檔（PR-4 size check 命中）**：`Dashboard.jsx` 26KB / `ContextMenu.jsx` 19KB / 凍結 `c13.js` 拆成 c13a + c13b（17KB）/ `excelImport.js` 15.5KB（PR-7 加完 validateFlow 又超 15KB 軟上限）。已解：`HelpPanel.jsx` 26KB → 11.3KB（PR #84 抽 helpPanelData）/ `taskDefs.js` 17.4KB → 14.3KB（PR #81 抽 selector）/ `excelImport.js` 17.2 → 14.9KB（PR #80）

## Phase 2（model 共用層抽出）— 全部完成

- ~~**PR-5**：`src/model/connectionFormat.js`~~ ✅ DONE（PR #80）
- ~~**PR-6**：`src/model/flowSelectors.js`~~ ✅ DONE（PR #81，`getL4Index` / `getL3Summary` / `getSwimlaneRows` 暫不抽，等真需要再補）
- ~~**PR-7**：`src/model/validation.js`~~ ✅ DONE（PR #82）

## 已完成（2026-04-30 出清）

- **PR #110**：TaskCard 顯示衍生「任務關聯說明」preview（formatConnection 自動產生，使用者改任何欄位即時更新）+ removeTask wiring 重連（`A → B → C` 刪 B 自動變 `A → C`）
- **PR #111**：TaskCard Row 2 統一為「元件類型」單一選單（8 種跟 InsertPicker 一致：L4 任務 / 排他 / 並行 / 包容 閘道 / 開始 / 結束 / L3 / 外部互動）；新增 `src/utils/elementTypes.js` 純函式（`detectElementKind` / `makeTypeChange`）；修閘道命名 bug（GatewaySubForm 「條件 ◇×」→「排他 ◇×」、legend 「闘道」typo → 「閘道」）
- **PR #112**：拖曳排序砍掉重來，HTML5 drag → ▲ ▼ 按鈕。三度修都失敗（#104 / #106 / #108），改方案二零 deps、100% 可靠、accessibility 友善，淨減 113 行 fragile code
- **PR #113**：規則文件 / changelog / HANDOVER / README 同步到 PR #110-112 最新狀態；HelpPanel 移除「連線規則」段落（連線型態現由元件類型自動衍生，使用者不需手動選）
- **PR #114**：CLAUDE.md §8 加 step 6 — 開 PR 後立即 `subscribe_pr_activity`，無須再問使用者（使用者：「未來 pr 後都要追蹤 ci」）；本 repo `deploy.yml` 只在 main push 觸發，PR-level check_runs = 0 屬正常；deploy 失敗開 fix-forward PR，不 revert
- **PR #115**：TaskCard 佈局收緊 — col 2 從 `w-[120px]` → `w-24`（省 24px 給 col 3+4）+ ConnectionSection Row 3 五種單目標型態砍 col-3 spacer（target select 跨 col 3+4，消除「下一步 →」後面空白）+ 兩個 label 縮短避免被 truncate（「子流程 L3 編號」→「L3 編號」、「迴圈返回至 ↺」→「返回至 ↺」）
- **PR #116**：backlog log PR #114 + #115（doc-only follow-up）
- **PR #117**：backlog remove Y / Z / AA / AB（使用者回報已做完）
- **PR #118**：TaskCard Row 2「元件類型」label 字級 `text-xs` → `text-sm`，跟 ConnectionSection / 展開區塊 label 視覺對齊
- **PR #119**：外部關係人互動元件全套規則 — `applyRoleChange` / `syncTasksToRoles` 純函式 + 5 個觸發點（TaskCard / ContextMenu 角色 select、DrawerContent / Wizard role.type cascade、storage 載入 fixup）+ `INTERACTION_FILL` 灰底 `#A0A0A0` + 拿掉 validation 3e + business-spec §3.1 新章節
- **PR #120**：backlog log PR #116-#119 in 已完成
- **PR #121**：修外部互動底色從未生效 — `shapes.jsx` + `drawioExport.js` 渲染端誤判 `task.type === 'interaction'`（外部互動實際是 `type='task' shapeType='interaction'`，PR #111 model 後既存 bug），改成 `task.shapeType` 兩行修
- **PR #122**：交接文件全面整理 — HANDOVER / README 目錄樹反映 directory 拆檔結構、skills 6→9 條、CLAUDE.md §2 git push 規則更新、刪除 `.claude/handover-2026-04-29.md` + `phase2-handover.md` 兩份過時 session-snapshot；changelog freeze c22
- **PR #123**：流程圖文字 UI 微調 — TaskShape lineH 14→24、edge label 白底 `estimateTextWidth + 8` 動態 hug、L4Number 加白底 pill
- **PR #124**：新增閘道操作拉齊 — N-branch picker 取代固定 2 條
- **PR #125**：backlog 整合（AD/AE/AF/AG/AH 加入）
- **PR-A #126 / PR-B #127 / PR-C #128**：code review 三步走 — 資料模型 bug / catalog schema / Before 變體
- **PR #129**：changelog freeze c23
- **PR #130 / #131**：點選線段刪除 + ✕ 按鈕真實中點
- **PR #132**：外部互動 `_w` 編號 + 不對稱 sync + 流程圖隱藏編號
- **PR #133**：流程圖 3 個微調（事件下方說明移除 / start label 防壓泳道頭 / L4 編號白底降透明度）
- **PR #134**：HelpPanel 列點化 + 22 條 validation rules + 日期 4/30→5/3 + PNG 隱藏橘點
- **AI（PR #135）**：Undo / Redo stack — 50 步 snapshot、500ms 打字 debounce、儲存後 stack 清空、Ctrl+Z / Ctrl+Y 鍵盤 + Header 按鈕；session-only
- **PR #123**：流程圖文字 UI 微調 — TaskShape `lineH` 14→24（1.5 ratio）+ `letterSpacing` 0.02em / Edge label 白底寬度從固定 40×22 改成 `estimateTextWidth + padding` 動態 hug 文字 / L4Number 加白底 pill 防被線穿過
- **U（PR #124）**：新增閘道操作拉齊 — `insertGatewayAfter` 簽名升級成 N-branch；ContextMenu / DrawerContent InsertPicker 都從固定 2 條改成預設 2 條 + 「+ 新增分支」/「✕」可動態增減

**2026-04-30 使用者整合 backlog 時確認 PR #123 已涵蓋的兩項**（不需另外排程）：

- ~~條件分支白底 pixel 數要跟字一樣長~~ → **PR #123 已做**（`estimateTextWidth + 8` 動態 hug）
- ~~數字序號白底（端點有線時）+ 圖層在最上層~~ → **PR #123 已做**（L4Number `<g>` + 白底 pill + paint order TasksLayer 已在 connections 後）

## 已完成（2026-04-28 至 2026-04-29 出清）

- **M-1. 頁首四顆按鈕風格統一** — DONE，編輯頁 Header 4 顆全部統一 `px-3 py-1.5` 高度 + 透明白邊白字，順序 [重設所有端點][打開編輯器][儲存][★]，「儲存」hasChanges 時實底白字強調；Toolbar 三鍵 PNG/drawio/Excel 全改 `#2A5598`（從原 3 色階改同色）。spec doc §13 新增「視覺與字級規格」7 小節單一來源。
- **P. 全頁儲存連動 BUG / E. Excel Tab 內嵌編輯 / M-2. 流程圖頂部下載統一** — DONE 三條一起。FlowTable 轉受控元件（移除本地 tasks/hasChanges state，cell 改 textarea + onBlur 寫回，對應 onUpdateTask）；流程圖 / Drawer / FlowTable 任一處編輯即時同步到 liveFlow，按頂部「儲存」一次存全部；Drawer 確認無獨立儲存按鈕；FlowEditor 抽 `saveAndValidate(onSuccess?)`，DiagramRenderer 收 `onBeforeExport` prop，PNG / drawio / Excel 三個 export 都先 validate 通過才存+下載；4 個關鍵欄位（任務名稱/重點說明/重要輸入/關聯說明）寬度 `min-w-[260px]`，表頭容許 2 行（whitespace-nowrap 移除）。Excel 按鈕用藍系第 3 階 #1A3D69。
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

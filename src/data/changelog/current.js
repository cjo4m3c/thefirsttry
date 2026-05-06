/**
 * Changelog "current tip" — new entries since last freeze land here.
 * When this file grows beyond ~7KB, freeze: rename to c{next}.js + reset to [].
 * Entries are newest-first within file.
 */
export default [
  {
    date: '2026-05-06',
    title: 'routing 升級 ship：col 改 topological + L4 walk / Phase 1 mixed priority / Phase 3f L1 retry — 取代 preview toggle',
    items: [
      '**緣由**：前幾輪 preview 三件組（scheme3 col + Phase 1 mixed + Phase 3f）使用者測試通過。本 PR 把它從 toggle 升格成預設行為、移除 enhancedRouting flag、並把規則寫進 `docs/business-spec.md` §5 當 SOT。',
      '**Col 分配（§5.2）**：`computeColumnMap` 改成 topological + L4 walk — 按 sortKey 順序走訪，`col[t] = max(predBound, l4Bound, 0)`。l4Bound 對 parallel sibling 允許同 col、對非 sibling 強制 +1。同時滿足 (a) parallel siblings contiguous 時同 col 對齊（5-1-5-7/8/9 case）(b) 中間有孤立任務時嚴格 L4 順序、不 leapfrog（g1/g2/g3 case）(c) compact 無空白 col。',
      '**Phase 1 mixed priority（§5.3）**：閘道條件挑 port 改 4-pass fallback — ① 未被 sibling 用 + 路徑無障礙 + 規則 1 OK ② 路徑無障礙 + 規則 1 OK ③ 未被 sibling 用 ④ priorities[0]。把障礙與規則 1 在上游就 catch、減少下游紅線。',
      '**Phase 3f L1 retry（§5.3）**：在所有 phase 跑完之後再掃所有連線（包含預設 right→left 沒進 routing maps 的）。對紅線連線試 16 種 (exit, entry) 組合，挑第一個規則 1 + 規則 2 都過的，寫進 `taskCrossLaneRouting`。**跳過使用者 override** — Phase 3e 寫過 connectionOverrides 的連線不被 auto-revert。',
      '**isPathClear helper（§5.6）**：`corridor.js` 新增、預測路徑 cells（top→top corridor / right→left Z 形 / top→left L 形 等）+ rule 1 port-mix 檢核。Phase 1 + Phase 3f 共用同一 predicate 確保兩階段判定一致。',
      '**移除 toggle**：拿掉 Header「改善排版」按鈕、FlowEditor 的 `toggleEnhanced` + `liveFlow.enhancedRouting`、`computeLayout` 的 `enhancedRouting` 條件分支。新行為對所有 flow 立即生效。',
      '**清掉舊 routing-handover.md**：preview branch `claude/preview-vertical-obstacle-fix` 階段的調研文件，現在 spec §5 已涵蓋全部內容、刪除避免雙源頭漂移。同步更新 `CLAUDE.md` pointer + `HANDOVER.md` §2.5（指向 spec §5）。',
      '**業務規則 SOT 化**：所有 routing 規則 + 工程細節都搬到 `docs/business-spec.md` §5（共 8 個小節 — 三條紅線 / col 分配 / pipeline / dr-dc 決策表 / corridor slot / isPathClear / 使用者覆寫優先 / 對應實作）。HANDOVER.md / business-rules.md 都改成指向那邊。',
      '**動到的檔案（10 個）**：`src/diagram/layout/columnAssign.js`（topological+L4 walk 取代 idx-driven）/ `src/diagram/layout/phase1and2.js`（4-pass fallback 預設）/ `src/diagram/layout/phase3f.js`（保留，永遠跑）/ `src/diagram/layout/computeLayout.js`（拿掉 toggle）/ `src/diagram/layout/corridor.js`（保留 isPathClear）/ `src/components/FlowEditor/Header.jsx`（移除按鈕）/ `src/components/FlowEditor/index.jsx`（移除 toggleEnhanced）/ `docs/business-spec.md` §5（重寫為 SOT）/ `HANDOVER.md` §2.5（縮成指標）/ `CLAUDE.md`（移除 routing-handover.md pointer）/ 刪除 `.claude/routing-handover.md`。',
    ],
  },
  {
    date: '2026-05-06',
    title: '`/ship-feature` skill 加 changelog 日期 audit step（CLAUDE.md §4 規則 5 補實作）',
    items: [
      '**緣由**：CLAUDE.md §4 第 5 條規則寫「`/ship-feature` skill 收尾步驟會跑 audit script 比對最新一條 changelog `date` 是否等於剛 merge 的 PR `merged_at`，不一致直接 fail」— 規則文字 PR-A 立過了，但 skill 本身沒實作。本 PR 補上。',
      '**`.claude/skills/ship-feature.md` 加步驟 6.5「Changelog 日期 audit」**：插在步驟 6（同步 local）之後、步驟 7（回報使用者）之前。流程 — (1) 從步驟 4 / 5 拿 PR number，呼叫 `mcp__github__pull_request_read` action `get` 取 `merged_at[:10]` (2) 讀 sync 後的 `src/data/changelog/current.js` 第一筆 entry 的 `date` (3) 比對 — 一致就通過、不一致 print 錯誤訊息含兩個日期 + 提示開 follow-up PR 修正、**不**繼續到步驟 7 回報。',
      '**為什麼不自動修**：main 通常 branch-protected 不接受直接 push；且違反一 PR 一變更慣例。讓使用者自己開 follow-up PR 比較乾淨（PR-A 校正 8 個歷史錯誤就是這個 pattern）。',
      '**`CLAUDE.md` §4 規則 5 文字微調**：原「會跑 audit script」改寫成「步驟 6.5（2026-05-06 補實作）會自動 audit ... 不一致就 fail + 提示開 follow-up PR 修正」— 反映實作落地。',
      '**驗證**：規則 audit 是 skill markdown 步驟，無 build 影響。功能驗證點：(a) 下次 ship 一個跨 UTC 日界 merge 的 PR → skill 步驟 6.5 應該抓到 changelog date 跟 merged_at 不一致並停下來 (b) 一致時應該無聲通過、繼續到步驟 7 回報。',
      '**動到的檔案（3 個）**：`.claude/skills/ship-feature.md`（加步驟 6.5）/ `CLAUDE.md`（§4 規則 5 文字微調）/ `src/data/changelog/current.js`（本條）。',
    ],
  },
  {
    date: '2026-05-06',
    title: 'Excel 匯入 banner 雙重 bullet 修正（list-disc + 文字「•」前綴重疊）',
    items: [
      '**緣由**：使用者「我發現匯入提醒事項列點後，有些原本有列點的現在就會有兩個點」。前一個 PR-I 在 banner 的 `<ul>` 加 `list-disc` 後，凡是訊息文字本身已含 `• ` 前綴的（例如「• 第 85 列「name」 X → Y」）就變成 disc bullet + 文字 bullet 兩顆連在一起。',
      '**修法**：把 8 處 `warnings.push` 開頭的 `• `（或 `  • `）字串前綴拿掉，讓視覺 bullet 完全由 `<ul list-disc>` CSS 提供。動到的位置 — `excelImport/warnings.js`：collectCrossCheckWarnings（4 處 `_g` 後綴 / 閘道型不一致 / `-0` start / `-99` end 訊息）+ collectGatewayChainWarnings（2 處：找不到前置 / 前置未指向）`excelImport/index.js`：normalizeL4Numbers fix line 2 種變體（含 / 不含 excelRow tag）。',
      '**沒動的地方**：`validators.js` 內 `errors.push(\'• 第 N 列...\')` 是 `validateNumbering` throw 的 hard error 訊息（不是 warning array）— 這些訊息是用 `\\n` 串成大字串後 throw，最後在 import error banner 用 `whitespace-pre-line` 顯示為純文字（沒走 `<ul>`），所以 `• ` 就是視覺 bullet 必須保留。',
      '**驗證**：`npm run build` 通過。功能驗證點：(a) 上傳會自動調整 L4 編號的 Excel → banner 顯示「[L3 5-1-2] 已自動調整 1 個 L4 編號以符合規則：」（一個 disc）+「第 85 列「name」 X → Y」（一個 disc）— 不再重複 (b) 上傳含 cross-check warning 的 Excel → 同樣每行一個 disc (c) `validateNumbering` throw 的格式錯誤（紅色 banner）字樣不變、保留 `• ` 純文字 bullet。',
      '**動到的檔案（3 個）**：`src/utils/excelImport/warnings.js`（6 處 strip）/ `src/utils/excelImport/index.js`（fix line 2 處 strip + 註解）/ `src/data/changelog/current.js`（本條）。',
    ],
  },
  {
    date: '2026-05-06',
    title: '頁面切換自動捲動置頂（修「進入編輯器頁面停在下方表格」）',
    items: [
      '**緣由**：使用者：「我也希望點入頁面時是停在頁面最上方（現在都會停在下方 table）」。瀏覽器預設保留 scroll 位置 — 在 Dashboard 卡片網格往下滾找到要編輯的 flow → 點「編輯」 → FlowEditor render 完仍維持原 scroll 位置（剛好對到 FlowTable 區），看不到頁首跟流程圖。',
      '**`App.jsx` 加 useEffect**：監聽 `view` + `activeFlowId` 變化，每次切換 view 或切到不同 flow 都跑 `window.scrollTo(0, 0)`。涵蓋場景：(a) Dashboard → FlowEditor (b) Dashboard → Wizard (c) FlowEditor → Dashboard（返回）(d) 同 view 換不同 flow（雖然 view 沒變，activeFlowId 變了會觸發）。',
      '**為什麼放 App.jsx 不放 FlowEditor.jsx**：因為三個 view 切換都需要捲動置頂（Dashboard 自身被開啟時也應從頂部開始），單一 useEffect 集中處理避免每個 page-level component 重複實作。',
      '**驗證**：`npm run build` 通過。功能驗證點：(a) Dashboard 滾到底部 → 點任一卡片「編輯」 → FlowEditor 從頂部（header / 流程圖）顯示 (b) FlowEditor 滾到底（FlowTable）→ 點返回 → Dashboard 從頂部顯示 (c) Dashboard → 上傳 Excel → 自動進入新匯入流程的 FlowEditor → 從頂部顯示。',
      '**動到的檔案（2 個）**：`src/App.jsx`（加 useEffect + import useEffect）/ `src/data/changelog/current.js`（本條）。',
    ],
  },
  {
    date: '2026-05-06',
    title: 'Excel 匯入提醒文字四項調整：元件用流程圖編號 + 調整 vs 建議確認 + 連線違規不顯示 + 全部列點',
    items: [
      '**緣由**：使用者四點需求 (1)「真的有修改的，才用『調整』這個詞」(2)「沒有修改只是『提醒使用者要檢查』，請寫『建議確認』」(3)「請不要使用任務 2、任務 3，要指出是哪個元件，就直接寫出現有流程圖上的編號」(4)「連線有違反規則（端點混用、被任務擋到）的情況，在上傳時不提醒」+「Excel 檢核的提示訊息全部列點」。',
      '**`model/validation.js` label 格式改寫（核心修正）**：原 `任務 ${i + 1}「${t.name}」` 用陣列 index — 跟流程圖上實際 L4 編號不一致（流程圖顯示 1-1-5-3，warning 卻寫「任務 2」），使用者找不到對應元件。改成 `${describeElement(t)}${num}「${t.name}」` 用 `displayLabels[t.id]`（fallback `task.l4Number`）+ 元件類型中文名稱。Warning 範例：`L4 任務 1-1-5-3「彙整請購資料」：未連接下一步元件`。',
      '**詞彙統一 — 多 start / end 警告改「建議確認」**：原「請確認是否刻意設計多個入口/收尾」改成「建議確認是否刻意設計多個入口/收尾」。對照規則：實際有改動 → 用「調整」（`已自動調整 X 個 L4 編號`）/ 沒改只提醒檢查 → 用「建議確認」。其他 warning 文字（「未連接下一步元件」/「沒有任何元件連接過來」/「未指定泳道角色」）本身就是純陳述，無需動。',
      '**`utils/excelImport/index.js` 連線違規 filter 擴大**：原 `isLineCrossingSummary` 只 filter「連線被任務矩形擋住」 summary。擴大成 `isConnectionViolation`，同時 filter (a) blocking「端點同時有進出連線（違反規則 1：端點不混用）」(b) warning「連線「A」→「B」 穿過任務「C」（違反規則 2：視覺不重疊）」(c) summary「連線被任務矩形擋住」。三者都從 Excel banner + per-flow `importWarnings` 過濾掉。Save 時編輯器內仍會跳 modal（紅框 + blocking 仍然 block save），只是上傳當下不顯示。',
      '**Bullet 列點（`Dashboard/Banners.jsx` + `FlowEditor/index.jsx`）**：兩個 ImportWarnings banner 的 `<ul>` 加 `list-disc` class — 原本沒有實心 bullet 點，使用者看到的是一行一行純文字，不像列表。加 class 後每筆訊息前面有 disc bullet「•」，視覺上清楚是列點。',
      '**驗證**：`npm run build` 通過。功能驗證點：(a) 上傳含未連接元件的 Excel → banner 顯示「L4 任務 1-1-5-3「name」：未連接下一步元件」（用 L4 編號不是任務 N）(b) 上傳含 IN+OUT 端點混用的 Excel → banner 不再顯示這條，但開編輯器後 save 仍會擋 (c) 多 start / end 警告改用「建議確認」 (d) 兩個 banner 訊息有 disc bullet。',
      '**動到的檔案（5 個）**：`src/model/validation.js`（label 改 displayLabels-based + 多 start/end 詞彙）/ `src/utils/excelImport/index.js`（filter 擴大 + 重命名 isLineCrossingSummary → isConnectionViolation）/ `src/components/Dashboard/Banners.jsx`（`list-disc` class）/ `src/components/FlowEditor/index.jsx`（`list-disc` class）/ `src/data/changelog/current.js`（本條）。',
    ],
  },
  {
    date: '2026-05-06',
    title: '元件類型中文標籤統一用全名（KIND_SHORT_LABEL 改 verbose）+ describeElement 改讀同一份',
    items: [
      '**緣由**：使用者：「我希望統一用全名」。原本 chip pill（TaskCard col 2 / ContextMenu header）用 compact 短名「任務」/「外部互動」/「子流程」，但 `validation.js describeElement()` warning 訊息用 verbose「L4 任務」/「外部關係人互動」/「L3 流程」— 同一個元件在 UI 三處顯示兩個名字，使用者混亂。改成單一份 SOT verbose 名稱。',
      '**`utils/elementTypes.js KIND_SHORT_LABEL` 全 verbose**：`task: 任務 → L4 任務` / `interaction: 外部互動 → 外部關係人互動` / `l3activity: 子流程 → L3 流程`。閘道 / 開始 / 結束 4 個原本就 verbose 不變。檔頭註解改成「跟 validation.describeElement() 故意一致 — 單一 SOT」。',
      '**`model/validation.js describeElement()` 改讀 KIND_SHORT_LABEL**：原本 inline 的 7 行 if/else mapping 換成 1 行 `KIND_SHORT_LABEL[detectElementKind(t)] || \'L4 任務\'`。流程斷點（legacy `connectionType === \'breakpoint\'`）保留 special case（detectElementKind 不曝露 breakpoint，只回 \'end\'），else 全部 import 共用 mapping。',
      '**TaskCard / DrawerContent / ConnectionSection 5-col layout 配套**：col 2（badge / label）從 `w-24`（96px）擴成 `w-32`（128px）容納「外部關係人互動」7 個 CJK 字（chip 約 96px + ℹ icon 14px + gap 4px = ~114px > 96px 會溢出）。3 個檔同步調，含 col 註解。',
      '**ContextMenu header 不動**：header 是 `w-300px` 固定 + chip flex-shrink-0 + 編號 truncate，wider chip 自然吃掉編號的 truncate 空間，無需特別調整。',
      '**驗證**：`npm run build` 通過。視覺驗證點：(a) TaskCard col 2 chip 顯示 `[L4 任務]` / `[外部關係人互動]` / `[L3 流程]` 不溢出 (b) 同一元件儲存提醒 warning 訊息「L4 任務 1-1-5-3 沒有任何元件連接過來」跟 chip 文字完全一致 (c) ContextMenu header chip 跟 chip 在 TaskCard col 2 顯示完全相同 (d) Row 2 任務名稱 label / Row 3 ConnectionSection label 隨 col 2 同寬度。',
      '**動到的檔案（5 個）**：`src/utils/elementTypes.js`（KIND_SHORT_LABEL 3 處 verbose 化 + 註解改寫）/ `src/model/validation.js`（describeElement 改 1 行 import + breakpoint special case）/ `src/components/FlowEditor/TaskCard.jsx`（col 2 + Row 2 label w-24 → w-32 共 4 處）/ `src/components/FlowEditor/DrawerContent.jsx`（label 寬度 + 註解）/ `src/components/ConnectionSection.jsx`（label 寬度 + 註解）/ `src/data/changelog/current.js`（本條）。',
    ],
  },
  {
    date: '2026-05-06',
    title: '拆 FlowEditor/index.jsx（19KB → 13.9KB）— 抽 useUndoRedo / useSaveReminder hooks + drawerInsertHandlers',
    items: [
      '**緣由**：使用者「希望每次改動不會遇到檔案太大的 timeout 問題」。`FlowEditor/index.jsx` 19KB 接近 20KB 硬上限，加 1 個小功能就會被擋。把混在主檔的 3 個有清楚切點的 concern 抽出去，剩下純 orchestrator state + render JSX。',
      '**新增 `useUndoRedo.js`（3.2KB）custom hook**：把 undoStack state + handleUndo / handleRedo + Ctrl+Z/Y 鍵盤監聽 useEffect 抽成獨立 hook，input { liveFlow, setLiveFlow, setHasChanges, saveModal, resetAllModal }，return { pushSnapshot, clear, canUndo, canRedo, handleUndo, handleRedo }。`patch()` 呼叫 `pushSnapshot()` 在 setLiveFlow 之前，`doSave()` 呼叫 `clear()` 重置棧。',
      '**新增 `useSaveReminder.js`（3.4KB）custom hook**：把 pulseMode / editStamp / editingStartRef + 2 個 useEffect（idle 90s 觸發 continuous + edit-duration 3min/5min 觸發 brief 8s）抽成獨立 hook，input { hasChanges, saveModal, resetAllModal }，return { pulseMode, bumpEdit, resetPulse }。`patch()` 呼叫 `bumpEdit()` 重置 idle timer，`doSave()` 呼叫 `resetPulse()` 重置 pulse + edit anchor。',
      '**新增 `drawerInsertHandlers.js`（2.6KB）factory**：把原本 inline 在 `<DrawerContent>` 4 個 prop 上的 ~50 行 `onAddTaskAt` / `onAddOtherAt` / `onAddL3At` / `onAddGatewayAt` 轉成 `makeDrawerInsertHandlers({ liveFlow, actions })` factory return 4 個 handler。Render 變成 `<DrawerContent {...drawerHandlers} />` 一行。',
      '**主檔 `FlowEditor/index.jsx`**：19KB → 13.9KB（軟上限 15KB 以內，留 1.1KB buffer）。減少 ~120 行 implementation，imports 多 3 條（hook 跟 factory），其他 state hub + render JSX 不動。',
      '**沒動的 logic**：純 mechanical refactor。undo/redo 行為（包括 typing-burst debounce / save-clears-stack）/ save-reminder pulse 兩條 trigger path / drawer 4 個 click-to-insert 的 anchor 解析全部 1:1 移到新檔。`patch()` 跟 `doSave()` 改成呼叫新 hook 的 method 但對使用者完全 transparent。',
      '**驗證**：`npm run build` 通過。所有 hook 對外 API 跟原 inline 寫法等價（pushSnapshot 在 setLiveFlow 前 / bumpEdit 在 setHasChanges 後 / 兩個 useEffect 的 deps array 完全保留）。',
      '**動到的檔案（5 個）**：`src/components/FlowEditor/index.jsx`（19KB → 13.9KB）/ 新增 3 個 sibling 檔在 `src/components/FlowEditor/`：`useUndoRedo.js` / `useSaveReminder.js` / `drawerInsertHandlers.js` / `src/data/changelog/current.js`（本條）。',
    ],
  },
  {
    date: '2026-05-06',
    title: '拆 useFlowActions.js（21KB）→ orchestrator + 4 個 factory 子檔（皆 ≤11KB）',
    items: [
      '**緣由**：使用者「希望每次改動不會遇到檔案太大的 timeout 問題」。`useFlowActions.js` 21KB 過 20KB 硬上限，包含 16 個 graph-mutation 函式（task CRUD / 特殊插入 / connection 操作）。原已拆出 `converters.js`（10KB），但主檔還是過大。',
      '**拆檔結構（新增 3 個 factory 子檔在 `src/components/FlowEditor/useFlowActions/`）**：(1) `taskOps.js`（7.4KB）— `makeTaskOps` factory，輸出 `updateTask` / `addTask` / `addTaskBefore` / `addTaskAfter` / `removeTask`。`updateTask` 是 SOT mutator，含 PR-D8 topology-shift l4Number reset 邏輯 (2) `inserts.js`（6.2KB）— `makeInserts` factory，輸出 `addL3ActivityBefore/After` / `insertGatewayBefore/After`。內部 helper `rewireIncomingTo` + `buildGatewayConditions` (3) `connections.js`（6.7KB）— `makeConnectionOps` factory（depends on `updateTask`），輸出 6 個 connection 操作（addConnection / updateConnectionOverride / changeConnectionTarget / removeConnection / resetConnectionOverride / resetAllOverrides）(4) `converters.js`（10KB，舊有，不動）。',
      '**主檔 `useFlowActions.js` 21KB → 1.3KB**：純 orchestrator，import 4 個 factory，注入 `updateTask` 給 connectionOps（保留單一 SOT），spread 出去當 hook return。',
      '**Dependency injection 模式**：connectionOps 不自己定義 updateTask，從 taskOps 接過去，避免 topology-shift 邏輯（PR-D8 規則：type/shapeType 變更時 strip 其他 task 的 l4Number）在多處重新 implement 而 desync。',
      '**沒動的 logic**：純 mechanical refactor。所有 16 個 action 函式 body 1:1 移到 sub-file，`alert` 文字 / generateId() 用法 / patch() 呼叫順序、condition / nextTaskIds 操作邏輯全部一致。共用的 `stripStoredL4Numbers` helper 在 taskOps + inserts 兩檔重複定義（5 行小 helper，跨檔 import 不划算）。',
      '**驗證**：`npm run build` 通過，bundle size 不變。每個子檔皆 ≤ 11KB（舊 converters.js 10KB 是上限），主檔 1.3KB。FlowEditor/index.jsx import 路徑（`./useFlowActions.js`）不變。',
      '**動到的檔案（6 個）**：`src/components/FlowEditor/useFlowActions.js`（21KB → 1.3KB orchestrator）/ 新增 3 個 factory：`taskOps.js` / `inserts.js` / `connections.js`，皆在 `src/components/FlowEditor/useFlowActions/` / `src/data/changelog/current.js`（本條）。`converters.js` 舊有未動。',
    ],
  },
  {
    date: '2026-05-06',
    title: '拆 Dashboard.jsx（27KB）→ 1 shim + 1 orchestrator + 5 子檔（皆 <13KB）',
    items: [
      '**緣由**：使用者「希望每次改動不會遇到檔案太大的 timeout 問題」。`Dashboard.jsx` 27KB 排第二大 source 檔，超過 20KB 硬上限。混合了 state（11 個 useState + 1 個 useEffect + sortFlows useMemo）/ banner（3 種 import banner 全 inline）/ bulk toolbar（含格式 checkbox + delete + download）/ flow card（80 行 grid item JSX）/ duplicate-L3 modal（50 行 confirm modal）等多個 concern。',
      '**拆檔結構（`src/components/Dashboard/`）**：(1) `sortFlows.js`（2.8KB）— `SORT_OPTIONS` 常數 + `sortFlows` + `fmtDateTime` 純 helper (2) `Banners.jsx`（3.1KB）— `ImportErrorBanner` / `ImportSuccessBanner` / `ImportWarningsBanner`（3 個獨立 banner，最後者含 expand / collapse / clipboard copy 邏輯）(3) `BulkToolbar.jsx`（3.4KB）— `BulkToolbar`（含 select-all / format-checkbox / delete / download）+ `PngProgressBanner`（PNG queue 進度條）(4) `FlowCard.jsx`（4.9KB）— 單張 grid 卡片，含 pinned star / role chips / 5 個 action button (5) `DuplicateImportModal.jsx`（3.1KB）— L3 重複 modal（取消 / 都保留 / 覆蓋 三選一）(6) `index.jsx`（12.4KB）— 主 component，state hub + handler + page layout，組裝上面 5 個 sub-component。',
      '**Shim 保留（`src/components/Dashboard.jsx` 0.3KB）**：`export { default } from \'./Dashboard/index.jsx\';` — 唯一 importer `App.jsx` 路徑不變。',
      '**捎帶清掉一處 SOT 違規**：`FlowCard.jsx` 卡片 role chip 顏色從拆檔前 hardcoded `#009900` / `#0066CC` 換成 `COLORS.EXTERNAL_BG` / `INTERNAL_BG` import — 跟前一個 PR-B 同一動。原本 PR-B 已改 Dashboard.jsx line 432，這次拆檔搬到 FlowCard 維持改法。',
      '**沒動的 logic**：純 mechanical refactor。所有 banner / toolbar / modal / card 行為跟拆檔前一致（dialog 文字、按鈕順序、disabled 條件、PNG queue 串行邏輯、bulk download 450ms 間隔等全部 1:1 移過去）。state 全留在 `index.jsx`，sub-components 透過 props 接 callback / 衍生狀態（`pngQueueActive` / `selectedCount` 等）。',
      '**驗證**：`npm run build` 通過，bundle size 不變。每個子檔皆 < 13KB，遠在 15KB 軟上限內。',
      '**動到的檔案（8 個）**：`src/components/Dashboard.jsx`（27KB → 0.3KB shim）/ 新增 6 個子檔在 `src/components/Dashboard/`（sortFlows / Banners / BulkToolbar / FlowCard / DuplicateImportModal / index）/ `src/data/changelog/current.js`（本條）。',
    ],
  },
  {
    date: '2026-05-06',
    title: '拆 excelImport.js（33KB）→ 1 shim + 6 子檔（皆 <11KB），降低未來 timeout 風險',
    items: [
      '**緣由**：使用者「希望每次改動不會遇到檔案太大的 timeout 問題」。`excelImport.js` 33KB 是 codebase 最大的 source 檔，遠超 15KB 軟上限 / 20KB 硬上限。動到 Excel 匯入邏輯時 Read / Edit 工具吃 context、改完 PR 推不上去。本 PR 走 shim+子目錄 pattern 拆檔，外部 import 路徑不變。',
      '**拆檔結構（`src/utils/excelImport/`）**：(1) `aux.js`（1.8KB）— `buildAuxColMap` / `readAuxMeta`，輔助欄位 header→colIndex 對照 (2) `detectors.js`（1.9KB）— `detectGatewayType`（從 ann body）/ `detectGatewayFromName`（從 L4 名稱前綴）/ `detectKindFromL4`（PR-D10 SOT，從 L4 後綴判元件類型）(3) `validators.js`（8.6KB）— `validateNumbering`（hard blocking 編號格式檢核）/ `normalizeL4Numbers`（auto-fix l4Number + 收集 fix 列表）(4) `warnings.js`（6.3KB）— `collectCrossCheckWarnings`（PR-D10 跨訊號 cross-check）/ `collectGatewayChainWarnings`（閘道鏈 X→X_g→X_g1）/ `collectMergeIncomingWarnings`（合併目標 incoming<2）(5) `buildFlow.js`（10.6KB）— `buildFlow`（單個 L3 group → flow 物件）+ `detectRoleTypes`（從 row 分布推 role.type）(6) `index.js`（8.1KB）— `parseExcelToFlow` 主 orchestrator + `parseFlowAnnotations` alias。',
      '**Shim 保留（`src/utils/excelImport.js` 0.3KB）**：`export { parseExcelToFlow, parseFlowAnnotations } from \'./excelImport/index.js\';` — 唯一外部 importer `Dashboard.jsx` 一行不動，路徑仍是 `\'../utils/excelImport.js\'`。',
      '**沒動的 logic**：純 mechanical refactor，每個函式 body 1:1 移到子檔，沒改任何驗證 rule / warning 文字 / detector 規則。少數常數（`COL_L3_NUMBER` / `COL_L4_NUMBER` 等）在多個子檔重複定義（每個子檔只用自己需要的 subset），資料不會 desync 因為它們都對應同一份 Excel 欄位 layout（layout 變了所有檔都要改）。',
      '**驗證**：`npm run build` 通過，bundle size 不變（987KB → 987KB）。每個子檔皆 < 11KB，遠在 15KB 軟上限內，未來加 1-2 個 validator / warning 都還有空間。',
      '**動到的檔案（8 個）**：`src/utils/excelImport.js`（33KB → 0.3KB shim）/ 新增 6 個子檔在 `src/utils/excelImport/`（aux / detectors / validators / warnings / buildFlow / index）/ `src/data/changelog/current.js`（本條）。',
    ],
  },
  {
    date: '2026-05-06',
    title: 'changelog 日期校正 + 加 §4 PR-merge 日期對照規則 + 凍結 c25',
    items: [
      '**緣由**：使用者：「我發現很常在更新 changelog 的時候寫錯日期，請重新檢查每個 log 對應的 PR 與日期，並且把這個檢查納入規則中每次遵循」。早上連續 merge 一批 PR 跨 UTC 日界（#175 / #176 / #178~#183 實際 merged on 2026-05-06，但 changelog 寫成 2026-05-05），需要校正並把對照流程立規則。',
      '**`current.js` 8 處日期校正**：以 `mcp__github__list_pull_requests` 抓 50 個最新 PR 的 `merged_at`，逐筆 title 比對 changelog 條目；發現以下 8 條原 `date: 2026-05-05` 應為 `2026-05-06`（PR 號 / 對應條目）：#183 驗證規則重整 / #182 外部角色 strip / #181 流程圖文字 UI / #180 TaskCard 欄位交換 / #179 TaskCard col 2 / #178 同 lane skip routing / #176 編輯器 col 2 stacked / #175 編輯器 TaskCard 三項。其餘 12 條（#171 / #170 / #169 / #168 / #165 / #164 / #163 / #162 / #161 / #160 / #159 + #184）日期正確。',
      '**`CLAUDE.md` §4 加 PR-merge 日期對照規則**：每次寫 changelog `date` 必須以 `mcp__github__pull_request_read get_pull_request` 或 `list_pull_requests` 取得目標 PR 的 `merged_at` ISO 日期為準（不是「正在寫的時間」、不是「PR 開立日期」）。如果是同一 session 還沒 merge → 暫填當天日期、merge 完後補正一次(含 ship-feature skill workflow 提醒)。新規則寫進 §4 「Changelog 維護」段，列為第 5 條 bullet。',
      '**`current.js` 凍結 c25**：current.js 在校正前 ~55KB（含校正後的 20 條），遠超 7KB 凍結門檻 — 執行 §4 freeze workflow：cp current.js c25.js、改檔頭註解、`index.js` 加 c25 import，current.js 重置為僅含本條。c25 收 PR #159~#184 共 20 條條目。',
      '**未動的部分**：c01~c24 凍結檔的歷史日期沒在這次 audit 範圍（量大、且這批沒踩到 cross-day merge）。如果之後比對使用者出 bug 可單獨開 audit PR。',
      '**驗證**：`npm run build` 通過。CHANGELOG export 數量不變（c25 加入後仍是同一條陣列）。HelpPanel 變更紀錄 tab 顯示順序：本條 → c25.js（20 條） → c24.js → ... → c01.js。',
      '**動到的檔案（4 個）**：`src/data/changelog/current.js`（先 8 處日期校正，再 reset 成本條）/ `src/data/changelog/c25.js`（新檔，從校正後 current.js 拷貝 + 改檔頭）/ `src/data/changelog/index.js`（加 c25 import + 對齊 spread）/ `CLAUDE.md`（§4 加第 5 條 PR merged_at 對照規則）。',
    ],
  },
];

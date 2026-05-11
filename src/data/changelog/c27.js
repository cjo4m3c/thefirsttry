/**
 * Frozen changelog chunk c27 — covers 2026-05-06 ~ 2026-05-11.
 * 5 entries snapped off `current.js` on 2026-05-11 拆檔 PR-2 收尾時
 * （pre-PR-2 size 已達 ~10KB 過 7KB 凍結門檻）。順序維持 newest-first。
 */
export default [
  {
    date: '2026-05-11',
    title: '拆檔 PR-1：c13.js 17.7KB → c13a + c13b（首輪批次拆檔暖場）',
    items: [
      '**緣由**：使用者：「我希望先把拆檔做完」。backlog「後續批次拆檔」第一個明確項目 c13.js 17.7KB 凍結 chunk 過 15KB 軟上限 2.7KB；本輪首批處理（暖場、零邏輯風險）。',
      '**拆法**：c13.js 內含 6 條 entries（newest-first），對半切 — c13a 收前 3 條（2026-04-28 × 3）、c13b 收後 3 條（2026-04-27 × 3）。`index.js` import `c13` → `c13a` + `c13b`，spread 順序維持 c14 → c13a → c13b → c12（newest → oldest 內部排序不變）。',
      '**結果**：c13a 9.1KB / c13b 8.7KB，兩半都遠在軟上限以下；總 bytes 從 17.7KB → 18.0KB（多 file header 0.3KB，可忽略）。',
      '**動到的檔案（4 個 + 2 新檔 - 1 刪檔）**：`src/data/changelog/c13a.js`（新）/ `src/data/changelog/c13b.js`（新）/ `src/data/changelog/c13.js`（刪）/ `src/data/changelog/index.js`（import + spread 替換）/ `.claude/backlog.md`（「後續批次拆檔」段刪 c13.js 那條）/ `src/data/changelog/current.js`（本條）。',
      '**驗證**：`npm run build` pass（dist bundle 0.1KB 變動正常 — frozen 資料完全等價）。',
    ],
  },
  {
    date: '2026-05-11',
    title: 'Dashboard 卡片新增「複製」按鈕 — 一鍵 fork 整條 L3 工作流做延伸編輯',
    items: [
      '**緣由**：使用者：「我希望在首頁新增一個功能，可以複製一整條流程來做延伸編輯」。對應 backlog #3（原 AC）— 阿明做完 `5-1-2 報名繳費`，主管說「6 月有特別場次，流程八成一樣」，過去要從頭重建或匯出 Excel 改編號再匯入；現在卡片按一下就好。',
      '**UX 流程**：FlowCard 第一排 [編輯] 後加 [複製] 按鈕（淺藍 px-3，跟 [刪除] 對稱）→ 點擊跳 mini-modal「新 L3 編號 + 新名稱」（編號留空、placeholder 顯示原編號當提示；名稱預設「<原名稱>（複本）」）→ 即時 inline 驗證 L3 格式（`X-Y-Z`，三段橫線）→ 確認後 silent saveFlow + 跳進 FlowEditor 看新流程。撞號不擋（依使用者規則）— 按確定走跟 `handleSave` 一樣的 `window.confirm`「L3 編號已被活動 X 使用，確定要建立複本？」，使用者按 OK 就允許並存。',
      '**`cloneFlow` 純函式（`storage.js`）**：deep clone 全部 task / role / 閘道 condition，每個 uuid 都重新產生；交叉引用同步重映射 — `task.roleId` / `task.nextTaskIds[]` / `task.conditions[].nextTaskId` / `task.connectionOverrides` keys（regular task 是 task uuid、gateway 是 condition uuid）；`task.l4Number` 全部 strip，靠 `computeDisplayLabels` 用新 L3 編號 + task 順序重算（spec §3「_g/_s/_e 共用 anchor」自動沿用）。reset 欄位：`pinned=false` / `importWarnings=[]` / `flowAnnotation` 不帶 / `createdAt+updatedAt` 留 saveFlow 設。保留：`task.meta`（30 個輔助欄位資料）/ `task.subprocessName`（raw L3 字串，跨流程引用照舊指向原子流程，符合決策點 E1）。',
      '**動到的檔案（5 個）**：`src/utils/storage.js`（+`cloneFlow` export，+~75 行；檔大小 12KB → 15.1KB，剛過 15KB 軟上限 ~100 bytes、未過 20KB 硬上限，未來再有大改動時順便拆）/ `src/components/Dashboard/CloneFlowModal.jsx`（新檔，4.7KB，mini-modal 含格式驗證 / Enter 提交 / 點外面取消）/ `src/components/Dashboard/FlowCard.jsx`（+ `onClone` prop + 「複製」按鈕）/ `src/components/Dashboard/index.jsx`（+ `pendingClone` state + `handleCloneResolve` + 把 modal 掛到 JSX 樹底）/ `src/App.jsx`（+ `handleClone` orchestrator：cloneFlow → 撞號 confirm → saveFlow → 跳 FlowEditor）/ `src/data/changelog/current.js`（本條）。',
      '**Backlog 更新**：item #3「複製整個 L3 工作流」搬到「已完成」段（PR #199）。',
    ],
  },
  {
    date: '2026-05-06',
    title: '閘道分支可寫「調用子流程 X-Y-Z」+ 自動補對應 _s 子流程元件',
    items: [
      '**緣由**：使用者匯入 Excel 第 82 列：L4=`5-1-2-3_g`、任務關聯說明=「條件分支至 5-1-2-4（不需要）、調用子流程 5-2-8（需要）」。預期：認成 XOR 閘道、有兩條分支（其中一條分支指向 L3 子流程元件）。實際：被 validator 誤判成「子流程列要加 _s 後綴」+「_g 跟調用子流程衝突」雙重 error 擋住整個匯入。',
      '**Bug 1（validator 誤判）— `excelImport/validators.js`**：原 `isSubprocessRow = /調用子流程 X-Y-Z/.test(text)` 在整段文字找到就 hit，閘道的分支裡有「調用子流程」也被當成 subprocess 列。改成 `hasSubprocessCall && !gatewayType` — 只有當 `調用子流程` 是 row 的 primary 出口（沒 fork keyword）才算是 subprocess 元件列。同時 line 101「_s 但缺調用子流程」改用寬鬆的 `hasSubprocessCall`（畢竟即便是 _s + fork 怪情境，仍想驗證 調用子流程 phrase 存在）。',
      '**Bug 2（parser 漏掉子流程分支）— `model/connectionFormat.js splitForkEntries`**：原 splitForkEntries 用 `NUM_HEAD` 匹配 entry 開頭，「調用子流程 5-2-8（需要）」開頭不是數字 → silently 丟掉。加 fallback：先試 `^調用子流程 (X-Y-Z)`，匹配時編碼成特殊 marker `__sub__:X-Y-Z` 推進 numbers 陣列。Marker 不改 API shape，buildFlow 看到 prefix 自己處理。',
      '**Bug 3（builder 沒 auto-create _s 元件）— `excelImport/buildFlow.js`**：閘道第二趟連線解析時，加 `resolveBranchTarget(n, label)` helper：`__sub__:` marker 會 (a) 先掃 taskList 找既有 `<gatewayBase>_s\\d*` 元件指向同 calledL3 → 重用其 id (b) 找不到才 auto-create 新的 l3activity 元件，L4=`<base>_s` / `_s1` / `_s2`（同 anchor，符合 spec §3「_g/_s/_e 共用 anchor」），subprocessName=calledL3，roleId 繼承閘道。auto-create 的元件累積到 `flow.__autoSubAdds`（內部欄位，orchestrator 撈完即刪不入 storage）。',
      '**Step 4 — orchestrator surface 提醒（`excelImport/index.js`）**：把 `__autoSubAdds` 轉成 banner warning，用「已自動補上」（屬於「調整」家族 — 真的有改、加了一列），格式：headline「已自動補上 N 個子流程元件（閘道分支寫了「調用子流程」但 Excel 沒對應的 _s 列，依規則自動建立）：」+ 每筆「`5-1-2-3_s`（調用 5-2-8）— 由閘道 `5-1-2-3_g` 的「需要」分支建立」。push 進 `normalizeWarnings` family（在原有 fix list 之前）+ flow.importWarnings。',
      '**情境 E（既有 `_s` 重用）覆蓋**：reuse 條件 = 同 anchor + 同 calledL3。E.g. user 已加 `5-1-2-3_s`（subprocessName=5-2-8）→ 閘道分支重用既有，不重複建。情境 D（多 subprocess 分支）→ 各自建立 `_s` / `_s1`。情境 F（跨閘道）→ 因 anchor 不同各自有元件。',
      '**驗證**：`npm run build` 通過。Mental trace 第 82 列：(a) validator gatewayType=xor / isSubprocessRow=false → 兩個 error 都不 fire ✅ (b) splitForkEntries 產 `branchToNumbers=[\'5-1-2-4\', \'__sub__:5-2-8\']` ✅ (c) buildFlow 找不到既有 _s → 建 `5-1-2-3_s`（subprocessName=5-2-8，l3activity 元件）→ 閘道兩條分支都連好 ✅ (d) banner 跳「已自動補上 1 個子流程元件...」list-disc 列點 ✅。',
      '**動到的檔案（5 個）**：`src/utils/excelImport/validators.js`（isSubprocessRow guard + line 101 用 hasSubprocessCall）/ `src/model/connectionFormat.js`（splitForkEntries 認 `調用子流程` entry → __sub__: marker）/ `src/utils/excelImport/buildFlow.js`（resolveBranchTarget + nextSubprocessSuffix + autoSubAdds tracking + flow.__autoSubAdds 回傳）/ `src/utils/excelImport/index.js`（autoSubWarnings 列表 + 強制 push warnings）/ `src/data/changelog/current.js`（本條）。',
    ],
  },
  {
    date: '2026-05-06',
    title: 'changelog freeze c26（current.js 28KB → 0）+ backlog log PR #196',
    items: [
      '**緣由**：使用者「請執行並合併在 197」— PR #197 原本只 log PR #196 done，順手把已過 7KB 凍結門檻 4 倍的 `current.js`（28KB）一起凍結成 c26，避免之後每個 PR 改 changelog 都更慢。',
      '**Freeze 步驟**：(1) `git mv src/data/changelog/current.js src/data/changelog/c26.js` (2) 改 c26.js 檔頭 doc-comment 標明 frozen 日期 + 涵蓋範圍 (3) 新建空 `current.js`（只含 `export default []`） (4) `index.js` 加 `import c26 from \'./c26.js\'` + spread 順序放在 c25 之前。',
      '**Backlog 更新（已隨 PR #197 commit）**：item #2「自動連線優化、閘道避開」更新為 Phase A + B 已 DONE（PR #196 涵蓋）+ Phase C grid-based path-finder 仍 open；2026-05-06 已完成段落新增 PR #196 條目。',
      '**動到的檔案（4 個）**：`src/data/changelog/c26.js`（新檔，從 current.js rename + 改檔頭）/ `src/data/changelog/current.js`（reset）/ `src/data/changelog/index.js`（import c26 + spread）/ `.claude/backlog.md`（PR #196 done + item #2 更新）。',
    ],
  },
  {
    date: '2026-05-06',
    title: '隱藏 Header「錯落」按鈕（保留 staggerLanes 邏輯，未確定的功能不在正式站曝光）',
    items: [
      '**緣由**：使用者：「在正式站裡不可以有錯落這個按鈕，請保留錯落的設計，但是先不要出現任何按鈕，這是還沒有確定要的功能」。錯落排列是 preview branch 的視覺實驗（奇數泳道右移 COL_W/2 = 92px）— 上線測試後使用者尚未決定要不要 ship、所以從 UI 拿掉但底層保留。',
      '**修法**：(1) `Header.jsx` 移除「錯落」按鈕 + 對應 props (staggerLanes / onToggleStagger) (2) `FlowEditor/index.jsx` 移除 `toggleStagger()` function + 對 Header 的 props pass (3) **不動** `computeLayout.js`：`flow.staggerLanes` 仍會從 stored data 讀進來（早期 preview 開過的 flow 會 honor 這個 flag）+ `laneXOffset` 計算邏輯完整保留。未來決定 ship 時把 Header 按鈕加回來即可、無需重做底層。',
      '**動到的檔案（3 個）**：`src/components/FlowEditor/Header.jsx`（移除按鈕 + props）/ `src/components/FlowEditor/index.jsx`（移除 toggleStagger + props pass）/ `src/diagram/layout/computeLayout.js`（更新註解標明邏輯保留 + UI 暫隱藏）。',
    ],
  },
];

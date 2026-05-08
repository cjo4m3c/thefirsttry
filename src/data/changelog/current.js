/**
 * Changelog "current tip" — new entries since last freeze land here.
 * When this file grows beyond ~7KB, freeze: rename to c{next}.js + reset to [].
 * Entries are newest-first within file.
 */
export default [
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

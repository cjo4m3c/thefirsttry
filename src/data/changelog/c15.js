/**
 * Frozen chunk c15 — 2026-04-29 batch:
 *   業務規格文件單一來源 refactor (PR #84) + Phase 2 PR-5/6/7 (PR #80/#81/#82)
 * Frozen 2026-04-29 when current.js reached 9.97KB.
 */
export default [
  {
    date: '2026-04-29',
    title: '業務規格文件單一來源 refactor — spec doc + helpPanelData + 規則文件分流',
    items: [
      '**緣由**：使用者：「希望可以產出一份業務規格文件，未來協作以這份文件的規則為基礎來討論優化，首頁右上角『規則說明』也以這份文件為基礎撰寫使用者需要知道的操作重點」。原本 `.claude/business-rules.md`（給 Claude）跟 `HelpPanel.jsx`（給使用者）兩邊都自稱 single source of truth，改規則時容易漂移。本 PR 重整為「業務規則 1 個源頭 + 2 個 consumer」結構。',
      '**新檔 `docs/business-spec.md` 12 章 / ~16KB**（業務規則單一來源）：階層定義 / 編號規則 / 元件類型 / 連線序列 / 路由三規則 / 編號顯示分層 / 儲存檢核兩層 / 編輯操作 / 禁止規則 / 匯出格式 / Excel I/O 相容 / 七視圖一致性。每章末尾「對應實作」列**目錄路徑 + 關鍵符號名**（不寫具體檔名，避免重構拆檔 silent drift），唯一例外是 §12 七視圖表保留具體 entry file 當 audit checklist。順手修正草稿 2 個錯路徑（`RightDrawer` / `Wizard` 在 `src/components/`、`violations` 在 `src/diagram/`）。',
      '**新檔 `src/data/helpPanelData.js` 15.8KB**（HelpPanel 給使用者看的規則摘要）：8 個 data array（HIERARCHY / NUMBERING / ELEMENTS / VALIDATION / CONNECTIONS / EDITABLE_ACTIONS / FORBIDDEN_RULES / EXPORTS）從 HelpPanel.jsx 完整搬出，每個 array 上方加 `// 對應 docs/business-spec.md §X` 章節錨點。',
      '**`HelpPanel.jsx` 26KB → 11.3KB**：刪 263 行 data 區段 + 維護註解 header，剩純 UI render。對外 API 不變（仍 default export），App.jsx 一行不動。**順手解掉 backlog 一條**：`HelpPanel.jsx 26KB` 拆檔項移除。',
      '**`.claude/business-rules.md` 4.9KB → 3KB**：§1（5 條業務規則）+ §2（閘道分類）刪掉改 pointer 指向 spec doc，保留 §3（工程慣例：trace 驗證 / Excel I/O 相容 / CJK wrap / 文件同步 / 日期取法）+ §4（協作偏好）。本檔現在只放 Claude 工作流相關慣例。',
      '**`CLAUDE.md` 更新（7.2KB → 8KB）**：頂部外部檔清單加 spec doc + helpPanelData.js；§8 完成檢查表第 3 點明確列出「改業務規則 = `docs/business-spec.md` + `src/data/helpPanelData.js` + changelog 三件組」；§10 業務規則表加 spec 章節欄；§3 閘道分類 pointer 改指 spec doc §4.1；§6 拆檔已解清單加 HelpPanel 26KB→11.3KB。',
      '**驗證**：`npm run build` 通過（112 modules transformed），HelpPanel modal Section render 邏輯逐行保留。',
    ],
  },
  {
    date: '2026-04-29',
    title: 'Phase 2 PR-7：抽出 src/model/validation.js + Excel 匯入跑同一套 warning',
    items: [
      '**動機**：使用者「Blocking 結構檢核 + Warning soft 提醒兩層」原本只有編輯器的儲存按鈕會跑（`FlowEditor/validateFlow.js`），Excel 匯入完直接落到 Dashboard 不經編輯器，孤兒任務 / 未指定下一步 / merge 來源不足等問題要等使用者開編輯器才看得到。',
      '**新建 `src/model/validation.js`（5.5KB）**：把 `validateFlow.js` body 完整搬出來，pure 模組無 React / 無 I/O / 無視圖層 import。`detectOverrideViolations` 留在 `src/diagram/violations.js`（要 `computeLayout` 才能判斷 routing 違規），但 `diagram/` 也是 infra 不是 view，相依方向合規。',
      '**`FlowEditor/validateFlow.js` 變 4 行 shim**：`export { validateFlow } from \'../../model/validation.js\'`，FlowEditor 儲存流程的 importer 一行不動。',
      '**Excel 匯入 banner 新增驗證行**：`parseExcelToFlow` 對每個產生的 flow 跑 `validateFlow`，blocking 行加 ❌ 前綴、多 L3 匯入加 `[L3 X-Y-Z] ` 前綴，併進原本的 gateway-chain warning 一起回傳。Dashboard 的 `importWarnings` banner 直接消化（之前就支援 array），UI 零變更。',
      '**驗證**：`npm run build` 通過。FlowEditor 儲存 flow 行為應該 byte-identical（shim 直接 re-export 同一個函式）；Excel 匯入路徑多了一段 warning lines append，原本的 gateway-chain warning 不變。',
    ],
  },
  {
    date: '2026-04-29',
    title: 'Phase 2 PR-6：抽出 src/model/flowSelectors.js — flow 衍生資料單一來源',
    items: [
      '**動機**：承接 PR-5 把連線文字搬到 model 層後，`flow` 衍生資料還散在多處：`computeDisplayLabels`（編號顯示）住 `taskDefs.js` 17.4KB（已超 15KB 軟上限），`incoming` 邊計數 map 在 `validateFlow.js` 和 `connectionFormat.js`（PR-5 剛抽完的 model 層）兩邊各寫一次（byte-identical 8 行）。',
      '**新建 `src/model/flowSelectors.js`（6.0KB）**：(1) `computeDisplayLabels(tasks, l3Number)` 從 `taskDefs.js` 搬過來，body 完整保留行為等價；同時 export `getDisplayLabels` 作 idiomatic alias。(2) `getTaskIncoming(tasks)` 抽出 incoming 邊計數 map，回傳 `{ taskId: count }`，給驗證（merge gateway ≥2 來源檢查）和 forward 格式化（merge node 偵測）共用。',
      '**Mechanical refactor（零行為變更）**：`taskDefs.js` 17.4 → 14.3KB（**順便讓它跌破 15KB 軟上限，解掉 backlog 一條**），刪掉 73 行 `computeDisplayLabels` body 改 `export { computeDisplayLabels } from \'../model/flowSelectors.js\'` re-export。`validateFlow.js` 8 行 incoming 計算 → 1 行 `const incoming = getTaskIncoming(tasks)`。`connectionFormat.js` 同樣 8 行 → 1 行 import。所有既有 importer（FlowEditor / DiagramRenderer / excelExport / Dashboard 共 3 處 `computeDisplayLabels` 引用）一行不動。',
      '**handover §4 提的其他 selector 不抽**（避免 over-engineer）：`getL4Index`（沒人重複）、`getL3Summary`（Dashboard 只用 `flow.tasks?.length` 兩行不值得）、`getSwimlaneRows` / role index map（只 `computeLayout.js` 1 處）。等真的出現第二處重複再開 PR 抽。',
      '**結構性保證（grep guard）**：`/sync-views` skill 加 incoming 反 pattern 偵測 — `grep -P \'\\b(incoming|incomingCount|inc)\\[\\w+\\] = \\(\\1\\[\\w+\\] \\|\\| 0\\) + 1\'` 排除 `model/` 後必須空輸出。捕捉「未來有人在視圖層手寫 incoming 計數」的反 pattern。',
      '**驗證 SOP**：(1) `/tmp/trace-pr6.mjs` 跑 5 個 fixture（含 stored l4Number / 無 l4Number / multi-incoming merge / loop-return / breakpoint）→ baseline md5 `cdcfcfc6` = after md5 `cdcfcfc6`，byte-identical。涵蓋 `computeDisplayLabels` / `formatConnection` / `validateFlow` 三個函式輸出。(2) `npm run build` 通過（108 modules transformed）。(3) grep guard 空輸出。(4) `find src -size +15k` 命中數從 5 減到 4（`taskDefs.js` 解掉）。',
      '**修正 PR-5 cosmetic typo**：`c14.js` line 10「自身大瘦身」段半形括號 `()` 改回全形 `（）`，跟整份 changelog 中文括號慣例對齊。',
    ],
  },
  {
    date: '2026-04-29',
    title: 'Phase 2 PR-5：抽出 src/model/connectionFormat.js — 連線格式化單一來源',
    items: [
      '**動機**：使用者「希望修改操作邏輯時，同一筆資料的改動可以同步在所有同資料的地方」。連線中文字串原本散在 `excelExport.js::generateFlowAnnotation`（forward）和 `excelImport.js::parseFlowAnnotations`（reverse）兩處獨立寫，未來改詞彙（例如「條件分支至」→「條件分流至」）要兩邊各自更新；FlowTable / drawio / Dashboard 又從各處 consume 這些字串。',
      '**新建 `src/model/connectionFormat.js`（13.2KB）**：(1) `PHRASE` 物件集中所有中文片語常數（XOR/AND/OR fork、條件/並行/包容 merge、loop return、subprocess call、流程開始/結束、流程斷點），(2) `formatConnection(task, allTasks, l4Map)` forward 函式，(3) `parseConnection(text)` reverse 函式，(4) `detectGatewayFromText(text)` 給 Excel 匯入 L4 編號驗證用。forward 與 reverse 共用同一份 `PHRASE` → 改一個常數、匯出 / 匯入兩邊自動同步。',
      '**結構性保證（grep guard）**：`/sync-views` skill 加新的檢核 — `grep -P \'(?:條件|並行|包容|可能)分支至(?!少)\'`（PCRE 負向 lookahead 排除「分支至少需要」偽命中），排除 `model/` / `changelog/` / `HelpPanel.jsx` / `Dashboard.jsx` 後必須空輸出。HelpPanel 是規則文件 prose、Dashboard 是 landing 靜態示例，兩者都不渲染真實 flow，列入白名單以維持規則文件可讀性。',
      '**既有檔案 mechanical refactor**：`excelExport.js`（7.3 → 3.6KB）刪掉 95 行 `generateFlowAnnotation` body，改 `import { formatConnection } from \'../model/connectionFormat.js\'` + `export const generateFlowAnnotation = formatConnection` 別名。`excelImport.js`（17.2 → 14.9KB）刪掉 110 行 `parseFlowAnnotations` body 和 `detectGatewayFromText`，改從 model 層 import + 別名。FlowTable / Dashboard / DiagramRenderer / drawioExport 等所有既有 importer 一行不動。',
      '**驗證 SOP**：(1) `/tmp/trace-pr5.mjs` 跑 11 個 fixture（sequential / XOR fork / AND fork / OR fork / 三種 merge / loop return / subprocess / start with multi-targets / breakpoint / multiple-outgoing / fork to end）→ 抽前 baseline md5 `a097f49f` = 抽後 md5 `a097f49f`，byte-identical。(2) `npm run build` 通過（108 modules transformed）。(3) grep guard 空輸出。(4) 所有 source 檔 < 15KB 軟上限。',
      '**Changelog freeze**：current.js 加完條目達 9.5KB → 凍結舊內容到 `c14.js`（4 條 PR-4 / Phase 1 拆檔），`index.js` 加 c14 import，current.js 重置只留本 PR 條目。',
    ],
  },
];

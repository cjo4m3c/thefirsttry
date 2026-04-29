/**
 * Frozen changelog chunk #15 — Phase 2 model-layer extraction (PR-5, PR-6).
 * Newest-first.
 */
export default [
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

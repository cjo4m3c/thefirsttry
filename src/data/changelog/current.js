/**
 * Changelog "current tip" — new entries since last freeze land here.
 * When this file grows beyond ~7KB, freeze: rename to c{next}.js + reset to [].
 * Entries are newest-first within file.
 */
export default [
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

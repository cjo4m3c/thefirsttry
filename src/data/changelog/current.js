/**
 * Changelog "current tip" — new entries since last freeze land here.
 * When this file grows beyond ~7KB, freeze: rename to c{next}.js + reset to [].
 * Entries are newest-first within file.
 */
export default [
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
      '**`CLAUDE.md` §4 加 PR-merge 日期對照規則**：每次寫 changelog `date` 必須以 `mcp__github__pull_request_read get_pull_request` 或 `list_pull_requests` 取得目標 PR 的 `merged_at` ISO 日期為準（不是「正在寫的時間」、不是「PR 開立日期」）。如果是同一 session 還沒 merge → 暫填當天日期、merge 完後補正一次（含 ship-feature skill workflow 提醒）。新規則寫進 §4 「Changelog 維護」段，列為第 5 條 bullet。',
      '**`current.js` 凍結 c25**：current.js 在校正前 ~55KB（含校正後的 20 條），遠超 7KB 凍結門檻 — 執行 §4 freeze workflow：cp current.js c25.js、改檔頭註解、`index.js` 加 c25 import，current.js 重置為僅含本條。c25 收 PR #159~#184 共 20 條條目。',
      '**未動的部分**：c01~c24 凍結檔的歷史日期沒在這次 audit 範圍（量大、且這批沒踩到 cross-day merge）。如果之後比對使用者出 bug 可單獨開 audit PR。',
      '**驗證**：`npm run build` 通過。CHANGELOG export 數量不變（c25 加入後仍是同一條陣列）。HelpPanel 變更紀錄 tab 顯示順序：本條 → c25.js（20 條） → c24.js → ... → c01.js。',
      '**動到的檔案（4 個）**：`src/data/changelog/current.js`（先 8 處日期校正，再 reset 成本條）/ `src/data/changelog/c25.js`（新檔，從校正後 current.js 拷貝 + 改檔頭）/ `src/data/changelog/index.js`（加 c25 import + 對齊 spread）/ `CLAUDE.md`（§4 加第 5 條 PR merged_at 對照規則）。',
    ],
  },
];

/**
 * Changelog "current tip" — new entries since last freeze land here.
 * When this file grows beyond ~7KB, freeze: rename to c{next}.js + reset to [].
 * Entries are newest-first within file.
 */
export default [
  {
    date: '2026-05-06',
    title: 'SOT 清理：泳道角色顏色 hex 改 import COLORS / KIND_BADGE 加 vs CONN_BADGE 範圍註解',
    items: [
      '**緣由**：使用者要求「同一個事情每次改動只要改一個地方，不會漏改」。先做兩處低風險 SOT 違規清理：(1) external/internal 泳道顏色 hex 在 3 個 component 裡寫死、改色得跑 3 處 (2) `KIND_BADGE` 跟 `taskDefs.js CONN_BADGE` 鍵有交集容易誤以為是 duplicate。',
      '**泳道顏色 import 統一**：`#009900`（external）/ `#0066CC`（internal）原本 hardcoded 在 3 個 view component（`Wizard.jsx:155,175` / `Dashboard.jsx:432` / `FlowEditor/DrawerContent.jsx:293`，共 4 處）。canonical source 一直都在 `src/diagram/constants.js COLORS.{EXTERNAL_BG, INTERNAL_BG, EXTERNAL_TEXT}`（DiagramRenderer / sticky header 已正確使用）。把 4 處 hex 全換成 `COLORS.EXTERNAL_BG` / `COLORS.INTERNAL_BG`、白字換成 `COLORS.EXTERNAL_TEXT`。3 個檔加 `import { COLORS } from \'<path>/diagram/constants.js\'`。改一次 `COLORS.EXTERNAL_BG` 全網頁同步：泳道 header / Dashboard 卡片 role chip / Wizard 設定列 / FlowEditor 抽屜 role select。',
      '**`elementTypes.js` 加 KIND_BADGE vs CONN_BADGE 範圍註解**：兩份 BADGE map 鍵有交集（`task` / `gateway-xor` 等）但 axis 不同 — KIND_BADGE 對應元件類型（chip on TaskCard col 2 + ContextMenu header），CONN_BADGE 對應連線型（連線 row 底色）。註解明寫「不是 duplicate、不要 silently sync」，提醒之後 PR 改色時不要誤把另一邊也改了。',
      '**沒動的部分**：`model/validation.js describeElement()` 也維護一份元件類型中文 mapping，但跟 KIND_SHORT_LABEL 故意不同（warning 用 verbose「L4 任務」/「外部關係人互動」/「L3 流程」、chip 用 compact「任務」/「外部互動」/「子流程」）。要不要強制統一是 UX 決定（會改 user-facing warning 文字），留給使用者單獨判斷後再做。',
      '**驗證**：`npm run build` 通過。視覺驗證點：(a) Dashboard 卡片 role chip 顏色不變 (b) Wizard 角色設定列 type select 底色不變 (c) FlowEditor 抽屜 role select 底色不變 (d) 流程圖 sticky lane header 底色仍由 COLORS 控制（沒動）。',
      '**動到的檔案（5 個）**：`src/components/Wizard.jsx`（COLORS import + 2 處 hex 替換）/ `src/components/Dashboard.jsx`（COLORS import + 1 處）/ `src/components/FlowEditor/DrawerContent.jsx`（COLORS import + 1 處）/ `src/utils/elementTypes.js`（KIND_BADGE 註解擴充）/ `src/data/changelog/current.js`（本條）。',
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

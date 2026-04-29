/**
 * Changelog "current tip" — new entries since last freeze land here.
 * When this file grows beyond ~7KB, freeze: rename to c{next}.js + reset to [].
 * Entries are newest-first within file.
 */
export default [
  {
    date: '2026-04-29',
    title: '流程圖字級三層化 + 框體精簡 + 行距拉開（收掉 backlog X）',
    items: [
      '**緣由**：使用者：「之前那個版面上單純把字放大、格子還是一樣大、字跟框邊界縮短，泳道角色欄位適度變窄，會議室遠看也清楚」+「L4 編號改用 L2 字級，多行文字行距拉開比較友善檢視」。c13 整體 +40% 放大版面後，框與字一起變大，框內 padding 過鬆（NODE_H 72 vs 1 行字 22 → 上下 25px 空白），泳道角色欄位 180px 給 7 字 wrap 預算多數浪費，字級散在 10 處不一致（任務名 16 / 閘道下標 15 / 連線 14 / 編號 13 / tooltip 12 五種混用）。',
      '**框體尺寸縮減（`src/diagram/constants.js`）**：`NODE_W` 180→156、`NODE_H` 72→60、`COL_W` 224→184、`LANE_H` 196→152、`LANE_HEADER_W` 180→108。1920×1080 螢幕一螢幕可看 5+ 條泳道（原 ~4）。`MAX_SHAPE_BOTTOM_OFFSET` (130) vs LANE_H (152) 仍有 22px buffer，`minLaneH(slots)` 連動算 routing slot 高度不撞。drawio / PNG 匯出檔自動跟隨 LAYOUT，不另改。',
      '**字級三層化**：L1 大（任務名稱 16 / 泳道角色 18 / 標題 22）/ L2 中（連線 label / Start-End 名 / 閘道下標 / 子流程 / **L4 編號** 全 14）/ L3 小（Start-End 補充 / hover tooltip 全 13）。閘道下標從孤立 15 拉齊 14；tooltip 從 `text-xs`(12) 拉到 `text-[13px]` 補齊一致；L4 編號依使用者要求從 13 升到 14（提升至 L2，task 上方編號可讀性提升）。',
      '**行距拉開（多行文字檢視優化）**：使用者：「行和行的距離有多行的情況會擠在一起，可以再拉開一點比較友善檢視」。`SvgLabel` lineH 22→24、`StickyHeader` 角色 lineH 22→26、`EventLabel` nameLineH 18→20 / descLineH 17→19、閘道下標 lineH 20→22。',
      '**wrap maxChars 連動**：框縮後字級不變、wrap 預算同步收，避免文字撞框 — `SvgLabel` 預設 maxChars 10→9、`StickyHeader` 角色 7→4（搭配 LANE_HEADER_W 108）、`EventLabel` 名 14→11 / desc 18→14、閘道下標 10→9。',
      '**動到的檔案**：`src/diagram/constants.js`（LAYOUT 5 項）/ `src/components/DiagramRenderer/text.jsx`（SvgLabel 預設 + L4Number + EventLabel）/ `StickyHeader.jsx`（角色 wrap）/ `shapes.jsx`（閘道下標）/ `overlays.jsx`（tooltip）。`build` 通過。',
      '**跨場景縮放**：使用者要的「筆電一螢幕多 vs 會議室遠看」兩場景，**用瀏覽器內建 Ctrl+/Ctrl- 縮放**處理（不自製 zoom slider）。理由：原生快捷鍵已普及、工具列也跟著變大對會議室觸控更友善、零工程量。Phase A baseline 修對後就不需自製。',
      '**Backlog**：條目 X「字級放大後版面修補」搬到「已完成」。',
    ],
  },
  {
    date: '2026-04-29',
    title: 'backlog 合併 + 交接文件 + changelog 凍結 c15',
    items: [
      '**緣由**：使用者一次提了 13 條待辦（部分重複舊條），順手請求補交接文件給下個 session。',
      '**backlog 合併**：6 條真新加入（**X** 字級放大版面修補 / **Y** tooltip 編輯既有閘道分流條件 / **Z** 閘道 fork+merge auto-fill 任務關聯說明 / **AA** 新增任務自動帶入泳道角色 / **AB** 任務連線到閘道自動新增分支欄位[待確認] / **AC** 複製整個 L3 工作流），6 條跟既有條目（F / M-1 / U / V / B / E）合併不重複新增。Phase 2 PR-5/6/7 從「進行中」標 ✅ 已完成；後續批次拆檔表移除已解的 `HelpPanel.jsx` 26KB（PR #84 已抽 helpPanelData）。',
      '**新檔 `.claude/handover-2026-04-29.md` 7.2KB**：給下個 session 的時點性快照 — 當前 git 狀態、本次完成的 4 commits、新建立的 3 條約定（三件組同步 / 對應實作目錄+符號名 / business-rules.md 不放業務規則）、6 條已知陷阱、優先序建議。下個 session 讀完可以刪。',
      '**Changelog freeze**：current.js 達 9.97KB（已超 7KB 軟上限），凍結到 `c15.js`（業務規格 refactor + PR-5/6/7 共 4 條）；`index.js` 加 c15 import；current.js 重置只留本 PR 條目。',
    ],
  },
];

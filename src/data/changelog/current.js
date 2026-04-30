/**
 * Changelog "current tip" — new entries since last freeze land here.
 * When this file grows beyond ~7KB, freeze: rename to c{next}.js + reset to [].
 * Entries are newest-first within file.
 */
export default [
  {
    date: '2026-04-30',
    title: '流程圖文字 UI 微調：任務元件行距 / 條件分支標籤白底寬度 / L4 編號白底',
    items: [
      '**緣由**：使用者提了 3 個 UI 問題：(1) 任務元件三行字擠在一起、中英文混排特別擠 (2) 條件分支連線上的標籤白底太大（固定 40×22px）跟字長不匹配 (3) 任務元件上方端點有線連入/連出時，編號文字直接被線穿過去看不清楚。',
      '**問題 1 root cause**：`shapes.jsx:51` TaskShape 用 `lineH={14}` 但 fontSize 預設 16，ratio = 0.875（< 1.0 等於行距小於字高），三行會疊在一起。同檔其他 shape（L3 / Gateway）都用 22-32（1.4-2.0 ratio）— 這是 outlier bug。',
      '**問題 1 修法**：(a) `lineH` 14 → 24（fontSize 16 × 1.5 ratio，跟使用者建議一致）(b) `SvgLabel` 加 `letterSpacing="0.02em"` 讓中英文混排稍微鬆一點。NODE_H=84 容得下 3 行 × 24px lineH + glyph height（總高 ~64px，餘 20px padding 上下平分）。',
      '**問題 2 root cause**：`arrows.jsx:99` `<rect x={labelPt[0] - 20} ... width={40} height={22}>` 是固定 40×22 slab — 短 label（例「Y」單字）右半邊一片空白、長 label（例「條件 A」）會被裁掉。',
      '**問題 2 修法**：抽 `estimateTextWidth(text, fontSize)` 純函式放到 `text.jsx`（CJK ~1× fontSize、Latin ~0.55×），arrows.jsx 改用 `labelW = estimateTextWidth(label, 14) + 8`、`labelH = fontSize + 4`。短長 label 都剛好包字。',
      '**問題 3 root cause**：`L4Number` 只有 `<text>` 沒 background。任務上方端點是進/出口時，連線會經過編號文字所在區域（`y - 7` ≈ rect 上方 7px），線跟字直接重疊。雖然 paint order 上 L4Number 在 arrow 之上（`TasksLayer` 渲染在 connections 之後），但缺底色等於透明，使用者眼睛仍會被線干擾。',
      '**問題 3 修法**：`L4Number` 加白底 pill（`<g>` + `<rect>` + `<text>`），width 用 `estimateTextWidth(number, 14) + 8`、height = 18，opacity 0.9。配合既有的 paint order（ConnectionArrow → TasksLayer），底色直接遮住下方線段，編號文字清晰可讀。',
      '**動到的檔案（4 個）**：`src/components/DiagramRenderer/text.jsx`（+`estimateTextWidth` helper / `SvgLabel` 加 letterSpacing / `L4Number` 加白底 pill）/ `src/components/DiagramRenderer/shapes.jsx`（TaskShape lineH 14→24）/ `src/components/DiagramRenderer/arrows.jsx`（edge label 動態寬度）/ `src/data/changelog/current.js`（本條）。`build` 通過。',
      '**驗證情境**：(a) 任務元件 3 行中英混排（例「提供計算Risk shipment及當月出貨達成狀況」）行距明顯拉開、字元間距微鬆 ✓ (b) 條件分支標籤「Y」「N」短字白底窄、長字「條件 A」白底寬，都剛好包住文字 ✓ (c) 任務上方端點有箭頭進出時，編號白底擋住線段，文字清晰可讀 ✓',
    ],
  },
  {
    date: '2026-04-30',
    title: '交接文件全面整理：HANDOVER / README / CLAUDE.md / orphans 同步到當前 main 狀態',
    items: [
      '**緣由**：使用者：「請檢查所有的交接檔案都有在最新，確保下一個人要看的時候完全知道怎麼操作，可以從0開始無縫接手」+「業務規則主檔、change log 也要在最新喔」。今日 8 個 PR（#114-#121）merge 後，多份交接文件還停留在 4/29 之前的狀態，新接手者讀會 broken。',
      '**Step 1 — 砍掉兩份過時的 session-specific 手冊**：(a) `.claude/handover-2026-04-29.md`（自身 §7 已寫「下個 session 讀完此檔可以直接刪掉」、承接的 Phase 2 / spec doc refactor 早已完成）(b) `.claude/phase2-handover.md`（Phase 2 三個 PR #80/#81/#82 早已 merge 進 main）。兩檔留著只會增加新接手者的閱讀負擔卻沒長期價值。`orphans.md` 同步補記。',
      '**Step 2 — `HANDOVER.md` 全面更新**：(a) 工作流程文字「`ChangelogPanel.jsx` 條目」→ 實際路徑 `src/data/changelog/current.js`（當前 PR）+ `c01.js`…`c{N}.js` 凍結 chunks (b) 「git push」→ 「`mcp__github__create_pull_request` + 立即 `subscribe_pr_activity`」反映 PR #114 起的 CI 追蹤規則 (c) 目錄樹大改：`ContextMenu.jsx` / `DiagramRenderer.jsx` / `FlowEditor.jsx` / `diagram/layout.js` 全部寫成 directory（PR-0/PR-1/PR-2/PR-3 都是拆檔）+ 新增 `src/model/` / `src/data/` 章節 (d) skills 從 6 個補到 9 個（加 sync-views / preview-branch / wrap-pr）(e) §3.1 編號表加「子流程調用 `_s`」row + `_g` / `_s` 共用 anchor 註解（PR #18 規範）(f) §5.2 接手讀路徑改成 spec doc + changelog directory + layout directory (g) 風險章節「layout.js 龐大」→「`src/diagram/layout/` PR-1 拆 11 檔」 (h) §8 歷史參考資料補上 spec doc / business-rules / backlog / orphans pointer。',
      '**Step 3 — `README.md` 同樣修**：skills 補 3 條、目錄樹改成跟 HANDOVER 一致的 directory 結構、新增 `docs/business-spec.md` + `src/model/` + `src/data/` 條目、storage migration 從「點→橫線、閘道補 _g」更新成 5 個（含 `_s` / merge type / 外部互動 shape sync）、關鍵檔案文案改 layout.js → `src/diagram/layout/`。',
      '**Step 4 — `CLAUDE.md §2` git push 規則更新**：原文「`git push` 被 local proxy 擋下（HTTP 503），不可使用」已過時 — 2026-04-30 起多 session 實測 `git push -u origin <branch>` 穩定運作。改寫成「git push 是預設管道，MCP push 是大檔 fallback」+ 加入「PR 開立用 `create_pull_request` + 立即 `subscribe_pr_activity`」流程（呼應 §8 step 6）。`git push origin --delete` 仍被擋的 caveat 保留。',
      '**Step 5 — changelog freeze**：current.js 累積到 12.9KB（>7KB threshold）→ freeze 成 `c22.js`（含 PR #113 / #115 / #118 / #119 / #121 五條），current.js reset 後加本條，`index.js` 加 c22 import。',
      '**動到的檔案（7 個）**：`HANDOVER.md`（重寫工作流程 / 目錄樹 / 編號表 / 接手路徑 / 風險章 / 歷史參考）/ `README.md`（同步目錄樹 + skills + 關鍵檔案）/ `CLAUDE.md`（§2 git push 流程更新）/ `.claude/orphans.md`（記 dragReorder.jsx + 兩份 handover 刪除）/ `.claude/handover-2026-04-29.md` 刪除 / `.claude/phase2-handover.md` 刪除 / `src/data/changelog/c22.js` 新（freeze）/ `current.js`（reset + 本條）/ `index.js`（加 c22 import）。`build` 通過。',
      '**驗證**：(a) 新接手者讀 README → HANDOVER → CLAUDE.md → docs/business-spec.md 一條龍能完整理解架構 ✓ (b) 目錄樹反映實際 directory 結構（無 stale 單檔指引）✓ (c) skills 列表跟 `.claude/skills/` 實際內容一致 ✓ (d) 編號規則含 `_g` + `_s` + 共用 anchor ✓ (e) git push 規則跟現實對齊 ✓',
    ],
  },
];

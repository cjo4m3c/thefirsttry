/**
 * Changelog "current tip" — new entries since last freeze land here.
 * When this file grows beyond ~7KB, freeze: rename to c{next}.js + reset to [].
 * Entries are newest-first within file.
 */
export default [
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

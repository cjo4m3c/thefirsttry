---
name: doc-audit
description: Comprehensive currency check — verify CLAUDE.md / README / HANDOVER / business-spec / backlog / helpPanelData are aligned with the latest code, plus scan for redundant code (unused exports, dead shims, legacy keywords, oversized files). Use after a wave of related PRs (e.g. a refactor series) or before a release.
---

# /doc-audit — 文件 currency + 冗餘碼 audit

兩段檢查，每段失敗就修：**(1) 6 份文件對齊現況、(2) 冗餘碼掃描**。Audit 範圍大，**建議 spawn agent 跑**（直接呼叫太燒主 context）。

## 觸發時機

- 連續 merge 5+ 個相關 PR 後（refactor 系列、新功能落地）
- Release 前
- 接手 session 時想確認交接狀態
- 使用者說「確認文件最新 / 檢查文件 / sync docs / audit」

## Agent 派工模板

```
Task tool, subagent=general-purpose
  description: "Audit docs + redundant code"
  prompt: """Audit /home/user/FlowSprite for two things, write concise
report (under 600 words). Read-only, no changes.

# Task 1: Doc currency

對 6 份文件對 main 程式碼狀態，標 CURRENT 或 STALE-WITH-DETAILS：

- `CLAUDE.md` — §3 編號（含 `_e`）、§6 size table、§8 PR checklist、§12 工作流通則、§開頭外部檔 pointer 列表
- `README.md` — 目錄樹、storage migration 數、changelog chunk 範圍、關鍵檔案描述
- `HANDOVER.md` — 目錄樹、§2.5 routing 規則、§3.1 編號表（含 `_e`、`_s` row）、§5.1 skill 數量
- `docs/business-spec.md` — §3 元件類型、§3.1 外部互動、§7.1/§7.2 validation 規則、§10 Excel 結構欄數
- `.claude/backlog.md` — 最近 PR 是否登 done、dropped items 是否移除、檔案 size 數據
- `src/data/helpPanelData.js` — NUMBERING / ELEMENTS / VALIDATION / EXPORTS / EDITABLE_ACTIONS / CONNECTIONS 條目跟程式碼一致

每份文件 diff-style 報告（不要 quote 整段），例：「README §X 直系樹漏 src/foo/，新增 PR-X 留下」。

# Task 2: Redundant code scan

掃描下列 5 類，列出 file:line + 風險（low/med/high）：

1. **Unused exports**：`grep export` 後對照 `grep '\\bX\\b'` importer 數
2. **Shim files**：`Dashboard.jsx` / `FlowEditor.jsx` / `DiagramRenderer.jsx` / `ContextMenu.jsx` / `HelpPanel.jsx` / `taskDefs.js` 是否仍是 shim、importer 是否還在
3. **Legacy keywords**：`_w` 應只在 changelog 歷史 + storage migration + taskDefs rename comment；其他位置都是 stale。`migrateLegacyWtoE` 等 typo 引用應改正
4. **File size cap**：`find src -size +15k`（軟）/ `+20k`（硬）— 列出 + 是否在 backlog 記錄
5. **Imports of removed code**：build 應該已抓到，但 IDE 殘留 import 偶見

每筆：file:line + why redundant + risk + suggested fix。

# 格式

回 markdown：

## Task 1: Doc currency
| File | Status | Details |
...

## Task 2: Redundant code
1. xxx (file:line) — risk=low/med/high — fix=xxx

不要修檔案。讀完回 600 字以內 markdown 報告。"""
```

## Audit 完後的動作

依 agent 報告類型分流：

### Doc 不對齊 → 開 cleanup PR
- 一次 PR 收齊 6 份文件改動（用 `claude/<topic>-doc-sync` 分支）
- 每個改動一次小 Edit（不要整 rewrite）
- changelog 加一條描述哪些 staleness 被修

### 冗餘碼 → 評估後決定
- **High risk**（可能還在用、不確定）→ 寫成 backlog 條目，下次有空再除
- **Med risk**（看起來無 importer 但可能有間接使用）→ grep 二次確認後刪
- **Low risk**（明顯 dead code）→ 直接刪、寫 changelog

### 都對齊 → 跟使用者回報「文件 + 冗餘碼皆 current」
- 不要為了 PR 而 PR — 沒事就不改

## 避免做的事

- **不要在主 context 跑 audit**（太燒 token，spawn agent）
- **不要 regenerate 整份文件**（每個小段落改）
- **不要把 audit 跟功能改動混 PR**（cleanup 自成一支）
- **不要因為 agent 沒抓到就放心** — 建議自己再 quick grep `_w` / unused exports，補 verify

## 已知 false positive

- `task.flowAnnotation` 被 `taskDefs.normalizeTask:189` + `excelImport.collectMergeIncomingWarnings` 讀，但只 check keyword 存在性 — 不算 dead code
- `loop-return` 相關常數（CONN_BADGE entry、normalizeTask 分支）— 雖然編輯器已移除 entry 點，舊資料仍會 render，**保留是 defensive** 不算 redundant
- `migrateInteractionSuffix` 的 `/_w\d*$/` regex — 是 legacy 偵測，**不要刪**

## 範例使用

```
User: 確認文件最新
Claude: 開 agent 跑 /doc-audit comprehensive scan
[agent 5 分鐘後回報 STALE 6 條 + redundant 2 條]
Claude: 列摘要 → 問使用者要不要修
User: 修
Claude: 開 cleanup PR
```

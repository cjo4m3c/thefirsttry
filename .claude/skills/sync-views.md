---
name: sync-views
description: Verify the seven-view consistency invariant + the single-file size limit + the no-duplicate-source-of-truth rule. Use after any task / role / connection / numbering / display-text change, before shipping. Runs automated greps; flags violations.
---

# /sync-views — 七視圖一致性 + 單檔大小 + 共用層完整性檢核

當任何 `task` / `role` / `connection` / 編號 / 顯示文字被改動後，**七個視圖必須同步**：

| # | 視圖 | 入口檔案 |
|---|---|---|
| ① | 網頁首頁卡片 | `Dashboard.jsx`（L3 列表 + 摘要） |
| ② | 網頁中流程圖 | `DiagramRenderer/` + `src/diagram/layout/` |
| ③ | 編輯器（drawer flow tab + roles tab + Wizard） | `FlowEditor/` + `RightDrawer.jsx` + `Wizard.jsx` |
| ④ | 網頁表格欄位（流程圖下方 Excel 表） | `FlowTable.jsx` |
| ⑤ | 下載資料：Excel | `excelExport.js` |
| ⑥ | 下載資料：drawio | `drawioExport.js` |
| ⑦ | 下載資料：PNG | `DiagramRenderer/index.jsx handleExport`（`html-to-image`） |

七視圖必須讀同一份 `liveFlow.tasks` + `computeDisplayLabels`，**任何一處殘留舊值就算這次未完成**。

## 自動化檢核（每次 ship 前跑）

### 1. 單檔大小（CLAUDE.md §6）

```bash
find src -type f \( -name "*.js" -o -name "*.jsx" \) -size +15k -exec ls -la {} \;
```

- **無輸出** = 全部過關
- **有輸出** = 命中軟上限 15KB
  - 若同時 > 20KB → **擋下任何新功能**，先開拆檔 PR
  - 若 15-20KB → 在 PR 描述說明「為何不拆」或排 follow-up
  - 拆檔範本：`layout/` / `DiagramRenderer/` / `FlowEditor/` 都是「shim re-export + 子目錄」pattern

### 2. 共用層唯一性（PR-5 起啟用）

連線格式化字串集中在 `src/model/connectionFormat.js::PHRASE`，視圖層只能 `import { formatConnection, parseConnection }`，不可再寫死中文片語：

```bash
# 閘道分支詞彙（forward / reverse 皆已抽到 model）
# 用 PCRE 負向 lookahead 排除「分支至少需要」這類含括號文字的偽命中
grep -rnP '(?:條件|並行|包容|可能)分支至(?!少)' src/ \
  --include="*.js" --include="*.jsx" \
  --exclude-dir=model --exclude-dir=changelog \
  --exclude=HelpPanel.jsx --exclude=Dashboard.jsx
# 期待：空輸出
# 白名單例外：
#   - HelpPanel.jsx：規則文件 prose（人讀，不渲染真實 flow）
#   - Dashboard.jsx：landing hint card 靜態示例（不渲染真實 flow）
```

未來改 `PHRASE.XOR_FORK = '條件分流至'` 之類詞彙：
1. 改 `connectionFormat.js` 的常數 → 匯出 / 匯入兩邊自動同步
2. 手動同步 HelpPanel + Dashboard 的範例文字（grep 一下找 3 處）

```bash
# 編號顯示邏輯（已單一來源 = computeDisplayLabels）
grep -rn 'computeDisplayLabels\|buildTableL4Map' src/ \
  --include="*.js" --include="*.jsx"
# 期待：所有視圖都 import computeDisplayLabels；buildTableL4Map 僅一處（excelExport.js 內部）
```

### 3. FlowTable / DiagramRenderer / FlowEditor 的 useEffect 依賴

歷史教訓：FlowTable `useEffect` deps 漏掉 `flow.tasks`（PR #70）→ 上方流程圖更新但下方表格不動。

```bash
grep -n "useEffect" src/components/FlowTable.jsx | head -5
```

人工檢查：每個 `useEffect` deps array 必含 `flow.tasks`（不是 `flow.id`）。

## 七視圖手動 walk（重大 PR 前必跑）

開瀏覽器 `npm run dev`，依序：

1. **首頁卡片**（Dashboard）：L3 列表能看到剛改的 flow，編號 / 名稱正確
2. **流程圖**（DiagramRenderer）：任務數 / 編號 / 名稱 / 連線 / 閘道種類符合預期
3. **編輯器 drawer**：右上「編輯」打開 → 任務 list 跟流程圖一致
4. **下方表格**（FlowTable）：第三欄 L4 編號跟流程圖一致；第四欄任務名稱包含閘道 prefix（如「[XOR閘道] ...」）
5. **下載 Excel**：第一欄 L3 編號 / 第三欄 L4 編號 / 第四欄任務名稱跟畫面一致
6. **下載 drawio**：用 diagrams.net 開啟，shape / label / edge 跟流程圖一致
7. **下載 PNG**：圖檔跟畫面一致（含 sticky header 應該在 x=0）

任何一視圖殘留舊值 → 修法：

- 表格不同步 → `FlowTable.jsx useEffect` deps 補 `flow.tasks`
- L4 編號不一致 → 檢查視圖是否走 `computeDisplayLabels`（非自己另開 counter）
- 連線文字不一致 → 視圖必須走 `formatConnection`（`src/model/connectionFormat.js`）；不可自己組裝中文片語

## 失敗處理

- **大小檢核命中 + > 20KB**：停下來開拆檔 PR，**不繼續這次功能**
- **grep 命中重複字串**：列出所有命中位置，建議走 `src/model/` 統一
- **七視圖殘留舊值**：以「source of truth = `liveFlow.tasks`」反推哪個視圖沒監聽到變動

## 何時跑

- 每次 `/ship-feature` 前自動跑（已整合到 ship-feature.md）
- 動到任務 / 連線 / 編號 / 顯示文字後手動跑一次
- 拆完大檔後跑一次確認新檔結構未引入新的 > 15KB

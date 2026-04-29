# FlowSprite 業務規格文件

**單一資料來源（Single Source of Truth）**：本文件統一描述 FlowSprite 的所有業務規則與操作規格。

- **給協作者看**：規則討論與優化方向以本文件為錨點
- **給使用者看**：首頁右上角「規則說明」（`HelpPanel.jsx`）從本文件摘錄關鍵操作重點，章節編號對齊本文件
- **不在此文件**：Claude 協作慣例（在 `.claude/business-rules.md` §3-4）、routing 演算法細節（在 `HANDOVER.md` §2.5）

每章末尾「對應實作」小節列出**目錄路徑 + 關鍵符號名**（不寫具體檔名，避免重構拆檔時 path drift）。例如 `src/diagram/`（`violations` 連線違規偵測），符號名可 `grep -rn 'function violations\|export.*violations' src/diagram/` 在該目錄下定位。

---

## 1. 階層定義

FlowSprite 管理單一階層 **L3 活動（一張泳道圖）**，但編號規則跨越 L1–L5 五層。

| 階層 | 名稱 | 描述 | 範例 |
|---|---|---|---|
| L1 | 業務領域 | 最高層業務分類 | 財務、人事、IT |
| L2 | 價值流 | 跨功能的端對端流程 | 採購到付款、訂單到收款 |
| L3 | 活動 | **本系統管理單元，即一張泳道圖** | `1-1-5` 員工請款流程 |
| L4 | 任務 | 泳道圖內的單一步驟節點 | `1-1-5-1` 填寫請款單 |
| L5 | 步驟 | L4 任務下的操作細節（**預留，尚未開放**） | — |

**對應實作**：`src/components/Dashboard/`（L3 列表）、`src/components/FlowEditor/`（L3 編輯）、`src/components/`（`HelpPanel` HIERARCHY array）

---

## 2. 編號規則

### 2.1 格式總表

**僅接受 `-`（橫線）分隔**，**不接受 `.`（點）分隔**。閘道用 `_g` 後綴、子流程調用用 `_s` 後綴例外。

| 種類 | 格式 | 範例 |
|---|---|---|
| L3 活動編號 | `\d+-\d+-\d+`（恰好 3 段） | `1-1-5`、`5-4-11` |
| L4 任務編號 | `L3編號-順號`（恰好 4 段） | `1-1-5-1`、`1-1-5-2` |
| 開始事件 L4 | 尾碼必為 `0` | `1-1-5-0` |
| 結束事件 L4 | 尾碼必為 `99` | `1-1-5-99` |
| 閘道 L4（單一） | 前一任務編號 + `_g` | `1-1-5-2_g` |
| 閘道 L4（連續多個） | 前一任務編號 + `_g1`、`_g2`、`_g3`… | `1-1-5-2_g1`、`1-1-5-2_g2` |
| 子流程調用 L4（單一） | 前一任務編號 + `_s` | `1-1-5-2_s` |
| 子流程調用 L4（連續多個） | 前一任務編號 + `_s1`、`_s2`、`_s3`… | `1-1-5-2_s1`、`1-1-5-2_s2` |

### 2.2 順號規則

- **只有「一般 L4 任務」會佔用流水順號**
- 開始 / 結束 / 閘道 / **子流程調用** 一律**不**佔順號
- 順號由 1 起算
- **第一個非閘道、非開始、非結束的任務編號 = `${L3}-1`**（規格 §2 (2)）

### 2.3 閘道 / 子流程「前綴必對應既有 L4 任務」原則

`X_g` 與 `X_s` 的前綴 `X` 必須是同一份流程中存在的 L4 任務編號。
**例外**：若閘道 / 子流程是流程的第一個元素，前綴可為 `${L3}-0`（開始事件）。
匯入時若前綴沒有對應任務或開始事件，會被擋下。

**閘道為流程第一個任務的範例**（規格 §2 (4)）：

```
X-Y-Z-0  →  X-Y-Z-0_g  →  X-Y-Z-1
（開始）    （閘道，前綴 -0）    （第一個一般任務）
```

### 2.4 連續性判定（`_g`、`_s` 共用規則）

「連續閘道」、「連續子流程」的判定條件：**兩個同類元素間沒有獨立 L4 任務隔開**。

- `_g`、`_s` 互相不打斷彼此的連續性（皆不佔順號）
- 規格範例：`1-1-1-1_s1 → 1-1-1-1_g → 1-1-1-1_s2`（中間 `_g` 不打斷 `_s` 的連續性）
- 同理：`1-1-1-1_g1 → 1-1-1-1_s → 1-1-1-1_g2`（中間 `_s` 不打斷 `_g` 的連續性）

### 2.5 禁止英文字母結尾編號（規格 §2 (8)）

除了 `_g` / `_s` 後綴外，**禁止**任何英文字母結尾。

| 禁止 | 原因 |
|---|---|
| `1-1-1-2a`、`1-1-1-2b` | 規格明文禁止字母結尾 |
| `1-1-1-2g`（無底線） | 必須是 `_g`（底線 + g） |
| `1-1-1-2_g_a` | 不接受複合後綴 |

閘道後續流程必須順向編號（不可用字母分支標記）。

### 2.6 舊資料相容

- 舊 localStorage 資料若用點分隔（`1.1.5.1`），載入時自動轉為橫線格式（`storage.normalizeNumber`）
- 舊閘道任務缺 `_g` 後綴時，載入時自動補（`storage.migrateGatewaySuffix`）
- 舊子流程調用任務缺 `_s` 後綴時，載入時自動補（`storage.migrateSubprocessSuffix`，同 `_g` 邏輯）

### 2.7 對應實作

- **格式驗證 regex 的單一來源**：`src/utils/`（`taskDefs` 內 6 個常數）
  - `L3_NUMBER_PATTERN`、`L4_NUMBER_PATTERN`（含 `_g` / `_s` 變體）、`L4_START_PATTERN`、`L4_END_PATTERN`、`L4_GATEWAY_PATTERN`、`L4_SUBPROCESS_PATTERN`
- **Excel 匯入 parser**：`src/utils/`（`excelImport` 寬鬆吃新舊格式 + `validateNumbering` 強制 `_s` / `_g` 規則）
- **顯示計算**：`src/model/`（`flowSelectors.computeDisplayLabels` 唯一 source of truth；對 `_s` / `_g` 共用 anchor `lastTaskBase`，連續計數器 `gwConsec` / `spConsec` 互不重置）
- **資料遷移**：`src/utils/`（`storage.normalizeNumber` + `migrateGatewaySuffix` + `migrateSubprocessSuffix`）

---

## 3. 元件類型

| 類型 | 形狀 | 顏色 | 用途 |
|---|---|---|---|
| 開始事件 | 圓形（空心） | `#D1FAE5` 綠框 | 流程唯一起點，每張圖必須有且僅能有一個 |
| 結束事件 | 圓形（實心深色） | `#111827` 填色 | 流程終點，每張圖至少有一個 |
| 流程斷點 | 圓形（實心，含 `‖` 符號） | `#374151` | 非正常結束（等待外部事件、流程暫停）。可選填下一步及斷點原因 |
| L4 任務 | 圓角矩形 | `#DBEAFE` 藍框 | 一般業務步驟，**佔用流水順號** |
| 互動任務 | 圓角矩形 | `#EDE9FE` 紫底藍框 | 涉及系統互動或跨角色協作的任務 |
| L3 活動（子流程調用） | 書端矩形（左右垂直分隔線） | `#FFFFFF` 深灰框 | 調用另一個 L3 活動。**圖上頂端顯示所調用的 L3 編號**取代本任務的 L4 編號 |
| 排他閘道（XOR） | 菱形（內含 `×`） | `#FEF3C7` 橙框 | 條件分支，每次只走一個路徑 |
| 並行閘道（AND） | 菱形（內含 `+`） | `#D1FAE5` 綠框 | 並行分支，同時啟動所有路徑（**不評估條件**） |
| 包容閘道（OR） | 菱形（內含 `○`） | `#FEF9C3` 黃框 | 包容分支，獨立評估每個條件，可同時觸發 1~N 條 |

**對應實作**：`src/diagram/`（`constants` 顏色 / 尺寸）、`src/components/DiagramRenderer/`（`shapes` 5 種元件繪製）、`src/components/`（`HelpPanel` ELEMENTS array）

---

## 4. 連線與序列類型

每個任務在編輯器內透過「流程設定」決定連線型態。共 12 種：

| 流程設定 | 行為 | 對應元件 |
|---|---|---|
| 序列流向 | 單一下一步任務（最常用） | 一般任務的箭頭 |
| 條件分支 | 可新增多個分支，每個分支設「條件標籤」+「目標」。**每次只走一條** | XOR 閘道 |
| 並行分支 | 同時啟動多個並行目標。**不評估條件**，標籤僅作註記用 | AND 閘道 |
| 包容分支 | 每個條件獨立評估，凡為真者建立並行路徑 | OR 閘道 |
| 並行合併 | 等待所有並行分支完成後合併。**必須有 ≥2 來源** | AND join |
| 條件合併 | 多個條件分支匯聚。**必須有 ≥2 條件分支來源** | XOR join |
| 包容合併 | 等待所有「曾觸發」的包容分支路徑都到達 | OR join |
| 流程開始 | 流程起始點，設定第一個任務目標 | 開始事件 |
| 流程結束 | 流程正常結束點，不需設定下一步 | 結束事件 |
| 流程斷點 | 非正常結束（等待外部 / 暫停），可選填下一步 | 流程斷點 |
| 子流程調用 | 調用另一個 L3 子流程，填寫子流程 L3 編號 + 返回後的下一步 | L3 活動 |
| 迴圈返回 | **不是獨立閘道**，一般任務上加 back-edge | 一般任務 |

### 4.1 閘道分類（業務上要嚴格區分）

#### 算獨立閘道元件（需要 `_g` 尾碼）

| 關鍵字 | 類型 |
|---|---|
| `條件分支至 A、B、C` | XOR fork |
| `並行分支至 A、B、C` | AND fork |
| `包容分支至 …` 或 `可能分支至 …` | OR fork（兩種動詞都吃） |

#### **不是**獨立閘道元件（一般任務，不用 `_g`）

| 關鍵字 | 語意 |
|---|---|
| `條件合併來自多個分支、序列流向 Z` | XOR merge target，收到 ≥2 條分支匯入 |
| `並行合併來自 X、Y、序列流向 Z` | AND join target |
| `包容合併來自多個分支，序列流向 Z` | OR join target |
| `迴圈返回至 X`（新格式）/ `若未通過則返回 X、若通過則序列流向 Y`（舊格式） | back-edge 合併進 `nextTaskIds` |

**對應實作**：`src/components/`（`ConnectionSection` 連線型態 UI、`RightDrawer` 編輯器右側容器）、`src/utils/`（`applyConnectionType` 連線型態變更副作用）、`src/components/`（`HelpPanel` CONNECTIONS array）

---

## 5. 路由規則（核心三條）

連線繪製順序與優先級。**違反規則 1（端點混用）比線段交叉更嚴重**。

### 規則 1：端點不混用

任一元件的 port 不可同時 IN + OUT。

- **檢查方向**：新增 OUT 時檢查 `hasIn`（source 同 port 是否已有 IN）；新增 IN 時檢查 `hasOut`（target 同 port 是否已有 OUT）
- **同方向多條並不算混用**：兩條 IN 共用同一端點 OK
- **Corridor 降級也要再檢查一次**：top corridor 不行退到 bottom 之前要檢查 bottom 是否也會混用

### 規則 2：避免視覺重疊

線段不可跨過任務矩形。**重疊時優先改端點（source / target 上下），其次改路徑**。

### 規則 3：依 target 順序排列 slot

多條連線並存時，按 target 欄位由左到右決定 slot 內外順序：

- Top corridor：slot 0 最內（緊鄰 lane 上緣）
- Bottom corridor：slot 0 最外（lane 底部往上堆）
- Tiebreaker：相同 target 時短 span 走內側

**對應實作**：`src/diagram/layout/`（多個 phase 檔，每檔處理一種情境）、`HANDOVER.md` §2.5（dr/dc 表 / 8 個 phase / corridor slot 詳細規則）

---

## 6. 編號顯示分層

- **流程圖只顯示 L3 / L4 的「正式編號」**
- start (`-0`) / end (`-99`) / 閘道 (`_g*`) 編號**不顯示在流程圖上**（僅作辨識用）
- **編輯介面**（task card、下拉選單）仍顯示全部編號
- L3 活動（子流程調用）**圖上頂端顯示所調用的 L3 編號**，取代本任務的 L4 編號

**對應實作**：`src/utils/`（`computeDisplayLabels` 唯一決定顯示 / 不顯示）

---

## 7. 儲存檢核兩層

FlowEditor 儲存前跑 `validateFlow` 兩層檢核。

### 7.1 Blocking（紅 modal，無法儲存）

只放「結構不合法、儲存了也不能用」的規則。**寧缺勿濫**。

| 規則 | 描述 |
|---|---|
| 必須有開始事件 | 至少一個流程設定為「流程開始」的節點 |
| 必須有結束事件 | 至少一個「流程結束」/「流程斷點」節點 |
| 開始事件必須有 outgoing | 「流程開始」節點的 outgoing 不能為空 |
| 結束事件必須有 incoming | 「流程結束」/「流程斷點」節點的 incoming 不能為空 |
| 端點不混用 | 違反規則 1 直接擋（紅色高亮該連線） |

### 7.2 Warning（黃 modal，使用者可選「仍然儲存」）

| 規則 | 描述 |
|---|---|
| 非結束節點必須設定下一步 | 序列 / 條件 / 並行 / 包容 / 子流程 / 迴圈 / 合併 / 開始 都應該設定至少一個有效目標 |
| 並行合併 ≥2 來源 | 至少 2 個其他節點指向 |
| 條件合併 ≥2 條件分支來源 | 至少 2 個「條件分支」節點的條件出口指向 |
| 包容合併 ≥2 來源 | 至少 2 個「包容分支」節點的條件出口指向 |
| 每個節點都必須被連接（除開始外） | 孤立節點跳 warning |
| 迴圈返回必須指定目標 | 「迴圈返回至」目標不能為空 |
| 閘道未指定泳道角色 | 閘道應該綁定一個角色 |
| L3 活動未連接 | L3 活動沒有前後連線時跳 warning（提示：可能流向另一張流程圖） |
| 線段跨過任務矩形 | 違反規則 2，建議重拖端點避開 |

### 7.3 Excel 匯入專屬檢核

匯入時跑同一份 `validateFlow`，加上格式檢核：

- L4 編號必須符合 §2.1 格式（含 `_g` 變體）
- 閘道前綴必對應既有 L4 任務（§2.3）
- 條件分支標籤可選填（XOR / OR 描述條件，AND 僅作註記用）

**對應實作**：`src/model/`（`validation` 共用驗證函式）、`src/components/FlowEditor/`（`validateFlow` shim 薄包裝）、`src/utils/`（`excelImport` 匯入時呼叫）、`src/components/`（`HelpPanel` VALIDATION array）

---

## 8. 編輯操作

### 8.1 圖上直接操作

| 操作 | 行為 |
|---|---|
| 點任務元件 | 彈出小選單，可改名稱 / 角色 / 重點說明、在後面新增、新增連線、新增閘道（兩條連線）、刪除 |
| Hover 任務 | 上方彈出「任務重點說明」浮層（只顯示有填說明的任務） |
| 拖曳連線端點覆寫 port | 點選連線後端點出現藍色 handle，可拖到該任務的其他 port（top / right / bottom / left）。覆寫過的端點顯示琥珀色小圓點 |
| 拖曳連線端點換目標 | 把目標 handle 拖到別的任務上會直接換 target；綠色虛線框提示候選目標、藍色虛線預覽路徑。原 connectionOverrides 自動跟著遷移 |
| 重設手動端點 | 違規時提示列出現「重設此連線端點」按鈕；流程圖頂部「重設所有手動端點」全清按鈕（僅在有 override 時顯示） |

### 8.2 編輯器（右側 drawer）

| 操作 | 行為 |
|---|---|
| 拖曳排序任務 | 「設定流程」分頁按住 `⠿` 拖曳。中間出現藍色橫線指示**插入位置**。順序改了之後 L4 編號自動重排 |
| 拖曳排序泳道角色 | 「設定泳道角色」分頁同樣拖曳 `⠿`。角色綁定（`task.roleId`）不變，只調整視覺位置 |

### 8.3 統一行為

新增任務 / 閘道 / L3 活動的按鈕**統一加在後面**（不再有「在前面新增」選項）。

**對應實作**：`src/components/DiagramRenderer/`（圖上互動）、`src/components/FlowEditor/`（drawer + ContextMenu）、`src/hooks/`（`useDragReorder`）、`src/components/`（`HelpPanel` EDITABLE_ACTIONS array）

---

## 9. 禁止規則（畫面紅線 / 儲存擋下）

| 違反項 | 等級 | 觸發行為 |
|---|---|---|
| 端點同時有 IN + OUT | Blocking | 儲存擋下、紅色高亮該連線 |
| 連線跨過任務矩形 | Warning | 黃色 modal，可選「仍然儲存」但建議重拖端點 |
| 缺開始或結束事件 / 開始無 outgoing / 結束無 incoming | Blocking | 儲存擋下 |
| L4 編號格式錯誤 | Blocking（匯入時） | 列出所有錯誤列、整份匯入擋下 |

**對應實作**：`src/diagram/`（`violations` 連線違規偵測）、`src/model/`（`validation` 儲存檢核）、`src/components/`（`HelpPanel` FORBIDDEN_RULES array）

---

## 10. 匯出格式

| 格式 | 副檔名 | 用途工具 | 說明 |
|---|---|---|---|
| PNG | `.png` | 圖片檢視器 / Word / PowerPoint | 高解析度圖片，不可再編輯節點。從流程編輯頁上方按鈕匯出，或首頁卡片「↓ PNG」 |
| Draw.io | `.drawio` | diagrams.net / VS Code Draw.io 擴充 | 可重新編輯節點、調整版面，mxGraph XML 格式。從流程編輯頁上方按鈕匯出，或首頁卡片「↓ draw.io」 |
| Excel | `.xlsx` | Excel / LibreOffice / Google Sheets | L4 任務明細共 10 欄：L3 編號、L3 名稱、L4 編號、任務名稱、說明、輸入、角色、產出、關聯說明、參考資料 |

**對應實作**：`src/components/DiagramRenderer/`（`handleExport` PNG via html-to-image）、`src/utils/`（`drawioExport` / `excelExport`）、`src/components/`（`HelpPanel` EXPORTS array）

---

## 11. Excel I/O 相容性

- **匯出**只產新格式
- **匯入**用放寬的 regex 同時吃新舊格式，例如迴圈返回同時吃：
  - `迴圈返回，序列流向 X`（新）
  - `迴圈返回至 X`
  - `迴圈返回 X`
  - `若未通過則返回 X、若通過則序列流向 Y`（舊）
- 條件分支標籤：`條件分支至 X（標籤）、Y` 或 `條件分支至 X、Y` 兩種寫法都吃

**對應實作**：`src/utils/`（`excelImport` parser regex / `excelExport` 只產新格式）、`src/model/`（`connectionFormat` 中文片語常數 PHRASE，匯出/匯入共用）

---

## 12. 七視圖一致性

任何業務規則變動後，**以下七個視圖必須同步使用同一份 `liveFlow.tasks` + `computeDisplayLabels`**：

| # | 視圖 | 入口檔案 |
|---|---|---|
| ① | 網頁首頁卡片 | `src/components/Dashboard/` |
| ② | 網頁中流程圖 | `src/components/DiagramRenderer/` + `src/diagram/layout/` |
| ③ | 編輯器（drawer flow tab + roles tab + Wizard） | `src/components/FlowEditor/` + `src/components/RightDrawer.jsx` + `src/components/Wizard.jsx` |
| ④ | 流程圖下方 Excel 表 | `src/components/FlowTable.jsx` |
| ⑤ | 下載：Excel | `src/utils/excelExport.js` |
| ⑥ | 下載：drawio | `src/utils/drawioExport.js` |
| ⑦ | 下載：PNG | `src/components/DiagramRenderer/`（`handleExport` 用 html-to-image） |

**檢核重點**：編號（`computeDisplayLabels` 是唯一 source of truth）、任務名稱、角色順序、連線目標、閘道種類。**任何一個視圖殘留舊值就算修正未完成**。

---

## 13. 視覺與字級規格

UI 一致性的單一來源。改數字優先在這裡定，再同步到實作檔；後續調整新增小節，不刪舊欄（保留歷史軌跡）。

### 13.1 LAYOUT 常數（流程圖框體尺寸）

| 名稱 | 值 (px) | 用途 |
|---|---|---|
| `TITLE_H` | 74 | 頂部標題列高度 |
| `LANE_HEADER_W` | 108 | 左側角色欄寬度 |
| `COL_W` | 184 | 任務欄寬度（含 gutter） |
| `LANE_H` | 152 | 泳道基本高度（routing slot 多時自動拉高，見 `minLaneH`）|
| `NODE_W` | 156 | 任務矩形寬 |
| `NODE_H` | 84 | 任務矩形高（容納 3 行 × lineH 32 + 字高 16，上下 padding 各 2）|
| `DIAMOND_SIZE` | 54 | 閘道菱形半徑 |
| `CIRCLE_R` | 32 | Start/End 圓形半徑 |
| `PADDING_RIGHT` | 56 | svg 右側留白 |
| `PADDING_BOTTOM` | 56 | svg 底部留白 |

設計原則：
- `LANE_H` 必須 ≥ `MAX_SHAPE_BOTTOM_OFFSET = NODE_VOFFSET + DIAMOND_SIZE = 130`，現留 22px buffer
- `NODE_H` 為「最大字級也不爆」設計（3 行字 + 最小 padding），1 行短任務名 padding 看起來會偏鬆是設計取捨

**對應實作**：`src/diagram/constants.js`（`LAYOUT` 物件）

### 13.2 字級三層

所有流程圖內文字依語意分三層：

| 層 | px | 用途 | 對應位置 |
|---|---|---|---|
| **L1 大** | 16 | 任務名稱 | `SvgLabel` 預設 fontSize |
| L1 大 | 18 | 泳道角色名 | `StickyHeader` |
| L1 大 | 22 | 流程圖標題 | `index.jsx` 標題列 |
| **L2 中** | 14 | 連線 label / Start-End 名 / 閘道下標 / 子流程 / **L4 編號** | `arrows.jsx` / `text.jsx` `EventLabel` 名 / `shapes.jsx` 閘道下標 / `L4Number` |
| **L3 小** | 13 | Start-End 補充說明 / hover tooltip | `text.jsx` `EventLabel` desc / `overlays.jsx` |

設計原則：
- 跨場景縮放（筆電編輯 vs 會議室遠看）**不在 app 內做 zoom**，使用瀏覽器內建 `Ctrl+/-` / `Ctrl+0`
- 字級調整時 wrap `maxChars` / 行距 `lineH` 必須連動，否則撞框（見 §13.3 / §13.4）

**對應實作**：`src/components/DiagramRenderer/text.jsx`（`SvgLabel` / `L4Number` / `EventLabel`） / `StickyHeader.jsx` / `shapes.jsx` / `arrows.jsx` / `overlays.jsx`

### 13.3 行距（lineH）

| 元素 | lineH (px) | 兩行間隙 | 設計意義 |
|---|---|---|---|
| 任務名稱 (`SvgLabel`) | **32** | 16 | 兩行間隙 = 一行字高（單行間距） |
| 泳道角色 | 26 | 8 | 字 18 + 間隙 8 |
| Event 名 | 20 | 6 | 字 14 + 間隙 6 |
| Event 補充 | 19 | 6 | 字 13 + 間隙 6 |
| 閘道下標 | 22 | 8 | 字 14 + 間隙 8 |

設計原則：兩行間隙至少 = 0.5 × 字高；任務名稱因為要容納 3 行 + 在多行情境最常見，特別放寬到 1.0 × 字高

### 13.4 wrap maxChars（每行字數預算）

`wrapText` 用 CJK-equivalent 計算：每 CJK 字 = 2 unit，每 Latin 字 = 1 unit。`maxChars` × 2 = 每行 unit 上限。

| 元素 | maxChars | maxTotal | 對應寬度（CJK 字數）|
|---|---|---|---|
| `SvgLabel` 預設（任務名稱） | 8 | 22 | 每行 8 字 × 3 行 ≤ 24 字 |
| 泳道角色 | 4 | — | LANE_HEADER_W 108px 容 4 字 |
| Event 名 | 11 | — | COL_W 184px 容 11 字 |
| Event 補充 | 14 | — | 比名稱寬，容更多細節文字 |
| 閘道下標 | 9 | — | 跟任務名稱對齊 |

### 13.5 任務元件 padding

| 軸 | 值 | 計算 |
|---|---|---|
| NODE_H 內垂直 padding | 上下各 2px | NODE_H 84 − (3 行 × 32 + 字高 16) = 4，上下各 2 |
| NODE_W 內水平 padding | textAnchor middle，由 maxChars 控制 | maxChars 8 × 16px = 128px 文字寬，NODE_W 156 留左右各 14 |

設計原則：垂直 padding 偏小是刻意（避免「框內還能寫」的視覺暗示）；水平 padding 由 wrap 邊界保證

### 13.6 按鈕色系 / 風格

#### 13.6.1 主題藍

| 用途 | 色 | hover |
|---|---|---|
| **主要按鈕**（首頁右上角 / 編輯頁 Header 背景 / Toolbar 三鍵）| `#2A5598` | `#1E4677` |
| 強調 outline（Header 底色內）| `border-white border-opacity-40` + 白字 | `bg-white bg-opacity-10` |

#### 13.6.2 編輯頁 Header 4 顆按鈕

統一規格：`px-3 py-1.5 text-base rounded`、透明背景、白邊（`border-white border-opacity-40`）、白字、hover 半透明白底（`hover:bg-white hover:bg-opacity-10`）

順序（左 → 右）：
1. 重設所有端點（條件顯示 — 有 override 才出現）
2. 打開編輯器
3. 儲存（`hasChanges` 時用實白底 + `#1E4677` 深藍字 + `font-semibold` 強調）
4. ★ 置頂（icon-only，最右）

#### 13.6.3 流程圖頂部三顆下載按鈕

PNG / drawio / Excel **同色 `#2A5598`**（hover `#1E4677`），順序保持 PNG → drawio → Excel。所有下載按鈕點擊時自動先 `saveAndValidate` → 通過才存全部 + 下載；blocking 錯誤無法存也無法下載。

#### 13.6.4 modal 警告色

| 類型 | 色 | hover |
|---|---|---|
| Blocking 錯誤 | `bg-red-50 border-red-200 text-red-700` | — |
| Warning「仍然儲存」 | `#D97706` | `#B45309` |

### 13.7 對應實作

| 規格 | 入口 |
|---|---|
| LAYOUT / 字級 / 行距 / wrap | `src/diagram/constants.js` + `src/components/DiagramRenderer/text.jsx` 等 |
| 編輯頁 Header 按鈕 | `src/components/FlowEditor/Header.jsx` |
| Toolbar 三鍵 | `src/components/DiagramRenderer/Toolbar.jsx` |
| 首頁按鈕 | `src/components/Dashboard.jsx` |
| Modal 樣式 | `src/components/FlowEditor/SaveModals.jsx` |

---

## 文件維護規則

1. **改業務規則時**：本文件 + `src/data/helpPanelData.js`（待 Phase 2-2 抽出）+ changelog 三者同步
2. **章節編號穩定**：HelpPanel 註解會引用本文件章節錨點（例 `// 對應 docs/business-spec.md §3`），新增章節用最後加，不要插中間
3. **不放這裡**：Claude 工作流（→ `.claude/business-rules.md`）、routing 演算法細節（→ `HANDOVER.md` §2.5）、實作待辦（→ `.claude/backlog.md`）

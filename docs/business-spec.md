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
| 閘道 L4（連續多個） | 前一任務編號 + `_g1`、`_g2`、`_g3`… **（從 1 開始）** | `1-1-5-2_g1`、`1-1-5-2_g2`、`1-1-5-2_g3` |
| 子流程調用 L4（單一） | 前一任務編號 + `_s` | `1-1-5-2_s` |
| 子流程調用 L4（連續多個） | 前一任務編號 + `_s1`、`_s2`、`_s3`… **（從 1 開始）** | `1-1-5-2_s1`、`1-1-5-2_s2` |
| 外部關係人互動 L4（單一） | 前一任務編號 + `_e` | `1-1-5-2_e` |
| 外部關係人互動 L4（連續多個） | 前一任務編號 + `_e1`、`_e2`、`_e3`… **（從 1 開始）** | `1-1-5-2_e1`、`1-1-5-2_e2` |

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

### 2.4 連續性判定（`_g`、`_s`、`_e` 共用規則）

「連續閘道」、「連續子流程」、「連續外部互動」的判定條件：**兩個同類元素間沒有獨立 L4 任務隔開**。

- `_g`、`_s`、`_e` 三者互相不打斷彼此的連續性（皆不佔順號）
- 規格範例：`1-1-1-1_s1 → 1-1-1-1_g → 1-1-1-1_s2`（中間 `_g` 不打斷 `_s` 的連續性）
- 同理：`1-1-1-1_e1 → 1-1-1-1_g → 1-1-1-1_e2`（中間 `_g` 不打斷 `_e` 的連續性）
- 三者各自獨立計數器，但共用 anchor（前一個 L4 任務或 `-0`）

### 2.5 禁止英文字母結尾編號（規格 §2 (8)）

除了 `_g` / `_s` / `_e` 後綴外，**禁止**任何英文字母結尾。

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

> **元件類型 SOT 規則（2026-05-05 PR-D10）**：
> Excel 匯入與 localStorage 載入時，元件類型由 **L4 編號後綴**唯一決定（見 §2.1）：
> - `-0` → 開始事件
> - `-99` → 結束事件
> - `_g\d*` → 閘道（具體 XOR/AND/OR 由任務關聯說明的分支詞彙決定，缺詞彙則預設 XOR + warning）
> - `_s\d*` → 子流程（任務關聯說明必須有「調用子流程 X-Y-Z」否則 blocking）
> - `_e\d*` → L4 任務 + 外部互動 shape
> - 純數字 → L4 任務 + 一般 shape
>
> 任務關聯說明的詞彙與 L4 名稱的 `[XX閘道]` 前綴是輔助訊號 — 跟 L4 不一致時跳 warning，但 type 以 L4 為準。

| 類型 | 形狀 | 顏色 | 用途 |
|---|---|---|---|
| 開始事件 | 圓形（空心） | `#D1FAE5` 綠框 | 流程唯一起點，每張圖必須有且僅能有一個 |
| 結束事件 | 圓形（實心深色） | `#111827` 填色 | 流程終點，每張圖至少有一個 |
| 流程斷點 | 圓形（實心，含 `‖` 符號） | `#374151` | 非正常結束（等待外部事件、流程暫停）。可選填下一步及斷點原因 |
| L4 任務 | 圓角矩形 | `#DBEAFE` 藍框 | 一般業務步驟，**佔用流水順號** |
| 外部關係人互動 | 圓角矩形 | `#A0A0A0` 灰底 | 外部角色泳道**強制**使用此元件；內部泳道**允許**但儲存跳 warning。L4 編號用 `_e` 後綴（不佔順號），例 `1-1-5-2_e`、連續用 `_e1`/`_e2`。**流程圖不顯示編號**（編輯器 + 表格仍顯示完整含 `_e` 編號）|
| L3 活動（子流程調用） | 書端矩形（左右垂直分隔線） | `#FFFFFF` 深灰框 | 調用另一個 L3 活動。**圖上頂端顯示所調用的 L3 編號**取代本任務的 L4 編號 |
| 排他閘道（XOR） | 菱形（內含 `×`） | `#FEF3C7` 橙框 | 條件分支，每次只走一個路徑 |
| 並行閘道（AND） | 菱形（內含 `+`） | `#D1FAE5` 綠框 | 並行分支，同時啟動所有路徑（**不評估條件**） |
| 包容閘道（OR） | 菱形（內含 `○`） | `#FEF9C3` 黃框 | 包容分支，獨立評估每個條件，可同時觸發 1~N 條 |

### 3.1 外部關係人互動 — 對稱 cascade + `_e` 編號（2026-05-05 改為對稱規則）

外部關係人互動 = `shapeType === 'interaction'`，編號用 `_e` 後綴（不佔順號，跟 `_g` / `_s` 同類）。

**Sync 規則（對稱）**：

| 觸發 | 結果 |
|---|---|
| 任務移到 external 泳道 | `shapeType` 強制 = `interaction`（外部角色不能用一般任務）+ 重新編號為 `_e` |
| 任務移到 internal 泳道 | `shapeType` 強制 = `task`（內部角色不能用外部互動）+ 重新編號為一般 L4（會 shift 後續順號） |
| 角色泳道 internal → external 切換 | 該泳道所有 lane-sensitive 任務 cascade → interaction + 重編 `_e` |
| 角色泳道 external → internal 切換 | 該泳道所有 lane-sensitive 任務 cascade → task + 重編一般 L4 |
| 載入舊 localStorage 資料 | **不自動 cascade**，違規元件保留資料原貌 + 在流程圖 / 表格上亮紅色邊框 |
| TaskCard / ContextMenu「外部互動 ⇄ 任務」手動切換 | 一律 honor 使用者選擇，但若違反 lane 規則則紅框警示 |

**範圍限制**：只有 `type === 'task'` 才會 lane-sensitive。閘道 / 開始 / 結束 / L3 活動可放任何泳道，sync 不動它們。

**紅框警示**：違規元件（內部泳道的 interaction、外部泳道的 task）會在流程圖元件外圍套一層紅色 stroke（PR-D3）；FlowTable 對應 row 的 L4 編號 cell 文字變成紅色加粗（PR-D6 改，原本是 row outline）。**僅介面 warning**，下載 PNG / drawio 都不會帶紅框 — PNG 透過 `data-export-skip="1"` 屬性 + html-to-image `filter` callback 過濾；drawio 由 `drawioExport.js` 自行構造 XML，本來就不渲染紅框 overlay。

**Excel 匯入**：parser 偵測 `_e\d*$` 的 L4 編號 → set `shapeType=interaction`。角色 type 由 `excelImport.detectRoleTypes` 智慧偵測：

| 該角色 lane-sensitive row 分布 | 推論 role.type | 備註 |
|---|---|---|
| 全 interaction（`_e` row） | **external** | 自動套 `[外部角色]` 前綴（PR-D4） |
| 全 task（一般任務） | **internal** | |
| 混用（task + `_e`） | **internal** | `_e` row 留在 interaction shape；PR-D3 紅框讓使用者檢查 |
| 0 個 lane-sensitive row（只有 start / end / gateway / l3activity） | **internal** | 無法分辨，預設內部 |

不再讀 Excel「角色類型」欄；純由 row 內容推導。

**流程圖顯示**：`_e*` 編號**不顯示在流程圖任務元件上**（同 `_g*` / `_s*` / `-0` / `-99` 規則）；編輯器 + 表格仍顯示完整 `_e` 編號（含後綴）。

**對應實作**：`src/utils/elementTypes.js`（`applyRoleChange` / `syncTasksToRoles` / `targetShapeFor` 對稱 sync）、`src/utils/taskDefs.js`（`L4_INTERACTION_PATTERN`）、`src/model/flowSelectors.js`（`computeDisplayLabels` `_e` derivation + `getLaneShapeViolations`）、`src/components/DiagramRenderer/{TasksLayer,shapes,index}.jsx`（hide regex 含 `_e*` + 紅框 overlay + PNG export filter）、`src/components/FlowTable.jsx`（row 紅框）、`src/utils/storage.js`（`migrateInteractionSuffix`，不再 cascade load-time）、`src/utils/excelImport.js`（`isInteraction = /_e\d*$/`）、`src/model/validation.js`（rule 3e 對稱化）。

**對應實作**：`src/diagram/`（`constants` 顏色 / 尺寸）、`src/components/DiagramRenderer/`（`shapes` 5 種元件繪製）、`src/components/`（`HelpPanel` ELEMENTS array）

---

## 4. 連線與序列類型

**UX（2026-04-30 起）**：使用者**不直接選連線型態**，而是在編輯器 Row 2「元件類型」單一選單選 8 種元件之一（見 §3）；連線型態由元件類型自動衍生（例：選「排他閘道」→ `connectionType=conditional-branch`）。底層仍是這 7 種連線型態（2026-04-29 移除「流程斷點」與「迴圈返回」兩個編輯器選項；既有資料仍可正常 render，但不再從編輯器產生新的）：

| 連線型態 | 行為 | 由哪個「元件類型」衍生 |
|---|---|---|
| 序列流向 | 單一下一步任務（最常用） | L4 任務 / 外部互動 |
| 條件分支 | 可新增多個分支，每個分支設「條件標籤」+「目標」。**每次只走一條** | 排他閘道（XOR） |
| 並行分支 | 同時啟動多個並行目標。**不評估條件**，標籤僅作註記用 | 並行閘道（AND） |
| 包容分支 | 每個條件獨立評估，凡為真者建立並行路徑 | 包容閘道（OR） |
| 流程開始 | 流程起始點，設定第一個任務目標 | 開始事件 |
| 流程結束 | 流程正常結束點，不需設定下一步 | 結束事件 |
| 子流程調用 | 調用另一個 L3 子流程，填寫子流程 L3 編號 + 返回後的下一步 | L3 流程（子流程調用） |

### 4.1 合併（merge）= 自動偵測，不是流程設定

**合併不是「流程設定」選項**，而是**衍生狀態**：當 ≥2 條 incoming 指向同一目標時，`formatConnection` 自動產生「並行/條件/包容合併 X、Y，序列流向 Z」文字插入該任務的「任務關聯說明」欄。合併類型由上游 source 的閘道種類推斷：

| 上游 source 全部是 | 合併類型 |
|---|---|
| AND 閘道 | 並行合併 |
| OR 閘道 | 包容合併 |
| XOR 閘道 / 混合 / 一般任務 | 條件合併（預設） |

**閘道作為 merge node**（fork-then-join 模式中閘道收 ≥2 incoming + ≤1 outgoing）：合併類型直接取閘道**自身的 gatewayType**（覆蓋上游推斷），輸出 `{XX}合併 X、Y，序列流向 Z`。

### 4.2 閘道分類（業務上要嚴格區分）

#### 算獨立閘道元件（需要 `_g` 尾碼）

| 關鍵字 | 類型 |
|---|---|
| `條件分支至 A、B、C` | XOR fork |
| `並行分支至 A、B、C` | AND fork |
| `包容分支至 …` 或 `可能分支至 …` | OR fork（兩種動詞都吃） |

#### **不是**獨立閘道元件（一般任務，不用 `_g`）

| 關鍵字 | 語意 |
|---|---|
| `條件合併 X、Y，序列流向 Z` | XOR merge target，收到 ≥2 條分支匯入（**自動產生**） |
| `並行合併 X、Y，序列流向 Z` | AND join target（**自動產生**） |
| `包容合併 X、Y，序列流向 Z` | OR join target（**自動產生**） |
| `迴圈返回至 X`（新格式）/ `若未通過則返回 X、若通過則序列流向 Y`（舊格式） | back-edge 合併進 `nextTaskIds` |

**對應實作**：`src/utils/elementTypes.js`（`ELEMENT_TYPES` / `detectElementKind` / `makeTypeChange` 元件類型 → 連線型態衍生）、`src/components/ConnectionSection.jsx`（依連線型態渲染對應的目標 / 條件欄位）、`src/components/RightDrawer.jsx`（編輯器右側容器）、`src/utils/taskDefs.js`（`applyConnectionType` 連線型態變更副作用，內部呼叫）、`src/model/connectionFormat.js`（`formatConnection` 衍生關聯說明文字）、`src/model/flowSelectors.js`（`getTaskIncomingSources` 自動合併偵測）。HelpPanel 不再顯示連線規則段落（§4 完整內容仍在本文）。

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
| 外部角色名稱缺少「[外部角色]」前綴 | UI 自動補（onBlur / role.type 改 external / Excel 匯入 / localStorage 載入），此 warning 兜底 |

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
| ▲ ▼ 排序任務 | 「設定流程」分頁點任務左側 ▲ ▼ 按鈕（最上 / 最下自動 disabled）。順序改了之後 L4 編號自動重排。**2026-04-30 起改用按鈕**（HTML5 drag 三度修不好，改方案二：點按鈕） |
| ▲ ▼ 排序泳道角色 | 「設定泳道角色」分頁同樣點 ▲ ▼ 改變泳道由上到下的順序。角色綁定（`task.roleId`）不變，只調整視覺位置 |
| 元件類型切換 | TaskCard Row 2「元件類型」單一選單可隨時改成 8 種任一（L4 任務 / 排他 / 並行 / 包容 閘道 / 開始 / 結束 / L3 / 外部互動）。連線文字（任務關聯說明）即時衍生，不必手動編輯 |
| 任務關聯說明 preview | TaskCard 下方的灰色斜體「關聯說明」是 `formatConnection` 自動產生，使用者改任何欄位都即時更新（不可編輯） |

### 8.3 統一行為

新增任務 / 閘道 / L3 活動的按鈕**統一加在後面**（不再有「在前面新增」選項）。

**對應實作**：`src/components/DiagramRenderer/`（圖上互動）、`src/components/FlowEditor/`（drawer + ContextMenu + TaskCard Row 2 元件類型 select）、`src/components/reorderButtons.jsx`（`ReorderButtons` ▲ ▼ 元件 + `moveItem` helper，2026-04-30 取代 HTML5 drag）、`src/components/`（`HelpPanel` EDITABLE_ACTIONS array）

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
| Excel | `.xlsx` | Excel / LibreOffice / Google Sheets | L4 任務明細共 31 欄：核心 10 欄（A~J）+ 輔助 21 欄（K~AE，§10.1） |

### 10.1 Excel 31 欄結構（2026-05-05 起，PR-AUX-RELABEL 後）

**核心 10 欄（A~J，位置硬編、流程圖辨識用）**：L3 編號 / L3 名稱 / L4 編號 / 任務名稱 / 重點說明 / 重要輸入 / 負責角色 / 產出成品 / 關聯說明 / 參考資料

**輔助 21 欄（K~AE，header mapping、不影響流程圖）**：

| Excel 欄 | # | header | 用途 |
|---|---|---|---|
| K | 1 | 執行主體 | 主體 |
| L | 2 | 操作系統 | 系統 |
| M | 3 | 涉及的業務實體 | 實體 |
| N | 4 | 操作後業務實體生命週期 | 生命週期 |
| O | 5 | 備註 | 自由說明 |
| P | 6 | 牽涉實體或分配（1-實體、2-分配） | 分類碼 |
| Q | 7 | 單一角色執行 | 單一性判定 |
| R | 8 | 連續執行不中斷 | 同上 |
| S | 9 | 對應單一業務產出 | 同上 |
| T | 10 | 目的具體完整 IPO | 完整性判定 |
| U | 11 | 動詞_中文 | 字典檢核 |
| V | 12 | 名詞_中文 | 字典檢核 |
| W | 13 | 檢核動詞_中文 | 字典檢核 |
| X | 14 | 檢核名詞_中文 | 字典檢核 |
| Y | 15 | 是否完成字典檢核 | 字典檢核 |
| Z | 16 | Key 傳遞斷點處 | 額外標記 |
| AA | 17 | 找 SO 釐清 | SO 互動 |
| AB | 18 | SO 釐清狀況 | SO 互動 |
| AC | 19 | 找 User 釐清 | User 互動 |
| AD | 20 | 合併場次 | User 互動 |
| AE | 21 | User 釐清狀況 | User 互動 |

**辨識規則**：
- 核心 10 欄走位置硬編（`COL_*` 常數），使用者調序會錯讀 → 不允許動
- 輔助 21 欄走 header mapping（讀 row 0 找各 `header` 字串位置），使用者可調序 / 缺欄 / 拼錯，匯入時 graceful（找不到 header → `task.meta[key]` 不存）
- 不再有視覺分組空白欄（PR-AUX-RELABEL 前有 4 個 separator，現在 21 欄連續）

**檢核**：輔助欄位**完全不做任何檢核**，沒有必填、沒有格式驗證；自由文字儲存。

**UI**：FlowTable 預設只顯示核心 10 欄（隱藏 L3 + 隱藏輔助欄位）；點「隱藏輔助欄位」toggle 解除後在右側展開 21 欄編輯。toggle 狀態跨 session 記得（localStorage `bpm_flow_table_show_aux`）。Excel 匯出**不受 UI toggle 影響**，永遠包含 31 欄。

**對應實作**：`src/utils/auxFieldDefs.js`（`AUX_FIELDS` SOT）/ `src/utils/excelExport.js`（CORE_HEADERS + AUX_HEADERS）/ `src/utils/excelImport.js`（`buildAuxColMap` / `readAuxMeta`）/ `src/components/FlowTable.jsx`（aux toggle + 渲染）/ `src/utils/storage.js`（`migrateTaskMeta`）

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
| `TITLE_H` | 66 | 頂部標題列高度 |
| `LANE_HEADER_W` | 96 | 左側角色欄寬度 |
| `COL_W` | 164 | 任務欄寬度（含 gutter） |
| `LANE_H` | 136 | 泳道基本高度（routing slot 多時自動拉高，見 `minLaneH`）|
| `NODE_W` | 140 | 任務矩形寬 |
| `NODE_H` | 84 | 任務矩形高（容納 3 行 × lineH 32 + 字高 16，上下 padding 各 2）|
| `DIAMOND_SIZE` | 48 | 閘道菱形半徑 |
| `CIRCLE_R` | 28 | Start/End 圓形半徑 |
| `PADDING_RIGHT` | 48 | svg 右側留白 |
| `PADDING_BOTTOM` | 48 | svg 底部留白 |

設計原則：
- `LANE_H` 必須 ≥ `MAX_SHAPE_BOTTOM_OFFSET = NODE_VOFFSET + DIAMOND_SIZE = 124`（NODE_VOFFSET 76 + DIAMOND_SIZE 48），現留 12px buffer
- `NODE_H` 為「最大字級也不爆」設計（3 行字 + 最小 padding），1 行短任務名 padding 看起來會偏鬆是設計取捨
- **2026-04-29 -10% 密度調整**：使用者反饋瀏覽器縮放 80% 才符合期望版面，但會等比縮字。解法是把 LAYOUT 整體 -10%、字級 / lineH 全部不動。`NODE_H` 唯一不動（3 行字空間需求）。NODE_W 156→140 連帶 wrap maxChars 10→8（8 字 × 16px = 128px ≤ NODE_W 140 確保不 overflow）

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
| `SvgLabel` 任務名稱（shapes.jsx 顯式）| 8 | 22 | 8 字 × 16px = 128px ≤ NODE_W 140，左右各 6px buffer。3 行最多 24 字 |
| `SvgLabel` 預設值（fallback） | 8 | 22 | 跨用途 conservative 預設 |
| 泳道角色 | 4 | — | LANE_HEADER_W 96px 容 4 字 |
| Event 名 | 11 | — | COL_W 164px 容 11 字 |
| Event 補充 | 14 | — | 比名稱寬，容更多細節文字 |
| 閘道下標 | 9 | — | 跟任務名稱對齊 |

### 13.5 任務元件 padding

| 軸 | 值 | 計算 |
|---|---|---|
| NODE_H 內垂直 padding | 上下各 2px | NODE_H 84 − (3 行 × 32 + 字高 16) = 4，上下各 2 |
| NODE_W 內水平 padding | textAnchor middle，由 maxChars 控制 | maxChars 8 × 16px = 128px 文字寬，NODE_W 140 留左右各 6 |

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

### 13.8 sticky 浮層 offset（捲動時固定在頂端的元素）

**Header（深藍）**：`position: sticky; top: 0`，已有 `shadow-md`。實際渲染高度 ≈ **56px**（`px-6 py-3` + 內容 input/button ~32px = 56-58）。所有下載按鈕（PNG / .drawio / Excel）統一以「↓ 下載 ▾」dropdown 形式放在這裡，整頁僅此一處下載入口。

**FlowTable 表格區自捲動**（`FlowTable.jsx`）：表格容器 `overflow: auto; max-height: calc(100vh - 80px)`。當頁面捲到表格區，整個容器進入 viewport 後內部開始自捲動，thead `<th>` 用 `sticky top: 0`（相對容器頂端，視覺上 = viewport 56px 附近）。

| 元素 | sticky 容器 | top 值 | 視覺處理 |
|---|---|---|---|
| FlowEditor Header | window | `0` | 深藍底 + `shadow-md`，整頁唯一固定頂層 |
| FlowTable thead `<th>` | 表格自身 `overflow:auto` 容器 | `0` | `bg-gray-100`（套在 `<th>` 而非 `<tr>` 才不透） |

**為什麼不用「整頁 thead sticky `top-[56px]`」**（PR #91 嘗試後失敗）：CSS sticky 找最近的 scrolling box（**任一軸** `overflow: auto/scroll/hidden/clip` 都算）當 sticky boundary。Chromium 嚴格依規範。所以表格在 `overflow-x-auto` 容器內時，**垂直 sticky 也會被那個容器卡住**，邊界錯誤導致 thead 跟著表格捲走。

正解：**讓表格容器自己 scroll**（雙軸都自捲動 + maxHeight），thead `top: 0` 相對容器永遠在頂。整頁外部仍可 scroll 看流程圖區。

**Header 高度漂移防護**：若改 Header（加按鈕 / 換字級 / 多列內容）導致實際高度變，**必須同步調整 FlowTable 的 maxHeight 計算**（`calc(100vh - 80px)` 中的 80 = Header 56 + main `py-6` 上半 24）。`grep -rn "100vh - 80px" src` 找定位點。

**目標瀏覽器**：Chrome / Edge（同 Chromium 引擎），`position: sticky` 完全依規範運作。Safari / Firefox 未列為優先支援。

---

## 文件維護規則

1. **改業務規則時**：本文件 + `src/data/helpPanelData.js`（待 Phase 2-2 抽出）+ changelog 三者同步
2. **章節編號穩定**：HelpPanel 註解會引用本文件章節錨點（例 `// 對應 docs/business-spec.md §3`），新增章節用最後加，不要插中間
3. **不放這裡**：Claude 工作流（→ `.claude/business-rules.md`）、routing 演算法細節（→ `HANDOVER.md` §2.5）、實作待辦（→ `.claude/backlog.md`）

# Auto-Routing 自動連線討論交接文件

本檔記錄 2026-05-04 後段對 FlowSprite auto-routing 違規情境的完整研究 + 進行中的修復方向決策樹。下個對話可從此處無縫接手。

**Status as of 2026-05-04**：preview branch `claude/preview-vertical-obstacle-fix` 已部署到 `/preview-routing-fix/`，第一輪修復解掉「上方 corridor 切過任務」但暴露第二個 bug（左方 entry 切過 target row 任務）。**等使用者決策**走 Phase A / B / C 哪條路。

---

## 1. 現有 routing 架構（必讀）

```
phase1and2  → 給每條 connection 初始 (exit, entry) port pair
phase3      → 閘道專用：依 priorities 表挑 (exit, entry) 重新分配
phase3b/3c  → 一般任務 backward / forward 跨欄路徑
phase3d     → same-row 跨 lane 特殊 case
phase3e     → final consolidation
routeArrow  → 拿 (exit, entry) 套固定幾何（L-shape / corridor-detour / Z-shape）
violations  → routing 完跑檢查：rule 1 (port-mix) + rule 2 (line crosses task)
```

**關鍵 insight**：現有架構是「**挑 port → 套樣板**」，**不是 path-finding**。每個 (exit, entry) 對應一個固定 routeArrow 形狀，沒有「在格子上找路」的能力。

### routeArrow 主要形狀（geometry）

| (exit, entry) | 路徑 | 用途 |
|---|---|---|
| `right → left` (sx<tx) | `[s, midX@sy, midX@ty, t]` Z-shape | forward 跨欄，midX 在 column gap |
| `right → left` (sx>tx) | 走 title-bar 上方 corridor | backward 跨欄 |
| `top → top` | `[s, sy-24, tx@sy-24, t]` corridor | parallel-corridor 上方 |
| `bottom → bottom` | `[s, routeY, tx@routeY, t]` corridor | parallel-corridor 下方 |
| `top/bottom → left/right` (needsCorridor=true) | `[s, sy±24, tx@sy±24, t]` | corridor detour，long vertical at tc |
| `top/bottom → left/right` (needsCorridor=false) | `[s, sx@ty, t]` 1-bend | L-path，long vertical at fc |

### Phase 3 priorities loop（閘道 port 選擇）

`src/diagram/layout/phase3.js` 三階段 fallback：

1. **Pass 1**：依 priorities `[bottom, right, top, left]`（隨方向變）找乾淨 exit。reject 條件：
   - `used.has(p)` — sibling 已用
   - `incoming.has(p)` — 跟 IN 同 port 會 mix
   - top corridor 衝突 / `corridorBlockedByFuturePhase3dVertical`
   - `(right||left) && horizontalPathHasObstacle`
   - `top && dr > 1` / `bottom && dr < -1`（cross-many-rows long detour）
2. **Pass 2 — sibling sharing**：同樣 priorities 但**只挑 used.has(p)**（讓 sibling 共用 port）
3. **Pass 3 — legacy fallback**：直接挑 `priorities[0]` + 預設 entry，**無 obstacle check**

---

## 2. 三條規則 + 違規情境分類

### 規則
- **規則 1（blocking）**：同一 port 不可同時 IN+OUT
- **規則 2（warning）**：連線不可穿過任務矩形
- **規則 3（warning）**：閘道分支需有 ≥2 條
- 偵測：`src/diagram/violations.js detectOverrideViolations(flow)` — 完整 routing 後對所有 connection 算 polyline，跑 `pathCrossesRect`

### 6 個分析過的情境

| ID | 名稱 | 是否真實 bug | 修法難度 | 狀態 |
|---|---|---|---|---|
| A | dc=1 對角穿透 | ❌ **不是 bug**（midX 在 column gap） | N/A | 排除 |
| B | 跨列 loop-return 穿透 | ✅ 真實，少見 | 中 | 排程中（Phase A 後） |
| C | 多分支閘道擠爆 | ✅ 真實，5+ 分支 | 高 | UX 引導取代 routing 改動 |
| D | 雙 corridor mix fallback | ⚠️ 邊緣 case | 低 | TODO（Phase A） |
| E | 閘道分支 vertical leg 切過任務 | ✅ **使用者實際遇到** | 中 | **正在修**（preview branch） |
| F | 使用者 override mix | ✅ 真實但不 auto-fix | N/A | 維持手動，加 hover 警示（Phase D） |

---

## 3. 當前 in-progress 工作（情境 E）

### 使用者實際 bug 描述

> 「從畫面左側包容閘道連到右下方 5-1-4-4，依照現在自動規則因為會越過任務，所以會從包容閘道的上方出發、5-1-4-4 任務的上方進入，但是會因為中間有越過排他閘道，所以會被標注紅色，違反規則」

**設定**：OR 閘道 (0, 0) → 5-1-4-4 (1, 3)，dr=1 dc=3。中間有 XOR 閘道 (0, 3)，5-1-4-3 處置物料異常 (1, 2)。

### Preview branch `claude/preview-vertical-obstacle-fix`

**已 deploy**：https://cjo4m3c.github.io/FlowSprite/preview-routing-fix/

#### 兩次 fix 歷史

**v1**（commit `f1d4b82`）：加 `verticalPathHasObstacle(ctx, fr, fc, tr, tc)` 在 `corridor.js`，phase3 對 `top`/`bottom` exit 加檢查。

```js
// v1 — strict between rows
for (let r = rLo + 1; r < rHi; r++) {  // EMPTY when |dr|=1 ← BUG
  if (ctx.taskAt(r, fc)) return true;
  if (fc !== tc && ctx.taskAt(r, tc)) return true;
}
```
**Bug**：`|dr|=1` 時迴圈是空的（使用者場景就是 dr=1）→ check 沒觸發。

**v2**（commit `7c1989c`，**目前 deploy 的版本**）：改 inclusive bounding box。

```js
// v2 — inclusive box at fc and tc
for (let r = rLo; r <= rHi; r++) {
  if (!(r === fr) && ctx.taskAt(r, fc)) {
    if (!(r === tr && fc === tc)) return true;
  }
  if (fc !== tc && !(r === tr) && ctx.taskAt(r, tc)) return true;
}
```
**結果**：top exit 改走 corridor → 但選了**下一個 fallback exit (`bottom→left` L-path)** → horizontal leg 切過 5-1-4-3 at (1, 2)。

### 第二輪 bug（使用者剛回報，**未修**）

> 「上傳資料後變成從 5-1-4-4 的左方端點進入，反而會跟 5-1-4-4 前面一個任務重疊」

**Root cause**：phase3 priorities loop 拒絕 `top` 後 fallback 到 `bottom` exit + inferEntrySide=`left` → bottom→left L-path。但 routeArrow 對 bottom→left 畫：
- 垂直 at fc 從 source 下到 target row
- 水平 at target row 從 fc 到 tx ← **切過 5-1-4-3 at (1, 2)**

#### 設計上要考慮的（v3 設計草稿）

需要兩件事：
1. **`verticalLPathHasObstacle`**（rename + 增強）：除了檢查垂直 leg at fc，**也要檢查水平 leg at target row**（cols cLo+1 to cHi-1）
2. **Phase 3 加「切換 entry 到 corridor」邏輯**：當 (exit=top/bottom, entry=left/right) L-path 被 obstacle 阻擋，改試 (exit, entry=exit) 即 corridor pairing（top→top / bottom→bottom），這個 pairing 的 routeArrow 走 lane corridor，不會穿任務

```js
// 設計（in phase3.js priorities loop）
let testEntry = inferEntrySide(p, c.dr, c.dc);
if ((p === 'top' || p === 'bottom') && (testEntry === 'left' || testEntry === 'right')
    && verticalLPathHasObstacle(ctx, c.fr, c.fc, c.tr, c.tc)) {
  testEntry = p;  // ← 切到 corridor pairing (top→top / bottom→bottom)
}
```

**未實作**：上次 commit 嘗試 rename 但沒同步 phase3 import → revert 回 v2，等使用者決策。

---

## 4. 使用者廣義訴求（Phase B/C 願景）

> 「整體的期待是如果要連線的元件之間，有其他的元件，照正常規則連線會造成違反『線段不能跟元件重疊』的問題（會顯示紅色線）。這個時候希望可以偵測到流程圖上空白的區間，把線段用稍微繞路的方式從空白的地方連起來」

**翻譯成工程語言**：把現有「挑 port → 套樣板」架構升級成 **grid-based path-finding**（A* 或 BFS）。

### 評估過的 12 個必須考慮情境

1. 多條連線競爭同一空白格 → 需 slot 分配
2. 完全沒有 clear path → 紅標 fallback
3. 多 bend 視覺醜 → cost function 懲罰彎折
4. 同欄中間格被佔 → 需 lateral detour
5. 跨多 lane 與 corridor 機制整合
6. Backward / loop-return
7. 閘道 N 分支聯合 optimize vs 獨立 path-find
8. 使用者拖端點 override 必須優先級高於 path-find
9. Drawio 匯出 elbow connector 的相容性
10. 大圖效能（10×15×50 connections ≈ 60K 操作 OK）
11. Re-layout 觸發頻率（每次編輯）
12. 跨 session 一致性（同 input 同 output）

---

## 5. Phase A / B / C 三段策略

### Phase A — 短期手術（2-3 PR）
**精修現有 phase3，不換引擎**。已開始：
- [x] v2 vertical path obstacle check（preview branch deployed，部分有效）
- [ ] **v3 — verticalLPathHasObstacle 增強 + corridor 切換**（in-progress，被 5-1-4-4 case 觸發）
- [ ] 情境 D 修 mix fallback bug（尚未動）

**ROI 高、風險低**，解 80% 明顯違規。

### Phase B — 中期擴增（4-5 PR）
保留 phase3 + corridor 機制，加 **post-validation 重試**：
- routing 完算 cross-task obstacles
- 對違規 connection 重試 (exit, entry) 組合
- 仍違規才標紅給使用者

### Phase C — 長期重構（多月）
換 grid-based path-finder：
- 設計 cost function（distance + bend penalty + slot cost）
- 重寫 routing engine
- 全圖回歸測試（七視圖一致性）
- 走 preview branch 多輪驗證

**建議路徑**：先做完 Phase A，ship 後評估剩餘違規率，再決定 B 或 C。

---

## 6. 給接手 Claude 的開機 checklist

1. `git checkout claude/preview-vertical-obstacle-fix` — 看現有 v2 修法
2. 開 https://cjo4m3c.github.io/FlowSprite/preview-routing-fix/ — 跑使用者的 5-1-4 流程，看 `OR 閘道 → 5-1-4-4` 連線：v2 已改走 left entry 但 horizontal leg 切過 5-1-4-3
3. 問使用者：要走 (a) 繼續 v3 corridor 切換 / (b) 暫停 Phase A、轉設計 Phase B/C / (c) 別的
4. 依答案動手；**routing 改動一律走 preview branch**（per CLAUDE.md §10.6）

### 關鍵檔案

| 檔案 | 用途 |
|---|---|
| `src/diagram/layout/phase3.js` | 閘道 priorities loop（三階段 fallback） |
| `src/diagram/layout/corridor.js` | obstacle predicates + corridor 管理 |
| `src/diagram/layout/routeArrow.js` | (exit, entry) → polyline geometry |
| `src/diagram/layout/gatewayRouting.js` | priorities table + inferEntrySide |
| `src/diagram/violations.js` | post-routing rule check |
| `src/diagram/layout/computeLayout.js` | top-level 整合 |

### 常用驗證

```bash
git checkout claude/preview-vertical-obstacle-fix
npm run build  # 必過
# 在 preview live site 跑 fixture：
#   - 5-1-4 流程（使用者實際 case）
#   - 簡單 forward gateway（不該被打破）
#   - backward loop-return（不該被打破）
```

### 已知 corner case fixture 列表（建議建成 test）

- **OR(0,0) → 5-1-4-4(1,3) with XOR(0,3) + 5-1-4-3(1,2)** ← v2 部分修
- 跨多列 fork 共用 column 中間有任務 ← Phase A 排程中
- 雙 corridor 都被佔 → 期望 fail-loudly ← Phase A 排程中

---

## 7. PR 狀態

| PR | 主題 | 狀態 |
|---|---|---|
| #148 | 密度 toggle Phase 1 | merged |
| #149 | 閘道 UX 兩件 | merged |
| #150 | 線段 label wrap | merged |
| #151 | sticky header zoom fix | merged |
| #152 | drop unused getDisplayLabels alias | merged |
| (preview) `claude/preview-vertical-obstacle-fix` | v2 routing fix | **on preview**, awaiting v3 + user decision |

---

## 8. 額外背景

- **業務規格**：`docs/business-spec.md` §5（連線規則）+ §7（儲存檢核）— 沒有 routing-engine-level 規則，所以 Phase A 改不需要動 spec
- **HelpPanel data**：`src/data/helpPanelData.js` VALIDATION 條目有列 rule 1/2 — 不需更新
- **CLAUDE.md §10**：routing 改動規定（preview branch + trace 驗證）— 已遵守
- **routing 改動測試門檻**：Phase A 每次改動都要在 preview 上跑使用者的 5-1-4 fixture 確認沒回頭壞

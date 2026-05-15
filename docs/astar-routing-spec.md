# A* Routing Algorithm — 規格文件

> **本檔為 A* 連線演算法的單一規格來源（SOT）**
>
> 任何要修改連線演算法之前都必須先查看此文件，並在修改後同步更新此檔。
> 修改原則：**只調整 cost function 權重 / 新增 cost 維度，不寫 if-then 規則**。

---

## 1. 設計哲學

### 1.1 核心理念
**所有「視覺偏好」都編碼進 cost function，讓 A* 自動找到最佳解。**

A* 的本質是「給定 cost，找最低成本路徑」。我們的工作不是寫規則去窮舉情境，而是設計 cost function 讓 A* 自然產生想要的視覺。

### 1.2 為什麼不用 rule-based

- Rule-based 永遠補不完情境（main 過去 6 個月補了 8-10 個 case，仍有 corner case）
- 每個 phase 之間互相耦合，加新 phase 容易破壞既有 phase
- 工程成本跟情境數線性增長

### 1.3 為什麼用 cost function

- 任何「視覺偏好」可拆解成幾個正交維度（distance、direction、proximity、occupancy）
- 加新情境只需「加新 cost 維度 / 調 weight」，不寫 if-then
- 程式碼量跟「視覺維度」線性增長（有限），不跟情境數線性增長
- A* 保證找到最低 cost 路徑（global optimization）

### 1.4 三條紅線

1. **不增加 if-then 規則分支**：所有新需求要找 cost function 對應的維度
2. **不破壞網格對齊**：所有座標必須是 `GRID_CELL` 倍數
3. **不引入第三方 routing library**：用自家演算法，零 runtime 依賴

---

## 2. 系統架構

```
src/diagram/
  layout-astar.js              ← Entry：orchestrate 整個 layout
  pathfinding/
    grid.js                    ← 網格化 + 障礙物標記 + 距離地圖 + 占用追蹤
    astar.js                   ← A* core + min-heap
    router.js                  ← Multi-pass routing + port 選擇 + path 後處理
```

### 2.1 資料流

```
flow (input)
  │
  ├─ layout-astar.js
  │   ├─ 1. 算 task col / row（重用 main 的 columnAssign）
  │   ├─ 2. 算 task 位置（lane center + col center）
  │   ├─ 3. 收集 raw connections（含 user override）
  │   ├─ 4. 算 SVG size
  │   └─ 5. routeAll(rawConns) → connections with _bendPoints
  │
  └─ output (positions + connections + svgDimensions)
```

### 2.2 Routing 流程

```
routeAll
  │
  ├─ 建 RoutingGrid（標 task + boundaries 為 blocked，computeDistanceMap）
  ├─ 排序 edges（source col asc → target col asc）
  │
  └─ for each edge:
       ├─ pickSides(src, tgt, override)  → 決定 exit/entry port
       ├─ computePath(grid, src, tgt, sides, src.id, tgt.id):
       │    ├─ unblock(startCell, goalCell)
       │    ├─ findPath（A* with 4-dim cost）
       │    ├─ append/prepend port pixels
       │    ├─ alignPortSegments（強制端點段對齊 exit/entry 軸）
       │    └─ cleanOrtho（去除 collinear、強制 axis-aligned）
       └─ markPathOccupied（含 source/target/dir metadata 給下條 edge 用）
```

---

## 3. Cost Function（核心）

### 3.1 完整公式

```js
cost(cell, dir, parent) =
    1                                          // 基本移動
  + (dir !== parent.dir ? TURN_PENALTY : 0)    // 維度 0: 轉彎
  + max(0, PROXIMITY_BONUS - distMap[cell])    // 維度 1: 障礙物距離
  + getOccupyPenalty(cell, dir, src, tgt)      // 維度 2: 智慧占用
  + i * 0.01                                   // 微小 tie-break (i = dirOrder index)
```

### 3.2 維度 0：Turn Penalty

**目的**：偏好直線，減少轉彎。

| 參數 | 預設值 | 意義 |
|---|---|---|
| `TURN_PENALTY` | 10 | 每 90° 轉彎扣分 |

- 太低（< 5）：路徑會 zigzag
- 太高（> 20）：路徑為了少轉彎而繞遠路
- 10 是平衡點

### 3.3 維度 1：Proximity Penalty

**目的**：讓路徑走 corridor 中央，遠離 task 邊緣。

```js
proximityCost = max(0, PROXIMITY_BONUS - distMap[cell])
```

- `distMap[cell]` = 該 cell 到最近 blocked cell 的曼哈頓距離
- 預先用 BFS 從所有 blocked cells 同時擴散一次算好（~5ms）

| 參數 | 預設值 | 意義 |
|---|---|---|
| `PROXIMITY_BONUS` | 4 | cell 離障礙物距離 ≥ 此值時無 penalty |

效果：

| 離障礙物距離 | proximityCost |
|---|---|
| 0（自己是 blocked）| 4 |
| 1（緊貼邊框）| 3 |
| 2 | 2 |
| 3 | 1 |
| ≥ 4（夠遠）| 0 |

**解決哪些情境**：
- 線貼 task 邊框 → 自然走遠離邊框的 cells（中央）
- Bend 偏在 source/target 邊 → bend cell 周圍 proximity 影響 → 自然往中央 bend

### 3.4 維度 2：Smart Occupancy

**目的**：多 pass 處理時，前面的 path 影響後面 path 的 cost，但要「智慧區分」哪些情境該分流、哪些該共享。

```js
getOccupyPenalty(cell, dir, myId, myTargetId):
  stored = occupiedMeta[cell]
  if (!stored) return 0
  if (stored.sourceId === myId)       return 0    // 同 source 共享前段
  if (stored.targetId === myTargetId) return 0    // 同 target 共享後段
  if (stored.dir === dir)             return 80   // 同向重疊：高 penalty
  if (stored.dir === opposite(dir))   return 80   // 反向也算重疊
  else                                return 8    // 垂直交叉：低 penalty
```

| 參數 | 預設值 | 意義 |
|---|---|---|
| `OCCUPY_SAME_SOURCE_OR_TARGET` | 0 | 同源 / 同目標共享，免費 |
| `OCCUPY_SAME_DIRECTION` | 80 | 同向（或反向）重疊：強烈懲罰 |
| `OCCUPY_PERPENDICULAR` | 8 | 垂直交叉：略懲罰但允許 |

**解決哪些情境**：
- 同 source 多 fork：前段共享 trunk、後段自然分叉
- 多 incoming 進同 target：後段合流到 target.port
- 平行路徑重疊：A* 自動分開到不同 row/col
- 垂直交叉：允許（penalty 低，視覺可接受）

### 3.4 維度 3：Center Bias

**目的**：讓 2-bend path 的 bend 點落在 path 中點（避免「一邊短一邊長」）。

```js
if (isTurn && hasCenter):
  midX = (src.cx + tgt.cx) / 2
  midY = (src.cy + tgt.cy) / 2
  centerDistCells = (|cellPxX - midX| + |cellPxY - midY|) / CELL_SIZE
  centerCost = centerDistCells * CENTER_WEIGHT
```

| 參數 | 預設值 | 意義 |
|---|---|---|
| `CENTER_WEIGHT` | 1.5 | turn cell 離 path 中點越遠，加 cost 越多 |

只對 **turn cell** 加 cost：
- 對所有 2-bend 候選 path 來說，base cost + proximity + turn cost 大致相同（鏡像對稱）
- bend 位置不同 → turn cell 在不同位置 → 用 centerCost 區分
- A* 自動選 bend 在中點的 path

**解決哪些情境**：
- 2-bend cross-lane 路徑 bend 偏 source / target → bend 拉到中點
- S-shape 路徑兩段水平等長

**對既有 case 的影響**：
- 直線（0 turn）：無 turn cell → 0 centerCost → 不影響 ✓
- 1-turn L-shape：turn cell 位置固定，centerCost 對所有變體相同（鏡像）→ 不影響選擇 ✓
- 多 turn 避障路徑：每 turn cell 加 centerCost → 偏好 turn 在中心區 ✓

### 3.5 Tie-break

```js
const dirOrder = [
  cur.dir,                       // 跟現在方向一致（greedy 直走）
  perpendicular(cur.dir)[0],     // 垂直方向 1
  perpendicular(cur.dir)[1],     // 垂直方向 2
  OPPOSITE[cur.dir],             // 反向
];
tieBias = i * 0.01;  // 0.00 / 0.01 / 0.02 / 0.03
```

當多條路徑 cost 完全相等時，偏好順序：**繼續同方向 > 垂直 > 反向**。

第一步不准回頭（`OPPOSITE[sourceExitDir]`）。

### 3.6 為什麼這四個維度足夠

任何「視覺好不好」的判斷都可拆解成：

| 視覺問題 | 對應 cost 維度 |
|---|---|
| 線太彎 | TURN_PENALTY |
| 線貼邊框 | PROXIMITY |
| 線重疊（同向）| OCCUPY same dir |
| 線無故繞路（同 source 之間互排）| OCCUPY same source/target |
| 線交叉太多（無 OCCUPY 限制）| OCCUPY perpendicular |
| 線左右搖擺 | Tie-break |

未來新增情境若用以上維度無法解決，再考慮**加新 cost 維度**（不寫 if-then）。

---

## 4. Grid 網格化

### 4.1 對齊原則

所有 task / lane / port 尺寸都是 `GRID_CELL` 倍數，確保 grid cell 邊界跟元件邊界完全重合。

- `GRID_CELL = 8`（在 `constants.js`）
- 改 `GRID_CELL` 時，`LAYOUT` 內所有值需保持是它的倍數（含 cx/cy 的 `/2` 需求 → COL_W、LANE_H、NODE_W、NODE_H 必須是 `2 * GRID_CELL` 倍數）

### 4.2 障礙物標記

`RoutingGrid.markTasks()` 把每個 task 矩形範圍的 cells 設為 blocked：

```
blocked cells = { (x, y) | left_x/CELL ≤ x < right_x/CELL,
                            top_y/CELL ≤ y < bottom_y/CELL }
```

### 4.3 虛擬邊界

`RoutingGrid.markBoundaries()` 把以下區域也標 blocked：

- Title bar (rows 0 到 `TITLE_H/CELL`)
- Lane header column (cols 0 到 `LANE_HEADER_W/CELL`)
- 右側 padding (cols ≥ `(svgWidth - PADDING_RIGHT)/CELL`)
- 下側 padding (rows ≥ `(svgHeight - PADDING_BOTTOM)/CELL`)

這樣 A* 不會把線畫到圖外，且 distance map 計算更準確。

### 4.4 Distance Map

`computeDistanceMap()` 用 BFS 從所有 blocked cells 同時擴散，給每個 walkable cell 算到最近 blocked 的曼哈頓距離。

- Time complexity: O(N) where N = total cells
- 對 ~14k cells 約 5ms
- Lazy compute：只有 A* 需要才算

### 4.5 Port 對應 cell 處理

A* 的起終點是「task 外一格」（沿 exit/entry 方向）：

```js
startCell = port_pixel + dirDelta(exitSide) * cellSize  // east 一格
goalCell  = port_pixel + dirDelta(entrySide) * cellSize  // 從 entry 方向看出去一格
```

由於 task 邊界對齊 grid，start/goal cell 就在 task 外緣的相鄰 cell。`unblock()` 確保 A* 能進出。

---

## 5. Multi-pass Routing

### 5.1 排序

```js
sorted = rawConns.sort((a, b):
  if (a.src.col !== b.src.col) return a.src.col - b.src.col
  return a.tgt.col - b.tgt.col)
```

依 source col 升序 → 同 source col 內依 target col 升序。

### 5.2 每條 edge 處理

1. `pickSides(src, tgt, conn._override)` → 決定 exit/entry
2. `computePath()` → 跑 A*，得到 path cells
3. `markPathOccupied()` → 標 path 用過的 cells，含 `{ sourceId, targetId, dir }` metadata
4. 下條 edge 的 A* 看到 occupied cells，依 smart occupancy 規則收費

### 5.3 失敗 fallback

A* 找不到 path 時（罕見，可能因為 grid 太擁擠），fallback 到 `fallbackOrthoPath()`（簡單 L 線），確保 connection 仍有顯示。

---

## 6. Port 選擇規則（Multi-port Trial）

### 6.1 主邏輯：純 cost-based 多候選比較

**不寫「同 lane 有障礙就用 bottom→bottom」這類規則**。改成：對每條 edge 嘗試多個 port 組合，A* 跑出實際 cost，挑最低的。

```
pickBestPath(src, tgt, override, srcId, tgtId):
  if (override 完整) return computePath with override
  
  candidates = generateCandidates(src, tgt, override)
  best = null
  for sides in candidates:
    result = computePath(grid, src, tgt, sides, srcId, tgtId)
    if (result.cost < best.cost) best = result
  return best
```

例：start1 → 1-0-1-2 中間有 1-0-1-1 擋路
- right→left 要繞 1-0-1-1 → A* 算出來高 cost
- bottom→bottom 直接走 lane 下方 corridor → A* 算出來低 cost
- A* 比 cost 自動選 bottom→bottom ✓

例：同 lane 直線無障礙
- right→left 直線 → 低 cost
- bottom→bottom 多 2 段 vertical stub → 高 cost
- A* 選 right→left ✓

### 6.2 候選 port 組合（generateCandidates）

依 dx/dy 給合理子集（不全試 16 種），減少 A* runs：

```
candidates = [autoPickSides(src, tgt)]  // 主候選

if (|dy| < 30):  // 同 lane
  candidates += [top→top, bottom→bottom]

if (|dx| > 30 && |dy| >= 30):  // 跨 lane forward
  if (dy > 0) candidates += [bottom→top]
  else        candidates += [top→bottom]

if (partial override): 把 override side 套用到所有 candidates
candidates = dedupe(candidates)
```

通常 2-3 個候選 → 2-3 次 A* runs → 每 edge ~30ms。

### 6.3 autoPickSides 規則（候選 #1）

```
dx = tgt.cx - src.cx
dy = tgt.cy - src.cy

if (|dx| > 30):  // 有明顯水平距離
  if (dx > 0) return { exit: 'right', entry: 'left' }
  else       return { exit: 'left',  entry: 'right' }
else:  // 幾乎同 col
  if (dy > 0) return { exit: 'bottom', entry: 'top' }
  else       return { exit: 'top',    entry: 'bottom' }
```

### 6.4 Override 處理

| Override 形式 | 行為 |
|---|---|
| 完整（exit + entry 都給）| 跳過多候選，直接用 override |
| 部分（只給 exit 或 entry）| Candidates 套上 override 的部分 |
| 無 | 全套 candidates 跑 trial |

### 6.5 已知 gap（多候選方案後仍未覆蓋）

- Gateway 類型偏好（parallel 應偏好 bottom 出）：可加新 candidate generator
- Backward edge：可加 `if (dx < -30): candidates += [top→top]`

這些都是擴 generateCandidates，不是寫 if-then 條件分支去「強制套用特定 port」。

---

## 7. Path 後處理

### 7.1 alignPortSegments

確保第一段沿 `exitSide` 軸、最後一段沿 `entrySide` 反向同軸。

避免端點段變成「從上下方進入元件」而不是「側邊」。

### 7.2 cleanOrtho

三 pass：

1. **Snap diagonals**: 對任意 diagonal 段，插入轉折變 axis-aligned
2. **Dedup**: 移除連續相同點
3. **Collapse collinear**: 三點共線（同 x 或同 y）的中間點移除

---

## 8. 可調參數總表

| 參數 | 位置 | 預設值 | 影響 |
|---|---|---|---|
| `GRID_CELL` | `constants.js` | 8 | 網格細度（改了所有 LAYOUT 倍數也要改）|
| `TURN_PENALTY` | `astar.js` | 10 | 轉彎扣分 |
| `PROXIMITY_BONUS` | `astar.js` | 4 | 障礙物距離 ≥ 此值時無 penalty |
| `CENTER_WEIGHT` | `astar.js` | 1.5 | Turn cell 離 path 中點越遠加 cost |
| `OCCUPY_SAME_DIR` | `grid.js` | 80 | 同向重疊扣分 |
| `OCCUPY_PERP` | `grid.js` | 8 | 垂直交叉扣分 |
| `MAX_ITER` | `astar.js` | 50000 | A* 搜尋上限 |
| `pickSides dx threshold` | `router.js` | 30 | 同 col 判定閾值（< 30 算同 col）|

---

## 9. 已知限制與未實作項目

| 項目 | 影響 | 後續處理方向 |
|---|---|---|
| Gateway 類型 exit 偏好 | parallel 預期從 bottom 出，目前統一從 right 出 | 加 cost 維度：若 src.type === 'gateway' && gatewayType === 'parallel' → exit=bottom 有 bonus |
| Backward edge 樣式 | dx<0 邊目前是「下方走 vs 上方繞」隨機 | 加 cost 維度：dx<0 時 north 方向有 small bonus |
| 規則 3「target 欄左→右排 slot」 | 同 corridor 多條線順序由 multi-pass 決定，不一定跟 target col 對齊 | 改 multi-pass 排序，或加 cost 維度：path y 應該越接近 target row 越低 cost |
| Drag preview 走 A* | 拖曳當下用簡單 L 預覽，放開後 A* 重算可能跳線 | useDragEndpoint 加 throttle 跑 A* |
| Lane 動態高度 | 目前固定 `BASE_LANE_H`，大流程可能擁擠 | 預估每 lane 內 corridor 流量，動態擴 lane height |
| 大流程效能 | 30+ tasks 約 100-300ms | per-edge 結構 hash cache |

---

## 10. 修改原則（紅線）

### 10.1 修改前必做

1. **先查此規格**（你正在讀的這份）
2. 找對應的 cost 維度（如果是 1-3 維能解決就調權重，否則加新維度）
3. 確認**不引入 if-then 規則分支**

### 10.2 修改時

1. **改 cost 維度權重**：在 `astar.js` 或 `grid.js` 改常數，跑 smoke test
2. **加新 cost 維度**：在 `astar.js::findPath` 內加，並在此規格 §3 加說明
3. **改 grid 結構**：在 `grid.js`，並在此規格 §4 同步

### 10.3 修改後必做

1. **更新此規格**對應段落
2. 跑 smoke test 看視覺
3. 確認 cost 維度數量、影響各 case 文件化
4. 更新 §9「已知限制」如果有新覆蓋的情境

### 10.4 不可以做的

- 在 router.js / astar.js 寫 `if (task.type === 'gateway' && something) { specialCase }` 之類分支
- 引入第三方 routing library
- 跳過 grid 對齊（必須維持 cell 邊界對齊）

---

## 11. 測試 / 驗證情境

每次 cost 維度修改後，至少跑以下情境並對照視覺：

| 情境 | 預期 |
|---|---|
| Adjacent same-lane (A → B 同 lane 相鄰) | 直線 2 點 |
| Same-lane 中間有 task 阻擋 | 走 corridor 中央，距離 task 邊框 ≥ 2 cells |
| 跨 lane 直接連線 | 2-turn S 或 1-turn L 形 |
| 跨 lane 中間有 task 阻擋（A→D 情境）| 在阻擋元件兩側 corridor 之一走，bend 點靠中央 |
| Backward edge（target.col < source.col）| 走 top corridor 繞回 |
| Gateway parallel fork（多條 outgoing）| 共享前段、自然分叉到不同 target |
| Gateway exclusive fork | 同上 |
| Merge（多 incoming 進同 target）| 後段合流到 target port |
| 兩條獨立 path 交叉 | 允許交叉（penalty 低）|
| 兩條平行 path 重疊 | 自動分開到不同 row/col |

---

## 12. 對照業務規則

| 業務規則（`docs/business-spec.md` §5）| A* 對應做法 |
|---|---|
| 規則 1：端點不混用 | Tie-break + multi-pass 自然避免；`violations.js` 仍做事後檢查 |
| 規則 2：避免視覺重疊 | Distance map 主動避障；`violations.js` 仍做事後檢查 |
| 規則 3：target 順序排 slot | **未實作（gap）**，已知限制 §9 |
| 規則 4：編號顯示分層 | 由 `TasksLayer.jsx` 處理，A* 不感知 |
| 規則 5：兩層儲存檢核 | `validateFlow` 不變 |

---

## 13. 變更歷史

| 日期 | 版本 | 內容 | Commit |
|---|---|---|---|
| 2026-05-13 | v1.0 | 初版規格，含 3 個 cost 維度（turn, proximity, smart occupancy）| ad2b338 |
| 2026-05-13 | v1.1 | 加 cost 維度 4: **Center Bias**（解 bend 不對稱）+ Port 選擇改 **Multi-port Trial**（解該用 top/top 或 bottom/bottom 而非 right/left）| TBD |

未來每次 cost function / grid / multi-pass 邏輯變更都要在此記錄。

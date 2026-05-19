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
    grid.js                    ← 網格化 + 障礙物標記 + 距離地圖 + 占用追蹤 + port reservation + coherence
    astar.js                   ← A* core + min-heap + 6 維 cost function
    router.js                  ← Shim re-export (1 行 export from ./router/index.js)
    router/                    ← 拆檔子目錄 (v1.9 size cap split)
      index.js                 ← Public API: export { routeAll }
      routeAll.js              ← Orchestrator (multi-pass + reservePort + markOccupied)
      anchorPredict.js         ← S1/S6 anchor by geometry pre-compute (維度 6)
      pickPath.js              ← multi-port trial + candidate generation + A* 包裝
      pathPostProc.js          ← alignPortSegments / cleanOrtho / fallback / side helpers
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

### 3.1 完整公式（v1.19）

```js
// astar.js per-cell cost
cost(cell, dir, parent) =
    baseStep  // v1.19 M1: 1 if runLength<3 else 0.5 (直走 rebate)
  + (isTurn ? turnPenalty(turnCount) : 0)                                // 維度 0: 累進 turn (v1.10 S15)
  + proximityCost(distMap[cell], distFromEndpoint)                       // 維度 1: 障礙物距離 (v1.9 S8 + v1.11 S4)
  + getOccupyPenalty(cell, dir, src, tgt,                                // 維度 2: 智慧占用
                     startCell, goalCell, entrySide, exitSide)           //   (v1.11 S20 不對稱 + v1.12 S22/S23 軸延伸)
  + (isTurn && farFromSkipRadius && centerBiasEnabled                    // 維度 4: 中心偏好 (v1.8 動態 + v1.10 S19 斜軸關)
       ? centerDist * CENTER_WEIGHT : 0)
  + i * 0.01                                                              // tie-break (i = dirOrder index)

// pickPath.js::pickBestPath 算完 A* 後加：
adjustedCost = a*.cost
  + getPortConflictPenalty(src, exit, 'out')                             // 維度 5: port reservation (v1.5)
  + getPortConflictPenalty(tgt, entry, 'in')
  + getCoherenceMismatchPenalty(src, exit, 'out')                        // 維度 6: coherence (v1.6 + v1.10 動態)
  + getCoherenceMismatchPenalty(tgt, entry, 'in')                        //   factor = 2*(1-anchorStrength)
```

v1.14 回退 v1.13 S24 (dim 7 bend endpoint clearance)：在 endpoint <3 cells 罰 turn cell 的設計反向誘導 A* 找 3-turn 替代路徑（cost 反低於被罰的 2-turn）。Issue 1 根因（短 backward stub 擠）改在 §6 candidate generation 解（強制 T→T / B→B），屬「per-edge port 組合策略」職責不該污染 per-cell cost — 詳 §10.5 職責分層。

### 3.2 維度 0：Turn Penalty (v1.10 S15 累進)

**目的**：偏好直線，減少轉彎。

```js
// v1.10 S15：累進函式取代固定值
turnPenalty(turnCount):
  if (turnCount <= 2) return 15  // 1st-2nd: base
  if (turnCount === 3) return 25
  return 30                       // 4th+

// A* node 維護 turnCount，每次轉彎遞增
```

| 參數 | 預設值 | 意義 |
|---|---|---|
| `TURN_PENALTY_BASE` | 15 | 第 1-2 turn 的 penalty (v1.2: 10→15 阻止 proximity-driven zigzag) |
| 第 3 turn | 25 | 累進開始 |
| 第 4+ turn | 30 | 上限 |

**為何累進**：長 path 中 base cost 主導，固定 15 的 turn penalty 相對小 → A* 為省 base cost 願意多 bend 繞行。累進讓「3-bend 繞行」cost 顯著高於「2-bend 直達」(差 25)，A* 自然偏好少 bend path (解情境 2/4 多 bend 繞行案例)。

**對既有 case 的影響**：
- 1-bend / 2-bend path：跟 v1.9 一樣 (15 per turn)
- 3-bend 必要避障：base+25 略升 (從 base+15)
- 4+ bend 嚴重繞行：cost 明顯升高，A* 偏好別的 candidate

**邊界**：避免極端 — 不會 ∞ 累進，4+ bend 都是 30 上限。

### 3.3 維度 1：Proximity Penalty (v1.9 S8 stub skip + v1.11 S4 endpoint clearance)

三段邊界處理：

```
distance from endpoint:
  0─1─2          3─4─5          6+
  STUB           END-ZONE       中段
  cost=0         BONUS=6        BONUS=4

  v1.9 S8         v1.11 S4       v1.0 標準
  stub 沿軸不繞行  endpoint 附近   corridor 中央
                  加強推開避箭頭擠
```

各段獨立可調，無耦合。



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

### 3.4 維度 2：Smart Occupancy (v1.3 + v1.11 S20 不對稱 + v1.12 S22/S23 軸延伸)

**目的**：多 pass 處理時，前面的 path 影響後面 path 的 cost。同 source/target 邊要「視情境共享 trunk/tail」、不同 source/target 邊要「分流避平行重疊」。

```js
// grid.js::getOccupyPenalty(cell, dir, mySource, myTarget, startCell, goalCell, entrySide, exitSide)
stored = occupiedMeta[cell]
if (!stored) return 0

// === 同 source (fork) ===
if (stored.sourceId === mySource):
  d = manhattan(cell, startCell)
  if (d <= SHARE_RADIUS_SOURCE=2)             return 0   // 圓形 share-free zone (trunk)
  // v1.12 S23：軸延伸 share-free（對稱 v1.12 S22）
  if (exitSide ∈ {top, bottom} && cell.x === startCell.x)  return 0  // 垂直 port，整條 x 軸
  if (exitSide ∈ {left, right} && cell.y === startCell.y)  return 0  // 水平 port，整條 y 軸
  return SHARE_PENALTY=3   // 偏離軸 + 圓外，spread

// === 同 target (merge) ===
if (stored.targetId === myTarget):
  d = manhattan(cell, goalCell)
  if (d <= SHARE_RADIUS_TARGET=5)             return 0   // 圓形 share-free zone (tail)
  // v1.12 S22：軸延伸 share-free
  if (entrySide ∈ {top, bottom} && cell.x === goalCell.x)  return 0  // 垂直 port，整條 x 軸
  if (entrySide ∈ {left, right} && cell.y === goalCell.y)  return 0  // 水平 port，整條 y 軸
  return SHARE_PENALTY=3   // 偏離軸 + 圓外，spread

// === 異 source/target ===
if (stored.dir === dir || stored.dir === opposite(dir))   return 80   // 同向重疊
return 8   // 垂直交叉允許
```

| 參數 | 預設值 | 意義 |
|---|---|---|
| `SHARE_RADIUS_SOURCE` | 2 | Fork 圓形 share-free 範圍小 → 早分叉 (v1.11 S20) |
| `SHARE_RADIUS_TARGET` | 5 | Merge 圓形 share-free 範圍大 → 提早合流 (v1.11 S20) |
| `SHARE_PENALTY` | 3 | 軸外、圓外的同 source/target cell cost |
| `OCCUPY_SAME_DIR` | 80 | 異 source/target 同向重疊（避平行）|
| `OCCUPY_PERP` | 8 | 異 source/target 垂直交叉（允許）|

**幾何直覺（v1.12 S22/S23 後）**：

```
            target task
         ┌─────────┐
         │         │
   ──────●─────────┤    ← S22: y=goalY 整條軸 share-free
         │         │      (水平 entry port)
         └─────────┘
         goalCell↓
              ····      ← Manhattan radius 5 圓形 share-free
         ┌────────┐
         │ (圓內) │
         └────────┘

   ──────── source axis (S23) ────────
         │
         │             ← x=startCell.x 整條軸 share-free
         │              (垂直 exit port)
       startCell
         │
   ┌─────●─────┐
   │  source   │
   │   task    │
   └───────────┘
```

**解決哪些情境**：
- 同 source 多 fork：trunk 共享（圓內 + 軸線上），中段自然分叉到不同 target
- 多 incoming 進同 target：tail 合流（圓內 + 軸線上），共用 port 軸接近 → 共用箭頭位置
- 平行路徑（不同 source/target）：自動分開到不同 row/col
- 垂直交叉（不同 source/target）：允許（penalty 低）
- **v1.12 修正**：S22 解「進 port 前 1-grid 階梯」、S23 解「出發後 1-grid 階梯」

**Trade-off**：S23 後 fork 邊堆疊在 source 軸 trunk，labels 可能重疊。視覺優先「整齊出發 / 共用箭頭」。

#### 3.4.1 markPathOccupied 完整展開

**注意**：`router/routeAll.js::markPathOccupied()` 必須對每段 path 的「每個 cell」展開標記，不能只標 bend point。

`cleanOrtho` 會合併共線中間點，所以 `pathPx` 通常只是 bend points。若只標 bend points，後續同 target 路徑看不到「水平/垂直段內部的 occupied cells」→ 同 target 無法 spread（同 cells 仍 0 penalty）。

實作：iterate 每對相鄰 bend points 之間的 cell，逐一 markOccupied。

### 3.5 維度 4：Center Bias (v1.1 + v1.2 + v1.8 動態 SKIP_RADIUS + v1.10 S19 斜軸關閉)

**v1.10 S19 重要適用範圍**：對「斜軸 pair」candidate（exit/entry 不同軸的 8 種：R→T, B→L, R→B, T→L, L→T, B→R, L→B, T→R），A* 跑 candidate 時**完全關閉** Center Bias。

理由：斜軸 pair 的 ideal 是 1-bend，bend 必在 corner（非 path midpoint）。Center Bias 設計目的是「2-bend U/S 拉中點」，對 1-bend 斜軸是**反向破壞** — A* 為避 centerCost 改走 3-bend 讓 bend 進中段，反而選繞行版本。

關閉後：斜軸 pair 1-bend 不被罰 → A* 自然選 1-bend。同軸 pair (T→T, R→L 等) 仍受 Center Bias 拉中點。



**目的**：讓 2-bend U/S path 的 bend 點落在 path 中點（避免「一邊短一邊長」）。

```js
// v1.8 (S3)：SKIP_RADIUS 從固定 4 改成依 path 長度動態算
pathLen = manhattan(start, goal)
skipRadius = clamp(pathLen / 4, [4, 10])

if (isTurn && hasCenter):
  if (distFromStart > skipRadius && distFromGoal > skipRadius):
    midX = (src.cx + tgt.cx) / 2
    midY = (src.cy + tgt.cy) / 2
    centerDistCells = (|cellPxX - midX| + |cellPxY - midY|) / CELL_SIZE
    centerCost = centerDistCells * CENTER_WEIGHT
```

| 參數 | 預設值 | 意義 |
|---|---|---|
| `CENTER_WEIGHT` | 1.5 | turn cell 離 path 中點越遠，加 cost 越多 |
| `CENTER_SKIP_RADIUS_MIN` | 4 | 短 path 的 SKIP_RADIUS 下限 (保留 v1.2 行為) |
| `CENTER_SKIP_RADIUS_MAX` | 10 | 長 path 的 SKIP_RADIUS 上限 |

只對「離 endpoint > SKIP_RADIUS」的 turn cell 加 cost。**v1.8 動態 SKIP_RADIUS 的意義**：

- 對短 path (pathLen=10)：skipRadius=4，跟 v1.2 一樣
- 對中 path (pathLen=20)：skipRadius=5，略寬
- 對長 path (pathLen=40+)：skipRadius=10 (上限)
- **解決圖一 5-1-4-3 → 5-1-4-10 case**：1-bend bend cell 在「東南角」離 goal 約 4，pathLen=28 → skipRadius=7 > 4 → bend 被跳過不算 centerCost → A* 自然選 1-bend 不繞行
- **保留 v1.1 修的「2-bend bend 拉中點」**：2-bend bend cells 位於 path 中段，distFromStart/Goal ≈ pathLen/2，仍 > skipRadius → centerCost 起作用

**解決哪些情境**：
- 2-bend cross-lane 路徑 bend 偏 source / target → bend 拉到中點 (v1.1)
- S-shape 路徑兩段水平等長 (v1.1)
- Port stub 必要轉彎不被誤罰 (v1.2)
- **長 path 1-bend (R→B 對角斜軸) 的 corner bend 不被誤罰** (v1.8)

**對既有 case 的影響**：
- 直線（0 turn）：無 turn cell → 0 centerCost → 不影響 ✓
- 1-turn L-shape 短 path：skipRadius=4 跟 v1.2 一樣 → 不影響 ✓
- 2-bend U/S：bend 在中段、離 endpoint > skipRadius → 仍受 Center Bias → bend 拉中點 ✓
- **1-bend 對角斜軸長 path：corner bend 落在 skipRadius 內 → 不被罰 → 1-bend 仍最低 cost ✓**

### 3.6 維度 5：Port Reservation (v1.5)

**目的**：解 business-spec §5 規則 1「同 port 不可混 IN+OUT」。

```js
getPortConflictPenalty(taskId, side, direction):
  state = portReservations[taskId]?.[side]
  if (!state) return 0
  opposite = (direction === 'in') ? 'out' : 'in'
  return state[opposite] > 0 ? PORT_VIOLATION_PENALTY(500) : 0
```

每 task 的每 port 維護 `{ in: count, out: count }`。Route 完一條 edge 後 `reservePort(srcId, exitSide, 'out')` 跟 `reservePort(tgtId, entrySide, 'in')`。下條 edge 在 `pickBestPath` 比 cost 時加上 conflict penalty。

| 參數 | 預設值 | 意義 |
|---|---|---|
| `PORT_VIOLATION_PENALTY` | 500 | 反向使用同 port 的 cost（大到 A* 一定避，但仍可 fallback）|

**解決哪些情境**：
- End event 已有 outgoing 從 bottom 出 → 新 incoming 不會誤選 bottom 進入
- Source 已有 incoming 從 top 進 → 新 outgoing 不會誤選 top 出
- 同 port 多 IN（merge）或多 OUT（fork）仍允許（count 累加不算 conflict）
- 違規不被 hard block（仍可選做 fallback），但 cost 屠殺其他候選

**實作位置**：
- `grid.js`：`portReservations` map + `reservePort()` + `getPortConflictPenalty()`
- `router.js::pickBestPath`：每個 candidate cost 加上 portPenalty 後比較
- `router.js::routeAll`：每條 edge route 完後 reservePort（含 fallback 路徑）

**Multi-pass 順序影響**：reservation state 依排序累加。目前 sort 是 `source.col asc → target.col asc`，先 route 的 edge 先 reserve port。若順序不合理可後續調 sort。

### 3.7 維度 6：Same-target / Same-source Coherence (v1.6 + v1.8 anchor by geometry + v1.10 S16 動態權重)

**v1.10 S16 動態 COHERENCE_PENALTY**：依 anchor strength（投票多數比例）縮放：

```js
factor = 2 * (1 - strength)
penalty = COHERENCE_PENALTY * factor

  strength=1.0 (壓倒性 majority 5/5) → factor=0   → 不罰
  strength=0.8 (4/5)                  → factor=0.4 → 4.8
  strength=0.6 (3/5)                  → factor=0.8 → 9.6
  strength=0.5 (邊際 2/4 / first-wins) → factor=1.0 → 12.0 (全罰)
```

**為何動態**：壓倒性 anchor 表示「大多數 path 已自然朝某 side」(cost-based 已收斂)，不需要 COHERENCE 強推一致；但少數異類 edge 反而應該放行（如 1-0-1-5 → end event B→T 不被強拉成 B→L）。弱 majority anchor 才強推一致（如 5-1-4-10 多 incoming 票數分散但有微弱多數）。

**解情境 4**：end event 集中型 anchor (5/5 票) 不再壓倒少數異類 edge。



**目的**：多 incoming 進同 target / 多 outgoing 出同 source 偏好收斂一致 entry/exit side。

```js
// v1.8 (S1)：routeAll 開頭先做 anchor by geometry pre-compute
predictAnchors(grid, rawConns, positions):
  for each edge (src → tgt):
    vote src.out anchor by (tgt 相對 src 的方位)
    vote tgt.in  anchor by (src 相對 tgt 的方位)
  for each task:
    in/out anchor = 票數最多的 side (tie-break: right > bottom > left > top)
    寫入 grid.coherence[taskId]

// route 過程中 reservePort first-wins 不覆寫已預設 anchor
reservePort(taskId, side, direction):
  ...port reservation 計數...
  if (!coherence[taskId][direction]) coherence[taskId][direction] = side  // 沒 anchor 才設

getCoherenceMismatchPenalty(taskId, side, direction):
  anchor = coherence[taskId]?.[direction]
  return (anchor && anchor !== side) ? COHERENCE_PENALTY : 0
```

每 task 的每方向（in / out）有一個 anchor side。**v1.8 後** anchor 由 layout 預處理依 geometry 多數投票決定，跟 multi-pass 順序解耦；route 完每條 edge 仍呼叫 reservePort 但不覆寫已預設的 anchor。

| 參數 | 預設值 | 意義 |
|---|---|---|
| `COHERENCE_PENALTY` | 20 | 同 task 同方向 anchor side 已設時，選不一致 side 的 cost |

**權重設計**：20 > TURN_PENALTY(15)，能贏 1 個 turn 的差距讓 coherence 屠殺；但 << OCCUPY_SAME_DIR(80) / PORT_VIOLATION(500)，明顯阻擋或規則違規仍會走非一致 side。

**解決哪些情境**：
- 多 incoming 進同 end event → 全部收斂同 entry side（anchor 預設）
- Gateway 多 fork → 全部從 anchor exit side 出（標籤不會散在不同 side）
- 跨多 lane 大流程 → 進入 side 視覺一致
- **v1.8 後**：編輯一條 edge 不會打亂其他 edge 的 anchor → 跳變消失

**邊界**：
- Anchor 由 geometry 預測；只有 0 票的 task 不設 anchor（罕見）
- 跟 port reservation 不衝突：reservation 是 hard 避反向，coherence 是 soft 偏向同 side

### 3.7.1 維度 7 (已回退 v1.14)

v1.13 S24 曾加 dim 7 (Bend Endpoint Clearance)，penalty=20 在 turn cell 距 endpoint <3 cells 處。但實測發現 A\* 為避這 penalty 找出 **3-turn 替代路徑**（cost N+49 < 被罰的 2-turn N+52） → 引入新 bug（短 path 進 endpoint 多 1 個小南彎）。v1.14 **回退** dim 7。

**教訓進 §10.5 職責分層**：cost dim 罰得太局部會讓 A\* 找替代路徑繞過 penalty。原本想解的「短 backward stub 擠」根因是「同 row 跨元件 R→L 候選的 cost 太低」，屬 candidate set 職責，不是 per-cell cost 職責 — 修正後在 §6.2 candidate generation 強制此類 edge 走 T→T / B→B。

### 3.8 Tie-break

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

### 3.9 為什麼這六個維度足夠（v1.14 回到 6 維）

任何「視覺好不好」的判斷都可拆解成：

| 視覺問題 | 對應 cost 維度 |
|---|---|
| 線太彎 | TURN_PENALTY |
| 線貼邊框 | PROXIMITY |
| 線重疊（同向）| OCCUPY same dir |
| 線無故繞路（同 source 之間互排）| OCCUPY same source/target |
| 線交叉太多（無 OCCUPY 限制）| OCCUPY perpendicular |
| 同 port IN+OUT 混用（規則 1 違規）| PORT_RESERVATION |
| 多 incoming/outgoing 進入方向不一致 | COHERENCE |
| Bend 不在 path 中點 | CENTER_BIAS |
| 線左右搖擺 | Tie-break |
| **某類 edge 應該走某類 port 組合**（如同 row 跨多 col → corridor）| **candidate set design（§6.2，非 cost dim）** |
| **空間配置（lane 大小不足）** | **layout pre-pass（§4.5，非 cost dim）** |

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

### 4.5 動態 Lane 高度 (v1.13)

**目的**：解多平行線段在同 lane 擠壓 → A* spread 受限於 lane 高度 hard cap → label 互蓋 + 箭頭間距 0-1 grid。

```js
// layout-astar.js Phase 2 在 positions 算出前
laneLoad[row] = Σ over edges:
  same_lane && dx < 0       : 1.0   (backward, 必走 corridor)
  same_lane && dx == 1      : 0.0   (adjacent forward, 直連不佔)
  same_lane && dx > 1       : 0.5   (gap forward, 可能走 corridor 避中間 task)
  cross_lane                : 0.15  (對 src/tgt 兩個 lane 各加，1-bend 對角)

overflow = max(0, ⌈laneLoad[row]⌉ - BASE_CORRIDOR_CAPACITY)
laneHeights[row] = clamp(BASE_LANE_H + overflow * LANE_GROWTH_STEP,
                         BASE_LANE_H, MAX_LANE_H)
```

| 參數 | 預設值 | 意義 |
|---|---|---|
| `BASE_CORRIDOR_CAPACITY` | 4 | 預設每 lane 上下 corridor 各有 ~4 row 容量 |
| `LANE_GROWTH_STEP` | `2 * GRID_CELL = 16px` (v1.16 修 bug, 原 v1.15 設 24 破壞對齊) | 每多 1 row 流量擴的 lane 高度（必須 2*GRID_CELL 倍數）|
| **`BOUNDARY_LANE_MULTIPLIER`** | `2` (v1.16) | lane 0 / 末端 lane 額外擴張係數，補 markBoundaries header/footer buffer 占用 |
| **`HEADER_BUFFER_CELLS`** | `2` (v1.16) | `grid.js::markBoundaries` title bar 下方 buffer 行數 (path 不可走) |
| **`FOOTER_BUFFER_CELLS`** | `2` (v1.16) | `grid.js::markBoundaries` padding bottom 上方 buffer 行數 |
| **`HALO_PENALTY_SAME_NEAR / FAR`** | `5 / 2` (v1.16) | 同 source/target halo cell penalty (vs 異 src/tgt 30/10)，fork trunk spread 用 |
| `MAX_LANE_H` | `30 * GRID_CELL = 240px` | lane 高度上限（極端流程應靠拆 lane 解，不靠 lane 撐） |
| `P_BACKWARD` | 1.0 | 同 lane backward edge 走 corridor 機率 |
| `P_GAP_FORWARD` | 0.5 | 同 lane 跨多 col forward 走 corridor 機率（非 fork）|
| `P_SAME_SOURCE_FORK` | 1.0 (v1.15) | 同 lane forward from fork source (outDegree≥2) — 每條 fork trunk 都 100% 佔 |
| `P_ADJACENT` | 0.0 | 同 lane adjacent forward 走 corridor 機率（直連，非 fork）|
| `P_CROSS_LANE` | 0.15 | 跨 lane edge 對 src/tgt 兩 lane 各加 |

**幾何直覺**：

```
LPMC lane (BASE 144px, 6 backward → load=6 → overflow=2 → +32px → 176px)

ＡＡＡ extra 2 rows (16px each)
─────────────────────────────────────  ← 擴的空間，corridor 多 2 row
 [t1] [t2] [t3] [t4] [t5] [t6] [t7]
        ▲    ▲    ▲    ▲    ▲    ▲
        │    │    │    │    │    │   6 backward edges
ＶＶＶ   spread 在 6+ 個 row 不擠
─────────────────────────────────────
```

**解決哪些情境**：
- 大流程同 lane 多 backward retry / 多 fork 分散：lane 自動擴張，A* 有空間 spread → label 不重疊
- 純直連 lane（無 backward / fork）：load = 0 → 不擴，版面不浪費

**為何啟發式單 pass 而非兩階段**：30+ task 流程已 150-300ms，兩階段 ×2 破壞使用者體驗 + cache invalidation 變難。啟發式 O(N) 一次掃，精度夠用（對症型 backward / 異常處理流程）。

**邊界**：
- 啟發式有可能低估（如某些 cross-lane 邊實際走長 corridor 但只算 0.15）— 真擠時退一步靠人工拆 lane
- 上限 240px：超過代表流程設計問題（單 lane 30+ task 應該 refactor）
- structuralHash 已含 task.nextTaskIds / conditions，lane 高度變動已涵蓋 cache 失效

### 4.6 Port 對應 cell 處理

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

依 (dx, dy) 分 9 象限給候選，主候選永遠 = `autoPickSides`，每象限再加同軸 pair + 對角象限加 2 個順向斜軸 pair 候選讓 A* 比 cost。

| dx \ dy | dy < -T (target 上方) | \|dy\| < T (同 row) | dy > T (target 下方) |
|---|---|---|---|
| dx < -T | L→R + T→B + T→T + B→B + **L→B + T→R** | T→T + B→B (Tier-1) + L→R (Tier-2, v1.17) | L→R + B→T + T→T + B→B + **L→T + B→R** |
| \|dx\| < T | T→B + L→L + R→R | AUTO 1 (退化) | B→T + L→L + R→R |
| dx > T | R→L + T→B + T→T + B→B + **R→B + T→L** | R→L + T→T + B→B (adj) / T→T + B→B (Tier-1) + R→L (Tier-2, v1.17 for gap) | R→L + B→T + T→T + B→B + **R→T + B→L** |

(T = 30。粗體 = v1.7 新增斜軸 pair。v1.14 同 row 跨 col 分 adjacent/non-adjacent。v1.17 加 Tier-2 fallback)

實作（router/pickPath.js::generateCandidates）：

```js
candidates = []
sameRow = |dy| < T(30)
sameCol = |dx| < T(30)
sameRowAdjacent = sameRow && |dx| ≤ ADJACENT_DX_LIMIT(288)  // v1.14：≈1.5×COL_W

// v1.14：同 row 跨多 col 或同 row backward — 不要 autoPick R→L/L→R 主候選
if !(sameRow && !sameCol && !sameRowAdjacent):
  candidates += [autoPickSides(src, tgt)]

if (sameRow && !sameCol):          // 同 row 跨 col
  // v1.14：兩種情況都加 T→T + B→B：
  //   - adjacent (|dx| ≤ 288): 主候選 R→L + corridor 備援
  //   - non-adjacent / backward: 沒主候選，只 T→T + B→B 強制走 corridor
  candidates += [T→T, B→B]  // Tier-1 視覺首選
  // v1.17 Tier-2 fallback：R→L (dx>0) 或 L→R (dx<0)
  // 飽和情境 (4+ edges 同 task port 都違規) 時 rule 1 hard preference 退讓視覺
  // 走直線 R→L 通過 task 之間 — 比 violate rule 1 好
  // adjacent case autoPick 已含 R→L → dedupe 自動移除 Tier-2 重複
  candidates += [dx>0 ? {exit:'right', entry:'left', tier:2}
                      : {exit:'left',  entry:'right', tier:2}]
else if (sameCol && !sameRow):     // 同 col 跨 row
  candidates += [L→L, R→R]         // 左右 corridor 繞行
else if (!sameRow && !sameCol):    // 對角象限
  candidates += [dy>0 ? B→T : T→B] // S-shape vertical 同軸
  candidates += [T→T, B→B]         // U-shape vertical 同軸
  // v1.7: 自然順向斜軸 (dx/dy 號決定方位)
  if (dx > 0 && dy > 0):
    candidates += [R→T, B→L]      // 右下
  else if (dx > 0 && dy < 0):
    candidates += [R→B, T→L]      // 右上
  else if (dx < 0 && dy > 0):
    candidates += [L→T, B→R]      // 左下
  else:
    candidates += [L→B, T→R]      // 左上

if (partial override): 收斂為單一「幾何自然 pair」候選（見 §6.4）
candidates = dedupe(candidates)
```

每象限 3-6 個候選 → 約 90-180ms / edge。30 tasks 估算 270-540ms。

#### 6.2.1 斜軸 pair 開放原則 (v1.7)

每對角象限只開「自然順向」2 種斜軸（dx/dy 號決定方位），**不開**繞遠的逆向 6 種。例如右下 (dx>T, dy>T) 開 R→T 跟 B→L（順自然方位），不開 T→R / L→B / R→B / T→L 等繞遠 pair。

斜軸 1-bend 數學上 cost 較低，可能讓 A* 選不對稱進入。**副作用由維度 5 + 6 受控**：
- 同 target 多 incoming 由 COHERENCE_PENALTY 強制收斂同 entry side
- 同 source 多 outgoing 同理收斂同 exit side
- 反向 port 使用由 PORT_VIOLATION_PENALTY 屠殺

未開斜軸的逆向 6 種：等實際遇到「強制走某 side 繞」的視覺需求再開。

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

### 6.5 已知 gap

- **Gateway 類型偏好**（parallel 應偏好 bottom 出）：可加新 candidate generator
- **斜軸逆向 6 種**：v1.7 只開順向 2 個 / 對角象限。逆向繞遠的 6 種等實際需求再開
- **Drag preview 跟 A* final 不一致**（spec §9 / handoff §6.5）：useDragEndpoint 加 throttle 跑 A*
- **同 row adjacent 跨元件視覺辨識度**：v1.14 已解「跨多 col」+「backward」走 T→T/B→B，但**相鄰 col（|dx| ≤ 288px）forward 仍走 R→L**。若使用者抱怨「兩格相鄰也想走 corridor」可調 `ADJACENT_DX_LIMIT` 至 0
- **Tier-2 fallback 觸發頻率**：v1.17 R→L Tier-2 在飽和情境才用。若實測發現過度頻繁觸發 → 表示視覺退化 → 應檢視 layout 結構（拆 lane / 重組 task 順序）而非調整 tier 系統

這些都是擴 cost 維度 / 候選 generator 適用範圍，不是寫 if-then 業務規則分支（依 task.type / gatewayType 等 attribute）。

### 6.6 Tier 系統與 pickBestPath 3-pass (v1.17)

candidate 可標 `tier: 2` 識別 Tier-2 fallback。`pickBestPath` 3-pass:

```js
let bestT1Clean = null, bestT2Clean = null, bestAnyDirty = null;
for (const sides of candidates):
  const result = computePath(...)
  const portPenalty = ...
  const cohPenalty = ...
  const baseCost = result.cost + cohPenalty  // 不含 port violation
  if (portPenalty === 0):
    if (sides.tier === 2): bestT2Clean = pickLower(bestT2Clean, ...)
    else                 : bestT1Clean = pickLower(bestT1Clean, ...)
  else:
    bestAnyDirty = pickLower(bestAnyDirty, ...)
return bestT1Clean ?? bestT2Clean ?? bestAnyDirty
```

**永續性原則**：rule 1 hard preference > 視覺首選 > violation。當 Tier-1 全違規 → 退到 Tier-2 (視覺退化但 rule 1 安全)；Tier-2 也全違規才 fallback 違規版。

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
| `TURN_PENALTY_BASE` | `astar.js` | 15 | 第 1-2 turn (v1.10 S15 累進 base, 第 3+ turn 升到 25/30) |
| `PROXIMITY_BONUS` | `astar.js` | 4 | 障礙物距離 ≥ 此值時無 penalty |
| `CENTER_WEIGHT` | `astar.js` | 1.5 | Turn cell 離 path 中點越遠加 cost |
| `CENTER_SKIP_RADIUS_MIN` | `astar.js` | 4 | 短 path 的 SKIP_RADIUS 下限 (v1.8 動態) |
| `CENTER_SKIP_RADIUS_MAX` | `astar.js` | 10 | 長 path 的 SKIP_RADIUS 上限 (v1.8 動態, skipRadius = clamp(pathLen/4)) |
| `OCCUPY_SAME_DIR` | `grid.js` | 80 | 同向重疊扣分 |
| `OCCUPY_PERP` | `grid.js` | 8 | 垂直交叉扣分 |
| `SHARE_RADIUS_SOURCE` | `grid.js` | 2 | 同 source fork: 圓形 trunk share-free 範圍 (v1.3, v1.11 S20 拆對稱) |
| `SHARE_RADIUS_TARGET` | `grid.js` | 5 | 同 target merge: 圓形 tail share-free 範圍 (v1.11 S20) |
| `SHARE_PENALTY` | `grid.js` | 3 | 偏離 port 軸 + 圓外的同 source/target cell cost |
| **S22 軸延伸**（target） | `grid.js` | flag | entrySide ∈ {top,bottom} → x=goalCell.x 整條軸 share-free；{left,right} → y=goalCell.y。解進 port 前 1-grid 階梯 (v1.12) |
| **S23 軸延伸**（source） | `grid.js` | flag | exitSide ∈ {top,bottom} → x=startCell.x 整條軸 share-free；{left,right} → y=startCell.y。解出發後 1-grid 階梯 (v1.12) |
| `ENDPOINT_BONUS` | `astar.js` | 6 | end-zone (3-5 cells from endpoint) proximity 推開門檻 (v1.11 S4) |
| `ENDPOINT_RADIUS` | `astar.js` | 5 | end-zone 範圍 (v1.11 S4) |
| `PORT_VIOLATION_PENALTY` | `grid.js` | 500 | 同 port 反向使用（規則 1 違規）的 cost penalty (v1.5) |
| `COHERENCE_PENALTY` | `grid.js` | 12 | base penalty (v1.6) ; v1.10 S16 動態 factor = 2*(1-strength)，壓倒性 anchor 不罰、邊際 anchor 全罰 |
| `PROXIMITY_STUB_RADIUS` | `astar.js` | 2 | 距 start/goal ≤ 此值的 cells skip proximity (v1.9 S8, alignPortSegments 已強制 stub 沿軸方向，無需 push) |
| `ANCHOR_MAJORITY` | `router.js` | > 0.5 | predictAnchors 嚴格 majority 才設 anchor (v1.9 S6, 票數分散時不預測回退 first-wins) |
| **`STRAIGHT_REBATE_THRESHOLD`** | `astar.js` | 3 (v1.19 M1) | 連續同方向 cells ≥ 此值才啟動 rebate (短直線不獎勵, 避免過 greedy) |
| **`STRAIGHT_REBATE`** | `astar.js` | 0.5 (v1.19 M1) | 直走 cell 在 runLength ≥ THRESHOLD 時 base cost (vs default 1.0) |
| **`BOUNDARY_LANE_MULTIPLIER`** | `layout-astar.js` | 3 (v1.19, was 2 in v1.16) | lane 0 / 末端 lane 擴張倍數，補 header/footer buffer + 容多 trunks |
| ~~`BEND_ENDPOINT_RADIUS` / `BEND_ENDPOINT_PENALTY`~~ | (已移除 v1.14) | — | v1.13 dim 7 已回退，詳 §3.7.1 |
| **`ADJACENT_DX_LIMIT`** | `pickPath.js` | 288px (≈1.5×COL_W) | 同 row 跨 col 是否算「相鄰」的閾值（v1.14）。≤ 此值仍走 R→L 主候選；> 此值或 backward 強制 T→T / B→B（candidate set 層解視覺辨識度，避免 cost dim 污染）|
| **`STUB_LENGTH`** | `pickPath.js` | 3 cells | v1.15 startCell/goalCell 內縮 K cells，A\* 不搜尋 stub 區（視覺距離 §10.5.1）。短 path (manhattan<6) fallback 降到 max(1, floor(M/3)) |
| **`HALO_RADIUS`** | `grid.js` | 2 cells | v1.15 path cell perpendicular ±N cells 標 halo（視覺距離 §10.5.1）|
| **`HALO_PENALTY_NEAR / FAR`** | `grid.js` | 30 / 10 | v1.15 halo cell 異 source/target same/opposite dir 的遞減 penalty |
| **`BASE_CORRIDOR_CAPACITY`** | `layout-astar.js` | 1 (v1.15) | 預設 lane corridor 容量（v1.15 從 4→1 更敏感擴張，配合 fork trunk 識別）|
| **`P_SAME_SOURCE_FORK`** | `layout-astar.js` | 1.0 | v1.15 同 source N+ fork 每條 100% 佔 corridor 機率 |
| **`FORK_THRESHOLD`** | `layout-astar.js` | 2 | v1.15 outDegree ≥ 此值才算 fork（1 outgoing 不算）|
| **`LANE_GROWTH_STEP`** | `layout-astar.js` | `2 * GRID_CELL = 16` | 每多 1 row 流量擴 16px (保 grid 對齊) |
| **`MAX_LANE_H`** | `layout-astar.js` | `30 * GRID_CELL = 240` | lane 高度上限（極端應拆 lane 解）|
| **`P_BACKWARD`** / `P_GAP_FORWARD` / `P_ADJACENT` / `P_CROSS_LANE` | `layout-astar.js` | 1.0 / 0.5 / 0.0 / 0.15 | corridor 機率啟發式（v1.13）|
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
| ~~Lane 動態高度~~ | **v1.13 已解（啟發式）** — 詳 §4.5。極端流程仍可能高估/低估，靠調參數或加最小 line spacing 維度 | — |
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

### 10.5 職責分層（v1.14 立，永續性核心）

**設計反思**：v1.13 S24 (dim 7 bend endpoint clearance) 解一個 corner case 反而誘導 A* 找 3-turn 替代路徑（cost N+49 < 被罰的 2-turn N+52），引入新 bug。教訓：**不是所有視覺偏好都該編進 cost function**。每加一維 cost → A* 為避它找替代 → 引入新 corner case → 再加新維度 → 無限循環。

新需求進來，**先**判斷屬下表哪一層，**不混用**：

| 視覺偏好類型 | 適合工具 | 例子 |
|---|---|---|
| 線形狀（彎多寡、貼邊、繞行） | cost dim per-cell | turn (dim 0) / proximity (dim 1) / center bias (dim 4) |
| Edge 間互動（重疊、收斂） | cost dim per-cell + multi-pass | occupy (dim 2) / coherence (dim 6) |
| 業務規則違規 | cost dim 大 penalty | port reservation (dim 5) |
| **某類 edge 應該走某類 port 組合** | **candidate set design** | **同 row 跨多 col → 強制 T→T/B→B (v1.14)** |
| **視覺距離（軟障礙推開）** | **§10.5.1 unified framework** | **dim 1 / dim 2 halo / STUB_LENGTH / lane 啟發式 (v1.15)** |
| 空間配置（lane 大小、task 位置）| layout pre-pass | 動態 lane 高度 (v1.13b + v1.15 fine-tune) |

**跨層 over-fit = 反 pattern**。如：
- ❌ 用 cost dim 解「某類 edge 應走某類 port」→ A* 會找替代路徑繞過 penalty（v1.13 S24 的失敗）
- ❌ 用 candidate set 解「線太彎」→ candidate 是離散選擇，無法表達連續優化
- ❌ 用 layout 解「動態避開既有 path」→ multi-pass 期間 layout 已 frozen

**判斷流程**（接 §10.1 修改前必做）：
1. 先讀 §10.5 表，找新需求屬哪一層
2. 該層內找對應工具（既有 dim / 既有 candidate logic / 既有 layout pre-pass）
3. 沒對應工具才考慮新增 — 仍在同層內擴展，不跨層
4. **絕對不**因為一個工具好用就強塞到別層需求上
5. **加新 cost dim 前先判斷粒度**（v1.13 S24 教訓的精確版）：
   - **Per-cell** (連續搜索空間) 的局部 penalty 危險 — A\* 會在 cell-level 找替代繞過（如 v1.13 S24 加 1 個 turn 避罰區）
   - **Per-candidate** (離散選擇) 的 flat penalty 安全 — A\* 沒「同 candidate 內部 hack」可走，只能換 candidate（如 v1.18 A1 stability）

### 10.5.1 視覺距離 Unified Framework (v1.15 立)

**設計觀察**：v1.0-v1.14 對「視覺間距」這個概念**處理不對稱**：

```
   軟障礙類型           | 處理工具                | 推開半徑
─────────────────────────┼─────────────────────────┼────────
   Task 邊緣 (blocked)   | dim 1 distance map     | 4 cells (PROXIMITY_BONUS) ✓
   Routed path cells     | dim 2 occupy           | 0 cell  (只罰自己) ❌ 不對稱
   Port 軸 (stub 區)     | dim 1/4 在 d≤2 全 skip  | 0 cell  (黑洞) ❌ 盲區
   Lane 邊界             | 固定 BASE_LANE_H       | 動態擴 (v1.13b) ✓
```

使用者持續抱怨的「線跟線擠 / 線跟元件擠 / stub 太短 / fork trunk 擠 label 蓋」**6 個情境都歸結到這個結構性遺漏**。

v1.13 S24 嘗試用 cost dim 補 stub 黑洞 → 失敗（cost penalty 太局部誘導 A\* 替代）。**正確補法是把「視覺距離」當作 unified concept，依不同障礙類型用不同工具**：

| 軟障礙 | v1.15 工具 | 位置 | 數值 |
|---|---|---|---|
| Task 邊緣 | dim 1 distance map (既有) | astar.js + grid.proximityDist | PROXIMITY_BONUS=4 |
| Routed path | **dim 2 halo (v1.15 新)** | grid.markHalo + getOccupyPenalty halo branch | HALO_RADIUS=2, HALO_PENALTY=[30,10] |
| Port 軸 stub | **STUB_LENGTH (v1.15 新, search-space)** | pickPath.js::computePath startCell/goalCell 內縮 | STUB_LENGTH=3, fallback when pathLen<6 |
| Lane 邊界（內部）| 動態 lane 高度 (v1.13b + v1.15 + v1.16 fix) | layout-astar.js | BASE_CAP=1, STEP=16 (v1.16 修 grid bug), P_SAME_SOURCE_FORK=1.0 |
| **Lane 邊界（sticky header / padding）v1.16** | markBoundaries buffer + boundary lane multiplier | grid.js + layout-astar.js | HEADER_BUFFER_CELLS=2, FOOTER_BUFFER_CELLS=2, BOUNDARY_LANE_MULTIPLIER=2 |
| **Halo same-source/target spread v1.16** | dim 2 halo 低 penalty | grid.js | HALO_PENALTY_SAME_NEAR=5, HALO_PENALTY_SAME_FAR=2 |

**Framework 原則**：
1. 新「視覺距離」需求**先在此框架內**找對應工具
2. 不開新 cost dim（v1.13 S24 教訓）
3. 工具間參數可獨立 fine-tune，不互相干擾
4. Halo 用 perpendicular ±radius 標記、share-free 邏輯（同 source/target 不罰）
5. STUB_LENGTH 用 hard 內縮 startCell/goalCell（不是 soft cost），避免 A\* 找替代

**未來「距離不夠」類需求都按本框架調參數**：
- 線跟線太近 → 調 HALO_RADIUS / HALO_PENALTY / HALO_PENALTY_SAME (v1.16)
- 線跟 task 太近 → 調 PROXIMITY_BONUS / ENDPOINT_BONUS
- 線跟 port 太近 → 調 STUB_LENGTH
- 多 trunk 擠 lane → 調 BASE_CORRIDOR_CAPACITY / LANE_GROWTH_STEP / P_SAME_SOURCE_FORK
- 線跟 sticky header / padding 重疊 → 調 HEADER_BUFFER_CELLS / FOOTER_BUFFER_CELLS / BOUNDARY_LANE_MULTIPLIER (v1.16)

### 10.5.2 User Override Stability — A1 Stability Dim 7 (v1.18 重設計)

**設計觀察**：A\* 是 stateless across edits — 每次 layout 都從零跑 multi-pass。當使用者加新 edge 或拖既有 edge 時，所有共用 endpoint 的其他 edges 的 routing 上下文都會變（predictAnchors / reservePort / coherence anchor / halo 占用），導致這些 edges 視覺也跟著動。

**v1.16 sibling pin (失敗的設計)**：useDragEndpoint::endDrag 寫 full override 給 sibling 強制 stale sides。**問題**：跟 v1.16 rule 1 hard preference 衝突 — 新 edge 加入時 sibling 被 pin 在 stale，A\* 為避新違規重路由其他 edges，視覺更糟（問題 3.2/3.3）。

**v1.18 A1 stability dim (新設計)**：把「視覺穩定性」做進 A\* cost function 而非 UI pin。

`pickPath.js::pickBestPath` 新加 `prior` 參數 + `STABILITY_PENALTY=20`：
```js
const stabilityCost = (sides) =>
  prior && (sides.exit !== prior.exit || sides.entry !== prior.entry)
    ? STABILITY_PENALTY : 0;
const baseCost = result.cost + cohPenalty + stabilityCost(sides);
```

`routeAll.js` 接 `priorEdges` Map (edgeKey → {exit, entry})，查每 edge prior 傳給 pickBestPath。

`layout-astar.js` 維 `priorByFlowId` module-level Map (flowKey → priorEdges)，每次 doLayout 後 snapshot 結果，下次同 flow 用。

**vs v1.16 sibling pin 優點**：
- **per-candidate level (離散)** 不是 per-cell — 不犯 v1.13 S24 cell-level 教訓（A\* 無「繞過 penalty 但仍同 candidate」可能）
- **soft (20) << portPenalty (500)** — rule 1 hard preference 永遠優先，飽和情境 A\* 仍找 clean
- **跟 Tier 系統相容**：T1 clean stab=0 > T1 clean stab=20 > T2 clean stab=0 ...
- **不會「黏」**：純 router internal，不寫 user-visible override，sibling 不顯示「已編輯」橘點

**未來「拖一邊另一邊也動」類需求**：調 `STABILITY_PENALTY` 數值（20 太小→ sibling 仍跑；太大→ 過度黏阻止合理 re-route）。**不再加新 cost dim 或新 UI pin**。

### 10.5.4 Dim 力場互動表 (v1.19 立, 永續維運)

**動機**：v1.x 累積多個 cost dim / 機制，cumulative effect 在某些 cell 互相干擾產生不直觀 path (如情境 1, 3 zigzag)。加新 dim 前先 review 此表，預測會在哪類 cell 累加、跟既有 dim 同向 / 反向 / 干擾。

| Cell 類型 | dim 0 turn | dim 1 prox | dim 2 occupy | dim 2 halo | dim 4 center | STUB_LENGTH | dim 7 stab | M1 rebate (v1.19) |
|---|---|---|---|---|---|---|---|---|
| Stub cell (≤2 from port) | n/a | skip | skip (start/goal) | 視 src/tgt | skip(< radius) | hard 起終段 | flat | runLength≥3 才 rebate (stub 通常 < 3) |
| 中段直走 cell | 0 (no turn) | 推離 task (0-4) | spread 或 share | 推離 prior (0-30) | 拉中點 (0-15) | n/a | flat | **rebate 0.5** ✓ |
| Turn cell (中段) | 15-30 | 推離 task | spread/share | 推離 prior | 拉中點 | n/a | flat | runLength 重置→無 rebate |
| 軸延伸 cell (S22/S23) | n/a | 推離 task | share-free 0 | 不影響 (halo perp) | n/a | n/a | flat | 視走法 |
| Endpoint-zone (3-5 from port, v1.11 S4) | n/a | bonus 6 推更強 | n/a | n/a | n/a | n/a | flat | 視走法 |

**判斷新 dim 是否安全**：
- 在某 cell 類型跟現有 dim **同向** → 補強既有 (低風險, OK if 效果不夠)
- **反向** → 互相抵消 (慎重評估數值, 別 cancel out)
- **干擾** (一個推一個拉) → cumulative 產生 unintended path 形狀 (避免, 或重新分區)

**加 dim 前必確認的問題**：
1. 此 dim 是 per-cell 還是 per-candidate? (per-cell 連續空間危險 → v1.13 S24 教訓)
2. 是 penalty 還是 rebate? (penalty 危險可能被 A* 繞過, rebate 安全直接鼓勵)
3. 在哪類 cell 生效? (跟既有 dim 力場是否衝突)
4. 數值跟既有 dim 的相對大小? (避免主導或被淹沒)

### 10.5.3 Drag deadband (v1.18 立)

`useDragEndpoint::endDrag` 加 MIN_DRAG_DELTA=8px (1 grid cell) — cursor 移動距離 < MIN_DRAG_DELTA 且未拖到不同 task 時，視為「沒拖」，不寫 override 也不觸發 sibling effect。解問題 3.1 「拖了沒動 sibling 出現已編輯橘點」。

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
| Gateway parallel fork（多條 outgoing）| **v1.12 S23**：fork 邊整齊堆疊 source 軸 trunk，到該轉處才分叉 — 不可出現「出發後 1-grid 階梯」|
| Gateway exclusive fork | 同上 |
| Merge（多 incoming 進同 target）| **v1.12 S22**：incoming 邊整齊收斂到 target 軸 tail，共用箭頭位置 — 不可出現「進 port 前 1-grid 階梯」|
| 兩條獨立 path 交叉 | 允許交叉（penalty 低）|
| 兩條平行 path 重疊（異 source/target）| 自動分開到不同 row/col |
| **同 row backward edge (任意 col 差)** | **v1.14 candidate 改寫**：強制 T→T / B→B 走 corridor，不再走 R→L 短直線；配合動態 lane 高度有寬度 spread，stub 自然不擠 |
| **同 row forward edge 跨多 col (\|dx\| > 288px)** | **v1.14 candidate 改寫**：強制 T→T / B→B 走 corridor，避免 R→L 線被夾在 task 之間視覺辨識度低 |
| **同 row forward edge adjacent (\|dx\| ≤ 288px)** | 維持 R→L 直線（autoPickSides）— 相鄰 task 無視覺辨識度問題 |
| **大流程多 backward (6+) 同 lane** | **v1.13 lane 動態高度 + v1.15 fine-tune**：lane 自動從 144px 擴到 240px，多 backward 分散不互蓋 label |
| **純直連 lane (無 backward / fork)** | **v1.13 lane 動態高度**：load=0 不擴，維持 144px 不浪費版面 |
| **v1.15 兩個 cross path 緊鄰**（左上→右下 + 左下→右上 同 col 共用 vertical 段）| **OCCUPY halo radius=2**：後 route path 偏 2-3 cells (HALO_PENALTY=30/10) 視覺清楚分離，不再 1 grid 緊貼 |
| **v1.15 同 source 多 fork trunk (4+ 條 corridor)**| **lane 動態高度 fine-tune** (BASE_CAP=1, STEP=24, P_SAME_SOURCE_FORK=1.0)：lane 自動擴張 + trunk 間 halo spread，label 不互蓋 |
| **v1.15 任何 edge 進 port stub**| **STUB_LENGTH=3**：箭頭至少距元件邊框 3 cells (24px)，不重疊；短 path fallback (manhattan<6) 降到 max(1, floor(M/3)) |
| **v1.17 飽和情境 4+ edges 同 task port** | **Tier-2 R→L fallback**：當所有 T→T/B→B candidates 違規時，A* 選 R→L (Tier-2) 視覺退化但 rule 1 安全；非飽和情境仍 T→T/B→B (Tier-1) 不退化 |

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
| 2026-05-13 | v1.1 | 加 cost 維度 4: **Center Bias**（解 bend 不對稱）+ Port 選擇改 **Multi-port Trial**（解該用 top/top 或 bottom/bottom 而非 right/left）| 21237a2 |
| 2026-05-13 | v1.2 | (a) `TURN_PENALTY` 10→15（防 proximity-driven zigzag）(b) Same-target OCCUPY 0→3（merge spread）(c) Center bias 加 `CENTER_SKIP_RADIUS=4`（stub turn 不誤罰）(d) `markPathOccupied` 修 bug：展開每個 cell（之前 cleanOrtho 後只標 bend point 導致 multi-pass 看不到水平/垂直段）| 9257bb1 |
| 2026-05-13 | v1.3 | (a) **Distance-aware OCCUPY**：同 source/target 從「全程同 penalty」改為「距離 port ≤ SHARE_RADIUS(2) 免費，遠離則 SHARE_PENALTY(3)」→ trunk/tail 共享同 port、中段 spread 開（解 fork labels 重疊 + merge 提早合流）(b) **Partial override 候選收斂**：使用者只拖 exit (或 entry) 時，只生 1 個幾何自然候選（垂直 exit → 水平 entry 依 target.cx 決定），不再 multi-trial 試錯 | 02f7cb9 |
| 2026-05-16 | v1.4 | **9 象限候選表**：`generateCandidates` 從「同 lane 加 T→T/B→B、跨 lane 加 S-shape」擴成 9 象限完整表。對角象限新增 T→T + B→B 候選（解圖一 task→end event 不必要彎折）。同 col 跨 row 新增 L→L + R→R 候選。**斜軸 pair 暫不開**（待 R3 coherence 維度落地）。Per-edge A* runs 從 1-3 升到 3-4，效能 +50%（30 tasks 約 180-450ms）。 | f7b5f40 |
| 2026-05-16 | v1.5 | **維度 5 Port Reservation**：grid 加 `portReservations` map 記錄每 task 每 port 的 IN/OUT 使用計數，`pickBestPath` 評估每個 candidate 時加 `PORT_VIOLATION_PENALTY(500)` if 反向已被用。解 business-spec §5 規則 1「同 port 不可混 IN+OUT」。同 port 多 IN（merge）/ 多 OUT（fork）仍允許。 | 6ec6346 |
| 2026-05-16 | v1.6 | **維度 6 Coherence**：grid 加 `coherence` map (first-wins anchor)，`reservePort` 順便鎖 anchor side。`pickBestPath` 加 `COHERENCE_PENALTY(20)` if 後續 edge 選不一致 side。解多 incoming 進同 target / 多 outgoing 出同 source 視覺一致性。 | 6feacf9 |
| 2026-05-16 | v1.7 | **斜軸 pair 開放**：對角象限每個加 2 個自然順向斜軸 pair (R→T, B→L 等)，A* 比 cost。1-bend 屠殺同軸 2-bend → 暢通對角邊更短。副作用由維度 5 (PORT_VIOLATION) + 6 (COHERENCE) 受控。每 edge A* runs 3-4 → 3-6，效能 +50% (30 tasks 約 270-540ms)。 | caa9b37 |
| 2026-05-17 | v1.8 | **Phase A 三合一**：(a) S1 Anchor by Geometry pre-compute — routeAll 開頭預測每 task 的 in/out anchor side (多數投票)，coherence 跟 multi-pass 順序解耦，編輯一條 edge 不再打亂其他 edge 視覺 (解圖二跳變)。(b) S2 Sort 結構性穩定化 — sort key 加 sourceId/targetId 字典序 tie-break，同 layout 永遠跑出同 result。(c) S3 Center Bias 動態 SKIP_RADIUS — CENTER_SKIP_RADIUS 從固定 4 改成 clamp(pathLen/4, [4, 10])，長 path 的 1-bend corner bend 不被誤罰 (解圖一 5-1-4-3/5-1-4-6 → 5-1-4-10 多餘彎折)，2-bend U/S 仍保留 bend 拉中點。 | ddc475e |
| 2026-05-17 | v1.9 | **Phase A.1 三合一精修**：(a) S6 Anchor majority threshold + COHERENCE 弱化 — predictAnchors 加嚴格 majority(>50%) 才設 anchor (票數分散回退 first-wins)，COHERENCE_PENALTY 20→12，避免錯誤 anchor 強迫自然 1-bend 路徑繞行 (解 5-1-4-5/6 多彎、包容閘道→5-1-4-5 R→L 繞遠)。(b) S7 拖曳 pin 對側 — useDragEndpoint::endDrag 把 partial override 改 full (pin 對側為當前 route 結果)，拖一端不影響另一端視覺。(c) S8 Proximity stub skip — astar.js 距 start/goal ≤ 2 cells 的 cells skip proximity，alignPortSegments 已強制 stub 沿軸方向，proximity 推開 stub 無視覺好處反而製造出發處小 bend (解 5-1-4-3→5-1-4-10 出發處彎折)。 | 2a44010 |
| 2026-05-17 | v1.10 | **Phase A.2 三合一 cost function 終極收尾**：(a) S15 TURN_PENALTY 累進 — 從固定 15 改成函式 (1st-2nd: 15, 3rd: 25, 4th+: 30)，A* node 維護 turnCount。長 path 的 3-bend 繞行不再「比 2-bend 直達便宜」(根因 A)。(b) S16 動態 COHERENCE_PENALTY — predictAnchors 投票記錄 strength (bestCount/total)，getCoherenceMismatchPenalty 用 factor=2*(1-strength) 縮放：壓倒性 majority (1.0) → 不罰、邊際 (0.5) → 全罰，解 end event 集中型 anchor 壓倒少數異類 edge (根因 B)。(c) S19 斜軸 pair candidate 關閉 Center Bias — generateCandidates 對 8 種斜軸 pair (R→T 等) 標 isAxisDiagonal: true，findPath 傳 centerBiasEnabled=false。斜軸 1-bend 的 corner bend 不再被 Center Bias 反向破壞 → A* 自然選 1-bend (根因 C)，full/partial override 斜軸也同樣享受。 | 2a25ad0 |
| 2026-05-17 | v1.11 | **Phase A.3 兩合一精修**：(a) S20 不對稱 SHARE_RADIUS — fork (source) 跟 merge (target) 的 share 範圍分開設常數: SHARE_RADIUS_SOURCE=2 (出來早分叉)、SHARE_RADIUS_TARGET=5 (進去提早合流)。解問題 1：5-1-4-6/5-1-4-7 → 5-1-4-10 同 target 多 incoming 在接近 target 時不再各自轉折，5 cells 內共享 cost 0 自然合流。(b) S4 Endpoint Clearance — Proximity 加三段邊界：STUB (≤2) cost=0、END-ZONE (3-5) bonus=6 加強推開、中段 (6+) bonus=4 標準。解問題 2：backward edge 進入 target 時箭頭不再被擠在邊角，end-zone 範圍 cells 距 task 邊框 ≥ 6 才不罰。 | 1e72aa9 |
| 2026-05-18 | v1.12 | **Phase B 雙軸延伸 share-free**：(a) S22 target 軸延伸 — 同 target cell 位於 entry port 進入軸 (perpDist=0) 不限距離 share-free。解「進 port 前 1-grid 階梯」：多 incoming 邊提早收斂到 port 軸，最後一段乾淨直達，共用箭頭位置。傳遞鏈：pickPath → findPath opts.entrySide → grid.getOccupyPenalty。(b) S23 source 軸延伸（對稱 S22）— 同 source cell 位於 exit port 出發軸 (perpDist=0) 不限距離 share-free。解「出發後 1-grid 階梯」：fork 邊堆疊在 source 軸 trunk，到該轉才分叉。Trade-off：fork trunk 上 label 可能重疊，「整齊出發」視覺優先。getOccupyPenalty 加 entrySide/exitSide 參數，astar.js findPath opts 對應加。 | 154a7ef + 768aa85 |
| 2026-05-18 | v1.13 | **Phase C 兩合一精修**：(a) **S24 維度 7 Bend Endpoint Clearance** — astar.js 加 `BEND_ENDPOINT_PENALTY(20)`，turn cell 在距 endpoint < 3 cells 時付。解短 backward edge B→B candidate 的 bend 落 d=1 處 → 進閘道 stub 被擠 → 箭頭跟元件邊框重疊。對症（只罰 turn cell，stub 直走不變）。spec §6.1 已解。(b) **動態 lane 高度** — layout-astar.js Phase 2 加啟發式：對每條 raw edge 預判 corridor 機率（backward 1.0 / gap forward 0.5 / adjacent 0 / cross-lane 0.15），累加到 lane row。超出預設 4 row 容量時，每多 1 row 流量擴 `2*GRID_CELL=16px`，上限 240px。LPMC 大流程 lane 從 144→192px 後 6 條 backward 分散不擠；純直連 lane 維持 144px 不浪費。 | 0de9d36 |
| 2026-05-18 | v1.14 | **Phase D 永續性重構**：(a) **回退 v1.13 S24 dim 7** — 實測發現 penalty=20 在 endpoint <3 處反向誘導 A* 找 3-turn 替代路徑（cost N+49 < 被罰的 2-turn N+52），引入新 bug（短 path 進 endpoint 多 1 個小彎）。cost function 回 6 維。教訓：cost dim 罰得太局部會讓 A* 找替代繞過 penalty。(b) **candidate generation 重劃** — 同 row 跨 col 分 adjacent / non-adjacent：`|dx| ≤ ADJACENT_DX_LIMIT(288, 1.5×COL_W)` 仍走 R→L 主候選；`|dx| > 288` (gap forward) 或 backward 強制 T→T / B→B 走 corridor，解觀察 2「R→L 短直線視覺辨識度低」+ 順便解 Issue 1 根因「短 backward stub 擠」。屬 candidate set 職責，不污染 cost function。(c) **新增 §10.5 職責分層** — 永續性核心：新需求先判斷屬 cost dim / candidate set / multi-pass / layout 哪層，不跨層 over-fit。修法決策樹第 0 步前置此判斷。(d) **保留 v1.13b 動態 lane 高度** — 跟 candidate 重劃互補，T→T/B→B 走 corridor 更需要 lane 寬度。 | d339715 |
| 2026-05-18 | v1.15 | **Phase E 視覺距離 unified framework**：補上 v1.0-v1.14 對「視覺間距」處理的結構不對稱（dim 1 對 task 邊距推 4 cells、dim 2 對 path 邊距 0 cells、stub 區 dim 全 skip 黑洞）。三個獨立工具同框架 (§10.5.1)：(a) **OCCUPY halo radius=2** — `grid.js` markHalo + getOccupyPenalty halo branch：path cell perpendicular ±2 cells 標 halo，異 source/target same/opposite dir 付 30/10 penalty。解情境 1/3「cross path 緊鄰 + fork trunk 擠」。same source/target halo 不罰（share-free 不退化）。(b) **STUB_LENGTH=3** — `router/pickPath.js::computePath` startCell/goalCell 內縮 K cells，A\* 不搜尋 stub 區。Hard 內縮非 soft penalty 避免 v1.13 S24 重蹈覆轍。短 path fallback (manhattan<6) 降到 max(1, floor(M/3))。解情境 2「stub 1 grid 進 port、箭頭重疊邊框」。(c) **lane 啟發式 fine-tune** — `layout-astar.js`：BASE_CAP 4→1（更敏感擴張）+ STEP 16→24（trunk + label 上下空間）+ 新加 P_SAME_SOURCE_FORK=1.0 識別同 source N+ fork pattern。解情境 3「4 fork trunk 擠 + label 蓋」(原 v1.13b load=2 不擴 → 現在 load=4 擴到 240px)。永續性檢查 ✓ 不違反紅線、不加新 cost dim、3 個工具獨立可調。 | 0c977d8 path... |
| 2026-05-18 | v1.16 | **Phase F 6 合一補齊**：解情境 4 (header 重疊) + 問題 1 (拖一邊另一邊動) + 問題 2 (rule 1 violation) + v1.15 grid alignment bug fix：(a) **bug fix: LANE_GROWTH_STEP 24→16** — v1.15 設成 3*GRID_CELL=24 破壞 NODE_VOFFSET=LANE_H/2 對齊紅線，回 2*GRID_CELL=16。(b) **§10.5.1 第 4 種距離: lane 邊界 (header/padding buffer)** — `grid.js::markBoundaries` 加 HEADER_BUFFER_CELLS=2 + FOOTER_BUFFER_CELLS=2，path 不能走在距 title bar / padding < 2 cells，label 不溢出邊界。(c) **Boundary lane multiplier** — `layout-astar.js`：lane 0 / 末端 lane 用 BOUNDARY_LANE_MULTIPLIER=2 額外擴張，補回 buffer 占用 + 提供 top/bottom corridor。(d) **Same-source halo 低 penalty** — `grid.js`：HALO_PENALTY_SAME_NEAR=5, HALO_PENALTY_SAME_FAR=2 (vs 異 src/tgt 30/10)，fork trunks 自然 spread 2+ cells 而非 1 grid 緊貼。Share-free 軸延伸 (S22/S23) 邏輯保留（主路徑分支處理，halo 分支不影響）。(e) **§10.5.2 User Override Stability** — `useDragEndpoint::endDrag` 加 `pinSiblings()`：拖 target/source 時 pin 共用 endpoint 的其他 edges 為當前 sides，避免 A* multi-pass 重 route 影響 sibling。解問題 1。(f) **Rule 1 hard preference** — `router/pickPath.js::pickBestPath` 改 2-pass：先在無 PORT_VIOLATION candidates 中挑最低，找不到才退回違規版。Rule 1 升為 hard preference 而非 soft penalty。解問題 2。 | 0c977d8...366de99 |
| 2026-05-18 | v1.17 | **Tier-2 candidate fallback**：解 v1.16 hard preference 在飽和情境（4+ edges 同 task 所有 Tier-1 candidates 都違規）退回 lowest violation 的 gap。`generateCandidates` 對 sameRow gap 加 Tier-2 R→L (dx>0) / L→R (dx<0) — 視覺次優但 rule 1 安全。`pickBestPath` 升級成 3-pass：T1 clean → T2 clean → any dirty。 | 7b0f42f |
| 2026-05-18 | v1.18 | **Phase G 5 合一補齊**：(a) **R1 Tier-3 lazy fallback** — `pickPath.js` 4-pass 加 T3 lazy 階段，T1+T2 全 dirty 時生全 16 port pair 找 clean (跨類別飽和救援)。(b) **R2 violation/fallback fix** — `violations.js` Rule 2 改 pathSegmentsCrossRect 支援 skip first/last segment，detect 「path 繞回 source/target」；`fallbackOrthoPath` 沿 exit 方向先走 1 cell。(c) **R3 drag deadband** — `useDragEndpoint::endDrag` MIN_DRAG_DELTA=8px 過濾微小拖曳。(d) **R4 revert v1.16 sibling pin** — 移除 pinSiblings (跟 rule 1 hard pref 衝突)。(e) **A1 stability dim 7 §10.5.2** — `pickPath.js` STABILITY_PENALTY=20 per-candidate (離散層級不犯 v1.13 S24 cell-level 教訓), `layout-astar.js` 維 priorByFlowId Map snapshot；soft preference < portPenalty(500) 保 rule 1 hard。 | a985199 |
| 2026-05-18 | v1.19 | **Phase H 4 合一 — 解情境 1/3 zigzag + 永續維運基建**：(a) **M1 直線優先 rebate** — `astar.js` A* node 加 runLength, 連續直走 ≥3 cells 時 base cost 1→0.5。鼓勵 path 集中 turn 在少數位置而非中段 zigzag。Rebate 不犯 v1.13 S24 教訓 (rebate 安全：A* 想拿必須直走, 沒繞過可能)。解情境 1 (5-7-2 → 5-7-2-6 階梯) + 情境 3 (5-7-2 → 左上閘道多餘 turn)。(b) **M5 lane 容量加碼** — `layout-astar.js` BOUNDARY_LANE_MULTIPLIER 2→3, lane 0 / 末端 lane 擴張更激進 (容 4+ trunks)。解情境 4 (閘道 4 ports 滿載 + user T→T 紅燈)。(c) **P1 regression smoke** — `scripts/astar-smoke.mjs` 把報過的 case 寫成 fixture, 每次改 dim 前後手動跑驗證形狀屬性 (turns 數 / lane heights / grid 對齊)。5 fixtures 全 pass。(d) **P2 §10.5.4 Dim 力場互動表** — 文件化每 dim 在不同 cell 類型的拉/推方向, 加新 dim 前 review 預測 cumulative effect。 | (本 PR) |

未來每次 cost function / grid / multi-pass / candidate set / layout 邏輯變更都要在此記錄。

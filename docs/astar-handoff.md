# A* 連線優化 — 進度交接文件

> **此文件為跨對話接手點**。下一個對話開始 A* 連線優化工作前**必讀**這份。
>
> **任務範圍**：只動 A* 連線優化，仍在 `claude/test-link-open-source-kKqHk` 分支的 `/test-astar/` 部署上測試。**未經使用者明確指令不得 merge 回 main**。

---

## 1. 一句話現狀

A* router 已實作 **7 維 cost function (v1.13)**，所有改進記錄在 `docs/astar-routing-spec.md`。**main 完全不動**，只有 `/test-astar/` URL 跑 A*。最近 Phase C 完成「bend endpoint clearance (S24)」+「動態 lane 高度啟發式」，短 backward edge stub 不再擠壓 + 大流程多 backward 同 lane 自動擴張避免 label 互蓋。剩餘 corner case 在 §6。

---

## 2. 工作守則（絕對紅線）

來自 `docs/astar-routing-spec.md` §10：

1. **任何修改前先讀 spec**（`docs/astar-routing-spec.md`），找對應的 cost 維度
2. **永遠不寫 if-then 業務規則分支**（例如不寫 `if (task.type === 'gateway') doSpecialThing()`）
3. **只調 cost 維度權重或加新維度**，新需求對應到「視覺偏好」→ cost
4. **不引入第三方 routing library**（之前砍掉 ELK 了）
5. **不破壞 grid 對齊**（所有 LAYOUT 尺寸都是 GRID_CELL 倍數）
6. **修完後同步更新 spec doc**（特別 §3 維度、§8 參數表、§13 變更歷史）

**「鏡像」紅線**：使用者明確說過「不希望走回 rule-based 但永遠無法窮舉情境」。**禁止寫 case-by-case 規則**。

---

## 3. 系統檔案結構

```
src/diagram/
  layout.js                ← VITE_ROUTER 切換 sync(main) / astar
  layout-astar.js          ← A* router 入口，含 cache + position 算法
  layout/                  ← main 原 rule-based 邏輯（不動，僅 sync mode 用）
  pathfinding/
    grid.js                ← 網格 + distance map + occupy metadata + port reservation + coherence
    astar.js               ← A* 核心 + MinHeap + 6 維 cost function
    router.js              ← Shim re-export (1 行)
    router/                ← v1.9 拆檔
      index.js             ← Public API
      routeAll.js          ← orchestrator
      anchorPredict.js     ← anchor 預測 (S1+S6)
      pickPath.js          ← multi-port trial + candidates
      pathPostProc.js      ← alignment / cleanup / fallback
  constants.js             ← GRID_CELL=8，所有尺寸都從這推導

docs/
  astar-routing-spec.md    ← A* 規格 SOT，每次修都更新
  astar-handoff.md         ← 本檔，跨對話交接點
```

---

## 4. Cost Function 當前狀態（v1.13）

```js
// routeAll 開頭 (v1.8 S1 + v1.10 S16 strength)
predictAnchors(grid, rawConns, positions)
  // 投票 + majority threshold + 記錄 strength (給 dim 6 動態 factor)

// layout-astar.js Phase 2 (v1.13)：依預估 corridor 流量擴 lane 高度
laneHeights[row] = clamp(BASE_LANE_H + overflow * LANE_GROWTH_STEP,
                         BASE_LANE_H(144), MAX_LANE_H(240))
  // overflow = max(0, ⌈corridorLoad⌉ - 4)

// astar.js per-cell cost (v1.13)
cost(cell, dir) =
    1                                                              // 移動
  + (turn ? turnPenalty(turnCount) : 0)                            // dim 0: 累進 turn (v1.10 S15)
  + max(0, PROXIMITY_BONUS(4) - distMap[cell])  if !inStub          // dim 1: 障礙物距離 (v1.9 + v1.11 S4)
  + occupyPenalty(cell, dir, src, tgt,                             // dim 2: 智慧占用
                  start, goal, entrySide, exitSide)                //   (v1.11 S20 不對稱 + v1.12 S22/S23 軸延伸)
  + (isTurn && farFromRadius && centerBiasEnabled                  // dim 4: 中心偏好
       ? centerDist*CENTER_WEIGHT(1.5) : 0)                        //   v1.10 S19: 斜軸 pair 關閉
  + (isTurn && distFromEndpoint < BEND_ENDPOINT_RADIUS(3)          // dim 7: bend endpoint clearance (v1.13 S24)
       ? BEND_ENDPOINT_PENALTY(20) : 0)

// router/pickPath.js::pickBestPath 算完 A* path 後加上：
adjustedCost = A* result.cost
  + getPortConflictPenalty(srcId, exitSide,  'out')                // dim 5: port reservation
  + getPortConflictPenalty(tgtId, entrySide, 'in')
  + getCoherenceMismatchPenalty(srcId, exitSide,  'out')           // dim 6: coherence (v1.10 動態權重)
  + getCoherenceMismatchPenalty(tgtId, entrySide, 'in')            //   factor = 2*(1-anchorStrength)
```

### 各維度解的問題

| 維度 | 解什麼 | 主要參數 |
|---|---|---|
| 0 Turn (v1.10 累進) | 少 bend，3+ bend 急升 cost | base=15 (1st-2nd), 25 (3rd), 30 (4th+) |
| 1 Proximity (v1.9 stub + v1.11 S4 end-zone) | STUB(≤2)=0, END-ZONE(3-5)=6, 中段(6+)=4 | PROXIMITY_BONUS=4, ENDPOINT_BONUS=6 |
| 2 Smart Occupy (v1.11 S20 + v1.12 S22/S23 軸延伸) | Fork 軸 trunk 整齊出發、Merge 軸 tail 共用箭頭；圓+軸雙重 share-free | SHARE_RADIUS_SOURCE=2, SHARE_RADIUS_TARGET=5, SHARE_PENALTY=3 |
| 4 Center Bias (v1.8 動態 SKIP + v1.10 斜軸關閉) | 2-bend U/S bend 在中點；斜軸 1-bend 不誤罰 | CENTER_WEIGHT=1.5, SKIP=clamp(pathLen/4, [4,10]) |
| 5 Port Reservation (v1.5) | 規則 1 (IN+OUT 不混用) | PORT_VIOLATION_PENALTY=500 |
| 6 Coherence (v1.6 + v1.8 + v1.9 + v1.10 動態權重) | 多 incoming/outgoing 收斂；強 majority 不罰、弱 majority 全罰 | COHERENCE_PENALTY=12, factor=2*(1-strength) |
| **7 Bend Endpoint Clearance (v1.13 S24)** | **turn cell 不貼 endpoint，stub 至少 3 cells 不擠** | **BEND_ENDPOINT_RADIUS=3, BEND_ENDPOINT_PENALTY=20** |

**Layout-level**（不算 cost 維度，但 v1.13 新增）：
- **動態 Lane 高度** (`layout-astar.js`)：對每條 raw edge 預判走 corridor 機率，累加到 lane row。超出 4 row 預設容量時擴張 lane（每 row +16px、上限 240px）。

詳細邏輯見 `docs/astar-routing-spec.md` §3 / §4.5。

---

## 5. 已實作完整覆蓋的情境

✅ 同 lane 相鄰直線（2-bend straight）
✅ 同 lane 中間有障礙 → bottom→bottom 走 corridor（multi-port trial）
✅ 跨 lane 2-bend S-shape（bend 在中點）
✅ **多 fork 從同 source 整齊出發**（v1.12 S23 軸延伸 trunk，無 1-grid 階梯）
✅ **多 merge 進同 target 共用箭頭**（v1.12 S22 軸延伸 tail，無進 port 前 1-grid 階梯）
✅ Drag override（完整 + partial 都尊重，partial 自動配對幾何 entry）
✅ Distance map proximity push 走 corridor 中央 + endpoint clearance 推開（v1.11 S4）
✅ Cell 邊界對齊 grid（所有座標 % 8 = 0）
✅ 結構 hash cache（React 重 render 友善）
✅ 斜軸 1-bend 不被誤罰繞行（v1.10 S19）
✅ 集中型 anchor (5/5 majority) 不壓倒少數異類 edge（v1.10 S16 dynamic coherence）
✅ **短 backward edge B→B candidate 進閘道 stub 不擠**（v1.13 S24 bend endpoint clearance）
✅ **大流程多 backward 同 lane 自動擴張避免 label 互蓋**（v1.13 動態 lane 高度啟發式）

---

## 6. 已知未解 corner cases（接下來工作清單）

### 🟡 中優先級

#### 6.2 Gateway 類型 exit 偏好
parallel gateway 視覺習慣從 bottom 出（往下分叉），exclusive 從 right 出。當前 multi-port trial 不知 gateway 類型偏好。

**修法方向**：cost function 加新維度「source 是 parallel gateway 時，candidate `bottom→top` 給 bonus（負 cost）」。或在 `generateCandidates` 依 source.gatewayType 調權重。

#### 6.3 Backward edge（迴圈返回）視覺
`dx < -30` 的邊（target 在 source 西邊），main 風格走 top 上方繞。

**v1.4 後狀態**：9 象限候選表已加 T→T / B→B 候選，A* 可比 cost 自動選 corridor 繞行。**待實測確認**是否完整解，若仍走 lane 內部則考慮新 cost 維度。

#### 6.4 規則 3「target 欄左→右排 slot」
業務規則：多條 corridor 線按 target col 排序。當前 multi-pass 排序是按 source col 進 → target col 進，路徑形狀由 A* 決定，**順序不保證跟 target col 對齊**。

**修法方向**：corridor cells 加 cost dimension「cell.y 應該 ∝ target.col」。或改 multi-pass 排序。

#### 6.5 Drag preview 用 A*（throttled）
拖曳預覽用簡單 L-shape，跟 final A* 結果不同 → 使用者觀感「拖完後線跳一下」。

**修法方向**：`useDragEndpoint.js::moveDrag` 每 50ms throttle 跑 A* 算 preview。

### 🟢 低優先級

#### 6.6 Lane 動態高度 — **v1.13 已解（啟發式版）**
~~30+ tasks 在同 lane 的大流程，A* 用固定 BASE_LANE_H 可能擁擠。~~

v1.13 已實作「啟發式預估 corridor 流量 + 動態擴 lane 高度」。詳見 spec §4.5。

**目前限制**：機率啟發式可能低估 / 高估，極端流程靠拆 lane / refactor 解。若實測仍擠，下一步可考慮：
- 提高 `P_GAP_FORWARD` (目前 0.5) 或 `P_CROSS_LANE` (目前 0.15)
- 降低 `BASE_CORRIDOR_CAPACITY` (目前 4) 讓 lane 更早擴
- 加新維度「最小 line spacing」強推 spread（避免 A* 在擴張後仍把 path 擠在一起）

#### 6.7 大流程效能
30+ tasks ~150-300ms。當前 hash cache 在「同結構新 flow object」命中，但編輯任意欄位都失效。

**修法方向**：per-edge 結構 hash 細緻快取，邊增量更新。

---

## 7. 目前部署狀態

| URL | 內容 | 狀態 |
|---|---|---|
| `https://cjo4m3c.github.io/FlowSprite/` | main（rule-based）| 永遠不動，由 main 分支 deploy.yml 部署 |
| `https://cjo4m3c.github.io/FlowSprite/test-astar/` | A* POC | 從本分支 `claude/test-link-open-source-kKqHk` 部署，每 push 自動 redeploy |

部署 workflow：`.github/workflows/deploy-test-astar.yml`（build main + astar 一起部署到 GitHub Pages 不同子路徑）。

ELK 系列試驗（test-elk / test-deep-a / test-deep-b）**已全砍**（commit `1ba60a4`）。

---

## 8. 接手流程建議

下一個對話開始時，建議按以下順序：

1. **讀完此檔（astar-handoff.md）**
2. **讀完 `docs/astar-routing-spec.md`**（特別 §3 維度、§10 紅線）
3. 跟使用者確認**要解的具體 corner case**（參考 §6 未解清單）
4. 跑現有 test smoke：
   ```bash
   node --experimental-vm-modules /tmp/test.mjs  # 隨便寫個測試 flow
   ```
   或讓使用者打開 `/test-astar/` 跑特定 flow 看視覺
5. **找對應 cost 維度**或**設計新維度**，先用紙筆計算 cost 期望，**確認方向**才動手
6. 改 cost function 後**跑 smoke 確認**：
   - 既有 case（adjacent same-lane、cross-lane simple）不破壞
   - 目標 case 改善
7. **同步更新 spec doc**（§3 / §8 / §13 至少要動到）
8. Commit + push 到分支，CI 自動部署 `/test-astar/`
9. 跟使用者確認視覺後**才繼續下一輪**

---

## 9. Git 操作備忘

```bash
# 看當前進度
git log --oneline -5

# 同步遠端
git fetch origin claude/test-link-open-source-kKqHk
git reset --hard origin/claude/test-link-open-source-kKqHk

# 改完一輪
git add -A
git commit -m "A* round N: <什麼改善>"
git push origin claude/test-link-open-source-kKqHk

# CI 跑 ~3-5 min，部署到 /test-astar/
```

**永遠不可以**：
- `git push origin main`
- `git checkout main && git merge ...`
- 任何把 A* 內容帶到 main 分支的操作

直到使用者明確說「把 A* merge 進 main」才執行。

---

## 10. 變更紀錄（每輪結尾在這裡加一條）

| 日期 | Commit | 主要改善 | 對應 spec 版本 |
|---|---|---|---|
| 2026-05-08 | 1db2c49 | Initial ELK V1 試驗 | - |
| 2026-05-13 | 1ba60a4 | 砍 ELK + 全網格對齊 + 簡化為 sync vs astar | - |
| 2026-05-13 | ad2b338 | A* round 4: 4-dim cost (turn / proximity / occupy / center) | v1.0 |
| 2026-05-13 | 21237a2 | A* round 5: multi-port trial + center bias | v1.1 |
| 2026-05-13 | 9257bb1 | A* round 6: 修 zigzag bug + markOccupied 展開 | v1.2 |
| 2026-05-13 | 02f7cb9 | A* round 7: distance-aware occupy + partial override 收斂 | v1.3 |
| 2026-05-16 | f7b5f40 | A* round 8: 9 象限候選表（解圖一 task→end event 不必要彎折，圖二 4 條進 end event 部分覆蓋）| v1.4 |
| 2026-05-16 | 6ec6346 | A* round 9: 維度 5 Port Reservation（解 B-7 條件 1 / business-spec §5 規則 1） | v1.5 |
| 2026-05-16 | 6feacf9 | A* round 10: 維度 6 Coherence（多 incoming/outgoing 收斂一致 side） | v1.6 |
| 2026-05-16 | caa9b37 | A* round 11: 斜軸 pair 開放（對角象限每個加 2 個自然順向 1-bend 候選） | v1.7 |
| 2026-05-17 | ddc475e | A* round 12 (Phase A): S1 anchor by geometry + S2 sort 穩定化 + S3 動態 SKIP_RADIUS | v1.8 |
| 2026-05-17 | 2a44010 | A* round 13 (Phase A.1): S6 anchor majority/COHERENCE 弱化 + S7 拖曳 pin 對側 + S8 proximity stub skip | v1.9 |
| 2026-05-17 | 474c338 | F1 router.js split — shim + router/ 5 subfiles (size cap) | v1.9 |
| 2026-05-17 | 2a25ad0 | A* round 14 (Phase A.2): S15 TURN 累進 + S16 動態 COHERENCE + S19 斜軸關 Center Bias | v1.10 |
| 2026-05-17 | 1e72aa9 | A* round 15 (Phase A.3): S20 不對稱 SHARE_RADIUS + S4 Endpoint Clearance | v1.11 |
| 2026-05-18 | 154a7ef | A* round 16 (Phase B): **S22 target 軸延伸 share-free** — 解 merge 進 port 前 1-grid 階梯 | v1.12 |
| 2026-05-18 | 768aa85 | A* round 17 (Phase B): **S23 source 軸延伸 share-free**（對稱 S22）— 解 fork 出發後 1-grid 階梯 | v1.12 |
| 2026-05-18 | (本 PR) | A* round 18 (Phase C): **S24 維度 7 Bend Endpoint Clearance** + **動態 lane 高度啟發式** — 解短 backward edge stub 擠壓 + 多平行線同 lane label 互蓋 | v1.13 |

---

## 11. 給下一個對話的最後叮嚀

### 接手後第一件事

讀完 §1-§10 後，**先跑下列「最近一輪覆蓋」smoke check**確認當前部署符合預期：

| Smoke case | 預期視覺 | 對應修法 |
|---|---|---|
| 多 fork 出 parallel gateway 下方 | 整齊堆疊在 gateway 下方 trunk，到該轉處才分叉，**無出發後 1-grid 階梯** | v1.12 S23 |
| 多 incoming 進 end event / merge target | 共用同一個箭頭位置，**最後一段直線進 port 無 1-grid 階梯** | v1.12 S22 |
| 跨多 lane 對角 task → end event 1-bend | 1-bend corner 不繞行 | v1.10 S19 |
| 5/5 majority anchor 含少數 T→B 異類邊 | 少數邊自由走自然路徑（不被強拉到 anchor side） | v1.10 S16 |
| **短 backward edge B→B 同 lane 同 row** | **bend 落 d ≥ 3 cells from endpoint，stub 至少 3 cells 不貼元件邊框** | **v1.13 S24** |
| **LPMC 大流程 lane 內 6+ backward edges** | **lane 自動從 144→192+ px，多 backward 分散到 row 不擠 / label 不互蓋** | **v1.13 動態 lane 高度** |
| **純直連 lane（只有 adjacent forward）** | **lane 維持 144px 不浪費版面** | **v1.13 啟發式 P_ADJACENT=0** |

若任一 case 退化（regression），先確認當前 deploy 是 latest commit (`/test-astar/` 顯示版本)，再回頭看 commit history 找 break point。

### 跟使用者協作的慣例

- **「相同根因不同症狀」**：使用者觀察力極敏銳。同時收到多個視覺問題時**先找共同 cost 維度根因**，再決定 1 fix 或 N fix
- **錯字判讀**：「勿」=「戊」、「做標」=「座標」，上下文判斷即可
- **截圖指代**：使用者用「圖一/圖二」指代當輪截圖，仔細看 image 順序與描述對應；常把「ideal 範例」跟「current bad」放一起讓你比對
- **「請執行」前等情境列舉**：複雜需求時，使用者偏好「先列 5-8 個具體使用情境 + 決策點」，**收齊使用者拍板才動手**（CLAUDE.md §12 規定）
- **每輪 push 後等使用者實測**，不要連續修無確認

### 修法決策樹

收到視覺優化需求時按此順序判斷：

1. **能否調既有維度權重解？** → 改常數（e.g., COHERENCE_PENALTY 20→12）
2. **能否縮小既有維度適用範圍？** → 加 skip 條件（e.g., S8 stub skip proximity、S19 斜軸關 Center Bias）
3. **能否擴大既有維度適用範圍？** → 加軸延伸 / radius 動態（e.g., S22/S23 軸延伸、S3 動態 SKIP_RADIUS）
4. **能否拆對稱常數？** → e.g., S20 不對稱 SHARE_RADIUS（source vs target）
5. **以上都不行才加新維度** → 在 spec §3 加新章節 + 更新 cost function 公式

**禁忌**：在 router.js / astar.js / pickPath.js 寫 `if (task.type === 'gateway' && ...) { specialCase }` 之類業務規則分支。

### 對稱性檢查（v1.12 後新增）

任何修同 source / 同 target 行為的改動，**自問**：source 側跟 target 側對稱嗎？是否該同時做？

- v1.11 S20：拆 SHARE_RADIUS_SOURCE vs SHARE_RADIUS_TARGET（語意不對稱，故拆）
- v1.12 S22/S23：軸延伸 share-free — target 先做（S22），source 對稱補（S23），都需要
- 反例：dim 6 Coherence 動態權重（S16）只動 `'in'`/`'out'` 共用邏輯，無 source/target 對稱問題

### 文件同步檢查單（**每輪 PR 前必跑**）

- [ ] `docs/astar-routing-spec.md` §3 對應維度章節更新
- [ ] `docs/astar-routing-spec.md` §8 參數表新增/修改
- [ ] `docs/astar-routing-spec.md` §11 測試情境若有新覆蓋情境補上
- [ ] `docs/astar-routing-spec.md` §13 變更歷史加一行（含 commit SHA）
- [ ] `docs/astar-handoff.md` §1 一句話現狀更新
- [ ] `docs/astar-handoff.md` §4 cost function 公式 + 維度表更新
- [ ] `docs/astar-handoff.md` §5 已覆蓋情境補上
- [ ] `docs/astar-handoff.md` §6 已知未解清單：若 fix 涵蓋某項 → 移除；若引入新已知 corner → 新增
- [ ] `docs/astar-handoff.md` §10 變更紀錄加一行
- [ ] commit msg 引用對應 S 編號（e.g., S22/S23）+ 紅線複查條目

### 保持紅線

cost-based、no if-then、no library、grid-aligned。任何違反都會被使用者抓到並回拒。

祝接手順利！

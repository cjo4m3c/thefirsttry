# A* 連線優化 — 進度交接文件

> **此文件為跨對話接手點**。下一個對話開始 A* 連線優化工作前**必讀**這份。
>
> **任務範圍**：只動 A* 連線優化，仍在 `claude/test-link-open-source-kKqHk` 分支的 `/test-astar/` 部署上測試。**未經使用者明確指令不得 merge 回 main**。

---

## 1. 一句話現狀

A* router 已實作 4 維 cost function，所有改進記錄在 `docs/astar-routing-spec.md` v1.3。**main 完全不動**，只有 `/test-astar/` URL 跑 A*。連線視覺已在多個情境改善但仍有 corner case 待 tune。

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

## 4. Cost Function 當前狀態（v1.8）

```js
// routeAll 開頭 (v1.8 S1)
predictAnchors(grid, rawConns, positions)  // 每 task in/out anchor by geometry 預測

// astar.js per-cell cost
cost(cell, dir) =
    1                                                    // 移動
  + (turn ? TURN_PENALTY(15) : 0)                        // dim 0: 轉彎
  + max(0, PROXIMITY_BONUS(4) - distMap[cell])           // dim 1: 障礙物距離
  + occupyPenalty(cell, dir, src, tgt, start, goal)      // dim 2: 智慧占用
  + (isTurn && farFromDynamicRadius ? centerDist*CENTER_WEIGHT(1.5) : 0)  // dim 4: 中心偏好 (v1.8 動態 skipRadius)

// router.js::pickBestPath 算完 A* path 後加上：
adjustedCost = A* result.cost
  + getPortConflictPenalty(srcId, exitSide,  'out')           // dim 5: port reservation
  + getPortConflictPenalty(tgtId, entrySide, 'in')
  + getCoherenceMismatchPenalty(srcId, exitSide,  'out')      // dim 6: coherence (v1.8 anchor 預測)
  + getCoherenceMismatchPenalty(tgtId, entrySide, 'in')
```

### 各維度解的問題

| 維度 | 解什麼 | 主要參數 |
|---|---|---|
| 0 Turn | 偏好直線、減少彎折 | TURN_PENALTY=15 |
| 1 Proximity | 不貼 task 邊框、走 corridor 中央 | PROXIMITY_BONUS=4 |
| 2 Smart Occupy | 多 fork/merge 共享 port、中段 spread | SHARE_RADIUS=2, SHARE_PENALTY=3, OCCUPY_SAME_DIR=80, OCCUPY_PERP=8 |
| 4 Center Bias (v1.8 動態) | 2-bend 路徑 bend 在中點；長 path 1-bend corner 不誤罰 | CENTER_WEIGHT=1.5, SKIP_RADIUS clamp(pathLen/4, [4, 10]) |
| 5 Port Reservation (v1.5) | 同 port 不可混 IN+OUT (business-spec §5 規則 1) | PORT_VIOLATION_PENALTY=500 |
| 6 Coherence (v1.6 + v1.8 anchor pre-compute + v1.9 majority threshold) | 多 incoming/outgoing 收斂一致 side；anchor 嚴格 majority 才設，弱 penalty 不壓自然路徑 | COHERENCE_PENALTY=12 |

詳細邏輯見 `docs/astar-routing-spec.md` §3。

---

## 5. 已實作完整覆蓋的情境

✅ 同 lane 相鄰直線（2-bend straight）
✅ 同 lane 中間有障礙 → bottom→bottom 走 corridor（multi-port trial）
✅ 跨 lane 2-bend S-shape（bend 在中點）
✅ 多 fork 從同 source 共享 port 出發、中段分流
✅ 多 merge 進同 target 中段分流、靠 port 合流
✅ Drag override（完整 + partial 都尊重，partial 自動配對幾何 entry）
✅ Distance map proximity push 走 corridor 中央
✅ Cell 邊界對齊 grid（所有座標 % 8 = 0）
✅ 結構 hash cache（React 重 render 友善）

---

## 6. 已知未解 corner cases（接下來工作清單）

### 🔴 高優先級

#### 6.1 多 fork 內部「微 zigzag」
某些 fork 路徑在 source 附近會出現 2-3 cells 的小垂直跳動。

**已觀察**：gw→t9 path `(192,184)→(192,192)→(208,192)→(208,184)→(768,184)` —— 在離開 source 短距離內有「下→東→上」的小 detour。

**原因猜測**：
- A* 的 `sourceExitDir='south'`（bottom 出）讓首步走南
- 第二步轉東 cost 高（TURN+15）
- 經過幾步後再北回 corridor 中央
- Center bias 的 CENTER_SKIP_RADIUS 太小，這些 turn 不被視為 stub turn，反而被 penalize 推到中間

**修法方向**：
- 試 `CENTER_SKIP_RADIUS` 4→6
- 或讓「near start cell 的 turn cost」更高（鼓勵第一步就轉到 target 方向）

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

#### 6.6 Lane 動態高度
30+ tasks 在同 lane 的大流程，A* 用固定 BASE_LANE_H 可能擁擠。

**修法方向**：layout-astar 預估每 lane corridor 流量，動態擴 lane height。

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
| 2026-05-17 | TBD | A* round 13 (Phase A.1): S6 anchor majority/COHERENCE 弱化 + S7 拖曳 pin 對側 + S8 proximity stub skip | v1.9 |

---

## 11. 給下一個對話的最後叮嚀

- 使用者的「相同根因，不同症狀」洞察力很強。如果同時收到多個視覺問題，**先找共同 cost 維度根因**，再決定改 1 個還是 N 個地方
- 使用者寫文字偶有錯字（「勿」=「戊」、「做標」=「座標」），上下文判斷即可
- 使用者用「圖一/圖二/圖三/圖四」指代當輪截圖，**仔細看 image 順序與 user 描述對應**
- 使用者把「ideal 範例」（圖三）跟「current bad」（圖一）放在一起 → **比對兩者差異**找優化方向
- **每輪 push 後等使用者實測**，不要連續修無確認
- **保持紅線**：cost-based、no if-then、no library、grid-aligned。任何違反都會被使用者抓到並回拒

祝接手順利！

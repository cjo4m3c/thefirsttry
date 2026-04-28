/**
 * Changelog archive chunk c08 (frozen — do not edit).
 * See ChangelogPanel.jsx for the full UI.
 */
export default [
  {
    date: '2026-04-22',
    title: 'Hover 高亮：方向色分流 + 連線反向高亮端點',
    items: [
      '**連線方向感知配色**：hover 元件時，**Outgoing（此元件指出去）**用 primary 深藍 `#2A5598`；**Incoming（指進此元件）**用 light 淡藍 `#7AB5DD`；方向一眼看清',
      '**反向：hover 連線也會高亮端點任務** — 滑鼠移到線段上，整條線變主藍 `#2563EB` 加粗，兩端的 task / gateway / event 也同步亮起藍邊框 + 淡藍底',
      '連線 hit area 擴大：額外加一條 transparent 10px 寬的 stroke 包住實線，讓滑鼠不用完全壓在細線上也能 hover 到',
      '新增 `ah-hover-out` / `ah-hover-in` 兩個 SVG marker，箭頭尖端跟線段同色',
      '`ui-rules.md` 新增「連線 hover 色」段落，兩色納入標準色票',
    ],
  },
  {
    date: '2026-04-22',
    title: 'Hover 時同步高亮相關連線',
    items: [
      '滑過任何元件（task / gateway / start / end / L3 活動）時，除了元件本身變藍，**指向它的 incoming 連線**與**它指出去的 outgoing 連線**也一起改為藍色加粗',
      '實作：`ConnectionArrow` 接收 `hoveredId` prop，連線兩端有一端為 hovered 元件即觸發高亮（stroke 改 `#2563EB`、寬度 1.4 → 2.5、箭頭 marker 改同色）',
      '新增 `ah-hover` SVG marker 讓箭頭尖端也跟著變色',
    ],
  },
  {
    date: '2026-04-22',
    title: '文件同步 + 新增 3 個 AI skill',
    items: [
      '`HelpPanel` 規則對齊最新 routing：ROUTING 表格合併出入口欄、補「Corridor slot 系統」小節說明 top / bottom 通道規則',
      '`HANDOVER.md` 更新：`layout.js` 行數 ~500 → ~800；風險章節補 Phase 3b / 3c / corridor slot 相關說明；Backlog 更新',
      '`README.md` 補 `layout.js` corridor slot 說明',
      '新增 `.claude/skills/sync-main.md`：使用者合併 PR 後本地同步的通用流程',
      '新增 `.claude/skills/doc-audit.md`：四份文件對齊性檢查清單',
      '新增 `.claude/skills/trace-layout.md`：跑 node trace 腳本驗證 `computeLayout` 輸出的樣板',
      '新增 `.claude/skills/ui-rules.md`：藍色主題色票、按鈕 / banner / modal / 頁首 / 表單 pattern，UI 異動前必讀',
    ],
  },
  {
    date: '2026-04-22',
    title: '上方 corridor slot 化 + forward 長跳欄避開中間元件',
    items: [
      '**Phase 3c**：task → task 的 forward 連線若同列 `dc>1`（跳欄），改走 **top corridor**，避免直線穿過中間 task',
      '**Top corridor slot 系統**：模仿現有 bottom corridor 的 slot，任何 `top → top` 連線（閘道 top-skip / 任務 backward / 任務 forward-skip）都進 `topConnsByRow`，每條自動分配不同 y-level',
      'Row 0 上方預留空間：`laneTopY[0]` 根據該列 top corridor 數量動態加高（原本只有 54px 到任務，現在會按需擴張），讓箭頭不會壓到標題列',
      '處理使用者提報的兩個情境：(1) `5-1-2-7/8/9 → end` 多條連線現在各自一條水平線堆疊；(2) `5-1-2-11 → end` 跳過 `5-1-2-12` 不再被擋住',
      'Phase 3 / 3b 取消 top corridor 衝突檢查（改由 slot 系統處理），邏輯簡化',
      '`routeArrow` 新增 `laneTopCorridorY` 參數，跟 `laneBottomY` 對稱',
    ],
  },
  {
    date: '2026-04-22',
    title: '規則說明同步 + 更新紀錄日期校正',
    items: [
      '`HelpPanel` 規則說明依最新規則改寫：新增「編號規則」章節（開始 `-0` / 結束 `-99` / 閘道 `_g` / 任務流水號）',
      'ELEMENTS 更新：`L3 活動（子流程調用）` 明確說明用於 `調用子流程 X-Y-Z`，圖上顯示 `[子流程] + L3 編號`',
      'CONNECTIONS 更新：「迴圈返回」改為單一目標（不是閘道）、「子流程調用」改為繪成 L3 活動元件',
      'VALIDATION 新增 4 條新規則（迴圈目標必填、閘道 `_g` 尾碼、閘道前綴對應 L4 任務）',
      'ROUTING 更新：描述 smart routing 多階段（Phase 1 sibling 分配、Phase 3 corridor 衝突讓步、incoming 端點避開）',
      '修正更新紀錄日期錯誤：本 session（4/22）所有條目原本標注為 4/21，批次改成 4/22',
    ],
  },
  {
    date: '2026-04-22',
    title: '子流程用 L3 活動元件 + 修正 same-row 平行 corridor 直線 bug',
    items: [
      '**子流程調用**：解析 Excel「調用子流程 5-3-2」取出 L3 編號，任務 `type` 設為 `l3activity`，繪成雙邊書擋矩形，上面顯示 `[子流程] 5-3-2`',
      'Wizard UI 的「子流程名稱」欄改為「子流程 L3 編號」（範例 `5-3-2`）',
      '**修正 routeArrow 直線 bug**：同列的 bottom→bottom（或同欄 top→top 等）連線原本會因為 `sy === ty` 被「degenerate-alignment shortcut」誤判為直線，穿過中間所有元件',
      '新行為：先檢查 exitSide === entrySide（parallel corridor）**再**處理 degenerate alignment，所以平行 corridor 一定走正確的 3-段繞行路徑',
      'Draw.io 匯出版本本來就正確（用 draw.io 自己的 orthogonalEdgeStyle），只有網頁 SVG 受影響',
    ],
  },
];

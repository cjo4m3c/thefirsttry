/**
 * helpPanelData — Rules Reference data for HelpPanel
 *
 * 此檔是 HelpPanel.jsx 的純資料層，從元件抽出後便於跟業務規格文件
 * docs/business-spec.md 對齊（規則來源是 spec doc，本檔是「使用者導向摘要」）。
 *
 * 每個 array 上方標註對應的 spec 章節編號，改規則時順著章節改即可。
 *
 * Sections:
 *   HIERARCHY        → docs/business-spec.md §1 階層定義
 *   NUMBERING        → §2 編號規則
 *   ELEMENTS         → §3 元件類型
 *   VALIDATION       → §7 儲存檢核兩層
 *   EDITABLE_ACTIONS → §8 編輯操作
 *   FORBIDDEN_RULES  → §9 禁止規則
 *   EXPORTS          → §10 匯出格式
 *
 * 「連線規則」(§4) 不在 HelpPanel 顯示（2026-04-30 使用者要求移除）—
 * 連線型態現在由「元件類型」單一選單自動衍生，使用者不再需要手動選連線型態。
 * 完整連線規則仍在 docs/business-spec.md §4。
 */

// 對應 docs/business-spec.md §1 階層定義
export const HIERARCHY = [
  { level: 'L1', name: '業務領域', desc: '最高層業務分類（如：財務、人事、IT）' },
  { level: 'L2', name: '價值流',   desc: '跨功能的端對端流程，由多個 L3 活動組成' },
  { level: 'L3', name: '活動',     desc: '本系統管理單元，即一張泳道圖（含角色與任務）' },
  { level: 'L4', name: '任務',     desc: '泳道圖內的單一步驟節點，帶有編號（如 3-1、3-2）' },
  { level: 'L5', name: '步驟',     desc: 'L4 任務下的操作細節（預留，尚未開放）' },
];

// 對應 docs/business-spec.md §2 編號規則
export const NUMBERING = [
  { kind: 'L3 活動編號',   rule: '`\\d+-\\d+-\\d+`（三段，僅接受 `-` 分隔）',         example: '`1-1-5`、`5-4-11`' },
  { kind: 'L4 任務編號',   rule: '`L3編號-順號`，**只對一般任務**從 1 流水計數',      example: '`1-1-5-1`、`1-1-5-2`、`1-1-5-3`' },
  { kind: '開始事件',       rule: '尾碼必為 `0`',                                         example: '`1-1-5-0`' },
  { kind: '結束事件',       rule: '尾碼必為 `99`',                                        example: '`1-1-5-99`' },
  { kind: '閘道（XOR/AND/OR）', rule: '前一任務編號 + `_g`（單一）或 `_g1`、`_g2`、`_g3`…（連續多個）；前綴必對應既有 L4 任務或 `-0` 開始事件', example: '`1-1-5-2_g`、`1-1-5-0_g`（接在開始之後）' },
  { kind: '迴圈返回',       rule: '（**舊資料兼容**，編輯器不再提供新增）以任務本身編號 + `nextTaskIds = [前面任務]`', example: '`1-1-5-4`（既有資料保留）' },
  { kind: '子流程調用',     rule: '**前一任務編號 + `_s`**（單一）或 `_s1`、`_s2`…（連續多個）；不佔順號，**圖上元件顯示所調用的 L3 編號**取代本任務 L4', example: '`1-1-5-2_s`、`1-1-5-2_s1 → _g → _s2`（中間閘道不打斷連續性）' },
  { kind: '外部關係人互動', rule: '**前一任務編號 + `_w`**（單一）或 `_w1`、`_w2`…（連續多個）；不佔順號，跟 `_g` / `_s` 共用 anchor、計數器互不重置（`_w1 → _g → _w2` 仍連續）。**流程圖上不顯示編號**（編輯器 + 表格仍顯示）', example: '`1-1-5-2_w`、`1-1-5-2_w1 → _g → _w2`' },
];

// 對應 docs/business-spec.md §3 元件類型
export const ELEMENTS = [
  {
    type: '開始事件',
    shape: '圓形（空心）',
    color: '#D1FAE5 / 綠框',
    purpose: '流程的唯一起點，每張圖必須有且僅能有一個。L4 編號尾碼必為 `0`（範例 `1-1-5-0`）。',
  },
  {
    type: '結束事件',
    shape: '圓形（實心深色）',
    color: '#111827 填色',
    purpose: '流程的終點，每張圖至少有一個。L4 編號尾碼必為 `99`（範例 `1-1-5-99`）。',
  },
  {
    type: 'L4 任務',
    shape: '圓角矩形',
    color: '#DBEAFE / 藍框',
    purpose: '一般業務步驟。編號 `L3-順號`（例 `1-1-5-1`），**只有一般任務會佔用流水號**（開始 / 結束 / 閘道都不佔）。流程設定選「序列流向」。',
  },
  {
    type: '外部關係人互動',
    shape: '圓角矩形（灰底）',
    color: '#A0A0A0 / 灰框',
    purpose: [
      '外觀與 L4 任務相同但底色為灰色',
      '外部角色泳道**強制**使用此元件（移到外部泳道時 task→interaction，不可逆）',
      '內部角色泳道**允許**使用此元件，但儲存時跳 warning 讓使用者檢查（移到內部時保留 shape）',
      '編號用 `_w` 後綴（`1-1-5-2_w`），不佔流水順號',
      '流程圖上不顯示編號，編輯器 + 表格仍完整顯示',
    ],
  },
  {
    type: 'L3 活動（子流程調用）',
    shape: '書端矩形（左右側垂直分隔線）',
    color: '#FFFFFF / 深灰框',
    purpose: [
      '調用另一個 L3 活動（Call Activity）',
      'L4 編號用 `_s` 後綴（**不佔順號**），例如 `1-1-5-2_s`；連續多個用 `_s1`、`_s2`',
      '**圖上頂端顯示所調用的 L3 編號**（例 `5-3-2`，取代此任務本身的 L4 編號）',
      '內部顯示「[子流程]」+ 任務名稱',
      'Excel 標記 `調用子流程 5-3-2`',
    ],
  },
  {
    type: '排他閘道（XOR）',
    shape: '菱形（內含 × 符號）',
    color: '#FEF3C7 / 橙框',
    purpose: [
      '條件分支：每次只走一個路徑',
      '**L4 編號 = 前一任務 + `_g`**（連續多個用 `_g1`、`_g2`…，例 `1-1-5-2_g`）',
      'Excel 標記：`條件分支至 …`',
    ],
  },
  {
    type: '並行閘道（AND）',
    shape: '菱形（內含 + 符號）',
    color: '#D1FAE5 / 綠框',
    purpose: [
      '並行分支：同時啟動所有路徑（**不評估條件**，標籤僅作註記用）',
      '編號規則同 XOR（`_g` 後綴）',
      'Excel 標記：`並行分支至 X、Y` 或 `並行分支至 X（A）、Y（B）`',
    ],
  },
  {
    type: '包容閘道（OR）',
    shape: '菱形（內含 ○ 符號）',
    color: '#FEF9C3 / 黃框',
    purpose: [
      '包容分支：每個條件獨立評估，凡為真者建立並行路徑（可同時觸發 1~N 條）',
      '編號規則同 XOR（`_g` 後綴）',
      'Excel 標記：`包容分支至 X（A）、Y（B）` 或 `可能分支至 …`（兩種動詞都吃）',
      '合併目標自動產生「包容合併 X、Y，序列流向 Z」',
    ],
  },
];

// 對應 docs/business-spec.md §7 儲存檢核兩層
// FlowEditor 儲存前會跑兩層檢核（spec §7.1 / §7.2）：
//   tier='blocking' → 結構不合法，彈紅色 modal、無法儲存
//   tier='warning'  → 建議修正，彈黃色 modal，使用者可選「仍然儲存」
//   tier='import'   → 只在 Excel 匯入時檢查（spec §7.3）
export const VALIDATION = [
  // ───── Blocking（無法儲存） ─────
  {
    tier: 'blocking',
    rule: '必須有開始事件',
    detail: '流程中至少需要一個流程設定為「流程開始」的節點，否則無法儲存。',
  },
  {
    tier: 'blocking',
    rule: '必須有結束事件',
    detail: '流程中至少需要一個流程設定為「流程結束」或「流程斷點」的節點，否則無法儲存。',
  },
  {
    tier: 'blocking',
    rule: '開始事件必須連接到其他任務',
    detail: '「流程開始」節點的 outgoing 不能為空，否則無法儲存。',
  },
  {
    tier: 'blocking',
    rule: '開始事件不能被連接（不可有 incoming）',
    detail: [
      'BPMN 規定：「流程開始」是流程入口，不可有任何元件連接到它',
      '違反時擋下儲存',
      '新建立的開始事件不會被自動串接到既有節點，使用者要手動設定它的下一步',
    ],
  },
  {
    tier: 'blocking',
    rule: '結束事件必須有其他任務連接到它',
    detail: '「流程結束」/「流程斷點」節點的 incoming 不能為空，否則無法儲存。',
  },
  {
    tier: 'blocking',
    rule: '連線端點不能同時有進入與出發',
    detail: [
      '一個元件的同一個端點（top/right/bottom/left）不能同時是 incoming + outgoing',
      '違反時用紅色高亮該連線、擋下儲存',
      '通常發生在拖端點 override 後造成 mix；改拖到別的 port 即可',
    ],
  },

  // ───── Warning（跳 modal 由使用者決定） ─────
  {
    tier: 'warning',
    rule: '非結束節點必須設定下一步',
    detail: '流程設定為「序列流向」、「條件分支」、「並行分支」、「包容分支」、「子流程調用」、「流程開始」的節點，都應該設定至少一個有效目標。未設定時跳 warning modal。',
  },
  {
    tier: 'warning',
    rule: '每個節點都必須被連接（除開始外）',
    detail: '「流程開始」節點以外，每個節點都應該被至少一條連線指向。孤立節點跳 warning。',
  },
  {
    tier: 'warning',
    rule: '多個開始 / 結束事件',
    detail: [
      '流程有 ≥2 個「流程開始」→ warning「BPMN 一般建議單一起點，請確認是否刻意設計多個入口」',
      '流程有 ≥2 個「流程結束 / 流程斷點」→ warning「多個終點可接受（不同情境收尾），請確認」',
      '都是建議性 warning，可選「仍然儲存」',
    ],
  },
  {
    tier: 'warning',
    rule: '閘道應有至少 2 條分支',
    detail: [
      '排他 / 並行 / 包容閘道都至少需要 2 條分支條件（fork 才有意義）',
      '若刪到 < 2 條跳 warning，使用者可選「仍然儲存」或回去補',
      '包容閘道另有「至少 2 個有效目標」warning（中間有未填 target 的條件不算）',
    ],
  },
  {
    tier: 'warning',
    rule: '閘道未指定泳道角色',
    detail: '閘道任務沒有設定 `roleId`（角色泳道）時跳 warning。閘道在下拉選單裡無論有無角色都會顯示，這條規則防止使用者忘了綁定。',
  },
  {
    tier: 'warning',
    rule: '迴圈返回必須指定目標',
    detail: '`connectionType=loop-return` 的任務必須在 `nextTaskIds[0]` 指向上游某任務。沒指定跳 warning。（編輯器已不再提供新增 loop-return 入口，舊資料仍會檢查）',
  },
  {
    tier: 'warning',
    rule: '外部互動建議放外部角色泳道',
    detail: [
      '外部關係人互動（`shapeType=interaction`）放在內部角色泳道時跳 warning',
      '使用者可選「仍然儲存」（不擋）',
      '外部角色泳道強制使用此元件、移過去自動轉換',
      '內部角色泳道允許但建議檢查是否錯放（外部互動 = 跨組織 / 客戶 / 系統互動，通常該歸外部角色）',
    ],
  },
  {
    tier: 'warning',
    rule: '連線不能跨過任務矩形',
    detail: '連線線段壓在其他任務矩形上時跳 warning。可選「仍然儲存」但建議重新拖端點避開（自動路由本來就避免這種情況，只在使用者手動 override 端點時才會發生）。',
  },
  {
    tier: 'warning',
    rule: '合併目標自動偵測（不需手動標記）',
    detail: [
      '任意任務（含閘道）收到 ≥2 個其他任務指向 → 系統自動在「任務關聯說明」前插入「並行/條件/包容合併 X、Y，序列流向 Z」',
      '合併類型由上游閘道種類推斷；混合來源或一般任務 source 預設為條件合併',
      '編輯器選單不再有 parallel-merge / conditional-merge / inclusive-merge 選項',
    ],
  },

  // ───── Import（Excel 匯入時檢查） ─────
  {
    tier: 'import',
    rule: 'L3 / L4 編號格式',
    detail: [
      'L3：`\\d+-\\d+-\\d+`（恰好 3 段，僅接受「-」分隔）',
      'L4 任務：`L3編號-順號`（恰好 4 段）',
      '舊資料用「.」分隔（例 `1.1.5.1`）載入時自動轉橫線',
      '禁止英文字母結尾（除了 `_g` / `_s` / `_w` 後綴例外）',
    ],
  },
  {
    tier: 'import',
    rule: '開始 / 結束事件編號',
    detail: [
      '開始事件 L4：尾碼必為 `0`（例 `1-1-5-0`）',
      '結束事件 L4：尾碼必為 `99`（例 `1-1-5-99`）',
    ],
  },
  {
    tier: 'import',
    rule: '閘道 L4 編號必須以 `_g` 結尾',
    detail: [
      'XOR / AND / OR 閘道：L4 編號必須是 `前一任務編號_g`（單一）或 `_g1`、`_g2`、`_g3`…（連續多個）',
      'Excel 匯入時若閘道列缺 `_g` 尾碼將被擋下',
      '舊 localStorage 資料載入時自動補',
    ],
  },
  {
    tier: 'import',
    rule: '子流程調用 L4 編號必須以 `_s` 結尾',
    detail: [
      '「調用子流程 X-Y-Z」的 L4 編號必須是 `前一任務編號_s`（單一）或 `_s1`、`_s2`、`_s3`…（連續多個）',
      '不佔順號',
      'Excel 匯入時若子流程列缺 `_s` 尾碼將被擋下；舊 localStorage 資料載入時自動補',
    ],
  },
  {
    tier: 'import',
    rule: '外部關係人互動 L4 編號必須以 `_w` 結尾',
    detail: [
      '外部互動的 L4 編號必須是 `前一任務編號_w`（單一）或 `_w1`、`_w2`、`_w3`…（連續多個）',
      '不佔順號',
      'Excel 匯入偵測到 `_w` 尾碼會自動 set `shapeType=interaction`',
      '若該行對應的角色是 internal lane → 匯入仍可接受、儲存時 warning 提醒檢查（不擋）',
    ],
  },
  {
    tier: 'import',
    rule: '閘道 / 子流程 / 外部互動前綴必對應既有 L4 任務',
    detail: [
      '`X_g`、`X_s`、`X_w` 的前綴 `X` 必須是同一份 Excel 中存在的 L4 任務',
      '例外：若是流程的第一個元素，前綴可為 `-0` 開始事件（例 `1-1-5-0_g`）',
      '`_g`、`_s`、`_w` 三者共用 anchor、計數器互不重置（`_w1 → _g → _w2` 仍視為連續）',
    ],
  },
  {
    tier: 'import',
    rule: '條件分支標籤可選填',
    detail: [
      'XOR / AND / OR 三類閘道的每個分支顯示「標籤」欄位但**不強制必填**',
      'XOR / OR 標籤代表觸發條件',
      'AND 標籤僅作註記用（規格上不評估條件）',
      'Excel 匯入兩種寫法都吃：`條件分支至 X（標籤）、Y` 或 `條件分支至 X、Y`',
    ],
  },
];

// 對應 docs/business-spec.md §8 編輯操作
// User-facing list of in-canvas / drawer edit actions.
// 自動路由 / corridor 規則細節在 HANDOVER.md（developer reference）— 使用者現在直接拖端點 / 換目標，
// 自動路由矩陣對使用者來說只是雜訊，所以從 HelpPanel 拿掉。
export const EDITABLE_ACTIONS = [
  {
    title: '↶ 復原 / ↷ 重做（Ctrl+Z / Ctrl+Y）',
    desc: [
      '頁首「↶ 復原」/「↷ 重做」按鈕、或鍵盤 Ctrl+Z（Mac: Cmd+Z）/ Ctrl+Y（或 Ctrl+Shift+Z）',
      '記錄最近 50 步操作；連續打字 500ms 內合併成 1 步（不會每打 1 個字就算 1 步）',
      '**儲存後 stack 清空**：每次按下儲存就重設「再編輯才能 undo」（避免 undo 退回未儲存版本後又儲存覆蓋）',
      'session-only：重新整理頁面 / 切換 L3 流程後 stack 重來',
      '在 input / textarea 內 Ctrl+Z 走瀏覽器原生文字復原（不會打斷打字）',
    ],
  },
  {
    title: '▲ ▼ 排序任務',
    desc: '在右側「✏️ 編輯」面板的「設定流程」分頁，點任務左側的 ▲ ▼ 按鈕改變順序（最上 / 最下會自動 disabled）。順序改了之後 L4 編號自動重排（除非曾經 Excel 匯入帶入特定編號）。',
  },
  {
    title: '▲ ▼ 排序泳道角色',
    desc: '「設定泳道角色」分頁同樣可點 ▲ ▼ 改變泳道由上到下的順序。任務的角色綁定（task.roleId）不變，只是視覺位置調整。',
  },
  {
    title: '點任務元件 → 彈出編輯選單',
    desc: [
      '點流程圖上**任務矩形 / 開始 / 結束 / 閘道**彈出小選單',
      '可編輯名稱 / 角色 / 重點說明（hover 時顯示）',
      '可在前面新增、在後面新增、新增一條連線、新增閘道、刪除元件',
      '新增的元件會自動接好連線避免孤兒',
    ],
  },
  {
    title: 'Hover 任務看重點說明',
    desc: '滑鼠懸停在任務上會在上方彈出「任務重點說明」浮層（只有有填說明的任務才顯示）。訪談時可作快速提示。',
  },
  {
    title: '拖曳連線端點覆寫起點 / 終點 port',
    desc: '點選連線後，端點會出現藍色 handle，可拖曳到該任務的其他 port（top / right / bottom / left）覆寫自動路徑。覆寫過的端點顯示琥珀色小圓點。',
  },
  {
    title: '拖曳連線端點換目標任務',
    desc: '把目標 handle 拖到別的任務上會直接換 target；綠色虛線框提示候選目標、藍色虛線預覽路徑。原 connectionOverrides 會自動跟著遷移。',
  },
  {
    title: '刪除連線（點選後按 Delete 或紅 ✕ 按鈕）',
    desc: [
      '點選連線 → 線段中點出現紅色 ✕ 圓形按鈕',
      '點按鈕或鍵盤按 Delete / Backspace 即刪除',
      '閘道分支：整條 condition 移除（含條件 label）',
      '常見副作用：起點若是流程開始且只剩此線 → 儲存被擋',
      '常見副作用：終點變成孤立節點 → 儲存跳 warning',
      '常見副作用：閘道變成 < 2 條分支 → 儲存跳 warning',
      '**無 undo**，誤刪要手動拖一條新的',
    ],
  },
  {
    title: '重設手動端點',
    desc: '若覆寫端點造成違規（紅線），選中該連線後右上角提示列會多「重設此連線端點」按鈕；流程圖上方還有「重設所有手動端點」全清按鈕（僅當有 override 時顯示）。',
  },
];

// 對應 docs/business-spec.md §9 禁止規則
// 把 violation detector 邏輯外露給使用者，讓他們知道什麼會觸發紅線 / 儲存 warning。
export const FORBIDDEN_RULES = [
  {
    title: '端點不能同時有進入和出發（IN + OUT）',
    impact: 'Blocking',
    desc: '同一個任務的同一個 port 不能同時是 incoming + outgoing 端點。違反會在儲存時擋下並用紅色高亮該連線。',
  },
  {
    title: '連線不能跨過任務矩形',
    impact: 'Warning',
    desc: '線段壓在其他任務矩形上面會在儲存時跳黃色 modal，可選「仍然儲存」但建議重新拖端點避開。',
  },
  {
    title: '必須有開始事件 + 結束事件，且各自有正確連線',
    impact: 'Blocking',
    desc: '流程必須有「流程開始」（outgoing 不為空）+「流程結束」/「流程斷點」（incoming 不為空）。',
  },
  {
    title: 'L4 編號規則（Excel 匯入時強制）',
    impact: 'Blocking（匯入時）',
    desc: [
      '一般任務 `1-1-1-1`',
      '開始事件尾碼 `-0`、結束事件尾碼 `-99`',
      '閘道 `1-1-1-X_g`（單一 _g；連續多個用 _g1、_g2…）',
      '子流程調用 `1-1-1-X_s`（單一 _s；連續多個用 _s1、_s2…）',
      '外部關係人互動 `1-1-1-X_w`（單一 _w；連續多個用 _w1、_w2…）',
      '僅接受橫線分隔（舊資料用「.」載入時自動轉）',
      '詳見上方「驗證規則 → Import」段落',
    ],
  },
];

// 對應 docs/business-spec.md §10 匯出格式
export const EXPORTS = [
  {
    format: 'PNG',
    ext: '.png',
    tool: '任何圖片檢視器、Word、PowerPoint',
    note: '高解析度圖片，不可再編輯節點。可從流程編輯頁上方按鈕匯出，或直接在首頁卡片點「↓ PNG」下載。',
  },
  {
    format: 'Draw.io',
    ext: '.drawio',
    tool: 'diagrams.net（免費線上 / 桌面版）或 VS Code Draw.io 擴充',
    note: '可重新編輯節點、調整版面，以 mxGraph XML 格式儲存。可從流程編輯頁上方按鈕匯出，或直接在首頁卡片點「↓ draw.io」下載。',
  },
  {
    format: 'Excel',
    ext: '.xlsx',
    tool: 'Microsoft Excel、LibreOffice Calc、Google Sheets',
    note: '包含 L4 任務明細共 10 欄（L3 編號、L3 名稱、L4 編號、任務名稱、說明、輸入、角色、產出、關聯說明、參考資料）。可在「詳細 Excel 清單」頁籤下載，或直接在首頁卡片點「↓ Excel」下載。',
  },
];

import { useState } from 'react';

/**
 * HelpPanel — Rules Reference Modal
 *
 * MAINTENANCE GUIDE:
 * This component is the single source of truth for documented rules.
 * Whenever you update validation logic in Wizard.jsx, connection/routing
 * logic in layout.js, or add new element types in constants.js / Wizard.jsx,
 * update the corresponding section below.
 *
 * Sections:
 *   HIERARCHY    — L1–L5 level definitions
 *   ELEMENTS     — All diagram element types (shape, color, purpose)
 *   VALIDATION   — FlowEditor save-time validation (blocking 擋儲存 / warning 跳 modal 由使用者決定)
 *   CONNECTIONS  — How tasks connect (nextTaskIds, parallel, gateway conditions)
 *   ROUTING      — Gateway exit/entry side logic based on dr/dc
 *   EXPORT       — Supported export formats and usage
 */

// ─── Rule Data ────────────────────────────────────────────────────────────────

const HIERARCHY = [
  { level: 'L1', name: '業務領域', desc: '最高層業務分類（如：財務、人事、IT）' },
  { level: 'L2', name: '價值流',   desc: '跨功能的端對端流程，由多個 L3 活動組成' },
  { level: 'L3', name: '活動',     desc: '本系統管理單元，即一張泳道圖（含角色與任務）' },
  { level: 'L4', name: '任務',     desc: '泳道圖內的單一步驟節點，帶有編號（如 3-1、3-2）' },
  { level: 'L5', name: '步驟',     desc: 'L4 任務下的操作細節（預留，尚未開放）' },
];

const NUMBERING = [
  { kind: 'L3 活動編號',   rule: '`\\d+-\\d+-\\d+`（三段，僅接受 `-` 分隔）',         example: '`1-1-5`、`5-4-11`' },
  { kind: 'L4 任務編號',   rule: '`L3編號-順號`，**只對一般任務**從 1 流水計數',      example: '`1-1-5-1`、`1-1-5-2`、`1-1-5-3`' },
  { kind: '開始事件',       rule: '尾碼必為 `0`',                                         example: '`1-1-5-0`' },
  { kind: '結束事件',       rule: '尾碼必為 `99`',                                        example: '`1-1-5-99`' },
  { kind: '閘道（XOR/AND/OR）', rule: '前一任務編號 + `_g`（單一）或 `_g1`、`_g2`、`_g3`…（連續多個）；前綴必對應既有 L4 任務', example: '`1-1-5-2_g`、`1-1-5-2_g2`' },
  { kind: '迴圈返回',       rule: '不是閘道元件，不用 `_g`；以任務本身編號 + `nextTaskIds = [前面任務]`', example: '`1-1-5-4`（上面任務名可標註「迴圈返回，序列流向 1-1-5-2」）' },
  { kind: '子流程調用',     rule: '不佔順號，任務名稱可標註「[子流程] 調用子流程 X-Y-Z」，X-Y-Z 為被調用 L3 活動編號', example: '`5-3-1-1`，調用 `5-3-2`' },
];

const ELEMENTS = [
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
    purpose: '一般業務步驟。編號 `L3-順號`（例 `1-1-5-1`），**只有一般任務會佔用流水號**（開始 / 結束 / 閘道都不佔）。流程設定選「序列流向」或「迴圈返回」。',
  },
  {
    type: '互動任務',
    shape: '圓角矩形（淺紫底）',
    color: '#EDE9FE / 藍框',
    purpose: '涉及系統互動或跨角色協作的任務節點，流程設定同 L4 任務。',
  },
  {
    type: 'L3 活動（子流程調用）',
    shape: '書端矩形（左右側垂直分隔線）',
    color: '#FFFFFF / 深灰框',
    purpose: '調用另一個 L3 活動（Call Activity）。**圖上頂端顯示所調用的 L3 編號**（例 `5-3-2`，取代此任務本身的 L4 編號），內部顯示「[子流程]」+ 任務名稱。Excel 標記 `調用子流程 5-3-2`。',
  },
  {
    type: '排他閘道（XOR）',
    shape: '菱形（內含 × 符號）',
    color: '#FEF3C7 / 橙框',
    purpose: '條件分支：每次只走一個路徑。**L4 編號 = 前一任務 + `_g`**（連續多個用 `_g1`、`_g2`…，例 `1-1-5-2_g`）。Excel 標記：`條件分支至 …`。',
  },
  {
    type: '並行閘道（AND）',
    shape: '菱形（內含 + 符號）',
    color: '#D1FAE5 / 綠框',
    purpose: '並行分支：同時啟動所有路徑（**不評估條件**，標籤僅作註記用）。編號規則同 XOR（`_g` 後綴）。Excel 標記：`並行分支至 X、Y` 或 `並行分支至 X（A）、Y（B）`。',
  },
  {
    type: '包容閘道（OR）',
    shape: '菱形（內含 ○ 符號）',
    color: '#FEF9C3 / 黃框',
    purpose: '包容分支：每個條件獨立評估，凡為真者建立並行路徑（可同時觸發 1~N 條）。編號規則同 XOR。Excel 標記：`包容分支至 X（A）、Y（B）` 或 `可能分支至 …`（兩種動詞都吃）。對應合併：`包容合併來自多個分支，序列流向 Z`。',
  },
];

// FlowEditor 儲存前會跑兩層檢核（CLAUDE.md 規則 5）：
//   tier='blocking' → 結構不合法，彈紅色 modal、無法儲存
//   tier='warning'  → 建議修正，彈黃色 modal，使用者可選「仍然儲存」
//   tier='import'   → 只在 Excel 匯入時檢查，非儲存檢核（留作參考）
const VALIDATION = [
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
    rule: '結束事件必須有其他任務連接到它',
    detail: '「流程結束」/「流程斷點」節點的 incoming 不能為空，否則無法儲存。',
  },
  {
    tier: 'warning',
    rule: '非結束節點必須設定下一步',
    detail: '流程設定為「序列流向」、「條件分支」、「並行分支」、「子流程調用」、「迴圈返回」、「並行合併」、「條件合併」、「流程開始」的節點，都應該設定至少一個有效目標。未設定時跳 warning modal。',
  },
  {
    tier: 'warning',
    rule: '並行合併：必須有 2 個以上來源',
    detail: '流程設定為「並行合併」的節點，應該被至少 2 個其他節點指向。',
  },
  {
    tier: 'warning',
    rule: '條件合併：必須有 2 個以上條件分支來源',
    detail: '流程設定為「條件合併」的節點，應該被至少 2 個「條件分支」節點的條件出口指向。',
  },
  {
    tier: 'warning',
    rule: '每個節點都必須被連接（除開始外）',
    detail: '「流程開始」節點以外，每個節點都應該被至少一條連線指向。孤立節點跳 warning。',
  },
  {
    tier: 'warning',
    rule: '迴圈返回必須指定目標',
    detail: '流程設定為「迴圈返回」的任務應該選擇「迴圈返回至」的目標任務（通常是較前面的任務）。',
  },
  {
    tier: 'import',
    rule: '條件分支標籤可選填',
    detail: 'XOR / AND / OR 三類閘道的每個分支都顯示「標籤」欄位但**不強制必填**。XOR / OR 標籤代表觸發條件；AND 標籤僅作註記用（規格上不評估條件）。Excel 匯入時兩種寫法都吃：`條件分支至 X（標籤）、Y` 或 `條件分支至 X、Y`。',
  },
  {
    tier: 'import',
    rule: '閘道 L4 編號必須以 `_g` 結尾',
    detail: 'XOR / AND / OR 閘道的 L4 編號必須是 `前一任務編號_g`（單一）或 `_g1`、`_g2`、`_g3`…（連續多個）。Excel 匯入時若閘道列缺 `_g` 尾碼將被擋下。',
  },
  {
    tier: 'import',
    rule: '閘道前綴必對應既有 L4 任務',
    detail: '閘道編號 `X_g` 的前綴 `X` 必須是同一份 Excel 中存在的 L4 任務。若 `X_g` 沒有對應任務，匯入會被擋下。',
  },
];

const CONNECTIONS = [
  {
    title: '序列流向',
    desc: '最常用的連接類型。選擇單一「下一步任務」，畫出一條從右向左的序列箭頭。形狀可選 L4 任務、互動任務、L3 活動。',
  },
  {
    title: '條件分支（XOR 排他閘道）',
    desc: '可新增多個分支，每個分支設定「條件標籤」與「目標任務」。**每次流程只走一條路徑**。標籤可選填（用以描述評估條件）。',
  },
  {
    title: '並行分支（AND 並行閘道）',
    desc: '同時啟動多個並行目標。**規格上不評估條件**，標籤欄位仍然顯示但僅作註記用，不必填寫。所有目標任務並行執行。',
  },
  {
    title: '包容分支（OR 包容閘道）',
    desc: '每個條件獨立評估，凡為真者建立並行路徑（**可同時觸發 1~N 條**）。標籤可選填。對應合併用「包容合併」等待所有觸發路徑完成。',
  },
  {
    title: '並行合併（AND 合併閘道）',
    desc: '等待所有並行分支完成後，合併為一個流程繼續。必須有 2 個以上的並行分支來源。設定合併後的單一下一步。',
  },
  {
    title: '條件合併（XOR 合併閘道）',
    desc: '當多個條件分支匯聚時使用。必須有 2 個以上條件分支來源。設定合併後的單一下一步。',
  },
  {
    title: '包容合併（OR 合併閘道）',
    desc: '等待所有「曾觸發」的包容分支路徑都到達後合併。Excel 標記：`包容合併來自多個分支，序列流向 Z`。',
  },
  {
    title: '流程開始',
    desc: '流程的起始點。設定第一個任務目標。每個流程圖必須有且僅能有一個流程開始節點。',
  },
  {
    title: '流程結束',
    desc: '流程的正常結束點。不需設定下一步。每個流程圖至少需要一個流程結束或流程斷點節點。',
  },
  {
    title: '流程斷點',
    desc: '非正常結束（如等待外部事件、流程暫停）。可選填下一步及斷點原因說明。任務關聯說明欄自動產生「【流程斷點：原因】」。',
  },
  {
    title: '子流程調用',
    desc: '調用另一個獨立的 L3 子流程。填寫**子流程 L3 編號**（例 `5-3-2`），並設定子流程完成後返回的下一步任務。**此任務自動繪為 L3 活動元件**（雙邊書擋矩形）。任務關聯說明自動產生「調用子流程 5-3-2，返回後序列流向 Y」。',
  },
  {
    title: '迴圈返回',
    desc: '**迴圈返回不是獨立閘道元件**，而是一般任務上加一條 back-edge。只需選擇「迴圈返回至」的目標任務（單一）；如需同時保留正向繼續，應改用「條件分支」（排他閘道）。任務關聯說明自動產生「迴圈返回，序列流向 X」。',
  },
];

// User-facing list of in-canvas / drawer edit actions.
// Internal routing / corridor rules moved to HANDOVER.md (developer reference)
// because users now drag endpoints / change targets directly — exposing the
// auto-routing matrix only added noise.
const EDITABLE_ACTIONS = [
  {
    title: '拖曳排序任務',
    desc: '在右側「✏️ 編輯」面板的「設定流程」分頁，按住任務左側的 ⠿ 拖曳改變順序。中間會出現一條藍色橫線指示**插入位置**。順序改了之後 L4 編號自動重排（除非曾經 Excel 匯入帶入特定編號）。',
  },
  {
    title: '拖曳排序泳道角色',
    desc: '「設定泳道角色」分頁同樣可拖曳 ⠿ 改變泳道由上到下的順序。任務的角色綁定（task.roleId）不變，只是視覺位置調整。',
  },
  {
    title: '點任務元件 → 彈出編輯選單',
    desc: '在流程圖上**點任務矩形 / 開始 / 結束 / 閘道**會彈出小選單，可直接編輯名稱 / 角色 / 重點說明（hover 時顯示），以及在前面新增、在後面新增、新增一條連線、新增閘道（兩條連線）、刪除元件。新增的元件會自動接好連線避免孤兒。',
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
    title: '重設手動端點',
    desc: '若覆寫端點造成違規（紅線），選中該連線後右上角提示列會多「重設此連線端點」按鈕；流程圖上方還有「重設所有手動端點」全清按鈕（僅當有 override 時顯示）。',
  },
];

// User-facing list of "rules you must not break" — surfaces the violation
// detector logic so users know what triggers red lines / save warnings.
const FORBIDDEN_RULES = [
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
    desc: '一般任務 `1-1-1-1`、開始 `-0`、結束 `-99`、閘道 `1-1-1-X_g`（單 / 連續加 _g1 _g2）、僅接受橫線分隔。詳見上方「編號規則」表。',
  },
];

const EXPORTS = [
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

// ─── Component ────────────────────────────────────────────────────────────────

function Section({ title, children }) {
  return (
    <div className="mb-6">
      <h3 className="font-bold text-gray-700 border-b border-gray-200 pb-1 mb-3 text-sm uppercase tracking-wide">
        {title}
      </h3>
      {children}
    </div>
  );
}

export default function HelpPanel() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="px-3 py-2 rounded-lg text-white text-sm font-medium transition-colors"
        style={{ background: '#3470B5' }}
        onMouseEnter={e => e.currentTarget.style.background = '#5B8AC9'}
        onMouseLeave={e => e.currentTarget.style.background = '#3470B5'}
        title="查看規則說明">
        規則說明
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.45)' }}
          onClick={e => { if (e.target === e.currentTarget) setOpen(false); }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <div>
                <h2 className="text-lg font-bold text-gray-800">規則說明 / Rules Reference</h2>
                <p className="text-xs text-gray-400 mt-0.5">本頁說明與系統實際規則同步，如有更新將一併修訂</p>
              </div>
              <button onClick={() => setOpen(false)}
                className="text-gray-400 hover:text-gray-600 text-xl font-bold leading-none px-2">
                ×
              </button>
            </div>

            {/* Scrollable body */}
            <div className="overflow-y-auto px-6 py-5 text-sm text-gray-700 flex-1">

              {/* ── 1. Hierarchy ── */}
              <Section title="層級架構 Hierarchy">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-500 text-xs">
                      <th className="pb-1 w-12">層級</th>
                      <th className="pb-1 w-24">名稱</th>
                      <th className="pb-1">說明</th>
                    </tr>
                  </thead>
                  <tbody>
                    {HIERARCHY.map(h => (
                      <tr key={h.level} className="border-t border-gray-100">
                        <td className="py-1.5 font-bold text-indigo-600">{h.level}</td>
                        <td className="py-1.5 font-medium">{h.name}</td>
                        <td className="py-1.5 text-gray-500">{h.desc}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Section>

              {/* ── 1b. Numbering ── */}
              <Section title="編號規則 Numbering">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-500 text-xs">
                      <th className="pb-1 w-36">類型</th>
                      <th className="pb-1">規則</th>
                      <th className="pb-1 w-44">範例</th>
                    </tr>
                  </thead>
                  <tbody>
                    {NUMBERING.map(n => (
                      <tr key={n.kind} className="border-t border-gray-100">
                        <td className="py-1.5 font-medium text-gray-700">{n.kind}</td>
                        <td className="py-1.5 text-gray-600">{n.rule}</td>
                        <td className="py-1.5 font-mono text-xs text-indigo-600">{n.example}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="text-xs text-gray-400 mt-2">
                  Excel 匯入時會驗證所有編號格式；舊資料（點分隔 / 閘道缺 `_g`）載入時自動遷移為新格式。
                </p>
              </Section>

              {/* ── 2. Elements ── */}
              <Section title="流程圖元件定義 Elements">
                <div className="grid gap-2">
                  {ELEMENTS.map(el => (
                    <div key={el.type} className="flex gap-3 bg-gray-50 rounded-lg px-3 py-2">
                      <div className="w-28 flex-shrink-0 font-medium text-gray-800">{el.type}</div>
                      <div className="flex-1">
                        <div className="text-gray-500 text-xs mb-0.5">
                          形狀：{el.shape}　顏色：{el.color}
                        </div>
                        <div>{el.purpose}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </Section>

              {/* ── 3. Validation ── */}
              <Section title="驗證規則 Validation">
                <p className="text-xs text-gray-400 mb-2">
                  FlowEditor 按「儲存」時跑兩層檢核：<span className="text-red-700 font-medium">Blocking</span> 擋儲存、<span className="text-amber-700 font-medium">Warning</span> 跳 modal 由使用者決定是否仍然儲存。<span className="text-gray-600 font-medium">Import</span> 只在 Excel 匯入時檢查。
                </p>
                <div className="grid gap-2">
                  {VALIDATION.map((v, i) => {
                    const style = v.tier === 'blocking'
                      ? { bg: 'bg-red-50',    border: 'border-red-100',    badgeBg: 'bg-red-200',    badgeText: 'text-red-700',    ruleText: 'text-red-800',    label: 'Blocking' }
                      : v.tier === 'warning'
                      ? { bg: 'bg-amber-50',  border: 'border-amber-100',  badgeBg: 'bg-amber-200',  badgeText: 'text-amber-700',  ruleText: 'text-amber-800',  label: 'Warning' }
                      : { bg: 'bg-gray-50',   border: 'border-gray-200',   badgeBg: 'bg-gray-200',   badgeText: 'text-gray-700',   ruleText: 'text-gray-800',   label: 'Import' };
                    return (
                      <div key={i} className={`flex gap-3 ${style.bg} border ${style.border} rounded-lg px-3 py-2`}>
                        <div className={`px-2 py-0.5 h-fit rounded ${style.badgeBg} ${style.badgeText} text-[10px] font-bold flex-shrink-0`}>
                          {style.label}
                        </div>
                        <div>
                          <div className={`font-medium ${style.ruleText}`}>{v.rule}</div>
                          <div className="text-gray-500 text-xs mt-0.5">{v.detail}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Section>

              {/* ── 4. Connections ── */}
              <Section title="連線規則 Connections">
                <div className="grid gap-2">
                  {CONNECTIONS.map((c, i) => (
                    <div key={i} className="bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
                      <div className="font-medium text-blue-800 mb-0.5">{c.title}</div>
                      <div className="text-gray-600">{c.desc}</div>
                    </div>
                  ))}
                </div>
              </Section>

              {/* ── 5. Editable Actions + Forbidden Rules ── */}
              <Section title="可編輯操作 Editable Actions">
                <p className="text-xs text-gray-400 mb-2">
                  畫面上可直接操作的編輯動作（不必再回到 Excel 修改）
                </p>
                <div className="grid gap-2 mb-4">
                  {EDITABLE_ACTIONS.map((a, i) => (
                    <div key={i} className="bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
                      <div className="font-medium text-blue-800 mb-0.5">{a.title}</div>
                      <div className="text-gray-600 text-xs leading-relaxed">{a.desc}</div>
                    </div>
                  ))}
                </div>

                <p className="text-xs text-gray-500 font-medium mb-1 mt-3">不能違反的規則 Forbidden Rules</p>
                <div className="grid gap-2">
                  {FORBIDDEN_RULES.map((r, i) => (
                    <div key={i} className="bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                      <div className="flex gap-2 items-baseline">
                        <span className="font-medium text-red-800">{r.title}</span>
                        <span className="text-xs font-mono px-1.5 py-0.5 rounded bg-red-100 text-red-700">{r.impact}</span>
                      </div>
                      <div className="text-gray-600 text-xs mt-0.5 leading-relaxed">{r.desc}</div>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-gray-400 mt-2">
                  自動路由細節（exit / entry side、corridor slot 分配）已轉為內部開發者文件，請參考 HANDOVER.md。
                </p>
              </Section>

              {/* ── 6. Exports ── */}
              <Section title="匯出格式 Export">
                <div className="grid gap-2">
                  {EXPORTS.map((ex, i) => (
                    <div key={i} className="bg-green-50 border border-green-100 rounded-lg px-3 py-2">
                      <div className="flex gap-2 items-baseline">
                        <span className="font-medium text-green-800">{ex.format}</span>
                        <span className="font-mono text-xs text-green-600">{ex.ext}</span>
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5">支援工具：{ex.tool}</div>
                      <div className="text-gray-600 text-xs mt-0.5">{ex.note}</div>
                    </div>
                  ))}
                </div>
              </Section>

            </div>

            {/* Footer */}
            <div className="px-6 py-3 border-t border-gray-100 flex justify-end">
              <button onClick={() => setOpen(false)}
                className="px-5 py-2 rounded-lg text-white text-sm font-medium transition-colors"
                style={{ background: '#2A5598' }}
                onMouseEnter={e => e.currentTarget.style.background = '#1E4677'}
                onMouseLeave={e => e.currentTarget.style.background = '#2A5598'}>
                關閉
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

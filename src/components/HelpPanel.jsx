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
 *   VALIDATION   — Wizard step-2→step-3 validation checks
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

const ELEMENTS = [
  {
    type: '開始事件',
    shape: '圓形（空心）',
    color: '#D1FAE5 / 綠框',
    purpose: '流程的唯一起點。每張圖必須有且僅能有一個。流程設定選「流程開始」。',
  },
  {
    type: '結束事件',
    shape: '圓形（實心深色）',
    color: '#111827 填色',
    purpose: '流程的終點。每張圖必須至少有一個。流程設定選「流程結束」或「流程斷點」。',
  },
  {
    type: 'L4 任務',
    shape: '圓角矩形',
    color: '#DBEAFE / 藍框',
    purpose: '一般業務步驟，自動帶入 L4 編號（L3編號-序號，例如 1-1-1-1）。流程設定選「序列流向」或「子流程調用」或「迴圈返回」。',
  },
  {
    type: '互動任務',
    shape: '圓角矩形（淺紫底）',
    color: '#EDE9FE / 藍框',
    purpose: '涉及系統互動或跨角色協作的任務節點。流程設定同 L4 任務。',
  },
  {
    type: 'L3 活動',
    shape: '書端矩形（左右側垂直分隔線）',
    color: '#FFFFFF / 深灰框',
    purpose: '引用另一張 L3 活動（Call Activity / BPMN 書端圖形）。流程設定選「序列流向」或「子流程調用」。',
  },
  {
    type: '排他閘道（XOR）',
    shape: '菱形（內含 × 符號）',
    color: '#FEF3C7 / 橙框',
    purpose: '條件分支：每次只走一個路徑。設定「條件分支」（每條件需標籤）或「條件合併」（匯入多條件分支）。不帶 L4 編號。',
  },
  {
    type: '並行閘道（AND）',
    shape: '菱形（內含 + 符號）',
    color: '#FEF3C7 / 橙框',
    purpose: '並行分支：同時啟動所有路徑。設定「並行分支」（無需條件標籤）或「並行合併」（匯入多並行分支）。不帶 L4 編號。',
  },
  {
    type: '包容閘道（OR）',
    shape: '菱形（內含 ○ 符號）',
    color: '#FEF3C7 / 橙框',
    purpose: '包容分支：一或多條路徑同時啟動（由條件決定）。設定同 XOR 條件分支，條件標籤說明觸發條件。不帶 L4 編號。',
  },
];

const VALIDATION = [
  {
    rule: '必須有開始事件',
    detail: '流程中至少需要一個流程設定為「流程開始」的節點，否則無法進入圖表預覽。',
  },
  {
    rule: '必須有結束事件',
    detail: '流程中至少需要一個流程設定為「流程結束」或「流程斷點」的節點，否則無法進入圖表預覽。',
  },
  {
    rule: '非結束節點必須設定下一步',
    detail: '流程設定為「序列流向」、「條件分支」、「並行分支」、「子流程調用」、「迴圈返回」、「並行合併」、「條件合併」、「流程開始」的節點，都必須設定至少一個有效目標。「流程斷點」的下一步為選填。',
  },
  {
    rule: '並行合併：必須有 2 個以上來源',
    detail: '流程設定為「並行合併」的節點，必須被至少 2 個其他節點的並行分支指向，否則驗證不通過。',
  },
  {
    rule: '條件合併：必須有 2 個以上條件分支來源',
    detail: '流程設定為「條件合併」的節點，必須被至少 2 個「條件分支」節點的條件出口指向，否則驗證不通過。',
  },
  {
    rule: '每個節點都必須被連接（有來源）',
    detail: '除了「流程開始」節點之外，每個節點都必須被至少一條連線指向（即有入口）。孤立節點無法通過驗證。',
  },
  {
    rule: '條件分支標籤必填',
    detail: '流程設定為「條件分支」的節點，每個分支條件都必須填寫標籤文字。並行分支（AND 閘道）不需要條件標籤。',
  },
];

const CONNECTIONS = [
  {
    title: '序列流向',
    desc: '最常用的連接類型。選擇單一「下一步任務」，畫出一條從右向左的序列箭頭。形狀可選 L4 任務、互動任務、L3 活動。',
  },
  {
    title: '條件分支（XOR / OR 閘道）',
    desc: '可新增多個分支，每個分支設定「條件標籤」與「目標任務」。每次流程只走一條路徑（XOR）或符合條件者（OR）。每個條件標籤必填。',
  },
  {
    title: '並行分支（AND 閘道）',
    desc: '同時啟動多個並行目標，不需條件標籤。所有目標任務並行執行。',
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
    desc: '調用另一個獨立的子流程。填寫子流程名稱，並設定子流程完成後返回的下一步任務。形狀可選 L4 任務、L3 活動。任務關聯說明自動產生「調用子流程 X，返回後序列流向 Y」。',
  },
  {
    title: '迴圈返回（XOR 迴圈）',
    desc: '條件判斷後兩種出口：若「未通過」則返回之前的任務（往前跳轉）；若「通過」則繼續往下。可填寫迴圈條件說明。任務關聯說明自動產生「條件判斷：若未通過則返回 X，若通過則序列流向 Y」。',
  },
];

/**
 * ROUTING RULES — sync with getGatewayExitEntry() in layout.js
 *
 * dr = toRow - fromRow (正 = 下方角色, 負 = 上方角色)
 * dc = toCol - fromCol (正 = 右邊欄位, 負 = 左邊/往前)
 */
const ROUTING = [
  { condition: 'dr=0, dc=1（同角色，相鄰向右）',   exit: '右',   entry: '左',   note: '直線水平連線' },
  { condition: 'dr=0, dc≠1（同角色，跳欄或往前）', exit: '下',   entry: '下',   note: '於泳道下方繞行；多條時垂直錯開（slot 制）' },
  { condition: 'dr<0, dc=1（上方角色，相鄰向右）',  exit: '上',   entry: '左',   note: '折線：先往上再往左' },
  { condition: 'dr<0, dc≠1（上方角色，其他）',      exit: '上',   entry: '上',   note: '從兩節點上方走廊通過' },
  { condition: 'dr>0, dc=1（下方角色，相鄰向右）',  exit: '下',   entry: '左',   note: '折線：先往下再往左' },
  { condition: 'dr>0, dc≠1（下方角色，其他）',      exit: '下',   entry: '下',   note: '於下方角色泳道底部繞行' },
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
        className="px-3 py-2 rounded-lg border border-gray-300 text-gray-600 text-sm hover:bg-gray-100 transition-colors"
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
                <p className="text-xs text-gray-400 mb-2">下列條件不滿足時，新增活動精靈中無法前進至「圖表預覽」步驟（既有活動可直接在編輯頁儲存）</p>
                <div className="grid gap-2">
                  {VALIDATION.map((v, i) => (
                    <div key={i} className="flex gap-3 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                      <div className="w-6 h-6 rounded-full bg-red-200 text-red-700 text-xs font-bold flex items-center justify-center flex-shrink-0">
                        {i + 1}
                      </div>
                      <div>
                        <div className="font-medium text-red-800">{v.rule}</div>
                        <div className="text-gray-500 text-xs mt-0.5">{v.detail}</div>
                      </div>
                    </div>
                  ))}
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

              {/* ── 5. Gateway Routing ── */}
              <Section title="判斷框指向規則 Gateway Routing">
                <p className="text-xs text-gray-400 mb-2">
                  dr = 目標角色列 − 來源角色列（正 = 下方）　dc = 目標欄 − 來源欄（正 = 右側，往前 = 負）
                </p>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-gray-500">
                      <th className="pb-1">條件</th>
                      <th className="pb-1 w-14 text-center">出口</th>
                      <th className="pb-1 w-14 text-center">入口</th>
                      <th className="pb-1">備註</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ROUTING.map((r, i) => (
                      <tr key={i} className="border-t border-gray-100">
                        <td className="py-1.5 font-mono text-gray-700">{r.condition}</td>
                        <td className="py-1.5 text-center font-medium text-indigo-600">{r.exit}</td>
                        <td className="py-1.5 text-center font-medium text-indigo-600">{r.entry}</td>
                        <td className="py-1.5 text-gray-500">{r.note}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="text-xs text-gray-400 mt-2">
                  同角色多條下繞線採 slot 制排列（長距離者排於最外側），泳道高度自動擴展以防重疊。
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
                className="px-5 py-2 rounded-lg text-white text-sm font-medium"
                style={{ background: '#4A5240' }}>
                關閉
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

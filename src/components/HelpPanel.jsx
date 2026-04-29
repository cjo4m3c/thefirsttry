import { useState } from 'react';
import {
  HIERARCHY,
  NUMBERING,
  ELEMENTS,
  VALIDATION,
  CONNECTIONS,
  EDITABLE_ACTIONS,
  FORBIDDEN_RULES,
  EXPORTS,
} from '../data/helpPanelData.js';

/**
 * HelpPanel — Rules Reference Modal
 *
 * 規則 data 全部住在 src/data/helpPanelData.js，章節對應 docs/business-spec.md。
 * 改規則：先改 spec doc → 同步 helpPanelData.js → 加 changelog。本檔只放 UI render。
 */

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

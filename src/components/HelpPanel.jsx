import { useState } from 'react';
import { Modal, ModalBody, ModalFoot } from './ui/Modal.jsx';
import { Button } from './ui/Button.jsx';
import {
  HIERARCHY,
  NUMBERING,
  ELEMENTS,
  VALIDATION,
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
      <h3 className="font-bold text-ink border-b border-line pb-1 mb-3 text-sm uppercase tracking-wide">
        {title}
      </h3>
      {children}
    </div>
  );
}

/**
 * Render long-form content as either a single paragraph (string) or a
 * bullet list (string[]). Lets helpPanelData mark which entries deserve
 * scannable bullets vs. flowing prose. Strings stay backward-compatible.
 */
function Content({ value, className = '' }) {
  if (Array.isArray(value)) {
    return (
      <ul className={`list-disc pl-5 space-y-1 ${className}`}>
        {value.map((item, i) => <li key={i}>{item}</li>)}
      </ul>
    );
  }
  return <div className={className}>{value}</div>;
}

// 2026-05-18 改 controlled — 由 InfoDropdown 控制 open state、把 trigger
// button 抽出去（一顆 dropdown 包 3 個 modal）。原本內建按鈕已移除。
export default function HelpPanel({ isOpen = false, onClose = () => {} }) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      width={768}
      title="業務規則 / Business Rules"
      subtitle="本頁說明與系統實際規則同步，如有更新將一併修訂"
    >
      <ModalBody>

              {/* ── 1. Hierarchy ── */}
              <Section title="層級架構 Hierarchy">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-ink-soft text-xs">
                      <th className="pb-1 w-12">層級</th>
                      <th className="pb-1 w-24">名稱</th>
                      <th className="pb-1">說明</th>
                    </tr>
                  </thead>
                  <tbody>
                    {HIERARCHY.map(h => (
                      <tr key={h.level} className="border-t border-line-dim">
                        <td className="py-1.5 font-bold text-brand">{h.level}</td>
                        <td className="py-1.5 font-medium">{h.name}</td>
                        <td className="py-1.5 text-ink-soft">{h.desc}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Section>

              {/* ── 1b. Numbering ── */}
              <Section title="編號規則 Numbering">
                <div className="grid gap-2">
                  {NUMBERING.map(n => (
                    <div key={n.kind} className="flex gap-3 bg-paper-2 rounded-lg px-3 py-2">
                      <div className="w-32 flex-shrink-0 font-medium text-ink">{n.kind}</div>
                      <div className="flex-1">
                        <Content value={n.rule} className="text-ink-soft" />
                        <div className="mt-1 text-xs text-ink-soft">
                          範例：
                          <span className="font-mono text-brand">
                            {Array.isArray(n.example) ? n.example.join('、') : n.example}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-ink-faint mt-2">
                  Excel 匯入時會驗證所有編號格式；舊資料（點分隔、閘道缺 _g）載入時自動遷移為新格式。
                </p>
              </Section>

              {/* ── 2. Elements ── */}
              <Section title="流程圖元件定義 Elements">
                <div className="grid gap-2">
                  {ELEMENTS.map(el => (
                    <div key={el.type} className="flex gap-3 bg-paper-2 rounded-lg px-3 py-2">
                      <div className="w-28 flex-shrink-0 font-medium text-ink">{el.type}</div>
                      <div className="flex-1">
                        <div className="text-ink-soft text-xs mb-0.5">
                          形狀：{el.shape}　顏色：{el.color}
                        </div>
                        <Content value={el.purpose} />
                      </div>
                    </div>
                  ))}
                </div>
              </Section>

              {/* ── 3. Validation ── */}
              <Section title="驗證規則 Validation">
                <p className="text-xs text-ink-faint mb-2">
                  FlowEditor 按「儲存」時跑兩層檢核：<span className="text-danger-ink font-medium">Blocking</span> 擋儲存、<span className="text-warning-ink font-medium">Warning</span> 跳 modal 由使用者決定是否仍然儲存。<span className="text-ink-soft font-medium">Import</span> 只在 Excel 匯入時檢查。
                </p>
                <div className="grid gap-2">
                  {VALIDATION.map((v, i) => {
                    const style = v.tier === 'blocking'
                      ? { bg: 'bg-danger-soft',    border: 'border-danger',    badgeBg: 'bg-danger',    badgeText: 'text-danger-ink',    ruleText: 'text-danger-ink',    label: 'Blocking' }
                      : v.tier === 'warning'
                      ? { bg: 'bg-warning-soft',  border: 'border-warning',  badgeBg: 'bg-warning',  badgeText: 'text-warning-ink',  ruleText: 'text-warning-ink',  label: 'Warning' }
                      : { bg: 'bg-paper-2',   border: 'border-line',   badgeBg: 'bg-paper-2',   badgeText: 'text-ink',   ruleText: 'text-ink',   label: 'Import' };
                    return (
                      <div key={i} className={`flex gap-3 ${style.bg} border ${style.border} rounded-lg px-3 py-2`}>
                        <div className={`px-2 py-0.5 h-fit rounded ${style.badgeBg} ${style.badgeText} text-[11px] font-bold flex-shrink-0`}>
                          {style.label}
                        </div>
                        <div>
                          <div className={`font-medium ${style.ruleText}`}>{v.rule}</div>
                          <Content value={v.detail} className="text-ink-soft text-xs mt-0.5" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Section>

              {/* ── 5. Editable Actions + Forbidden Rules ── */}
              <Section title="可編輯操作 Editable Actions">
                <p className="text-xs text-ink-faint mb-2">
                  畫面上可直接操作的編輯動作（不必再回到 Excel 修改）
                </p>
                <div className="grid gap-2 mb-4">
                  {EDITABLE_ACTIONS.map((a, i) => (
                    <div key={i} className="bg-info-soft border border-info rounded-lg px-3 py-2">
                      <div className="font-medium text-info-ink mb-0.5">{a.title}</div>
                      <Content value={a.desc} className="text-ink-soft text-xs leading-relaxed" />
                    </div>
                  ))}
                </div>

                <p className="text-xs text-ink-soft font-medium mb-1 mt-3">不能違反的規則 Forbidden Rules</p>
                <div className="grid gap-2">
                  {FORBIDDEN_RULES.map((r, i) => (
                    <div key={i} className="bg-danger-soft border border-danger rounded-lg px-3 py-2">
                      <div className="flex gap-2 items-baseline">
                        <span className="font-medium text-danger-ink">{r.title}</span>
                        <span className="text-xs font-mono px-1.5 py-0.5 rounded bg-danger-soft text-danger-ink">{r.impact}</span>
                      </div>
                      <Content value={r.desc} className="text-ink-soft text-xs mt-0.5 leading-relaxed" />
                    </div>
                  ))}
                </div>
                <p className="text-xs text-ink-faint mt-2">
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
                      <div className="text-xs text-ink-soft mt-0.5">支援工具：{ex.tool}</div>
                      <Content value={ex.note} className="text-ink-soft text-xs mt-0.5" />
                    </div>
                  ))}
                </div>
              </Section>

      </ModalBody>
      <ModalFoot>
        <Button variant="primary" onClick={onClose}>關閉</Button>
      </ModalFoot>
    </Modal>
  );
}

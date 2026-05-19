/**
 * FlowTable cell renderers — EditCell / ReadCell / RoleCell。
 * 拆自 FlowTable.jsx（PR #237、§6 拆檔）。
 */
import { useState, useEffect, useRef } from 'react';
import { autoSpace } from '../../utils/autoSpace.js';
import { cellStickyStyle } from './sticky.js';

// EditCell — buffered textarea. Local state holds the typing in-flight; we
// only patch back to liveFlow on blur to avoid a re-layout per keystroke.
// `value` change from outside re-syncs the buffer.
// `autoFit` (per-table user toggle) → textarea auto-grows to scrollHeight
// so long content shows in full without internal scroll. When false, falls
// back to fixed `rows={2}` and any user-applied `resize-y` size.
export function EditCell({ value, onChange, placeholder = '', wide = false, sticky = null, autoFit = false }) {
  const [local, setLocal] = useState(value || '');
  useEffect(() => { setLocal(value || ''); }, [value]);
  const taRef = useRef(null);
  // Auto-fit: re-measure scrollHeight on every value change AND on mode
  // toggle. When mode flips off, clear the inline height so rows={2} +
  // any manual resize-y wins again.
  useEffect(() => {
    const el = taRef.current;
    if (!el) return;
    if (autoFit) {
      el.style.height = 'auto';
      el.style.height = el.scrollHeight + 'px';
    } else {
      el.style.height = '';
    }
  }, [autoFit, local]);
  // 欄寬由 <table tableLayout: fixed> + <colgroup> 統一決定（user-resizable
  // via useColumnWidths）；cell 自己**不再帶 min-w-*** — 否則瀏覽器在
  // table-layout: fixed 下仍把 min-width 當下限、非 sticky 欄無法縮窄。
  return (
    <td
      className={`border border-gray-200 px-1 py-0.5 align-top bg-white`}
      style={cellStickyStyle(sticky)}
    >
      <textarea
        ref={taRef}
        value={local}
        onChange={e => setLocal(e.target.value)}
        onBlur={() => { if (local !== (value || '')) onChange(local); }}
        placeholder={placeholder}
        rows={2}
        className="w-full px-1.5 py-1 text-base border border-gray-200 rounded bg-white focus:outline-none focus:ring-1 focus:ring-blue-300 resize-y"
      />
    </td>
  );
}

export function ReadCell({ value, muted = false, wide = false, sticky = null, danger = false, title = undefined }) {
  // 欄寬由 colgroup 統一決定、cell 不帶 min-w-*（參見 EditCell 同邏輯）。
  // `wide` 參數保留但不再影響寬度（給未來 readability 用、可移除）。
  const bg = muted ? 'bg-gray-50' : 'bg-gray-50';
  // PR-D6 (rule 6): violation cells colour the L4 number text red instead of
  // outlining the row — only the diagram keeps the red border.
  const text = danger ? 'text-red-600 font-semibold'
    : muted ? 'text-gray-400'
    : 'text-gray-700';
  return (
    <td
      className={`border border-gray-200 px-2 py-1.5 text-base whitespace-pre-wrap align-top ${bg} ${text}`}
      style={cellStickyStyle(sticky)}
      title={title}
    >
      {autoSpace(value)}
    </td>
  );
}

export function RoleCell({ roleId, roles, onChange }) {
  return (
    <td className="border border-gray-200 px-1 py-0.5 align-top bg-white">
      <select
        value={roleId || ''}
        onChange={e => onChange(e.target.value)}
        className="w-full px-1.5 py-1 text-base border border-gray-200 rounded bg-white focus:outline-none focus:ring-1 focus:ring-blue-300"
      >
        <option value="">（無）</option>
        {roles.filter(r => r.name).map(r => (
          <option key={r.id} value={r.id}>{r.name}</option>
        ))}
      </select>
    </td>
  );
}

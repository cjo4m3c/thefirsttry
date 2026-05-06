import { useState } from 'react';
import ConnectionSection from '../ConnectionSection.jsx';
import { ReorderButtons } from '../reorderButtons.jsx';
import { CONN_ROW_BG } from '../../utils/taskDefs.js';
import { ELEMENT_TYPES, detectElementKind, makeTypeChange, applyRoleChange } from '../../utils/elementTypes.js';

// Card background per element category. PR (2026-05-05): row colour now
// distinguishes external interaction (cool slate) from regular L4 task
// (default light grey) — earlier they shared the same `sequence` row bg
// and looked identical in the editor despite rendering differently on
// the diagram. Gateways / start / end / l3activity keep their existing
// connectionType-driven palette via CONN_ROW_BG.
const INTERACTION_ROW_BG = '#F1F5F9';   // slate-100, mirrors diagram's `#A0A0A0` interaction fill in a lighter form

// ── TaskCard ────────────────────────────────────────
export default function TaskCard({ task, roles, allTasks, displayLabels, onUpdate, onRemove, canRemove,
  canMoveUp, canMoveDown, onMoveUp, onMoveDown }) {
  const ct = task.connectionType || 'sequence';
  const num = displayLabels[task.id];
  const rowBg = ct === 'sequence' && task.shapeType === 'interaction'
    ? INTERACTION_ROW_BG
    : CONN_ROW_BG[ct] || '#FAFAFA';
  const nameOptional = ct === 'start' || ct === 'end' || ct === 'breakpoint';
  const currentKind = detectElementKind(task);
  // Show legacy 'breakpoint' option only when the task already is one (phased
  // out 2026-04-29; new ones can't be created from any UI).
  const elementOptions = currentKind === 'breakpoint'
    ? [...ELEMENT_TYPES, { value: 'breakpoint', label: '流程斷點（停用，僅相容舊資料）' }]
    : ELEMENT_TYPES;
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className="rounded-lg border border-gray-200 overflow-hidden select-none"
      style={{ background: rowBg }}>

      {/* All three rows share the same 5-column flex layout so columns
          align vertically:
            col 1: ReorderButtons / spacer   (w-5)
            col 2: L4 number                 (w-24)
            col 3: role / connection-type    (w-40)
            col 4: name / shape-type / target select (flex-1 min-w-0)
            col 5: action buttons / spacer   (w-14)  ← ▼ + ✕ 24+24+gap8 + safety
          ConnectionSection inherits this layout via the wrapper below. */}

      {/* Row 1: reorder + L4 number + role + name + actions */}
      <div className="flex items-center gap-2 px-2 pt-2 min-w-0">
        <ReorderButtons canUp={canMoveUp} canDown={canMoveDown} onUp={onMoveUp} onDown={onMoveDown} />

        {/* col 2: L4 number — PR (2026-05-05): show for ALL element types
            (was: gateway / start / end / subprocess showed coloured badge
            label only, hiding the actual number). Mono font, truncates
            if overflow. */}
        <div className="w-24 flex-shrink-0 flex items-center">
          <span className="text-sm font-mono text-gray-600 font-semibold whitespace-nowrap truncate">
            {num || ''}
          </span>
        </div>

        {/* col 3: Role — applyRoleChange auto-syncs shapeType when moving
            between internal / external lanes (task ↔ interaction). */}
        <select value={task.roleId} onChange={e => onUpdate(applyRoleChange(task, e.target.value, roles))}
          className="w-40 flex-shrink-0 px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-400">
          <option value="">角色 *</option>
          {roles.filter(r => r.name).map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>

        {/* col 4: Name */}
        <input type="text" placeholder={nameOptional ? '名稱（選填）' : '任務名稱 *'}
          value={task.name} onChange={e => onUpdate({ ...task, name: e.target.value })}
          className="flex-1 min-w-0 px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-400" />

        {/* col 5: actions (expand / remove) */}
        <button onClick={() => setExpanded(v => !v)}
          title={expanded ? '收合詳細欄位' : '展開詳細欄位'}
          className="w-6 flex-shrink-0 text-gray-400 hover:text-gray-600 text-base">
          {expanded ? '▲' : '▼'}
        </button>
        <button onClick={onRemove} disabled={!canRemove}
          className="w-6 flex-shrink-0 text-red-400 hover:text-red-600 disabled:opacity-20 disabled:cursor-not-allowed text-base">✕</button>
      </div>

      {/* Row 2: unified 元件類型 select (mirrors InsertPicker / ConvertSubForm).
          Replaces the previous connectionType + shapeType pair so the editor's
          mental model matches "選元件，系統填預設關聯文字" — one knob, not two. */}
      <div className="flex items-center gap-2 px-2 pt-1.5 pb-2 min-w-0">
        <div className="w-5 flex-shrink-0" aria-hidden="true" />          {/* col 1: reorder spacer */}
        <div className="w-24 flex-shrink-0 text-sm text-gray-600 pl-1">元件類型</div>

        {/* col 3 + col 4: element-type select stretches across both cols
            so all 8 labels (some long: "L3 流程（子流程調用）") fit comfortably */}
        <select value={currentKind}
          onChange={e => onUpdate(makeTypeChange(task, e.target.value))}
          className="flex-1 min-w-0 px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-400">
          {elementOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
        </select>
      </div>

      {/* Row 3: Connection config — wrapper provides reorder spacer; the inner
          ConnectionSection lays out its own [label | optional mid | select]
          using the same w-24 / w-40 / flex-1 pattern so labels align
          with the badge column and the inputs align with the name column. */}
      <div className="flex items-start gap-2 px-2 pb-2.5 min-w-0">
        <div className="w-5 flex-shrink-0" aria-hidden="true" />          {/* col 1: reorder spacer */}
        <div className="flex-1 min-w-0">
          <ConnectionSection task={task} allTasks={allTasks} displayLabels={displayLabels} onUpdate={onUpdate} />
        </div>
      </div>

      {/* PR (2026-05-05): removed the auto-generated 「關聯說明」 preview row.
          The same text still appears in FlowTable's 任務關聯說明 column and on
          PNG / drawio / Excel export, so duplicating it under each TaskCard
          was redundant noise. */}

      {/* Expandable detail fields */}
      {expanded && (
        <div className="px-3 pb-3 pt-1 border-t border-gray-100 grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1">
            <span className="text-sm text-gray-500">任務重點說明</span>
            <input type="text" value={task.description || ''} placeholder="重點說明（選填）"
              onChange={e => onUpdate({ ...task, description: e.target.value })}
              className="px-2 py-1 border border-gray-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-300" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm text-gray-500">任務重要輸入</span>
            <input type="text" value={task.inputItems || ''} placeholder="重要輸入（選填）"
              onChange={e => onUpdate({ ...task, inputItems: e.target.value })}
              className="px-2 py-1 border border-gray-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-300" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm text-gray-500">任務產出成品</span>
            <input type="text" value={task.outputItems || ''} placeholder="產出成品（選填）"
              onChange={e => onUpdate({ ...task, outputItems: e.target.value })}
              className="px-2 py-1 border border-gray-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-300" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm text-gray-500">參考資料來源文件名稱</span>
            <input type="text" value={task.reference || ''} placeholder="參考文件（選填）"
              onChange={e => onUpdate({ ...task, reference: e.target.value })}
              className="px-2 py-1 border border-gray-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-300" />
          </label>
        </div>
      )}
    </div>
  );
}

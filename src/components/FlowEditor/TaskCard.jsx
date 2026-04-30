import { useState } from 'react';
import ConnectionSection from '../ConnectionSection.jsx';
import { DragHandle } from '../dragReorder.jsx';
import { CONN_BADGE, CONN_ROW_BG } from '../../utils/taskDefs.js';
import { ELEMENT_TYPES, detectElementKind, makeTypeChange } from '../../utils/elementTypes.js';
import { formatConnection } from '../../model/connectionFormat.js';

// ── TaskCard ────────────────────────────────────────
export default function TaskCard({ task, roles, allTasks, displayLabels, onUpdate, onRemove, canRemove, dragHandlers, dragHandleProps, isDragging, dropEdge }) {
  const ct = task.connectionType || 'sequence';
  const badge = CONN_BADGE[ct];
  const num = displayLabels[task.id];
  const rowBg = CONN_ROW_BG[ct] || '#FAFAFA';
  const nameOptional = ct === 'start' || ct === 'end' || ct === 'breakpoint';
  const currentKind = detectElementKind(task);
  // Show legacy 'breakpoint' option only when the task already is one (phased
  // out 2026-04-29; new ones can't be created from any UI).
  const elementOptions = currentKind === 'breakpoint'
    ? [...ELEMENT_TYPES, { value: 'breakpoint', label: '流程斷點（停用，僅相容舊資料）' }]
    : ELEMENT_TYPES;
  const [expanded, setExpanded] = useState(false);
  // Derived "任務關聯說明" — the BPMN sequence-flow text that appears in the
  // FlowTable / Excel / diagram tooltip. Showing it here lets the user see
  // exactly what gets auto-generated as they edit, without bouncing to the
  // table below.
  const annotation = formatConnection(task, allTasks || [], displayLabels || {});

  // dropEdge marks this row as adjacent to the drop slot:
  //   'top'    → drop slot is above this row    (top edge highlighted)
  //   'bottom' → drop slot is below this row    (bottom edge highlighted)
  //   null     → not adjacent
  // The DropLine sibling rendered between rows shows the actual insertion line.
  const dropEdgeClass = dropEdge === 'top'
    ? 'border-t-2 border-blue-500'
    : dropEdge === 'bottom'
      ? 'border-b-2 border-blue-500'
      : 'border-gray-200';

  return (
    <div
      {...dragHandlers}
      className={`rounded-lg border overflow-hidden transition-all select-none
        ${isDragging ? 'opacity-40 scale-95' : ''}
        ${dropEdgeClass}`}
      style={{ background: rowBg }}>

      {/* All three rows share the same 5-column flex layout so columns
          align vertically:
            col 1: DragHandle / spacer       (w-5)
            col 2: badge / Row 3 label       (w-[120px])
            col 3: role / connection-type    (w-40)
            col 4: name / shape-type / target select (flex-1 min-w-0)
            col 5: action buttons / spacer   (w-14)  ← ▼ + ✕ 24+24+gap8 + safety
          ConnectionSection inherits this layout via the wrapper below. */}

      {/* Row 1: drag + badge + role + name + actions */}
      <div className="flex items-center gap-2 px-2 pt-2 min-w-0">
        <DragHandle {...(dragHandleProps || {})} />

        {/* col 2: Badge / number */}
        <div className="w-[120px] flex-shrink-0 flex items-center">
          {ct === 'sequence' && num ? (
            <span className="text-sm font-mono text-gray-500 font-semibold whitespace-nowrap">{num}</span>
          ) : (
            <span className="px-1.5 py-0.5 rounded text-sm font-bold whitespace-nowrap"
              style={{ background: badge.bg, color: badge.text }}>
              {badge.label || num}
            </span>
          )}
        </div>

        {/* col 3: Role */}
        <select value={task.roleId} onChange={e => onUpdate({ ...task, roleId: e.target.value })}
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
        <div className="w-5 flex-shrink-0" aria-hidden="true" />          {/* col 1: drag spacer */}
        <div className="w-[120px] flex-shrink-0 text-xs text-gray-500 pl-1">元件類型</div>

        {/* col 3 + col 4: element-type select stretches across both cols
            so all 8 labels (some long: "L3 流程（子流程調用）") fit comfortably */}
        <select value={currentKind}
          onChange={e => onUpdate(makeTypeChange(task, e.target.value))}
          className="flex-1 min-w-0 px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-400">
          {elementOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
        </select>
      </div>

      {/* Row 3: Connection config — wrapper provides drag spacer; the inner
          ConnectionSection lays out its own [label | optional mid | select]
          using the same w-[120px] / w-40 / flex-1 pattern so labels align
          with the badge column and the inputs align with the name column. */}
      <div className="flex items-start gap-2 px-2 pb-2.5 min-w-0">
        <div className="w-5 flex-shrink-0" aria-hidden="true" />          {/* col 1: drag spacer */}
        <div className="flex-1 min-w-0">
          <ConnectionSection task={task} allTasks={allTasks} displayLabels={displayLabels} onUpdate={onUpdate} />
        </div>
      </div>

      {/* Auto-generated 任務關聯說明 preview — uses the same 5-col layout
          (drag spacer / badge col / role col + name col flex-1 / actions
          col) so the text reads as "below the name column". Italic muted
          gray makes it clear this is system-generated, not editable. */}
      {annotation && (
        <div className="flex items-start gap-2 px-2 pb-2 min-w-0">
          <div className="w-5 flex-shrink-0" aria-hidden="true" />
          <div className="w-[120px] flex-shrink-0 text-xs text-gray-400 italic pt-0.5">關聯說明</div>
          <div className="flex-1 min-w-0 text-xs text-gray-500 italic break-words pt-0.5">{annotation}</div>
        </div>
      )}

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

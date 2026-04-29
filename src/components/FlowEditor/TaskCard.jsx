import { useState } from 'react';
import ConnectionSection from '../ConnectionSection.jsx';
import { DragHandle } from '../dragReorder.jsx';
import { CONNECTION_TYPES, SHAPE_TYPES, CONN_BADGE, CONN_ROW_BG, applyConnectionType } from '../../utils/taskDefs.js';

// ── TaskCard ────────────────────────────────────────
export default function TaskCard({ task, roles, allTasks, displayLabels, onUpdate, onRemove, canRemove, dragHandlers, isDragging, dropEdge }) {
  const ct = task.connectionType || 'sequence';
  const badge = CONN_BADGE[ct];
  const num = displayLabels[task.id];
  const rowBg = CONN_ROW_BG[ct] || '#FAFAFA';
  const nameOptional = ct === 'start' || ct === 'end' || ct === 'breakpoint';
  const showShape = ct === 'sequence' || ct === 'subprocess';
  const [expanded, setExpanded] = useState(false);

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

      {/* Row 1: drag + badge + role + name (wide) + actions */}
      <div className="flex items-center gap-2 px-2 pt-2 min-w-0">
        <DragHandle />

        {/* Badge / number */}
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

        {/* Role — wider (was w-24=96px) so multi-CJK role names fit without
            truncation while still leaving the badge column un-stretched. */}
        <select value={task.roleId} onChange={e => onUpdate({ ...task, roleId: e.target.value })}
          className="w-40 flex-shrink-0 px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-400">
          <option value="">角色 *</option>
          {roles.filter(r => r.name).map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>

        {/* Name — gets all the remaining width on Row 1 */}
        <input type="text" placeholder={nameOptional ? '名稱（選填）' : '任務名稱 *'}
          value={task.name} onChange={e => onUpdate({ ...task, name: e.target.value })}
          className="flex-1 min-w-0 px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-400" />

        {/* Expand / collapse detail fields */}
        <button onClick={() => setExpanded(v => !v)}
          title={expanded ? '收合詳細欄位' : '展開詳細欄位'}
          className="w-6 flex-shrink-0 text-gray-400 hover:text-gray-600 text-base">
          {expanded ? '▲' : '▼'}
        </button>

        {/* Remove */}
        <button onClick={onRemove} disabled={!canRemove}
          className="w-6 flex-shrink-0 text-red-400 hover:text-red-600 disabled:opacity-20 disabled:cursor-not-allowed text-base">✕</button>
      </div>

      {/* Row 2: connection type + shape type (offset to align under name).
          Spacer ≈ drag(~16) + gap(8) + badge w-[120] + gap(8) + role w-40(160) + gap(8) = 320.
          Same spacer reused for the ConnectionSection row below so 序列流向
          / 條件分支至 etc. line up under the task-name input. */}
      <div className="flex items-center gap-2 px-2 pt-1.5 pb-2 min-w-0">
        <div className="w-[300px] flex-shrink-0" aria-hidden="true" />

        {/* Connection type */}
        <select value={ct} onChange={e => onUpdate(applyConnectionType(task, e.target.value))}
          className="w-32 flex-shrink-0 px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-400">
          {CONNECTION_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>

        {/* Shape type (sequence/subprocess only) */}
        {showShape && (
          <select value={task.shapeType || 'task'}
            onChange={e => { const st = e.target.value; onUpdate({ ...task, shapeType: st, type: st }); }}
            className="w-24 flex-shrink-0 px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-400">
            {SHAPE_TYPES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        )}
      </div>

      {/* Connection config — wrapped in the same spacer pattern as Row 2 so
          the inner "序列流向 / 條件分支至 ..." controls line up under the
          task-name input on Row 1. */}
      <div className="flex items-start gap-2 px-2 pb-2.5 min-w-0">
        <div className="w-[300px] flex-shrink-0" aria-hidden="true" />
        <div className="flex-1 min-w-0">
          <ConnectionSection task={task} allTasks={allTasks} displayLabels={displayLabels} onUpdate={onUpdate} />
        </div>
      </div>

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

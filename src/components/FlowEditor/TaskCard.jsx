import { useState } from 'react';
import ConnectionSection from '../ConnectionSection.jsx';
import { ReorderButtons } from '../reorderButtons.jsx';
import { CONN_ROW_BG } from '../../utils/taskDefs.js';
import {
  ELEMENT_TYPES, detectElementKind, makeTypeChange, applyRoleChange,
  KIND_SHORT_LABEL, KIND_BADGE, KIND_BADGE_FALLBACK,
} from '../../utils/elementTypes.js';
import { formatConnection } from '../../model/connectionFormat.js';

// Card background per element category. PR (2026-05-05): row colour now
// distinguishes external interaction (cool slate) from regular L4 task
// (default light grey) — earlier they shared the same `sequence` row bg
// and looked identical in the editor despite rendering differently on
// the diagram. Gateways / start / end / l3activity keep their existing
// connectionType-driven palette via CONN_ROW_BG.
const INTERACTION_ROW_BG = '#F1F5F9';   // slate-100, mirrors diagram's `#A0A0A0` interaction fill in a lighter form

// KIND_SHORT_LABEL / KIND_BADGE moved to utils/elementTypes.js (PR 2026-05-06)
// — shared with ContextMenu header so the chip + colour stays in sync.

// PR (2026-05-05): description shown on hover over the ℹ icon. Replaces
// the gray inline notes that used to live at the bottom of each
// ConnectionSection variant.
const KIND_DESCRIPTION = {
  task:           'L4 任務 — 一般工作項目，順序執行',
  interaction:    '外部關係人互動 — 跨組織 / 客戶 / 系統互動，建議放在外部角色泳道',
  'gateway-xor':  '排他閘道（XOR）— 評估每個條件，僅一條為真者觸發',
  'gateway-and':  '並行閘道（AND）— 不評估條件，所有目標同時建立並行路徑（標籤僅作註記用）',
  'gateway-or':   '包容閘道（OR）— 每個條件獨立評估，凡為真者建立並行路徑（可同時觸發 1~N 條）',
  l3activity:     '子流程調用 — 跳到指定的另一張 L3 流程圖；圖上以雙邊書擋矩形繪製',
  start:          '開始事件 — 流程入口',
  end:            '結束事件 — 流程出口',
};

// ── TaskCard ────────────────────────────────────────
export default function TaskCard({ task, roles, allTasks, displayLabels, onUpdate, onRemove, canRemove,
  canMoveUp, canMoveDown, onMoveUp, onMoveDown }) {
  const ct = task.connectionType || 'sequence';
  const num = displayLabels[task.id];
  const rowBg = ct === 'sequence' && task.shapeType === 'interaction'
    ? INTERACTION_ROW_BG
    : CONN_ROW_BG[ct] || '#FAFAFA';
  const nameOptional = ct === 'start' || ct === 'end';
  const currentKind = detectElementKind(task);
  const kindLabel = KIND_SHORT_LABEL[currentKind] || '';
  const kindBadge = KIND_BADGE[currentKind] || KIND_BADGE_FALLBACK;
  const kindDescription = KIND_DESCRIPTION[currentKind] || '';
  const annotation = formatConnection(task, allTasks || [], displayLabels || {});
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className="rounded-lg border border-gray-200 select-none"
      style={{ background: rowBg }}>

      {/* All three rows share the same 5-column flex layout so columns
          align vertically:
            col 1: ReorderButtons / spacer   (w-5)
            col 2: L4 number + kind label    (w-32)
            col 3: role / connection-type    (w-40)
            col 4: name / shape-type / target select (flex-1 min-w-0)
            col 5: action buttons / spacer   (w-14)  ← ▼ + ✕ 24+24+gap8 + safety
          ConnectionSection inherits this layout via the wrapper below. */}

      {/* Row 1: reorder + L4 number + role + name + actions */}
      <div className="flex items-center gap-2 px-2 pt-2 min-w-0">
        <ReorderButtons canUp={canMoveUp} canDown={canMoveDown} onUp={onMoveUp} onDown={onMoveDown} />

        {/* col 2: kind chip (top, coloured pill) + ℹ tooltip + L4 number
            (bottom, mono). PR (2026-05-05):
            - Name moved ABOVE number per user
            - Chip pill background colour echoes the diagram / CONN_BADGE
              palette per element kind so each card visually identifies
              itself without reading text
            - ℹ tooltip switched from `title` (unreliable native) to a
              CSS `group-hover` popover for instant + multi-line + styled
              behaviour. Popover wraps below-the-icon, max-w 280px, dark
              background for contrast. */}
        <div className="w-32 flex-shrink-0 flex flex-col items-start gap-0.5 min-w-0">
          {kindLabel && (
            <div className="flex items-center gap-1 w-full min-w-0">
              <span className="px-1.5 py-0.5 rounded text-xs font-bold whitespace-nowrap"
                style={{ background: kindBadge.bg, color: kindBadge.text }}>
                {kindLabel}
              </span>
              <span className="relative group flex-shrink-0 cursor-help text-gray-400 hover:text-gray-600 text-xs leading-none">
                ℹ
                <span className="invisible group-hover:visible absolute z-50 top-full left-0 mt-1 p-2 bg-gray-800 text-white text-xs rounded shadow-lg whitespace-pre-wrap w-[280px] pointer-events-none">
                  <span className="block font-bold mb-1">{kindLabel}</span>
                  {kindDescription && <span className="block">{kindDescription}</span>}
                  {annotation && (
                    <>
                      <span className="block mt-1.5 font-semibold text-gray-300">任務關聯說明：</span>
                      <span className="block">{annotation}</span>
                    </>
                  )}
                </span>
              </span>
            </div>
          )}
          <span className="text-xs font-mono text-gray-500 whitespace-nowrap truncate w-full">
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

        {/* col 4: Element-type select. PR (2026-05-05): swapped with name —
            element-type 留 Row 1 較窄欄位（select 內可 truncate），讓 Row 2
            的任務名稱能拿 col 3+4 雙欄寬度。 */}
        <select value={currentKind}
          onChange={e => onUpdate(makeTypeChange(task, e.target.value))}
          className="flex-1 min-w-0 px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-400">
          {ELEMENT_TYPES.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
        </select>

        {/* col 5: actions (expand / remove) */}
        <button onClick={() => setExpanded(v => !v)}
          title={expanded ? '收合詳細欄位' : '展開詳細欄位'}
          className="w-6 flex-shrink-0 text-gray-400 hover:text-gray-600 text-base">
          {expanded ? '▲' : '▼'}
        </button>
        <button onClick={onRemove} disabled={!canRemove}
          className="w-6 flex-shrink-0 text-red-400 hover:text-red-600 disabled:opacity-20 disabled:cursor-not-allowed text-base">✕</button>
      </div>

      {/* Row 2: 任務名稱 input spans col 3+4 for breathing room (PR 2026-05-05
          swap with Row 1's element-type field). Label sits in col 2 same
          x-position as Row 1 col 2 chip / Row 3 ConnectionSection labels. */}
      <div className="flex items-center gap-2 px-2 pt-1.5 pb-2 min-w-0">
        <div className="w-5 flex-shrink-0" aria-hidden="true" />          {/* col 1: reorder spacer */}
        <div className="w-32 flex-shrink-0 text-sm text-gray-600">任務名稱</div>

        {/* col 3 + col 4: name input spans both for ample edit room */}
        <input type="text" placeholder={nameOptional ? '名稱（選填）' : '任務名稱 *'}
          value={task.name} onChange={e => onUpdate({ ...task, name: e.target.value })}
          className="flex-1 min-w-0 px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-400" />
      </div>

      {/* Row 3: Connection config — wrapper provides reorder spacer; the inner
          ConnectionSection lays out its own [label | optional mid | select]
          using the same w-32 / w-40 / flex-1 pattern so labels align
          with the badge column and the inputs align with the name column. */}
      <div className="flex items-start gap-2 px-2 pb-2.5 min-w-0">
        <div className="w-5 flex-shrink-0" aria-hidden="true" />          {/* col 1: reorder spacer */}
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

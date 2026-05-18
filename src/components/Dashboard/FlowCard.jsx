/**
 * Single flow card in the Dashboard grid. Layout reserves fixed heights for
 * title (min-h-3rem) / dates (min-h-2rem) / role chips (3rem) so cards stay
 * visually aligned across grid rows regardless of content length.
 */
import { exportDrawio } from '../../utils/drawioExport.js';
import { exportFlowToExcel } from '../../utils/excelExport.js';
import { COLORS } from '../../diagram/constants.js';
import { fmtDateTime } from './sortFlows.js';
import { autoSpace } from '../../utils/autoSpace.js';

// Shared style for all non-destructive card actions (編輯 / 複製 / 下載 ×3).
// 刪除 keeps its red palette to stay visually distinct. Per user 2026-05-11:
// 「除了刪除之外，其他所有的按鈕樣式顏色要拉齊」.
const ACTION_BTN = 'rounded border border-blue-300 text-blue-700 hover:bg-blue-50 transition-colors font-medium';

export function FlowCard({
  flow, isSelected, onToggleSelect, onTogglePin,
  onEdit, onDelete, onClone, onExportPng,
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow p-5 flex flex-col gap-3">
      {/* Header — title row reserves min-h-[3rem] so 1-line titles
          align with 2-line titles across the same grid row. */}
      <div className="flex items-start gap-2 min-h-[3rem]">
        <input type="checkbox" checked={isSelected}
          onChange={() => onToggleSelect(flow.id)}
          className="mt-0.5 w-4 h-4 flex-shrink-0 cursor-pointer"
          title="勾選以批量下載 / 刪除" />
        <button onClick={() => onTogglePin(flow.id)}
          title={flow.pinned ? '取消置頂' : '置頂此工作流'}
          className="flex-shrink-0 transition-transform hover:scale-110">
          <svg width="18" height="18" viewBox="0 0 24 24"
            fill={flow.pinned ? '#FBBF24' : 'none'}
            stroke={flow.pinned ? '#D97706' : '#9CA3AF'} strokeWidth="2"
            strokeLinejoin="round">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
          </svg>
        </button>
        <span className="px-2 py-0.5 rounded text-xs font-bold text-white flex-shrink-0"
          style={{ background: '#2A5598' }}>
          {flow.l3Number}
        </span>
        <span className="font-semibold text-gray-800 leading-tight line-clamp-2">{autoSpace(flow.l3Name)}</span>
      </div>

      {/* Stats */}
      <div className="flex gap-3 text-xs text-gray-500">
        <span>角色 {flow.roles?.length ?? 0}</span>
        <span>·</span>
        <span>任務 {flow.tasks?.length ?? 0}</span>
      </div>
      {/* Reserves 2-row height even when one of createdAt /
          updatedAt is missing (legacy pre-versioned flows). */}
      <div className="flex flex-col gap-0.5 text-xs text-gray-400 min-h-[2rem]">
        {flow.createdAt && <span>建立：{fmtDateTime(flow.createdAt)}</span>}
        {flow.updatedAt && <span>更新：{fmtDateTime(flow.updatedAt)}</span>}
      </div>

      {/* Roles preview — fixed 2-row height (≈ 2 × 22px chip + gap)
          so cards align across the grid regardless of role count.
          overflow-hidden keeps long lists from breaking the layout
          (rare; usually 1-5 roles). */}
      <div className="flex flex-wrap gap-1 content-start overflow-hidden"
        style={{ minHeight: '3rem', maxHeight: '3rem' }}>
        {(flow.roles ?? []).map(r => (
          <span key={r.id}
            className="px-2 py-0.5 rounded-full text-xs text-white h-fit"
            style={{ background: r.type === 'external' ? COLORS.EXTERNAL_BG : COLORS.INTERNAL_BG }}>
            {autoSpace(r.name)}
          </span>
        ))}
      </div>

      {/* Actions — pinned to card bottom via mt-auto so cards
          in the same grid row stay visually aligned regardless of
          title / role count above. */}
      <div className="mt-auto flex flex-col gap-1.5 pt-1 border-t border-gray-100">
        <div className="flex gap-1.5">
          <button onClick={() => onEdit(flow.id)}
            className={`flex-1 py-1.5 text-sm ${ACTION_BTN}`}>
            編輯
          </button>
          <button onClick={() => onClone(flow)}
            title="複製整條流程做延伸編輯"
            className={`px-3 py-1.5 text-sm ${ACTION_BTN}`}>
            複製
          </button>
          <button onClick={() => {
              if (window.confirm(`確定要刪除「${flow.l3Name}」嗎？`)) onDelete(flow.id);
            }}
            className="px-3 py-1.5 text-sm rounded border border-red-200 text-red-500 hover:bg-red-50 transition-colors">
            刪除
          </button>
        </div>
        <div className="flex gap-1.5">
          <button onClick={() => onExportPng(flow)}
            className={`flex-1 py-1.5 text-xs ${ACTION_BTN}`}>
            下載 PNG
          </button>
          <button onClick={() => exportDrawio(flow)}
            className={`flex-1 py-1.5 text-xs ${ACTION_BTN}`}>
            下載 Drawio
          </button>
          <button onClick={() => exportFlowToExcel(flow)}
            className={`flex-1 py-1.5 text-xs ${ACTION_BTN}`}>
            下載 Excel
          </button>
        </div>
      </div>
    </div>
  );
}

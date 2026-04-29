import { exportDrawio } from '../../utils/drawioExport.js';
import { exportFlowToExcel } from '../../utils/excelExport.js';

// One L3 card on the Dashboard grid. Encapsulates checkbox / pin star /
// header / stats / role chips / edit-delete row / download row. PNG export
// is delegated up via `onRequestPng` so the parent owns the hidden renderer.

function fmtDateTime(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('zh-TW', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
}

export default function FlowCard({
  flow,
  selected,
  onToggleSelect,
  onTogglePin,
  onEdit,
  onDelete,
  onRequestPng,
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow p-5 flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-start gap-2">
        <input type="checkbox" checked={selected}
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
        <span className="font-semibold text-gray-800 leading-tight">{flow.l3Name}</span>
      </div>

      {/* Stats */}
      <div className="flex gap-3 text-xs text-gray-500">
        <span>角色 {flow.roles?.length ?? 0}</span>
        <span>·</span>
        <span>任務 {flow.tasks?.length ?? 0}</span>
      </div>
      <div className="flex flex-col gap-0.5 text-xs text-gray-400">
        {flow.createdAt && <span>建立：{fmtDateTime(flow.createdAt)}</span>}
        {flow.updatedAt && <span>更新：{fmtDateTime(flow.updatedAt)}</span>}
      </div>

      {/* Roles preview */}
      <div className="flex flex-wrap gap-1">
        {(flow.roles ?? []).map(r => (
          <span key={r.id}
            className="px-2 py-0.5 rounded-full text-xs text-white"
            style={{ background: r.type === 'external' ? '#009900' : '#0066CC' }}>
            {r.name}
          </span>
        ))}
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-1.5 pt-1 border-t border-gray-100">
        <div className="flex gap-1.5">
          <button onClick={() => onEdit(flow.id)}
            className="flex-1 py-1.5 text-sm rounded border border-blue-300 text-blue-700 hover:bg-blue-50 transition-colors font-medium">
            編輯
          </button>
          <button onClick={() => {
            if (window.confirm(`確定要刪除「${flow.l3Name}」嗎？`)) onDelete(flow.id);
          }}
            className="px-3 py-1.5 text-sm rounded border border-red-200 text-red-500 hover:bg-red-50 transition-colors">
            刪除
          </button>
        </div>
        <div className="flex gap-1.5">
          <button onClick={() => onRequestPng(flow)}
            className="flex-1 py-1.5 text-xs rounded border border-sky-300 text-sky-700 hover:bg-sky-50 transition-colors">
            ↓ PNG
          </button>
          <button onClick={() => exportDrawio(flow)}
            className="flex-1 py-1.5 text-xs rounded border border-blue-300 text-blue-700 hover:bg-blue-50 transition-colors">
            ↓ draw.io
          </button>
          <button onClick={() => exportFlowToExcel(flow)}
            className="flex-1 py-1.5 text-xs rounded border border-cyan-300 text-cyan-700 hover:bg-cyan-50 transition-colors">
            ↓ Excel
          </button>
        </div>
      </div>
    </div>
  );
}

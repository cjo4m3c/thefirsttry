import { useState, useMemo } from 'react';
import HelpPanel from './HelpPanel.jsx';
import ChangelogPanel from './ChangelogPanel.jsx';

const SORT_OPTIONS = [
  { value: 'number-asc',  label: 'L3 編號 ↑' },
  { value: 'number-desc', label: 'L3 編號 ↓' },
  { value: 'updated-desc', label: '更新日期（最新）' },
  { value: 'updated-asc',  label: '更新日期（最舊）' },
];

function sortFlows(flows, sortKey) {
  const arr = [...flows];
  switch (sortKey) {
    case 'number-asc':
      return arr.sort((a, b) => String(a.l3Number ?? '').localeCompare(String(b.l3Number ?? ''), 'zh-TW', { numeric: true }));
    case 'number-desc':
      return arr.sort((a, b) => String(b.l3Number ?? '').localeCompare(String(a.l3Number ?? ''), 'zh-TW', { numeric: true }));
    case 'updated-desc':
      return arr.sort((a, b) => (b.updatedAt ?? b.createdAt ?? '').localeCompare(a.updatedAt ?? a.createdAt ?? ''));
    case 'updated-asc':
      return arr.sort((a, b) => (a.updatedAt ?? a.createdAt ?? '').localeCompare(b.updatedAt ?? b.createdAt ?? ''));
    default:
      return arr;
  }
}

export default function Dashboard({ flows, onNew, onEdit, onView, onDelete }) {
  const [sortKey, setSortKey] = useState('number-asc');

  const sortedFlows = useMemo(() => sortFlows(flows, sortKey), [flows, sortKey]);

  function fmtDateTime(iso) {
    if (!iso) return '';
    return new Date(iso).toLocaleString('zh-TW', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit',
    });
  }

  return (
    <div className="min-h-screen" style={{ background: '#F3F4F6' }}>
      {/* Top bar */}
      <header className="px-6 py-3 shadow-md flex items-center gap-4" style={{ background: '#4A5240', color: 'white' }}>
        <span className="text-lg font-bold tracking-wide">DoReMiSo</span>
        <span className="text-xs opacity-60">BPM Flow Designer</span>
        <div className="ml-auto flex gap-2">
          <ChangelogPanel />
          <HelpPanel />
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        {/* Page title */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">L3 活動管理</h1>
            <p className="text-sm text-gray-500 mt-1">管理所有 L3 活動，點選「檢視」可直接預覽 L4 泳道圖</p>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={sortKey}
              onChange={e => setSortKey(e.target.value)}
              className="px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-300">
              {SORT_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <button onClick={onNew}
              className="px-5 py-2 rounded-lg text-white font-medium shadow transition-colors"
              style={{ background: '#2A52BE' }}
              onMouseEnter={e => e.target.style.background = '#1a3a9e'}
              onMouseLeave={e => e.target.style.background = '#2A52BE'}>
              + 新增 L3 活動
            </button>
          </div>
        </div>

        {/* Flow list */}
        {sortedFlows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <div className="text-5xl mb-4">📋</div>
            <p className="text-lg">尚無活動，點選右上角「新增 L3 活動」開始</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {sortedFlows.map(flow => (
              <div key={flow.id}
                className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow p-5 flex flex-col gap-3">
                {/* Header */}
                <div className="flex items-start gap-2">
                  <span className="px-2 py-0.5 rounded text-xs font-bold text-white flex-shrink-0"
                    style={{ background: '#2A52BE' }}>
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
                      style={{ background: r.type === 'external' ? '#16982B' : '#6B7280' }}>
                      {r.name}
                    </span>
                  ))}
                </div>

                {/* Actions */}
                <div className="flex gap-1.5 pt-1 border-t border-gray-100">
                  <button onClick={() => onView(flow.id)}
                    className="flex-1 py-1.5 text-sm rounded border border-indigo-300 text-indigo-700 hover:bg-indigo-50 transition-colors font-medium">
                    檢視 / 下載
                  </button>
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
              </div>
            ))}
          </div>
        )}

        {/* Future expansion note */}
        <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700">
          <strong>系統層級架構：</strong>
          L1 業務領域 → L2 價值流 → L3 活動（泳道圖）→ L4 任務 → L5 步驟
          <br />
          <span className="opacity-70">目前支援 L3 活動 / L4 任務泳道圖，L5 步驟功能將陸續新增</span>
        </div>
      </main>
    </div>
  );
}

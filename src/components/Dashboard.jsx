export default function Dashboard({ flows, onNew, onEdit, onDelete }) {
  function fmtDate(iso) {
    if (!iso) return '';
    return new Date(iso).toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' });
  }

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
        <span className="text-lg font-bold tracking-wide">業務流程管理系統</span>
        <span className="text-xs opacity-60">BPM Flow Designer</span>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        {/* Page title */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">L3 流程管理</h1>
            <p className="text-sm text-gray-500 mt-1">管理所有 L3 工作流，點選可展開 L4 泳道圖</p>
          </div>
          <button onClick={onNew}
            className="px-5 py-2 rounded-lg text-white font-medium shadow transition-colors"
            style={{ background: '#2A52BE' }}
            onMouseEnter={e => e.target.style.background = '#1a3a9e'}
            onMouseLeave={e => e.target.style.background = '#2A52BE'}>
            + 新增 L3 流程
          </button>
        </div>

        {/* Flow list */}
        {flows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <div className="text-5xl mb-4">📋</div>
            <p className="text-lg">尚無流程，點選右上角「新增 L3 流程」開始</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {flows.map(flow => (
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
                <div className="flex gap-2 pt-1 border-t border-gray-100">
                  <button onClick={() => onEdit(flow.id)}
                    className="flex-1 py-1.5 text-sm rounded border border-blue-300 text-blue-700 hover:bg-blue-50 transition-colors font-medium">
                    編輯 / 檢視
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
          <strong>系統層級架構：</strong> L1 → L2 → L3（工作流）→ L4 泳道圖 → L5 細節流程 / 操作清單 / 痛點分析
          <br />
          <span className="opacity-70">目前支援 L3/L4 泳道圖，L5 細節與痛點功能將陸續新增</span>
        </div>
      </main>
    </div>
  );
}

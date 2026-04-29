// Modal that surfaces when imported Excel contains L3 numbers already in the
// store. User picks one of:
//   keep      — coexist with existing (same as legacy behavior)
//   overwrite — delete every duplicate then insert imported
//   cancel    — discard imported flows entirely
// Parent owns the pendingImport state and calls onResolve(mode) on click.

export default function DuplicateImportModal({ pendingImport, onResolve }) {
  if (!pendingImport) return null;
  const totalDupes = pendingImport.dupes.reduce((s, d) => s + d.count, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.45)' }}
      onClick={e => { if (e.target === e.currentTarget) onResolve('cancel'); }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-bold text-gray-800">偵測到重複的 L3 編號</h2>
          <p className="text-xs text-gray-500 mt-1">系統已有相同編號的活動，請選擇處理方式：</p>
        </div>
        <div className="px-6 py-4 space-y-2">
          <ul className="text-sm text-gray-700 space-y-1 max-h-64 overflow-y-auto">
            {pendingImport.dupes.map(d => (
              <li key={d.l3Number} className="flex items-center gap-2">
                <span className="font-mono text-blue-700">{d.l3Number}</span>
                <span className="text-gray-500">已有 {d.count} 個 → 將匯入 1 個新的</span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-gray-500 pt-2">
            <strong>都保留</strong>：新舊活動並存（跟目前行為一樣）<br />
            <strong>覆蓋</strong>：刪除上述編號的 {totalDupes} 個舊活動，只保留本次匯入
          </p>
        </div>
        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-2 flex-wrap">
          <button onClick={() => onResolve('cancel')}
            className="px-4 py-2 rounded-lg text-sm text-gray-700 hover:bg-gray-100 transition-colors">
            取消匯入
          </button>
          <button onClick={() => onResolve('keep')}
            className="px-4 py-2 rounded-lg text-sm text-white transition-colors"
            style={{ background: '#3470B5' }}
            onMouseEnter={e => e.currentTarget.style.background = '#5B8AC9'}
            onMouseLeave={e => e.currentTarget.style.background = '#3470B5'}>
            都保留
          </button>
          <button onClick={() => onResolve('overwrite')}
            className="px-4 py-2 rounded-lg text-sm text-white font-semibold transition-colors"
            style={{ background: '#DC2626' }}
            onMouseEnter={e => e.currentTarget.style.background = '#B91C1C'}
            onMouseLeave={e => e.currentTarget.style.background = '#DC2626'}>
            覆蓋（刪除 {totalDupes} 個舊的）
          </button>
        </div>
      </div>
    </div>
  );
}

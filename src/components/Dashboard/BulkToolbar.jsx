// Bulk-action toolbar that appears once any L3 row is selected.
// Owns no state — parent passes selection set + format toggles + handlers.

const FORMAT_KEYS = ['png', 'drawio', 'excel'];

export default function BulkToolbar({
  selectedCount,
  totalCount,
  onSelectAll,
  onClearSelected,
  bulkFormats,
  onToggleFormat,
  onBulkDelete,
  onBulkDownload,
  busy,
}) {
  if (selectedCount === 0) return null;
  const noFormat = !(bulkFormats.png || bulkFormats.drawio || bulkFormats.excel);
  return (
    <div className="mb-4 p-3 rounded-lg bg-blue-50 border border-blue-300 flex items-center gap-3 flex-wrap">
      <span className="text-sm font-medium text-blue-800">
        已選 {selectedCount} / {totalCount} 個活動
      </span>
      <button onClick={onSelectAll}
        className="text-xs px-2 py-1 rounded border border-blue-300 text-blue-600 hover:bg-blue-100">全選</button>
      <button onClick={onClearSelected}
        className="text-xs px-2 py-1 rounded border border-gray-300 text-gray-600 hover:bg-gray-100">取消選取</button>
      <span className="mx-2 text-gray-300">|</span>
      <span className="text-xs text-blue-700">格式：</span>
      {FORMAT_KEYS.map(fmt => (
        <label key={fmt}
          className="flex items-center gap-1 text-xs text-blue-800 cursor-pointer select-none">
          <input type="checkbox" checked={bulkFormats[fmt]}
            onChange={e => onToggleFormat(fmt, e.target.checked)}
            className="w-3.5 h-3.5" />
          {fmt.toUpperCase()}
        </label>
      ))}
      <button onClick={onBulkDelete}
        disabled={busy}
        className="ml-auto px-3 py-1.5 text-sm rounded font-medium border transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        style={{ borderColor: '#DC2626', color: '#DC2626', background: 'white' }}
        onMouseEnter={e => { if (!e.currentTarget.disabled) { e.currentTarget.style.background = '#FEE2E2'; } }}
        onMouseLeave={e => { e.currentTarget.style.background = 'white'; }}>
        批量刪除
      </button>
      <button onClick={onBulkDownload}
        disabled={busy || noFormat}
        className="px-4 py-1.5 text-sm rounded font-medium text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        style={{ background: '#2A5598' }}
        onMouseEnter={e => !e.currentTarget.disabled && (e.currentTarget.style.background = '#1E4677')}
        onMouseLeave={e => (e.currentTarget.style.background = '#2A5598')}>
        批量下載
      </button>
    </div>
  );
}

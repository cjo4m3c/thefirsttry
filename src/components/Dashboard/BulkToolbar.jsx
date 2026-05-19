/**
 * Bulk action toolbar shown above the flow grid when any cards are selected.
 * Provides 全選 / 取消選取 + per-format checkboxes (PNG / Drawio / Excel) +
 * 批量刪除 / 批量下載 buttons.
 *
 * `pngQueueActive` disables the action buttons while a PNG batch render is
 * in flight (Chrome silently drops too-fast download bursts; serial PNG
 * generation is the only reliable path for >5 flows).
 */
const BTN_BLUE = 'var(--brand-dark)';
const BTN_BLUE_HOVER = 'var(--brand-dark-hover)';
const RED = '#DC2626';
const RED_BG = '#FEE2E2';

const FORMATS = ['png', 'drawio', 'excel'];

export function BulkToolbar({
  selectedCount, totalCount,
  bulkFormats, onSetBulkFormat,
  pngQueueActive,
  onSelectAll, onClearSelected, onBulkDelete, onBulkDownload,
}) {
  if (selectedCount === 0) return null;
  const noFormat = !(bulkFormats.png || bulkFormats.drawio || bulkFormats.excel);
  return (
    <div className="mb-4 p-3 rounded-lg bg-blue-50 border border-blue-300 flex items-center gap-3 flex-wrap">
      <span className="text-sm font-medium text-blue-800">已選 {selectedCount} / {totalCount} 個活動</span>
      <button onClick={onSelectAll}
        className="text-xs px-2 py-1 rounded border border-blue-300 text-blue-600 hover:bg-blue-100">全選</button>
      <button onClick={onClearSelected}
        className="text-xs px-2 py-1 rounded border border-gray-300 text-gray-600 hover:bg-gray-100">取消選取</button>
      <span className="mx-2 text-gray-300">|</span>
      <span className="text-xs text-blue-700">格式：</span>
      {FORMATS.map(fmt => (
        <label key={fmt} className="flex items-center gap-1 text-xs text-blue-800 cursor-pointer select-none">
          <input type="checkbox" checked={bulkFormats[fmt]}
            onChange={e => onSetBulkFormat(fmt, e.target.checked)}
            className="w-3.5 h-3.5" />
          {fmt.toUpperCase()}
        </label>
      ))}
      <button onClick={onBulkDelete}
        disabled={pngQueueActive}
        className="ml-auto px-3 py-1.5 text-sm rounded font-medium border transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        style={{ borderColor: RED, color: RED, background: 'white' }}
        onMouseEnter={e => { if (!e.currentTarget.disabled) { e.currentTarget.style.background = RED_BG; } }}
        onMouseLeave={e => { e.currentTarget.style.background = 'white'; }}>
        批量刪除
      </button>
      <button onClick={onBulkDownload}
        disabled={pngQueueActive || noFormat}
        className="px-4 py-1.5 text-sm rounded font-medium text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        style={{ background: BTN_BLUE }}
        onMouseEnter={e => !e.currentTarget.disabled && (e.currentTarget.style.background = BTN_BLUE_HOVER)}
        onMouseLeave={e => (e.currentTarget.style.background = BTN_BLUE)}>
        批量下載
      </button>
    </div>
  );
}

export function PngProgressBanner({ pngQueue, pngTotal }) {
  if (pngQueue.length === 0) return null;
  return (
    <div className="mb-4 p-3 rounded-lg bg-yellow-50 border border-yellow-300 text-sm text-yellow-800 flex items-center gap-2">
      <span className="animate-spin inline-block w-4 h-4 border-2 border-yellow-500 border-t-transparent rounded-full" />
      正在產生 PNG {pngTotal - pngQueue.length + 1} / {pngTotal}（{pngQueue[0]?.l3Number} {pngQueue[0]?.l3Name}）
    </div>
  );
}

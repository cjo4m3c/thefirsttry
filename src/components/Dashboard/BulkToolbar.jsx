/**
 * Bulk action toolbar shown above the flow grid when any cards are selected.
 * Provides 全選 / 取消選取 + per-format checkboxes (PNG / Drawio / Excel) +
 * 批量刪除 / 批量下載 buttons.
 *
 * `pngQueueActive` disables the action buttons while a PNG batch render is
 * in flight (Chrome silently drops too-fast download bursts; serial PNG
 * generation is the only reliable path for >5 flows).
 *
 * PR #238：批量下載改用 Button variant="primary"（亮藍）、批量刪除用
 * variant="danger"（白底紅字次要警示）— design system 一致。
 */
import { Button } from '../ui/Button.jsx';

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
    <div className="mb-4 p-3 rounded-lg bg-info-soft border border-info flex items-center gap-3 flex-wrap">
      <span className="text-sm font-medium text-info-ink">已選 {selectedCount} / {totalCount} 個活動</span>
      <Button size="sm" onClick={onSelectAll}>全選</Button>
      <Button size="sm" onClick={onClearSelected}>取消選取</Button>
      <span className="mx-2 text-line">|</span>
      <span className="text-xs text-info-ink">格式：</span>
      {FORMATS.map(fmt => (
        <label key={fmt} className="flex items-center gap-1 text-xs text-info-ink cursor-pointer select-none">
          <input type="checkbox" checked={bulkFormats[fmt]}
            onChange={e => onSetBulkFormat(fmt, e.target.checked)}
            className="w-3.5 h-3.5" />
          {fmt.toUpperCase()}
        </label>
      ))}
      <Button variant="danger" disabled={pngQueueActive} onClick={onBulkDelete} className="ml-auto">
        批量刪除
      </Button>
      <Button variant="primary" disabled={pngQueueActive || noFormat} onClick={onBulkDownload}>
        批量下載
      </Button>
    </div>
  );
}

export function PngProgressBanner({ pngQueue, pngTotal }) {
  if (pngQueue.length === 0) return null;
  return (
    <div className="mb-4 p-3 rounded-lg bg-warning-soft border border-warning text-sm text-warning-ink flex items-center gap-2">
      <span className="animate-spin inline-block w-4 h-4 border-2 border-warning border-t-transparent rounded-full" />
      正在產生 PNG {pngTotal - pngQueue.length + 1} / {pngTotal}（{pngQueue[0]?.l3Number} {pngQueue[0]?.l3Name}）
    </div>
  );
}

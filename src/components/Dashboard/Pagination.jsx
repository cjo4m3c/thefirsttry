/**
 * Dashboard 分頁 controls — `< 1 2 3 ... > 共 N 個`
 *
 * 顯示策略：
 *   - totalPages <= 7：全展開
 *   - totalPages > 7：[1] ... [current-1] [current] [current+1] ... [last]
 */
import { Button } from '../ui/Button.jsx';

export function Pagination({ page, totalPages, totalCount, onPageChange }) {
  if (totalPages <= 1) {
    return null;
  }
  const pages = visiblePages(page, totalPages);
  return (
    <div className="flex items-center justify-center gap-1 mt-4 flex-wrap">
      <Button size="sm" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>‹ 上一頁</Button>
      {pages.map((p, i) =>
        p === '…' ? (
          <span key={`gap-${i}`} className="px-2 text-ink-faint text-sm">…</span>
        ) : (
          <Button
            key={p}
            size="sm"
            variant={p === page ? 'primary' : 'default'}
            onClick={() => onPageChange(p)}>
            {p}
          </Button>
        )
      )}
      <Button size="sm" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>下一頁 ›</Button>
      <span className="ml-3 text-xs text-ink-soft">第 {page} / {totalPages} 頁、共 {totalCount} 個</span>
    </div>
  );
}

function visiblePages(page, total) {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  const pages = [1];
  if (page > 3) pages.push('…');
  for (let p = Math.max(2, page - 1); p <= Math.min(total - 1, page + 1); p++) {
    pages.push(p);
  }
  if (page < total - 2) pages.push('…');
  pages.push(total);
  return pages;
}

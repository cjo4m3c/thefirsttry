/**
 * Three top-of-page banners shown above the flow grid:
 *   - ImportErrorBanner   (red, blocking import error)
 *   - ImportSuccessBanner (sky blue, multi-L3 success summary)
 *   - ImportWarningsBanner (amber, soft chain / format warnings, expandable)
 *
 * Per user 2026-05-04: warnings collapse at 20 lines with a 「展開全部 N 筆」
 * + 「複製全部」 toggle, and the full list scrolls inside `max-h-96` so a
 * 100+-line import doesn't push the rest of the page off-screen.
 */

export function ImportErrorBanner({ error, onDismiss }) {
  if (!error) return null;
  return (
    <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700 flex items-start gap-2">
      <span className="flex-shrink-0 font-bold">!</span>
      <span className="whitespace-pre-line flex-1">{error}</span>
      <button onClick={onDismiss} className="ml-auto text-red-400 hover:text-red-600 font-bold">×</button>
    </div>
  );
}

export function ImportSuccessBanner({ message, onDismiss }) {
  if (!message) return null;
  return (
    <div className="mb-4 p-3 rounded-lg bg-sky-50 border border-sky-200 text-sm text-sky-800 flex items-start gap-2">
      <span className="flex-shrink-0">✓</span>
      <span>{message}</span>
      <button onClick={onDismiss} className="ml-auto text-sky-400 hover:text-sky-600 font-bold">×</button>
    </div>
  );
}

// 2026-05-13 拆兩段（fixes / notices）顯示。標題雙計數；fixes 仍顯示全部（通常數量少）、
// notices 維持原本 20 筆 collapse + 展開 + 複製全部 行為。一鍵 ✕ 清空兩個。
export function ImportWarningsBanner({ fixes = [], notices = [], expanded, onToggleExpand, onDismiss }) {
  if (fixes.length === 0 && notices.length === 0) return null;
  const visibleNotices = expanded ? notices : notices.slice(0, 20);
  const parts = [];
  if (fixes.length > 0) parts.push(`系統已自動調整 ${fixes.length} 筆內容`);
  if (notices.length > 0) parts.push(`另有 ${notices.length} 筆建議檢視（未自動處理）`);
  const headline = `Excel 已匯入：${parts.join('；')}`;
  return (
    <div className="mb-4 p-3 rounded-lg bg-amber-50 border border-amber-300 text-sm text-amber-800">
      <div className="flex items-start gap-2 mb-1.5">
        <span className="flex-shrink-0 font-bold">⚠</span>
        <span className="font-medium flex-1">{headline}</span>
        <button onClick={onDismiss}
          className="text-amber-400 hover:text-amber-600 font-bold">×</button>
      </div>
      {fixes.length > 0 && (
        <div className="ml-5 mb-2">
          <div className="font-semibold text-amber-900 mb-0.5">已自動調整（{fixes.length}）</div>
          <ul className="ml-4 space-y-0.5 text-xs list-disc">
            {fixes.map((w, i) => (<li key={i}>{w}</li>))}
          </ul>
        </div>
      )}
      {notices.length > 0 && (
        <div className="ml-5">
          <div className="font-semibold text-amber-900 mb-0.5">建議檢視（{notices.length}）</div>
          <div className={expanded ? 'max-h-96 overflow-y-auto pr-1' : ''}>
            <ul className="ml-4 space-y-0.5 text-xs list-disc">
              {visibleNotices.map((w, i) => (<li key={i}>{w}</li>))}
            </ul>
          </div>
          {notices.length > 20 && (
            <div className="mt-1.5 flex items-center gap-3">
              <button onClick={onToggleExpand}
                className="text-xs text-amber-700 hover:text-amber-900 underline">
                {expanded ? '收合（只顯示前 20 筆）' : `展開全部 ${notices.length} 筆`}
              </button>
              <button onClick={async () => {
                  try { await navigator.clipboard.writeText([...fixes, ...notices].join('\n')); }
                  catch { /* ignore — clipboard blocked in some browsers */ }
                }}
                title="複製全部提醒文字到剪貼簿"
                className="text-xs text-amber-700 hover:text-amber-900 underline">
                複製全部
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

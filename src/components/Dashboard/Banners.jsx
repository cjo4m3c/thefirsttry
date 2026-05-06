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

export function ImportWarningsBanner({ warnings, expanded, onToggleExpand, onDismiss }) {
  if (warnings.length === 0) return null;
  const visible = expanded ? warnings : warnings.slice(0, 20);
  return (
    <div className="mb-4 p-3 rounded-lg bg-amber-50 border border-amber-300 text-sm text-amber-800">
      <div className="flex items-start gap-2 mb-1.5">
        <span className="flex-shrink-0 font-bold">⚠</span>
        <span className="font-medium flex-1">
          Excel 已匯入，但有 {warnings.length} 筆閘道鏈警告（不影響使用，建議修正以獲得正確流程圖）
        </span>
        <button onClick={onDismiss}
          className="text-amber-400 hover:text-amber-600 font-bold">×</button>
      </div>
      <div className={expanded ? 'max-h-96 overflow-y-auto pr-1' : ''}>
        <ul className="ml-5 space-y-0.5 text-xs">
          {visible.map((w, i) => (<li key={i}>{w}</li>))}
        </ul>
      </div>
      {warnings.length > 20 && (
        <div className="ml-5 mt-1.5 flex items-center gap-3">
          <button onClick={onToggleExpand}
            className="text-xs text-amber-700 hover:text-amber-900 underline">
            {expanded ? '收合（只顯示前 20 筆）' : `展開全部 ${warnings.length} 筆`}
          </button>
          <button onClick={async () => {
              try { await navigator.clipboard.writeText(warnings.join('\n')); }
              catch { /* ignore — clipboard blocked in some browsers */ }
            }}
            title="複製全部警告文字到剪貼簿"
            className="text-xs text-amber-700 hover:text-amber-900 underline">
            複製全部
          </button>
        </div>
      )}
    </div>
  );
}

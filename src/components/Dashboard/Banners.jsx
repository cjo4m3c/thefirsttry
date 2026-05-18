/**
 * Three top-of-page banners shown above the flow grid:
 *   - ImportErrorBanner   (danger, blocking import error)
 *   - ImportSuccessBanner (info, multi-L3 success summary)
 *   - ImportWarningsBanner (warning, soft chain / format warnings, expandable)
 *
 * 2026-05-18 PR-6 follow-up：3 個 banner 統一改用 <Callout>（spec design
 * system base 元件）— 視覺一致、未來 Callout 內統一改色一處生效。複雜
 * 內容（fixes/notices 雙 section + 展開 + 複製）保留在 children。
 */
import { Callout } from '../ui/Callout.jsx';

export function ImportErrorBanner({ error, onDismiss }) {
  if (!error) return null;
  return (
    <Callout variant="danger" title={<>! 匯入失敗</>} onDismiss={onDismiss}>
      <span className="whitespace-pre-line">{error}</span>
    </Callout>
  );
}

export function ImportSuccessBanner({ message, onDismiss }) {
  if (!message) return null;
  return (
    <Callout variant="info" title={<>✓ 匯入完成</>} onDismiss={onDismiss}>
      {message}
    </Callout>
  );
}

// 2026-05-13 拆兩段（fixes / notices）顯示。標題雙計數；fixes 仍顯示全部（通常數量少）、
// notices 維持原本 20 筆 collapse + 展開 + 複製全部 行為。一鍵 ✕ 清空兩個。
// 2026-05-18 PR-6 follow-up：外層改用 <Callout variant="warning">、body 保留複雜結構。
export function ImportWarningsBanner({ fixes = [], notices = [], expanded, onToggleExpand, onDismiss }) {
  if (fixes.length === 0 && notices.length === 0) return null;
  const visibleNotices = expanded ? notices : notices.slice(0, 20);
  const parts = [];
  if (fixes.length > 0) parts.push(`系統已自動調整 ${fixes.length} 筆內容`);
  if (notices.length > 0) parts.push(`另有 ${notices.length} 筆建議檢視（未自動處理）`);
  const headline = `⚠ Excel 已匯入：${parts.join('；')}`;
  return (
    <Callout variant="warning" title={headline} onDismiss={onDismiss}>
      {fixes.length > 0 && (
        <div className="ml-1 mb-2">
          <div className="font-semibold text-warning-ink mb-0.5">已自動調整（{fixes.length}）</div>
          <ul className="ml-4 space-y-0.5 text-xs list-disc">
            {fixes.map((w, i) => (<li key={i}>{w}</li>))}
          </ul>
        </div>
      )}
      {notices.length > 0 && (
        <div className="ml-1">
          <div className="font-semibold text-warning-ink mb-0.5">建議檢視（{notices.length}）</div>
          <div className={expanded ? 'max-h-96 overflow-y-auto pr-1' : ''}>
            <ul className="ml-4 space-y-0.5 text-xs list-disc">
              {visibleNotices.map((w, i) => (<li key={i}>{w}</li>))}
            </ul>
          </div>
          {notices.length > 20 && (
            <div className="mt-1.5 flex items-center gap-3">
              <button onClick={onToggleExpand}
                className="text-xs text-warning-ink hover:opacity-70 underline">
                {expanded ? '收合（只顯示前 20 筆）' : `展開全部 ${notices.length} 筆`}
              </button>
              <button onClick={async () => {
                  try { await navigator.clipboard.writeText([...fixes, ...notices].join('\n')); }
                  catch { /* ignore — clipboard blocked in some browsers */ }
                }}
                title="複製全部提醒文字到剪貼簿"
                className="text-xs text-warning-ink hover:opacity-70 underline">
                複製全部
              </button>
            </div>
          )}
        </div>
      )}
    </Callout>
  );
}

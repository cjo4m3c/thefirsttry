/**
 * Three top-of-page banners shown above the flow grid:
 *   - ImportErrorBanner   (danger, blocking import error)
 *   - ImportSuccessBanner (info, multi-L3 success summary)
 *   - ImportWarningsBanner (warning, soft chain / format warnings, expandable)
 *
 * 2026-05-18 PR-6 follow-up：3 個 banner 統一改用 <Callout>（spec design
 * system base 元件）— 視覺一致、未來 Callout 內統一改色一處生效。
 *
 * 2026-05-19 PR #236：fixes / notices 改 nested group `{ l3, headline, details[] }`
 * 結構、headline 一級 + details 縮排二級。移除所有 emoji（⚠ / ✓ / ! / ❌）。
 */
import { Callout } from '../ui/Callout.jsx';

export function ImportErrorBanner({ error, onDismiss }) {
  if (!error) return null;
  return (
    <Callout variant="danger" title="匯入失敗" onDismiss={onDismiss}>
      <span className="whitespace-pre-line">{error}</span>
    </Callout>
  );
}

export function ImportSuccessBanner({ message, onDismiss }) {
  if (!message) return null;
  return (
    <Callout variant="info" title="匯入完成" onDismiss={onDismiss}>
      {message}
    </Callout>
  );
}

// 計算 group array 內的「detail 總筆數」— banner headline 顯示用
function countDetails(groups) {
  return (groups ?? []).reduce((s, g) => s + (g?.details?.length ?? 0), 0);
}

// 渲染一組 group：headline 一級 + details ul 縮排二級。
// `hideL3` 真 → 不顯示 [L3 N] prefix（FlowEditor 單一流程內 banner 用）
export function ImportGroupList({ groups, hideL3 = false }) {
  return (
    <ul className="ml-4 space-y-1 text-xs list-disc">
      {groups.map((g, i) => (
        <li key={i}>
          <span>{hideL3 ? g.headline : `[L3 ${g.l3}] ${g.headline}`}</span>
          {g.details && g.details.length > 0 && (
            <ul className="ml-5 mt-0.5 space-y-0.5 list-disc">
              {g.details.map((d, j) => (<li key={j} className="whitespace-pre-wrap">{d}</li>))}
            </ul>
          )}
        </li>
      ))}
    </ul>
  );
}

// 局部 alias for in-file use（保持本檔內部 render 邏輯不變）
const GroupList = ImportGroupList;

// 把 nested groups 序列化為 plain text（給「複製全部」按鈕用）
function groupsToText(groups) {
  return groups.map(g => {
    const header = `[L3 ${g.l3}] ${g.headline}`;
    const lines = (g.details ?? []).map(d => `  - ${d}`);
    return [header, ...lines].join('\n');
  }).join('\n');
}

export function ImportWarningsBanner({ fixes = [], notices = [], expanded, onToggleExpand, onDismiss }) {
  if (fixes.length === 0 && notices.length === 0) return null;
  const fixesCount = countDetails(fixes);
  const noticesCount = countDetails(notices);
  const COLLAPSE_LIMIT = 20;
  const noticeTotal = notices.length;
  const visibleNotices = expanded ? notices : notices.slice(0, COLLAPSE_LIMIT);
  const parts = [];
  if (fixesCount > 0) parts.push(`系統已自動調整 ${fixesCount} 筆內容`);
  if (noticesCount > 0) parts.push(`另有 ${noticesCount} 筆建議檢視（未自動處理）`);
  const headline = `Excel 已匯入：${parts.join('；')}`;
  return (
    <Callout variant="warning" title={headline} onDismiss={onDismiss}>
      {fixes.length > 0 && (
        <div className="ml-1 mb-2">
          <div className="font-semibold text-warning-ink mb-0.5">已自動調整（{fixesCount}）</div>
          <GroupList groups={fixes} />
        </div>
      )}
      {notices.length > 0 && (
        <div className="ml-1">
          <div className="font-semibold text-warning-ink mb-0.5">建議檢視（{noticesCount}）</div>
          <div className={expanded ? 'max-h-96 overflow-y-auto pr-1' : ''}>
            <GroupList groups={visibleNotices} />
          </div>
          {noticeTotal > COLLAPSE_LIMIT && (
            <div className="mt-1.5 flex items-center gap-3">
              <button onClick={onToggleExpand}
                className="text-xs text-warning-ink hover:opacity-70 underline">
                {expanded ? `收合（只顯示前 ${COLLAPSE_LIMIT} 個 L3）` : `展開全部 ${noticeTotal} 個 L3`}
              </button>
              <button onClick={async () => {
                  try { await navigator.clipboard.writeText(groupsToText([...fixes, ...notices])); }
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

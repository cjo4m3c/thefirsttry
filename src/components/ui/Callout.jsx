/**
 * Callout — 共用提示框元件，對齊 design_handoff_flowsprite spec
 * `.callout` 4 種語意色（info / warning / danger / success）。
 *
 * 用法：
 *   <Callout variant="warning" title="匯入時自動調整 22 筆" onDismiss={fn}>
 *     不影響使用，建議檢視 Excel 原始檔對照。
 *   </Callout>
 *
 *   <Callout variant="danger" title="必須有開始事件">
 *     流程缺少開始事件，無法儲存。
 *   </Callout>
 *
 * 設計原則（per spec）：
 *   - info：藍 — 一般提示
 *   - warning：琥珀 — 可儲存但建議修正
 *   - danger：紅 — Blocking / 違規 / destructive
 *   - success：綠 — 完成 / 通過
 *   - 可選 onDismiss → 顯示右上 ✕
 */

const VARIANTS = {
  info:    { border: 'border-info',    bg: 'bg-info-soft',    title: 'text-info-ink' },
  warning: { border: 'border-warning', bg: 'bg-warning-soft', title: 'text-warning-ink' },
  danger:  { border: 'border-danger',  bg: 'bg-danger-soft',  title: 'text-danger-ink' },
  success: { border: 'border-success', bg: 'bg-success-soft', title: 'text-success-ink' },
};

export function Callout({ variant = 'info', title, children, onDismiss, className = '' }) {
  const v = VARIANTS[variant] || VARIANTS.info;
  return (
    <div className={`border ${v.border} ${v.bg} rounded-md px-4 py-3 mb-3 ${className}`}>
      {(title || onDismiss) && (
        <div className={`flex items-start gap-2 mb-1.5 font-semibold leading-snug ${v.title}`}
             style={{ fontSize: 'var(--fs-body)' }}>
          <span className="flex-1">{title}</span>
          {onDismiss && (
            <button
              onClick={onDismiss}
              className={`flex-shrink-0 hover:opacity-70 font-bold ${v.title}`}
              title="關閉提示"
            >✕</button>
          )}
        </div>
      )}
      <div className="text-ink leading-snug" style={{ fontSize: 'var(--fs-body)' }}>
        {children}
      </div>
    </div>
  );
}

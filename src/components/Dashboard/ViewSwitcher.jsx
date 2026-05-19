/**
 * ViewSwitcher — 卡片 / 表格 segmented control（方案 A、2026-05-18）。
 *
 * 兩個 view 並列、選一個。沿用 spec components.css `.seg` 風格、Tailwind
 * 改寫（paper-2 軌 + card 選中底）。view 偏好由 caller 持久化到 localStorage。
 */

const VIEWS = [
  { value: 'cards', label: '卡片' },
  { value: 'table', label: '表格' },
];

export function ViewSwitcher({ value, onChange }) {
  return (
    <div className="inline-flex bg-paper-2 border border-line rounded-md p-0.5 gap-0.5">
      {VIEWS.map(v => {
        const active = value === v.value;
        return (
          <button
            key={v.value}
            onClick={() => onChange(v.value)}
            className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
              active
                ? 'bg-card text-ink shadow-sm font-semibold'
                : 'text-ink-soft hover:text-ink'
            }`}
            title={`切換到${v.label}檢視`}>
            {v.label}
          </button>
        );
      })}
    </div>
  );
}

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
  // 2026-05-19：高度對齊右側 sort dropdown / 上傳 / 新增（py-2 + text-[13px]
  // ≈ 38px）、字級拉齊 spec fs-body 13px（PR #228、使用者：「字能不能也
  // 拉齊？」整批拉到 13px）。
  return (
    <div className="inline-flex bg-paper-2 border border-line rounded-md p-0.5 gap-0.5 h-[38px]">
      {VIEWS.map(v => {
        const active = value === v.value;
        return (
          <button
            key={v.value}
            onClick={() => onChange(v.value)}
            className={`h-full px-3 text-[13px] font-medium rounded transition-colors ${
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

/**
 * Dashboard search + filter bar — 3 filters AND 結合 + 右側 view/sort 控制：
 *   - 搜尋 input（L3 名稱 / 編號 / L4 任務名 substring）
 *   - L2 dropdown（單選、列出所有現存 L2 prefix）
 *   - 角色 dropdown 多選（chip 樣式）
 *   - 右側置右：ViewSwitcher + sort dropdown（PR #237、從頁面標題列移過來）
 * + active filter chips（含「✕ 清除」單獨 + 全部清除）
 */
import { useState, useRef, useEffect } from 'react';
import { Button } from '../ui/Button.jsx';
import { Chip } from '../ui/Chip.jsx';
import { autoSpace } from '../../utils/autoSpace.js';

export function SearchBar({
  keyword, onKeywordChange,
  l2, onL2Change,
  roles, onRolesChange,
  l2Options, roleOptions,
  onClearAll,
  // PR #237：view + sort 從頁面標題列移到 SearchBar 同列、置右
  viewSwitcher, sortControl,
}) {
  const hasAnyFilter = keyword.trim() || l2 || roles.length > 0;
  return (
    <div className="flex flex-col gap-2 mb-3">
      <div className="flex items-center gap-2 flex-wrap">
        <input
          type="text"
          value={keyword}
          onChange={e => onKeywordChange(e.target.value)}
          placeholder="搜尋活動名稱 / 編號 / 任務名稱..."
          className="flex-1 min-w-[200px] max-w-md px-3 py-2 rounded-lg border border-line text-sm bg-card focus:outline-none focus:ring-2 focus:ring-brand-light"
        />
        <L2Dropdown value={l2} options={l2Options} onChange={onL2Change} />
        <RolesDropdown value={roles} options={roleOptions} onChange={onRolesChange} />
        {hasAnyFilter && (
          <Button onClick={onClearAll}>清除全部</Button>
        )}
        {/* 置右區：view 切換 + sort dropdown */}
        {(viewSwitcher || sortControl) && (
          <div className="ml-auto flex items-center gap-2">
            {viewSwitcher}
            {sortControl}
          </div>
        )}
      </div>
      {hasAnyFilter && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs text-ink-faint">篩選中：</span>
          {keyword.trim() && (
            <FilterChip onClear={() => onKeywordChange('')}>
              關鍵字「{autoSpace(keyword.trim())}」
            </FilterChip>
          )}
          {l2 && (
            <FilterChip onClear={() => onL2Change('')}>
              L2 = {l2}
            </FilterChip>
          )}
          {roles.map(r => (
            <FilterChip key={r} onClear={() => onRolesChange(roles.filter(x => x !== r))}>
              角色 = {autoSpace(r)}
            </FilterChip>
          ))}
        </div>
      )}
    </div>
  );
}

// FilterChip — 包 `<Chip variant="filter">` + 內嵌「✕ 清除」按鈕
function FilterChip({ children, onClear }) {
  return (
    <Chip variant="filter">
      {children}
      <button onClick={onClear} className="hover:text-danger" title="清除此篩選">✕</button>
    </Chip>
  );
}

function L2Dropdown({ value, options, onChange }) {
  return (
    <SelectWithChevron value={value} onChange={onChange}
      title="按 L2 編號（前兩段）篩選" ariaLabel="L2 篩選">
      <option value="">全部 L2</option>
      {options.map(o => (
        <option key={o.value} value={o.value}>{o.value} ({o.count})</option>
      ))}
    </SelectWithChevron>
  );
}

// SVG chevron-down — 飽和實心三角、3 個 dropdown 一致用此（PR #240）。
// L2 / sort dropdown 用 `<select>` + `appearance-none` 隱藏 native arrow、
// 包裝 div overlay 此元件；角色 dropdown 是 button + 直接放此元件。
function ChevronDown() {
  return (
    <svg width="10" height="6" viewBox="0 0 10 6" fill="currentColor" aria-hidden="true">
      <polygon points="0,0 10,0 5,6" />
    </svg>
  );
}

// Wrapper: native <select> + 隱藏內建箭頭 + 自繪實心 SVG chevron overlay。
// L2 / sort dropdown 共用此 pattern 跟角色 button trigger 視覺一致。
export function SelectWithChevron({ value, onChange, title, children, ariaLabel }) {
  return (
    <div className="relative inline-block">
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        title={title}
        aria-label={ariaLabel}
        className="appearance-none pl-3 pr-8 py-2 rounded-lg border border-line text-sm bg-card focus:outline-none focus:ring-2 focus:ring-brand-light cursor-pointer">
        {children}
      </select>
      <span className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-ink-soft">
        <ChevronDown />
      </span>
    </div>
  );
}

function RolesDropdown({ value, options, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    function onDoc(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);
  function toggle(name) {
    onChange(value.includes(name) ? value.filter(x => x !== name) : [...value, name]);
  }
  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="px-3 py-2 rounded-lg border border-line text-sm bg-card hover:bg-paper-2 focus:outline-none focus:ring-2 focus:ring-brand-light inline-flex items-center gap-2"
        title="按角色多選篩選">
        <span>{value.length > 0 ? `角色 (${value.length})` : '全部角色'}</span>
        <ChevronDown />
      </button>
      {open && (
        <div className="absolute right-0 mt-1 min-w-[220px] max-h-72 overflow-y-auto bg-card border border-line rounded-lg shadow-lg z-20 py-1">
          {options.length === 0 && <div className="px-3 py-2 text-xs text-ink-faint">尚無角色</div>}
          {options.map(o => {
            const checked = value.includes(o.value);
            return (
              <label key={o.value} className="flex items-center gap-2 px-3 py-1.5 hover:bg-paper-2 cursor-pointer text-sm">
                <input type="checkbox" checked={checked} onChange={() => toggle(o.value)} className="w-4 h-4 cursor-pointer" />
                <span className="flex-1 truncate">{autoSpace(o.value)}</span>
                <span className="text-xs text-ink-faint">{o.count}</span>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function EmptyState({ onClearAll }) {
  return (
    <div className="text-center py-16 text-ink-soft">
      <div className="text-sm mb-3">沒有符合篩選的流程</div>
      <Button onClick={onClearAll}>清除全部篩選</Button>
    </div>
  );
}

/**
 * InfoDropdown — Dashboard 右上「說明 ▾」單顆按鈕收攏 3 個次要資訊面板。
 *
 * 2026-05-18：使用者「這三個按鈕不是第一眼需要知道的資訊，有什麼好方法
 * 可以收攏」。3 個 panel（更新紀錄 / 業務規則 / 設計規範）改 controlled、
 * 由本元件統管 open state、用 dropdown 收成 1 顆按鈕。
 *
 * 設計選擇（per 使用者）：
 *   - dropdown 項目用**純文字、無 icon / emoji**
 *   - 點外面 / Esc 關閉 dropdown（但不關 modal）
 *   - 開 modal 後 dropdown 自動收起
 *   - 3 個 modal 並存（同時只能開一個）— 切換時前一個 close
 *
 * 視覺對齊 Dashboard / FlowEditor Header 既有的白色 outline 按鈕（spec
 * `.nav-btn` 樣式）。
 */
import { useState, useEffect, useRef } from 'react';
import ChangelogPanel from './ChangelogPanel.jsx';
import HelpPanel from './HelpPanel.jsx';
import DesignGuidelinePanel from './DesignGuidelinePanel.jsx';

const MENU_ITEMS = [
  { key: 'changelog', label: '更新紀錄' },
  { key: 'help',      label: '業務規則' },
  { key: 'design',    label: '設計規範' },
];

export default function InfoDropdown() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [active, setActive] = useState(null);  // 'changelog' | 'help' | 'design' | null
  const ref = useRef(null);

  // Click outside / Esc 關閉 dropdown（不關 modal）
  useEffect(() => {
    if (!menuOpen) return;
    function onDocClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setMenuOpen(false);
    }
    function onKey(e) { if (e.key === 'Escape') setMenuOpen(false); }
    const id = setTimeout(() => document.addEventListener('mousedown', onDocClick), 0);
    document.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(id);
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  function pick(key) {
    setActive(key);
    setMenuOpen(false);
  }

  return (
    <>
      <div ref={ref} className="relative">
        <button
          onClick={() => setMenuOpen(v => !v)}
          title="查看更新紀錄、業務規則、設計規範"
          className="px-3 py-2 rounded-lg text-white text-sm font-medium transition-colors inline-flex items-center gap-1.5"
          style={{ background: '#3470B5' }}
          onMouseEnter={e => e.currentTarget.style.background = '#5B8AC9'}
          onMouseLeave={e => e.currentTarget.style.background = '#3470B5'}>
          <span>說明</span>
          <svg width="10" height="6" viewBox="0 0 10 6" fill="currentColor" aria-hidden="true">
            <polygon points="0,0 10,0 5,6" />
          </svg>
        </button>
        {menuOpen && (
          <div className="absolute right-0 mt-1 min-w-[140px] bg-white rounded-lg shadow-lg border border-line py-1 z-20">
            {MENU_ITEMS.map(item => (
              <button
                key={item.key}
                onClick={() => pick(item.key)}
                className="block w-full text-left px-4 py-2 text-sm text-ink hover:bg-paper-2 transition-colors">
                {item.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <ChangelogPanel       isOpen={active === 'changelog'} onClose={() => setActive(null)} />
      <HelpPanel            isOpen={active === 'help'}      onClose={() => setActive(null)} />
      <DesignGuidelinePanel isOpen={active === 'design'}    onClose={() => setActive(null)} />
    </>
  );
}

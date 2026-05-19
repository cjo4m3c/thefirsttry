import { useState } from 'react';
import { CHANGELOG } from '../data/changelog/index.js';

/**
 * ChangelogPanel — 版本更新紀錄
 *
 * 每筆新更新加在 `src/data/changelog/current.js` 最前面（newest first）。
 * `current.js` 累積太大（>10KB）時凍結：rename 成 `c{next}.js` 並 reset current。
 * 格式：{ date: 'YYYY-MM-DD', title: '簡短標題', items: ['...', '...'] }
 */

function Section({ entry, isFirst }) {
  const [open, setOpen] = useState(isFirst);
  return (
    <div className="border-b border-gray-100 last:border-0">
      <button
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors"
        onClick={() => setOpen(o => !o)}>
        <span className="text-xs font-mono text-gray-400 flex-shrink-0 w-24">{entry.date}</span>
        <span className="flex-1 text-sm font-medium text-gray-800">{entry.title}</span>
        <span className="text-gray-400 text-xs">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <ul className="px-4 pb-3 space-y-1 ml-24">
          {entry.items.map((item, i) => (
            <li key={i} className="text-xs text-gray-600 flex gap-2">
              <span className="text-gray-300 flex-shrink-0 mt-0.5">•</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// 2026-05-18 改 controlled — InfoDropdown 統管 open state，trigger 已移除。
export default function ChangelogPanel({ isOpen = false, onClose = () => {} }) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.45)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h2 className="text-lg font-bold text-gray-800">版本更新紀錄</h2>
            <p className="text-xs text-gray-400 mt-0.5">最新更新排列在最上方，點選標題可展開/收合明細</p>
          </div>
          <button onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl font-bold leading-none px-2">
            ×
          </button>
        </div>
        <div className="overflow-y-auto flex-1">
          {CHANGELOG.map((entry, i) => (
            <Section key={i} entry={entry} isFirst={i === 0} />
          ))}
        </div>
        <div className="px-6 py-3 border-t border-gray-100 flex justify-end">
          <button onClick={onClose}
            className="px-5 py-2 rounded-lg text-white text-sm font-medium transition-colors"
            style={{ background: 'var(--brand-dark)' }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--brand-dark-hover)'}
            onMouseLeave={e => e.currentTarget.style.background = 'var(--brand-dark)'}>
            關閉
          </button>
        </div>
      </div>
    </div>
  );
}

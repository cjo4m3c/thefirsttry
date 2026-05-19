import { useState } from 'react';
import { CHANGELOG } from '../data/changelog/index.js';
import { Modal, ModalFoot } from './ui/Modal.jsx';
import { Button } from './ui/Button.jsx';

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
    <div className="border-b border-line-dim last:border-0">
      <button
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-paper-2 transition-colors"
        onClick={() => setOpen(o => !o)}>
        <span className="text-xs font-mono text-ink-faint flex-shrink-0 w-24">{entry.date}</span>
        <span className="flex-1 text-sm font-medium text-ink">{entry.title}</span>
        <span className="text-ink-faint text-xs">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <ul className="px-4 pb-3 space-y-1 ml-24">
          {entry.items.map((item, i) => (
            <li key={i} className="text-xs text-ink-soft flex gap-2">
              <span className="text-ink-faint flex-shrink-0 mt-0.5">•</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// 2026-05-18 改 controlled — InfoDropdown 統管 open state，trigger 已移除。
// PR #238：改用 Modal base + Button primary（design system 一致性）。
export default function ChangelogPanel({ isOpen = false, onClose = () => {} }) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      width={672}
      title="版本更新紀錄"
      subtitle="最新更新排列在最上方，點選標題可展開/收合明細"
    >
      <div className="overflow-y-auto flex-1">
        {CHANGELOG.map((entry, i) => (
          <Section key={i} entry={entry} isFirst={i === 0} />
        ))}
      </div>
      <ModalFoot>
        <Button variant="primary" onClick={onClose}>關閉</Button>
      </ModalFoot>
    </Modal>
  );
}

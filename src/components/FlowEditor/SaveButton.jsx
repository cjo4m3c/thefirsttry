/**
 * SaveButton — FlowEditor Header 儲存按鈕、4 種狀態：
 *
 *   1. saveCelebrate  — 剛存完、emerald 邊框 + flash 動畫 + 5 顆 confetti
 *   2. savePulse      — 編輯久未存、amber 底脈動提醒
 *   3. hasChanges     — 有未存改動、白底 brand-dark-hover 字（強調）
 *   4. default        — 沒未存改動、跟其他 dark-bar button 同款（透明白邊白字）
 *
 * 拆自 FlowEditor/Header.jsx（PR #238、§6 拆 SaveButton 子元件、消 inline
 * pattern）。Header 內原本三層條件 className 改用 SaveButton 4 個 state
 * 各自 className、邏輯封裝在此檔。
 *
 * `<Button>` base 提供 size md = `px-3 py-1.5 text-sm rounded-md font-medium`、
 * 但儲存 button 跟舊 inline 對齊用 `text-base` (16px) + `rounded` (4px) +
 * `font-semibold`、透過 className 覆寫 base 預設。default 狀態用 dark-bar
 * 風格（跟 Header 其他 7 button 同款）、其他 3 狀態各帶 own 邊框/底色/動畫。
 */
const STATE_CLASS = {
  saveCelebrate: 'border-emerald-400 save-celebrate-flash text-white',
  savePulse:     'border-amber-300 bg-amber-400 text-amber-950 hover:bg-amber-300 save-pulse',
  // hasChanges 用 font-semibold override baseCls 的 font-medium、強調主動作
  hasChanges:    'border-white bg-white text-brand-dark-hover hover:bg-opacity-90 font-semibold',
  default:       'border-white border-opacity-40 text-white hover:bg-white hover:bg-opacity-10',
};

function pickState({ saveCelebrate, savePulse, hasChanges }) {
  if (saveCelebrate) return 'saveCelebrate';
  if (savePulse !== 'none') return 'savePulse';
  if (hasChanges) return 'hasChanges';
  return 'default';
}

export function SaveButton({ hasChanges, savePulse, saveCelebrate, savePhrase, onSave }) {
  const state = pickState({ saveCelebrate, savePulse, hasChanges });
  // PR #239：拉齊 dark-bar 規格（text-sm 14 / rounded-md 6 / font-medium）
  // 跟 Header 其他 7 button 視覺一致。hasChanges 狀態用 font-semibold
  // override 強調主動作差異（透過 STATE_CLASS）。
  const baseCls = 'px-3 py-1.5 text-sm rounded-md border font-medium transition-colors';
  return (
    <div className="relative">
      <button
        onClick={onSave}
        title={hasChanges ? savePhrase : '目前沒有未儲存的變更'}
        className={`${baseCls} ${STATE_CLASS[state]}`}>
        儲存
      </button>
      {saveCelebrate && (
        // 5-particle confetti burst — colored circles + rotated squares
        // fan out from the button (no emoji). Range ~42px per user
        // 2026-05-04 (+30% vs. previous single-sparkle implementation).
        <>
          <span aria-hidden="true" className="confetti confetti-1" />
          <span aria-hidden="true" className="confetti confetti-2" />
          <span aria-hidden="true" className="confetti confetti-3" />
          <span aria-hidden="true" className="confetti confetti-4" />
          <span aria-hidden="true" className="confetti confetti-5" />
        </>
      )}
    </div>
  );
}

// Note: 為什麼不直接用 `<Button variant="...">`？
// Button base 預設 size md = text-sm 14 / rounded-md 6 / font-medium、
// 但儲存按鈕跟舊 inline 對齊用 text-base 16 / rounded 4 / font-semibold
// 強調「主動作」、跟 Header 其他 dark-bar button 視覺對比明顯。
// 如未來想統一字級、改本檔 baseCls 一處即可。

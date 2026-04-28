/**
 * Two confirmation modals shown above FlowEditor:
 *   - SaveModal: blocking errors / warning list before save
 *   - ResetAllModal: confirm before clearing all manual endpoint overrides
 */
export function SaveModal({ saveModal, onCancel, onSaveAnyway }) {
  if (!saveModal) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.45)' }}
      onClick={e => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col">
        <div className={`px-6 py-4 border-b ${saveModal.type === 'blocking' ? 'border-red-200 bg-red-50' : 'border-amber-200 bg-amber-50'}`}>
          <h2 className={`text-xl font-bold ${saveModal.type === 'blocking' ? 'text-red-700' : 'text-amber-700'}`}>
            {saveModal.type === 'blocking' ? '⛔ 必要條件未達，無法儲存' : '⚠️ 有建議改善項目'}
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            {saveModal.type === 'blocking'
              ? '修正以下問題後才能儲存：'
              : '以下項目建議修正。您可以選擇仍然儲存，或取消並回去調整：'}
          </p>
        </div>
        <div className="px-6 py-4 max-h-80 overflow-y-auto">
          <ul className="text-base text-gray-700 space-y-1.5 list-disc list-inside">
            {saveModal.messages.map((m, i) => <li key={i}>{m}</li>)}
          </ul>
        </div>
        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-lg text-base text-gray-700 hover:bg-gray-100 transition-colors">
            {saveModal.type === 'blocking' ? '知道了' : '取消'}
          </button>
          {saveModal.type === 'warning' && (
            <button
              onClick={onSaveAnyway}
              className="px-4 py-2 rounded-lg text-base text-white font-semibold transition-colors"
              style={{ background: '#D97706' }}
              onMouseEnter={e => e.currentTarget.style.background = '#B45309'}
              onMouseLeave={e => e.currentTarget.style.background = '#D97706'}>
              仍然儲存
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// PR I: confirm modal for the global "重設所有手動端點" action.
// Destructive (can't undo) → require explicit confirmation.
export function ResetAllModal({ open, onCancel, onConfirm }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.45)' }}
      onClick={e => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col">
        <div className="px-6 py-4 border-b border-amber-200 bg-amber-50">
          <h2 className="text-xl font-bold text-amber-700">⚠️ 重設所有手動端點</h2>
          <p className="text-sm text-gray-600 mt-1">此動作會清除本工作流所有連線的手動拖曳端點設定，回到自動路由。無法復原。</p>
        </div>
        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-lg text-base text-gray-700 hover:bg-gray-100 transition-colors">
            取消
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 rounded-lg text-base text-white font-semibold transition-colors"
            style={{ background: '#D97706' }}
            onMouseEnter={e => e.currentTarget.style.background = '#B45309'}
            onMouseLeave={e => e.currentTarget.style.background = '#D97706'}>
            確定重設
          </button>
        </div>
      </div>
    </div>
  );
}

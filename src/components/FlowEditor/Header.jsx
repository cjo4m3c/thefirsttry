/**
 * Top header bar of FlowEditor:
 *   - back button + logo (with happy / wave reaction class)
 *   - L3 number / name editable inputs
 *   - unsaved-changes indicator
 *   - "重設所有手動端點" button (only when overrides exist)
 *   - pin toggle
 *   - "編輯" button (opens drawer)
 *   - "儲存" button
 */
export function Header({ liveFlow, hasChanges, logoReaction, onBack, onPatch,
  onTogglePin, onOpenDrawer, onSave, onResetAllConfirm }) {
  return (
    <header className="px-6 py-3 shadow-md flex items-center gap-4 sticky top-0 z-10"
      style={{ background: '#2A5598', color: 'white' }}>
      <button onClick={onBack} className="opacity-70 hover:opacity-100 text-base flex-shrink-0">← 返回</button>
      <img
        src={`${import.meta.env.BASE_URL}logo.png`}
        alt="FlowSprite Logo"
        className={`h-9 w-9 rounded-full object-cover flex-shrink-0 logo-happy ${logoReaction ? `logo-${logoReaction}` : ''}`}
        onError={e => { e.currentTarget.style.display = 'none'; }}
      />
      <div className="flex items-center gap-2 min-w-0">
        <input
          value={liveFlow.l3Number || ''}
          onChange={e => onPatch({ l3Number: e.target.value })}
          placeholder="L3 編號"
          className="w-24 px-2 py-1 rounded text-base bg-white bg-opacity-15 border border-white border-opacity-30 text-white placeholder-white placeholder-opacity-50 focus:outline-none focus:ring-1 focus:ring-white"
        />
        <input
          value={liveFlow.l3Name || ''}
          onChange={e => onPatch({ l3Name: e.target.value })}
          placeholder="L3 活動名稱"
          className="flex-1 min-w-0 px-2 py-1 rounded text-base bg-white bg-opacity-15 border border-white border-opacity-30 text-white placeholder-white placeholder-opacity-50 focus:outline-none focus:ring-1 focus:ring-white"
        />
      </div>
      <div className="ml-auto flex items-center gap-2 flex-shrink-0">
        {hasChanges && (
          <span className="text-sm text-yellow-300 font-medium hidden sm:inline">● 未儲存</span>
        )}
        {/* PR I: global reset for all manual endpoint overrides. Shown
            only when the current flow has at least one override — avoids
            an always-on destructive button. Opens a confirm modal. */}
        {liveFlow.tasks.some(t => t.connectionOverrides && Object.keys(t.connectionOverrides).length > 0) && (
          <button
            onClick={onResetAllConfirm}
            title="重設所有手動拖曳的連線端點"
            className="px-3 py-1 text-sm rounded border border-white border-opacity-40 text-white hover:bg-white hover:bg-opacity-10">
            重設所有手動端點
          </button>
        )}
        <button
          onClick={onTogglePin}
          title={liveFlow.pinned ? '取消置頂' : '置頂此工作流'}
          className="p-1.5 rounded transition-transform hover:scale-110">
          <svg width="20" height="20" viewBox="0 0 24 24"
            fill={liveFlow.pinned ? '#FBBF24' : 'none'}
            stroke={liveFlow.pinned ? '#FBBF24' : 'white'} strokeWidth="2"
            strokeLinejoin="round">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
          </svg>
        </button>
        <button
          onClick={onOpenDrawer}
          title="開啟編輯面板"
          className="px-3 py-1.5 text-base rounded border border-white border-opacity-40 text-white hover:bg-white hover:bg-opacity-10 flex items-center gap-1">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z" />
          </svg>
          編輯
        </button>
        <button
          onClick={onSave}
          className="px-4 py-1.5 text-base rounded font-medium transition-colors"
          style={{ background: hasChanges ? '#7AB5DD' : '#6B7280', color: hasChanges ? '#1E4677' : 'white' }}>
          儲存
        </button>
      </div>
    </header>
  );
}

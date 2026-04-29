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
        {/* M-1 unified header buttons — same height (py-1.5), same outlined-white
            style. Order from left to right: [conditional reset] [open editor]
            [save] [pin star]. Save uses solid white fill on hasChanges to draw
            attention; pin star is the rightmost since it's a per-flow flag. */}
        {liveFlow.tasks.some(t => t.connectionOverrides && Object.keys(t.connectionOverrides).length > 0) && (
          <button
            onClick={onResetAllConfirm}
            title="重設所有手動拖曳的連線端點"
            className="px-3 py-1.5 text-base rounded border border-white border-opacity-40 text-white hover:bg-white hover:bg-opacity-10 transition-colors">
            重設所有端點
          </button>
        )}
        <button
          onClick={onOpenDrawer}
          title="開啟編輯面板"
          className="px-3 py-1.5 text-base rounded border border-white border-opacity-40 text-white hover:bg-white hover:bg-opacity-10 transition-colors">
          打開編輯器
        </button>
        <button
          onClick={onSave}
          title={hasChanges ? '儲存所有變更' : '目前沒有未儲存的變更'}
          className={`px-3 py-1.5 text-base rounded border transition-colors ${
            hasChanges
              ? 'border-white bg-white text-[#1E4677] font-semibold hover:bg-opacity-90'
              : 'border-white border-opacity-40 text-white hover:bg-white hover:bg-opacity-10'
          }`}>
          儲存
        </button>
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
      </div>
    </header>
  );
}

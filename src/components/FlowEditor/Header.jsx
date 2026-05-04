import { useState, useRef, useEffect } from 'react';
import { LegendModal } from '../DiagramRenderer/legend.jsx';

// Encouragement phrases shown as the save-button tooltip when there are
// unsaved changes. Picked once per edit session (locks until save) so the
// hover text doesn't shuffle on every keystroke. Curated by user 2026-05-04
// to make the save reminder less mechanical.
const SAVE_PHRASES = [
  '上次存檔的勇者，都活下來了',
  '你距離「完美的一天」只差一個儲存',
  '你的工作成果值得被記住',
  '你今天存檔了嗎？每一步努力都值得留下印記',
  '如果是欣梅爾的話，一定會按儲存的',
];
function pickRandomPhrase() {
  return SAVE_PHRASES[Math.floor(Math.random() * SAVE_PHRASES.length)];
}

/**
 * Top header bar of FlowEditor:
 *   - back button + logo (with happy / wave reaction class)
 *   - L3 number / name editable inputs
 *   - unsaved-changes indicator
 *   - "圖例" button (opens LegendModal)
 *   - "重設所有手動端點" button (only when overrides exist)
 *   - "打開編輯器" button (opens drawer)
 *   - "下載 ▼" dropdown (PNG / .drawio / Excel) — each item runs
 *     saveAndValidate first then triggers the matching exporter
 *   - "儲存" button
 *   - pin toggle (rightmost)
 */
export function Header({ liveFlow, hasChanges, logoReaction, onBack, onPatch,
  onTogglePin, onOpenDrawer, onSave, onResetAllConfirm, downloadHandlers,
  onUndo, onRedo, canUndo = false, canRedo = false,
  savePulse = 'none', saveCelebrate = false,
  densityMode = 'default', onCycleDensity }) {
  const densityLabel =
    densityMode === 'compact'  ? '⊟ 緊密' :
    densityMode === 'spacious' ? '⊞ 寬鬆' :
                                 '▦ 預設';
  const densityNext =
    densityMode === 'default'  ? '緊密' :
    densityMode === 'compact'  ? '寬鬆' :
                                 '預設';
  // Per-edit-session random encouragement phrase. Re-randomizes each time
  // hasChanges flips false→true (i.e., a fresh edit session after save).
  const [savePhrase, setSavePhrase] = useState(() => pickRandomPhrase());
  useEffect(() => {
    if (hasChanges) setSavePhrase(pickRandomPhrase());
  }, [hasChanges]);
  const [downloadOpen, setDownloadOpen] = useState(false);
  const [legendOpen, setLegendOpen] = useState(false);
  const downloadRef = useRef(null);
  useEffect(() => {
    if (!downloadOpen) return;
    function onDocClick(e) {
      if (downloadRef.current && !downloadRef.current.contains(e.target)) {
        setDownloadOpen(false);
      }
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [downloadOpen]);

  function pickDownload(kind) {
    setDownloadOpen(false);
    downloadHandlers?.[kind]?.();
  }

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
        {/* Header buttons. Order left → right:
            [圖例] [conditional reset] [open editor] [download ▼] [save] [pin star].
            Same outlined-white style; "儲存" gets solid white fill on hasChanges. */}
        <button
          onClick={() => setLegendOpen(true)}
          title="圖例說明（流程圖元件對照表）"
          className="px-3 py-1.5 text-base rounded border border-white border-opacity-40 text-white hover:bg-white hover:bg-opacity-10 transition-colors">
          圖例
        </button>
        {/* Density toggle (compact / default / spacious) — cycles on click.
            Applied via CSS zoom on the diagram wrapper; PNG export
            temporarily resets to 1x for full-resolution capture. */}
        <button
          onClick={onCycleDensity}
          title={`目前：${densityLabel} — 點一下切換到「${densityNext}」`}
          className="px-3 py-1.5 text-base rounded border border-white border-opacity-40 text-white hover:bg-white hover:bg-opacity-10 transition-colors">
          {densityLabel}
        </button>
        {/* Undo / Redo (Ctrl+Z / Ctrl+Y or Ctrl+Shift+Z). Stack clears
            after every save per spec — disabled while empty so users see
            visually whether undo is available. */}
        <button
          onClick={onUndo}
          disabled={!canUndo}
          title={canUndo ? '復原（Ctrl+Z / Cmd+Z）' : '沒有可復原的動作（每次儲存後會清空）'}
          className="px-3 py-1.5 text-base rounded border border-white border-opacity-40 text-white hover:bg-white hover:bg-opacity-10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
          ↶ 復原
        </button>
        <button
          onClick={onRedo}
          disabled={!canRedo}
          title={canRedo ? '取消復原（Ctrl+Y / Ctrl+Shift+Z）' : '沒有可重做的動作'}
          className="px-3 py-1.5 text-base rounded border border-white border-opacity-40 text-white hover:bg-white hover:bg-opacity-10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
          ↷ 重做
        </button>
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
        <div ref={downloadRef} className="relative">
          <button
            onClick={() => setDownloadOpen(v => !v)}
            title="下載流程圖或 Excel（會先檢核並儲存全頁變更）"
            className="px-3 py-1.5 text-base rounded border border-white border-opacity-40 text-white hover:bg-white hover:bg-opacity-10 transition-colors whitespace-nowrap inline-flex items-center gap-1.5">
            <span>下載</span>
            <svg width="10" height="6" viewBox="0 0 10 6" fill="currentColor" aria-hidden="true">
              <polygon points="0,0 10,0 5,6" />
            </svg>
          </button>
          {downloadOpen && (
            <div className="absolute right-0 mt-1 min-w-[160px] bg-white rounded shadow-lg border border-gray-200 py-1 z-20">
              <button
                onClick={() => pickDownload('png')}
                className="block w-full text-left px-4 py-2 text-base text-gray-700 hover:bg-blue-50">
                下載 PNG
              </button>
              <button
                onClick={() => pickDownload('drawio')}
                title="可用 diagrams.net（免費）或 VS Code Draw.io 擴充套件開啟編輯"
                className="block w-full text-left px-4 py-2 text-base text-gray-700 hover:bg-blue-50">
                下載 Drawio
              </button>
              <button
                onClick={() => pickDownload('excel')}
                className="block w-full text-left px-4 py-2 text-base text-gray-700 hover:bg-blue-50">
                下載 Excel
              </button>
            </div>
          )}
        </div>
        <div className="relative">
          <button
            onClick={onSave}
            title={hasChanges ? savePhrase : '目前沒有未儲存的變更'}
            className={`px-3 py-1.5 text-base rounded border font-semibold transition-colors ${
              saveCelebrate
                ? 'border-emerald-400 save-celebrate-flash'
                : savePulse !== 'none'
                  ? 'border-amber-300 bg-amber-400 text-amber-950 hover:bg-amber-300 save-pulse'
                  : hasChanges
                    ? 'border-white bg-white text-[#1E4677] hover:bg-opacity-90'
                    : 'border-white border-opacity-40 text-white font-normal hover:bg-white hover:bg-opacity-10'
            }`}>
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
      <LegendModal open={legendOpen} onClose={() => setLegendOpen(false)} />
    </header>
  );
}

/**
 * Top toolbar above the diagram:
 *   - L3 number + name label
 *   - PNG / .drawio export buttons
 *   - Edit-hint banner (when editable) with selected-connection helpers
 */
export function DiagramToolbar({ flow, showExport, onExport, onExportDrawio, onExportExcel,
  editable, selectedConnKey, selectedConnHasOverride, onResetSelected, onClearSelection }) {
  return (
    <>
      {showExport && (
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-sm text-gray-600 font-medium">
            {flow.l3Number} {flow.l3Name}
          </span>
          <div className="ml-auto flex gap-2">
            {/* M-1 unified: all three download buttons share the app's primary
                blue (#2A5598 / hover #1E4677), matching the Dashboard top-right
                buttons and the FlowEditor Header background. */}
            <button onClick={onExport}
              className="px-4 py-1.5 text-sm text-white rounded transition-colors"
              style={{ background: '#2A5598' }}
              onMouseEnter={e => e.currentTarget.style.background = '#1E4677'}
              onMouseLeave={e => e.currentTarget.style.background = '#2A5598'}>
              ↓ 匯出 PNG
            </button>
            <button onClick={onExportDrawio}
              title="可用 diagrams.net（免費）或 VS Code Draw.io 擴充套件開啟編輯"
              className="px-4 py-1.5 text-sm text-white rounded transition-colors"
              style={{ background: '#2A5598' }}
              onMouseEnter={e => e.currentTarget.style.background = '#1E4677'}
              onMouseLeave={e => e.currentTarget.style.background = '#2A5598'}>
              ↓ 匯出 .drawio
            </button>
            {onExportExcel && (
              <button onClick={onExportExcel}
                title="下載任務表格 Excel（按下時會先檢核並儲存全頁變更）"
                className="px-4 py-1.5 text-sm text-white rounded transition-colors"
                style={{ background: '#2A5598' }}
                onMouseEnter={e => e.currentTarget.style.background = '#1E4677'}
                onMouseLeave={e => e.currentTarget.style.background = '#2A5598'}>
                ↓ 下載 Excel
              </button>
            )}
          </div>
        </div>
      )}

      {editable && (
        <div className="text-xs text-gray-500 -mt-1 flex items-center gap-2 flex-wrap">
          <span>點選連線可拖曳端點（🔵 圓點）：拖到原本任務的其他 port = 覆寫端點；拖到別的任務 = 換目標任務</span>
          {selectedConnKey && (
            <>
              <span className="text-blue-600">● 已選取連線</span>
              {selectedConnHasOverride && (
                <button
                  onClick={onResetSelected}
                  className="px-2 py-0.5 text-xs rounded border border-amber-400 text-amber-700 bg-amber-50 hover:bg-amber-100">
                  重設此連線端點
                </button>
              )}
              <button
                onClick={onClearSelection}
                className="px-2 py-0.5 text-xs rounded border border-gray-300 text-gray-600 hover:bg-gray-50">
                取消選取 (Esc)
              </button>
            </>
          )}
        </div>
      )}
    </>
  );
}

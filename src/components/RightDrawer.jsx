import { useEffect } from 'react';

/**
 * RightDrawer — slide-in panel from the right edge.
 *
 * Used by FlowEditor to host the "設定流程 / 設定泳道角色" tabs without
 * forcing the user to scroll below the diagram. Drawer overlays main
 * content (semi-transparent backdrop on smaller widths only) so the
 * diagram remains visible alongside.
 *
 * Props:
 *   - open       boolean — controls slide state
 *   - onClose    () => void — called by close button / Esc / backdrop
 *   - title      string — header text
 *   - tabs       [{ key, label }] — tab definitions (optional)
 *   - activeTab  string — current tab key (when tabs provided)
 *   - onTabChange(key) — called on tab click
 *   - width      string — Tailwind width class for drawer (default 'w-[480px]')
 *   - children   tab content
 */
export default function RightDrawer({
  open, onClose, title,
  tabs, activeTab, onTabChange,
  width = 'w-full sm:w-[520px] md:w-[560px]',
  children,
}) {
  // Esc closes drawer.
  useEffect(() => {
    if (!open) return;
    const onKey = e => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <>
      {/* Backdrop — only visible on small screens (<sm) where drawer is full-width */}
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black bg-opacity-30 sm:hidden"
          onClick={onClose}
        />
      )}

      {/* Drawer panel */}
      <aside
        className={`fixed top-0 right-0 h-screen z-40 ${width} bg-white shadow-2xl
          border-l border-gray-200 flex flex-col
          transition-transform duration-300 ease-in-out
          ${open ? 'translate-x-0' : 'translate-x-full'}`}
        aria-hidden={!open}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50 flex-shrink-0">
          <h3 className="text-sm font-semibold text-gray-700">{title}</h3>
          <button
            onClick={onClose}
            title="收合（Esc）"
            className="w-8 h-8 flex items-center justify-center rounded text-gray-500 hover:bg-gray-200 hover:text-gray-800 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Optional tab bar */}
        {tabs && tabs.length > 0 && (
          <div className="flex border-b border-gray-200 flex-shrink-0">
            {tabs.map(tab => (
              <button
                key={tab.key}
                onClick={() => onTabChange?.(tab.key)}
                className={`flex-1 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.key
                    ? 'border-blue-600 text-blue-700 bg-blue-50'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}

        {/* Content (scrollable) */}
        <div className="flex-1 overflow-y-auto p-4">
          {children}
        </div>
      </aside>
    </>
  );
}

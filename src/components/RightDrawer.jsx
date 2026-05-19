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
          border-l border-line flex flex-col
          transition-transform duration-300 ease-in-out
          ${open ? 'translate-x-0' : 'translate-x-full'}`}
        aria-hidden={!open}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-line bg-paper-2 flex-shrink-0">
          <h3 className="text-sm font-semibold text-ink">{title}</h3>
          <button
            onClick={onClose}
            title="收合（Esc）"
            className="w-8 h-8 flex items-center justify-center rounded text-ink-soft hover:bg-paper-2 hover:text-ink transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Optional tab bar */}
        {tabs && tabs.length > 0 && (
          <div className="flex border-b border-line flex-shrink-0">
            {tabs.map(tab => (
              <button
                key={tab.key}
                onClick={() => onTabChange?.(tab.key)}
                className={`flex-1 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.key
                    ? 'border-brand text-brand bg-brand-soft'
                    : 'border-transparent text-ink-soft hover:text-ink hover:bg-paper-2'
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

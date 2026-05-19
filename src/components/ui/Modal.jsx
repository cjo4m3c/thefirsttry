/**
 * Modal — 共用 modal 元件，對齊 design_handoff_flowsprite spec
 * `.modal-backdrop` / `.modal-head` / `.modal-body` / `.modal-foot`。
 *
 * 用法：
 *   <Modal isOpen={open} onClose={() => setOpen(false)} title="標題" subtitle="副標">
 *     <ModalBody>...內容...</ModalBody>
 *     <ModalFoot>
 *       <Button onClick={...}>取消</Button>
 *       <Button variant="primary" onClick={...}>確認</Button>
 *     </ModalFoot>
 *   </Modal>
 *
 * 設計原則：
 *   - 點 backdrop 觸發 onClose（標準 modal pattern）
 *   - ESC 鍵觸發 onClose
 *   - 阻擋 body scroll（modal 開啟時）
 *   - z-index 1000、shadow 重型
 */
import { useEffect } from 'react';

// Header bg / border / title color tokens per variant. Default 走中性 line-dim、
// warning/danger 用 semantic tokens（給 SaveModal blocking / ResetAll warning 等用）。
const HEADER_VARIANTS = {
  default: { bg: '',                 border: 'border-line-dim',  title: '' },
  warning: { bg: 'bg-warning-soft',  border: 'border-warning',   title: 'text-warning-ink' },
  danger:  { bg: 'bg-danger-soft',   border: 'border-danger',    title: 'text-danger-ink' },
};

export function Modal({ isOpen, onClose, title, subtitle, variant = 'default', width = 720, children, className = '' }) {
  // ESC key + body scroll lock
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center"
      style={{ background: 'rgba(14, 31, 66, 0.45)' }}
      onClick={onClose}
    >
      <div
        className={`bg-card rounded-lg flex flex-col overflow-hidden max-h-[88vh] ${className}`}
        style={{
          width,
          boxShadow: '0 24px 64px rgba(14, 31, 66, 0.25), 0 2px 8px rgba(14, 31, 66, 0.1)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {(title || subtitle || onClose) && (() => {
          const v = HEADER_VARIANTS[variant] || HEADER_VARIANTS.default;
          return (
            <div className={`px-6 pt-5 pb-4 border-b ${v.bg} ${v.border} flex items-start justify-between gap-4`}>
              <div className="flex-1 min-w-0">
                {title && <h2 className={`t-h1 m-0 ${v.title}`}>{title}</h2>}
                {subtitle && <p className="t-caption mt-1 m-0">{subtitle}</p>}
              </div>
              {onClose && (
                <button
                  onClick={onClose}
                  title="關閉（Esc）"
                  className="w-7 h-7 rounded-md text-ink-soft text-base inline-flex items-center justify-center flex-shrink-0 hover:bg-paper-2 hover:text-ink"
                >
                  ✕
                </button>
              )}
            </div>
          );
        })()}
        {children}
      </div>
    </div>
  );
}

export function ModalBody({ children, className = '' }) {
  return <div className={`px-6 py-4 overflow-y-auto flex-1 ${className}`}>{children}</div>;
}

export function ModalFoot({ children, className = '' }) {
  return (
    <div className={`px-6 py-3 border-t border-line-dim bg-paper flex justify-end gap-2 ${className}`}>
      {children}
    </div>
  );
}

import { useEffect } from 'react';
import { COLORS } from '../../diagram/constants.js';

export function LegendSection() {
  const items = [
    { shape: 'start',       label: '活動起點' },
    { shape: 'end',         label: '活動終點' },
    { shape: 'task',        label: 'L4 任務' },
    { shape: 'interaction', label: '外部關係人互動' },
    { shape: 'gateway-xor', label: '排他闘道 (XOR)' },
    { shape: 'gateway-and', label: '並行闘道 (AND)' },
    { shape: 'gateway-or',  label: '包容闘道 (OR)' },
    { shape: 'l3activity',  label: 'L3 活動（關聯）' },
    { shape: 'arrow',       label: '順序流' },
  ];

  return (
    <div className="mt-4 p-4 bg-white border border-gray-200 rounded-lg">
      <div className="text-sm font-semibold text-gray-700 mb-3">圖例說明</div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {items.map(item => (
          <div key={item.shape} className="flex items-center gap-2">
            <LegendIcon type={item.shape} />
            <span className="text-xs text-gray-600">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function LegendIcon({ type }) {
  const s = 36;
  const c = s / 2;
  if (type === 'start') return (
    <svg width={s} height={s}><circle cx={c} cy={c} r={12} fill={COLORS.START_FILL} stroke={COLORS.START_STROKE} strokeWidth={2} /></svg>
  );
  if (type === 'end') return (
    <svg width={s} height={s}><circle cx={c} cy={c} r={12} fill={COLORS.END_FILL} stroke={COLORS.END_FILL} strokeWidth={2} /></svg>
  );
  if (type === 'task') return (
    <svg width={s} height={s}><rect x={3} y={8} width={30} height={20} fill={COLORS.TASK_FILL} stroke={COLORS.TASK_STROKE} strokeWidth={1.2} rx={2} /></svg>
  );
  if (type === 'interaction') return (
    <svg width={s} height={s}><rect x={3} y={8} width={30} height={20} fill={COLORS.INTERACTION_FILL} stroke={COLORS.TASK_STROKE} strokeWidth={1.2} rx={2} /></svg>
  );
  if (type === 'gateway-xor') {
    const sym = 6;
    return (
      <svg width={s} height={s}>
        <polygon points={`${c},4 ${s-4},${c} ${c},${s-4} 4,${c}`} fill={COLORS.GATEWAY_FILL} stroke={COLORS.GATEWAY_STROKE} strokeWidth={1.2} />
        <line x1={c-sym} y1={c-sym} x2={c+sym} y2={c+sym} stroke={COLORS.GATEWAY_STROKE} strokeWidth={1.8} />
        <line x1={c+sym} y1={c-sym} x2={c-sym} y2={c+sym} stroke={COLORS.GATEWAY_STROKE} strokeWidth={1.8} />
      </svg>
    );
  }
  if (type === 'gateway-and') {
    const sym = 6;
    return (
      <svg width={s} height={s}>
        <polygon points={`${c},4 ${s-4},${c} ${c},${s-4} 4,${c}`} fill={COLORS.GATEWAY_FILL} stroke={COLORS.GATEWAY_STROKE} strokeWidth={1.2} />
        <line x1={c} y1={c-sym} x2={c} y2={c+sym} stroke={COLORS.GATEWAY_STROKE} strokeWidth={1.8} />
        <line x1={c-sym} y1={c} x2={c+sym} y2={c} stroke={COLORS.GATEWAY_STROKE} strokeWidth={1.8} />
      </svg>
    );
  }
  if (type === 'gateway-or') {
    return (
      <svg width={s} height={s}>
        <polygon points={`${c},4 ${s-4},${c} ${c},${s-4} 4,${c}`} fill={COLORS.GATEWAY_FILL} stroke={COLORS.GATEWAY_STROKE} strokeWidth={1.2} />
        <circle cx={c} cy={c} r={6} fill="none" stroke={COLORS.GATEWAY_STROKE} strokeWidth={1.5} />
      </svg>
    );
  }
  if (type === 'l3activity') return (
    <svg width={s} height={s}>
      <rect x={3} y={6} width={30} height={22} fill={COLORS.L3_ACTIVITY_FILL} stroke={COLORS.L3_ACTIVITY_STROKE} strokeWidth={1.5} />
      <line x1={11} y1={6} x2={11} y2={28} stroke={COLORS.L3_ACTIVITY_STROKE} strokeWidth={1} />
      <line x1={25} y1={6} x2={25} y2={28} stroke={COLORS.L3_ACTIVITY_STROKE} strokeWidth={1} />
    </svg>
  );
  if (type === 'arrow') return (
    <svg width={s} height={s}>
      <defs><marker id="leg-ah" markerWidth="6" markerHeight="5" refX="6" refY="2.5" orient="auto"><polygon points="0 0,6 2.5,0 5" fill={COLORS.ARROW_COLOR} /></marker></defs>
      <line x1={2} y1={c} x2={s-6} y2={c} stroke={COLORS.ARROW_COLOR} strokeWidth={1.5} markerEnd="url(#leg-ah)" />
    </svg>
  );
  return null;
}

/**
 * LegendModal — pop-up frame around LegendSection. Triggered from the
 * FlowEditor Header's "圖例" button so the legend no longer occupies space
 * inside DiagramRenderer (page now contains only the diagram + table).
 *
 * Click backdrop / ESC closes.
 */
export function LegendModal({ open, onClose }) {
  useEffect(() => {
    if (!open) return;
    function onKey(e) { if (e.key === 'Escape') onClose?.(); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[85vh] overflow-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-3 border-b border-gray-200 flex items-center justify-between">
          <span className="text-base font-semibold text-gray-700">圖例說明</span>
          <button onClick={onClose} title="關閉（Esc）"
            className="text-gray-400 hover:text-gray-700 text-lg leading-none">✕</button>
        </div>
        <div className="p-5">
          <LegendSection />
        </div>
      </div>
    </div>
  );
}

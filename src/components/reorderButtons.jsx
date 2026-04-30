/**
 * ReorderButtons — up/down arrow controls replacing the previous HTML5
 * drag-handle. After three failed attempts to make HTML5 drag reliable
 * inside rows that contain <input> / <select> (PR #104 split rowProps /
 * handleProps; PR #106 SVG pointer-events; PR #108 SVG → div+spans), we
 * dropped HTML5 drag entirely on 2026-04-30 and switched to explicit
 * ▲ ▼ buttons. Trade-offs:
 *   ✓ 100% reliable across browsers / touch / accessibility
 *   ✓ Zero deps (no @dnd-kit), works keyboard-first
 *   ✓ Removed ~80 lines of fragile drag plumbing (dragIdx / overIdx /
 *     dropAfter state, DropLine renderer, rowProps/handleProps split)
 *   ✗ Less fluid for moving multiple positions — but typical L3 flows
 *     have 5-10 tasks so two clicks is rarely a problem
 *
 * Visual: occupies the same w-5 slot as the old DragHandle so all
 * 5-column TaskCard layouts stay aligned. ▲ above, ▼ below; both
 * disabled at list edges.
 */
export function ReorderButtons({ canUp, canDown, onUp, onDown }) {
  return (
    <div className="flex flex-col items-center justify-center w-5 flex-shrink-0 select-none gap-0">
      <button
        type="button"
        onClick={onUp}
        disabled={!canUp}
        title="向上移動"
        aria-label="向上移動"
        className="w-5 h-4 leading-none text-xs text-gray-400 hover:text-blue-600 disabled:opacity-20 disabled:cursor-not-allowed">
        ▲
      </button>
      <button
        type="button"
        onClick={onDown}
        disabled={!canDown}
        title="向下移動"
        aria-label="向下移動"
        className="w-5 h-4 leading-none text-xs text-gray-400 hover:text-blue-600 disabled:opacity-20 disabled:cursor-not-allowed">
        ▼
      </button>
    </div>
  );
}

/**
 * moveItem — pure helper for "move element at fromIdx by `dir` (-1 / +1)".
 * Returns a new array, or the same array if move is a no-op (out of bounds
 * or dir=0). Reused by FlowEditor task / role moves and Wizard role moves.
 */
export function moveItem(items, fromIdx, dir) {
  const toIdx = fromIdx + dir;
  if (toIdx < 0 || toIdx >= items.length || dir === 0) return items;
  const next = [...items];
  const [moved] = next.splice(fromIdx, 1);
  next.splice(toIdx, 0, moved);
  return next;
}

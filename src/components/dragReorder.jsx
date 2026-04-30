import { useState } from 'react';

/**
 * Generic HTML5 drag-and-drop reorder hook.
 *
 * Wizard (roles list) and FlowEditor (tasks list) share this identical
 * implementation. Parent passes `items` + an `onReorder(nextItems)` callback;
 * hook returns `{ dragIdx, overIdx, dropAfter, rowProps, handleProps }`.
 *
 * Drop-position semantics (improved 2026-04-27):
 *   onDragOver compares mouse Y to the row's vertical midpoint and reports
 *   whether the drop will land *above* (dropAfter=false) or *below*
 *   (dropAfter=true) row `overIdx`. Renderers should draw a thin colored
 *   line on the corresponding edge — a top border when !dropAfter, a bottom
 *   border when dropAfter — so the user sees the exact future insertion
 *   slot ("between rows") rather than a whole-row highlight that's
 *   ambiguous about above-vs-below.
 *
 * Drag start vs drop target split (2026-04-29):
 *   `rowProps(i)` returns ONLY the row-level handlers (onDragOver / onDrop /
 *   onDragEnd) — meant for the row's outer container. `handleProps(i)`
 *   returns the actual draggable trigger (`draggable=true` + onDragStart),
 *   meant for the DragHandle element. This split avoids the HTML5 quirk
 *   where input/select fields inside a draggable row swallow drag events,
 *   making rows look "un-draggable" except at the row's edges. Now drag
 *   only starts from the DragHandle, so all rows behave consistently.
 */
export function useDragReorder(items, onReorder) {
  const [dragIdx, setDragIdx] = useState(null);
  const [overIdx, setOverIdx] = useState(null);
  const [dropAfter, setDropAfter] = useState(false);

  function onDragStart(e, i) {
    setDragIdx(i);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', '');
  }
  function onDragOver(e, i) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const rect = e.currentTarget.getBoundingClientRect();
    const after = e.clientY > rect.top + rect.height / 2;
    if (i !== overIdx) setOverIdx(i);
    if (after !== dropAfter) setDropAfter(after);
  }
  function onDrop(e, i) {
    e.preventDefault();
    if (dragIdx !== null) {
      let target = dropAfter ? i + 1 : i;
      if (dragIdx < target) target -= 1;
      if (target !== dragIdx) {
        const next = [...items];
        const [moved] = next.splice(dragIdx, 1);
        next.splice(target, 0, moved);
        onReorder(next);
      }
    }
    setDragIdx(null); setOverIdx(null); setDropAfter(false);
  }
  function onDragEnd() { setDragIdx(null); setOverIdx(null); setDropAfter(false); }
  // Row-level handlers — receives the drop, doesn't initiate drag.
  function rowProps(i) {
    return {
      onDragOver: e => onDragOver(e, i),
      onDrop:    e => onDrop(e, i),
      onDragEnd,
    };
  }
  // DragHandle handlers — initiates the drag. Spread onto the DragHandle's
  // root element (inside <DragHandle {...handleProps(i)} />).
  function handleProps(i) {
    return {
      draggable: true,
      onDragStart: e => onDragStart(e, i),
    };
  }
  return { dragIdx, overIdx, dropAfter, rowProps, handleProps };
}

/** Six-dot drag affordance icon used by every draggable row.
 *  Pass the parent's `handleProps(i)` so this element is the draggable
 *  trigger (draggable=true + onDragStart), keeping the rest of the row
 *  free for normal input/select interaction.
 *
 *  Caveat (fixed 2026-04-29): the inner <svg> needs `pointer-events: none`
 *  because SVG elements default to draggable=false and will swallow the
 *  drag attempt before it bubbles to the parent <div draggable=true>. The
 *  six-dot grid covers the whole DragHandle, so without this fix the user
 *  can't actually trigger drag from the handle. */
export function DragHandle(props) {
  return (
    <div {...props}
      className="flex items-center justify-center w-5 flex-shrink-0 cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500 select-none">
      <svg width="10" height="16" viewBox="0 0 10 16" fill="currentColor"
        style={{ pointerEvents: 'none' }}>
        <circle cx="3" cy="3"  r="1.4"/><circle cx="7" cy="3"  r="1.4"/>
        <circle cx="3" cy="8"  r="1.4"/><circle cx="7" cy="8"  r="1.4"/>
        <circle cx="3" cy="13" r="1.4"/><circle cx="7" cy="13" r="1.4"/>
      </svg>
    </div>
  );
}

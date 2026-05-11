import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Positioning / drag / dismiss for the floating ContextMenu pop-up.
 *
 * Owns four pieces of cross-cutting behaviour that have no connection to the
 * menu's business state (form contents, sub-form toggle, submit handlers):
 *
 *   1. Initial placement at the click point + reset whenever a different task
 *      is clicked.
 *   2. Viewport clamp on size change (ResizeObserver + window resize) —
 *      sub-form expand / collapse + drag + window resize all funnel through
 *      `reclamp()`. Per user spec 2026-05-04: always corrects overflow even
 *      after manual drag.
 *   3. Pointer drag from the ☰ handle. Live position is clamped while
 *      dragging so the menu can't be dragged off-screen. `startDrag` is the
 *      handle's `onPointerDown`.
 *   4. Dismiss on click-outside / Esc — `onClose` is called by both. Click-
 *      outside is skipped while actively dragging so releasing the pointer
 *      outside doesn't accidentally close.
 *
 * @param x         Initial viewport X (click coordinate)
 * @param y         Initial viewport Y (click coordinate)
 * @param taskId    Currently-focused task id; changes reset the initial
 *                  position back to the click point.
 * @param onClose   Called on click-outside / Esc.
 * @returns { ref, adjusted, dragging, startDrag }
 *   - ref       attach to the menu root `<div>`
 *   - adjusted  { left, top } current pixel position (always clamped)
 *   - dragging  true while drag in progress (caller may toggle cursor style)
 *   - startDrag onPointerDown handler for the drag handle
 */
export function useContextMenuPosition({ x, y, taskId, onClose }) {
  const ref = useRef(null);
  const [adjusted, setAdjusted] = useState({ left: x, top: y });
  // Per user spec 2026-05-04 the menu is always reclamped on size change
  // (incl. after a drag), so we only need the dragging flag and pointer
  // offset to drive the live drag.
  const [dragging, setDragging] = useState(false);
  const dragOffsetRef = useRef({ dx: 0, dy: 0 });

  // Initialize position from the click point whenever the menu opens for
  // a different task. Subsequent drags / sub-form expansions only adjust
  // from the previous adjusted position (not back to the click point).
  useEffect(() => {
    setAdjusted({ left: x, top: y });
  }, [x, y, taskId]);

  // Pure clamp — given prev (left, top), shrink to viewport bounds.
  // Reads ref.current rect inside so it always uses the latest size.
  const reclamp = useCallback(() => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    setAdjusted(prev => {
      let left = prev.left;
      let top = prev.top;
      if (left + rect.width > vw - 8)  left = vw - rect.width - 8;
      if (top  + rect.height > vh - 8) top  = vh - rect.height - 8;
      if (left < 8) left = 8;
      if (top  < 8) top  = 8;
      return (left === prev.left && top === prev.top) ? prev : { left, top };
    });
  }, []);

  // Auto-reclamp on size changes — covers sub-form expand/collapse + window
  // resize + post-drag (when user drags to an edge then expands).
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(() => reclamp());
    ro.observe(ref.current);
    function onWinResize() { reclamp(); }
    window.addEventListener('resize', onWinResize);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', onWinResize);
    };
  }, [reclamp]);

  // Drag handlers — pointermove / pointerup attach to window only while
  // actively dragging. Live position is also clamped to viewport so the
  // user can't lose the menu off-screen.
  function startDrag(e) {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    dragOffsetRef.current = {
      dx: e.clientX - rect.left,
      dy: e.clientY - rect.top,
    };
    setDragging(true);
    e.preventDefault();
  }
  useEffect(() => {
    if (!dragging) return;
    function onMove(e) {
      if (!ref.current) return;
      const rect = ref.current.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      let left = e.clientX - dragOffsetRef.current.dx;
      let top = e.clientY - dragOffsetRef.current.dy;
      if (left + rect.width > vw - 8)  left = vw - rect.width - 8;
      if (top  + rect.height > vh - 8) top  = vh - rect.height - 8;
      if (left < 8) left = 8;
      if (top  < 8) top  = 8;
      setAdjusted({ left, top });
    }
    function onUp() { setDragging(false); }
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [dragging]);

  // Click outside / Esc closes. Skipped while dragging — releasing the
  // pointer outside the menu shouldn't accidentally close it.
  useEffect(() => {
    const onDocClick = (e) => {
      if (dragging) return;
      if (ref.current && !ref.current.contains(e.target)) onClose?.();
    };
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    // Defer to next tick so the click that opened us doesn't immediately close.
    const id = setTimeout(() => {
      document.addEventListener('mousedown', onDocClick);
    }, 0);
    window.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(id);
      document.removeEventListener('mousedown', onDocClick);
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose, dragging]);

  return { ref, adjusted, dragging, startDrag };
}

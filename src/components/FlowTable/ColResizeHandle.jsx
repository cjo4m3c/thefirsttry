/**
 * ColResizeHandle — 8px transparent strip on right edge of each resizable
 * th. pointerDown 開始 drag、pointerMove 即時更新欄寬、pointerUp 結束。
 *
 * 用 setPointerCapture + React 同元素 onPointerMove/Up 的 pattern
 * （跟 useDragEndpoint.js 一致）：捕獲 pointer 後、所有 pointer 事件都
 * 送到 handle div、即使 cursor 移出去也不會掉事件。draggingRef 用
 * ref 而非 state 避免 drag 中觸發本元件 re-render。
 *
 * 拆自 FlowTable.jsx（PR #237、§6 拆檔）。
 */
import { useRef } from 'react';

export function ColResizeHandle({ idx, onResize, currentWidth }) {
  const draggingRef = useRef(false);
  const startRef = useRef({ x: 0, w: 0 });

  function onPointerDown(e) {
    e.preventDefault();
    e.stopPropagation();
    try { e.currentTarget.setPointerCapture?.(e.pointerId); } catch {}
    startRef.current = { x: e.clientX, w: currentWidth };
    draggingRef.current = true;
  }
  function onPointerMove(e) {
    if (!draggingRef.current) return;
    onResize(idx, startRef.current.w + (e.clientX - startRef.current.x));
  }
  function onPointerUp(e) {
    if (!draggingRef.current) return;
    try { e.currentTarget.releasePointerCapture?.(e.pointerId); } catch {}
    draggingRef.current = false;
  }

  return (
    <div
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      title="拖曳調整欄寬"
      style={{
        position: 'absolute', top: 0, right: 0, height: '100%', width: 8,
        cursor: 'col-resize', touchAction: 'none', zIndex: 10,
      }}
      className="hover:bg-blue-400 hover:bg-opacity-50"
    />
  );
}

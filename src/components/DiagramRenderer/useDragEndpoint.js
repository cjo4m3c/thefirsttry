import { useState } from 'react';
import { screenToSvg, nearestSide, findTaskAtPoint } from './dragHelpers.js';

/**
 * Drag state machine for connection endpoint manipulation.
 *
 * Owns `dragInfo` state and exposes startDrag / moveDrag / endDrag handlers
 * that mutate it. The parent component still owns `selectedConnKey` and the
 * connection list / positions; this hook just encapsulates the pointer-event
 * choreography.
 *
 * Drop semantics on endDrag:
 *   - Target handle dropped on a different valid task → onChangeTarget
 *     (PR J change-target)
 *   - Otherwise snap to nearest side of original anchor task → onUpdateOverride
 *     (PR G manual port override)
 */
export function useDragEndpoint({ svgRef, flow, positions, connections, editable,
  onUpdateOverride, onChangeTarget, onWireThroughGateway }) {
  const [dragInfo, setDragInfo] = useState(null);

  function startDrag(evt, connKey, endpoint) {
    if (!editable) return;
    evt.preventDefault();
    evt.stopPropagation();
    const target = evt.currentTarget;
    const pointerId = evt.pointerId;
    try { target.setPointerCapture?.(pointerId); } catch {}
    const [sx, sy] = screenToSvg(svgRef.current, evt);
    // v1.18 R3: 記下起點，endDrag 用 deadband 過濾微小移動
    setDragInfo({ connKey, endpoint, pointerId, cursor: [sx, sy],
                  startCursor: [sx, sy], proposedSide: null });
  }

  function moveDrag(evt) {
    if (!dragInfo) return;
    evt.preventDefault();
    const [sx, sy] = screenToSvg(svgRef.current, evt);
    const idx = parseInt(dragInfo.connKey.slice(1), 10);
    const conn = connections[idx];
    if (!conn) return;
    const anchorId = dragInfo.endpoint === 'source' ? conn.fromId : conn.toId;
    const pos = positions[anchorId];
    if (!pos) return;
    const proposedSide = nearestSide(pos, sx, sy);
    // For target-handle drag, also detect drop-on-different-task (PR J) for
    // change-target. Highlighted in render so user sees where the new
    // connection will land. Reject self-loop (drop on source) and start
    // events (no incoming allowed). Drop on the original target task is
    // NOT a "change target" — that falls through to the port-snap branch.
    let dropTargetId = null;
    if (dragInfo.endpoint === 'target' && onChangeTarget) {
      const hitId = findTaskAtPoint(flow.tasks, positions, sx, sy);
      if (hitId && hitId !== conn.fromId && hitId !== conn.toId) {
        const hitTask = flow.tasks.find(t => t.id === hitId);
        if (hitTask && hitTask.type !== 'start') dropTargetId = hitId;
      }
    }
    setDragInfo({ ...dragInfo, cursor: [sx, sy], proposedSide, dropTargetId });
  }

  function endDrag(evt) {
    if (!dragInfo) return;
    evt.preventDefault();
    const idx = parseInt(dragInfo.connKey.slice(1), 10);
    const conn = connections[idx];
    if (!conn) { setDragInfo(null); return; }

    // v1.18 R3: deadband — 過濾微小拖曳避免 sibling pin / override 誤觸發
    // 解問題 3.1：使用者「拖了但沒動」時仍觸發 sibling 「已編輯」橘點
    // 條件：未拖到不同 task (dropTargetId 為 null) 且 cursor 移動 < MIN_DRAG_DELTA
    const MIN_DRAG_DELTA = 8;  // 1 grid cell = 8px
    if (!dragInfo.dropTargetId && dragInfo.startCursor) {
      const [sx0, sy0] = dragInfo.startCursor;
      const [sx1, sy1] = dragInfo.cursor;
      const moveDist = Math.hypot(sx1 - sx0, sy1 - sy0);
      if (moveDist < MIN_DRAG_DELTA) {
        // 微小移動 — 視為「沒拖」，不寫 override 也不 pin sibling
        setDragInfo(null);
        return;
      }
    }

    // Priority 1 — PR J: target handle dropped on a different valid task →
    // change the connection's target. Snap port = nearest side of new target
    // to the drop coordinate.
    //
    // Special case (PR-A): if drop target is a GATEWAY, also auto-add a
    // condition on it pointing back at the original target B. So dragging
    // A→B's target endpoint to gateway C produces:
    //   - A → C (the retarget)
    //   - C → B (new condition, empty label, user fills via ContextMenu)
    if (dragInfo.dropTargetId && dragInfo.endpoint === 'target') {
      const newTargetId = dragInfo.dropTargetId;
      const newPos = positions[newTargetId];
      const [sx, sy] = dragInfo.cursor;
      const snapSide = newPos ? nearestSide(newPos, sx, sy) : 'left';
      const newTargetTask = flow.tasks.find(t => t.id === newTargetId);
      if (newTargetTask?.type === 'gateway' && onWireThroughGateway) {
        onWireThroughGateway(conn.fromId, conn.overrideKey, newTargetId, conn.toId, snapSide);
      } else if (onChangeTarget) {
        onChangeTarget(conn.fromId, conn.overrideKey, newTargetId, snapSide);
      }
      // v1.16 §10.5.2 User Override Stability：pin 共用 newTargetId 的其他
      // incoming edges，避免新 edge 加入後 multi-pass 重 route 改變 sibling 端點。
      // 解使用者「拖一邊另一邊也動」(問題 1 / 5-1-4-5 case).
      pinSiblings(connections, idx, 'target', newTargetId, onUpdateOverride);
      setDragInfo(null);
      return;
    }

    // Priority 2 — PR G: snap to nearest port of the original anchor task.
    // S7 (v1.9)：pin 對側為當前 route 結果，變 full override。
    // 解使用者期待「拖一個端點只動那個端點，另一端不跟著動」— 避免重 route 時
    // 另一端因 anchor/occupancy 變化而跳變視覺。
    if (dragInfo.proposedSide && onUpdateOverride) {
      const currentSide = dragInfo.endpoint === 'source' ? conn.exitSide : conn.entrySide;
      if (dragInfo.proposedSide !== currentSide) {
        const full = dragInfo.endpoint === 'source'
          ? { exitSide: dragInfo.proposedSide, entrySide: conn.entrySide }
          : { exitSide: conn.exitSide,         entrySide: dragInfo.proposedSide };
        onUpdateOverride(conn.fromId, conn.overrideKey, full);
        // v1.16 §10.5.2：pin sibling edges sharing the affected endpoint task.
        // 拖 source side → pin 同 fromId 其他 outgoing；
        // 拖 target side → pin 同 toId 其他 incoming.
        const targetId = dragInfo.endpoint === 'source' ? conn.fromId : conn.toId;
        pinSiblings(connections, idx, dragInfo.endpoint, targetId, onUpdateOverride);
      }
    }
    setDragInfo(null);
  }

  /** v1.16 §10.5.2 User Override Stability — pin sibling edges sharing
   * the dragged endpoint's task. Avoid multi-pass re-route changing siblings
   * after a new/dragged edge introduces context changes.
   *
   * @param {string} endpoint - 'source' (pin 同 fromId 其他 outgoing) 或
   *                            'target' (pin 同 toId 其他 incoming)
   * @param {string} taskId   - 共用的 task id (fromId or toId)
   */
  function pinSiblings(conns, draggedIdx, endpoint, taskId, updateOverride) {
    if (!updateOverride || !taskId) return;
    for (let i = 0; i < conns.length; i++) {
      if (i === draggedIdx) continue;
      const o = conns[i];
      const sharesEndpoint = endpoint === 'source'
        ? o.fromId === taskId
        : o.toId === taskId;
      if (!sharesEndpoint) continue;
      if (!o.exitSide || !o.entrySide) continue;  // 沒 route 結果不 pin
      updateOverride(o.fromId, o.overrideKey, {
        exitSide: o.exitSide, entrySide: o.entrySide,
      });
    }
  }

  return { dragInfo, setDragInfo, startDrag, moveDrag, endDrag };
}

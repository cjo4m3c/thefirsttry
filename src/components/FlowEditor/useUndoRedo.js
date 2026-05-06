/**
 * Undo/redo hook for FlowEditor — wraps the snapshot stack helper from
 * `utils/undoStack.js` plus the Ctrl+Z / Ctrl+Y keyboard listener.
 *
 * The stack is debounced (push ignored if within DEBOUNCE_MS of last push)
 * so a typing burst collapses into a single undo step. Save clears both
 * stacks because save establishes a new baseline that undo shouldn't cross.
 *
 * Inputs:
 *   liveFlow        — current state (for snapshot push + restore-into)
 *   setLiveFlow     — setter to apply restored snapshot
 *   setHasChanges   — setter to mark dirty after undo/redo (the change
 *                     was already known, but undo crosses save baseline)
 *   saveModal,
 *   resetAllModal   — boolean-ish; non-null/true blocks the keyboard listener
 *                     so a modal interaction can't accidentally undo
 *
 * Returns:
 *   pushSnapshot()  — call BEFORE applying a mutation (snapshot of current)
 *   clear()         — wipe the stack (called on save)
 *   canUndo, canRedo
 *   handleUndo, handleRedo — exposed for buttons in addition to keyboard
 */
import { useEffect, useState } from 'react';
import {
  createStack as createUndoStack, push as pushUndo,
  undo as popUndo, redo as popRedo,
  canUndo as canUndoStack, canRedo as canRedoStack,
} from '../../utils/undoStack.js';

export function useUndoRedo({ liveFlow, setLiveFlow, setHasChanges, saveModal, resetAllModal }) {
  const [undoStack, setUndoStack] = useState(createUndoStack);

  function pushSnapshot() {
    setUndoStack(prev => pushUndo(prev, structuredClone(liveFlow)));
  }

  function clear() {
    setUndoStack(createUndoStack());
  }

  function handleUndo() {
    const result = popUndo(undoStack, structuredClone(liveFlow));
    if (!result) return;
    setUndoStack(result.stack);
    setLiveFlow(result.snapshot);
    setHasChanges(true);
  }

  function handleRedo() {
    const result = popRedo(undoStack, structuredClone(liveFlow));
    if (!result) return;
    setUndoStack(result.stack);
    setLiveFlow(result.snapshot);
    setHasChanges(true);
  }

  // Ctrl+Z / Cmd+Z = undo; Ctrl+Y or Ctrl+Shift+Z = redo. Skip when focused
  // in input/textarea/select (browser native text-undo) or when a modal is
  // open (modal blocks user actions).
  useEffect(() => {
    function onKey(e) {
      const tag = e.target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || e.target?.isContentEditable) return;
      if (saveModal || resetAllModal) return;
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;
      if (e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      } else if (e.key === 'y' || (e.key === 'z' && e.shiftKey)) {
        e.preventDefault();
        handleRedo();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saveModal, resetAllModal, undoStack, liveFlow]);

  return {
    pushSnapshot,
    clear,
    canUndo: canUndoStack(undoStack),
    canRedo: canRedoStack(undoStack),
    handleUndo,
    handleRedo,
  };
}

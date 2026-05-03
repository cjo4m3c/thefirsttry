/**
 * undoStack.js — pure-function undo/redo stack for FlowEditor.
 *
 * Design (2026-05-03 per user spec):
 *   - Snapshot-based (not action-diff). Each `push` stores a clone of the
 *     pre-mutation `liveFlow`; undo restores it. Simple, robust, covers all
 *     mutations regardless of which action triggered them.
 *   - Time-debounced push: rapid edits within DEBOUNCE_MS collapse into one
 *     undo step. A 5-character typing burst becomes 1 step (the "before
 *     typing" state), not 5 steps.
 *   - Save resets the stack: per user spec「存過要再編輯才能 undo」— undo
 *     should NOT cross a save checkpoint. After save, both undo + redo
 *     stacks are empty until next edit.
 *   - 50-step ring buffer: oldest state drops when stack overflows.
 *
 * Caller is expected to:
 *   - call `push(stack, snapshot)` BEFORE applying a mutation (snapshot =
 *     pre-mutation state), then apply.
 *   - call `undo(stack, current)` / `redo(stack, current)` with the CURRENT
 *     state so it can be saved on the opposite stack for the inverse op.
 *   - call `clear()` after a save.
 */

const MAX_SIZE = 50;
const DEBOUNCE_MS = 500;

export function createStack() {
  return { undo: [], redo: [], lastPushTime: 0 };
}

/**
 * Push `snapshot` to the undo stack. If called within DEBOUNCE_MS of the
 * previous push, drops it (mid-typing collapse). New push always clears
 * the redo stack — the forward branch is invalidated by a fresh edit.
 */
export function push(stack, snapshot, now = Date.now()) {
  if (now - stack.lastPushTime < DEBOUNCE_MS) {
    return stack;  // mid-typing collapse
  }
  return {
    undo: [...stack.undo, snapshot].slice(-MAX_SIZE),
    redo: [],
    lastPushTime: now,
  };
}

/**
 * Undo: pop the last snapshot from the undo stack, push current state to
 * redo stack, return both. Returns null when nothing to undo.
 */
export function undo(stack, currentSnapshot) {
  if (stack.undo.length === 0) return null;
  const items = [...stack.undo];
  const snapshot = items.pop();
  return {
    stack: {
      undo: items,
      redo: [...stack.redo, currentSnapshot].slice(-MAX_SIZE),
      lastPushTime: 0,  // undo/redo not subject to debounce
    },
    snapshot,
  };
}

/**
 * Redo: inverse of undo. Pop redo, push current to undo. Returns null when
 * nothing to redo (e.g. just performed a fresh edit which cleared redo).
 */
export function redo(stack, currentSnapshot) {
  if (stack.redo.length === 0) return null;
  const items = [...stack.redo];
  const snapshot = items.pop();
  return {
    stack: {
      undo: [...stack.undo, currentSnapshot].slice(-MAX_SIZE),
      redo: items,
      lastPushTime: 0,
    },
    snapshot,
  };
}

export const canUndo = stack => stack.undo.length > 0;
export const canRedo = stack => stack.redo.length > 0;

/**
 * Connection-edge actions: addConnection / changeConnectionTarget /
 * removeConnection / updateConnectionOverride / resetConnectionOverride /
 * resetAllOverrides.
 *
 * All of these route through the injected `updateTask` so the canonical
 * topology-shift l4Number reset (PR-D8) stays in one place — even though
 * none of these actually flip type/shapeType, the dependency injection
 * keeps the contract uniform and side-steps the temptation to inline a
 * partial reimplementation.
 */
import { generateId } from '../../../utils/storage.js';

export function makeConnectionOps({ liveFlow, patch, updateTask }) {
  // ContextMenu: append a new outgoing connection from `fromTaskId` to
  // `toTaskId`. Regular tasks just push to nextTaskIds (multi-target =
  // parallel rendering). Gateways append a new condition.
  function addConnection(fromTaskId, toTaskId) {
    const task = liveFlow.tasks.find(t => t.id === fromTaskId);
    if (!task || !toTaskId || fromTaskId === toTaskId) return;
    if (task.type === 'gateway') {
      const newCond = { id: generateId(), label: '', nextTaskId: toTaskId };
      updateTask(fromTaskId, {
        ...task,
        conditions: [...(task.conditions || []), newCond],
      });
    } else {
      const nexts = (task.nextTaskIds || []).filter(Boolean);
      updateTask(fromTaskId, { ...task, nextTaskIds: [...nexts, toTaskId] });
    }
  }

  // Merge a partial endpoint override into task.connectionOverrides. Called
  // by DiagramRenderer when the user drags a connection endpoint to a new
  // port. `partial` holds either { exitSide } (source drag) or
  // { entrySide } (target drag); any unmentioned side keeps its previous
  // override (if any) so the two sides can be set independently.
  function updateConnectionOverride(taskId, key, partial) {
    const task = liveFlow.tasks.find(t => t.id === taskId);
    if (!task || !key) return;
    const currentOverrides = task.connectionOverrides || {};
    const currentForKey = currentOverrides[key] || {};
    const newForKey = { ...currentForKey, ...partial };
    updateTask(taskId, {
      ...task,
      connectionOverrides: { ...currentOverrides, [key]: newForKey },
    });
  }

  // PR J — change a connection's TARGET task by dragging the target handle
  // onto a different task. Updates the underlying graph data (`nextTaskIds`
  // for regular tasks, `conditions[i].nextTaskId` for gateway conditions);
  // this is the source of truth for the diagram, FlowTable, Excel export
  // and drawio export, so all four views auto-sync from the same change.
  //
  // Override migration:
  //   - Regular task: override key was oldTargetId → migrate to newTargetId
  //     (preserving exitSide if any), set entrySide to the snap side
  //   - Gateway condition: key is condId (immutable across target change),
  //     so no migration — just update entrySide
  //
  // Self-loop guard: refuse to make a task connect to itself.
  function changeConnectionTarget(fromTaskId, oldKey, newTargetId, snapSide) {
    if (!fromTaskId || !newTargetId || newTargetId === fromTaskId) return;
    const task = liveFlow.tasks.find(t => t.id === fromTaskId);
    if (!task) return;
    const newTarget = liveFlow.tasks.find(t => t.id === newTargetId);
    if (!newTarget || newTarget.type === 'start') return;  // start has no incoming

    let updated;
    if (task.type === 'gateway') {
      const currentOverrides = task.connectionOverrides || {};
      const prevOv = currentOverrides[oldKey] || {};
      updated = {
        ...task,
        conditions: (task.conditions || []).map(c =>
          c.id === oldKey ? { ...c, nextTaskId: newTargetId } : c
        ),
        connectionOverrides: {
          ...currentOverrides,
          [oldKey]: { ...prevOv, entrySide: snapSide },
        },
      };
    } else {
      const newOverrides = { ...(task.connectionOverrides || {}) };
      const prevOv = newOverrides[oldKey] || {};
      delete newOverrides[oldKey];
      newOverrides[newTargetId] = { ...prevOv, entrySide: snapSide };
      updated = {
        ...task,
        nextTaskIds: (task.nextTaskIds || []).map(id => id === oldKey ? newTargetId : id),
        connectionOverrides: newOverrides,
      };
    }
    updateTask(fromTaskId, updated);
  }

  // Remove a single connection from `fromTaskId`. `key` is the connection's
  // overrideKey:
  //   - regular task / l3activity: targetTaskId — filter task.nextTaskIds.
  //   - gateway: condition.id — drop the entire condition entry (per spec
  //     2026-04-30: deleting a branch removes both target + label).
  // Always cleans `task.connectionOverrides[key]` to avoid stale overrides.
  // Validation downstream (rule 1 / 4 / new gateway-arity) flags any
  // resulting structural issues at save time; the user can always re-add.
  function removeConnection(fromTaskId, key) {
    const task = liveFlow.tasks.find(t => t.id === fromTaskId);
    if (!task) return;
    let updated;
    if (task.type === 'gateway') {
      const conds = (task.conditions || []).filter(c => c.id !== key);
      updated = { ...task, conditions: conds };
    } else {
      const nexts = (task.nextTaskIds || []).filter(id => id !== key);
      updated = { ...task, nextTaskIds: nexts };
    }
    if (updated.connectionOverrides?.[key]) {
      const newOv = { ...updated.connectionOverrides };
      delete newOv[key];
      updated = { ...updated, connectionOverrides: newOv };
    }
    updateTask(fromTaskId, updated);
  }

  // PR I — reset a single connection's override (both exit and entry side).
  // Called from DiagramRenderer's "重設此連線端點" button when a connection
  // with override is selected.
  function resetConnectionOverride(fromTaskId, key) {
    const task = liveFlow.tasks.find(t => t.id === fromTaskId);
    if (!task?.connectionOverrides?.[key]) return;
    const newOverrides = { ...task.connectionOverrides };
    delete newOverrides[key];
    updateTask(fromTaskId, { ...task, connectionOverrides: newOverrides });
  }

  // PR I — reset ALL manual endpoint overrides across every task.
  // Caller is expected to confirm via a modal first (destructive, hard to
  // undo — the only recovery is editing each connection again or reloading
  // from Excel).
  function resetAllOverrides() {
    const cleaned = liveFlow.tasks.map(t => {
      if (!t.connectionOverrides || Object.keys(t.connectionOverrides).length === 0) return t;
      return { ...t, connectionOverrides: {} };
    });
    patch({ tasks: cleaned });
  }

  return {
    addConnection, updateConnectionOverride, changeConnectionTarget,
    removeConnection, resetConnectionOverride, resetAllOverrides,
  };
}

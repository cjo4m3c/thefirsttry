/**
 * Task-CRUD actions: updateTask + add* + removeTask.
 *
 * `updateTask` is the SOT mutator — every other action ultimately ends up
 * calling it. It also handles the PR-D8 topology-shift l4Number reset
 * (when `type` or `shapeType` changes on one task, every OTHER task's
 * stored l4Number is stripped so computeDisplayLabels re-derives a
 * consistent layout). Other factories receive `updateTask` via dependency
 * injection so the topology-shift behaviour stays canonical.
 */
import { makeTask, applySequentialDefaults } from '../../../utils/taskDefs.js';

function stripStoredL4Numbers(tasks) {
  return tasks.map(t => {
    if (!t.l4Number) return t;
    const { l4Number, ...rest } = t;
    return rest;
  });
}

export function makeTaskOps({ liveFlow, patch }) {
  function updateTask(id, updated) {
    // PR-D8 (2026-05-05): when a task's `type` or `shapeType` changes, the
    // anchor topology shifts — `_g` / `_s` / `_e` suffix anchors and
    // regular-task counter ordering may become invalid for OTHER tasks in
    // the flow. Strip stored l4Number from every other task so
    // computeDisplayLabels re-derives a consistent layout. The directly-
    // updated task already strips its own l4Number via makeTypeChange /
    // applyRoleChange. Safe because labels regenerate deterministically.
    const prev = liveFlow.tasks.find(t => t.id === id);
    const topologyShift = !!prev
      && (prev.type !== updated.type || prev.shapeType !== updated.shapeType);
    patch({
      tasks: liveFlow.tasks.map(t => {
        if (t.id === id) return updated;
        if (!topologyShift || !t.l4Number) return t;
        const { l4Number, ...rest } = t;
        return rest;
      }),
    });
  }

  function addTask() {
    const newTask = makeTask();
    patch({ tasks: applySequentialDefaults([...liveFlow.tasks, newTask]) });
  }

  // Insert a new (sequence) task before the given anchor.
  //   addTaskBefore: (everyone who pointed at anchor) → NEW → anchor
  function addTaskBefore(anchorId) {
    const idx = liveFlow.tasks.findIndex(t => t.id === anchorId);
    if (idx < 0) return;
    const anchor = liveFlow.tasks[idx];
    // Inherit anchor's roleId so the new task lands in the same swimlane.
    const newTask = makeTask({ roleId: anchor.roleId || '' });
    // Rewire: every task that pointed at anchor → point at newTask
    // (covers regular task.nextTaskIds and gateway conditions[].nextTaskId).
    const rewired = liveFlow.tasks.map(t => {
      if (t.type === 'gateway') {
        const conds = (t.conditions || []).map(c =>
          c.nextTaskId === anchorId ? { ...c, nextTaskId: newTask.id } : c
        );
        return { ...t, conditions: conds };
      }
      const nexts = (t.nextTaskIds || []).map(id => id === anchorId ? newTask.id : id);
      return { ...t, nextTaskIds: nexts };
    });
    // newTask points at anchor (single sequence connection).
    newTask.nextTaskIds = [anchorId];
    const next = [...rewired];
    next.splice(idx, 0, newTask);
    // Strip stored l4Number on insertion so numbering stays sequential
    // (same rationale as the drag-reorder fix from the earlier PR).
    patch({ tasks: applySequentialDefaults(stripStoredL4Numbers(next)) });
  }

  // Insert a new (sequence) task after the given anchor.
  //   addTaskAfter:  anchor → NEW → (anchor's old nextTaskIds)
  // Gateway anchors skip auto-reconnect (multiple outgoing paths — can't
  // safely pick one); user gets an alert to wire it manually.
  function addTaskAfter(anchorId) {
    const idx = liveFlow.tasks.findIndex(t => t.id === anchorId);
    if (idx < 0) return;
    const anchor = liveFlow.tasks[idx];
    // Inherit anchor's roleId so the new task lands in the same swimlane.
    const newTask = makeTask({ roleId: anchor.roleId || '' });

    let rewired;
    if (anchor.type === 'gateway') {
      // Gateway has multiple outgoing conditions — can't pick one safely.
      // Insert without auto-reconnect; user wires it manually in the drawer.
      rewired = liveFlow.tasks;
      // Surface the limitation as a save-time blocking-style warning via
      // a quick alert. Rare action, lightweight feedback is fine.
      alert('閘道後方新增的任務需要手動到編輯面板（右側「編輯」）連接到對應分支。已為您插入新任務。');
    } else {
      // Regular task / start / interaction / l3activity — move anchor's
      // outgoing to newTask, anchor → newTask sole sequence connection.
      newTask.nextTaskIds = (anchor.nextTaskIds || []).filter(Boolean);
      rewired = liveFlow.tasks.map(t =>
        t.id === anchorId ? { ...t, nextTaskIds: [newTask.id] } : t
      );
    }

    const next = [...rewired];
    next.splice(idx + 1, 0, newTask);
    patch({ tasks: applySequentialDefaults(stripStoredL4Numbers(next)) });
  }

  function removeTask(id) {
    if (liveFlow.tasks.length <= 1) return;
    const removed = liveFlow.tasks.find(t => t.id === id);
    if (!removed) return;

    // Determine the "passthrough" downstream the upstream sources should
    // reconnect to. If the removed task was a gateway, take its first valid
    // condition target; otherwise its first nextTaskId. Falls back to null
    // (sources end up with empty downstream — flagged later by validation).
    const passthroughId = removed.type === 'gateway'
      ? ((removed.conditions || []).find(c => c.nextTaskId)?.nextTaskId || null)
      : ((removed.nextTaskIds || []).find(Boolean) || null);

    const cleaned = liveFlow.tasks.filter(t => t.id !== id).map(t => {
      let next = t;

      // 1. Strip stale connectionOverrides keyed by removed id (PR H).
      //    Gateway overrides are keyed by condId so they're unaffected;
      //    only regular tasks need this cleanup.
      if (t.type !== 'gateway' && t.connectionOverrides?.[id]) {
        const newOv = { ...t.connectionOverrides };
        delete newOv[id];
        next = { ...next, connectionOverrides: newOv };
      }

      // 2. Rewire wiring 2026-04-29: if upstream task points at the removed
      //    task, redirect to the passthrough so A→B→C becomes A→C when B
      //    is deleted.
      if (t.type === 'gateway') {
        const conds = (t.conditions || []).map(c =>
          c.nextTaskId === id ? { ...c, nextTaskId: passthroughId || '' } : c
        );
        next = { ...next, conditions: conds };
      } else {
        const oldNexts = next.nextTaskIds || [];
        if (oldNexts.includes(id)) {
          // Replace the removed id with the passthrough; if the passthrough
          // is null, drop the entry entirely (no orphan reference left).
          const replaced = oldNexts.flatMap(n => {
            if (n !== id) return [n];
            return passthroughId ? [passthroughId] : [];
          });
          // De-dup in case the passthrough was already a peer target.
          const deduped = replaced.filter((n, i, arr) => arr.indexOf(n) === i);
          next = { ...next, nextTaskIds: deduped };
        }
      }

      return next;
    });

    // Strip stored l4Number after a removal so computeDisplayLabels
    // re-sequences from 1 (avoids gaps like "1, 2, 4, 5" after deleting 3).
    // Mirrors what addTaskAfter / addTaskBefore do on insertion.
    patch({ tasks: stripStoredL4Numbers(cleaned) });
  }

  return { updateTask, addTask, addTaskBefore, addTaskAfter, removeTask };
}

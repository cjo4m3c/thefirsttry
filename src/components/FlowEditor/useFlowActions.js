import { makeTask, applySequentialDefaults, applyGatewayPrefix } from '../../utils/taskDefs.js';
import { generateId } from '../../utils/storage.js';

/**
 * Action handlers for FlowEditor — all graph-mutation logic in one place.
 * Each function captures `liveFlow` + `patch` via closure and calls patch()
 * with the next state. Behavior preserved verbatim from the inline versions
 * that lived in FlowEditor.jsx.
 */
export function useFlowActions({ liveFlow, patch }) {
  function updateTask(id, updated) {
    patch({ tasks: liveFlow.tasks.map(t => t.id === id ? updated : t) });
  }

  function addTask() {
    const newTask = makeTask();
    patch({ tasks: applySequentialDefaults([...liveFlow.tasks, newTask]) });
  }

  // Insert a new (sequence) task before / after the given anchor task,
  // and rewire connections so the new task is NOT orphaned:
  //   addTaskAfter:  anchor → NEW → (anchor's old nextTaskIds)
  //   addTaskBefore: (everyone who pointed at anchor) → NEW → anchor
  // Gateway anchors skip auto-reconnect for `addTaskAfter` (multiple outgoing
  // paths — can't safely pick one); user gets a warning to wire it manually.
  function addTaskBefore(anchorId) {
    const idx = liveFlow.tasks.findIndex(t => t.id === anchorId);
    if (idx < 0) return;
    const newTask = makeTask();
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
    const renumbered = next.map(t => {
      if (!t.l4Number) return t;
      const { l4Number, ...rest } = t;
      return rest;
    });
    patch({ tasks: applySequentialDefaults(renumbered) });
  }

  function addTaskAfter(anchorId) {
    const idx = liveFlow.tasks.findIndex(t => t.id === anchorId);
    if (idx < 0) return;
    const anchor = liveFlow.tasks[idx];
    const newTask = makeTask();

    let rewired;
    if (anchor.type === 'gateway') {
      // Gateway has multiple outgoing conditions — can't pick one safely.
      // Insert without auto-reconnect; user wires it manually in the drawer.
      rewired = liveFlow.tasks;
      // Surface the limitation as a save-time blocking-style warning via
      // a quick alert. Rare action, lightweight feedback is fine.
      alert('闘道後方新增的任務需要手動到編輯面板（右側 ✏️ 編輯）連接到對應分支。已為您插入新任務。');
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
    const renumbered = next.map(t => {
      if (!t.l4Number) return t;
      const { l4Number, ...rest } = t;
      return rest;
    });
    patch({ tasks: applySequentialDefaults(renumbered) });
  }

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

  // ContextMenu: insert a gateway after `anchorId` with two outgoing
  // conditions to `targetId1` / `targetId2`. anchor → newGateway →
  // [target1, target2]. anchor's old nextTaskIds are overwritten — if the
  // user wanted to preserve them, they should pick them as one of the
  // targets via the menu's dropdowns.
  // ContextMenu: insert an L3 activity (subprocess call) after `anchorId`.
  // anchor → newL3 → (anchor's old nextTaskIds[0]).
  // L3 activity uses connectionType='subprocess', shapeType='l3activity',
  // and stores the called L3 number in `subprocessName`. Name = activity name.
  function addL3ActivityAfter(anchorId, l3Number = '', l3Name = '') {
    const idx = liveFlow.tasks.findIndex(t => t.id === anchorId);
    if (idx < 0) return;
    const anchor = liveFlow.tasks[idx];
    const downstream = (anchor.nextTaskIds || []).filter(Boolean);
    const newL3 = makeTask({
      type: 'l3activity',
      shapeType: 'l3activity',
      connectionType: 'subprocess',
      roleId: anchor.roleId || '',
      name: l3Name || '',
      subprocessName: l3Number || '',
      // L3 activity inherits the anchor's downstream so the sequence stays
      // intact: anchor → L3 → (anchor's old next). User can adjust later.
      nextTaskIds: downstream.length ? [downstream[0]] : [''],
    });
    const rewired = liveFlow.tasks.map(t =>
      t.id === anchorId ? { ...t, nextTaskIds: [newL3.id] } : t
    );
    const next = [...rewired];
    next.splice(idx + 1, 0, newL3);
    const renumbered = next.map(t => {
      if (!t.l4Number) return t;
      const { l4Number, ...rest } = t;
      return rest;
    });
    patch({ tasks: applySequentialDefaults(renumbered) });
  }

  function insertGatewayAfter(anchorId, gatewayType, targetId1, targetId2, label1 = '', label2 = '') {
    const idx = liveFlow.tasks.findIndex(t => t.id === anchorId);
    if (idx < 0) return;
    const anchor = liveFlow.tasks[idx];
    const ctMap = {
      xor: 'conditional-branch',
      and: 'parallel-branch',
      or:  'inclusive-branch',
    };
    const newGateway = makeTask({
      type: 'gateway',
      gatewayType,
      connectionType: ctMap[gatewayType] || 'conditional-branch',
      roleId: anchor.roleId || '',
      // Pre-fill name with "[XX闘道] " prefix so the FlowTable / Excel rows
      // are immediately readable. User extends after the space.
      name: applyGatewayPrefix('', gatewayType),
      conditions: [
        { id: generateId(), label: label1 || '', nextTaskId: targetId1 || '' },
        { id: generateId(), label: label2 || '', nextTaskId: targetId2 || '' },
      ],
      nextTaskIds: [],
    });
    // anchor's outgoing now points solely at the new gateway (overwrite).
    const rewired = liveFlow.tasks.map(t =>
      t.id === anchorId ? { ...t, nextTaskIds: [newGateway.id] } : t
    );
    const next = [...rewired];
    next.splice(idx + 1, 0, newGateway);
    const renumbered = next.map(t => {
      if (!t.l4Number) return t;
      const { l4Number, ...rest } = t;
      return rest;
    });
    patch({ tasks: applySequentialDefaults(renumbered) });
  }

  function removeTask(id) {
    if (liveFlow.tasks.length <= 1) return;
    // PR H: drop the task, AND clear any other task's connectionOverrides
    // key that points at the removed task. Gateway overrides are keyed by
    // condId (not targetId) so they're unaffected by this deletion — only
    // regular tasks need the cleanup.
    const cleaned = liveFlow.tasks.filter(t => t.id !== id).map(t => {
      if (t.type === 'gateway' || !t.connectionOverrides?.[id]) return t;
      const newOv = { ...t.connectionOverrides };
      delete newOv[id];
      return { ...t, connectionOverrides: newOv };
    });
    patch({ tasks: cleaned });
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
    updateTask,
    addTask,
    addTaskBefore,
    addTaskAfter,
    addConnection,
    addL3ActivityAfter,
    insertGatewayAfter,
    removeTask,
    updateConnectionOverride,
    changeConnectionTarget,
    resetConnectionOverride,
    resetAllOverrides,
  };
}

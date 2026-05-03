import { makeTask, applySequentialDefaults } from '../../../utils/taskDefs.js';
import { makeTypeChange } from '../../../utils/elementTypes.js';
import { generateId } from '../../../utils/storage.js';

/**
 * Type-converter / "add other" / "wire-through-gateway" actions extracted
 * from useFlowActions.js so the parent file stays under the 20KB hard limit.
 *
 * Factory pattern: each call captures `liveFlow` + `patch` via closure,
 * matching the inline functions in useFlowActions's main file.
 */
export function makeConverterActions({ liveFlow, patch }) {
  // Insert "其他" element types (start / end / breakpoint / interaction) after
  // anchor. Insertion + rewiring depends on the kind:
  //   - start: NEW (PR-A 2026-04-30) — appended without rewiring anchor.
  //     Start nodes must have no incoming per BPMN; the previous behavior
  //     made anchor → newStart which violated that invariant + bypassed the
  //     "1 start only" warning. User wires the new start manually.
  //   - end / breakpoint: anchor → new (no outgoing); anchor's downstream
  //     is dropped.
  //   - interaction: anchor → new → old downstream. shape derived from the
  //     anchor's lane role.type — external lane gets shapeType='interaction',
  //     internal lane silently downgrades to shapeType='task' so the lane
  //     auto-sync invariant (PR #119) holds. Moving the task to an external
  //     lane later promotes it to interaction via syncTasksToRoles.
  // `name` is optional; when provided it's set on the new task so the editor's
  // InsertPicker can ship "name + type" together in a single create.
  function addOtherAfter(anchorId, kind, name = '') {
    const idx = liveFlow.tasks.findIndex(t => t.id === anchorId);
    if (idx < 0) return;
    const anchor = liveFlow.tasks[idx];
    const downstream = (anchor.nextTaskIds || []).filter(Boolean);
    let overrides;
    if (kind === 'start') {
      // No anchor rewire — new start is orphan until user wires it.
      overrides = {
        type: 'start', shapeType: 'task', connectionType: 'start',
        roleId: anchor.roleId || '',
        nextTaskIds: [''],
      };
    } else if (kind === 'end') {
      overrides = {
        type: 'end', shapeType: 'task', connectionType: 'end',
        roleId: anchor.roleId || '', nextTaskIds: [],
      };
    } else if (kind === 'breakpoint') {
      overrides = {
        type: 'end', shapeType: 'task', connectionType: 'breakpoint',
        roleId: anchor.roleId || '', nextTaskIds: [],
      };
    } else if (kind === 'interaction') {
      // 2026-04-30 後段：使用者明確選 interaction 一律給 interaction shape，
      // 不再依 anchor lane 降級。internal 泳道允許但儲存時 validation 3e
      // 跳 warning 讓使用者檢查（per spec 「內部角色也允許使用外部關係人
      // 互動元件，只是要跳提醒」）。
      overrides = {
        type: 'task',
        shapeType: 'interaction',
        connectionType: 'sequence',
        roleId: anchor.roleId || '',
        nextTaskIds: downstream.length ? [downstream[0]] : [''],
      };
    } else {
      return;
    }
    const newTask = makeTask({ ...overrides, name: name || '' });
    // Skip rewire for start (it must have no incoming). All other kinds
    // continue to wire anchor → newTask.
    const rewireAnchor = kind !== 'start';
    const rewired = rewireAnchor
      ? liveFlow.tasks.map(t =>
          t.id === anchorId ? { ...t, nextTaskIds: [newTask.id] } : t
        )
      : liveFlow.tasks;
    const next = [...rewired];
    next.splice(idx + 1, 0, newTask);
    const renumbered = next.map(t => {
      if (!t.l4Number) return t;
      const { l4Number, ...rest } = t;
      return rest;
    });
    patch({ tasks: applySequentialDefaults(renumbered) });
  }

  // Convert an existing task's type / connectionType in place. Preserves
  // identity (id, name, role, description) and best-effort preserves
  // connections — gateway↔non-gateway conversions can't perfectly map
  // (conditions vs nextTaskIds), so we collapse to the first available
  // target and the user re-wires extras manually.
  // Pure transform lives in `utils/elementTypes.js` so TaskCard Row 2 can
  // reuse it inline (without going through this action wrapper).
  function convertTaskType(taskId, kind) {
    const task = liveFlow.tasks.find(t => t.id === taskId);
    if (!task) return;
    const updated = makeTypeChange(task, kind);
    if (updated === task) return;  // unknown kind, no-op
    patch({ tasks: liveFlow.tasks.map(t => t.id === taskId ? updated : t) });
  }

  // Drop a connection target onto a gateway. Effect:
  //   - Re-target the connection (A→B becomes A→gateway)
  //   - Add a new condition on the gateway pointing at the original target B,
  //     with empty label (user fills it via ContextMenu)
  function wireConnectionThroughGateway(fromTaskId, oldKey, gatewayId, originalTargetId, snapSide) {
    const gw = liveFlow.tasks.find(t => t.id === gatewayId);
    if (!gw || gw.type !== 'gateway') return;
    if (originalTargetId === gatewayId) return;
    const fromTask = liveFlow.tasks.find(t => t.id === fromTaskId);
    if (!fromTask) return;
    let updatedFrom;
    if (fromTask.type === 'gateway') {
      const currentOv = fromTask.connectionOverrides || {};
      const prevOv = currentOv[oldKey] || {};
      updatedFrom = {
        ...fromTask,
        conditions: (fromTask.conditions || []).map(c =>
          c.id === oldKey ? { ...c, nextTaskId: gatewayId } : c
        ),
        connectionOverrides: { ...currentOv, [oldKey]: { ...prevOv, entrySide: snapSide } },
      };
    } else {
      const newOv = { ...(fromTask.connectionOverrides || {}) };
      const prevOv = newOv[oldKey] || {};
      delete newOv[oldKey];
      newOv[gatewayId] = { ...prevOv, entrySide: snapSide };
      updatedFrom = {
        ...fromTask,
        nextTaskIds: (fromTask.nextTaskIds || []).map(id => id === oldKey ? gatewayId : id),
        connectionOverrides: newOv,
      };
    }
    const updatedGw = {
      ...gw,
      conditions: [
        ...(gw.conditions || []),
        { id: generateId(), label: '', nextTaskId: originalTargetId },
      ],
    };
    patch({
      tasks: liveFlow.tasks.map(t => {
        if (t.id === fromTaskId) return updatedFrom;
        if (t.id === gatewayId) return updatedGw;
        return t;
      }),
    });
  }

  // Insert "其他" element types *before* anchor — mirror of addOtherAfter
  // for the top insert slot (PR-C 2026-04-30; previous shortcut routed
  // index<=0 through addOtherAfter and produced the wrong visual order).
  // Rewiring per kind:
  //   - start: orphan (no rewire); user wires manually. Mirrors PR-A.
  //   - end / breakpoint: orphan no-rewire (semantically odd to put end
  //     before anything; we just splice without wiring).
  //   - interaction: (everyone pointing at anchor) → new → anchor.
  //     Shape derived from anchor lane role.type, same as addOtherAfter.
  function addOtherBefore(anchorId, kind, name = '') {
    const idx = liveFlow.tasks.findIndex(t => t.id === anchorId);
    if (idx < 0) return;
    const anchor = liveFlow.tasks[idx];
    let overrides;
    let rewire = false;
    if (kind === 'start') {
      overrides = {
        type: 'start', shapeType: 'task', connectionType: 'start',
        roleId: anchor.roleId || '',
        nextTaskIds: [anchorId],
      };
    } else if (kind === 'end') {
      overrides = {
        type: 'end', shapeType: 'task', connectionType: 'end',
        roleId: anchor.roleId || '', nextTaskIds: [],
      };
    } else if (kind === 'breakpoint') {
      overrides = {
        type: 'end', shapeType: 'task', connectionType: 'breakpoint',
        roleId: anchor.roleId || '', nextTaskIds: [],
      };
    } else if (kind === 'interaction') {
      // 同 addOtherAfter：使用者選 interaction 一律給 interaction shape；
      // internal 泳道由 validation 3e 跳 warning。
      overrides = {
        type: 'task',
        shapeType: 'interaction',
        connectionType: 'sequence',
        roleId: anchor.roleId || '',
        nextTaskIds: [anchorId],
      };
      rewire = true;
    } else {
      return;
    }
    const newTask = makeTask({ ...overrides, name: name || '' });
    let tasks = liveFlow.tasks;
    if (rewire) {
      // Redirect every task that pointed at anchor to point at newTask
      // (covers regular task.nextTaskIds and gateway conditions[].nextTaskId).
      tasks = tasks.map(t => {
        if (t.type === 'gateway') {
          const conds = (t.conditions || []).map(c =>
            c.nextTaskId === anchorId ? { ...c, nextTaskId: newTask.id } : c
          );
          return { ...t, conditions: conds };
        }
        const nexts = (t.nextTaskIds || []).map(id => id === anchorId ? newTask.id : id);
        return { ...t, nextTaskIds: nexts };
      });
    }
    const next = [...tasks];
    next.splice(idx, 0, newTask);
    const renumbered = next.map(t => {
      if (!t.l4Number) return t;
      const { l4Number, ...rest } = t;
      return rest;
    });
    patch({ tasks: applySequentialDefaults(renumbered) });
  }

  return { addOtherBefore, addOtherAfter, convertTaskType, wireConnectionThroughGateway };
}

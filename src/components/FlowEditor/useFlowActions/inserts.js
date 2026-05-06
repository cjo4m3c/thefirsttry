/**
 * "Insert special element" actions: addL3Activity{Before,After} +
 * insertGateway{Before,After}. Both call `rewireIncomingTo` (a local
 * helper) on the *Before path so all incoming edges redirect to the
 * newly-inserted element, and use applySequentialDefaults afterwards
 * to renumber.
 */
import { makeTask, applySequentialDefaults, applyGatewayPrefix } from '../../../utils/taskDefs.js';
import { generateId } from '../../../utils/storage.js';

const CT_MAP = {
  xor: 'conditional-branch',
  and: 'parallel-branch',
  or:  'inclusive-branch',
};

// Rewire helper used by *Before insertion paths: every task that pointed
// at `oldId` (regular task.nextTaskIds AND gateway condition.nextTaskId)
// is redirected to `newId`. Pure — returns a new tasks array.
function rewireIncomingTo(tasks, oldId, newId) {
  return tasks.map(t => {
    if (t.type === 'gateway') {
      const conds = (t.conditions || []).map(c =>
        c.nextTaskId === oldId ? { ...c, nextTaskId: newId } : c
      );
      return { ...t, conditions: conds };
    }
    const nexts = (t.nextTaskIds || []).map(id => id === oldId ? newId : id);
    return { ...t, nextTaskIds: nexts };
  });
}

function stripStoredL4Numbers(tasks) {
  return tasks.map(t => {
    if (!t.l4Number) return t;
    const { l4Number, ...rest } = t;
    return rest;
  });
}

function buildGatewayConditions(rest) {
  // Accepts an array of {label, targetId} so callers can prefill 2..N branches.
  // Backwards-compat: callers passing the legacy positional form
  // (anchorId, type, target1, target2, label1, label2) still work via the
  // 2-element fallback below.
  if (rest.length === 1 && Array.isArray(rest[0])) {
    return rest[0].map(c => ({
      id: generateId(),
      label: c.label || '',
      nextTaskId: c.targetId || '',
    }));
  }
  const [targetId1, targetId2, label1 = '', label2 = ''] = rest;
  return [
    { id: generateId(), label: label1 || '', nextTaskId: targetId1 || '' },
    { id: generateId(), label: label2 || '', nextTaskId: targetId2 || '' },
  ];
}

export function makeInserts({ liveFlow, patch }) {
  // L3 activity inserted *before* anchor:
  //   (everyone who pointed at anchor) → newL3 → anchor
  function addL3ActivityBefore(anchorId, l3Number = '', l3Name = '') {
    const idx = liveFlow.tasks.findIndex(t => t.id === anchorId);
    if (idx < 0) return;
    const anchor = liveFlow.tasks[idx];
    const newL3 = makeTask({
      type: 'l3activity',
      shapeType: 'l3activity',
      connectionType: 'subprocess',
      roleId: anchor.roleId || '',
      name: l3Name || '',
      subprocessName: l3Number || '',
      nextTaskIds: [anchorId],
    });
    const rewired = rewireIncomingTo(liveFlow.tasks, anchorId, newL3.id);
    const next = [...rewired];
    next.splice(idx, 0, newL3);
    patch({ tasks: applySequentialDefaults(stripStoredL4Numbers(next)) });
  }

  // L3 activity inserted *after* anchor:
  //   anchor → newL3 → (anchor's old nextTaskIds[0]).
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
    patch({ tasks: applySequentialDefaults(stripStoredL4Numbers(next)) });
  }

  // Gateway inserted *before* anchor:
  //   (everyone who pointed at anchor) → gateway → branches as user picked.
  // Doesn't auto-include anchor in branches — user supplies them explicitly.
  function insertGatewayBefore(anchorId, gatewayType, ...rest) {
    const idx = liveFlow.tasks.findIndex(t => t.id === anchorId);
    if (idx < 0) return;
    const anchor = liveFlow.tasks[idx];
    const newGateway = makeTask({
      type: 'gateway',
      gatewayType,
      connectionType: CT_MAP[gatewayType] || 'conditional-branch',
      roleId: anchor.roleId || '',
      name: applyGatewayPrefix('', gatewayType),
      conditions: buildGatewayConditions(rest),
      nextTaskIds: [],
    });
    const rewired = rewireIncomingTo(liveFlow.tasks, anchorId, newGateway.id);
    const next = [...rewired];
    next.splice(idx, 0, newGateway);
    patch({ tasks: applySequentialDefaults(stripStoredL4Numbers(next)) });
  }

  // Gateway inserted *after* anchor: anchor → newGateway → (user-chosen branches).
  // anchor's old nextTaskIds are overwritten — if the user wanted to preserve
  // them, they should pick them as one of the targets via the menu's dropdowns.
  function insertGatewayAfter(anchorId, gatewayType, ...rest) {
    const idx = liveFlow.tasks.findIndex(t => t.id === anchorId);
    if (idx < 0) return;
    const anchor = liveFlow.tasks[idx];
    const newGateway = makeTask({
      type: 'gateway',
      gatewayType,
      connectionType: CT_MAP[gatewayType] || 'conditional-branch',
      roleId: anchor.roleId || '',
      // Pre-fill name with "[XX闘道] " prefix so the FlowTable / Excel rows
      // are immediately readable. User extends after the space.
      name: applyGatewayPrefix('', gatewayType),
      conditions: buildGatewayConditions(rest),
      nextTaskIds: [],
    });
    // anchor's outgoing now points solely at the new gateway (overwrite).
    const rewired = liveFlow.tasks.map(t =>
      t.id === anchorId ? { ...t, nextTaskIds: [newGateway.id] } : t
    );
    const next = [...rewired];
    next.splice(idx + 1, 0, newGateway);
    patch({ tasks: applySequentialDefaults(stripStoredL4Numbers(next)) });
  }

  return { addL3ActivityBefore, addL3ActivityAfter, insertGatewayBefore, insertGatewayAfter };
}

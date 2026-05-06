/**
 * Click-to-insert handler factory for DrawerContent's flow tab. Each
 * handler resolves the click index into a "before tasks[0]" / "after
 * tasks[N-1]" / "append at end" branch, then calls the matching
 * useFlowActions function.
 *
 * Index semantics (consistent across all 4):
 *   index 0           → insert before tasks[0]
 *   index 1..len-1    → insert after tasks[index - 1]
 *   index >= len      → append at end (after last task)
 *
 * Empty `liveFlow.tasks` short-circuits all four (except onAddTaskAt
 * which still calls the unanchored `addTask`).
 */
export function makeDrawerInsertHandlers({ liveFlow, actions }) {
  function onAddTaskAt(index) {
    // Click-to-insert plain L4 task at exact slot.
    //   index 0           → before first task   = addTaskBefore(tasks[0])
    //   index N (1..len)  → after tasks[N-1]    = addTaskAfter(tasks[N-1])
    //   index >= len      → append at end       = addTask
    const tasks = liveFlow.tasks || [];
    if (index <= 0 && tasks[0]) actions.addTaskBefore(tasks[0].id);
    else if (index >= tasks.length) actions.addTask();
    else actions.addTaskAfter(tasks[index - 1].id);
  }

  function onAddOtherAt(index, kind, name) {
    // start / end / interaction at exact slot:
    //   index 0          → before tasks[0]   = addOtherBefore
    //   index N (1..len) → after tasks[N-1]  = addOtherAfter
    //   index >= len     → after last task   = addOtherAfter
    const tasks = liveFlow.tasks || [];
    if (!tasks[0]) return;
    if (index <= 0) {
      actions.addOtherBefore(tasks[0].id, kind, name || '');
    } else {
      const anchorIdx = index >= tasks.length ? tasks.length - 1 : index - 1;
      actions.addOtherAfter(tasks[anchorIdx].id, kind, name || '');
    }
  }

  function onAddL3At(index, l3Number, l3Name) {
    const tasks = liveFlow.tasks || [];
    if (!tasks[0]) return;
    if (index <= 0) {
      actions.addL3ActivityBefore(tasks[0].id, l3Number, l3Name);
    } else {
      const anchorIdx = index >= tasks.length ? tasks.length - 1 : index - 1;
      actions.addL3ActivityAfter(tasks[anchorIdx].id, l3Number, l3Name);
    }
  }

  function onAddGatewayAt(index, gatewayType, branches) {
    const tasks = liveFlow.tasks || [];
    if (!tasks[0]) return;
    if (index <= 0) {
      actions.insertGatewayBefore(tasks[0].id, gatewayType, branches);
    } else {
      const anchorIdx = index >= tasks.length ? tasks.length - 1 : index - 1;
      actions.insertGatewayAfter(tasks[anchorIdx].id, gatewayType, branches);
    }
  }

  return { onAddTaskAt, onAddOtherAt, onAddL3At, onAddGatewayAt };
}

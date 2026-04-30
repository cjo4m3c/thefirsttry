/**
 * elementTypes.js — Single source of truth for the unified "元件類型" catalog.
 * Mirrors InsertPicker (DrawerContent.jsx) and ConvertSubForm (subforms.jsx)
 * so the editor's TaskCard Row 2, the diagram's "新增" / "轉換為..." menus,
 * and the drawer's insert picker all show the same 8 options in the same
 * order.
 *
 * Naming convention (audited 2026-04-30):
 *   xor → 排他閘道 (NOT「條件閘道」/「條件」). 條件 is reserved for the *connection
 *   text* (條件分支至 X) — not the gateway type. AND → 並行閘道, OR → 包容閘道.
 */
import { generateId } from './storage.js';
import { applyGatewayPrefix } from './taskDefs.js';

// User-pickable element types in canonical order (matches InsertPicker).
// Breakpoint is intentionally excluded — phased out 2026-04-29; legacy data
// still renders but no UI creates new ones. detectElementKind handles the
// legacy breakpoint round-trip.
export const ELEMENT_TYPES = [
  { value: 'task',         label: 'L4 任務' },
  { value: 'gateway-xor',  label: '排他閘道（XOR）' },
  { value: 'gateway-and',  label: '並行閘道（AND）' },
  { value: 'gateway-or',   label: '包容閘道（OR）' },
  { value: 'start',        label: '開始事件' },
  { value: 'end',          label: '結束事件' },
  { value: 'l3activity',   label: 'L3 流程（子流程調用）' },
  { value: 'interaction',  label: '外部互動' },
];

/**
 * Inverse of makeTypeChange — given an existing task, return its element-type
 * kind (one of the ELEMENT_TYPES values, plus 'breakpoint' for legacy data).
 * Used as the current value of the 元件類型 dropdown.
 */
export function detectElementKind(task) {
  if (task.type === 'start') return 'start';
  if (task.type === 'end') {
    return task.connectionType === 'breakpoint' ? 'breakpoint' : 'end';
  }
  if (task.type === 'l3activity') return 'l3activity';
  if (task.shapeType === 'interaction') return 'interaction';
  if (task.type === 'gateway') return `gateway-${task.gatewayType || 'xor'}`;
  return 'task';
}

/**
 * Pure transform: task + kind → converted task. Same logic as
 * useFlowActions.convertTaskType but without touching the flow store, so it
 * can be called inline from TaskCard's onUpdate. The action wrapper simply
 * does `patch({ tasks: tasks.map(t => t.id===id ? makeTypeChange(t, kind) : t) })`.
 *
 * Connection rewiring is best-effort — gateway↔non-gateway transitions can't
 * perfectly map (conditions vs nextTaskIds), so we collapse to the first
 * available target and the user re-wires extras manually.
 *
 * Side effects on the returned object:
 *   - Strips l4Number (auto re-derived by computeDisplayLabels)
 *   - Clears connectionOverrides (key semantics flip between gateway/non-gateway)
 *   - Adds/removes "[XX閘道] " name prefix based on direction
 */
export function makeTypeChange(task, kind) {
  const existingTarget =
    task.type === 'gateway'
      ? (task.conditions || []).map(c => c.nextTaskId).filter(Boolean)[0] || ''
      : (task.nextTaskIds || []).filter(Boolean)[0] || '';
  let overrides;
  if (kind === 'task') {
    overrides = { type: 'task', shapeType: 'task', connectionType: 'sequence',
      nextTaskIds: existingTarget ? [existingTarget] : [''], conditions: [] };
  } else if (kind === 'l3activity') {
    overrides = { type: 'l3activity', shapeType: 'l3activity', connectionType: 'subprocess',
      nextTaskIds: existingTarget ? [existingTarget] : [''], conditions: [] };
  } else if (kind === 'interaction') {
    overrides = { type: 'task', shapeType: 'interaction', connectionType: 'sequence',
      nextTaskIds: existingTarget ? [existingTarget] : [''], conditions: [] };
  } else if (kind === 'start') {
    overrides = { type: 'start', shapeType: 'task', connectionType: 'start',
      nextTaskIds: existingTarget ? [existingTarget] : [''], conditions: [] };
  } else if (kind === 'end') {
    overrides = { type: 'end', shapeType: 'task', connectionType: 'end',
      nextTaskIds: [], conditions: [] };
  } else if (kind === 'breakpoint') {
    overrides = { type: 'end', shapeType: 'task', connectionType: 'breakpoint',
      nextTaskIds: [], conditions: [] };
  } else if (kind === 'gateway-xor' || kind === 'gateway-and' || kind === 'gateway-or') {
    const gType = kind.slice(8);
    const ctMap = { xor: 'conditional-branch', and: 'parallel-branch', or: 'inclusive-branch' };
    const existingConds = task.type === 'gateway' ? (task.conditions || []) : [];
    const conditions = existingConds.length
      ? existingConds
      : [{ id: generateId(), label: '', nextTaskId: existingTarget || '' }];
    overrides = {
      type: 'gateway', shapeType: 'task', gatewayType: gType,
      connectionType: ctMap[gType],
      name: applyGatewayPrefix(task.name, gType),
      nextTaskIds: [], conditions,
    };
  } else {
    return task;
  }
  const cleanedName = task.type === 'gateway' && !kind.startsWith('gateway-')
    ? applyGatewayPrefix(task.name, null)
    : (overrides.name ?? task.name);
  return {
    ...task, ...overrides, name: cleanedName,
    l4Number: undefined,
    connectionOverrides: {},
  };
}

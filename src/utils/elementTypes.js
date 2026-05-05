/**
 * elementTypes.js — Single source of truth for the unified "元件類型" catalog.
 *
 * Three view-layer consumers all read from this file (PR-B 2026-04-30):
 *   - TaskCard Row 2 元件類型 select (FlowEditor/TaskCard.jsx)
 *   - InsertPicker 新增類型 select + helper text (FlowEditor/DrawerContent.jsx)
 *   - ContextMenu OtherSubForm + ConvertSubForm (ContextMenu/subforms.jsx)
 *
 * Adding a new element type = add one entry here; adjust makeTypeChange +
 * detectElementKind if it has model-side semantics. No view-layer edits
 * needed for label / icon / helper text.
 *
 * Naming convention (audited 2026-04-30):
 *   xor → 排他閘道 (NOT「條件閘道」/「條件」). 條件 is reserved for the *connection
 *   text* (條件分支至 X) — not the gateway type. AND → 並行閘道, OR → 包容閘道.
 */
import { generateId } from './storage.js';
import { applyGatewayPrefix } from './taskDefs.js';

// Per-entry metadata fields:
//   value         — kind id; matches detectElementKind / makeTypeChange
//   label         — long-form label for InsertPicker / TaskCard / Convert ("L4 任務")
//   shortLabel    — compact label with icon for ContextMenu OtherSubForm
//                   ("○ 開始事件") and ConvertSubForm short list. Falls back
//                   to label when not specified.
//   helperText    — one-liner shown next to the InsertPicker select / under
//                   each OtherSubForm button as a hint
//   inOther       — true: shown in ContextMenu OtherSubForm "新增其他" button
//                   row (start/end/interaction). Other values omitted.
//   inConvert     — true: shown in ConvertSubForm "轉換為..." list. Defaults
//                   to true; set false to hide a kind from convert flow.
//
// Breakpoint is intentionally excluded — phased out 2026-04-29; legacy data
// still renders but no UI creates new ones. detectElementKind handles the
// legacy breakpoint round-trip.
export const ELEMENT_TYPES = [
  { value: 'task',         label: 'L4 任務',
    helperText: '一般 L4 任務（自動接續上下任務）' },
  { value: 'gateway-xor',  label: '排他閘道（XOR）', shortLabel: '排他閘道 ◇×',
    helperText: '請設定兩條分支條件 + 目標' },
  { value: 'gateway-and',  label: '並行閘道（AND）', shortLabel: '並行閘道 ◇+',
    helperText: '請設定兩條分支條件 + 目標' },
  { value: 'gateway-or',   label: '包容閘道（OR）',  shortLabel: '包容閘道 ◇⊙',
    helperText: '請設定兩條分支條件 + 目標' },
  { value: 'start',        label: '開始事件',        shortLabel: '○ 開始事件',
    helperText: 'BPMN 流程起點。建議單一起點',
    inOther: true },
  { value: 'end',          label: '結束事件',        shortLabel: '● 結束事件',
    helperText: 'BPMN 流程終點。可多個（不同情境收尾）',
    inOther: true },
  { value: 'l3activity',   label: 'L3 流程（子流程調用）', shortLabel: 'L3 活動（子流程調用）',
    helperText: '調用其他 L3 流程；填入該 L3 編號' },
  { value: 'interaction',  label: '外部互動',        shortLabel: '▭ 外部互動',
    helperText: '外部關係人 / 系統互動（如：客戶補件）',
    inOther: true },
];

/** Lookup helper — returns the entry whose value matches `kind`, or null. */
export function getElementType(kind) {
  return ELEMENT_TYPES.find(e => e.value === kind) || null;
}

/** Subset filter for the OtherSubForm "新增其他" button row. */
export function getOtherElementTypes() {
  return ELEMENT_TYPES.filter(e => e.inOther);
}

/** Subset filter for the ConvertSubForm "轉換為..." list. Default = all. */
export function getConvertibleElementTypes() {
  return ELEMENT_TYPES.filter(e => e.inConvert !== false);
}

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
  // PR-D9 (2026-05-05): collect ALL existing target ids, not just the first.
  // Lets non-gateway↔non-gateway preserve fan-out (task ↔ interaction etc.),
  // and seeds multi-condition gateways from a multi-target task.
  const existingTargets = task.type === 'gateway'
    ? (task.conditions || []).map(c => c.nextTaskId).filter(Boolean)
    : (task.nextTaskIds || []).filter(Boolean);
  const firstTarget = existingTargets[0] || '';
  let overrides;
  if (kind === 'task') {
    overrides = { type: 'task', shapeType: 'task', connectionType: 'sequence',
      nextTaskIds: existingTargets.length ? existingTargets : [''], conditions: [] };
  } else if (kind === 'l3activity') {
    // Subprocess convention: single return target. Drop extras (l3activity
    // is a 1-in-1-out element by spec).
    overrides = { type: 'l3activity', shapeType: 'l3activity', connectionType: 'subprocess',
      nextTaskIds: firstTarget ? [firstTarget] : [''], conditions: [] };
  } else if (kind === 'interaction') {
    overrides = { type: 'task', shapeType: 'interaction', connectionType: 'sequence',
      nextTaskIds: existingTargets.length ? existingTargets : [''], conditions: [] };
  } else if (kind === 'start') {
    overrides = { type: 'start', shapeType: 'task', connectionType: 'start',
      nextTaskIds: existingTargets.length ? existingTargets : [''], conditions: [] };
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
    // PR-D9: when source isn't a gateway, seed conditions from EVERY target
    // (each gets empty label for the user to fill in). Single-target tasks
    // still get exactly one seeded condition; multi-target tasks no longer
    // silently drop branches.
    const conditions = existingConds.length
      ? existingConds
      : existingTargets.length
        ? existingTargets.map(id => ({ id: generateId(), label: '', nextTaskId: id }))
        : [{ id: generateId(), label: '', nextTaskId: '' }];
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

/**
 * Auto-sync rule (2026-04-30): tasks living in an external-role lane should
 * use the 外部關係人互動 element (shapeType='interaction'); tasks in internal
 * lanes use the regular L4 task element (shapeType='task'). Other element
 * types (gateway / start / end / l3activity) are lane-agnostic and stay
 * untouched by this sync.
 *
 * Trigger points:
 *   1. Task's roleId changes (user moves task between lanes) → applyRoleChange
 *   2. Role's type changes (user flips a lane internal↔external) → cascade
 *      via syncTasksToRoles over all tasks in that role
 *
 * NOT a trigger: storage.migrateFlow no longer calls syncTasksToRoles on load
 * (2026-05-05 — symmetric strict rule). Pre-existing mismatches stay visible
 * as red-border violations rather than getting silently auto-fixed on load.
 *
 * Scope: only flips between shapeType 'task' ↔ 'interaction'. type stays
 * 'task' in both cases (interaction is just a shape variant of a task,
 * not a separate element kind for routing purposes).
 */
function isLaneSensitive(task) {
  // Only regular tasks and interaction tasks swap based on lane.
  // type='task' covers both shapeType='task' and shapeType='interaction'.
  return task.type === 'task'
    && (task.shapeType === 'task' || task.shapeType === 'interaction');
}

/**
 * Symmetric strict rule (2026-05-05 update per user spec):
 *   external lane → force interaction (外部角色不能用一般任務)
 *   internal lane → force task         (內部角色不能用外部互動)
 *
 * Both directions cascade-convert when role.type flips or task moves to a
 * lane of different type. Standalone violations (user manually picks the
 * wrong shapeType in TaskCard, or legacy data) are NOT silently fixed —
 * they're surfaced as red-border warnings on the diagram (see
 * flowSelectors.getLaneShapeViolations).
 */
function targetShapeFor(_currentShape, role) {
  if (role?.type === 'external') return 'interaction';
  if (role?.type === 'internal') return 'task';
  return _currentShape;  // role unspecified — preserve user's choice
}

/** Move a task to a new role; auto-sync shapeType based on the role's type. */
export function applyRoleChange(task, newRoleId, roles) {
  if (!isLaneSensitive(task)) return { ...task, roleId: newRoleId };
  const newRole = (roles || []).find(r => r.id === newRoleId);
  const targetShape = targetShapeFor(task.shapeType, newRole);
  if (task.shapeType === targetShape && task.roleId === newRoleId) return task;
  // Shape changed — strip stored l4Number so display labels re-derive with
  // the right suffix family (`_e` for interaction, plain L4 counter for task).
  const stripL4 = task.shapeType !== targetShape && task.l4Number;
  const next = { ...task, roleId: newRoleId, shapeType: targetShape };
  if (stripL4) delete next.l4Number;
  return next;
}

/**
 * Cascade-sync every task's shapeType against the current roles list. Used
 * when a role's type flips and as a one-time fixup on load. Idempotent —
 * returns the same array reference when no changes needed.
 * Asymmetric: external forces interaction, internal preserves current shape.
 */
export function syncTasksToRoles(tasks, roles) {
  if (!Array.isArray(tasks) || !Array.isArray(roles)) return tasks;
  const roleById = new Map(roles.map(r => [r.id, r]));
  let anyShapeChange = false;
  // Pass 1: flip shapeType where the lane requires it.
  const intermediate = tasks.map(t => {
    if (!isLaneSensitive(t) || !t.roleId) return t;
    const role = roleById.get(t.roleId);
    if (!role) return t;
    const targetShape = targetShapeFor(t.shapeType, role);
    if (t.shapeType === targetShape) return t;
    anyShapeChange = true;
    return { ...t, shapeType: targetShape };
  });
  if (!anyShapeChange) return tasks;
  // Pass 2 (PR-D8, 2026-05-05): strip stored l4Number from EVERY task in
  // the flow when any shape changes. Anchor topology shifts when a task
  // flips between task↔interaction — `_g` / `_s` / `_e` suffix anchors
  // and regular-task counter ordering all need to re-derive against the
  // new layout. computeDisplayLabels prefers stored over derived, so a
  // surgical strip on only the directly-flipped task left gateway / other
  // interaction labels pointing at stale anchors. Stripping all is safe
  // because computeDisplayLabels regenerates deterministically; tasks not
  // affected by the flip get the same number back.
  return intermediate.map(t => {
    if (!t.l4Number) return t;
    const { l4Number, ...rest } = t;
    return rest;
  });
}

// ────────────────────────────────────────────────────────────────────────────
// External-role name prefix automation (PR-D4, 2026-05-05)
// ────────────────────────────────────────────────────────────────────────────

export const EXTERNAL_ROLE_PREFIX = '[外部角色]';

/**
 * Ensure an external-role's display name carries the `[外部角色]` prefix
 * (per user spec rule 5 + I — auto-prefix on add / Excel import / type-flip,
 * and re-add when user manually deletes the prefix). Idempotent: returns
 * the same object reference when already prefixed or when role.type !== 'external'.
 */
export function ensureExternalPrefix(role) {
  if (!role || role.type !== 'external') return role;
  const name = role.name || '';
  if (name.startsWith(EXTERNAL_ROLE_PREFIX)) return role;
  return { ...role, name: EXTERNAL_ROLE_PREFIX + name };
}

/** Cascade-apply ensureExternalPrefix to a roles array; same-ref when no-op. */
export function applyExternalPrefixToRoles(roles) {
  if (!Array.isArray(roles)) return roles;
  let changed = false;
  const next = roles.map(r => {
    const fixed = ensureExternalPrefix(r);
    if (fixed !== r) changed = true;
    return fixed;
  });
  return changed ? next : roles;
}

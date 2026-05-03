/**
 * taskDefs.js — Shared task/connection type definitions and utilities.
 * Used by both Wizard.jsx and FlowEditor.jsx.
 */
import { generateId } from './storage.js';

// ── L3 / L4 number format (single source of truth) ──────────────────
// Current spec (dash separator only):
//   L3:                  d-d-d                   (3 segments)
//   L4 base:             d-d-d-d                 (4 segments)
//   L4 start event:      d-d-d-0                 (suffix must be 0)
//   L4 end event:        d-d-d-99                (suffix must be 99)
//   L4 gateway:          d-d-d-d_g               (single gateway after a task)
//                        d-d-d-d_g1 / _g2 / ...  (consecutive gateways)
//                        All gateway types (XOR / AND / OR) use this notation.
//   L4 subprocess call:  d-d-d-d_s               (single subprocess after a task)
//                        d-d-d-d_s1 / _s2 / ...  (consecutive subprocess calls,
//                          where 連續 = no independent L4 task between them; _g
//                          in between does NOT break the run, mirroring the way
//                          subprocess calls don't break consecutive _g).
// Both `_g` and `_s` share these properties:
//   - prefix d-d-d-d must reference an existing L4 task in the same flow
//     (or `-0` when the gateway/subprocess is the first element after start)
//   - they don't consume an N counter slot
// Letter suffixes (`a`, `b`…) are explicitly forbidden — see business-spec §2 (8).
// Dot separators are NOT accepted in new data; legacy localStorage data gets
// dot→dash migration via storage.normalizeNumber.
export const L3_NUMBER_PATTERN     = /^\d+-\d+-\d+$/;
export const L4_NUMBER_PATTERN     = /^\d+-\d+-\d+-\d+(_g\d*|_s\d*|_w\d*)?$/;
export const L4_START_PATTERN      = /^\d+-\d+-\d+-0$/;
export const L4_END_PATTERN        = /^\d+-\d+-\d+-99$/;
export const L4_GATEWAY_PATTERN    = /^\d+-\d+-\d+-\d+_g\d*$/;
export const L4_SUBPROCESS_PATTERN = /^\d+-\d+-\d+-\d+_s\d*$/;
// `_w` suffix marks "外部關係人互動" tasks — like `_g` / `_s`, doesn't
// claim a flow counter and shares the previous L4 task's anchor. Added
// 2026-04-30 per user spec ("跟現在閘道的編號邏輯一樣用『前一個L4編號＋後綴』").
export const L4_INTERACTION_PATTERN = /^\d+-\d+-\d+-\d+_w\d*$/;

// ── Constants ─────────────────────────────────────────────────────
// User-pickable connectionTypes in the dropdown. Type variants that exist in
// the data model but are NOT user-pickable (legacy data still supported):
//   - parallel-merge / conditional-merge / inclusive-merge — derived from
//     incoming-edge count via formatConnection (PR-B 2026-04-29)
//   - breakpoint     — removed per user request 2026-04-29 (no new ones)
//   - loop-return    — removed per user request 2026-04-29
// Existing breakpoint / loop-return data still renders correctly but cannot
// be created from the dropdown anymore. The diagram won't generate new
// breakpoint shapes.
export const CONNECTION_TYPES = [
  { value: 'sequence',           label: '序列流向' },
  { value: 'conditional-branch', label: '條件分支' },
  { value: 'parallel-branch',    label: '並行分支' },
  { value: 'inclusive-branch',   label: '包容分支' },
  { value: 'start',              label: '流程開始' },
  { value: 'end',                label: '流程結束' },
  { value: 'subprocess',         label: '子流程調用' },
];

export const SHAPE_TYPES = [
  { value: 'task',        label: 'L4 任務' },
  { value: 'interaction', label: '外部互動' },
  { value: 'l3activity',  label: 'L3 活動（關聯）' },
];

export const CONN_BADGE = {
  'sequence':           { label: '',     bg: '#E5E7EB', text: '#374151' },
  'subprocess':         { label: '子流程', bg: '#EDE9FE', text: '#5B21B6' },
  'conditional-branch': { label: '排他',  bg: '#FEF3C7', text: '#92400E' },
  'parallel-branch':    { label: '並行',  bg: '#D1FAE5', text: '#065F46' },
  'inclusive-branch':   { label: '包容',  bg: '#FEF9C3', text: '#854D0E' },
  'start':              { label: '開始',  bg: '#D1FAE5', text: '#065F46' },
  'end':                { label: '結束',  bg: '#FEE2E2', text: '#991B1B' },
  'breakpoint':         { label: '斷點',  bg: '#FEE2E2', text: '#991B1B' },
  'loop-return':        { label: '迴圈',  bg: '#EDE9FE', text: '#5B21B6' },
};

export const CONN_ROW_BG = {
  'sequence':           '#FAFAFA',
  'subprocess':         '#FAF5FF',
  'conditional-branch': '#FFFBEB',
  'parallel-branch':    '#F0FDF4',
  'inclusive-branch':   '#FEFCE8',
  'start':              '#F0FDF4',
  'end':                '#FFF1F2',
  'breakpoint':         '#FFF1F2',
  'loop-return':        '#F5F3FF',
};

// ── Factories ─────────────────────────────────────────────────────
export function makeRole() {
  return { id: generateId(), name: '', type: 'internal' };
}

export function makeTask(overrides = {}) {
  return {
    id: generateId(), roleId: '', name: '',
    connectionType: 'sequence', shapeType: 'task',
    type: 'task', gatewayType: 'xor',
    conditions: [], nextTaskIds: [''],
    subprocessName: '', breakpointReason: '',
    // User-defined manual endpoint overrides for outgoing connections.
    //   key = target task id (for regular tasks) or condition.id (for gateway)
    //   value = { exitSide?: 'top'|'right'|'bottom'|'left', entrySide?: same }
    // Applied in src/diagram/layout.js as the last routing step, overriding
    // the auto-computed exit/entry sides. See CLAUDE.md §10.1 rule 5 for the
    // validation semantics (IN+OUT mix = blocking, crossing task = warning).
    connectionOverrides: {},
    ...overrides,
  };
}

export function makeCondition(label = '') {
  return { id: generateId(), label, nextTaskId: '' };
}

// Display labels for the three gateway types (used in task name prefix
// like "[排他閘道] 判斷客戶心情" so the FlowTable / Excel rows stay readable
// without having to look at the diagram).
export const GATEWAY_LABELS = {
  xor: '排他閘道',
  and: '並行閘道',
  or:  '包容閘道',
};

const GATEWAY_PREFIX_RE = /^\[(?:排他|並行|包容)閘道\]\s*/;

/** Build the display prefix `[XX閘道] ` for a given gateway type. */
export function gatewayPrefix(gatewayType) {
  const label = GATEWAY_LABELS[gatewayType] || '閘道';
  return `[${label}] `;
}

/**
 * Apply / refresh the gateway-type prefix on a task name. Strips any existing
 * "[排他/並行/包容閘道]" prefix first, then prepends the new one. Idempotent.
 * If `gatewayType` is null/undefined, only strips (used when converting a
 * gateway back into a regular task).
 *   ""                     + 'or'   → "[包容閘道] "
 *   "[排他閘道] 判斷"        + 'or'   → "[包容閘道] 判斷"
 *   "[包容閘道] 判斷"        + 'or'   → "[包容閘道] 判斷"
 *   "判斷"                  + 'and'  → "[並行閘道] 判斷"
 *   "[排他閘道] 判斷"        + null   → "判斷"
 */
export function applyGatewayPrefix(name, gatewayType) {
  const stripped = (name || '').replace(GATEWAY_PREFIX_RE, '');
  if (!gatewayType) return stripped;
  return `${gatewayPrefix(gatewayType)}${stripped}`;
}

// ── Task normalization ────────────────────────────────────────────
/** Infer connectionType from legacy task data (for existing saved flows) */
export function normalizeTask(task) {
  if (task.connectionType) return migrateLoopReturn(task);
  let connectionType = 'sequence';
  let shapeType = 'task';
  if (task.type === 'start') { connectionType = 'start'; }
  else if (task.type === 'end') { connectionType = 'end'; }
  else if (task.type === 'interaction') { connectionType = 'sequence'; shapeType = 'interaction'; }
  else if (task.type === 'l3activity')  { connectionType = 'sequence'; shapeType = 'l3activity'; }
  else if (task.type === 'gateway') {
    // PR-B: gateways always use the -branch connectionType. The merge
    // semantic is now derived from incoming-edge count at render time
    // (formatConnection auto-detects ≥2 incoming → emits "X合併 ..." text).
    const conds = task.conditions || [];
    if (task.gatewayType === 'and') {
      connectionType = 'parallel-branch';
    } else if (task.gatewayType === 'or') {
      connectionType = 'inclusive-branch';
    } else {
      const isLoop = conds.some(c => c.label === '若未通過' || c.label === '若通過');
      connectionType = isLoop ? 'loop-return' : 'conditional-branch';
    }
  } else if (task.type === 'task') {
    if ((task.nextTaskIds || []).filter(Boolean).length > 1) connectionType = 'parallel-branch';
    else if (task.subprocessName || task.flowAnnotation?.includes('調用子流程')) connectionType = 'subprocess';
  }
  let conditions = task.conditions || [];
  let nextTaskIds = task.nextTaskIds || [];
  if (connectionType === 'parallel-branch' && task.type === 'task' && nextTaskIds.filter(Boolean).length > 1) {
    conditions = nextTaskIds.filter(Boolean).map(id => ({ id: generateId(), label: '', nextTaskId: id }));
    nextTaskIds = [];
  }
  return migrateLoopReturn({
    ...task, connectionType, shapeType, conditions, nextTaskIds,
    subprocessName: task.subprocessName || '', breakpointReason: task.breakpointReason || '',
    connectionOverrides: task.connectionOverrides || {},
  });
}

/**
 * Migrate legacy loop-return data model:
 *   OLD: { type:'gateway', connectionType:'loop-return',
 *          conditions:[{label:'若未通過',nextTaskId:X},{label:'若通過',nextTaskId:Y}] }
 *   NEW: { type:'task', connectionType:'loop-return', nextTaskIds:[X, Y], conditions:[] }
 *
 * Task keeps rectangle shape; the back target X and forward target Y merge
 * into nextTaskIds. New Wizard UI only edits nextTaskIds[0] (the back
 * target); forward continuation (if any) stays in nextTaskIds[1+] and is
 * handled as a regular sequential edge.
 */
function migrateLoopReturn(task) {
  if (task.connectionType !== 'loop-return') return task;
  if (task.type === 'task' && Array.isArray(task.nextTaskIds)) return task;  // already migrated
  const conds = task.conditions || [];
  const targets = conds.map(c => c.nextTaskId).filter(Boolean);
  return {
    ...task,
    type: 'task',
    conditions: [],
    nextTaskIds: targets.length ? targets : [''],
  };
}

/** Apply a new connectionType, resetting connections appropriately */
export function applyConnectionType(task, newCT) {
  const st = task.shapeType || 'task';
  // loop-return is NOT a gateway — it's a regular task with a back-edge
  // stored in nextTaskIds[0] (single target, like 迴圈返回至 X syntax).
  const typeMap = {
    sequence: st, subprocess: 'l3activity', start: 'start', end: 'end', breakpoint: 'end',
    'conditional-branch': 'gateway', 'parallel-branch': 'gateway',
    'inclusive-branch':  'gateway',
    'loop-return': 'task',
  };
  const gwMap = {
    'conditional-branch': 'xor',
    'parallel-branch':    'and',
    'inclusive-branch':   'or',
  };
  let conditions = [], nextTaskIds = [];
  if (newCT === 'sequence' || newCT === 'start' || newCT === 'subprocess') {
    nextTaskIds = (task.nextTaskIds || []).filter(Boolean).length
      ? task.nextTaskIds.filter(Boolean) : [''];
  } else if (newCT === 'conditional-branch'
          || newCT === 'parallel-branch'
          || newCT === 'inclusive-branch') {
    conditions = task.conditions?.length ? task.conditions : [makeCondition()];
  } else if (newCT === 'loop-return') {
    // Prefer existing nextTaskIds[0] (new model) or fallback to legacy
    // conditions[0].nextTaskId (若未通過 = back target).
    const back = (task.nextTaskIds?.[0]) || (task.conditions?.[0]?.nextTaskId) || '';
    nextTaskIds = [back];
  }
  const newGwType = gwMap[newCT] || null;
  return {
    ...task, connectionType: newCT, shapeType: st,
    type: typeMap[newCT] || 'task', gatewayType: newGwType || task.gatewayType || 'xor',
    name: applyGatewayPrefix(task.name, newGwType),
    conditions, nextTaskIds,
    // PR H: connectionType change invalidates all manual overrides because
    // key semantics flip — gateway uses condId, regular task uses targetId.
    connectionOverrides: {},
  };
}

/** Auto-link tasks sequentially when nextTaskIds is empty */
export function applySequentialDefaults(tasks) {
  return tasks.map((t, i) => {
    const ct = t.connectionType || 'sequence';
    if (['end', 'breakpoint',
         'conditional-branch', 'parallel-branch', 'inclusive-branch',
         'loop-return'].includes(ct)) return t;
    const hasNext = t.nextTaskIds?.some(Boolean);
    if (hasNext) return t;
    return { ...t, nextTaskIds: tasks[i + 1] ? [tasks[i + 1].id] : [] };
  });
}

// ── Display helpers ───────────────────────────────────────────────
// `computeDisplayLabels` lives in `src/model/flowSelectors.js` (PR-6).
// Re-exported here so existing importers keep working unchanged.
export { computeDisplayLabels } from '../model/flowSelectors.js';

/** Human-readable option label for a task in a dropdown */
export function taskOptionLabel(task, displayLabels) {
  const ct = task.connectionType || 'sequence';
  const num = displayLabels[task.id] ?? '';
  const name = task.name.trim();
  if (ct === 'start')              return `${num} ● 流程開始${name ? '：' + name : ''}`;
  if (ct === 'end')                return `${num} ⊙ 流程結束`;
  if (ct === 'breakpoint')         return `${num} ⊗ 流程斷點${name ? '：' + name : ''}`;
  if (ct === 'conditional-branch') return `${num} ◇× 排他：${name || '（未命名）'}`;
  if (ct === 'parallel-branch')    return `${num} ◇+ 並行：${name || '（未命名）'}`;
  if (ct === 'inclusive-branch')   return `${num} ◇⊙ 包容：${name || '（未命名）'}`;
  if (ct === 'loop-return')        return `${num} ↺ 迴圈：${name || '（未命名）'}`;
  if (ct === 'subprocess')         return `${num} ▦ 子流程：${name || '（未命名）'}`;
  return `${num}${name ? ' ' + name : ' （未命名）'}`;
}

/**
 * taskDefs.js — Shared task/connection type definitions and utilities.
 * Used by both Wizard.jsx and FlowEditor.jsx.
 */
import { generateId } from './storage.js';

// ── L3 / L4 number format (single source of truth) ──────────────────
// Current spec (dash separator only):
//   L3:                d-d-d                   (3 segments)
//   L4 base:           d-d-d-d                 (4 segments)
//   L4 start event:    d-d-d-0                 (suffix must be 0)
//   L4 end event:      d-d-d-99                (suffix must be 99)
//   L4 gateway:        d-d-d-d_g               (single gateway after a task)
//                      d-d-d-d_g1 / _g2 / ...  (consecutive gateways)
//                      All gateway types (XOR / AND / OR) use this notation;
//                      prefix d-d-d-d must match an existing L4 task number.
// Dot separators are NOT accepted in new data. Legacy localStorage data still
// gets dot→dash migration via storage.normalizeNumber. If numbering rules
// change, update these patterns + any example strings in Wizard / HelpPanel.
export const L3_NUMBER_PATTERN   = /^\d+-\d+-\d+$/;
export const L4_NUMBER_PATTERN   = /^\d+-\d+-\d+-\d+(_g\d*)?$/;
export const L4_START_PATTERN    = /^\d+-\d+-\d+-0$/;
export const L4_END_PATTERN      = /^\d+-\d+-\d+-99$/;
export const L4_GATEWAY_PATTERN  = /^\d+-\d+-\d+-\d+_g\d*$/;

// ── Constants ─────────────────────────────────────────────────────
export const CONNECTION_TYPES = [
  { value: 'sequence',           label: '序列流向' },
  { value: 'conditional-branch', label: '條件分支' },
  { value: 'parallel-branch',    label: '並行分支' },
  { value: 'parallel-merge',     label: '並行合併' },
  { value: 'conditional-merge',  label: '條件合併' },
  { value: 'start',              label: '流程開始' },
  { value: 'end',                label: '流程結束' },
  { value: 'breakpoint',         label: '流程斷點' },
  { value: 'subprocess',         label: '子流程調用' },
  { value: 'loop-return',        label: '迴圈返回' },
];

export const SHAPE_TYPES = [
  { value: 'task',        label: 'L4 任務' },
  { value: 'interaction', label: '外部互動' },
  { value: 'l3activity',  label: 'L3 活動（關聯）' },
];

export const CONN_BADGE = {
  'sequence':           { label: '',     bg: '#E5E7EB', text: '#374151' },
  'subprocess':         { label: '子流',  bg: '#EDE9FE', text: '#5B21B6' },
  'conditional-branch': { label: 'XOR',  bg: '#FEF3C7', text: '#92400E' },
  'parallel-branch':    { label: 'AND',  bg: '#D1FAE5', text: '#065F46' },
  'parallel-merge':     { label: '⊕',   bg: '#D1FAE5', text: '#065F46' },
  'conditional-merge':  { label: '◇↘', bg: '#FEF3C7', text: '#92400E' },
  'start':              { label: '開始',  bg: '#D1FAE5', text: '#065F46' },
  'end':                { label: '結束',  bg: '#FEE2E2', text: '#991B1B' },
  'breakpoint':         { label: '斷點',  bg: '#FEE2E2', text: '#991B1B' },
  'loop-return':        { label: '↺',   bg: '#EDE9FE', text: '#5B21B6' },
};

export const CONN_ROW_BG = {
  'sequence':           '#FAFAFA',
  'subprocess':         '#FAF5FF',
  'conditional-branch': '#FFFBEB',
  'parallel-branch':    '#F0FDF4',
  'parallel-merge':     '#F0FDF4',
  'conditional-merge':  '#FFFBEB',
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
    ...overrides,
  };
}

export function makeCondition(label = '') {
  return { id: generateId(), label, nextTaskId: '' };
}

// ── Task normalization ────────────────────────────────────────────
/** Infer connectionType from legacy task data (for existing saved flows) */
export function normalizeTask(task) {
  if (task.connectionType) return task;
  let connectionType = 'sequence';
  let shapeType = 'task';
  if (task.type === 'start') { connectionType = 'start'; }
  else if (task.type === 'end') { connectionType = 'end'; }
  else if (task.type === 'interaction') { connectionType = 'sequence'; shapeType = 'interaction'; }
  else if (task.type === 'l3activity')  { connectionType = 'sequence'; shapeType = 'l3activity'; }
  else if (task.type === 'gateway') {
    const conds = task.conditions || [];
    if (task.gatewayType === 'and') {
      connectionType = conds.length <= 1 ? 'parallel-merge' : 'parallel-branch';
    } else {
      const isLoop = conds.some(c => c.label === '若未通過' || c.label === '若通過');
      connectionType = isLoop ? 'loop-return' : conds.length <= 1 ? 'conditional-merge' : 'conditional-branch';
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
  return {
    ...task, connectionType, shapeType, conditions, nextTaskIds,
    subprocessName: task.subprocessName || '', breakpointReason: task.breakpointReason || '',
  };
}

/** Apply a new connectionType, resetting connections appropriately */
export function applyConnectionType(task, newCT) {
  const st = task.shapeType || 'task';
  const typeMap = {
    sequence: st, subprocess: 'task', start: 'start', end: 'end', breakpoint: 'end',
    'conditional-branch': 'gateway', 'parallel-branch': 'gateway',
    'parallel-merge': 'gateway', 'conditional-merge': 'gateway', 'loop-return': 'gateway',
  };
  const gwMap = {
    'conditional-branch': 'xor', 'conditional-merge': 'xor', 'loop-return': 'xor',
    'parallel-branch': 'and', 'parallel-merge': 'and',
  };
  let conditions = [], nextTaskIds = [];
  if (newCT === 'sequence' || newCT === 'start' || newCT === 'subprocess') {
    nextTaskIds = (task.nextTaskIds || []).filter(Boolean).length
      ? task.nextTaskIds.filter(Boolean) : [''];
  } else if (newCT === 'conditional-branch') {
    conditions = task.conditions?.length ? task.conditions : [makeCondition()];
  } else if (newCT === 'parallel-branch') {
    conditions = task.conditions?.length ? task.conditions : [makeCondition()];
  } else if (newCT === 'parallel-merge' || newCT === 'conditional-merge') {
    conditions = task.conditions?.length ? [task.conditions[0]] : [makeCondition()];
  } else if (newCT === 'loop-return') {
    const ex = task.conditions || [];
    conditions = [
      { id: ex[0]?.id || generateId(), label: '若未通過', nextTaskId: ex[0]?.nextTaskId || '' },
      { id: ex[1]?.id || generateId(), label: '若通過',   nextTaskId: ex[1]?.nextTaskId || '' },
    ];
  }
  return {
    ...task, connectionType: newCT, shapeType: st,
    type: typeMap[newCT] || 'task', gatewayType: gwMap[newCT] || task.gatewayType || 'xor',
    conditions, nextTaskIds,
  };
}

/** Auto-link tasks sequentially when nextTaskIds is empty */
export function applySequentialDefaults(tasks) {
  return tasks.map((t, i) => {
    const ct = t.connectionType || 'sequence';
    if (['end', 'breakpoint', 'conditional-branch', 'parallel-branch',
         'parallel-merge', 'conditional-merge', 'loop-return'].includes(ct)) return t;
    const hasNext = t.nextTaskIds?.some(Boolean);
    if (hasNext) return t;
    return { ...t, nextTaskIds: tasks[i + 1] ? [tasks[i + 1].id] : [] };
  });
}

// ── Display helpers ───────────────────────────────────────────────
/** Compute display labels (e.g. "1-1-1-1") for each task */
export function computeDisplayLabels(tasks, l3Number) {
  const labels = {};
  let counter = 1;
  tasks.forEach(task => {
    labels[task.id] = `${l3Number || '?'}-${counter++}`;
  });
  return labels;
}

/** Human-readable option label for a task in a dropdown */
export function taskOptionLabel(task, displayLabels) {
  const ct = task.connectionType || 'sequence';
  const num = displayLabels[task.id] ?? '';
  const name = task.name.trim();
  if (ct === 'start')              return `${num} ● 流程開始${name ? '：' + name : ''}`;
  if (ct === 'end')                return `${num} ⊙ 流程結束`;
  if (ct === 'breakpoint')         return `${num} ⊗ 流程斷點${name ? '：' + name : ''}`;
  if (ct === 'conditional-branch') return `${num} ◇× XOR：${name || '（未命名）'}`;
  if (ct === 'parallel-branch')    return `${num} ◇+ AND：${name || '（未命名）'}`;
  if (ct === 'parallel-merge')     return `${num} ⊕ 並行合併：${name || '（未命名）'}`;
  if (ct === 'conditional-merge')  return `${num} ◇↘ 條件合併：${name || '（未命名）'}`;
  if (ct === 'loop-return')        return `${num} ↺ 迴圈：${name || '（未命名）'}`;
  if (ct === 'subprocess')         return `${num} ▦ 子流程：${name || '（未命名）'}`;
  return `${num}${name ? ' ' + name : ' （未命名）'}`;
}

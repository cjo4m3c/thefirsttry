import { useState, useMemo } from 'react';
import { generateId } from '../utils/storage.js';
import DiagramRenderer from './DiagramRenderer.jsx';

// ── Constants ────────────────────────────────────────────────────
const CONNECTION_TYPES = [
  { value: 'sequence',          label: '序列流向' },
  { value: 'conditional-branch',label: '條件分支' },
  { value: 'parallel-branch',   label: '並行分支' },
  { value: 'parallel-merge',    label: '並行合併' },
  { value: 'conditional-merge', label: '條件合併' },
  { value: 'start',             label: '流程開始' },
  { value: 'end',               label: '流程結束' },
  { value: 'breakpoint',        label: '流程斷點' },
  { value: 'subprocess',        label: '子流程調用' },
  { value: 'loop-return',       label: '迴圈返回' },
];

const SHAPE_TYPES = [
  { value: 'task',        label: 'L4 任務' },
  { value: 'interaction', label: '外部互動' },
  { value: 'l3activity',  label: 'L3 活動（關聯）' },
];

const CONN_BADGE = {
  'sequence':           { label: '',    bg: '#E5E7EB', text: '#374151' },
  'subprocess':         { label: '子流', bg: '#EDE9FE', text: '#5B21B6' },
  'conditional-branch': { label: 'XOR', bg: '#FEF3C7', text: '#92400E' },
  'parallel-branch':    { label: 'AND', bg: '#D1FAE5', text: '#065F46' },
  'parallel-merge':     { label: '⊕',  bg: '#D1FAE5', text: '#065F46' },
  'conditional-merge':  { label: '◇↘', bg: '#FEF3C7', text: '#92400E' },
  'start':              { label: '開始', bg: '#D1FAE5', text: '#065F46' },
  'end':                { label: '結束', bg: '#FEE2E2', text: '#991B1B' },
  'breakpoint':         { label: '斷點', bg: '#FEE2E2', text: '#991B1B' },
  'loop-return':        { label: '↺',  bg: '#EDE9FE', text: '#5B21B6' },
};

const CONN_ROW_BG = {
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

// ── Factories ────────────────────────────────────────────────────
function makeRole() {
  return { id: generateId(), name: '', type: 'internal' };
}

function makeTask(overrides = {}) {
  return {
    id: generateId(), roleId: '', name: '',
    connectionType: 'sequence', shapeType: 'task',
    type: 'task', gatewayType: 'xor',
    conditions: [], nextTaskIds: [''],
    subprocessName: '', breakpointReason: '',
    ...overrides,
  };
}

function makeCondition(label = '') {
  return { id: generateId(), label, nextTaskId: '' };
}

/** Infer connectionType from legacy task data (for existing saved flows) */
function normalizeTask(task) {
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
  // migrate parallel-branch from multi-nextTaskIds task
  let conditions = task.conditions || [];
  let nextTaskIds = task.nextTaskIds || [];
  if (connectionType === 'parallel-branch' && task.type === 'task' && nextTaskIds.filter(Boolean).length > 1) {
    conditions = nextTaskIds.filter(Boolean).map(id => ({ id: generateId(), label: '', nextTaskId: id }));
    nextTaskIds = [];
  }
  return { ...task, connectionType, shapeType, conditions, nextTaskIds,
    subprocessName: task.subprocessName || '', breakpointReason: task.breakpointReason || '' };
}

/** Apply a new connectionType, resetting connections appropriately */
function applyConnectionType(task, newCT) {
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
    nextTaskIds = (task.nextTaskIds || []).filter(Boolean).length ? task.nextTaskIds.filter(Boolean) : [''];
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
  return { ...task, connectionType: newCT, shapeType: st,
    type: typeMap[newCT] || 'task', gatewayType: gwMap[newCT] || task.gatewayType || 'xor',
    conditions, nextTaskIds };
}

function applySequentialDefaults(tasks) {
  return tasks.map((t, i) => {
    const ct = t.connectionType || 'sequence';
    if (['end','breakpoint','conditional-branch','parallel-branch',
         'parallel-merge','conditional-merge','loop-return'].includes(ct)) return t;
    const hasNext = t.nextTaskIds?.some(Boolean);
    if (hasNext) return t;
    return { ...t, nextTaskIds: tasks[i + 1] ? [tasks[i + 1].id] : [] };
  });
}

function initFormData(flow) {
  if (flow) {
    const migrated = (flow.tasks || []).map(t => {
      const withIds = t.nextTaskIds?.length ? t : { ...t, nextTaskIds: t.nextTaskId ? [t.nextTaskId] : [] };
      return normalizeTask(withIds);
    });
    return { ...flow, tasks: applySequentialDefaults(migrated) };
  }
  const tasks = Array.from({ length: 8 }, (_, i) =>
    makeTask({ connectionType: i === 0 ? 'start' : 'sequence', type: i === 0 ? 'start' : 'task' })
  );
  tasks.forEach((t, i) => { t.nextTaskIds = tasks[i + 1] ? [tasks[i + 1].id] : []; });
  return { id: generateId(), l3Number: '', l3Name: '', roles: [makeRole(), makeRole()], tasks };
}

// ── Helpers ──────────────────────────────────────────────────────
function computeDisplayLabels(tasks, l3Number) {
  const labels = {};
  let counter = 1;
  tasks.forEach(task => {
    labels[task.id] = `${l3Number || '?'}.${counter++}`;
  });
  return labels;
}

function taskOptionLabel(task, displayLabels) {
  const ct = task.connectionType || 'sequence';
  const num = displayLabels[task.id] ?? '';
  const name = task.name.trim();
  if (ct === 'start')             return `${num} ● 流程開始${name ? '：' + name : ''}`;
  if (ct === 'end')               return `${num} ⊙ 流程結束`;
  if (ct === 'breakpoint')        return `${num} ⊗ 流程斷點${name ? '：' + name : ''}`;
  if (ct === 'conditional-branch')return `${num} ◇× XOR：${name || '（未命名）'}`;
  if (ct === 'parallel-branch')   return `${num} ◇+ AND：${name || '（未命名）'}`;
  if (ct === 'parallel-merge')    return `${num} ⊕ 並行合併：${name || '（未命名）'}`;
  if (ct === 'conditional-merge') return `${num} ◇↘ 條件合併：${name || '（未命名）'}`;
  if (ct === 'loop-return')       return `${num} ↺ 迴圈：${name || '（未命名）'}`;
  if (ct === 'subprocess')        return `${num} ▦ 子流程：${name || '（未命名）'}`;
  return `${num}${name ? ' ' + name : ' （未命名）'}`;
}

// ── Drag-and-drop hook ───────────────────────────────────────────
function useDragReorder(items, onReorder) {
  const [dragIdx, setDragIdx] = useState(null);
  const [overIdx, setOverIdx] = useState(null);

  function onDragStart(e, i) {
    setDragIdx(i);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', '');
  }

  function onDragOver(e, i) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (i !== overIdx) setOverIdx(i);
  }

  function onDrop(e, i) {
    e.preventDefault();
    if (dragIdx !== null && dragIdx !== i) {
      const next = [...items];
      const [moved] = next.splice(dragIdx, 1);
      next.splice(i, 0, moved);
      onReorder(next);
    }
    setDragIdx(null);
    setOverIdx(null);
  }

  function onDragEnd() {
    setDragIdx(null);
    setOverIdx(null);
  }

  function rowProps(i) {
    return {
      draggable: true,
      onDragStart: e => onDragStart(e, i),
      onDragOver:  e => onDragOver(e, i),
      onDrop:      e => onDrop(e, i),
      onDragEnd,
    };
  }

  return { dragIdx, overIdx, rowProps };
}

// ── Shared sub-components ────────────────────────────────────────
function DragHandle() {
  return (
    <div className="flex items-center justify-center w-5 flex-shrink-0 cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500 select-none">
      <svg width="10" height="16" viewBox="0 0 10 16" fill="currentColor">
        <circle cx="3" cy="3"  r="1.4"/><circle cx="7" cy="3"  r="1.4"/>
        <circle cx="3" cy="8"  r="1.4"/><circle cx="7" cy="8"  r="1.4"/>
        <circle cx="3" cy="13" r="1.4"/><circle cx="7" cy="13" r="1.4"/>
      </svg>
    </div>
  );
}

function StepIndicator({ current, steps }) {
  return (
    <div className="flex items-center mb-8">
      {steps.map((label, i) => (
        <div key={i} className="flex items-center flex-1 last:flex-none">
          <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold border-2 transition-colors flex-shrink-0 ${
            i < current  ? 'bg-blue-600 border-blue-600 text-white' :
            i === current ? 'bg-blue-50 border-blue-600 text-blue-700' :
                            'bg-gray-100 border-gray-300 text-gray-400'
          }`}>{i + 1}</div>
          <span className={`ml-2 text-sm font-medium whitespace-nowrap ${
            i === current ? 'text-blue-700' : i < current ? 'text-blue-500' : 'text-gray-400'
          }`}>{label}</span>
          {i < steps.length - 1 && (
            <div className={`flex-1 h-0.5 mx-3 ${i < current ? 'bg-blue-500' : 'bg-gray-200'}`} />
          )}
        </div>
      ))}
    </div>
  );
}

// ── Step 1: L3 Info ──────────────────────────────────────────────
function Step1({ data, onChange }) {
  const [numErr, setNumErr] = useState('');

  function handleNumber(val) {
    onChange({ l3Number: val });
    setNumErr(val && !/^\d+(\.\d+)*$/.test(val) ? '格式錯誤，範例：1.1.1' : '');
  }

  return (
    <div className="max-w-lg mx-auto">
      <h2 className="text-xl font-bold text-gray-800 mb-1">L3 活動基本資訊</h2>
      <p className="text-sm text-gray-500 mb-6">輸入此活動的名稱與層級編號</p>
      <div className="flex flex-col gap-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">L3 活動編號 <span className="text-red-500">*</span></label>
          <input type="text" placeholder="例：1.1.1" value={data.l3Number}
            onChange={e => handleNumber(e.target.value)}
            className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 ${numErr ? 'border-red-400' : 'border-gray-300'}`} />
          {numErr && <p className="text-xs text-red-500 mt-1">{numErr}</p>}
          <p className="text-xs text-gray-400 mt-1">三層編碼，例：1.1.1、2.3.4</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">L3 活動名稱 <span className="text-red-500">*</span></label>
          <input type="text" placeholder="例：建立商機報價" value={data.l3Name}
            onChange={e => onChange({ l3Name: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
        </div>
        {data.l3Number && data.l3Name && (
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700">
            預覽：<strong>{data.l3Number}</strong>　{data.l3Name}
            <br /><span className="text-xs opacity-70">L4 任務將從 {data.l3Number}.1 開始編號</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Step 2: Roles (with drag-and-drop) ──────────────────────────
function Step2({ data, onChange }) {
  const { dragIdx, overIdx, rowProps } = useDragReorder(
    data.roles,
    newRoles => onChange({ roles: newRoles })
  );

  function addRole() { onChange({ roles: [...data.roles, makeRole()] }); }
  function removeRole(id) {
    if (data.roles.length <= 2) return;
    onChange({ roles: data.roles.filter(r => r.id !== id) });
  }
  function updateRole(id, field, val) {
    onChange({ roles: data.roles.map(r => r.id === id ? { ...r, [field]: val } : r) });
  }

  return (
    <div className="max-w-xl mx-auto">
      <h2 className="text-xl font-bold text-gray-800 mb-1">泳道角色設定</h2>
      <p className="text-sm text-gray-500 mb-2">設定流程中的參與角色（至少 2 個）</p>
      <p className="text-xs text-gray-400 mb-5 flex items-center gap-1">
        <span className="text-gray-400">⠿</span> 可用滑鼠拖曳左側圓點改變泳道順序（由上到下）
      </p>

      <div className="flex flex-col gap-2">
        {data.roles.map((role, i) => (
          <div
            key={role.id}
            {...rowProps(i)}
            className={`flex items-center gap-3 p-3 bg-gray-50 border rounded-lg transition-all select-none
              ${dragIdx === i ? 'opacity-40 scale-95' : ''}
              ${overIdx === i && dragIdx !== i ? 'border-blue-400 border-t-2' : 'border-gray-200'}`}>
            <DragHandle />
            <span className="text-xs text-gray-400 w-4 flex-shrink-0">#{i + 1}</span>
            <input type="text" placeholder="角色名稱" value={role.name}
              onChange={e => updateRole(role.id, 'name', e.target.value)}
              className="flex-1 px-3 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
            <select value={role.type}
              onChange={e => updateRole(role.id, 'type', e.target.value)}
              className="px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none"
              style={{ background: role.type === 'external' ? '#16982B' : '#2A52BE', color: 'white' }}>
              <option value="internal">內部角色</option>
              <option value="external">外部角色</option>
            </select>
            <button onClick={() => removeRole(role.id)} disabled={data.roles.length <= 2}
              className="text-red-400 hover:text-red-600 disabled:opacity-20 disabled:cursor-not-allowed text-lg leading-none">✕</button>
          </div>
        ))}
      </div>

      <button onClick={addRole}
        className="mt-4 w-full py-2 text-sm border border-dashed border-blue-400 text-blue-600 rounded-lg hover:bg-blue-50 transition-colors">
        + 新增角色
      </button>

      {/* Lane preview */}
      <div className="mt-4 p-3 bg-gray-50 border border-gray-200 rounded-lg">
        <div className="text-xs font-semibold text-gray-600 mb-2">泳道預覽（由上到下）：</div>
        <div className="flex flex-col gap-1">
          {data.roles.filter(r => r.name).map((r, i) => (
            <div key={r.id} className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-sm" style={{ background: r.type === 'external' ? '#16982B' : '#2A52BE' }} />
              <span className="text-xs font-medium text-gray-700">泳道 {i + 1}：{r.name}</span>
              <span className="text-xs text-gray-400">（{r.type === 'external' ? '外部' : '內部'}）</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Step 3 sub-components ────────────────────────────────────────
function ConnectionSection({ task, allTasks, displayLabels, onUpdate }) {
  const ct = task.connectionType || 'sequence';
  const opts = allTasks.filter(t => t.id !== task.id && t.roleId);
  const sel = 'flex-1 min-w-0 px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-400';
  const inp = 'flex-1 min-w-0 px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-400';
  const lbl = 'text-xs text-gray-500 w-16 flex-shrink-0';

  function renderOpts() {
    return opts.map(t => <option key={t.id} value={t.id}>{taskOptionLabel(t, displayLabels)}</option>);
  }
  function updCond(idx, field, val) {
    const updated = [...(task.conditions || [])];
    updated[idx] = { ...updated[idx], [field]: val };
    onUpdate({ ...task, conditions: updated });
  }
  function remCond(idx) {
    onUpdate({ ...task, conditions: task.conditions.filter((_, i) => i !== idx) });
  }
  function addCond(label = '') {
    onUpdate({ ...task, conditions: [...(task.conditions || []), makeCondition(label)] });
  }

  if (ct === 'sequence' || ct === 'start') {
    return (
      <div className="flex items-center gap-2 mt-1.5">
        <span className={lbl}>{ct === 'start' ? '流程開始 →' : '下一步 →'}</span>
        <select value={task.nextTaskIds?.[0] || ''} className={sel}
          onChange={e => onUpdate({ ...task, nextTaskIds: [e.target.value] })}>
          <option value="">選擇目標任務</option>{renderOpts()}
        </select>
      </div>
    );
  }

  if (ct === 'subprocess') {
    return (
      <div className="flex flex-col gap-1.5 mt-1.5">
        <div className="flex items-center gap-2">
          <span className={lbl}>子流程名稱</span>
          <input className={inp} value={task.subprocessName || ''} placeholder="例：1.2.3 訂單確認"
            onChange={e => onUpdate({ ...task, subprocessName: e.target.value })} />
        </div>
        <div className="flex items-center gap-2">
          <span className={lbl}>返回後 →</span>
          <select value={task.nextTaskIds?.[0] || ''} className={sel}
            onChange={e => onUpdate({ ...task, nextTaskIds: [e.target.value] })}>
            <option value="">選擇目標任務</option>{renderOpts()}
          </select>
        </div>
      </div>
    );
  }

  if (ct === 'conditional-branch') {
    const conds = task.conditions || [];
    return (
      <div className="mt-1.5">
        {conds.map((cond, idx) => (
          <div key={cond.id} className="flex items-center gap-2 mt-1">
            <span className="text-xs text-yellow-600 flex-shrink-0">◇</span>
            <input className="w-20 flex-shrink-0 px-2 py-1 border border-yellow-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-yellow-400"
              value={cond.label} placeholder="條件標籤"
              onChange={e => updCond(idx, 'label', e.target.value)} />
            <span className="text-xs text-gray-400 flex-shrink-0">→</span>
            <select value={cond.nextTaskId} className={sel}
              onChange={e => updCond(idx, 'nextTaskId', e.target.value)}>
              <option value="">選擇目標任務</option>{renderOpts()}
            </select>
            <button onClick={() => remCond(idx)} disabled={conds.length <= 1}
              className="text-red-400 hover:text-red-600 text-xs flex-shrink-0 disabled:opacity-20">✕</button>
          </div>
        ))}
        <button onClick={() => addCond()} className="mt-1.5 text-xs text-yellow-700 hover:text-yellow-900">
          + 新增條件分支
        </button>
      </div>
    );
  }

  if (ct === 'parallel-branch') {
    const conds = task.conditions || [];
    return (
      <div className="mt-1.5">
        {conds.map((cond, idx) => (
          <div key={cond.id} className="flex items-center gap-2 mt-1">
            <span className="text-xs text-green-600 flex-shrink-0">+{idx + 1}</span>
            <select value={cond.nextTaskId} className={sel}
              onChange={e => updCond(idx, 'nextTaskId', e.target.value)}>
              <option value="">選擇並行目標</option>{renderOpts()}
            </select>
            <button onClick={() => remCond(idx)} disabled={conds.length <= 1}
              className="text-red-400 hover:text-red-600 text-xs flex-shrink-0 disabled:opacity-20">✕</button>
          </div>
        ))}
        <button onClick={() => addCond('')} className="mt-1.5 text-xs text-green-700 hover:text-green-900">
          + 新增並行目標
        </button>
      </div>
    );
  }

  if (ct === 'parallel-merge' || ct === 'conditional-merge') {
    const mergeType = ct === 'parallel-merge' ? '並行' : '條件';
    const c0 = task.conditions?.[0];
    return (
      <div className="mt-1.5">
        <div className="flex items-center gap-2">
          <span className={lbl}>合併後 →</span>
          <select value={c0?.nextTaskId || ''} className={sel}
            onChange={e => onUpdate({ ...task, conditions: [{ id: c0?.id || generateId(), label: '', nextTaskId: e.target.value }] })}>
            <option value="">選擇目標任務</option>{renderOpts()}
          </select>
        </div>
        <p className="text-xs text-gray-400 mt-1 pl-1">ℹ 驗證時將確認有多個{mergeType}來源指向此元件</p>
      </div>
    );
  }

  if (ct === 'loop-return') {
    const conds = task.conditions?.length >= 2 ? task.conditions : [
      { id: generateId(), label: '若未通過', nextTaskId: '' },
      { id: generateId(), label: '若通過',   nextTaskId: '' },
    ];
    return (
      <div className="flex flex-col gap-1.5 mt-1.5">
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 flex-shrink-0">條件判斷說明</span>
          <input className={inp} value={task.loopDescription || ''}
            placeholder="說明判斷條件（選填）"
            onChange={e => onUpdate({ ...task, loopDescription: e.target.value })} />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-red-500 w-16 flex-shrink-0">若未通過 ↺</span>
          <select value={conds[0]?.nextTaskId || ''} className={sel}
            onChange={e => {
              const updated = [...conds];
              updated[0] = { ...updated[0], nextTaskId: e.target.value };
              onUpdate({ ...task, conditions: updated });
            }}>
            <option value="">選擇返回目標</option>{renderOpts()}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-green-600 w-16 flex-shrink-0">若通過 →</span>
          <select value={conds[1]?.nextTaskId || ''} className={sel}
            onChange={e => {
              const updated = [...conds];
              updated[1] = { ...updated[1], nextTaskId: e.target.value };
              onUpdate({ ...task, conditions: updated });
            }}>
            <option value="">選擇繼續目標</option>{renderOpts()}
          </select>
        </div>
      </div>
    );
  }

  if (ct === 'breakpoint') {
    return (
      <div className="flex items-center gap-2 mt-1.5">
        <span className={lbl}>斷點說明</span>
        <input className={inp} value={task.breakpointReason || ''}
          placeholder="說明斷點原因（選填）"
          onChange={e => onUpdate({ ...task, breakpointReason: e.target.value })} />
      </div>
    );
  }

  return null; // 'end'
}

function TaskRow({ task, roles, allTasks, displayLabels, onUpdate, onRemove, canRemove, dragHandlers, isDragging, isOver }) {
  const ct = task.connectionType || 'sequence';
  const badge = CONN_BADGE[ct];
  const num = displayLabels[task.id];
  const rowBg = CONN_ROW_BG[ct] || '#FAFAFA';
  const nameOptional = ct === 'start' || ct === 'end' || ct === 'breakpoint';
  const showShape = ct === 'sequence' || ct === 'subprocess';

  return (
    <div
      {...dragHandlers}
      className={`rounded-lg border overflow-hidden transition-all select-none
        ${isDragging ? 'opacity-40 scale-95' : ''}
        ${isOver ? 'border-t-2 border-blue-400' : 'border-gray-200'}`}
      style={{ background: rowBg }}>

      {/* Main row */}
      <div className="flex items-center gap-2 p-2 min-w-0">
        <DragHandle />

        {/* Badge / L4 number */}
        <div className="w-14 flex-shrink-0 flex items-center">
          {ct === 'sequence' && num ? (
            <span className="text-xs font-mono text-gray-500 font-semibold">{num}</span>
          ) : (
            <span className="px-1.5 py-0.5 rounded text-xs font-bold whitespace-nowrap"
              style={{ background: badge.bg, color: badge.text }}>
              {badge.label || num}
            </span>
          )}
        </div>

        {/* Role */}
        <select value={task.roleId} onChange={e => onUpdate({ ...task, roleId: e.target.value })}
          className="w-24 flex-shrink-0 px-2 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-400">
          <option value="">角色 *</option>
          {roles.filter(r => r.name).map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>

        {/* Name */}
        <input type="text" placeholder={nameOptional ? '名稱（選填）' : '任務名稱 *'}
          value={task.name} onChange={e => onUpdate({ ...task, name: e.target.value })}
          className="flex-1 min-w-0 px-2 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-400" />

        {/* Connection type */}
        <select value={ct} onChange={e => onUpdate(applyConnectionType(task, e.target.value))}
          className="w-28 flex-shrink-0 px-2 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-400">
          {CONNECTION_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>

        {/* Shape type (only for sequence/subprocess) */}
        {showShape ? (
          <select value={task.shapeType || 'task'}
            onChange={e => {
              const st = e.target.value;
              onUpdate({ ...task, shapeType: st, type: st });
            }}
            className="w-24 flex-shrink-0 px-2 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-400">
            {SHAPE_TYPES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        ) : <div className="w-24 flex-shrink-0" />}

        {/* Remove */}
        <button onClick={onRemove} disabled={!canRemove}
          className="w-6 flex-shrink-0 text-red-400 hover:text-red-600 disabled:opacity-20 disabled:cursor-not-allowed text-sm">✕</button>
      </div>

      {/* Connection config section */}
      <div className="px-3 pb-2.5">
        <ConnectionSection task={task} allTasks={allTasks} displayLabels={displayLabels} onUpdate={onUpdate} />
      </div>
    </div>
  );
}

// ── Step 3: Tasks (with drag-and-drop) ───────────────────────────
function Step3({ data, onChange }) {
  const displayLabels = useMemo(
    () => computeDisplayLabels(data.tasks, data.l3Number),
    [data.tasks, data.l3Number]
  );

  const { dragIdx, overIdx, rowProps } = useDragReorder(
    data.tasks,
    newTasks => {
      // After drag reorder:
      // - Tasks with an explicit next (nextTaskIds[0] is set) keep their setting.
      // - Tasks with no next set get auto-filled with the new sequential next.
      // - Gateway and end tasks are always left unchanged.
      const updated = applySequentialDefaults(newTasks);
      onChange({ tasks: updated });
    }
  );

  function addTask() {
    const newTask = makeTask();
    // applySequentialDefaults will auto-fill any previously-last task that had no next set
    onChange({ tasks: applySequentialDefaults([...data.tasks, newTask]) });
  }

  function updateTask(id, updated) {
    onChange({ tasks: data.tasks.map(t => t.id === id ? updated : t) });
  }

  function removeTask(id) {
    if (data.tasks.length <= 1) return;
    onChange({ tasks: data.tasks.filter(t => t.id !== id) });
  }

  const hasStart = data.tasks.some(t => (t.connectionType === 'start' || t.type === 'start') && t.roleId);
  const hasEnd   = data.tasks.some(t => (t.connectionType === 'end' || t.connectionType === 'breakpoint' || t.type === 'end') && t.roleId);

  return (
    <div className="w-full max-w-5xl mx-auto">
      <h2 className="text-xl font-bold text-gray-800 mb-1">L4 任務輸入</h2>
      <p className="text-sm text-gray-500 mb-1">依序填入每個步驟，可拖曳左側圓點調整順序</p>
      <p className="text-xs text-gray-400 mb-4">
        使用「流程設定」欄位選擇 BPMN 連接方式，系統會自動套用對應圖形與連線邏輯
      </p>

      {/* Status badges */}
      <div className="flex gap-2 mb-3">
        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${hasStart ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
          {hasStart ? '✓ 已設定開始事件' : '✗ 缺少開始事件'}
        </span>
        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${hasEnd ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
          {hasEnd ? '✓ 已設定結束事件' : '✗ 缺少結束事件'}
        </span>
      </div>

      {/* Column headers */}
      <div className="flex items-center gap-2 px-2 mb-1.5 text-xs font-semibold text-gray-400">
        <span className="w-5 flex-shrink-0" />
        <span className="w-14 flex-shrink-0">編號</span>
        <span className="w-24 flex-shrink-0">角色 *</span>
        <span className="flex-1">元件名稱</span>
        <span className="w-28 flex-shrink-0">流程設定</span>
        <span className="w-24 flex-shrink-0">圖形樣式</span>
        <span className="w-6 flex-shrink-0" />
      </div>

      <div className="flex flex-col gap-2">
        {data.tasks.map((task, i) => (
          <TaskRow
            key={task.id}
            task={task}
            rowIndex={i}
            roles={data.roles}
            allTasks={data.tasks}
            displayLabels={displayLabels}
            onUpdate={updated => updateTask(task.id, updated)}
            onRemove={() => removeTask(task.id)}
            canRemove={data.tasks.length > 1}
            dragHandlers={rowProps(i)}
            isDragging={dragIdx === i}
            isOver={overIdx === i && dragIdx !== i}
          />
        ))}
      </div>

      <button onClick={addTask}
        className="mt-4 w-full py-2 text-sm border border-dashed border-blue-400 text-blue-600 rounded-lg hover:bg-blue-50 transition-colors">
        + 新增任務欄位
      </button>

      <div className="mt-4 p-3 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-500">
        <strong>流程設定說明：</strong>
        序列流向＝單一下一步；條件分支＝XOR 閘道，依條件分流；並行分支＝AND 閘道，同時啟動多個路徑；
        並行合併／條件合併＝多路徑收束，驗證時會確認有足夠來源；迴圈返回＝通過則繼續、未通過則返回；
        子流程調用＝調用子流程後返回繼續；流程斷點＝非完整流程的截止點（下一步選填）。
        空白欄位（無角色）在產生圖表時自動忽略。
      </div>
    </div>
  );
}

// ── Step 4: Preview ──────────────────────────────────────────────
function Step4({ data }) {
  const cleanedFlow = useMemo(() => {
    const validRoles = data.roles.filter(r => r.name.trim());
    const validRoleIds = new Set(validRoles.map(r => r.id));

    const validTasks = data.tasks.filter(t => {
      if (!t.roleId || !validRoleIds.has(t.roleId)) return false;
      const ct2 = t.connectionType || (t.type === 'start' ? 'start' : t.type === 'end' ? 'end' : 'sequence');
      if (ct2 === 'start' || ct2 === 'end' || ct2 === 'breakpoint') return true;
      return t.name.trim();
    });
    const validTaskIds = new Set(validTasks.map(t => t.id));

    const tasks = validTasks.map(t => ({
      ...t,
      nextTaskIds: (t.nextTaskIds || []).filter(id => id && validTaskIds.has(id)),
      conditions: (t.conditions || []).filter(c => {
        const ct3 = t.connectionType;
        const needLabel = ct3 === 'conditional-branch';
        return (needLabel ? c.label.trim() : true) && c.nextTaskId && validTaskIds.has(c.nextTaskId);
      }),
    }));

    return { ...data, roles: validRoles, tasks };
  }, [data]);

  if (!cleanedFlow.roles.length || !cleanedFlow.tasks.length) {
    return (
      <div className="text-center py-12 text-gray-400">
        資料不完整，請返回確認每個任務都已設定角色
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-xl font-bold text-gray-800 mb-1">流程圖預覽</h2>
      <p className="text-sm text-gray-500 mb-4">確認圖表後點選「儲存」完成建立</p>
      <DiagramRenderer flow={cleanedFlow} showExport={true} />
    </div>
  );
}

// ── Validation ───────────────────────────────────────────────────
function validate(step, data) {
  if (step === 0) {
    if (!data.l3Number.trim()) return 'L3 活動編號為必填';
    if (!/^\d+(\.\d+)*$/.test(data.l3Number.trim())) return 'L3 編號格式錯誤（範例：1.1.1）';
    if (!data.l3Name.trim()) return 'L3 活動名稱為必填';
    return null;
  }

  if (step === 1) {
    if (data.roles.filter(r => r.name.trim()).length < 2) return '至少需要 2 個有名稱的角色';
    return null;
  }

  if (step === 2) {
    const validRoleIds = new Set(data.roles.filter(r => r.name.trim()).map(r => r.id));
    const active = data.tasks.filter(t => {
      if (!t.roleId || !validRoleIds.has(t.roleId)) return false;
      const ct = t.connectionType || 'sequence';
      if (ct === 'start' || ct === 'end' || ct === 'breakpoint') return true;
      return t.name.trim();
    });
    const validTaskIds = new Set(active.map(t => t.id));

    // ── 1. 必須有開始和結束 ──────────────────────────────────────
    if (!active.some(t => t.connectionType === 'start' || t.type === 'start'))
      return '必須設定至少一個「流程開始」並為其選擇角色';
    if (!active.some(t => ['end','breakpoint'].includes(t.connectionType) || t.type === 'end'))
      return '必須設定至少一個「流程結束」或「流程斷點」並為其選擇角色';

    // ── 2. 各連接類型的必填欄位 ─────────────────────────────────
    for (const t of active) {
      const ct = t.connectionType || 'sequence';
      const n = t.name || '（未命名）';
      if (ct !== 'start' && ct !== 'end' && ct !== 'breakpoint' && !t.name.trim())
        return '有元件缺少名稱，請填入或移除該欄位';

      if (ct === 'sequence' || ct === 'start') {
        if (!(t.nextTaskIds || []).some(id => id && validTaskIds.has(id)))
          return `「${n}」的下一步尚未設定`;
      } else if (ct === 'subprocess') {
        if (!t.subprocessName?.trim()) return `「${n}」的子流程名稱為必填`;
        if (!(t.nextTaskIds || []).some(id => id && validTaskIds.has(id)))
          return `「${n}」的返回後下一步尚未設定`;
      } else if (ct === 'conditional-branch') {
        if (!t.conditions?.length) return `「${n}」必須至少設定一個條件分支`;
        for (const c of t.conditions) {
          if (!c.label.trim()) return `「${n}」有條件缺少標籤`;
          if (!c.nextTaskId || !validTaskIds.has(c.nextTaskId)) return `「${n}」有條件未選擇目標任務`;
        }
      } else if (ct === 'parallel-branch') {
        if (!t.conditions?.length) return `「${n}」必須至少設定一個並行目標`;
        for (const c of t.conditions) {
          if (!c.nextTaskId || !validTaskIds.has(c.nextTaskId)) return `「${n}」有並行目標未選擇`;
        }
      } else if (ct === 'parallel-merge' || ct === 'conditional-merge') {
        const c0 = t.conditions?.[0];
        if (!c0?.nextTaskId || !validTaskIds.has(c0.nextTaskId))
          return `「${n}」的合併後下一步尚未設定`;
      } else if (ct === 'loop-return') {
        const c0 = t.conditions?.[0], c1 = t.conditions?.[1];
        if (!c0?.nextTaskId || !validTaskIds.has(c0.nextTaskId)) return `「${n}」的「若未通過」目標未設定`;
        if (!c1?.nextTaskId || !validTaskIds.has(c1.nextTaskId)) return `「${n}」的「若通過」目標未設定`;
      }
    }

    // ── 3. 並行合併 / 條件合併：驗證有多個來源 ──────────────────
    const incomingCount = {};
    const condIncoming = {};
    active.forEach(t => {
      const ct = t.connectionType || 'sequence';
      const outs = ['conditional-branch','parallel-branch','parallel-merge','conditional-merge','loop-return'].includes(ct)
        ? (t.conditions || []).map(c => c.nextTaskId).filter(Boolean)
        : (t.nextTaskIds || []).filter(Boolean);
      outs.forEach(id => {
        if (validTaskIds.has(id)) {
          incomingCount[id] = (incomingCount[id] || 0) + 1;
          if (ct === 'conditional-branch') condIncoming[id] = (condIncoming[id] || 0) + 1;
        }
      });
    });
    for (const t of active) {
      const ct = t.connectionType || 'sequence';
      const n = t.name || '（未命名）';
      if (ct === 'parallel-merge') {
        const cnt = incomingCount[t.id] || 0;
        if (cnt < 2) return `「${n}」設定為並行合併，但目前只有 ${cnt} 個來源指向它（需 2 個以上）`;
      }
      if (ct === 'conditional-merge') {
        const cnt = condIncoming[t.id] || 0;
        if (cnt < 2) return `「${n}」設定為條件合併，但只有 ${cnt} 個條件分支指向它（需 2 個以上）`;
      }
    }

    // ── 4. 每個非開始元件必須被至少一個元件指向 ─────────────────
    const incomingSet = new Set(Object.keys(incomingCount));
    for (const t of active) {
      const ct = t.connectionType || 'sequence';
      if (ct === 'start') continue;
      if (!incomingSet.has(t.id)) {
        const n = t.name?.trim() || `（${ct === 'end' || ct === 'breakpoint' ? '結束' : '元件'}）`;
        return `「${n}」沒有任何元件指向它，請確認流程連接完整`;
      }
    }

    return null;
  }

  return null;
}

// ── Main Wizard ──────────────────────────────────────────────────
const STEPS = ['L3 活動資訊', '泳道角色', 'L4 任務', '圖表預覽'];

export default function Wizard({ flow, onSave, onCancel }) {
  const [step, setStep] = useState(0);
  const [data, setData] = useState(() => initFormData(flow));
  const [error, setError] = useState('');

  function update(fields) { setData(prev => ({ ...prev, ...fields })); setError(''); }

  function next() {
    const err = validate(step, data);
    if (err) { setError(err); return; }
    setError('');
    setStep(s => s + 1);
  }

  function back() { setError(''); setStep(s => s - 1); }

  function handleSave() {
    const err = validate(step, data);
    if (err) { setError(err); return; }
    onSave(data);
  }

  return (
    <div className="min-h-screen" style={{ background: '#F3F4F6' }}>
      <header className="px-6 py-3 shadow-md flex items-center gap-4" style={{ background: '#4A5240', color: 'white' }}>
        <button onClick={onCancel} className="opacity-70 hover:opacity-100 text-sm">← 返回</button>
        <span className="text-lg font-bold tracking-wide">{flow ? '編輯 L3 活動' : '新增 L3 活動'}</span>
      </header>

      <main className={`mx-auto py-8 w-full ${step <= 1 ? 'max-w-3xl px-6' : step === 2 ? 'max-w-5xl px-4' : 'px-4'}`}>
        <StepIndicator current={step} steps={STEPS} />

        <div className={`bg-white rounded-xl border border-gray-200 shadow-sm min-h-64 overflow-x-auto ${step === 3 ? 'p-4' : 'p-6'}`}>
          {step === 0 && <Step1 data={data} onChange={update} />}
          {step === 1 && <Step2 data={data} onChange={update} />}
          {step === 2 && <Step3 data={data} onChange={update} />}
          {step === 3 && <Step4 data={data} />}
        </div>

        {error && (
          <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
            ⚠ {error}
          </div>
        )}

        <div className="flex items-center justify-between mt-5">
          <button onClick={back} disabled={step === 0}
            className="px-5 py-2 rounded-lg border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
            ← 上一步
          </button>
          <div className="flex gap-3">
            <button onClick={onCancel}
              className="px-5 py-2 rounded-lg border border-gray-300 text-gray-500 text-sm hover:bg-gray-50 transition-colors">
              取消
            </button>
            {step < STEPS.length - 1 ? (
              <button onClick={next}
                className="px-6 py-2 rounded-lg text-white text-sm font-medium transition-colors"
                style={{ background: '#2A52BE' }}
                onMouseEnter={e => e.currentTarget.style.background = '#1a3a9e'}
                onMouseLeave={e => e.currentTarget.style.background = '#2A52BE'}>
                下一步 →
              </button>
            ) : (
              <button onClick={handleSave}
                className="px-6 py-2 rounded-lg text-white text-sm font-bold transition-colors"
                style={{ background: '#16982B' }}
                onMouseEnter={e => e.currentTarget.style.background = '#0f7222'}
                onMouseLeave={e => e.currentTarget.style.background = '#16982B'}>
                ✓ 儲存流程
              </button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

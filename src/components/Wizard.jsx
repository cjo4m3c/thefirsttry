import { useState, useMemo } from 'react';
import { generateId } from '../utils/storage.js';
import DiagramRenderer from './DiagramRenderer.jsx';

// ── Constants ────────────────────────────────────────────────────
const TASK_TYPES = [
  { value: 'task',        label: 'L4 任務' },
  { value: 'start',       label: '開始事件' },
  { value: 'end',         label: '結束事件' },
  { value: 'interaction', label: '互動（外部關係人）' },
  { value: 'gateway',     label: '判斷框' },
  { value: 'l3activity',  label: 'L3 活動（關聯）' },
];

const TYPE_BADGE = {
  start:       { label: '開始', bg: '#D1FAE5', text: '#065F46' },
  end:         { label: '結束', bg: '#FEE2E2', text: '#991B1B' },
  gateway:     { label: '判斷', bg: '#FEF3C7', text: '#92400E' },
  interaction: { label: '互動', bg: '#E5E7EB', text: '#374151' },
  l3activity:  { label: 'L3', bg: '#EFF6FF', text: '#1D4ED8' },
};

// ── Factories ────────────────────────────────────────────────────
function makeRole() {
  return { id: generateId(), name: '', type: 'internal' };
}

function makeTask(overrides = {}) {
  return { id: generateId(), roleId: '', name: '', type: 'task', gatewayType: 'xor', conditions: [], nextTaskIds: [], ...overrides };
}

function makeCondition() {
  return { id: generateId(), label: '', nextTaskId: '' };
}

/**
 * Ensure every non-end/non-gateway task has at least one nextTaskIds slot,
 * pre-filling with the sequential next task if currently empty.
 * Tasks that already have an explicit (non-empty) nextTaskIds[0] are left unchanged.
 */
function applySequentialDefaults(tasks) {
  return tasks.map((t, i) => {
    if (t.type === 'end' || t.type === 'gateway') return t;
    const hasExplicitNext = t.nextTaskIds?.length && t.nextTaskIds[0];
    if (hasExplicitNext) return t;
    return { ...t, nextTaskIds: tasks[i + 1] ? [tasks[i + 1].id] : [] };
  });
}

function initFormData(flow) {
  if (flow) {
    // Step 1: migrate legacy nextTaskId string → nextTaskIds[]
    const migrated = (flow.tasks || []).map(t => {
      if (t.nextTaskIds?.length) return t;
      const ids = t.nextTaskId ? [t.nextTaskId] : [];
      return { ...t, nextTaskIds: ids };
    });
    // Step 2: auto-fill empty nextTaskIds with sequential next
    const tasks = applySequentialDefaults(migrated);
    return { ...flow, tasks };
  }

  // New flow: 8 default slots, first is start event
  const tasks = Array.from({ length: 8 }, (_, i) =>
    makeTask({ type: i === 0 ? 'start' : 'task' })
  );
  // Set sequential nextTaskIds defaults
  tasks.forEach((t, i) => { t.nextTaskIds = tasks[i + 1] ? [tasks[i + 1].id] : []; });

  return {
    id: generateId(),
    l3Number: '',
    l3Name: '',
    roles: [makeRole(), makeRole()],
    tasks,
  };
}

// ── Helpers ──────────────────────────────────────────────────────
// Returns display label/number for each task (used in dropdowns and row labels)
function computeDisplayLabels(tasks, l3Number) {
  const labels = {};
  let counter = 1;
  tasks.forEach(task => {
    if (task.type === 'task') {
      labels[task.id] = `${l3Number || '?'}.${counter++}`;
    } else {
      labels[task.id] = TYPE_BADGE[task.type]?.label || task.type;
    }
  });
  return labels;
}

function taskOptionLabel(task, displayLabels) {
  const lbl = displayLabels[task.id] ?? '';
  const name = task.name.trim();
  if (task.type === 'start') return `【開始】${name ? ' ' + name : ''}`;
  if (task.type === 'end')   return `【結束】${name ? ' ' + name : ''}`;
  if (task.type === 'gateway') {
    const gLabel = task.gatewayType === 'and' ? '並行' : task.gatewayType === 'or' ? '包容' : '排他';
    return `◇ ${gLabel}閘道：${name || '（未命名）'}`;
  }
  if (task.type === 'interaction') return `□ 互動：${name || '（未命名）'}`;
  if (task.type === 'l3activity')  return `⊞ L3活動：${name || '（未命名）'}`;
  return `${lbl}${name ? ' ' + name : ' （未命名）'}`;
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
function ConditionRow({ cond, currentTaskId, allTasks, displayLabels, onUpdate, onRemove }) {
  const options = allTasks.filter(t => t.id !== currentTaskId && t.roleId);
  return (
    <div className="flex items-center gap-2 mt-1.5 pl-2">
      <span className="text-xs text-yellow-600">→</span>
      <input type="text" placeholder="條件標籤（如：是、否）" value={cond.label}
        onChange={e => onUpdate({ ...cond, label: e.target.value })}
        className="w-24 px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-400" />
      <span className="text-xs text-gray-400">前往</span>
      <select value={cond.nextTaskId}
        onChange={e => onUpdate({ ...cond, nextTaskId: e.target.value })}
        className="flex-1 px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-400">
        <option value="">選擇目標任務</option>
        {options.map(t => (
          <option key={t.id} value={t.id}>{taskOptionLabel(t, displayLabels)}</option>
        ))}
      </select>
      <button onClick={onRemove} className="text-red-400 hover:text-red-600 text-sm flex-shrink-0">✕</button>
    </div>
  );
}

function TaskRow({ task, rowIndex, roles, allTasks, displayLabels, onUpdate, onRemove, canRemove, dragHandlers, isDragging, isOver }) {
  const isGateway = task.type === 'gateway';
  const isEnd = task.type === 'end';
  const isStart = task.type === 'start';
  const nameOptional = isStart || isEnd;
  const showNextTask = !isGateway && !isEnd;
  const badge = TYPE_BADGE[task.type];
  const displayLabel = displayLabels[task.id];
  const validRoleIds = new Set(roles.filter(r => r.name).map(r => r.id));

  function handleTypeChange(newType) {
    const updates = { type: newType };
    if (newType !== 'gateway') updates.conditions = [];
    if (newType === 'gateway' && !task.gatewayType) updates.gatewayType = 'xor';
    if (newType === 'end') updates.nextTaskIds = [];
    onUpdate({ ...task, ...updates });
  }

  function addCondition() {
    onUpdate({ ...task, conditions: [...(task.conditions || []), makeCondition()] });
  }

  function updateNextId(idx, val) {
    const updated = [...(task.nextTaskIds || [])];
    updated[idx] = val;
    onUpdate({ ...task, nextTaskIds: updated });
  }

  function removeNextId(idx) {
    onUpdate({ ...task, nextTaskIds: (task.nextTaskIds || []).filter((_, i) => i !== idx) });
  }

  function addParallelNext() {
    onUpdate({ ...task, nextTaskIds: [...(task.nextTaskIds || []), ''] });
  }

  // Available tasks for "next task" dropdown (exclude self, include all with roleId)
  const nextOptions = allTasks.filter(t => t.id !== task.id && t.roleId && validRoleIds.has(t.roleId));

  return (
    <div
      {...dragHandlers}
      className={`rounded-lg border overflow-hidden transition-all select-none
        ${isDragging ? 'opacity-40 scale-95' : ''}
        ${isOver ? 'border-t-2 border-blue-400' : 'border-gray-200'}`}
      style={{ background: isGateway ? '#FFFBEB' : isStart ? '#F0FDF4' : isEnd ? '#FFF1F2' : '#FAFAFA' }}>

      {/* Main row */}
      <div className="flex items-center gap-2 p-2 min-w-0">
        <DragHandle />

        {/* Left label: L4 number or type badge */}
        <div className="w-16 flex-shrink-0 flex items-center">
          {badge ? (
            <span className="px-1.5 py-0.5 rounded text-xs font-bold"
              style={{ background: badge.bg, color: badge.text }}>
              {badge.label}
            </span>
          ) : (
            <span className="text-xs font-mono text-gray-500 font-semibold">{displayLabel}</span>
          )}
        </div>

        {/* Role dropdown */}
        <select value={task.roleId}
          onChange={e => onUpdate({ ...task, roleId: e.target.value })}
          className="w-28 flex-shrink-0 px-2 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-400">
          <option value="">選擇角色 *</option>
          {roles.filter(r => r.name).map(r => (
            <option key={r.id} value={r.id}>{r.name}</option>
          ))}
        </select>

        {/* Task name */}
        <input type="text"
          placeholder={nameOptional ? '事件名稱（選填）' : '任務名稱 *'}
          value={task.name}
          onChange={e => onUpdate({ ...task, name: e.target.value })}
          className="flex-1 min-w-0 px-2 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-400" />

        {/* Type dropdown */}
        <select value={task.type}
          onChange={e => handleTypeChange(e.target.value)}
          className="w-28 flex-shrink-0 px-2 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-400">
          {TASK_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>

        {/* Next task — always show ≥1 slot; extra slots = parallel targets */}
        {showNextTask ? (
          <div className="w-40 flex-shrink-0 flex flex-col gap-1">
            {/* Always show at least one slot, even when nextTaskIds is empty */}
            {(task.nextTaskIds?.length ? task.nextTaskIds : ['']).map((nid, idx) => (
              <div key={idx} className="flex items-center gap-1">
                <select value={nid}
                  onChange={e => updateNextId(idx, e.target.value)}
                  className="flex-1 min-w-0 px-1.5 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-400">
                  <option value="">{idx === 0 ? '→ 下一步' : `→ 並行 ${idx + 1}`}</option>
                  {nextOptions.map(t => (
                    <option key={t.id} value={t.id}>{taskOptionLabel(t, displayLabels)}</option>
                  ))}
                </select>
                {idx > 0 && (
                  <button onClick={() => removeNextId(idx)}
                    className="text-red-400 hover:text-red-600 text-xs flex-shrink-0">✕</button>
                )}
              </div>
            ))}
            <button onClick={addParallelNext}
              className="text-left text-xs text-blue-500 hover:text-blue-700 leading-none">
              + 新增並行任務
            </button>
          </div>
        ) : (
          <div className="w-40 flex-shrink-0" />
        )}

        {/* Remove */}
        <button onClick={onRemove} disabled={!canRemove}
          className="w-6 flex-shrink-0 text-red-400 hover:text-red-600 disabled:opacity-20 disabled:cursor-not-allowed text-sm">✕</button>
      </div>

      {/* Gateway conditions */}
      {isGateway && (
        <div className="px-3 pb-3 bg-yellow-50 border-t border-yellow-100">
          <div className="flex items-center gap-3 mt-2 mb-2">
            <span className="text-xs font-semibold text-yellow-700">閘道類型：</span>
            <select value={task.gatewayType || 'xor'}
              onChange={e => onUpdate({ ...task, gatewayType: e.target.value })}
              className="px-2 py-1 border border-yellow-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-yellow-400 bg-white">
              <option value="xor">排他閘道 (XOR) — 擇一分支</option>
              <option value="and">並行閘道 (AND) — 同時分支</option>
              <option value="or">包容閘道 (OR) — 條件包容</option>
            </select>
          </div>
          <div className="text-xs font-semibold text-yellow-700 mb-1">
            {(task.gatewayType || 'xor') === 'and' ? '並行分支目標：' : '網關條件：'}
          </div>
          {(task.conditions || []).map(cond => (
            <ConditionRow key={cond.id} cond={cond} currentTaskId={task.id}
              allTasks={allTasks} displayLabels={displayLabels}
              onUpdate={updated => onUpdate({ ...task, conditions: task.conditions.map(c => c.id === cond.id ? updated : c) })}
              onRemove={() => onUpdate({ ...task, conditions: task.conditions.filter(c => c.id !== cond.id) })} />
          ))}
          <button onClick={addCondition}
            className="mt-2 px-3 py-1 text-xs border border-dashed border-yellow-400 text-yellow-700 rounded hover:bg-yellow-100 transition-colors">
            + {(task.gatewayType || 'xor') === 'and' ? '新增並行目標' : '新增條件'}
          </button>
          {!(task.conditions?.length) && (
            <p className="text-xs text-yellow-600 mt-1 opacity-70">請至少加入一個目標/條件，否則流程無法繼續</p>
          )}
        </div>
      )}
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

  const hasStart = data.tasks.some(t => t.type === 'start' && t.roleId);
  const hasEnd   = data.tasks.some(t => t.type === 'end'   && t.roleId);

  return (
    <div className="w-full max-w-5xl mx-auto">
      <h2 className="text-xl font-bold text-gray-800 mb-1">L4 任務輸入</h2>
      <p className="text-sm text-gray-500 mb-1">依序填入每個步驟，可拖曳左側圓點調整順序</p>
      <p className="text-xs text-gray-400 mb-4">
        只有「任務」類型才會帶有 L4 編號；開始／結束事件的名稱為選填
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
        <span className="w-16 flex-shrink-0">編號/類型</span>
        <span className="w-28 flex-shrink-0">角色 *</span>
        <span className="flex-1">任務名稱</span>
        <span className="w-28 flex-shrink-0">類型</span>
        <span className="w-40 flex-shrink-0">下一步 →</span>
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
        <strong>提示：</strong>
        「下一步」欄位設定此任務完成後要連接哪個步驟，系統已帶入預設值。
        點選「+ 並行」可新增多個並行的下一步目標，代表後續步驟同時進行。
        判斷框改用「條件」控制分支。
        空白欄位（無角色且無名稱）在產生圖表時自動忽略。
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
      if (t.type === 'start' || t.type === 'end') return true; // name optional
      return t.name.trim();
    });
    const validTaskIds = new Set(validTasks.map(t => t.id));

    const tasks = validTasks.map(t => ({
      ...t,
      nextTaskIds: (t.nextTaskIds || []).filter(id => id && validTaskIds.has(id)),
      conditions: (t.conditions || []).filter(c =>
        c.label.trim() && c.nextTaskId && validTaskIds.has(c.nextTaskId)
      ),
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
      if (t.type === 'start' || t.type === 'end') return true;
      return t.name.trim();
    });
    const validTaskIds = new Set(active.map(t => t.id));

    // ── 1. 必須有開始和結束 ──────────────────────────────────────
    if (!active.some(t => t.type === 'start')) return '必須設定至少一個「開始事件」並為其選擇角色';
    if (!active.some(t => t.type === 'end'))   return '必須設定至少一個「結束事件」並為其選擇角色';

    // ── 2. 名稱與判斷框條件檢查 ─────────────────────────────────
    for (const t of active) {
      if (t.type !== 'start' && t.type !== 'end' && !t.name.trim()) {
        return `有元件缺少名稱，請填入或移除該欄位`;
      }
      if (t.type === 'gateway') {
        const gName = t.name || '（未命名）';
        if (!t.conditions?.length) return `閘道「${gName}」必須至少設定一個條件/分支目標`;
        const isAnd = (t.gatewayType || 'xor') === 'and';
        for (const c of t.conditions) {
          if (!isAnd && !c.label.trim()) return `閘道「${t.name}」有條件缺少標籤（AND 並行閘道不需要標籤）`;
          if (!c.nextTaskId) return `閘道「${t.name}」有條件/分支目標未選擇任務`;
        }
      }
    }

    // ── 3. 出口連接：每個非結束元件必須有至少一個有效下一步 ─────
    for (const t of active) {
      if (t.type === 'end') continue;
      if (t.type === 'gateway') continue; // 已由條件檢查覆蓋
      const validNext = (t.nextTaskIds || []).filter(id => id && validTaskIds.has(id));
      if (!validNext.length) {
        const name = t.name?.trim() || `（${t.type === 'start' ? '開始事件' : '元件'}）`;
        return `「${name}」未設定下一步，請在「下一步 →」欄位選擇連接目標`;
      }
    }

    // ── 4. 入口連接：每個非開始元件必須被至少一個元件指向 ───────
    const incomingSet = new Set();
    active.forEach(t => {
      if (t.type === 'gateway') {
        (t.conditions || []).forEach(c => {
          if (c.nextTaskId && validTaskIds.has(c.nextTaskId)) incomingSet.add(c.nextTaskId);
        });
      } else {
        (t.nextTaskIds || []).forEach(id => {
          if (id && validTaskIds.has(id)) incomingSet.add(id);
        });
      }
    });
    for (const t of active) {
      if (t.type === 'start') continue;
      if (!incomingSet.has(t.id)) {
        const name = t.name?.trim() || `（${t.type === 'end' ? '結束事件' : '元件'}）`;
        return `「${name}」沒有任何元件指向它，請確認流程連接完整`;
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

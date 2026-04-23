import { useState, useMemo } from 'react';
import { generateId } from '../utils/storage.js';
import DiagramRenderer from './DiagramRenderer.jsx';
import ConnectionSection from './ConnectionSection.jsx';
import {
  CONNECTION_TYPES, SHAPE_TYPES, CONN_BADGE, CONN_ROW_BG,
  makeRole, makeTask, makeCondition,
  normalizeTask, applyConnectionType, applySequentialDefaults,
  computeDisplayLabels, taskOptionLabel,
  L3_NUMBER_PATTERN,
} from '../utils/taskDefs.js';

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
    setNumErr(val && !L3_NUMBER_PATTERN.test(val) ? '格式錯誤，範例：1-1-1' : '');
  }

  return (
    <div className="max-w-lg mx-auto">
      <h2 className="text-xl font-bold text-gray-800 mb-1">L3 活動基本資訊</h2>
      <p className="text-sm text-gray-500 mb-6">輸入此活動的名稱與層級編號</p>
      <div className="flex flex-col gap-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">L3 活動編號 <span className="text-red-500">*</span></label>
          <input type="text" placeholder="例：1-1-1" value={data.l3Number}
            onChange={e => handleNumber(e.target.value)}
            className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 ${numErr ? 'border-red-400' : 'border-gray-300'}`} />
          {numErr && <p className="text-xs text-red-500 mt-1">{numErr}</p>}
          <p className="text-xs text-gray-400 mt-1">三層編碼，例：1-1-1、2-3-4（與 Excel 匯入格式一致）</p>
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
            <br /><span className="text-xs opacity-70">L4 任務將從 {data.l3Number}-1 開始編號</span>
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
    if (data.roles.length <= 1) return;
    onChange({ roles: data.roles.filter(r => r.id !== id) });
  }
  function updateRole(id, field, val) {
    onChange({ roles: data.roles.map(r => r.id === id ? { ...r, [field]: val } : r) });
  }

  return (
    <div className="max-w-xl mx-auto">
      <h2 className="text-xl font-bold text-gray-800 mb-1">泳道角色設定</h2>
      <p className="text-sm text-gray-500 mb-2">設定流程中的參與角色（至少 1 個）</p>
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
              style={{ background: role.type === 'external' ? '#009900' : '#0066CC', color: 'white' }}>
              <option value="internal">內部角色</option>
              <option value="external">外部角色</option>
            </select>
            <button onClick={() => removeRole(role.id)} disabled={data.roles.length <= 1}
              className="text-red-400 hover:text-red-600 disabled:opacity-20 disabled:cursor-not-allowed text-lg leading-none">✕</button>
          </div>
        ))}
      </div>

      <button onClick={addRole}
        className="mt-4 w-full py-2 text-sm border border-dashed border-blue-400 text-blue-600 rounded-lg hover:bg-blue-50 transition-colors">
        + 新增角色
      </button>

      <div className="mt-4 p-3 bg-gray-50 border border-gray-200 rounded-lg">
        <div className="text-xs font-semibold text-gray-600 mb-2">泳道預覽（由上到下）：</div>
        <div className="flex flex-col gap-1">
          {data.roles.filter(r => r.name).map((r, i) => (
            <div key={r.id} className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-sm" style={{ background: r.type === 'external' ? '#009900' : '#0066CC' }} />
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
      const updated = applySequentialDefaults(newTasks);
      onChange({ tasks: updated });
    }
  );

  function addTask() {
    const newTask = makeTask();
    onChange({ tasks: applySequentialDefaults([...data.tasks, newTask]) });
  }

  function updateTask(id, updated) {
    onChange({ tasks: data.tasks.map(t => t.id === id ? updated : t) });
  }

  function removeTask(id) {
    if (data.tasks.length <= 1) return;
    onChange({ tasks: data.tasks.filter(t => t.id !== id) });
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold text-gray-800">L4 任務設定</h2>
          <p className="text-sm text-gray-500 mt-0.5">設定流程步驟與連接關係</p>
        </div>
        <button onClick={addTask}
          className="px-4 py-2 text-sm rounded-lg border border-dashed border-blue-400 text-blue-600 hover:bg-blue-50 transition-colors">
          + 新增任務
        </button>
      </div>

      <div className="flex flex-col gap-2">
        {data.tasks.map((task, i) => (
          <TaskRow
            key={task.id}
            task={task}
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
    </div>
  );
}

// ── Step 4: Preview ──────────────────────────────────────────────
function Step4({ data }) {
  return (
    <div>
      <h2 className="text-xl font-bold text-gray-800 mb-1">預覽泳道圖</h2>
      <p className="text-sm text-gray-500 mb-4">確認流程圖是否符合預期，可返回上一步修改</p>
      <DiagramRenderer flow={data} showExport={false} />
    </div>
  );
}

// ── Validation ───────────────────────────────────────────────────
function validate(step, data) {
  const errs = [];
  if (step >= 0) {
    if (!data.l3Number.trim()) errs.push('請填寫 L3 活動編號');
    if (!data.l3Name.trim())   errs.push('請填寫 L3 活動名稱');
    if (!L3_NUMBER_PATTERN.test(data.l3Number.trim())) errs.push('L3 編號格式錯誤（例：1-1-1）');
  }
  if (step >= 1) {
    const namedRoles = data.roles.filter(r => r.name.trim());
    if (namedRoles.length < 1) errs.push('至少需要 1 個已命名的角色');
  }
  if (step >= 2) {
    const tasks = data.tasks;
    const taskMap = Object.fromEntries(tasks.map(t => [t.id, t]));

    tasks.forEach((t, i) => {
      const label = `任務 ${i + 1}`;
      const ct = t.connectionType || 'sequence';
      if (!t.roleId) errs.push(`${label}：請選擇負責角色`);

      if (ct === 'sequence' || ct === 'start') {
        // ok if no next (last task)
      } else if (ct === 'subprocess') {
        if (!t.subprocessName?.trim()) errs.push(`${label}：請填寫子流程名稱`);
      } else if (ct === 'conditional-branch') {
        const conds = t.conditions || [];
        if (conds.length < 2) errs.push(`${label}：條件分支至少需要 2 個條件`);
        conds.forEach((c, ci) => {
          if (!c.label?.trim()) errs.push(`${label} 條件 ${ci + 1}：請填寫條件標籤`);
          if (!c.nextTaskId)    errs.push(`${label} 條件 ${ci + 1}：請選擇目標任務`);
        });
      } else if (ct === 'parallel-branch') {
        const conds = t.conditions || [];
        if (conds.length < 2) errs.push(`${label}：並行分支至少需要 2 個目標`);
        conds.forEach((c, ci) => {
          if (!c.nextTaskId) errs.push(`${label} 並行目標 ${ci + 1}：請選擇目標任務`);
        });
      } else if (ct === 'parallel-merge' || ct === 'conditional-merge') {
        const incomingCount = tasks.filter(other => {
          if (other.id === t.id) return false;
          const oct = other.connectionType || 'sequence';
          if (oct === 'parallel-branch' || oct === 'conditional-branch') {
            return (other.conditions || []).some(c => c.nextTaskId === t.id);
          }
          return (other.nextTaskIds || []).includes(t.id);
        }).length;
        if (incomingCount < 2) errs.push(`${label}：合併節點需要至少 2 個來源指向它`);
      } else if (ct === 'loop-return') {
        if (!t.nextTaskIds?.[0]) errs.push(`${label}：請選擇「迴圈返回至」的目標任務`);
      }
    });

    const hasStart = tasks.some(t => t.connectionType === 'start');
    const hasEnd   = tasks.some(t => t.connectionType === 'end' || t.connectionType === 'breakpoint');
    if (!hasStart) errs.push('流程需要至少一個「流程開始」節點');
    if (!hasEnd)   errs.push('流程需要至少一個「流程結束」或「流程斷點」節點');

    // Check all tasks (except start) have at least one incoming connection
    const reachable = new Set();
    tasks.forEach(t => {
      const ct = t.connectionType || 'sequence';
      if (ct === 'conditional-branch' || ct === 'parallel-branch') {
        (t.conditions || []).forEach(c => { if (c.nextTaskId) reachable.add(c.nextTaskId); });
      } else if (ct === 'parallel-merge' || ct === 'conditional-merge') {
        const c0 = t.conditions?.[0];
        if (c0?.nextTaskId) reachable.add(c0.nextTaskId);
      } else if (ct === 'loop-return') {
        (t.nextTaskIds || []).filter(Boolean).forEach(id => reachable.add(id));
      } else {
        (t.nextTaskIds || []).filter(Boolean).forEach(id => reachable.add(id));
      }
    });
    tasks.forEach((t, i) => {
      if (t.connectionType === 'start') return;
      if (!reachable.has(t.id)) errs.push(`任務 ${i + 1}「${t.name || '未命名'}」：沒有任何來源連結到此任務`);
    });
  }
  return errs;
}

// ── Main Wizard ──────────────────────────────────────────────────
const STEPS = ['L3 基本資訊', '泳道角色', 'L4 任務', '預覽'];

export default function Wizard({ flow, onSave, onCancel }) {
  const [step, setStep]     = useState(0);
  const [data, setData]     = useState(() => initFormData(flow));
  const [errors, setErrors] = useState([]);

  function handleChange(updates) {
    setData(prev => ({ ...prev, ...updates }));
    setErrors([]);
  }

  function handleNext() {
    const errs = validate(step, data);
    if (errs.length) { setErrors(errs); return; }
    setErrors([]);
    setStep(s => s + 1);
  }

  function handleBack() {
    setErrors([]);
    setStep(s => s - 1);
  }

  function handleSave() {
    const errs = validate(step, data);
    if (errs.length) { setErrors(errs); return; }
    onSave(data);
  }

  return (
    <div className="min-h-screen" style={{ background: '#F5F8FC' }}>
      <header className="px-6 py-3 shadow-md flex items-center gap-4" style={{ background: '#2A5598', color: 'white' }}>
        <button onClick={onCancel} className="opacity-70 hover:opacity-100 text-sm">← 返回</button>
        <span className="text-lg font-bold tracking-wide">
          {flow ? `編輯：${data.l3Number} ${data.l3Name}` : '新增 L3 活動'}
        </span>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8">
        <StepIndicator current={step} steps={STEPS} />

        {errors.length > 0 && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm font-semibold text-red-700 mb-2">請修正以下問題：</p>
            <ul className="list-disc list-inside space-y-1">
              {errors.map((e, i) => <li key={i} className="text-sm text-red-600">{e}</li>)}
            </ul>
          </div>
        )}

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          {step === 0 && <Step1 data={data} onChange={handleChange} />}
          {step === 1 && <Step2 data={data} onChange={handleChange} />}
          {step === 2 && <Step3 data={data} onChange={handleChange} />}
          {step === 3 && <Step4 data={data} />}
        </div>

        <div className="flex justify-between">
          <button onClick={step === 0 ? onCancel : handleBack}
            className="px-5 py-2 rounded-lg border border-gray-300 text-gray-700 text-sm hover:bg-gray-50 transition-colors">
            {step === 0 ? '取消' : '← 上一步'}
          </button>
          {step < STEPS.length - 1 ? (
            <button onClick={handleNext}
              className="px-5 py-2 rounded-lg text-white text-sm font-medium transition-colors"
              style={{ background: '#3470B5' }}
              onMouseEnter={e => e.currentTarget.style.background = '#274F86'}
              onMouseLeave={e => e.currentTarget.style.background = '#3470B5'}>
              下一步 →
            </button>
          ) : (
            <button onClick={handleSave}
              className="px-5 py-2 rounded-lg text-white text-sm font-medium transition-colors"
              style={{ background: '#2A5598' }}
              onMouseEnter={e => e.currentTarget.style.background = '#1E4677'}
              onMouseLeave={e => e.currentTarget.style.background = '#2A5598'}>
              儲存並完成
            </button>
          )}
        </div>
      </main>
    </div>
  );
}

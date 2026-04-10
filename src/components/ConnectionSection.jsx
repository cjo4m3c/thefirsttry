/**
 * ConnectionSection — renders the BPMN connection configuration UI
 * for a single task, based on its connectionType.
 * Shared between Wizard (Step 3) and FlowEditor.
 */
import { generateId } from '../utils/storage.js';
import { makeCondition, taskOptionLabel } from '../utils/taskDefs.js';

export default function ConnectionSection({ task, allTasks, displayLabels, onUpdate }) {
  const ct = task.connectionType || 'sequence';
  const opts = allTasks.filter(t => t.id !== task.id && t.roleId);
  const sel = 'flex-1 min-w-0 px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-400';
  const inp = 'flex-1 min-w-0 px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-400';
  const lbl = 'text-xs text-gray-500 w-16 flex-shrink-0';

  function renderOpts() {
    return opts.map(t => (
      <option key={t.id} value={t.id}>{taskOptionLabel(t, displayLabels)}</option>
    ));
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
            <input
              className="w-20 flex-shrink-0 px-2 py-1 border border-yellow-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-yellow-400"
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
        <button onClick={() => addCond()}
          className="mt-1.5 text-xs text-yellow-700 hover:text-yellow-900">
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
        <button onClick={() => addCond('')}
          className="mt-1.5 text-xs text-green-700 hover:text-green-900">
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
            onChange={e => onUpdate({
              ...task,
              conditions: [{ id: c0?.id || generateId(), label: '', nextTaskId: e.target.value }],
            })}>
            <option value="">選擇目標任務</option>{renderOpts()}
          </select>
        </div>
        <p className="text-xs text-gray-400 mt-1 pl-1">
          ℹ 驗證時將確認有多個{mergeType}來源指向此元件
        </p>
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

  return null; // 'end' — no connection config needed
}

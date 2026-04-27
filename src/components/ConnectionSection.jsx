/**
 * ConnectionSection — renders the BPMN connection configuration UI
 * for a single task, based on its connectionType.
 * Shared between Wizard (Step 3) and FlowEditor.
 */
import { generateId } from '../utils/storage.js';
import { makeCondition, taskOptionLabel } from '../utils/taskDefs.js';

export default function ConnectionSection({ task, allTasks, displayLabels, onUpdate }) {
  const ct = task.connectionType || 'sequence';
  // Gateways skip the roleId filter — a freshly added gateway often has no
  // role yet, but other tasks should still be able to point at it. validateFlow
  // surfaces "gateway without roleId" as a save-time warning.
  const opts = allTasks.filter(t => t.id !== task.id && (t.type === 'gateway' || t.roleId));
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
          <span className={lbl}>子流程 L3 編號</span>
          <input className={inp} value={task.subprocessName || ''} placeholder="例：5-3-2"
            onChange={e => onUpdate({ ...task, subprocessName: e.target.value })} />
        </div>
        <div className="flex items-center gap-2">
          <span className={lbl}>返回後 →</span>
          <select value={task.nextTaskIds?.[0] || ''} className={sel}
            onChange={e => onUpdate({ ...task, nextTaskIds: [e.target.value] })}>
            <option value="">選擇目標任務</option>{renderOpts()}
          </select>
        </div>
        <p className="text-xs text-gray-400 mt-1 pl-1">
          ℹ 此任務將以 L3 活動元件（雙邊書擋矩形）繪製，上面顯示所調用的子流程 L3 編號
        </p>
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
            <input
              className="w-20 flex-shrink-0 px-2 py-1 border border-green-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-green-400"
              value={cond.label} placeholder="標籤（選填）"
              onChange={e => updCond(idx, 'label', e.target.value)} />
            <span className="text-xs text-gray-400 flex-shrink-0">→</span>
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
        <p className="text-xs text-gray-400 mt-1 pl-1">
          ℹ AND 並行閘道不評估條件（標籤僅作註記用），所有目標都會建立並行路徑
        </p>
      </div>
    );
  }

  if (ct === 'inclusive-branch') {
    const conds = task.conditions || [];
    return (
      <div className="mt-1.5">
        {conds.map((cond, idx) => (
          <div key={cond.id} className="flex items-center gap-2 mt-1">
            <span className="text-xs flex-shrink-0" style={{ color: '#854D0E' }}>◇⊙</span>
            <input
              className="w-20 flex-shrink-0 px-2 py-1 border rounded text-xs focus:outline-none focus:ring-1"
              style={{ borderColor: '#FDE68A' }}
              value={cond.label} placeholder="條件標籤"
              onChange={e => updCond(idx, 'label', e.target.value)} />
            <span className="text-xs text-gray-400 flex-shrink-0">→</span>
            <select value={cond.nextTaskId} className={sel}
              onChange={e => updCond(idx, 'nextTaskId', e.target.value)}>
              <option value="">選擇包容目標</option>{renderOpts()}
            </select>
            <button onClick={() => remCond(idx)} disabled={conds.length <= 1}
              className="text-red-400 hover:text-red-600 text-xs flex-shrink-0 disabled:opacity-20">✕</button>
          </div>
        ))}
        <button onClick={() => addCond()}
          className="mt-1.5 text-xs"
          style={{ color: '#854D0E' }}>
          + 新增包容分支
        </button>
        <p className="text-xs text-gray-400 mt-1 pl-1">
          ℹ OR 包容閘道：每個條件獨立評估，凡為真者建立並行路徑（可同時觸發 1~N 條）
        </p>
      </div>
    );
  }

  if (ct === 'parallel-merge' || ct === 'conditional-merge' || ct === 'inclusive-merge') {
    const mergeType = ct === 'parallel-merge' ? '並行'
                     : ct === 'inclusive-merge' ? '包容'
                     : '條件';
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
    // New single-target model: loop-return is a regular task with a
    // back-edge in nextTaskIds[0]. No conditional branches; forward
    // continuation (if any) comes from a preceding gateway, not here.
    const backTarget = task.nextTaskIds?.[0] || '';
    return (
      <div className="flex flex-col gap-1.5 mt-1.5">
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 flex-shrink-0">迴圈說明</span>
          <input className={inp} value={task.loopDescription || ''}
            placeholder="說明迴圈觸發條件（選填）"
            onChange={e => onUpdate({ ...task, loopDescription: e.target.value })} />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-red-500 w-20 flex-shrink-0">迴圈返回至 ↺</span>
          <select value={backTarget} className={sel}
            onChange={e => onUpdate({ ...task, nextTaskIds: [e.target.value] })}>
            <option value="">選擇返回目標任務</option>{renderOpts()}
          </select>
        </div>
        <p className="text-xs text-gray-400 mt-1 pl-1">
          ℹ 迴圈返回只指回前方任務；若需同時有「繼續前進」的條件分支，請改用「條件分支」排他閘道（需 `_g` 後綴）。
        </p>
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

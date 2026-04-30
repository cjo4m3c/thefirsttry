/**
 * ConnectionSection — renders the BPMN connection configuration UI
 * for a single task, based on its connectionType. Embedded inside
 * TaskCard's Row 3 (the "下一步 / 條件分支至 ..." row).
 *
 * Layout convention (matches TaskCard's other rows):
 *   col-A label    w-24        ← aligns with TaskCard badge column
 *   col-B middle   w-40        ← aligns with TaskCard role column
 *                              (used by branch cases for the condition
 *                              label input; for non-branch single-target
 *                              cases the spacer is dropped — target select
 *                              spans col-B + col-C so there's no empty
 *                              gap between label and dropdown)
 *   col-C target   flex-1      ← aligns with TaskCard name column
 *   col-D action   w-6 + spacer ← row remove button + reserved space for ▼/✕
 *
 * Font sizes: text-sm everywhere so the connection row reads at the
 * same density as the role / task-name inputs above it.
 */
import { generateId } from '../utils/storage.js';
import { makeCondition, taskOptionLabel } from '../utils/taskDefs.js';

export default function ConnectionSection({ task, allTasks, displayLabels, onUpdate }) {
  const ct = task.connectionType || 'sequence';
  const opts = allTasks.filter(t => t.id !== task.id && (t.type === 'gateway' || t.type === 'l3activity' || t.roleId));
  // Shared style fragments — keep the row layout identical across all
  // connection-type cases so columns align with TaskCard rows above.
  const lbl = 'text-sm text-gray-600 w-24 flex-shrink-0 truncate';
  const midInput = 'w-40 flex-shrink-0 px-2 py-1.5 border rounded text-sm focus:outline-none focus:ring-1';
  // Single-target cases (non-branch): select / input spans col-B + col-C
  // (drops the empty col-B spacer that used to leave an awkward gap between
  // "下一步 →" label and the dropdown — see 2026-04-30 user request).
  const wide = 'flex-1 min-w-0 px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-400';
  // Branch cases keep col-C target select narrower because col-B is occupied
  // by the condition-label input.
  const sel = 'flex-1 min-w-0 px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-400';
  const rowGap = 'flex items-center gap-2';
  const removeBtn = 'w-6 flex-shrink-0 text-red-400 hover:text-red-600 text-sm disabled:opacity-20';

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
      <div className={`${rowGap} mt-1.5`}>
        <span className={lbl}>{ct === 'start' ? '流程開始 →' : '下一步 →'}</span>
        <select value={task.nextTaskIds?.[0] || ''} className={wide}
          onChange={e => onUpdate({ ...task, nextTaskIds: [e.target.value] })}>
          <option value="">選擇目標任務</option>{renderOpts()}
        </select>
      </div>
    );
  }

  if (ct === 'subprocess') {
    return (
      <div className="flex flex-col gap-1.5 mt-1.5">
        <div className={rowGap}>
          <span className={lbl}>L3 編號</span>
          <input className={wide} value={task.subprocessName || ''} placeholder="例：5-3-2"
            onChange={e => onUpdate({ ...task, subprocessName: e.target.value })} />
        </div>
        <div className={rowGap}>
          <span className={lbl}>返回後 →</span>
          <select value={task.nextTaskIds?.[0] || ''} className={wide}
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
          <div key={cond.id} className={`${rowGap} mt-1`}>
            <span className={lbl}>條件 {idx + 1} →</span>
            <input
              className={`${midInput} border-yellow-300 focus:ring-yellow-400`}
              value={cond.label} placeholder="條件標籤"
              onChange={e => updCond(idx, 'label', e.target.value)} />
            <select value={cond.nextTaskId} className={sel}
              onChange={e => updCond(idx, 'nextTaskId', e.target.value)}>
              <option value="">選擇目標任務</option>{renderOpts()}
            </select>
            <button onClick={() => remCond(idx)} disabled={conds.length <= 1}
              className={removeBtn}>✕</button>
          </div>
        ))}
        <button onClick={() => addCond()}
          className="mt-1.5 text-sm text-yellow-700 hover:text-yellow-900">
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
          <div key={cond.id} className={`${rowGap} mt-1`}>
            <span className={lbl}>並行 {idx + 1} →</span>
            <input
              className={`${midInput} border-green-300 focus:ring-green-400`}
              value={cond.label} placeholder="標籤（選填）"
              onChange={e => updCond(idx, 'label', e.target.value)} />
            <select value={cond.nextTaskId} className={sel}
              onChange={e => updCond(idx, 'nextTaskId', e.target.value)}>
              <option value="">選擇並行目標</option>{renderOpts()}
            </select>
            <button onClick={() => remCond(idx)} disabled={conds.length <= 1}
              className={removeBtn}>✕</button>
          </div>
        ))}
        <button onClick={() => addCond('')}
          className="mt-1.5 text-sm text-green-700 hover:text-green-900">
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
          <div key={cond.id} className={`${rowGap} mt-1`}>
            <span className={lbl}>包容 {idx + 1} →</span>
            <input
              className={midInput}
              style={{ borderColor: '#FDE68A' }}
              value={cond.label} placeholder="條件標籤"
              onChange={e => updCond(idx, 'label', e.target.value)} />
            <select value={cond.nextTaskId} className={sel}
              onChange={e => updCond(idx, 'nextTaskId', e.target.value)}>
              <option value="">選擇包容目標</option>{renderOpts()}
            </select>
            <button onClick={() => remCond(idx)} disabled={conds.length <= 1}
              className={removeBtn}>✕</button>
          </div>
        ))}
        <button onClick={() => addCond()}
          className="mt-1.5 text-sm" style={{ color: '#854D0E' }}>
          + 新增包容分支
        </button>
        <p className="text-xs text-gray-400 mt-1 pl-1">
          ℹ OR 包容閘道：每個條件獨立評估，凡為真者建立並行路徑（可同時觸發 1~N 條）
        </p>
      </div>
    );
  }

  // PR-B 2026-04-29: parallel-merge / conditional-merge / inclusive-merge
  // removed from CONNECTION_TYPES. Merge is derived from incoming-edge count
  // at render time (formatConnection auto-emits "X合併 ..."). Old saved data
  // gets migrated to the matching -branch by storage.migrateMergeConnectionType,
  // so this block is unreachable in practice — kept removed.

  if (ct === 'loop-return') {
    const backTarget = task.nextTaskIds?.[0] || '';
    return (
      <div className="flex flex-col gap-1.5 mt-1.5">
        <div className={rowGap}>
          <span className={lbl}>迴圈說明</span>
          <input className={wide} value={task.loopDescription || ''}
            placeholder="說明迴圈觸發條件（選填）"
            onChange={e => onUpdate({ ...task, loopDescription: e.target.value })} />
        </div>
        <div className={rowGap}>
          <span className={`${lbl} text-red-500`}>返回至 ↺</span>
          <select value={backTarget} className={wide}
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
      <div className={`${rowGap} mt-1.5`}>
        <span className={lbl}>斷點說明</span>
        <input className={wide} value={task.breakpointReason || ''}
          placeholder="說明斷點原因（選填）"
          onChange={e => onUpdate({ ...task, breakpointReason: e.target.value })} />
      </div>
    );
  }

  return null; // 'end' — no connection config needed
}

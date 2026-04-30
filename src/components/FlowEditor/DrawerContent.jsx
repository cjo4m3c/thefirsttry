import { Fragment, useState } from 'react';
import TaskCard from './TaskCard.jsx';
import { ReorderButtons } from '../reorderButtons.jsx';
import { makeRole, taskOptionLabel } from '../../utils/taskDefs.js';
import { ELEMENT_TYPES, getElementType, syncTasksToRoles } from '../../utils/elementTypes.js';

// InsertPicker — drawer-side equivalent of the diagram's ContextMenu, used
// to add elements between TaskCards. Collapsed state looks identical to the
// previous InsertSlot (hover-only "+ 插入元件" pill). Expanded state shows a
// type dropdown + per-type fields + confirm/cancel, mirroring the
// ContextMenu sub-form pattern so the editor and the diagram stay one
// consistent UX.
//
// Type list mirrors the spec's element catalog (no "其他" grouping — the
// drawer has space to lay them out flat):
//   L4 任務 (default) / 排他 / 並行 / 包容 閘道 / 開始事件 / 結束事件 /
//   L3 流程（子流程調用）/ 外部互動
function InsertPicker({ index, allTasks, displayLabels,
  onAddTaskAt, onAddOtherAt, onAddL3At, onAddGatewayAt }) {
  const [expanded, setExpanded] = useState(false);
  const [type, setType] = useState('task');
  // Gateway: list of {label, target} branches. Default 2; user can add /
  // remove until ≥2 remain. Mirrors ContextMenu GatewaySubForm UX.
  const [gwBranches, setGwBranches] = useState([
    { label: '', target: '' },
    { label: '', target: '' },
  ]);
  const [l3Number, setL3Number] = useState('');
  const [l3Name, setL3Name] = useState('');
  const [eventName, setEventName] = useState('');

  function reset() {
    setExpanded(false);
    setType('task');
    setGwBranches([{ label: '', target: '' }, { label: '', target: '' }]);
    setL3Number(''); setL3Name('');
    setEventName('');
  }

  function handleSubmit() {
    if (type === 'task') {
      onAddTaskAt(index);
    } else if (type === 'start' || type === 'end' || type === 'interaction') {
      onAddOtherAt(index, type, eventName);
    } else if (type === 'l3activity') {
      if (!l3Number.trim()) return;
      onAddL3At(index, l3Number.trim(), l3Name.trim());
    } else if (type.startsWith('gateway-')) {
      const kind = type.slice(8);  // xor / and / or
      const valid = gwBranches.filter(b => b.target);
      if (valid.length < 2) return;
      onAddGatewayAt(index, kind, valid.map(b => ({ label: b.label, targetId: b.target })));
    }
    reset();
  }

  // Disable confirm when required fields missing
  const validBranchCount = gwBranches.filter(b => b.target).length;
  const canConfirm =
    type === 'task' || type === 'start' || type === 'end' || type === 'interaction'
      || (type === 'l3activity' && l3Number.trim())
      || (type.startsWith('gateway-') && validBranchCount >= 2);

  if (!expanded) {
    return (
      <div className="relative h-4 -my-1 group">
        <div className="absolute inset-x-2 top-1/2 -translate-y-1/2 h-0.5 bg-transparent group-hover:bg-blue-300 transition-colors" />
        <button
          type="button"
          onClick={() => setExpanded(true)}
          title="在此位置插入新元件"
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 px-2 py-0.5 text-xs rounded-full bg-white border border-blue-400 text-blue-600 hover:bg-blue-50 shadow-sm whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-10">
          + 插入元件
        </button>
      </div>
    );
  }

  // 5-col layout matching TaskCard rows: drag(w-5) / label(w-24) /
  // role-col(w-40) / name-col(flex-1) / actions(w-14). Picker reuses the
  // label column for "新增類型" and beyond.
  const lbl = 'text-sm text-gray-600 w-24 flex-shrink-0';
  const midInput = 'w-40 flex-shrink-0 px-2 py-1.5 border border-gray-300 rounded text-sm';
  const sel = 'flex-1 min-w-0 px-2 py-1.5 border border-gray-300 rounded text-sm';
  const targetOptions = (allTasks || []);

  return (
    <div className="my-1 p-3 bg-blue-50 border border-blue-300 rounded-lg flex flex-col gap-2">
      {/* Type selector — options + helperText come from ELEMENT_TYPES schema
          so adding a new element kind only needs a single edit there. */}
      <div className="flex items-center gap-2">
        <span className={lbl}>新增類型</span>
        <select value={type} onChange={e => setType(e.target.value)}
          className={`${midInput} bg-white`}>
          {ELEMENT_TYPES.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
        </select>
        <div className="flex-1 min-w-0 text-xs text-gray-500 pl-2">
          {getElementType(type)?.helperText}
        </div>
      </div>

      {/* Type-specific fields */}
      {type.startsWith('gateway-') && (
        <>
          {gwBranches.map((b, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className={lbl}>分支 {i + 1}</span>
              <input type="text" value={b.label}
                onChange={e => setGwBranches(gwBranches.map((row, j) => j === i ? { ...row, label: e.target.value } : row))}
                placeholder="條件標籤" className={`${midInput} bg-white`} />
              <select value={b.target}
                onChange={e => setGwBranches(gwBranches.map((row, j) => j === i ? { ...row, target: e.target.value } : row))}
                className={`${sel} bg-white`}>
                <option value="">選擇目標任務</option>
                {targetOptions.map(t => <option key={t.id} value={t.id}>{taskOptionLabel(t, displayLabels || {})}</option>)}
              </select>
              {gwBranches.length > 2 && (
                <button onClick={() => setGwBranches(gwBranches.filter((_, j) => j !== i))}
                  title="移除此分支"
                  className="w-6 flex-shrink-0 text-red-400 hover:text-red-600 text-base">✕</button>
              )}
            </div>
          ))}
          <button type="button"
            onClick={() => setGwBranches([...gwBranches, { label: '', target: '' }])}
            className="text-sm text-blue-600 hover:text-blue-800 self-start px-2 py-1">
            + 新增分支
          </button>
        </>
      )}

      {type === 'l3activity' && (
        <>
          <div className="flex items-center gap-2">
            <span className={lbl}>L3 編號 *</span>
            <input type="text" value={l3Number} onChange={e => setL3Number(e.target.value)}
              placeholder="例：5-3-2" className={`${midInput} bg-white`} />
            <div className="flex-1 min-w-0" />
          </div>
          <div className="flex items-center gap-2">
            <span className={lbl}>L3 活動名稱</span>
            <input type="text" value={l3Name} onChange={e => setL3Name(e.target.value)}
              placeholder="（選填）" className={`${midInput} bg-white`} />
            <div className="flex-1 min-w-0" />
          </div>
        </>
      )}

      {(type === 'start' || type === 'end' || type === 'interaction') && (
        <div className="flex items-center gap-2">
          <span className={lbl}>名稱（選填）</span>
          <input type="text" value={eventName} onChange={e => setEventName(e.target.value)}
            placeholder={
              type === 'start' ? '例：開始事件'
              : type === 'end' ? '例：結束事件'
              : '例：客戶提交需求'
            }
            className={`${sel} bg-white`} />
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-2 mt-1">
        <button type="button" onClick={reset}
          className="px-3 py-1 text-sm text-gray-600 hover:text-gray-900">
          取消
        </button>
        <button type="button" onClick={handleSubmit} disabled={!canConfirm}
          className="px-3 py-1 text-sm rounded text-white disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ background: canConfirm ? '#2A5598' : '#9CA3AF' }}>
          確認新增
        </button>
      </div>
    </div>
  );
}

// Hover-only insert slot between rows (role tab still uses this — only one
// element type so no picker needed). Different from DropLine (drag feedback).
function InsertSlot({ onClick, label, title }) {
  return (
    <div className="relative h-4 -my-1 group">
      <div className="absolute inset-x-2 top-1/2 -translate-y-1/2 h-0.5 bg-transparent group-hover:bg-blue-300 transition-colors" />
      <button
        type="button"
        onClick={onClick}
        title={title}
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 px-2 py-0.5 text-xs rounded-full bg-white border border-blue-400 text-blue-600 hover:bg-blue-50 shadow-sm whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-10">
        {label}
      </button>
    </div>
  );
}

/**
 * Drawer body — switches between "設定流程" (task cards) and
 * "設定泳道角色" (role rows). Reorder is via ▲ ▼ arrow buttons on each row
 * (replaced HTML5 drag 2026-04-30 — see src/components/reorderButtons.jsx).
 *
 * UX:
 *  - Both tabs use hover-between-rows InsertSlot exclusively for adding
 *    rows. Top "+ 新增任務 / 新增角色" buttons removed — InsertSlot covers
 *    every position (before first row, between rows, after last row).
 */
export function DrawerContent({ activeTab, liveFlow, displayLabels,
  onMoveTask, onMoveRole, onPatch, onUpdateTask, onRemoveTask,
  onAddTaskAt, onAddOtherAt, onAddL3At, onAddGatewayAt }) {
  if (activeTab === 'flow') {
    return (
      <div>
        <p className="text-sm text-gray-400 mb-3">▼ 點任務右側箭頭可展開說明、輸入、產出欄位；左側 ▲ ▼ 可改變順序；滑鼠移到任務間 / 列表前後可選擇要插入的元件類型（任務 / 閘道 / 開始 / 結束 / L3 流程 / 外部互動）</p>
        <div className="flex flex-col gap-2">
          <InsertPicker index={0} allTasks={liveFlow.tasks} displayLabels={displayLabels}
            onAddTaskAt={onAddTaskAt} onAddOtherAt={onAddOtherAt}
            onAddL3At={onAddL3At} onAddGatewayAt={onAddGatewayAt} />
          {liveFlow.tasks.map((task, i) => (
            <Fragment key={task.id}>
              <TaskCard
                task={task}
                roles={liveFlow.roles || []}
                allTasks={liveFlow.tasks}
                displayLabels={displayLabels}
                onUpdate={updated => onUpdateTask(task.id, updated)}
                onRemove={() => onRemoveTask(task.id)}
                canRemove={liveFlow.tasks.length > 1}
                canMoveUp={i > 0}
                canMoveDown={i < liveFlow.tasks.length - 1}
                onMoveUp={() => onMoveTask(i, -1)}
                onMoveDown={() => onMoveTask(i, +1)}
              />
              <InsertPicker index={i + 1} allTasks={liveFlow.tasks} displayLabels={displayLabels}
                onAddTaskAt={onAddTaskAt} onAddOtherAt={onAddOtherAt}
                onAddL3At={onAddL3At} onAddGatewayAt={onAddGatewayAt} />
            </Fragment>
          ))}
        </div>
      </div>
    );
  }

  // 'roles' tab — same pattern: no top button; InsertSlot at every slot.
  function addRoleAt(index) {
    const arr = liveFlow.roles || [];
    const next = [...arr];
    next.splice(index, 0, makeRole());
    onPatch({ roles: next });
  }
  const roles = liveFlow.roles || [];
  return (
    <div>
      <p className="text-sm text-gray-400 mb-3 flex items-center gap-1">
        <span className="text-gray-400">⠨</span> 點左側 ▲ ▼ 改變泳道順序；滑鼠移到角色間 / 列表前後可插入新角色
      </p>
      <div className="flex flex-col gap-2">
        <InsertSlot onClick={() => addRoleAt(0)} label="+ 插入角色" title="在此位置插入新角色" />
        {roles.map((role, i) => (
          <Fragment key={role.id}>
            <div
              className="flex items-center gap-2 p-2 bg-gray-50 border border-gray-200 rounded-lg select-none">
              <ReorderButtons
                canUp={i > 0} canDown={i < roles.length - 1}
                onUp={() => onMoveRole(i, -1)} onDown={() => onMoveRole(i, +1)} />
              <span className="text-sm text-gray-400 w-5 flex-shrink-0">#{i + 1}</span>
              <input type="text" placeholder="角色名稱" value={role.name}
                onChange={e => onPatch({ roles: liveFlow.roles.map(r => r.id === role.id ? { ...r, name: e.target.value } : r) })}
                className="flex-1 px-3 py-1.5 border border-gray-300 rounded text-base focus:outline-none focus:ring-1 focus:ring-blue-400" />
              <select value={role.type}
                onChange={e => {
                  // Cascade-sync: flipping a role internal↔external swaps
                  // every L4 task in that lane between task / interaction.
                  const newRoles = liveFlow.roles.map(r => r.id === role.id ? { ...r, type: e.target.value } : r);
                  onPatch({ roles: newRoles, tasks: syncTasksToRoles(liveFlow.tasks, newRoles) });
                }}
                className="px-2 py-1.5 border border-gray-300 rounded text-base focus:outline-none"
                style={{ background: role.type === 'external' ? '#009900' : '#0066CC', color: 'white' }}>
                <option value="internal">內部角色</option>
                <option value="external">外部角色</option>
              </select>
              <button
                onClick={() => { if (liveFlow.roles.length > 1) onPatch({ roles: liveFlow.roles.filter(r => r.id !== role.id) }); }}
                disabled={liveFlow.roles.length <= 1}
                className="text-red-400 hover:text-red-600 disabled:opacity-20 text-xl leading-none">✕</button>
            </div>
            <InsertSlot onClick={() => addRoleAt(i + 1)} label="+ 插入角色" title="在此位置插入新角色" />
          </Fragment>
        ))}
      </div>
    </div>
  );
}

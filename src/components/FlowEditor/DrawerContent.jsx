import { Fragment, useState } from 'react';
import TaskCard from './TaskCard.jsx';
import { DragHandle } from '../dragReorder.jsx';
import { makeRole } from '../../utils/taskDefs.js';

// Shared blue insertion line for drag-reorder feedback (task list AND role
// list share the same look). Sits between adjacent rows; rendered with
// negative margin so it occupies near-zero vertical space.
function DropLine() {
  return (
    <div className="relative h-0 my-[-4px]" aria-hidden="true">
      <div className="absolute inset-x-2 -translate-y-1/2 h-1.5 bg-blue-500 rounded-full shadow-md shadow-blue-300" />
    </div>
  );
}

// Hover-only insert slot between rows. Different from DropLine (which appears
// during drag-to-reorder). InsertSlot is point-and-click: hover the gap, see
// a blue line + button, click to add a new row at that exact position.
// Container is always 16px high so layout doesn't shift; line + button fade
// in via group-hover. `label` is the button text (e.g. "+ 插入任務").
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
 * "設定泳道角色" (role rows). Drag-reorder handlers come from the parent's
 * useDragReorder hook instances (one per list).
 *
 * UX:
 *  - "+ 新增任務" button now sits at the TOP of the task list (was bottom)
 *  - InsertSlot between every adjacent pair of TaskCards lets the user
 *    click to insert at that exact position (separate from drag-to-reorder)
 *  - Both task drag and role drag show the same DropLine indicator
 *    between rows during a drag operation
 */
export function DrawerContent({ activeTab, liveFlow, displayLabels,
  taskDrag, roleDrag, onPatch, onUpdateTask, onRemoveTask, onAddTask, onAddTaskAt, onAddInteraction }) {
  if (activeTab === 'flow') {
    const { dragIdx, overIdx, dropAfter, rowProps } = taskDrag;
    const dropTargetSlot = (dragIdx === null || overIdx === null) ? null
      : (dropAfter ? overIdx + 1 : overIdx);
    const adjacentTopIdx    = dropTargetSlot !== null ? dropTargetSlot - 1 : null;
    const adjacentBottomIdx = dropTargetSlot;
    const getDropEdge = (i) => {
      if (dragIdx === null || dragIdx === i) return null;
      if (i === adjacentTopIdx)    return 'bottom';
      if (i === adjacentBottomIdx) return 'top';
      return null;
    };
    const showLineAt = (slot) => dropTargetSlot === slot
      && dragIdx !== null
      && slot !== dragIdx
      && slot !== dragIdx + 1;
    const isDragging = dragIdx !== null;
    return (
      <div>
        {/* Add buttons pinned to the top. Two entry points:
            - 新增任務: regular task at end of list
            - 新增外部互動: task with shapeType=interaction (purple/gray)
              Per business spec, interactions belong on external-role lanes;
              save validation warns (non-blocking) if dropped on internal lane. */}
        <div className="flex gap-2 mb-3">
          <button onClick={onAddTask}
            className="flex-1 py-2 text-base border border-dashed border-blue-400 text-blue-600 rounded-lg hover:bg-blue-50 transition-colors">
            + 新增任務（加到最後）
          </button>
          <button onClick={onAddInteraction}
            className="flex-1 py-2 text-base border border-dashed border-purple-400 text-purple-700 rounded-lg hover:bg-purple-50 transition-colors"
            style={{ background: '#FAF5FF' }}>
            + 新增外部互動
          </button>
        </div>
        <p className="text-sm text-gray-400 mb-3">▼ 點任務右側箭頭可展開說明、輸入、產出欄位；滑鼠移到任務間可從中間插入</p>
        <div className="flex flex-col gap-2">
          {/* Top InsertSlot — insert before the first task. Hidden during
              drag to avoid visual conflict with DropLine. */}
          {!isDragging && liveFlow.tasks.length > 0 && (
            <InsertSlot onClick={() => onAddTaskAt(0)} label="+ 插入任務" title="在此位置插入新任務" />
          )}
          {liveFlow.tasks.map((task, i) => (
            <Fragment key={task.id}>
              {showLineAt(i) && <DropLine />}
              <TaskCard
                task={task}
                roles={liveFlow.roles || []}
                allTasks={liveFlow.tasks}
                displayLabels={displayLabels}
                onUpdate={updated => onUpdateTask(task.id, updated)}
                onRemove={() => onRemoveTask(task.id)}
                canRemove={liveFlow.tasks.length > 1}
                dragHandlers={rowProps(i)}
                isDragging={dragIdx === i}
                dropEdge={getDropEdge(i)}
              />
              {/* Between-row InsertSlot — except after the last task,
                  which the top "新增任務（加到最後）" button covers. */}
              {!isDragging && i < liveFlow.tasks.length - 1 && (
                <InsertSlot onClick={() => onAddTaskAt(i + 1)} label="+ 插入任務" title="在此位置插入新任務" />
              )}
            </Fragment>
          ))}
          {showLineAt(liveFlow.tasks.length) && <DropLine />}
        </div>
      </div>
    );
  }

  // 'roles' tab — same UX pattern as tasks: top "+ 新增角色" button is gone;
  // hover-between-rows InsertSlot is the sole entry point. Drag-reorder still
  // shows DropLine.
  const { dragIdx: roleDragIdx, overIdx: roleOverIdx, dropAfter: roleDropAfter, rowProps: roleRowProps } = roleDrag;
  const roleDropTargetSlot = (roleDragIdx === null || roleOverIdx === null) ? null
    : (roleDropAfter ? roleOverIdx + 1 : roleOverIdx);
  const showRoleLineAt = (slot) => roleDropTargetSlot === slot
    && roleDragIdx !== null
    && slot !== roleDragIdx
    && slot !== roleDragIdx + 1;
  const isRoleDragging = roleDragIdx !== null;
  function addRoleAt(index) {
    const arr = liveFlow.roles || [];
    const next = [...arr];
    next.splice(index, 0, makeRole());
    onPatch({ roles: next });
  }
  return (
    <div>
      <button
        onClick={() => addRoleAt((liveFlow.roles || []).length)}
        className="w-full py-2 text-base border border-dashed border-blue-400 text-blue-600 rounded-lg hover:bg-blue-50 transition-colors mb-3">
        + 新增角色（加到最後）
      </button>
      <p className="text-sm text-gray-400 mb-3 flex items-center gap-1">
        <span className="text-gray-400">⠨</span> 可拖曳左側圓點改變順序；滑鼠移到角色間可從中間插入
      </p>
      <div className="flex flex-col gap-2">
        {!isRoleDragging && (liveFlow.roles || []).length > 0 && (
          <InsertSlot onClick={() => addRoleAt(0)} label="+ 插入角色" title="在此位置插入新角色" />
        )}
        {(liveFlow.roles || []).map((role, i) => (
          <Fragment key={role.id}>
            {showRoleLineAt(i) && <DropLine />}
            <div
              {...roleRowProps(i)}
              className={`flex items-center gap-2 p-2 bg-gray-50 border border-gray-200 rounded-lg transition-all select-none
                ${roleDragIdx === i ? 'opacity-40 scale-95' : ''}`}>
              <DragHandle />
              <span className="text-sm text-gray-400 w-5 flex-shrink-0">#{i + 1}</span>
              <input type="text" placeholder="角色名稱" value={role.name}
                onChange={e => onPatch({ roles: liveFlow.roles.map(r => r.id === role.id ? { ...r, name: e.target.value } : r) })}
                className="flex-1 px-3 py-1.5 border border-gray-300 rounded text-base focus:outline-none focus:ring-1 focus:ring-blue-400" />
              <select value={role.type}
                onChange={e => onPatch({ roles: liveFlow.roles.map(r => r.id === role.id ? { ...r, type: e.target.value } : r) })}
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
            {!isRoleDragging && i < (liveFlow.roles || []).length - 1 && (
              <InsertSlot onClick={() => addRoleAt(i + 1)} label="+ 插入角色" title="在此位置插入新角色" />
            )}
          </Fragment>
        ))}
        {showRoleLineAt((liveFlow.roles || []).length) && <DropLine />}
      </div>
    </div>
  );
}

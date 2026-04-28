/**
 * FlowEditor — Unified view/edit page.
 * Shows the swimlane diagram (top) and a full task editor (bottom)
 * on the same page, with real-time diagram updates on save.
 *
 * Works for both use cases:
 *   1. From scratch (via Wizard → redirected here after save)
 *   2. From Excel import (opened directly in view/edit mode)
 */
import { useState, useMemo, useEffect, Fragment } from 'react';
import DiagramRenderer from './DiagramRenderer.jsx';
import ConnectionSection from './ConnectionSection.jsx';
import FlowTable from './FlowTable.jsx';
import BackToTop from './BackToTop.jsx';
import RightDrawer from './RightDrawer.jsx';
import ContextMenu from './ContextMenu.jsx';
import { useDragReorder, DragHandle } from './dragReorder.jsx';
import {
  CONNECTION_TYPES, SHAPE_TYPES, CONN_BADGE, CONN_ROW_BG,
  makeTask, makeRole,
  normalizeTask, applyConnectionType, applySequentialDefaults,
  computeDisplayLabels, applyGatewayPrefix,
} from '../utils/taskDefs.js';
import { generateId } from '../utils/storage.js';
import { detectOverrideViolations } from '../diagram/violations.js';

// ── Pre-save validation ──────────────────────────────────────
// Split into two tiers so the user can still save an imperfect draft:
//   blocking  — hard stops (no save button will work until fixed)
//   warnings  — soft checks surfaced as a confirm dialog; user chooses
//               whether to save anyway or go back to fix them.
function isStart(t) { return t.connectionType === 'start' || t.type === 'start'; }
function isEnd(t)   { return t.connectionType === 'end' || t.connectionType === 'breakpoint' || t.type === 'end'; }

function validateFlow(flow) {
  const tasks = flow.tasks || [];
  const blocking = [];
  const warnings = [];

  const startTasks = tasks.filter(isStart);
  const endTasks   = tasks.filter(isEnd);

  // Count incoming connections per task so we can detect unconnected nodes
  // and validate merge-gateway arity.
  const incoming = {};
  tasks.forEach(t => {
    const outs = t.type === 'gateway'
      ? (t.conditions || []).map(c => c.nextTaskId)
      : (t.nextTaskIds || []);
    outs.filter(Boolean).forEach(id => {
      incoming[id] = (incoming[id] || 0) + 1;
    });
  });

  // ── Blocking checks ────────────────────────────────────────
  if (startTasks.length === 0) blocking.push('必須要有「流程開始」節點');
  if (endTasks.length === 0)   blocking.push('必須要有「流程結束」或「流程斷點」節點');

  startTasks.forEach(s => {
    const outs = (s.nextTaskIds || []).filter(Boolean);
    if (outs.length === 0) blocking.push('「流程開始」必須連接到其他任務元件');
  });
  endTasks.forEach(e => {
    if (!(incoming[e.id] > 0)) blocking.push('「流程結束」/「流程斷點」必須有其他任務連接到它');
  });

  // ── Warning-level checks ───────────────────────────────────
  tasks.forEach((t, i) => {
    const ct = t.connectionType || 'sequence';
    const label = `任務 ${i + 1}「${t.name || '未命名'}」`;

    // 1. Non-end nodes must have next step.
    if (!isEnd(t)) {
      const hasNext = t.type === 'gateway'
        ? (t.conditions || []).some(c => c.nextTaskId)
        : (t.nextTaskIds || []).some(Boolean);
      if (!hasNext) warnings.push(`${label}：未設定下一步`);
    }

    // 2. Parallel-merge needs ≥2 incoming.
    if (ct === 'parallel-merge' && (incoming[t.id] || 0) < 2) {
      warnings.push(`${label}：並行合併至少需要 2 個來源`);
    }

    // 3. Conditional-merge needs ≥2 incoming.
    if (ct === 'conditional-merge' && (incoming[t.id] || 0) < 2) {
      warnings.push(`${label}：條件合併至少需要 2 個來源`);
    }

    // 3b. Inclusive-merge needs ≥2 incoming.
    if (ct === 'inclusive-merge' && (incoming[t.id] || 0) < 2) {
      warnings.push(`${label}：包容合併至少需要 2 個來源`);
    }

    // 3c. Inclusive-branch needs ≥2 conditions wired up.
    if (ct === 'inclusive-branch' && (t.conditions || []).filter(c => c.nextTaskId).length < 2) {
      warnings.push(`${label}：包容分支至少需要 2 個目標`);
    }

    // 3d. Gateway without roleId — soft warning. Since gateway is shown in
    // dropdowns regardless of roleId, this catches the user before save.
    if (t.type === 'gateway' && !t.roleId) {
      warnings.push(`${label}：閘道未指定泳道角色`);
    }

    // 4. Every node except start must have incoming (already blocking for end,
    //    this catches orphan middle nodes).
    if (!isStart(t) && !(incoming[t.id] > 0)) {
      warnings.push(`${label}：沒有任何任務連接到此節點`);
    }

    // 5. Loop-return must specify target.
    if (ct === 'loop-return') {
      const target = (t.nextTaskIds || [])[0];
      if (!target) warnings.push(`${label}：迴圈返回必須指定目標任務`);
    }
  });

  // PR H — override-induced violations. Blocking: IN+OUT mix on same port.
  // Warning: line crosses another task. Auto-routing already avoids both,
  // so these only fire when a user override forces the condition.
  const { blocking: ovBlocking, warnings: ovWarnings } = detectOverrideViolations(flow);
  return {
    blocking: [...blocking, ...ovBlocking],
    warnings: [...warnings, ...ovWarnings],
  };
}

// ── TaskCard ────────────────────────────────────────────────
function TaskCard({ task, roles, allTasks, displayLabels, onUpdate, onRemove, canRemove, dragHandlers, isDragging, dropEdge }) {
  const ct = task.connectionType || 'sequence';
  const badge = CONN_BADGE[ct];
  const num = displayLabels[task.id];
  const rowBg = CONN_ROW_BG[ct] || '#FAFAFA';
  const nameOptional = ct === 'start' || ct === 'end' || ct === 'breakpoint';
  const showShape = ct === 'sequence' || ct === 'subprocess';
  const [expanded, setExpanded] = useState(false);

  // dropEdge marks this row as adjacent to the drop slot:
  //   'top'    → drop slot is above this row    (top edge highlighted)
  //   'bottom' → drop slot is below this row    (bottom edge highlighted)
  //   null     → not adjacent
  // The DropLine sibling rendered between rows shows the actual insertion line.
  const dropEdgeClass = dropEdge === 'top'
    ? 'border-t-2 border-blue-500'
    : dropEdge === 'bottom'
      ? 'border-b-2 border-blue-500'
      : 'border-gray-200';

  return (
    <div
      {...dragHandlers}
      className={`rounded-lg border overflow-hidden transition-all select-none
        ${isDragging ? 'opacity-40 scale-95' : ''}
        ${dropEdgeClass}`}
      style={{ background: rowBg }}>

      {/* Row 1: drag + badge + role + name (wide) + actions */}
      <div className="flex items-center gap-2 px-2 pt-2 min-w-0">
        <DragHandle />

        {/* Badge / number */}
        <div className="w-14 flex-shrink-0 flex items-center">
          {ct === 'sequence' && num ? (
            <span className="text-sm font-mono text-gray-500 font-semibold">{num}</span>
          ) : (
            <span className="px-1.5 py-0.5 rounded text-sm font-bold whitespace-nowrap"
              style={{ background: badge.bg, color: badge.text }}>
              {badge.label || num}
            </span>
          )}
        </div>

        {/* Role */}
        <select value={task.roleId} onChange={e => onUpdate({ ...task, roleId: e.target.value })}
          className="w-24 flex-shrink-0 px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-400">
          <option value="">角色 *</option>
          {roles.filter(r => r.name).map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>

        {/* Name — gets all the remaining width on Row 1 */}
        <input type="text" placeholder={nameOptional ? '名稱（選填）' : '任務名稱 *'}
          value={task.name} onChange={e => onUpdate({ ...task, name: e.target.value })}
          className="flex-1 min-w-0 px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-400" />

        {/* Expand / collapse detail fields */}
        <button onClick={() => setExpanded(v => !v)}
          title={expanded ? '收合詳細欄位' : '展開詳細欄位'}
          className="w-6 flex-shrink-0 text-gray-400 hover:text-gray-600 text-base">
          {expanded ? '▲' : '▼'}
        </button>

        {/* Remove */}
        <button onClick={onRemove} disabled={!canRemove}
          className="w-6 flex-shrink-0 text-red-400 hover:text-red-600 disabled:opacity-20 disabled:cursor-not-allowed text-base">✕</button>
      </div>

      {/* Row 2: connection type + shape type (offset to align under name) */}
      <div className="flex items-center gap-2 px-2 pt-1.5 pb-2 min-w-0">
        {/* Spacer matches drag (~20) + badge (56) + role (96) + 3×gap (24) = 196 */}
        <div className="w-[196px] flex-shrink-0" aria-hidden="true" />

        {/* Connection type */}
        <select value={ct} onChange={e => onUpdate(applyConnectionType(task, e.target.value))}
          className="w-32 flex-shrink-0 px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-400">
          {CONNECTION_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>

        {/* Shape type (sequence/subprocess only) */}
        {showShape && (
          <select value={task.shapeType || 'task'}
            onChange={e => { const st = e.target.value; onUpdate({ ...task, shapeType: st, type: st }); }}
            className="w-24 flex-shrink-0 px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-400">
            {SHAPE_TYPES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        )}
      </div>

      {/* Connection config */}
      <div className="px-3 pb-2.5">
        <ConnectionSection task={task} allTasks={allTasks} displayLabels={displayLabels} onUpdate={onUpdate} />
      </div>

      {/* Expandable detail fields */}
      {expanded && (
        <div className="px-3 pb-3 pt-1 border-t border-gray-100 grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1">
            <span className="text-sm text-gray-500">任務重點說明</span>
            <input type="text" value={task.description || ''} placeholder="重點說明（選填）"
              onChange={e => onUpdate({ ...task, description: e.target.value })}
              className="px-2 py-1 border border-gray-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-300" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm text-gray-500">任務重要輸入</span>
            <input type="text" value={task.inputItems || ''} placeholder="重要輸入（選填）"
              onChange={e => onUpdate({ ...task, inputItems: e.target.value })}
              className="px-2 py-1 border border-gray-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-300" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm text-gray-500">任務產出成品</span>
            <input type="text" value={task.outputItems || ''} placeholder="產出成品（選填）"
              onChange={e => onUpdate({ ...task, outputItems: e.target.value })}
              className="px-2 py-1 border border-gray-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-300" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm text-gray-500">參考資料來源文件名稱</span>
            <input type="text" value={task.reference || ''} placeholder="參考文件（選填）"
              onChange={e => onUpdate({ ...task, reference: e.target.value })}
              className="px-2 py-1 border border-gray-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-300" />
          </label>
        </div>
      )}
    </div>
  );
}

// ── Main FlowEditor ────────────────────────────────────────
export default function FlowEditor({ flow, onBack, onSave }) {
  const [liveFlow, setLiveFlow] = useState(() => ({
    ...flow,
    tasks: (flow.tasks || []).map(t => {
      const withIds = t.nextTaskIds?.length ? t : { ...t, nextTaskIds: t.nextTaskId ? [t.nextTaskId] : [] };
      return normalizeTask(withIds);
    }),
  }));
  const [hasChanges, setHasChanges] = useState(false);
  // Drawer state: tabs inside drawer are 'flow' (流程) / 'roles' (角色).
  // Excel table moves out of tabs entirely → always shown below diagram.
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerTab, setDrawerTab] = useState('flow'); // 'flow' | 'roles'
  // Context menu state: { task, x, y } when open, null when closed.
  // Triggered by clicking a shape on the diagram.
  const [contextMenu, setContextMenu] = useState(null);
  const [logoReaction, setLogoReaction] = useState(null); // 'wave' | null
    const [saveModal, setSaveModal] = useState(null); // { type: 'blocking'|'warning', messages: [] }
  // PR I: confirm-before-clear modal for "重設所有手動端點" global reset.
  const [resetAllModal, setResetAllModal] = useState(false);
  
  useEffect(() => {
    if (!logoReaction) return;
    const timer = setTimeout(() => setLogoReaction(null), 900);
    return () => clearTimeout(timer);
  }, [logoReaction]);

  const displayLabels = useMemo(
    () => computeDisplayLabels(liveFlow.tasks, liveFlow.l3Number),
    [liveFlow.tasks, liveFlow.l3Number]
  );

  const { dragIdx, overIdx, dropAfter, rowProps } = useDragReorder(
    liveFlow.tasks,
    newTasks => {
      // Drop stored l4Number on reorder so computeDisplayLabels falls back
      // to its sequential auto-generation. Otherwise imported tasks keep
      // their original numbers and don't re-sequence with the new order
      // (e.g. dragging a new task between imported 5-1-1-1 and 5-1-1-2
      // would still show NEW=5-1-1-4, B=5-1-1-1 — order ≠ numbers).
      const renumbered = newTasks.map(t => {
        if (!t.l4Number) return t;
        const { l4Number, ...rest } = t;
        return rest;
      });
      patch({ tasks: applySequentialDefaults(renumbered) });
    }
  );

  // Separate hook instance for the role list inside the drawer's "roles"
  // tab. Reorder = swimlane top-to-bottom order; no extra side effects
  // (task.roleId is stable UUID-based, unaffected by lane index).
  const {
    dragIdx: roleDragIdx,
    overIdx: roleOverIdx,
    dropAfter: roleDropAfter,
    rowProps: roleRowProps,
  } = useDragReorder(
    liveFlow.roles || [],
    newRoles => patch({ roles: newRoles })
  );

  function patch(updates) {
    setLiveFlow(prev => ({ ...prev, ...updates }));
    setHasChanges(true);
  }

  function updateTask(id, updated) {
    patch({ tasks: liveFlow.tasks.map(t => t.id === id ? updated : t) });
  }

  function addTask() {
    const newTask = makeTask();
    patch({ tasks: applySequentialDefaults([...liveFlow.tasks, newTask]) });
  }

  // Insert a new (sequence) task before / after the given anchor task,
  // and rewire connections so the new task is NOT orphaned:
  //   addTaskAfter:  anchor → NEW → (anchor's old nextTaskIds)
  //   addTaskBefore: (everyone who pointed at anchor) → NEW → anchor
  // Gateway anchors skip auto-reconnect for `addTaskAfter` (multiple outgoing
  // paths — can't safely pick one); user gets a warning to wire it manually.
  function addTaskBefore(anchorId) {
    const idx = liveFlow.tasks.findIndex(t => t.id === anchorId);
    if (idx < 0) return;
    const newTask = makeTask();
    // Rewire: every task that pointed at anchor → point at newTask
    // (covers regular task.nextTaskIds and gateway conditions[].nextTaskId).
    const rewired = liveFlow.tasks.map(t => {
      if (t.type === 'gateway') {
        const conds = (t.conditions || []).map(c =>
          c.nextTaskId === anchorId ? { ...c, nextTaskId: newTask.id } : c
        );
        return { ...t, conditions: conds };
      }
      const nexts = (t.nextTaskIds || []).map(id => id === anchorId ? newTask.id : id);
      return { ...t, nextTaskIds: nexts };
    });
    // newTask points at anchor (single sequence connection).
    newTask.nextTaskIds = [anchorId];
    const next = [...rewired];
    next.splice(idx, 0, newTask);
    // Strip stored l4Number on insertion so numbering stays sequential
    // (same rationale as the drag-reorder fix from the earlier PR).
    const renumbered = next.map(t => {
      if (!t.l4Number) return t;
      const { l4Number, ...rest } = t;
      return rest;
    });
    patch({ tasks: applySequentialDefaults(renumbered) });
  }

  function addTaskAfter(anchorId) {
    const idx = liveFlow.tasks.findIndex(t => t.id === anchorId);
    if (idx < 0) return;
    const anchor = liveFlow.tasks[idx];
    const newTask = makeTask();

    let rewired;
    if (anchor.type === 'gateway') {
      // Gateway has multiple outgoing conditions — can't pick one safely.
      // Insert without auto-reconnect; user wires it manually in the drawer.
      rewired = liveFlow.tasks;
      // Surface the limitation as a save-time blocking-style warning via
      // a quick alert. Rare action, lightweight feedback is fine.
      alert('閘道後方新增的任務需要手動到編輯面板（右側 ✏️ 編輯）連接到對應分支。已為您插入新任務。');
    } else {
      // Regular task / start / interaction / l3activity — move anchor's
      // outgoing to newTask, anchor → newTask sole sequence connection.
      newTask.nextTaskIds = (anchor.nextTaskIds || []).filter(Boolean);
      rewired = liveFlow.tasks.map(t =>
        t.id === anchorId ? { ...t, nextTaskIds: [newTask.id] } : t
      );
    }

    const next = [...rewired];
    next.splice(idx + 1, 0, newTask);
    const renumbered = next.map(t => {
      if (!t.l4Number) return t;
      const { l4Number, ...rest } = t;
      return rest;
    });
    patch({ tasks: applySequentialDefaults(renumbered) });
  }

  // ContextMenu: append a new outgoing connection from `fromTaskId` to
  // `toTaskId`. Regular tasks just push to nextTaskIds (multi-target =
  // parallel rendering). Gateways append a new condition.
  function addConnection(fromTaskId, toTaskId) {
    const task = liveFlow.tasks.find(t => t.id === fromTaskId);
    if (!task || !toTaskId || fromTaskId === toTaskId) return;
    if (task.type === 'gateway') {
      const newCond = { id: generateId(), label: '', nextTaskId: toTaskId };
      updateTask(fromTaskId, {
        ...task,
        conditions: [...(task.conditions || []), newCond],
      });
    } else {
      const nexts = (task.nextTaskIds || []).filter(Boolean);
      updateTask(fromTaskId, { ...task, nextTaskIds: [...nexts, toTaskId] });
    }
  }

  // ContextMenu: insert a gateway after `anchorId` with two outgoing
  // conditions to `targetId1` / `targetId2`. anchor → newGateway →
  // [target1, target2]. anchor's old nextTaskIds are overwritten — if the
  // user wanted to preserve them, they should pick them as one of the
  // targets via the menu's dropdowns.
  function insertGatewayAfter(anchorId, gatewayType, targetId1, targetId2, label1 = '', label2 = '') {
    const idx = liveFlow.tasks.findIndex(t => t.id === anchorId);
    if (idx < 0) return;
    const anchor = liveFlow.tasks[idx];
    const ctMap = {
      xor: 'conditional-branch',
      and: 'parallel-branch',
      or:  'inclusive-branch',
    };
    const newGateway = makeTask({
      type: 'gateway',
      gatewayType,
      connectionType: ctMap[gatewayType] || 'conditional-branch',
      roleId: anchor.roleId || '',
      // Pre-fill name with "[XX閘道] " prefix so the FlowTable / Excel rows
      // are immediately readable. User extends after the space.
      name: applyGatewayPrefix('', gatewayType),
      conditions: [
        { id: generateId(), label: label1 || '', nextTaskId: targetId1 || '' },
        { id: generateId(), label: label2 || '', nextTaskId: targetId2 || '' },
      ],
      nextTaskIds: [],
    });
    // anchor's outgoing now points solely at the new gateway (overwrite).
    const rewired = liveFlow.tasks.map(t =>
      t.id === anchorId ? { ...t, nextTaskIds: [newGateway.id] } : t
    );
    const next = [...rewired];
    next.splice(idx + 1, 0, newGateway);
    const renumbered = next.map(t => {
      if (!t.l4Number) return t;
      const { l4Number, ...rest } = t;
      return rest;
    });
    patch({ tasks: applySequentialDefaults(renumbered) });
  }

  function removeTask(id) {
    if (liveFlow.tasks.length <= 1) return;
    // PR H: drop the task, AND clear any other task's connectionOverrides
    // key that points at the removed task. Gateway overrides are keyed by
    // condId (not targetId) so they're unaffected by this deletion — only
    // regular tasks need the cleanup.
    const cleaned = liveFlow.tasks.filter(t => t.id !== id).map(t => {
      if (t.type === 'gateway' || !t.connectionOverrides?.[id]) return t;
      const newOv = { ...t.connectionOverrides };
      delete newOv[id];
      return { ...t, connectionOverrides: newOv };
    });
    patch({ tasks: cleaned });
  }
  
  // Merge a partial endpoint override into task.connectionOverrides. Called
  // by DiagramRenderer when the user drags a connection endpoint to a new
  // port. `partial` holds either { exitSide } (source drag) or
  // { entrySide } (target drag); any unmentioned side keeps its previous
  // override (if any) so the two sides can be set independently.
  function updateConnectionOverride(taskId, key, partial) {
    const task = liveFlow.tasks.find(t => t.id === taskId);
    if (!task || !key) return;
    const currentOverrides = task.connectionOverrides || {};
    const currentForKey = currentOverrides[key] || {};
    const newForKey = { ...currentForKey, ...partial };
    updateTask(taskId, {
      ...task,
      connectionOverrides: { ...currentOverrides, [key]: newForKey },
    });
  }

  // PR J — change a connection's TARGET task by dragging the target handle
  // onto a different task. Updates the underlying graph data (`nextTaskIds`
  // for regular tasks, `conditions[i].nextTaskId` for gateway conditions);
  // this is the source of truth for the diagram, FlowTable, Excel export
  // and drawio export, so all four views auto-sync from the same change.
  //
  // Override migration:
  //   - Regular task: override key was oldTargetId → migrate to newTargetId
  //     (preserving exitSide if any), set entrySide to the snap side
  //   - Gateway condition: key is condId (immutable across target change),
  //     so no migration — just update entrySide
  //
  // Self-loop guard: refuse to make a task connect to itself.
  function changeConnectionTarget(fromTaskId, oldKey, newTargetId, snapSide) {
    if (!fromTaskId || !newTargetId || newTargetId === fromTaskId) return;
    const task = liveFlow.tasks.find(t => t.id === fromTaskId);
    if (!task) return;
    const newTarget = liveFlow.tasks.find(t => t.id === newTargetId);
    if (!newTarget || newTarget.type === 'start') return;  // start has no incoming

    let updated;
    if (task.type === 'gateway') {
      const currentOverrides = task.connectionOverrides || {};
      const prevOv = currentOverrides[oldKey] || {};
      updated = {
        ...task,
        conditions: (task.conditions || []).map(c =>
          c.id === oldKey ? { ...c, nextTaskId: newTargetId } : c
        ),
        connectionOverrides: {
          ...currentOverrides,
          [oldKey]: { ...prevOv, entrySide: snapSide },
        },
      };
    } else {
      const newOverrides = { ...(task.connectionOverrides || {}) };
      const prevOv = newOverrides[oldKey] || {};
      delete newOverrides[oldKey];
      newOverrides[newTargetId] = { ...prevOv, entrySide: snapSide };
      updated = {
        ...task,
        nextTaskIds: (task.nextTaskIds || []).map(id => id === oldKey ? newTargetId : id),
        connectionOverrides: newOverrides,
      };
    }
    updateTask(fromTaskId, updated);
  }

  // PR I — reset a single connection's override (both exit and entry side).
  // Called from DiagramRenderer's "重設此連線端點" button when a connection
  // with override is selected.
  function resetConnectionOverride(fromTaskId, key) {
    const task = liveFlow.tasks.find(t => t.id === fromTaskId);
    if (!task?.connectionOverrides?.[key]) return;
    const newOverrides = { ...task.connectionOverrides };
    delete newOverrides[key];
    updateTask(fromTaskId, { ...task, connectionOverrides: newOverrides });
  }

  // PR I — reset ALL manual endpoint overrides across every task. Confirmed
  // via the resetAllModal first (destructive, hard to undo — the only
  // recovery is editing each connection again or reloading from Excel).
  function resetAllOverrides() {
    const cleaned = liveFlow.tasks.map(t => {
      if (!t.connectionOverrides || Object.keys(t.connectionOverrides).length === 0) return t;
      return { ...t, connectionOverrides: {} };
    });
    patch({ tasks: cleaned });
    setResetAllModal(false);
  }

      function doSave(flow) {
    onSave(flow);
    setHasChanges(false);
    setLogoReaction('wave');
    setSaveModal(null);
  }

  function handleSave() {
    const { blocking, warnings } = validateFlow(liveFlow);
    if (blocking.length > 0) {
      setSaveModal({ type: 'blocking', messages: blocking });
      return;
    }
    if (warnings.length > 0) {
      setSaveModal({ type: 'warning', messages: warnings });
      return;
    }
    doSave(liveFlow);
  }

  function handleTogglePin() {
    const next = { ...liveFlow, pinned: !liveFlow.pinned };
    setLiveFlow(next);
    onSave(next);
  }
  
  function handleTableSave(updatedFlow) {
    setLiveFlow(updatedFlow);
    onSave(updatedFlow);
    setHasChanges(false);
    setLogoReaction('wave');
  }

  return (
    <div className="min-h-screen" style={{ background: '#F5F8FC' }}>
      <header className="px-6 py-3 shadow-md flex items-center gap-4 sticky top-0 z-10"
        style={{ background: '#2A5598', color: 'white' }}>
        <button onClick={onBack} className="opacity-70 hover:opacity-100 text-base flex-shrink-0">← 返回</button>
        <img
          src={`${import.meta.env.BASE_URL}logo.png`}
          alt="FlowSprite Logo"
          className={`h-9 w-9 rounded-full object-cover flex-shrink-0 logo-happy ${logoReaction ? `logo-${logoReaction}` : ''}`}
          onError={e => { e.currentTarget.style.display = 'none'; }}
        />
        <div className="flex items-center gap-2 min-w-0">
          <input
            value={liveFlow.l3Number || ''}
            onChange={e => patch({ l3Number: e.target.value })}
            placeholder="L3 編號"
            className="w-24 px-2 py-1 rounded text-base bg-white bg-opacity-15 border border-white border-opacity-30 text-white placeholder-white placeholder-opacity-50 focus:outline-none focus:ring-1 focus:ring-white"
          />
          <input
            value={liveFlow.l3Name || ''}
            onChange={e => patch({ l3Name: e.target.value })}
            placeholder="L3 活動名稱"
            className="flex-1 min-w-0 px-2 py-1 rounded text-base bg-white bg-opacity-15 border border-white border-opacity-30 text-white placeholder-white placeholder-opacity-50 focus:outline-none focus:ring-1 focus:ring-white"
          />
        </div>
        <div className="ml-auto flex items-center gap-2 flex-shrink-0">
          {hasChanges && (
            <span className="text-sm text-yellow-300 font-medium hidden sm:inline">● 未儲存</span>
          )}
          {/* PR I: global reset for all manual endpoint overrides. Shown
              only when the current flow has at least one override — avoids
              an always-on destructive button. Opens a confirm modal. */}
          {liveFlow.tasks.some(t => t.connectionOverrides && Object.keys(t.connectionOverrides).length > 0) && (
            <button
              onClick={() => setResetAllModal(true)}
              title="重設所有手動拖曳的連線端點"
              className="px-3 py-1 text-sm rounded border border-white border-opacity-40 text-white hover:bg-white hover:bg-opacity-10">
              重設所有手動端點
            </button>
          )}
          <button
            onClick={handleTogglePin}
            title={liveFlow.pinned ? '取消置頂' : '置頂此工作流'}
            className="p-1.5 rounded transition-transform hover:scale-110">
            <svg width="20" height="20" viewBox="0 0 24 24"
              fill={liveFlow.pinned ? '#FBBF24' : 'none'}
              stroke={liveFlow.pinned ? '#FBBF24' : 'white'} strokeWidth="2"
              strokeLinejoin="round">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
          </button>
          <button
            onClick={() => setDrawerOpen(true)}
            title="開啟編輯面板"
            className="px-3 py-1.5 text-base rounded border border-white border-opacity-40 text-white hover:bg-white hover:bg-opacity-10 flex items-center gap-1">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z" />
            </svg>
            編輯
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-1.5 text-base rounded font-medium transition-colors"
            style={{ background: hasChanges ? '#7AB5DD' : '#6B7280', color: hasChanges ? '#1E4677' : 'white' }}>
            儲存
          </button>
        </div>
      </header>

      <main className="px-4 py-6 w-full max-w-full">
        {/* Diagram — always visible */}
        <DiagramRenderer flow={liveFlow} showExport={true}
          onUpdateOverride={updateConnectionOverride}
          onChangeTarget={changeConnectionTarget}
          onResetOverride={resetConnectionOverride}
          onTaskClick={(task, x, y) => setContextMenu({ task, x, y })}
          highlightedTaskId={contextMenu?.task?.id || null} />

        {/* Excel table — always visible (used to be a tab) */}
        <div className="mt-6 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden p-4">
          <FlowTable flow={liveFlow} onSave={handleTableSave} />
        </div>
      </main>

      {/* Drawer — hosts 設定流程 / 設定泳道角色 tabs */}
      <RightDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="編輯流程"
        tabs={[
          { key: 'flow',  label: '設定流程' },
          { key: 'roles', label: '設定泳道角色' },
        ]}
        activeTab={drawerTab}
        onTabChange={setDrawerTab}
      >
        {drawerTab === 'flow' && (() => {
          // Compute the future insertion slot (0..tasks.length) so we can
          // light up BOTH adjacent rows AND draw a dedicated drop-line
          // between them — far less ambiguous than highlighting just one.
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
          // Don't draw the line if it would land at the dragged row's own
          // index (a no-op drop) — feedback should reflect a real change.
          const showLineAt = (slot) => dropTargetSlot === slot
            && dragIdx !== null
            && slot !== dragIdx
            && slot !== dragIdx + 1;
          const DropLine = () => (
            <div className="relative h-0 my-[-4px]" aria-hidden="true">
              <div className="absolute inset-x-2 -translate-y-1/2 h-1.5 bg-blue-500 rounded-full shadow-md shadow-blue-300" />
            </div>
          );
          return (
            <div>
              <p className="text-sm text-gray-400 mb-3">▼ 點任務右側箭頭可展開說明、輸入、產出欄位</p>
              <div className="flex flex-col gap-2">
                {liveFlow.tasks.map((task, i) => (
                  <Fragment key={task.id}>
                    {showLineAt(i) && <DropLine />}
                    <TaskCard
                      task={task}
                      roles={liveFlow.roles || []}
                      allTasks={liveFlow.tasks}
                      displayLabels={displayLabels}
                      onUpdate={updated => updateTask(task.id, updated)}
                      onRemove={() => removeTask(task.id)}
                      canRemove={liveFlow.tasks.length > 1}
                      dragHandlers={rowProps(i)}
                      isDragging={dragIdx === i}
                      dropEdge={getDropEdge(i)}
                    />
                  </Fragment>
                ))}
                {showLineAt(liveFlow.tasks.length) && <DropLine />}
              </div>
              <button onClick={addTask}
                className="mt-3 w-full py-2 text-base border border-dashed border-blue-400 text-blue-600 rounded-lg hover:bg-blue-50 transition-colors">
                + 新增任務
              </button>
            </div>
          );
        })()}

        {drawerTab === 'roles' && (
          <div>
            <p className="text-base text-gray-500 mb-1">設定流程中的參與角色，變更後請點右上角「儲存」</p>
            <p className="text-sm text-gray-400 mb-3 flex items-center gap-1">
              <span className="text-gray-400">⠿</span> 可拖曳左側圓點改變泳道順序（由上到下）
            </p>
            <div className="flex flex-col gap-2">
              {(liveFlow.roles || []).map((role, i) => {
                const isOver = roleOverIdx === i && roleDragIdx !== i;
                const dropEdgeClass = isOver
                  ? (roleDropAfter ? 'border-b-2 border-blue-500' : 'border-t-2 border-blue-500')
                  : 'border-gray-200';
                return (
                  <div
                    key={role.id}
                    {...roleRowProps(i)}
                    className={`flex items-center gap-2 p-2 bg-gray-50 border rounded-lg transition-all select-none
                      ${roleDragIdx === i ? 'opacity-40 scale-95' : ''}
                      ${dropEdgeClass}`}>
                    <DragHandle />
                    <span className="text-sm text-gray-400 w-5 flex-shrink-0">#{i + 1}</span>
                    <input type="text" placeholder="角色名稱" value={role.name}
                      onChange={e => patch({ roles: liveFlow.roles.map(r => r.id === role.id ? { ...r, name: e.target.value } : r) })}
                      className="flex-1 px-3 py-1.5 border border-gray-300 rounded text-base focus:outline-none focus:ring-1 focus:ring-blue-400" />
                    <select value={role.type}
                      onChange={e => patch({ roles: liveFlow.roles.map(r => r.id === role.id ? { ...r, type: e.target.value } : r) })}
                      className="px-2 py-1.5 border border-gray-300 rounded text-base focus:outline-none"
                      style={{ background: role.type === 'external' ? '#009900' : '#0066CC', color: 'white' }}>
                      <option value="internal">內部角色</option>
                      <option value="external">外部角色</option>
                    </select>
                    <button
                      onClick={() => { if (liveFlow.roles.length > 1) patch({ roles: liveFlow.roles.filter(r => r.id !== role.id) }); }}
                      disabled={liveFlow.roles.length <= 1}
                      className="text-red-400 hover:text-red-600 disabled:opacity-20 text-xl leading-none">✕</button>
                  </div>
                );
              })}
            </div>
            <button
              onClick={() => patch({ roles: [...(liveFlow.roles || []), makeRole()] })}
              className="mt-3 w-full py-2 text-base border border-dashed border-blue-400 text-blue-600 rounded-lg hover:bg-blue-50 transition-colors">
              + 新增角色
            </button>
          </div>
        )}
      </RightDrawer>

      {/* ContextMenu — shown when user clicks a shape on the diagram */}
      {contextMenu && (
        <ContextMenu
          task={contextMenu.task}
          x={contextMenu.x}
          y={contextMenu.y}
          roles={liveFlow.roles || []}
          allTasks={liveFlow.tasks}
          displayLabels={displayLabels}
          onUpdate={(updated) => {
            updateTask(contextMenu.task.id, updated);
            // Reflect the edit in the menu's local task copy too.
            setContextMenu(prev => prev ? { ...prev, task: updated } : prev);
          }}
          onAddBefore={addTaskBefore}
          onAddAfter={addTaskAfter}
          onAddConnection={addConnection}
          onAddGateway={insertGatewayAfter}
          onDelete={removeTask}
          onClose={() => setContextMenu(null)}
        />
      )}

            <BackToTop />

      {saveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.45)' }}
          onClick={e => { if (e.target === e.currentTarget) setSaveModal(null); }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col">
            <div className={`px-6 py-4 border-b ${saveModal.type === 'blocking' ? 'border-red-200 bg-red-50' : 'border-amber-200 bg-amber-50'}`}>
              <h2 className={`text-xl font-bold ${saveModal.type === 'blocking' ? 'text-red-700' : 'text-amber-700'}`}>
                {saveModal.type === 'blocking' ? '⛔ 必要條件未達，無法儲存' : '⚠️ 有建議改善項目'}
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                {saveModal.type === 'blocking'
                  ? '修正以下問題後才能儲存：'
                  : '以下項目建議修正。您可以選擇仍然儲存，或取消並回去調整：'}
              </p>
            </div>
            <div className="px-6 py-4 max-h-80 overflow-y-auto">
              <ul className="text-base text-gray-700 space-y-1.5 list-disc list-inside">
                {saveModal.messages.map((m, i) => <li key={i}>{m}</li>)}
              </ul>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-2">
              <button
                onClick={() => setSaveModal(null)}
                className="px-4 py-2 rounded-lg text-base text-gray-700 hover:bg-gray-100 transition-colors">
                {saveModal.type === 'blocking' ? '知道了' : '取消'}
              </button>
              {saveModal.type === 'warning' && (
                <button
                  onClick={() => doSave(liveFlow)}
                  className="px-4 py-2 rounded-lg text-base text-white font-semibold transition-colors"
                  style={{ background: '#D97706' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#B45309'}
                  onMouseLeave={e => e.currentTarget.style.background = '#D97706'}>
                  仍然儲存
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* PR I: confirm modal for the global "重設所有手動端點" action.
          Destructive (can't undo) → require explicit confirmation. */}
      {resetAllModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.45)' }}
          onClick={e => { if (e.target === e.currentTarget) setResetAllModal(false); }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col">
            <div className="px-6 py-4 border-b border-amber-200 bg-amber-50">
              <h2 className="text-xl font-bold text-amber-700">⚠️ 重設所有手動端點</h2>
              <p className="text-sm text-gray-600 mt-1">此動作會清除本工作流所有連線的手動拖曳端點設定，回到自動路由。無法復原。</p>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-2">
              <button
                onClick={() => setResetAllModal(false)}
                className="px-4 py-2 rounded-lg text-base text-gray-700 hover:bg-gray-100 transition-colors">
                取消
              </button>
              <button
                onClick={resetAllOverrides}
                className="px-4 py-2 rounded-lg text-base text-white font-semibold transition-colors"
                style={{ background: '#D97706' }}
                onMouseEnter={e => e.currentTarget.style.background = '#B45309'}
                onMouseLeave={e => e.currentTarget.style.background = '#D97706'}>
                確定重設
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

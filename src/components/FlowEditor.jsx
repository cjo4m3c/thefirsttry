/**
 * FlowEditor — Unified view/edit page.
 * Shows the swimlane diagram (top) and a full task editor (bottom)
 * on the same page, with real-time diagram updates on save.
 *
 * Works for both use cases:
 *   1. From scratch (via Wizard → redirected here after save)
 *   2. From Excel import (opened directly in view/edit mode)
 */
import { useState, useMemo, useEffect } from 'react';
import DiagramRenderer from './DiagramRenderer.jsx';
import ConnectionSection from './ConnectionSection.jsx';
import FlowTable from './FlowTable.jsx';
import BackToTop from './BackToTop.jsx';
import { useDragReorder, DragHandle } from './dragReorder.jsx';
import {
  CONNECTION_TYPES, SHAPE_TYPES, CONN_BADGE, CONN_ROW_BG,
  makeTask, makeRole,
  normalizeTask, applyConnectionType, applySequentialDefaults,
  computeDisplayLabels,
} from '../utils/taskDefs.js';

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

  return { blocking, warnings };
}

// ── TaskCard ────────────────────────────────────────────────
function TaskCard({ task, roles, allTasks, displayLabels, onUpdate, onRemove, canRemove, dragHandlers, isDragging, isOver }) {
  const ct = task.connectionType || 'sequence';
  const badge = CONN_BADGE[ct];
  const num = displayLabels[task.id];
  const rowBg = CONN_ROW_BG[ct] || '#FAFAFA';
  const nameOptional = ct === 'start' || ct === 'end' || ct === 'breakpoint';
  const showShape = ct === 'sequence' || ct === 'subprocess';
  const [expanded, setExpanded] = useState(false);

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

        {/* Badge / number */}
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

        {/* Shape type (sequence/subprocess only) */}
        {showShape ? (
          <select value={task.shapeType || 'task'}
            onChange={e => { const st = e.target.value; onUpdate({ ...task, shapeType: st, type: st }); }}
            className="w-24 flex-shrink-0 px-2 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-400">
            {SHAPE_TYPES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        ) : <div className="w-24 flex-shrink-0" />}

        {/* Expand / collapse detail fields */}
        <button onClick={() => setExpanded(v => !v)}
          title={expanded ? '收合詳細欄位' : '展開詳細欄位'}
          className="w-6 flex-shrink-0 text-gray-400 hover:text-gray-600 text-sm">
          {expanded ? '▲' : '▼'}
        </button>

        {/* Remove */}
        <button onClick={onRemove} disabled={!canRemove}
          className="w-6 flex-shrink-0 text-red-400 hover:text-red-600 disabled:opacity-20 disabled:cursor-not-allowed text-sm">✕</button>
      </div>

      {/* Connection config */}
      <div className="px-3 pb-2.5">
        <ConnectionSection task={task} allTasks={allTasks} displayLabels={displayLabels} onUpdate={onUpdate} />
      </div>

      {/* Expandable detail fields */}
      {expanded && (
        <div className="px-3 pb-3 pt-1 border-t border-gray-100 grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1">
            <span className="text-xs text-gray-500">任務重點說明</span>
            <input type="text" value={task.description || ''} placeholder="重點說明（選填）"
              onChange={e => onUpdate({ ...task, description: e.target.value })}
              className="px-2 py-1 border border-gray-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-300" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-gray-500">任務重要輸入</span>
            <input type="text" value={task.inputItems || ''} placeholder="重要輸入（選填）"
              onChange={e => onUpdate({ ...task, inputItems: e.target.value })}
              className="px-2 py-1 border border-gray-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-300" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-gray-500">任務產出成品</span>
            <input type="text" value={task.outputItems || ''} placeholder="產出成品（選填）"
              onChange={e => onUpdate({ ...task, outputItems: e.target.value })}
              className="px-2 py-1 border border-gray-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-300" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-gray-500">參考資料來源文件名稱</span>
            <input type="text" value={task.reference || ''} placeholder="參考文件（選填）"
              onChange={e => onUpdate({ ...task, reference: e.target.value })}
              className="px-2 py-1 border border-gray-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-300" />
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
  const [activeTab, setActiveTab] = useState('flow'); // 'flow' | 'table' | 'roles'
  const [logoReaction, setLogoReaction] = useState(null); // 'wave' | null
  const [saveModal, setSaveModal] = useState(null); // { type: 'blocking'|'warning', messages: [] }
  
  useEffect(() => {
    if (!logoReaction) return;
    const timer = setTimeout(() => setLogoReaction(null), 900);
    return () => clearTimeout(timer);
  }, [logoReaction]);

  const displayLabels = useMemo(
    () => computeDisplayLabels(liveFlow.tasks, liveFlow.l3Number),
    [liveFlow.tasks, liveFlow.l3Number]
  );

  const { dragIdx, overIdx, rowProps } = useDragReorder(
    liveFlow.tasks,
    newTasks => patch({ tasks: applySequentialDefaults(newTasks) })
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

  function removeTask(id) {
    if (liveFlow.tasks.length <= 1) return;
    patch({ tasks: liveFlow.tasks.filter(t => t.id !== id) });
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
        <button onClick={onBack} className="opacity-70 hover:opacity-100 text-sm flex-shrink-0">← 返回</button>
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
            className="w-24 px-2 py-1 rounded text-sm bg-white bg-opacity-15 border border-white border-opacity-30 text-white placeholder-white placeholder-opacity-50 focus:outline-none focus:ring-1 focus:ring-white"
          />
          <input
            value={liveFlow.l3Name || ''}
            onChange={e => patch({ l3Name: e.target.value })}
            placeholder="L3 活動名稱"
            className="flex-1 min-w-0 px-2 py-1 rounded text-sm bg-white bg-opacity-15 border border-white border-opacity-30 text-white placeholder-white placeholder-opacity-50 focus:outline-none focus:ring-1 focus:ring-white"
          />
        </div>
        <div className="ml-auto flex items-center gap-2 flex-shrink-0">
          {hasChanges && (
            <span className="text-xs text-yellow-300 font-medium hidden sm:inline">● 未儲存</span>
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
            onClick={handleSave}
            className="px-4 py-1.5 text-sm rounded font-medium transition-colors"
            style={{ background: hasChanges ? '#7AB5DD' : '#6B7280', color: hasChanges ? '#1E4677' : 'white' }}>
            儲存
          </button>
        </div>
      </header>

      <main className="px-4 py-6 w-full max-w-full">
        {/* Diagram — always visible */}
        <DiagramRenderer flow={liveFlow} showExport={true} />

        {/* Tabs */}
        <div className="mt-6 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          {/* Tab bar */}
          <div className="flex border-b border-gray-200">
            {[
              { key: 'flow',  label: '設定流程' },
              { key: 'table', label: '詳細 Excel 清單' },
              { key: 'roles', label: '設定泳道角色' },
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.key
                    ? 'border-blue-600 text-blue-700 bg-blue-50'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                }`}>
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab: 設定流程 */}
          {activeTab === 'flow' && (
            <div className="p-4">
              <p className="text-xs text-gray-400 mb-3">▼ 點任務右側箭頭可展開說明、輸入、產出欄位</p>
              <div className="flex flex-col gap-2">
                {liveFlow.tasks.map((task, i) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    roles={liveFlow.roles || []}
                    allTasks={liveFlow.tasks}
                    displayLabels={displayLabels}
                    onUpdate={updated => updateTask(task.id, updated)}
                    onRemove={() => removeTask(task.id)}
                    canRemove={liveFlow.tasks.length > 1}
                    dragHandlers={rowProps(i)}
                    isDragging={dragIdx === i}
                    isOver={overIdx === i && dragIdx !== i}
                  />
                ))}
              </div>
              <button onClick={addTask}
                className="mt-3 w-full py-2 text-sm border border-dashed border-blue-400 text-blue-600 rounded-lg hover:bg-blue-50 transition-colors">
                + 新增任務
              </button>
            </div>
          )}

          {/* Tab: 詳細 Excel 清單 */}
          {activeTab === 'table' && (
            <div className="p-4">
              <FlowTable flow={liveFlow} onSave={handleTableSave} />
            </div>
          )}

          {/* Tab: 設定泳道角色 */}
          {activeTab === 'roles' && (
            <div className="p-4">
              <p className="text-sm text-gray-500 mb-3">設定流程中的參與角色，變更後請點右上角「儲存」</p>
              <div className="flex flex-col gap-2">
                {(liveFlow.roles || []).map((role, i) => (
                  <div key={role.id} className="flex items-center gap-2">
                    <span className="text-xs text-gray-400 w-5 flex-shrink-0">#{i + 1}</span>
                    <input type="text" placeholder="角色名稱" value={role.name}
                      onChange={e => patch({ roles: liveFlow.roles.map(r => r.id === role.id ? { ...r, name: e.target.value } : r) })}
                      className="flex-1 px-3 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-400" />
                    <select value={role.type}
                      onChange={e => patch({ roles: liveFlow.roles.map(r => r.id === role.id ? { ...r, type: e.target.value } : r) })}
                      className="px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none"
                      style={{ background: role.type === 'external' ? '#009900' : '#0066CC', color: 'white' }}>
                      <option value="internal">內部角色</option>
                      <option value="external">外部角色</option>
                    </select>
                    <button
                      onClick={() => { if (liveFlow.roles.length > 1) patch({ roles: liveFlow.roles.filter(r => r.id !== role.id) }); }}
                      disabled={liveFlow.roles.length <= 1}
                      className="text-red-400 hover:text-red-600 disabled:opacity-20 text-lg leading-none">✕</button>
                  </div>
                ))}
              </div>
              <button
                onClick={() => patch({ roles: [...(liveFlow.roles || []), makeRole()] })}
                className="mt-3 w-full py-2 text-sm border border-dashed border-blue-400 text-blue-600 rounded-lg hover:bg-blue-50 transition-colors">
                + 新增角色
              </button>
            </div>
          )}
        </div>
      </main>

            <BackToTop />

      {saveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.45)' }}
          onClick={e => { if (e.target === e.currentTarget) setSaveModal(null); }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col">
            <div className={`px-6 py-4 border-b ${saveModal.type === 'blocking' ? 'border-red-200 bg-red-50' : 'border-amber-200 bg-amber-50'}`}>
              <h2 className={`text-lg font-bold ${saveModal.type === 'blocking' ? 'text-red-700' : 'text-amber-700'}`}>
                {saveModal.type === 'blocking' ? '⛔ 必要條件未達，無法儲存' : '⚠️ 有建議改善項目'}
              </h2>
              <p className="text-xs text-gray-600 mt-1">
                {saveModal.type === 'blocking'
                  ? '修正以下問題後才能儲存：'
                  : '以下項目建議修正。您可以選擇仍然儲存，或取消並回去調整：'}
              </p>
            </div>
            <div className="px-6 py-4 max-h-80 overflow-y-auto">
              <ul className="text-sm text-gray-700 space-y-1.5 list-disc list-inside">
                {saveModal.messages.map((m, i) => <li key={i}>{m}</li>)}
              </ul>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-2">
              <button
                onClick={() => setSaveModal(null)}
                className="px-4 py-2 rounded-lg text-sm text-gray-700 hover:bg-gray-100 transition-colors">
                {saveModal.type === 'blocking' ? '知道了' : '取消'}
              </button>
              {saveModal.type === 'warning' && (
                <button
                  onClick={() => doSave(liveFlow)}
                  className="px-4 py-2 rounded-lg text-sm text-white font-semibold transition-colors"
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
    </div>
  );
}

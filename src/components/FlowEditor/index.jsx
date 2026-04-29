/**
 * FlowEditor — Unified view/edit page.
 * Shows the swimlane diagram (top) and a full task editor (bottom)
 * on the same page, with real-time diagram updates on save.
 *
 * Works for both use cases:
 *   1. From scratch (via Wizard → redirected here after save)
 *   2. From Excel import (opened directly in view/edit mode)
 */
import { useState, useMemo, useEffect, useRef } from 'react';
import DiagramRenderer from '../DiagramRenderer.jsx';
import FlowTable from '../FlowTable.jsx';
import BackToTop from '../BackToTop.jsx';
import RightDrawer from '../RightDrawer.jsx';
import ContextMenu from '../ContextMenu.jsx';
import { useDragReorder } from '../dragReorder.jsx';
import {
  normalizeTask, applySequentialDefaults, computeDisplayLabels,
} from '../../utils/taskDefs.js';
import { validateFlow } from './validateFlow.js';
import { useFlowActions } from './useFlowActions.js';
import { Header } from './Header.jsx';
import { DrawerContent } from './DrawerContent.jsx';
import { SaveModal, ResetAllModal } from './SaveModals.jsx';

export default function FlowEditor({ flow, onBack, onSave }) {
  const [liveFlow, setLiveFlow] = useState(() => ({
    ...flow,
    tasks: (flow.tasks || []).map(t => {
      const withIds = t.nextTaskIds?.length ? t : { ...t, nextTaskIds: t.nextTaskId ? [t.nextTaskId] : [] };
      return normalizeTask(withIds);
    }),
  }));
  const [hasChanges, setHasChanges] = useState(false);
  // Ref to DiagramRenderer's imperative export API (forwardRef +
  // useImperativeHandle exposes exportPng / exportDrawio / exportExcel).
  // Used by the Header download dropdown — each item calls
  // saveAndValidate(callback) which chains the export after the save+validate
  // pass succeeds.
  const diagramRef = useRef(null);
  const downloadHandlers = {
    png:    () => saveAndValidate(() => diagramRef.current?.exportPng()),
    drawio: () => saveAndValidate(() => diagramRef.current?.exportDrawio()),
    excel:  () => saveAndValidate(() => diagramRef.current?.exportExcel()),
  };
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

  function patch(updates) {
    setLiveFlow(prev => ({ ...prev, ...updates }));
    setHasChanges(true);
  }

  const taskDrag = useDragReorder(
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
  const roleDrag = useDragReorder(
    liveFlow.roles || [],
    newRoles => patch({ roles: newRoles })
  );

  // All graph mutations (addTask, addTaskAfter, insertGatewayAfter, ...)
  const actions = useFlowActions({ liveFlow, patch });

  function doSave(flow, onSuccess) {
    onSave(flow);
    setHasChanges(false);
    setLogoReaction('wave');
    setSaveModal(null);
    onSuccess?.();
  }

  // Shared validate-then-save flow used by both the header save button and
  // the three diagram export buttons (PNG / drawio / Excel). Callers pass
  // `onSuccess` so they can chain a download after the save completes.
  // Blocking errors abort entirely; warnings open the modal and the
  // "仍然儲存" button forwards the same `onSuccess` callback.
  function saveAndValidate(onSuccess) {
    const { blocking, warnings } = validateFlow(liveFlow);
    if (blocking.length > 0) {
      setSaveModal({ type: 'blocking', messages: blocking });
      return;
    }
    if (warnings.length > 0) {
      setSaveModal({ type: 'warning', messages: warnings, onSuccess });
      return;
    }
    doSave(liveFlow, onSuccess);
  }

  function handleSave() {
    saveAndValidate();
  }

  function handleTogglePin() {
    const next = { ...liveFlow, pinned: !liveFlow.pinned };
    setLiveFlow(next);
    onSave(next);
  }

  function handleResetAllConfirm() {
    actions.resetAllOverrides();
    setResetAllModal(false);
  }

  return (
    <div className="min-h-screen" style={{ background: '#F5F8FC' }}>
      <Header
        liveFlow={liveFlow} hasChanges={hasChanges} logoReaction={logoReaction}
        onBack={onBack} onPatch={patch}
        onTogglePin={handleTogglePin} onOpenDrawer={() => setDrawerOpen(true)}
        onSave={handleSave} onResetAllConfirm={() => setResetAllModal(true)}
        downloadHandlers={downloadHandlers} />

      <main className="px-4 py-6 w-full max-w-full">
        {/* Diagram — always visible. ref exposes exportPng/Drawio/Excel
            imperatively so the Header download dropdown can trigger them. */}
        <DiagramRenderer ref={diagramRef} flow={liveFlow}
          onUpdateOverride={actions.updateConnectionOverride}
          onChangeTarget={actions.changeConnectionTarget}
          onWireThroughGateway={actions.wireConnectionThroughGateway}
          onResetOverride={actions.resetConnectionOverride}
          onTaskClick={(task, x, y) => setContextMenu({ task, x, y })}
          highlightedTaskId={contextMenu?.task?.id || null} />

        {/* Excel table — always visible (used to be a tab) */}
        <div className="mt-6 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden p-4">
          <FlowTable flow={liveFlow} onUpdateTask={actions.updateTask} />
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
        <DrawerContent
          activeTab={drawerTab} liveFlow={liveFlow} displayLabels={displayLabels}
          taskDrag={taskDrag} roleDrag={roleDrag}
          onPatch={patch}
          onUpdateTask={actions.updateTask} onRemoveTask={actions.removeTask}
          onAddTask={actions.addTask}
          onAddTaskAt={(index) => {
            // Click-to-insert at exact slot.
            //   index 0           → before first task   = addTaskBefore(tasks[0])
            //   index N (1..len)  → after tasks[N-1]    = addTaskAfter(tasks[N-1])
            //   index >= len      → append at end       = addTask
            const tasks = liveFlow.tasks || [];
            if (index <= 0 && tasks[0]) actions.addTaskBefore(tasks[0].id);
            else if (index >= tasks.length) actions.addTask();
            else actions.addTaskAfter(tasks[index - 1].id);
          }}
          onAddInteraction={() => {
            // Append a task with shapeType=interaction at end of list. Reuses
            // addOtherAfter('interaction') if there's an anchor; falls back to
            // addTask + post-update for the empty-flow case.
            const tasks = liveFlow.tasks || [];
            if (tasks.length > 0) actions.addOtherAfter(tasks[tasks.length - 1].id, 'interaction');
            else actions.addTask();
          }} />
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
            actions.updateTask(contextMenu.task.id, updated);
            // Reflect the edit in the menu's local task copy too.
            setContextMenu(prev => prev ? { ...prev, task: updated } : prev);
          }}
          onAddAfter={actions.addTaskAfter}
          onAddConnection={actions.addConnection}
          onAddGateway={actions.insertGatewayAfter}
          onAddL3Activity={actions.addL3ActivityAfter}
          onAddOther={actions.addOtherAfter}
          onConvertType={actions.convertTaskType}
          onDelete={actions.removeTask}
          onClose={() => setContextMenu(null)}
        />
      )}

      <BackToTop />

      <SaveModal saveModal={saveModal}
        onCancel={() => setSaveModal(null)}
        onSaveAnyway={() => doSave(liveFlow, saveModal?.onSuccess)} />

      <ResetAllModal open={resetAllModal}
        onCancel={() => setResetAllModal(false)}
        onConfirm={handleResetAllConfirm} />
    </div>
  );
}

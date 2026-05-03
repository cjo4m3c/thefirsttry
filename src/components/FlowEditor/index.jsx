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
import { moveItem } from '../reorderButtons.jsx';
import {
  normalizeTask, applySequentialDefaults, computeDisplayLabels,
} from '../../utils/taskDefs.js';
import { validateFlow } from './validateFlow.js';
import { useFlowActions } from './useFlowActions.js';
import { Header } from './Header.jsx';
import { DrawerContent } from './DrawerContent.jsx';
import { SaveModal, ResetAllModal } from './SaveModals.jsx';
import {
  createStack as createUndoStack, push as pushUndo,
  undo as popUndo, redo as popRedo,
  canUndo as canUndoStack, canRedo as canRedoStack,
} from '../../utils/undoStack.js';

export default function FlowEditor({ flow, onBack, onSave }) {
  const [liveFlow, setLiveFlow] = useState(() => ({
    ...flow,
    tasks: (flow.tasks || []).map(t => {
      const withIds = t.nextTaskIds?.length ? t : { ...t, nextTaskIds: t.nextTaskId ? [t.nextTaskId] : [] };
      return normalizeTask(withIds);
    }),
  }));
  const [hasChanges, setHasChanges] = useState(false);
  // Undo/redo stack (50 steps, debounced 500ms, cleared on save).
  // Snapshot-based — push current liveFlow before mutation, restore on undo.
  const [undoStack, setUndoStack] = useState(createUndoStack);
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
    // Snapshot current liveFlow into the undo stack BEFORE applying. The
    // stack helper drops pushes within DEBOUNCE_MS so a typing burst
    // collapses to a single undo step (the pre-burst state).
    setUndoStack(prev => pushUndo(prev, structuredClone(liveFlow)));
    setLiveFlow(prev => ({ ...prev, ...updates }));
    setHasChanges(true);
  }

  function handleUndo() {
    const result = popUndo(undoStack, structuredClone(liveFlow));
    if (!result) return;
    setUndoStack(result.stack);
    setLiveFlow(result.snapshot);
    setHasChanges(true);
  }

  function handleRedo() {
    const result = popRedo(undoStack, structuredClone(liveFlow));
    if (!result) return;
    setUndoStack(result.stack);
    setLiveFlow(result.snapshot);
    setHasChanges(true);
  }

  // Reorder via ▲ ▼ buttons (replaced HTML5 drag 2026-04-30 — see
  // src/components/reorderButtons.jsx for the rationale). On task reorder
  // we strip stored l4Number so computeDisplayLabels re-sequences (without
  // this, imported tasks keep their original numbers and the visible order
  // diverges from the numbering — e.g. moving a new task between imported
  // 5-1-1-1 and 5-1-1-2 would still show NEW=5-1-1-4 + B=5-1-1-1).
  function moveTask(idx, dir) {
    const next = moveItem(liveFlow.tasks, idx, dir);
    if (next === liveFlow.tasks) return;
    const renumbered = next.map(t => {
      if (!t.l4Number) return t;
      const { l4Number, ...rest } = t;
      return rest;
    });
    patch({ tasks: applySequentialDefaults(renumbered) });
  }
  function moveRole(idx, dir) {
    const arr = liveFlow.roles || [];
    const next = moveItem(arr, idx, dir);
    if (next === arr) return;
    patch({ roles: next });
  }

  // All graph mutations (addTask, addTaskAfter, insertGatewayAfter, ...)
  const actions = useFlowActions({ liveFlow, patch });

  function doSave(flow, onSuccess) {
    onSave(flow);
    setHasChanges(false);
    setLogoReaction('wave');
    setSaveModal(null);
    // Per user spec 2026-05-03: clear undo + redo stacks on save. The saved
    // state is the new baseline — undo can't cross a save checkpoint.
    setUndoStack(createUndoStack());
    onSuccess?.();
  }

  // Ctrl+Z / Cmd+Z = undo; Ctrl+Y or Ctrl+Shift+Z = redo. Skip when focused
  // in input/textarea/select (browser native text-undo) or when a modal is
  // open (modal blocks user actions).
  useEffect(() => {
    function onKey(e) {
      const tag = e.target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || e.target?.isContentEditable) return;
      if (saveModal || resetAllModal) return;
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;
      if (e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      } else if (e.key === 'y' || (e.key === 'z' && e.shiftKey)) {
        e.preventDefault();
        handleRedo();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saveModal, resetAllModal, undoStack, liveFlow]);

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
        downloadHandlers={downloadHandlers}
        onUndo={handleUndo} onRedo={handleRedo}
        canUndo={canUndoStack(undoStack)} canRedo={canRedoStack(undoStack)} />

      <main className="px-4 py-6 w-full max-w-full">
        {/* Diagram — always visible. ref exposes exportPng/Drawio/Excel
            imperatively so the Header download dropdown can trigger them. */}
        <DiagramRenderer ref={diagramRef} flow={liveFlow}
          onUpdateOverride={actions.updateConnectionOverride}
          onChangeTarget={actions.changeConnectionTarget}
          onWireThroughGateway={actions.wireConnectionThroughGateway}
          onRemoveConnection={actions.removeConnection}
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
          onMoveTask={moveTask} onMoveRole={moveRole}
          onPatch={patch}
          onUpdateTask={actions.updateTask} onRemoveTask={actions.removeTask}
          onAddTaskAt={(index) => {
            // Click-to-insert plain L4 task at exact slot.
            //   index 0           → before first task   = addTaskBefore(tasks[0])
            //   index N (1..len)  → after tasks[N-1]    = addTaskAfter(tasks[N-1])
            //   index >= len      → append at end       = addTask
            const tasks = liveFlow.tasks || [];
            if (index <= 0 && tasks[0]) actions.addTaskBefore(tasks[0].id);
            else if (index >= tasks.length) actions.addTask();
            else actions.addTaskAfter(tasks[index - 1].id);
          }}
          onAddOtherAt={(index, kind, name) => {
            // start / end / interaction at exact slot:
            //   index 0          → before tasks[0]   = addOtherBefore
            //   index N (1..len) → after tasks[N-1]  = addOtherAfter
            //   index >= len     → after last task   = addOtherAfter
            const tasks = liveFlow.tasks || [];
            if (!tasks[0]) return;
            if (index <= 0) {
              actions.addOtherBefore(tasks[0].id, kind, name || '');
            } else {
              const anchorIdx = index >= tasks.length ? tasks.length - 1 : index - 1;
              actions.addOtherAfter(tasks[anchorIdx].id, kind, name || '');
            }
          }}
          onAddL3At={(index, l3Number, l3Name) => {
            const tasks = liveFlow.tasks || [];
            if (!tasks[0]) return;
            if (index <= 0) {
              actions.addL3ActivityBefore(tasks[0].id, l3Number, l3Name);
            } else {
              const anchorIdx = index >= tasks.length ? tasks.length - 1 : index - 1;
              actions.addL3ActivityAfter(tasks[anchorIdx].id, l3Number, l3Name);
            }
          }}
          onAddGatewayAt={(index, gatewayType, branches) => {
            const tasks = liveFlow.tasks || [];
            if (!tasks[0]) return;
            if (index <= 0) {
              actions.insertGatewayBefore(tasks[0].id, gatewayType, branches);
            } else {
              const anchorIdx = index >= tasks.length ? tasks.length - 1 : index - 1;
              actions.insertGatewayAfter(tasks[anchorIdx].id, gatewayType, branches);
            }
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

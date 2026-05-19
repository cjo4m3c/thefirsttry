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
import { saveFlow } from '../../utils/storage.js';
import DiagramRenderer from '../DiagramRenderer.jsx';
import FlowTable from '../FlowTable.jsx';
import BackToTop from '../BackToTop.jsx';
import { Callout } from '../ui/Callout.jsx';
import { ImportGroupList } from '../Dashboard/Banners.jsx';
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
import { useUndoRedo } from './useUndoRedo.js';
import { useSaveReminder } from './useSaveReminder.js';
import { makeDrawerInsertHandlers } from './drawerInsertHandlers.js';

export default function FlowEditor({ flow, onBack, onSave }) {
  const [liveFlow, setLiveFlow] = useState(() => ({
    ...flow,
    tasks: (flow.tasks || []).map(t => {
      const withIds = t.nextTaskIds?.length ? t : { ...t, nextTaskIds: t.nextTaskId ? [t.nextTaskId] : [] };
      return normalizeTask(withIds);
    }),
  }));
  const [hasChanges, setHasChanges] = useState(false);
  // Save success celebration — set true on every successful save for ~900ms
  // so the Header can run the flash + sparkle animation. Auto-clears.
  const [saveCelebrate, setSaveCelebrate] = useState(false);
  // Density mode (compact / default / spacious) — applied via CSS zoom on
  // the diagram wrapper. Persisted in localStorage so the user's preference
  // survives reloads. Per user spec 2026-05-04 後段：3 段、預設 1.0、PNG
  // 匯出時強制還原 1x（doPngExport 處理）。
  const [densityMode, setDensityMode] = useState(() => {
    try {
      const v = localStorage.getItem('flow-density-mode');
      return v === 'compact' || v === 'spacious' ? v : 'default';
    } catch { return 'default'; }
  });
  useEffect(() => {
    try { localStorage.setItem('flow-density-mode', densityMode); } catch {}
  }, [densityMode]);
  function cycleDensity() {
    setDensityMode(m => m === 'default' ? 'compact' : m === 'compact' ? 'spacious' : 'default');
  }
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

  // Undo/redo stack (50 steps, debounced 500ms, cleared on save). Hook also
  // installs the Ctrl+Z / Ctrl+Y keyboard listener.
  const { pushSnapshot, clear: clearUndo, canUndo, canRedo, handleUndo, handleRedo } =
    useUndoRedo({ liveFlow, setLiveFlow, setHasChanges, saveModal, resetAllModal });

  // Save-reminder pulse: 'none' / 'brief' (8s burst) / 'continuous' (until
  // user edits or saves). bumpEdit() is called from patch() on each edit;
  // resetPulse() is called from doSave() on success.
  const { pulseMode, bumpEdit, resetPulse } =
    useSaveReminder({ hasChanges, saveModal, resetAllModal });

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
    pushSnapshot();
    setLiveFlow(prev => ({ ...prev, ...updates }));
    setHasChanges(true);
    bumpEdit();  // resets the save-reminder idle timer
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
  // Click-to-insert handlers for DrawerContent — resolve index into the
  // appropriate before/after action call.
  const drawerHandlers = makeDrawerInsertHandlers({ liveFlow, actions });

  function doSave(flow, onSuccess) {
    onSave(flow);
    setHasChanges(false);
    setLogoReaction('wave');
    setSaveModal(null);
    // Per user spec 2026-05-03: clear undo + redo stacks on save. The saved
    // state is the new baseline — undo can't cross a save checkpoint.
    clearUndo();
    // Save-reminder reset — pulse stops, edit-duration anchor restarts on
    // next edit (so 3min/5min timers re-trigger from a fresh starting point).
    resetPulse();
    // Trigger celebration animation (Header reads saveCelebrate prop).
    setSaveCelebrate(true);
    setTimeout(() => setSaveCelebrate(false), 900);
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

  // PR-D12: dismiss import-warnings banner. Persists immediately (bypasses
  // validateFlow / hasChanges) so a single click clears the banner without
  // requiring a save action. 2026-05-13：清 importFixes + importNotices 兩個 array。
  function handleDismissImportWarnings() {
    const updated = { ...liveFlow, importFixes: [], importNotices: [] };
    setLiveFlow(updated);
    saveFlow(updated);
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
        canUndo={canUndo} canRedo={canRedo}
        savePulse={pulseMode} saveCelebrate={saveCelebrate}
        densityMode={densityMode} onCycleDensity={cycleDensity} />

      <main className="px-4 py-6 w-full max-w-full">
        {/* PR-D12: Excel import warnings banner — shows the auto-fix /
            cross-check messages saved on this flow at import time. User
            clicks ✕ to permanently dismiss (saves the cleared array to
            localStorage so reopening the flow doesn't re-show). */}
        {/* fixes（已自動改）/ notices（純提醒）兩段。Group 結構 PR #236：
            `{ l3, headline, details[] }`、ImportGroupList 縮排渲染。
            FlowEditor 單一 flow、用 hideL3 隱藏 [L3 N] prefix。 */}
        {(() => {
          const fixes = Array.isArray(liveFlow.importFixes) ? liveFlow.importFixes : [];
          const notices = Array.isArray(liveFlow.importNotices) ? liveFlow.importNotices : [];
          if (fixes.length === 0 && notices.length === 0) return null;
          const fixesCount = fixes.reduce((s, g) => s + (g?.details?.length ?? 0), 0);
          const noticesCount = notices.reduce((s, g) => s + (g?.details?.length ?? 0), 0);
          const parts = [];
          if (fixesCount > 0) parts.push(`系統已自動調整 ${fixesCount} 筆內容`);
          if (noticesCount > 0) parts.push(`另有 ${noticesCount} 筆建議檢視（未自動處理）`);
          const headline = `匯入提醒：${parts.join('；')}（建議檢視 Excel 原始檔對照）`;
          return (
            <Callout variant="warning" title={headline} onDismiss={handleDismissImportWarnings}>
              {fixes.length > 0 && (
                <div className="ml-1 mb-2">
                  <div className="font-semibold text-warning-ink mb-0.5">已自動調整（{fixesCount}）</div>
                  <div className="max-h-48 overflow-y-auto pr-1">
                    <ImportGroupList groups={fixes} hideL3 />
                  </div>
                </div>
              )}
              {notices.length > 0 && (
                <div className="ml-1">
                  <div className="font-semibold text-warning-ink mb-0.5">建議檢視（{noticesCount}）</div>
                  <div className="max-h-48 overflow-y-auto pr-1">
                    <ImportGroupList groups={notices} hideL3 />
                  </div>
                </div>
              )}
            </Callout>
          );
        })()}

        {/* Diagram — always visible. ref exposes exportPng/Drawio/Excel
            imperatively so the Header download dropdown can trigger them. */}
        <DiagramRenderer ref={diagramRef} flow={liveFlow}
          densityMode={densityMode}
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
          onAddTaskAt={drawerHandlers.onAddTaskAt}
          onAddOtherAt={drawerHandlers.onAddOtherAt}
          onAddL3At={drawerHandlers.onAddL3At}
          onAddGatewayAt={drawerHandlers.onAddGatewayAt} />
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

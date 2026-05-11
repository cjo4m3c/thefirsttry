import { useState, useEffect } from 'react';
import Dashboard from './components/Dashboard.jsx';
import Wizard from './components/Wizard.jsx';
import FlowEditor from './components/FlowEditor.jsx';
import { loadFlows, saveFlow, deleteFlow, cloneFlow } from './utils/storage.js';

export default function App() {
  const [view, setView] = useState('dashboard');
  const [flows, setFlows] = useState(() => loadFlows());
  const [activeFlowId, setActiveFlowId] = useState(null);

  // PR (2026-05-06): reset window scroll to top whenever the page-level
  // view switches. Without this, the browser preserves scroll position
  // across renders — so scrolling Dashboard down to find a flow → 編輯 →
  // FlowEditor would land scrolled at the bottom (over FlowTable) instead
  // of the diagram. Same effect when navigating Dashboard → Wizard or
  // back from FlowEditor. activeFlowId is included so re-entering the
  // same view for a different flow also scrolls top.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [view, activeFlowId]);

  function refreshFlows() { setFlows(loadFlows()); }

  function handleNew() { setActiveFlowId(null); setView('wizard'); }

  function handleEdit(id) { setActiveFlowId(id); setView('view'); }

  function handleSave(flow) {
    const duplicate = flows.find(f => f.id !== flow.id && f.l3Number && f.l3Number === flow.l3Number);
    if (duplicate) {
      if (!window.confirm(
        `L3 編號「${flow.l3Number}」已被活動「${duplicate.l3Name}」使用，確定要儲存？\n（建議先修改編號以避免重複）`
      )) return;
    }
    saveFlow(flow);
    refreshFlows();
    // After saving from Wizard, go to FlowEditor so user can see diagram immediately
    setActiveFlowId(flow.id);
    setView('view');
  }

  function handleDelete(id) { deleteFlow(id); refreshFlows(); }

  function handleTogglePin(id) {
    const flow = flows.find(f => f.id === id);
    if (!flow) return;
    saveFlow({ ...flow, pinned: !flow.pinned });
    refreshFlows();
  }

  function handleCancel() { setView('dashboard'); }

  /** Save edits made in FlowEditor without leaving the page. */
  function handleViewSave(flow) {
    const duplicate = flows.find(f => f.id !== flow.id && f.l3Number && f.l3Number === flow.l3Number);
    if (duplicate) {
      if (!window.confirm(
        `L3 編號「${flow.l3Number}」已被活動「${duplicate.l3Name}」使用，確定要儲存？`
      )) return;
    }
    saveFlow(flow);
    refreshFlows();
  }

  /**
   * Clone an existing flow with a new L3 number / name. Re-uses the same
   * window.confirm dup-check as handleSave / handleViewSave so behaviour
   * stays consistent (撞號可存、提醒一致）。On success drops the user into
   * FlowEditor on the new flow.
   */
  function handleClone(source, { newL3Number, newL3Name }) {
    const cloned = cloneFlow(source, { newL3Number, newL3Name });
    if (!cloned) return;
    const duplicate = flows.find(f => f.l3Number && f.l3Number === cloned.l3Number);
    if (duplicate) {
      if (!window.confirm(
        `L3 編號「${cloned.l3Number}」已被活動「${duplicate.l3Name}」使用，確定要建立複本？\n（建議先修改編號以避免重複）`
      )) return;
    }
    saveFlow(cloned);
    refreshFlows();
    setActiveFlowId(cloned.id);
    setView('view');
  }

  function handleImportExcel(importedFlows, mode = 'keep') {
    // mode='overwrite': delete every existing flow whose l3Number matches an
    // imported one (only those L3 numbers, not the whole list), so the user
    // can re-import a single activity cleanly. mode='keep' leaves existing
    // flows untouched (duplicates will coexist).
    if (mode === 'overwrite') {
      const importedNums = new Set(importedFlows.map(f => f.l3Number).filter(Boolean));
      flows.forEach(f => {
        if (importedNums.has(f.l3Number)) deleteFlow(f.id);
      });
    }
    importedFlows.forEach(f => saveFlow(f));
    refreshFlows();
    if (importedFlows.length === 1) {
      setActiveFlowId(importedFlows[0].id);
      setView('view');
    } else {
      setView('dashboard');
    }
  }

  const activeFlow = activeFlowId ? flows.find(f => f.id === activeFlowId) ?? null : null;

  if (view === 'wizard') {
    return <Wizard flow={activeFlow} onSave={handleSave} onCancel={handleCancel} />;
  }

  if (view === 'view') {
    return (
      <FlowEditor
        flow={activeFlow}
        onBack={handleCancel}
        onSave={handleViewSave}
      />
    );
  }

  return (
    <Dashboard
      flows={flows}
      onNew={handleNew}
      onEdit={handleEdit}
      onDelete={handleDelete}
      onImportExcel={handleImportExcel}
      onTogglePin={handleTogglePin}
      onClone={handleClone}
    />
  );
}

import { useState } from 'react';
import Dashboard from './components/Dashboard.jsx';
import Wizard from './components/Wizard.jsx';
import FlowEditor from './components/FlowEditor.jsx';
import { loadFlows, saveFlow, deleteFlow } from './utils/storage.js';

export default function App() {
  const [view, setView] = useState('dashboard');
  const [flows, setFlows] = useState(() => loadFlows());
  const [activeFlowId, setActiveFlowId] = useState(null);

  function refreshFlows() { setFlows(loadFlows()); }

  function handleNew() { setActiveFlowId(null); setView('wizard'); }

  function handleEdit(id) { setActiveFlowId(id); setView('view'); }

  function handleView(id) { setActiveFlowId(id); setView('view'); }

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

  function handleImportExcel(importedFlows) {
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
      onView={handleView}
      onDelete={handleDelete}
      onImportExcel={handleImportExcel}
      onTogglePin={handleTogglePin}
    />
  );
}

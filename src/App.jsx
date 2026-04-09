import { useState } from 'react';
import Dashboard from './components/Dashboard.jsx';
import Wizard from './components/Wizard.jsx';
import FlowViewer from './components/FlowViewer.jsx';
import { loadFlows, saveFlow, deleteFlow } from './utils/storage.js';

export default function App() {
  const [view, setView] = useState('dashboard');
  const [flows, setFlows] = useState(() => loadFlows());
  const [activeFlowId, setActiveFlowId] = useState(null);

  function refreshFlows() { setFlows(loadFlows()); }

  function handleNew() { setActiveFlowId(null); setView('wizard'); }

  function handleEdit(id) { setActiveFlowId(id); setView('wizard'); }

  function handleView(id) { setActiveFlowId(id); setView('view'); }

  function handleSave(flow) { saveFlow(flow); refreshFlows(); setView('dashboard'); }

  function handleDelete(id) { deleteFlow(id); refreshFlows(); }

  function handleCancel() { setView('dashboard'); }

  function handleImportExcel(flow) {
    saveFlow(flow);
    refreshFlows();
    setActiveFlowId(flow.id);
    setView('view');
  }

  const activeFlow = activeFlowId ? flows.find(f => f.id === activeFlowId) ?? null : null;

  if (view === 'wizard') {
    return <Wizard flow={activeFlow} onSave={handleSave} onCancel={handleCancel} />;
  }

  if (view === 'view') {
    return (
      <FlowViewer
        flow={activeFlow}
        onBack={handleCancel}
        onEdit={() => handleEdit(activeFlowId)}
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
    />
  );
}

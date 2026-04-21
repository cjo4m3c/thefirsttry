const FLOWS_KEY = 'bpm_flows_v1';

function normalizeNumber(raw) {
  return raw == null ? raw : String(raw).replace(/\./g, '-');
}

function migrateFlow(flow) {
  if (!flow) return flow;
  const tasks = Array.isArray(flow.tasks)
    ? flow.tasks.map(t => (t && t.l4Number ? { ...t, l4Number: normalizeNumber(t.l4Number) } : t))
    : flow.tasks;
  return { ...flow, l3Number: normalizeNumber(flow.l3Number), tasks };
}

export function loadFlows() {
  try {
    const raw = localStorage.getItem(FLOWS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.map(migrateFlow) : [];
  } catch {
    return [];
  }
}

export function saveFlow(flow) {
  const flows = loadFlows();
  const idx = flows.findIndex(f => f.id === flow.id);
  const now = new Date().toISOString();
  const updated = { ...flow, updatedAt: now };
  if (idx >= 0) {
    flows[idx] = updated;
  } else {
    flows.push({ ...updated, createdAt: now });
  }
  localStorage.setItem(FLOWS_KEY, JSON.stringify(flows));
}

export function deleteFlow(flowId) {
  const flows = loadFlows().filter(f => f.id !== flowId);
  localStorage.setItem(FLOWS_KEY, JSON.stringify(flows));
}

export function generateId() {
  return crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/** Today's date as `yyyymmdd` (zero-padded). Used as suffix in download filenames. */
export function todayYmd() {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
}

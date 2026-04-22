const FLOWS_KEY = 'bpm_flows_v1';

function normalizeNumber(raw) {
  return raw == null ? raw : String(raw).replace(/\./g, '-');
}

/**
 * Legacy gateways (created before the `_g` rule was enforced) may have
 * l4Numbers like "1-1-1-3". The canonical form is the preceding task's
 * number + `_g` suffix (`_g`, `_g1`, `_g2`…). This migration walks each
 * flow in task order, and for any gateway whose l4Number lacks `_g`,
 * rewrites it to ${predecessor}_g (or _g2, _g3 if siblings already use
 * _g / _g1).
 */
function migrateGatewaySuffix(tasks) {
  if (!Array.isArray(tasks)) return tasks;
  const needsFix = tasks.some(t =>
    t && t.type === 'gateway' && t.l4Number && !/_g\d*$/.test(String(t.l4Number))
  );
  if (!needsFix) return tasks;

  const updated = tasks.map(t => (t ? { ...t } : t));
  const countByBase = {};

  // First pass: count already-suffixed gateways per base to avoid collisions
  updated.forEach(t => {
    if (!t || t.type !== 'gateway' || !t.l4Number) return;
    const m = String(t.l4Number).match(/^(\d+-\d+-\d+-\d+)_g(\d*)$/);
    if (m) countByBase[m[1]] = (countByBase[m[1]] || 0) + 1;
  });

  // Second pass: fix gateways that lack _g, using the nearest preceding
  // non-gateway task as the base.
  for (let i = 0; i < updated.length; i++) {
    const t = updated[i];
    if (!t || t.type !== 'gateway' || !t.l4Number) continue;
    if (/_g\d*$/.test(String(t.l4Number))) continue;

    let base = null;
    for (let j = i - 1; j >= 0; j--) {
      const prev = updated[j];
      if (prev && prev.type === 'task' && prev.l4Number) {
        base = String(prev.l4Number).replace(/_g\d*$/, '');
        break;
      }
    }
    if (!base) base = String(t.l4Number);  // fallback: reuse own number as base

    const taken = countByBase[base] || 0;
    t.l4Number = taken === 0 ? `${base}_g` : `${base}_g${taken + 1}`;
    countByBase[base] = taken + 1;
  }
  return updated;
}

function migrateFlow(flow) {
  if (!flow) return flow;
  let tasks = Array.isArray(flow.tasks)
    ? flow.tasks.map(t => (t && t.l4Number ? { ...t, l4Number: normalizeNumber(t.l4Number) } : t))
    : flow.tasks;
  tasks = migrateGatewaySuffix(tasks);
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

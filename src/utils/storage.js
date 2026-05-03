import { syncTasksToRoles } from './elementTypes.js';

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

/**
 * Legacy subprocess calls (l3activity tasks created before the `_s` rule
 * was added in 2026-04) may have l4Numbers like "1-1-1-3" that consume a
 * counter slot. The canonical form anchors the suffix on the predecessor
 * task: `${predecessor}_s` (or _s2, _s3… for consecutive subprocess calls
 * sharing the same anchor). This walks tasks in order; for any l3activity
 * whose l4Number lacks `_s`, rewrites to `${predecessor}_s` (sibling-aware).
 *
 * Mirrors `migrateGatewaySuffix` — kept separate so spec changes to either
 * suffix can land independently.
 */
function migrateSubprocessSuffix(tasks) {
  if (!Array.isArray(tasks)) return tasks;
  const needsFix = tasks.some(t =>
    t && t.type === 'l3activity' && t.l4Number && !/_s\d*$/.test(String(t.l4Number))
  );
  if (!needsFix) return tasks;

  const updated = tasks.map(t => (t ? { ...t } : t));
  const countByBase = {};

  updated.forEach(t => {
    if (!t || t.type !== 'l3activity' || !t.l4Number) return;
    const m = String(t.l4Number).match(/^(\d+-\d+-\d+-\d+)_s(\d*)$/);
    if (m) countByBase[m[1]] = (countByBase[m[1]] || 0) + 1;
  });

  for (let i = 0; i < updated.length; i++) {
    const t = updated[i];
    if (!t || t.type !== 'l3activity' || !t.l4Number) continue;
    if (/_s\d*$/.test(String(t.l4Number))) continue;

    let base = null;
    for (let j = i - 1; j >= 0; j--) {
      const prev = updated[j];
      // Anchor must be a counter-claiming element (regular task) or start.
      if (prev && (prev.type === 'task' || prev.type === 'start') && prev.l4Number) {
        base = String(prev.l4Number).replace(/(_g\d*|_s\d*)$/, '');
        break;
      }
    }
    if (!base) base = String(t.l4Number);  // fallback: reuse own number

    const taken = countByBase[base] || 0;
    t.l4Number = taken === 0 ? `${base}_s` : `${base}_s${taken + 1}`;
    countByBase[base] = taken + 1;
  }
  return updated;
}

/**
 * PR H — clean stale `connectionOverrides` keys when loading from storage.
 * An override key goes stale when:
 *   - (regular task) the targetId it points at has been deleted
 *   - (gateway) the condId it points at has been removed
 * Stale keys can't be interpreted and cause silent confusion in the diagram.
 * Drop them at load time so downstream (layout, UI) sees only valid overrides.
 */
function cleanStaleOverrides(tasks) {
  if (!Array.isArray(tasks)) return tasks;
  const validTaskIds = new Set(tasks.map(t => t?.id).filter(Boolean));
  const condIdsByGateway = new Map();
  tasks.forEach(t => {
    if (t?.type === 'gateway') {
      condIdsByGateway.set(t.id, new Set((t.conditions || []).map(c => c.id)));
    }
  });
  return tasks.map(t => {
    const ov = t?.connectionOverrides;
    if (!ov || typeof ov !== 'object' || Object.keys(ov).length === 0) return t;
    const cleaned = {};
    for (const [key, value] of Object.entries(ov)) {
      if (t.type === 'gateway') {
        const valid = condIdsByGateway.get(t.id);
        if (valid && valid.has(key)) cleaned[key] = value;
      } else {
        if (validTaskIds.has(key)) cleaned[key] = value;
      }
    }
    return { ...t, connectionOverrides: cleaned };
  });
}

/**
 * PR-B 2026-04-29: drop the legacy "merge" connectionType variants. The
 * editor menu no longer offers them — merge is now derived from incoming-
 * edge count. Existing data:
 *   - gateway + parallel-merge / conditional-merge / inclusive-merge
 *     → flip to the matching -branch (gateway type unchanged; conditions
 *     stay; formatConnection auto-emits "X合併" when ≥2 incoming).
 *   - non-gateway with merge connectionType (rare / inconsistent legacy):
 *     → fall back to 'sequence'.
 */
function migrateMergeConnectionType(tasks) {
  if (!Array.isArray(tasks)) return tasks;
  const MERGE_TO_BRANCH = {
    'parallel-merge':    'parallel-branch',
    'conditional-merge': 'conditional-branch',
    'inclusive-merge':   'inclusive-branch',
  };
  let changed = false;
  const next = tasks.map(t => {
    if (!t) return t;
    const replacement = MERGE_TO_BRANCH[t.connectionType];
    if (!replacement) return t;
    changed = true;
    if (t.type === 'gateway') {
      return { ...t, connectionType: replacement };
    }
    return { ...t, connectionType: 'sequence' };
  });
  return changed ? next : tasks;
}

/**
 * 2026-04-30: external-interaction tasks now use the `_w` suffix (analogous
 * to `_g` / `_s`). Pre-PR data has them numbered as regular L4 tasks (e.g.
 * `1-1-5-3`); strip those stored l4Numbers so computeDisplayLabels re-derives
 * with the correct `_w` suffix on next render. Idempotent — only acts on
 * shapeType='interaction' tasks whose l4Number lacks `_w`.
 */
function migrateInteractionSuffix(tasks) {
  if (!Array.isArray(tasks)) return tasks;
  const needsFix = tasks.some(t =>
    t && t.shapeType === 'interaction'
      && t.type === 'task'  // exclude gateway / l3activity / start / end
      && t.l4Number && !/_w\d*$/.test(String(t.l4Number))
  );
  if (!needsFix) return tasks;
  return tasks.map(t => {
    if (t && t.shapeType === 'interaction' && t.type === 'task'
        && t.l4Number && !/_w\d*$/.test(String(t.l4Number))) {
      const { l4Number, ...rest } = t;
      return rest;
    }
    return t;
  });
}

function migrateFlow(flow) {
  if (!flow) return flow;
  let tasks = Array.isArray(flow.tasks)
    ? flow.tasks.map(t => (t && t.l4Number ? { ...t, l4Number: normalizeNumber(t.l4Number) } : t))
    : flow.tasks;
  tasks = migrateGatewaySuffix(tasks);
  tasks = migrateSubprocessSuffix(tasks);
  tasks = migrateInteractionSuffix(tasks);
  tasks = migrateMergeConnectionType(tasks);
  tasks = cleanStaleOverrides(tasks);
  // 2026-04-30: one-time fixup so tasks living in external-role lanes use
  // shapeType='interaction' and tasks in internal lanes use shapeType='task'.
  // After this, the auto-sync runs on every roleId / role.type edit so
  // mismatches don't reappear. Idempotent — returns same array when already
  // in sync (most loads after the first).
  tasks = syncTasksToRoles(tasks, flow.roles || []);
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

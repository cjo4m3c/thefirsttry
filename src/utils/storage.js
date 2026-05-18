import { applyExternalPrefixToRoles } from './elementTypes.js';
import {
  normalizeNumber,
  migrateGatewaySuffix,
  migrateSubprocessSuffix,
  migrateInteractionSuffix,
  migrateEndSuffix,
  migrateMergeConnectionType,
  migrateTaskMeta,
  migrateTypeFromL4Suffix,
  migrateImportWarningsToFixes,
  cleanStaleOverrides,
} from './storage/migrations.js';

const FLOWS_KEY = 'bpm_flows_v1';

function migrateFlow(flow) {
  if (!flow) return flow;
  let tasks = Array.isArray(flow.tasks)
    ? flow.tasks.map(t => (t && t.l4Number ? { ...t, l4Number: normalizeNumber(t.l4Number) } : t))
    : flow.tasks;
  tasks = migrateTypeFromL4Suffix(tasks);  // PR-D10: L4 suffix → type
  tasks = migrateGatewaySuffix(tasks);
  tasks = migrateSubprocessSuffix(tasks);
  tasks = migrateInteractionSuffix(tasks);
  // 2026-05-13: end events get `_x{K}` when multi-end exists (spec
  // alignment with external BPMN / Excel rule). Auto-rewrite legacy
  // multi-end on `-99` only, and gap-fix mis-numbered `_x` runs. The
  // fix list goes into importWarnings via loadFlows below.
  const endFix = migrateEndSuffix(tasks, flow.l3Number);
  tasks = endFix.tasks;
  tasks = migrateMergeConnectionType(tasks);
  tasks = migrateTaskMeta(tasks);
  tasks = cleanStaleOverrides(tasks);
  // 2026-05-05 (symmetric strict rule): no longer cascade-fix shape on load.
  // Pre-existing mismatches (e.g. internal-lane interaction from the old
  // asymmetric era) stay as data; the diagram surfaces them via red-border
  // violations (flowSelectors.getLaneShapeViolations) so the user can decide
  // whether to fix. Cascade still runs on explicit role.type / roleId edits
  // (Wizard / DrawerContent / TaskCard / ContextMenu).
  // PR-D4: ensure `[外部角色]` prefix on legacy external roles missing it.
  // Idempotent — same-ref when already prefixed.
  const roles = applyExternalPrefixToRoles(flow.roles || []);
  // 2026-05-13: 把舊版單一 importWarnings array 拆成 importFixes + importNotices。
  // Idempotent — 已拆過的 flow（有 importFixes/importNotices 任一）跳過。
  const { importFixes, importNotices } = migrateImportWarningsToFixes(flow);
  const out = { ...flow, l3Number: normalizeNumber(flow.l3Number), tasks, roles, importFixes, importNotices };
  if ('importWarnings' in out) delete out.importWarnings;  // 舊欄位不再使用
  // Stash end-suffix fixes on the flow; loadFlows turns them into an
  // importWarning entry and persists the rewritten data so the notice
  // fires once. Underscore-prefixed key so it can't collide with real
  // flow fields and gets stripped before persist.
  if (endFix.fixes.length > 0) out._endMigrationFixes = endFix.fixes;
  return out;
}

export function loadFlows() {
  try {
    const raw = localStorage.getItem(FLOWS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    const flows = parsed.map(migrateFlow);
    let mutated = false;
    flows.forEach(f => {
      if (!f._endMigrationFixes) return;
      const diffs = f._endMigrationFixes
        .map(x => `${x.before} → ${x.after}`).join('、');
      const msg = `🔧 結束事件編號已自動更新（多結束事件對齊 BPMN 規則）：${diffs}`;
      // 2026-05-13：寫進 importFixes（這是 fix、不是純提醒）。
      f.importFixes = [...(Array.isArray(f.importFixes) ? f.importFixes : []), msg];
      delete f._endMigrationFixes;
      mutated = true;
    });
    if (mutated) {
      try { localStorage.setItem(FLOWS_KEY, JSON.stringify(flows)); } catch { /* quota / disabled */ }
    }
    return flows;
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
    // 尊重 caller 帶的 createdAt（例：overwrite 匯入會保留舊 createdAt）；
    // 真正新建（沒帶 createdAt）才用 now。
    flows.push({ ...updated, createdAt: flow.createdAt || now });
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

/**
 * Deep-clone an existing flow into a brand-new one. Used by Dashboard
 * 「複製」button so the user can fork a finished L3 工作流 to make a
 * variant without re-typing tasks / roles / aux-field values.
 *
 * Identity rewrites (everything that referenced an old uuid is repointed
 * to the corresponding new uuid):
 *   - flow.id, every task.id, every role.id, every gateway condition.id
 *   - task.roleId → new role uuid
 *   - task.nextTaskIds[] → new task uuids
 *   - task.conditions[].nextTaskId → new task uuids
 *   - task.connectionOverrides keys (task uuids for regular tasks, condition
 *     uuids for gateways) → corresponding new uuid
 *
 * Reset (per spec):
 *   - l3Number / l3Name → caller-supplied
 *   - pinned → false
 *   - importFixes / importNotices / flowAnnotation → cleared (源 Excel 匯入歷史，不該跟著複本走)
 *   - createdAt / updatedAt → left undefined (saveFlow sets them)
 *   - tasks[].l4Number → stripped (computeDisplayLabels regenerates from new L3)
 *
 * Preserved (deep copy, raw values stay):
 *   - tasks[].meta (30 個輔助欄位)
 *   - tasks[].subprocessName ("5-2-8" 樣的 raw L3 字串，跨流程引用)
 *   - everything else in task / role objects
 */
export function cloneFlow(source, { newL3Number, newL3Name }) {
  if (!source) return null;
  const roleIdMap = new Map();
  const taskIdMap = new Map();
  const condIdMap = new Map();

  const newRoles = (source.roles || []).map(r => {
    const newId = generateId();
    if (r?.id) roleIdMap.set(r.id, newId);
    return { ...r, id: newId };
  });

  // First pass: allocate new ids for every task + every gateway condition
  // so the second pass can resolve forward references regardless of order.
  (source.tasks || []).forEach(t => {
    if (!t) return;
    if (t.id) taskIdMap.set(t.id, generateId());
    (t.conditions || []).forEach(c => {
      if (c?.id) condIdMap.set(c.id, generateId());
    });
  });

  const remapTaskId = id => taskIdMap.get(id) || '';
  const remapCondId = id => condIdMap.get(id) || id;

  const newTasks = (source.tasks || []).map(t => {
    if (!t) return t;
    const { l4Number, ...rest } = t;  // strip l4Number — recomputed from new L3
    const next = {
      ...rest,
      id: taskIdMap.get(t.id) || generateId(),
      roleId: roleIdMap.get(t.roleId) || t.roleId || '',
      nextTaskIds: (t.nextTaskIds || []).map(id => (id ? remapTaskId(id) : id)),
      conditions: (t.conditions || []).map(c => ({
        ...c,
        id: condIdMap.get(c.id) || generateId(),
        nextTaskId: c.nextTaskId ? remapTaskId(c.nextTaskId) : '',
      })),
      meta: t.meta ? { ...t.meta } : {},
    };
    if (t.connectionOverrides && typeof t.connectionOverrides === 'object') {
      const remapKey = t.type === 'gateway' ? remapCondId : remapTaskId;
      const newOv = {};
      for (const [k, v] of Object.entries(t.connectionOverrides)) {
        const newK = remapKey(k);
        if (newK) newOv[newK] = v;
      }
      next.connectionOverrides = newOv;
    }
    return next;
  });

  return {
    id: generateId(),
    l3Number: newL3Number,
    l3Name: newL3Name,
    roles: newRoles,
    tasks: newTasks,
    pinned: false,
    importFixes: [],
    importNotices: [],
  };
}

/** Today's date as `yyyymmdd` (zero-padded). Used as suffix in download filenames. */
export function todayYmd() {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
}

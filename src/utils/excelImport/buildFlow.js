/**
 * Per-L3-group flow builder. Takes the rows for a single L3 (already grouped
 * by `parseExcelToFlow`) and produces the in-memory flow object: roles,
 * tasks (with annotations resolved into nextTaskIds / conditions),
 * synthetic start/end if missing, role-type detection.
 *
 * Detached from the orchestrator (PR 2026-05-06) so excelImport.js stays
 * under the 15KB soft cap.
 */
import { generateId } from '../storage.js';
import { parseConnection } from '../../model/connectionFormat.js';
import { applyExternalPrefixToRoles, applyStripExternalPrefixToRoles } from '../elementTypes.js';
import { detectGatewayType, detectKindFromL4 } from './detectors.js';
import { readAuxMeta } from './aux.js';

// PR (2026-05-06): when a gateway branch reads「調用子流程 X-Y-Z」,
// parseConnection encodes it as `__sub__:X-Y-Z` in branchToNumbers (etc).
// resolveBranchTarget then either reuses an existing `<gatewayBase>_s\d*`
// l3activity element pointing to the same called L3, or auto-creates one
// at the gateway's anchor — surfacing to the user as a「已自動調整」warning.
const SUB_MARKER_RE = /^__sub__:(.+)$/;

function nextSubprocessSuffix(taskByNumber, base) {
  if (!taskByNumber[`${base}_s`]) return `${base}_s`;
  let n = 1;
  while (taskByNumber[`${base}_s${n}`]) n++;
  return `${base}_s${n}`;
}

const COL_L3_NUMBER = 0;
const COL_L3_NAME   = 1;
const COL_L4_NUMBER = 2;
const COL_L4_NAME   = 3;
const COL_L4_ROLE   = 6;
const COL_L4_FLOW   = 8;

function normalizeL3Number(raw) {
  return String(raw ?? '').trim().replace(/\./g, '-');
}

export function buildFlow(rows, auxColMap = {}) {
  const firstRow = rows[0];
  const l3Number = normalizeL3Number(firstRow[COL_L3_NUMBER]);
  const l3Name   = String(firstRow[COL_L3_NAME] ?? '').trim();

  // ── Roles ───────────────────────────────────────────────────
  const roleNameToId = {};
  const roles = [];
  rows.forEach(row => {
    const name = String(row[COL_L4_ROLE] ?? '').trim();
    if (name && !roleNameToId[name]) {
      const id = generateId();
      roleNameToId[name] = id;
      roles.push({ id, name, type: 'internal' });
    }
  });
  if (roles.length === 0) throw new Error(`L3「${l3Name}」：找不到任務負責角色資料（第 7 欄）`);

  // ── First pass: stubs ──────────────────────────────────────
  const taskByNumber = {};
  const taskList     = [];
  const annotationOf = {};

  rows.forEach(row => {
    const l4Num    = String(row[COL_L4_NUMBER] ?? '').trim();
    const l4Name   = String(row[COL_L4_NAME]   ?? '').trim();
    const roleName = String(row[COL_L4_ROLE]   ?? '').trim();
    const roleId   = roleNameToId[roleName] ?? roles[0].id;
    const flowText = String(row[COL_L4_FLOW]   ?? '');

    const ann = parseConnection(flowText);
    // PR-D10 (2026-05-05): L4 number suffix is the SOT for element type.
    // Body's fork keyword only refines gateway sub-type (xor/and/or); name
    // prefix is informational, surfaced as warning if it disagrees.
    const taskType = detectKindFromL4(l4Num);
    const isInteraction = /_e\d*$/.test(l4Num);
    const isSubprocess  = taskType === 'l3activity';
    const gTypeFromBody = detectGatewayType(ann);
    // Default XOR when L4 says gateway but body has no fork keyword (decision 2).
    // The validateNumbering layer already surfaces a warning so the user knows.
    const gType = taskType === 'gateway' ? (gTypeFromBody || 'xor') : null;

    // PR-D6: always set shapeType explicitly for type='task' rows so
    // detectRoleTypes (and getLaneShapeViolations) can count them — leaving
    // shapeType undefined caused regular tasks to be skipped, which made
    // mixed-role detection wrongly mark internal+_e roles as external.
    const taskShapeType = taskType === 'task'
      ? (isInteraction ? 'interaction' : 'task')
      : undefined;
    const task = {
      id: generateId(),
      name: l4Name || l4Num,
      type: taskType,
      roleId,
      ...(taskShapeType ? { shapeType: taskShapeType } : {}),
      ...(taskType === 'gateway'
        ? { gatewayType: gType, conditions: [] }
        : { nextTaskIds: [] }),
      ...(taskType === 'start' ? { connectionType: 'start' } : {}),
      ...(taskType === 'end'   ? { connectionType: 'end'   } : {}),
      ...(isSubprocess ? { connectionType: 'subprocess', subprocessName: ann.subprocessL3 || '' } : {}),
      l4Number:       l4Num,
      description:    String(row[4] ?? '').trim(),
      inputItems:     String(row[5] ?? '').trim(),
      outputItems:    String(row[7] ?? '').trim(),
      reference:      String(row[9] ?? '').trim(),
      flowAnnotation: flowText,
      meta:           readAuxMeta(row, auxColMap),
    };

    taskByNumber[l4Num] = task;
    taskList.push(task);
    annotationOf[task.id] = ann;
  });

  // ── Second pass: resolve outgoing connections ────────────────────────────
  // PR (2026-05-06): track auto-added L3 activity elements so the orchestrator
  // can surface them as「已自動調整」 warnings.
  const autoSubAdds = [];

  taskList.forEach(task => {
    const ann = annotationOf[task.id];

    if (task.type === 'gateway') {
      const seen = new Set();
      // Resolve a branch entry's target id. Plain L4 numbers come straight
      // from `taskByNumber`; 「調用子流程 X-Y-Z」 entries (encoded as
      // `__sub__:X-Y-Z` by splitForkEntries) reuse an existing `_s` element
      // at this gateway's anchor or auto-create one. `branchLabel` is captured
      // for the warning message ("由閘道 G 的「label」分支建立").
      const resolveBranchTarget = (n, branchLabel) => {
        const subMatch = SUB_MARKER_RE.exec(String(n || ''));
        if (!subMatch) return taskByNumber[n]?.id;
        const calledL3 = subMatch[1];
        const base = (task.l4Number || '').replace(/_g\d*$/, '');
        if (!base) return undefined;
        // Reuse: any existing `<base>_s\d*` element pointing to same called L3.
        const existing = taskList.find(t =>
          t.type === 'l3activity'
          && t.subprocessName === calledL3
          && (t.l4Number || '').startsWith(`${base}_s`)
        );
        if (existing) return existing.id;
        // Auto-create a new _s element at this anchor.
        const newL4 = nextSubprocessSuffix(taskByNumber, base);
        const synth = {
          id: generateId(),
          name: `[L3 流程] 調用 ${calledL3}`,
          type: 'l3activity',
          shapeType: 'l3activity',
          connectionType: 'subprocess',
          subprocessName: calledL3,
          roleId: task.roleId || '',
          l4Number: newL4,
          nextTaskIds: [],
          flowAnnotation: '',
          description: '',
          inputItems: '',
          outputItems: '',
          reference: '',
          meta: {},
        };
        taskByNumber[newL4] = synth;
        taskList.push(synth);
        annotationOf[synth.id] = parseConnection('');
        autoSubAdds.push({
          gateway: task.l4Number || '',
          sub: newL4,
          calledL3,
          branchLabel,
        });
        return synth.id;
      };
      const addCond = (toId, label = '') => {
        if (!toId || seen.has(toId)) return;
        seen.add(toId);
        task.conditions.push({ id: generateId(), label, nextTaskId: toId });
      };

      if (task.gatewayType === 'and') {
        ann.parallelToNumbers.forEach((n, i) => {
          const lbl = ann.parallelLabels[i] || '';
          addCond(resolveBranchTarget(n, lbl), lbl);
        });
        ann.parallelMergeNextNums.forEach(n => addCond(resolveBranchTarget(n, ''), ''));
      } else if (task.gatewayType === 'or') {
        ann.inclusiveToNumbers.forEach((n, i) => {
          const lbl = ann.inclusiveLabels[i] || '';
          addCond(resolveBranchTarget(n, lbl), lbl);
        });
        ann.inclusiveMergeNextNums.forEach(n => addCond(resolveBranchTarget(n, ''), ''));
      } else {
        ann.branchToNumbers.forEach((n, i) => {
          const lbl = ann.branchLabels[i] || '';
          addCond(resolveBranchTarget(n, lbl), lbl);
        });
        ann.condMergeNextNums.forEach(n => addCond(resolveBranchTarget(n, ''), ''));
      }
      ann.nextTaskNumbers.forEach(n => addCond(resolveBranchTarget(n, ''), ''));

    } else if (task.type !== 'end') {
      // Regular task: merge sequential + loop-back targets into nextTaskIds.
      //   loopConditions yields [backTarget, forwardTarget] (legacy)
      //   loopBackNumbers yields [backTarget] (new simple syntax)
      const loopNums = [
        ...ann.loopConditions.map(lc => lc.nextNum),
        ...ann.loopBackNumbers,
      ];
      const combined = [...ann.nextTaskNumbers, ...loopNums]
        .filter((v, i, a) => a.indexOf(v) === i);
      task.nextTaskIds = combined.map(n => taskByNumber[n]?.id).filter(Boolean);
    }
  });

  // ── Start / End event handling ─────────────────────────────────────
  // If the Excel has rows explicitly marked "開始事件"/"結束事件", use them as the
  // start/end node directly. Otherwise fall back to auto-creating synthetic nodes.
  const explicitStart = taskList.find(t => t.type === 'start');
  const explicitEnd   = taskList.find(t => t.type === 'end');

  let syntheticStart = null;
  if (!explicitStart) {
    const startTargets = taskList.filter(t => annotationOf[t.id].isStart);
    if (startTargets.length === 0 && taskList[0]) startTargets.push(taskList[0]);
    syntheticStart = {
      id: generateId(), name: '開始', type: 'start', connectionType: 'start',
      roleId: startTargets[0]?.roleId ?? roles[0].id,
      nextTaskIds: startTargets.map(t => t.id),
    };
  }

  let syntheticEnd = null;
  if (!explicitEnd) {
    syntheticEnd = {
      id: generateId(), name: '結束', type: 'end', connectionType: 'end',
      roleId: taskList[taskList.length - 1]?.roleId ?? roles[0].id,
      nextTaskIds: [],
    };
  }

  // Connect dangling tasks: only add edges to synthetic end if it exists
  const endFallbackId = syntheticEnd?.id ?? explicitEnd?.id ?? null;
  if (endFallbackId) {
    taskList.forEach(task => {
      if (task.id === endFallbackId) return;
      const ann = annotationOf[task.id];
      if (task.type === 'gateway') {
        if (ann.isEnd) task.conditions.push({ id: generateId(), label: '', nextTaskId: endFallbackId });
        if (task.conditions.length === 0) task.conditions.push({ id: generateId(), label: '', nextTaskId: endFallbackId });
      } else if (task.type !== 'end' && task.type !== 'start') {
        if (ann.isEnd || task.nextTaskIds.length === 0) {
          if (!task.nextTaskIds.includes(endFallbackId)) task.nextTaskIds.push(endFallbackId);
        }
      }
    });
  }

  const finalTasks = [];
  if (syntheticStart) finalTasks.push(syntheticStart);
  finalTasks.push(...taskList);
  if (syntheticEnd) finalTasks.push(syntheticEnd);

  // PR-D5: detect role.type from row distribution per user spec rules 7 + 8:
  //   • role with only `_e` (interaction) lane-sensitive rows → external
  //   • role with only regular task rows → internal
  //   • role with mixed task + `_e` rows → internal (rule 8); the `_e` rows
  //     stay shapeType=interaction and get surfaced via PR-D3 red border on
  //     the diagram + FlowTable so the user can fix manually
  //   • role with no lane-sensitive rows (only start/end/gateway/l3activity)
  //     → internal (default; can't infer either way)
  // PR-D4 prefix automation: external roles get `[外部角色]` auto-added.
  // PR (2026-05-05) prefix strip: internal roles whose Excel name still
  // carries `[外部角色]` (e.g. mixed-role Excel where detectRoleTypes
  // demoted external→internal but the typed name kept the prefix) get
  // the prefix stripped so type / name stay consistent.
  const typedRoles = detectRoleTypes(roles, finalTasks);
  const withPrefix = applyExternalPrefixToRoles(typedRoles);
  const withStrip  = applyStripExternalPrefixToRoles(withPrefix);
  return {
    id: generateId(), l3Number, l3Name,
    roles: withStrip,
    tasks: finalTasks,
    // PR (2026-05-06): non-persistent — orchestrator extracts to global
    // warnings list, then deletes before storage save (prefixed `__` so
    // it's clear this is internal scaffolding, not persistent flow data).
    __autoSubAdds: autoSubAdds,
  };
}

/**
 * Per-role role.type detection (PR-D5). Walks lane-sensitive tasks
 * (type='task' with shapeType in {task, interaction}) and votes per
 * roleId. Pure function. See callsite for spec.
 */
function detectRoleTypes(roles, tasks) {
  if (!Array.isArray(roles) || !Array.isArray(tasks)) return roles;
  // Tally lane-sensitive shape counts per role.
  const counts = new Map();  // roleId → { task: n, interaction: n }
  tasks.forEach(t => {
    if (t.type !== 'task' || !t.roleId) return;
    if (t.shapeType !== 'task' && t.shapeType !== 'interaction') return;
    let c = counts.get(t.roleId);
    if (!c) { c = { task: 0, interaction: 0 }; counts.set(t.roleId, c); }
    c[t.shapeType] += 1;
  });
  return roles.map(r => {
    const c = counts.get(r.id);
    if (!c) return r;  // no lane-sensitive evidence → leave default (internal)
    if (c.interaction > 0 && c.task === 0) return { ...r, type: 'external' };
    // c.task > 0 (only-task or mixed) → internal. Mixed leaves the `_e` rows
    // as interaction-on-internal-lane violations, picked up by PR-D3's red
    // border so the user knows to review.
    return r;
  });
}

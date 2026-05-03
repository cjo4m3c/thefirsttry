/**
 * Flow validation model layer (PR-7).
 *
 * Pre-save validation for one flow. Split into two tiers so the user can
 * still save an imperfect draft:
 *   blocking  — hard stops (no save button will work until fixed)
 *   warnings  — soft checks surfaced as a confirm dialog; user chooses
 *               whether to save anyway or go back to fix them.
 *
 * Pure function — no React, no I/O, no view-layer imports. The override
 * detector (`detectOverrideViolations`) lives in `src/diagram/violations.js`
 * because it needs `computeLayout` to inspect routing decisions; that's
 * still allowed since `diagram/` is also infra (not view).
 *
 * Used by:
 *   - FlowEditor save flow (existing): blocking shows toast, warnings open
 *     a confirm modal.
 *   - Excel import (PR-7 new): warnings get appended to the import banner
 *     so the user sees orphan tasks / missing role / etc. immediately
 *     rather than only after opening the editor.
 *
 * `src/components/FlowEditor/validateFlow.js` re-exports `validateFlow`
 * from this module so the existing save-flow importer keeps working.
 */
import { detectOverrideViolations } from '../diagram/violations.js';
import { getTaskIncoming } from './flowSelectors.js';

function isStart(t) { return t.connectionType === 'start' || t.type === 'start'; }
function isEnd(t)   { return t.connectionType === 'end' || t.connectionType === 'breakpoint' || t.type === 'end'; }

export function validateFlow(flow) {
  const tasks = flow.tasks || [];
  const blocking = [];
  const warnings = [];

  const startTasks = tasks.filter(isStart);
  const endTasks   = tasks.filter(isEnd);

  // Count incoming connections per task so we can detect unconnected nodes
  // and validate merge-gateway arity.
  const incoming = getTaskIncoming(tasks);

  // ── Blocking checks ───────────────────────────────────
  if (startTasks.length === 0) blocking.push('必須要有「流程開始」節點');
  if (endTasks.length === 0)   blocking.push('必須要有「流程結束」或「流程斷點」節點');

  startTasks.forEach(s => {
    const outs = (s.nextTaskIds || []).filter(Boolean);
    if (outs.length === 0) blocking.push('「流程開始」必須連接到其他任務元件');
    // PR-A 2026-04-30: start must have NO incoming. Backstops the
    // converters fix (P1-1) — if any other code path sneaks an incoming
    // edge onto a start, save is blocked.
    if (incoming[s.id] > 0) {
      blocking.push(`「流程開始」「${s.name || '（未命名）'}」不能有任何元件連接到它（BPMN 規定）`);
    }
  });
  endTasks.forEach(e => {
    if (!(incoming[e.id] > 0)) blocking.push('「流程結束」/「流程斷點」必須有其他任務連接到它');
  });

  // ── Multi-start / multi-end warnings (2026-04-29) ──────────────
  // User decision: allow multiple start / end events but surface a save-time
  // notice so the user can confirm the topology was intentional.
  if (startTasks.length >= 2) {
    warnings.push(`流程有 ${startTasks.length} 個「流程開始」節點。BPMN 一般建議單一起點，請確認是否刻意設計多個入口`);
  }
  if (endTasks.length >= 2) {
    warnings.push(`流程有 ${endTasks.length} 個「流程結束 / 流程斷點」節點。多個終點可接受（不同情境收尾），請確認是否刻意設計`);
  }

  // ── Warning-level checks ───────────────────────────────
  tasks.forEach((t, i) => {
    const ct = t.connectionType || 'sequence';
    const label = `任務 ${i + 1}「${t.name || '未命名'}」`;

    // 1. Non-end nodes must have next step.
    if (!isEnd(t)) {
      const hasNext = t.type === 'gateway'
        ? (t.conditions || []).some(c => c.nextTaskId)
        : (t.nextTaskIds || []).some(Boolean);
      if (!hasNext) {
        if (t.type === 'l3activity') {
          warnings.push(`${label}（L3 活動 ${t.subprocessName || '未填編號'}）：未設定下一步。若該 L3 流向另一張流程圖可忽略此提醒，否則請補上連線`);
        } else {
          warnings.push(`${label}：未設定下一步`);
        }
      }
    }

    // PR-B 2026-04-29: removed parallel-merge / conditional-merge /
    // inclusive-merge connection types. Merge is now derived from
    // incoming-edge count, so these "needs ≥2 incoming" warnings no
    // longer apply (the merge text only appears when ≥2 incoming
    // already exists). Old saved data is migrated to -branch by
    // storage.migrateMergeConnectionType.

    // 3c. Inclusive-branch needs ≥2 conditions wired up.
    if (ct === 'inclusive-branch' && (t.conditions || []).filter(c => c.nextTaskId).length < 2) {
      warnings.push(`${label}：包容分支至少需要 2 個目標`);
    }

    // 3c-bis (2026-04-30): any gateway should have ≥2 branch conditions.
    // If the user deletes a branch via "click connection → Delete" until only
    // 1 remains, the gateway loses fork semantics and confuses future
    // readers. Warning only — user can still save if they meant it
    // (e.g., transitional editing state).
    if (t.type === 'gateway' && (t.conditions || []).length < 2) {
      const gtLabel = t.gatewayType === 'and' ? '並行' : t.gatewayType === 'or' ? '包容' : '排他';
      warnings.push(`${label}（${gtLabel}閘道）：閘道應有至少 2 條分支，目前只有 ${(t.conditions || []).length} 條`);
    }

    // 3d. Gateway without roleId — soft warning. Since gateway is shown in
    // dropdowns regardless of roleId, this catches the user before save.
    if (t.type === 'gateway' && !t.roleId) {
      warnings.push(`${label}：闘道未指定泳道角色`);
    }

    // 3e (restored 2026-04-30 後段): warn when shapeType=interaction sits
    // on an internal-role lane. Per updated user spec, internal lanes ALLOW
    // interaction (not blocked) but should be reviewed — typical use is on
    // external lanes; mixing reads as accidental. syncTasksToRoles only
    // force-converts internal→external (not the reverse), so this case
    // can legitimately occur via TaskCard "外部互動" pick / Excel `_w` row.
    if (t.shapeType === 'interaction' && t.type === 'task' && t.roleId) {
      const role = (flow.roles || []).find(r => r.id === t.roleId);
      if (role && role.type === 'internal') {
        warnings.push(`${label}：外部互動任務「${t.name || '（未命名）'}」放在內部角色泳道「${role.name || '（未命名）'}」，建議改放外部角色泳道（仍可儲存）`);
      }
    }

    // 4. Every node except start must have incoming (already blocking for end,
    //    this catches orphan middle nodes).
    if (!isStart(t) && !(incoming[t.id] > 0)) {
      if (t.type === 'l3activity') {
        warnings.push(`${label}（L3 活動 ${t.subprocessName || '未填編號'}）：沒有任何任務連接到此節點。若該 L3 從另一張流程圖進入可忽略此提醒，否則請補上連線`);
      } else {
        warnings.push(`${label}：沒有任何任務連接到此節點`);
      }
    }

    // 5. Loop-return must specify target.
    if (ct === 'loop-return') {
      const target = (t.nextTaskIds || [])[0];
      if (!target) warnings.push(`${label}：迴圈返回必須指定目標任務`);
    }
  });

  // PR H — override-induced violations. Blocking: IN+OUT mix on same port.
  // Warning: line crosses another task. Auto-routing already avoids both,
  // so these only fire when a user override forces the condition.
  const { blocking: ovBlocking, warnings: ovWarnings } = detectOverrideViolations(flow);
  return {
    blocking: [...blocking, ...ovBlocking],
    warnings: [...warnings, ...ovWarnings],
  };
}

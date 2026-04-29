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
  });
  endTasks.forEach(e => {
    if (!(incoming[e.id] > 0)) blocking.push('「流程結束」/「流程斷點」必須有其他任務連接到它');
  });

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

    // 2. Parallel-merge needs ≥2 incoming.
    if (ct === 'parallel-merge' && (incoming[t.id] || 0) < 2) {
      warnings.push(`${label}：並行合併至少需要 2 個來源`);
    }

    // 3. Conditional-merge needs ≥2 incoming.
    if (ct === 'conditional-merge' && (incoming[t.id] || 0) < 2) {
      warnings.push(`${label}：條件合併至少需要 2 個來源`);
    }

    // 3b. Inclusive-merge needs ≥2 incoming.
    if (ct === 'inclusive-merge' && (incoming[t.id] || 0) < 2) {
      warnings.push(`${label}：包容合併至少需要 2 個來源`);
    }

    // 3c. Inclusive-branch needs ≥2 conditions wired up.
    if (ct === 'inclusive-branch' && (t.conditions || []).filter(c => c.nextTaskId).length < 2) {
      warnings.push(`${label}：包容分支至少需要 2 個目標`);
    }

    // 3d. Gateway without roleId — soft warning. Since gateway is shown in
    // dropdowns regardless of roleId, this catches the user before save.
    if (t.type === 'gateway' && !t.roleId) {
      warnings.push(`${label}：闘道未指定泳道角色`);
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

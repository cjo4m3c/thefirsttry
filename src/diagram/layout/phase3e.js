/**
 * Phase 3e — apply user-defined manual endpoint overrides.
 *
 * User can drag a connection's source/target endpoint to a different port
 * in DiagramRenderer; the override is stored on the SOURCE task as
 * `task.connectionOverrides[key]` where
 *   key = target's task id         (regular task → anything)
 *   key = condition.id             (gateway → any condition target)
 * value = { exitSide?, entrySide? } (either may be missing to keep auto)
 *
 * Applying overrides last (after all auto-phases) ensures that:
 *   1. Slot allocation in sections 5–8 sees the FINAL routing and puts
 *      overridden top→top / bottom→bottom edges into corridor slots.
 *   2. Auto-routing's port-mix tracking (portIn / portOut) is complete;
 *      override violations are detected via `validateFlow`.
 *
 * For non-gateway tasks we funnel overrides into `taskCrossLaneRouting`
 * (clearing any earlier entry in the other two maps) so section 5/6b and
 * section 10 — which already consult all three maps in order — find the
 * override regardless of which auto-phase first placed the edge.
 *
 * Mutates: ctx.condRouting, ctx.taskBackwardRouting,
 *          ctx.taskForwardRouting, ctx.taskCrossLaneRouting
 */
export function runPhase3e(ctx) {
  const { tasks, taskIdSetAll, condRouting,
          taskBackwardRouting, taskForwardRouting, taskCrossLaneRouting } = ctx;

  tasks.forEach(task => {
    const overrides = task.connectionOverrides;
    if (!overrides || typeof overrides !== 'object') return;
    const keys = Object.keys(overrides);
    if (keys.length === 0) return;

    if (task.type === 'gateway') {
      (task.conditions || []).forEach(cond => {
        const ov = overrides[cond.id];
        if (!ov || !cond.nextTaskId) return;
        const key = `${task.id}::${cond.id}`;
        const base = condRouting.get(key) || { exitSide: 'right', entrySide: 'left' };
        condRouting.set(key, {
          exitSide:  ov.exitSide  ?? base.exitSide,
          entrySide: ov.entrySide ?? base.entrySide,
        });
      });
    } else if (task.type !== 'end') {
      // start 也走這條路徑（之前漏了 — start 有 outgoing、可以被 user 拖端點
      // 改 port，但 phase3e 排除 start 導致 override 寫進 storage 卻不被 apply、
      // 視覺上「拉不動」。end 沒有 outgoing → 沒 override、留 defensive check）。
      const nextIds = task.nextTaskIds?.length
        ? task.nextTaskIds
        : (task.nextTaskId ? [task.nextTaskId] : []);
      nextIds.forEach(toId => {
        const ov = overrides[toId];
        if (!ov || !toId || !taskIdSetAll.has(toId)) return;
        const key = `${task.id}::${toId}`;
        const base = taskBackwardRouting.get(key)
                  ?? taskForwardRouting.get(key)
                  ?? taskCrossLaneRouting.get(key)
                  ?? { exitSide: 'right', entrySide: 'left' };
        const final = {
          exitSide:  ov.exitSide  ?? base.exitSide,
          entrySide: ov.entrySide ?? base.entrySide,
        };
        taskBackwardRouting.delete(key);
        taskForwardRouting.delete(key);
        taskCrossLaneRouting.set(key, final);
      });
    }
  });
}

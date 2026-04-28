import {
  hasIn, hasOut, useIn, useOut,
  isColInsideTopRange, registerTopCorridor,
} from './corridor.js';

/**
 * Phase 3b — non-gateway backward edge corridor decision.
 *
 * A regular task's backward nextTaskId (e.g. 迴圈返回至 X) is drawn as
 * top→top by default. If the top corridor at that row is already taken
 * by a gateway condition (registered in Phase 3), route this backward
 * edge via bottom→bottom instead, so it doesn't overlap.
 *
 * Bottom→bottom edges join the existing slot-allocation pipeline
 * (step 5) so the lane auto-expands to fit.
 *
 * Mutates: ctx.taskBackwardRouting, ctx.topCorridorByRow, ctx.portIn, ctx.portOut
 */
export function runPhase3b(ctx) {
  const { tasks, taskRowOf, taskColOf, taskIdSetAll, taskBackwardRouting } = ctx;

  tasks.forEach(task => {
    if (task.type === 'end' || task.type === 'gateway' || task.type === 'start') return;
    const nextIds = task.nextTaskIds?.length ? task.nextTaskIds : (task.nextTaskId ? [task.nextTaskId] : []);
    const fr = taskRowOf[task.id], fc = taskColOf[task.id];
    nextIds.forEach(toId => {
      if (!toId || !taskIdSetAll.has(toId)) return;
      const tr = taskRowOf[toId], tc = taskColOf[toId];
      if (tr === undefined || tc === undefined) return;
      const isBackward = (tc < fc) || (tc === fc && tr < fr);
      if (!isBackward) return;

      // Prefer top corridor; if source's column is strictly inside any
      // already-registered top corridor range (an earlier gateway / task
      // already routes a line above this column), the new edge's vertical
      // exit would cross that line — fall back to the bottom corridor.
      const row = Math.min(fr, tr);
      const minCol = Math.min(fc, tc);
      const maxCol = Math.max(fc, tc);
      // Priority: rule 1 (no port-mix) > rule 2 (no visual crossing).
      //   top clean → top; top bad but bottom mix-free → bottom;
      //   both bad → top (crossing is visual-only; mix violates stricter rule 1).
      const topMix    = hasIn(ctx, task.id, 'top')    || hasOut(ctx, toId, 'top');
      const bottomMix = hasIn(ctx, task.id, 'bottom') || hasOut(ctx, toId, 'bottom');
      const topCross  = isColInsideTopRange(ctx, row, fc) || isColInsideTopRange(ctx, row, tc);
      const topBad    = topMix || topCross;
      const useBottom = topBad && !bottomMix;
      if (useBottom) {
        taskBackwardRouting.set(`${task.id}::${toId}`, { exitSide: 'bottom', entrySide: 'bottom' });
        useOut(ctx, task.id, 'bottom'); useIn(ctx, toId, 'bottom');
      } else {
        taskBackwardRouting.set(`${task.id}::${toId}`, { exitSide: 'top', entrySide: 'top' });
        registerTopCorridor(ctx, row, minCol, maxCol);
        useOut(ctx, task.id, 'top'); useIn(ctx, toId, 'top');
      }
    });
  });
}

/**
 * Phase 3c — non-gateway forward edge obstacle avoidance.
 *
 * A regular task → another-task / end forward edge with dc > 1 (skips at
 * least one column) on the same row would draw a straight right→left line
 * that passes through every intermediate column — visually blocked by
 * any element in between. Route such edges via the top corridor instead
 * (unless top corridor is already taken for that span, in which case
 * fall back to bottom → bottom with slot allocation).
 *
 * `taskForwardRouting` mirrors `taskBackwardRouting` and feeds step 10.
 *
 * Mutates: ctx.taskForwardRouting, ctx.topCorridorByRow, ctx.portIn, ctx.portOut
 */
export function runPhase3c(ctx) {
  const { tasks, taskRowOf, taskColOf, taskIdSetAll, taskBackwardRouting, taskForwardRouting } = ctx;

  tasks.forEach(task => {
    if (task.type === 'end' || task.type === 'gateway' || task.type === 'start') return;
    const nextIds = task.nextTaskIds?.length ? task.nextTaskIds : (task.nextTaskId ? [task.nextTaskId] : []);
    const fr = taskRowOf[task.id], fc = taskColOf[task.id];
    nextIds.forEach(toId => {
      if (!toId || !taskIdSetAll.has(toId)) return;
      if (taskBackwardRouting.has(`${task.id}::${toId}`)) return;  // backward handled already
      const tr = taskRowOf[toId], tc = taskColOf[toId];
      if (tr === undefined || tc === undefined) return;
      const dc = tc - fc, dr = tr - fr;
      // Only redirect forward edges that actually skip columns on the same row.
      if (dr !== 0 || dc <= 1) return;

      // Prefer top corridor. But if either endpoint's column sits strictly
      // inside an earlier-registered top corridor range, the new edge's
      // vertical exit/entry segment would cross that line — fall back to
      // bottom corridor so the crossing doesn't happen.
      const row = fr;
      const minCol = Math.min(fc, tc);
      const maxCol = Math.max(fc, tc);
      // Priority: rule 1 (no port-mix) > rule 2 (no visual crossing).
      //   top clean                → top
      //   top has issue, bottom mix-free → bottom
      //   both have issue          → top (crossing is visual-only; bottom mix
      //                              violates stricter rule 1)
      const topMix    = hasIn(ctx, task.id, 'top')    || hasOut(ctx, toId, 'top');
      const bottomMix = hasIn(ctx, task.id, 'bottom') || hasOut(ctx, toId, 'bottom');
      const topCross  = isColInsideTopRange(ctx, row, fc) || isColInsideTopRange(ctx, row, tc);
      const topBad    = topMix || topCross;
      const useBottom = topBad && !bottomMix;
      if (useBottom) {
        taskForwardRouting.set(`${task.id}::${toId}`, { exitSide: 'bottom', entrySide: 'bottom' });
        useOut(ctx, task.id, 'bottom'); useIn(ctx, toId, 'bottom');
      } else {
        taskForwardRouting.set(`${task.id}::${toId}`, { exitSide: 'top', entrySide: 'top' });
        registerTopCorridor(ctx, row, minCol, maxCol);
        useOut(ctx, task.id, 'top'); useIn(ctx, toId, 'top');
      }
    });
  });
}

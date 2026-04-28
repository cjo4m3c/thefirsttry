import { hasIn, hasOut, useIn, useOut } from './corridor.js';

/**
 * Phase 3d — cross-lane forward obstacle avoidance.
 *
 * A regular task → task/end forward edge where source and target are
 * on different rows (dr ≠ 0, dc > 0) defaults to right→left with a
 * midX vertical. If an intermediate task sits at source row, target
 * row, or in the spanned rectangle, the default path cuts through it.
 *
 * Two alternative routings keep the vertical on a column guaranteed
 * to be free of other tasks (source's or target's own column):
 *   Option A — enter target from top/bottom (vertical at tc col)
 *   Option B — exit source from top/bottom (vertical at fc col)
 *
 * User preference: "有跟任何任務重疊時，都可以優先考慮改變起始端點或結束端點".
 * Try A first (target-side), then B (source-side), else keep default.
 *
 * Mutates: ctx.taskCrossLaneRouting, ctx.portIn, ctx.portOut
 */
export function runPhase3d(ctx) {
  const { tasks, taskRowOf, taskColOf, taskAt, taskIdSetAll,
          taskBackwardRouting, taskForwardRouting, taskCrossLaneRouting } = ctx;

  // Pre-collect all Phase 3d-eligible edges so each one can detect if its
  // default midX path would cross ANOTHER Phase 3d edge's midX vertical (or
  // vice versa). Task-cell overlaps were already caught by `taskAt`; this
  // catches **line-to-line overlap** where two default cross-lane paths share
  // a col/row intersection. When detected, `defaultBad = true` triggers
  // Option A / Option B just like a task obstacle would.
  const phase3dEligible = [];
  tasks.forEach(task => {
    if (task.type === 'end' || task.type === 'start' || task.type === 'gateway') return;
    const nextIds = task.nextTaskIds?.length ? task.nextTaskIds : (task.nextTaskId ? [task.nextTaskId] : []);
    const fr = taskRowOf[task.id], fc = taskColOf[task.id];
    nextIds.forEach(toId => {
      if (!toId || !taskIdSetAll.has(toId)) return;
      if (taskBackwardRouting.has(`${task.id}::${toId}`)) return;
      if (taskForwardRouting.has(`${task.id}::${toId}`)) return;
      const tr = taskRowOf[toId], tc = taskColOf[toId];
      if (tr === undefined || tc === undefined) return;
      const dr = tr - fr, dc = tc - fc;
      if (dr === 0 || dc <= 0) return;
      phase3dEligible.push({ fromId: task.id, toId, fr, fc, tr, tc });
    });
  });

  function defaultPathCrossesOtherEdge(myFr, myFc, myTr, myTc, myFromId, myToId) {
    const myMid = (myFc + myTc) / 2;
    const myRowLo = Math.min(myFr, myTr), myRowHi = Math.max(myFr, myTr);
    for (const other of phase3dEligible) {
      if (other.fromId === myFromId && other.toId === myToId) continue;
      const otherMid = (other.fc + other.tc) / 2;
      const otherRowLo = Math.min(other.fr, other.tr);
      const otherRowHi = Math.max(other.fr, other.tr);
      // Case 1: other's midX vertical passes through our horizontal at fr / tr.
      const otherVInMyCol = otherMid > myFc && otherMid < myTc;
      if (otherVInMyCol && otherRowLo <= myFr && myFr <= otherRowHi) return true;
      if (otherVInMyCol && otherRowLo <= myTr && myTr <= otherRowHi) return true;
      // Case 2: my midX vertical passes through other's horizontal at other.fr / other.tr.
      const myVInOtherCol = myMid > other.fc && myMid < other.tc;
      if (myVInOtherCol && myRowLo <= other.fr && other.fr <= myRowHi) return true;
      if (myVInOtherCol && myRowLo <= other.tr && other.tr <= myRowHi) return true;
    }
    return false;
  }

  tasks.forEach(task => {
    if (task.type === 'end' || task.type === 'start' || task.type === 'gateway') return;
    const nextIds = task.nextTaskIds?.length ? task.nextTaskIds : (task.nextTaskId ? [task.nextTaskId] : []);
    const fr = taskRowOf[task.id], fc = taskColOf[task.id];
    nextIds.forEach(toId => {
      if (!toId || !taskIdSetAll.has(toId)) return;
      if (taskBackwardRouting.has(`${task.id}::${toId}`)) return;
      if (taskForwardRouting.has(`${task.id}::${toId}`)) return;
      const tr = taskRowOf[toId], tc = taskColOf[toId];
      if (tr === undefined || tc === undefined) return;
      const dr = tr - fr, dc = tc - fc;
      if (dr === 0 || dc <= 0) return;  // same-row or backward handled elsewhere

      const rLo = Math.min(fr, tr), rHi = Math.max(fr, tr);

      // Check default right→left midX path for overlaps.
      let defaultBad = false;
      for (let c = fc + 1; c < tc && !defaultBad; c++) {
        if (taskAt(fr, c) || taskAt(tr, c)) defaultBad = true;
      }
      for (let r = rLo + 1; r < rHi && !defaultBad; r++) {
        for (let c = fc + 1; c < tc && !defaultBad; c++) {
          if (taskAt(r, c)) defaultBad = true;
        }
      }
      // Also trigger Option A/B when another Phase 3d edge's midX path would
      // visibly cross ours (segment-segment overlap, not just task boxes).
      if (!defaultBad && defaultPathCrossesOtherEdge(fr, fc, tr, tc, task.id, toId)) {
        defaultBad = true;
      }
      if (!defaultBad) return;

      // Option A: entry top/bottom (vertical at tc). Horizontal at row fr.
      // Port-mix check: source's `right` must not already have IN (we're
      // adding OUT), target's `entrySideA` must not already have OUT (we're
      // adding IN). Multiple INs or multiple OUTs on the same port are
      // fine — the rule is no mix of directions per port.
      const entrySideA = dr > 0 ? 'top' : 'bottom';
      let aBad = false;
      for (let c = fc + 1; c < tc && !aBad; c++) if (taskAt(fr, c)) aBad = true;
      for (let r = rLo + 1; r < rHi && !aBad; r++) if (taskAt(r, tc)) aBad = true;
      if (!aBad && !hasIn(ctx, task.id, 'right') && !hasOut(ctx, toId, entrySideA)) {
        taskCrossLaneRouting.set(`${task.id}::${toId}`, { exitSide: 'right', entrySide: entrySideA });
        useOut(ctx, task.id, 'right'); useIn(ctx, toId, entrySideA);
        return;
      }

      // Option B: exit top/bottom (vertical at fc). Horizontal at row tr.
      const exitSideB = dr > 0 ? 'bottom' : 'top';
      let bBad = false;
      for (let r = rLo + 1; r < rHi && !bBad; r++) if (taskAt(r, fc)) bBad = true;
      for (let c = fc + 1; c < tc && !bBad; c++) if (taskAt(tr, c)) bBad = true;
      if (!bBad && !hasIn(ctx, task.id, exitSideB) && !hasOut(ctx, toId, 'left')) {
        taskCrossLaneRouting.set(`${task.id}::${toId}`, { exitSide: exitSideB, entrySide: 'left' });
        useOut(ctx, task.id, exitSideB); useIn(ctx, toId, 'left');
        return;
      }
      // Else: keep default (both alternatives have their own obstacles).
    });
  });
}

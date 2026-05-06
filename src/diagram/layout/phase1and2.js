import { getExitPriority, inferEntrySide } from './gatewayRouting.js';
import { isPathClear } from './corridor.js';

/**
 * Phase 1+2 — per-gateway condition routing (smart distribution).
 *
 *   Phase 1: For each gateway, compute an ordered exit-side preference list
 *            per condition based on (dr, dc). Greedy-assign each condition
 *            to its highest-priority side not yet taken by a sibling condition.
 *
 *   Phase 2: After all gateways are processed, scan per-target incoming
 *            connections. If ≥2 connections enter the same side of the same
 *            target (gateway target only — tasks use left→right model),
 *            bump the later ones to an alternate entry side where geometry
 *            allows.
 *
 * `useMixedPriority` (preview branch 2026-05-06) — when true, replaces the
 * single sibling-uniqueness filter with a 4-pass fallback chain:
 *   1️⃣ not used by sibling AND path obstacle-free AND rule-1 OK
 *   2️⃣ path obstacle-free AND rule-1 OK (sibling sharing allowed)
 *   3️⃣ not used by sibling AND rule-1 OK (path may be blocked)
 *   4️⃣ priorities[0] (legacy)
 *
 * Mutates: ctx.condRouting, ctx.incomingByTarget
 */
export function runPhase1And2(ctx, useMixedPriority = false) {
  const { tasks, taskRowOf, taskColOf, condRouting, incomingByTarget } = ctx;

  tasks.forEach(task => {
    if (task.type !== 'gateway' || !task.conditions?.length) return;
    const fr = taskRowOf[task.id], fc = taskColOf[task.id];
    const usedExits = new Set();

    // Sort conditions so that the one with the most constrained direction
    // (forward-adjacent) gets its preferred side first. Conditions farther
    // away or backward yield when there's a conflict.
    const prioritized = task.conditions
      .filter(c => c.nextTaskId && taskRowOf[c.nextTaskId] !== undefined)
      .map(c => {
        const dr = taskRowOf[c.nextTaskId] - fr;
        const dc = taskColOf[c.nextTaskId] - fc;
        return { cond: c, dr, dc, priorities: getExitPriority(dr, dc) };
      });

    // Sort: forward-adjacent (dc=1, dr=0) first, then by Manhattan distance asc
    prioritized.sort((a, b) => {
      const adjA = (a.dr === 0 && a.dc === 1) ? 0 : 1;
      const adjB = (b.dr === 0 && b.dc === 1) ? 0 : 1;
      if (adjA !== adjB) return adjA - adjB;
      return (Math.abs(a.dr) + Math.abs(a.dc)) - (Math.abs(b.dr) + Math.abs(b.dc));
    });

    prioritized.forEach(({ cond, dr, dc, priorities }) => {
      let exitSide;
      if (useMixedPriority) {
        const tr = taskRowOf[cond.nextTaskId], tc = taskColOf[cond.nextTaskId];
        const trial = (p) => ({
          exit: p,
          entry: inferEntrySide(p, dr, dc),
        });
        const tryFilter = (filterFn) =>
          priorities.find(p => filterFn(trial(p)));

        // 1️⃣ not used + path clear (incl. rule 1)
        exitSide = tryFilter(({ exit, entry }) =>
          !usedExits.has(exit) &&
          isPathClear(exit, entry, fr, fc, tr, tc, ctx, task.id, cond.nextTaskId)
        );
        // 2️⃣ path clear (sibling sharing OK)
        if (!exitSide) exitSide = tryFilter(({ exit, entry }) =>
          isPathClear(exit, entry, fr, fc, tr, tc, ctx, task.id, cond.nextTaskId)
        );
        // 3️⃣ not used (path may be blocked, but rule 1 still OK)
        if (!exitSide) exitSide = tryFilter(({ exit }) => !usedExits.has(exit));
        // 4️⃣ legacy fallback
        if (!exitSide) exitSide = priorities[0];
      } else {
        exitSide = priorities.find(p => !usedExits.has(p)) ?? priorities[0];
      }
      const entrySide = inferEntrySide(exitSide, dr, dc);
      usedExits.add(exitSide);
      condRouting.set(`${task.id}::${cond.id}`, { exitSide, entrySide });

      (incomingByTarget[cond.nextTaskId] ||= []).push({
        key: `${task.id}::${cond.id}`, fromId: task.id, dr: -dr, dc: -dc, entrySide,
      });
    });
  });

  // Phase 2: dedup entry sides per target (only for gateway targets, which
  // reliably have 4 ports; tasks use left→right model and don't need it).
  tasks.forEach(target => {
    if (target.type !== 'gateway') return;
    const incs = incomingByTarget[target.id];
    if (!incs || incs.length < 2) return;

    const usedEntries = new Set();
    // Order: forward-adjacent-left first (dc=-1, dr=0 from target POV means source is left neighbor)
    incs.sort((a, b) => {
      const adjA = (a.dr === 0 && a.dc === -1) ? 0 : 1;
      const adjB = (b.dr === 0 && b.dc === -1) ? 0 : 1;
      if (adjA !== adjB) return adjA - adjB;
      return (Math.abs(a.dr) + Math.abs(a.dc)) - (Math.abs(b.dr) + Math.abs(b.dc));
    });

    incs.forEach(inc => {
      const { key, entrySide: preferred, dr, dc } = inc;
      // Build entry-priority: original choice first, then alternates by direction
      const entryPriorities = [preferred, ...['left', 'top', 'bottom', 'right'].filter(s => s !== preferred)];
      // Filter to geometrically sensible entries given (dr, dc) from target POV.
      //   dr>0 (source above target): top is sensible; bottom less so.
      //   dr<0 (source below): bottom sensible.
      //   dc>0 (source to right): right sensible; left less so.
      //   dc<0 (source to left): left sensible.
      // dr/dc here are FROM-TARGET-POV (source relative to target).
      //   dr < 0 → source above target → entering TOP natural, BOTTOM awkward
      //   dr > 0 → source below target → entering BOTTOM natural, TOP awkward
      //   dc < 0 → source left of target → entering LEFT natural, RIGHT awkward
      //   dc > 0 → source right of target → entering RIGHT natural, LEFT awkward
      const sensible = entryPriorities.filter(s => {
        if (s === 'top'    && dr > 0)  return false;
        if (s === 'bottom' && dr < 0)  return false;
        if (s === 'left'   && dc > 0)  return false;
        if (s === 'right'  && dc < 0)  return false;
        return true;
      });
      const finalEntry = sensible.find(s => !usedEntries.has(s)) ?? preferred;
      usedEntries.add(finalEntry);
      if (finalEntry !== preferred) {
        const r = condRouting.get(key);
        condRouting.set(key, { exitSide: r.exitSide, entrySide: finalEntry });
      }
    });
  });
}

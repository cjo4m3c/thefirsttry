import { getExitPriority, inferEntrySide } from './gatewayRouting.js';
import {
  hasTopConflict, registerTopCorridor, topCorridorRange,
  horizontalPathHasObstacle, corridorBlockedByFuturePhase3dVertical,
  useIn, useOut,
} from './corridor.js';

/**
 * Phase 3 — corridor conflict detection across gateways.
 *
 * Phase 1+2 only consider sibling conflicts within a single gateway.
 * When two DIFFERENT gateways both route via the TOP corridor of the
 * same row with overlapping column spans, their horizontal segments
 * land on (nearly) the same y and visually overlap.
 *
 * Strategy: walk every gateway condition in deterministic order
 * (short Manhattan first — short forward flows keep their natural
 * choice, long / backward flows yield). For each condition, if its
 * chosen corridor overlaps an already-registered corridor, advance
 * through the exit-side priority list to find a non-conflicting one
 * that hasn't been taken by a sibling of the same gateway. Then
 * register the accepted corridor so later conditions see it.
 *
 * Only the TOP corridor is Phase-3-controlled here; the bottom lane
 * corridor already has a slot-allocation system (step 5/8).
 *
 * Mutates: ctx.condRouting, ctx.topCorridorByRow, ctx.portIn, ctx.portOut
 */
export function runPhase3(ctx) {
  const { tasks, taskRowOf, taskColOf, condRouting } = ctx;

  const allGatewayConds = [];
  tasks.forEach(task => {
    if (task.type !== 'gateway' || !task.conditions?.length) return;
    const fr = taskRowOf[task.id], fc = taskColOf[task.id];
    task.conditions.forEach(cond => {
      const tr = taskRowOf[cond.nextTaskId];
      const tc = taskColOf[cond.nextTaskId];
      if (tr === undefined || tc === undefined) return;
      const dr = tr - fr, dc = tc - fc;
      allGatewayConds.push({
        key: `${task.id}::${cond.id}`,
        gatewayId: task.id,
        toId: cond.nextTaskId,
        fr, fc, tr, tc, dr, dc,
        priorities: getExitPriority(dr, dc),
      });
    });
  });

  allGatewayConds.sort((a, b) =>
    (Math.abs(a.dr) + Math.abs(a.dc)) - (Math.abs(b.dr) + Math.abs(b.dc))
  );

  // Compute incoming ports per gateway so the outgoing-port selection below
  // can avoid colliding with a port that already has an arrow landing on it.
  //   - gateway → gateway: use entrySide from condRouting (Phase 1+2 already
  //     resolved it)
  //   - regular task → gateway: default right→left, so entry='left'
  //     (unless Phase 3b gave a non-default backward routing)
  //   - start → gateway: same default entry='left'
  const incomingPortByGateway = new Map();
  const addIncomingPort = (gatewayId, port) => {
    if (!incomingPortByGateway.has(gatewayId)) incomingPortByGateway.set(gatewayId, new Set());
    incomingPortByGateway.get(gatewayId).add(port);
  };
  tasks.forEach(task => {
    if (task.type === 'gateway') {
      (task.conditions || []).forEach(cond => {
        const r = condRouting.get(`${task.id}::${cond.id}`);
        const toTask = tasks.find(t => t.id === cond.nextTaskId);
        if (r && toTask && toTask.type === 'gateway') addIncomingPort(toTask.id, r.entrySide);
      });
    } else if (task.type !== 'end') {
      // Regular task → gateway uses default right→left (entry='left').
      // Backward task → gateway is rare and resolved later by Phase 3b; not
      // tracked here.
      const nextIds = task.nextTaskIds?.length ? task.nextTaskIds : (task.nextTaskId ? [task.nextTaskId] : []);
      nextIds.forEach(toId => {
        const toTask = tasks.find(t => t.id === toId);
        if (!toTask || toTask.type !== 'gateway') return;
        addIncomingPort(toTask.id, 'left');
      });
    }
  });

  const usedExitsByGateway = new Map();
  const gatewayUsed = (gid) => {
    if (!usedExitsByGateway.has(gid)) usedExitsByGateway.set(gid, new Set());
    return usedExitsByGateway.get(gid);
  };

  allGatewayConds.forEach(c => {
    const r0 = condRouting.get(c.key);
    if (!r0) return;
    const used = gatewayUsed(c.gatewayId);
    const incoming = incomingPortByGateway.get(c.gatewayId) || new Set();

    // Walk the priority list from the top (ignoring the old r0.exitSide
    // choice) so we can drop it if it conflicts with an incoming port —
    // otherwise the outgoing arrow would land on the same side of the
    // gateway as an incoming arrow (which the user explicitly flagged).
    // Fall back to r0.exitSide only if every priority is blocked.
    let accepted = null;
    for (const p of c.priorities) {
      if (used.has(p)) continue;
      if (incoming.has(p)) continue;
      const testEntry = inferEntrySide(p, c.dr, c.dc);
      // Two INs sharing one port (e.g. gateway forward top→top + backward
      // loop-back top→top both landing on target's TOP center) is allowed
      // per the user rule "端點不能同時有進有出" — IN + IN is fine. No
      // special override needed here.
      const range = topCorridorRange(p, testEntry, c.fr, c.fc, c.tr, c.tc);
      if (range && hasTopConflict(ctx, range.row, range.minCol, range.maxCol)) continue;
      if (range && corridorBlockedByFuturePhase3dVertical(ctx, range.row, range.minCol, range.maxCol)) continue;
      // Horizontal exit (right/left) draws a 1-bend L-path whose vertical
      // leg can pass through an intermediate task. Reject so the fallback
      // below can share the primary exit with a sibling (visual line
      // overlap near the gateway is preferred over cutting a task box).
      if ((p === 'right' || p === 'left') && horizontalPathHasObstacle(ctx, c.fr, c.fc, c.tr, c.tc)) continue;
      // Vertical exit (top/bottom) going OPPOSITE the target's row span
      // needs a corridor detour whose drop/rise crosses more than one lane
      // boundary when |dr| > 1. Prefer sharing the primary exit with a
      // sibling over drawing such a long cross-row vertical.
      if (p === 'top'    && c.dr > 1)  continue;
      if (p === 'bottom' && c.dr < -1) continue;
      accepted = { exit: p, entry: testEntry, range };
      break;
    }
    // Pass 2 — sibling-sharing with a priority-walk: if no clean exit
    // was found, allow sharing a port that's already taken by an
    // earlier-processed sibling of the same gateway. Walk the priority
    // list again in order so we land on the most visually natural
    // shared port (e.g. a backward condition whose `top` is held by a
    // forward sibling shares top and enters target's TOP, rather than
    // falling to an awkward bottom detour). Still reject port-mix with
    // incoming, horizontal obstacles, and long cross-row verticals.
    if (!accepted) {
      for (const p of c.priorities) {
        if (!used.has(p)) continue;
        if (incoming.has(p)) continue;
        if ((p === 'right' || p === 'left') && horizontalPathHasObstacle(ctx, c.fr, c.fc, c.tr, c.tc)) continue;
        if (p === 'top'    && c.dr > 1)  continue;
        if (p === 'bottom' && c.dr < -1) continue;
        const testEntry = inferEntrySide(p, c.dr, c.dc);
        accepted = { exit: p, entry: testEntry, range: null };
        break;
      }
    }
    // Pass 3 — legacy fallback: share primary priority with target LEFT/RIGHT
    // edge entry so two arrows diverge at the targets.
    if (!accepted) {
      const pref = c.priorities[0];
      if (!incoming.has(pref)) {
        const fbEntry = c.dc > 0 ? 'left' : c.dc < 0 ? 'right' : (c.dr > 0 ? 'top' : 'bottom');
        accepted = { exit: pref, entry: fbEntry, range: null };
      }
    }
    if (!accepted) {
      accepted = { exit: r0.exitSide, entry: r0.entrySide, range: null };
    }

    used.add(accepted.exit);
    if (accepted.exit !== r0.exitSide || accepted.entry !== r0.entrySide) {
      condRouting.set(c.key, { exitSide: accepted.exit, entrySide: accepted.entry });
    }
    // Track final port direction usage so Phase 3b/3c/3d can detect mixing.
    useOut(ctx, c.gatewayId, accepted.exit);
    if (c.toId) useIn(ctx, c.toId, accepted.entry);
    if (accepted.range) registerTopCorridor(ctx, accepted.range.row, accepted.range.minCol, accepted.range.maxCol);
  });
}

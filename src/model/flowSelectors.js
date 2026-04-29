/**
 * Flow-selectors model layer (PR-6).
 *
 * Pure-function selectors for data derived from `flow`. Centralizing them
 * here avoids the "same derivation written twice diverges" trap (history:
 * `buildTableL4Map` had its own counter loop that disagreed with the on-canvas
 * labels until commit 7606d16; the inline `incoming` map in validateFlow.js
 * vs formatConnection were byte-identical but maintained separately).
 *
 * Pure functions only — no React, no I/O, no view-layer imports.
 *
 * Backward compat: `src/utils/taskDefs.js` re-exports `computeDisplayLabels`
 * from this module, so every existing importer keeps working without changes.
 */

// ────────────────────────────────────────────────────────────────────────────
// Display labels (formerly src/utils/taskDefs.js::computeDisplayLabels)
// ────────────────────────────────────────────────────────────────────────────

/**
 * Build `{ taskId → L4 number string }` for one L3 flow.
 *
 * Rules (mirrors business-spec.md §2):
 *   start event           → `${l3}-0`
 *   end event / breakpt.  → `${l3}-99`
 *   gateway (XOR/AND/OR)  → single   → `${base}_g`
 *                           consec.  → `${base}_g1` / `_g2` / `_g3`…
 *                           (連續 = no independent L4 task between them;
 *                           subprocess calls don't break the run.)
 *   subprocess call       → single   → `${base}_s`
 *                           consec.  → `${base}_s1` / `_s2` / `_s3`…
 *                           (連續 = no independent L4 task between them;
 *                           gateways don't break the run.)
 *   regular task          → `${l3}-${counter}` where counter counts ONLY
 *                           regular tasks from 1.
 *
 * `${base}` is `lastTaskBase`: the last anchor element's L4 number (a regular
 * task, or `${l3}-0` when start is the only thing seen). Both `_g` and `_s`
 * share this anchor — neither consumes a counter slot, neither resets the
 * other's run-length counter (per spec §2 example `_s1 → _g → _s2`).
 *
 * Stored `task.l4Number` wins for imported flows, with one exception: legacy
 * subprocess tasks that lack `_s` are dropped (their stored base is wrong
 * under the new spec) and regenerated from rolling state.
 *
 * Sole numbering source: editor dropdowns, FlowTable, Excel export, drawio,
 * and on-canvas labels all flow through this function so the seven views
 * stay aligned.
 */
export function computeDisplayLabels(tasks, l3Number) {
  const labels = {};
  const prefix = l3Number || '?';
  const GATEWAY_CTS = new Set([
    'conditional-branch', 'parallel-branch', 'inclusive-branch',
    'parallel-merge', 'conditional-merge', 'inclusive-merge',
  ]);

  // Pre-scan stored l4Numbers so auto-generated counters don't collide
  // with imported tasks. _g and _s suffixes don't claim a counter — both
  // share their anchor task's counter. Start / end (counters 0 / 99) are
  // reserved and excluded.
  const usedCounters = new Set();
  tasks.forEach(task => {
    if (!task.l4Number) return;
    const base = String(task.l4Number).replace(/(_g\d*|_s\d*)$/, '');
    if (base.startsWith(prefix + '-')) {
      const n = parseInt(base.slice(prefix.length + 1), 10);
      if (!Number.isNaN(n) && n !== 0 && n !== 99) usedCounters.add(n);
    }
  });

  let taskCounter = 1;
  let lastTaskBase = null;  // anchor for `_g` / `_s` suffixes
  let gwConsec = 0;         // consecutive gateways after lastTaskBase
  let spConsec = 0;         // consecutive subprocess calls after lastTaskBase

  tasks.forEach(task => {
    const ct = task.connectionType || 'sequence';
    const isStart = task.type === 'start' || ct === 'start';
    const isEnd   = task.type === 'end'   || ct === 'end' || ct === 'breakpoint';
    const isGateway = task.type === 'gateway' || GATEWAY_CTS.has(ct);
    const isSubprocess = task.type === 'l3activity' || ct === 'subprocess';

    // 1. Respect stored l4Number (imported flows). Legacy subprocess data
    //    that lacks `_s` is intentionally dropped — its stored base is wrong
    //    under the new spec; fall through to generated logic so the base
    //    becomes the actual predecessor task.
    const stored = task.l4Number ? String(task.l4Number) : null;
    const skipStored = isSubprocess && stored && !/_s\d*$/.test(stored);
    if (stored && !skipStored) {
      let label = stored;
      if (isGateway && !/_g\d*$/.test(label)) label += '_g';
      labels[task.id] = label;
      const mGW = label.match(/^(\d+-\d+-\d+-\d+)_g(\d*)$/);
      const mSP = label.match(/^(\d+-\d+-\d+-\d+)_s(\d*)$/);
      if (mGW) {
        lastTaskBase = mGW[1];
        gwConsec = mGW[2] === '' ? 1 : parseInt(mGW[2], 10);
        // spConsec preserved — `_s1 → _g → _s2` stays consecutive.
      } else if (mSP) {
        lastTaskBase = mSP[1];
        spConsec = mSP[2] === '' ? 1 : parseInt(mSP[2], 10);
        // gwConsec preserved — `_g1 → _s → _g2` stays consecutive.
      } else if (isStart) {
        lastTaskBase = label;  // `${l3}-0` anchors trailing _g / _s
        gwConsec = 0;
        spConsec = 0;
      } else if (!isEnd) {
        lastTaskBase = label;
        gwConsec = 0;
        spConsec = 0;
      }
      return;
    }

    // 2. Generated labels by type
    if (isStart) {
      const label = `${prefix}-0`;
      labels[task.id] = label;
      lastTaskBase = label;  // start anchors trailing _g / _s as `-0_g` / `-0_s`
      gwConsec = 0;
      spConsec = 0;
    } else if (isEnd) {
      labels[task.id] = `${prefix}-99`;
    } else if (isSubprocess) {
      const base = lastTaskBase || `${prefix}-0`;
      spConsec += 1;
      // Always emit `_s${n}` here; post-process below strips the index when
      // the run length is exactly 1 (yielding plain `_s` for single calls).
      labels[task.id] = `${base}_s${spConsec}`;
      // gwConsec preserved across _s.
    } else if (isGateway) {
      const base = lastTaskBase || `${prefix}-0`;
      gwConsec += 1;
      // Always emit `_g${n}` here; post-process below strips the index when
      // the run length is exactly 1 (yielding plain `_g` for single gateways).
      labels[task.id] = `${base}_g${gwConsec}`;
      // spConsec preserved across _g.
    } else {
      while (usedCounters.has(taskCounter)) taskCounter++;
      const num = `${prefix}-${taskCounter++}`;
      labels[task.id] = num;
      lastTaskBase = num;
      gwConsec = 0;
      spConsec = 0;
    }
  });

  // Post-process: count gateway / subprocess run length per anchor base. When
  // the run is exactly 1, drop the index so the label reads as plain `_g` /
  // `_s` (per business-spec §2: "單一 _g, 連續 _g1 _g2 _g3"). Stored labels
  // that came in as plain `_g` / `_s` (no digit) don't match the regex below
  // so they're left alone.
  const gwBaseMax = {};
  const spBaseMax = {};
  Object.values(labels).forEach(label => {
    const mG = label.match(/^(\d+-\d+-\d+-\d+)_g(\d+)$/);
    if (mG) gwBaseMax[mG[1]] = Math.max(gwBaseMax[mG[1]] || 0, parseInt(mG[2], 10));
    const mS = label.match(/^(\d+-\d+-\d+-\d+)_s(\d+)$/);
    if (mS) spBaseMax[mS[1]] = Math.max(spBaseMax[mS[1]] || 0, parseInt(mS[2], 10));
  });
  const result = {};
  Object.entries(labels).forEach(([id, label]) => {
    const mG = label.match(/^(\d+-\d+-\d+-\d+)_g(\d+)$/);
    if (mG && gwBaseMax[mG[1]] === 1) {
      result[id] = `${mG[1]}_g`;
      return;
    }
    const mS = label.match(/^(\d+-\d+-\d+-\d+)_s(\d+)$/);
    if (mS && spBaseMax[mS[1]] === 1) {
      result[id] = `${mS[1]}_s`;
      return;
    }
    result[id] = label;
  });
  return result;
}

/** Idiomatic alias for new code; same behavior as `computeDisplayLabels`. */
export const getDisplayLabels = computeDisplayLabels;

// ────────────────────────────────────────────────────────────────────────────
// Incoming-edge map (formerly duplicated inline in validateFlow.js and
// connectionFormat.js — byte-identical implementations)
// ────────────────────────────────────────────────────────────────────────────

/**
 * Count incoming edges per task. Used by validation (merge gateways need
 * ≥2 incoming) and forward formatting (XOR/AND/OR merge detection).
 *
 * @param {object[]} tasks
 * @returns {Record<string, number>} task.id → incoming-edge count
 */
export function getTaskIncoming(tasks) {
  const incoming = {};
  tasks.forEach(t => {
    const outs = t.type === 'gateway'
      ? (t.conditions || []).map(c => c.nextTaskId)
      : (t.nextTaskIds || []);
    outs.filter(Boolean).forEach(id => {
      incoming[id] = (incoming[id] || 0) + 1;
    });
  });
  return incoming;
}

/**
 * Map each task to the list of source task IDs that point at it. Used by
 * formatConnection to render merge text like "並行合併 X、Y，序列流向 Z"
 * where X / Y are the source task numbers.
 *
 * Order matches task array order (so output is deterministic).
 *
 * @param {object[]} tasks
 * @returns {Record<string, string[]>} task.id → list of source task IDs
 */
export function getTaskIncomingSources(tasks) {
  const sources = {};
  tasks.forEach(t => {
    const outs = t.type === 'gateway'
      ? (t.conditions || []).map(c => c.nextTaskId)
      : (t.nextTaskIds || []);
    outs.filter(Boolean).forEach(targetId => {
      if (!sources[targetId]) sources[targetId] = [];
      sources[targetId].push(t.id);
    });
  });
  return sources;
}

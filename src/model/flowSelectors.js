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
 * Rules (mirrors the spec rendered in `HelpPanel.jsx`):
 *   start event         → `${l3}-0`
 *   end event / break.  → `${l3}-99`
 *   gateway (any kind)  → `${lastTask}_g` (or _g2, _g3… when consecutive
 *                         gateways follow the same base task)
 *   regular task        → `${l3}-${counter}` where counter counts ONLY
 *                         regular tasks from 1.
 *
 * Stored `task.l4Number` always wins (preserves imported numbering).
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
  // with imported tasks. A stored label like "5-1-1-3" or "5-1-1-3_g"
  // claims counter 3 (the `_g` suffix doesn't consume a new counter —
  // gateways share their preceding task's counter). Start / end events
  // (counters 0 / 99) are reserved and excluded.
  //
  // Without this, adding a new task in FlowEditor after Excel import
  // would pick `taskCounter=1` and collide with imported "5-1-1-1".
  const usedCounters = new Set();
  tasks.forEach(task => {
    if (!task.l4Number) return;
    const base = String(task.l4Number).replace(/_g\d*$/, '');
    if (base.startsWith(prefix + '-')) {
      const n = parseInt(base.slice(prefix.length + 1), 10);
      if (!Number.isNaN(n) && n !== 0 && n !== 99) usedCounters.add(n);
    }
  });

  let taskCounter = 1;
  let lastTaskBase = null;  // last regular task's L4 number (base for _g)
  let gwConsec = 0;         // consecutive gateways after lastTaskBase

  tasks.forEach(task => {
    const ct = task.connectionType || 'sequence';
    const isStart = task.type === 'start' || ct === 'start';
    const isEnd   = task.type === 'end'   || ct === 'end' || ct === 'breakpoint';
    const isGateway = task.type === 'gateway' || GATEWAY_CTS.has(ct);

    // 1. Respect stored l4Number (imported flows)
    if (task.l4Number) {
      let label = String(task.l4Number);
      if (isGateway && !/_g\d*$/.test(label)) label += '_g';
      labels[task.id] = label;
      // Update rolling state so subsequent generated labels continue
      // sensibly after imported rows.
      const mGW = label.match(/^(\d+-\d+-\d+-\d+)_g(\d*)$/);
      if (mGW) {
        lastTaskBase = mGW[1];
        gwConsec = mGW[2] === '' ? 1 : parseInt(mGW[2], 10);
      } else if (!isStart && !isEnd) {
        lastTaskBase = label.replace(/_g\d*$/, '');
        gwConsec = 0;
      }
      return;
    }

    // 2. Generated labels by type
    if (isStart) {
      labels[task.id] = `${prefix}-0`;
    } else if (isEnd) {
      labels[task.id] = `${prefix}-99`;
    } else if (isGateway) {
      const base = lastTaskBase || `${prefix}-${taskCounter}`;
      gwConsec += 1;
      labels[task.id] = gwConsec === 1 ? `${base}_g` : `${base}_g${gwConsec}`;
    } else {
      // Skip any counter slot already claimed by an imported l4Number.
      while (usedCounters.has(taskCounter)) taskCounter++;
      const num = `${prefix}-${taskCounter++}`;
      labels[task.id] = num;
      lastTaskBase = num;
      gwConsec = 0;
    }
  });
  return labels;
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

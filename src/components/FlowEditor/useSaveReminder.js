/**
 * Save-reminder pulse hook for FlowEditor — drives the amber save-button
 * highlight that nudges the user to commit pending changes.
 *
 * Two trigger paths:
 *   • Idle: 2 minutes since last edit while dirty → 'continuous' pulse
 *           (until next edit or save).
 *   • Edit-duration: 8-second 'brief' burst at the 3-min and 5-min marks
 *           anchored at the FIRST edit since last save.
 *
 * `bumpEdit()` is called from `patch()` so each new edit (a) resets the
 * idle timer and (b) drops continuous pulse (the user is active again).
 * `resetPulse()` is called from `doSave()` to clear pulse state and the
 * edit anchor.
 *
 * Inputs:
 *   hasChanges      — required for both paths (no pulses when clean)
 *   saveModal,
 *   resetAllModal   — modal open suppresses the idle timer (modal already
 *                     captures user attention)
 *
 * Returns:
 *   pulseMode       — 'none' | 'brief' | 'continuous'  (for Header)
 *   bumpEdit()      — call after each user edit
 *   resetPulse()    — call on successful save
 */
import { useEffect, useState, useRef } from 'react';

export function useSaveReminder({ hasChanges, saveModal, resetAllModal }) {
  const [pulseMode, setPulseMode] = useState('none');
  // Tick counter — bumps on every patch so the idle-timer effect can react
  // (hasChanges stays true throughout an edit session, so we need a finer
  // signal to "user is still active").
  const [editStamp, setEditStamp] = useState(0);
  // Anchor for the 3-min / 5-min brief reminders: timestamp of the FIRST
  // edit since last save. Cleared on save.
  const editingStartRef = useRef(null);

  function bumpEdit() {
    setEditStamp(s => s + 1);
  }

  function resetPulse() {
    setPulseMode('none');
    editingStartRef.current = null;
  }

  // Save reminder — idle path: while there are unsaved changes, every edit
  // resets a 2-min timer; if it fires the save button enters 'continuous'
  // pulse until the user resumes editing or saves.
  useEffect(() => {
    if (!hasChanges || saveModal || resetAllModal) return;
    // Any new edit → drop continuous pulse (user is active again).
    setPulseMode(prev => (prev === 'continuous' ? 'none' : prev));
    const t = setTimeout(() => setPulseMode('continuous'), 90 * 1000);
    return () => clearTimeout(t);
  }, [editStamp, hasChanges, saveModal, resetAllModal]);

  // Save reminder — edit-duration path: anchored at first edit since last
  // save, fire a brief 8-second pulse at the 3-min and 5-min marks. Brief
  // doesn't override continuous (continuous is the more urgent state).
  useEffect(() => {
    if (!hasChanges) {
      editingStartRef.current = null;
      return;
    }
    if (editingStartRef.current == null) editingStartRef.current = Date.now();
    const elapsed = Date.now() - editingStartRef.current;
    const triggerBrief = () => {
      setPulseMode(prev => (prev === 'continuous' ? prev : 'brief'));
      setTimeout(() => {
        setPulseMode(prev => (prev === 'brief' ? 'none' : prev));
      }, 8000);
    };
    const timers = [];
    const remain3 = 3 * 60 * 1000 - elapsed;
    const remain5 = 5 * 60 * 1000 - elapsed;
    if (remain3 > 0) timers.push(setTimeout(triggerBrief, remain3));
    if (remain5 > 0) timers.push(setTimeout(triggerBrief, remain5));
    return () => timers.forEach(clearTimeout);
  }, [hasChanges]);

  return { pulseMode, bumpEdit, resetPulse };
}

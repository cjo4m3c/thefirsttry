/**
 * Action handlers for FlowEditor — all graph-mutation logic in one place.
 * Each function captures `liveFlow` + `patch` via closure and calls patch()
 * with the next state. Behaviour preserved verbatim from the inline versions
 * that lived in FlowEditor.jsx.
 *
 * Split (PR 2026-05-06): the four action families live in
 * ./useFlowActions/{taskOps,inserts,connections,converters}.js. This file
 * is the orchestrator that composes them — sub-files share `updateTask`
 * via dependency injection so the topology-shift l4Number reset
 * (PR-D8 2026-05-05) stays canonical.
 */
import { makeTaskOps } from './useFlowActions/taskOps.js';
import { makeInserts } from './useFlowActions/inserts.js';
import { makeConnectionOps } from './useFlowActions/connections.js';
import { makeConverterActions } from './useFlowActions/converters.js';

export function useFlowActions({ liveFlow, patch }) {
  const taskOps = makeTaskOps({ liveFlow, patch });
  const inserts = makeInserts({ liveFlow, patch });
  const connections = makeConnectionOps({ liveFlow, patch, updateTask: taskOps.updateTask });
  const converters = makeConverterActions({ liveFlow, patch });

  return {
    ...taskOps,
    ...inserts,
    ...connections,
    ...converters,
  };
}

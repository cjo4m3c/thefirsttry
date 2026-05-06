/**
 * Element-kind detectors used by the Excel importer.
 *
 * Three signal families:
 *   1. body (parsed annotation) — gateway sub-type via fork keywords
 *   2. name (L4 name `[XX閘道]` prefix) — gateway sub-type cross-check
 *   3. number (L4 suffix) — element kind (PR-D10 SOT 2026-05-05)
 */

/**
 * Determine gateway type from a parsed annotation. Returns null when the row
 * is not an independent gateway element — only fork patterns qualify (see
 * `detectGatewayFromText` in `src/model/connectionFormat.js` for the
 * phrase-level rule). Merges and loop-returns are regular tasks.
 */
export function detectGatewayType(ann) {
  if (ann.parallelToNumbers.length > 0)  return 'and';
  if (ann.inclusiveToNumbers.length > 0) return 'or';
  if (ann.branchToNumbers.length > 0)    return 'xor';
  return null;
}

/**
 * Recognize the gateway sub-type from the L4 name's `[XX閘道]` prefix.
 * Used as cross-check signal (PR-D10 2026-05-05) — name only ever surfaces
 * warnings, body remains the authoritative gateway-sub-type signal.
 */
export function detectGatewayFromName(l4Name) {
  if (/\[排他閘道\]|\[XOR\s*閘道\]/.test(l4Name)) return 'xor';
  if (/\[並行閘道\]|\[AND\s*閘道\]/.test(l4Name)) return 'and';
  if (/\[包容閘道\]|\[OR\s*閘道\]/.test(l4Name))  return 'or';
  return null;
}

/**
 * PR-D10 (2026-05-05): L4 number suffix is the SOT for element type.
 * Returns one of: 'start' | 'end' | 'gateway' | 'l3activity' | 'task'.
 * For 'task', the caller derives shapeType separately based on `_e` suffix.
 */
export function detectKindFromL4(l4Num) {
  if (/-0$/.test(l4Num))      return 'start';
  if (/-99$/.test(l4Num))     return 'end';
  if (/_g\d*$/.test(l4Num))   return 'gateway';
  if (/_s\d*$/.test(l4Num))   return 'l3activity';
  return 'task';   // plain or `_e\d*` suffix — both regular tasks (shapeType differs)
}

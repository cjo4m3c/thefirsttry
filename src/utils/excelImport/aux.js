/**
 * Auxiliary-column helpers for Excel import. Auxiliary fields (Excel cols
 * K~AD, ~20 columns) are positioned by header text — not fixed indices —
 * so users can reorder them without breaking import. Empty cells stay off
 * `task.meta` so downstream `task.meta[k] ?? ''` works without storing
 * redundant '' values.
 */
import { AUX_FIELD_DEFS } from '../auxFieldDefs.js';

/**
 * Walk the header row (allRows[0]) and build a `{ auxKey → colIndex }` map by
 * matching trimmed cell text against `AUX_FIELD_DEFS[].header`. Headers we
 * can't find are simply absent from the map — corresponding `task.meta[key]`
 * stays unset, and downstream code uses `?? ''`. Nothing is treated as a
 * fatal error (auxiliary content is optional by spec).
 *
 * Tolerance:
 *   - `String(cell ?? '').trim()` collapses null / non-string / surrounding
 *     whitespace
 *   - First match wins if a header is duplicated (rare; user typo)
 *   - Header positions are independent of `COL_*` core indices, so users
 *     who reorder aux columns in their Excel still import correctly
 */
export function buildAuxColMap(headerRow) {
  const map = {};
  if (!Array.isArray(headerRow)) return map;
  const trimmed = headerRow.map(c => String(c ?? '').trim());
  AUX_FIELD_DEFS.forEach(({ key, header }) => {
    const idx = trimmed.indexOf(header);
    if (idx >= 0) map[key] = idx;
  });
  return map;
}

/**
 * Read a single task row's auxiliary fields into a fresh `meta` object using
 * the `{ key → colIndex }` map. Empty cells are skipped (kept off the object
 * so downstream `task.meta[k] ?? ''` works without storing redundant ''s).
 */
export function readAuxMeta(row, auxColMap) {
  const meta = {};
  for (const key in auxColMap) {
    const v = String(row[auxColMap[key]] ?? '').trim();
    if (v) meta[key] = v;
  }
  return meta;
}

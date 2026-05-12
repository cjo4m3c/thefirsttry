/**
 * useColumnWidths — FlowTable per-user column width preferences.
 *
 * State: 一個 number array、index = column index in EXCEL_HEADERS。
 * Persistence: localStorage key `bpm_flow_table_col_widths`。儲存格式
 *   是 sparse object `{ "3": 320, "5": 180 }` 只記 user 改過的 col、
 *   未改的維持 defaults。schema 改動（加減 column）時 user override
 *   仍對得上（用 index 當 key）。
 *
 * Clamp: min 60 / max 600 px 防止極端。
 *
 * Default widths:
 *   sticky 4 欄（L3 編號/名稱、L4 編號/名稱）跟原 STICKY_WIDTHS 同
 *   其他 wide 欄 260 / 一般欄 140 / aux separator 24（不可拉）。
 *
 * Reset: 一鍵清掉所有 user override、回到 defaults。
 */
import { useState, useCallback } from 'react';

const STORAGE_KEY = 'bpm_flow_table_col_widths';
export const MIN_WIDTH = 60;
export const MAX_WIDTH = 600;

function loadOverrides() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return typeof parsed === 'object' && parsed !== null ? parsed : {};
  } catch { return {}; }
}

function saveOverrides(obj) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(obj)); }
  catch {}
}

function clearOverrides() {
  try { localStorage.removeItem(STORAGE_KEY); } catch {}
}

export function useColumnWidths(defaultWidths) {
  const [overrides, setOverrides] = useState(loadOverrides);

  // Combined widths: defaults + user overrides
  const widths = defaultWidths.map((d, i) => overrides[i] != null ? overrides[i] : d);

  const setWidth = useCallback((idx, newW) => {
    const clamped = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, Math.round(newW)));
    setOverrides(prev => {
      const next = { ...prev, [idx]: clamped };
      saveOverrides(next);
      return next;
    });
  }, []);

  const resetAll = useCallback(() => {
    setOverrides({});
    clearOverrides();
  }, []);

  const hasOverrides = Object.keys(overrides).length > 0;

  return { widths, setWidth, resetAll, hasOverrides };
}

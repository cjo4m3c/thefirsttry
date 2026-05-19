/**
 * Sticky-left column helpers — getStickyMap / cellStickyStyle / STICKY_COLS_*
 * 拆自 FlowTable.jsx（PR #237、§6 拆檔）。
 */

// Sticky-left column indices (depend on showL3 toggle). Widths now come
// from useColumnWidths hook so user resize on sticky cols reflows the
// subsequent sticky cols' left offset correctly.
export const STICKY_COLS_WITH_L3 = [0, 1, 2, 3];
export const STICKY_COLS_WITHOUT_L3 = [2, 3];

export function getStickyMap(showL3, widths) {
  const list = showL3 ? STICKY_COLS_WITH_L3 : STICKY_COLS_WITHOUT_L3;
  const map = {};
  let acc = 0;
  list.forEach(col => {
    map[col] = { left: acc, width: widths[col] };
    acc += widths[col];
  });
  return map;
}

// Shared cell builder. Pass `sticky={ left, width }` to freeze this cell on
// horizontal scroll; opaque background is required (sticky cells overlay
// scrolled content). Plain cells fall back to `min-w-` widths.
export function cellStickyStyle(sticky) {
  if (!sticky) return undefined;
  return {
    position: 'sticky',
    left: `${sticky.left}px`,
    width: `${sticky.width}px`,
    minWidth: `${sticky.width}px`,
    zIndex: 4,
  };
}

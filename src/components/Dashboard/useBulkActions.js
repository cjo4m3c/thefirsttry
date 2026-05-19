/**
 * useBulkActions — Dashboard 批量選取 / 批量下載 / 批量刪除 state 管理。
 *
 * 抽自 Dashboard/index.jsx（PR #242、§6 軟超 15KB 拆 hook）。
 * 集中 selectedIds / bulkFormats / pngQueue / pngTotal 4 個 state
 * + toggleSelected / selectAll / clearSelected / handleBulkDownload /
 *   handleBulkDelete 5 個 handler。
 *
 * Caller (Dashboard) 提供 sortedFlows + onDelete + setLogoReaction、
 * 從 hook return 取 state + handler 直接用。
 *
 * PNG 批量下載靠 Dashboard 內 hidden DiagramRenderer 渲染後 ondownload
 * 移除佇列、所以 pngQueue / setPngQueue 也 return 給 Dashboard。
 */
import { useState } from 'react';
import { exportDrawio } from '../../utils/drawioExport.js';
import { exportFlowToExcel } from '../../utils/excelExport.js';

export function useBulkActions({ sortedFlows, onDelete, setLogoReaction }) {
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkFormats, setBulkFormats] = useState({ png: true, drawio: true, excel: true });
  const [pngQueue, setPngQueue] = useState([]); // flows awaiting PNG render
  const [pngTotal, setPngTotal] = useState(0);

  function toggleSelected(id) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }
  function selectAll() { setSelectedIds(new Set(sortedFlows.map(f => f.id))); }
  function clearSelected() { setSelectedIds(new Set()); }

  function handleBulkDownload() {
    const selected = sortedFlows.filter(f => selectedIds.has(f.id));
    if (selected.length === 0) return;
    const { png, drawio, excel } = bulkFormats;
    if (!png && !drawio && !excel) return;

    // Chrome silently drops downloads when too many fire inside a short
    // window. Serialize drawio + excel one flow at a time with a generous
    // gap so even 30+ selections reliably download every file.
    const STEP_MS = 450;
    let slot = 0;
    selected.forEach(flow => {
      if (drawio) { setTimeout(() => exportDrawio(flow),       slot * STEP_MS); slot++; }
      if (excel)  { setTimeout(() => exportFlowToExcel(flow),  slot * STEP_MS); slot++; }
    });

    // PNG: queue async rendering (one at a time via hidden renderer)
    if (png) {
      setPngQueue(selected);
      setPngTotal(selected.length);
    }
  }

  function handleBulkDelete() {
    const selected = sortedFlows.filter(f => selectedIds.has(f.id));
    if (selected.length === 0) return;
    const preview = selected.slice(0, 10).map(f => `• ${f.l3Number} ${f.l3Name}`).join('\n');
    const more = selected.length > 10 ? `\n… 另外 ${selected.length - 10} 個` : '';
    if (!window.confirm(`確定要刪除以下 ${selected.length} 個活動嗎？此動作無法復原。\n\n${preview}${more}`)) return;
    selected.forEach(f => onDelete(f.id));
    setLogoReaction?.('dim');
    setSelectedIds(new Set());
  }

  // Caller 刪單筆時也要把該筆從 selectedIds 移除
  function removeFromSelection(id) {
    setSelectedIds(prev => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev); next.delete(id); return next;
    });
  }

  return {
    selectedIds,
    bulkFormats, setBulkFormats,
    pngQueue, setPngQueue,
    pngTotal, setPngTotal,
    toggleSelected, selectAll, clearSelected,
    handleBulkDownload, handleBulkDelete,
    removeFromSelection,
  };
}

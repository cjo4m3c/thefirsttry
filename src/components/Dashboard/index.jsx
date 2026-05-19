/**
 * Dashboard — top-level page listing all L3 工作流 cards. Provides:
 *   - Sort control + 上傳 Excel + 新增 L3 buttons
 *   - Import banners (error / success / warnings) — see ./Banners.jsx
 *   - Bulk toolbar (when any selected) — see ./BulkToolbar.jsx
 *   - Flow grid — see ./FlowCard.jsx
 *   - Duplicate-L3 import modal — see ./DuplicateImportModal.jsx
 *   - Hidden off-screen DiagramRenderer for PNG single-flow + queue export
 *
 * Split (PR 2026-05-06): banners / bulk toolbar / card / modal / sort
 * helpers extracted to siblings so this orchestrator stays under the 15KB
 * soft cap with breathing room.
 */
import { useState, useMemo, useRef, useEffect } from 'react';
// 2026-05-18：HelpPanel / ChangelogPanel / DesignGuidelinePanel 收攏到
// `InfoDropdown`「說明 ▾」單顆按鈕（使用者：「這三個按鈕不是第一眼需要
// 知道的資訊、有什麼好方法可以收攏」）。
import InfoDropdown from '../InfoDropdown.jsx';
import DiagramRenderer from '../DiagramRenderer.jsx';
import BackToTop from '../BackToTop.jsx';
import { parseExcelToFlow } from '../../utils/excelImport.js';
import { exportDrawio } from '../../utils/drawioExport.js';
import { exportFlowToExcel } from '../../utils/excelExport.js';
import { SORT_OPTIONS, sortFlows } from './sortFlows.js';
import { ImportErrorBanner, ImportSuccessBanner, ImportWarningsBanner } from './Banners.jsx';
import { BulkToolbar, PngProgressBanner } from './BulkToolbar.jsx';
import { FlowCard } from './FlowCard.jsx';
import { FlowListTable } from './FlowListTable.jsx';
import { ViewSwitcher } from './ViewSwitcher.jsx';
import { DuplicateImportModal } from './DuplicateImportModal.jsx';
import { CloneFlowModal } from './CloneFlowModal.jsx';

const VIEW_PREF_KEY = 'bpm_dashboard_view';

export default function Dashboard({ flows, onNew, onEdit, onDelete, onImportExcel, onTogglePin, onClone }) {
  const [sortKey, setSortKey] = useState('number-asc');
  // 2026-05-18 表格 view（方案 A）— 卡片 / 表格 二選一、localStorage 記憶。
  // 兩個 view 共享所有 state（sort / search / filter / select）、只是渲染不同。
  const [view, setView] = useState(() => {
    try {
      const v = localStorage.getItem(VIEW_PREF_KEY);
      return v === 'table' ? 'table' : 'cards';
    } catch { return 'cards'; }
  });
  useEffect(() => {
    try { localStorage.setItem(VIEW_PREF_KEY, view); } catch { /* quota / disabled */ }
  }, [view]);
  const [importError, setImportError] = useState('');
  const [importSuccess, setImportSuccess] = useState('');
  // 2026-05-13 拆兩段（fixes / notices）— 替代舊單一 importWarnings state。
  const [importFixes, setImportFixes] = useState([]);
  const [importNotices, setImportNotices] = useState([]);
  const [warningsExpanded, setWarningsExpanded] = useState(false);
  const [pendingPngFlow, setPendingPngFlow] = useState(null);
  const [logoReaction, setLogoReaction] = useState(null); // 'flash' | 'dim' | null
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkFormats, setBulkFormats] = useState({ png: true, drawio: true, excel: true });
  const [pngQueue, setPngQueue] = useState([]); // flows awaiting PNG render
  const [pngTotal, setPngTotal] = useState(0);
  // Duplicate-L3 import confirmation. `pending` holds the imported flows +
  // per-L3 existing counts so the modal can show what will happen on each
  // button. Closing the modal discards the imported flows.
  const [pendingImport, setPendingImport] = useState(null);
  const [pendingClone, setPendingClone] = useState(null);
  const fileInputRef = useRef(null);

  const sortedFlows = useMemo(() => sortFlows(flows, sortKey), [flows, sortKey]);

  // Auto-clear logo reaction after animation completes
  useEffect(() => {
    if (!logoReaction) return;
    const timer = setTimeout(() => setLogoReaction(null), 900);
    return () => clearTimeout(timer);
  }, [logoReaction]);

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

  function handleDelete(id) {
    setLogoReaction('dim');
    onDelete(id);
    setSelectedIds(prev => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev); next.delete(id); return next;
    });
  }

  function handleBulkDelete() {
    const selected = sortedFlows.filter(f => selectedIds.has(f.id));
    if (selected.length === 0) return;
    const preview = selected.slice(0, 10).map(f => `• ${f.l3Number} ${f.l3Name}`).join('\n');
    const more = selected.length > 10 ? `\n… 另外 ${selected.length - 10} 個` : '';
    if (!window.confirm(`確定要刪除以下 ${selected.length} 個活動嗎？此動作無法復原。\n\n${preview}${more}`)) return;
    selected.forEach(f => onDelete(f.id));
    setLogoReaction('dim');
    setSelectedIds(new Set());
  }

  // 2026-05-13：upload 後拆兩段（fixes / notices）寫入兩個 state。
  function finalizeImport(importedFlows, fixes, notices, mode) {
    if (importedFlows.length > 1) {
      setImportSuccess(`成功匯入 ${importedFlows.length} 個 L3 活動：${importedFlows.map(f => f.l3Number).join('、')}`);
    }
    if (fixes && fixes.length > 0) setImportFixes(fixes);
    if (notices && notices.length > 0) setImportNotices(notices);
    setLogoReaction('flash');
    onImportExcel(importedFlows, mode);
  }

  function handleDuplicateResolve(mode) {
    const pending = pendingImport;
    setPendingImport(null);
    if (!pending || mode === 'cancel') return;
    finalizeImport(pending.importedFlows, pending.fixes, pending.notices, mode);
  }

  function handleCloneResolve(result) {
    const source = pendingClone;
    setPendingClone(null);
    if (!source || !result) return;
    onClone(source, result);
  }

  function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setImportError('');
    setImportSuccess('');
    setImportFixes([]);
    setImportNotices([]);

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const { flows: importedFlows, fixes, notices } = parseExcelToFlow(ev.target.result);

        // Detect duplicate L3 numbers + count how many existing activities
        // share each one. If any duplicates exist, defer to the modal so
        // the user can choose: keep all (coexist) / overwrite (delete old) /
        // cancel. No dupes → proceed immediately.
        const existingCounts = {};
        flows.forEach(f => {
          if (!f.l3Number) return;
          existingCounts[f.l3Number] = (existingCounts[f.l3Number] || 0) + 1;
        });
        const dupes = importedFlows
          .map(f => ({ l3Number: f.l3Number, count: existingCounts[f.l3Number] || 0 }))
          .filter(d => d.count > 0);

        if (dupes.length > 0) {
          setPendingImport({ importedFlows, fixes: fixes || [], notices: notices || [], dupes });
          return;
        }
        finalizeImport(importedFlows, fixes || [], notices || [], 'keep');
      } catch (err) {
        setImportError(err.message ?? '解析 Excel 時發生未知錯誤');
      }
    };
    reader.onerror = () => setImportError('讀取檔案失敗，請重試');
    reader.readAsArrayBuffer(file);
  }

  return (
    <div className="min-h-screen" style={{ background: '#F5F8FC' }}>
      {/* Top bar */}
      <header className="px-6 py-3 shadow-md flex items-center gap-4" style={{ background: '#2A5598', color: 'white' }}>
        <img
          src={`${import.meta.env.BASE_URL}logo.png`}
          alt="FlowSprite Logo"
          className={`h-9 w-9 rounded-full object-cover flex-shrink-0 logo-happy ${logoReaction ? `logo-${logoReaction}` : ''}`}
          onError={e => { e.currentTarget.style.display = 'none'; }}
        />
        <span className="text-lg font-bold tracking-wide">FlowSprite</span>

        <div className="ml-auto flex gap-2">
          <InfoDropdown />
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Page title */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">L3 工作流</h1>
            <p className="text-sm text-gray-500 mt-1">點星星可置頂、勾選可批量下載</p>
          </div>
          <div className="flex items-center gap-2">
            <ViewSwitcher value={view} onChange={setView} />
            {/* sort select / 上傳 / 新增 字級拉齊 spec fs-body 13px（PR #228） */}
            <select
              value={sortKey}
              onChange={e => setSortKey(e.target.value)}
              className="px-3 py-2 rounded-lg border border-gray-300 text-[13px] text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-300">
              {SORT_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>

            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={handleFileChange}
            />
            <button
              onClick={() => { setImportError(''); fileInputRef.current?.click(); }}
              className="px-5 py-2 rounded-lg text-white text-[13px] font-medium shadow transition-colors"
              style={{ background: '#2A5598' }}
              onMouseEnter={e => e.currentTarget.style.background = '#1E4677'}
              onMouseLeave={e => e.currentTarget.style.background = '#2A5598'}>
              上傳 Excel
            </button>

            <button onClick={onNew}
              className="px-5 py-2 rounded-lg text-white text-[13px] font-medium shadow transition-colors"
              style={{ background: '#2A5598' }}
              onMouseEnter={e => e.currentTarget.style.background = '#1E4677'}
              onMouseLeave={e => e.currentTarget.style.background = '#2A5598'}>
              + 新增 L3 工作流
            </button>
          </div>
        </div>

        <ImportErrorBanner error={importError} onDismiss={() => setImportError('')} />
        <ImportSuccessBanner message={importSuccess} onDismiss={() => setImportSuccess('')} />
        <ImportWarningsBanner
          fixes={importFixes}
          notices={importNotices}
          expanded={warningsExpanded}
          onToggleExpand={() => setWarningsExpanded(v => !v)}
          onDismiss={() => { setImportFixes([]); setImportNotices([]); setWarningsExpanded(false); }} />

        <BulkToolbar
          selectedCount={selectedIds.size}
          totalCount={sortedFlows.length}
          bulkFormats={bulkFormats}
          onSetBulkFormat={(fmt, on) => setBulkFormats(f => ({ ...f, [fmt]: on }))}
          pngQueueActive={pngQueue.length > 0}
          onSelectAll={selectAll}
          onClearSelected={clearSelected}
          onBulkDelete={handleBulkDelete}
          onBulkDownload={handleBulkDownload} />

        <PngProgressBanner pngQueue={pngQueue} pngTotal={pngTotal} />

        {/* Flow list — 2026-05-18：view='cards' 或 'table'、所有功能 parity */}
        {sortedFlows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <div className="text-5xl mb-4">📋</div>
            <p className="text-lg">尚無活動，點選右上角「新增 L3 活動」或「上傳 Excel」開始</p>
          </div>
        ) : view === 'table' ? (
          <FlowListTable
            flows={sortedFlows}
            selectedIds={selectedIds}
            onToggleSelect={toggleSelected}
            onSelectAll={selectAll}
            onClearSelected={clearSelected}
            sortKey={sortKey}
            onSortKeyChange={setSortKey}
            onTogglePin={onTogglePin}
            onEdit={onEdit}
            onDelete={handleDelete}
            onClone={setPendingClone}
            onExportPng={setPendingPngFlow} />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {sortedFlows.map(flow => (
              <FlowCard key={flow.id}
                flow={flow}
                isSelected={selectedIds.has(flow.id)}
                onToggleSelect={toggleSelected}
                onTogglePin={onTogglePin}
                onEdit={onEdit}
                onDelete={handleDelete}
                onClone={setPendingClone}
                onExportPng={setPendingPngFlow} />
            ))}
          </div>
        )}

      </main>

      {/* Hidden off-screen renderer for single-flow PNG export */}
      {pendingPngFlow && (
        <div style={{ position: 'fixed', left: '-9999px', top: '-9999px', pointerEvents: 'none' }}>
          <DiagramRenderer
            flow={pendingPngFlow}
            autoExportPng={true}
            onExportDone={() => setPendingPngFlow(null)}
          />
        </div>
      )}

      {/* Hidden off-screen renderer for bulk PNG queue (one flow at a time) */}
      {pngQueue.length > 0 && (
        <div style={{ position: 'fixed', left: '-9999px', top: '-9999px', pointerEvents: 'none' }}>
          <DiagramRenderer
            key={pngQueue[0].id}
            flow={pngQueue[0]}
            autoExportPng={true}
            onExportDone={() => {
              setPngQueue(q => q.slice(1));
            }}
          />
        </div>
      )}

      <BackToTop />

      <DuplicateImportModal
        pendingImport={pendingImport}
        onResolve={handleDuplicateResolve} />

      <CloneFlowModal
        source={pendingClone}
        onResolve={handleCloneResolve} />
    </div>
  );
}

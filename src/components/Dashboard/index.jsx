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
import { useState, useMemo, useEffect } from 'react';
// 2026-05-18：HelpPanel / ChangelogPanel / DesignGuidelinePanel 收攏到
// `InfoDropdown`「說明 ▾」單顆按鈕（使用者：「這三個按鈕不是第一眼需要
// 知道的資訊、有什麼好方法可以收攏」）。
import InfoDropdown from '../InfoDropdown.jsx';
import DiagramRenderer from '../DiagramRenderer.jsx';
import BackToTop from '../BackToTop.jsx';
import { exportDrawio } from '../../utils/drawioExport.js';
import { exportFlowToExcel } from '../../utils/excelExport.js';
import { SORT_OPTIONS, sortFlows, filterFlows, extractL2Options, extractRoleOptions } from './sortFlows.js';
import { ImportErrorBanner, ImportSuccessBanner, ImportWarningsBanner } from './Banners.jsx';
import { BulkToolbar, PngProgressBanner } from './BulkToolbar.jsx';
import { FlowCard } from './FlowCard.jsx';
import { FlowListTable } from './FlowListTable.jsx';
import { ViewSwitcher } from './ViewSwitcher.jsx';
import { DuplicateImportModal } from './DuplicateImportModal.jsx';
import { CloneFlowModal } from './CloneFlowModal.jsx';
import { SearchBar, EmptyState } from './SearchBar.jsx';
import { Pagination } from './Pagination.jsx';
import { useExcelImport } from './useExcelImport.js';

const VIEW_PREF_KEY = 'bpm_dashboard_view';
const SORT_PREF_KEY = 'flowsprite.dashboardSortKey';
const SEARCH_STATE_KEY = 'flowsprite.dashboardSearch'; // sessionStorage、跨 page navigate 保留、不跨 browser session
const VALID_SORT_KEYS = new Set(SORT_OPTIONS.map(o => o.value));
const PAGE_SIZE = 25;

function loadSearchState() {
  try {
    const raw = sessionStorage.getItem(SEARCH_STATE_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw);
    return {
      keyword: typeof v.keyword === 'string' ? v.keyword : '',
      l2: typeof v.l2 === 'string' ? v.l2 : '',
      roles: Array.isArray(v.roles) ? v.roles.filter(x => typeof x === 'string') : [],
    };
  } catch { return null; }
}

export default function Dashboard({ flows, onNew, onEdit, onDelete, onImportExcel, onTogglePin, onClone }) {
  // sortKey localStorage 持久化（PR #234）— 跨 session 記住、跟 view 同 pattern
  const [sortKey, setSortKey] = useState(() => {
    try {
      const v = localStorage.getItem(SORT_PREF_KEY);
      return v && VALID_SORT_KEYS.has(v) ? v : 'number-asc';
    } catch { return 'number-asc'; }
  });
  useEffect(() => {
    try { localStorage.setItem(SORT_PREF_KEY, sortKey); } catch { /* quota / disabled */ }
  }, [sortKey]);
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
  // 搜尋 / 篩選 state（PR #235）— sessionStorage 持久化、跨 page navigate
  // 保留、不跨瀏覽器 session（搜尋是臨時行為、不該長期記）
  const initialSearch = loadSearchState();
  const [keyword, setKeyword] = useState(initialSearch?.keyword ?? '');
  const [l2, setL2] = useState(initialSearch?.l2 ?? '');
  const [filterRoles, setFilterRoles] = useState(initialSearch?.roles ?? []);
  useEffect(() => {
    try {
      sessionStorage.setItem(SEARCH_STATE_KEY, JSON.stringify({ keyword, l2, roles: filterRoles }));
    } catch { /* quota / disabled */ }
  }, [keyword, l2, filterRoles]);
  const [page, setPage] = useState(1);
  // 篩選改變 → page 自動 reset 到 1（避免「第 3 頁但 filter 後只剩 2 頁」）
  useEffect(() => { setPage(1); }, [keyword, l2, filterRoles]);

  const [logoReaction, setLogoReaction] = useState(null); // 'flash' | 'dim' | null
  // Excel 匯入相關 state / handler — PR #236 抽到 useExcelImport hook
  const importHook = useExcelImport({ flows, onImportExcel, setLogoReaction });
  const {
    importError, setImportError,
    importSuccess, setImportSuccess,
    importFixes, importNotices,
    warningsExpanded, setWarningsExpanded,
    pendingImport,
    fileInputRef,
    handleFileChange,
    handleDuplicateResolve,
    dismissWarnings,
    triggerFilePicker,
  } = importHook;
  const [pendingPngFlow, setPendingPngFlow] = useState(null);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkFormats, setBulkFormats] = useState({ png: true, drawio: true, excel: true });
  const [pngQueue, setPngQueue] = useState([]); // flows awaiting PNG render
  const [pngTotal, setPngTotal] = useState(0);
  // pendingImport / handleDuplicateResolve / fileInputRef 由 useExcelImport hook 提供
  const [pendingClone, setPendingClone] = useState(null);

  // 篩選 dropdown 選項（從全集 flows 抽出，非 filtered 結果）
  const l2Options = useMemo(() => extractL2Options(flows), [flows]);
  const roleOptions = useMemo(() => extractRoleOptions(flows), [flows]);
  // Pipeline: filter → sort → paginate
  const filteredFlows = useMemo(
    () => filterFlows(flows, { keyword, l2, roles: filterRoles }),
    [flows, keyword, l2, filterRoles]
  );
  const sortedFlows = useMemo(() => sortFlows(filteredFlows, sortKey), [filteredFlows, sortKey]);
  const totalPages = Math.max(1, Math.ceil(sortedFlows.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pagedFlows = useMemo(
    () => sortedFlows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE),
    [sortedFlows, safePage]
  );
  function clearAllFilters() {
    setKeyword('');
    setL2('');
    setFilterRoles([]);
  }

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

  // finalizeImport / handleDuplicateResolve / handleFileChange 全在 useExcelImport hook
  function handleCloneResolve(result) {
    const source = pendingClone;
    setPendingClone(null);
    if (!source || !result) return;
    onClone(source, result);
  }

  return (
    <div className="min-h-screen" style={{ background: '#F5F8FC' }}>
      {/* Top bar */}
      <header className="px-6 py-3 shadow-md flex items-center gap-4" style={{ background: 'var(--brand-dark)', color: 'white' }}>
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
        {/* Page title — 頁標題 + 兩顆 CTA。view/sort 已搬到下方 SearchBar 列 */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">L3 工作流</h1>
          </div>
          <div className="flex items-center gap-2">
            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={handleFileChange}
            />
            <button
              onClick={triggerFilePicker}
              className="px-5 py-2 rounded-lg text-white text-sm font-medium shadow transition-colors"
              style={{ background: '#2A5598' }}
              onMouseEnter={e => e.currentTarget.style.background = '#1E4677'}
              onMouseLeave={e => e.currentTarget.style.background = '#2A5598'}>
              上傳 Excel
            </button>

            <button onClick={onNew}
              className="px-5 py-2 rounded-lg text-white text-sm font-medium shadow transition-colors"
              style={{ background: '#2A5598' }}
              onMouseEnter={e => e.currentTarget.style.background = '#1E4677'}
              onMouseLeave={e => e.currentTarget.style.background = '#2A5598'}>
              新增 L3 工作流
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
          onDismiss={dismissWarnings} />

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

        {/* 搜尋 / 篩選 bar + view/sort 控制（PR #237 合併到同一列、置右）。
            沒內容（flows.length === 0）時整列不渲染。 */}
        {flows.length > 0 && (
          <SearchBar
            keyword={keyword} onKeywordChange={setKeyword}
            l2={l2} onL2Change={setL2}
            roles={filterRoles} onRolesChange={setFilterRoles}
            l2Options={l2Options} roleOptions={roleOptions}
            onClearAll={clearAllFilters}
            viewSwitcher={<ViewSwitcher value={view} onChange={setView} />}
            sortControl={
              <select
                value={sortKey}
                onChange={e => setSortKey(e.target.value)}
                className="px-3 py-2 rounded-lg border border-line text-sm text-ink bg-card focus:outline-none focus:ring-2 focus:ring-brand-light">
                {SORT_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            } />
        )}

        {/* Flow list — 2026-05-18：view='cards' 或 'table'、所有功能 parity */}
        {flows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <div className="text-5xl mb-4">📋</div>
            <p className="text-lg">尚無活動，點選右上角「新增 L3 活動」或「上傳 Excel」開始</p>
          </div>
        ) : sortedFlows.length === 0 ? (
          <EmptyState onClearAll={clearAllFilters} />
        ) : view === 'table' ? (
          <FlowListTable
            flows={pagedFlows}
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
            {pagedFlows.map(flow => (
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

        {sortedFlows.length > 0 && (
          <Pagination page={safePage} totalPages={totalPages}
            totalCount={sortedFlows.length} onPageChange={setPage} />
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

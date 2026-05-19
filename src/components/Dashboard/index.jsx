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
import { Button } from '../ui/Button.jsx';
import DiagramRenderer from '../DiagramRenderer.jsx';
import BackToTop from '../BackToTop.jsx';
import { sortFlows, filterFlows, extractL2Options, extractRoleOptions, SORT_OPTIONS } from './sortFlows.js';
import { ImportErrorBanner, ImportSuccessBanner, ImportWarningsBanner } from './Banners.jsx';
import { BulkToolbar, PngProgressBanner } from './BulkToolbar.jsx';
import { FlowCard } from './FlowCard.jsx';
import { FlowListTable } from './FlowListTable.jsx';
import { ViewSwitcher } from './ViewSwitcher.jsx';
import { DuplicateImportModal } from './DuplicateImportModal.jsx';
import { CloneFlowModal } from './CloneFlowModal.jsx';
import { SearchBar, EmptyState, SelectWithChevron } from './SearchBar.jsx';
import { Pagination } from './Pagination.jsx';
import { useExcelImport } from './useExcelImport.js';
import { useDashboardFilters } from './useDashboardFilters.js';
import { useBulkActions } from './useBulkActions.js';

const PAGE_SIZE = 25;

export default function Dashboard({ flows, onNew, onEdit, onDelete, onImportExcel, onTogglePin, onClone }) {
  // 篩選 / 排序 / 分頁 state — PR #242 抽到 useDashboardFilters hook
  const {
    sortKey, setSortKey,
    view, setView,
    keyword, setKeyword,
    l2, setL2,
    filterRoles, setFilterRoles,
    page, setPage,
    clearAllFilters,
  } = useDashboardFilters();

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

  // 批量選取 / 下載 / 刪除 — PR #242 抽到 useBulkActions hook
  const bulkHook = useBulkActions({ sortedFlows, onDelete, setLogoReaction });
  const {
    selectedIds,
    bulkFormats, setBulkFormats,
    pngQueue, setPngQueue,
    pngTotal,
    toggleSelected, selectAll, clearSelected,
    handleBulkDownload, handleBulkDelete,
    removeFromSelection,
  } = bulkHook;

  // Auto-clear logo reaction after animation completes
  useEffect(() => {
    if (!logoReaction) return;
    const timer = setTimeout(() => setLogoReaction(null), 900);
    return () => clearTimeout(timer);
  }, [logoReaction]);

  // 單筆刪除 — 同步從 bulk selection 移除（避免幽靈 ID）
  function handleDelete(id) {
    setLogoReaction('dim');
    onDelete(id);
    removeFromSelection(id);
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
      <header className="px-6 py-3 shadow-md flex items-center gap-4" style={{ background: 'var(--brand-darker)', color: 'white' }}>
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
            <Button variant="primary" onClick={triggerFilePicker} className="px-5 py-2 shadow">
              上傳 Excel
            </Button>

            <Button variant="primary" onClick={onNew} className="px-5 py-2 shadow">
              新增 L3 工作流
            </Button>
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
              <SelectWithChevron value={sortKey} onChange={setSortKey} ariaLabel="排序方式">
                {SORT_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </SelectWithChevron>
            } />
        )}

        {/* Flow list — 2026-05-18：view='cards' 或 'table'、所有功能 parity */}
        {flows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-ink-faint">
            <p className="text-lg">尚無活動，點選右上角「新增 L3 工作流」或「上傳 Excel」開始</p>
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

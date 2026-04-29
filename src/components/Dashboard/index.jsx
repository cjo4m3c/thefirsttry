import { useState, useMemo, useRef, useEffect } from 'react';
import HelpPanel from '../HelpPanel.jsx';
import ChangelogPanel from '../ChangelogPanel.jsx';
import BackToTop from '../BackToTop.jsx';
import { parseExcelToFlow } from '../../utils/excelImport.js';
import { exportDrawio } from '../../utils/drawioExport.js';
import { exportFlowToExcel } from '../../utils/excelExport.js';

import { SORT_OPTIONS, sortFlows } from './sortFlows.js';
import ImportBanners from './ImportBanners.jsx';
import BulkToolbar from './BulkToolbar.jsx';
import FlowCard from './FlowCard.jsx';
import DuplicateImportModal from './DuplicateImportModal.jsx';
import PngRenderers from './PngRenderers.jsx';

export default function Dashboard({ flows, onNew, onEdit, onDelete, onImportExcel, onTogglePin }) {
  const [sortKey, setSortKey] = useState('number-asc');
  const [importError, setImportError] = useState('');
  const [importSuccess, setImportSuccess] = useState('');
  const [importWarnings, setImportWarnings] = useState([]);
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

  function finalizeImport(importedFlows, warnings, mode) {
    if (importedFlows.length > 1) {
      setImportSuccess(`成功匯入 ${importedFlows.length} 個 L3 活動：${importedFlows.map(f => f.l3Number).join('、')}`);
    }
    if (warnings && warnings.length > 0) setImportWarnings(warnings);
    setLogoReaction('flash');
    onImportExcel(importedFlows, mode);
  }

  function handleDuplicateResolve(mode) {
    const pending = pendingImport;
    setPendingImport(null);
    if (!pending || mode === 'cancel') return;
    finalizeImport(pending.importedFlows, pending.warnings, mode);
  }

  function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setImportError('');
    setImportSuccess('');
    setImportWarnings([]);

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const { flows: importedFlows, warnings } = parseExcelToFlow(ev.target.result);

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
          setPendingImport({ importedFlows, warnings: warnings || [], dupes });
          return;
        }
        finalizeImport(importedFlows, warnings || [], 'keep');
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
          <ChangelogPanel />
          <HelpPanel />
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        {/* Page title */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">L3 工作流</h1>
            <p className="text-sm text-gray-500 mt-1">點星星可置頂、勾選可批量下載</p>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={sortKey}
              onChange={e => setSortKey(e.target.value)}
              className="px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-300">
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
              className="px-5 py-2 rounded-lg text-white font-medium shadow transition-colors"
              style={{ background: '#2A5598' }}
              onMouseEnter={e => e.currentTarget.style.background = '#1E4677'}
              onMouseLeave={e => e.currentTarget.style.background = '#2A5598'}>
              上傳 Excel
            </button>

            <button onClick={onNew}
              className="px-5 py-2 rounded-lg text-white font-medium shadow transition-colors"
              style={{ background: '#2A5598' }}
              onMouseEnter={e => e.currentTarget.style.background = '#1E4677'}
              onMouseLeave={e => e.currentTarget.style.background = '#2A5598'}>
              + 新增 L3 工作流
            </button>
          </div>
        </div>

        <ImportBanners
          importError={importError}       setImportError={setImportError}
          importSuccess={importSuccess}   setImportSuccess={setImportSuccess}
          importWarnings={importWarnings} setImportWarnings={setImportWarnings}
        />

        <BulkToolbar
          selectedCount={selectedIds.size}
          totalCount={sortedFlows.length}
          onSelectAll={selectAll}
          onClearSelected={clearSelected}
          bulkFormats={bulkFormats}
          onToggleFormat={(fmt, val) => setBulkFormats(f => ({ ...f, [fmt]: val }))}
          onBulkDelete={handleBulkDelete}
          onBulkDownload={handleBulkDownload}
          busy={pngQueue.length > 0}
        />

        {/* PNG batch progress */}
        {pngQueue.length > 0 && (
          <div className="mb-4 p-3 rounded-lg bg-yellow-50 border border-yellow-300 text-sm text-yellow-800 flex items-center gap-2">
            <span className="animate-spin inline-block w-4 h-4 border-2 border-yellow-500 border-t-transparent rounded-full" />
            正在產生 PNG {pngTotal - pngQueue.length + 1} / {pngTotal}（{pngQueue[0]?.l3Number} {pngQueue[0]?.l3Name}）
          </div>
        )}

        {/* Excel format hint */}
        <div className="mb-4 p-3 rounded-lg bg-sky-50 border border-sky-200 text-xs text-sky-800 space-y-1">
          <div>
            <strong>Excel 上傳格式（支援單檔多個 L3）：</strong>
            首列為標題列，欄位依序為：L3 活動編號、L3 活動名稱、L4 任務編號、L4 任務名稱、任務重點說明、任務重要輸入、
            <strong>任務負責角色</strong>（第 7 欄）、任務產出成品、<strong>任務關聯說明</strong>（第 9 欄）、參考資料來源文件名稱。
          </div>
          <div>
            <strong>任務關聯說明支援的標記：</strong>
            <span className="ml-1">序列流向 5-1-1-3</span>
            <span className="mx-1 text-sky-500">·</span>
            <span>流程開始</span>
            <span className="mx-1 text-sky-500">·</span>
            <span>流程結束</span>
            <span className="mx-1 text-sky-500">·</span>
            <span>條件分支至 5-1-1-3、5-1-1-5</span>
            <span className="mx-1 text-sky-500">·</span>
            <span>條件合併來自多個分支</span>
          </div>
        </div>

        {/* Flow list */}
        {sortedFlows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <div className="text-5xl mb-4">📋</div>
            <p className="text-lg">尚無活動，點選右上角「新增 L3 活動」或「上傳 Excel」開始</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {sortedFlows.map(flow => (
              <FlowCard key={flow.id}
                flow={flow}
                selected={selectedIds.has(flow.id)}
                onToggleSelect={toggleSelected}
                onTogglePin={onTogglePin}
                onEdit={onEdit}
                onDelete={handleDelete}
                onRequestPng={setPendingPngFlow}
              />
            ))}
          </div>
        )}

      </main>

      <PngRenderers
        pendingPngFlow={pendingPngFlow}
        onSinglePngDone={() => setPendingPngFlow(null)}
        pngQueue={pngQueue}
        onQueueItemDone={() => setPngQueue(q => q.slice(1))}
      />

      <BackToTop />

      <DuplicateImportModal
        pendingImport={pendingImport}
        onResolve={handleDuplicateResolve}
      />
    </div>
  );
}

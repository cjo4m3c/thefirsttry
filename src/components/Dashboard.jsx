import { useState, useMemo, useRef, useEffect } from 'react';
import HelpPanel from './HelpPanel.jsx';
import ChangelogPanel from './ChangelogPanel.jsx';
import DiagramRenderer from './DiagramRenderer.jsx';
import { parseExcelToFlow } from '../utils/excelImport.js';
import { exportDrawio } from '../utils/drawioExport.js';
import { exportFlowToExcel } from '../utils/excelExport.js';

const SORT_OPTIONS = [
  { value: 'number-asc',  label: 'L3 編號 ↑' },
  { value: 'number-desc', label: 'L3 編號 ↓' },
  { value: 'updated-desc', label: '更新日期（最新）' },
  { value: 'updated-asc',  label: '更新日期（最舊）' },
];

function sortFlows(flows, sortKey) {
  const arr = [...flows];
  switch (sortKey) {
    case 'number-asc':
      arr.sort((a, b) => String(a.l3Number ?? '').localeCompare(String(b.l3Number ?? ''), 'zh-TW', { numeric: true }));
      break;
    case 'number-desc':
      arr.sort((a, b) => String(b.l3Number ?? '').localeCompare(String(a.l3Number ?? ''), 'zh-TW', { numeric: true }));
      break;
    case 'updated-desc':
      arr.sort((a, b) => (b.updatedAt ?? b.createdAt ?? '').localeCompare(a.updatedAt ?? a.createdAt ?? ''));
      break;
    case 'updated-asc':
      arr.sort((a, b) => (a.updatedAt ?? a.createdAt ?? '').localeCompare(b.updatedAt ?? b.createdAt ?? ''));
      break;
    default:
      break;
  }
  // Pinned items always come first; pinned and non-pinned each keep above sort order.
  return [...arr.filter(f => f.pinned), ...arr.filter(f => !f.pinned)];
}

export default function Dashboard({ flows, onNew, onEdit, onView, onDelete, onImportExcel, onTogglePin }) {
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

    // drawio + excel: synchronous with staggered timers to avoid browser dedup
    selected.forEach((flow, i) => {
      if (drawio) setTimeout(() => exportDrawio(flow),       i * 220);
      if (excel)  setTimeout(() => exportFlowToExcel(flow),  i * 220 + 110);
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

  function fmtDateTime(iso) {
    if (!iso) return '';
    return new Date(iso).toLocaleString('zh-TW', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit',
    });
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

        // Warn if any L3 numbers already exist
        const existingNums = new Set(flows.map(f => f.l3Number).filter(Boolean));
        const dupes = importedFlows.filter(f => existingNums.has(f.l3Number)).map(f => f.l3Number);
        if (dupes.length > 0) {
          if (!window.confirm(
            `⚠ 以下 L3 編號已存在於系統中：${dupes.join('、')}\n繼續匯入將新增重複編號的活動，確定要繼續嗎？`
          )) return;
        }

        if (importedFlows.length > 1) {
          setImportSuccess(`成功匯入 ${importedFlows.length} 個 L3 活動：${importedFlows.map(f => f.l3Number).join('、')}`);
        }
        if (warnings && warnings.length > 0) setImportWarnings(warnings);
        setLogoReaction('flash');
        onImportExcel(importedFlows);
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
              className="px-4 py-2 rounded-lg font-medium text-sm shadow transition-colors border"
              style={{ background: '#3470B5', color: 'white', borderColor: '#3470B5' }}
              onMouseEnter={e => e.currentTarget.style.background = '#274F86'}
              onMouseLeave={e => e.currentTarget.style.background = '#3470B5'}>
              上傳 Excel
            </button>

            <button onClick={onNew}
              className="px-5 py-2 rounded-lg text-white font-medium shadow transition-colors"
              style={{ background: '#2A5598' }}
              onMouseEnter={e => e.currentTarget.style.background = '#1E4677'}
              onMouseLeave={e => e.currentTarget.style.background = '#2A5598'}>
              + 新增 L3 活動
            </button>
          </div>
        </div>

        {/* Import error banner */}
        {importError && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700 flex items-start gap-2">
            <span className="flex-shrink-0 font-bold">!</span>
            <span className="whitespace-pre-line flex-1">{importError}</span>
            <button onClick={() => setImportError('')} className="ml-auto text-red-400 hover:text-red-600 font-bold">×</button>
          </div>
        )}

        {/* Import success banner (multi-L3 only) */}
        {importSuccess && (
          <div className="mb-4 p-3 rounded-lg bg-sky-50 border border-sky-200 text-sm text-sky-800 flex items-start gap-2">
            <span className="flex-shrink-0">✓</span>
            <span>{importSuccess}</span>
            <button onClick={() => setImportSuccess('')} className="ml-auto text-sky-400 hover:text-sky-600 font-bold">×</button>
          </div>
        )}

        {/* Import warnings banner (gateway-chain soft checks) */}
        {importWarnings.length > 0 && (
          <div className="mb-4 p-3 rounded-lg bg-amber-50 border border-amber-300 text-sm text-amber-800">
            <div className="flex items-start gap-2 mb-1.5">
              <span className="flex-shrink-0 font-bold">⚠</span>
              <span className="font-medium flex-1">
                Excel 已匯入，但有 {importWarnings.length} 筆閘道鏈警告（不影響使用，建議修正以獲得正確流程圖）
              </span>
              <button onClick={() => setImportWarnings([])}
                className="text-amber-400 hover:text-amber-600 font-bold">×</button>
            </div>
            <ul className="ml-5 space-y-0.5 text-xs">
              {importWarnings.slice(0, 20).map((w, i) => (
                <li key={i}>{w}</li>
              ))}
              {importWarnings.length > 20 && (
                <li className="text-amber-600">… 另有 {importWarnings.length - 20} 筆未顯示</li>
              )}
            </ul>
          </div>
        )}

        {/* Bulk toolbar (appears when any selected) */}
        {selectedIds.size > 0 && (
          <div className="mb-4 p-3 rounded-lg bg-blue-50 border border-blue-300 flex items-center gap-3 flex-wrap">
            <span className="text-sm font-medium text-blue-800">已選 {selectedIds.size} / {sortedFlows.length} 個活動</span>
            <button onClick={selectAll}
              className="text-xs px-2 py-1 rounded border border-blue-300 text-blue-600 hover:bg-blue-100">全選</button>
            <button onClick={clearSelected}
              className="text-xs px-2 py-1 rounded border border-gray-300 text-gray-600 hover:bg-gray-100">取消選取</button>
            <span className="mx-2 text-gray-300">|</span>
            <span className="text-xs text-blue-700">格式：</span>
            {['png', 'drawio', 'excel'].map(fmt => (
              <label key={fmt} className="flex items-center gap-1 text-xs text-blue-800 cursor-pointer select-none">
                <input type="checkbox" checked={bulkFormats[fmt]}
                  onChange={e => setBulkFormats(f => ({ ...f, [fmt]: e.target.checked }))}
                  className="w-3.5 h-3.5" />
                {fmt.toUpperCase()}
              </label>
            ))}
            <button onClick={handleBulkDelete}
              disabled={pngQueue.length > 0}
              className="ml-auto px-3 py-1.5 text-sm rounded font-medium border transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ borderColor: '#DC2626', color: '#DC2626', background: 'white' }}
              onMouseEnter={e => { if (!e.currentTarget.disabled) { e.currentTarget.style.background = '#FEE2E2'; } }}
              onMouseLeave={e => { e.currentTarget.style.background = 'white'; }}>
              批量刪除
            </button>
            <button onClick={handleBulkDownload}
              disabled={pngQueue.length > 0 || !(bulkFormats.png || bulkFormats.drawio || bulkFormats.excel)}
              className="px-4 py-1.5 text-sm rounded font-medium text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: '#2A5598' }}
              onMouseEnter={e => !e.currentTarget.disabled && (e.currentTarget.style.background = '#1E4677')}
              onMouseLeave={e => (e.currentTarget.style.background = '#2A5598')}>
              批量下載
            </button>
          </div>
        )}

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
              <div key={flow.id}
                className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow p-5 flex flex-col gap-3">
                {/* Header */}
                <div className="flex items-start gap-2">
                  <input type="checkbox" checked={selectedIds.has(flow.id)}
                    onChange={() => toggleSelected(flow.id)}
                    className="mt-0.5 w-4 h-4 flex-shrink-0 cursor-pointer"
                    title="勾選以批量下載 / 刪除" />
                  <button onClick={() => onTogglePin(flow.id)}
                    title={flow.pinned ? '取消置頂' : '置頂此工作流'}
                    className="flex-shrink-0 transition-transform hover:scale-110">
                    <svg width="18" height="18" viewBox="0 0 24 24"
                      fill={flow.pinned ? '#FBBF24' : 'none'}
                      stroke={flow.pinned ? '#D97706' : '#9CA3AF'} strokeWidth="2"
                      strokeLinejoin="round">
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                    </svg>
                  </button>
                  <span className="px-2 py-0.5 rounded text-xs font-bold text-white flex-shrink-0"
                    style={{ background: '#2A5598' }}>
                    {flow.l3Number}
                  </span>
                  <span className="font-semibold text-gray-800 leading-tight">{flow.l3Name}</span>
                </div>

                {/* Stats */}
                <div className="flex gap-3 text-xs text-gray-500">
                  <span>角色 {flow.roles?.length ?? 0}</span>
                  <span>·</span>
                  <span>任務 {flow.tasks?.length ?? 0}</span>
                </div>
                <div className="flex flex-col gap-0.5 text-xs text-gray-400">
                  {flow.createdAt && <span>建立：{fmtDateTime(flow.createdAt)}</span>}
                  {flow.updatedAt && <span>更新：{fmtDateTime(flow.updatedAt)}</span>}
                </div>

                {/* Roles preview */}
                <div className="flex flex-wrap gap-1">
                  {(flow.roles ?? []).map(r => (
                    <span key={r.id}
                      className="px-2 py-0.5 rounded-full text-xs text-white"
                      style={{ background: r.type === 'external' ? '#5B8AC9' : '#2A5598' }}>
                      {r.name}
                    </span>
                  ))}
                </div>

                {/* Actions */}
                <div className="flex flex-col gap-1.5 pt-1 border-t border-gray-100">
                  <div className="flex gap-1.5">
                    <button onClick={() => onEdit(flow.id)}
                      className="flex-1 py-1.5 text-sm rounded border border-blue-300 text-blue-700 hover:bg-blue-50 transition-colors font-medium">
                      編輯
                    </button>
                    <button onClick={() => {
                      if (window.confirm(`確定要刪除「${flow.l3Name}」嗎？`)) handleDelete(flow.id);
                    }}
                      className="px-3 py-1.5 text-sm rounded border border-red-200 text-red-500 hover:bg-red-50 transition-colors">
                      刪除
                    </button>
                  </div>
                  <div className="flex gap-1.5">
                    <button onClick={() => setPendingPngFlow(flow)}
                      className="flex-1 py-1.5 text-xs rounded border border-sky-300 text-sky-700 hover:bg-sky-50 transition-colors">
                      ↓ PNG
                    </button>
                    <button onClick={() => exportDrawio(flow)}
                      className="flex-1 py-1.5 text-xs rounded border border-blue-300 text-blue-700 hover:bg-blue-50 transition-colors">
                      ↓ draw.io
                    </button>
                    <button onClick={() => exportFlowToExcel(flow)}
                      className="flex-1 py-1.5 text-xs rounded border border-cyan-300 text-cyan-700 hover:bg-cyan-50 transition-colors">
                      ↓ Excel
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

      </main>

      {/* Hidden off-screen renderer for single-flow PNG export */}
      {pendingPngFlow && (
        <div style={{ position: 'fixed', left: '-9999px', top: '-9999px', pointerEvents: 'none' }}>
          <DiagramRenderer
            flow={pendingPngFlow}
            showExport={false}
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
            showExport={false}
            autoExportPng={true}
            onExportDone={() => {
              setPngQueue(q => q.slice(1));
            }}
          />
        </div>
      )}
    </div>
  );
}

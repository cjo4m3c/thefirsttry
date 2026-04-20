import { useState, useMemo, useRef } from 'react';
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
      return arr.sort((a, b) => String(a.l3Number ?? '').localeCompare(String(b.l3Number ?? ''), 'zh-TW', { numeric: true }));
    case 'number-desc':
      return arr.sort((a, b) => String(b.l3Number ?? '').localeCompare(String(a.l3Number ?? ''), 'zh-TW', { numeric: true }));
    case 'updated-desc':
      return arr.sort((a, b) => (b.updatedAt ?? b.createdAt ?? '').localeCompare(a.updatedAt ?? a.createdAt ?? ''));
    case 'updated-asc':
      return arr.sort((a, b) => (a.updatedAt ?? a.createdAt ?? '').localeCompare(b.updatedAt ?? b.createdAt ?? ''));
    default:
      return arr;
  }
}

export default function Dashboard({ flows, onNew, onEdit, onView, onDelete, onImportExcel }) {
  const [sortKey, setSortKey] = useState('number-asc');
  const [importError, setImportError] = useState('');
  const [importSuccess, setImportSuccess] = useState('');
  const [pendingPngFlow, setPendingPngFlow] = useState(null);
  const fileInputRef = useRef(null);

  const sortedFlows = useMemo(() => sortFlows(flows, sortKey), [flows, sortKey]);

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

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const importedFlows = parseExcelToFlow(ev.target.result);

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
        onImportExcel(importedFlows);
      } catch (err) {
        setImportError(err.message ?? '解析 Excel 時發生未知錯誤');
      }
    };
    reader.onerror = () => setImportError('讀取檔案失敗，請重試');
    reader.readAsArrayBuffer(file);
  }

  return (
    <div className="min-h-screen" style={{ background: '#F3F4F6' }}>
      {/* Top bar */}
      <header className="px-6 py-3 shadow-md flex items-center gap-4" style={{ background: '#4A5240', color: 'white' }}>
        <img
          src={`${import.meta.env.BASE_URL}logo.png`}
          alt="FlowSprite Logo"
          className="h-9 w-9 rounded-full object-cover flex-shrink-0 logo-happy"
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
            <h1 className="text-2xl font-bold text-gray-800">L3 活動管理</h1>
            <p className="text-sm text-gray-500 mt-1">管理所有 L3 活動，點選「編輯」可直接編輯 L4 泳道圖</p>
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
              style={{ background: '#16982B', color: 'white', borderColor: '#16982B' }}
              onMouseEnter={e => e.currentTarget.style.background = '#0f7020'}
              onMouseLeave={e => e.currentTarget.style.background = '#16982B'}>
              上傳 Excel
            </button>

            <button onClick={onNew}
              className="px-5 py-2 rounded-lg text-white font-medium shadow transition-colors"
              style={{ background: '#2A52BE' }}
              onMouseEnter={e => e.currentTarget.style.background = '#1a3a9e'}
              onMouseLeave={e => e.currentTarget.style.background = '#2A52BE'}>
              + 新增 L3 活動
            </button>
          </div>
        </div>

        {/* Import error banner */}
        {importError && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700 flex items-start gap-2">
            <span className="flex-shrink-0 font-bold">!</span>
            <span>{importError}</span>
            <button onClick={() => setImportError('')} className="ml-auto text-red-400 hover:text-red-600 font-bold">×</button>
          </div>
        )}

        {/* Import success banner (multi-L3 only) */}
        {importSuccess && (
          <div className="mb-4 p-3 rounded-lg bg-teal-50 border border-teal-200 text-sm text-teal-800 flex items-start gap-2">
            <span className="flex-shrink-0">✓</span>
            <span>{importSuccess}</span>
            <button onClick={() => setImportSuccess('')} className="ml-auto text-teal-400 hover:text-teal-600 font-bold">×</button>
          </div>
        )}

        {/* Excel format hint */}
        <div className="mb-4 p-3 rounded-lg bg-green-50 border border-green-200 text-xs text-green-800 space-y-1">
          <div>
            <strong>Excel 上傳格式（支援單檔多個 L3）：</strong>
            首列為標題列，欄位依序為：L3 活動編號、L3 活動名稱、L4 任務編號、L4 任務名稱、任務重點說明、任務重要輸入、
            <strong>任務負責角色</strong>（第 7 欄）、任務產出成品、<strong>任務關聯說明</strong>（第 9 欄）、參考資料來源文件名稱。
          </div>
          <div>
            <strong>任務關聯說明支援的標記：</strong>
            <span className="ml-1">序列流向 5.1.1.3</span>
            <span className="mx-1 text-green-500">·</span>
            <span>流程開始</span>
            <span className="mx-1 text-green-500">·</span>
            <span>流程結束</span>
            <span className="mx-1 text-green-500">·</span>
            <span>條件分支至 5.1.1.3、5.1.1.5</span>
            <span className="mx-1 text-green-500">·</span>
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
                  <span className="px-2 py-0.5 rounded text-xs font-bold text-white flex-shrink-0"
                    style={{ background: '#2A52BE' }}>
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
                      style={{ background: r.type === 'external' ? '#16982B' : '#6B7280' }}>
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
                      if (window.confirm(`確定要刪除「${flow.l3Name}」嗎？`)) onDelete(flow.id);
                    }}
                      className="px-3 py-1.5 text-sm rounded border border-red-200 text-red-500 hover:bg-red-50 transition-colors">
                      刪除
                    </button>
                  </div>
                  <div className="flex gap-1.5">
                    <button onClick={() => setPendingPngFlow(flow)}
                      className="flex-1 py-1.5 text-xs rounded border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors">
                      ↓ PNG
                    </button>
                    <button onClick={() => exportDrawio(flow)}
                      className="flex-1 py-1.5 text-xs rounded border border-indigo-200 text-indigo-600 hover:bg-indigo-50 transition-colors">
                      ↓ draw.io
                    </button>
                    <button onClick={() => exportFlowToExcel(flow)}
                      className="flex-1 py-1.5 text-xs rounded border border-green-200 text-green-600 hover:bg-green-50 transition-colors">
                      ↓ Excel
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Future expansion note */}
        <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700">
          <strong>系統層級架構：</strong>
          L1 業務領域 → L2 價值流 → L3 活動（泳道圖）→ L4 任務 → L5 步驟
          <br />
          <span className="opacity-70">目前支援 L3 活動 / L4 任務泳道圖，L5 步驟功能將陸續新增</span>
        </div>
      </main>

      {/* Hidden off-screen renderer for PNG export */}
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
    </div>
  );
}

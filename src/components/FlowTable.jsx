import { useState, useEffect, useMemo, useRef } from 'react';
import {
  buildTableL4Map,
  generateFlowAnnotation,
  EXCEL_HEADERS,
} from '../utils/excelExport.js';
import { AUX_FIELDS } from '../utils/auxFieldDefs.js';
import { getLaneShapeViolations } from '../model/flowSelectors.js';

// EXCEL_HEADERS = 10 core (0~9) + 20 auxiliary (10~29). When the user
// hasn't expanded aux columns we slice the header loop at the boundary
// to keep the table at its previous width.
const CORE_HEADER_COUNT = 10;

// Sticky-left columns spec — leftmost N columns are frozen during horizontal
// scroll so identifiers (L3 / L4 numbers + names) stay visible. Widths are
// fixed to known values so each cell knows its `left` offset.
//
// Indices are positions in EXCEL_HEADERS. When showL3 is off we hide cols
// 0/1, but L4-number / L4-name slide left and become the leftmost frozen
// pair. Computation lives in `getStickyMap` below.
const STICKY_WIDTHS_WITH_L3 = [
  { col: 0, width: 100 }, // L3 編號
  { col: 1, width: 160 }, // L3 名稱
  { col: 2, width: 110 }, // L4 編號
  { col: 3, width: 260 }, // L4 名稱
];
const STICKY_WIDTHS_WITHOUT_L3 = [
  { col: 2, width: 110 }, // L4 編號
  { col: 3, width: 260 }, // L4 名稱
];

function getStickyMap(showL3) {
  const list = showL3 ? STICKY_WIDTHS_WITH_L3 : STICKY_WIDTHS_WITHOUT_L3;
  const map = {};
  let acc = 0;
  list.forEach(({ col, width }) => {
    map[col] = { left: acc, width };
    acc += width;
  });
  return map;
}

// Shared cell builder. Pass `sticky={ left, width }` to freeze this cell on
// horizontal scroll; opaque background is required (sticky cells overlay
// scrolled content). Plain cells fall back to `min-w-` widths.
function cellStickyStyle(sticky) {
  if (!sticky) return undefined;
  return {
    position: 'sticky',
    left: `${sticky.left}px`,
    width: `${sticky.width}px`,
    minWidth: `${sticky.width}px`,
    zIndex: 4,
  };
}

// EditCell — buffered textarea. Local state holds the typing in-flight; we
// only patch back to liveFlow on blur to avoid a re-layout per keystroke.
// `value` change from outside re-syncs the buffer.
// `autoFit` (per-table user toggle) → textarea auto-grows to scrollHeight
// so long content shows in full without internal scroll. When false, falls
// back to fixed `rows={2}` and any user-applied `resize-y` size.
function EditCell({ value, onChange, placeholder = '', wide = false, sticky = null, autoFit = false }) {
  const [local, setLocal] = useState(value || '');
  useEffect(() => { setLocal(value || ''); }, [value]);
  const taRef = useRef(null);
  // Auto-fit: re-measure scrollHeight on every value change AND on mode
  // toggle. When mode flips off, clear the inline height so rows={2} +
  // any manual resize-y wins again.
  useEffect(() => {
    const el = taRef.current;
    if (!el) return;
    if (autoFit) {
      el.style.height = 'auto';
      el.style.height = el.scrollHeight + 'px';
    } else {
      el.style.height = '';
    }
  }, [autoFit, local]);
  const widthCls = sticky ? '' : (wide ? 'min-w-[260px]' : 'min-w-[140px]');
  return (
    <td
      className={`border border-gray-200 px-1 py-0.5 align-top bg-white ${widthCls}`}
      style={cellStickyStyle(sticky)}
    >
      <textarea
        ref={taRef}
        value={local}
        onChange={e => setLocal(e.target.value)}
        onBlur={() => { if (local !== (value || '')) onChange(local); }}
        placeholder={placeholder}
        rows={2}
        className="w-full px-1.5 py-1 text-base border border-gray-200 rounded bg-white focus:outline-none focus:ring-1 focus:ring-blue-300 resize-y"
      />
    </td>
  );
}

function ReadCell({ value, muted = false, wide = false, sticky = null, danger = false, title = undefined }) {
  const widthCls = sticky ? '' : (wide ? 'min-w-[260px]' : 'min-w-[140px]');
  const bg = muted ? 'bg-gray-50' : 'bg-gray-50';
  // PR-D6 (rule 6): violation cells colour the L4 number text red instead of
  // outlining the row — only the diagram keeps the red border.
  const text = danger ? 'text-red-600 font-semibold'
    : muted ? 'text-gray-400'
    : 'text-gray-700';
  return (
    <td
      className={`border border-gray-200 px-2 py-1.5 text-base whitespace-pre-wrap align-top ${bg} ${text} ${widthCls}`}
      style={cellStickyStyle(sticky)}
      title={title}
    >
      {value}
    </td>
  );
}

function RoleCell({ roleId, roles, onChange }) {
  return (
    <td className="border border-gray-200 px-1 py-0.5 align-top min-w-[140px] bg-white">
      <select
        value={roleId || ''}
        onChange={e => onChange(e.target.value)}
        className="w-full px-1.5 py-1 text-base border border-gray-200 rounded bg-white focus:outline-none focus:ring-1 focus:ring-blue-300"
      >
        <option value="">（無）</option>
        {roles.filter(r => r.name).map(r => (
          <option key={r.id} value={r.id}>{r.name}</option>
        ))}
      </select>
    </td>
  );
}

// localStorage key for "show L3 columns in table" toggle. Default false —
// the user already sees L3 編號 / L3 名稱 in the page Header, so on-screen
// these two columns are usually noise. They DO appear in Excel export
// regardless of this toggle (export = full data, view = filtered).
const L3_VISIBLE_KEY = 'bpm_flow_table_show_l3';

// localStorage key for "show 20 auxiliary description columns" toggle.
// Default false — auxiliary fields are off-flow metadata only relevant
// to a subset of business reviews. When off the table renders 10 core
// columns; when on, AUX_FIELDS expand to the right (separator entries
// become narrow visual gaps to preserve Excel grouping).
const AUX_VISIBLE_KEY = 'bpm_flow_table_show_aux';

// 24px narrow gap for AUX_FIELDS[i].separator entries — visually mimics
// the empty grouping columns in the user's Excel template.
const AUX_SEP_WIDTH = 24;

export default function FlowTable({ flow, onUpdateTask }) {
  const tasks = flow.tasks || [];
  const l4Map = useMemo(
    () => buildTableL4Map(flow.l3Number, tasks),
    [flow.l3Number, tasks]
  );
  // PR-D3 (backlog AJ companion): same lane / element-shape violation set
  // surfaced on the diagram, mirrored as a red row border in the table so
  // users editing data exclusively in the table can spot the issue too.
  const violationIds = useMemo(
    () => getLaneShapeViolations(tasks, flow.roles || []),
    [tasks, flow.roles]
  );

  const [showL3, setShowL3] = useState(() => {
    try { return localStorage.getItem(L3_VISIBLE_KEY) === 'true'; }
    catch { return false; }
  });
  useEffect(() => {
    try { localStorage.setItem(L3_VISIBLE_KEY, String(showL3)); }
    catch {}
  }, [showL3]);
  const [showAux, setShowAux] = useState(() => {
    try { return localStorage.getItem(AUX_VISIBLE_KEY) === 'true'; }
    catch { return false; }
  });
  useEffect(() => {
    try { localStorage.setItem(AUX_VISIBLE_KEY, String(showAux)); }
    catch {}
  }, [showAux]);
  // Per-table toggle: row heights = textarea content (auto-grow) vs the
  // default fixed rows={2}. Session-only — refresh resets to default.
  const [autoFitRows, setAutoFitRows] = useState(false);

  const stickyMap = useMemo(() => getStickyMap(showL3), [showL3]);

  function updateField(taskId, field, value) {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    onUpdateTask(taskId, { ...task, [field]: value });
  }

  // Auxiliary field updater — writes into task.meta[key]. Empty / whitespace
  // strings are stripped from the meta object so the saved data stays lean.
  function updateMeta(taskId, key, value) {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    const trimmed = (value ?? '').trim();
    const nextMeta = { ...(task.meta || {}) };
    if (trimmed) nextMeta[key] = value;
    else delete nextMeta[key];
    onUpdateTask(taskId, { ...task, meta: nextMeta });
  }

  return (
    <div className="mt-6">
      {/* Toggle bar — small, no title/description (info redundant with the
          page Header). The L3-columns toggle is kept because it's actionable.
          Auto-fit row heights toggle 2026-05-04: switches between fixed
          rows={2} (default) and textarea-grows-to-content. */}
      <div className="mb-2 flex justify-end gap-2">
        <button
          type="button"
          onClick={() => setShowAux(v => !v)}
          className="shrink-0 px-3 py-1.5 text-sm rounded border border-blue-200 bg-white text-blue-600 hover:bg-blue-50 transition-colors whitespace-nowrap"
          title="輔助欄位（執行主體 / 操作系統 / 動詞名詞 / 字典檢核 等 16 欄）為任務描述用，不影響流程圖、編號或連線。Excel 匯出無論顯示與否都會包含。"
        >
          {showAux ? '⊖ 隱藏輔助欄位' : '⊕ 顯示輔助欄位'}
        </button>
        <button
          type="button"
          onClick={() => setAutoFitRows(v => !v)}
          className="shrink-0 px-3 py-1.5 text-sm rounded border border-blue-200 bg-white text-blue-600 hover:bg-blue-50 transition-colors whitespace-nowrap"
          title={autoFitRows
            ? '回到預設兩行高度（內容超過會在 cell 內捲動）'
            : '自動展開每列到對應內容高度，不用捲動就看到全部內容'}
        >
          {autoFitRows ? '⇕ 回預設高度' : '⇕ 適應內容高度'}
        </button>
        <button
          type="button"
          onClick={() => setShowL3(v => !v)}
          className="shrink-0 px-3 py-1.5 text-sm rounded border border-blue-200 bg-white text-blue-600 hover:bg-blue-50 transition-colors whitespace-nowrap"
          title="L3 編號 / L3 名稱在頁面上方已有；下載 Excel 時無論顯示與否都會包含。"
        >
          {showL3 ? '隱藏 L3 欄位 ▲' : '顯示 L3 欄位 ▼'}
        </button>
      </div>

      {/* Self-scrolling container. Vertical: thead stays pinned via top:0.
          Horizontal: leftmost identifier columns (L4 編號 / 名稱; plus L3 pair
          when toggled on) are pinned via sticky left. Sticky boundary is
          this div itself; both axes covered by the same overflow:auto. */}
      <div
        className="overflow-auto border border-gray-200 rounded-lg"
        style={{ maxHeight: 'calc(100vh - 80px)' }}
      >
        <table className="border-collapse text-base" style={{ minWidth: '1100px' }}>
          <thead>
            <tr className="align-middle">
              {EXCEL_HEADERS.map((h, i) => {
                // Skip L3 編號 (i=0) and L3 名稱 (i=1) when toggle is off.
                if (!showL3 && (i === 0 || i === 1)) return null;
                // Skip 20 auxiliary columns when toggle is off.
                if (!showAux && i >= CORE_HEADER_COUNT) return null;
                const sticky = stickyMap[i];
                // Sticky+top corner cells need higher z so they sit above
                // both the row's other sticky-left cells and the rest of
                // the thead (which is sticky-top only).
                const z = sticky ? 7 : 5;
                // Auxiliary separator entries (4 of 20) become narrow visual
                // gaps mirroring the empty grouping columns in the Excel
                // template — no header text, just a divider.
                const isAuxSep = i >= CORE_HEADER_COUNT
                  && AUX_FIELDS[i - CORE_HEADER_COUNT]?.separator;
                const widthStyle = sticky
                  ? { width: `${sticky.width}px`, minWidth: `${sticky.width}px`, left: `${sticky.left}px` }
                  : isAuxSep
                  ? { width: `${AUX_SEP_WIDTH}px`, minWidth: `${AUX_SEP_WIDTH}px` }
                  : {};
                return (
                  <th
                    key={i}
                    className={`border border-gray-200 px-2 py-2 text-left font-semibold text-gray-700 align-middle bg-gray-100 sticky top-0`}
                    style={{ ...widthStyle, zIndex: z, ...(sticky ? { position: 'sticky' } : {}) }}
                  >
                    {h}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {tasks.map(task => {
              const annotation = generateFlowAnnotation(task, tasks, l4Map);
              const isViolation = violationIds.has(task.id);
              return (
                <tr key={task.id} className="hover:bg-blue-50 transition-colors">
                  {showL3 && <ReadCell value={flow.l3Number} muted sticky={stickyMap[0]} />}
                  {showL3 && <ReadCell value={flow.l3Name} muted sticky={stickyMap[1]} />}
                  <ReadCell value={l4Map[task.id] || ''} sticky={stickyMap[2]}
                    danger={isViolation}
                    title={isViolation ? '泳道角色類型與元件形狀不符（外部泳道應為外部互動，內部泳道應為 L4 任務）' : undefined} />
                  <EditCell wide
                    value={task.name || ''}
                    onChange={v => updateField(task.id, 'name', v)}
                    placeholder="任務名稱"
                    sticky={stickyMap[3]}
                    autoFit={autoFitRows}
                  />
                  <EditCell wide
                    value={task.description || ''}
                    onChange={v => updateField(task.id, 'description', v)}
                    placeholder="重點說明"
                    autoFit={autoFitRows}
                  />
                  <EditCell wide
                    value={task.inputItems || ''}
                    onChange={v => updateField(task.id, 'inputItems', v)}
                    placeholder="重要輸入"
                    autoFit={autoFitRows}
                  />
                  <RoleCell
                    roleId={task.roleId}
                    roles={flow.roles || []}
                    onChange={v => updateField(task.id, 'roleId', v)}
                  />
                  <EditCell
                    value={task.outputItems || ''}
                    onChange={v => updateField(task.id, 'outputItems', v)}
                    placeholder="產出成品"
                    autoFit={autoFitRows}
                  />
                  <ReadCell value={annotation} wide />
                  <EditCell
                    value={task.reference || ''}
                    onChange={v => updateField(task.id, 'reference', v)}
                    placeholder="參考文件"
                    autoFit={autoFitRows}
                  />
                  {showAux && AUX_FIELDS.map((f, i) => {
                    if (f.separator) {
                      return (
                        <td
                          key={`aux-${i}`}
                          className="border border-gray-200 bg-gray-50"
                          style={{ width: AUX_SEP_WIDTH, minWidth: AUX_SEP_WIDTH }}
                        />
                      );
                    }
                    return (
                      <EditCell
                        key={`aux-${i}`}
                        value={task.meta?.[f.key] || ''}
                        onChange={v => updateMeta(task.id, f.key, v)}
                        placeholder={f.header}
                        autoFit={autoFitRows}
                      />
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

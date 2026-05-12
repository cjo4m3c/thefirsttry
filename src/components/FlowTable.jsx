import { useState, useEffect, useMemo, useRef } from 'react';
import {
  buildTableL4Map,
  generateFlowAnnotation,
  EXCEL_HEADERS,
} from '../utils/excelExport.js';
import { AUX_FIELDS } from '../utils/auxFieldDefs.js';
import { getLaneShapeViolations } from '../model/flowSelectors.js';
import { useColumnWidths } from './FlowTable/useColumnWidths.js';

// EXCEL_HEADERS = 10 core (0~9) + 20 auxiliary (10~29). When the user
// hasn't expanded aux columns we slice the header loop at the boundary
// to keep the table at its previous width.
const CORE_HEADER_COUNT = 10;

// Per-column default widths. Sticky cols (0~3 / 2~3 depending on showL3)
// + 6 wide / 4 narrow core cols + aux cols (separator 24px, others 140px).
// Used as `useColumnWidths` hook input; user overrides on top via drag.
// 為什麼用 array index 當 key：EXCEL_HEADERS order 跟 schema 對應、index
// 是穩定 reference。schema 改（加減 column）時 user override 會錯位、
// 但 schema 改動是罕見事件且 user 看到怪表格可一鍵「重設欄寬」。
const DEFAULT_COL_WIDTHS = (() => {
  // 10 core cols
  const core = [
    100, // 0 L3 編號
    160, // 1 L3 名稱
    110, // 2 L4 編號
    260, // 3 任務名稱
    260, // 4 重點說明
    260, // 5 重要輸入
    140, // 6 任務角色
    140, // 7 產出成品
    260, // 8 任務關聯說明
    140, // 9 參考文件
  ];
  const aux = AUX_FIELDS.map(f => f.separator ? 24 : 140);
  return [...core, ...aux];
})();

// Sticky-left column indices (depend on showL3 toggle). Widths now come
// from useColumnWidths hook so user resize on sticky cols reflows the
// subsequent sticky cols' left offset correctly.
const STICKY_COLS_WITH_L3 = [0, 1, 2, 3];
const STICKY_COLS_WITHOUT_L3 = [2, 3];

function getStickyMap(showL3, widths) {
  const list = showL3 ? STICKY_COLS_WITH_L3 : STICKY_COLS_WITHOUT_L3;
  const map = {};
  let acc = 0;
  list.forEach(col => {
    map[col] = { left: acc, width: widths[col] };
    acc += widths[col];
  });
  return map;
}

// ColResizeHandle — 8px transparent strip on right edge of each resizable
// th. pointerDown 開始 drag、pointerMove 即時更新欄寬、pointerUp 結束。
//
// 用 setPointerCapture + React 同元素 onPointerMove/Up 的 pattern
// （跟 useDragEndpoint.js 一致）：捕獲 pointer 後、所有 pointer 事件都
// 送到 handle div、即使 cursor 移出去也不會掉事件。draggingRef 用
// ref 而非 state 避免 drag 中觸發本元件 re-render。
function ColResizeHandle({ idx, onResize, currentWidth }) {
  const draggingRef = useRef(false);
  const startRef = useRef({ x: 0, w: 0 });

  function onPointerDown(e) {
    e.preventDefault();
    e.stopPropagation();
    try { e.currentTarget.setPointerCapture?.(e.pointerId); } catch {}
    startRef.current = { x: e.clientX, w: currentWidth };
    draggingRef.current = true;
  }
  function onPointerMove(e) {
    if (!draggingRef.current) return;
    onResize(idx, startRef.current.w + (e.clientX - startRef.current.x));
  }
  function onPointerUp(e) {
    if (!draggingRef.current) return;
    try { e.currentTarget.releasePointerCapture?.(e.pointerId); } catch {}
    draggingRef.current = false;
  }

  return (
    <div
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      title="拖曳調整欄寬"
      style={{
        position: 'absolute', top: 0, right: 0, height: '100%', width: 8,
        cursor: 'col-resize', touchAction: 'none', zIndex: 10,
      }}
      className="hover:bg-blue-400 hover:bg-opacity-50"
    />
  );
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
  // 欄寬由 <table tableLayout: fixed> + <colgroup> 統一決定（user-resizable
  // via useColumnWidths）；cell 自己**不再帶 min-w-*** — 否則瀏覽器在
  // table-layout: fixed 下仍把 min-width 當下限、非 sticky 欄無法縮窄。
  return (
    <td
      className={`border border-gray-200 px-1 py-0.5 align-top bg-white`}
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
  // 欄寬由 colgroup 統一決定、cell 不帶 min-w-*（參見 EditCell 同邏輯）。
  // `wide` 參數保留但不再影響寬度（給未來 readability 用、可移除）。
  const bg = muted ? 'bg-gray-50' : 'bg-gray-50';
  // PR-D6 (rule 6): violation cells colour the L4 number text red instead of
  // outlining the row — only the diagram keeps the red border.
  const text = danger ? 'text-red-600 font-semibold'
    : muted ? 'text-gray-400'
    : 'text-gray-700';
  return (
    <td
      className={`border border-gray-200 px-2 py-1.5 text-base whitespace-pre-wrap align-top ${bg} ${text}`}
      style={cellStickyStyle(sticky)}
      title={title}
    >
      {value}
    </td>
  );
}

function RoleCell({ roleId, roles, onChange }) {
  return (
    <td className="border border-gray-200 px-1 py-0.5 align-top bg-white">
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

  // Per-user column widths (drag handle on th right edge to resize).
  // Persisted to localStorage; min 60 / max 600 px; reset via toolbar button.
  const { widths: colWidths, setWidth: setColWidth, resetAll: resetColWidths, hasOverrides: hasColOverrides } =
    useColumnWidths(DEFAULT_COL_WIDTHS);

  const stickyMap = useMemo(() => getStickyMap(showL3, colWidths), [showL3, colWidths]);

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
      {/* Toolbar — 3 toggle buttons (PR 2026-05-05): 適應內容高度 / 隱藏輔助欄位
          / 隱藏L3欄位。Pure-text labels (no icons), each toggle is highlighted
          when its named feature is active. Defaults: aux hidden + L3 hidden +
          default row height (i.e. 隱藏輔助欄位 / 隱藏L3欄位 highlighted, 適應內
          容高度 inactive on first visit; user-toggled state persists per
          localStorage). Layout: left-to-right per spec. */}
      <div className="mb-2 flex justify-end gap-2">
        {/* 重設欄寬 — 永遠顯示（讓使用者隨時看得到入口）；沒 override 時 disabled。 */}
        <button
          type="button"
          onClick={resetColWidths}
          disabled={!hasColOverrides}
          className="shrink-0 px-3 py-1.5 text-sm rounded border bg-white text-blue-600 border-blue-200 hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white transition-colors whitespace-nowrap"
          title={hasColOverrides
            ? '清除所有手動拉過的欄寬、回到預設值'
            : '尚未調整任何欄寬'}
        >
          重設欄寬
        </button>
        <button
          type="button"
          onClick={() => setAutoFitRows(v => !v)}
          className={`shrink-0 px-3 py-1.5 text-sm rounded border transition-colors whitespace-nowrap ${
            autoFitRows
              ? 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700'
              : 'bg-white text-blue-600 border-blue-200 hover:bg-blue-50'
          }`}
          title={autoFitRows
            ? '目前每列自動展開到對應內容高度（再按一次回預設兩行）'
            : '每列依內容高度自動展開（不用 cell 內捲動）'}
        >
          適應內容高度
        </button>
        <button
          type="button"
          onClick={() => setShowAux(v => !v)}
          className={`shrink-0 px-3 py-1.5 text-sm rounded border transition-colors whitespace-nowrap ${
            !showAux
              ? 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700'
              : 'bg-white text-blue-600 border-blue-200 hover:bg-blue-50'
          }`}
          title={!showAux
            ? '目前隱藏 21 欄輔助欄位（執行主體 / 操作系統 / 動詞名詞 / 字典檢核 等任務描述用）— 再按一次顯示'
            : '隱藏右側 21 欄輔助欄位（保留核心欄位專注編輯）'}
        >
          隱藏輔助欄位
        </button>
        <button
          type="button"
          onClick={() => setShowL3(v => !v)}
          className={`shrink-0 px-3 py-1.5 text-sm rounded border transition-colors whitespace-nowrap ${
            !showL3
              ? 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700'
              : 'bg-white text-blue-600 border-blue-200 hover:bg-blue-50'
          }`}
          title={!showL3
            ? '目前隱藏 L3 編號 / L3 名稱欄（頁面上方已顯示）— 再按一次顯示'
            : '隱藏 L3 編號 / L3 名稱欄'}
        >
          隱藏L3欄位
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
        <table className="border-collapse text-base" style={{ width: 'max-content', minWidth: '1100px', tableLayout: 'fixed' }}>
          {/* colgroup — drives every column's authoritative width.
              tableLayout: fixed means col widths win; cells overflow into
              wrap (textarea wraps text, ReadCell text wraps). User drags
              th right-edge handle to change colWidths state; persisted
              to localStorage via useColumnWidths hook. */}
          <colgroup>
            {EXCEL_HEADERS.map((_, i) => {
              if (!showL3 && (i === 0 || i === 1)) return null;
              if (!showAux && i >= CORE_HEADER_COUNT) return null;
              return <col key={i} style={{ width: `${colWidths[i]}px` }} />;
            })}
          </colgroup>
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
                // template — no header text, just a divider. Not resizable.
                const isAuxSep = i >= CORE_HEADER_COUNT
                  && AUX_FIELDS[i - CORE_HEADER_COUNT]?.separator;
                // Sticky cells need explicit left offset (computed from
                // current widths via getStickyMap). Width still comes from
                // colgroup, but sticky positioning requires the cell to
                // know its left.
                const stickyLeftStyle = sticky ? { left: `${sticky.left}px` } : {};
                return (
                  <th
                    key={i}
                    className={`border border-gray-200 px-2 py-2 text-left font-semibold text-gray-700 align-middle bg-gray-100 sticky top-0 relative`}
                    style={{ ...stickyLeftStyle, zIndex: z, ...(sticky ? { position: 'sticky' } : {}) }}
                  >
                    {h}
                    {!isAuxSep && (
                      <ColResizeHandle idx={i} onResize={setColWidth} currentWidth={colWidths[i]} />
                    )}
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

/**
 * FlowTable — FlowEditor 下半部 30 欄 Excel-like 任務表格。
 * 拆檔結構（PR #237、§6 拆檔）：
 *   - index.jsx（本檔）— 主元件 + toolbar + table 渲染
 *   - cells.jsx           — EditCell / ReadCell / RoleCell
 *   - ColResizeHandle.jsx — 欄寬拖曳 handle
 *   - sticky.js           — getStickyMap / cellStickyStyle / STICKY_COLS_*
 *   - widthDefaults.js    — DEFAULT_COL_WIDTHS + consts (L3_VISIBLE_KEY 等)
 *   - useColumnWidths.js  — per-user col widths localStorage hook
 */
import { useState, useEffect, useMemo } from 'react';
import {
  buildTableL4Map,
  generateFlowAnnotation,
  EXCEL_HEADERS,
} from '../../utils/excelExport.js';
import { AUX_FIELDS } from '../../utils/auxFieldDefs.js';
import { getLaneShapeViolations } from '../../model/flowSelectors.js';
import { useColumnWidths } from './useColumnWidths.js';
import { EditCell, ReadCell, RoleCell } from './cells.jsx';
import { ColResizeHandle } from './ColResizeHandle.jsx';
import { getStickyMap } from './sticky.js';
import {
  DEFAULT_COL_WIDTHS,
  CORE_HEADER_COUNT,
  L3_VISIBLE_KEY,
  AUX_VISIBLE_KEY,
  AUX_SEP_WIDTH,
} from './widthDefaults.js';

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

import { useRef, useEffect, useState, forwardRef, useImperativeHandle } from 'react';
import { toPng } from 'html-to-image';
import { computeLayout, routeArrow } from '../../diagram/layout.js';
import { detectOverrideViolations } from '../../diagram/violations.js';
import { LAYOUT, COLORS } from '../../diagram/constants.js';
import { exportDrawio } from '../../utils/drawioExport.js';
import { exportFlowToExcel } from '../../utils/excelExport.js';
import { todayYmd } from '../../utils/storage.js';
import { ArrowMarkers, ConnectionArrow, EndpointHandle } from './arrows.jsx';
import { StickyHeader } from './StickyHeader.jsx';
import { TasksLayer } from './TasksLayer.jsx';
import {
  DropTargetHighlight, OverrideIndicators, DragPreview, HoverTooltip,
} from './overlays.jsx';
import { useDragEndpoint } from './useDragEndpoint.js';

const { LANE_HEADER_W, TITLE_H } = LAYOUT;

// Geometric midpoint of a polyline by cumulative segment length. Returns
// {x, y} on the actual line at exactly half its total length — what the
// user perceives as "the middle of this line", regardless of how many
// corridor / cross-lane bends the route has. Used to anchor the selected-
// connection delete badge so it always sits on top of the line.
function polylineMidpoint(pts) {
  if (!pts || pts.length < 2) return null;
  const lens = [];
  let total = 0;
  for (let i = 1; i < pts.length; i++) {
    const dx = pts[i][0] - pts[i - 1][0];
    const dy = pts[i][1] - pts[i - 1][1];
    const l = Math.hypot(dx, dy);
    lens.push(l);
    total += l;
  }
  if (total === 0) return { x: pts[0][0], y: pts[0][1] };
  const half = total / 2;
  let acc = 0;
  for (let i = 0; i < lens.length; i++) {
    if (acc + lens[i] >= half) {
      const t = (half - acc) / lens[i];
      return {
        x: pts[i][0] + t * (pts[i + 1][0] - pts[i][0]),
        y: pts[i][1] + t * (pts[i + 1][1] - pts[i][1]),
      };
    }
    acc += lens[i];
  }
  return { x: pts[pts.length - 1][0], y: pts[pts.length - 1][1] };
}

const DiagramRenderer = forwardRef(function DiagramRenderer({ flow, autoExportPng = false,
  onExportDone = null, onUpdateOverride = null, onChangeTarget = null,
  onWireThroughGateway = null, onRemoveConnection = null,
  onResetOverride = null, onTaskClick = null, highlightedTaskId = null,
  densityMode = 'default' }, ref) {
  const exportRef = useRef(null);
  // Override-indicator wrapper — hidden during PNG export so the captured
  // image shows only the final routing, not editing artefacts (the amber
  // dots on hand-routed endpoints).
  const overrideIndicatorsRef = useRef(null);
  const svgRef = useRef(null);
  // Sticky-role-header support: when the diagram is wider than the viewport,
  // the user scrolls horizontally — but the role-header column on the left
  // should stay visible so they can always see whose lane each task is in.
  // We watch the scroll container's scrollLeft and apply a counter-translate
  // to the sticky <g> that holds the role-header rects + names + the vertical
  // separator at x=LANE_HEADER_W.
  const scrollContainerRef = useRef(null);
  const stickyHeadersRef = useRef(null);
  const [hoveredId, setHoveredId] = useState(null);
  const [hoveredConnKey, setHoveredConnKey] = useState(null);
  // Tooltip state for hover-on-task description preview.
  // { taskId, x, y } where x/y anchor the tooltip *above* the task shape.
  const [tooltip, setTooltip] = useState(null);
  const [selectedConnKey, setSelectedConnKey] = useState(null);
  const editable = !!(onUpdateOverride || onChangeTarget);

  useEffect(() => {
    if (!autoExportPng || !exportRef.current) return;
    resetStickyForExport();
    toPng(exportRef.current, { pixelRatio: 2, backgroundColor: '#ffffff' })
      .then(dataUrl => {
        const a = document.createElement('a');
        a.download = `${flow.l3Number}-${flow.l3Name}-${todayYmd()}.png`;
        a.href = dataUrl;
        a.click();
      })
      .catch(e => alert(`PNG 匯出失敗：${e?.message || e}`))
      .finally(() => onExportDone?.());
  }, [autoExportPng]);

  // Sticky role header: keep the left column anchored to the viewport as the
  // user scrolls horizontally. Direct DOM mutation (not React state) — runs
  // every scroll tick so we avoid forcing a re-render of the whole SVG.
  //
  // Density toggle uses CSS `zoom` on the export wrapper which scales SVG
  // user units relative to scroll px: scrollLeft is reported in CSS px of
  // the scroll container (= visual px after zoom), but the SVG translate
  // is in user units. Divide by zoom so the counter-translate matches the
  // visual scroll distance — otherwise compact (0.85) lags and spacious
  // (1.15) overshoots, both leaving the header un-anchored.
  // Per user bug report 2026-05-04 後段：「緊密模式無法凍結角色欄、寬鬆
  // 模式角色欄向畫面中間移動」.
  const zoomFactor = densityMode === 'compact' ? 0.85 : densityMode === 'spacious' ? 1.15 : 1;
  function handleScrollLeft() {
    const sl = scrollContainerRef.current?.scrollLeft || 0;
    if (stickyHeadersRef.current) {
      stickyHeadersRef.current.setAttribute('transform', `translate(${sl / zoomFactor}, 0)`);
    }
  }

  // Re-apply the sticky transform whenever density changes — otherwise the
  // existing transform (computed under the previous zoom factor) stays
  // stale until the user scrolls again, leaving the header visibly offset.
  useEffect(() => {
    handleScrollLeft();
  }, [densityMode]);

  // Before PNG export, reset sticky transform so the captured image has the
  // role header at its natural x=0 position (otherwise the export would show
  // the header offset by whatever scrollLeft the user happened to be at).
  function resetStickyForExport() {
    if (stickyHeadersRef.current) stickyHeadersRef.current.setAttribute('transform', 'translate(0, 0)');
    if (scrollContainerRef.current) scrollContainerRef.current.scrollLeft = 0;
  }

  if (!flow || !flow.roles?.length || !flow.tasks?.length) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400 text-sm border border-dashed border-gray-300 rounded-lg">
        尚無流程資料，請完成表單後產生圖表
      </div>
    );
  }

  const { positions, connections, l4Numbers, svgWidth, svgHeight, laneTopY, laneHeights } = computeLayout(flow);

  // PR H: detect override-induced violations so we can stroke the offending
  // connections red in real time. Two categories (see violations.js):
  //   - IN+OUT mix on same port  (rule 1, blocking at save time)
  //   - line crosses other task  (rule 2, warning at save time)
  const { violatingConnIdx } = detectOverrideViolations(flow);

  // Drag-endpoint state machine (extracted hook). Owns dragInfo + handlers.
  const { dragInfo, setDragInfo, startDrag, moveDrag, endDrag } = useDragEndpoint({
    svgRef, flow, positions, connections, editable, onUpdateOverride, onChangeTarget, onWireThroughGateway,
  });

  // Esc cancels drag / clears selection. Delete + Backspace remove the
  // selected connection (deferred to onRemoveConnection prop).
  useEffect(() => {
    if (!editable) return;
    function onKey(e) {
      // Don't hijack typing in inputs / textareas / contenteditable.
      const t = e.target;
      const tag = t?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || t?.isContentEditable) return;
      if (e.key === 'Escape') {
        if (dragInfo) setDragInfo(null);
        else if (selectedConnKey) setSelectedConnKey(null);
        return;
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedConnKey && !dragInfo) {
        const conn = connections[parseInt(selectedConnKey.slice(1), 10)];
        if (conn && onRemoveConnection) {
          e.preventDefault();
          onRemoveConnection(conn.fromId, conn.overrideKey);
          setSelectedConnKey(null);
        }
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [editable, dragInfo, selectedConnKey, connections, onRemoveConnection]);

  // PR I: compute which endpoints of each connection have been manually
  // overridden so we can draw a small indicator (🔧 dot) that's visible
  // even when the connection isn't selected. Per-connection result:
  //   { source: boolean, target: boolean }
  // A source override exists iff `fromTask.connectionOverrides[overrideKey]
  // .exitSide` is set (same for target with `.entrySide`).
  const taskById = Object.fromEntries(flow.tasks.map(t => [t.id, t]));
  const overrideFlagOf = (conn) => {
    const fromTask = taskById[conn.fromId];
    const ov = fromTask?.connectionOverrides?.[conn.overrideKey];
    return { source: !!ov?.exitSide, target: !!ov?.entrySide };
  };
  const selectedConnHasOverride = (() => {
    if (!selectedConnKey) return false;
    const idx = parseInt(selectedConnKey.slice(1), 10);
    const c = connections[idx];
    if (!c) return false;
    const f = overrideFlagOf(c);
    return f.source || f.target;
  })();

  const selectedConn = selectedConnKey
    ? connections[parseInt(selectedConnKey.slice(1), 10)]
    : null;

  // Export handlers — exposed via useImperativeHandle below so the parent
  // (FlowEditor → Header) can trigger downloads from outside DiagramRenderer.
  // The parent wraps each call with its own save+validate gate.
  async function doPngExport() {
    if (!exportRef.current) return;
    resetStickyForExport();
    // Hide editing artefacts (override indicator dots) during export so
    // the captured PNG shows only the final routing, not which lines
    // were hand-routed. Dashboard preview renders editable=false so its
    // PNG path doesn't render OverrideIndicators in the first place.
    const ovEl = overrideIndicatorsRef.current;
    if (ovEl) ovEl.style.display = 'none';
    // Density toggle uses CSS zoom; reset to 1 during capture so the
    // exported file is always full-resolution regardless of the on-screen
    // density. Restored in finally.
    const prevZoom = exportRef.current.style.zoom;
    exportRef.current.style.zoom = 1;
    try {
      const dataUrl = await toPng(exportRef.current, { pixelRatio: 2, backgroundColor: '#ffffff' });
      const a = document.createElement('a');
      a.download = `${flow.l3Number}-${flow.l3Name}-${todayYmd()}.png`;
      a.href = dataUrl;
      a.click();
    } catch (e) {
      alert(`PNG 匯出失敗：${e?.message || e}`);
    } finally {
      if (ovEl) ovEl.style.display = '';
      if (exportRef.current) exportRef.current.style.zoom = prevZoom;
    }
  }

  function doDrawioExport() {
    try { exportDrawio(flow); }
    catch (e) { alert(`Draw.io 匯出失敗：${e?.message || e}`); }
  }

  function doExcelExport() {
    try { exportFlowToExcel(flow); }
    catch (e) { alert(`Excel 匯出失敗：${e?.message || e}`); }
  }

  useImperativeHandle(ref, () => ({
    exportPng:    () => doPngExport(),
    exportDrawio: () => doDrawioExport(),
    exportExcel:  () => doExcelExport(),
  }));

  // Derive endpoints of the hovered connection (if any) so we can light up
  // BOTH tasks that a hovered line connects.
  const hc = hoveredConnKey ? connections[parseInt(hoveredConnKey.slice(1), 10)] : null;
  const hoveredConnEndpoints = hc ? new Set([hc.fromId, hc.toId]) : null;

  return (
    <div className="flex flex-col gap-3 w-full">
      <div ref={scrollContainerRef} onScroll={handleScrollLeft}
        className="overflow-auto border border-gray-300 rounded-lg bg-white w-full">
        <div ref={exportRef} style={{
          display: 'inline-block',
          background: '#fff',
          // Per user spec 2026-05-04 後段：density toggle uses CSS zoom
          // for visual scaling. PNG export temporarily resets to 1
          // (see doPngExport) to capture full-resolution output.
          zoom: densityMode === 'compact' ? 0.85 : densityMode === 'spacious' ? 1.15 : 1,
        }}>
        <svg ref={svgRef} width={svgWidth} height={svgHeight} xmlns="http://www.w3.org/2000/svg"
          onPointerMove={editable && dragInfo ? moveDrag : undefined}
          onPointerUp={editable && dragInfo ? endDrag : undefined}
          onPointerCancel={editable && dragInfo ? endDrag : undefined}
          onClick={editable ? () => setSelectedConnKey(null) : undefined}>
          <ArrowMarkers />

          <rect x={0} y={0} width={svgWidth} height={svgHeight} fill="#FFFFFF" />

          <rect x={0} y={0} width={svgWidth} height={TITLE_H} fill={COLORS.TITLE_BG} />
          <text x={svgWidth / 2} y={TITLE_H / 2} textAnchor="middle" dominantBaseline="middle"
            fill={COLORS.TITLE_TEXT} fontSize={22} fontWeight="bold"
            fontFamily="Microsoft JhengHei, PingFang TC, sans-serif">
            {flow.l3Number}　{flow.l3Name}　—　業務活動泳道圖
          </text>

          {/* Lane backgrounds + bottom borders. Role-header rect + name +
              the vertical separator at x=LANE_HEADER_W are split out into
              the sticky `<g>` near the end of this SVG so they stay anchored
              to the viewport during horizontal scroll. */}
          {flow.roles.map((role, i) => {
            const laneY = laneTopY[i];
            const laneH = laneHeights[i];
            const laneBg = i % 2 === 0 ? COLORS.LANE_ODD : COLORS.LANE_EVEN;
            // The top-corridor gap above this lane belongs visually to this
            // lane (arrows entering this lane use that corridor). Extend
            // header + body rects upward to absorb the gap so the swimlane
            // has no white strip when the corridor reserves extra space.
            const prevBottom = i === 0 ? TITLE_H : laneTopY[i - 1] + laneHeights[i - 1];
            const fillTop = prevBottom;
            const fillH = laneY + laneH - fillTop;
            return (
              <g key={role.id}>
                <rect x={LANE_HEADER_W} y={fillTop} width={svgWidth - LANE_HEADER_W} height={fillH}
                  fill={laneBg} />
                <line x1={0} y1={laneY + laneH} x2={svgWidth} y2={laneY + laneH}
                  stroke={COLORS.LANE_BORDER} strokeWidth={1} />
              </g>
            );
          })}

          {connections.map((conn, i) => (
            <ConnectionArrow key={i} conn={conn} connKey={`c${i}`} positions={positions}
              hoveredId={hoveredId} hoveredConnKey={hoveredConnKey}
              onHover={setHoveredConnKey}
              isSelected={selectedConnKey === `c${i}`}
              onSelect={setSelectedConnKey}
              editable={editable}
              isViolation={violatingConnIdx.has(i)} />
          ))}

          <TasksLayer tasks={flow.tasks} positions={positions} l4Numbers={l4Numbers}
            hoveredId={hoveredId} hoveredConnEndpoints={hoveredConnEndpoints}
            highlightedTaskId={highlightedTaskId}
            setHoveredId={setHoveredId} setTooltip={setTooltip}
            onTaskClick={onTaskClick} />

          {editable && dragInfo?.dropTargetId && (
            <DropTargetHighlight pos={positions[dragInfo.dropTargetId]} />
          )}
          {editable && dragInfo?.dropTargetId && (
            <DropTargetHighlight pos={positions[dragInfo.dropTargetId]} />
          )}

          {editable && (
            <g ref={overrideIndicatorsRef}>
              <OverrideIndicators
                connections={connections} positions={positions}
                overrideFlagOf={overrideFlagOf} />
            </g>
          )}

          {editable && dragInfo && dragInfo.proposedSide && (
            <DragPreview
              conn={connections[parseInt(dragInfo.connKey.slice(1), 10)]}
              positions={positions} dragInfo={dragInfo} />
          )}

          {/* Handles for the selected connection's endpoints (render last
              so they're on top of tasks and connection lines). */}
          {editable && selectedConn && (() => {
            const from = positions[selectedConn.fromId];
            const to = positions[selectedConn.toId];
            if (!from || !to) return null;
            const srcPort = from[selectedConn.exitSide];
            const tgtPort = to[selectedConn.entrySide];
            const srcDragging = dragInfo?.endpoint === 'source';
            const tgtDragging = dragInfo?.endpoint === 'target';
            // Compute the actual rendered polyline so the delete badge sits
            // on top of the line — geometric src/tgt midpoint drifts off the
            // line for routes that go through corridors or cross lanes.
            const polyline = (srcPort && tgtPort)
              ? routeArrow(from, to, selectedConn.exitSide, selectedConn.entrySide,
                           selectedConn.laneBottomY, selectedConn.laneTopCorridorY)
              : null;
            const deletePt = polyline ? polylineMidpoint(polyline) : null;
            return (
              <>
                {srcPort && (
                  <EndpointHandle cx={srcPort.x} cy={srcPort.y}
                    onPointerDown={(e) => startDrag(e, selectedConnKey, 'source')}
                    isDragging={srcDragging} />
                )}
                {tgtPort && (
                  <EndpointHandle cx={tgtPort.x} cy={tgtPort.y}
                    onPointerDown={(e) => startDrag(e, selectedConnKey, 'target')}
                    isDragging={tgtDragging} />
                )}
                {deletePt && onRemoveConnection && !dragInfo && (
                  <g style={{ cursor: 'pointer' }}
                     onClick={(e) => {
                       e.stopPropagation();
                       onRemoveConnection(selectedConn.fromId, selectedConn.overrideKey);
                       setSelectedConnKey(null);
                     }}>
                    <title>刪除這條連線（或按 Delete 鍵）</title>
                    <circle cx={deletePt.x} cy={deletePt.y} r={11}
                      fill="#FFFFFF" stroke="#EF4444" strokeWidth={1.5} />
                    <line x1={deletePt.x - 4} y1={deletePt.y - 4}
                          x2={deletePt.x + 4} y2={deletePt.y + 4}
                          stroke="#EF4444" strokeWidth={1.8} strokeLinecap="round" />
                    <line x1={deletePt.x + 4} y1={deletePt.y - 4}
                          x2={deletePt.x - 4} y2={deletePt.y + 4}
                          stroke="#EF4444" strokeWidth={1.8} strokeLinecap="round" />
                  </g>
                )}
              </>
            );
          })()}

          <StickyHeader ref={stickyHeadersRef}
            roles={flow.roles} laneTopY={laneTopY} laneHeights={laneHeights}
            svgHeight={svgHeight} />
        </svg>
        </div>
      </div>

      <HoverTooltip tooltip={tooltip} tasks={flow.tasks} />
    </div>
  );
});

export default DiagramRenderer;

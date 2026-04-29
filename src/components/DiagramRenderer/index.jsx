import { useRef, useEffect, useState, forwardRef, useImperativeHandle } from 'react';
import { toPng } from 'html-to-image';
import { computeLayout } from '../../diagram/layout.js';
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

const DiagramRenderer = forwardRef(function DiagramRenderer({ flow, autoExportPng = false,
  onExportDone = null, onUpdateOverride = null, onChangeTarget = null,
  onWireThroughGateway = null,
  onResetOverride = null, onTaskClick = null, highlightedTaskId = null }, ref) {
  const exportRef = useRef(null);
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
  function handleScrollLeft() {
    const sl = scrollContainerRef.current?.scrollLeft || 0;
    if (stickyHeadersRef.current) {
      stickyHeadersRef.current.setAttribute('transform', `translate(${sl}, 0)`);
    }
  }

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

  // Esc key cancels active drag / clears selection.
  useEffect(() => {
    if (!editable) return;
    function onKey(e) {
      if (e.key !== 'Escape') return;
      if (dragInfo) setDragInfo(null);
      else if (selectedConnKey) setSelectedConnKey(null);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [editable, dragInfo, selectedConnKey]);

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
    try {
      const dataUrl = await toPng(exportRef.current, { pixelRatio: 2, backgroundColor: '#ffffff' });
      const a = document.createElement('a');
      a.download = `${flow.l3Number}-${flow.l3Name}-${todayYmd()}.png`;
      a.href = dataUrl;
      a.click();
    } catch (e) {
      alert(`PNG 匯出失敗：${e?.message || e}`);
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
        <div ref={exportRef} style={{ display: 'inline-block', background: '#fff' }}>
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
            <OverrideIndicators
              connections={connections} positions={positions}
              overrideFlagOf={overrideFlagOf} />
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

/**
 * Export flow as Draw.io XML (.drawio)
 * Open with diagrams.net (free, browser or desktop) or VS Code Draw.io extension.
 * From Draw.io you can also export to Visio VSDX, PDF, SVG, etc.
 */
import { computeLayout } from '../diagram/layout.js';
import { LAYOUT, COLORS } from '../diagram/constants.js';

const { LANE_HEADER_W, COL_W, LANE_H, TITLE_H, NODE_W, NODE_H, DIAMOND_SIZE, CIRCLE_R } = LAYOUT;

function esc(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Map exitSide/entrySide to Draw.io exit/entry point fractions
const SIDE_XY = {
  right:  { x: 1,   y: 0.5, dx: 0, dy: 0 },
  left:   { x: 0,   y: 0.5, dx: 0, dy: 0 },
  top:    { x: 0.5, y: 0,   dx: 0, dy: 0 },
  bottom: { x: 0.5, y: 1,   dx: 0, dy: 0 },
};

export function exportDrawio(flow) {
  const { positions, connections, l4Numbers, svgWidth, svgHeight } = computeLayout(flow);

  const cells = [];
  let id = 2; // 0 and 1 are reserved in mxGraph

  // Map task.id → mxCell id (number)
  const idMap = {};

  // ── Title bar ──────────────────────────────────────────────────
  cells.push(`<mxCell id="${id++}" value="${esc(`${flow.l3Number} ${flow.l3Name} — 業務流程泳道圖`)}"
    style="text;strokeColor=none;fillColor=${COLORS.TITLE_BG};fontColor=#ffffff;fontSize=14;fontStyle=1;align=center;verticalAlign=middle;html=1;"
    vertex="1" parent="1">
    <mxGeometry x="0" y="0" width="${svgWidth}" height="${TITLE_H}" as="geometry"/>
  </mxCell>`);

  // ── Lane backgrounds & headers ─────────────────────────────────
  flow.roles.forEach((role, i) => {
    const laneY = TITLE_H + i * LANE_H;
    const headerBg = role.type === 'external' ? COLORS.EXTERNAL_BG : COLORS.INTERNAL_BG;
    const laneBg = i % 2 === 0 ? COLORS.LANE_ODD : COLORS.LANE_EVEN;

    // Lane body (full width background)
    cells.push(`<mxCell id="${id++}" value=""
      style="strokeColor=${COLORS.LANE_BORDER};fillColor=${laneBg};html=1;"
      vertex="1" parent="1">
      <mxGeometry x="0" y="${laneY}" width="${svgWidth}" height="${LANE_H}" as="geometry"/>
    </mxCell>`);

    // Lane header (colored left strip with role name)
    cells.push(`<mxCell id="${id++}" value="${esc(role.name)}"
      style="text;strokeColor=${headerBg};fillColor=${headerBg};fontColor=#ffffff;fontSize=12;fontStyle=1;align=center;verticalAlign=middle;html=1;rotation=-90;"
      vertex="1" parent="1">
      <mxGeometry x="0" y="${laneY}" width="${LANE_HEADER_W}" height="${LANE_H}" as="geometry"/>
    </mxCell>`);
  });

  // ── Task shapes ────────────────────────────────────────────────
  flow.tasks.forEach(task => {
    const pos = positions[task.id];
    if (!pos) return;
    const num = l4Numbers[task.id];
    const cellId = id++;
    idMap[task.id] = cellId;

    if (task.type === 'start' || task.type === 'end') {
      const d = CIRCLE_R * 2;
      const fill = task.type === 'start' ? COLORS.START_FILL : COLORS.END_FILL;
      const stroke = task.type === 'start' ? COLORS.START_STROKE : COLORS.END_FILL;
      const fontColor = task.type === 'start' ? '#111827' : '#ffffff';
      cells.push(`<mxCell id="${cellId}" value="${esc(task.name || '')}"
        style="ellipse;whiteSpace=wrap;html=1;fillColor=${fill};strokeColor=${stroke};strokeWidth=2;fontSize=10;fontColor=${fontColor};align=center;verticalAlign=middle;"
        vertex="1" parent="1">
        <mxGeometry x="${pos.cx - CIRCLE_R}" y="${pos.cy - CIRCLE_R}" width="${d}" height="${d}" as="geometry"/>
      </mxCell>`);

    } else if (task.type === 'gateway') {
      const d = DIAMOND_SIZE * 2;
      const label = task.name ? esc(task.name) : '';
      cells.push(`<mxCell id="${cellId}" value="${label}"
        style="rhombus;whiteSpace=wrap;html=1;fillColor=${COLORS.GATEWAY_FILL};strokeColor=${COLORS.GATEWAY_STROKE};strokeWidth=1.5;fontSize=10;align=center;verticalAlign=middle;"
        vertex="1" parent="1">
        <mxGeometry x="${pos.cx - DIAMOND_SIZE}" y="${pos.cy - DIAMOND_SIZE}" width="${d}" height="${d}" as="geometry"/>
      </mxCell>`);

    } else {
      const fill = task.type === 'interaction' ? COLORS.INTERACTION_FILL : COLORS.TASK_FILL;
      const numLine = num ? `<font style="font-size:9px;color:#6b7280;">${esc(num)}</font><br/>` : '';
      const label = `${numLine}${esc(task.name)}`;
      cells.push(`<mxCell id="${cellId}" value="${label}"
        style="rounded=1;whiteSpace=wrap;html=1;fillColor=${fill};strokeColor=${COLORS.TASK_STROKE};strokeWidth=1.2;fontSize=10;align=center;verticalAlign=middle;arcSize=4;"
        vertex="1" parent="1">
        <mxGeometry x="${pos.cx - NODE_W / 2}" y="${pos.cy - NODE_H / 2}" width="${NODE_W}" height="${NODE_H}" as="geometry"/>
      </mxCell>`);
    }
  });

  // ── Connections ────────────────────────────────────────────────
  connections.forEach(conn => {
    const fromCellId = idMap[conn.fromId];
    const toCellId = idMap[conn.toId];
    if (!fromCellId || !toCellId) return;

    const exit  = SIDE_XY[conn.exitSide]  || SIDE_XY.right;
    const entry = SIDE_XY[conn.entrySide] || SIDE_XY.left;
    const label = conn.label ? esc(conn.label) : '';

    cells.push(`<mxCell id="${id++}" value="${label}"
      style="edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;exitX=${exit.x};exitY=${exit.y};exitDx=0;exitDy=0;entryX=${entry.x};entryY=${entry.y};entryDx=0;entryDy=0;strokeColor=${COLORS.ARROW_COLOR};fontSize=10;"
      edge="1" source="${fromCellId}" target="${toCellId}" parent="1">
      <mxGeometry relative="1" as="geometry"/>
    </mxCell>`);
  });

  // ── Assemble XML ───────────────────────────────────────────────
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<mxGraphModel dx="1422" dy="762" grid="0" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="${svgWidth}" pageHeight="${svgHeight}" math="0" shadow="0">
  <root>
    <mxCell id="0"/>
    <mxCell id="1" parent="0"/>
    ${cells.join('\n    ')}
  </root>
</mxGraphModel>`;

  const blob = new Blob([xml], { type: 'application/xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${flow.l3Number}-${flow.l3Name}.drawio`;
  a.click();
  URL.revokeObjectURL(url);
}

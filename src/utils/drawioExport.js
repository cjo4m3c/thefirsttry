/**
 * Export flow as Draw.io XML (.drawio)
 * Open with diagrams.net (free, browser or desktop) or VS Code Draw.io extension.
 */
import { computeLayout } from '../diagram/layout.js';
import { LAYOUT, COLORS } from '../diagram/constants.js';

const { LANE_HEADER_W, LANE_H, TITLE_H, NODE_W, NODE_H, DIAMOND_SIZE, CIRCLE_R } = LAYOUT;

// XML-escape for attribute values
function xa(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// Map exit/entry side name to Draw.io fraction coordinates
const SIDE = {
  right:  { x: 1,   y: 0.5 },
  left:   { x: 0,   y: 0.5 },
  top:    { x: 0.5, y: 0   },
  bottom: { x: 0.5, y: 1   },
};

export function exportDrawio(flow) {
  const { positions, connections, l4Numbers, svgWidth, svgHeight, laneTopY, laneHeights } = computeLayout(flow);

  // Cells are stored as plain objects, serialised at the end
  const cells = [];
  let nextId = 2; // 0 and 1 are reserved

  function rect(x, y, w, h, style, value = '') {
    const id = nextId++;
    cells.push({ id, value, style, x, y, w, h, type: 'vertex' });
    return id;
  }

  function edge(sourceId, targetId, style, value = '') {
    cells.push({ id: nextId++, value, style, sourceId, targetId, type: 'edge' });
  }

  // ── Title bar ──────────────────────────────────────────────────
  rect(0, 0, svgWidth, TITLE_H,
    `text;strokeColor=none;fillColor=${COLORS.TITLE_BG};fontColor=#ffffff;fontSize=14;fontStyle=1;align=center;verticalAlign=middle;html=1;`,
    `${flow.l3Number} ${flow.l3Name} — 業務活動泳道圖`);

  // ── Lane backgrounds & headers (dynamic heights) ───────────────
  flow.roles.forEach((role, i) => {
    const laneY = laneTopY[i];
    const laneH = laneHeights[i];
    const headerBg = role.type === 'external' ? COLORS.EXTERNAL_BG : COLORS.INTERNAL_BG;
    const laneBg = i % 2 === 0 ? COLORS.LANE_ODD : COLORS.LANE_EVEN;

    // Full-width lane background
    rect(0, laneY, svgWidth, laneH,
      `strokeColor=${COLORS.LANE_BORDER};fillColor=${laneBg};html=1;`);

    // Header strip with role name (horizontal text, no rotation)
    rect(0, laneY, LANE_HEADER_W, laneH,
      `text;strokeColor=${headerBg};fillColor=${headerBg};fontColor=#ffffff;fontSize=12;fontStyle=1;align=center;verticalAlign=middle;whiteSpace=wrap;html=0;`,
      role.name);
  });

  // ── Task shapes ────────────────────────────────────────────────
  const idMap = {};

  flow.tasks.forEach(task => {
    const pos = positions[task.id];
    if (!pos) return;
    const num = l4Numbers[task.id];

    // Label: "L4編號-任務名稱" format with dash separator (&#xa; causes literal display when xa() escapes it)
    const label = num ? `${num}-${task.name}` : (task.name || '');

    let cellId;
    if (task.type === 'start' || task.type === 'end') {
      const d = CIRCLE_R * 2;
      const fill = task.type === 'start' ? COLORS.START_FILL : COLORS.END_FILL;
      const stroke = task.type === 'start' ? COLORS.START_STROKE : COLORS.END_FILL;
      const fontColor = task.type === 'end' ? '#ffffff' : '#111827';
      cellId = rect(pos.cx - CIRCLE_R, pos.cy - CIRCLE_R, d, d,
        `ellipse;whiteSpace=wrap;html=0;fillColor=${fill};strokeColor=${stroke};strokeWidth=2;fontSize=10;fontColor=${fontColor};align=center;verticalAlign=middle;`,
        task.name || '');

    } else if (task.type === 'gateway') {
      const d = DIAMOND_SIZE * 2;
      const gType = task.gatewayType || 'xor';
      const symMap = { xor: '×', and: '+', or: '○' };
      const gwLabel = `${symMap[gType] || '×'}\n${task.name || ''}`;
      cellId = rect(pos.cx - DIAMOND_SIZE, pos.cy - DIAMOND_SIZE, d, d,
        `rhombus;whiteSpace=wrap;html=0;fillColor=${COLORS.GATEWAY_FILL};strokeColor=${COLORS.GATEWAY_STROKE};strokeWidth=1.5;fontSize=10;align=center;verticalAlign=middle;`,
        gwLabel);

    } else if (task.type === 'l3activity') {
      // Double-border via Draw.io's built-in "double" style
      cellId = rect(pos.cx - NODE_W / 2, pos.cy - NODE_H / 2, NODE_W, NODE_H,
        `whiteSpace=wrap;html=0;fillColor=${COLORS.L3_ACTIVITY_FILL};strokeColor=${COLORS.L3_ACTIVITY_STROKE};strokeWidth=1.5;fontSize=10;align=center;verticalAlign=middle;double=1;`,
        label);
    } else {
      const fill = task.type === 'interaction' ? COLORS.INTERACTION_FILL : COLORS.TASK_FILL;
      cellId = rect(pos.cx - NODE_W / 2, pos.cy - NODE_H / 2, NODE_W, NODE_H,
        `rounded=1;whiteSpace=wrap;html=0;fillColor=${fill};strokeColor=${COLORS.TASK_STROKE};strokeWidth=1.2;fontSize=10;align=center;verticalAlign=middle;arcSize=4;`,
        label);
    }

    idMap[task.id] = cellId;
  });

  // ── Connections ────────────────────────────────────────────────
  connections.forEach(conn => {
    const srcId = idMap[conn.fromId];
    const tgtId = idMap[conn.toId];
    if (!srcId || !tgtId) return;
    const ex = SIDE[conn.exitSide]  || SIDE.right;
    const en = SIDE[conn.entrySide] || SIDE.left;
    edge(srcId, tgtId,
      `edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;exitX=${ex.x};exitY=${ex.y};exitDx=0;exitDy=0;entryX=${en.x};entryY=${en.y};entryDx=0;entryDy=0;strokeColor=${COLORS.ARROW_COLOR};fontSize=10;`,
      conn.label || '');
  });

  // ── Serialise to XML ───────────────────────────────────────────
  const cellXml = cells.map(c => {
    if (c.type === 'vertex') {
      return `<mxCell id="${c.id}" value="${xa(c.value)}" style="${xa(c.style)}" vertex="1" parent="1"><mxGeometry x="${c.x}" y="${c.y}" width="${c.w}" height="${c.h}" as="geometry"/></mxCell>`;
    }
    return `<mxCell id="${c.id}" value="${xa(c.value)}" style="${xa(c.style)}" edge="1" source="${c.sourceId}" target="${c.targetId}" parent="1"><mxGeometry relative="1" as="geometry"/></mxCell>`;
  }).join('\n    ');

  // mxfile wrapper is required by modern Draw.io versions
  const xml = `<mxfile host="BPM-Flow-Designer" version="1.0">
  <diagram id="swimlane" name="${xa(`${flow.l3Number} ${flow.l3Name}`)}">
    <mxGraphModel grid="0" page="1" pageWidth="${svgWidth}" pageHeight="${svgHeight}">
      <root>
        <mxCell id="0"/>
        <mxCell id="1" parent="0"/>
        ${cellXml}
      </root>
    </mxGraphModel>
  </diagram>
</mxfile>`;

  const blob = new Blob([xml], { type: 'text/xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${flow.l3Number}-${flow.l3Name}.drawio`;
  a.click();
  URL.revokeObjectURL(url);
}

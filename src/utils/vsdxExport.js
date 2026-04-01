import JSZip from 'jszip';
import { computeLayout } from '../diagram/layout.js';
import { LAYOUT, COLORS } from '../diagram/constants.js';

const { LANE_HEADER_W, COL_W, LANE_H, TITLE_H, NODE_W, NODE_H, DIAMOND_SIZE, CIRCLE_R } = LAYOUT;

// 1 SVG pixel = 1/96 inch in Visio
const PX = 1 / 96;

function esc(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Convert SVG y (top-origin) to Visio y (bottom-origin)
function vy(svgY, svgH) { return (svgH - svgY) * PX; }
function vx(svgX) { return svgX * PX; }

function makeRect(id, cx_in, cy_in, w_in, h_in, fill, stroke, text, rounding = 0, geom = '') {
  return `<Shape ID="${id}" Type="Shape">
      <XForm>
        <PinX>${cx_in.toFixed(5)}</PinX>
        <PinY>${cy_in.toFixed(5)}</PinY>
        <Width>${w_in.toFixed(5)}</Width>
        <Height>${h_in.toFixed(5)}</Height>
        <LocPinX>${(w_in / 2).toFixed(5)}</LocPinX>
        <LocPinY>${(h_in / 2).toFixed(5)}</LocPinY>
        <Angle>0</Angle>
        <FlipX>0</FlipX>
        <FlipY>0</FlipY>
      </XForm>
      <Fill>
        <FillForegnd>${fill}</FillForegnd>
        <FillBkgnd>${fill}</FillBkgnd>
        <FillPattern>1</FillPattern>
      </Fill>
      <Line>
        <LineColor>${stroke}</LineColor>
        <LineWeight>0.01389</LineWeight>
        ${rounding > 0 ? `<Rounding>${rounding.toFixed(5)}</Rounding>` : ''}
      </Line>
      <Char IX="0">
        <Size>0.09</Size>
      </Char>
      <Para IX="0">
        <HorzAlign>1</HorzAlign>
        <VerticalAlign>1</VerticalAlign>
      </Para>${geom}
      ${text ? `<Text>${esc(text)}</Text>` : ''}
    </Shape>`;
}

function diamondGeom(w_in, h_in) {
  return `
      <Geom IX="0">
        <MoveTo IX="1"><X>${(w_in / 2).toFixed(5)}</X><Y>0.00000</Y></MoveTo>
        <LineTo IX="2"><X>${w_in.toFixed(5)}</X><Y>${(h_in / 2).toFixed(5)}</Y></LineTo>
        <LineTo IX="3"><X>${(w_in / 2).toFixed(5)}</X><Y>${h_in.toFixed(5)}</Y></LineTo>
        <LineTo IX="4"><X>0.00000</X><Y>${(h_in / 2).toFixed(5)}</Y></LineTo>
        <LineTo IX="5"><X>${(w_in / 2).toFixed(5)}</X><Y>0.00000</Y></LineTo>
      </Geom>`;
}

export async function exportVsdx(flow) {
  const { positions, l4Numbers, svgWidth, svgHeight } = computeLayout(flow);
  const shapes = [];
  let id = 1;

  // Title bar
  shapes.push(makeRect(
    id++,
    vx(svgWidth / 2), vy(TITLE_H / 2, svgHeight),
    vx(svgWidth), TITLE_H * PX,
    COLORS.TITLE_BG, COLORS.TITLE_BG,
    `${flow.l3Number} ${flow.l3Name} — 業務流程泳道圖`
  ));

  // Lane headers & bodies
  flow.roles.forEach((role, i) => {
    const laneY = TITLE_H + i * LANE_H;
    const headerBg = role.type === 'external' ? COLORS.EXTERNAL_BG : COLORS.INTERNAL_BG;
    const laneBg = i % 2 === 0 ? COLORS.LANE_ODD : COLORS.LANE_EVEN;

    // Lane body background
    shapes.push(makeRect(
      id++,
      vx(LANE_HEADER_W + (svgWidth - LANE_HEADER_W) / 2), vy(laneY + LANE_H / 2, svgHeight),
      vx(svgWidth - LANE_HEADER_W), LANE_H * PX,
      laneBg, '#cccccc', ''
    ));

    // Lane header
    shapes.push(makeRect(
      id++,
      vx(LANE_HEADER_W / 2), vy(laneY + LANE_H / 2, svgHeight),
      vx(LANE_HEADER_W), LANE_H * PX,
      headerBg, headerBg, role.name
    ));
  });

  // Task shapes
  flow.tasks.forEach(task => {
    const pos = positions[task.id];
    if (!pos) return;
    const num = l4Numbers[task.id];

    if (task.type === 'start' || task.type === 'end') {
      const d = CIRCLE_R * 2;
      const d_in = d * PX;
      const fill = task.type === 'start' ? COLORS.START_FILL : COLORS.END_FILL;
      const stroke = task.type === 'start' ? COLORS.START_STROKE : COLORS.END_FILL;
      shapes.push(makeRect(
        id++,
        vx(pos.cx), vy(pos.cy, svgHeight),
        d_in, d_in,
        fill, stroke, task.name || '',
        d_in / 2  // rounding = radius → makes a circle
      ));
    } else if (task.type === 'gateway') {
      const d = DIAMOND_SIZE * 2;
      const d_in = d * PX;
      shapes.push(makeRect(
        id++,
        vx(pos.cx), vy(pos.cy, svgHeight),
        d_in, d_in,
        COLORS.GATEWAY_FILL, COLORS.GATEWAY_STROKE,
        task.name || '',
        0,
        diamondGeom(d_in, d_in)
      ));
    } else {
      const fill = task.type === 'interaction' ? COLORS.INTERACTION_FILL : COLORS.TASK_FILL;
      const label = num ? `${num}\n${task.name}` : task.name;
      shapes.push(makeRect(
        id++,
        vx(pos.cx), vy(pos.cy, svgHeight),
        NODE_W * PX, NODE_H * PX,
        fill, COLORS.TASK_STROKE, label
      ));
    }
  });

  // VSDX file structure (ZIP containing XML files)
  const pageW_in = vx(svgWidth);
  const pageH_in = svgHeight * PX;

  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/visio/document.xml" ContentType="application/vnd.ms-visio.drawing.main+xml"/>
  <Override PartName="/visio/pages/page1.xml" ContentType="application/vnd.ms-visio.page+xml"/>
</Types>`;

  const rootRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.microsoft.com/visio/2010/relationships/document" Target="visio/document.xml"/>
</Relationships>`;

  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<VisioDocument xmlns="http://schemas.microsoft.com/office/visio/2012/main"
  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
  xml:space="preserve">
  <DocumentSettings/>
  <Pages>
    <Page ID="0" NameU="Page-1" IsCustomNameU="1" IsCustomName="1">
      <PageSheet UniqueID="{B7D1E3F2-0000-0000-0000-000000000001}" NameU="Page-1">
        <PageProps>
          <PageWidth>${pageW_in.toFixed(5)}</PageWidth>
          <PageHeight>${pageH_in.toFixed(5)}</PageHeight>
          <PageScale>1</PageScale>
          <DrawingScale>1</DrawingScale>
          <DrawingSizeType>4</DrawingSizeType>
          <DrawingScaleType>0</DrawingScaleType>
          <InhibitSnap>0</InhibitSnap>
        </PageProps>
      </PageSheet>
      <Rel r:id="rId1"/>
    </Page>
  </Pages>
</VisioDocument>`;

  const documentRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.microsoft.com/visio/2010/relationships/page" Target="pages/page1.xml"/>
</Relationships>`;

  const pageXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<PageContents xmlns="http://schemas.microsoft.com/office/visio/2012/main"
  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
  xml:space="preserve">
  <Shapes>
    ${shapes.join('\n    ')}
  </Shapes>
  <Connects/>
</PageContents>`;

  const pageRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>`;

  const zip = new JSZip();
  zip.file('[Content_Types].xml', contentTypes);
  zip.file('_rels/.rels', rootRels);
  zip.file('visio/document.xml', documentXml);
  zip.file('visio/_rels/document.xml.rels', documentRels);
  zip.file('visio/pages/page1.xml', pageXml);
  zip.file('visio/pages/_rels/page1.xml.rels', pageRels);

  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${flow.l3Number}-${flow.l3Name}.vsdx`;
  a.click();
  URL.revokeObjectURL(url);
}

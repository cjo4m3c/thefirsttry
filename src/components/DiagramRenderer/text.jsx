import { COLORS } from '../../diagram/constants.js';

/**
 * Approximate the rendered width of an SVG text string. CJK glyphs occupy
 * ~1× fontSize horizontally, Latin/digits ~0.55×. Used to size the white
 * background rect behind labels so it hugs the text (no fixed-width slabs).
 */
const cjkWidthRe = /[　-〿぀-ゟ゠-ヿ一-鿿＀-￯]/;
export function estimateTextWidth(text, fontSize = 14) {
  if (!text) return 0;
  let w = 0;
  for (const c of text) w += cjkWidthRe.test(c) ? fontSize : fontSize * 0.55;
  return w;
}

/**
 * Token-aware text wrapping for SVG labels.
 *
 * Tokenize: each CJK char / CJK-punct is its own token, each run of
 * Latin/digit chars is one token, other single non-space chars are one
 * token. Whitespace acts as separator only. This keeps English words
 * intact on line breaks instead of slicing "Sourcer" → "Sourc"+"er".
 *
 * CJK occupies ~2x the horizontal space of a Latin char; treat maxChars
 * as a CJK-equivalent budget (maxWidth = maxChars * 2 Latin units).
 */
export function wrapText(text, maxChars, maxTotal) {
  if (!text) return [];
  const cjkRe = /[　-〿぀-ゟ゠-ヿ一-鿿＀-￯]/;
  const tokens = text.match(/[　-〿぀-ゟ゠-ヿ一-鿿＀-￯]|[A-Za-z0-9]+|\S/g) || [];
  const tokWidth = t => [...t].reduce((s, c) => s + (cjkRe.test(c) ? 2 : 1), 0);
  const isLatin = c => /[A-Za-z0-9]/.test(c);
  const maxWidth = maxChars * 2;
  const totalCap = maxTotal != null ? maxTotal * 2 : Infinity;
  const lines = [];
  let cur = '', curW = 0, totalW = 0, truncated = false;
  for (const tok of tokens) {
    const tw = tokWidth(tok);
    if (totalW + tw > totalCap) { truncated = true; break; }
    if (!cur) { cur = tok; curW = tw; }
    else {
      const needsSpace = isLatin(cur[cur.length - 1]) && isLatin(tok[0]);
      const addW = tw + (needsSpace ? 1 : 0);
      if (curW + addW <= maxWidth) { cur += (needsSpace ? ' ' : '') + tok; curW += addW; }
      else { lines.push(cur); cur = tok; curW = tw; }
    }
    totalW += tw;
  }
  if (cur) lines.push(cur);
  if (truncated && lines.length) lines[lines.length - 1] += '…';
  return lines;
}

export function SvgLabel({ text, cx, cy, maxChars = 8, lineH = 32, fontSize = 16, fill = COLORS.TASK_TEXT, maxTotal = 22, bg = false, bgOpacity = 0.6 }) {
  const lines = wrapText(text, maxChars, maxTotal);
  const total = (lines.length - 1) * lineH;
  // When `bg` is true, render a hugging white pill behind each line first
  // so the text reads cleanly even when arrows pass underneath. Used by
  // GatewayShape so the gateway name doesn't get sliced by lines entering
  // / exiting the bottom port.
  return (
    <>
      {bg && lines.map((line, i) => {
        const w = estimateTextWidth(line, fontSize) + 8;
        const h = fontSize + 4;
        const y = cy - total / 2 + i * lineH;
        return (
          <rect key={`bg${i}`} x={cx - w / 2} y={y - h / 2}
            width={w} height={h} rx={2}
            fill={COLORS.ARROW_LABEL_BG} opacity={bgOpacity} />
        );
      })}
      {lines.map((line, i) => (
        <text key={i} x={cx} y={cy - total / 2 + i * lineH}
          textAnchor="middle" dominantBaseline="middle"
          fontSize={fontSize} fill={fill} letterSpacing="0.02em"
          fontFamily="Microsoft JhengHei, PingFang TC, sans-serif">
          {line}
        </text>
      ))}
    </>
  );
}

/**
 * Task L4 number rendered above the rect's top edge. Has a white pill
 * background so it stays readable when an arrow enters / exits the top
 * port (without bg the line cuts straight through the digits). The pill
 * width hugs the text — see estimateTextWidth.
 */
export function L4Number({ number, cx, y }) {
  if (!number) return null;
  const fontSize = 14;
  const w = estimateTextWidth(number, fontSize) + 8;
  const h = fontSize + 4;
  const baselineY = y - 7;
  return (
    <g>
      <rect x={cx - w / 2} y={baselineY - h / 2} width={w} height={h}
        fill={COLORS.ARROW_LABEL_BG} opacity={0.6} rx={2} />
      <text x={cx} y={baselineY} textAnchor="middle" dominantBaseline="middle"
        fontSize={fontSize} fill={COLORS.TASK_NUMBER}
        fontFamily="Microsoft JhengHei, PingFang TC, sans-serif">
        {number}
      </text>
    </g>
  );
}

export function EventLabel({ cx, y, name, desc, minX = 0 }) {
  const fontFamily = 'Microsoft JhengHei, PingFang TC, sans-serif';
  // Events (start/end) sit in roughly one column width (184px);
  // wrap at ~11 CJK chars for the name and ~14 for the smaller description
  // so long labels don't spill past the column / lane boundary.
  const nameLines = wrapText(name || '', 11);
  const descLines = wrapText(desc || '', 14);
  const nameLineH = 20;
  const descLineH = 19;
  const gap = 4;
  // Avoid overlapping the sticky left lane-header column: if the longest
  // name/desc line would draw left of `minX`, shift cx right by just enough
  // (textAnchor stays "middle" so the label is still centered relative to
  // its visible width). Caller passes minX = LANE_HEADER_W + safety gap.
  const widestLine = Math.max(
    0,
    ...nameLines.map(l => estimateTextWidth(l, 14)),
    ...descLines.map(l => estimateTextWidth(l, 13)),
  );
  const leftEdge = cx - widestLine / 2;
  const adjCx = leftEdge < minX ? cx + (minX - leftEdge) : cx;
  let cursor = y;
  return (
    <>
      {nameLines.map((line, i) => (
        <text key={`n${i}`} x={adjCx} y={cursor + i * nameLineH}
          textAnchor="middle" dominantBaseline="middle"
          fontSize={14} fill={COLORS.TASK_TEXT} fontFamily={fontFamily}>
          {line}
        </text>
      ))}
      {descLines.length > 0 && descLines.map((line, i) => {
        const y0 = cursor + Math.max(nameLines.length, 1) * nameLineH + gap + i * descLineH;
        return (
          <text key={`d${i}`} x={adjCx} y={y0}
            textAnchor="middle" dominantBaseline="middle"
            fontSize={13} fill="#6B7280" fontFamily={fontFamily}>
            {line}
          </text>
        );
      })}
    </>
  );
}

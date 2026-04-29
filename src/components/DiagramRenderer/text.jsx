import { COLORS } from '../../diagram/constants.js';

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

export function SvgLabel({ text, cx, cy, maxChars = 8, lineH = 32, fontSize = 16, fill = COLORS.TASK_TEXT, maxTotal = 22 }) {
  const lines = wrapText(text, maxChars, maxTotal);
  const total = (lines.length - 1) * lineH;
  return (
    <>
      {lines.map((line, i) => (
        <text key={i} x={cx} y={cy - total / 2 + i * lineH}
          textAnchor="middle" dominantBaseline="middle"
          fontSize={fontSize} fill={fill} fontFamily="Microsoft JhengHei, PingFang TC, sans-serif">
          {line}
        </text>
      ))}
    </>
  );
}

export function L4Number({ number, cx, y }) {
  if (!number) return null;
  return (
    <text x={cx} y={y - 7} textAnchor="middle" fontSize={14} fill={COLORS.TASK_NUMBER}
      fontFamily="Microsoft JhengHei, PingFang TC, sans-serif">
      {number}
    </text>
  );
}

export function EventLabel({ cx, y, name, desc }) {
  const fontFamily = 'Microsoft JhengHei, PingFang TC, sans-serif';
  // Events (start/end) sit in roughly one column width (184px);
  // wrap at ~11 CJK chars for the name and ~14 for the smaller description
  // so long labels don't spill past the column / lane boundary.
  const nameLines = wrapText(name || '', 11);
  const descLines = wrapText(desc || '', 14);
  const nameLineH = 20;
  const descLineH = 19;
  const gap = 4;
  let cursor = y;
  return (
    <>
      {nameLines.map((line, i) => (
        <text key={`n${i}`} x={cx} y={cursor + i * nameLineH}
          textAnchor="middle" dominantBaseline="middle"
          fontSize={14} fill={COLORS.TASK_TEXT} fontFamily={fontFamily}>
          {line}
        </text>
      ))}
      {descLines.length > 0 && descLines.map((line, i) => {
        const y0 = cursor + Math.max(nameLines.length, 1) * nameLineH + gap + i * descLineH;
        return (
          <text key={`d${i}`} x={cx} y={y0}
            textAnchor="middle" dominantBaseline="middle"
            fontSize={13} fill="#6B7280" fontFamily={fontFamily}>
            {line}
          </text>
        );
      })}
    </>
  );
}

import { forwardRef } from 'react';
import { LAYOUT, COLORS } from '../../diagram/constants.js';
import { wrapText } from './text.jsx';

const { LANE_HEADER_W, TITLE_H } = LAYOUT;

/**
 * Sticky role-header column. Translated by `scrollLeft` via the parent's
 * `handleScrollLeft` so it stays anchored to the left of the viewport while
 * horizontal scrolling. Rendered LAST in the SVG so it sits on top of
 * connection lines and tasks (the column visually covers anything that
 * scrolls under it).
 */
export const StickyHeader = forwardRef(function StickyHeader(
  { roles, laneTopY, laneHeights, svgHeight }, ref
) {
  return (
    <g ref={ref} transform="translate(0, 0)">
      {roles.map((role, i) => {
        const headerBg = role.type === 'external' ? COLORS.EXTERNAL_BG : COLORS.INTERNAL_BG;
        const laneY = laneTopY[i];
        const laneH = laneHeights[i];
        const prevBottom = i === 0 ? TITLE_H : laneTopY[i - 1] + laneHeights[i - 1];
        const fillTop = prevBottom;
        const fillH = laneY + laneH - fillTop;
        const lineH = 26;
        const lines = wrapText(role.name, 4);
        const total = (lines.length - 1) * lineH;
        return (
          <g key={`sticky-${role.id}`}>
            <rect x={0} y={fillTop} width={LANE_HEADER_W} height={fillH} fill={headerBg} />
            {lines.map((line, li) => (
              <text key={li} x={LANE_HEADER_W / 2}
                y={laneY + laneH / 2 - total / 2 + li * lineH}
                textAnchor="middle" dominantBaseline="middle"
                fill={COLORS.HEADER_TEXT} fontSize={18} fontWeight="bold"
                fontFamily="Microsoft JhengHei, PingFang TC, sans-serif">
                {line}
              </text>
            ))}
          </g>
        );
      })}
      <line x1={LANE_HEADER_W} y1={TITLE_H} x2={LANE_HEADER_W} y2={svgHeight}
        stroke={COLORS.LANE_BORDER} strokeWidth={1.5} />
    </g>
  );
});

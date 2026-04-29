export const LAYOUT = {
  // PR 2026-04-29 (-10% density pass): user reported needing browser-zoom 80%
  // for the desired page density, but that shrinks fonts too. Decoupled by
  // shrinking LAYOUT 10% while keeping font sizes (text.jsx lineH 32, font
  // tiers 16/14/13) intact. NODE_H unchanged to preserve 3-line task names.
  TITLE_H: 66,
  LANE_HEADER_W: 96,
  COL_W: 164,
  LANE_H: 136,
  NODE_W: 140,
  NODE_H: 84,
  DIAMOND_SIZE: 48,
  CIRCLE_R: 28,
  PADDING_RIGHT: 48,
  PADDING_BOTTOM: 48,
};

export const COLORS = {
  TITLE_BG: '#374151',
  TITLE_TEXT: '#FFFFFF',
  EXTERNAL_BG: '#009900',
  EXTERNAL_TEXT: '#FFFFFF',
  INTERNAL_BG: '#0066CC',
  INTERNAL_TEXT: '#FFFFFF',
  LANE_ODD: '#F0F6FB',
  LANE_EVEN: '#FFFFFF',
  LANE_BORDER: '#C8D9E8',
  TASK_FILL: '#FFFFFF',
  TASK_STROKE: '#9CA3AF',
  INTERACTION_FILL: '#D1D5DB',
  INTERACTION_STROKE: '#9CA3AF',
  GATEWAY_FILL: '#FFFFFF',
  GATEWAY_STROKE: '#9CA3AF',
  START_FILL: '#FFFFFF',
  START_STROKE: '#374151',
  END_FILL: '#374151',
  ARROW_COLOR: '#374151',
  ARROW_LABEL_BG: '#FFFFFF',
  TASK_TEXT: '#111827',
  TASK_NUMBER: '#6B7280',
  HEADER_TEXT: '#FFFFFF',
  L3_ACTIVITY_FILL: '#FFFFFF',
  L3_ACTIVITY_STROKE: '#374151',
};

// Grid 對齊：所有尺寸都是 GRID_CELL 的倍數，方便 routing grid 對齊。
// 改 GRID_CELL 時，下面的數值都會跟著縮放，泳道、元件、port 永遠落在
// cell 邊界，不會佔到 cell 中段。
//
// 一致性需求：
//   - cy = laneTopY + NODE_VOFFSET 要對齊 → LANE_H 必須是 2*GRID_CELL 倍數（NODE_VOFFSET=LANE_H/2）
//   - cx = LANE_HEADER_W + col*COL_W + COL_W/2 要對齊 → COL_W 必須是 2*GRID_CELL 倍數
//   - port = cx ± NODE_W/2 要對齊 → NODE_W、NODE_H 必須是 2*GRID_CELL 倍數
//   - DIAMOND_SIZE / CIRCLE_R 是 half-extent（不再 /2）→ 只要是 GRID_CELL 倍數即可
//
// 若改成 GRID_CELL=6，只要保留下面的倍數結構，數值會自動跟著變。
export const GRID_CELL = 8;

export const LAYOUT = {
  // 整數倍 GRID_CELL（單一邊界對齊）
  TITLE_H:       8 * GRID_CELL,   // 64
  LANE_HEADER_W: 12 * GRID_CELL,  // 96
  DIAMOND_SIZE:  6 * GRID_CELL,   // 48 (gateway 半徑)
  CIRCLE_R:      4 * GRID_CELL,   // 32 (start/end 半徑)
  PADDING_RIGHT: 6 * GRID_CELL,   // 48
  PADDING_BOTTOM: 6 * GRID_CELL,  // 48

  // 偶數倍 GRID_CELL（要再 /2，所以 2*GRID_CELL 倍數）
  COL_W:  24 * GRID_CELL,  // 192
  LANE_H: 18 * GRID_CELL,  // 144
  NODE_W: 18 * GRID_CELL,  // 144 (task 矩形寬)
  NODE_H: 10 * GRID_CELL,  // 80  (task 矩形高)
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
  INTERACTION_FILL: '#A0A0A0',
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

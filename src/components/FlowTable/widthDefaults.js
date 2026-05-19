/**
 * Default column widths + constants — 拆自 FlowTable.jsx（PR #237、§6 拆檔）。
 */
import { AUX_FIELDS } from '../../utils/auxFieldDefs.js';

// EXCEL_HEADERS = 10 core (0~9) + 20 auxiliary (10~29). When the user
// hasn't expanded aux columns we slice the header loop at the boundary
// to keep the table at its previous width.
export const CORE_HEADER_COUNT = 10;

// Per-column default widths. Sticky cols (0~3 / 2~3 depending on showL3)
// + 6 wide / 4 narrow core cols + aux cols (separator 24px, others 140px).
// Used as `useColumnWidths` hook input; user overrides on top via drag.
// 為什麼用 array index 當 key：EXCEL_HEADERS order 跟 schema 對應、index
// 是穩定 reference。schema 改（加減 column）時 user override 會錯位、
// 但 schema 改動是罕見事件且 user 看到怪表格可一鍵「重設欄寬」。
export const DEFAULT_COL_WIDTHS = (() => {
  // 10 core cols
  const core = [
    100, // 0 L3 編號
    160, // 1 L3 名稱
    110, // 2 L4 編號
    260, // 3 任務名稱
    260, // 4 重點說明
    260, // 5 重要輸入
    140, // 6 任務角色
    140, // 7 產出成品
    260, // 8 任務關聯說明
    140, // 9 參考文件
  ];
  const aux = AUX_FIELDS.map(f => f.separator ? 24 : 140);
  return [...core, ...aux];
})();

// localStorage key for "show L3 columns in table" toggle. Default false —
// the user already sees L3 編號 / L3 名稱 in the page Header, so on-screen
// these two columns are usually noise. They DO appear in Excel export
// regardless of this toggle (export = full data, view = filtered).
export const L3_VISIBLE_KEY = 'bpm_flow_table_show_l3';

// localStorage key for "show 20 auxiliary description columns" toggle.
// Default false — auxiliary fields are off-flow metadata only relevant
// to a subset of business reviews. When off the table renders 10 core
// columns; when on, AUX_FIELDS expand to the right (separator entries
// become narrow visual gaps to preserve Excel grouping).
export const AUX_VISIBLE_KEY = 'bpm_flow_table_show_aux';

// 24px narrow gap for AUX_FIELDS[i].separator entries — visually mimics
// the empty grouping columns in the user's Excel template.
export const AUX_SEP_WIDTH = 24;

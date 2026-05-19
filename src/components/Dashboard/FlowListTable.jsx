/**
 * FlowListTable — Dashboard 表格 view（方案 A、PR 開於 2026-05-18）。
 *
 * 跟卡片 view 功能 parity：pin / select / 編輯 / 複製 / 刪除 / 下載 PNG /
 * Drawio / Excel — 使用者：「卡片上有的功能表格上都有，兩者差異只是排列
 * 排版不同」。
 *
 * 不重做的部分（沿用 Dashboard 既有）：search / sort / filter / bulk
 * toolbar — view 切換不影響這些 state。
 *
 * 2026-05-19 強化（5 項使用者需求）：
 *   1. 表頭 checkbox 全選 / 部分選中 indeterminate
 *   2. 5 欄表頭可點排序（編號 / 名稱 / 角色 / 任務 / 日期），跟外面 sort
 *      dropdown 共享同一個 sortKey state（完全同步）
 *   3. 動作欄 6 顆按鈕全展開（編輯 / 複製 / PNG / Drawio / Excel / 刪除），
 *      下載不再收 ▾ dropdown
 *   4. 日期欄 whitespace-nowrap + 拉寬到 w-64 確保螢幕 100% 不折成 4 列
 */
import { useRef, useEffect } from 'react';
import { exportDrawio } from '../../utils/drawioExport.js';
import { exportFlowToExcel } from '../../utils/excelExport.js';
import { fmtDateTime } from './sortFlows.js';
import { autoSpace } from '../../utils/autoSpace.js';
import { Chip } from '../ui/Chip.jsx';
import { Button } from '../ui/Button.jsx';

function PinIcon({ pinned }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24"
      fill={pinned ? 'var(--star)' : 'none'}
      stroke={pinned ? 'var(--warning)' : 'var(--ink-faint)'} strokeWidth="2"
      strokeLinejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}

// 主要角色 chips preview — 最多顯示 1 個 + `+N` 摺疊（PR #228、釋出欄寬給
// 名稱欄）。`flex-nowrap` 強制一行、配合 row 等高策略。
function RolesPreview({ roles }) {
  const arr = Array.isArray(roles) ? roles : [];
  const visible = arr.slice(0, 1);
  const more = arr.length - visible.length;
  if (arr.length === 0) {
    return <span className="text-[11px] text-ink-faint">—</span>;
  }
  return (
    <div className="flex flex-nowrap gap-1 items-center overflow-hidden">
      {visible.map(r => (
        <Chip key={r.id} variant={r.type === 'external' ? 'external' : 'internal'}>
          {autoSpace(r.name)}
        </Chip>
      ))}
      {more > 0 && <Chip variant="more">+{more}</Chip>}
    </div>
  );
}

// 可排序表頭 — 點擊在 column-asc / column-desc 之間切換；目前 active 欄顯示 ↑ / ↓
function SortableHeader({ column, label, sortKey, onSortKeyChange, className = '' }) {
  const ascKey = `${column}-asc`;
  const descKey = `${column}-desc`;
  const isAsc = sortKey === ascKey;
  const isDesc = sortKey === descKey;
  const isActive = isAsc || isDesc;
  const next = isAsc ? descKey : ascKey;
  return (
    <th className={`px-3 py-2 font-semibold ${className}`}>
      <button
        onClick={() => onSortKeyChange(next)}
        className={`inline-flex items-center gap-1 hover:text-ink transition-colors ${isActive ? 'text-ink' : ''}`}
        title={`點擊以${isAsc ? '改為降序' : '排序'}`}>
        <span>{label}</span>
        <span className={`text-[11px] ${isActive ? '' : 'opacity-30'}`}>
          {isDesc ? '↓' : '↑'}
        </span>
      </button>
    </th>
  );
}

// 表頭 checkbox — 全選 / 取消全選 / 部分選中 indeterminate
function HeaderCheckbox({ flows, selectedIds, onSelectAll, onClearSelected }) {
  const ref = useRef(null);
  const total = flows.length;
  const selectedCount = flows.reduce((n, f) => n + (selectedIds.has(f.id) ? 1 : 0), 0);
  const allChecked = total > 0 && selectedCount === total;
  const partial = selectedCount > 0 && selectedCount < total;
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = partial;
  }, [partial]);
  function onChange() {
    if (allChecked) onClearSelected();
    else onSelectAll();
  }
  return (
    <input
      ref={ref}
      type="checkbox"
      checked={allChecked}
      onChange={onChange}
      className="w-4 h-4 cursor-pointer"
      title={allChecked ? '取消全選' : '全選本頁'}
      disabled={total === 0}
    />
  );
}

export function FlowListTable({
  flows, selectedIds, onToggleSelect, onSelectAll, onClearSelected,
  sortKey, onSortKeyChange,
  onTogglePin, onEdit, onDelete, onClone, onExportPng,
}) {
  return (
    <div className="overflow-x-auto border border-line rounded-lg bg-card">
      {/* 字級 spec fs-body 14px（new 7 階）；table-fixed 配合明確欄寬讓名稱 truncate 生效 */}
      <table className="w-full text-sm border-collapse table-fixed">
        <thead className="bg-paper-2 text-ink-soft">
          <tr className="text-left">
            <th className="px-3 py-2 w-10">
              <HeaderCheckbox
                flows={flows}
                selectedIds={selectedIds}
                onSelectAll={onSelectAll}
                onClearSelected={onClearSelected} />
            </th>
            <th className="px-2 py-2 w-8"></th>
            <SortableHeader column="number" label="編號"
              sortKey={sortKey} onSortKeyChange={onSortKeyChange}
              className="w-24" />
            <SortableHeader column="name" label="名稱"
              sortKey={sortKey} onSortKeyChange={onSortKeyChange} />
            <SortableHeader column="roles" label="角色"
              sortKey={sortKey} onSortKeyChange={onSortKeyChange}
              className="w-16 text-center" />
            <SortableHeader column="tasks" label="任務"
              sortKey={sortKey} onSortKeyChange={onSortKeyChange}
              className="w-16 text-center" />
            <th className="px-3 py-2 w-32 font-semibold">主要角色</th>
            <SortableHeader column="updated" label="日期"
              sortKey={sortKey} onSortKeyChange={onSortKeyChange}
              className="w-64" />
            <th className="px-3 py-2 w-[22rem] font-semibold">動作</th>
          </tr>
        </thead>
        <tbody>
          {flows.map(flow => {
            const isSelected = selectedIds.has(flow.id);
            return (
              <tr key={flow.id}
                className={`border-t border-line-dim hover:bg-paper transition-colors ${isSelected ? 'bg-brand-light-soft' : ''}`}>
                {/* checkbox */}
                <td className="px-3 py-2">
                  <input type="checkbox" checked={isSelected}
                    onChange={() => onToggleSelect(flow.id)}
                    className="w-4 h-4 cursor-pointer"
                    title="勾選以批量下載 / 刪除" />
                </td>
                {/* pin star */}
                <td className="px-2 py-2">
                  <button onClick={() => onTogglePin(flow.id)}
                    title={flow.pinned ? '取消置頂' : '置頂此工作流'}
                    className="transition-transform hover:scale-110">
                    <PinIcon pinned={flow.pinned} />
                  </button>
                </td>
                {/* L3 編號 chip */}
                <td className="px-3 py-2">
                  <Chip variant="id">{flow.l3Number}</Chip>
                </td>
                {/* L3 名稱 — truncate `…` + hover tooltip 顯示全名（PR #228 row 等高策略） */}
                <td className="px-3 py-2 font-medium text-ink">
                  <div className="truncate" title={flow.l3Name}>{autoSpace(flow.l3Name)}</div>
                </td>
                {/* 角色 count */}
                <td className="px-3 py-2 text-center text-ink-soft">{flow.roles?.length ?? 0}</td>
                {/* 任務 count */}
                <td className="px-3 py-2 text-center text-ink-soft">{flow.tasks?.length ?? 0}</td>
                {/* 主要角色 chips — cap 1 + N、flex-nowrap 強制一行 */}
                <td className="px-3 py-2">
                  <RolesPreview roles={flow.roles} />
                </td>
                {/* 日期 — whitespace-nowrap 確保兩列不折成四列；fs-caption 11 */}
                <td className="px-3 py-2 text-[11px] text-ink-faint leading-tight whitespace-nowrap">
                  {flow.createdAt && <div>建立：{fmtDateTime(flow.createdAt)}</div>}
                  {flow.updatedAt && <div>更新：{fmtDateTime(flow.updatedAt)}</div>}
                </td>
                {/* 動作 — 6 顆全展開、size="sm" 加大、flex-nowrap 強制一行 */}
                <td className="px-3 py-2">
                  <div className="flex gap-1 flex-nowrap items-center">
                    <Button size="sm" onClick={() => onEdit(flow.id)}>編輯</Button>
                    <Button size="sm" onClick={() => onClone(flow)} title="複製整條流程做延伸編輯">複製</Button>
                    <Button size="sm" onClick={() => onExportPng(flow)} title="下載 PNG 圖檔">PNG</Button>
                    <Button size="sm" onClick={() => exportDrawio(flow)} title="下載 Drawio 檔">Drawio</Button>
                    <Button size="sm" onClick={() => exportFlowToExcel(flow)} title="下載 Excel 檔">Excel</Button>
                    <Button size="sm" variant="danger" onClick={() => {
                      if (window.confirm(`確定要刪除「${flow.l3Name}」嗎？`)) onDelete(flow.id);
                    }}>刪除</Button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

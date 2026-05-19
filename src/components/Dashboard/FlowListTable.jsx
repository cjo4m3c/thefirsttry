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
 * 列高 / 排序 / 分頁等 spec 進階功能本 PR 不做（per 使用者選 A）。
 */
import { useState, useRef, useEffect } from 'react';
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

// 下載 ▾ dropdown — 對齊 FlowEditor Header 既有 pattern（click 開、外面關）
function DownloadMenu({ flow, onExportPng }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    function onDocClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    const id = setTimeout(() => document.addEventListener('mousedown', onDocClick), 0);
    return () => {
      clearTimeout(id);
      document.removeEventListener('mousedown', onDocClick);
    };
  }, [open]);
  function pick(action) {
    setOpen(false);
    action();
  }
  return (
    <div ref={ref} className="relative inline-block">
      <Button size="xs" onClick={() => setOpen(v => !v)} title="下載 PNG / Drawio / Excel">
        下載 ▾
      </Button>
      {open && (
        <div className="absolute right-0 mt-1 min-w-[110px] bg-card rounded shadow-lg border border-line py-1 z-30">
          <button onClick={() => pick(() => onExportPng(flow))}
            className="block w-full text-left px-3 py-1.5 text-xs text-ink hover:bg-paper-2">PNG</button>
          <button onClick={() => pick(() => exportDrawio(flow))}
            className="block w-full text-left px-3 py-1.5 text-xs text-ink hover:bg-paper-2">Drawio</button>
          <button onClick={() => pick(() => exportFlowToExcel(flow))}
            className="block w-full text-left px-3 py-1.5 text-xs text-ink hover:bg-paper-2">Excel</button>
        </div>
      )}
    </div>
  );
}

// 主要角色 chips preview — 最多顯示 2 個 + `+N` 摺疊（避免欄寬爆掉）
function RolesPreview({ roles }) {
  const arr = Array.isArray(roles) ? roles : [];
  const visible = arr.slice(0, 2);
  const more = arr.length - visible.length;
  if (arr.length === 0) {
    return <span className="text-xs text-ink-faint">—</span>;
  }
  return (
    <div className="flex flex-wrap gap-1 items-center">
      {visible.map(r => (
        <Chip key={r.id} variant={r.type === 'external' ? 'external' : 'internal'}>
          {autoSpace(r.name)}
        </Chip>
      ))}
      {more > 0 && <Chip variant="more">+{more}</Chip>}
    </div>
  );
}

export function FlowListTable({
  flows, selectedIds, onToggleSelect, onTogglePin,
  onEdit, onDelete, onClone, onExportPng,
}) {
  return (
    <div className="overflow-x-auto border border-line rounded-lg bg-card">
      <table className="w-full text-sm border-collapse">
        <thead className="bg-paper-2 text-ink-soft">
          <tr className="text-left">
            <th className="px-3 py-2 w-10"></th>
            <th className="px-2 py-2 w-8"></th>
            <th className="px-3 py-2 w-24 font-semibold">編號</th>
            <th className="px-3 py-2 font-semibold">名稱</th>
            <th className="px-3 py-2 w-16 text-center font-semibold">角色</th>
            <th className="px-3 py-2 w-16 text-center font-semibold">任務</th>
            <th className="px-3 py-2 w-56 font-semibold">主要角色</th>
            <th className="px-3 py-2 w-44 font-semibold">日期</th>
            <th className="px-3 py-2 w-72 font-semibold">動作</th>
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
                {/* L3 名稱 */}
                <td className="px-3 py-2 font-medium text-ink">
                  {autoSpace(flow.l3Name)}
                </td>
                {/* 角色 count */}
                <td className="px-3 py-2 text-center text-ink-soft">{flow.roles?.length ?? 0}</td>
                {/* 任務 count */}
                <td className="px-3 py-2 text-center text-ink-soft">{flow.tasks?.length ?? 0}</td>
                {/* 主要角色 chips */}
                <td className="px-3 py-2">
                  <RolesPreview roles={flow.roles} />
                </td>
                {/* 日期 */}
                <td className="px-3 py-2 text-xs text-ink-faint leading-tight">
                  {flow.createdAt && <div>建立：{fmtDateTime(flow.createdAt)}</div>}
                  {flow.updatedAt && <div>更新：{fmtDateTime(flow.updatedAt)}</div>}
                </td>
                {/* 動作 */}
                <td className="px-3 py-2">
                  <div className="flex gap-1 flex-wrap items-center">
                    <Button size="xs" onClick={() => onEdit(flow.id)}>編輯</Button>
                    <Button size="xs" onClick={() => onClone(flow)} title="複製整條流程做延伸編輯">複製</Button>
                    <DownloadMenu flow={flow} onExportPng={onExportPng} />
                    <Button size="xs" variant="danger" onClick={() => {
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

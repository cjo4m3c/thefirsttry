/**
 * Single flow card in the Dashboard grid. Layout reserves fixed heights for
 * title (min-h-3rem) / dates (min-h-2rem) / role chips (3rem) so cards stay
 * visually aligned across grid rows regardless of content length.
 */
import { exportDrawio } from '../../utils/drawioExport.js';
import { exportFlowToExcel } from '../../utils/excelExport.js';
import { fmtDateTime } from './sortFlows.js';
import { autoSpace } from '../../utils/autoSpace.js';
import { Button } from '../ui/Button.jsx';
import { Chip } from '../ui/Chip.jsx';

export function FlowCard({
  flow, isSelected, onToggleSelect, onTogglePin,
  onEdit, onDelete, onClone, onExportPng,
}) {
  return (
    <div className="bg-card rounded-xl border border-line shadow-sm hover:shadow-md transition-shadow p-5 flex flex-col gap-3">
      {/* Header — title row reserves min-h-[3rem] so 1-line titles
          align with 2-line titles across the same grid row. */}
      <div className="flex items-start gap-2 min-h-[3rem]">
        <input type="checkbox" checked={isSelected}
          onChange={() => onToggleSelect(flow.id)}
          className="mt-0.5 w-4 h-4 flex-shrink-0 cursor-pointer"
          title="勾選以批量下載 / 刪除" />
        <button onClick={() => onTogglePin(flow.id)}
          title={flow.pinned ? '取消置頂' : '置頂此工作流'}
          className="flex-shrink-0 transition-transform hover:scale-110">
          <svg width="18" height="18" viewBox="0 0 24 24"
            fill={flow.pinned ? 'var(--star)' : 'none'}
            stroke={flow.pinned ? 'var(--warning)' : 'var(--ink-faint)'} strokeWidth="2"
            strokeLinejoin="round">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
          </svg>
        </button>
        <Chip variant="id" className="flex-shrink-0 font-bold">{flow.l3Number}</Chip>
        <span className="font-semibold text-ink leading-tight line-clamp-2">{autoSpace(flow.l3Name)}</span>
      </div>

      {/* Stats */}
      <div className="flex gap-3 text-xs text-ink-soft">
        <span>角色 {flow.roles?.length ?? 0}</span>
        <span>·</span>
        <span>任務 {flow.tasks?.length ?? 0}</span>
      </div>
      {/* Reserves 2-row height even when one of createdAt /
          updatedAt is missing (legacy pre-versioned flows). */}
      <div className="flex flex-col gap-0.5 text-xs text-ink-faint min-h-[2rem]">
        {flow.createdAt && <span>建立：{fmtDateTime(flow.createdAt)}</span>}
        {flow.updatedAt && <span>更新：{fmtDateTime(flow.updatedAt)}</span>}
      </div>

      {/* Roles preview — 2-row 容量、cards 跨 grid row 對齊。
          2026-05-18：maxHeight 3rem (48px) → 4rem (64px)、accommodate
          PR-4 引入的 <Chip> 元件比原 inline <span> 多 1px border + 寬
          px-2.5 padding 造成的 2-4px 高度差。minHeight 3rem 保持原本
          1-row card 在 grid 中的 baseline。N > 2 排的角色仍被 cap 截。 */}
      <div className="flex flex-wrap gap-1 content-start overflow-hidden"
        style={{ minHeight: '3rem', maxHeight: '4rem' }}>
        {(flow.roles ?? []).map(r => (
          <Chip key={r.id} variant={r.type === 'external' ? 'external' : 'internal'} className="h-fit">
            {autoSpace(r.name)}
          </Chip>
        ))}
      </div>

      {/* Actions — pinned to card bottom via mt-auto so cards
          in the same grid row stay visually aligned regardless of
          title / role count above. */}
      <div className="mt-auto flex flex-col gap-1.5 pt-1 border-t border-line-dim">
        <div className="flex gap-1.5">
          <Button onClick={() => onEdit(flow.id)} className="flex-1 justify-center">編輯</Button>
          <Button onClick={() => onClone(flow)} title="複製整條流程做延伸編輯">複製</Button>
          <Button variant="danger" onClick={() => {
            if (window.confirm(`確定要刪除「${flow.l3Name}」嗎？`)) onDelete(flow.id);
          }}>刪除</Button>
        </div>
        <div className="flex gap-1.5">
          <Button size="sm" onClick={() => onExportPng(flow)} className="flex-1 justify-center">下載 PNG</Button>
          <Button size="sm" onClick={() => exportDrawio(flow)} className="flex-1 justify-center">下載 Drawio</Button>
          <Button size="sm" onClick={() => exportFlowToExcel(flow)} className="flex-1 justify-center">下載 Excel</Button>
        </div>
      </div>
    </div>
  );
}

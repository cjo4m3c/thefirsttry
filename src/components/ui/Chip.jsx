/**
 * Chip — 共用標籤元件，對齊 design_handoff_flowsprite spec `.chip` 系列。
 *
 * Variants：
 *   <Chip>業務</Chip>                    ← default 中性（card 底 ink 字）
 *   <Chip variant="internal">PM</Chip>   ← 內部角色（藍底白字、固定）
 *   <Chip variant="external">廠商</Chip> ← 外部角色（綠底白字、固定）
 *   <Chip variant="id">1-1-1</Chip>      ← L3 編號徽章（brand 底 mono）
 *   <Chip variant="more">+3</Chip>       ← 摺疊計數
 *
 * 設計原則：
 *   - internal / external 必須成對使用（業務規則）
 *   - id 變體用 mono 字 + brand 色強識別
 *   - 不傳 className 預設樣式；可附加（不覆蓋）
 *
 * spec 對應：components.css `.chip` `.chip.internal` `.chip.external`
 *           `.chip.id` `.chip.more`
 */

const BASE = 'inline-flex items-center border rounded-full px-2.5 py-0.5 whitespace-nowrap font-medium';

const VARIANTS = {
  default:  'bg-card border-line text-ink',
  internal: 'bg-internal border-internal text-white',
  external: 'bg-external border-external text-white',
  // 2026-05-18：id chip 用 brand-darker `#1B2E4C`（spec 原 brand-dark 色）
  // — 使用者：「首頁 L3 編號的 chip 請都改成用品牌深色 #1B2E4C」。深 navy 比
  // Header bg (`--brand-dark` `#2A5598`) 更深一階、ID 識別徽章更突出。
  id:       'bg-brand-darker border-brand-darker text-white tracking-wider',
  more:     'bg-paper-2 border-line text-ink-soft',
  // PR #240：filter chip — 給 SearchBar active filter 用、
  // 也可給未來其他「篩選中」狀態 chip 共用
  filter:   'bg-brand-soft border-brand-soft text-brand-dark gap-1',
};

// id variant 用 mono 字 + 較小字（per spec：fs-caption + mono + 略寬 letter-spacing）
const ID_STYLE = { fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-caption)' };

export function Chip({ variant = 'default', className = '', children, ...rest }) {
  const v = VARIANTS[variant] || VARIANTS.default;
  const sizeCls = variant === 'id' ? '' : 'text-xs';  // fs-label 12 for non-id
  const inlineStyle = variant === 'id' ? ID_STYLE : undefined;
  return (
    <span
      className={`${BASE} ${v} ${sizeCls} ${className}`}
      style={inlineStyle}
      {...rest}
    >
      {children}
    </span>
  );
}

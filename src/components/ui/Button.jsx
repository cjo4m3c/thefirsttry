/**
 * Button — 共用按鈕元件，對齊 design_handoff_flowsprite spec `.btn` 系列。
 *
 * Variants × Sizes 組合：
 *
 *   <Button>編輯</Button>                      ← default md
 *   <Button variant="primary">+ 新增</Button>   ← CTA（brand 底白字、一頁最多 1-2）
 *   <Button variant="ghost">⇧ 篩選</Button>     ← dashed 邊次要動作
 *   <Button variant="danger">刪除</Button>      ← 紅字 destructive
 *   <Button size="sm">下載 ▾</Button>           ← 小尺寸（fs-label 12px）
 *   <Button size="xs">編輯</Button>             ← 極小（fs-caption 11px）
 *
 * 設計原則（per spec）：
 *   - Primary 一頁 1-2 個（新增 / 儲存）；不要用 brand-dark / brand-light 當 primary
 *   - Destructive 一律 danger variant（不要自己刷紅）
 *   - 不傳 className 預設樣式由 token 控制；傳 className 會附加（不覆蓋）
 *
 * 跟原本 Tailwind inline class 對應：
 *   舊：`px-3 py-1.5 rounded border border-blue-300 text-blue-700 hover:bg-blue-50 ...`
 *   新：`<Button>` 從 tokens.css 取色、保持視覺一致
 */
import { forwardRef } from 'react';

// 對齊 spec components.css .btn 系列：
//   .btn          font-family sans / fs-body / fw-medium / card bg / line border /
//                 radius-md / 5px 12px padding / ink text / inline-flex
//   .btn.primary  brand bg / white text / brand border
//   .btn.ghost    dashed border / ink-soft text
//   .btn.danger   danger text
//   .btn.sm       fs-label / 3px 9px padding / radius-sm
//   .btn.xs       fs-caption / 2px 7px padding / radius-xs / fw-medium
const BASE = 'inline-flex items-center gap-1 whitespace-nowrap border transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand focus-visible:outline-offset-1';

const SIZES = {
  md: 'px-3 py-1.5 text-sm leading-[1.4] rounded-md font-medium',      // fs-body 14
  sm: 'px-2.5 py-1 text-xs leading-[1.4] rounded-[5px] font-medium',   // fs-label 12 / radius-sm
  xs: 'px-2 py-0.5 text-[11px] leading-[1.4] rounded font-medium',     // fs-caption 11 / radius-xs
};

const VARIANTS = {
  default: 'bg-card border-line text-ink hover:bg-paper-2',
  primary: 'bg-brand border-brand text-white hover:opacity-90',
  ghost:   'bg-card border-line border-dashed text-ink-soft hover:bg-paper-2',
  danger:  'bg-card border-line text-danger hover:bg-danger-soft',
  // Filled warning（橘黃底白字）— 給「仍然儲存」/「確定重設」這類 destructive
  // 但非錯誤的確認 button 用。對應 spec semantic `--warning` token。
  warning: 'bg-warning border-warning text-white hover:opacity-90',
  // Filled danger（紅底白字）— 給 DuplicateImport「覆蓋」這類真正破壞性的
  // confirm button 用。
  'danger-fill': 'bg-danger border-danger text-white hover:opacity-90',
  // dark-bar：跑在 --brand-dark Header bg 上的透明白邊白字 button
  // （FlowEditor / Dashboard / Wizard 三個深藍 header 共用）
  'dark-bar': 'bg-transparent border-white border-opacity-40 text-white hover:bg-white hover:bg-opacity-10',
};

export const Button = forwardRef(function Button(
  { variant = 'default', size = 'md', className = '', children, type = 'button', ...rest },
  ref
) {
  const v = VARIANTS[variant] || VARIANTS.default;
  const s = SIZES[size] || SIZES.md;
  return (
    <button ref={ref} type={type} {...rest} className={`${BASE} ${s} ${v} ${className}`}>
      {children}
    </button>
  );
});

/**
 * DesignGuidelinePanel — 設計規範摘要 + 範例。
 *
 * 2026-05-18：使用者要求「首頁右上角加設計規範彈窗、內容說明 design
 * guideline + 範例」。此 modal 取 `docs/business-spec.md` §13.9 核心內容
 * 並附 chip / button / pill / 配色 swatch 等實際視覺範例，讓設計師 /
 * 非工程協作者站內直接看實際樣式對照、不用打開 markdown spec。
 *
 * controlled — open state 由 caller（InfoDropdown）管。
 */

// 8 種節點 pill + 卡背配色（取自 docs/business-spec.md §13.9.2）
const NODE_TYPES = [
  { kind: '開始事件 Start',  pillBg: 'var(--brand-dark)',         pillText: '#FFFFFF',           cardMix: 'var(--card)', borderMix: 'var(--line)' },
  { kind: '結束事件 End',    pillBg: 'var(--brand-dark)',         pillText: '#FFFFFF',           cardMix: 'var(--card)', borderMix: 'var(--line)' },
  { kind: 'L4 任務 Task',    pillBg: 'var(--brand-light-deep)',   pillText: '#FFFFFF',           cardMix: 'color-mix(in oklch, var(--brand-light) 12%, var(--card))',   borderMix: 'color-mix(in oklch, var(--brand-light) 30%, var(--card))' },
  { kind: '並行閘道 AND',    pillBg: 'var(--success)',            pillText: '#FFFFFF',           cardMix: 'color-mix(in oklch, var(--success) 5%, var(--card))',        borderMix: 'color-mix(in oklch, var(--success) 22%, var(--card))' },
  { kind: '排他閘道 XOR',    pillBg: 'var(--warning)',            pillText: '#FFFFFF',           cardMix: 'color-mix(in oklch, var(--warning) 5%, var(--card))',        borderMix: 'color-mix(in oklch, var(--warning) 22%, var(--card))' },
  { kind: '包容閘道 OR',     pillBg: 'var(--inclusive)',          pillText: '#FFFFFF',           cardMix: 'color-mix(in oklch, var(--inclusive) 5%, var(--card))',      borderMix: 'color-mix(in oklch, var(--inclusive) 25%, var(--card))' },
  { kind: 'L3 子流程',       pillBg: 'var(--subflow)',            pillText: '#FFFFFF',           cardMix: 'color-mix(in oklch, var(--subflow) 5%, var(--card))',        borderMix: 'color-mix(in oklch, var(--subflow) 22%, var(--card))' },
  { kind: '外部互動',         pillBg: 'var(--external-node)',      pillText: '#FFFFFF',           cardMix: 'color-mix(in oklch, var(--external-node) 6%, var(--card))',  borderMix: 'color-mix(in oklch, var(--external-node) 22%, var(--card))' },
];

// 色彩 token swatch（取自 §13.9.1）
const COLOR_TOKENS = [
  { token: '--brand',            label: '品牌主色',          desc: 'Primary CTA / focus ring' },
  { token: '--brand-dark',       label: '品牌深輔色',        desc: 'App bar / Canvas head / 開始/結束事件 pill' },
  { token: '--brand-darker',     label: '品牌最深輔色',      desc: 'L3 編號徽章（比 brand-dark 更深一階）' },
  { token: '--brand-light',      label: '品牌淺輔色',        desc: 'hover 入口連線 / highlight' },
  { token: '--brand-light-deep', label: 'L4 任務 pill 底色', desc: 'brand-light 加深版' },
  { token: '--internal',         label: '內部角色（固定）',  desc: '內部角色 chip / 泳道（必須成對外部）' },
  { token: '--external',         label: '外部角色（固定）',  desc: '外部角色 chip / 泳道（必須成對內部）' },
  { token: '--warning',          label: '琥珀 — 警告',       desc: '排他閘道 / warning callout' },
  { token: '--success',          label: '綠 — 成功',         desc: '並行閘道 / success callout' },
  { token: '--danger',           label: '紅 — 危險',         desc: 'blocking / danger callout' },
  { token: '--inclusive',        label: 'Teal — 包容',       desc: '包容閘道 pill' },
  { token: '--subflow',          label: '紫 — 子流程',       desc: 'L3 子流程節點' },
  { token: '--external-node',    label: '板岩 — 外部互動',   desc: '外部互動節點' },
];

// 字級 7 階
const FONT_SIZES = [
  { token: '--fs-display', px: 32, sample: '頁面主標 32px' },
  { token: '--fs-h1',      px: 22, sample: '區塊標題 22px' },
  { token: '--fs-h2',      px: 17, sample: '卡片大標 17px' },
  { token: '--fs-h3',      px: 15, sample: '卡片名稱 15px' },
  { token: '--fs-body',    px: 13, sample: '預設 UI 字 13px' },
  { token: '--fs-label',   px: 12, sample: 'Chip / 次要 label 12px' },
  { token: '--fs-caption', px: 11, sample: '日期 / 提示 11px' },
];

function Section({ title, children }) {
  return (
    <div className="mb-6">
      <h3 className="text-base font-semibold text-ink mb-2">{title}</h3>
      {children}
    </div>
  );
}

function Pill({ bg, text, label }) {
  return (
    <span className="inline-block px-2 py-0.5 rounded text-xs font-semibold"
      style={{ background: bg, color: text }}>
      {label}
    </span>
  );
}

function NodeRow({ kind, pillBg, pillText, cardMix, borderMix }) {
  return (
    <div className="rounded-md border p-2.5 flex items-center gap-3"
      style={{ background: cardMix, borderColor: borderMix }}>
      <Pill bg={pillBg} text={pillText} label={kind} />
      <span className="text-xs text-ink-soft">5% mix 卡背 + 22-30% mix 邊框</span>
    </div>
  );
}

function Swatch({ token, label, desc }) {
  return (
    <div className="flex items-center gap-2.5 py-1.5">
      <div className="w-8 h-8 rounded border border-line flex-shrink-0"
        style={{ background: `var(${token})` }} />
      <div className="flex-1 min-w-0">
        <div className="text-xs font-mono text-ink">{token}</div>
        <div className="text-xs text-ink-soft truncate">{label} — {desc}</div>
      </div>
    </div>
  );
}

export default function DesignGuidelinePanel({ isOpen = false, onClose = () => {} }) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.45)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-line">
          <div>
            <h2 className="text-lg font-bold text-ink">設計規範 / Design Guideline</h2>
            <p className="text-xs text-ink-faint mt-0.5">本頁摘要 + 範例；完整規格見 `docs/business-spec.md` §13.9</p>
          </div>
          <button onClick={onClose}
            className="text-ink-faint hover:text-ink text-xl font-bold leading-none px-2">
            ×
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto px-6 py-5 flex-1">

          <Section title="色彩 Color tokens">
            <p className="text-xs text-ink-soft mb-2">改 hex 改 `src/styles/tokens.css`（SOT）；SVG attribute 不認 CSS variable、用 hex literal 但須跟 token 同步。</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-0">
              {COLOR_TOKENS.map(c => <Swatch key={c.token} {...c} />)}
            </div>
          </Section>

          <Section title="8 種節點 pill + 卡背配色">
            <p className="text-xs text-ink-soft mb-2">編輯器右側「設定流程」面板每張節點卡。SOT：`src/utils/elementTypes.js` `KIND_BADGE` + `KIND_CARD_STYLE`。</p>
            <div className="grid gap-1.5">
              {NODE_TYPES.map(n => <NodeRow key={n.kind} {...n} />)}
            </div>
          </Section>

          <Section title="字級 Typography（7 階）">
            <p className="text-xs text-ink-soft mb-2">最小 11px、不允許更小。同螢幕最多 3 階層次。Display 一頁僅 1 處。</p>
            <div className="space-y-1">
              {FONT_SIZES.map(f => (
                <div key={f.token} className="flex items-baseline gap-3 border-b border-line-dim pb-1">
                  <code className="text-xs text-ink-soft w-32 flex-shrink-0">{f.token}</code>
                  <span style={{ fontSize: f.px + 'px', lineHeight: 1.3 }} className="text-ink">{f.sample}</span>
                </div>
              ))}
            </div>
          </Section>

          <Section title="Base 元件 ui/ 範例">
            <p className="text-xs text-ink-soft mb-2">新增 UI 優先用、不要再 inline class。完整 API 見 `src/components/ui/`。</p>
            <div className="grid gap-3">
              {/* Button */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-ink-soft w-20 flex-shrink-0">Button</span>
                <button className="px-3 py-1.5 text-xs rounded-md border border-line bg-card text-ink hover:bg-paper-2">default</button>
                <button className="px-3 py-1.5 text-xs rounded-md border border-brand bg-brand text-white">primary</button>
                <button className="px-3 py-1.5 text-xs rounded-md border border-line border-dashed bg-card text-ink-soft">ghost</button>
                <button className="px-3 py-1.5 text-xs rounded-md border border-line bg-card text-danger hover:bg-danger-soft">danger</button>
              </div>
              {/* Chip */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-ink-soft w-20 flex-shrink-0">Chip</span>
                <span className="px-2 py-0.5 rounded-full border border-line text-xs">業務</span>
                <span className="px-2 py-0.5 rounded-full bg-internal border-internal text-white text-xs">內部 GPMC</span>
                <span className="px-2 py-0.5 rounded-full bg-external border-external text-white text-xs">外部 Vendor</span>
                <span className="px-2 py-0.5 rounded-full bg-brand-dark border-brand-dark text-white text-xs tracking-wider">1-1-1</span>
                <span className="px-2 py-0.5 rounded-full bg-paper-2 border-line text-ink-soft text-xs">+3</span>
              </div>
              {/* Callout */}
              <div className="flex items-start gap-2">
                <span className="text-xs text-ink-soft w-20 flex-shrink-0 pt-2">Callout</span>
                <div className="flex-1 grid gap-1.5">
                  <div className="border border-info bg-info-soft text-info-ink rounded-md px-3 py-2 text-xs"><b>Info</b> — 一般說明性內容</div>
                  <div className="border border-warning bg-warning-soft text-warning-ink rounded-md px-3 py-2 text-xs"><b>Warning</b> — 可儲存但建議修正</div>
                  <div className="border border-danger bg-danger-soft text-danger-ink rounded-md px-3 py-2 text-xs"><b>Blocking</b> — 不可儲存</div>
                  <div className="border border-success bg-success-soft text-success-ink rounded-md px-3 py-2 text-xs"><b>Success</b> — 驗證通過</div>
                </div>
              </div>
            </div>
          </Section>

          <Section title="文件位置">
            <ul className="text-xs text-ink space-y-1 list-disc pl-5">
              <li><code className="text-ink-soft">src/styles/tokens.css</code> — 所有 CSS variables（SOT）</li>
              <li><code className="text-ink-soft">src/components/ui/</code> — Button / Modal / Callout / Chip base 元件</li>
              <li><code className="text-ink-soft">src/utils/elementTypes.js</code> — 8 種節點 KIND_BADGE + KIND_CARD_STYLE 配色</li>
              <li><code className="text-ink-soft">docs/business-spec.md §13.9</code> — 完整 design system 規格 SOT</li>
              <li><code className="text-ink-soft">tailwind.config.js</code> — Tailwind `bg-brand` / `text-ink-soft` 等 utility 對應 token</li>
            </ul>
          </Section>

        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-line-dim flex justify-end">
          <button onClick={onClose}
            className="px-5 py-2 rounded-lg text-white text-sm font-medium transition-colors"
            style={{ background: '#2A5598' }}
            onMouseEnter={e => e.currentTarget.style.background = '#1E4677'}
            onMouseLeave={e => e.currentTarget.style.background = '#2A5598'}>
            關閉
          </button>
        </div>
      </div>
    </div>
  );
}

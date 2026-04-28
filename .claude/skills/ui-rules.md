---
name: ui-rules
description: Apply FlowSprite's UI conventions (blue color palette, button patterns, banner/modal patterns, typography). Use proactively whenever creating or editing any user-facing visual element — buttons, banners, modals, form inputs, diagram elements — so the app stays visually consistent.
---

# /ui-rules — FlowSprite UI 規則

所有使用者可見的元件**必須**遵守這份規則。動 UI 程式碼前先讀過對應段落，動完用這份 checklist 自我審核。

## 1. 色票（單一來源）

主色系（藍）：
| 角色 | HEX | 用途 |
|---|---|---|
| Primary | `#2A5598` | 主要按鈕、頁首、L3 徽章、內部角色 |
| Primary hover | `#1E4677` | 主按鈕滑過變深 |
| Mid | `#3470B5` | 次要按鈕（Excel 上傳/下載、PNG 匯出、下一步）、規則說明/更新紀錄 |
| Mid hover | `#274F86` | 次按鈕滑過變深 |
| Light | `#7AB5DD` | hover 高亮、FlowEditor 內 save 按鈕（在深藍頁首中襯托）、捲軸 thumb |
| External role | `#4CAF50` | 外部角色泳道 / 標籤（綠色區分，跟內部角色的藍色對比） |
| Soft BG | `#E8F1F9` | 若有「淡藍底」需求 |
| Soft hover | `#D1E3F2` |  |
| Page BG | `#F5F8FC` | 首頁 / FlowEditor / Wizard 的 `<div className="min-h-screen">` 底色 |
| Scrollbar track | `#E8F1F9` | `::-webkit-scrollbar-track` |
| Scrollbar thumb | `#7AB5DD` → `#3470B5` on hover | `::-webkit-scrollbar-thumb` |

狀態色（**必保留**，不藍化）：
| 角色 | 值 | 用途 |
|---|---|---|
| Danger | `#DC2626` / `text-red-*` / `bg-red-*` | 刪除、批量刪除、Error banner |
| Warning (amber) | `text-amber-600` / `bg-amber-50` | 未儲存提示、匯入警告 banner |
| Pin (yellow) | `fill=#FBBF24 stroke=#D97706` | 首頁置頂星星 |
| Progress | `bg-yellow-50 border-yellow-300` | PNG 批量進度 |
| Success | `bg-sky-50 border-sky-200` / `text-sky-800` | 匯入成功 banner（**注意**：改用 sky 不用 green，只有狀態色保留 red/amber/yellow） |

流程圖連線 hover 色（方向感知）：
| 角色 | HEX | 用途 |
|---|---|---|
| Outgoing hover | `#2A5598` (primary 深藍) | hover 某元件時，**它指出去**的連線變深藍加粗，示意 flow 流向 |
| Incoming hover | `#7AB5DD` (light 淡藍) | hover 某元件時，**指向它**的連線變淡藍加粗，示意 upstream 來源 |
| Element hover border | `#2563EB` (HOVER_STROKE) | 元件邊框 hover（Tailwind blue-600）|
| Element hover tint | `#DBEAFE` (HOVER_TINT) | 元件底色 hover（Tailwind blue-100） |

泳道圖內部色（在 `src/diagram/constants.js` `COLORS`）：
| 常數 | 值 | 用途 |
|---|---|---|
| `TITLE_BG` | `#374151` | 流程圖標題列（深灰色，白字清楚對比） |
| `INTERNAL_BG` | `#0066CC` | 內部角色泳道頭（中藍，跟外部綠明確對比） |
| `EXTERNAL_BG` | `#009900` | 外部角色泳道頭（純綠，跟內部中藍明確對比） |
| `LANE_ODD` | `#F0F6FB` | 奇數列淡藍底 |
| `LANE_BORDER` | `#C8D9E8` | 泳道分隔線 |

## 2. 按鈕 pattern

### 2.1 主要按鈕（Primary action）
範例：`新增 L3 活動`、`儲存`、`批量下載`、`儲存並完成`

```jsx
<button onClick={handler}
  className="px-5 py-2 rounded-lg text-white font-medium shadow transition-colors"
  style={{ background: '#2A5598' }}
  onMouseEnter={e => e.currentTarget.style.background = '#1E4677'}
  onMouseLeave={e => e.currentTarget.style.background = '#2A5598'}>
  按鈕文字
</button>
```

### 2.2 次要按鈕（Secondary action）
範例：`上傳 Excel`、`下載 Excel`、`匯出 PNG`、`下一步`

```jsx
<button onClick={handler}
  className="px-4 py-2 rounded-lg text-white text-sm font-medium shadow transition-colors border"
  style={{ background: '#3470B5', borderColor: '#3470B5' }}
  onMouseEnter={e => e.currentTarget.style.background = '#274F86'}
  onMouseLeave={e => e.currentTarget.style.background = '#3470B5'}>
  按鈕文字
</button>
```

### 2.3 Header 按鈕（在深藍頁首中）
範例：`規則說明`、`更新紀錄` — **不得**是 outline 白邊（那會讓使用者要 hover 才找得到）

```jsx
<button
  className="px-3 py-2 rounded-lg text-white text-sm font-medium transition-colors"
  style={{ background: '#3470B5' }}
  onMouseEnter={e => e.currentTarget.style.background = '#5B8AC9'}
  onMouseLeave={e => e.currentTarget.style.background = '#3470B5'}>
  按鈕文字
</button>
```

### 2.4 FlowEditor 頁首內的 Save（襯托）
因為頁首是主色藍 `#2A5598`，主按鈕會和頁首融在一起，所以用淡藍 + 深藍字：

```jsx
style={{ background: hasChanges ? '#7AB5DD' : '#6B7280', color: hasChanges ? '#1E4677' : 'white' }}
```

### 2.5 Outline / Danger / Download 三色藍
卡片上的 PNG / drawio / Excel 三個下載按鈕用三層藍區分（sky / blue / cyan），保留視覺區分度：

```jsx
<button className="flex-1 py-1.5 text-xs rounded border border-sky-300 text-sky-700 hover:bg-sky-50 transition-colors">↓ PNG</button>
<button className="flex-1 py-1.5 text-xs rounded border border-blue-300 text-blue-700 hover:bg-blue-50 transition-colors">↓ draw.io</button>
<button className="flex-1 py-1.5 text-xs rounded border border-cyan-300 text-cyan-700 hover:bg-cyan-50 transition-colors">↓ Excel</button>
```

### 2.6 Danger
```jsx
className="... border border-red-200 text-red-500 hover:bg-red-50 transition-colors"
// 或
style={{ borderColor: '#DC2626', color: '#DC2626', background: 'white' }}
onMouseEnter={e => { if (!e.currentTarget.disabled) e.currentTarget.style.background = '#FEE2E2'; }}
```

## 3. Banner pattern

使用者回饋橫條一律放在主內容區域頂端（`main` 內 `<h1>` 下方），寬度 auto，可 dismiss。

### 3.1 Error banner（紅）
```jsx
<div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700 flex items-start gap-2">
  <span className="flex-shrink-0 font-bold">!</span>
  <span className="whitespace-pre-line flex-1">{errorMsg}</span>
  <button onClick={clear} className="ml-auto text-red-400 hover:text-red-600 font-bold">×</button>
</div>
```

### 3.2 Success banner（淡藍，不是綠）
```jsx
<div className="mb-4 p-3 rounded-lg bg-sky-50 border border-sky-200 text-sm text-sky-800 flex items-start gap-2">
  <span className="flex-shrink-0">✓</span>
  <span>{successMsg}</span>
  <button onClick={clear} className="ml-auto text-sky-400 hover:text-sky-600 font-bold">×</button>
</div>
```

### 3.3 Warning banner（amber）
```jsx
<div className="mb-4 p-3 rounded-lg bg-amber-50 border border-amber-300 text-sm text-amber-800">
  <div className="flex items-start gap-2 mb-1.5">
    <span className="flex-shrink-0 font-bold">⚠</span>
    <span className="font-medium flex-1">{heading}</span>
    <button onClick={clear} className="text-amber-400 hover:text-amber-600 font-bold">×</button>
  </div>
  <ul className="ml-5 space-y-0.5 text-xs">{items.map(...)}</ul>
</div>
```

### 3.4 Progress banner（yellow）
```jsx
<div className="mb-4 p-3 rounded-lg bg-yellow-50 border border-yellow-300 text-sm text-yellow-800 flex items-center gap-2">
  <span className="animate-spin inline-block w-4 h-4 border-2 border-yellow-500 border-t-transparent rounded-full" />
  正在產生 PNG {done} / {total}...
</div>
```

## 4. Modal pattern

規則說明 / 更新紀錄 modal 統一樣式：

```jsx
{open && (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
    style={{ background: 'rgba(0,0,0,0.45)' }}
    onClick={e => { if (e.target === e.currentTarget) setOpen(false); }}>
    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
        <div>
          <h2 className="text-lg font-bold text-gray-800">{title}</h2>
          {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
        </div>
        <button onClick={() => setOpen(false)}
          className="text-gray-400 hover:text-gray-600 text-xl font-bold leading-none px-2">×</button>
      </div>
      {/* Scrollable body */}
      <div className="overflow-y-auto flex-1">{/* content */}</div>
      {/* Footer close button（主色藍） */}
      <div className="px-6 py-3 border-t border-gray-100 flex justify-end">
        <button onClick={() => setOpen(false)}
          className="px-5 py-2 rounded-lg text-white text-sm font-medium transition-colors"
          style={{ background: '#2A5598' }}
          onMouseEnter={e => e.currentTarget.style.background = '#1E4677'}
          onMouseLeave={e => e.currentTarget.style.background = '#2A5598'}>
          關閉
        </button>
      </div>
    </div>
  </div>
)}
```

## 5. 頁首 pattern

```jsx
<header className="px-6 py-3 shadow-md flex items-center gap-4"
  style={{ background: '#2A5598', color: 'white' }}>
  {/* 選用 logo */}
  <img src={`${import.meta.env.BASE_URL}logo.png`}
    className="h-9 w-9 rounded-full object-cover flex-shrink-0 logo-happy"
    onError={e => { e.currentTarget.style.display = 'none'; }} />
  <span className="text-lg font-bold tracking-wide">FlowSprite</span>
  {/* 或頁面專用標題 */}
  <div className="ml-auto flex gap-2">{/* Header 按鈕（規則說明/更新紀錄/儲存） */}</div>
</header>
```

## 6. 表單輸入

```jsx
<input type="text" placeholder="..."
  className="px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 bg-white
             focus:outline-none focus:ring-2 focus:ring-blue-300" />
<select
  className="px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 bg-white
             focus:outline-none focus:ring-2 focus:ring-blue-300">
  ...
</select>
```

角色 select 加入角色色背景時：
```jsx
style={{ background: role.type === 'external' ? '#5B8AC9' : '#2A5598', color: 'white' }}
```

## 7. L3 卡片 / 徽章

```jsx
{/* L3 編號徽章 */}
<span className="px-2 py-0.5 rounded text-xs font-bold text-white flex-shrink-0"
  style={{ background: '#2A5598' }}>
  {flow.l3Number}
</span>

{/* 角色標籤 */}
<span className="px-2 py-0.5 rounded-full text-xs text-white"
  style={{ background: r.type === 'external' ? '#5B8AC9' : '#2A5598' }}>
  {r.name}
</span>
```

## 8. 文字 / 字級

2026-04-28 起 FlowEditor / Wizard / FlowTable 統一往上一級（會議室遠看可讀性）；Dashboard 仍維持原級（首頁不在 +1 範圍）。新元件依此表的「+1 級」欄。

| 用途 | Tailwind class（+1 級，編輯/Wizard/Table 用） | 原級（Dashboard 仍用） |
|---|---|---|
| 頁面主標 H1 | `text-3xl font-bold text-gray-800` | `text-2xl font-bold text-gray-800` |
| 區塊標題 H2 | `text-xl font-bold text-gray-800` | `text-lg font-bold text-gray-800` |
| 小節標題 H3 | `text-base font-bold text-gray-700 uppercase tracking-wide` | `text-sm font-bold text-gray-700 uppercase tracking-wide` |
| 內文 | `text-base text-gray-700` | `text-sm text-gray-700` |
| 提示 | `text-sm text-gray-400` | `text-xs text-gray-400` |
| 錯誤 | `text-base text-red-700` / `text-sm text-red-600` | `text-sm text-red-700` / `text-xs text-red-600` |
| 未儲存提醒 | `text-sm text-yellow-300` 或 `text-amber-600` | `text-xs text-yellow-300` 或 `text-amber-600` |

## 9. 動效

| 情境 | Class |
|---|---|
| 按鈕/連結 hover | `transition-colors`（然後 inline onMouseEnter/Leave 切背景） |
| 卡片 hover | `hover:shadow-md transition-shadow` |
| Logo hover 旋轉彈跳光暈 | `logo-happy`（定義在 `index.css`）|
| Logo 儲存成功揮手 | `logo-wave` via `setLogoReaction('wave')` |
| Logo Excel 匯入閃光 | `logo-flash` |
| Logo 刪除暗下 | `logo-dim` |
| 下載進度 spinner | `animate-spin inline-block w-4 h-4 border-2 border-yellow-500 border-t-transparent rounded-full` |

## 10. 浮動元件 Pattern（ContextMenu / RightDrawer / DropLine）

新增類似的 popover / drawer / drag-indicator 時複用這些模板，視覺與行為才能一致。

### 10.1 Right-side drawer（編輯面板滑出）

`<RightDrawer>` 範例位於 `src/components/RightDrawer.jsx`。Pattern：

| 屬性 | 值 |
|---|---|
| 定位 | `fixed top-0 right-0 h-screen z-40` |
| 寬度 | `w-full sm:w-[520px] md:w-[560px]`（行動全寬、桌面 520-560px）|
| 開關動畫 | `transition-transform duration-300 ease-in-out` + `${open ? 'translate-x-0' : 'translate-x-full'}` |
| Backdrop | 只在 sm 以下才顯示（`sm:hidden`）半透明黑底 |
| 關閉觸發 | ✕ button + Esc + backdrop click |
| Header | `bg-gray-50 border-b border-gray-200 px-4 py-3 flex items-center justify-between` |
| Tab bar（可選）| `flex border-b border-gray-200`，active = `border-blue-600 text-blue-700 bg-blue-50` |
| Content | `flex-1 overflow-y-auto p-4` |

### 10.2 ContextMenu（點元件彈出選單）

`<ContextMenu>` 範例位於 `src/components/ContextMenu.jsx`。Pattern：

| 屬性 | 值 |
|---|---|
| 定位 | `fixed z-50` + `style={{ left, top }}`（依 cursor / 元件 rect 計算）|
| 寬度 | 260-300px（不要超過 320，避免行動裝置出框）|
| 邊界 reposition | useEffect 算 `getBoundingClientRect()`，超出視窗自動 inset 8px |
| Backdrop | **無**（直接 click outside via document listener）|
| 關閉觸發 | ✕ button + Esc + 點 menu 外面（`document.addEventListener('mousedown')`，**defer setTimeout 0** 避免 opening click 立刻觸發）|
| Header | 跟 RightDrawer 同 pattern（`bg-gray-50` + ✕ button）|
| Inline edit fields | `<label className="flex flex-col gap-1">` + `<span className="text-xs text-gray-500">` 標題 + input/select/textarea |
| Action buttons（垂直堆疊）| `w-full px-3 py-2 text-left text-xs hover:bg-blue-50 hover:text-blue-700 flex items-center gap-2` |
| Sub-form expand | accordion 模式（同一 button 點兩次收回），active 時 button 用 `bg-blue-50 text-blue-700`，▾/▴ 在右側 |
| Sub-form 內容 | `bg-gray-50 border-t border-b border-gray-100 px-3 py-2 flex flex-col gap-2`，底部「取消 / 確認」按鈕對齊右 |
| 危險 button | `text-red-600 hover:bg-red-50`（刪除類）|

### 10.3 拖曳 Drop indicator（DropLine + 兩相鄰 row 邊框）

`useDragReorder` hook 已 expose `dropAfter`（依 mouseY 跟 row 中線比較）。Pattern：

| 視覺元素 | 樣式 |
|---|---|
| 上面 row 邊框（drop 在這 row 之下）| `border-b-2 border-blue-500` |
| 下面 row 邊框（drop 在這 row 之上）| `border-t-2 border-blue-500` |
| **中間插入的 DropLine**（最明顯）| `<div className="relative h-0 my-[-4px]" aria-hidden="true">` 包 `<div className="absolute inset-x-2 -translate-y-1/2 h-1.5 bg-blue-500 rounded-full shadow-md shadow-blue-300" />` |
| 拖曳中 row 自身 | `opacity-40 scale-95` |

**算插入位置（slot）**：
```js
const dropTargetSlot = (dragIdx === null || overIdx === null) ? null
  : (dropAfter ? overIdx + 1 : overIdx);
const adjacentTopIdx    = dropTargetSlot - 1;
const adjacentBottomIdx = dropTargetSlot;
// 不在 dragIdx 自己 / 自己旁邊（no-op drop）顯示線
```

## 11. Checklist（做完 UI 變更自我審）

- [ ] 按鈕用對應 pattern（primary / secondary / header / danger / outline）
- [ ] Banner 用對應色（red / sky / amber / yellow）
- [ ] 沒有用綠色（除了狀態色場景，一般元件都要藍化）
- [ ] 沒有硬 code 非這份清單的其他 HEX 值（例如 `#4A5240` 舊墨綠、`#16982B` 舊綠、`#2A52BE` 舊navy、`#FAFAFA` 連線類型 row bg **仍然保留**請勿動）
- [ ] 文字字級照表 4
- [ ] Modal 用統一結構
- [ ] `status` 色（紅/黃/橘）保留不改藍
- [ ] 加了新常用色，必須同步寫回此 skill 文件

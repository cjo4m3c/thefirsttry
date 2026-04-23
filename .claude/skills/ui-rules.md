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
| `TITLE_BG` | `#2A5598` | 流程圖標題列 |
| `INTERNAL_BG` | `#2A5598` | 內部角色泳道頭 |
| `EXTERNAL_BG` | `#4CAF50` | 外部角色泳道頭（綠色，跟內部角色的深藍對比） |
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

| 用途 | Tailwind class |
|---|---|
| 頁面主標 H1 | `text-2xl font-bold text-gray-800` |
| 區塊標題 H2 | `text-lg font-bold text-gray-800` |
| 小節標題 H3 | `text-sm font-bold text-gray-700 uppercase tracking-wide` |
| 內文 | `text-sm text-gray-700` |
| 提示 | `text-xs text-gray-400` |
| 錯誤 | `text-sm text-red-700` / `text-xs text-red-600` |
| 未儲存提醒 | `text-xs text-yellow-300` 或 `text-amber-600` |

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

## 10. Checklist（做完 UI 變更自我審）

- [ ] 按鈕用對應 pattern（primary / secondary / header / danger / outline）
- [ ] Banner 用對應色（red / sky / amber / yellow）
- [ ] 沒有用綠色（除了狀態色場景，一般元件都要藍化）
- [ ] 沒有硬 code 非這份清單的其他 HEX 值（例如 `#4A5240` 舊墨綠、`#16982B` 舊綠、`#2A52BE` 舊navy、`#FAFAFA` 連線類型 row bg **仍然保留**請勿動）
- [ ] 文字字級照表 4
- [ ] Modal 用統一結構
- [ ] `status` 色（紅/黃/橘）保留不改藍
- [ ] 加了新常用色，必須同步寫回此 skill 文件

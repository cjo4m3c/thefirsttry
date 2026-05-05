/**
 * AUX_FIELDS — 任務輔助欄位 schema 單一來源
 *
 * 規格背景（2026-05-05 起）：
 *   - 核心 10 欄（Excel 0~9）負責流程圖辨識，解析邏輯不能動
 *   - 輔助 20 欄（Excel 10+）只是任務的延伸描述，全部存在 `task.meta[key]`
 *   - 輔助欄位**完全不參與**：流程結構解析、編號規則、validation
 *   - UI 預設隱藏，使用者可在 FlowTable 點 toggle 向右展開編輯
 *   - Excel 匯入/匯出走 header mapping（不認位置），找不到 header 的欄位
 *     會留空字串，永不報錯
 *
 * 命名約定：
 *   - `key`：英數蛇形小駝峰，跟 task.meta 物件 key 一致
 *   - `header`：Excel 欄標題（中文），匯入時拿來找欄位、匯出時印出
 *   - `description`（選填）：給 UI 顯示為 placeholder 或 tooltip
 *
 * ⚠️ 下面 20 個 entry 是 placeholder header（aux01..aux20），等待業務確認
 * 後再批次替換成實際欄名。改動只需編輯本檔的 `header` 字串，其他層自動跟上。
 */
export const AUX_FIELDS = [
  { key: 'aux01', header: '輔助欄位 01' },
  { key: 'aux02', header: '輔助欄位 02' },
  { key: 'aux03', header: '輔助欄位 03' },
  { key: 'aux04', header: '輔助欄位 04' },
  { key: 'aux05', header: '輔助欄位 05' },
  { key: 'aux06', header: '輔助欄位 06' },
  { key: 'aux07', header: '輔助欄位 07' },
  { key: 'aux08', header: '輔助欄位 08' },
  { key: 'aux09', header: '輔助欄位 09' },
  { key: 'aux10', header: '輔助欄位 10' },
  { key: 'aux11', header: '輔助欄位 11' },
  { key: 'aux12', header: '輔助欄位 12' },
  { key: 'aux13', header: '輔助欄位 13' },
  { key: 'aux14', header: '輔助欄位 14' },
  { key: 'aux15', header: '輔助欄位 15' },
  { key: 'aux16', header: '輔助欄位 16' },
  { key: 'aux17', header: '輔助欄位 17' },
  { key: 'aux18', header: '輔助欄位 18' },
  { key: 'aux19', header: '輔助欄位 19' },
  { key: 'aux20', header: '輔助欄位 20' },
];

export const AUX_FIELD_KEYS = AUX_FIELDS.map(f => f.key);

/**
 * 確保 task 上有 `meta` 物件且型別正確。loadFlows / 新建任務 / Excel 匯入
 * 都應該過這個 helper，讓下游永遠拿到 object（不會 undefined / null / array）。
 *
 * 不會幫每個 AUX_FIELDS.key 預填空字串 — 那會把 localStorage 灌肥。下游
 * render 時用 `task.meta[key] ?? ''` 取值即可。
 */
export function ensureMeta(task) {
  if (!task) return task;
  if (task.meta && typeof task.meta === 'object' && !Array.isArray(task.meta)) {
    return task;
  }
  return { ...task, meta: {} };
}

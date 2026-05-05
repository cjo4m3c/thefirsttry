/**
 * AUX_FIELDS — 任務輔助欄位 schema 單一來源
 *
 * 規格背景（2026-05-05 起）：
 *   - 核心 10 欄（Excel A~J，0~9）負責流程圖辨識，解析邏輯不能動
 *   - 輔助 20 欄（Excel K~AD，10~29）只是任務的延伸描述，全部存在 `task.meta[key]`
 *   - 輔助欄位**完全不參與**：流程結構解析、編號規則、validation
 *   - UI 預設隱藏，使用者可在 FlowTable 點 toggle 向右展開編輯
 *   - Excel 匯入/匯出走 header mapping（不認位置），找不到 header 的欄位
 *     會留空字串，永不報錯
 *
 * 欄序對應 Excel 視覺排版（4 個 separator 是業務分組視覺空白）：
 *   K-N  主體 / 系統 / 實體（4 欄）
 *   O-P  〔分組空白〕
 *   Q-U  單一性 / 完整性判定（5 欄）
 *   V    〔分組空白〕
 *   W-AA 動詞 / 名詞 / 字典檢核（5 欄）
 *   AB   〔分組空白〕
 *   AC-AD 額外標記（2 欄）
 *
 * Entry 形式：
 *   - 一般欄位：`{ key, header }` — `key` 進 task.meta、`header` 對 Excel 欄標題
 *   - 視覺空白：`{ separator: true }` — 匯出時占欄位位置（空 header / 空 cell）
 *     匯入時略過（不讀進 task.meta）、UI 渲染成窄分隔欄
 */
export const AUX_FIELDS = [
  { key: 'executor',         header: '執行主體' },
  { key: 'system',           header: '操作系統' },
  { key: 'businessEntity',   header: '涉及的業務實體' },
  { key: 'entityLifecycle',  header: '操作後業務實體生命週期' },
  { separator: true },
  { separator: true },
  { key: 'entityAllocType',  header: '(1-實體)(2-分配)' },
  { key: 'singleRoleExec',   header: '單一角色執行' },
  { key: 'continuousExec',   header: '連續執行不中斷' },
  { key: 'singleBizOutput',  header: '對應單一業務產出' },
  { key: 'completeIpo',      header: '目的具體完整 IPO' },
  { separator: true },
  { key: 'verbZh',           header: '動詞_中文' },
  { key: 'nounZh',           header: '名詞_中文' },
  { key: 'checkVerbZh',      header: '檢核動詞_中文' },
  { key: 'checkNounZh',      header: '檢核名詞_中文' },
  { key: 'dictCheckDone',    header: '是否完成字典檢核' },
  { separator: true },
  { key: 'keyHandoffBreak',  header: 'Key 傳遞斷點處' },
  { key: 'soClarify',        header: '找 SO 釐清' },
];

/** 真實有 key 的輔助欄位（過濾掉 separator）— 給 task.meta 取值用。 */
export const AUX_FIELD_DEFS = AUX_FIELDS.filter(f => !f.separator);

/** 純 key 陣列，方便 task.meta render / 迭代用。 */
export const AUX_FIELD_KEYS = AUX_FIELD_DEFS.map(f => f.key);

/**
 * 確保 task 上有 `meta` 物件且型別正確。loadFlows / 新建任務 / Excel 匯入
 * 都應該過這個 helper，讓下游永遠拿到 object（不會 undefined / null / array）。
 *
 * 不會幫每個 key 預填空字串 — 那會把 localStorage 灌肥。下游 render 時用
 * `task.meta[key] ?? ''` 取值即可。
 */
export function ensureMeta(task) {
  if (!task) return task;
  if (task.meta && typeof task.meta === 'object' && !Array.isArray(task.meta)) {
    return task;
  }
  return { ...task, meta: {} };
}

/**
 * 中英混排自動間距（display-only）
 *
 * 在 CJK ↔ ASCII 英數字相鄰處自動插入一個半形空格，提升中英混排的閱讀
 * 舒適度。屬於**顯示層**處理 — caller 傳進來的 raw 資料完全不動，只回傳
 * spaced 版本供畫面顯示。Excel 匯出 / drawio 匯出 / localStorage 儲存
 * 一律走 raw 路徑、不經過此 helper。
 *
 * **規則**（只有 2 條）：
 *   1. CJK + 英數 → CJK + ' ' + 英數
 *   2. 英數 + CJK → 英數 + ' ' + CJK
 *
 * 已有空格的字串不會被重複插入（regex pattern 不會自我命中）。
 *
 * **設計決策**：
 *   - 不引用 `pangu` lib（FlowSprite 只用得到 2 條 rule、+10KB bundle
 *     換不到實際好處）。
 *   - 「英數」狹義定義為 `[A-Za-z0-9]` — 不含 `_` `-` `.` 等符號、避免
 *     L4 編號 `1-1-1-1_g` 內部被誤插空格。
 *   - CJK 範圍涵蓋常用漢字 + ext A（足以處理使用者實際輸入；ext B 以上
 *     的 astral plane 字符業務無需求）。
 *   - 不處理白名單（v1）— 多數品牌名（iPhone / PChome / 3M）內部無 CJK
 *     不會觸發 pattern。若未來實際遇到誤動再加 placeholder-based 白名單。
 *
 * **使用情境**：
 *   - DiagramRenderer SVG text (task 名稱 / 角色名稱 / edge labels)
 *   - FlowTable ReadCell value 顯示
 *   - Dashboard FlowCard `l3Name` / role chips
 *
 * **絕不使用**：
 *   - `<input>` / `<textarea>` value（會造成游標跳動）
 *   - L4Number pill（純 ASCII、本來就沒中英混排）
 *   - Excel / drawio 匯出（資料層、保持 raw）
 *   - 流程結構字串（已有 hard-coded 空格、不會被重複處理）
 *
 * @param {*} text - 任何值；非 string / null / undefined 原樣回傳
 * @returns {*} spaced string，或原值（若非 string）
 *
 * @example
 * autoSpace('確認需求')         // → '確認需求'（純中文不動）
 * autoSpace('Push to GitHub')   // → 'Push to GitHub'（純英文不動）
 * autoSpace('確認需求GitHub')   // → '確認需求 GitHub'（中→英）
 * autoSpace('GitHub整合')       // → 'GitHub 整合'（英→中）
 * autoSpace('確認 GitHub 整合') // → '確認 GitHub 整合'（已有空格、不動）
 * autoSpace('確認3M需求')       // → '確認 3M 需求'（中+數字+中）
 * autoSpace('1-1-1-1_g')        // → '1-1-1-1_g'（純 ASCII、無變化）
 * autoSpace('序列流向 5-1-1-2') // → '序列流向 5-1-1-2'（已有空格）
 * autoSpace(null)               // → null
 * autoSpace(undefined)          // → undefined
 * autoSpace('')                 // → ''
 */

// CJK Unified Ideographs（含 ext A）— 涵蓋常見中日韓漢字
const CJK = '[一-鿿㐀-䶿]';

// 「英數」嚴格定義 — 拉丁字母 + ASCII 數字
// 不含 `_` `-` `.` 避免 L4 編號 `1-1-1-1_g` 被誤動
const ALNUM = '[A-Za-z0-9]';

const RE_CJK_THEN_ALNUM = new RegExp(`(${CJK})(${ALNUM})`, 'g');
const RE_ALNUM_THEN_CJK = new RegExp(`(${ALNUM})(${CJK})`, 'g');

export function autoSpace(text) {
  if (!text || typeof text !== 'string') return text;
  return text
    .replace(RE_CJK_THEN_ALNUM, '$1 $2')
    .replace(RE_ALNUM_THEN_CJK, '$1 $2');
}

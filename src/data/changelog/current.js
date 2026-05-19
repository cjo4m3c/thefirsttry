/**
 * Changelog "current tip" — new entries since last freeze land here.
 * When this file grows beyond ~7KB, freeze: rename to c{next}.js + reset to [].
 * Entries are newest-first within file.
 */
export default [
  {
    date: '2026-05-19',
    title: 'Excel 匯入提示 nested + 列號 bug fix + 移除 emoji + Dashboard import 拆 hook',
    items: [
      '**緣由**：使用者看 banner 提示 (1) 同 L3 多筆 fix 該整齊縮排呈現、不該扁平列點 (2) 兩個結束事件被標到同一列 (Excel 第 119 列重複)、列號識別有 bug (3) 紅叉叉 ❌ / 警告 ⚠ 等 emoji 應移除、純文字呈現。+「先拆檔」按 §6 spec 規範挑、Dashboard/index.jsx 18.3KB 軟超 + 跟提示文字邏輯關聯、本 PR 抽 useExcelImport hook。',
      '**1. 訊息結構：flat string → nested group**（`excelImport/index.js`）：`flow.importFixes` / `flow.importNotices` 從 `Array<string>` → `Array<{ l3, headline, details[] }>`。同 L3 多種 fix 各自 group、headline 一級、details 縮排二級。5 種 group：(A) auto-sub adds (B) normalize L4 (C) merge incoming 不足 (D) cross-row + chain (E) validation blocking + warnings。',
      '**2. Bug fix：multi-end 列號識別錯誤**（`excelImport/index.js` + `validators.js`）：原 `excelRowByL4` 是 `Map<l4, excelRow>`、`if (!excelRowByL4[l4]) ...` 只記第一個 → 兩個 `5-2-6-99` task 都查到同一個 row（第 119 列）。改 `excelRowsByL4` 為 `Map<l4, Array<excelRow>>`、normalizeL4Numbers 加 `usedByL4` counter、按 task 出現順序消化第 N 個 → 第 N 個 row。範例：兩個 `5-2-6-99` task → 第 119 列 / 第 120 列分明。',
      '**3. 移除所有 emoji**（`excelImport/index.js` + `Banners.jsx` + `FlowEditor/index.jsx`）：(a) blocking `❌` prefix 移除（用「結構問題」/ blocking count 替代）(b) `⚠ Excel 已匯入` / `⚠ 匯入提醒` headline 去掉 ⚠ 字 (c) `! 匯入失敗` / `✓ 匯入完成` banner title 去 ! / ✓。純文字呈現。',
      '**4. Banner 渲染 nested**（`Banners.jsx` + `FlowEditor/index.jsx`）：新 `<ImportGroupList groups={...} hideL3?>` export 元件。Dashboard banner 顯示 `[L3 N] headline` + 縮排 details；FlowEditor banner `hideL3` 因單一 flow 不需 prefix、只顯 headline + details。計數從 group count 改 detail count（保持「N 筆內容」語義不變）。',
      '**5. 舊資料一次性清理**（`storage/migrations.js migrateImportWarningsToFixes`）：使用者「以新為主、不要並存」。新邏輯：見到 flow.importFixes / importNotices 內非 group object（舊 flat string / 舊 importWarnings）一律 filter 掉。重新 import Excel 才會看到 nested banner。舊資料 banner 此次重整後不顯示。',
      '**6. 拆 Dashboard import 邏輯到 `useExcelImport` hook**（**新檔** `Dashboard/useExcelImport.js`）：抽 6 個 state（importError / importSuccess / importFixes / importNotices / warningsExpanded / pendingImport）+ fileInputRef + 4 個 handler（finalizeImport / handleDuplicateResolve / handleFileChange / dismissWarnings / triggerFilePicker）。Dashboard/index.jsx 從 18.3KB → 15.9KB（軟 15KB 邊緣、硬 20KB 內）。',
      '**動到的檔案（9 個）**：`src/utils/excelImport/index.js`（5 種 group 重組 + excelRowsByL4 array）/ `src/utils/excelImport/validators.js`（normalizeL4Numbers counter）/ `src/utils/storage/migrations.js`（migrateImportWarningsToFixes filter group）/ `src/components/Dashboard/Banners.jsx`（GroupList nested render + 移 emoji）/ `src/components/Dashboard/useExcelImport.js`（**新檔**）/ `src/components/Dashboard/index.jsx`（套 hook、削減 ~80 行）/ `src/components/FlowEditor/index.jsx`（banner 改 ImportGroupList + 移 ⚠）+ `src/data/changelog/{current,c33,index}.js`（c33 凍結 PR #234 + #235 兩條、current.js 從 10.7KB 降回 ~4KB）。',
      '**驗證**：`npm run build` 通過、Dashboard/index.jsx 18.3 → 15.9KB。手動：(a) 上傳 multi-end Excel、看兩個結束事件分標不同列 (b) Dashboard banner 內 fixes / notices 依 L3 group 縮排呈現 (c) 無 ❌ / ⚠ / ! / ✓ emoji (d) FlowEditor 進入舊 flow、banner 不再顯示（舊 flat string 清空）(e) FlowEditor 進入新 import 的 flow、banner 顯示 nested。',
    ],
  },
];

// Three banners stacked above the L3 list:
//   - error    (red):    parse failure / file read error
//   - success  (sky):    multi-L3 import confirmation
//   - warnings (amber):  gateway-chain soft checks + PR-7 validateFlow lines
// All three are dismissible; parent owns the state.

export default function ImportBanners({
  importError,    setImportError,
  importSuccess,  setImportSuccess,
  importWarnings, setImportWarnings,
}) {
  return (
    <>
      {importError && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700 flex items-start gap-2">
          <span className="flex-shrink-0 font-bold">!</span>
          <span className="whitespace-pre-line flex-1">{importError}</span>
          <button onClick={() => setImportError('')}
            className="ml-auto text-red-400 hover:text-red-600 font-bold">×</button>
        </div>
      )}

      {importSuccess && (
        <div className="mb-4 p-3 rounded-lg bg-sky-50 border border-sky-200 text-sm text-sky-800 flex items-start gap-2">
          <span className="flex-shrink-0">✓</span>
          <span>{importSuccess}</span>
          <button onClick={() => setImportSuccess('')}
            className="ml-auto text-sky-400 hover:text-sky-600 font-bold">×</button>
        </div>
      )}

      {importWarnings.length > 0 && (
        <div className="mb-4 p-3 rounded-lg bg-amber-50 border border-amber-300 text-sm text-amber-800">
          <div className="flex items-start gap-2 mb-1.5">
            <span className="flex-shrink-0 font-bold">⚠</span>
            <span className="font-medium flex-1">
              Excel 已匯入，但有 {importWarnings.length} 筆閘道鏈警告（不影響使用，建議修正以獲得正確流程圖）
            </span>
            <button onClick={() => setImportWarnings([])}
              className="text-amber-400 hover:text-amber-600 font-bold">×</button>
          </div>
          <ul className="ml-5 space-y-0.5 text-xs">
            {importWarnings.slice(0, 20).map((w, i) => (
              <li key={i}>{w}</li>
            ))}
            {importWarnings.length > 20 && (
              <li className="text-amber-600">… 另有 {importWarnings.length - 20} 筆未顯示</li>
            )}
          </ul>
        </div>
      )}
    </>
  );
}

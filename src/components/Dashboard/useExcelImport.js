/**
 * useExcelImport — 把 Dashboard 的 Excel 匯入相關 state / handler 抽離。
 *
 * 提供 state（importError / importSuccess / importFixes / importNotices /
 * pendingImport / warningsExpanded）+ handler（handleFileChange /
 * handleDuplicateResolve）+ dismiss / clear 函式 + fileInputRef。
 *
 * 不擁有 flows / onImportExcel / setLogoReaction — 透過 props 傳入呼叫。
 */
import { useState, useRef, useCallback } from 'react';
import { parseExcelToFlow } from '../../utils/excelImport.js';

export function useExcelImport({ flows, onImportExcel, setLogoReaction }) {
  const [importError, setImportError] = useState('');
  const [importSuccess, setImportSuccess] = useState('');
  const [importFixes, setImportFixes] = useState([]);
  const [importNotices, setImportNotices] = useState([]);
  const [warningsExpanded, setWarningsExpanded] = useState(false);
  const [pendingImport, setPendingImport] = useState(null);
  const fileInputRef = useRef(null);

  const finalizeImport = useCallback((importedFlows, fixes, notices, mode) => {
    if (importedFlows.length > 1) {
      setImportSuccess(`成功匯入 ${importedFlows.length} 個 L3 活動：${importedFlows.map(f => f.l3Number).join('、')}`);
    }
    if (fixes && fixes.length > 0) setImportFixes(fixes);
    if (notices && notices.length > 0) setImportNotices(notices);
    setLogoReaction?.('flash');
    onImportExcel(importedFlows, mode);
  }, [onImportExcel, setLogoReaction]);

  const handleDuplicateResolve = useCallback((mode) => {
    setPendingImport(prev => {
      if (!prev || mode === 'cancel') return null;
      finalizeImport(prev.importedFlows, prev.fixes, prev.notices, mode);
      return null;
    });
  }, [finalizeImport]);

  const handleFileChange = useCallback((e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setImportError('');
    setImportSuccess('');
    setImportFixes([]);
    setImportNotices([]);

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const { flows: importedFlows, fixes, notices } = parseExcelToFlow(ev.target.result);
        // 偵測撞號：existingCounts 計算同 L3 編號既有幾個、dupes 過濾 > 0 的
        const existingCounts = {};
        flows.forEach(f => {
          if (!f.l3Number) return;
          existingCounts[f.l3Number] = (existingCounts[f.l3Number] || 0) + 1;
        });
        const dupes = importedFlows
          .map(f => ({ l3Number: f.l3Number, count: existingCounts[f.l3Number] || 0 }))
          .filter(d => d.count > 0);

        if (dupes.length > 0) {
          setPendingImport({ importedFlows, fixes: fixes || [], notices: notices || [], dupes });
          return;
        }
        finalizeImport(importedFlows, fixes || [], notices || [], 'keep');
      } catch (err) {
        setImportError(err.message ?? '解析 Excel 時發生未知錯誤');
      }
    };
    reader.onerror = () => setImportError('讀取檔案失敗，請重試');
    reader.readAsArrayBuffer(file);
  }, [flows, finalizeImport]);

  const dismissWarnings = useCallback(() => {
    setImportFixes([]);
    setImportNotices([]);
    setWarningsExpanded(false);
  }, []);

  const triggerFilePicker = useCallback(() => {
    setImportError('');
    fileInputRef.current?.click();
  }, []);

  return {
    // state
    importError, setImportError,
    importSuccess, setImportSuccess,
    importFixes, importNotices,
    warningsExpanded, setWarningsExpanded,
    pendingImport,
    fileInputRef,
    // actions
    handleFileChange,
    handleDuplicateResolve,
    dismissWarnings,
    triggerFilePicker,
  };
}

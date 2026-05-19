/**
 * Modal shown when 使用者按 Dashboard 卡片的「複製」按鈕。讓使用者填新 L3
 * 編號 + 新名稱，按確定後觸發 cloneFlow + saveFlow + 跳進 FlowEditor。
 *
 * 撞號處理：modal 不擋；維持跟 Wizard 儲存相同的行為（App.handleClone
 * 跳 window.confirm，使用者按確定就允許並存）。
 *
 * Pre-fill：新編號留空（placeholder 顯示原編號當提示）；名稱預設
 * 「<原名稱>（複本）」。L3 格式錯誤即時 inline error，不准送出。
 */
import { useState, useEffect, useRef } from 'react';
import { L3_NUMBER_PATTERN } from '../../utils/taskDefs.js';
import { Modal, ModalBody, ModalFoot } from '../ui/Modal.jsx';
import { Button } from '../ui/Button.jsx';

export function CloneFlowModal({ source, onResolve }) {
  const [newL3Number, setNewL3Number] = useState('');
  const [newL3Name, setNewL3Name] = useState('');
  const numberInputRef = useRef(null);

  useEffect(() => {
    if (source) {
      setNewL3Number('');
      setNewL3Name(`${source.l3Name || ''}（複本）`);
      // Defer so the modal mounts before focus runs
      setTimeout(() => numberInputRef.current?.focus(), 0);
    }
  }, [source]);

  if (!source) return null;

  const trimmedNumber = newL3Number.trim();
  const trimmedName = newL3Name.trim();
  const numberFormatOk = L3_NUMBER_PATTERN.test(trimmedNumber);
  const formatError = trimmedNumber && !numberFormatOk
    ? '格式應為 X-Y-Z（三段數字、橫線分隔，例：5-1-3）'
    : '';
  const canSubmit = numberFormatOk && trimmedName.length > 0;

  function submit() {
    if (!canSubmit) return;
    onResolve({ newL3Number: trimmedNumber, newL3Name: trimmedName });
  }

  return (
    <Modal
      isOpen={!!source}
      onClose={() => onResolve(null)}
      width={480}
      title="複製工作流"
    >
      <ModalBody>
        <p className="text-xs text-gray-500">
          從「<span className="font-mono text-blue-700">{source.l3Number}</span> {source.l3Name}」複製一份新流程，原始流程不會更動。
        </p>
        <div className="space-y-4 mt-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">新 L3 編號</label>
            <input
              ref={numberInputRef}
              type="text"
              value={newL3Number}
              onChange={e => setNewL3Number(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && canSubmit) submit(); }}
              placeholder={source.l3Number || '例：5-1-3'}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-300" />
            {formatError && (
              <p className="text-xs text-red-600 mt-1">{formatError}</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">新名稱</label>
            <input
              type="text"
              value={newL3Name}
              onChange={e => setNewL3Name(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && canSubmit) submit(); }}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
          </div>
          <p className="text-xs text-gray-500">
            複製內容：所有任務、角色、連線、輔助欄位資料。<br />
            重設項目：建立 / 更新時間、置頂、Excel 匯入警示。<br />
            子流程引用（調用 X-Y-Z）維持指向原流程。
          </p>
        </div>
      </ModalBody>
      <ModalFoot>
        <Button onClick={() => onResolve(null)}>取消</Button>
        <Button variant="primary" disabled={!canSubmit} onClick={submit}>
          複製並開啟
        </Button>
      </ModalFoot>
    </Modal>
  );
}

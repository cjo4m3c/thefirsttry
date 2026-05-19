/**
 * Modal shown when an Excel import contains L3 numbers that already exist.
 * The user picks 都保留 (coexist with old) / 覆蓋 (delete old, keep new) /
 * 取消匯入 (discard imported flows). Click outside the panel = cancel.
 *
 * `pendingImport.dupes` is the per-L3 duplicate list ({ l3Number, count }).
 * Total old = sum of counts; gets shown in the 覆蓋 button label.
 */
import { Modal, ModalBody, ModalFoot } from '../ui/Modal.jsx';
import { Button } from '../ui/Button.jsx';

export function DuplicateImportModal({ pendingImport, onResolve }) {
  if (!pendingImport) return null;
  const totalOld = pendingImport.dupes.reduce((s, d) => s + d.count, 0);
  return (
    <Modal
      isOpen={!!pendingImport}
      onClose={() => onResolve('cancel')}
      width={560}
      title="偵測到重複的 L3 編號"
      subtitle="系統已有相同編號的活動，請選擇處理方式："
    >
      <ModalBody>
        <ul className="text-sm text-gray-700 space-y-1 max-h-64 overflow-y-auto">
          {pendingImport.dupes.map(d => (
            <li key={d.l3Number} className="flex items-center gap-2">
              <span className="font-mono text-blue-700">{d.l3Number}</span>
              <span className="text-gray-500">已有 {d.count} 個 → 將匯入 1 個新的</span>
            </li>
          ))}
        </ul>
        <p className="text-xs text-gray-500 pt-2">
          <strong>都保留</strong>：新舊活動並存（跟目前行為一樣）<br />
          <strong>覆蓋</strong>：刪除上述編號的 {totalOld} 個舊活動，只保留本次匯入
        </p>
      </ModalBody>
      <ModalFoot className="flex-wrap">
        <Button onClick={() => onResolve('cancel')}>取消匯入</Button>
        {/* 都保留 = 主動作 primary；覆蓋 = 破壞動作 danger-fill */}
        <Button variant="primary" onClick={() => onResolve('keep')}>都保留</Button>
        <Button variant="danger-fill" onClick={() => onResolve('overwrite')}>
          覆蓋（刪除 {totalOld} 個舊的）
        </Button>
      </ModalFoot>
    </Modal>
  );
}

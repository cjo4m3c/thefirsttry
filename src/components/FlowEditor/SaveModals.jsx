/**
 * Two confirmation modals shown above FlowEditor:
 *   - SaveModal: blocking errors / warning list before save
 *   - ResetAllModal: confirm before clearing all manual endpoint overrides
 */
import { Modal, ModalBody, ModalFoot } from '../ui/Modal.jsx';
import { Button } from '../ui/Button.jsx';

export function SaveModal({ saveModal, onCancel, onSaveAnyway }) {
  if (!saveModal) return null;
  const isBlocking = saveModal.type === 'blocking';
  return (
    <Modal
      isOpen={!!saveModal}
      onClose={onCancel}
      variant={isBlocking ? 'danger' : 'warning'}
      width={560}
      title={isBlocking ? '必要條件未達，無法儲存' : '有建議改善項目'}
      subtitle={isBlocking
        ? '修正以下問題後才能儲存：'
        : '以下項目建議修正。您可以選擇仍然儲存，或取消並回去調整：'}
    >
      <ModalBody>
        <ul className="text-sm text-gray-700 space-y-1.5 list-disc list-inside">
          {saveModal.messages.map((m, i) => <li key={i}>{m}</li>)}
        </ul>
      </ModalBody>
      <ModalFoot>
        <Button onClick={onCancel}>
          {isBlocking ? '知道了' : '取消'}
        </Button>
        {!isBlocking && (
          <Button variant="warning" onClick={onSaveAnyway}>
            仍然儲存
          </Button>
        )}
      </ModalFoot>
    </Modal>
  );
}

// PR I: confirm modal for the global "重設所有手動端點" action.
// Destructive (can't undo) → require explicit confirmation.
export function ResetAllModal({ open, onCancel, onConfirm }) {
  return (
    <Modal
      isOpen={open}
      onClose={onCancel}
      variant="warning"
      width={480}
      title="重設所有手動端點"
      subtitle="此動作會清除本工作流所有連線的手動拖曳端點設定，回到自動路由。無法復原。"
    >
      <ModalFoot>
        <Button onClick={onCancel}>取消</Button>
        <Button variant="warning" onClick={onConfirm}>確定重設</Button>
      </ModalFoot>
    </Modal>
  );
}

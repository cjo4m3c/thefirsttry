import { useEffect, useRef, useState, useCallback } from 'react';
import { applyRoleChange } from '../../utils/elementTypes.js';
import {
  L3ActivitySubForm,
  ConnectionSubForm,
  GatewaySubForm,
  GatewayEditorSubForm,
  OtherSubForm,
  ConvertSubForm,
} from './subforms.jsx';

/**
 * ContextMenu — pop-up shown when the user clicks a task shape on the diagram.
 *
 * Inline-edits name/role/description/l3-number; actions trigger add-after /
 * add-gateway / add-connection / add-l3 / add-other / convert / delete.
 * Gateway-only: 編輯閘道 (type + conditions inline editor).
 *
 * Action order (by element type — common operations on top):
 *   non-gateway: 任務 / 閘道 / 連線 / L3 / 其他 / 轉換 / 刪除
 *   gateway:     任務 / 閘道 / 連線 / L3 / 編輯閘道 / 其他 / 轉換 / 刪除
 *
 * Layout split (PR-0):
 *   - this file: state hub, action list, edit fields, glue
 *   - subforms.jsx: 6 sub-form components
 *
 * Props:
 *   - task          the clicked task object (or null when closed)
 *   - x, y          viewport coordinates where the click happened
 *   - roles         flow.roles array
 *   - allTasks      flow.tasks array (for sub-form target dropdowns)
 *   - displayLabels { taskId → "5-1-1-3" } for dropdown option labels
 *   - onUpdate(updatedTask)
 *   - onAddAfter(taskId)
 *   - onAddConnection(fromTaskId, toTaskId)
 *   - onAddGateway(anchorId, gatewayType, target1, target2, label1, label2)
 *   - onAddL3Activity(anchorId, l3Number, l3Name)
 *   - onAddOther(anchorId, kind)              kind: start|end|breakpoint|interaction
 *   - onConvertType(taskId, kind)             kind: task|l3activity|interaction|start|end|breakpoint|gateway-xor|gateway-and|gateway-or
 *   - onDelete(taskId)
 *   - onClose()
 *
 * Hidden options:
 *   - end / breakpoint → no add-after / add-connection / add-gateway / add-l3 / add-other
 *   - "編輯閘道" appears only for gateway tasks
 */
export default function ContextMenu({
  task, x, y, roles, allTasks, displayLabels,
  onUpdate, onAddAfter, onAddConnection, onAddGateway, onAddL3Activity,
  onAddOther, onConvertType, onDelete, onClose,
}) {
  const ref = useRef(null);
  const [adjusted, setAdjusted] = useState({ left: x, top: y });
  // Drag state: per user spec 2026-05-04 the menu is always reclamped on
  // size change (incl. after a drag), so we only need the dragging flag
  // and the pointer offset to drive the live drag.
  const [dragging, setDragging] = useState(false);
  const dragOffsetRef = useRef({ dx: 0, dy: 0 });
  // 'connection' | 'gateway' | 'l3activity' | 'gw-edit' | 'other' | 'convert' | null
  const [subForm, setSubForm] = useState(null);
  const [connTarget, setConnTarget] = useState('');
  const [gwType, setGwType] = useState('xor');
  // gwBranches: [{ label, target }]. Default 2; user can add / remove
  // until ≥2 remain. Mirrors editor InsertPicker UX.
  const [gwBranches, setGwBranches] = useState([
    { label: '', target: '' },
    { label: '', target: '' },
  ]);
  const [l3Number, setL3Number] = useState('');
  const [l3Name, setL3Name] = useState('');

  // Reset sub-form state when the menu opens for a different task.
  // Per user spec 2026-05-04 後段：clicking a gateway auto-expands the
  // 編輯閘道 ('gw-edit') sub-form, since branch editing is the primary
  // action on a gateway. Other task types keep the collapsed default.
  useEffect(() => {
    setSubForm(task?.type === 'gateway' ? 'gw-edit' : null);
    setConnTarget('');
    setGwType('xor');
    setGwBranches([{ label: '', target: '' }, { label: '', target: '' }]);
    setL3Number('');
    setL3Name('');
  }, [task?.id, task?.type]);

  // Initialize position from the click point whenever the menu opens for
  // a different task. Subsequent drags / sub-form expansions only adjust
  // from the previous adjusted position (not back to the click point).
  useEffect(() => {
    setAdjusted({ left: x, top: y });
  }, [x, y, task?.id]);

  // Pure clamp — given prev (left, top), shrink to viewport bounds.
  // Reads ref.current rect inside so it always uses the latest size.
  const reclamp = useCallback(() => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    setAdjusted(prev => {
      let left = prev.left;
      let top = prev.top;
      if (left + rect.width > vw - 8)  left = vw - rect.width - 8;
      if (top  + rect.height > vh - 8) top  = vh - rect.height - 8;
      if (left < 8) left = 8;
      if (top  < 8) top  = 8;
      return (left === prev.left && top === prev.top) ? prev : { left, top };
    });
  }, []);

  // Auto-reclamp on size changes — covers sub-form expand/collapse + window
  // resize + post-drag (when user drags to an edge then expands). Per user
  // spec 2026-05-04, this runs even after manual drag (always corrects
  // overflow). ResizeObserver fires on any element-size change.
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(() => reclamp());
    ro.observe(ref.current);
    function onWinResize() { reclamp(); }
    window.addEventListener('resize', onWinResize);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', onWinResize);
    };
  }, [reclamp]);

  // Drag handlers — pointermove / pointerup attach to window only while
  // actively dragging. Live position is also clamped to viewport so the
  // user can't lose the menu off-screen.
  function startDrag(e) {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    dragOffsetRef.current = {
      dx: e.clientX - rect.left,
      dy: e.clientY - rect.top,
    };
    setDragging(true);
    e.preventDefault();
  }
  useEffect(() => {
    if (!dragging) return;
    function onMove(e) {
      if (!ref.current) return;
      const rect = ref.current.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      let left = e.clientX - dragOffsetRef.current.dx;
      let top = e.clientY - dragOffsetRef.current.dy;
      if (left + rect.width > vw - 8)  left = vw - rect.width - 8;
      if (top  + rect.height > vh - 8) top  = vh - rect.height - 8;
      if (left < 8) left = 8;
      if (top  < 8) top  = 8;
      setAdjusted({ left, top });
    }
    function onUp() { setDragging(false); }
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [dragging]);

  // Click outside / Esc closes. Skipped while dragging — releasing the
  // pointer outside the menu shouldn't accidentally close it.
  useEffect(() => {
    const onDocClick = (e) => {
      if (dragging) return;
      if (ref.current && !ref.current.contains(e.target)) onClose?.();
    };
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    // Defer to next tick so the click that opened us doesn't immediately close.
    const id = setTimeout(() => {
      document.addEventListener('mousedown', onDocClick);
    }, 0);
    window.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(id);
      document.removeEventListener('mousedown', onDocClick);
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose, dragging]);

  if (!task) return null;

  const isStart = task.type === 'start' || task.connectionType === 'start';
  const isEnd   = task.type === 'end'   || task.connectionType === 'end' || task.connectionType === 'breakpoint';
  // end / breakpoint have no outgoing → all "add after" actions disabled.
  const canAddOutgoing = !isEnd;
  const isGateway = task.type === 'gateway';

  // Dropdown candidate tasks for sub-forms (exclude self).
  const targetOptions = (allTasks || []).filter(t => t.id !== task.id);

  function submitConnection() {
    if (!connTarget) return;
    onAddConnection?.(task.id, connTarget);
    onClose?.();
  }
  function submitGateway() {
    // Pass ALL branch rows (including empty-target ones) so the gateway is
    // created exactly as the user sees it in the form. Empty targets become
    // save-time warnings (rule 1 / 3c-bis) — per user spec 2026-05-04 後段:
    // "不強制要先連到任務才能按確定，允許使用者先新增後回來補分支".
    onAddGateway?.(task.id, gwType, gwBranches.map(b => ({ label: b.label, targetId: b.target })));
    onClose?.();
  }
  function submitL3Activity() {
    if (!l3Number.trim()) return;
    onAddL3Activity?.(task.id, l3Number.trim(), l3Name.trim());
    onClose?.();
  }
  function pickOther(kind) {
    onAddOther?.(task.id, kind);
    onClose?.();
  }
  function pickConvert(kind) {
    onConvertType?.(task.id, kind);
    onClose?.();
  }

  // Action button — toggles sub-form visibility. Per user request, no leading
  // icons; chevron on the right is kept as a functional dropdown indicator.
  function ActionToggle({ formKey, label }) {
    const active = subForm === formKey;
    return (
      <button
        onClick={() => setSubForm(active ? null : formKey)}
        className={`w-full px-3 py-2 text-left text-xs flex items-center gap-2 ${
          active ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-blue-50 hover:text-blue-700'
        }`}>
        {label}
        <span className="ml-auto text-gray-400">{active ? '▴' : '▾'}</span>
      </button>
    );
  }

  return (
    <div
      ref={ref}
      className="fixed z-50 bg-white rounded-lg shadow-2xl border border-gray-200"
      style={{ left: adjusted.left, top: adjusted.top, width: 300 }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header — left has drag handle (☰), right has close (✕). The
          handle is the only drag region so clicking elsewhere on the header
          (e.g. ✕) doesn't start a drag. */}
      <div className="px-2 py-2 border-b border-gray-200 bg-gray-50 rounded-t-lg flex items-center justify-between gap-2">
        <button onPointerDown={startDrag}
          title="拖曳移動編輯選單"
          aria-label="拖曳移動"
          className="text-gray-400 hover:text-gray-700 text-base leading-none px-1"
          style={{ cursor: dragging ? 'grabbing' : 'grab', touchAction: 'none' }}>
          ☰
        </button>
        <span className="text-xs font-semibold text-gray-700 flex-1">編輯元件</span>
        <button onClick={onClose} title="關閉（Esc）"
          className="text-gray-400 hover:text-gray-700 text-sm leading-none px-1">✕</button>
      </div>
      {/* Body — scrollable when sub-form expand pushes total height past
          70vh. Header (drag + ✕) stays outside this wrapper so always
          reachable even when scrolled. */}
      <div className="overflow-y-auto" style={{ maxHeight: '70vh' }}>

      {/* Inline edit fields */}
      <div className="px-3 py-2.5 flex flex-col gap-2">
        <label className="flex flex-col gap-1">
          <span className="text-xs text-gray-500">名稱</span>
          <input type="text" value={task.name || ''}
            onChange={(e) => onUpdate({ ...task, name: e.target.value })}
            placeholder={isStart || isEnd ? '名稱（選填）' : '任務名稱'}
            className="px-2 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-gray-500">角色</span>
          <select value={task.roleId || ''}
            onChange={(e) => onUpdate(applyRoleChange(task, e.target.value, roles))}
            className="px-2 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-400">
            <option value="">（未指定）</option>
            {(roles || []).filter(r => r.name).map(r => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-gray-500">任務重點說明</span>
          <textarea value={task.description || ''}
            onChange={(e) => onUpdate({ ...task, description: e.target.value })}
            placeholder="說明這個任務的重點（會在流程圖 hover 時顯示）"
            rows={3}
            className="px-2 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-400 resize-y leading-relaxed"
          />
        </label>
        {task.type === 'l3activity' && (
          <label className="flex flex-col gap-1">
            <span className="text-xs text-gray-500">L3 編號（被調用的子流程）</span>
            <input type="text" value={task.subprocessName || ''}
              onChange={(e) => onUpdate({ ...task, subprocessName: e.target.value })}
              placeholder="例：5-3-2"
              className="px-2 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
            />
          </label>
        )}
      </div>

      {/* Action buttons — order by usage frequency (per element type).
          Gateway-specific: 編輯閘道 first (auto-expanded on open) so
          branch editing is the most prominent action. Per user spec
          2026-05-04 後段：「希望也預設展開編輯閘道分支的欄位」 +
          field-order evaluation. */}
      <div className="border-t border-gray-100 py-1">
        {/* 0 (gateway-only, top). 編輯閘道 — type switch + conditions list.
            Auto-expanded by default on gateway click. */}
        {isGateway && <ActionToggle formKey="gw-edit" label="編輯閘道（種類 / 條件）" />}
        {isGateway && subForm === 'gw-edit' && (
          <GatewayEditorSubForm
            task={task} allTasks={allTasks} displayLabels={displayLabels}
            onUpdate={onUpdate} />
        )}

        {/* 1. 新增任務 */}
        {canAddOutgoing && (
          <button onClick={() => { onAddAfter?.(task.id); onClose?.(); }}
            className="w-full px-3 py-2 text-left text-xs text-gray-700 hover:bg-blue-50 hover:text-blue-700 flex items-center gap-2">
            新增任務
          </button>
        )}

        {/* 2. 新增閘道 */}
        {canAddOutgoing && <ActionToggle formKey="gateway" label="新增閘道" />}
        {subForm === 'gateway' && (
          <GatewaySubForm
            gwType={gwType} setGwType={setGwType}
            gwBranches={gwBranches} setGwBranches={setGwBranches}
            targetOptions={targetOptions} displayLabels={displayLabels}
            onCancel={() => setSubForm(null)} onSubmit={submitGateway} />
        )}

        {/* 3. 新增連線 */}
        {canAddOutgoing && <ActionToggle formKey="connection" label="新增連線" />}
        {subForm === 'connection' && (
          <ConnectionSubForm
            connTarget={connTarget} setConnTarget={setConnTarget}
            targetOptions={targetOptions} displayLabels={displayLabels}
            onCancel={() => setSubForm(null)} onSubmit={submitConnection} />
        )}

        {/* 4. 新增 L3 流程 */}
        {canAddOutgoing && <ActionToggle formKey="l3activity" label="新增 L3 流程（子流程調用）" />}
        {subForm === 'l3activity' && (
          <L3ActivitySubForm
            l3Number={l3Number} setL3Number={setL3Number}
            l3Name={l3Name} setL3Name={setL3Name}
            onCancel={() => setSubForm(null)} onSubmit={submitL3Activity} />
        )}

        {/* 5. 新增其他 */}
        {canAddOutgoing && <ActionToggle formKey="other" label="新增其他" />}
        {subForm === 'other' && (
          <OtherSubForm onPick={pickOther} onCancel={() => setSubForm(null)} />
        )}

        {/* 6b (non-gateway). 轉換為 — change this element's type in place */}
        {!isStart && <ActionToggle formKey="convert" label="轉換為..." />}
        {subForm === 'convert' && (
          <ConvertSubForm task={task} onPick={pickConvert} onCancel={() => setSubForm(null)} />
        )}

        {/* 7. 刪除 */}
        <button onClick={() => { onDelete?.(task.id); onClose?.(); }}
          className="w-full px-3 py-2 text-left text-xs text-red-600 hover:bg-red-50 flex items-center gap-2">
          刪除此元件
        </button>
      </div>
      </div>{/* /body scroll wrapper */}
    </div>
  );
}

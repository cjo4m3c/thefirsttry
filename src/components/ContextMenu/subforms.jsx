import { taskOptionLabel, applyGatewayPrefix } from '../../utils/taskDefs.js';
import { generateId } from '../../utils/storage.js';

/**
 * Add-action sub-forms for the ContextMenu — one block per add type.
 * All forms share a common shape: title row + body fields + action row
 * (取消 / 確認). Visibility is controlled by the parent's `subForm` state.
 */

function renderTargetOption(t, displayLabels) {
  return (
    <option key={t.id} value={t.id}>
      {taskOptionLabel(t, displayLabels || {})}
    </option>
  );
}

export function L3ActivitySubForm({
  l3Number, setL3Number, l3Name, setL3Name,
  onCancel, onSubmit,
}) {
  return (
    <div className="px-3 py-2 bg-gray-50 border-t border-b border-gray-100 flex flex-col gap-2">
      <label className="flex flex-col gap-1">
        <span className="text-xs text-gray-500">L3 編號 *</span>
        <input type="text" value={l3Number} onChange={(e) => setL3Number(e.target.value)}
          placeholder="例：5-3-2"
          className="px-2 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-400" />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs text-gray-500">L3 活動名稱（選填）</span>
        <input type="text" value={l3Name} onChange={(e) => setL3Name(e.target.value)}
          placeholder="例：客戶資料審核"
          className="px-2 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-400" />
      </label>
      <p className="text-xs text-gray-400 pl-1">
        ℹ L3 活動會插入在當前元件之後，並自動接續原本的下一步
      </p>
      <div className="flex gap-2 justify-end">
        <button onClick={onCancel}
          className="px-3 py-1 text-xs text-gray-600 hover:text-gray-900">取消</button>
        <button onClick={onSubmit} disabled={!l3Number.trim()}
          className="px-3 py-1 text-xs rounded text-white disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ background: l3Number.trim() ? '#2A5598' : '#9CA3AF' }}>
          確認
        </button>
      </div>
    </div>
  );
}

export function ConnectionSubForm({
  connTarget, setConnTarget, targetOptions, displayLabels,
  onCancel, onSubmit,
}) {
  return (
    <div className="px-3 py-2 bg-gray-50 border-t border-b border-gray-100 flex flex-col gap-2">
      <label className="flex flex-col gap-1">
        <span className="text-xs text-gray-500">連線目標</span>
        <select value={connTarget} onChange={(e) => setConnTarget(e.target.value)}
          className="px-2 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-400">
          <option value="">選擇目標任務</option>
          {targetOptions.map(t => renderTargetOption(t, displayLabels))}
        </select>
      </label>
      <div className="flex gap-2 justify-end">
        <button onClick={onCancel}
          className="px-3 py-1 text-xs text-gray-600 hover:text-gray-900">取消</button>
        <button onClick={onSubmit} disabled={!connTarget}
          className="px-3 py-1 text-xs rounded text-white disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ background: connTarget ? '#2A5598' : '#9CA3AF' }}>
          確認
        </button>
      </div>
    </div>
  );
}

export function GatewaySubForm({
  gwType, setGwType,
  gwLabel1, setGwLabel1, gwTarget1, setGwTarget1,
  gwLabel2, setGwLabel2, gwTarget2, setGwTarget2,
  targetOptions, displayLabels,
  onCancel, onSubmit,
}) {
  const canSubmit = !!(gwTarget1 && gwTarget2);
  return (
    <div className="px-3 py-2 bg-gray-50 border-t border-b border-gray-100 flex flex-col gap-2">
      <div className="flex flex-col gap-1">
        <span className="text-xs text-gray-500">閘道類型</span>
        <div className="flex gap-3 text-xs">
          {[
            { v: 'xor', label: '條件 ◇×' },
            { v: 'and', label: '並行 ◇+' },
            { v: 'or',  label: '包容 ◇⊙' },
          ].map(opt => (
            <label key={opt.v} className="flex items-center gap-1 cursor-pointer">
              <input type="radio" value={opt.v} checked={gwType === opt.v}
                onChange={() => setGwType(opt.v)} />
              {opt.label}
            </label>
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-xs text-gray-500">分支 1</span>
        <input type="text" value={gwLabel1} onChange={(e) => setGwLabel1(e.target.value)}
          placeholder={gwType === 'and' ? '條件標籤（選填）' : '條件標籤（如「已核准」）'}
          className="px-2 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-400" />
        <select value={gwTarget1} onChange={(e) => setGwTarget1(e.target.value)}
          className="px-2 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-400">
          <option value="">選擇目標任務</option>
          {targetOptions.map(t => renderTargetOption(t, displayLabels))}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-xs text-gray-500">分支 2</span>
        <input type="text" value={gwLabel2} onChange={(e) => setGwLabel2(e.target.value)}
          placeholder={gwType === 'and' ? '條件標籤（選填）' : '條件標籤（如「未通過」）'}
          className="px-2 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-400" />
        <select value={gwTarget2} onChange={(e) => setGwTarget2(e.target.value)}
          className="px-2 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-400">
          <option value="">選擇目標任務</option>
          {targetOptions.map(t => renderTargetOption(t, displayLabels))}
        </select>
      </div>
      <p className="text-xs text-gray-400 pl-1">
        ℹ 閘道會插入在當前元件之後，原本「序列流向」會被覆寫為「→ 閘道」
      </p>
      <div className="flex gap-2 justify-end">
        <button onClick={onCancel}
          className="px-3 py-1 text-xs text-gray-600 hover:text-gray-900">取消</button>
        <button onClick={onSubmit} disabled={!canSubmit}
          className="px-3 py-1 text-xs rounded text-white disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ background: canSubmit ? '#2A5598' : '#9CA3AF' }}>
          確認
        </button>
      </div>
    </div>
  );
}

/**
 * Gateway editor — type switch + conditions list (label + target + delete +
 * add). Used for existing gateways via the "編輯閘道" action. Combines what
 * used to be the type-switch sub-form with inline conditions editing so the
 * user can adjust everything in one place.
 *
 * Auto-saves on every change via onUpdate(updatedTask) — no 取消/確認 buttons.
 */
export function GatewayEditorSubForm({
  task, allTasks, displayLabels, onUpdate,
}) {
  function setType(newType) {
    if (newType === task.gatewayType) return;
    const isMerge = task.connectionType?.endsWith('-merge');
    const typeRoot = { xor: 'conditional', and: 'parallel', or: 'inclusive' }[newType];
    const newCT = `${typeRoot}-${isMerge ? 'merge' : 'branch'}`;
    onUpdate({
      ...task,
      gatewayType: newType,
      connectionType: newCT,
      name: applyGatewayPrefix(task.name, newType),
    });
  }
  function setCondition(idx, partial) {
    const conds = (task.conditions || []).map((c, i) =>
      i === idx ? { ...c, ...partial } : c
    );
    onUpdate({ ...task, conditions: conds });
  }
  function addCondition() {
    const conds = [...(task.conditions || []), { id: generateId(), label: '', nextTaskId: '' }];
    onUpdate({ ...task, conditions: conds });
  }
  function removeCondition(idx) {
    const conds = (task.conditions || []).filter((_, i) => i !== idx);
    onUpdate({ ...task, conditions: conds });
  }
  const targetOptions = (allTasks || []).filter(t => t.id !== task.id);
  return (
    <div className="px-3 py-2 bg-gray-50 border-t border-b border-gray-100 flex flex-col gap-2">
      <div>
        <span className="text-xs text-gray-500">閘道類型</span>
        <div className="flex gap-3 text-xs mt-1">
          {[
            { v: 'xor', label: '排他 ◇×' },
            { v: 'and', label: '並行 ◇+' },
            { v: 'or',  label: '包容 ◇⊙' },
          ].map(opt => (
            <label key={opt.v} className="flex items-center gap-1 cursor-pointer">
              <input type="radio" value={opt.v} checked={task.gatewayType === opt.v}
                onChange={() => setType(opt.v)} />
              {opt.label}
            </label>
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-2 mt-1">
        <span className="text-xs text-gray-500">分支條件 / 流向</span>
        {(task.conditions || []).map((c, i) => (
          <div key={c.id} className="flex flex-col gap-1 border border-gray-200 bg-white rounded p-1.5">
            <div className="flex items-center gap-1">
              <span className="text-xs text-gray-400 w-10 flex-shrink-0">分支{i + 1}</span>
              <input type="text" value={c.label || ''}
                onChange={(e) => setCondition(i, { label: e.target.value })}
                placeholder={task.gatewayType === 'and' ? '條件標籤（選填）' : '條件標籤'}
                className="flex-1 min-w-0 px-1.5 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-400" />
              <button onClick={() => removeCondition(i)} title="刪除這個分支"
                className="text-red-500 hover:bg-red-50 rounded px-1 text-xs flex-shrink-0">✕</button>
            </div>
            <select value={c.nextTaskId || ''}
              onChange={(e) => setCondition(i, { nextTaskId: e.target.value })}
              className="px-1.5 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-400">
              <option value="">選擇目標任務</option>
              {targetOptions.map(t =>
                <option key={t.id} value={t.id}>{taskOptionLabel(t, displayLabels || {})}</option>
              )}
            </select>
          </div>
        ))}
        <button onClick={addCondition}
          className="self-start text-xs text-blue-600 hover:bg-blue-50 px-2 py-1 rounded border border-blue-200">
          + 新增分支
        </button>
      </div>
      <p className="text-xs text-gray-400 pl-1">
        ℹ 變更會即時套用，不需要按確認
      </p>
    </div>
  );
}

/**
 * "新增其他" — 開始 / 結束 / 流程斷點 / 外部互動 four-button row.
 * Each button creates the corresponding element after the anchor task.
 */
export function OtherSubForm({ onPick, onCancel }) {
  const items = [
    { kind: 'start',       label: '○ 開始事件',   hint: '流程起點（每張圖僅能有一個）' },
    { kind: 'end',         label: '● 結束事件',   hint: '流程正常終點' },
    { kind: 'interaction', label: '▭ 外部互動',  hint: '系統互動 / 跨角色協作（建議放外部角色泳道）' },
  ];
  return (
    <div className="px-3 py-2 bg-gray-50 border-t border-b border-gray-100 flex flex-col gap-1">
      {items.map(it => (
        <button key={it.kind} onClick={() => onPick(it.kind)}
          className="text-left px-2 py-1.5 text-xs rounded hover:bg-blue-50 hover:text-blue-700 flex flex-col">
          <span className="font-medium">{it.label}</span>
          <span className="text-gray-400">{it.hint}</span>
        </button>
      ))}
      <div className="flex justify-end pt-1">
        <button onClick={onCancel}
          className="px-3 py-1 text-xs text-gray-600 hover:text-gray-900">取消</button>
      </div>
    </div>
  );
}

/**
 * "轉換為..." — convert the existing task's type / connectionType in place.
 * Lists all valid target types; current type is highlighted and disabled.
 */
export function ConvertSubForm({ task, onPick, onCancel }) {
  const items = [
    { kind: 'task',         label: '一般任務',       match: task.type === 'task' && task.shapeType !== 'interaction' && task.connectionType !== 'subprocess' },
    { kind: 'l3activity',   label: 'L3 活動（子流程調用）', match: task.type === 'l3activity' },
    { kind: 'interaction',  label: '外部互動',       match: task.shapeType === 'interaction' },
    { kind: 'gateway-xor',  label: '排他閘道 ◇×',   match: task.type === 'gateway' && task.gatewayType === 'xor' },
    { kind: 'gateway-and',  label: '並行閘道 ◇+',   match: task.type === 'gateway' && task.gatewayType === 'and' },
    { kind: 'gateway-or',   label: '包容閘道 ◇⊙',  match: task.type === 'gateway' && task.gatewayType === 'or' },
    { kind: 'start',        label: '開始事件',       match: task.type === 'start' },
    { kind: 'end',          label: '結束事件',       match: task.type === 'end' && task.connectionType === 'end' },
  ];
  return (
    <div className="px-3 py-2 bg-gray-50 border-t border-b border-gray-100 flex flex-col gap-1">
      <p className="text-xs text-gray-400 pl-1">
        ℹ 轉換後現有連線會收斂到第一個目標；多分支需手動補
      </p>
      {items.map(it => (
        <button key={it.kind} onClick={() => onPick(it.kind)} disabled={it.match}
          className={`text-left px-2 py-1.5 text-xs rounded ${
            it.match
              ? 'bg-blue-100 text-blue-700 cursor-not-allowed'
              : 'hover:bg-blue-50 hover:text-blue-700 text-gray-700'
          }`}>
          {it.label} {it.match && <span className="text-gray-400">（目前）</span>}
        </button>
      ))}
      <div className="flex justify-end pt-1">
        <button onClick={onCancel}
          className="px-3 py-1 text-xs text-gray-600 hover:text-gray-900">取消</button>
      </div>
    </div>
  );
}

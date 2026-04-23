import { useState } from 'react';
import { generateId } from '../utils/storage.js';
import { useDragReorder, DragHandle } from './dragReorder.jsx';
import {
  makeRole, makeTask,
  applySequentialDefaults,
  L3_NUMBER_PATTERN,
} from '../utils/taskDefs.js';

// The wizard is a 2-step kickoff (L3 info → roles) that seeds a minimal
// flow (start + one task + end) and hands off to FlowEditor for the full
// task editing experience. Excel import already opens FlowEditor directly;
// keeping the wizard short mirrors that UX for the manual-entry path.
function initFormData(flow) {
  if (flow) {
    return { ...flow, tasks: applySequentialDefaults(flow.tasks || []) };
  }
  const tasks = [
    makeTask({ connectionType: 'start',    type: 'start' }),
    makeTask({ connectionType: 'sequence', type: 'task'  }),
    makeTask({ connectionType: 'end',      type: 'end'   }),
  ];
  tasks[0].nextTaskIds = [tasks[1].id];
  tasks[1].nextTaskIds = [tasks[2].id];
  return { id: generateId(), l3Number: '', l3Name: '', roles: [makeRole(), makeRole()], tasks };
}

// ── Step indicator ───────────────────────────────────────────────
function StepIndicator({ current, steps }) {
  return (
    <div className="flex items-center justify-center mb-8">
      {steps.map((label, i) => (
        <div key={i} className="flex items-center">
          <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-semibold transition-colors
            ${i < current  ? 'bg-blue-600 text-white' :
              i === current ? 'bg-blue-600 text-white ring-4 ring-blue-100' :
                              'bg-gray-200 text-gray-500'}`}>
            {i + 1}
          </div>
          <span className={`ml-2 text-sm ${i === current ? 'font-semibold text-blue-600' : 'text-gray-500'}`}>
            {label}
          </span>
          {i < steps.length - 1 && (
            <div className={`w-8 h-0.5 mx-2 ${i < current ? 'bg-blue-600' : 'bg-gray-200'}`} />
          )}
        </div>
      ))}
    </div>
  );
}

// ── Step 1: L3 Info ──────────────────────────────────────────────
function Step1({ data, onChange }) {
  const [numErr, setNumErr] = useState('');

  function handleNumber(val) {
    onChange({ l3Number: val });
    setNumErr(val && !L3_NUMBER_PATTERN.test(val) ? '格式錯誤，範例：1-1-1' : '');
  }

  return (
    <div className="max-w-lg mx-auto">
      <h2 className="text-xl font-bold text-gray-800 mb-1">L3 活動基本資訊</h2>
      <p className="text-sm text-gray-500 mb-6">輸入此活動的名稱與層級編號</p>
      <div className="flex flex-col gap-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">L3 活動編號 <span className="text-red-500">*</span></label>
          <input type="text" placeholder="例：1-1-1" value={data.l3Number}
            onChange={e => handleNumber(e.target.value)}
            className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 ${numErr ? 'border-red-400' : 'border-gray-300'}`} />
          {numErr && <p className="text-xs text-red-500 mt-1">{numErr}</p>}
          <p className="text-xs text-gray-400 mt-1">三層編碼，例：1-1-1、2-3-4（與 Excel 匯入格式一致）</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">L3 活動名稱 <span className="text-red-500">*</span></label>
          <input type="text" placeholder="例：建立商機報價" value={data.l3Name}
            onChange={e => onChange({ l3Name: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
        </div>
        {data.l3Number && data.l3Name && (
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700">
            預覽：<strong>{data.l3Number}</strong>　{data.l3Name}
            <br /><span className="text-xs opacity-70">L4 任務將從 {data.l3Number}-1 開始編號</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Step 2: Roles (with drag-and-drop) ──────────────────────────
function Step2({ data, onChange }) {
  const { dragIdx, overIdx, rowProps } = useDragReorder(
    data.roles,
    newRoles => onChange({ roles: newRoles })
  );

  function addRole() { onChange({ roles: [...data.roles, makeRole()] }); }
  function removeRole(id) {
    if (data.roles.length <= 1) return;
    onChange({ roles: data.roles.filter(r => r.id !== id) });
  }
  function updateRole(id, field, val) {
    onChange({ roles: data.roles.map(r => r.id === id ? { ...r, [field]: val } : r) });
  }

  return (
    <div className="max-w-xl mx-auto">
      <h2 className="text-xl font-bold text-gray-800 mb-1">泳道角色設定</h2>
      <p className="text-sm text-gray-500 mb-2">設定流程中的參與角色（至少 1 個）</p>
      <p className="text-xs text-gray-400 mb-5 flex items-center gap-1">
        <span className="text-gray-400">⠿</span> 可用滑鼠拖曳左側圓點改變泳道順序（由上到下）
      </p>

      <div className="flex flex-col gap-2">
        {data.roles.map((role, i) => (
          <div
            key={role.id}
            {...rowProps(i)}
            className={`flex items-center gap-3 p-3 bg-gray-50 border rounded-lg transition-all select-none
              ${dragIdx === i ? 'opacity-40 scale-95' : ''}
              ${overIdx === i && dragIdx !== i ? 'border-blue-400 border-t-2' : 'border-gray-200'}`}>
            <DragHandle />
            <span className="text-xs text-gray-400 w-4 flex-shrink-0">#{i + 1}</span>
            <input type="text" placeholder="角色名稱" value={role.name}
              onChange={e => updateRole(role.id, 'name', e.target.value)}
              className="flex-1 px-3 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
            <select value={role.type}
              onChange={e => updateRole(role.id, 'type', e.target.value)}
              className="px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none"
              style={{ background: role.type === 'external' ? '#009900' : '#0066CC', color: 'white' }}>
              <option value="internal">內部角色</option>
              <option value="external">外部角色</option>
            </select>
            <button onClick={() => removeRole(role.id)} disabled={data.roles.length <= 1}
              className="text-red-400 hover:text-red-600 disabled:opacity-20 disabled:cursor-not-allowed text-lg leading-none">✕</button>
          </div>
        ))}
      </div>

      <button onClick={addRole}
        className="mt-4 w-full py-2 text-sm border border-dashed border-blue-400 text-blue-600 rounded-lg hover:bg-blue-50 transition-colors">
        + 新增角色
      </button>

      <div className="mt-4 p-3 bg-gray-50 border border-gray-200 rounded-lg">
        <div className="text-xs font-semibold text-gray-600 mb-2">泳道預覽（由上到下）：</div>
        <div className="flex flex-col gap-1">
          {data.roles.filter(r => r.name).map((r, i) => (
            <div key={r.id} className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-sm" style={{ background: r.type === 'external' ? '#009900' : '#0066CC' }} />
              <span className="text-xs font-medium text-gray-700">泳道 {i + 1}：{r.name}</span>
              <span className="text-xs text-gray-400">（{r.type === 'external' ? '外部' : '內部'}）</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Validation (only L3 info + roles; task editing moved to FlowEditor) ──
function validate(step, data) {
  const errs = [];
  if (step >= 0) {
    if (!data.l3Number.trim()) errs.push('請填寫 L3 活動編號');
    if (!data.l3Name.trim())   errs.push('請填寫 L3 活動名稱');
    if (data.l3Number.trim() && !L3_NUMBER_PATTERN.test(data.l3Number.trim())) {
      errs.push('L3 編號格式錯誤（例：1-1-1）');
    }
  }
  if (step >= 1) {
    const namedRoles = data.roles.filter(r => r.name.trim());
    if (namedRoles.length < 1) errs.push('至少需要 1 個已命名的角色');
  }
  return errs;
}

// ── Main Wizard ──────────────────────────────────────────────────
// 3 steps are shown in the indicator; steps 0–1 are editable inside
// Wizard, step 2 is a visual placeholder pointing at FlowEditor (the
// next screen after "進入編輯流程") so users know editing continues
// beyond the wizard.
const STEPS = ['L3 基本資訊', '泳道角色', '流程編輯'];
const LAST_WIZARD_STEP = 1;

export default function Wizard({ flow, onSave, onCancel }) {
  const [step, setStep]     = useState(0);
  const [data, setData]     = useState(() => initFormData(flow));
  const [errors, setErrors] = useState([]);

  function handleChange(updates) {
    setData(prev => ({ ...prev, ...updates }));
    setErrors([]);
  }

  function handleNext() {
    const errs = validate(step, data);
    if (errs.length) { setErrors(errs); return; }
    setErrors([]);
    setStep(s => s + 1);
  }

  function handleBack() {
    setErrors([]);
    setStep(s => s - 1);
  }

  function handleSave() {
    // Validate all steps before handing off to FlowEditor.
    const errs = [...validate(0, data), ...validate(1, data)];
    if (errs.length) { setErrors(errs); return; }
    // Assign the first named role to seeded tasks so they're immediately
    // usable inside FlowEditor without the user having to re-touch each card.
    const firstRoleId = data.roles.find(r => r.name.trim())?.id ?? data.roles[0]?.id;
    const seededTasks = data.tasks.map(t => t.roleId ? t : { ...t, roleId: firstRoleId });
    onSave({ ...data, tasks: seededTasks });
  }

  return (
    <div className="min-h-screen" style={{ background: '#F5F8FC' }}>
      <header className="px-6 py-3 shadow-md flex items-center gap-4" style={{ background: '#2A5598', color: 'white' }}>
        <button onClick={onCancel} className="opacity-70 hover:opacity-100 text-sm">← 返回</button>
        <span className="text-lg font-bold tracking-wide">
          {flow ? `編輯：${data.l3Number} ${data.l3Name}` : '新增 L3 工作流'}
        </span>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8">
        <StepIndicator current={step} steps={STEPS} />

        {errors.length > 0 && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm font-semibold text-red-700 mb-2">請修正以下問題：</p>
            <ul className="list-disc list-inside space-y-1">
              {errors.map((e, i) => <li key={i} className="text-sm text-red-600">{e}</li>)}
            </ul>
          </div>
        )}

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          {step === 0 && <Step1 data={data} onChange={handleChange} />}
          {step === 1 && <Step2 data={data} onChange={handleChange} />}
        </div>

        <div className="flex justify-between">
          <button onClick={step === 0 ? onCancel : handleBack}
            className="px-5 py-2 rounded-lg border border-gray-300 text-gray-700 text-sm hover:bg-gray-50 transition-colors">
            {step === 0 ? '取消' : '← 上一步'}
          </button>
          {step < LAST_WIZARD_STEP ? (
            <button onClick={handleNext}
              className="px-5 py-2 rounded-lg text-white text-sm font-medium transition-colors"
              style={{ background: '#3470B5' }}
              onMouseEnter={e => e.currentTarget.style.background = '#274F86'}
              onMouseLeave={e => e.currentTarget.style.background = '#3470B5'}>
              下一步 →
            </button>
          ) : (
            <button onClick={handleSave}
              className="px-5 py-2 rounded-lg text-white text-sm font-medium transition-colors"
              style={{ background: '#2A5598' }}
              onMouseEnter={e => e.currentTarget.style.background = '#1E4677'}
              onMouseLeave={e => e.currentTarget.style.background = '#2A5598'}>
              進入編輯流程 →
            </button>
          )}
        </div>
      </main>
    </div>
  );
}

import { useState, useEffect, useMemo } from 'react';
import {
  buildTableL4Map,
  generateFlowAnnotation,
  EXCEL_HEADERS,
} from '../utils/excelExport.js';

// EditCell — buffered textarea. Local state holds the typing in-flight; we
// only patch back to liveFlow on blur to avoid a re-layout per keystroke.
// `value` change from outside re-syncs the buffer.
function EditCell({ value, onChange, placeholder = '', wide = false }) {
  const [local, setLocal] = useState(value || '');
  useEffect(() => { setLocal(value || ''); }, [value]);
  return (
    <td className={`border border-gray-200 px-1 py-0.5 align-top ${wide ? 'min-w-[260px]' : 'min-w-[140px]'}`}>
      <textarea
        value={local}
        onChange={e => setLocal(e.target.value)}
        onBlur={() => { if (local !== (value || '')) onChange(local); }}
        placeholder={placeholder}
        rows={2}
        className="w-full px-1.5 py-1 text-base border border-gray-200 rounded bg-white focus:outline-none focus:ring-1 focus:ring-blue-300 resize-y"
      />
    </td>
  );
}

function ReadCell({ value, muted = false, wide = false }) {
  return (
    <td className={`border border-gray-200 px-2 py-1.5 text-base whitespace-pre-wrap align-top ${wide ? 'min-w-[260px]' : 'max-w-[180px]'} ${muted ? 'bg-gray-50 text-gray-400' : 'bg-gray-50 text-gray-700'}`}>
      {value}
    </td>
  );
}

function RoleCell({ roleId, roles, onChange }) {
  return (
    <td className="border border-gray-200 px-1 py-0.5 align-top min-w-[100px]">
      <select
        value={roleId || ''}
        onChange={e => onChange(e.target.value)}
        className="w-full px-1.5 py-1 text-base border border-gray-200 rounded bg-white focus:outline-none focus:ring-1 focus:ring-blue-300"
      >
        <option value="">（無）</option>
        {roles.filter(r => r.name).map(r => (
          <option key={r.id} value={r.id}>{r.name}</option>
        ))}
      </select>
    </td>
  );
}

export default function FlowTable({ flow, onUpdateTask }) {
  const tasks = flow.tasks || [];
  const l4Map = useMemo(
    () => buildTableL4Map(flow.l3Number, tasks),
    [flow.l3Number, tasks]
  );

  function updateField(taskId, field, value) {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    onUpdateTask(taskId, { ...task, [field]: value });
  }

  return (
    <div className="mt-6">
      <div className="mb-3">
        <h3 className="text-xl font-semibold text-gray-700">
          任務表格 <span className="text-base font-normal text-gray-400">（{tasks.length} 筆）</span>
        </h3>
        <p className="text-base text-gray-400 mt-0.5">
          白色欄位可直接編輯，灰色欄位為唯讀。離開欄位（Tab / 點別處）即同步到上方流程圖與編輯器；按頂部「儲存」一次存全部。
        </p>
      </div>

      <div className="overflow-x-auto border border-gray-200 rounded-lg">
        <table className="border-collapse text-base" style={{ minWidth: '1100px' }}>
          <thead>
            <tr className="align-middle">
              {EXCEL_HEADERS.map((h, i) => (
                <th
                  key={i}
                  className="border border-gray-200 px-2 py-2 text-left font-semibold text-gray-700 align-middle bg-gray-100 sticky top-[56px] z-[5]"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tasks.map(task => {
              const annotation = generateFlowAnnotation(task, tasks, l4Map);
              return (
                <tr key={task.id} className="hover:bg-blue-50 transition-colors">
                  <ReadCell value={flow.l3Number} muted />
                  <ReadCell value={flow.l3Name} muted />
                  <ReadCell value={l4Map[task.id] || ''} />
                  <EditCell wide
                    value={task.name || ''}
                    onChange={v => updateField(task.id, 'name', v)}
                    placeholder="任務名稱"
                  />
                  <EditCell wide
                    value={task.description || ''}
                    onChange={v => updateField(task.id, 'description', v)}
                    placeholder="重點說明"
                  />
                  <EditCell wide
                    value={task.inputItems || ''}
                    onChange={v => updateField(task.id, 'inputItems', v)}
                    placeholder="重要輸入"
                  />
                  <RoleCell
                    roleId={task.roleId}
                    roles={flow.roles || []}
                    onChange={v => updateField(task.id, 'roleId', v)}
                  />
                  <EditCell
                    value={task.outputItems || ''}
                    onChange={v => updateField(task.id, 'outputItems', v)}
                    placeholder="產出成品"
                  />
                  <ReadCell value={annotation} wide />
                  <EditCell
                    value={task.reference || ''}
                    onChange={v => updateField(task.id, 'reference', v)}
                    placeholder="參考文件"
                  />
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

import { useState, useEffect, useMemo } from 'react';
import {
  exportFlowToExcel,
  buildTableL4Map,
  generateFlowAnnotation,
  EXCEL_HEADERS,
} from '../utils/excelExport.js';

// ── Editable cell ────────────────────────────────────────────────────────────
function EditCell({ value, onChange, placeholder = '' }) {
  return (
    <td className="border border-gray-200 px-1 py-0.5 min-w-[120px]">
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-1.5 py-1 text-base border border-gray-200 rounded bg-white focus:outline-none focus:ring-1 focus:ring-blue-300"
      />
    </td>
  );
}

// ── Read-only cell ───────────────────────────────────────────────────────────
function ReadCell({ value, muted = false }) {
  return (
    <td className={`border border-gray-200 px-2 py-1.5 text-base whitespace-pre-wrap max-w-[220px] ${muted ? 'bg-gray-50 text-gray-400' : 'bg-gray-50 text-gray-700'}`}>
      {value}
    </td>
  );
}

// ── Role dropdown cell ───────────────────────────────────────────────────────
function RoleCell({ roleId, roles, onChange }) {
  return (
    <td className="border border-gray-200 px-1 py-0.5 min-w-[100px]">
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

// ── Main component ───────────────────────────────────────────────────────────
export default function FlowTable({ flow, onSave }) {
  const [tasks, setTasks] = useState(flow.tasks || []);
  const [hasChanges, setHasChanges] = useState(false);

  // Sync when flow's identity OR task list changes. Watching only `flow.id`
  // (the original implementation) missed in-place edits — adding a task via
  // the drawer / ContextMenu mutated `flow.tasks` without changing `flow.id`,
  // so this table stayed at its stale snapshot. Watching `flow.tasks`
  // re-syncs whenever the parent's task array reference changes (insert /
  // delete / drag-reorder all produce a new array).
  useEffect(() => {
    setTasks(flow.tasks || []);
    setHasChanges(false);
  }, [flow.id, flow.tasks]);

  const l4Map = useMemo(
    () => buildTableL4Map(flow.l3Number, tasks),
    [flow.l3Number, tasks]
  );

  function updateTask(taskId, field, value) {
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, [field]: value } : t));
    setHasChanges(true);
  }

  function handleSave() {
    if (onSave) {
      onSave({ ...flow, tasks });
      setHasChanges(false);
    }
  }

  function handleDownload() {
    exportFlowToExcel({ ...flow, tasks });
  }

  return (
    <div className="mt-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-xl font-semibold text-gray-700">L4 任務明細表</h3>
          <p className="text-base text-gray-400 mt-0.5">白色欄位可直接編輯，灰色欄位為唯讀（在精靈中修改）</p>
        </div>
        <div className="flex items-center gap-2">
          {hasChanges && (
            <span className="text-base text-amber-600 font-medium">● 有未儲存的變更</span>
          )}
          {onSave && (
            <button
              onClick={handleSave}
              disabled={!hasChanges}
              className="px-4 py-1.5 text-lg rounded transition-colors text-white disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ background: hasChanges ? '#2A5598' : '#9CA3AF' }}
            >
              儲存
            </button>
          )}
          <button
            onClick={handleDownload}
            className="px-4 py-1.5 text-lg rounded text-white transition-colors"
            style={{ background: '#3470B5' }}
            onMouseEnter={e => e.currentTarget.style.background = '#274F86'}
            onMouseLeave={e => e.currentTarget.style.background = '#3470B5'}
          >
            ↓ 下載 Excel
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto border border-gray-200 rounded-lg">
        <table className="border-collapse text-base" style={{ minWidth: '1100px' }}>
          <thead>
            <tr className="bg-gray-100">
              {EXCEL_HEADERS.map((h, i) => (
                <th
                  key={i}
                  className="border border-gray-200 px-2 py-2 text-left font-semibold text-gray-700 whitespace-nowrap"
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
                  {/* L3 活動編號 - read-only */}
                  <ReadCell value={flow.l3Number} muted />
                  {/* L3 活動名稱 - read-only */}
                  <ReadCell value={flow.l3Name} muted />
                  {/* L4 任務編號 - read-only */}
                  <ReadCell value={l4Map[task.id] || ''} />
                  {/* L4 任務名稱 - editable */}
                  <EditCell
                    value={task.name || ''}
                    onChange={v => updateTask(task.id, 'name', v)}
                    placeholder="任務名稱"
                  />
                  {/* 任務重點說明 - editable */}
                  <EditCell
                    value={task.description || ''}
                    onChange={v => updateTask(task.id, 'description', v)}
                    placeholder="重點說明"
                  />
                  {/* 任務重要輸入 - editable */}
                  <EditCell
                    value={task.inputItems || ''}
                    onChange={v => updateTask(task.id, 'inputItems', v)}
                    placeholder="重要輸入"
                  />
                  {/* 任務負責角色 - role dropdown */}
                  <RoleCell
                    roleId={task.roleId}
                    roles={flow.roles || []}
                    onChange={v => updateTask(task.id, 'roleId', v)}
                  />
                  {/* 任務產出成品 - editable */}
                  <EditCell
                    value={task.outputItems || ''}
                    onChange={v => updateTask(task.id, 'outputItems', v)}
                    placeholder="產出成品"
                  />
                  {/* 任務關聯說明 - read-only (auto-generated) */}
                  <ReadCell value={annotation} />
                  {/* 參考資料來源 - editable */}
                  <EditCell
                    value={task.reference || ''}
                    onChange={v => updateTask(task.id, 'reference', v)}
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

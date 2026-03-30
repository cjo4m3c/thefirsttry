const HELP_TEXT = `# 輸入格式說明
title: 流程名稱

lanes:
  - name: 角色名稱1
  - name: 角色名稱2

steps:
  - id: s1
    lane: 角色名稱1
    type: start   # start|end|task|gateway|activity|interaction
    label: 標籤文字

connections:
  - from: s1
    to: s2
    label: "是"   # 可選，箭頭標籤
    dashed: false # 可選，是否為虛線`;

export default function InputPanel({ value, onChange, onGenerate, error }) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-base font-semibold text-gray-700">流程輸入</h2>
        <button className="btn-primary text-sm" onClick={onGenerate}>
          ▶ 產生圖表
        </button>
      </div>

      <textarea
        className="yaml-input"
        value={value}
        onChange={e => onChange(e.target.value)}
        spellCheck={false}
        placeholder={HELP_TEXT}
      />

      {error && (
        <div className="error-box">
          ⚠ {error}
        </div>
      )}

      <details className="mt-2 text-xs text-gray-500">
        <summary className="cursor-pointer hover:text-gray-700 select-none">格式說明</summary>
        <pre className="mt-1 p-2 bg-gray-50 border border-gray-200 rounded text-xs overflow-auto leading-relaxed">
{`type 可用值：
  start       開始事件（空心圓）
  end         結束事件（實心黑圓）
  task        L4 任務（白色矩形）
  gateway     網關（菱形）
  activity    L3 活動（有色框矩形）
  interaction 互動（灰色矩形）

connections 欄位：
  from, to    步驟 id（必填）
  label       箭頭上的文字（選填，如「是」「否」）
  dashed      true 為虛線消息流（選填）`}
        </pre>
      </details>
    </div>
  );
}

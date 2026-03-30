import { useState, useCallback } from 'react';
import InputPanel from './components/InputPanel.jsx';
import DiagramPanel from './components/DiagramPanel.jsx';
import { parseInput } from './utils/parser.js';
import { computeLayout } from './utils/layout.js';
import { DEFAULT_INPUT } from './constants/defaultInput.js';

function buildDiagramData(text) {
  const parsed = parseInput(text);
  const { layoutSteps, svgWidth, svgHeight } = computeLayout(
    parsed.lanes,
    parsed.steps,
    parsed.connections
  );
  return {
    data: { ...parsed, steps: layoutSteps },
    svgWidth,
    svgHeight,
  };
}

export default function App() {
  const [inputText, setInputText] = useState(DEFAULT_INPUT);
  const [diagram, setDiagram] = useState(() => {
    try {
      return { ...buildDiagramData(DEFAULT_INPUT), error: null };
    } catch (e) {
      return { data: null, svgWidth: 800, svgHeight: 400, error: e.message };
    }
  });

  const handleGenerate = useCallback(() => {
    try {
      const result = buildDiagramData(inputText);
      setDiagram({ ...result, error: null });
    } catch (e) {
      setDiagram(prev => ({ ...prev, error: e.message }));
    }
  }, [inputText]);

  // Auto-generate on Ctrl+Enter
  const handleKeyDown = (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      handleGenerate();
    }
  };

  return (
    <div className="flex flex-col h-screen" onKeyDown={handleKeyDown}>
      {/* Top bar */}
      <header
        className="flex items-center px-6 py-3 shadow-md"
        style={{ background: '#4d4d2e', color: 'white' }}
      >
        <span className="text-lg font-bold tracking-wide">流程泳道圖產生器</span>
        <span className="ml-4 text-xs opacity-60">業務流程 L3/L4 泳道圖</span>
        <span className="ml-auto text-xs opacity-50">Ctrl+Enter 快速產生</span>
      </header>

      {/* Split panel */}
      <div className="flex flex-1 overflow-hidden gap-0">
        {/* Left: Input panel */}
        <div
          className="flex flex-col p-4 border-r border-gray-300"
          style={{ width: '40%', minWidth: 300, background: '#fafaf8' }}
        >
          <InputPanel
            value={inputText}
            onChange={setInputText}
            onGenerate={handleGenerate}
            error={diagram.error}
          />
        </div>

        {/* Right: Diagram panel */}
        <div
          className="flex flex-col p-4 flex-1"
          style={{ background: '#f0f0ec' }}
        >
          <DiagramPanel
            data={diagram.data}
            svgWidth={diagram.svgWidth}
            svgHeight={diagram.svgHeight}
          />
        </div>
      </div>
    </div>
  );
}

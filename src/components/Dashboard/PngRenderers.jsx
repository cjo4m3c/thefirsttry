import DiagramRenderer from '../DiagramRenderer.jsx';

// Two off-screen DiagramRenderer instances dedicated to PNG export so the
// main grid never re-renders during a download:
//   - single: triggered by per-card "↓ PNG" button (pendingPngFlow)
//   - queue:  triggered by bulk-download checkbox flow (pngQueue)
// Positioned at -9999/-9999 and pointer-events:none so they're invisible.

const HIDDEN_STYLE = {
  position: 'fixed',
  left: '-9999px',
  top: '-9999px',
  pointerEvents: 'none',
};

export default function PngRenderers({
  pendingPngFlow,
  onSinglePngDone,
  pngQueue,
  onQueueItemDone,
}) {
  return (
    <>
      {pendingPngFlow && (
        <div style={HIDDEN_STYLE}>
          <DiagramRenderer
            flow={pendingPngFlow}
            showExport={false}
            autoExportPng={true}
            onExportDone={onSinglePngDone}
          />
        </div>
      )}

      {pngQueue.length > 0 && (
        <div style={HIDDEN_STYLE}>
          <DiagramRenderer
            key={pngQueue[0].id}
            flow={pngQueue[0]}
            showExport={false}
            autoExportPng={true}
            onExportDone={onQueueItemDone}
          />
        </div>
      )}
    </>
  );
}

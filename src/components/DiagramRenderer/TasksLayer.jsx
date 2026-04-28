import {
  StartShape, EndShape, TaskShape, L3ActivityShape, GatewayShape,
} from './shapes.jsx';

/**
 * Renders the swimlane's task shapes (start / end / task / l3activity / gateway)
 * with hover + click handling. Sits between the connection arrows and the
 * sticky role-header column in the SVG z-order.
 *
 * Hover side-effects (setHoveredId / setTooltip) and click side-effects
 * (onTaskClick) are passed in so this layer remains a pure render.
 */
export function TasksLayer({ tasks, positions, l4Numbers, hoveredId, hoveredConnEndpoints,
  highlightedTaskId, setHoveredId, setTooltip, onTaskClick }) {
  return tasks.map(task => {
    const pos = positions[task.id];
    if (!pos) return null;
    // Diagram label rule: only formal L3/L4 numbers appear on shapes.
    // Hide identifier-only suffixes (`_g*`, `-0`, `-99`).
    // L3 activity (subprocess call) shows the called L3 number instead.
    let num = l4Numbers[task.id];
    if (num && /(_g\d*|-0|-99)$/.test(num)) num = undefined;
    if (task.type === 'l3activity' && task.subprocessName?.trim()) {
      num = task.subprocessName.trim();
    }
    const isHovered = hoveredId === task.id
      || (hoveredConnEndpoints?.has(task.id) ?? false)
      || highlightedTaskId === task.id;
    const props = { pos, l4Number: num, task, isHovered };
    let shape;
    if (task.type === 'start')           shape = <StartShape {...props} />;
    else if (task.type === 'end')        shape = <EndShape {...props} />;
    else if (task.type === 'gateway')    shape = <GatewayShape {...props} />;
    else if (task.type === 'l3activity') shape = <L3ActivityShape {...props} />;
    else                                  shape = <TaskShape {...props} />;
    return (
      <g key={task.id}
        onMouseEnter={(e) => {
          setHoveredId(task.id);
          // Show tooltip only when the task has a description
          // ("任務重點說明") to avoid empty popovers.
          if (task.description?.trim()) {
            const rect = e.currentTarget.getBoundingClientRect();
            setTooltip({
              taskId: task.id,
              // Anchor center-X above the shape (stable, doesn't
              // chase the cursor).
              x: rect.left + rect.width / 2,
              y: rect.top,
            });
          }
        }}
        onMouseLeave={() => {
          setHoveredId(null);
          setTooltip(null);
        }}
        onClick={onTaskClick ? (e) => {
          // Stop propagation so the SVG's clear-selection handler
          // doesn't fire. Pass viewport coordinates so ContextMenu
          // can position itself near the cursor.
          e.stopPropagation();
          onTaskClick(task, e.clientX, e.clientY);
        } : undefined}
        style={{ cursor: 'pointer' }}>
        {shape}
      </g>
    );
  });
}

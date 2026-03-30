import yaml from 'js-yaml';

/**
 * Parse YAML input text into a structured diagram data model.
 * Returns { title, lanes, steps, connections } or throws on error.
 */
export function parseInput(text) {
  const raw = yaml.load(text);

  if (!raw || typeof raw !== 'object') {
    throw new Error('無效的 YAML 格式');
  }

  const title = raw.title || '未命名流程';

  // Parse lanes
  const rawLanes = raw.lanes || [];
  if (!Array.isArray(rawLanes) || rawLanes.length === 0) {
    throw new Error('請至少定義一個泳道 (lanes)');
  }
  const lanes = rawLanes.map((l, i) => ({
    id: `lane_${i}`,
    name: typeof l === 'string' ? l : (l.name || `泳道${i + 1}`),
  }));
  const laneNameToId = Object.fromEntries(lanes.map(l => [l.name, l.id]));

  // Parse steps
  const rawSteps = raw.steps || [];
  if (!Array.isArray(rawSteps) || rawSteps.length === 0) {
    throw new Error('請至少定義一個步驟 (steps)');
  }

  const validTypes = new Set(['start', 'end', 'task', 'gateway', 'activity', 'interaction']);
  const steps = rawSteps.map((s, i) => {
    if (!s.id) throw new Error(`步驟 ${i + 1} 缺少 id`);
    if (!s.lane) throw new Error(`步驟 ${s.id} 缺少 lane`);
    if (!laneNameToId[s.lane]) throw new Error(`步驟 ${s.id} 的 lane "${s.lane}" 不存在`);
    const type = s.type || 'task';
    if (!validTypes.has(type)) throw new Error(`步驟 ${s.id} 的 type "${type}" 無效`);
    return {
      id: String(s.id),
      laneId: laneNameToId[s.lane],
      laneName: s.lane,
      type,
      label: s.label || '',
    };
  });

  const stepIds = new Set(steps.map(s => s.id));

  // Parse connections
  const rawConns = raw.connections || [];
  const connections = rawConns.map((c, i) => {
    if (!c.from) throw new Error(`連接 ${i + 1} 缺少 from`);
    if (!c.to) throw new Error(`連接 ${i + 1} 缺少 to`);
    const from = String(c.from);
    const to = String(c.to);
    if (!stepIds.has(from)) throw new Error(`連接 ${i + 1}: 步驟 "${from}" 不存在`);
    if (!stepIds.has(to)) throw new Error(`連接 ${i + 1}: 步驟 "${to}" 不存在`);
    return {
      from,
      to,
      label: c.label || '',
      dashed: c.dashed || false,
    };
  });

  return { title, lanes, steps, connections };
}

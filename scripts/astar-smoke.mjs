/**
 * astar-smoke.mjs — A* path 形狀 regression smoke checks (v1.19 P1)。
 *
 * 用法：node --experimental-vm-modules scripts/astar-smoke.mjs
 *
 * 把使用者報過的視覺問題 case 寫成 fixtures。每個 fixture 定義：
 *   - flow: 流程資料
 *   - expected: assertions on path shape (turns count / max collinear / lane size 等)
 *
 * 改 A* dim / 參數前後都跑一次，看哪些 case 退化。
 * 對齊 spec §10.5 「越改越好不退步」永續性原則。
 */

import { computeLayout } from '../src/diagram/layout-astar.js';

// ============ Helpers ============

function countTurns(bendPts) {
  if (!bendPts || bendPts.length < 3) return 0;
  let turns = 0;
  for (let i = 1; i < bendPts.length - 1; i++) {
    const [x1, y1] = bendPts[i - 1];
    const [x2, y2] = bendPts[i];
    const [x3, y3] = bendPts[i + 1];
    const dx1 = Math.sign(x2 - x1), dy1 = Math.sign(y2 - y1);
    const dx2 = Math.sign(x3 - x2), dy2 = Math.sign(y3 - y2);
    if (dx1 !== dx2 || dy1 !== dy2) turns++;
  }
  return turns;
}

function maxCollinearRun(bendPts) {
  if (!bendPts || bendPts.length < 2) return 0;
  let max = 0;
  for (let i = 0; i < bendPts.length - 1; i++) {
    const [x1, y1] = bendPts[i];
    const [x2, y2] = bendPts[i + 1];
    max = Math.max(max, Math.abs(x2 - x1) + Math.abs(y2 - y1));
  }
  return max;
}

function findConn(layout, fromId, toId) {
  return layout.connections.find(c => c.fromId === fromId && c.toId === toId);
}

// ============ Fixtures ============

const fixtures = [
  {
    name: 'single-edge-cross-lane-direct',
    desc: '情境 3 (5-7-2 子流程 → 左上閘道) 單一 edge 跨 lane 直走，期待 ≤ 3 turns',
    flow: {
      l3Number: 'test-1',
      roles: [{ id: 'A' }, { id: 'B' }],
      tasks: [
        { id: 'src', type: 'task', roleId: 'B', nextTaskIds: ['gw'] },
        { id: 'gw',  type: 'gateway', roleId: 'A', conditions: [
          { id: 'c1', nextTaskId: 'end' },
        ]},
        { id: 'end', type: 'end', roleId: 'A' },
      ],
    },
    assertions: [
      (layout) => {
        const c = findConn(layout, 'src', 'gw');
        const turns = countTurns(c?._bendPoints);
        return { ok: turns <= 3, msg: `src→gw turns=${turns} (≤3 expected)` };
      },
    ],
  },
  {
    name: 'multi-fork-trunk-not-zigzag',
    desc: '情境 1 (5-7-2 多 fork) 各 edge 中段不該超過 3 turns',
    flow: {
      l3Number: 'test-2',
      roles: [{ id: 'A' }],
      tasks: [
        { id: 'gw', type: 'gateway', roleId: 'A', conditions: [
          { id: 'c1', nextTaskId: 't1' },
          { id: 'c2', nextTaskId: 't2' },
          { id: 'c3', nextTaskId: 't3' },
        ]},
        { id: 't1', type: 'task', roleId: 'A', nextTaskIds: ['end'] },
        { id: 't2', type: 'task', roleId: 'A', nextTaskIds: ['end'] },
        { id: 't3', type: 'task', roleId: 'A', nextTaskIds: ['end'] },
        { id: 'end', type: 'end', roleId: 'A' },
      ],
    },
    assertions: [
      (layout) => {
        const results = ['t1', 't2', 't3'].map(t => {
          const c = findConn(layout, 'gw', t);
          return { t, turns: countTurns(c?._bendPoints) };
        });
        const maxTurns = Math.max(...results.map(r => r.turns));
        return {
          ok: maxTurns <= 3,
          msg: `multi-fork max turns=${maxTurns} (≤3 expected): ${JSON.stringify(results)}`,
        };
      },
    ],
  },
  {
    name: 'pure-direct-lane-keeps-base-height',
    desc: '純直連 lane (no fork/backward) 應維持 144px 不擴張',
    flow: {
      l3Number: 'test-3',
      roles: [{ id: 'A' }, { id: 'B' }],
      tasks: [
        { id: 't1', type: 'task', roleId: 'A', nextTaskIds: ['t2'] },
        { id: 't2', type: 'task', roleId: 'A', nextTaskIds: ['t3'] },
        { id: 't3', type: 'task', roleId: 'B', nextTaskIds: ['end'] },
        { id: 'end', type: 'end', roleId: 'B' },
      ],
    },
    assertions: [
      (layout) => {
        const h0 = layout.laneHeights[0];
        return {
          ok: h0 === 144,
          msg: `lane 0 height=${h0} (144 expected, 純直連)`,
        };
      },
    ],
  },
  {
    name: 'boundary-lane-fork-expanded',
    desc: 'Lane 0 (boundary) 4-fork 應擴張到較大 (M5: multiplier=3)',
    flow: {
      l3Number: 'test-4',
      roles: [{ id: 'A' }, { id: 'B' }],
      tasks: [
        { id: 'gw', type: 'gateway', roleId: 'A', conditions: [
          { id: 'c1', nextTaskId: 't1' },
          { id: 'c2', nextTaskId: 't2' },
          { id: 'c3', nextTaskId: 't3' },
          { id: 'c4', nextTaskId: 't4' },
        ]},
        { id: 't1', type: 'task', roleId: 'A', nextTaskIds: ['end'] },
        { id: 't2', type: 'task', roleId: 'A', nextTaskIds: ['end'] },
        { id: 't3', type: 'task', roleId: 'A', nextTaskIds: ['end'] },
        { id: 't4', type: 'task', roleId: 'A', nextTaskIds: ['end'] },
        { id: 'end', type: 'end', roleId: 'B' },
      ],
    },
    assertions: [
      (layout) => {
        const h0 = layout.laneHeights[0];
        return {
          ok: h0 >= 192 && h0 <= 240,
          msg: `lane 0 height=${h0} (192-240 expected for 4-fork boundary)`,
        };
      },
      (layout) => {
        const aligned = layout.laneHeights.every(h => h % 16 === 0);
        return {
          ok: aligned,
          msg: `lanes 全 grid-aligned (16 倍數): ${JSON.stringify(layout.laneHeights)}`,
        };
      },
    ],
  },
  {
    name: 'sameRow-gap-forward-stub-not-collapsed',
    desc: '情境 2 (5-1-2 sameRow gap forward) stub 進 port 至少 3 cells',
    flow: {
      l3Number: 'test-5',
      roles: [{ id: 'A' }],
      tasks: [
        { id: 's', type: 'task', roleId: 'A', nextTaskIds: ['gap'] },
        { id: 'm1', type: 'task', roleId: 'A', nextTaskIds: ['end'] },
        { id: 'm2', type: 'task', roleId: 'A', nextTaskIds: ['end'] },
        { id: 'gap', type: 'task', roleId: 'A', nextTaskIds: ['end'] },
        { id: 'end', type: 'end', roleId: 'A' },
      ],
    },
    assertions: [
      (layout) => {
        const c = findConn(layout, 's', 'gap');
        const turns = countTurns(c?._bendPoints);
        return {
          ok: turns >= 0 && turns <= 4,
          msg: `s→gap turns=${turns} (sameRow gap, ≤4 reasonable)`,
        };
      },
    ],
  },
];

// ============ Run ============

console.log('A* path 形狀 regression smoke (v1.19 P1)\n');

let passed = 0;
let failed = 0;
for (const f of fixtures) {
  console.log(`\n# ${f.name}`);
  console.log(`  ${f.desc}`);
  let layout;
  try {
    layout = computeLayout(f.flow);
  } catch (e) {
    console.log(`  ❌ layout 失敗: ${e.message}`);
    failed++;
    continue;
  }
  let allOk = true;
  for (const assertFn of f.assertions) {
    const { ok, msg } = assertFn(layout);
    console.log(`  ${ok ? '✓' : '❌'} ${msg}`);
    if (!ok) allOk = false;
  }
  if (allOk) passed++; else failed++;
}

console.log(`\n${'='.repeat(50)}`);
console.log(`Passed: ${passed} / ${fixtures.length}, Failed: ${failed}`);
process.exit(failed > 0 ? 1 : 0);

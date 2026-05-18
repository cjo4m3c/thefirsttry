/**
 * Unit tests for autoSpace (中英混排自動間距).
 *
 * Uses Node 18+ built-in `node:test` — runs without installing any dev deps.
 *
 * 跑法：
 *   node --test src/utils/autoSpace.test.js
 *
 * 預期輸出：
 *   ✔ subtest 名稱 (… ms)
 *   ✔ ...
 *   tests N | pass N | fail 0
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { autoSpace } from './autoSpace.js';

test('純中文不動', () => {
  assert.equal(autoSpace('確認客戶需求'), '確認客戶需求');
  assert.equal(autoSpace('報名繳費流程'), '報名繳費流程');
});

test('純英文不動', () => {
  assert.equal(autoSpace('Push to GitHub'), 'Push to GitHub');
  assert.equal(autoSpace('iPhone APP'), 'iPhone APP');
  assert.equal(autoSpace('React and Vue'), 'React and Vue');
});

test('中→英自動加空格', () => {
  assert.equal(autoSpace('確認需求GitHub'), '確認需求 GitHub');
  assert.equal(autoSpace('系統A'), '系統 A');
  assert.equal(autoSpace('版本2'), '版本 2');
});

test('英→中自動加空格', () => {
  assert.equal(autoSpace('GitHub整合'), 'GitHub 整合');
  assert.equal(autoSpace('Apush推播'), 'Apush 推播');
  assert.equal(autoSpace('5分鐘'), '5 分鐘');
});

test('已有空格不重複插入', () => {
  assert.equal(autoSpace('確認 GitHub 整合'), '確認 GitHub 整合');
  assert.equal(autoSpace('版本 2 釋出'), '版本 2 釋出');
});

test('中+英數+中（連續 sandwich）', () => {
  assert.equal(autoSpace('確認3M需求'), '確認 3M 需求');
  assert.equal(autoSpace('用iPhone拍照'), '用 iPhone 拍照');
});

test('混合多段', () => {
  assert.equal(
    autoSpace('每天Push code到GitHub完成PR審核'),
    '每天 Push code 到 GitHub 完成 PR 審核'
  );
});

test('L4 編號不動（純 ASCII / 包含 - / _）', () => {
  assert.equal(autoSpace('1-1-1-1'), '1-1-1-1');
  assert.equal(autoSpace('1-1-1-1_g'), '1-1-1-1_g');
  assert.equal(autoSpace('5-1-1-2_s1'), '5-1-1-2_s1');
  assert.equal(autoSpace('-99_x1'), '-99_x1');
});

test('flowAnnotation 結構字串（已有空格）不動', () => {
  assert.equal(autoSpace('序列流向 5-1-1-2'), '序列流向 5-1-1-2');
  assert.equal(autoSpace('條件分支至 1-1-3、1-1-4'), '條件分支至 1-1-3、1-1-4');
  assert.equal(autoSpace('調用子流程 5-2-8'), '調用子流程 5-2-8');
});

test('Bracket prefix（]` 不算英數、不觸發）', () => {
  // `]` 跟 `[` 都是 ASCII 標點、不在 [A-Za-z0-9] 內、不會跟 CJK 插空格
  assert.equal(autoSpace('[排他閘道]確認'), '[排他閘道]確認');
  assert.equal(autoSpace('[外部角色]客戶'), '[外部角色]客戶');
});

test('Bracket + 英數 + 中文（`]` 不算英數、不觸發）', () => {
  // 設計選擇：`]` 不在 [A-Za-z0-9] 範圍 → `]` + 中文不插空格、`2` + `]`
  // 也不插。結果視覺上 `[v2]新版` 看起來緊湊、但安全（不會誤動結構性
  // bracket prefix 如 [排他閘道] 開頭的標籤）。實務上 FlowSprite 的
  // bracket prefix 後通常會接空格（如「[排他閘道] 確認需求」），業務
  // 影響極小。
  assert.equal(autoSpace('[v2]新版'), '[v2]新版');
});

test('Mixed L4 ref in sentence（已是 raw、不破壞）', () => {
  // 使用者可能在 task description 寫「請參考 1-1-1 的設定 然後 push to GitHub」
  const input = '請參考 1-1-1 的設定後 push to GitHub';
  assert.equal(autoSpace(input), '請參考 1-1-1 的設定後 push to GitHub');
});

test('Edge cases：falsy / 非 string', () => {
  assert.equal(autoSpace(null), null);
  assert.equal(autoSpace(undefined), undefined);
  assert.equal(autoSpace(''), '');
  assert.equal(autoSpace(0), 0);
  assert.equal(autoSpace(false), false);
  // 非 string 原樣回傳（caller 自負）
  const obj = { foo: 'bar' };
  assert.equal(autoSpace(obj), obj);
});

test('Idempotency：跑兩次結果一樣', () => {
  const inputs = [
    '確認需求GitHub',
    'Push to GitHub完成',
    '用iPhone拍照',
    '確認 GitHub 整合',
    '純中文',
    'Pure English',
  ];
  for (const input of inputs) {
    const once = autoSpace(input);
    const twice = autoSpace(once);
    assert.equal(twice, once, `Idempotency 失敗：${input}`);
  }
});

// 连续墨迹与攻击路径回归：胶囊笔刷、双方弹道、闪电与固定容量
const src = require('fs').readFileSync(__dirname + '/enemy-config.js', 'utf8') + '\n' + require('fs').readFileSync(__dirname + '/main.js', 'utf8').replace("'use strict';", '');
const fakeCtx = new Proxy({}, { get(t, k) { if (k === 'measureText') return () => ({ width: 10 }); return () => {}; }, set() { return true; } });
const fakeCanvas = { getContext: () => fakeCtx, width: 0, height: 0, style: {}, addEventListener() {}, getBoundingClientRect: () => ({ left: 0, top: 0, width: 375, height: 667 }) };
global.window = { addEventListener() {}, devicePixelRatio: 1, innerWidth: 375, innerHeight: 667 };
global.document = { getElementById: () => fakeCanvas }; global.requestAnimationFrame = () => {};
eval(src + `
;globalThis.G = {
  resetGame, addInkStroke, fireBullet, update, render, updateInkStains, inkCellAt, inkCircleHas, inkStats,
  get bullets() { return bullets; }, get ebullets() { return ebullets; }, get lightnings() { return lightnings; },
  get erupts() { return erupts; }, get blades() { return blades; }, get player() { return player; }, set state(v) { state = v; }
};`);
let failed = 0;
function test(name, fn) { try { fn(); console.log('OK  ' + name); } catch (e) { failed++; console.log('ERR ' + name + ': ' + e.message); } }
function assert(ok, msg) { if (!ok) throw new Error(msg); }
function fresh() { G.resetGame(); G.state = 'play'; G.player.xpNext = 999; G.player.hp = G.player.maxhp = 9999; }
function assertPath(x1, x2, y, owner, msg) { for (let x = x1; x <= x2; x += 4) assert(G.inkCellAt(x, y).owner === owner, msg + '，断点 x=' + x); }

test('长笔触一次铺满整条线段，不是孤立圆点', () => {
  fresh(); G.addInkStroke(-45, 0, 45, 0, '#e67e22', false); assertPath(-40, 40, 0, 1, '长笔触不连续'); G.render();
});
test('角色子弹飞行当帧留下连续路径，不直接返还墨水', () => {
  fresh(); G.player.ink = 50; G.fireBullet(-100, 0, 0, 400, 1, 'nib', { life: 1, col: '#e67e22', hits: 99 }); G.update(0.2);
  assertPath(-90, -20, 0, 1, '子弹路径不连续'); assert(G.player.ink < 51, '攻击路径错误返墨');
});
test('敌方墨弹飞行留下连续灰色路径', () => {
  fresh(); G.player.x = 300; G.player.y = 300; G.ebullets.push({ x: -100, y: 0, vx: 400, vy: 0, dmg: 1, life: 1 }); G.update(0.2);
  assertPath(-90, -20, 0, 2, '敌方弹道路径不连续');
});
test('电弧和冲刺类闪电路径连续铺墨', () => {
  fresh(); G.lightnings.push({ x1: -60, y1: 0, x2: 60, y2: 0, t: 0.3, delay: 0, prog: 1, c: { col: '#5b5bd6' } }); G.update(0.02);
  assertPath(-55, 55, 0, 1, '闪电路径不连续');
});
test('地面爆发与环绕刀阵都会在攻击位置铺墨', () => {
  fresh(); G.erupts.push({ x: 20, y: 0, delay: 0, dmg: 0, r: 20, c: { col: '#e67e22' }, done: false, t: 0 });
  G.blades.push({ x: 0, y: 0, ang: 0, t: 1, dmg: 0, c: { col: '#6b6b6b' }, rad: 1 }); G.update(0.02);
  assert(G.inkCellAt(20, 0).owner === 1, '地面爆发没有铺墨'); const bl = G.blades[0];
  assert(G.inkCellAt(bl.x, bl.y).owner === 1, '刀阵路径没有铺墨');
});
test('攻击路径持久保留并积攒墨潮，但不改变普通墨水', () => {
  fresh(); G.player.ink = 50; G.addInkStroke(0, 0, 80, 0, '#7ec8e3', false); const before = G.inkStats().friendly;
  G.updateInkStains(20); assert(G.inkStats().friendly === before, '历史轨迹被时间或数量回收');
  assert(G.player.special > 0 && G.player.ink === 50, '墨潮充能或普通墨水错误');
});
test('超过旧 260 点上限后，最早与最新轨迹仍然共存', () => {
  fresh(); for (let y = -600; y <= 600; y += 80) for (let x = -420; x <= 420; x += 60) G.addInkStroke(x, y, x + 12, y, '#1a2b8f', false);
  assert(G.inkCellAt(-414, -600).owner === 1 && G.inkCellAt(432, 600).owner === 1, '旧轨迹被数量上限删除');
  assert(G.inkStats().friendly > 260 && G.inkStats().capacity > 0, '网格没有使用固定容量');
});
console.log(failed ? 'INK_PATH_TEST_FAILURES: ' + failed : 'INK_PATH_TEST_OK (7/7)');
process.exit(failed ? 1 : 0);

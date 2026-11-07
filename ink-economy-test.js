// 墨水资源回归：夺地返墨、截墨返墨、排除项与单次上限
const src = require('fs').readFileSync(__dirname + '/enemy-config.js', 'utf8') + '\n' + require('fs').readFileSync(__dirname + '/main.js', 'utf8').replace("'use strict';", '');
const fakeCtx = new Proxy({}, { get(t, k) { if (k === 'measureText') return () => ({ width: 10 }); return () => {}; }, set() { return true; } });
const fakeCanvas = { getContext: () => fakeCtx, width: 0, height: 0, style: {}, addEventListener() {}, getBoundingClientRect: () => ({ left: 0, top: 0, width: 375, height: 667 }) };
global.window = { addEventListener() {}, devicePixelRatio: 1, innerWidth: 375, innerHeight: 667 };
global.document = { getElementById: () => fakeCanvas }; global.requestAnimationFrame = () => {};
eval(src + `
;globalThis.G = {
  resetGame, addInkStain, addHostileInk, addInkStroke, addLinkedTrail, updateInkTactics,
  spawnEnemy, render,
  get player() { return player; }, get floats() { return floats; }, get enemies() { return enemies; },
  set time(v) { gameTime = v; }, set state(v) { state = v; },
  set ink(v) { player.ink = v; }, set surge(v) { inkSurgePainting = v; }
};`);
let failed = 0;
function test(name, fn) { try { fn(); console.log('OK  ' + name); } catch (e) { failed++; console.log('ERR ' + name + ': ' + e.message); } }
function assert(ok, msg) { if (!ok) throw new Error(msg); }
function near(a, b) { return Math.abs(a - b) < 1e-8; }
function fresh() { G.resetGame(); G.state = 'play'; G.time = 0; G.ink = 50; }
function cutLine(e, length) {
  G.addLinkedTrail(e, length, 0, '#70645e', true, 12, 1.5, 12, 'trailX', 'trailY', 'trailS');
  G.addInkStroke(80, -20, 80, 20, '#1a2b8f', false); G.updateInkTactics();
}

test('非轨迹夺地按覆盖面积返墨，大片夺地单次封顶 4', () => {
  fresh(); G.addHostileInk(0, 0, 30, 8, 101); G.addInkStain(0, 0, 30, 8, '#1a2b8f', false, false);
  const smallGain = G.player.ink - 50;
  assert(smallGain > 0 && smallGain < 4, '小片夺地没有按面积返墨：' + smallGain);
  assert(!G.floats.some(f => f.txt.startsWith('夺地 +')), '夺地返墨仍显示具体数字跳字');
  fresh(); G.addHostileInk(0, 0, 30, 60, 102); G.addInkStain(0, 0, 30, 60, '#1a2b8f', false, false);
  assert(near(G.player.ink, 54), '大片夺地未封顶 4：' + (G.player.ink - 50));
  G.ink = 99.9; G.addHostileInk(100, 0, 30, 8, 103); G.addInkStain(100, 0, 30, 8, '#1a2b8f', false, false);
  assert(G.player.ink <= 100 && near(G.player.ink, 100), '返墨超过最大墨水或满墨限制失效');
});

test('空白涂地、同色重复与移动／弹道路径均不返墨', () => {
  fresh(); G.addInkStain(0, 0, 30, 12, '#1a2b8f', false, false);
  assert(near(G.player.ink, 50), '空白涂地错误返墨');
  G.addInkStain(0, 0, 30, 12, '#1a2b8f', false, false);
  assert(near(G.player.ink, 50), '重复涂彩墨错误返墨');
  G.addHostileInk(0, 0, 30, 12, 104); G.addInkStroke(-20, 0, 20, 0, '#1a2b8f', false);
  assert(near(G.player.ink, 50), '轨迹覆盖灰墨错误返墨');
});

test('墨潮覆盖灰墨不返墨', () => {
  fresh(); G.addHostileInk(0, 0, 30, 30, 105); G.surge = true;
  G.addInkStain(0, 0, 28, 30, '#1a2b8f', false, false); G.surge = false;
  assert(near(G.player.ink, 50), '墨潮覆盖灰墨错误返墨');
  assert(!G.floats.some(f => f.txt.startsWith('夺地 +')), '墨潮产生了夺地返墨跳字');
});

test('失源截墨成功返墨，大面积转化单次封顶 12', () => {
  fresh(); G.spawnEnemy('stick', 0, 0); const e = G.enemies[0]; cutLine(e, 600);
  G.time = 1.01; G.updateInkTactics();
  assert(near(G.player.ink, 62), '截墨没有返墨或未封顶 12：' + (G.player.ink - 50));
  assert(!G.floats.some(f => f.txt.startsWith('截墨 +')), '截墨返墨仍显示具体数字跳字');
  fresh(); G.spawnEnemy('stick', 0, 0); const full = G.enemies[0]; G.ink = 100; cutLine(full, 160);
  G.time = 1.01; G.updateInkTactics();
  assert(near(G.player.ink, 100) && G.floats.some(f => f.txt === '截墨！'), '满墨截墨未保留原反馈');
});

test('来源怪物重新续墨不返墨', () => {
  fresh(); G.spawnEnemy('stick', 0, 0); const e = G.enemies[0]; cutLine(e, 160);
  G.addInkStroke(0, 0, 160, 0, '#70645e', true, e.id); G.updateInkTactics();
  G.time = 1.2; G.updateInkTactics();
  assert(near(G.player.ink, 50), '重新续墨错误触发截墨返墨');
  assert(!G.floats.some(f => f.txt.startsWith('截墨 +')), '续墨产生了截墨返墨跳字');
});
console.log(failed ? 'INK_ECONOMY_TEST_FAILURES: ' + failed : 'INK_ECONOMY_TEST_OK (5/5)');
process.exit(failed ? 1 : 0);

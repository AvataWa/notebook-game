// 墨迹对抗回归：截墨、续墨、失源转化与夺地失衡
const src = require('fs').readFileSync(__dirname + '/enemy-config.js', 'utf8') + '\n' + require('fs').readFileSync(__dirname + '/main.js', 'utf8').replace("'use strict';", '');
const fakeCtx = new Proxy({}, { get(t, k) { if (k === 'measureText') return () => ({ width: 10 }); return () => {}; }, set() { return true; } });
const fakeCanvas = { getContext: () => fakeCtx, width: 0, height: 0, style: {}, addEventListener() {}, getBoundingClientRect: () => ({ left: 0, top: 0, width: 375, height: 667 }) };
global.window = { addEventListener() {}, devicePixelRatio: 1, innerWidth: 375, innerHeight: 667 };
global.document = { getElementById: () => fakeCanvas }; global.requestAnimationFrame = () => {};
eval(src + `
;globalThis.G = {
  resetGame, addInkStain, addHostileInk, addInkStroke, addLinkedTrail, updateInkTactics, inkCellAt,
  spawnEnemy, spawnBoss, killEnemy, render,
  get enemies() { return enemies; }, get inkOrphanCells() { return inkOrphanCells; },
  set time(v) { gameTime = v; }, set state(v) { state = v; }
};`);
let failed = 0;
function test(name, fn) { try { fn(); console.log('OK  ' + name); } catch (e) { failed++; console.log('ERR ' + name + ': ' + e.message); } }
function assert(ok, msg) { if (!ok) throw new Error(msg); }
function near(a, b) { return Math.abs(a - b) < 1e-8; }
function fresh() { G.resetGame(); G.state = 'play'; G.time = 0; }
function cutLine(e) {
  G.addLinkedTrail(e, 160, 0, '#70645e', true, 12, 1.5, 12, 'trailX', 'trailY', 'trailS');
  G.addInkStroke(80, -20, 80, 20, '#1a2b8f', false); G.updateInkTactics();
}

test('夺地会打断普通怪，独立冷却内不会重复触发', () => {
  fresh(); G.spawnEnemy('stick', 0, 0); const e = G.enemies[0];
  G.addHostileInk(0, 0, 8, 30, e.id); G.addInkStain(0, 0, 5, 30, '#1a2b8f');
  assert(near(e.stunT, 0.4) && near(e.groundStealCd, 1.2), '普通怪夺地时长或冷却错误');
  e.stunT = 0; G.addHostileInk(0, 0, 8, 30, e.id); G.addInkStain(0, 0, 5, 30, '#1a2b8f');
  assert(!e.stunT, '冷却内再次夺地仍触发');
  G.time = 1.3; G.addHostileInk(0, 0, 8, 30, e.id); G.addInkStain(0, 0, 5, 30, '#1a2b8f');
  assert(near(e.stunT, 0.4), '冷却结束后无法再次夺地');
});
test('Boss 仅短暂延迟，且使用更长独立冷却', () => {
  fresh(); G.spawnBoss(1); const e = G.enemies.find(x => x.boss); e.x = e.y = 0;
  G.addHostileInk(0, 0, 8, 45, e.id); G.addInkStain(0, 0, 5, 45, '#1a2b8f');
  assert(near(e.stunT, 0.12) && near(e.groundStealCd, 2), 'Boss 夺地时长或冷却错误');
});
test('重复涂已有彩墨不会误判为夺地', () => {
  fresh(); G.spawnEnemy('stick', 0, 0); const e = G.enemies[0];
  G.addInkStain(0, 0, 5, 30, '#1a2b8f'); G.addInkStain(0, 0, 5, 30, '#1a2b8f');
  assert(!e.stunT, '彩墨重复覆盖触发了夺地');
});
test('截墨只令断开尾段失源，一秒后转成彩墨', () => {
  fresh(); G.spawnEnemy('stick', 0, 0); const e = G.enemies[0]; cutLine(e);
  assert(G.inkCellAt(40, 0).owner === 2 && !G.inkCellAt(40, 0).orphan, '仍连接怪物的头部被误判失源');
  assert(G.inkCellAt(120, 0).owner === 2 && G.inkCellAt(120, 0).orphan, '断开尾段没有进入失源');
  G.time = 0.8; G.updateInkTactics(); assert(G.inkCellAt(120, 0).owner === 2, '失源不到一秒就转化');
  G.time = 1.01; G.updateInkTactics();
  assert(G.inkCellAt(120, 0).owner === 1 && !G.inkCellAt(120, 0).orphan, '失源尾段没有按时转化');
  assert(G.inkCellAt(40, 0).owner === 2, '截墨错误转化了仍连接的头部');
});
test('来源怪物重新续墨会取消失源倒计时', () => {
  fresh(); G.spawnEnemy('stick', 0, 0); const e = G.enemies[0]; cutLine(e);
  assert(G.inkCellAt(120, 0).orphan, '测试前置没有形成失源');
  G.addInkStroke(0, 0, 160, 0, '#70645e', true, e.id); G.updateInkTactics();
  assert(!G.inkCellAt(120, 0).orphan, '续墨后仍保留失源状态');
  G.time = 1.2; G.updateInkTactics(); assert(G.inkCellAt(120, 0).owner === 2, '已续墨的尾段仍被转化');
});
test('击杀转化会清理失源队列，不会留下延迟变色斑块', () => {
  fresh(); G.spawnEnemy('stick', 0, 0); const e = G.enemies[0]; cutLine(e);
  assert(G.inkOrphanCells.size > 0, '测试前置没有失源网格'); G.killEnemy(e);
  assert(G.inkOrphanCells.size === 0 && G.inkCellAt(120, 0).owner === 1, '击杀没有清理并转化失源');
  G.time = 2; G.updateInkTactics(); G.render();
  assert(G.inkOrphanCells.size === 0 && G.inkCellAt(120, 0).owner === 1, '死亡后出现残留失源状态');
});
console.log(failed ? 'INK_TACTICS_TEST_FAILURES: ' + failed : 'INK_TACTICS_TEST_OK (6/6)');
process.exit(failed ? 1 : 0);

// 墨水资源回归：技能扣费、领地回复、吸墨怪、击杀爆墨与完整墨潮
const src = require('fs').readFileSync(__dirname + '/enemy-config.js', 'utf8') + '\n' + require('fs').readFileSync(__dirname + '/main.js', 'utf8').replace("'use strict';", '');
const fakeCtx = new Proxy({}, { get(t, k) { if (k === 'measureText') return () => ({ width: 10 }); return () => {}; }, set() { return true; } });
const fakeCanvas = { getContext: () => fakeCtx, width: 0, height: 0, style: {}, addEventListener() {}, getBoundingClientRect: () => ({ left: 0, top: 0, width: 375, height: 667 }) };
global.window = { addEventListener() {}, devicePixelRatio: 1, innerWidth: 375, innerHeight: 667 };
global.document = { getElementById: () => fakeCanvas }; global.requestAnimationFrame = () => {};
eval(src + `
;globalThis.G = {
  resetGame, updateSkills, updateInkEater, updatePlayerInk, toggleDive, castInkSurge, inkCellAt, inkStats,
  startInkSurgeCharge, updateInkSurgeCharge, releaseInkSurgeCharge, cancelInkSurgeCharge, inkSurgeChargeRadius,
  killEnemy, spawnEnemy, addInkStain, spendSkillInk, render,
  get player() { return player; }, get enemies() { return enemies; }, get novas() { return novas; }, set state(v) { state = v; }
};`);
let failed = 0;
function test(name, fn) { try { fn(); console.log('OK  ' + name); } catch (e) { failed++; console.log('ERR ' + name + ': ' + e.message); } }
function assert(ok, msg) { if (!ok) throw new Error(msg); }
function near(a, b) { return Math.abs(a - b) < 1e-8; }
function fresh() { G.resetGame(); G.state = 'play'; G.player.xpNext = 999; G.player.hp = G.player.maxhp = 9999; }
function active(id) { G.player.actives = [{ id: id || 'cyclone', lvl: 1, supports: [], t: 0, uc: 0 }]; }

test('技能施放扣墨并生成对应网格墨痕', () => {
  fresh(); active(); G.player.ink = 100; G.updateSkills(1 / 60);
  assert(G.player.ink === 99 && G.inkCellAt(0, 0).amount === 1, '扣墨或墨痕浓度错误');
});
test('墨水不足暂停施放，不变负也不生成复制体', () => {
  fresh(); active('tornado'); G.player.ink = 0; G.updateSkills(1 / 60);
  assert(G.player.ink === 0 && G.inkStats().friendly === 0, '缺墨仍施放'); assert(G.player.actives[0].t === 0.2, '缺墨没有进入重试');
  assert(!G.enemies.some(e => e.shade), '已删除的透支复制体仍出现'); assert(G.spendSkillInk(G.player.actives[0], 20) === false, '允许透支');
});
test('己方墨迹潜墨每秒耗墨 12，并停止所有主动技能', () => {
  fresh(); active(); G.addInkStain(0, 0, 10, 45, '#1a2b8f'); G.player.ink = 30; assert(G.toggleDive(), '无法潜墨');
  const cells = G.inkStats().friendly; G.updatePlayerInk(1); G.updateSkills(1);
  assert(near(G.player.ink, 18), '己方墨迹潜墨消耗错误'); assert(G.inkStats().friendly === cells && G.player.actives[0].t === 0, '潜墨仍施放技能');
});
test('非己方墨迹可开启潜墨，每秒耗墨 36，耗尽后自动退出', () => {
  fresh(); G.player.ink = 40; assert(G.toggleDive() && G.player.diving, '空白区域无法开启潜墨');
  G.updatePlayerInk(1); assert(near(G.player.ink, 4) && G.player.diving, '非己方墨迹消耗错误');
  G.updatePlayerInk(0.2); assert(G.player.ink === 0 && !G.player.diving, '墨水耗尽后没有退出潜墨');
  assert(!G.toggleDive(), '零墨水仍能重新进入潜墨');
});
test('非潜墨站在己方墨迹仅缓慢补墨', () => {
  fresh(); G.addInkStain(0, 0, 10, 45, '#1a2b8f'); G.player.ink = 10; G.updatePlayerInk(1); assert(near(G.player.ink, 12.85), '普通领地回复错误');
});
test('吸墨怪按面积吃墨成长，储墨击杀返还仍保留', () => {
  fresh(); G.addInkStain(100, 100, 10, 24, '#1a2b8f'); G.spawnEnemy('leech', 100, 100);
  const e = G.enemies[0], hp = e.maxhp, dmg = e.dmg; G.updateInkEater(e, 1 / 60);
  assert(e.ink > 0 && e.ink <= 12 && e.maxhp === hp + e.ink * 4 && e.dmg > dmg, '吸墨怪成长错误：' + e.ink); G.player.ink = 20; G.killEnemy(e); assert(G.player.ink > 20, '储墨没有返还');
});
test('普通击杀爆开己方墨迹但不直接返墨', () => {
  fresh(); G.spawnEnemy('stick', 50, 0); G.player.ink = 20; G.killEnemy(G.enemies[0]);
  assert(G.inkCellAt(50, 0).owner === 1 && G.player.ink === 20, '击杀爆墨或返墨错误');
});
test('墨潮释放后清零，且自身铺墨不会重新充能', () => {
  fresh(); G.player.special = 100; G.player.specialAnnounced = true; assert(G.castInkSurge(), '满墨潮无法释放');
  assert(G.player.special === 0 && G.novas.length === 1 && G.inkStats().friendly > 1000, '墨潮资源或范围错误'); assert(!G.castInkSurge(), '空墨潮仍能释放'); G.render();
});
test('墨潮圆周内部完整填充，一次覆盖范围内灰墨', () => {
  fresh(); G.addInkStain(60, 60, 200, 30, '#70645e', true, false); G.addInkStain(300, 0, 200, 30, '#70645e', true, false);
  G.player.special = 100; G.castInkSurge();
  for (let y = -200; y <= 200; y += 20) for (let x = -200; x <= 200; x += 20) {
    if (Math.hypot(x, y) <= 200) assert(G.inkCellAt(x, y).owner === 1, '墨潮内部空洞或灰墨残留：' + x + ',' + y);
  }
  assert(G.inkCellAt(60, 60).owner === 1 && G.inkCellAt(60, 60).amount === 1, '灰墨未被一次覆盖');
  assert(G.inkCellAt(300, 0).owner === 2 && G.inkCellAt(300, 0).amount === 1, '范围外灰墨被误清');
  assert(G.inkCellAt(250, 0).owner === 0, '墨潮超出设定半径');
});
test('墨潮按下只蓄力，快速松开释放 144 像素最小范围', () => {
  fresh(); G.player.special = 100;
  assert(G.startInkSurgeCharge(), '满墨潮无法开始蓄力');
  assert(G.player.surgeCharging && G.player.special === 100 && G.novas.length === 0, '按下时提前消耗或释放墨潮');
  assert(G.releaseInkSurgeCharge(), '松开时没有释放墨潮');
  assert(near(G.novas[0].max, 144) && G.player.special === 0 && !G.player.surgeCharging, '最小范围或释放结算错误');
});
test('墨潮蓄力随时间扩大，0.6 秒为 216，1.2 秒封顶 288', () => {
  fresh(); G.player.special = 100; G.startInkSurgeCharge();
  G.updateInkSurgeCharge(0.6);
  assert(near(G.inkSurgeChargeRadius(), 216), '半蓄力范围不是基准的 90%');
  G.updateInkSurgeCharge(10);
  assert(near(G.inkSurgeChargeRadius(), 288) && near(G.player.surgeChargeT, 1.2), '最大范围或蓄力时间封顶错误');
  G.releaseInkSurgeCharge(); assert(near(G.novas[0].max, 288), '实际释放没有使用最大范围');
});
test('潜墨可以蓄力和释放墨潮，全程不被打断', () => {
  fresh(); G.player.special = 100; assert(G.toggleDive(), '无法进入潜墨');
  G.startInkSurgeCharge(7); G.updateInkSurgeCharge(0.6); G.updatePlayerInk(0.6);
  assert(G.player.diving && G.player.surgeCharging && near(G.player.ink, 78.4), '蓄力打断潜墨或影响正常耗墨');
  G.releaseInkSurgeCharge(7);
  assert(G.player.diving && near(G.novas[0].max, 216), '释放墨潮打断潜潮或范围错误');
});
test('错误触点不能释放，取消蓄力不消耗墨潮', () => {
  fresh(); G.player.special = 100; G.startInkSurgeCharge(4); G.updateInkSurgeCharge(0.6);
  assert(!G.releaseInkSurgeCharge(5) && G.player.surgeCharging, '其他触点错误释放了墨潮');
  assert(G.cancelInkSurgeCharge(4), '正确触点无法取消蓄力');
  assert(G.player.special === 100 && G.novas.length === 0 && !G.player.surgeCharging, '取消蓄力消耗资源或误放技能');
});
console.log(failed ? 'INK_TEST_FAILURES: ' + failed : 'INK_TEST_OK (13/13)');
process.exit(failed ? 1 : 0);

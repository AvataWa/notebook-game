// 网格领地回归：逐帧铺墨、双方覆盖、潜墨移速与灰墨限制
const src = require('fs').readFileSync(__dirname + '/enemy-config.js', 'utf8') + '\n' +
  require('fs').readFileSync(__dirname + '/main.js', 'utf8').replace("'use strict';", '');
const fakeCtx = new Proxy({}, { get(t, k) { if (k === 'measureText') return () => ({ width: 10 }); return () => {}; }, set() { return true; } });
const fakeCanvas = { getContext: () => fakeCtx, width: 0, height: 0, style: {}, addEventListener() {}, getBoundingClientRect: () => ({ left: 0, top: 0, width: 375, height: 667 }) };
global.window = { addEventListener() {}, devicePixelRatio: 1, innerWidth: 375, innerHeight: 667 };
global.document = { getElementById: () => fakeCanvas };
global.requestAnimationFrame = () => {};
eval(src + `
;globalThis.G = {
  resetGame, addInkStain, addHostileInk, addPlayerTrail, addLinkedTrail, playerOnOwnInk, playerOnHostileInk,
  updatePlayerInk, toggleDive, updateEnemyTrails, updateInkStains, enemyInkFactor, inkCircleHas, inkCellAt, inkStats,
  spawnEnemy, update, hurtPlayer, render,
  get enemies() { return enemies; }, get player() { return player; }, get keys() { return keys; }, set state(v) { state = v; }
};`);
let failed = 0;
function test(name, fn) { try { fn(); console.log('OK  ' + name); } catch (e) { failed++; console.log('ERR ' + name + ': ' + e.message); } }
function assert(ok, msg) { if (!ok) throw new Error(msg); }
function near(a, b) { return Math.abs(a - b) < 1e-8; }
function fresh() { G.resetGame(); G.state = 'play'; G.player.xpNext = 999; G.player.hp = G.player.maxhp = 9999; for (const k in G.keys) G.keys[k] = false; }
function active() { G.player.actives = [{ id: 'cyclone', lvl: 1, supports: [], t: 999, uc: 0 }]; }

test('角色逐帧移动留下己方轨迹，轨迹不伤敌也不直接返墨', () => {
  fresh(); active(); G.keys.d = true; G.update(0.2); G.keys.d = false;
  assert(G.inkCircleHas(G.player.x, G.player.y, 0, false), '角色笔端没有当帧铺墨');
  G.spawnEnemy('stick', G.player.x, G.player.y); const e = G.enemies[0], hp = e.hp;
  G.updateInkStains(1); assert(e.hp === hp, '移动轨迹错误造成伤害');
  G.player.ink = 50; G.addPlayerTrail(G.player.x, G.player.y, '#1a2b8f'); assert(G.player.ink === 50, '铺设轨迹错误返墨');
});
test('普通站在己方墨迹上提供 12% 移速', () => {
  fresh(); G.keys.d = true; G.update(0.1); const normal = G.player.x;
  fresh(); G.addInkStain(10, 0, 10, 40, '#6b6b6b'); assert(G.playerOnOwnInk(), '未识别己方墨迹');
  G.keys.d = true; G.update(0.1); assert(near(G.player.x / normal, 1.12), '路线移速倍率错误');
});
test('潜墨提供 55% 移速且移动不铺新轨迹', () => {
  fresh(); active(); G.keys.d = true; G.update(0.1); const normal = G.player.x;
  fresh(); active(); G.addInkStain(10, 0, 10, 60, '#1a2b8f'); const before = G.inkStats().friendly;
  assert(G.toggleDive() && G.player.diving, '己方墨迹上无法潜墨'); G.keys.d = true; G.update(0.1);
  assert(near(G.player.x / normal, 1.55), '潜墨移速倍率错误'); assert(G.inkStats().friendly === before, '潜墨生成了新领地');
});
test('潜墨朝非己方向移动时铺设己方轨迹并减速 80%', () => {
  fresh(); G.keys.d = true; G.update(0.1); const normal = G.player.x;
  fresh(); G.player.ink = 100; assert(G.toggleDive(), '空白区域无法开启潜墨');
  G.keys.d = true; G.update(0.1);
  assert(near(G.player.x / normal, 1.55 * 0.2), '空白区域潜墨移速不是原潜墨速度的 20%');
  assert(G.inkCircleHas(G.player.x, G.player.y, 0, false), '非己方区域潜墨没有留下己方墨迹');
  const firstX = G.player.x; G.update(0.1);
  assert(near((G.player.x - firstX) / normal, 1.55 * 0.2), '继续向外潜墨时错误恢复了移速');
});
test('潜墨身前已是己方墨迹时恢复速度，包括回游方向', () => {
  fresh(); G.keys.d = true; G.update(0.1); const normal = G.player.x;
  fresh(); G.player.x = 50; G.addInkStain(90, 0, 10, 35, '#1a2b8f');
  assert(!G.playerOnOwnInk(), '测试起点应位于己方墨迹外');
  G.toggleDive(); G.keys.d = true; G.update(0.1);
  assert(near((G.player.x - 50) / normal, 1.55), '朝己方墨迹回游时仍被减速');
});
test('新涂地与覆盖灰墨充能，重复涂同色不充能', () => {
  fresh(); G.addInkStain(0, 0, 10, 40, '#6b6b6b'); assert(near(G.player.special, 12), '新区域充能错误');
  const charged = G.player.special; G.addInkStain(0, 0, 10, 40, '#6b6b6b'); assert(G.player.special === charged, '重复涂地仍充能');
  fresh(); G.addHostileInk(0, 0, 5, 40); const covered = G.addPlayerTrail(0, 0, '#6b6b6b');
  assert(covered > 0 && G.player.special > 0, '覆盖灰墨没有充能');
});
test('灰墨会反向覆盖彩色路线并同步网格归属', () => {
  fresh(); G.addPlayerTrail(0, 0, '#6b6b6b'); G.addHostileInk(0, 0, 3, 18);
  assert(G.inkCellAt(0, 0).owner === 2, '灰墨覆盖后网格归属没有更新');
});
test('普通状态站灰墨不扣血且暂停自然回墨', () => {
  fresh(); G.addHostileInk(0, 0, 10, 50); G.player.ink = 50;
  const hp = G.player.hp, result = G.updatePlayerInk(0.65);
  assert(result.hostile && G.playerOnHostileInk(), '未识别灰墨');
  assert(G.player.hp === hp, '普通状态仍受到灰墨周期伤害');
  assert(G.player.ink === 50, '灰墨中没有暂停自然回墨');
});
test('灰墨仍减速，潜墨不会被打断或退出', () => {
  fresh(); G.keys.d = true; G.update(0.1); const normal = G.player.x;
  fresh(); G.addHostileInk(10, 0, 10, 50); assert(G.playerOnHostileInk(), '未识别灰墨');
  G.player.ink = 50; assert(G.toggleDive(), '灰墨中无法开启潜墨');
  const hp = G.player.hp; G.keys.d = true; G.update(0.55);
  assert(G.player.diving && G.player.hp === hp, '灰墨仍然打断潜墨或造成伤害');
  assert(near(G.player.x / normal, 0.58 * 1.55 * 0.2 * 5.5), '灰墨中的潜墨没有降低 80% 移速');
});
test('怪物逐帧移动留下灰墨，彩墨与灰墨分别改变速度', () => {
  fresh(); G.spawnEnemy('stick', 0, 0); const e = G.enemies[0]; e.x = 50; G.updateEnemyTrails();
  assert(G.inkCircleHas(50, 0, 0, true) && G.enemyInkFactor(e) === 1.12, '灰墨轨迹或加速错误');
  e.hp = e.maxhp * 0.5; const hp = e.hp; G.enemyInkFactor(e); assert(e.hp === hp, '灰墨错误回血');
  fresh(); G.addInkStain(0, 0, 10, 40, '#1a2b8f'); G.spawnEnemy('stick', 0, 0); assert(G.enemyInkFactor(G.enemies[0]) === 0.82, '彩墨没有减速');
});
test('潜墨离开己方墨迹仍保持无敌位移，受击不退出', () => {
  fresh(); G.addInkStain(0, 0, 10, 20, '#1a2b8f'); G.player.ink = 50; G.toggleDive();
  G.player.x = 200; G.updatePlayerInk(0.1);
  assert(G.player.diving && near(G.player.ink, 46.4), '离开墨迹后退出或高消耗未生效');
  const hp = G.player.hp; G.hurtPlayer(20);
  assert(G.player.diving && G.player.hp === hp, '潜墨受击后掉血或退出'); G.render();
});
test('不足旧采样距离时也当帧铺设完整线段', () => {
  fresh(); const owner = { trailX: 0, trailY: 0, trailS: null };
  G.addLinkedTrail(owner, 10, 0, '#1a2b8f', false, 14, 1.2, 12, 'trailX', 'trailY', 'trailS');
  G.addLinkedTrail(owner, 14, 0, '#1a2b8f', false, 14, 1.2, 12, 'trailX', 'trailY', 'trailS');
  assert(owner.trailS.x === 14 && G.inkCircleHas(12, 0, 0, false), '笔端或中间线段没有同步');
});
test('长线段中点属于真实墨迹范围，远端不会误判', () => {
  fresh(); G.addPlayerTrail(30, 0, '#1a2b8f', { x: -30, y: 0 }); G.player.x = 0; G.player.y = 0;
  assert(G.playerOnOwnInk(), '线段中点没有识别为墨迹'); G.player.x = 90; assert(!G.playerOnOwnInk(), '墨迹范围被错误扩大');
});
console.log(failed ? 'INK_ROUTE_TEST_FAILURES: ' + failed : 'INK_ROUTE_TEST_OK (13/13)');
process.exit(failed ? 1 : 0);

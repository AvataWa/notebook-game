// 墨迹 / 弹反 / 墨潮 / 潜墨大节点与战斗配置回归
const src = require('fs').readFileSync(__dirname + '/battle-config.js', 'utf8') + '\n' +
  require('fs').readFileSync(__dirname + '/enemy-config.js', 'utf8') + '\n' +
  require('fs').readFileSync(__dirname + '/content-config.js', 'utf8') + '\n' +
  require('fs').readFileSync(__dirname + '/main.js', 'utf8').replace("'use strict';", '');
const fakeCtx = new Proxy({}, { get(t, k) { if (k === 'measureText') return () => ({ width: 10 }); return () => {}; }, set() { return true; } });
const fakeCanvas = { getContext: () => fakeCtx, width: 0, height: 0, style: {}, addEventListener() {}, getBoundingClientRect: () => ({ left: 0, top: 0, width: 375, height: 667 }) };
global.window = { addEventListener() {}, devicePixelRatio: 1, innerWidth: 375, innerHeight: 667 };
global.document = { getElementById: () => fakeCanvas }; global.requestAnimationFrame = () => {};
eval(src + `
;globalThis.G = {
  resetGame, addInkStain, hurtPlayer, hurtEnemy, spawnEnemy, castAbsorb, reflectEnemyBullet,
  updateMeleeSwing, castInkSurge, toggleDive, diveInkCost, update, inkStats, render,
  get player() { return player; }, get enemies() { return enemies; }, get keys() { return keys; },
  get PASSIVES() { return PASSIVES; }, get OPERATION_AFFIXES() { return OPERATION_AFFIXES; },
  get BATTLE() { return BATTLE; }, set state(v) { state = v; }
};`);
let failed = 0;
function test(name, fn) { try { fn(); console.log('OK  ' + name); } catch (e) { failed++; console.log('ERR ' + name + ': ' + e.message); } }
function assert(ok, msg) { if (!ok) throw new Error(msg); }
function near(a, b) { return Math.abs(a - b) < 1e-8; }
function fresh() { G.resetGame(); G.state = 'play'; G.player.xpNext = 999; G.player.hp = G.player.maxhp = 9999; for (const k in G.keys) G.keys[k] = false; }
function active() { G.player.actives = [{ id: 'cyclone', lvl: 1, supports: [], t: 999, uc: 0 }]; }
function enemy(type, x, y) { G.spawnEnemy(type, x, y); return G.enemies[G.enemies.length - 1]; }

test('战斗配置提供潜墨消耗与强化弹反回墨', () => {
  fresh(); assert(G.diveInkCost() === 36, '非己方墨迹潜墨不是 36/秒');
  G.addInkStain(0, 0, 5, 30, '#1a2b8f'); assert(G.diveInkCost() === 24, '己方墨迹潜墨不是当前配置的 24/秒');
  assert(G.BATTLE.absorb.bulletInk === 3 && G.BATTLE.absorb.meleeInk === 8, '弹反回墨参数未生效');
  assert(G.BATTLE.surge.chargeTime === 1.2 && G.BATTLE.surge.minScale === 0.6 && G.BATTLE.surge.maxScale === 1.2, '墨潮蓄力时间或范围倍率未生效');
});
test('大节点合并为 11 条通用被动，并有 62 条操作辅助', () => {
  assert(G.PASSIVES.length === 11, '通用被动数量不是 11');
  assert(G.OPERATION_AFFIXES.length === 62, '操作辅助数量不是 62');
  assert(['inkarmor', 'inkpower'].every(id => G.PASSIVES.some(n => n.id === id)), '原墨迹大节点未合并');
  assert(['parrycharge', 'parrywell', 'divepaint', 'surgeecho'].every(id => G.OPERATION_AFFIXES.some(n => n.id === id)), '原操作大节点未合并');
});
test('墨层护膜只在己方墨迹上减伤 20%', () => {
  fresh(); G.player.taken.inkarmor = true; G.hurtPlayer(100);
  assert(G.player.hp === 9899, '非墨迹区域也错误减伤');
  fresh(); G.player.taken.inkarmor = true; G.addInkStain(0, 0, 5, 30, '#1a2b8f'); G.hurtPlayer(100);
  assert(G.player.hp === 9919, '己方墨迹减伤不是 20%');
});
test('领地笔意使己方墨迹上的全部伤害提高 20%', () => {
  fresh(); const e = enemy('stick', 80, 0); e.hp = e.maxhp = 500; G.player.taken.inkpower = true;
  G.addInkStain(0, 0, 5, 30, '#1a2b8f'); G.hurtEnemy(e, 100, 0, 0, 0, 0, 0, 0, '#1a2b8f');
  assert(near(e.hp, 380), '站墨增伤没有生效');
});
test('回墨共振与深吸强化子弹弹反的充能和回墨', () => {
  fresh(); G.player.ink = 50; G.player.taken.parrycharge = true; G.player.taken.parrywell = true;
  const e = enemy('pencilthrower', 100, 0);
  const eb = { x: 0, y: 0, vx: -100, vy: 0, dmg: 10, life: 2, sourceId: e.id, reflectable: true };
  G.castAbsorb(); assert(G.reflectEnemyBullet(eb), '子弹弹反失败');
  assert(near(G.player.ink, 54.5), '深吸没有把子弹回墨提高到 4.5');
  assert(near(G.player.special, 34.8), '回墨共振没有把弹反充能提高到 30%');
});
test('深吸强化近战弹反回墨，但仍受单次上限约束', () => {
  fresh(); G.player.ink = 50; G.player.taken.parrywell = true;
  const e = enemy('stick', 30, 0); e.hp = e.maxhp = 500;
  e.swingT = 0.13; e.swingHit = false; G.castAbsorb(); G.updateMeleeSwing(e, 0.02);
  assert(near(G.player.ink, 62), '近战弹反回墨不是 12');
});
test('余潮使墨潮释放后保留 20% 充能', () => {
  fresh(); G.player.taken.surgeecho = true; G.player.special = 100; G.player.specialAnnounced = true;
  assert(G.castInkSurge() && near(G.player.special, 20), '墨潮余潮保留充能错误');
});
test('潜行笔迹让潜墨移动铺设己方墨迹', () => {
  fresh(); active(); G.addInkStain(0, 0, 5, 30, '#1a2b8f'); G.player.taken.divepaint = true;
  const before = G.inkStats().friendly; assert(G.toggleDive(), '无法进入潜墨');
  G.keys.d = true; G.update(0.1); G.keys.d = false;
  assert(G.player.diving && G.inkStats().friendly > before, '潜墨移动没有铺墨');
  G.render();
});
console.log(failed ? 'BATTLE_BUILD_TEST_FAILURES: ' + failed : 'BATTLE_BUILD_TEST_OK (8/8)');
process.exit(failed ? 1 : 0);

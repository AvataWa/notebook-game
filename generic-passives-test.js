// 通用词条对主动、墨潮、吸墨弹反与潜墨的一致性回归
const fs = require('fs');
const src = ['battle-config.js', 'enemy-config.js', 'content-config.js', 'main.js', 'build-runtime.js']
  .map(f => fs.readFileSync(__dirname + '/' + f, 'utf8').replace("'use strict';", '')).join('\n');
const fakeCtx = new Proxy({}, { get(t, k) {
  if (k === 'measureText') return () => ({ width: 10 });
  return () => {};
}, set() { return true; } });
const fakeCanvas = { getContext: () => fakeCtx, width: 0, height: 0, style: {}, addEventListener() {}, getBoundingClientRect: () => ({ left: 0, top: 0, width: 375, height: 667 }) };
global.window = { addEventListener() {}, devicePixelRatio: 1, innerWidth: 375, innerHeight: 667 };
global.document = { getElementById: () => fakeCanvas }; global.requestAnimationFrame = () => {};
eval(src + `
;globalThis.G = {
  resetGame, skillCalc, surgeChargeTime, castInkSurge, castMeleeInkSurge, castAbsorb, chargeParry, toggleDive, spawnEnemy,
  get player() { return player; }, get enemies() { return enemies; }, get novas() { return novas; },
  get PASSIVES() { return PASSIVES; }, get state() { return state; }, set state(v) { state = v; }
};`);
let failed = 0, passed = 0;
function test(name, fn) { try { fn(); passed++; console.log('OK  ' + name); } catch (e) { failed++; console.log('ERR ' + name + ': ' + e.stack.split('\n')[0]); } }
function assert(ok, msg) { if (!ok) throw new Error(msg); }
function near(a, b) { return Math.abs(a - b) < 1e-8; }
function fresh() {
  G.resetGame(); G.state = 'play'; G.player.xpNext = 999999; G.player.hp = G.player.maxhp = 9999;
  G.player.actives = [{ id: 'cyclone', lvl: 1, supports: [], t: 999, uc: 0 }];
}
function take(id) { const p = G.PASSIVES.find(x => x.id === id); assert(p, '缺少词条 ' + id); p.fx(); }

test('速写同时缩短主动冷却、墨潮蓄力、吸墨与潜墨冷却', () => {
  fresh(); take('haste');
  assert(near(G.player.cdMul, 0.94) && near(G.skillCalc(G.player.actives[0]).cd, 0.94), '主动冷却未生效');
  assert(near(G.surgeChargeTime(), 1.2 * 0.94), '墨潮蓄力未生效');
  G.castAbsorb(); assert(near(G.player.absorbCd, 1.2 * 0.94), '吸墨冷却未生效');
  G.chargeParry(); assert(near(G.player.absorbCd, 0.5 * 0.94), '弹反成功冷却未生效');
  fresh(); take('haste'); G.toggleDive(); G.toggleDive();
  assert(near(G.player.diveCd, 0.94), '潜墨冷却未生效');
});

test('笔芯连供使用同一冷却规则并保留全局伤害代价', () => {
  fresh(); take('fountain');
  assert(near(G.surgeChargeTime(), 1.2 * 0.88) && near(G.player.dmgMul, 0.92), '墨潮蓄力或伤害代价错误');
  G.castAbsorb(); assert(near(G.player.absorbCd, 1.2 * 0.88), '吸墨冷却没有应用笔芯连供');
  G.chargeParry(); assert(near(G.player.absorbCd, 0.5 * 0.88), '弹反成功冷却没有应用笔芯连供');
  fresh(); take('fountain'); G.toggleDive(); G.toggleDive();
  assert(near(G.player.diveCd, 0.88), '潜墨冷却没有应用笔芯连供');
});

test('泼墨同步扩大墨潮、弹反判定、小墨潮与潜墨爆发', () => {
  fresh(); take('inkmaster'); G.castAbsorb();
  assert(near(G.player.absorbRadius, 65 * 1.2), '弹反判定范围未扩大');
  G.castMeleeInkSurge(); assert(near(G.novas[G.novas.length - 1].max, 120 * 1.2), '小墨潮范围未扩大');
  G.player.special = 100; G.castInkSurge();
  assert(near(G.novas[G.novas.length - 1].max, 168 * 1.2), '墨潮范围未扩大');
  fresh(); take('inkmaster'); G.player.affixes.dive.exitburst = true; G.toggleDive(); G.toggleDive();
  assert(near(G.novas[G.novas.length - 1].max, 75 * 1.2), '潜墨爆发范围未扩大');
});

test('全局伤害与装备攻击也作用于潜墨爆发', () => {
  fresh(); take('dmg'); G.player.eqAtk = 20; G.player.affixes.dive.exitburst = true;
  G.spawnEnemy('stick', 50, 0); const e = G.enemies[0]; e.hp = e.maxhp = 500;
  G.toggleDive(); G.toggleDive();
  assert(near(e.hp, 500 - 30 * 1.1 * 1.2), '潜墨爆发没有应用全局伤害与装备攻击');
});

console.log(failed ? 'GENERIC_PASSIVES_TEST_FAILURES: ' + failed : 'GENERIC_PASSIVES_TEST_OK (' + passed + '/' + passed + ')');
process.exit(failed ? 1 : 0);

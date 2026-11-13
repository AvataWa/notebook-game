// 五类主动连携、独立触发冷却与红芯投枪下线专项测试
const fs = require('fs');
const src = ['battle-config.js', 'enemy-config.js', 'content-config.js', 'main.js', 'build-runtime.js', 'hades-runtime.js', 'hades-weapons-runtime.js', 'weapon-passives-expansion.js', 'form-passives-runtime.js', 'support-expansion-runtime.js', 'elemental-support-runtime.js', 'trigger-support-runtime.js']
  .map(f => fs.readFileSync(__dirname + '/' + f, 'utf8').replace("'use strict';", '')).join('\n');
const fakeCtx = new Proxy({}, { get(t, k) {
  if (k === 'measureText') return txt => ({ width: String(txt).length * 10 });
  return () => {};
}, set() { return true; } });
const fakeCanvas = { getContext: () => fakeCtx, width: 0, height: 0, style: {}, addEventListener() {}, getBoundingClientRect: () => ({ left: 0, top: 0, width: 375, height: 667 }) };
global.window = { addEventListener() {}, devicePixelRatio: 1, innerWidth: 375, innerHeight: 667 };
global.document = { getElementById: () => fakeCanvas }; global.requestAnimationFrame = () => {};
eval(src + `
;globalThis.G = {
  resetGame, skillCalc, supportUsable, supDesc, castAbsorb, enterDive, castInkSurge, hurtEnemy, killEnemy, spawnEnemy,
  get SKILL_DEFS() { return SKILL_DEFS; }, get PASSIVES() { return PASSIVES; }, get SUPPORTS() { return SUPPORTS; },
  get player() { return player; }, get enemies() { return enemies; }, get state() { return state; }, set state(v) { state = v; },
  get gameTime() { return gameTime; }, set gameTime(v) { gameTime = v; }, get T() { return window.__triggerSupport; }
};`);
let failed = 0, passed = 0;
function test(name, fn) { try { fn(); passed++; console.log('OK  ' + name); } catch (e) { failed++; console.log('ERR ' + name + ': ' + e.stack.split('\n')[0]); } }
function assert(ok, msg) { if (!ok) throw new Error(msg); }
function near(a, b, eps = 0.001) { return Math.abs(a - b) < eps; }
function fresh(support, lvl = 1) {
  G.resetGame(); G.state = 'play'; G.gameTime = 0; G.player.xpNext = 999999; G.player.hp = G.player.maxhp = 9999;
  G.player.actives = [{ id: 'cyclone', lvl: 1, supports: support ? [{ id: support, lvl }] : [], t: 999, uc: 0 }];
}
function target(x = 50) {
  G.spawnEnemy('stick', x, 0);
  const e = G.enemies[G.enemies.length - 1]; e.hp = e.maxhp = 9999; e.stunT = 999; e.r = 5; return e;
}

test('红芯及三条专属被动下线，五种连携可供全部主动使用', () => {
  fresh();
  assert(Object.keys(G.SKILL_DEFS).length === 29 && !G.SKILL_DEFS.bloodcore && !G.SKILL_DEFS.weakmark, '红芯投枪或红笔减分仍在主动池');
  assert(!['hdualcore', 'hcorewound', 'hshardguard'].some(id => G.PASSIVES.some(p => p.id === id)), '红芯专属被动仍在词条池');
  assert(Object.keys(G.SUPPORTS).length === 70, '辅助总数不是 70');
  for (const id of ['onabsorb', 'ondive', 'onsurge', 'oncrit', 'onkill']) assert(G.supportUsable(id, 'cyclone') && G.supportUsable(id, 'tornado'), id + ' 未对全部主动开放');
  assert(G.supDesc('oncrit', 1).includes('1.0 秒') && G.supDesc('onkill', 3).includes('0.8 秒'), '触发冷却文案错误');
});

test('吸墨、进入潜墨与墨潮都会实际触发所镶嵌主动', () => {
  fresh('onabsorb'); let e = target(); const ink = G.player.ink, timer = G.player.actives[0].t;
  assert(G.castAbsorb() && e.hp < e.maxhp, '吸墨没有触发旋转蜡笔');
  assert(G.player.ink === ink && G.player.actives[0].t === timer, '连携额外耗墨或重置自动冷却');
  fresh('ondive'); e = target(); G.enterDive(); assert(e.hp < e.maxhp, '进入潜墨没有触发主动');
  fresh('onsurge'); e = target(); G.player.special = 100;
  assert(G.castInkSurge(40, false) && e.hp < e.maxhp, '墨潮没有触发范围外主动');
});

test('操作连携升级提高触发伤害', () => {
  fresh('onabsorb', 1); let e = target(); G.castAbsorb(); const first = e.maxhp - e.hp;
  fresh('onabsorb', 3); e = target(); G.castAbsorb(); const third = e.maxhp - e.hp;
  assert(near(third, first * 1.3), '三级操作连携没有提升到 130% 触发伤害：' + first + '/' + third);
});

test('暴击触发默认一秒冷却，同一帧重复暴击不会递归', () => {
  fresh('oncrit'); const e = target(); G.player.crit = 1;
  G.hurtEnemy(e, 1, 0, 0, 0, 0, 0, 0, '#000', false, 'other'); const first = e.maxhp - e.hp;
  assert(first > 2, '暴击没有触发主动');
  G.hurtEnemy(e, 1, 0, 0, 0, 0, 0, 0, '#000', false, 'other');
  assert(near(e.maxhp - e.hp, first + 2), '冷却内再次暴击仍触发');
  G.gameTime = 0.99; G.hurtEnemy(e, 1, 0, 0, 0, 0, 0, 0, '#000', false, 'other');
  assert(near(e.maxhp - e.hp, first + 4), '0.99 秒提前恢复触发');
  G.gameTime = 1; G.hurtEnemy(e, 1, 0, 0, 0, 0, 0, 0, '#000', false, 'other');
  assert(e.maxhp - e.hp > first + 6, '1 秒后没有恢复触发');
});

test('击杀触发使用独立冷却，升级后按 0.1 秒每级缩减', () => {
  fresh('onkill', 3); assert(near(G.T.cooldownFor({ lvl: 3 }), 0.8), '三级冷却不是 0.8 秒');
  let dead = target(), nearby = target(); G.killEnemy(dead); const dealt = nearby.maxhp - nearby.hp;
  assert(dealt > 0, '怪物死亡没有触发主动');
  dead = target(); const second = target(); G.killEnemy(dead);
  assert(second.hp === second.maxhp, '击杀冷却内仍重复触发');
  G.gameTime = 0.8; dead = target(); const third = target(); G.killEnemy(dead);
  assert(third.hp < third.maxhp, '升级后的 0.8 秒冷却未恢复');
});

test('不同主动的暴击冷却彼此独立', () => {
  fresh('oncrit'); G.player.actives.push({ id: 'volcanic', lvl: 1, supports: [{ id: 'oncrit', lvl: 1 }], t: 999, uc: 0 });
  const cds = G.player.actives.map(a => a.triggerCds);
  G.player.crit = 1; const e = target(); G.hurtEnemy(e, 1, 0, 0, 0, 0, 0, 0, '#000', false, 'other');
  assert(G.player.actives.every(a => a.triggerCds && a.triggerCds.crit === 1), '两个主动没有分别记录暴击冷却');
  assert(cds[0] !== G.player.actives[0].triggerCds, '测试未正确初始化冷却记录');
});

console.log(failed ? 'TRIGGER_SUPPORT_TEST_FAILURES: ' + failed : 'TRIGGER_SUPPORT_TEST_OK (' + passed + '/' + passed + ')');
process.exit(failed ? 1 : 0);

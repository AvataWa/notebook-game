// 留墨、范围/持续补偿、移速转化与乱线金装单穿价值专项回归
const fs = require('fs');
const files = ['battle-config.js', 'enemy-config.js', 'content-config.js', 'main.js', 'build-runtime.js',
  'hades-runtime.js', 'hades-weapons-runtime.js', 'weapon-passives-expansion.js', 'form-passives-runtime.js',
  'support-expansion-runtime.js', 'elemental-support-runtime.js', 'trigger-support-runtime.js', 'build-view.js',
  'equipment-rework-runtime.js', 'boss-set-runtime.js', 'build-optimization-runtime.js', 'affix-dedup-runtime.js', 'option-director-runtime.js'];
const src = files.map(f => fs.readFileSync(__dirname + '/' + f, 'utf8').replace("'use strict';", '')).join('\n');
const fakeCtx = new Proxy({}, { get(t, k) {
  if (k === 'measureText') return txt => ({ width: String(txt).length * 8 });
  return () => {};
}, set() { return true; } });
const fakeCanvas = { getContext: () => fakeCtx, width: 0, height: 0, style: {}, addEventListener() {},
  getBoundingClientRect: () => ({ left: 0, top: 0, width: 375, height: 667 }) };
global.window = { addEventListener() {}, devicePixelRatio: 1, innerWidth: 375, innerHeight: 667 };
global.document = { getElementById: () => fakeCanvas }; global.requestAnimationFrame = () => {};
eval(src + `
;globalThis.G = {
  resetGame, update, skillCalc, fireSkill, areaHit, hurtEnemy, hurtPlayer, spawnEnemy, spawnBoss,
  recomputeEquip, itemV, supportUsable, supDesc, chargeParry,
  get SUPPORTS() { return SUPPORTS; }, get PASSIVES() { return PASSIVES; },
  get player() { return player; }, get enemies() { return enemies; }, get bullets() { return bullets; },
  get keys() { return keys; }, get state() { return state; }, set state(v) { state = v; },
  get R() { return window.BuildOptimizationRuntime; }, get B() { return window.BossSetRuntime; },
  get D() { return window.OptionDirectorRuntime; }
};`);
global.BossSetRuntime = window.BossSetRuntime;
let passed = 0, failed = 0;
function test(name, fn) { try { fn(); passed++; console.log('OK  ' + name); } catch (e) { failed++; console.log('ERR ' + name + ': ' + e.stack.split('\n')[0]); } }
function assert(ok, msg) { if (!ok) throw new Error(msg); }
function near(a, b, eps = 0.01) { return Math.abs(a - b) < eps; }
function fresh(id = 'cyclone', supports = []) {
  G.resetGame(); G.state = 'play'; G.player.xpNext = 999999; G.player.hp = G.player.maxhp = 9999;
  G.player.actives = [{ id, lvl: 1, supports: supports.map(id => ({ id, lvl: 1 })), t: 999, uc: 0 }];
  G.R.state.pools.length = 0;
}
function target(x = 60, y = 0, boss = false) {
  if (boss) G.spawnBoss(1); else G.spawnEnemy('stick', x, y);
  const e = G.enemies[G.enemies.length - 1]; e.x = x; e.y = y; e.hp = e.maxhp = 99999;
  e.stunT = 999; e.sp = 0; e.r = boss ? e.r : 5; return e;
}
function calc() { return G.skillCalc(G.player.actives[0]); }
function cast() { return G.fireSkill(G.player.actives[0], calc()); }
function take(id) { G.PASSIVES.find(p => p.id === id).fx(); }
function equip(key, roll = 100) {
  const slots = { scribblecrown: 'head', scribblehide: 'body', huntergall: 'acc', tailgrip: 'hands', lineboots: 'feet',
    crown: 'head', cap4: 'head', blankcap: 'head', multicore: 'head', highscore: 'head', rulerband: 'head', scatterband: 'head',
    cloak: 'body', stapler: 'body', blotarmor: 'body', looseleaf: 'body', inkarmor: 'body', cliparmor: 'body',
    glove: 'hands', compass: 'hands', burstglove: 'hands', parrygrip: 'hands', surgeglove: 'hands', shredglove: 'hands',
    shoes: 'feet', tape: 'feet', gridshoes: 'feet', trackshoes: 'feet', erasershoes: 'feet', blankshoes: 'feet',
    pendant: 'acc', bookmark: 'acc', lowink: 'acc', fullink: 'acc', inklens: 'acc', rerollnote: 'acc', widependant: 'acc' };
  const rarity = ['tailgrip', 'lineboots'].includes(key) ? 2 : (['scribblecrown', 'scribblehide', 'huntergall'].includes(key) ? 3 : 0);
  G.player.equip[slots[key]] = { key, rarity, roll }; G.recomputeEquip();
}

test('粗管笔由留墨笔尖替换，最终 67 条辅助并进入机制卡', () => {
  fresh(); assert(!G.SUPPORTS.fatpipe && G.SUPPORTS.inkpool && Object.keys(G.SUPPORTS).length === 67, '辅助替换或总数错误');
  assert(!G.supportUsable('fatpipe', 'tornado') && G.supportUsable('inkpool', 'tornado'), '普通子弹匹配错误');
  assert(G.supportUsable('inkpool', 'ricoshield'), '飞盾不能使用留墨笔尖');
  assert(G.supDesc('inkpool', 2).includes('24%') && G.D.isMechanism({ kind: 'support', sup: 'inkpool' }), '描述或导演分类错误');
});

test('同一子弹只生成一个墨斑，墨斑按子弹伤害造成真实周期伤害', () => {
  fresh('icespear', ['inkpool']); const e = target(100); cast(); const b = G.bullets[0];
  Object.assign(b, { x: e.x, y: e.y, vx: 0, vy: 0, life: 2 });
  G.R.prepareProjectilePools(); G.R.prepareProjectilePools();
  assert(G.R.state.pools.length === 1 && b.inkPoolDone, '一颗子弹生成了多个墨斑');
  const pool = G.R.state.pools[0], hp = e.hp;
  assert(near(pool.dps, b.dmg * 0.12) && pool.t === 2, '墨斑 DPS 或持续时间错误');
  G.R.updatePools(0.2); assert(near(hp - e.hp, b.dmg * 0.12 * 0.2), '墨斑没有真实周期伤害');
});

test('浓墨重彩降低纯半径收益并为外圈增伤，内圈不吃外圈加成', () => {
  fresh('cyclone', ['wide']); const c = calc(), inner = target(20), outer = target(120);
  assert(near(c.rad, 1.15) && near(c.outerDmg, 0.15), '范围或外圈参数错误');
  const ih = inner.hp, oh = outer.hp;
  G.areaHit(inner, 100, c, 0, 0, 150, 20); G.areaHit(outer, 100, c, 0, 0, 150, 120);
  assert(near(ih - inner.hp, 100) && near(oh - outer.hp, 115), '内外圈伤害结算错误');
});

test('大开大合改为外圈牵引，余墨与持久墨水不再附带直接增伤', () => {
  fresh('cyclone', ['sweep']); let c = calc();
  assert(near(c.sweep, 0.15) && near(c.outerDmg, 0) && c.sweepPull === 1, '大开大合参数错误');
  fresh('inkrain', ['linger']); c = calc();
  assert(near(c.dmg, 1) && near(c.lingerT, 0.35), '余墨仍有伤害补偿或持续错误');
  fresh('vortex', ['dur']); c = calc();
  assert(near(c.dmg, 1) && near(c.areaT, 1.3) && c.count === 1, '持久墨水持续或存在上限错误');
  fresh('tornado', ['projspd']); c = calc(); assert(near(c.proj, 1.2) && near(c.dmg, 1.1), '快干墨弹速或伤害错误');
});

test('震荡纸面对 Boss 转为短暂易伤，不再完全空转', () => {
  fresh('pageslash', ['shock']); const boss = target(60, 0, true), c = calc();
  G.areaHit(boss, 100, c, 0, 0); assert(near(boss.vuln, 0.1) && boss.vulnT > 0 && boss.vulnT <= 0.8, 'Boss 易伤未生效');
});

test('所有脚部装备都有真实移速，并进入统一额外移速汇总', () => {
  for (const key of ['shoes', 'tape', 'gridshoes', 'trackshoes', 'erasershoes', 'blankshoes', 'lineboots']) {
    fresh(); equip(key); const speed = G.itemV(key, 'speed');
    assert(speed > 0 && near(G.player.eqSpd, 1 + speed / 100), key + ' 移速未生效');
    assert(near(G.R.extraSpeed(), speed), key + ' 未进入移速汇总');
  }
});

test('急就章在 60% 额外移速时提供 18% 主动冷却缩减并封顶', () => {
  fresh(); take('hastyscript'); G.player.passiveCounts = { spd: 10 };
  assert(near(G.R.extraSpeed(), 60) && near(calc().cd, 0.82), '60% 移速冷却转化错误');
  G.player.passiveCounts.spd = 30; assert(near(calc().cd, 0.64), '冷却转化没有封顶 36%');
});

test('边走边写移动时增伤、停笔失效，0.5 秒宽限仍保留', () => {
  fresh(); take('movingwrite'); G.player.passiveCounts = { spd: 10 }; G.player.moveT = 1;
  assert(near(calc().dmg, 1.12), '移动增伤错误');
  G.player.passiveCounts.spd = 30; assert(near(calc().dmg, 1.24), '移动增伤没有封顶 24%');
  G.player.moveT = 0; G.R.state.moveGrace = 0.4; assert(near(calc().dmg, 1.24), '停笔宽限没有保留');
  G.R.state.moveGrace = 0; assert(near(calc().dmg, 1), '停笔宽限结束后仍增伤');
});

test('行间拖影需要持续移动一秒，并按额外移速减伤', () => {
  fresh(); take('runningguard'); G.player.passiveCounts = { spd: 10 }; G.player.moveT = 1;
  let hp = G.player.hp; G.hurtPlayer(100); assert(near(hp - G.player.hp, 91), '60% 移速没有提供 9% 减伤');
  fresh(); take('runningguard'); G.player.passiveCounts = { spd: 10 }; G.player.moveT = 0;
  hp = G.player.hp; G.hurtPlayer(100); assert(near(hp - G.player.hp, 100), '未满一秒也获得减伤');
});

test('踉跄疾书有持续、内置冷却、移速转化和首次主动墨痕', () => {
  fresh(); take('stumblewrite'); G.hurtPlayer(100);
  assert(G.R.state.hurtSpeedT === 3 && G.R.state.hurtCdT === 6 && G.R.extraSpeed() === 40, '受击增速或冷却错误');
  cast(); cast(); assert(G.R.state.pools.filter(p => p.skill === 'stumblewrite').length === 1, '首次主动墨痕不是一次');
  G.R.state.hurtSpeedT = 0; G.R.state.hurtCdT = 3; G.player.hurtT = 0;
  G.hurtPlayer(100); assert(G.R.state.hurtSpeedT === 0, '内置冷却期间重复触发');
});

test('泼墨范围降为 15%，弹反强化下一主动 15%', () => {
  fresh(); const base = calc().dmg; take('inkmaster'); G.chargeParry();
  assert(near(G.player.radMul, 1.15) && G.player.itemParryT === 2, '范围或弹反强化状态错误');
  assert(near(calc().dmg, base * 1.15), '下一主动增伤错误');
});

test('乱线角冠、猎手墨胆和兽皮单穿均有独立战斗价值', () => {
  fresh(); const beforeCrown = calc().dmg; equip('scribblecrown');
  assert(near(calc().dmg, beforeCrown * (1 + G.player.eqAtk / 100) * 1.2), '角冠主动增伤未生效');
  fresh(); equip('huntergall'); const e = target(); G.player.ink = 0; cast();
  G.hurtEnemy(e, 10, 0, 0, 0, 0, -1, 0, undefined, false, 'cyclone');
  assert(G.player.ink === 4 && !G.B.state.castRefunds.cyclone, '墨胆首次命中回墨错误');
  const ink = G.player.ink; G.hurtEnemy(e, 10, 0, 0, 0, 0, -1, 0, undefined, false, 'cyclone');
  assert(G.player.ink === ink, '同一主动重复回墨');
  fresh(); equip('scribblehide'); G.B.state.hurtBoostT = 3; const hp = G.player.hp;
  G.hurtPlayer(100); assert(near(hp - G.player.hp, 85) && G.R.extraSpeed() === 25, '兽皮减伤或受击移速未生效');
});

console.log(failed ? 'BUILD_OPTIMIZATION_TEST_FAILURES: ' + failed : 'BUILD_OPTIMIZATION_TEST_OK (' + passed + '/' + passed + ')');
process.exit(failed ? 1 : 0);

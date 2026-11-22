// 三选一去重：最终运行时数值、条件机制、属性行为与抽卡互斥专项测试
const fs = require('fs');
const files = ['battle-config.js', 'enemy-config.js', 'content-config.js', 'main.js', 'build-runtime.js',
  'hades-runtime.js', 'hades-weapons-runtime.js', 'weapon-passives-expansion.js', 'form-passives-runtime.js',
  'evolution-runtime.js', 'support-expansion-runtime.js', 'cyclone-support-runtime.js', 'elemental-support-runtime.js',
  'trigger-support-runtime.js', 'build-optimization-runtime.js', 'affix-dedup-runtime.js', 'option-director-runtime.js'];
const src = files.map(f => fs.readFileSync(__dirname + '/' + f, 'utf8').replace("'use strict';", '')).join('\n');
const fakeCtx = new Proxy({}, { get(t, k) {
  if (k === 'measureText') return txt => ({ width: String(txt).length * 8 });
  return () => {};
}, set() { return true; } });
const fakeCanvas = { getContext: () => fakeCtx, width: 0, height: 0, style: {}, addEventListener() {},
  getBoundingClientRect: () => ({ left: 0, top: 0, width: 375, height: 667 }) };
global.window = global;
global.addEventListener = () => {};
Object.assign(global, { devicePixelRatio: 1, innerWidth: 375, innerHeight: 667 });
global.document = { getElementById: () => fakeCanvas }; global.requestAnimationFrame = () => {};
eval(src + `\n;globalThis.G = {
  resetGame, update, fireSkill, skillCalc, spawnEnemy, hurtEnemy, killEnemy, areaHit, supportUsable, supDesc,
  get SUPPORTS() { return SUPPORTS; }, get player() { return player; }, get enemies() { return enemies; },
  get floats() { return floats; }, get lightnings() { return lightnings; }, get bullets() { return bullets; },
  get state() { return state; }, set state(v) { state = v; }, get gameTime() { return gameTime; }, set gameTime(v) { gameTime = v; },
  get R() { return window.AffixDedupRuntime; }, get D() { return window.OptionDirectorRuntime; },
  get E() { return window.__supportExpansion; }, get T() { return window.__triggerSupport; }
};`);
let passed = 0, failed = 0;
const realRandom = Math.random;
function test(name, fn) { try { fn(); passed++; console.log('OK  ' + name); } catch (e) { failed++; console.log('ERR ' + name + ': ' + e.stack.split('\n')[0]); } finally { Math.random = realRandom; } }
function assert(ok, msg) { if (!ok) throw new Error(msg); }
function near(a, b, eps = 0.01) { return Math.abs(a - b) < eps; }
function fresh(id = 'cyclone', supports = []) {
  G.resetGame(); G.state = 'play'; G.gameTime = 0; G.player.xpNext = 999999; G.player.hp = G.player.maxhp = 99999;
  G.player.crit = 0; G.player.eqCrit = 0; G.player.characterId = 'draft';
  G.player.actives = [{ id, lvl: 1, supports: supports.map(s => Array.isArray(s) ? { id: s[0], lvl: s[1] } : { id: s, lvl: 1 }), t: 999, uc: 0 }];
  return G.player;
}
function addActive(id, supports = []) {
  const a = { id, lvl: 1, supports: supports.map(id => ({ id, lvl: 1 })), t: 999, uc: 0 };
  G.player.actives.push(a); return a;
}
function target(x = 100, y = 0) {
  G.spawnEnemy('stick', x, y); const e = G.enemies[G.enemies.length - 1];
  e.hp = e.maxhp = 99999; e.stunT = 999; e.r = 5; e.dmg = 0; e.sp = 0; return e;
}
function calc(a) { return G.skillCalc(a || G.player.actives[0]); }
function cast(a) { a = a || G.player.actives[0]; const c = calc(a); return { result: G.fireSkill(a, c), c }; }
function hit(e, skill, amount = 100) { G.hurtEnemy(e, amount, 0, 0, 0, 0, 0, 0, '#000', false, skill || G.player.actives[0].id); }
function dealt(e) { return e.maxhp - e.hp; }

test('合并三条辅助后总数为七十一，旧词条不可再获取', () => {
  fresh(); assert(Object.keys(G.SUPPORTS).length === 71, '最终辅助数不是71：' + Object.keys(G.SUPPORTS).length);
  for (const id of ['soak', 'projrepeat', 'followup']) assert(!G.SUPPORTS[id] && !G.supportUsable(id, 'cyclone'), id + ' 仍在池中');
});

test('用力描粗按释放频率降低百分之八结算，不再使用冷却加八', () => {
  fresh('cyclone'); const base = calc(); fresh('cyclone', ['brutal']); const c = calc();
  assert(near(c.dmg, base.dmg * 1.25) && near(c.cd, base.cd / 0.92), '伤害或释放频率换算错误：' + c.cd + '/' + base.cd);
  assert(G.supDesc('brutal', 1).includes('释放频率降低 8%') && !G.supDesc('brutal', 1).includes('冷却 +'), '描述仍有冷却加八');
});

test('连笔速写不再直接减冷却，只在不同主动轮转时返还前一技能', () => {
  const p = fresh('cyclone'); target(); const first = p.actives[0], second = addActive('arc', ['swift']);
  first.t = second.t = 100; cast(first); const before = first.t; cast(second);
  const refund = 100 - first.t;
  assert(refund > 0, '轮转没有返还');
  assert(near(refund, 0.45 * calc(first).cd * 0.08, 0.001), '返还数值不是前一技能冷却的8%：' + refund);
  const settled = first.t; cast(second); assert(near(first.t, settled), '重复同一技能仍触发返还');
  assert(near(calc(second).cd, 1), '连笔速写仍直接缩短冷却');
});

test('削尖笔尖只强化近距子弹，重墨弹头按目标距离增加暴击', () => {
  fresh('tornado', ['sharpen']); const close = target(100), far = target(300);
  hit(close, 'tornado'); hit(far, 'tornado');
  assert(near(dealt(close), 135) && near(dealt(far), 100), '近距子弹增伤错误');
  fresh('tornado', ['heavynib']); const nearE = target(0), farE = target(600);
  Math.random = () => 0.15; hit(nearE, 'tornado'); hit(farE, 'tornado');
  assert(near(dealt(nearE), 100) && near(dealt(farE), 200), '远距暴击没有生效');
});

test('重色涂满按单次覆盖敌数增伤，收笔回锋按不同命中目标返还', () => {
  fresh('cyclone', ['saturate']); let es = [target(20), target(35)]; const c2 = calc();
  for (const e of es) G.areaHit(e, 100, c2, 0, 0, 150, 20);
  assert(es.every(e => near(dealt(e), 100)), '两敌也触发了覆盖增伤');
  fresh('cyclone', ['saturate']); es = [target(20), target(35), target(50)]; const c3 = calc();
  for (const e of es) G.areaHit(e, 100, c3, 0, 0, 150, 20);
  assert(es.every(e => near(dealt(e), 125)), '三敌没有全部获得覆盖增伤');
  const p = fresh('inkrain', ['sheath']); const a = p.actives[0]; a.t = 10; target(80); target(100); const casted = cast(a);
  G.areaHit(G.enemies[0], 10, casted.c, 80, 0, 55, 0); G.areaHit(G.enemies[1], 10, casted.c, 100, 0, 55, 0);
  const before = a.t; G.R.state.sheathCasts[0].t = 0.001; G.update(0.01);
  assert(before - a.t > 0.05 && G.R.state.sheathCasts.length === 0, '范围结束返冷却未结算：' + (before - a.t));
});

test('落笔千钧奖励两秒节奏，寸劲只提高近身打击暴击', () => {
  const p = fresh('pageslash', ['heavyweight']); target(60); const a = p.actives[0];
  assert(cast(a).c.heavyReady, '首次施放没有重击');
  G.gameTime = 1; assert(!cast(a).c.heavyReady, '一秒间隔仍触发重击');
  G.gameTime = 3; const ready = cast(a).c; assert(ready.heavyReady, '两秒间隔没有触发重击');
  const e = target(60); G.areaHit(e, 100, ready, 0, 0); assert(near(dealt(e), 140), '重击伤害错误');
  fresh('pageslash', ['scrit']); const close = target(80), far = target(300); Math.random = () => 0.15;
  hit(close, 'pageslash'); hit(far, 'pageslash'); assert(near(dealt(close), 200) && near(dealt(far), 100), '近身打击暴击错误');
});

test('大开大合外圈牵引、余墨不再增伤、持久墨水增加存在上限', () => {
  fresh('cyclone', ['sweep']); const c = calc(), e = target(120); const x = e.x;
  G.areaHit(e, 100, c, 0, 0, 150, 120); assert(e.x < x && near(c.outerDmg || 0, 0), '外圈没有牵引或仍直接增伤');
  fresh('inkrain', ['linger']); assert(near(calc().dmg, 1) && near(calc().lingerT, 0.35), '余墨仍附增伤或持续错误');
  fresh('vortex', ['dur']); assert(near(calc().dmg, 1) && near(calc().areaT, 1.3) && calc().count === 1, '持久墨水参数错误');
});

test('物理硬压与不同主动破纸均进入后续真实伤害', () => {
  fresh('cyclone', ['physdmg']); const e = target(); hit(e); hit(e); hit(e); hit(e);
  assert(near(dealt(e), 100 + 104 + 108 + 112), '硬压叠层伤害错误：' + dealt(e));
  const p = fresh('cyclone', ['physvuln']); addActive('pageslash', ['physvuln']); const other = target();
  hit(other, 'cyclone'); hit(other, 'cyclone'); hit(other, 'pageslash'); hit(other, 'cyclone');
  assert(near(dealt(other), 100 + 106 + 106 + 112), '不同主动破纸没有叠层：' + dealt(other));
});

test('物理暴击僵直并叠硬压，火焰暴击传播燃烧', () => {
  fresh('cyclone', ['physcrit']); const e = target(); e.stunT = 0; G.player.crit = 1; Math.random = () => 0; hit(e);
  assert(near(dealt(e), 200) && e.stunT >= 0.25 && e.dedupPressureN === 1, '物理暴击行为错误');
  fresh('volcanic', ['firecrit']); const first = target(80), second = target(140); G.player.crit = 1; Math.random = () => 0; hit(first, 'volcanic');
  assert(near(dealt(first), 200) && second.elBurns && second.elBurns.length === 1, '火焰暴击没有传播燃烧');
});

test('火焰增伤看燃烧层数，爆燃区域附加燃烧', () => {
  fresh('volcanic', ['firedmg', 'fireburn']); const e = target(); hit(e); hit(e); hit(e); hit(e);
  assert(near(dealt(e), 100 + 108 + 116 + 124), '燃烧层数增伤错误：' + dealt(e));
  fresh('volcanic', ['fireburn', 'fireblast']); const dead = target(80), other = target(120);
  hit(dead, 'volcanic'); G.killEnemy(dead);
  assert(near(dealt(other), 60) && other.elBurns && other.elBurns.length === 1, '爆燃没有附加燃烧');
});

test('冰霜增伤区分减速冻结，冰霜暴击额外叠寒霜', () => {
  fresh('cola', ['icedmg']); const normal = target(), slow = target(150), frozen = target(220);
  slow.slowT = 2; frozen.slowT = 2; frozen.elFrostN = 3; frozen.stunT = 1;
  hit(normal); hit(slow); hit(frozen);
  assert(near(dealt(normal), 100) && near(dealt(slow), 112) && near(dealt(frozen), 124), '冰霜条件增伤错误');
  fresh('cola', ['icecrit']); const e = target(); G.player.crit = 1; Math.random = () => 0; hit(e);
  assert(near(dealt(e), 200) && e.elFrostN === 1, '冰霜暴击没有叠寒霜');
});

test('雷电增伤与静电均奖励不同目标，雷电暴击额外传导', () => {
  fresh('arc', ['thunderdmg']); const es = [target(50), target(100), target(150), target(200)];
  for (const e of es) hit(e, 'arc');
  assert(es.every((e, i) => near(dealt(e), 100 + i * 8)), '不同目标雷电增伤错误：' + es.map(dealt).join(','));
  fresh('arc', ['thunderstatic']); const targets = [target(50), target(100), target(150), target(200)];
  for (const e of targets) hit(e, 'arc');
  assert(near(dealt(targets[3]), 160) && targets.slice(0, 3).every(e => near(dealt(e), 100)), '四目标静电雷错误');
  fresh('arc', ['thundercrit']); const first = target(80), second = target(140); G.player.crit = 0.1;
  let rolls = 0; Math.random = () => rolls++ === 0 ? 0 : 0.99; hit(first, 'arc');
  assert(near(dealt(first), 200) && near(dealt(second), 50), '雷电暴击传导错误：' + dealt(first) + '/' + dealt(second));
});

test('墨刺累计三次定身普通怪，暴击与收割连携保持原描述和冷却', () => {
  fresh('cyclone', ['areaspikes']); const e = target(); e.stunT = 0;
  G.R.spikeHit(e); G.R.spikeHit(e); assert(e.stunT === 0 && e.slowT > 0, '墨刺提前定身或没有减速');
  G.R.spikeHit(e); assert(e.stunT >= 0.35, '第三次墨刺没有定身');
  assert(G.supDesc('oncrit', 1) === '暴击时额外施放本技能，触发冷却 1.0 秒', '暴击连携被改动');
  assert(G.supDesc('onkill', 1) === '怪物死亡时额外施放本技能，触发冷却 1.0 秒', '收割连携被改动');
  assert(near(G.T.cooldownFor({ lvl: 1 }, G.player.actives[0]), 1), '连携冷却被改动');
});

test('三选一同模板互斥、近期与已选同类降权，重做词条均算机制卡', () => {
  const p = fresh('cyclone'); p.actives[0].supports = [];
  const pool = [
    { kind: 'support', skill: 'cyclone', sup: 'onabsorb' }, { kind: 'support', skill: 'cyclone', sup: 'ondive' },
    { kind: 'support', skill: 'cyclone', sup: 'onsurge' }, { kind: 'support', skill: 'cyclone', sup: 'multi' },
    { kind: 'support', skill: 'cyclone', sup: 'sharpen' }, { kind: 'support', skill: 'cyclone', sup: 'sheath' }
  ];
  for (let i = 0; i < 100; i++) {
    const picks = G.D.pick(pool, 3), groups = picks.map(G.D.category).filter(Boolean);
    assert(new Set(groups).size === groups.length, '同轮出现重复模板：' + groups.join(','));
  }
  for (const id of ['swift', 'sharpen', 'heavynib', 'saturate', 'sheath', 'heavyweight', 'scrit', 'sweep', 'physdmg', 'firecrit'])
    assert(G.D.isMechanism({ kind: 'support', skill: 'cyclone', sup: id }), id + ' 仍被算作纯数值');
  G.D.state.recentCards = [];
  const card = { kind: 'support', skill: 'cyclone', sup: 'multi' }, base = G.D.score(card);
  G.D.state.recentCards = [['support::multi:cyclone']]; assert(G.D.score(card) < base * 0.25, '近期词条没有降权');
  G.D.state.recentCards = []; p.actives[0].supports = [{ id: 'onabsorb', lvl: 1 }, { id: 'ondive', lvl: 1 }];
  const linked = { kind: 'support', skill: 'cyclone', sup: 'onsurge' };
  assert(G.D.score(linked) < 1.15 * 0.4, '已选两个同类辅助后没有降权');
});

console.log(failed ? 'AFFIX_DEDUP_FAILURES: ' + failed : 'AFFIX_DEDUP_OK (' + passed + '/' + passed + ')');
process.exit(failed ? 1 : 0);

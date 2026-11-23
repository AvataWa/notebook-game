// 最终网页运行时词条集成审计：全部辅助与装备的实际施放、命中、更新和基础结算。
const fs = require('fs');
const files = ['battle-config.js', 'enemy-config.js', 'content-config.js', 'boss-collection-config.js', 'main.js',
  'build-runtime.js', 'hades-runtime.js', 'hades-weapons-runtime.js', 'weapon-passives-expansion.js', 'form-passives-runtime.js',
  'evolution-runtime.js', 'support-expansion-runtime.js', 'cyclone-support-runtime.js', 'elemental-support-runtime.js',
  'trigger-support-runtime.js', 'build-view.js', 'meta-config.js', 'equipment-rework-runtime.js', 'boss-set-runtime.js',
  'build-optimization-runtime.js', 'affix-dedup-runtime.js', 'boss-collection-runtime.js', 'boss-set-mechanics-a.js',
  'boss-set-mechanics-b.js', 'meta-runtime.js'];
const src = files.map(f => fs.readFileSync(__dirname + '/' + f, 'utf8').replace("'use strict';", '')).join('\n');
const fakeCtx = new Proxy({}, { get(t, k) {
  if (k === 'measureText') return txt => ({ width: String(txt).length * 8 });
  return () => {};
}, set() { return true; } });
const fakeCanvas = { getContext: () => fakeCtx, width: 0, height: 0, style: {}, addEventListener() {},
  getBoundingClientRect: () => ({ left: 0, top: 0, width: 375, height: 667 }) };
const stored = {};
global.localStorage = { getItem: k => stored[k] || null, setItem: (k, v) => { stored[k] = String(v); }, removeItem: k => { delete stored[k]; } };
global.window = { addEventListener() {}, devicePixelRatio: 1, innerWidth: 375, innerHeight: 667 };
global.document = { getElementById: () => fakeCanvas, createElement: () => fakeCanvas };
global.requestAnimationFrame = () => {};
eval(src + `\n;globalThis.G = {
  resetGame, update, render, skillCalc, fireSkill, hurtEnemy, hurtPlayer, spawnEnemy, killEnemy, areaHit,
  supportUsable, supDesc, recomputeEquip, itemV, itemValues, itemDescription, equipmentBaseStats,
  castAbsorb, castInkSurge, enterDive, exitDive, convertGrayDisk, addInkStain, addHostileInk, chargeParry,
  get SUPPORTS() { return SUPPORTS; }, get SKILL_DEFS() { return SKILL_DEFS; }, get SKILL_TAGS() { return SKILL_TAGS; },
  get ITEM_DEFS() { return ITEM_DEFS; }, get ITEM_KEYS() { return EQUIPMENT_ITEM_KEYS; },
  get player() { return player; }, set player(v) { player = v; }, get enemies() { return enemies; },
  get bullets() { return bullets; }, get floats() { return floats; }, get state() { return state; }, set state(v) { state = v; },
  get gameTime() { return gameTime; }, set gameTime(v) { gameTime = v; }, get meta() { return window.__metaRuntime; },
  get R() { return window.BossCollectionRuntime; }, get O() { return window.BuildOptimizationRuntime; },
  get D() { return window.AffixDedupRuntime; }, get E() { return window.__elementalSupports; },
  get X() { return window.__supportExpansion; }, get T() { return window.__triggerSupport; },
  get totems() { return totems; }, get minions() { return minions; }, get keys() { return keys; }, get BATTLE() { return BATTLE; }
};`);
const M = G.meta;
let passed = 0, failed = 0;
const failures = [];
function test(name, fn) { try { fn(); passed++; console.log('OK  ' + name); } catch (e) { failed++; failures.push(name + ': ' + e.message); console.log('ERR ' + name + ': ' + e.stack.split('\n').slice(0, 3).join('\n')); } }
function assert(ok, msg) { if (!ok) throw new Error(msg); }
function near(a, b, eps = 0.01) { return Math.abs(a - b) < eps; }
function finiteTree(value, path = 'value', seen = new Set()) {
  if (typeof value === 'number') { assert(Number.isFinite(value), path + ' 不是有限数：' + value); return; }
  if (!value || typeof value !== 'object' || seen.has(value)) return;
  seen.add(value);
  for (const [k, v] of Object.entries(value)) if (typeof v === 'number') assert(Number.isFinite(v), path + '.' + k + ' 不是有限数：' + v);
}
function fresh(id = 'cyclone', supports = []) {
  M.resetAll(); M.beginRun(); G.state = 'play'; G.gameTime = 0;
  const p = G.player; p.xpNext = 999999; p.hp = p.maxhp = 99999; p.ink = p.maxInk = 999;
  p.crit = 0; p.eqCrit = 0; p.characterId = 'draft';
  p.actives = [{ id, lvl: 1, supports: supports.map(s => Array.isArray(s) ? { id: s[0], lvl: s[1] } : { id: s, lvl: 1 }), t: 999, uc: 0 }];
  return p;
}
function target(x = 100, y = 0) {
  G.spawnEnemy('stick', x, y); const e = G.enemies[G.enemies.length - 1];
  e.x = x; e.y = y; e.hp = e.maxhp = 999999; e.stunT = 999; e.r = 8; e.dmg = 0; e.sp = 0; return e;
}
function calc(a) { return G.skillCalc(a || G.player.actives[0]); }
function cast(a) { a = a || G.player.actives[0]; const c = calc(a); return { result: G.fireSkill(a, c), c }; }
function hit(e, amount = 100, skill) { G.hurtEnemy(e, amount, 0, 0, 0, 0, 0, 0, '#000', false, skill || G.player.actives[0].id); }
function dealt(e) { return e.maxhp - e.hp; }
function equip(key, rarity) {
  const def = G.ITEM_DEFS[key]; rarity = rarity === undefined ? (def.bossSet ? 3 : 0) : rarity;
  G.player.equip[def.slot] = { key, rarity, roll: 100, rerollFloor: 50 }; G.recomputeEquip();
  G.player.hp = G.player.maxhp = Math.max(99999, G.player.maxhp); G.player.ink = G.player.maxInk = 999;
}

test('最终运行时包含 71 条辅助和 132 件装备', () => {
  assert(Object.keys(G.SUPPORTS).length === 71, '辅助数=' + Object.keys(G.SUPPORTS).length);
  assert(G.ITEM_KEYS.length === 132 && Object.keys(G.ITEM_DEFS).length === 132, '装备数=' + G.ITEM_KEYS.length);
});

test('全部 71 条辅助：适配、描述、计算、施放、命中与更新均真实执行', () => {
  for (const [sid, def] of Object.entries(G.SUPPORTS)) {
    const skill = Object.keys(G.SKILL_DEFS).find(id => G.supportUsable(sid, id));
    assert(skill, sid + '（' + def.name + '）没有任何可镶嵌主动');
    const p = fresh(skill, [sid]); const a = p.actives[0];
    const text = G.supDesc(sid, 1);
    assert(text && !/undefined|NaN/.test(text), sid + ' 描述异常：' + text);
    const c = calc(a); finiteTree(c, sid + '.skillCalc');
    const e = target(90); cast(a); hit(e, 100, skill); G.update(0.02);
    finiteTree(p, sid + '.player'); finiteTree(e, sid + '.enemy');
  }
});

test('全部 132 件装备：四品质描述有效，单穿基础属性与战斗更新正确', () => {
  for (const key of G.ITEM_KEYS) {
    const def = G.ITEM_DEFS[key];
    for (let rarity = 0; rarity < 4; rarity++) for (const roll of [50, 100]) {
      const text = G.itemDescription(key, rarity, roll);
      assert(text && !/undefined|NaN/.test(text), key + ' 描述异常：' + text);
      const values = G.itemValues(key, rarity, roll); finiteTree(values, key + '.itemValues');
    }
    fresh(); equip(key); const p = G.player, eq = p.equip[def.slot], base = G.equipmentBaseStats(eq);
    assert(p.eqAtk === base.atk, key + ' 攻击基础值错误：' + p.eqAtk + '/' + base.atk);
    assert(p.eqSpd >= 1 && Number.isFinite(p.eqSpd), key + ' 移速结算异常');
    const e = target(100); cast(); hit(e); G.update(0.02);
    finiteTree(p, key + '.player'); finiteTree(e, key + '.enemy');
  }
});

test('作者握笔单穿：不同主动积累书写进度并实际增伤，重复主动重新累计', () => {
  const p = fresh('cyclone'); equip('authorpen');
  for (const id of ['tornado', 'arc', 'pageslash']) p.actives.push({ id, lvl: 1, supports: [], t: 999, uc: 0 });
  const base = calc(p.actives[2]).dmg;
  cast(p.actives[0]); cast(p.actives[1]);
  assert(G.R.state('author').sequence === 2, '单穿没有积累书写进度');
  assert(near(calc(p.actives[2]).dmg, base * 1.08), '两层书写进度没有提供 8% 增伤：' + calc(p.actives[2]).dmg + '/' + base);
  cast(p.actives[1]);
  assert(G.R.state('author').sequence === 1 && near(calc(p.actives[2]).dmg, base * 1.04), '重复主动没有重新累计');
});

test('作者书签单穿：依次四个主动真实回墨并写出终页', () => {
  const p = fresh('cyclone'); equip('authorbookmark'); p.ink = 0;
  for (const id of ['tornado', 'arc', 'pageslash']) p.actives.push({ id, lvl: 1, supports: [], t: 999, uc: 0 });
  for (const a of p.actives) cast(a);
  assert(G.R.state('author').pageReady, '单穿书签不能写出终页');
  assert(p.ink >= 8, '四次不同主动没有回墨：' + p.ink);
});

test('育母树冠：原有炮台和套装荚果都视为召唤物，无召唤物不增伤', () => {
  let p = fresh('ballista'); equip('podcrown'); let noSummon = calc().dmg;
  cast(); assert(G.totems.length > 0, '炮台未生成');
  assert(near(calc().dmg, noSummon * 1.16), '炮台存在时树冠没有增伤：' + calc().dmg + '/' + noSummon);
  p = fresh('cyclone'); equip('podcrown'); equip('podboots'); noSummon = calc().dmg;
  for (let i = 0; i < 4; i++) cast();
  assert((G.R.state('pods').pods || []).length > 0, '套装荚果未生成');
  assert(near(calc().dmg, noSummon * 1.16), '荚果存在时树冠没有增伤：' + calc().dmg + '/' + noSummon);
});

test('鞋子条件增速只结算一次，并同时进入实际位移与移速转化', () => {
  const p = fresh('cyclone'); equip('eraserboots'); p.diving = true;
  assert(near(G.O.conditionalShoeSpeed(), 15) && near(G.O.extraSpeed(), 27), '潜墨增速汇总错误');
  p.x = 0; p.y = 0; G.keys.d = true; const x = p.x; G.update(0.1); G.keys.d = false;
  const expected = p.speed * p.eqSpd * G.BATTLE.dive.speed * 1.15 * G.BATTLE.dive.offOwnSpeed * 0.1;
  assert(near(p.x - x, expected, 0.1), '潜墨实际位移与描述不一致：' + (p.x - x) + '/' + expected);
});

test('最终组合辅助：近距子弹、远距暴击和三敌覆盖均按条件结算', () => {
  fresh('tornado', ['sharpen']); const close = target(100), far = target(300);
  hit(close, 100, 'tornado'); hit(far, 100, 'tornado');
  assert(near(dealt(close), 135) && near(dealt(far), 100), '近距子弹条件错误');
  const oldRandom = Math.random;
  try {
    fresh('tornado', ['heavynib']); const nearE = target(0), farE = target(600); Math.random = () => .15;
    hit(nearE, 100, 'tornado'); hit(farE, 100, 'tornado');
    assert(near(dealt(nearE), 100) && near(dealt(farE), 200), '远距暴击条件错误');
  } finally { Math.random = oldRandom; }
  fresh('cyclone', ['saturate']); const es = [target(20), target(35), target(50)], c = calc();
  for (const e of es) G.areaHit(e, 100, c, 0, 0, 150, 20);
  assert(es.every(e => near(dealt(e), 125)), '三敌覆盖没有全部增伤');
});

test('最终组合辅助：技能轮转与范围结束返还只触发一次', () => {
  const p = fresh('cyclone'); target(); const first = p.actives[0];
  const second = { id: 'arc', lvl: 1, supports: [{ id: 'swift', lvl: 1 }], t: 100, uc: 0 };
  p.actives.push(second); first.t = 100; cast(first); const before = first.t; cast(second);
  const refund = before - first.t;
  assert(near(refund, .45 * calc(first).cd * .08, .001), '轮转返还比例错误：' + refund);
  const settled = first.t; cast(second); assert(near(first.t, settled), '重复技能仍然返还');
  const rain = fresh('inkrain', ['sheath']), a = rain.actives[0]; a.t = 10; target(80); target(100);
  const casted = cast(a); G.areaHit(G.enemies[0], 10, casted.c, 80, 0, 55, 0); G.areaHit(G.enemies[1], 10, casted.c, 100, 0, 55, 0);
  const rainBefore = a.t; G.D.state.sheathCasts[0].t = .001; G.update(.01);
  assert(rainBefore - a.t > .05 && G.D.state.sheathCasts.length === 0, '范围结束返还未结算');
});

test('最终组合辅助：物理、火焰与雷电暴击保留各自机制', () => {
  const oldRandom = Math.random;
  try {
    fresh('cyclone', ['physcrit']); const physical = target(); physical.stunT = 0; G.player.crit = 1; Math.random = () => 0;
    hit(physical); assert(near(dealt(physical), 200) && physical.stunT >= .25 && physical.dedupPressureN === 1, '物理暴击机制错误');
    fresh('volcanic', ['firecrit']); const first = target(80), second = target(140); G.player.crit = 1; Math.random = () => 0;
    hit(first, 100, 'volcanic'); assert(near(dealt(first), 200) && second.elBurns && second.elBurns.length === 1, '火焰暴击传播错误');
    fresh('arc', ['thundercrit']); const third = target(80), fourth = target(140); G.player.crit = .1;
    let rolls = 0; Math.random = () => rolls++ === 0 ? 0 : .99; hit(third, 100, 'arc');
    assert(near(dealt(third), 200) && near(dealt(fourth), 50), '雷电暴击传导错误');
  } finally { Math.random = oldRandom; }
  assert(G.supDesc('oncrit', 1) === '暴击时额外施放本技能，触发间隔 1.0 秒', '暴击连携被改动');
  assert(G.supDesc('onkill', 1) === '怪物死亡时额外施放本技能，触发间隔 1.0 秒', '收割连携被改动');
});

test('Boss 头部和手部：条件增伤使用同一装备基准进行对照', () => {
  const p = fresh('cyclone'); equip('tapehelm'); const boosted = calc().dmg, head = p.equip.head;
  p.equip.head = null; const base = calc().dmg; p.equip.head = head;
  assert(near(boosted, base * (1 + G.itemV('tapehelm', 'activeDmg') / 100)), '范围头部增伤错误');
  fresh('tornado'); equip('dragonclaw'); const hands = G.player.equip.hands;
  G.player.equip.hands = null; const plain = target(100); hit(plain, 100, 'tornado'); G.player.equip.hands = hands;
  const buffed = target(100); hit(buffed, 100, 'tornado');
  assert(near(dealt(buffed), dealt(plain) * (1 + G.itemV('dragonclaw', 'projDmg') / 100)), '子弹手部增伤错误');
});

test('Boss 饰品：首次命中与第四次施放的单件回墨均真实到账', () => {
  let p = fresh('cyclone'); equip('judgeseal'); p.ink = 0; const e = target(100); cast();
  hit(e); const expected = G.itemV('judgeseal', 'castInk');
  assert(near(p.ink, expected), '首次命中回墨错误：' + p.ink + '/' + expected);
  hit(e); assert(near(p.ink, expected), '同一施放重复回墨');
  p = fresh('cyclone'); equip('tapecore'); p.ink = 0;
  for (let i = 0; i < 4; i++) cast();
  assert(near(p.ink, G.itemV('tapecore', 'castInk')), '第四次施放回墨错误：' + p.ink);
});

console.log(failed ? 'EFFECT_INTEGRATION_FAILURES: ' + failed + '\n' + failures.join('\n') : 'EFFECT_INTEGRATION_OK (' + passed + '/' + passed + ')');
process.exit(failed ? 1 : 0);

// 四个老主动进化与三选一导演专项测试
const fs = require('fs');
const files = [
  'battle-config.js', 'enemy-config.js', 'content-config.js', 'main.js', 'build-runtime.js',
  'hades-runtime.js', 'hades-weapons-runtime.js', 'weapon-passives-expansion.js',
  'form-passives-runtime.js', 'evolution-runtime.js', 'support-expansion-runtime.js',
  'elemental-support-runtime.js', 'trigger-support-runtime.js', 'build-view.js',
  'meta-config.js', 'character-config.js', 'dive-counter-runtime.js', 'combat-feel-runtime.js',
  'equipment-rework-runtime.js', 'meta-runtime.js', 'character-runtime.js', 'idle-runtime.js',
  'ui-copy.js', 'ui-detail-runtime.js', 'desktop-runtime.js', 'loadout-runtime.js',
  'acquisition-runtime.js', 'option-director-runtime.js'
];
const src = files.map(f => fs.readFileSync(__dirname + '/' + f, 'utf8').replace("'use strict';", '')).join('\n');
const fakeCtx = new Proxy({}, { get(t, k) {
  if (k === 'measureText') return txt => ({ width: String(txt).length * 10 });
  return () => {};
}, set() { return true; } });
const fakeCanvas = {
  getContext: () => fakeCtx, width: 0, height: 0, style: {}, addEventListener() {},
  setPointerCapture() {}, releasePointerCapture() {},
  getBoundingClientRect: () => ({ left: 0, top: 0, right: 375, bottom: 667, width: 375, height: 667 })
};
const stored = Object.create(null);
global.localStorage = { getItem: k => stored[k] || null, setItem: (k, v) => { stored[k] = String(v); }, removeItem: k => { delete stored[k]; } };
global.window = global;
global.PointerEvent = function PointerEvent() {};
Object.assign(global, {
  addEventListener() {}, devicePixelRatio: 1, innerWidth: 375, innerHeight: 667,
  matchMedia: () => ({ matches: true })
});
global.document = { getElementById: () => fakeCanvas, createElement: () => fakeCanvas };
global.requestAnimationFrame = () => {};
eval(src + `\n;globalThis.G = {
  resetGame, update, fireSkill, skillCalc, spawnEnemy, hurtEnemy, killEnemy, buildOptions,
  get player() { return player; }, get enemies() { return enemies; }, get bullets() { return bullets; },
  get clouds() { return clouds; }, get totems() { return totems; }, get minions() { return minions; },
  get lightnings() { return lightnings; }, get cards() { return cards; },
  get state() { return state; }, set state(v) { state = v; },
  get gameTime() { return gameTime; }, set gameTime(v) { gameTime = v; },
  get SKILL_EVOLUTIONS() { return SKILL_EVOLUTIONS; },
  get E() { return window.EvolutionRuntime; }, get D() { return window.OptionDirectorRuntime; }
};`);
let failed = 0, passed = 0;
const realRandom = Math.random;
function test(name, fn) {
  try { fn(); passed++; console.log('OK  ' + name); }
  catch (e) { failed++; console.log('ERR ' + name + ': ' + e.stack.split('\n')[0]); }
  finally { Math.random = realRandom; }
}
function assert(ok, msg) { if (!ok) throw new Error(msg); }
function near(a, b, eps = 0.001) { return Math.abs(a - b) < eps; }
function fresh(id, lvl = 1, supports = []) {
  G.resetGame(); G.state = 'play'; G.gameTime = 0;
  G.player.xpNext = 999999; G.player.hp = G.player.maxhp = 99999;
  G.player.characterId = 'draft'; G.player.characterLevel = 1;
  G.player.actives = [{ id, lvl, supports: supports.map(s => ({ id: s, lvl: 1 })), t: 999, uc: 0 }];
  return G.player;
}
function target(x = 100, y = 0, hp = 9999) {
  G.spawnEnemy('stick', x, y);
  const e = G.enemies[G.enemies.length - 1];
  e.hp = e.maxhp = hp; e.stunT = 999; e.r = 5; e.dmg = 0;
  return e;
}
function cast() { const a = G.player.actives[0]; return G.fireSkill(a, G.skillCalc(a)); }
function chainHit(b, e) {
  G.E.beforeChainHit(b, e);
  const dealt = b.dmg;
  G.hurtEnemy(e, dealt, 0, b.x, b.y, 0, 0, 0, b.col, false, 'chainclip');
  b.chainLeft--;
  G.E.afterChainHit(b, e);
  return dealt;
}
function optionPool() {
  return [
    { kind: 'active+', skill: 'ruler', name: 'ruler+' },
    { kind: 'support', skill: 'ruler', sup: 'brutal', name: 'brutal' },
    { kind: 'support', skill: 'ruler', sup: 'followup', name: 'followup' },
    { kind: 'active', id: 'cola', name: 'cola' },
    { kind: 'passive', id: 'dmg', name: 'dmg' },
    { kind: 'passive', id: 'spd', name: 'spd' }
  ];
}

test('三个保留主动均有三级与五级进化文案', () => {
  for (const id of ['chainclip', 'ballista', 'inkrain']) {
    assert(G.SKILL_EVOLUTIONS[id] && G.SKILL_EVOLUTIONS[id][3] && G.SKILL_EVOLUTIONS[id][5], id + ' 缺少进化');
  }
});

test('回形针回跳消耗电荷但不消耗连锁次数', () => {
  fresh('chainclip', 3); const a = target(70), b = target(130); cast();
  const bullet = G.bullets[0], initialLeft = bullet.chainLeft, base = bullet.dmg;
  chainHit(bullet, a);
  const dealt = chainHit(bullet, a);
  assert(bullet.evoChain.used === 1 && bullet.evoChain.charges === 0, '电荷消耗错误');
  assert(bullet.chainLeft === initialLeft - 1 && near(dealt, base * 0.55), '回跳仍消耗连锁或伤害错误');
  assert(bullet.evoChain.hitIds.length === 1 && b.hp === b.maxhp, '回跳错误记录了新目标或误伤其他目标');
});

test('回形针三名不同目标触发一次闭链且不递归', () => {
  fresh('chainclip', 5, ['chain']);
  const a = target(60), b = target(120), c = target(180); cast();
  const bullet = G.bullets[0];
  chainHit(bullet, a); chainHit(bullet, b); chainHit(bullet, c);
  const closed = G.lightnings.filter(l => l.evoDerived);
  assert(bullet.evoChain.closed && closed.length === 2, '闭链没有生成首末两段伤害');
  assert(closed.every(l => near(l.dmg, bullet.evoChain.baseDmg * 0.4) && l.c.hadesSkill === 'chainclip'), '闭链伤害或来源错误');
  chainHit(bullet, a);
  assert(G.lightnings.filter(l => l.evoDerived).length === 2, '闭链重复触发');
});

test('炮台三层集火获得穿透，续火保留三层且有独立冷却', () => {
  fresh('ballista', 5); const first = target(100); cast();
  const tt = G.totems[0]; tt.sameId = first.id; tt.ramp = 4; tt.fireCd = 2;
  G.E.updateTotems();
  assert(tt.pierce === (tt.evoBasePierce || 0) + 1, '三层集火未获得穿透');
  G.killEnemy(first); const second = target(130); G.gameTime = 1;
  const before = G.bullets.length; G.E.updateTotems();
  assert(G.bullets.length === before + 2 && tt.ramp === 3 && tt.sameId === second.id, '续火补射或集火保留错误');
  assert(G.bullets.slice(-2).every(b => near(b.dmg, tt.dmg * 0.5) && b._noExpand), '补射伤害或防增殖标记错误');
  G.E.updateTotems();
  assert(G.bullets.length === before + 2 && near(tt.evoVolleyReady, 2.5), '续火未进入 1.5 秒冷却');
});

test('毒云合并伤害、半径和次数上限正确', () => {
  fresh('inkrain', 5); target(); cast();
  assert(G.clouds.length === 3, '基础毒云数量错误');
  for (const cl of G.clouds) { cl.x = 100; cl.y = 100; cl.t = 2.5; }
  const firstDmg = G.clouds[0].dmg, total = G.clouds.reduce((n, cl) => n + cl.dmg, 0);
  G.E.mergeClouds();
  assert(G.clouds.length === 1, '三片重叠毒云未完成两次合并');
  const cl = G.clouds[0];
  assert(near(cl.dmg, firstDmg + (total - firstDmg) * 0.75) && cl.evoMerges === 2, '合并伤害或次数错误');
  assert(near(cl.r, Math.min(55 * cl.c.rad * 1.5, 55 * cl.c.rad * 1.2 * 1.2)), '两次合并半径或 1.5 倍上限错误');
});

test('毒云结束生成毒潭且毒潭总数不超过二十四', () => {
  fresh('inkrain', 5); target(); cast();
  const cl = G.clouds[0]; cl.x = 80; cl.y = 80; cl.t = 0.01;
  for (let i = 1; i < G.clouds.length; i++) G.clouds[i].t = 20;
  G.update(0.02);
  assert(G.E.state.puddles.length === 1, '毒云消失未生成毒潭');
  assert(near(G.E.state.puddles[0].dmg, cl.dmg * 0.6), '毒潭伤害不是毒云每跳的 60%');
  for (let i = 0; i < 30; i++) G.E.addPuddle(cl);
  assert(G.E.state.puddles.length === 24, '毒潭超过 24 个上限');
});

test('移动积雨云与等级进化共存并实际移动', () => {
  fresh('inkrain', 5); G.player.taken.form_inkrain = true; target(200, 0); cast();
  assert(G.clouds.every(cl => cl.formCloud && cl.evoLevel === 5), '形态毒云未获得进化标记');
  const cl = G.clouds[0], x = cl.x, y = cl.y;
  for (const other of G.clouds) { other.x += 1000; other.y += 1000; }
  G.update(0.5);
  assert(Math.hypot(cl.x - x, cl.y - y) > 5, '移动积雨云没有移动');
});

test('抽卡导演保留满栏 0.65 权重并设置进化与数值权重', () => {
  fresh('chainclip', 2);
  assert(near(G.D.score({ kind: 'active', id: 'cola', weight: 0.65 }), 0.65), '满栏主动权重被改变');
  assert(near(G.D.score({ kind: 'active+', skill: 'chainclip' }), 1.5), '三级进化权重不是 1.5');
  assert(near(G.D.score({ kind: 'support', skill: 'chainclip', sup: 'brutal' }), 0.75), '纯数值辅助权重不是 0.75');
  assert(near(G.D.score({ kind: 'support', skill: 'chainclip', sup: 'followup' }), 1.15), '机制辅助权重不是 1.15');
});

test('回血只替换自由槽且相关卡补偿下一轮必中', () => {
  fresh('ruler', 2); const pool = optionPool();
  Math.random = () => 0;
  let picks = G.D.pick(pool, 3);
  assert(picks.filter(c => c.kind === 'heal').length === 1 && picks[2].kind === 'heal', '回血数量或槽位错误');
  assert(picks.slice(0, 2).every(c => c.kind !== 'heal'), '回血覆盖了相关或机制槽');
  G.D.state.relatedMiss = false; Math.random = () => 0.99;
  picks = G.D.pick(pool, 1);
  assert(!G.D.isRelated(picks[0]) && G.D.state.relatedMiss, '未相关时没有记录补偿');
  Math.random = () => 0.99;
  const original = Math.random;
  let calls = 0; Math.random = () => calls++ === 0 ? 0 : 0.99;
  picks = G.D.pick(pool, 1);
  assert(G.D.isRelated(picks[0]) && !G.D.state.relatedMiss, '下一轮相关卡没有必中');
  Math.random = original;
});

test('五千次抽卡无重复，回血约三成且不会连续两轮无相关', () => {
  fresh('ruler', 2); G.D.state.relatedMiss = false; G.D.state.lastCards = [];
  let heals = 0, previousMiss = false;
  for (let i = 0; i < 5000; i++) {
    const picks = G.D.pick(optionPool(), 3);
    assert(new Set(picks.map(c => c.kind + ':' + (c.id || c.sup || ''))).size === picks.length, '第 ' + i + ' 次出现重复选项');
    assert(picks.length === 3, '第 ' + i + ' 次选项不足三张');
    const related = picks.some(G.D.isRelated);
    assert(!(previousMiss && !related), '连续两轮没有相关卡：' + JSON.stringify({ picks, state: G.D.state }));
    previousMiss = !related;
    if (picks.some(c => c.kind === 'heal')) {
      heals++;
      assert(picks[2].kind === 'heal', '回血出现在非自由槽');
    }
  }
  const ratio = heals / 5000;
  assert(ratio > 0.28 && ratio < 0.32, '回血概率异常：' + ratio);
});

console.log(failed ? 'EVOLUTION_DIRECTOR_FAILURES: ' + failed : 'EVOLUTION_DIRECTOR_OK (' + passed + '/' + passed + ')');
process.exit(failed ? 1 : 0);

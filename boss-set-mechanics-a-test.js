// 第 2—10 页九套：真实技能、命中、充能、延迟与受击钩子回归。
const fs = require('fs');
const files = ['battle-config.js', 'enemy-config.js', 'content-config.js', 'boss-collection-config.js', 'main.js', 'build-runtime.js', 'build-view.js',
  'equipment-rework-runtime.js', 'boss-set-runtime.js', 'build-optimization-runtime.js', 'boss-collection-runtime.js', 'boss-set-mechanics-a.js', 'meta-config.js', 'meta-runtime.js'];
const src = files.map(f => fs.readFileSync(__dirname + '/' + f, 'utf8').replace("'use strict';", '')).join('\n');
const fakeCtx = new Proxy({}, { get(t, k) { if (k === 'measureText') return () => ({ width: 10 }); return () => {}; }, set() { return true; } });
const fakeCanvas = { getContext: () => fakeCtx, width: 0, height: 0, style: {}, addEventListener() {}, getBoundingClientRect: () => ({ left: 0, top: 0, width: 375, height: 667 }) };
global.window = { addEventListener() {}, devicePixelRatio: 1, innerWidth: 375, innerHeight: 667 }; global.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
global.document = { getElementById: () => fakeCanvas, createElement: () => fakeCanvas }; global.requestAnimationFrame = () => {};
eval(src + `;globalThis.G = { resetGame, skillCalc, fireSkill, hurtEnemy, hurtPlayer, spawnEnemy, recomputeEquip, itemV,
  get player() { return player; }, get enemies() { return enemies; }, get state() { return state; }, set state(v) { state = v; },
  get meta() { return window.__metaRuntime; }, collection: BOSS_SET_COLLECTION };`);
const G = global.G, B = window.BossSetRuntime, R = window.BossCollectionRuntime, C = G.collection, M = G.meta;
let failed = 0, passed = 0;
function assert(ok, msg) { if (!ok) throw new Error(msg); }
function test(name, fn) { try { fn(); passed++; console.log('OK  ' + name); } catch (e) { failed++; console.log('ERR ' + name + ': ' + e.stack.split('\n').slice(0, 3).join('\n')); } }
function wear(set) { M.resetAll(); M.beginRun(); G.state = 'play'; for (const key of set.all) { M.addInventory({ key, rarity: set.purple.includes(key) ? 2 : 3, roll: 100 }); B.toggleEquip(key); } M.applyPlayer(); G.player.xpNext = 999999; }
function enemy(x = 90, y = 0) { G.spawnEnemy('stick', x, y); const e = G.enemies[G.enemies.length - 1]; e.x = x; e.y = y; e.hp = e.maxhp = 1000000; e.r = 16; return e; }
function cast(id = 'tornado') { const a = { id, lvl: 1, supports: [], t: 0, uc: 1 }; if (!G.player.actives.some(x => x.id === id)) G.player.actives.push(a); const c = G.skillCalc(a); G.fireSkill(a, c); return c; }
function casts(n, ids = ['tornado']) { for (let i = 0; i < n; i++) cast(ids[i % ids.length]); }

test('涂改堡垒：条件增伤、延迟爆裂、易伤纸甲与二次收束', () => {
  wear(C.byId.correction); const a = enemy(), b = enemy(145, 0); a.slowT = 2; const skill = { id: 'tornado', lvl: 1, supports: [] }, ordinary = G.skillCalc(skill).dmg;
  G.hurtEnemy(a, 100, 0, 0, 0, 0, -1, 0, undefined, false, 'tornado'); assert(a.maxhp - a.hp > 100, '灰墨／减速单件增伤未生效');
  casts(4); assert(R.fx.delays.some(x => x.id === 'correction'), '四主动未生成延迟涂改带'); R.updateFx(2.1);
  assert(a.bossSetMarks && a.bossSetMarks.correction > 0 && G.player.bossPaperShield > 0, '三件易伤或纸甲缺失');
  assert(b.hp < b.maxhp, '五件二次收束未命中其他目标');
});

test('朱笔终审：审判增伤、五层处刑、终审与连锁，受击可叠层', () => {
  wear(C.byId.judge); const a = enemy(), b = enemy(150, 0); G.hurtEnemy(a, 100, 0, 0, 0, 0, -1, 0, undefined, false, 'tornado');
  assert(a.judgeStacks === 1, '主动命中未叠审判'); const before = a.hp; G.hurtEnemy(a, 100, 0, 0, 0, 0, -1, 0, undefined, false, 'tornado'); assert(before - a.hp > 100, '指虎层数增伤无效');
  for (let i = 0; i < 3; i++) G.hurtEnemy(a, 100, 0, 0, 0, 0, -1, 0, undefined, false, 'tornado');
  assert(a.judgeStacks === 0 && a.bossSetMarks.judge > 0 && b.hp < b.maxhp, '处刑、终审或连锁缺失');
  G.player.hurtT = 0; G.player.goldT = 0; G.hurtPlayer(1, 'enemy', a); assert(a.judgeStacks >= 2, '官袍受击未附加审判');
});

test('空想星翼：受击积星、主动凝聚陨星、星墨域与小陨星', () => {
  wear(C.byId.dragon); const a = enemy(), b = enemy(135, 0); G.player.hurtT = 0; G.hurtPlayer(1, 'enemy', a); assert(R.state('dragon').stars === 2, '龙皮受击未积星');
  casts(3); assert(R.state('dragon').stars === 0 && R.fx.zones.some(z => z.id === 'dragon'), '五层陨星或星墨域未触发'); assert(b.hp < b.maxhp, '五件小陨星未弹射');
});

test('涂鸦列队：周期纸影、重复攻击、碰撞抵挡与消失冲锋', () => {
  wear(C.byId.knights); const a = enemy(120, 0); casts(4); const s = R.state('knights'); assert(s.shadow && s.shadow.block, '纸影或抵挡充能未生成');
  assert(R.consumeBlock('enemy', a) && !s.shadow.block, '纸影未消耗碰撞抵挡'); R.hooks.knights.update(.8); assert(a.hp < a.maxhp, '纸影没有重复攻击');
  R.hooks.knights.update(4); assert(!s.shadow, '纸影未正常消失');
});

test('元素墨域：擦灰充能、墨潮墨爆、墨域纸甲与弹射', () => {
  wear(C.byId.element); const a = enemy(60, 0), b = enemy(150, 0); for (let i = 0; i < 3; i++) R.hooks.element.onGray(0, 0, 20, 1, false);
  assert(R.state('element').charge === 3, '覆盖灰墨未充能'); R.hooks.element.onSurge(200, true);
  assert(R.state('element').charge === 0 && R.fx.zones.filter(z => z.id === 'element').length === 3, '墨潮未逐层墨爆'); assert(a.hp < a.maxhp && b.hp < b.maxhp && G.player.bossPaperShield > 0, '墨爆、弹射或纸甲缺失');
});

test('千纸龙翼：三道折返纸刃、返程易伤、纸甲与分裂', () => {
  wear(C.byId.origami); const a = enemy(150, 0); casts(4); assert(R.fx.projectiles.filter(p => p.id === 'origami').length === 3, '没有三道纸刃');
  R.updateFx(.65); assert(R.fx.projectiles.some(p => p.phase === 'back' || p.split), '纸刃未折返或分裂'); assert(G.player.bossPaperShield > 0, '折返纸甲未触发'); R.updateFx(.7); assert(a.hp < a.maxhp, '纸刃未实际命中');
});

test('暴走摩擦：跑鞋效率、受击充能、满摩擦爆发与反弹', () => {
  wear(C.byId.eraser); const a = enemy(), b = enemy(140, 0); R.hooks.eraser.onGray(0, 0, 20, 2, true); assert(R.state('eraser').friction === 60, '跑鞋擦灰效率错误');
  G.player.hurtT = 0; G.hurtPlayer(1, 'enemy', a); assert(R.state('eraser').friction === 85, '厚甲受击摩擦错误'); R.hooks.eraser.onGray(0, 0, 20, 1, true); cast();
  assert(R.state('eraser').friction === 0 && a.bossSetMarks.eraser > 0 && b.hp < b.maxhp, '碎屑爆发、擦痕或反弹缺失');
});

test('深渊万墨：灰墨充能、主动触手、减速墨域与延伸', () => {
  wear(C.byId.abyss); const a = enemy(), b = enemy(145, 0); for (let i = 0; i < 5; i++) R.hooks.abyss.onGray(); cast();
  assert(R.state('abyss').charge === 0 && R.fx.zones.some(z => z.id === 'abyss'), '触手或深渊墨域未生成'); R.updateFx(.1); assert(a.bossSetMarks.abyss > 0 && b.hp < b.maxhp, '深渊易伤或延伸缺失');
});

test('终页作者：不同主动写页、下一主动终页、纸甲回墨与临摹', () => {
  wear(C.byId.author); const a = enemy(), b = enemy(145, 0); const ids = ['tornado', 'ruler', 'chalk', 'arc']; casts(4, ids);
  assert(R.state('author').pageReady && G.player.bossPaperShield > 0, '四次不同主动未写完一页'); cast('tornado');
  assert(!R.state('author').pageReady && a.bossSetMarks.author > 0 && b.hp < b.maxhp, '下一主动终页或临摹缺失');
});

console.log(failed ? 'BOSS_MECHANICS_A_FAILURES: ' + failed : 'BOSS_MECHANICS_A_OK (' + passed + '/' + passed + ')'); process.exit(failed ? 1 : 0);

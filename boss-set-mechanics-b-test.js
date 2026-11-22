// 第 11—20 页十套：移动、潜墨、召唤、轨迹、直线与多形态机制回归。
const fs = require('fs');
const files = ['battle-config.js', 'enemy-config.js', 'content-config.js', 'boss-collection-config.js', 'main.js', 'build-runtime.js', 'build-view.js',
  'equipment-rework-runtime.js', 'boss-set-runtime.js', 'build-optimization-runtime.js', 'boss-collection-runtime.js', 'boss-set-mechanics-b.js', 'meta-config.js', 'meta-runtime.js'];
const src = files.map(f => fs.readFileSync(__dirname + '/' + f, 'utf8').replace("'use strict';", '')).join('\n');
const fakeCtx = new Proxy({}, { get(t, k) { if (k === 'measureText') return () => ({ width: 10 }); return () => {}; }, set() { return true; } });
const fakeCanvas = { getContext: () => fakeCtx, width: 0, height: 0, style: {}, addEventListener() {}, getBoundingClientRect: () => ({ left: 0, top: 0, width: 375, height: 667 }) };
global.window = { addEventListener() {}, devicePixelRatio: 1, innerWidth: 375, innerHeight: 667 }; global.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
global.document = { getElementById: () => fakeCanvas, createElement: () => fakeCanvas }; global.requestAnimationFrame = () => {};
eval(src + `;globalThis.G = { resetGame, skillCalc, fireSkill, hurtEnemy, hurtPlayer, spawnEnemy, recomputeEquip, exitDive,
  get player() { return player; }, get enemies() { return enemies; }, get state() { return state; }, set state(v) { state = v; },
  get meta() { return window.__metaRuntime; }, collection: BOSS_SET_COLLECTION };`);
const G = global.G, B = window.BossSetRuntime, R = window.BossCollectionRuntime, C = G.collection, M = G.meta;
let failed = 0, passed = 0;
function assert(ok, msg) { if (!ok) throw new Error(msg); }
function test(name, fn) { try { fn(); passed++; console.log('OK  ' + name); } catch (e) { failed++; console.log('ERR ' + name + ': ' + e.stack.split('\n').slice(0, 3).join('\n')); } }
function wear(set) { M.resetAll(); M.beginRun(); G.state = 'play'; for (const key of set.all) { M.addInventory({ key, rarity: set.purple.includes(key) ? 2 : 3, roll: 100 }); B.toggleEquip(key); } M.applyPlayer(); G.player.xpNext = 999999; }
function enemy(x = 90, y = 0) { G.spawnEnemy('stick', x, y); const e = G.enemies[G.enemies.length - 1]; e.x = x; e.y = y; e.hp = e.maxhp = 1000000; e.r = 16; return e; }
function cast(id = 'tornado') { const a = { id, lvl: 1, supports: [], t: 0, uc: 1 }; if (!G.player.actives.some(x => x.id === id)) G.player.actives.push(a); const c = G.skillCalc(a); G.fireSkill(a, c); return c; }
function casts(n) { for (let i = 0; i < n; i++) cast(); }

test('荒原猎踪：潜墨积层、受击猎踪、退出扑杀与折返', () => {
  wear(C.byId.feral); const a = enemy(70, 0), b = enemy(135, 0); G.player.diving = true; const s = R.state('feral');
  for (let i = 0; i < 3; i++) { const x = G.player.x; G.player.x += 75; R.hooks.feral.update(.2, x, G.player.y); }
  assert(s.tracks === 3, '潜墨移动未积三层'); G.player.diving = false; R.hooks.feral.onDiveExit(); R.updateFx(1);
  assert(s.tracks === 0 && a.bossSetMarks.feral > 0 && b.hp < b.maxhp, '扑杀、标记或折返缺失');
});

test('墨壳山甲：生命单件、墨壳减伤、受击壳震与内缩', () => {
  wear(C.byId.turtle); const a = enemy(), b = enemy(140, 0), hp = G.player.maxhp; assert(hp > 100, '山冠最大生命未生效'); R.state('turtle').shell = 2;
  G.player.hurtT = 0; G.hurtPlayer(1, 'enemy', a); assert(R.state('turtle').shell === 1 && a.bossSetMarks.turtle > 0 && b.hp < b.maxhp, '壳震、裂甲或内缩缺失'); assert(G.player.bossStaggerImmuneT > 0, '三件抗打断缺失');
});

test('缚根花笼：每五主动捕笼、延迟闭合、根缚与二次收束', () => {
  wear(C.byId.flower); const a = enemy(), b = enemy(145, 0); casts(5); assert(G.player.bossPaperShield > 0 && R.fx.delays.some(x => x.id === 'flower'), '捕笼未形成'); R.updateFx(1.3);
  assert(a.bossSetMarks.flower > 0 && a.slowT > 0 && b.hp < b.maxhp, '根缚、减速或二次收束缺失');
});

test('钉角车阵：直线积势、满层回墨、贯穿车道与平行副道', () => {
  wear(C.byId.rhino); const a = enemy(180, 0); const s = R.state('rhino');
  for (let i = 0; i < 3; i++) { const x = G.player.x; G.player.x += 110; R.hooks.rhino.update(.2, x, G.player.y); }
  assert(s.charge === 3 && s.fullRefund, '直线冲势或满层回墨状态错误'); cast(); assert(s.charge === 0 && R.fx.lines.some(l => l.color === C.byId.rhino.color), '车道未释放'); assert(a.hp < a.maxhp, '车道未实际命中');
});

test('百荚根网：周期播种、根网持续伤害、收缩爆裂与碰撞抵挡', () => {
  wear(C.byId.pods); const a = enemy(70, 0); casts(8); const s = R.state('pods'); assert(s.pods.length === 2 && s.pods.every(p => p.block), '荚果或抵挡充能缺失');
  R.hooks.pods.update(3.1); assert(a.hp < a.maxhp, '根网收缩未伤害'); assert(R.consumeBlock('enemy', a), '荚果未抵挡碰撞');
});

test('盲根回迹：潜墨轨迹、分段回放、纸甲与反向回声', () => {
  wear(C.byId.blind); const a = enemy(50, 0); G.player.diving = true; const s = R.state('blind');
  for (let i = 0; i < 4; i++) { const x = G.player.x; G.player.x += 35; R.hooks.blind.update(.1, x, G.player.y); }
  assert(s.path.length >= 3, '潜墨轨迹未记录'); G.player.diving = false; R.hooks.blind.onDiveExit(); assert(G.player.bossPaperShield > 0 && R.fx.delays.length >= 6, '正反向回放未排队'); R.updateFx(2); assert(a.hp < a.maxhp, '回放未实际造成伤害');
});

test('折光归羽：主动留羽、吸墨召回、折光标记与散射', () => {
  wear(C.byId.feather); const a = enemy(); G.hurtEnemy(a, 100, 0, 0, 0, 0, -1, 0, undefined, false, 'tornado'); assert(R.state('feather').feathers.length === 1, '主动命中未留下羽刃');
  R.hooks.feather.onAbsorb(); assert(R.fx.projectiles.some(p => p.id === 'feather' && p.phase === 'back') && G.player.bossPaperShield > 0, '归羽或纸甲未触发'); R.updateFx(.8); assert(a.hp < a.maxhp - 100, '羽刃召回未命中');
});

test('百眼象限：正交凝视不重复中心、网格纸甲与旋转凝视', () => {
  wear(C.byId.totem); const a = enemy(); casts(4); assert(R.fx.lines.filter(l => l.color === C.byId.totem.color).length === 4, '正交与旋转凝视数量错误'); assert(R.fx.zones.some(z => z.id === 'totem') && G.player.bossPaperShield > 0, '象限网格或纸甲缺失'); assert(a.hp < a.maxhp, '凝视未实际命中');
});

test('断线残月：每三主动存线、下一主动收刀、纸甲与交叉回放', () => {
  wear(C.byId.mantis); const a = enemy(), b = enemy(140, 0); casts(3); const s = R.state('mantis'); assert(s.armed && s.lines.length === 1 && G.player.bossPaperShield > 0, '截线未储存'); cast();
  assert(!s.armed && s.lines.length === 0 && a.bossSetMarks.mantis > 0, '下一主动未收刀或标记'); assert(R.fx.lines.filter(l => l.color === C.byId.mantis.color).length >= 2, '五件交叉回放缺失');
});

test('混生终稿：三联轮换、同目标混生标记、融合与循环回墨', () => {
  wear(C.byId.mother); const a = enemy(); casts(9); const s = R.state('mother'); assert(s.cycle === 3, '三次终稿未完整轮换'); assert(a.bossSetMarks.mother > 0, '三种终稿命中未触发混生标记'); assert(a.hp < a.maxhp, '终稿未实际伤害');
});

console.log(failed ? 'BOSS_MECHANICS_B_FAILURES: ' + failed : 'BOSS_MECHANICS_B_OK (' + passed + '/' + passed + ')'); process.exit(failed ? 1 : 0);

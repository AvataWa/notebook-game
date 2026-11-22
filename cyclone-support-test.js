// 连笔蜡笔四个专属辅助的机制、等级成长与防循环测试。
const fs = require('fs');
const src = ['battle-config.js', 'enemy-config.js', 'content-config.js', 'main.js', 'build-runtime.js',
  'hades-runtime.js', 'form-passives-runtime.js', 'support-expansion-runtime.js', 'cyclone-support-runtime.js',
  'elemental-support-runtime.js', 'trigger-support-runtime.js', 'build-optimization-runtime.js', 'affix-dedup-runtime.js']
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
  resetGame, fireSkill, skillCalc, spawnEnemy, spawnCycloneStroke, hurtEnemy, supportUsable, supDesc,
  get SUPPORTS() { return SUPPORTS; }, get player() { return player; }, get enemies() { return enemies; },
  get blades() { return blades; }, get gameTime() { return gameTime; }, set gameTime(v) { gameTime = v; },
  get C() { return window.__cycloneSupports; }
};`);
let failed = 0, passed = 0;
function test(name, fn) { try { fn(); passed++; console.log('OK  ' + name); } catch (e) { failed++; console.log('ERR ' + name + ': ' + e.stack.split('\n')[0]); } }
function assert(ok, msg) { if (!ok) throw new Error(msg); }
function near(a, b, eps = 0.001) { return Math.abs(a - b) < eps; }
function fresh(supports = []) {
  G.resetGame(); G.player.xpNext = 999999; G.player.hp = G.player.maxhp = 9999;
  G.player.actives = [{ id: 'cyclone', lvl: 1, supports: supports.map(id => ({ id, lvl: 1 })), t: 999, uc: 0 }];
}
function level(id, lvl) { G.player.actives[0].supports.find(sp => sp.id === id).lvl = lvl; }
function calc() { return G.skillCalc(G.player.actives[0]); }
function target(x, y = 0, r = 12) {
  G.spawnEnemy('stick', x, y); const e = G.enemies[G.enemies.length - 1];
  e.hp = e.maxhp = 9999; e.stunT = 999; e.sp = 0; e.r = r; return e;
}
function stroke(e, angle = 0) { return G.spawnCycloneStroke(calc(), angle, 1, 0, e, { angle }); }
function otherHit(e, skill = 'arc', dmg = 10) { G.hurtEnemy(e, dmg, 0, 0, 0, 0, 0, 0, '#000', false, skill); }

test('四个辅助仅开放给连笔蜡笔并写入独立结算参数', () => {
  fresh(['cycloneline', 'cycloneresidue', 'cycloneshards', 'cyclonedetonate']);
  assert(Object.keys(G.SUPPORTS).length === 71, '加入专属辅助后的总数不是 71');
  for (const id of G.C.ids) {
    assert(G.supportUsable(id, 'cyclone') && !G.supportUsable(id, 'arc'), id + ' 的专属匹配错误');
    assert(G.supDesc(id, 1).length > 10, id + ' 缺少描述');
  }
  const c = calc();
  assert(c.cycloneLine === 1 && c.cycloneResidue === 1 && c.cycloneShards === 1 && c.cycloneDetonate === 1, '辅助参数没有进入技能结算');
});

test('一线到底 Lv1 同线三怪直接刮蜡，两怪仍只厚涂', () => {
  fresh(['cycloneline']); const a = target(120), b = target(140), c = target(160);
  stroke(a);
  assert(a.waxScrapes === 1 && b.waxScrapes === 1 && c.waxScrapes === 1, '同线三怪没有全部直接刮蜡');
  assert([a, b, c].every(e => e.waxStacks === 0 && near(e.maxhp - e.hp, 29)), '三怪刮蜡后的层数或伤害错误');
  fresh(['cycloneline']); const d = target(120), e = target(140); stroke(d);
  assert(d.waxStacks === 2 && e.waxStacks === 2 && !d.waxScrapes && !e.waxScrapes, 'Lv1 两怪被错误直接刮蜡');
});

test('一线到底 Lv3 降低为两怪，Lv5 刮蜡后保留一层', () => {
  fresh(['cycloneline']); level('cycloneline', 3); const a = target(120), b = target(140); stroke(a);
  assert(a.waxScrapes === 1 && b.waxScrapes === 1 && a.waxStacks === 0, 'Lv3 同线两怪没有直接刮蜡');
  fresh(['cycloneline']); level('cycloneline', 5); const c = target(120), d = target(140); stroke(c);
  assert(c.waxScrapes === 1 && d.waxScrapes === 1 && c.waxStacks === 1 && d.waxStacks === 1, 'Lv5 没有保留一层蜡色');
});

test('残蜡刻痕等待主线消退，只让后来穿线的其他怪触发一次', () => {
  fresh(['cycloneresidue']); const main = target(120), crossing = target(240); stroke(main);
  assert(G.C.state.residuals.length === 1, '没有生成残蜡刻痕');
  const mainHp = main.hp, crossingHp = crossing.hp;
  G.C.updateEffects(0.2); assert(crossing.hp === crossingHp, '残线提前于主线消退结算');
  crossing.x = 120; G.C.updateEffects(0.33); const hp = crossing.hp;
  assert(crossing.hp < crossingHp && crossing.waxStacks === 1, '穿线怪物没有受伤并叠一层');
  assert(main.hp === mainHp && main.waxStacks === 1, '原主线目标被残线重复结算');
  G.C.updateEffects(0.5); assert(crossing.hp === hp, '同一怪物被同一条残线重复伤害');
});

test('飞屑刮刀沿原直线两端发射，命中叠层但不派生新蜡屑', () => {
  fresh(['cycloneshards']); const main = target(120), other = target(180); main.waxStacks = 2;
  stroke(main);
  assert(main.waxScrapes === 1 && G.C.state.shards.length === 2, '刮蜡没有向两端生成蜡屑');
  other.waxStacks = 2; G.C.updateEffects(0.25);
  assert(other.waxScrapes === 1 && other.waxStacks === 0, '蜡屑命中没有叠层并结算已有蜡色');
  assert(G.C.state.shards.length === 2, '蜡屑触发的刮蜡错误派生了新蜡屑');
  assert(G.C.state.shards.every(s => s.hit || s.phase === 'out'), '蜡屑飞行状态异常');
});

test('飞屑刮刀 Lv3 到达终点后折返一次', () => {
  fresh(['cycloneshards']); level('cycloneshards', 3); const main = target(120); main.waxStacks = 2; stroke(main);
  G.C.updateEffects(0.61);
  assert(G.C.state.shards.length === 2 && G.C.state.shards.every(s => s.phase === 'return' && s.dir), 'Lv3 蜡屑没有折返');
  G.C.updateEffects(0.61); assert(G.C.state.shards.length === 0, '折返后的蜡屑没有按寿命消失');
});

test('裂蜡批注让其他主动消耗两层并引爆，同目标间隔内不重复触发', () => {
  fresh(['cyclonedetonate']); const e = target(120); e.waxStacks = 2; e.waxAngle = 0;
  const hp = e.hp; otherHit(e);
  assert(near(hp - e.hp, 20.8), '其他主动命中没有附加 60% 刮蜡伤害：' + (hp - e.hp));
  assert(e.waxScrapes === 1 && e.waxStacks === 0 && e.cycloneDetonateAt === G.gameTime, '裂蜡没有消耗层数或记录间隔');
  const after = e.hp; otherHit(e); assert(near(after - e.hp, 10) && e.waxScrapes === 1, '触发间隔内重复引爆');
});

test('裂蜡批注不被蜡笔自身或非主动装备伤害触发，并能联动飞屑', () => {
  fresh(['cyclonedetonate', 'cycloneshards']); const e = target(120); e.waxStacks = 2;
  otherHit(e, 'cyclone'); assert(e.waxStacks === 2 && !e.waxScrapes && G.C.state.shards.length === 0, '蜡笔自身错误触发裂蜡');
  otherHit(e, 'other'); assert(e.waxStacks === 2 && !e.waxScrapes, '装备 other 伤害错误触发裂蜡');
  otherHit(e, 'arc'); assert(e.waxScrapes === 1 && G.C.state.shards.length === 2, '裂蜡没有联动飞屑刮刀');
});

console.log(failed ? 'CYCLONE_SUPPORT_TEST_FAILURES: ' + failed : 'CYCLONE_SUPPORT_TEST_OK (' + passed + '/' + passed + ')');
process.exit(failed ? 1 : 0);

// 怪物出招令牌：近战与远程共享普通名额，重击独立限流，连发持续占位
const src = ['battle-config.js', 'enemy-config.js', 'main.js']
  .map(f => require('fs').readFileSync(__dirname + '/' + f, 'utf8').replace("'use strict';", '')).join('\n');
const fakeCtx = new Proxy({}, {
  get(t, k) {
    if (k === 'measureText') return () => ({ width: 10 });
    if (k === 'createImageData') return (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) });
    return () => {};
  },
  set() { return true; }
});
const fakeCanvas = {
  getContext: () => fakeCtx, width: 0, height: 0, style: {}, addEventListener() {},
  getBoundingClientRect: () => ({ left: 0, top: 0, width: 375, height: 667 })
};
global.window = {
  addEventListener() {}, devicePixelRatio: 1, innerWidth: 375, innerHeight: 667,
  matchMedia: () => ({ matches: false })
};
global.document = { getElementById: () => fakeCanvas, createElement: () => fakeCanvas };
global.requestAnimationFrame = () => {};
eval(src + `
;globalThis.G = {
  resetGame, spawnEnemy, updateShooter, updateMeleeSwing, enemyAttackLimits, enemyAttackCounts,
  get player() { return player; }, get enemies() { return enemies; }, set state(v) { state = v; }
};`);
let failed = 0, passed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('OK  ' + name); }
  catch (e) { failed++; console.log('ERR ' + name + ': ' + e.message); }
}
function assert(ok, msg) { if (!ok) throw new Error(msg); }
function fresh(level = 1) { G.resetGame(); G.state = 'play'; G.player.level = level; }
function enemy(type, x = 0, y = 0) { G.spawnEnemy(type, x, y); return G.enemies[G.enemies.length - 1]; }
function startMelee(e) { e.swingCd = 0; G.updateMeleeSwing(e, 0.01); }

test('令牌数量按第 1、4、7、13 关分阶段提升', () => {
  const cases = [[1, 4, 1], [31, 5, 1], [61, 6, 1], [121, 7, 2]];
  for (const [level, normal, heavy] of cases) {
    fresh(level); const limits = G.enemyAttackLimits();
    assert(limits.normal === normal && limits.heavy === heavy,
      '等级 ' + level + ' 的令牌错误：' + JSON.stringify(limits));
  }
});

test('前期近战最多四只同时出招，结束后等待者补位', () => {
  fresh(); const group = Array.from({ length: 6 }, () => enemy('stick'));
  for (const e of group) startMelee(e);
  assert(group.filter(e => e.swingT > 0).length === 4, '同时挥击数不是 4');
  assert(G.enemyAttackCounts().normal === 4, '普通令牌占用统计错误');
  for (let i = 0; i < 4; i++) group[i].swingT = 0;
  startMelee(group[4]);
  assert(group[4].swingT > 0 && group[5].swingT === 0, '令牌释放后等待者没有按顺序补位');
});

test('近战与远程共用普通令牌', () => {
  fresh(); const melee = enemy('stick'), shooters = Array.from({ length: 4 }, () => enemy('pencilthrower', 0, -240));
  startMelee(melee);
  for (const e of shooters) { e.shotCd = 0; G.updateShooter(e, 0.01); }
  assert(melee.swingT > 0 && shooters.slice(0, 3).every(e => e.shotWindup > 0), '前四个攻击没有取得普通令牌');
  assert(shooters[3].shotWindup === 0, '第五个远程攻击越过普通令牌上限');
  assert(G.enemyAttackCounts().normal === 4, '近战与远程没有合并计数');
});

test('重击使用独立令牌，不挤占普通攻击名额', () => {
  fresh(); const first = enemy('scissors'), second = enemy('scissors');
  first.attackCount = second.attackCount = 2;
  startMelee(first); startMelee(second);
  assert(first.swingUnparryable && first.swingT > 0, '第一只剪刀怪没有发起重击');
  assert(second.swingT === 0, '第二只重击越过令牌上限');
  const normal = Array.from({ length: 5 }, () => enemy('stick'));
  for (const e of normal) startMelee(e);
  assert(normal.filter(e => e.swingT > 0).length === 4, '重击错误挤占普通令牌');
  const counts = G.enemyAttackCounts();
  assert(counts.normal === 4 && counts.heavy === 1, '普通与重击分类统计错误');
});

test('精英重弩在前摇和整段连发期间持续占用重击令牌', () => {
  fresh(); const crossbow = enemy('eliteCrossbow', 0, -280), scissors = enemy('scissors');
  crossbow.shotCount = 2; crossbow.shotCd = 0; scissors.attackCount = 2;
  G.updateShooter(crossbow, 0.01); startMelee(scissors);
  assert(crossbow.shotWindup > 0 && scissors.swingT === 0, '重弩前摇没有占用重击令牌');
  crossbow.shotWindup = 0.01; G.updateShooter(crossbow, 0.02);
  assert(crossbow.burstLeft === 3, '重弩连发没有开始');
  startMelee(scissors);
  assert(scissors.swingT === 0, '重弩连发期间错误释放重击令牌');
  G.updateShooter(crossbow, 0.01); G.updateShooter(crossbow, 0.19); G.updateShooter(crossbow, 0.19);
  assert(crossbow.burstLeft === 0, '测试连发没有结束');
  startMelee(scissors);
  assert(scissors.swingT > 0 && scissors.swingUnparryable, '连发结束后重击令牌没有释放');
});

test('终页允许七普通与两重击并行，超出部分继续等待', () => {
  fresh(121); const normal = Array.from({ length: 8 }, () => enemy('stick'));
  for (const e of normal) startMelee(e);
  const heavy = Array.from({ length: 3 }, () => enemy('scissors'));
  for (const e of heavy) { e.attackCount = 2; startMelee(e); }
  assert(normal.filter(e => e.swingT > 0).length === 7, '终页普通令牌不是 7');
  assert(heavy.filter(e => e.swingT > 0).length === 2, '终页重击令牌不是 2');
  const counts = G.enemyAttackCounts();
  assert(counts.normal === 7 && counts.heavy === 2, '终页并行统计错误：' + JSON.stringify(counts));
});

console.log(failed ? 'ATTACK_TOKEN_TEST_FAILURES: ' + failed : 'ATTACK_TOKEN_TEST_OK (' + passed + '/' + passed + ')');
process.exit(failed ? 1 : 0);

// 同屏怪物上限：普通怪、精英、召唤物与墨债统一受限，Boss 额外保留位置
const src = ['battle-config.js', 'enemy-config.js', 'content-config.js', 'main.js']
  .map(f => require('fs').readFileSync(__dirname + '/' + f, 'utf8').replace("'use strict';", '')).join('\n');
function makeCtx() {
  return new Proxy({}, {
    get(t, k) {
      if (k === 'measureText') return text => ({ width: String(text).length * 10 });
      if (k === 'createImageData') return (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) });
      return () => {};
    },
    set() { return true; }
  });
}
function makeCanvas() {
  const context = makeCtx();
  return {
    width: 0, height: 0, style: {}, getContext: () => context,
    addEventListener() {}, getBoundingClientRect: () => ({ left: 0, top: 0, width: 375, height: 667 })
  };
}
const mainCanvas = makeCanvas();
global.window = {
  addEventListener() {}, devicePixelRatio: 1, innerWidth: 375, innerHeight: 667,
  matchMedia: () => ({ matches: false })
};
global.document = { getElementById: () => mainCanvas, createElement: () => makeCanvas() };
global.requestAnimationFrame = () => {};
eval(src + `
;globalThis.G = {
  resetGame, spawnEnemy, summonMob, spawnBoss, spawnInkShade, updateBoss, normalEnemyCount, normalEnemyCap,
  get enemies() { return enemies; }, get player() { return player; }, set state(v) { state = v; }
};`);
let failed = 0;
function test(name, fn) { try { fn(); console.log('OK  ' + name); } catch (e) { failed++; console.log('ERR ' + name + ': ' + e.message); } }
function assert(ok, msg) { if (!ok) throw new Error(msg); }
function fresh(level = 1) { G.resetGame(); G.state = 'play'; G.player.level = level; }
function fill(count) {
  for (let i = 0; i < count; i++) G.spawnEnemy(i % 2 ? 'elitePencil' : 'stick', 200 + i, 200);
}

test('第 1 关 20 只，之后每关增加 10 只', () => {
  fresh(1); assert(G.normalEnemyCap() === 20, '第 1 关上限不是 20');
  fresh(11); assert(G.normalEnemyCap() === 30, '第 2 关上限不是 30');
  fresh(91); assert(G.normalEnemyCap() === 110, '第 10 关上限不是 110');
});

test('普通怪与精英合计严格停在当前关卡上限', () => {
  fresh(11); fill(40);
  assert(G.normalEnemyCount() === 30, '第 2 关存活非 Boss 数不是 30：' + G.normalEnemyCount());
  assert(G.enemies.length === 30, '怪物数组仍继续增长：' + G.enemies.length);
});

test('逐个召唤补到上限后停止，Boss 登场清空小怪并独立保留', () => {
  fresh(); fill(19);
  assert(G.summonMob('spider', 100, 100) !== null, '第 20 只召唤物未生成');
  assert(G.summonMob('spider', 110, 110) === null, '第 21 只普通怪未被拦截');
  G.spawnBoss(1);
  assert(G.normalEnemyCount() === 0, 'Boss 登场没有清空普通怪');
  assert(G.enemies.length === 1 && G.enemies.filter(e => e.boss).length === 1, 'Boss 没有独立保留');
});

test('满员时墨债生成失败且不改造已有怪物', () => {
  fresh(); fill(20);
  const before = G.enemies.map(e => ({ id: e.id, name: e.name, shade: e.shade }));
  assert(G.spawnInkShade('candle') === false, '满员时墨债仍报告生成成功');
  assert(G.enemies.length === 20, '满员墨债增加了怪物数量');
  assert(G.enemies.every((e, i) => e.id === before[i].id && e.name === before[i].name && e.shade === before[i].shade), '已有怪物被误改成墨债');
});

test('Boss 登场清空小怪后，召唤仍逐只补至上限', () => {
  fresh(); fill(18); G.spawnBoss(1);
  assert(G.normalEnemyCount() === 0, 'Boss 登场后仍残留普通怪');
  const boss = G.enemies[G.enemies.length - 1];
  assert(boss.arch === 'charger', '测试 Boss 不是召唤冲锋原型');
  boss.summonT = 0; G.updateBoss(boss, 0.01);
  assert(G.normalEnemyCount() === 4, 'Boss 登场后第一批召唤数不正确：' + G.normalEnemyCount());
  while (G.normalEnemyCount() < G.normalEnemyCap()) G.summonMob('spider', 100, 100);
  assert(G.summonMob('spider', 110, 110) === null, '召唤超过普通怪上限时未被拦截');
  assert(G.normalEnemyCount() === 20, '连续召唤后普通怪数量不是 20：' + G.normalEnemyCount());
  assert(G.enemies.length === 21 && G.enemies.filter(e => e.boss).length === 1, '总数不是 20 普通怪 + 1 Boss');
});

console.log(failed ? 'ENEMY_CAP_TEST_FAILURES: ' + failed : 'ENEMY_CAP_TEST_OK (5/5)');
process.exitCode = failed ? 1 : 0;

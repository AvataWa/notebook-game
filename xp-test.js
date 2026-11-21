// 经验回归：击杀直加、升级曲线、Boss 每级上限与旧经验珠清理
const src = require('fs').readFileSync(__dirname + '/enemy-config.js', 'utf8') + '\n' +
  require('fs').readFileSync(__dirname + '/main.js', 'utf8').replace("'use strict';", '');
const fakeCtx = new Proxy({}, {
  get(t, k) { if (k === 'measureText') return () => ({ width: 10 }); return () => {}; },
  set() { return true; }
});
const fakeCanvas = {
  getContext: () => fakeCtx, width: 0, height: 0, style: {},
  addEventListener() {}, getBoundingClientRect: () => ({ left: 0, top: 0, width: 375, height: 667 })
};
global.window = { addEventListener() {}, devicePixelRatio: 1, innerWidth: 375, innerHeight: 667 };
global.document = { getElementById: () => fakeCanvas };
global.requestAnimationFrame = () => {};

eval(src + `
;globalThis.G = {
  resetGame, update, killEnemy, spawnEnemy, spawnBoss, xpForNextLevel,
  get player() { return player; }, get enemies() { return enemies; },
  get drops() { return drops; }, get state() { return state; },
  get passives() { return PASSIVES; }, set state(v) { state = v; }
};`);

let failed = 0;
function test(name, fn) {
  try { fn(); console.log('OK  ' + name); }
  catch (e) { failed++; console.log('ERR ' + name + ': ' + e.message); }
}
function assert(ok, msg) { if (!ok) throw new Error(msg); }
function near(actual, expected) { return Math.abs(actual - expected) < 1e-8; }
function fresh() { G.resetGame(); G.state = 'play'; }

test('经验按页内等级递增，跨页只线性小增', () => {
  fresh();
  assert(G.player.xpNext === 26, '首级需求实际为 ' + G.player.xpNext);
  assert(G.xpForNextLevel(2) === 35, '2 级需求应为 35');
  assert(G.xpForNextLevel(10) === 107, '第 1 页 Boss 级需求应为 107');
  assert(G.xpForNextLevel(11) === 38 && G.xpForNextLevel(20) === 119, '第 2 页经验边界错误');
  assert(G.xpForNextLevel(91) === 134 && G.xpForNextLevel(99) === 206, '第 10 页经验没有受控');
});

test('远处怪物死亡也直接加经验，不再生成经验颗粒', () => {
  fresh(); G.player.xpNext = 999;
  G.spawnEnemy('stick', G.player.x + 400, G.player.y + 300);
  const e = G.enemies[G.enemies.length - 1], expected = e.xp;
  G.killEnemy(e);
  assert(near(G.player.xp, expected), '经验未直接到账');
  assert(!/\bgems\b|\bdropGem\b|\bxpBatchMultiplier\b/.test(src), '仍有经验颗粒或批量吸收逻辑');
});

test('普通击杀经验可正常升级并结转剩余经验', () => {
  fresh(); G.player.xp = 25;
  G.spawnEnemy('crumple', G.player.x, G.player.y);
  const e = G.enemies[G.enemies.length - 1];
  G.killEnemy(e); G.update(0.51);
  assert(G.player.level === 2 && G.state === 'levelup', '没有正常升级');
  assert(near(G.player.xp, e.xp - 1), '剩余经验结转错误');
  assert(G.player.xpNext === 35, '升级后需求未使用新曲线');
});

test('第 1 至 9 关 Boss 都只升一级，装备掉落仍保留', () => {
  for (let stage = 1; stage <= 9; stage++) {
    fresh();
    G.player.level = 7; G.player.xpNext = 80; G.player.xp = stage * 3;
    G.player.xpMul = 10; // 普通经验加成不能让 Boss 突破一级上限
    G.spawnBoss(stage);
    const boss = G.enemies[G.enemies.length - 1];
    G.killEnemy(boss); G.update(0.51);
    assert(G.player.level === 8, '第 ' + stage + ' 关 Boss 升到了 ' + G.player.level + ' 级');
    assert(G.player.xp === 0 && G.player.xpNext === G.xpForNextLevel(8), '第 ' + stage + ' 关 Boss 经验发生溢出');
    assert(G.state === 'levelup', '第 ' + stage + ' 关未进入升级界面');
    assert(G.drops.length === 1, '第 ' + stage + ' 关装备掉落被误删');
  }
});

test('原拾取被动改为普通击杀经验加成', () => {
  fresh(); G.player.xpNext = 999;
  const passive = G.passives.find(p => p.id === 'magnet');
  assert(passive.name === '灵感' && passive.desc.includes('击杀经验'), '被动说明未更新');
  passive.fx();
  assert(near(G.player.xpMul, 1.15), '经验倍率错误');
  G.spawnEnemy('stick', G.player.x, G.player.y);
  const e = G.enemies[G.enemies.length - 1];
  G.killEnemy(e);
  assert(near(G.player.xp, e.xp * 1.15), '经验加成未直接生效');
});

test('全 100 级节奏模拟：90 次普通升级与 10 次 Boss 补级经验受控', () => {
  const pages = Array(10).fill(0), localNeeds = Array.from({ length: 10 }, () => []);
  let regular = 0, bosses = 0, total = 0;
  for (let level = 1; level <= 99; level++) {
    if (level % 10 === 0) { bosses++; continue; }
    const page = Math.floor((level - 1) / 10), need = G.xpForNextLevel(level);
    regular++; total += need; pages[page] += need; localNeeds[page].push(need);
  }
  bosses++; // 第 100 级最终 Boss，通关而不再进入 101 级。
  assert(regular === 90 && bosses === 10, '普通升级或 Boss 次数错误：' + regular + '/' + bosses);
  assert(total === 10440, '全 100 级普通升级总经验应为 10440，实际为 ' + total);
  pages.forEach((xp, page) => {
    assert(xp === 558 + page * 108, '第 ' + (page + 1) + ' 页经验预算错误：' + xp);
    const needs = localNeeds[page];
    assert(needs.length === 9 && needs.every((v, i) => i === 0 || v > needs[i - 1]), '第 ' + (page + 1) + ' 页内没有逐级递增');
  });
  assert(pages[9] < pages[0] * 3, '末页经验预算仍超过首页 3 倍');
  // 用平均每只怪 4～13 经验的代表模型检查击杀节奏，目标仍是稳定击杀数而非拖时间。
  const killPaces = pages.map((xp, page) => xp / (page + 4));
  assert(killPaces.every(kills => kills >= 110 && kills <= 145), '每页代表击杀数超出 110～145：' + killPaces.join(','));
  console.log('PACE  ' + pages.map((xp, page) => 'P' + (page + 1) + ':' + xp + 'xp/' + Math.round(killPaces[page]) + '杀').join(' | '));
});

console.log(failed ? 'XP_TEST_FAILURES: ' + failed : 'XP_TEST_OK (6/6)');
process.exit(failed ? 1 : 0);

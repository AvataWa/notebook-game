// 资源循环回归：墨潮不可自循环，轨迹共享充能预算，普通击杀与弹反保持原收益
const src = require('fs').readFileSync(__dirname + '/battle-config.js', 'utf8') + '\n' +
  require('fs').readFileSync(__dirname + '/enemy-config.js', 'utf8') + '\n' +
  require('fs').readFileSync(__dirname + '/content-config.js', 'utf8') + '\n' +
  require('fs').readFileSync(__dirname + '/main.js', 'utf8').replace("'use strict';", '');
const fakeCtx = new Proxy({}, { get(t, k) { if (k === 'measureText') return () => ({ width: 10 }); return () => {}; }, set() { return true; } });
const fakeCanvas = { getContext: () => fakeCtx, width: 0, height: 0, style: {}, addEventListener() {}, getBoundingClientRect: () => ({ left: 0, top: 0, width: 375, height: 667 }) };
global.window = { addEventListener() {}, devicePixelRatio: 1, innerWidth: 375, innerHeight: 667 };
global.document = { getElementById: () => fakeCanvas }; global.requestAnimationFrame = () => {};
eval(src + `
;globalThis.G = {
  resetGame, spawnEnemy, castInkSurge, killEnemy, addAttackPath, regenInkResourceBudgets,
  castAbsorb, reflectEnemyBullet,
  get player() { return player; }, get enemies() { return enemies; },
  set state(v) { state = v; }
};`);
let failed = 0;
function test(name, fn) { try { fn(); console.log('OK  ' + name); } catch (e) { failed++; console.log('ERR ' + name + ': ' + e.message); } }
function assert(ok, msg) { if (!ok) throw new Error(msg); }
function near(a, b, eps = 1e-8) { return Math.abs(a - b) < eps; }
function fresh() { G.resetGame(); G.state = 'play'; G.player.xpNext = 99999; G.player.hp = G.player.maxhp = 9999; }
function enemy(type, x, y) { G.spawnEnemy(type, x, y); return G.enemies[G.enemies.length - 1]; }

test('一次墨潮击杀 45 个低血量怪不会返还任何充能', () => {
  fresh();
  for (let i = 0; i < 45; i++) {
    const a = i / 45 * Math.PI * 2, r = 35 + (i % 5) * 18;
    const e = enemy('stick', Math.cos(a) * r, Math.sin(a) * r);
    e.hp = 1;
  }
  G.player.special = 100; G.player.specialAnnounced = true;
  assert(G.castInkSurge(), '墨潮未能释放');
  assert(G.enemies.every(e => e.dead), '测试怪群未被墨潮清空');
  assert(near(G.player.special, 0), '墨潮击杀返充能：' + G.player.special);
});

test('普通击杀墨团仍按原公式提供 3.6% 充能', () => {
  fresh(); const e = enemy('stick', 0, 0); e.hp = 1;
  G.killEnemy(e);
  assert(near(G.player.special, 3.6), '普通击杀充能被误削：' + G.player.special);
});

function trailChargeFor(projectiles) {
  fresh(); G.player.trailChargeBudget = 0;
  for (let frame = 0; frame < 60; frame++) {
    G.regenInkResourceBudgets(1 / 60);
    for (let i = 0; i < projectiles; i++) {
      const x = -350 + (frame + 1) * 12, y = -300 + i * 30;
      G.addAttackPath(x, y, '#1a2b8f', false, { x: x - 12, y });
    }
  }
  return G.player.special;
}
test('1 颗与 20 颗子弹的轨迹均受同一约 6%/秒预算限制', () => {
  const single = trailChargeFor(1), dense = trailChargeFor(20);
  assert(single > 5.8 && single <= 6.000001, '单颗轨迹一秒充能异常：' + single);
  assert(dense > 5.8 && dense <= 6.000001, '密集轨迹一秒充能异常：' + dense);
  assert(near(single, dense, 0.000001), `子弹数量仍线性放大充能：${single} / ${dense}`);
});

test('弹反墨团与弹反奖励保持原来的合计 24.8% 充能', () => {
  fresh(); G.player.ink = 50;
  const e = enemy('pencilthrower', 100, 0);
  const eb = { x: 0, y: 0, vx: -100, vy: 0, dmg: 10, life: 2, sourceId: e.id, reflectable: true };
  G.castAbsorb(); assert(G.reflectEnemyBullet(eb), '子弹弹反失败');
  assert(near(G.player.special, 24.8), '弹反充能被轨迹预算误削：' + G.player.special);
});
console.log(failed ? 'RESOURCE_LOOP_TEST_FAILURES: ' + failed : 'RESOURCE_LOOP_TEST_OK (4/4)');
process.exit(failed ? 1 : 0);

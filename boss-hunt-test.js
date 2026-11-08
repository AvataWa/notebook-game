// 乱线魔王专项：选招、方向锁定、连段、疲惫、部位破坏与弹反。
const src = require('fs').readFileSync(__dirname + '/enemy-config.js', 'utf8') + '\n'
  + require('fs').readFileSync(__dirname + '/main.js', 'utf8').replace("'use strict';", '') + '\n'
  + require('fs').readFileSync(__dirname + '/boss-hunt-runtime.js', 'utf8');
const fakeCtx = new Proxy({}, { get(t, k) { if (k === 'measureText') return () => ({ width: 10 }); return () => {}; }, set() { return true; } });
const fakeCanvas = { getContext: () => fakeCtx, width: 0, height: 0, style: {}, addEventListener() {}, getBoundingClientRect: () => ({ left: 0, top: 0, width: 375, height: 667 }) };
global.window = { addEventListener() {}, devicePixelRatio: 1, innerWidth: 375, innerHeight: 667 };
global.document = { getElementById: () => fakeCanvas }; global.requestAnimationFrame = () => {};
eval(src + `
;globalThis.G = {
  resetGame, spawnBoss, update, updateBoss, hurtEnemy, castAbsorb, render,
  get player() { return player; }, get enemies() { return enemies; }, get floats() { return floats; },
  set state(v) { state = v; }
};`);
let failed = 0;
function test(name, fn) { try { fn(); console.log('OK  ' + name); } catch (e) { failed++; console.log('ERR ' + name + ': ' + e.stack); } }
function assert(ok, msg) { if (!ok) throw new Error(msg); }
function freshBoss() {
  G.resetGame(); G.state = 'play'; G.player.xpNext = 99999;
  G.spawnBoss(1);
  const e = G.enemies[G.enemies.length - 1];
  e.x = 0; e.y = 0; e.faceA = 0; e.kbx = e.kby = 0;
  G.player.x = 70; G.player.y = 0;
  return e;
}
const H = globalThis.BossHuntRuntime;

test('第一关初始化为独立狩猎 Boss，拥有尖角部位', () => {
  const e = freshBoss();
  assert(e.huntBoss && e.hornHp === e.hornMax && !e.hornBroken, '狩猎状态或部位未初始化');
  assert(e.huntMode === 'chase' && e.phase === 1, '初始状态错误');
});
test('近距离正面选择爪击，背后选择甩尾', () => {
  let e = freshBoss(); e.huntT = 0; H.update(e, 0.01);
  assert(e.attack === 'claw' && e.huntMode === 'windup', '正面没有使用爪击');
  e = freshBoss(); G.player.x = -70; e.huntT = 0; H.update(e, 0.01);
  assert(e.attack === 'tail' && e.huntMode === 'windup', '背后没有使用甩尾');
});
test('冲锋末段锁定方向，玩家横移不改变轨迹', () => {
  const e = freshBoss(); G.player.x = 260; H.startAttack(e, 'charge');
  e.huntT = 0.2;
  const dx = e.lockDx, dy = e.lockDy;
  G.player.x = 0; G.player.y = 250; H.update(e, 0.01);
  assert(e.lockDx === dx && e.lockDy === dy, '锁定末段仍然追踪玩家');
});
test('飞扑保留起手时的落点', () => {
  const e = freshBoss(); G.player.x = 180; G.player.y = 60; H.startAttack(e, 'pounce');
  const x = e.targetX, y = e.targetY;
  G.player.x = -200; G.player.y = -100; H.update(e, 0.1);
  assert(e.targetX === x && e.targetY === y, '飞扑落点被实时追踪');
});
test('半血冲锋变成二连击，第二段使用短前摇', () => {
  const e = freshBoss(); e.phase = 2; H.startAttack(e, 'charge');
  assert(e.chargeChain === 1, '半血没有储存第二段冲锋');
  e.huntMode = 'active'; e.huntT = 0; H.update(e, 0.01);
  assert(e.attack === 'charge' && e.huntMode === 'windup' && e.chargeChain === 0, '第二段冲锋未开始');
  assert(e.windupDuration === 0.38, '第二段冲锋不是短前摇');
});
test('完成四轮招式后进入疲惫输出窗口', () => {
  const e = freshBoss(); e.huntMoveCount = 3; e.attack = 'claw'; e.huntMode = 'recover'; e.huntT = 0;
  H.update(e, 0.01);
  assert(e.huntMode === 'fatigue' && e.huntT > 2.4, '没有进入疲惫');
  const hp = e.hp; G.hurtEnemy(e, 100, 0, -500, -500);
  assert(Math.round(hp - e.hp) === 120, '疲惫受伤加深未生效');
});
test('尖角按命中位置积累，破坏后倒地三秒', () => {
  const e = freshBoss(); const p = H.hornPoint(e), old = e.hornHp;
  H.onDamage(e, p.x, p.y, 100);
  assert(e.hornHp === old - 80, '尖角命中没有累计部位伤害');
  const after = e.hornHp; H.onDamage(e, -500, -500, 100);
  assert(e.hornHp === after, '远离尖角的命中错误累计部位伤害');
  H.addPartDamage(e, e.hornHp);
  assert(e.hornBroken && e.huntMode === 'down' && e.huntT === 3, '断角没有触发三秒倒地');
});
test('爪击可弹反，玩家不受伤且 Boss 进入收招', () => {
  const e = freshBoss(); G.player.x = 65; G.player.y = 0; G.castAbsorb();
  const hp = G.player.hp, oldHorn = e.hornHp;
  H.startAttack(e, 'claw'); e.huntMode = 'active'; e.huntT = 0.1; H.update(e, 0.01);
  assert(G.player.hp === hp && e.huntMode === 'recover', '爪击弹反未生效');
  assert(e.hornHp < oldHorn && G.floats.some(f => f.txt === '弹反！'), '弹反未积累部位破坏或缺少反馈');
});
test('狩猎 Boss 不再使用无动作的贴身碰撞伤害', () => {
  const e = freshBoss(); G.player.x = 0; G.player.y = 0; e.huntMode = 'fatigue'; e.huntT = 2;
  const hp = G.player.hp; G.update(0.01);
  assert(G.player.hp === hp, '疲惫时仍发生无动作碰撞伤害');
});
test('全部招式和部位状态的渲染不报错', () => {
  const e = freshBoss();
  for (const kind of ['claw', 'tail', 'charge', 'pounce']) {
    H.startAttack(e, kind); G.render();
    e.huntMode = 'active'; G.render();
  }
  e.huntMode = 'fatigue'; G.render();
  H.addPartDamage(e, e.hornHp); G.render();
});
if (failed) { console.error('BOSS_HUNT_TEST_FAILED (' + failed + ')'); process.exit(1); }
console.log('BOSS_HUNT_TEST_OK (10/10)');

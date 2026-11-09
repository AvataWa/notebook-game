// 第 3～10 页 Boss：统一状态机、独立招式表、方向锁定、真实判定与全招式渲染。
require('./creature-designs.js');
require('./creature-design-renderer.js');
require('./creature-game-runtime.js');
const src = require('fs').readFileSync(__dirname + '/enemy-config.js', 'utf8') + '\n'
  + require('fs').readFileSync(__dirname + '/main.js', 'utf8').replace("'use strict';", '') + '\n'
  + require('fs').readFileSync(__dirname + '/boss-ai-runtime.js', 'utf8') + '\n'
  + require('fs').readFileSync(__dirname + '/boss-standard-runtime.js', 'utf8');
const fakeCtx = new Proxy({}, { get(t, k) { if (k === 'measureText') return () => ({ width: 10 }); return () => {}; }, set() { return true; } });
const fakeCanvas = { getContext: () => fakeCtx, width: 0, height: 0, style: {}, addEventListener() {}, getBoundingClientRect: () => ({ left: 0, top: 0, width: 375, height: 667 }) };
global.window = { addEventListener() {}, devicePixelRatio: 1, innerWidth: 375, innerHeight: 667 };
global.document = { getElementById: () => fakeCanvas }; global.requestAnimationFrame = () => {};
eval(src + `
;globalThis.G = {
  resetGame, spawnBoss, hurtEnemy, castAbsorb, render,
  get player() { return player; }, get enemies() { return enemies; }, get floats() { return floats; },
  get ebullets() { return ebullets; }, get hazards() { return hazards; },
  set state(v) { state = v; }
};`);
let failed = 0, passed = 0;
function test(name, fn) { try { fn(); passed++; console.log('OK  ' + name); } catch (e) { failed++; console.log('ERR ' + name + ': ' + e.stack); } }
function assert(ok, msg) { if (!ok) throw new Error(msg); }
function freshBoss(stage) {
  G.resetGame(); G.state = 'play'; G.player.xpNext = 99999;
  G.spawnBoss(stage);
  const e = G.enemies[G.enemies.length - 1];
  e.x = 0; e.y = 0; e.faceA = 0; e.kbx = e.kby = 0;
  G.player.x = 180; G.player.y = 0; G.player.hurtT = 0; G.player.goldT = 0;
  return e;
}
function beginActive(e) { e.huntT = 0; S.update(e, 0.001); }
const S = globalThis.BossStandardRuntime;

test('八名 Boss 全部使用统一控制器且保留各自原型', () => {
  const creatures = { 3: 'bossJudge', 4: 'bossDragon', 5: 'bossKnight', 6: 'bossElement', 7: 'bossOrigami', 8: 'bossEraser', 9: 'bossAbyss', 10: 'bossNotebook' };
  for (let stage = 3; stage <= 10; stage++) {
    const e = freshBoss(stage); G.render();
    assert(e.huntBoss && e.bossAI === 'standard' && e.huntMode === 'chase', stage + ' 控制器未接入');
    assert(e.creatureId === creatures[stage], stage + ' 原型被替换');
    assert(Object.keys(S.PROFILES[stage].moves).length >= 5, stage + ' 独立招式不足五招');
    assert(S.debugCandidates(e).length >= 2, stage + ' 常规站位没有可选招式');
  }
});
test('每名 Boss 的全部招式前摇、出手、阶段与收招均可运行和渲染', () => {
  for (let stage = 3; stage <= 10; stage++) for (const kind of Object.keys(S.PROFILES[stage].moves)) {
    const e = freshBoss(stage); S.startAttack(e, kind); G.render();
    assert(e.huntMode === 'windup' && e.attack === kind, stage + ' ' + kind + ' 未进入前摇');
    beginActive(e); e.huntT = Math.max(0.001, e.activeDuration * 0.45); S.update(e, 0.001); G.render();
    e.huntMode = 'recover'; e.huntT = 0; S.update(e, 0.001); G.render();
    assert(e.huntLast === kind || e.huntMode === 'fatigue', stage + ' ' + kind + ' 收招状态错误');
  }
});
test('冲锋前摇有限修正，末段锁定方向', () => {
  const e = freshBoss(3); G.player.x = 400; S.startAttack(e, 'judgeCharge');
  G.player.y = 180; e.huntT = 0.45; S.update(e, 0.05);
  assert(e.faceA > 0 && e.faceA < Math.atan2(180, 400), '前摇没有有限追踪');
  e.huntT = 0.15; const face = e.faceA;
  G.player.x = -300; G.player.y = -100; S.update(e, 0.01);
  assert(e.faceA === face, '末段仍然追踪');
});
test('范围落点前摇更新，末段锁定后保持一致', () => {
  const e = freshBoss(4); G.player.x = 350; S.startAttack(e, 'dragonMeteor');
  G.player.x = 420; G.player.y = 90; e.huntT = 0.6; S.update(e, 0.01);
  assert(e.targetX === 420 && e.targetY === 90, '落点没有追踪');
  e.huntT = 0.2; S.update(e, 0.01);
  const saved = [e.targetX, e.targetY];
  G.player.x = -300; G.player.y = -200; e.huntT = 0.1; S.update(e, 0.01);
  assert(e.targetX === saved[0] && e.targetY === saved[1], '末段落点变化');
  beginActive(e);
  assert(e.standardTargets && e.standardTargets[0].x === saved[0] && e.standardTargets[0].y === saved[1], '实际结算落点与预警不一致');
});
test('普通近战可以弹反并进入收招', () => {
  const e = freshBoss(3); G.player.x = 70; G.castAbsorb(); const hp = G.player.hp;
  S.startAttack(e, 'judgeSlash'); e.huntMode = 'active'; e.huntT = 0.1; S.update(e, 0.001);
  assert(G.player.hp === hp && e.huntMode === 'recover', '近战弹反未生效');
  assert(G.floats.some(f => f.txt === '弹反！'), '缺少弹反反馈');
});
test('不可弹反震地击碎吸墨并造成真实伤害', () => {
  const e = freshBoss(3); G.player.x = 70; G.castAbsorb(); const hp = G.player.hp;
  S.startAttack(e, 'judgeSlam'); e.huntMode = 'active'; e.huntT = e.activeDuration * 0.2; S.update(e, 0.001);
  assert(G.player.hp < hp && G.player.absorbT === 0 && e.attackResolved, '震地判定错误');
});
test('环形与扇形招式生成可弹反真实弹体', () => {
  let e = freshBoss(6); S.startAttack(e, 'elementRing'); beginActive(e);
  assert(G.ebullets.length === 14 && G.ebullets.every(b => b.reflectable), '环形弹体错误');
  e = freshBoss(7); e.phase = 2; S.startAttack(e, 'origamiVolley'); beginActive(e);
  assert(G.ebullets.length === 9 && new Set(G.ebullets.map(b => b.vy)).size > 1, '愤怒扇形弹体错误');
});
test('墨雨与召唤产生真实区域和怪物', () => {
  let e = freshBoss(6); S.startAttack(e, 'elementInk'); beginActive(e);
  assert(e.attackResolved && G.ebullets.length === 0, '墨雨没有独立结算');
  e = freshBoss(5); S.startAttack(e, 'knightSummon'); beginActive(e);
  assert(G.enemies.filter(x => x.type === 'rage').length === 3, '召唤数量错误');
});
test('八名 Boss 半血都进入第二阶段且不换控制器', () => {
  for (let stage = 3; stage <= 10; stage++) {
    const e = freshBoss(stage); e.hp = e.maxhp * 0.4; const speed = e.sp; S.update(e, 0.01);
    assert(e.phase === 2 && e.sp > speed && e.bossAI === 'standard', stage + ' 阶段切换错误');
  }
});
test('连段计数后进入疲惫输出窗口', () => {
  const e = freshBoss(10); e.ai.moveCount = 6; e.attack = 'notebookSlash'; e.huntMode = 'recover'; e.huntT = 0;
  S.update(e, 0.001);
  assert(e.huntMode === 'fatigue' && e.huntT > 2.3, '最终 Boss 没有疲惫窗口');
  const hp = e.hp; G.hurtEnemy(e, 100, 0, -500, -500);
  assert(Math.round(hp - e.hp) === 120, '疲惫受伤加深未生效');
});
if (failed) { console.error('BOSS_STANDARD_TEST_FAILED (' + failed + ')'); process.exit(1); }
console.log('BOSS_STANDARD_TEST_OK (' + passed + '/' + passed + ')');

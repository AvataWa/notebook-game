// 乱线魔王专项：站位选招、方向锁定、固定派生、部位状态、真实判定与渲染。
require('./creature-designs.js');
require('./creature-design-renderer.js');
require('./creature-game-runtime.js');
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
  get ebullets() { return ebullets; }, get bullets() { return bullets; },
  set state(v) { state = v; }
};`);
let failed = 0, passed = 0;
function test(name, fn) { try { fn(); passed++; console.log('OK  ' + name); } catch (e) { failed++; console.log('ERR ' + name + ': ' + e.stack); } }
function assert(ok, msg) { if (!ok) throw new Error(msg); }
function freshBoss() {
  G.resetGame(); G.state = 'play'; G.player.xpNext = 99999;
  G.spawnBoss(1);
  const e = G.enemies[G.enemies.length - 1];
  e.x = 0; e.y = 0; e.faceA = 0; e.kbx = e.kby = 0;
  G.player.x = 70; G.player.y = 0;
  return e;
}
function forceActive(e, kind) {
  e.attack = kind; e.huntMode = 'active'; e.huntT = 0;
}
function advanceCombo(e) {
  e.huntT = 0;
  globalThis.BossHuntRuntime.update(e, 0.17);
}
const H = globalThis.BossHuntRuntime;

test('保留七足乱线魔王原型、体型和部位初始化', () => {
  const e = freshBoss(); G.render();
  assert(e.huntBoss && e.creatureId === 'bossScribble' && e.creatureRig.legs.length === 7 && e.r === 51, 'Boss 原型、七足步态或体型被替换');
  assert(e.hornHp === e.hornMax && e.tailHp === e.tailMax && e.tailSpikes === 1, '部位未初始化');
  assert(e.huntMode === 'chase' && e.phase === 1 && e.ai, '初始 AI 状态错误');
});
test('头前、侧面、背后根据站位提供不同招式池', () => {
  const e = freshBoss();
  let pool = H.debugCandidates(e);
  assert(pool.includes('bite') && pool.includes('claw'), '头前缺少前咬或爪击');
  assert(!pool.includes('tail') && !pool.includes('tailSlam'), '头前错误出现尾部招式');
  G.player.x = 0; G.player.y = 200; pool = H.debugCandidates(e);
  assert(pool.includes('claw') && pool.includes('tail') && pool.includes('tailSlam'), '侧面派生不完整');
  G.player.x = -200; G.player.y = 0; pool = H.debugCandidates(e);
  assert(pool.includes('tail') && pool.includes('tailSlam'), '背后缺少甩尾或尾砸');
  assert(!pool.includes('bite') && !pool.includes('charge'), '背后错误出现头前招式');
});
test('甩尾和尾砸始终将尾部朝向玩家', () => {
  for (const kind of ['tail', 'tailSlam']) {
    const e = freshBoss(); G.player.x = 180; G.player.y = 0;
    H.startAttack(e, kind);
    const rear = e.faceA + Math.PI;
    assert(Math.abs(Math.cos(rear) - 1) < 1e-8 && Math.abs(Math.sin(rear)) < 1e-8, kind + ' 尾部朝向反转');
  }
});
test('侧跳产生真实横向位移，同时持续观察玩家', () => {
  const e = freshBoss(); G.player.x = 240; G.player.y = 0;
  e.huntMode = 'reposition'; e.huntT = 0.2; e.ai.repositionSide = 1;
  H.update(e, 0.05);
  assert(e.y > 15 && Math.abs(e.x) < 1e-8, '侧跳没有横向移动');
  assert(Math.abs(e.faceA) < 1e-8, '侧跳时失去玩家朝向');
});
test('冲锋前摇有限修正，锁定末段不再追踪', () => {
  const e = freshBoss(); G.player.x = 400; G.player.y = 0; H.startAttack(e, 'charge');
  G.player.y = 180; e.huntT = 0.4; H.update(e, 0.05);
  assert(e.faceA > 0 && e.faceA < Math.atan2(180, 400), '前摇没有有限转向或转向无上限');
  e.huntT = 0.2;
  const dx = e.lockDx, dy = e.lockDy, face = e.faceA;
  G.player.x = -300; G.player.y = -250; H.update(e, 0.01);
  assert(e.lockDx === dx && e.lockDy === dy && e.faceA === face, '锁定末段仍然追踪玩家');
});
test('飞扑先追踪落点，末段锁定后不再改变', () => {
  const e = freshBoss(); G.player.x = 360; G.player.y = 60; H.startAttack(e, 'pounce');
  G.player.x = 420; G.player.y = 100; e.huntT = 0.5; H.update(e, 0.01);
  assert(e.targetX === 420 && e.targetY === 100, '飞扑前摇没有更新落点');
  e.huntT = 0.2;
  const x = e.targetX, y = e.targetY;
  G.player.x = -200; G.player.y = -100; H.update(e, 0.01);
  assert(e.targetX === x && e.targetY === y, '飞扑末段仍实时追踪');
});
test('愤怒冲锋先进入连段等待，再以短前摇发动第二段', () => {
  const e = freshBoss(); e.phase = 2; G.player.x = 400; H.startAttack(e, 'charge');
  assert(e.chargeChain === 1, '没有储存第二段冲锋');
  forceActive(e, 'charge'); H.update(e, 0.01);
  assert(e.huntMode === 'comboWait' && e.ai.nextCombo === 'charge', '第一段后跳过连段节奏');
  H.update(e, 0.17);
  assert(e.attack === 'charge' && e.huntMode === 'windup' && e.chargeChain === 0, '第二段冲锋未开始');
  assert(e.windupDuration === 0.38, '第二段冲锋不是短前摇');
});
test('愤怒回旋与尾砸都执行真正的第二段', () => {
  for (const kind of ['spin', 'tailSlam']) {
    const e = freshBoss(); e.phase = 2; G.player.x = -180; H.startAttack(e, kind);
    forceActive(e, kind); H.update(e, 0.01);
    assert(e.huntMode === 'comboWait' && e.ai.nextCombo === kind, kind + ' 未进入第二段等待');
    advanceCombo(e);
    assert(e.attack === kind && e.huntMode === 'windup', kind + ' 第二段未开始');
    assert(e.windupDuration === H.MOVES[kind].chainWindup, kind + ' 第二段前摇错误');
  }
});
test('两次刃翼连扑后固定派生飞扑', () => {
  const e = freshBoss(); e.phase = 2; G.player.x = 400; H.startAttack(e, 'comboSlash');
  assert(e.ai.combo.join(',') === 'comboSlash,pounce', '连段队列不是两扑一飞扑');
  forceActive(e, 'comboSlash'); H.update(e, 0.01); advanceCombo(e);
  assert(e.attack === 'comboSlash' && e.huntMode === 'windup', '第二次连扑未开始');
  forceActive(e, 'comboSlash'); H.update(e, 0.01); advanceCombo(e);
  assert(e.attack === 'pounce' && e.huntMode === 'windup' && e.windupDuration === 0.42, '连扑后未派生飞扑');
});
test('完成四轮招式后进入疲惫输出窗口并有表现反馈', () => {
  const e = freshBoss(); e.ai.moveCount = 3; e.attack = 'claw'; e.huntMode = 'recover'; e.huntT = 0;
  H.update(e, 0.01);
  assert(e.huntMode === 'fatigue' && e.huntT > 2.4, '没有进入疲惫');
  assert(G.floats.length >= 0 && e.ai.moveCount === 0, '疲惫计数未复位');
  const hp = e.hp; G.hurtEnemy(e, 100, 0, -500, -500);
  assert(Math.round(hp - e.hp) === 120, '疲惫受伤加深未生效');
});
test('尖角按命中位置积累，破坏后倒地三秒并清空连段', () => {
  const e = freshBoss(); e.ai.combo = ['charge']; const p = H.hornPoint(e), old = e.hornHp;
  H.onDamage(e, p.x, p.y, 100);
  assert(e.hornHp === old - 80, '尖角命中没有累计部位伤害');
  const after = e.hornHp; H.onDamage(e, -500, -500, 100);
  assert(e.hornHp === after, '远离尖角的命中错误累计部位伤害');
  H.addPartDamage(e, e.hornHp);
  assert(e.hornBroken && e.huntMode === 'down' && e.huntT === 3 && e.ai.combo.length === 0, '断角没有触发倒地或中断连段');
});
test('爪击可弹反，玩家不受伤且 Boss 进入收招', () => {
  const e = freshBoss(); G.player.x = 65; G.player.y = 0; G.castAbsorb();
  const hp = G.player.hp, oldHorn = e.hornHp;
  H.startAttack(e, 'claw'); e.huntMode = 'active'; e.huntT = 0.1; H.update(e, 0.01);
  assert(G.player.hp === hp && e.huntMode === 'recover', '爪击弹反未生效');
  assert(e.hornHp < oldHorn && G.floats.some(f => f.txt === '弹反！'), '弹反未积累部位破坏或缺少反馈');
});
test('尾砸使用与预警一致的后方长条判定', () => {
  let e = freshBoss(); G.player.x = -300; G.player.y = 0; H.startAttack(e, 'tailSlam');
  let hp = G.player.hp; forceActive(e, 'tailSlam'); H.update(e, 0.01);
  assert(G.player.hp < hp, '尾砸长条内没有造成伤害');
  e = freshBoss(); G.player.x = -300; G.player.y = 0; H.startAttack(e, 'tailSlam');
  G.player.y = 200; hp = G.player.hp; forceActive(e, 'tailSlam'); H.update(e, 0.01);
  assert(G.player.hp === hp, '尾砸长条外仍错误受伤');
});
test('尾棘发射真实弹体，耗尽后暂时移除远程招式', () => {
  const e = freshBoss(); G.player.x = -500; G.player.y = 0; H.startAttack(e, 'quills');
  e.huntT = 0; H.update(e, 0.01);
  assert(G.ebullets.length === 5 && G.ebullets.every(b => b.kind === 'quill' && b.reflectable), '没有发射五枚可弹反尾棘');
  assert(G.ebullets.every(b => b.vx < 0 && Math.abs(b.vy) < 150), '尾棘没有从尾部朝玩家扇形发射');
  assert(e.tailSpikes === 0 && !H.debugCandidates(e).includes('quills'), '耗尽后仍可重复齐射');
});
test('尾棘可再生，破坏尾部也会暂时封射击', () => {
  const e = freshBoss(); G.player.x = -400; G.player.y = 0;
  assert(H.addTailDamage(e, e.tailMax) && e.tailSpikes === 0, '尾棘破坏未生效');
  assert(!H.debugCandidates(e).includes('quills'), '破坏后尾棘仍在候选池');
  e.huntMode = 'down'; e.huntT = 100; H.update(e, 8.1);
  assert(e.tailSpikes === 1 && e.tailHp === e.tailMax, '尾棘再生或耐久恢复失败');
  assert(H.debugCandidates(e).includes('quills'), '再生后远程招式未恢复');
});
test('尾棘能被吸墨弹反并转化为己方弹体', () => {
  const e = freshBoss(); G.player.x = 70; G.player.y = 0; G.castAbsorb();
  G.ebullets.push({ x: 72, y: 0, vx: -100, vy: 0, dmg: 10, life: 2, sourceId: e.id, reflectable: true, kind: 'quill' });
  const hp = G.player.hp; G.update(0.001);
  assert(G.player.hp === hp && G.ebullets.length === 0, '尾棘未被弹反或仍造成伤害');
  assert(G.bullets.some(b => b.reflected), '尾棘弹反没有生成己方弹体');
});
test('狩猎 Boss 不再使用无动作的贴身碰撞伤害', () => {
  const e = freshBoss(); G.player.x = 0; G.player.y = 0; e.huntMode = 'fatigue'; e.huntT = 2;
  const hp = G.player.hp; G.update(0.01);
  assert(G.player.hp === hp, '疲惫时仍发生无动作碰撞伤害');
});
test('九种招式、侧跳、疲惫和倒地渲染均不报错', () => {
  const e = freshBoss();
  for (const kind of Object.keys(H.MOVES)) {
    H.startAttack(e, kind); G.render();
    e.huntMode = 'active'; e.huntT = e.activeDuration * 0.5; G.render();
  }
  e.huntMode = 'reposition'; G.render();
  e.huntMode = 'fatigue'; G.render();
  H.addPartDamage(e, e.hornHp); G.render();
});
if (failed) { console.error('BOSS_HUNT_TEST_FAILED (' + failed + ')'); process.exit(1); }
console.log('BOSS_HUNT_TEST_OK (' + passed + '/' + passed + ')');

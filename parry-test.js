// 操作战斗回归：远程前摇、近战挥击、吸墨弹反与返墨上限
const src = require('fs').readFileSync(__dirname + '/enemy-config.js', 'utf8') + '\n' + require('fs').readFileSync(__dirname + '/main.js', 'utf8').replace("'use strict';", '');
const fakeCtx = new Proxy({}, { get(t, k) { if (k === 'measureText') return () => ({ width: 10 }); return () => {}; }, set() { return true; } });
const fakeCanvas = { getContext: () => fakeCtx, width: 0, height: 0, style: {}, addEventListener() {}, getBoundingClientRect: () => ({ left: 0, top: 0, width: 375, height: 667 }) };
global.window = { addEventListener() {}, devicePixelRatio: 1, innerWidth: 375, innerHeight: 667 };
global.document = { getElementById: () => fakeCanvas }; global.requestAnimationFrame = () => {};
eval(src + `
;globalThis.G = {
  resetGame, spawnEnemy, spawnBoss, update, updateShooter, updateMeleeSwing, castAbsorb, castMeleeInkSurge, reflectEnemyBullet, reflectHazard, hurtPlayer, addInkStain, render, loop,
  get player() { return player; }, get enemies() { return enemies; }, get ebullets() { return ebullets; },
  get bullets() { return bullets; }, get floats() { return floats; }, get novas() { return novas; }, get hazards() { return hazards; },
  get hitStop() { return hitStopT; }, get time() { return gameTime; },
  set state(v) { state = v; }, set hitStop(v) { hitStopT = v; }, set last(v) { last = v; }
};`);
let failed = 0;
function test(name, fn) { try { fn(); console.log('OK  ' + name); } catch (e) { failed++; console.log('ERR ' + name + ': ' + e.message); } }
function assert(ok, msg) { if (!ok) throw new Error(msg); }
function near(a, b) { return Math.abs(a - b) < 1e-8; }
function fresh() { G.resetGame(); G.state = 'play'; }
function enemy(type, x, y) { G.spawnEnemy(type, x, y); return G.enemies[G.enemies.length - 1]; }

test('铅笔投手先瞄准再发射单发子弹', () => {
  fresh(); const e = enemy('pencilthrower', 0, -240); e.shotCd = 0;
  G.updateShooter(e, 0.01);
  assert(e.shotWindup > 0.39 && G.ebullets.length === 0, '没有射击前摇或提前生成子弹');
  G.updateShooter(e, 0.39); assert(G.ebullets.length === 0, '前摇尚未结束就发射');
  G.updateShooter(e, 0.02);
  assert(G.ebullets.length === 1 && G.ebullets[0].sourceId === e.id, '单发射击或来源错误');
  assert(near(G.ebullets[0].dmg, Math.round(e.dmg * 0.65)), '远程子弹伤害倍率错误');
});
test('分叉笔头一次生成三颗扇形子弹', () => {
  fresh(); const e = enemy('forkpen', 0, -260); e.shotWindup = 0.01; e.aimA = Math.PI / 2;
  G.updateShooter(e, 0.02);
  assert(G.ebullets.length === 3, '扇形子弹数量不是 3');
  const speeds = G.ebullets.map(b => Math.hypot(b.vx, b.vy));
  assert(speeds.every(s => near(s, 205)), '扇形子弹速度配置错误');
  assert(G.ebullets[0].vx !== G.ebullets[2].vx, '三颗子弹没有散开');
});
test('橡皮弩手在前摇后连续射出三轮', () => {
  fresh(); const e = enemy('eliteCrossbow', 0, -280); e.shotWindup = 0.01;
  G.updateShooter(e, 0.02); assert(e.burstLeft === 3 && G.ebullets.length === 0, '连发状态未正确开始');
  G.updateShooter(e, 0.01); G.updateShooter(e, 0.19); G.updateShooter(e, 0.19);
  assert(G.ebullets.length === 3 && e.burstLeft === 0, '精英三轮连发数量错误');
});
test('近战挥击有前摇，并按 1.5 秒周期再次起手', () => {
  fresh(); const e = enemy('stick', 0, 0); const hp = G.player.hp; e.swingCd = 0;
  G.updateMeleeSwing(e, 0.01);
  assert(near(e.swingT, 0.55) && G.player.hp === hp, '挥击总时长错误、贴脸立即扣血或没有挥击前摇');
  const firstCycle = e.swingCd; assert(near(firstCycle, 1.5), '挥击周期不是 1.5 秒');
  G.updateMeleeSwing(e, 0.3); assert(G.player.hp === hp, '前摇期间提前结算伤害');
  G.updateMeleeSwing(e, 0.06); assert(G.player.hp < hp && e.swingHit, '有效挥击没有结算伤害');
  G.updateMeleeSwing(e, 1.2); G.updateMeleeSwing(e, 0.01);
  assert(e.swingT > 0 && !e.swingHit, '下一周期没有重新挥击');
});
test('近战命中圈保留 0.2 秒，且持续期间不重复扣血', () => {
  fresh(); const e = enemy('stick', 0, 0); const hp = G.player.hp;
  e.swingT = 0.21; e.swingHit = false;
  G.updateMeleeSwing(e, 0.02);
  assert(G.player.hp < hp && near(e.swingT, 0.19), '命中圈没有进入 0.2 秒持续阶段');
  const hitHp = G.player.hp; G.updateMeleeSwing(e, 0.1);
  assert(G.player.hp === hitHp && near(e.swingT, 0.09), '命中持续期间重复扣血或特效提前消失');
  G.updateMeleeSwing(e, 0.09);
  assert(G.player.hp === hitHp && e.swingT === 0, '命中圈没有按 0.2 秒时长结束');
});
test('吸墨释放后进入冷却，不能连续透支', () => {
  fresh(); assert(G.castAbsorb(), '吸墨无法释放');
  assert(near(G.player.absorbT, 0.35) && near(G.player.absorbRadius, 65) && near(G.player.absorbCd, 1.2), '基础窗口、范围或冷却数值错误');
  assert(!G.castAbsorb(), '冷却中重复释放成功');
});
test('站在己方墨迹释放吸墨时，窗口提升至 0.4 秒、范围提升至 100', () => {
  fresh(); G.addInkStain(G.player.x, G.player.y, 3, 30, '#1a2b8f', false, true);
  assert(G.castAbsorb(), '己方墨迹上无法释放吸墨');
  assert(near(G.player.absorbT, 0.4) && near(G.player.absorbDuration, 0.4), '站墨弹反窗口不是 0.4 秒');
  assert(near(G.player.absorbRadius, 100), '站墨弹反范围不是 100 像素');
  G.render();
});
test('90 像素敌弹仅在站墨强化时进入弹反判定', () => {
  fresh(); G.player.xpNext = 999;
  let e = enemy('pencilthrower', 200, 0);
  let eb = { x: 90, y: 0, vx: 0, vy: 0, dmg: 10, life: 2, sourceId: e.id, reflectable: true };
  G.ebullets.push(eb); G.castAbsorb(); G.update(0);
  assert(eb.life > 0 && G.bullets.length === 0, '基础 65 像素范围误弹了 90 像素敌弹');

  fresh(); G.player.xpNext = 999;
  G.addInkStain(G.player.x, G.player.y, 3, 30, '#1a2b8f', false, true);
  e = enemy('pencilthrower', 200, 0);
  eb = { x: 90, y: 0, vx: 0, vy: 0, dmg: 10, life: 2, sourceId: e.id, reflectable: true };
  G.ebullets.push(eb); G.castAbsorb(); G.update(0);
  assert(eb.life === 0 && G.bullets.length === 1 && G.bullets[0].kind === 'reflect', '站墨 100 像素范围没有弹反 90 像素敌弹');
});
test('吸墨将敌弹转为飞向发射者的己方高伤返还弹', () => {
  fresh(); G.player.ink = 50; const e = enemy('pencilthrower', 100, 0);
  const eb = { x: 0, y: 0, vx: -100, vy: 0, dmg: 10, life: 2, sourceId: e.id, reflectable: true };
  G.ebullets.push(eb); G.castAbsorb(); const hp = G.player.hp;
  assert(G.reflectEnemyBullet(eb), '窗口内敌弹没有被吸收');
  assert(G.player.hp === hp && eb.life === 0, '吸墨后玩家受伤或敌弹未移除');
  assert(G.bullets.length === 1 && G.bullets[0].kind === 'reflect' && G.bullets[0].vx > 0, '返还弹阵营或目标错误');
  assert(near(G.bullets[0].dmg, 15) && near(G.player.ink, 53), '返还弹伤害或吸墨回复错误');
  assert(near(G.player.special, 24.8), '子弹弹反的 20% 充能或返还弹墨迹充能错误');
  assert(near(G.hitStop, 0.3) && G.novas.length === 0, '子弹弹反慢放错误或误放小墨潮');
  G.hurtPlayer(20);
  assert(G.player.hp === hp, '弹反慢放期间仍受到其他伤害');
  assert(G.floats.some(f => f.txt === '返还！'), '缺少返还反馈');
});
test('吸墨反弹挥击伤害并僵直攻击者，玩家不受伤', () => {
  fresh(); G.player.ink = 50; G.player.special = 37;
  const e = enemy('stick', 30, 0); e.hp = e.maxhp = 500;
  const hp = G.player.hp, ehp = e.hp;
  e.swingT = 0.13; e.swingHit = false; G.castAbsorb(); G.updateMeleeSwing(e, 0.02);
  assert(G.player.hp === hp, '成功反弹后玩家仍受伤');
  assert(near(ehp - e.hp, e.dmg * 1.5 + 27.5), '挥击反伤与小墨潮总伤害错误');
  assert(e.stunT >= 0.49 && e.swingT === 0, '反弹没有打断挥击或僵直');
  assert(near(G.player.ink, 58) && G.floats.some(f => f.txt === '反弹！'), '挥击返墨或反馈错误');
  assert(near(G.hitStop, 0.3), '近战弹反没有触发 0.3 秒慢放');
  assert(G.novas.length === 1 && near(G.novas[0].max, 120), '小墨潮数量或半径错误');
  assert(near(G.player.special, 57), '近战弹反没有充能 20%，或小墨潮错误改变了充能');
});
test('近战攻击圈与弹反圈相交即可弹反，不要求角色中心进入攻击圈', () => {
  fresh(); const e = enemy('stick', 90, 0); e.hp = e.maxhp = 500;
  const hp = G.player.hp, ehp = e.hp;
  e.swingT = 0.13; e.swingHit = false; G.castAbsorb(); G.updateMeleeSwing(e, 0.02);
  assert(G.player.hp === hp && e.hp < ehp && e.swingT === 0, '两圈相交但没有触发近战弹反');
});
test('攻击圈出现后再按吸墨，仍可在剩余持续时间内弹反', () => {
  fresh(); const e = enemy('stick', 90, 0); e.hp = e.maxhp = 500;
  const hp = G.player.hp, ehp = e.hp;
  e.swingT = 0.13; e.swingHit = false; G.updateMeleeSwing(e, 0.02);
  assert(e.hp === ehp && e.swingHit && e.swingT > 0, '前置攻击状态不正确');
  G.castAbsorb(); G.updateMeleeSwing(e, 0.02);
  assert(e.hp < ehp && e.swingT === 0 && G.player.hp === hp, '攻击圈出现后补按吸墨仍无法弹反');
});
test('站墨后的 100 像素圈对近战同样生效，圈外不会误弹', () => {
  fresh(); let e = enemy('stick', 140, 0); e.hp = e.maxhp = 500;
  let ehp = e.hp; e.swingT = 0.13; e.swingHit = false; G.castAbsorb(); G.updateMeleeSwing(e, 0.02);
  assert(e.hp === ehp && e.swingT > 0, '基础弹反圈误弹了判定圈外的怪物');

  fresh(); G.addInkStain(G.player.x, G.player.y, 3, 30, '#1a2b8f', false, true);
  e = enemy('stick', 140, 0); e.hp = e.maxhp = 500; ehp = e.hp;
  e.swingT = 0.13; e.swingHit = false; G.castAbsorb(); G.updateMeleeSwing(e, 0.02);
  assert(e.hp < ehp && e.swingT === 0, '站墨强化范围没有用于近战弹反');
});
test('小墨潮击退范围内怪物，不影响范围外怪物', () => {
  fresh(); const inside = enemy('stick', 80, 0), outside = enemy('stick', 160, 0);
  inside.hp = inside.maxhp = 500; outside.hp = outside.maxhp = 500;
  const outsideHp = outside.hp; G.castMeleeInkSurge();
  assert(near(inside.kbx, 540) && near(inside.kby, 0), '范围内怪物没有获得预期击退');
  assert(outside.kbx === 0 && outside.kby === 0 && outside.hp === outsideHp, '范围外怪物受到小墨潮影响');
});
test('没有吸墨窗口时挥击正常命中且不反伤', () => {
  fresh(); const e = enemy('stick', 30, 0); const hp = G.player.hp, ehp = e.hp;
  e.swingT = 0.13; e.swingHit = false; G.updateMeleeSwing(e, 0.02);
  assert(G.player.hp < hp && near(e.hp, ehp), '未招架时伤害或反伤判定错误');
});
test('已造成伤害的挥击不能补报弹反成功', () => {
  fresh(); const e = enemy('stick', 0, 0); const hp = G.player.hp, ehp = e.hp;
  e.swingT = 0.13; e.swingHit = false; G.updateMeleeSwing(e, 0.02);
  assert(G.player.hp < hp && e.swingDamage, '前置挥击没有实际造成伤害');
  const hitHp = G.player.hp;
  G.castAbsorb(); G.updateMeleeSwing(e, 0.02);
  assert(e.hp === ehp && e.swingT > 0 && G.player.hp === hitHp, '已命中挥击被补报为弹反');
  assert(!G.floats.some(f => f.txt === '反弹！'), '已命中挥击仍出现弹反成功反馈');
});
test('单次吸墨的子弹返墨最多为 12', () => {
  fresh(); G.player.ink = 50; const e = enemy('pencilthrower', 100, 0); G.castAbsorb();
  for (let i = 0; i < 12; i++) G.reflectEnemyBullet({ x: 0, y: 0, vx: -100, vy: 0, dmg: 1, life: 2, sourceId: e.id });
  assert(near(G.player.ink, 62), '单次吸墨返墨没有封顶 12：' + G.player.ink);
  assert(near(G.player.special, 100), '连续弹反的墨潮充能没有封顶 100%');
  G.render();
});
test('Boss 近身碰撞可以被弹反，玩家不掉血且 Boss 受反伤', () => {
  fresh(); G.player.xpNext = 999; G.spawnBoss(1);
  const e = G.enemies[G.enemies.length - 1];
  e.x = G.player.x + 20; e.y = G.player.y; e.hp = e.maxhp = 5000; e.hitCd = 0;
  const hp = G.player.hp, ehp = e.hp;
  G.castAbsorb(); G.update(0);
  assert(G.player.hp === hp && e.hp < ehp, 'Boss 近身碰撞未弹反或仍造成伤害');
  assert(e.stunT > 0 && G.floats.some(f => f.txt === '反弹！'), 'Boss 弹反缺少僵直或成功反馈');
});
test('Boss 陨石可以被弹反，危险区消失且玩家不掉血', () => {
  fresh(); G.player.xpNext = 999; G.spawnBoss(4);
  const e = G.enemies[G.enemies.length - 1];
  assert(e.arch === 'caster', '测试 Boss 不是龙息陨石原型');
  const hp = G.player.hp, ehp = e.hp;
  G.hazards.push({ kind: 'meteor', x: G.player.x, y: G.player.y, r: 46, delay: 0, dmg: 20, t: 0.35, done: false, sourceId: e.id });
  G.castAbsorb(); G.update(0);
  assert(G.hazards.length === 0 && G.player.hp === hp && e.hp < ehp, 'Boss 陨石未弹反、危险区未移除或玩家仍受伤');
  assert(G.floats.some(f => f.txt === '反弹！'), 'Boss 陨石弹反缺少成功反馈');
});
test('弹反慢放按 0.15 倍速推进，结束后恢复正常速度', () => {
  fresh(); G.hitStop = 0.3; G.last = 1000; G.loop(1016);
  assert(near(G.time, 0.016 * 0.15) && near(G.hitStop, 0.3 - 0.016), '慢放期间游戏时间没有按 0.15 倍速推进');
  G.hitStop = 0; G.loop(1032);
  assert(near(G.time, 0.016 * 1.15), '慢放结束后游戏没有恢复正常速度');
});
console.log(failed ? 'PARRY_TEST_FAILURES: ' + failed : 'PARRY_TEST_OK (20/20)');
process.exit(failed ? 1 : 0);

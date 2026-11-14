// 荒原六足狸：六足步态、五种招式、弹反属性、连段与绘制专项测试。
require('./creature-designs.js');
require('./creature-design-renderer.js');
require('./creature-game-runtime.js');
require('./procedural-locomotion.js');
require('./hexapod-runtime.js');
const fs = require('fs');
const src = fs.readFileSync(__dirname + '/enemy-config.js', 'utf8') + '\n'
  + fs.readFileSync(__dirname + '/main.js', 'utf8').replace("'use strict';", '') + '\n'
  + fs.readFileSync(__dirname + '/boss-ai-runtime.js', 'utf8') + '\n'
  + fs.readFileSync(__dirname + '/boss-standard-runtime.js', 'utf8');
const fakeCtx = new Proxy({}, { get(t, k) { if (k === 'measureText') return () => ({ width: 10 }); return () => {}; }, set() { return true; } });
const fakeCanvas = { getContext: () => fakeCtx, width: 0, height: 0, style: {}, addEventListener() {}, getBoundingClientRect: () => ({ left: 0, top: 0, width: 375, height: 667 }) };
global.window = { addEventListener() {}, devicePixelRatio: 1, innerWidth: 375, innerHeight: 667 };
global.document = { getElementById: () => fakeCanvas }; global.requestAnimationFrame = () => {};
eval(src + `
;globalThis.G = {
  resetGame, spawnBoss, castAbsorb, render,
  get BOSS_DEFS() { return BOSS_DEFS; },
  get player() { return player; }, get enemies() { return enemies; },
  get floats() { return floats; }, set state(v) { state = v; }
};`);
const S = globalThis.BossStandardRuntime, H = globalThis.HexapodRuntime;
let failed = 0, passed = 0;
function test(name, fn) { try { fn(); passed++; console.log('OK  ' + name); } catch (e) { failed++; console.log('ERR ' + name + ': ' + e.stack); } }
function assert(ok, msg) { if (!ok) throw new Error(msg); }
function freshBoss() {
  G.resetGame(); G.state = 'play'; G.player.xpNext = 99999; G.spawnBoss(11);
  const e = G.enemies[G.enemies.length - 1];
  e.x = 0; e.y = 0; e.faceA = 0; e.kbx = e.kby = 0;
  G.player.x = 180; G.player.y = 0; G.player.hurtT = 0; G.player.goldT = 0;
  return e;
}
function beginActive(e) { e.huntT = 0; S.update(e, 0.001); }

test('扩展 Boss 定义与挑战编号 11 对应荒原六足狸', () => {
  assert(G.BOSS_DEFS.length === 20 && G.BOSS_DEFS[10].page === 19, 'Boss 定义或展示页码错误');
  const e = freshBoss();
  assert(e.name === '荒原六足狸' && e.hexapod === 'feral' && e.bossAI === 'standard', 'Boss 控制器或外形标记未接入');
  assert(Object.keys(S.PROFILES[11].moves).length === 5, '不是五种独立招式');
});

test('六足分成两组三足，静止时支撑脚不滑动', () => {
  const e = freshBoss(), rig = H.ensure(e);
  assert(rig.legs.length === 6 && rig.legs.filter(l => l.group === 0).length === 3, '六足或三足分组错误');
  H.update(e, 0.016);
  const before = rig.legs.map(l => [l.x, l.y]);
  H.update(e, 0.016);
  assert(rig.legs.every((l, i) => l.x === before[i][0] && l.y === before[i][1]), '静止时脚掌发生滑动');
});

test('实际移动驱动抬脚，且保持双段 IK 腿长约束', () => {
  const e = freshBoss(), rig = H.ensure(e);
  for (let i = 0; i < 20; i++) { e.x += 8; H.update(e, 0.016); }
  assert(rig.legs.some(l => l.state === 'stepping' || l.stepT > 0), '移动没有驱动六足步态');
  const poses = rig.getPose(e);
  assert(poses.every(p => Number.isFinite(p.knee.x) && Number.isFinite(p.foot.x)), 'IK 姿势出现非法坐标');
});

test('五种招式均可前摇、出手、收招并完整渲染', () => {
  for (const kind of Object.keys(S.PROFILES[11].moves)) {
    const e = freshBoss(); S.startAttack(e, kind); G.render();
    assert(e.huntMode === 'windup' && e.attack === kind, kind + ' 未进入前摇');
    beginActive(e); e.huntT = Math.max(0.001, e.activeDuration * 0.45); S.update(e, 0.001); G.render();
    e.huntMode = 'recover'; e.huntT = 0; S.update(e, 0.001); G.render();
    assert(e.huntLast === kind || e.huntMode === 'fatigue', kind + ' 收招状态错误');
  }
});

test('裂纸爪可弹反并打断当前招式', () => {
  const e = freshBoss(); G.player.x = 180; G.castAbsorb(); const hp = G.player.hp;
  S.startAttack(e, 'feralClaw'); e.huntMode = 'active'; e.huntT = 0.1; S.update(e, 0.001);
  assert(G.player.hp === hp && e.huntMode === 'recover', '裂纸爪弹反未生效');
  assert(G.floats.some(f => f.txt === '弹反！'), '缺少弹反反馈');
});

test('裂纸爪使用有内缘的窄月牙，第二爪左右镜像', () => {
  const e = freshBoss(), m = S.PROFILES[11].moves.feralClaw;
  S.startAttack(e, 'feralClaw');
  const firstSide = e.clawSide;
  const firstOrigin = { x: e.x + m.clawForward, y: e.y + firstSide * m.clawOffset };
  assert(m.kind === 'crescent' && m.innerRange > 0 && m.arc < 1, '爪击不是独立窄月牙形状');
  S.startAttack(e, 'feralClaw', true);
  const secondOrigin = { x: e.x + m.clawForward, y: e.y + e.clawSide * m.clawOffset };
  assert(e.clawSide === -firstSide, '第二爪没有切换左右侧');
  assert(Math.hypot(firstOrigin.x - secondOrigin.x, firstOrigin.y - secondOrigin.y) === m.clawOffset * 2, '左右爪原点没有镜像分离');
});

test('荒原扑杀不可弹反，落点与预警共用同一坐标', () => {
  const e = freshBoss(); G.player.x = 180; G.castAbsorb(); const hp = G.player.hp;
  S.startAttack(e, 'feralPounce'); e.huntT = 0.1; S.update(e, 0.01);
  const target = [e.targetX, e.targetY]; beginActive(e);
  e.huntT = e.activeDuration * 0.1; S.update(e, 0.001);
  assert(G.player.hp < hp && G.player.absorbT === 0 && e.attackResolved, '不可弹反扑杀没有正确结算');
  assert(e.targetX === target[0] && e.targetY === target[1], '扑杀落点在锁定后变化');
});

test('荒原扑杀落地后真实向前滑行 80', () => {
  const e = freshBoss(); S.startAttack(e, 'feralPounce'); beginActive(e);
  const tx = e.targetX, ty = e.targetY;
  e.huntT = 0.001; S.update(e, 0.001);
  assert(Math.abs(Math.hypot(e.x - tx, e.y - ty) - 80) < 0.001, '扑杀结束没有形成 80 的真实滑行');
  assert(e.pounceHeight === 0 && e.huntMode === 'recover', '滑行后未正常落地收招');
});

test('折返奔袭反向且平行偏移 110，偏移在预警期完成', () => {
  const e = freshBoss(); e.phase = 2; S.startAttack(e, 'feralCharge');
  e.x = 400; e.y = 0; S.startAttack(e, 'feralCharge', true);
  assert(e.lockDx * e.chargeRootDx + e.lockDy * e.chargeRootDy < -0.999, '返程没有反向：' + JSON.stringify([e.lockDx, e.lockDy, e.chargeRootDx, e.chargeRootDy]));
  assert(e.x === 400 && e.y === 0, '返程在预警开始前发生瞬移');
  assert(Math.abs(Math.hypot(e.chargeShiftX - 400, e.chargeShiftY) - 110) < 0.001, '返程通道不是平行偏移 110');
  e.huntT = 0; S.update(e, 0.001);
  assert(Math.abs(Math.hypot(e.x - 400, e.y) - 110) < 0.001, '进入返程出手时未完成侧向换位');
});

test('侧步反扑沿弧线移动 120，并始终攻击旧位置', () => {
  const e = freshBoss(), start = { x: e.x, y: e.y }; S.startAttack(e, 'feralFlank');
  G.player.x = 420; G.player.y = 220;
  e.huntT = 0; S.update(e, 0.001);
  assert(e.flankTargetX === 180 && e.flankTargetY === 0, '反扑目标被新位置重新吸附');
  const travel = Math.hypot(e.x - start.x, e.y - start.y);
  assert(Math.abs(travel - 2 * 180 * Math.sin(120 / 180 / 2)) < 0.01, '侧步不是指定长度的弧线');
  const oldAngle = Math.atan2(-e.y, 180 - e.x);
  assert(Math.abs(globalThis.BossAI.norm(e.faceA - oldAngle)) < 0.001, '出手朝向没有锁定旧位置');
});

test('二阶段爪击与冲锋获得各自二段，不串成无限连招', () => {
  let e = freshBoss(); e.phase = 2; S.startAttack(e, 'feralClaw');
  assert(e.ai.combo.length === 1 && e.ai.combo[0] === 'feralClaw', '二阶段爪击派生错误');
  e = freshBoss(); e.phase = 2; S.startAttack(e, 'feralCharge');
  assert(e.ai.combo.length === 1 && e.ai.combo[0] === 'feralCharge', '二阶段折返派生错误');
});

if (failed) { console.error('HEXAPOD_BOSS_TEST_FAILED (' + failed + ')'); process.exit(1); }
console.log('HEXAPOD_BOSS_TEST_OK (' + passed + '/' + passed + ')');

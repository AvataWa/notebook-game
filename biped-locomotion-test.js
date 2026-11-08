'use strict';
const assert = require('assert');
const BL = require('./biped-locomotion.js');

const ids = ['player', 'stick', 'doodle', 'rage', 'pencilthrower', 'elitePencil', 'eliteCrossbow', 'bossJudge'];
assert.strictEqual(BL.DEFS.length, 8);
assert.deepStrictEqual(BL.DEFS.map(d => d.id), ids);
for (const d of BL.DEFS) {
  assert(d.color && d.accent && d.accessory && d.name);
  assert(d.upperLen > 0 && d.lowerLen > 0 && d.stepLength > 0 && d.swingTime > 0);
}

function close(actual, expected, label) {
  assert(Math.abs(actual - expected) < 0.002, `${label}: ${actual} != ${expected}`);
}
function validatePose(rig, label) {
  const pose = rig.getPose();
  for (const leg of pose.legs) {
    for (const p of [leg.hip, leg.knee, leg.foot]) {
      assert(Number.isFinite(p.x) && Number.isFinite(p.y), `${label} 非有限关节坐标`);
    }
    close(Math.hypot(leg.knee.x - leg.hip.x, leg.knee.y - leg.hip.y), rig.def.upperLen, `${label} 大腿长度`);
    close(Math.hypot(leg.foot.x - leg.knee.x, leg.foot.y - leg.knee.y), rig.def.lowerLen, `${label} 小腿长度`);
    assert(leg.reachable, `${label} 脚点超出腿长`);
    if (leg.phase === 'stance') close(leg.foot.y, 0, `${label} 支撑脚贴地`);
    else assert(leg.foot.y >= 0, `${label} 摆动脚穿地`);
  }
  for (const arm of pose.arms) {
    for (const p of [arm.shoulder, arm.knee, arm.foot]) assert(Number.isFinite(p.x) && Number.isFinite(p.y));
  }
  assert(pose.legs.filter(l => l.phase === 'swing').length <= 1, `${label} 双腿同时摆动`);
  close(pose.chest.x, pose.pelvis.x, `${label} 躯干不得倾斜`);
  close(pose.neck.x, pose.pelvis.x, `${label} 颈部不得倾斜`);
  close(pose.head.x, pose.pelvis.x, `${label} 头部不得倾斜`);
}

for (const d of BL.DEFS) {
  const rig = new BL.BipedRig(d.id);
  let previous = rig.legs.map(l => ({ phase: l.phase, x: l.footX }));
  for (let frame = 0; frame < 60 * 8; frame++) {
    rig.update(1 / 60);
    validatePose(rig, d.id);
    rig.legs.forEach((leg, i) => {
      if (previous[i].phase === 'stance' && leg.phase === 'stance') {
        assert.strictEqual(leg.footX, previous[i].x, `${d.id} 支撑脚滑动`);
      }
    });
    previous = rig.legs.map(l => ({ phase: l.phase, x: l.footX }));
  }
  assert(rig.steps >= 8, `${d.id} 没有持续交替迈步: ${rig.steps}`);
  assert(rig.plantEvents.length >= 2, `${d.id} 缺少落地事件`);
  const plantedSides = rig.plantEvents.map(e => e.leg);
  for (let i = 1; i < plantedSides.length; i++) assert.notStrictEqual(plantedSides[i], plantedSides[i - 1], `${d.id} 同脚连续落地`);
}

const variable = new BL.BipedRig('player');
for (let frame = 0; frame < 60 * 10; frame++) {
  const speed = frame % 240 < 120 ? 30 : frame % 240 < 180 ? 72 : 0;
  variable.update(1 / 60, speed);
  validatePose(variable, '变速主角');
}
assert(variable.steps >= 12, '变速后步态无法继续');

for (const speed of [58, 96, 144, 200]) {
  const fast = new BL.BipedRig('player');
  const baseY = (fast.def.upperLen + fast.def.lowerLen) * fast.def.hipHeight;
  let minPelvis = Infinity;
  for (let frame = 0; frame < 60 * 6; frame++) {
    fast.update(1 / 60, speed);
    validatePose(fast, `高速主角 ${speed}`);
    minPelvis = Math.min(minPelvis, fast.getPose().pelvis.y);
  }
  assert(minPelvis >= baseY * 0.72, `速度 ${speed} 出现跪地：骨盆 ${minPelvis.toFixed(2)} / 基准 ${baseY.toFixed(2)}`);
  assert(fast.steps >= 12, `速度 ${speed} 步态停滞`);
}

const abrupt = new BL.BipedRig('player');
for (let frame = 0; frame < 600 && !abrupt.legs.some(l => l.phase === 'swing'); frame++) abrupt.update(1 / 60, 58);
const swinging = abrupt.legs.find(l => l.phase === 'swing');
assert(swinging, '没有找到摆动腿');
const duration = swinging.duration, progress = swinging.swingT;
abrupt.update(1 / 60, 180);
assert.strictEqual(swinging.duration, duration, '变速导致本次摆腿时长跳变');
assert(Math.abs(swinging.swingT - progress - 1 / 60) < 1e-9, '变速导致摆腿进度跳变');

const reverse = new BL.BipedRig('bossJudge');
reverse.update(1 / 60);
assert.strictEqual(reverse.def.kneeBend, -1, '判官未使用反向膝关节');
assert.strictEqual(BL.DEFS.find(d => d.id === 'player').kneeBend, 1, '主角膝弯配置异常');

const swimmer = new BL.BipedRig('player');
let previousHandX = null, swimMoved = false;
for (let frame = 0; frame < 240; frame++) {
  swimmer.update(1 / 60, 80);
  const pose = swimmer.getSwimPose();
  assert(pose.swimming && pose.neck.x > pose.pelvis.x && pose.head.x > pose.neck.x, '潜墨身体没有放平朝前');
  for (const leg of pose.legs) {
    close(Math.hypot(leg.knee.x - leg.hip.x, leg.knee.y - leg.hip.y), swimmer.def.upperLen, '游泳大腿长度');
    close(Math.hypot(leg.foot.x - leg.knee.x, leg.foot.y - leg.knee.y), swimmer.def.lowerLen, '游泳小腿长度');
    assert(leg.reachable, '游泳打腿超出腿长');
  }
  for (const arm of pose.arms) {
    close(Math.hypot(arm.knee.x - arm.shoulder.x, arm.knee.y - arm.shoulder.y), swimmer.def.armLen * 0.52, '游泳上臂长度');
    close(Math.hypot(arm.foot.x - arm.knee.x, arm.foot.y - arm.knee.y), swimmer.def.armLen * 0.48, '游泳前臂长度');
    assert(arm.reachable, '游泳划水超出臂长');
  }
  if (previousHandX !== null && Math.abs(previousHandX - pose.arms[0].foot.x) > 0.01) swimMoved = true;
  previousHandX = pose.arms[0].foot.x;
}
assert(swimMoved, '游泳手臂没有持续划水');

console.log('BIPED_TEST_OK：8 个独立人形原型、交替迈步、双段 IK、变速与潜墨游泳检查通过');

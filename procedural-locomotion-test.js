'use strict';
const assert = require('assert');
const { MultiLegRig, createSpiderRig, solveTwoBoneIK } = require('./procedural-locomotion.js');

// 普通巡航测试让身体朝向与 +X 移动一致；初始急转弯在独立用例中验证。
const body = { x: 0, y: 0, locomotionAngle: Math.PI / 2 };
const rig = createSpiderRig(body);
assert.strictEqual(rig.legs.length, 8, '蜘蛛必须有八条腿');
assert(rig.legs.every(l => l.state === 'planted'), '出生时全部落地');

const original = rig.legs.map(l => ({ x: l.x, y: l.y }));
rig.update(body, 1 / 60);
assert(rig.legs.every((l, i) => l.x === original[i].x && l.y === original[i].y), '静止时不能滑脚或原地踏步');

let maxSwing = 0, sequenceCursor = 0;
const starts = [], expected = [0, 4, 1, 5, 2, 6, 3, 7];
for (let n = 0; n < 360; n++) {
  // 普通追击速度：严格验证 1→2→3→4 波动顺序；高速保护另测。
  body.x += 0.8;
  const before = rig.legs.map(l => ({ x: l.x, y: l.y, state: l.state }));
  rig.update(body, 1 / 60);
  rig.legs.forEach((leg, i) => {
    if (before[i].state === 'planted' && leg.state === 'planted') {
      assert(leg.x === before[i].x && leg.y === before[i].y, '支撑脚在世界坐标中不能滑动');
    }
    if (before[i].state === 'planted' && leg.state === 'stepping') {
      starts.push(i);
      assert.strictEqual(i, expected[sequenceCursor % expected.length], '后一对足不能越过前一对抢步');
      sequenceCursor++;
    }
  });
  const swinging = rig.legs.filter(l => l.state === 'stepping');
  maxSwing = Math.max(maxSwing, swinging.length);
  assert(swinging.length <= 2, '波动步态始终至少保留六条支撑腿');
}
assert(starts.length > 16, '移动必须持续触发迈步');
const leftOrder = starts.filter(i => i < 4), rightOrder = starts.filter(i => i >= 4);
for (let i = 1; i < leftOrder.length; i++) assert.strictEqual(leftOrder[i], (leftOrder[i - 1] + 1) % 4, '左侧必须是 1→2→3→4');
for (let i = 1; i < rightOrder.length; i++) assert.strictEqual(rightOrder[i], 4 + (rightOrder[i - 1] - 3) % 4, '右侧必须是 1→2→3→4');

body.vx = 0;
const still = rig.legs.map(l => ({ x: l.targetX, y: l.targetY }));
for (let n = 0; n < 180; n++) rig.update(body, 1 / 60);
for (const leg of rig.legs) {
  assert(Number.isFinite(leg.x) && Number.isFinite(leg.y), '落脚点必须有效');
  assert(Math.hypot(leg.x - body.x, leg.y - body.y) < 45, '腿不能无限拉伸');
}

const ik = solveTwoBoneIK({ x: 0, y: 0 }, { x: 12, y: 0 }, 8, 8, 1);
assert(Math.abs(Math.hypot(ik.x, ik.y) - 8) < 1e-6, 'IK 上段长度错误');
assert(Math.abs(Math.hypot(12 - ik.x, -ik.y) - 8) < 1e-6, 'IK 下段长度错误');

function assertPoseWithinReach(r, b, label) {
  let maxRatio = 0;
  for (const p of r.getPose(b)) {
    for (const point of [p.hip, p.knee, p.foot]) {
      assert(Number.isFinite(point.x) && Number.isFinite(point.y), label + '：姿态坐标必须有效');
    }
    const distance = Math.hypot(p.foot.x - p.hip.x, p.foot.y - p.hip.y);
    const limit = p.leg.upper + p.leg.lower - 0.65;
    maxRatio = Math.max(maxRatio, distance / limit);
    assert(distance <= limit + 1e-6, label + '：视觉腿长不能超过骨骼总长');
  }
  return maxRatio;
}

const turned = createSpiderRig({ x: 0, y: 0 });
const turnedBody = { x: 0, y: 0 };
for (let n = 0; n < 90; n++) {
  const a = n / 90 * Math.PI * 2;
  turnedBody.x = Math.cos(a) * 20; turnedBody.y = Math.sin(a) * 20;
  turned.update(turnedBody, 1 / 60);
  assertPoseWithinReach(turned, turnedBody, '圆周转向');
}
assert(turned.legs.every(l => Number.isFinite(l.x) && Number.isFinite(l.y)), '转向时步态必须稳定');

// 与正式游戏蜘蛛相同的 105 px/s：允许紧急收步，但不允许视觉长腿。
const fastBody = { x: 0, y: 0, locomotionAngle: Math.PI / 2 };
const fastRig = createSpiderRig(fastBody);
let fastMaxRatio = 0;
for (let n = 0; n < 360; n++) {
  fastBody.x += 1.75;
  fastRig.update(fastBody, 1 / 60);
  fastMaxRatio = Math.max(fastMaxRatio, assertPoseWithinReach(fastRig, fastBody, '高速追击'));
}
assert(fastMaxRatio > 0.95, '高速测试必须真正走到接近腿长极限的区域');

// 40 px 瞬发击退后立刻反向、直角转弯，模拟战斗中的极端位移。
const knockBody = { x: 0, y: 0, locomotionAngle: Math.PI / 2 };
const knockRig = createSpiderRig(knockBody);
for (let n = 0; n < 30; n++) {
  knockBody.x += 1.75; knockRig.update(knockBody, 1 / 60);
}
knockBody.x += 40;
knockRig.update(knockBody, 1 / 60);
assertPoseWithinReach(knockRig, knockBody, '瞬间击退');
for (let n = 0; n < 120; n++) {
  const a = n % 40 < 20 ? Math.PI : Math.PI / 2;
  knockBody.x += Math.cos(a) * 2.2; knockBody.y += Math.sin(a) * 2.2;
  knockRig.update(knockBody, 1 / 60);
  assertPoseWithinReach(knockRig, knockBody, '击退后急转');
}

const { updateSpiderLocomotionLOD } = require('./procedural-locomotion.js');
const switchBody = { x: 0, y: 0, locomotionAngle: Math.PI / 2 };
const switchRig = createSpiderRig(switchBody); switchBody.locomotionRig = switchRig;
for (let n = 0; n < 180; n++) {
  switchBody.x += 1.75;
  const distance = n < 60 ? 500 : n < 120 ? 250 : 100;
  updateSpiderLocomotionLOD(switchBody, 1 / 60, distance, true);
  assertPoseWithinReach(switchRig, switchBody, '远中近 LOD 切换');
}

function lodUpdates(distance, onscreen) {
  const b = { x: 0, y: 0 }, r = createSpiderRig(b);
  b.locomotionRig = r;
  let calls = 0; const originalUpdate = r.update.bind(r);
  r.update = (body, dt) => { calls++; originalUpdate(body, dt); };
  for (let i = 0; i < 60; i++) updateSpiderLocomotionLOD(b, 1 / 60, distance, onscreen);
  return { calls, level: b.locomotionLod, poseReused: r.getPose(b) === r.getPose(b) };
}
const near = lodUpdates(100, true), mid = lodUpdates(250, true), far = lodUpdates(500, true), off = lodUpdates(100, false);
assert.strictEqual(near.calls, 60, '近处必须逐帧更新');
assert(Math.abs(mid.calls - 30) <= 1, '中距离必须约 30 Hz');
assert(Math.abs(far.calls - 12) <= 1, '远处必须约 12 Hz');
assert(Math.abs(off.calls - 8) <= 1, '屏外必须约 8 Hz');
assert(near.level === 0 && mid.level === 1 && far.level === 2 && off.level === 3, 'LOD 分区错误');
assert(near.poseReused, 'IK 姿态数组必须复用，避免逐帧分配');

console.log('OK  多足模组：普通顺序、脚底固定、IK、高速、击退、急转、LOD 切换与对象复用全部通过');
console.log('高速视觉腿长最大比例：' + fastMaxRatio.toFixed(3));

'use strict';
const assert = require('assert');
const PL = require('./procedural-locomotion.js');
const { DEFS } = require('./creature-designs.js');
const { PROFILES, createBioRig, updateBio } = require('./creature-bio-rig.js');
assert.strictEqual(DEFS.length, 29, '总览应包含玩家与全部 28 个敌人');
assert.strictEqual(new Set(DEFS.map(d => d.id)).size, DEFS.length, '角色 ID 不能重复');
assert.deepStrictEqual(DEFS.reduce((n, d) => (n[d.group]++, n), { player: 0, normal: 0, elite: 0, boss: 0 }),
  { player: 1, normal: 13, elite: 5, boss: 10 }, '角色分组数量错误');

// 总览蜘蛛必须直接使用原型的每一条骨骼参数。
const spiderDef = DEFS.find(d => d.id === 'spider');
const spiderBody = { x: 0, y: 0, locomotionAngle: Math.PI / 2 };
const previewSpider = createBioRig(spiderDef, spiderBody);
const originalSpider = PL.createSpiderRig(spiderBody);
const boneKeys = ['hipX', 'hipY', 'restX', 'restY', 'upper', 'lower', 'bend', 'liftHeight'];
for (let i = 0; i < 8; i++) for (const key of boneKeys) {
  assert.strictEqual(previewSpider.legs[i][key], originalSpider.legs[i][key], '蜘蛛原型参数被改变：' + key);
}
assert.deepStrictEqual(previewSpider.options.sequence, originalSpider.options.sequence, '蜘蛛必须保留原始波动顺序');

for (const d of DEFS) {
  assert(PROFILES[d.id], d.name + '：缺少独立运动算法配置');
  assert(Number.isInteger(d.legs) && d.legs >= 0 && d.legs <= 12, d.name + '：腿数无效');
  const body = { x: 0, y: 0, locomotionAngle: Math.PI / 2 };
  const rig = createBioRig(d, body);
  assert.strictEqual(rig ? rig.legs.length : 0, d.legs, d.name + '：生成腿数与配置不一致');
  let stepStarts = 0;
  for (let f = 0; f < 90; f++) {
    const before = rig ? rig.legs.map(l => l.state) : [];
    body.x += d.speed / 60;
    updateBio(d, body, rig, 1 / 60, f / 60);
    if (rig) rig.legs.forEach((l, i) => { if (before[i] === 'planted' && l.state === 'stepping') stepStarts++; });
    if (d.id === 'player') assert(rig.legs.filter(l => l.state === 'stepping').length <= 1, '玩家普通步行必须始终保留支撑脚');
    if (!rig) continue;
    for (const p of rig.getPose(body)) {
      assert(Number.isFinite(p.foot.x) && Number.isFinite(p.foot.y), d.name + '：脚部坐标无效');
      const reach = p.leg.upper + p.leg.lower - 0.65;
      assert(Math.hypot(p.foot.x - p.hip.x, p.foot.y - p.hip.y) <= reach + 1e-6, d.name + '：视觉腿长超限');
    }
  }
  if (rig) assert(stepStarts > 0, d.name + '：独立步态没有实际产生迈步');
}
console.log('CREATURE_BIO_TEST_OK：29 个独立运动配置、实际迈步、蜘蛛原型一致性、玩家长支撑、IK 快速检查通过');

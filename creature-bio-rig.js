/* 生物运动总览专用：每个角色显式定义骨架与步态，不套统一身体比例公式。 */
(function (root, factory) {
  const PL = root.ProceduralLocomotion || (typeof require !== 'undefined' ? require('./procedural-locomotion.js') : null);
  const api = factory(PL);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.CreatureBioRig = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (PL) {
  'use strict';

  // gait: biped 单腿交替 / wave 波动 / tripod 交替三足 / diagonal 对角步 / bound 前后成组 / suction 吸附爬行。
  const PROFILES = {
    player:      { gait: 'biped', sequence: [0, 1], maxSwing: 1, stepDuration: .11, cooldown: .04, bob: .7, sway: .25, turnSpeed: 14, lift: 2.1 },
    stick:       { gait: 'biped', sequence: [0, 1], maxSwing: 1, stepDuration: .15, cooldown: .12, bob: .65, sway: .18, turnSpeed: 11, lift: 2.2 },
    doodle:      { gait: 'biped', sequence: [0, 1], maxSwing: 1, stepDuration: .075, cooldown: .025, bob: .35, sway: .4, turnSpeed: 16, lift: 1.3 },
    spider:      { gait: 'wave', sequence: [0, 4, 1, 5, 2, 6, 3, 7], maxSwing: 2, stepDuration: .12, cooldown: .4, bob: .08, sway: 0, turnSpeed: 12, lift: 2.2 },
    crumple:     { gait: 'wave', sequence: [0, 2, 1, 3], maxSwing: 1, stepDuration: .17, cooldown: .22, bob: .3, sway: 1.2, roll: .055, turnSpeed: 7, lift: 1.2 },
    scissors:    { gait: 'bound', groups: [[0, 2], [1, 3]], stepDuration: .085, bob: .8, sway: .15, lean: .045, turnSpeed: 17, lift: 2.8 },
    rage:        { gait: 'biped', sequence: [0, 1], maxSwing: 1, stepDuration: .21, cooldown: .28, bob: 1.25, sway: .7, turnSpeed: 6, lift: 2.4 },
    ink:         { gait: 'suction', sequence: [0, 3, 1, 4, 2, 5], maxSwing: 1, stepDuration: .2, cooldown: .32, bob: .2, sway: .4, softness: .045, turnSpeed: 5, lift: 1 },
    plane:       { gait: 'flight', bob: 1.8, sway: .3, roll: .08, turnSpeed: 9 },
    leech:       { gait: 'suction', sequence: [0, 3, 1, 4, 2, 5], maxSwing: 1, stepDuration: .16, cooldown: .28, bob: .25, sway: .35, softness: .06, turnSpeed: 8, lift: 1.2 },
    sprayer:     { gait: 'tripod', groups: [[0, 4, 2], [3, 1, 5]], stepDuration: .12, bob: .45, sway: .25, turnSpeed: 12, lift: 1.9 },
    inksac:      { gait: 'wave', sequence: [0, 3, 1, 4, 2, 5], maxSwing: 1, stepDuration: .18, cooldown: .25, bob: .25, sway: 1.3, roll: .035, turnSpeed: 6, lift: 1.1 },
    pencilthrower:{ gait: 'biped', sequence: [0, 1], maxSwing: 1, stepDuration: .13, cooldown: .1, bob: .6, sway: .2, turnSpeed: 10, lift: 2 },
    forkpen:     { gait: 'tripod', groups: [[0, 1], [2]], stepDuration: .17, bob: .35, sway: .55, turnSpeed: 7, lift: 2.2 },

    elitePencil: { gait: 'biped', sequence: [0, 1], maxSwing: 1, stepDuration: .16, cooldown: .1, bob: .85, sway: .18, turnSpeed: 10, lift: 2.8 },
    inkthief:    { gait: 'suction', sequence: [0, 4, 1, 5, 2, 6, 3, 7], maxSwing: 1, stepDuration: .14, cooldown: .18, bob: .25, sway: .45, softness: .04, turnSpeed: 11, lift: 1.8 },
    eliteCrossbow:{ gait: 'wave', sequence: [0, 2, 1, 3], maxSwing: 1, stepDuration: .16, cooldown: .2, bob: .65, sway: .2, turnSpeed: 8, lift: 2.2 },
    eliteEraser: { gait: 'wave', sequence: [0, 2, 1, 3], maxSwing: 1, stepDuration: .23, cooldown: .3, bob: .35, sway: .55, turnSpeed: 5, lift: 1.3 },
    eliteEye:    { gait: 'wave', sequence: [0, 3, 1, 4, 2, 5], maxSwing: 2, stepDuration: .13, cooldown: .22, bob: .9, sway: .25, turnSpeed: 9, lift: 3.1 },

    bossScribble:{ gait: 'wave', sequence: [0, 3, 1, 4, 2, 5, 6], maxSwing: 2, stepDuration: .13, cooldown: .24, bob: .5, sway: .8, turnSpeed: 10, lift: 3.2 },
    bossTape:    { gait: 'wave', sequence: [0, 3, 1, 4, 2, 5], maxSwing: 1, stepDuration: .24, cooldown: .32, bob: .4, sway: .65, turnSpeed: 5, lift: 2 },
    bossJudge:   { gait: 'biped', sequence: [0, 1], maxSwing: 1, stepDuration: .19, cooldown: .14, bob: 1.1, sway: .25, turnSpeed: 9, lift: 4.2 },
    bossDragon:  { gait: 'wave', sequence: [0, 2, 1, 3], maxSwing: 1, stepDuration: .22, cooldown: .25, bob: .55, sway: .45, turnSpeed: 6, lift: 3 },
    bossKnight:  { gait: 'diagonal', groups: [[0, 3], [1, 2]], stepDuration: .15, bob: 1, sway: .2, turnSpeed: 9, lift: 3.6 },
    bossElement: { gait: 'suction', sequence: [0, 4, 1, 5, 2, 6, 3, 7], maxSwing: 1, stepDuration: .19, cooldown: .24, bob: .35, sway: .5, softness: .055, turnSpeed: 7, lift: 2.4 },
    bossOrigami: { gait: 'wave', sequence: [0, 2, 1, 3], maxSwing: 1, stepDuration: .18, cooldown: .24, bob: .45, sway: .2, turnSpeed: 7, lift: 3.2 },
    bossEraser:  { gait: 'bound', groups: [[0, 2], [1, 3]], stepDuration: .14, bob: 1.1, sway: .15, turnSpeed: 8, lift: 3.5 },
    bossAbyss:   { gait: 'suction', sequence: [0, 5, 1, 6, 2, 7, 3, 8, 4, 9], maxSwing: 1, stepDuration: .22, cooldown: .3, bob: .25, sway: .35, softness: .04, turnSpeed: 5, lift: 2 },
    bossNotebook:{ gait: 'wave', sequence: [0, 6, 1, 7, 2, 8, 3, 9, 4, 10, 5, 11], maxSwing: 2, stepDuration: .18, cooldown: .25, bob: .4, sway: .35, turnSpeed: 6, lift: 3.2 }
  };

  const pair = (hipX, hipY, restX, restY, upper, lower, bend, lift) => ({ hipX, hipY, restX, restY, upper, lower, bend, lift });
  // 每对足都显式写出：髋 X/Y、静止脚 X/Y、上段、下段、弯曲方向、抬脚高度。
  const LAYOUTS = {
    player: [pair(2.5, 4.5, 4, 14, 5.8, 6.2, 1, 2.1)],
    stick: [pair(2.8, 5.5, 4.5, 17, 6.5, 7, 1, 2.2)],
    doodle: [pair(2, 3, 3, 9, 4, 4.5, 1, 1.3)],
    crumple: [pair(6, -4, 13, -9, 3.2, 3.4, 1, 1.2), pair(6, 5, 12, 11, 3.1, 3.3, -1, 1.2)],
    scissors: [pair(4, -4, 14, -12, 7, 7.5, 1, 2.8), pair(4, 5, 10, 13, 6, 7, -1, 2.8)],
    rage: [pair(5, 5, 6.5, 14, 6, 6.5, 1, 2.4)],
    ink: [pair(8, -7, 18, -11, 4.5, 5, 1, 1), pair(10, 0, 20, 1, 4.8, 5.2, -1, 1), pair(8, 7, 17, 13, 4.5, 5, 1, 1)],
    leech: [pair(6, -4, 14, -9, 4.5, 5, 1, 1.2), pair(7, 1, 16, 2, 4.5, 5, -1, 1.2), pair(6, 5, 13, 10, 4.5, 5, 1, 1.2)],
    sprayer: [pair(4, -5, 14, -12, 5.5, 6.5, 1, 1.9), pair(5, 0, 16, 1, 5.5, 6.5, -1, 1.9), pair(4, 5, 13, 12, 5.5, 6.5, 1, 1.9)],
    inksac: [pair(7, -7, 17, -12, 4.5, 5, 1, 1.1), pair(8, 1, 18, 3, 4.5, 5, -1, 1.1), pair(7, 9, 16, 15, 4.5, 5, 1, 1.1)],
    pencilthrower: [pair(2.7, 5, 4.5, 15, 6.2, 6.8, 1, 2)],
    forkpen: [pair(5, 4, 16, 13, 7, 8, 1, 2.2)],

    elitePencil: [pair(4, 8, 6, 24, 9, 10, 1, 2.8)],
    inkthief: [pair(8, -7, 25, -18, 8, 9, 1, 1.8), pair(10, -2, 27, -5, 7.5, 8.5, -1, 1.8), pair(10, 4, 24, 9, 7, 8, 1, 1.8), pair(8, 8, 20, 17, 6.5, 7.5, -1, 1.8)],
    eliteCrossbow: [pair(6, -6, 17, -13, 7.5, 8.5, 1, 2.2), pair(6, 7, 15, 16, 7, 8, -1, 2.2)],
    eliteEraser: [pair(10, -6, 21, -11, 5, 5.5, 1, 1.3), pair(10, 7, 21, 14, 5, 5.5, -1, 1.3)],
    eliteEye: [pair(7, -6, 23, -18, 8.5, 9.5, 1, 3.1), pair(9, 0, 27, 1, 9, 10, -1, 3.1), pair(7, 6, 22, 19, 8.5, 9.5, 1, 3.1)],

    bossScribble: [pair(12, -13, 39, -32, 13, 15, 1, 3.2), pair(15, -2, 46, -5, 14, 16, -1, 3.2), pair(11, 12, 36, 31, 13, 15, 1, 3.2)],
    bossTape: [pair(17, -13, 39, -24, 10, 12, 1, 2), pair(20, 0, 43, 3, 11, 12, -1, 2), pair(17, 13, 38, 26, 10, 12, 1, 2)],
    bossJudge: [pair(6, 12, 9, 39, 15, 17, -1, 4.2)],
    bossDragon: [pair(14, -15, 42, -28, 16, 17, 1, 3), pair(15, 18, 44, 34, 16, 18, -1, 3)],
    bossKnight: [pair(12, -12, 35, -27, 14, 15, 1, 3.6), pair(13, 14, 37, 32, 14, 16, -1, 3.6)],
    bossElement: [pair(13, -19, 39, -37, 12, 14, 1, 2.4), pair(17, -6, 46, -12, 13, 14, -1, 2.4), pair(17, 8, 44, 16, 13, 14, 1, 2.4), pair(12, 21, 36, 38, 12, 14, -1, 2.4)],
    bossOrigami: [pair(16, -15, 46, -31, 16, 18, 1, 3.2), pair(16, 17, 45, 35, 16, 18, -1, 3.2)],
    bossEraser: [pair(17, -10, 37, -21, 9, 11, 1, 3.5), pair(17, 11, 38, 25, 9, 11, -1, 3.5)],
    bossAbyss: [pair(20, -20, 51, -38, 11, 13, 1, 2), pair(24, -10, 58, -18, 12, 14, -1, 2), pair(25, 0, 59, 2, 12, 14, 1, 2), pair(23, 11, 55, 22, 12, 14, -1, 2), pair(19, 21, 48, 39, 11, 13, 1, 2)],
    bossNotebook: [pair(20, -25, 57, -48, 16, 18, 1, 3.2), pair(25, -15, 66, -29, 17, 19, -1, 3.2), pair(27, -5, 69, -9, 17, 19, 1, 3.2), pair(27, 6, 68, 12, 17, 19, -1, 3.2), pair(24, 16, 63, 31, 17, 19, 1, 3.2), pair(19, 26, 54, 48, 16, 18, -1, 3.2)]
  };

  function makeLegs(def, profile) {
    const pairs = LAYOUTS[def.id];
    if (!pairs && def.legs) throw new Error(def.id + ' 缺少显式腿部布局');
    const legs = [];
    for (let sideIndex = 0; sideIndex < 2; sideIndex++) {
      const side = sideIndex === 0 ? -1 : 1;
      for (const p of pairs || []) legs.push({
        hipX: p.hipX * side, hipY: p.hipY, restX: p.restX * side, restY: p.restY,
        upper: p.upper, lower: p.lower, bend: p.bend * side, group: sideIndex,
        liftHeight: p.lift || profile.lift, foot: def.foot
      });
    }
    if (def.legs % 2) legs.push({ hipX: 0, hipY: 10, restX: 0, restY: 30,
      upper: 10, lower: 12, bend: 1, group: 0, liftHeight: profile.lift, foot: def.foot });
    return legs;
  }

  class BioRig extends PL.MultiLegRig {
    constructor(def, body, profile) {
      super(body, { legs: makeLegs(def, profile), sequence: profile.sequence || [],
        stepDistance: Math.max(2.2, profile.stepDuration * def.speed * .42),
        stepDuration: profile.stepDuration, velocityPrediction: profile.gait === 'suction' ? .06 : .1,
        turnSpeed: profile.turnSpeed, forwardOffset: Math.PI / 2 });
      this.profile = profile; this.def = def;
    }
    updateMetachronal(dt) {
      const p = this.profile;
      this.sequenceCooldown = Math.max(0, this.sequenceCooldown - dt);
      let swinging = 0;
      for (const leg of this.legs) if (leg.state === 'stepping') swinging++;
      if (p.groups) {
        if (swinging || this.sequenceCooldown > 0) return;
        let group = p.groups[this.activeGroup % p.groups.length], started = false;
        for (const i of group) {
          const leg = this.legs[i];
          if (leg && leg.state === 'planted' && this.needsStep(leg)) { this.beginStep(leg); started = true; }
        }
        this.activeGroup = (this.activeGroup + 1) % p.groups.length;
        if (started) this.sequenceCooldown = this.currentStepDuration * .12;
        return;
      }
      if (swinging >= p.maxSwing || this.sequenceCooldown > 0) return;
      const sequence = p.sequence, leg = this.legs[sequence[this.sequenceIndex]];
      if (!leg || leg.state !== 'planted' || !this.needsStep(leg)) return;
      this.beginStep(leg);
      this.sequenceIndex = (this.sequenceIndex + 1) % sequence.length;
      this.sequenceCooldown = this.currentStepDuration * p.cooldown;
    }
  }

  function createBioRig(def, body) {
    const profile = PROFILES[def.id];
    if (!profile) throw new Error(def.id + ' 缺少独立运动配置');
    // 基准蜘蛛完全沿用原型，不复制、不近似。
    const rig = def.id === 'spider' ? PL.createSpiderRig(body) : (def.legs ? new BioRig(def, body, profile) : null);
    if (rig) rig.bioProfile = profile;
    return rig;
  }

  function updateBio(def, body, rig, dt, time) {
    const p = PROFILES[def.id];
    if (rig) rig.update(body, dt);
    const phase = time * Math.max(2, def.speed * .075) * Math.PI * 2;
    const motion = body.motion || (body.motion = {});
    motion.bob = Math.abs(Math.sin(phase)) * p.bob;
    motion.swayX = Math.sin(phase * .5) * p.sway;
    motion.roll = Math.sin(phase * .5) * (p.roll || 0);
    motion.lean = Math.sin(phase) * (p.lean || 0);
    motion.softness = Math.sin(phase) * (p.softness || 0);
    motion.armSwing = Math.sin(phase) * (p.gait === 'biped' ? 1 : .25);
    motion.flightWing = Math.sin(time * 10) * .12;
    return motion;
  }

  return { PROFILES, LAYOUTS, createBioRig, updateBio };
});

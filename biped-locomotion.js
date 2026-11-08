/* 独立双足步态：世界坐标支撑脚 + 单腿摆动状态机 + 双段 IK。 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.BipedLocomotion = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const INK = '#1a2b8f';
  const GRAPHITE = '#353238';
  const RED = '#a85e55';
  const OCHRE = '#9b8257';
  const BLUEGRAY = '#657987';
  const PAPER = '#f5f1e6';
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = t => t * t * (3 - 2 * t);
  const finitePoint = p => ({ x: Number.isFinite(p.x) ? p.x : 0, y: Number.isFinite(p.y) ? p.y : 0 });

  const DEFAULTS = {
    speed: 55, stepLength: 22, swingTime: 0.26,
    upperLen: 11, lowerLen: 12, hipHeight: 0.88, hipWidth: 4,
    torsoH: 19, headR: 7, armLen: 15, bodyWidth: 8,
    bob: 1.4, lift: 5, lean: 0.08, kneeBend: 1,
    color: GRAPHITE, accent: RED, lineWidth: 1.8,
    foot: 'shoe', accessory: 'none', name: '未命名双足'
  };

  const DEFS = [
    { id: 'player', name: '主角 · 画中人', role: 'player', accessory: 'none',
      color: INK, accent: INK, speed: 58, stepLength: 22, swingTime: 0.24,
      upperLen: 10, lowerLen: 11, torsoH: 18, headR: 7.5, armLen: 14,
      bodyWidth: 8, hipWidth: 4, bob: 1.6, lift: 5.2, lean: 0, lineWidth: 2.1,
      description: '蓝色圆头小人；去掉背包、围巾和头发，只保留清楚的头、身体与四肢。' },
    { id: 'stick', name: '火柴人', role: 'normal', accessory: 'horns',
      color: GRAPHITE, accent: RED, speed: 62, stepLength: 30, swingTime: 0.27,
      upperLen: 13, lowerLen: 14, torsoH: 23, headR: 6.3, armLen: 19,
      bodyWidth: 4, hipWidth: 3, bob: 1.2, lift: 6.5, lean: 0.12, lineWidth: 1.7,
      description: '细长四肢和双角；跨幅最大，摆臂明显，重心始终越过支撑脚。' },
    { id: 'doodle', name: '小人潮', role: 'normal', accessory: 'horns',
      color: GRAPHITE, accent: RED, speed: 43, stepLength: 12, swingTime: 0.14,
      upperLen: 6, lowerLen: 6.5, torsoH: 10, headR: 7.4, armLen: 9,
      bodyWidth: 7, hipWidth: 3, bob: 1.1, lift: 3.2, lean: 0.1, lineWidth: 1.6,
      description: '大头短腿、高频率碎步；步幅小但落脚密集，适合成群围上来。' },
    { id: 'rage', name: '暴躁涂鸦', role: 'normal', accessory: 'heavyHorns',
      color: GRAPHITE, accent: RED, speed: 27, stepLength: 20, swingTime: 0.42,
      upperLen: 9, lowerLen: 10, torsoH: 18, headR: 8, armLen: 16,
      bodyWidth: 18, hipWidth: 8, bob: 2.6, lift: 4.5, lean: 0.16, lineWidth: 2.8,
      foot: 'block', description: '宽肩粗臂、短壮腿；抬脚慢、落脚重，纸屑只由实际落地事件触发。' },
    { id: 'pencilthrower', name: '铅笔投手', role: 'normal', accessory: 'throwingPencil',
      color: GRAPHITE, accent: OCHRE, speed: 53, stepLength: 24, swingTime: 0.27,
      upperLen: 11, lowerLen: 12, torsoH: 26, headR: 5.8, armLen: 17,
      bodyWidth: 8, hipWidth: 4, bob: 1.1, lift: 5, lean: 0.06, lineWidth: 1.9,
      description: '铅笔杆躯干、持笔手臂；行走和投掷共用肩肘骨架，便于接入攻击前摇。' },
    { id: 'elitePencil', name: '铅笔统领', role: 'elite', accessory: 'pencilCrown',
      color: GRAPHITE, accent: RED, speed: 58, stepLength: 31, swingTime: 0.36,
      upperLen: 15, lowerLen: 16, torsoH: 31, headR: 6.8, armLen: 21,
      bodyWidth: 13, hipWidth: 6, bob: 1.8, lift: 7, lean: 0.07, lineWidth: 2.4,
      foot: 'block', description: '装甲长腿与笔帽王冠；步幅大、节奏稳，抬脚高度明显高于普通投手。' },
    { id: 'eliteCrossbow', name: '橡皮弩手', role: 'elite', accessory: 'crossbow',
      color: GRAPHITE, accent: BLUEGRAY, speed: 45, stepLength: 23, swingTime: 0.34,
      upperLen: 12, lowerLen: 13, torsoH: 19, headR: 6.2, armLen: 16,
      bodyWidth: 21, hipWidth: 8, bob: 1.7, lift: 5.5, lean: 0.04, lineWidth: 2.5,
      foot: 'block', description: '宽厚橡皮躯干和清楚的弩；双脚稳定承重，上身尽量减少晃动以保持瞄准。' },
    { id: 'bossJudge', name: '红笔判官', role: 'boss', accessory: 'judgeRobe',
      color: GRAPHITE, accent: RED, speed: 64, stepLength: 38, swingTime: 0.4,
      upperLen: 21, lowerLen: 23, torsoH: 34, headR: 8.2, armLen: 25,
      bodyWidth: 13, hipWidth: 6, bob: 1.5, lift: 9, lean: 0.05, kneeBend: -1,
      lineWidth: 2.6, foot: 'claw', description: '钢笔尖头颅、瘦高长袍和反向膝关节；长腿交叉迈步，落脚节奏压迫感更强。' }
  ].map(d => Object.assign({}, DEFAULTS, d));

  function getDef(idOrDef) {
    if (typeof idOrDef === 'object' && idOrDef) return Object.assign({}, DEFAULTS, idOrDef);
    const found = DEFS.find(d => d.id === idOrDef);
    if (!found) throw new Error('Unknown biped: ' + idOrDef);
    return found;
  }

  /* 只解两条骨段的几何，不包含任何多足步态或落脚点队列。 */
  function solveTwoBone(hip, foot, upperLen, lowerLen, bend) {
    hip = finitePoint(hip); foot = finitePoint(foot);
    const dx = foot.x - hip.x, dy = foot.y - hip.y;
    const rawD = Math.hypot(dx, dy);
    const minD = Math.abs(upperLen - lowerLen) + 0.0001;
    const maxD = upperLen + lowerLen - 0.0001;
    const d = clamp(rawD, minD, maxD);
    const ux = rawD > 0.000001 ? dx / rawD : 0;
    const uy = rawD > 0.000001 ? dy / rawD : -1;
    const reachableFoot = rawD > maxD
      ? { x: hip.x + ux * maxD, y: hip.y + uy * maxD }
      : rawD < minD
        ? { x: hip.x + ux * minD, y: hip.y + uy * minD }
        : { x: foot.x, y: foot.y };
    const a = (upperLen * upperLen - lowerLen * lowerLen + d * d) / (2 * d);
    const h = Math.sqrt(Math.max(0, upperLen * upperLen - a * a));
    const baseX = hip.x + ux * a, baseY = hip.y + uy * a;
    const side = bend < 0 ? -1 : 1;
    return {
      hip: { x: hip.x, y: hip.y },
      knee: { x: baseX - uy * h * side, y: baseY + ux * h * side },
      foot: reachableFoot,
      requestedFoot: { x: foot.x, y: foot.y },
      reachable: rawD <= maxD && rawD >= minD
    };
  }

  class BipedRig {
    constructor(idOrDef, options) {
      this.def = getDef(idOrDef);
      this.options = Object.assign({ startX: 0, startPhase: 0 }, options || {});
      this.x = this.options.startX;
      this.time = 0;
      this.speed = this.def.speed;
      this.steps = 0;
      this.plantPulse = 0;
      this.lastPlanted = -1;
      this.plantEvents = [];
      const d = this.def;
      const baseY = (d.upperLen + d.lowerLen) * d.hipHeight;
      this.pelvisY = baseY;
      this.legs = [
        { side: 'left', phase: 'stance', footX: this.x - d.stepLength * 0.35, footY: 0, lift: 0, swingT: 0, startX: 0, targetX: 0 },
        { side: 'right', phase: 'stance', footX: this.x + d.stepLength * 0.35, footY: 0, lift: 0, swingT: 0, startX: 0, targetX: 0 }
      ];
      if (this.options.startPhase > 0) this.startSwing(0, this.options.startPhase);
    }

    swingDuration() {
      const d = this.def;
      /* 每次迈步的身体位移有上限；高速靠提高步频，而不是拖长支撑阶段。 */
      const travelLimited = d.stepLength * 0.42 / Math.max(1, this.speed);
      return clamp(travelLimited, d.swingTime * 0.2, d.swingTime);
    }

    startSwing(index, initialProgress) {
      const d = this.def, leg = this.legs[index];
      leg.phase = 'swing';
      leg.duration = this.swingDuration();
      /* 时长在落脚前保持固定，速度或朝向变化不会让当前动作跳进度。 */
      leg.swingT = clamp(initialProgress || 0, 0, 0.99) * leg.duration;
      leg.startX = leg.footX;
      leg.targetX = this.x + d.stepLength * 0.75;
      return leg;
    }

    update(dt, speedOverride) {
      dt = clamp(Number.isFinite(dt) ? dt : 0, 0, 0.1);
      const d = this.def;
      this.speed = Number.isFinite(speedOverride) ? Math.max(0, speedOverride) : d.speed;
      this.time += dt;
      this.x += this.speed * dt;
      this.plantPulse = Math.max(0, this.plantPulse - dt * 7.5);

      const swinging = this.legs.findIndex(leg => leg.phase === 'swing');
      if (swinging >= 0) {
        const leg = this.legs[swinging];
        leg.swingT += dt;
        const u = clamp(leg.swingT / leg.duration, 0, 1);
        const travel = smooth(u);
        leg.footX = lerp(leg.startX, leg.targetX, travel);
        leg.lift = Math.sin(Math.PI * u) * d.lift;
        leg.footY = leg.lift;
        if (u >= 1) {
          leg.phase = 'stance'; leg.footX = leg.targetX; leg.footY = 0; leg.lift = 0;
          this.steps++; this.lastPlanted = swinging; this.plantPulse = 1;
          this.plantEvents.push({ leg: swinging, x: leg.footX, time: this.time });
          if (this.plantEvents.length > 24) this.plantEvents.shift();
        }
      }
      if (!this.legs.some(leg => leg.phase === 'swing') && this.speed > 0.001) {
        const trailing = this.legs[0].footX < this.legs[1].footX ? 0 : 1;
        const leg = this.legs[trailing];
        /* 落地后可在同帧换脚，避免高速时多拖一帧才抬起后脚。 */
        if (this.x - leg.footX >= d.stepLength * 0.38) this.startSwing(trailing, 0);
      }

      const swingIndex = this.legs.findIndex(leg => leg.phase === 'swing');
      const activeLeg = swingIndex >= 0 ? this.legs[swingIndex] : null;
      const swingU = activeLeg ? clamp(activeLeg.swingT / activeLeg.duration, 0, 1) : 0;
      const baseY = (d.upperLen + d.lowerLen) * d.hipHeight;
      const gaitDrop = activeLeg ? Math.sin(Math.PI * swingU) * d.bob * 0.65 : 0;
      const plantRecoil = this.plantPulse > 0 ? -Math.sin((1 - this.plantPulse) * Math.PI) * d.bob * 0.2 : 0;
      this.pelvisY = baseY - gaitDrop + plantRecoil;
      return this;
    }

    getPose() {
      const d = this.def;
      const maxReach = d.upperLen + d.lowerLen - 0.015;
      const hipYOffsets = [-0.15, 0.15];
      let pelvisY = this.pelvisY;
      const hipXFor = i => this.x + (i === 0 ? -0.5 : 0.5) * d.hipWidth * 0.28;
      /* 在长腿极端跨步时降低骨盆，而不是拉长骨段或拖动支撑脚。 */
      for (let i = 0; i < 2; i++) {
        const leg = this.legs[i], dx = leg.footX - hipXFor(i);
        const verticalReach = Math.sqrt(Math.max(0.01, maxReach * maxReach - dx * dx));
        pelvisY = Math.min(pelvisY, leg.footY + verticalReach - hipYOffsets[i]);
      }
      const pelvis = { x: this.x, y: Math.max(2, pelvisY) };
      /* 头、躯干和骨盆始终共线，速度和变向不再改变身体倾斜。 */
      const chest = { x: pelvis.x, y: pelvis.y + d.torsoH * 0.76 };
      const neck = { x: pelvis.x, y: pelvis.y + d.torsoH };
      const head = { x: neck.x, y: neck.y + d.headR * 0.92 };
      const legs = this.legs.map((leg, i) => {
        const hip = { x: hipXFor(i), y: pelvis.y + hipYOffsets[i] };
        const solved = solveTwoBone(hip, { x: leg.footX, y: leg.footY }, d.upperLen, d.lowerLen, d.kneeBend);
        return Object.assign(solved, { side: leg.side, phase: leg.phase, lift: leg.lift, index: i });
      });
      const relativeStride = clamp((this.legs[1].footX - this.legs[0].footX) / Math.max(1, d.stepLength), -1, 1);
      const arms = [0, 1].map(i => {
        const side = i === 0 ? -1 : 1;
        const shoulder = { x: chest.x + side * d.bodyWidth * 0.12, y: chest.y + d.torsoH * 0.12 + (i === 0 ? -0.2 : 0.2) };
        const swing = (i === 0 ? relativeStride : -relativeStride);
        const hand = {
          x: shoulder.x + swing * d.armLen * 0.65 + d.armLen * 0.1,
          y: shoulder.y - d.armLen * (0.76 - Math.abs(swing) * 0.12)
        };
        const solved = solveTwoBone(shoulder, hand, d.armLen * 0.52, d.armLen * 0.48, i === 0 ? -1 : 1);
        return Object.assign(solved, { shoulder, hand: solved.foot, side: i === 0 ? 'left' : 'right', index: i });
      });
      return { x: this.x, pelvis, chest, neck, head, legs, arms, relativeStride,
        speed: this.speed, time: this.time, plantPulse: this.plantPulse, lastPlanted: this.lastPlanted };
    }

    /* 潜墨姿态：身体放平，双臂交替自由泳划水，双腿上下打水；仍由同一套双段 IK 约束骨长。 */
    getSwimPose() {
      const d = this.def;
      const phase = this.time * (this.speed > 4 ? 9 : 4.5);
      const bob = Math.sin(phase * 2) * 0.45;
      const pelvis = { x: this.x, y: 5 + bob };
      const chest = { x: pelvis.x + d.torsoH * 0.58, y: pelvis.y + 1.1 };
      const neck = { x: pelvis.x + d.torsoH * 0.96, y: pelvis.y + 1.8 };
      const head = { x: neck.x + d.headR * 0.86, y: neck.y + 1.25 };
      const legs = [0, 1].map(i => {
        const hip = { x: pelvis.x + (i === 0 ? -0.5 : 0.5) * d.hipWidth * 0.18, y: pelvis.y + (i === 0 ? -0.2 : 0.2) };
        const kick = Math.sin(phase * 1.7 + i * Math.PI);
        const reach = (d.upperLen + d.lowerLen) * (0.78 + Math.cos(phase * 1.7 + i * Math.PI) * 0.06);
        const foot = { x: hip.x - reach, y: hip.y - 1.2 + kick * d.lift * 0.62 };
        const solved = solveTwoBone(hip, foot, d.upperLen, d.lowerLen, i === 0 ? -1 : 1);
        return Object.assign(solved, { side: i === 0 ? 'left' : 'right', phase: 'swim', lift: Math.abs(kick) * d.lift * 0.62, index: i });
      });
      const arms = [0, 1].map(i => {
        const stroke = phase + i * Math.PI;
        const shoulder = { x: chest.x + (i === 0 ? -0.5 : 0.5) * d.bodyWidth * 0.12, y: chest.y + (i === 0 ? -0.2 : 0.2) };
        const hand = {
          x: shoulder.x + Math.cos(stroke) * d.armLen * 0.7 - d.armLen * 0.1,
          y: shoulder.y + Math.sin(stroke) * d.armLen * 0.42 - d.armLen * 0.18
        };
        const solved = solveTwoBone(shoulder, hand, d.armLen * 0.52, d.armLen * 0.48, i === 0 ? -1 : 1);
        return Object.assign(solved, { shoulder, hand: solved.foot, side: i === 0 ? 'left' : 'right', index: i });
      });
      return { x: this.x, pelvis, chest, neck, head, legs, arms, swimming: true, swimPhase: phase,
        speed: this.speed, time: this.time, plantPulse: 0, lastPlanted: -1 };
    }
  }

  return { DEFS, DEFAULTS, BipedRig, solveTwoBone, getDef, PALETTE: { INK, GRAPHITE, RED, OCHRE, BLUEGRAY, PAPER } };
});

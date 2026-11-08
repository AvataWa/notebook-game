/* ============================================================
   程序化多足运动模组
   - 世界坐标落脚点：支撑脚不随身体滑动
   - 分组步态：同一时刻只允许一组腿摆动
   - 速度提前量：脚迈向身体即将到达的位置
   - 双段 IK：根据髋关节和脚底求膝关节
   角色只需提供腿部配置，并在实际位移后调用 update(body, dt)。
   ============================================================ */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.ProceduralLocomotion = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const TAU = Math.PI * 2;
  const clamp01 = v => Math.max(0, Math.min(1, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = t => t * t * (3 - 2 * t);
  const angleDelta = (from, to) => {
    let d = (to - from) % TAU;
    if (d > Math.PI) d -= TAU;
    if (d < -Math.PI) d += TAU;
    return d;
  };

  function solveTwoBoneIKInto(hipX, hipY, footX, footY, upperLen, lowerLen, bendDir, out) {
    const dx = footX - hipX, dy = footY - hipY;
    const rawD = Math.hypot(dx, dy) || 0.0001;
    const d = Math.max(Math.abs(upperLen - lowerLen) + 0.001,
      Math.min(rawD, upperLen + lowerLen - 0.001));
    const base = Math.atan2(dy, dx);
    const cosA = Math.max(-1, Math.min(1,
      (upperLen * upperLen + d * d - lowerLen * lowerLen) / (2 * upperLen * d)));
    const a = base + Math.acos(cosA) * bendDir;
    out.x = hipX + Math.cos(a) * upperLen;
    out.y = hipY + Math.sin(a) * upperLen;
    return out;
  }
  function solveTwoBoneIK(hip, foot, upperLen, lowerLen, bendDir) {
    return solveTwoBoneIKInto(hip.x, hip.y, foot.x, foot.y, upperLen, lowerLen, bendDir, {});
  }

  class MultiLegRig {
    constructor(body, options) {
      this.options = Object.assign({
        stepDistance: 5,
        stepDuration: 0.13,
        velocityPrediction: 0.11,
        turnSpeed: 11,
        forwardOffset: Math.PI / 2,
        teleportDistance: 80
      }, options || {});
      if (!this.options.legs || this.options.legs.length < 2) {
        throw new Error('MultiLegRig 需要至少两条腿的配置');
      }
      this.legs = this.options.legs.map((cfg, index) => Object.assign({
        index, group: index % 2, bend: 1,
        x: 0, y: 0, lift: 0, state: 'planted', stepT: 0,
        startX: 0, startY: 0, targetX: 0, targetY: 0
      }, cfg));
      this.activeGroup = 0;
      this.sequenceIndex = 0; this.sequenceCooldown = 0;
      this.vx = 0; this.vy = 0;
      this.footScratch = { x: 0, y: 0 };
      this.poses = this.legs.map(leg => ({
        leg, hip: { x: 0, y: 0 }, knee: { x: 0, y: 0 }, foot: { x: 0, y: 0 },
        groundX: 0, groundY: 0
      }));
      this.reset(body.x, body.y, body.locomotionAngle || 0);
    }

    syncAngleCache() {
      this.angleCos = Math.cos(this.angle); this.angleSin = Math.sin(this.angle);
    }

    localToWorldInto(x, y, lx, ly, out) {
      out.x = x + lx * this.angleCos - ly * this.angleSin;
      out.y = y + lx * this.angleSin + ly * this.angleCos;
      return out;
    }

    desiredFoot(leg, x = this.x, y = this.y, prediction = true) {
      const p = this.localToWorldInto(x, y, leg.restX, leg.restY, this.footScratch);
      if (prediction) {
        p.x += this.vx * this.options.velocityPrediction;
        p.y += this.vy * this.options.velocityPrediction;
      }
      return p;
    }

    reset(x, y, angle = this.angle || 0) {
      this.x = x; this.y = y; this.prevX = x; this.prevY = y;
      this.angle = angle; this.syncAngleCache(); this.vx = 0; this.vy = 0;
      this.activeGroup = 0; this.sequenceIndex = 0; this.sequenceCooldown = 0;
      for (const leg of this.legs) {
        const p = this.desiredFoot(leg, x, y, false);
        leg.x = leg.startX = leg.targetX = p.x;
        leg.y = leg.startY = leg.targetY = p.y;
        leg.lift = 0; leg.stepT = 0; leg.state = 'planted';
      }
    }

    legReach(leg) { return leg.upper + leg.lower - 0.65; }

    hipDistance(leg) {
      const hipX = this.x + leg.hipX * this.angleCos - leg.hipY * this.angleSin;
      const hipY = this.y + leg.hipX * this.angleSin + leg.hipY * this.angleCos;
      return Math.hypot(leg.x - hipX, leg.y - hipY);
    }

    beginStep(leg, emergency = false) {
      const target = this.desiredFoot(leg);
      leg.state = 'stepping'; leg.stepT = 0; leg.emergency = emergency;
      leg.stepDuration = emergency ? Math.max(0.045, (this.currentStepDuration || this.options.stepDuration) * 0.6) :
        (this.currentStepDuration || this.options.stepDuration);
      leg.startX = leg.x; leg.startY = leg.y;
      leg.targetX = target.x; leg.targetY = target.y;
    }

    needsStep(leg) {
      const desired = this.desiredFoot(leg);
      return Math.hypot(desired.x - leg.x, desired.y - leg.y) > this.options.stepDistance;
    }

    updateMetachronal(dt) {
      this.sequenceCooldown = Math.max(0, this.sequenceCooldown - dt);
      let swinging = 0;
      for (const leg of this.legs) if (leg.state === 'stepping') swinging++;
      if (swinging >= (this.currentMaxSwing || 2) || this.sequenceCooldown > 0) return;
      // 正常移动严格按 sequence 排队；紧急收步仅用于避免击退等情况拉长腿部
      const sequence = this.options.sequence;
      const leg = this.legs[sequence[this.sequenceIndex]];
      if (!leg || leg.state !== 'planted' || !this.needsStep(leg)) return;
      this.beginStep(leg);
      this.sequenceIndex = (this.sequenceIndex + 1) % sequence.length;
      this.sequenceCooldown = (this.currentStepDuration || this.options.stepDuration) * 0.4;
    }

    update(body, dt) {
      if (!(dt >= 0)) return;
      const dx = body.x - this.prevX, dy = body.y - this.prevY;
      if (Math.hypot(dx, dy) > this.options.teleportDistance) this.reset(body.x, body.y, this.angle);
      const safeDt = Math.min(dt, 0.05); // 防止切回标签页时一步跨过整个步态
      const blend = Math.min(1, safeDt * 18);
      const instVx = safeDt > 0 ? dx / safeDt : 0, instVy = safeDt > 0 ? dy / safeDt : 0;
      this.vx = lerp(this.vx, instVx, blend);
      this.vy = lerp(this.vy, instVy, blend);
      const speed = Math.hypot(this.vx, this.vy);
      // 八足完整一轮包含多次排队，从普通移动开始就随速度缩短步态周期。
      this.currentStepDuration = Math.max(0.05, Math.min(this.options.stepDuration,
        this.options.stepDuration * 30 / Math.max(30, speed)));
      this.currentMaxSwing = speed > 85 ? 3 : 2;
      if (speed > 7) {
        const desiredAngle = Math.atan2(this.vy, this.vx) + this.options.forwardOffset;
        this.angle += angleDelta(this.angle, desiredAngle) * Math.min(1, safeDt * this.options.turnSpeed);
      }
      this.syncAngleCache();
      this.x = body.x; this.y = body.y;
      this.prevX = body.x; this.prevY = body.y;

      // 只有高速、击退或 LOD 追帧才打破顺序紧急收步；普通移动始终严格排队。
      if (speed > 75) {
        for (const leg of this.legs) {
          if (leg.state === 'planted' && this.hipDistance(leg) > this.legReach(leg) * 0.9) {
            this.beginStep(leg, true);
          }
        }
      }
      for (const leg of this.legs) {
        if (leg.state !== 'stepping') continue;
        // 摆动期间跟随最新身体速度修正目标，避免落到身体后方形成长腿
        const target = this.desiredFoot(leg);
        leg.targetX = target.x; leg.targetY = target.y;
        leg.stepT = Math.min(1, leg.stepT + safeDt / leg.stepDuration);
        const t = smooth(leg.stepT);
        leg.x = lerp(leg.startX, leg.targetX, t);
        leg.y = lerp(leg.startY, leg.targetY, t);
        leg.lift = Math.sin(leg.stepT * Math.PI) * (leg.liftHeight || 2.5);
        if (leg.stepT >= 1) {
          leg.state = 'planted'; leg.lift = 0; leg.emergency = false;
          leg.x = leg.targetX; leg.y = leg.targetY;
        }
      }
      if (safeDt <= 0) return;
      if (this.options.sequence) { this.updateMetachronal(safeDt); return; }

      if (this.legs.some(leg => leg.state === 'stepping')) return;
      const needs = [false, false];
      for (const leg of this.legs) if (this.needsStep(leg)) needs[leg.group] = true;
      if (!needs[0] && !needs[1]) return;
      if (!needs[this.activeGroup]) this.activeGroup = 1 - this.activeGroup;
      for (const leg of this.legs) {
        if (leg.group === this.activeGroup && this.needsStep(leg)) this.beginStep(leg);
      }
      this.activeGroup = 1 - this.activeGroup;
    }

    getPose(body) {
      for (let i = 0; i < this.legs.length; i++) {
        const leg = this.legs[i], pose = this.poses[i];
        this.localToWorldInto(body.x, body.y, leg.hipX, leg.hipY, pose.hip);
        pose.foot.x = leg.x; pose.foot.y = leg.y - leg.lift;
        // 最终视觉约束：任何异常位移都不能把腿画成超过骨骼总长的直线
        const dx = pose.foot.x - pose.hip.x, dy = pose.foot.y - pose.hip.y;
        const distance = Math.hypot(dx, dy), maxReach = this.legReach(leg);
        if (distance > maxReach) {
          pose.foot.x = pose.hip.x + dx / distance * maxReach;
          pose.foot.y = pose.hip.y + dy / distance * maxReach;
        }
        solveTwoBoneIKInto(pose.hip.x, pose.hip.y, pose.foot.x, pose.foot.y,
          leg.upper, leg.lower, leg.bend, pose.knee);
        pose.groundX = pose.foot.x; pose.groundY = pose.foot.y + leg.lift;
      }
      return this.poses;
    }
  }

  function createSpiderRig(body) {
    const legs = [];
    for (let sideIndex = 0; sideIndex < 2; sideIndex++) {
      const side = sideIndex === 0 ? -1 : 1;
      for (let i = 0; i < 4; i++) {
        legs.push({
          hipX: side * (3.2 + (i === 1 || i === 2 ? 0.8 : 0)),
          hipY: -5 + i * 3.7,
          restX: side * (13.5 + (i === 1 || i === 2 ? 3.5 : 0)),
          restY: -15 + i * 10,
          upper: 8.5 + (i === 1 || i === 2 ? 1 : 0),
          lower: 10 + (i === 1 || i === 2 ? 1 : 0),
          bend: side * (i < 2 ? 1 : -1),
          group: sideIndex, // 打样页用颜色区分左右足
          liftHeight: 2.2
        });
      }
    }
    return new MultiLegRig(body, {
      legs, stepDistance: 4.5, stepDuration: 0.12,
      velocityPrediction: 0.1, turnSpeed: 12,
      // 左 1、右 1、左 2、右 2……严格形成前到后的 1→2→3→4 波浪
      sequence: [0, 4, 1, 5, 2, 6, 3, 7], maxSwing: 2, stepOverlap: 0.55
    });
  }

  function ensureSpiderRig(body) {
    if (!body.locomotionRig) body.locomotionRig = createSpiderRig(body);
    return body.locomotionRig;
  }

  function updateSpiderLocomotion(body, dt) {
    ensureSpiderRig(body).update(body, dt);
  }

  const SPIDER_LOD = Object.freeze({
    nearDistance: 190, farDistance: 360,
    intervals: [0, 1 / 30, 1 / 12, 1 / 8]
  });
  function updateSpiderLocomotionLOD(body, dt, distanceToViewer, onscreen = true) {
    const level = !onscreen ? 3 : distanceToViewer <= SPIDER_LOD.nearDistance ? 0 :
      distanceToViewer <= SPIDER_LOD.farDistance ? 1 : 2;
    body.locomotionLod = level;
    const rig = ensureSpiderRig(body);
    if (level === 0) {
      body.locomotionAccum = 0; rig.update(body, dt); return level;
    }
    body.locomotionAccum = (body.locomotionAccum || 0) + dt;
    const interval = SPIDER_LOD.intervals[level];
    if (body.locomotionAccum >= interval) {
      rig.update(body, body.locomotionAccum);
      body.locomotionAccum = 0;
    }
    return level;
  }

  return { MultiLegRig, solveTwoBoneIK, createSpiderRig, ensureSpiderRig,
    updateSpiderLocomotion, updateSpiderLocomotionLOD, SPIDER_LOD };
});

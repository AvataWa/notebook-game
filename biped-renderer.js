/* 双足人形绘制器：只消费 BipedRig 骨架，不调用蜘蛛或多足绘制路径。 */
(function (root, factory) {
  const locomotion = root.BipedLocomotion || (typeof require !== 'undefined' ? require('./biped-locomotion.js') : null);
  const api = factory(locomotion);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.BipedRenderer = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (BL) {
  'use strict';
  const root = typeof globalThis !== 'undefined' ? globalThis : this;
  const P = BL.PALETTE;

  function line(ctx, x1, y1, x2, y2, color, width) {
    if (root.doodleBridge) { root.doodleBridge.line(x1, y1, x2, y2, color, width); return; }
    const len = Math.hypot(x2 - x1, y2 - y1);
    const seg = Math.max(2, Math.min(12, Math.ceil(len / 8)));
    ctx.strokeStyle = color; ctx.lineWidth = width || 1.8; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath();
    for (let i = 0; i <= seg; i++) {
      const t = i / seg;
      const jitter = i > 0 && i < seg ? Math.sin(i * 91.7 + x1 * 0.17 + y2 * 0.11) * 0.38 : 0;
      const x = x1 + (x2 - x1) * t + jitter, y = y1 + (y2 - y1) * t - jitter * 0.55;
      if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
    }
    ctx.stroke();
  }
  function circle(ctx, x, y, r, color, width, fill) {
    if (root.doodleBridge) {
      root.doodleBridge.circle(x, y, r, color, width);
      if (fill) { ctx.fillStyle = color; ctx.fill(); }
      return;
    }
    ctx.strokeStyle = color; ctx.lineWidth = width || 1.8; ctx.fillStyle = color;
    ctx.beginPath();
    for (let i = 0; i <= 20; i++) {
      const a = i / 20 * Math.PI * 2, rr = r + (i < 20 ? Math.sin(i * 17.3 + x) * 0.22 : 0);
      const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr;
      if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
    }
    if (fill) ctx.fill(); else ctx.stroke();
  }
  function rect(ctx, x, y, w, h, color, width) {
    if (root.doodleBridge) { root.doodleBridge.rect(x, y, w, h, color, width); return; }
    poly(ctx, [[x, y], [x + w, y], [x + w, y + h], [x, y + h]], color, width, true);
  }
  function poly(ctx, points, color, width, close) {
    for (let i = 1; i < points.length; i++) line(ctx, ...points[i - 1], ...points[i], color, width);
    if (close !== false && points.length > 2) line(ctx, ...points[points.length - 1], ...points[0], color, width);
  }
  function hatch(ctx, x, y, w, h, color, gap) {
    ctx.save(); ctx.globalAlpha *= 0.42;
    for (let yy = y + 2; yy < y + h; yy += gap || 3) line(ctx, x, yy, x + w, yy + 1.5, color, 0.8);
    ctx.restore();
  }
  function eye(ctx, x, y, r, color) { circle(ctx, x, y, r || 0.9, color, 1, true); }
  function smile(ctx, head, r, color, stern) {
    if (stern) {
      line(ctx, head.x + r * 0.05, head.y - r * 0.34, head.x + r * 0.58, head.y - r * 0.24, color, 1.35);
      line(ctx, head.x + r * 0.16, head.y + r * 0.47, head.x + r * 0.63, head.y + r * 0.61, color, 1.25);
    } else {
      line(ctx, head.x + r * 0.08, head.y - r * 0.3, head.x + r * 0.36, head.y - r * 0.43, color, 1.15);
      line(ctx, head.x + r * 0.36, head.y - r * 0.43, head.x + r * 0.62, head.y - r * 0.24, color, 1.15);
    }
  }
  function horns(ctx, head, r, color, heavy) {
    const w = heavy ? 2.7 : 1.7;
    poly(ctx, [[head.x - r * 0.65, head.y + r * 0.55], [head.x - r * 0.88, head.y + r * 1.45], [head.x - r * 0.2, head.y + r * 0.85]], color, w, false);
    poly(ctx, [[head.x + r * 0.25, head.y + r * 0.83], [head.x + r * 0.66, head.y + r * 1.48], [head.x + r * 0.77, head.y + r * 0.52]], color, w, false);
  }
  function shoe(ctx, foot, d, far) {
    const c = d.color, w = Math.max(1.1, d.lineWidth * 0.72);
    if (d.foot === 'claw') {
      poly(ctx, [[foot.x - 1.5, foot.y + 1.3], [foot.x + 4.8, foot.y + 0.2], [foot.x + 1.2, foot.y + 2.5]], c, w, false);
      line(ctx, foot.x + 3.3, foot.y + 0.4, foot.x + 5.4, foot.y - 0.2, d.accent, 1.1);
    } else if (d.foot === 'block') {
      rect(ctx, foot.x - 2.1, foot.y, 7.2, 3.4, c, w);
      line(ctx, foot.x - 1.5, foot.y + 0.4, foot.x + 5, foot.y + 0.4, d.accent, 0.85);
    } else {
      poly(ctx, [[foot.x - 1.7, foot.y + 0.2], [foot.x + 4.7, foot.y + 0.2], [foot.x + 4.1, foot.y + 2.4], [foot.x - 0.8, foot.y + 2.8]], c, w, true);
      if (!far) line(ctx, foot.x + 0.2, foot.y + 2.2, foot.x + 2.6, foot.y + 1.5, d.accent, 0.8);
    }
  }
  function limb(ctx, solved, d, isArm, far) {
    const a = solved.hip || solved.shoulder, b = solved.knee, c = solved.foot;
    const color = d.color, width = d.lineWidth * (isArm ? 0.86 : 1);
    line(ctx, a.x, a.y, b.x, b.y, color, width);
    line(ctx, b.x, b.y, c.x, c.y, color, width * 0.88);
    if (isArm) circle(ctx, c.x, c.y, d.id === 'rage' ? 2.5 : 1.25, color, width * 0.65, d.id === 'rage');
    else shoe(ctx, c, d, far);
  }

  function drawPlayerBody(ctx, pose, d) {
    const p = pose.pelvis, n = pose.neck, h = pose.head;
    /* 主角只保留圆头、躯干和表情，辨识度交给蓝色与无角轮廓。 */
    line(ctx, p.x, p.y, n.x, n.y, d.color, d.lineWidth);
    circle(ctx, h.x, h.y, d.headR, d.color, d.lineWidth);
    eye(ctx, h.x + d.headR * 0.3, h.y + 0.65, 0.95, d.color);
    smile(ctx, h, d.headR, d.color, false);
  }

  function drawHumanoidBody(ctx, pose, d) {
    const p = pose.pelvis, n = pose.neck, h = pose.head, w = d.bodyWidth;
    if (d.id === 'stick') {
      line(ctx, p.x, p.y, n.x, n.y, d.color, d.lineWidth);
      line(ctx, p.x - 2, p.y + 3, p.x + 2, p.y + 3, d.color, 1.2);
    } else if (d.id === 'doodle') {
      rect(ctx, p.x - w * 0.48, p.y, w * 0.96, d.torsoH, d.color, d.lineWidth);
      hatch(ctx, p.x - w * 0.36, p.y + 1, w * 0.72, d.torsoH - 2, d.color, 3);
    } else if (d.id === 'rage') {
      poly(ctx, [[p.x - w * 0.36, p.y], [n.x - w * 0.82, n.y - 2], [n.x + w * 0.76, n.y - 2], [p.x + w * 0.4, p.y]], d.color, d.lineWidth);
      hatch(ctx, p.x - w * 0.3, p.y + 2, w * 0.65, d.torsoH * 0.6, d.color, 2.4);
      line(ctx, n.x - w * 0.9, n.y - 1, n.x + w * 0.85, n.y - 1, d.color, 3.2);
    }
    circle(ctx, h.x, h.y, d.headR, d.color, d.lineWidth);
    horns(ctx, h, d.headR, d.color, d.id === 'rage');
    eye(ctx, h.x + d.headR * 0.33, h.y + 0.8, d.id === 'rage' ? 1.2 : 0.85, d.color);
    smile(ctx, h, d.headR, d.color, d.id !== 'doodle');
    if (d.id === 'rage') {
      line(ctx, h.x + 0.5, h.y + 3.5, h.x + 5.5, h.y + 2.2, d.color, 1.8);
      line(ctx, p.x - w * 0.2, p.y + 5, p.x + w * 0.28, p.y + 5, d.accent, 1.6);
    }
  }

  function drawPencilBody(ctx, pose, d, elite) {
    const p = pose.pelvis, n = pose.neck, h = pose.head, w = d.bodyWidth;
    rect(ctx, p.x - w * 0.5, p.y + 2, w, d.torsoH - 2, d.color, d.lineWidth);
    poly(ctx, [[p.x - w * 0.5, p.y + 2], [p.x, p.y - 3], [p.x + w * 0.5, p.y + 2]], d.color, d.lineWidth);
    line(ctx, p.x - w * 0.22, p.y + 5, p.x - w * 0.22, n.y - 2, d.accent, 1.1);
    if (elite) {
      rect(ctx, p.x - w * 0.68, p.y + d.torsoH * 0.37, w * 1.36, d.torsoH * 0.34, d.color, 2.2);
      hatch(ctx, p.x - w * 0.5, p.y + d.torsoH * 0.4, w, d.torsoH * 0.26, d.accent, 3.2);
      line(ctx, n.x - w * 0.85, n.y - 2, n.x + w * 0.85, n.y - 2, d.accent, 2.4);
    }
    circle(ctx, h.x, h.y, d.headR, d.color, d.lineWidth);
    horns(ctx, h, d.headR, d.color, false);
    eye(ctx, h.x + d.headR * 0.3, h.y + 0.5, 1, d.color); smile(ctx, h, d.headR, d.color, true);
    if (elite) {
      poly(ctx, [[h.x - d.headR * 0.9, h.y + d.headR * 0.8], [h.x - d.headR * 0.65, h.y + d.headR * 1.75], [h.x, h.y + d.headR * 1.05], [h.x + d.headR * 0.65, h.y + d.headR * 1.75], [h.x + d.headR * 0.9, h.y + d.headR * 0.8]], d.accent, 2.1, false);
      rect(ctx, h.x - d.headR, h.y + d.headR * 0.52, d.headR * 2, 2.5, d.color, 1.7);
    }
  }

  function drawCrossbowBody(ctx, pose, d) {
    const p = pose.pelvis, n = pose.neck, h = pose.head, w = d.bodyWidth;
    rect(ctx, p.x - w * 0.5, p.y + 1, w, d.torsoH - 1, d.color, d.lineWidth);
    ctx.save(); ctx.globalAlpha *= 0.13; ctx.fillStyle = d.accent;
    ctx.fillRect(p.x - w * 0.48, p.y + d.torsoH * 0.45, w * 0.96, d.torsoH * 0.5); ctx.restore();
    rect(ctx, p.x - w * 0.5, p.y + d.torsoH * 0.45, w, d.torsoH * 0.5, d.accent, 1.5);
    line(ctx, p.x - w * 0.15, p.y + d.torsoH * 0.45, p.x + w * 0.1, n.y, d.accent, 1.2);
    circle(ctx, h.x, h.y, d.headR, d.color, d.lineWidth);
    horns(ctx, h, d.headR, d.color, false);
    eye(ctx, h.x + 2, h.y + 0.6, 1, d.color); smile(ctx, h, d.headR, d.color, true);
  }

  function drawJudgeBody(ctx, pose, d) {
    const p = pose.pelvis, n = pose.neck, h = pose.head, w = d.bodyWidth;
    poly(ctx, [[p.x - w * 0.8, p.y - 12], [n.x - w * 0.75, n.y - 2], [n.x + w * 0.72, n.y - 2], [p.x + w * 0.75, p.y - 12], [p.x + w * 0.1, p.y - 9], [p.x - w * 0.8, p.y - 12]], d.color, d.lineWidth, false);
    hatch(ctx, p.x - w * 0.55, p.y - 9, w * 1.05, d.torsoH * 0.58, d.accent, 4.2);
    poly(ctx, [[n.x - w * 0.85, n.y - 1], [n.x, n.y - 6], [n.x + w * 0.85, n.y - 1]], d.accent, 2.2, false);
    /* 钢笔尖头颅，中央笔尖缝与墨孔清晰可见。 */
    poly(ctx, [[h.x, h.y + d.headR * 1.65], [h.x - d.headR * 0.72, h.y + d.headR * 0.3], [h.x - d.headR * 0.55, h.y - d.headR * 0.75], [h.x + d.headR * 0.55, h.y - d.headR * 0.75], [h.x + d.headR * 0.72, h.y + d.headR * 0.3]], d.color, d.lineWidth);
    line(ctx, h.x, h.y + d.headR * 1.48, h.x, h.y + 0.5, d.accent, 1.35);
    circle(ctx, h.x, h.y + 0.2, 1.25, d.accent, 1.2);
    eye(ctx, h.x + 2.5, h.y - 2.2, 0.9, d.color);
    horns(ctx, { x: h.x, y: h.y - 2 }, d.headR * 0.7, d.color, false);
  }

  function drawAccessory(ctx, pose, d) {
    const hand = pose.arms[1].foot;
    if (d.accessory === 'throwingPencil') {
      const ax = hand.x - 8, ay = hand.y - 7, bx = hand.x + 11, by = hand.y + 6;
      line(ctx, ax, ay, bx, by, d.accent, 2.5);
      poly(ctx, [[bx, by], [bx + 4.5, by + 2.8], [bx - 0.8, by - 2.2]], d.color, 1.35);
      line(ctx, ax - 2, ay - 1.5, ax, ay, d.color, 2.8);
    } else if (d.accessory === 'crossbow') {
      const x = hand.x + 3, y = hand.y + 1;
      line(ctx, hand.x - 9, hand.y - 1, x + 13, y, d.color, 2.4);
      poly(ctx, [[x + 8, y - 10], [x + 13, y], [x + 8, y + 10]], d.color, 2.2, false);
      line(ctx, x + 8, y - 10, x + 8, y + 10, d.accent, 1.1);
      line(ctx, x - 2, y, x + 17, y, d.accent, 1.1);
      poly(ctx, [[x + 17, y], [x + 13.5, y + 1.8], [x + 13.5, y - 1.8]], d.accent, 1.1);
    }
  }

  function drawSkeleton(ctx, pose) {
    ctx.save(); ctx.globalAlpha = 0.8;
    for (const leg of pose.legs) {
      line(ctx, leg.hip.x, leg.hip.y, leg.knee.x, leg.knee.y, '#a85e55', 0.65);
      line(ctx, leg.knee.x, leg.knee.y, leg.foot.x, leg.foot.y, '#a85e55', 0.65);
      for (const p of [leg.hip, leg.knee, leg.foot]) circle(ctx, p.x, p.y, 0.85, '#a85e55', 0.7);
    }
    line(ctx, pose.pelvis.x, pose.pelvis.y, pose.neck.x, pose.neck.y, '#657987', 0.7);
    for (const arm of pose.arms) {
      line(ctx, arm.shoulder.x, arm.shoulder.y, arm.knee.x, arm.knee.y, '#657987', 0.65);
      line(ctx, arm.knee.x, arm.knee.y, arm.foot.x, arm.foot.y, '#657987', 0.65);
    }
    ctx.restore();
  }

  function drawPlantDust(ctx, rig, pose) {
    if (rig.def.id !== 'rage' || pose.plantPulse <= 0 || pose.lastPlanted < 0) return;
    const foot = pose.legs[pose.lastPlanted].foot;
    ctx.save(); ctx.globalAlpha = pose.plantPulse * 0.65;
    for (let i = 0; i < 5; i++) {
      const dir = i - 2, height = (1 - pose.plantPulse) * (4 + i % 2 * 2);
      line(ctx, foot.x + dir * 2.2, 0.4, foot.x + dir * 3.4, height + 0.6, rig.def.accent, 1);
    }
    ctx.restore();
  }

  function draw(ctx, rig, options) {
    const o = Object.assign({ cx: 165, groundY: 205, scale: 2.2, skeleton: false, facing: 1 }, options || {});
    const d = o.def || rig.def, pose = o.swimming && rig.getSwimPose ? rig.getSwimPose() : rig.getPose();
    ctx.save(); ctx.translate(o.cx, o.groundY); ctx.scale(o.scale * (o.facing < 0 ? -1 : 1), -o.scale); ctx.translate(-pose.x, 0);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    /* 远侧手脚先画、近侧后画，形成侧向前后关系。 */
    ctx.save(); ctx.globalAlpha = 0.46;
    limb(ctx, pose.arms[0], d, true, true); limb(ctx, pose.legs[0], d, false, true); ctx.restore();
    if (d.id === 'player') drawPlayerBody(ctx, pose, d);
    else if (d.id === 'pencilthrower') drawPencilBody(ctx, pose, d, false);
    else if (d.id === 'elitePencil') drawPencilBody(ctx, pose, d, true);
    else if (d.id === 'eliteCrossbow') drawCrossbowBody(ctx, pose, d);
    else if (d.id === 'bossJudge') drawJudgeBody(ctx, pose, d);
    else drawHumanoidBody(ctx, pose, d);
    limb(ctx, pose.legs[1], d, false, false);
    limb(ctx, pose.arms[1], d, true, false);
    drawAccessory(ctx, pose, d);
    drawPlantDust(ctx, rig, pose);
    if (o.skeleton) drawSkeleton(ctx, pose);
    ctx.restore();
    return pose;
  }

  return { draw, solveTwoBone: BL.solveTwoBone };
});

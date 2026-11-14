/* 六足兽类样板：世界坐标落脚点、三足交替支撑与荒原六足狸手绘外形。 */
(function (root) {
  'use strict';
  const PL = root.ProceduralLocomotion || (typeof require !== 'undefined' ? require('./procedural-locomotion.js') : null);
  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const norm = a => {
    while (a > Math.PI) a -= TAU;
    while (a < -Math.PI) a += TAU;
    return a;
  };

  function createFeralRig(body) {
    const r = body.r || 56, legs = [];
    for (let sideIndex = 0; sideIndex < 2; sideIndex++) {
      const side = sideIndex === 0 ? -1 : 1;
      for (let i = 0; i < 3; i++) {
        const index = sideIndex * 3 + i;
        // A 组：左前、右中、左后；B 组：右前、左中、右后。
        const group = (i + sideIndex) % 2;
        legs.push({
          hipX: side * r * 0.43, hipY: (i - 1) * r * 0.48,
          restX: side * r * (i === 1 ? 1.22 : 1.12), restY: (i - 1) * r * 0.92,
          upper: r * 0.48, lower: r * 0.54,
          bend: side * (i === 2 ? -1 : 1), group, liftHeight: r * 0.075,
          index
        });
      }
    }
    return new PL.MultiLegRig(body, {
      legs, stepDistance: r * 0.14, stepDuration: 0.11,
      velocityPrediction: 0.075, turnSpeed: 14,
      forwardOffset: Math.PI / 2, teleportDistance: r * 2.4
    });
  }

  function ensure(body) {
    if (!body.hexapodRig) body.hexapodRig = createFeralRig(body);
    return body.hexapodRig;
  }

  function update(body, dt) {
    const rig = ensure(body);
    rig.update(body, dt);
    // 站立出招时仍以 AI 朝向为准，不让双腿决定头部和躯干朝向。
    const target = (body.faceA || 0) + Math.PI / 2;
    rig.angle += norm(target - rig.angle) * Math.min(1, Math.max(0, dt) * 16);
    rig.syncAngleCache();
    return rig;
  }

  function ellipsePath(ctx, x, y, rx, ry) {
    ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, TAU);
  }

  function drawVariant(ctx, body, c, bridge, rig) {
    const r = body.r, kind = body.hexapod, paper = '#fffaf0', accent = '#a85e55';
    const moving = Math.hypot(rig.vx, rig.vy) > 12;
    const bob = moving ? Math.sin((body.walk || 0) * 2.1) * r * (kind === 'turtle' || kind === 'totem' ? 0.008 : 0.025) : 0;
    ctx.translate(body.x, body.y - bob); ctx.rotate(rig.angle);
    ctx.fillStyle = paper; ctx.strokeStyle = c; ctx.lineWidth = 3;
    if (kind === 'turtle') {
      ellipsePath(ctx, 0, 0, r * 0.96, r * 0.76); ctx.fill(); ctx.stroke();
      ellipsePath(ctx, 0, 0, r * 0.72, r * 0.55); ctx.lineWidth = 2; ctx.stroke();
      for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; bridge.line(0, 0, Math.cos(a) * r * 0.68, Math.sin(a) * r * 0.52, c, 1.5); }
      ellipsePath(ctx, 0, -r * 0.82, r * 0.3, r * 0.3); ctx.fill(); ctx.stroke();
      if (body.phase >= 2) { bridge.line(-r * 0.2, -r * 0.55, r * 0.08, 0, accent, 2.5); bridge.line(r * 0.08, 0, -r * 0.14, r * 0.48, accent, 2.5); }
    } else if (kind === 'flower') {
      bridge.line(0, r * 0.8, 0, -r * 0.2, c, 8);
      for (let i = 0; i < 6; i++) {
        const a = i / 6 * TAU + (body.phase === 2 ? 0.25 : 0), x = Math.cos(a) * r * 0.52, y = -r * 0.35 + Math.sin(a) * r * 0.52;
        ellipsePath(ctx, x, y, r * 0.28, r * 0.5); ctx.fill(); ctx.stroke();
      }
      ellipsePath(ctx, 0, -r * 0.35, r * 0.34, r * 0.34); ctx.fillStyle = '#ead9b0'; ctx.fill(); ctx.stroke();
      for (const side of [-1, 1]) bridge.line(side * r * 0.12, -r * 0.35, side * r * 0.22, -r * 0.3, c, 2);
    } else if (kind === 'rhino') {
      ellipsePath(ctx, 0, r * 0.08, r * 0.76, r * 0.88); ctx.fill(); ctx.stroke();
      ellipsePath(ctx, 0, -r * 0.76, r * 0.48, r * 0.42); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-r * 0.14, -r * 1.02); ctx.lineTo(0, -r * 1.65); ctx.lineTo(r * 0.16, -r * 1.02); ctx.closePath(); ctx.fill(); ctx.stroke();
      bridge.line(-r * 0.48, -r * 0.1, r * 0.48, -r * 0.1, c, 2);
      for (const side of [-1, 1]) bridge.circle(side * r * 0.2, -r * 0.82, 2.4, c, 1.5);
    } else if (kind === 'tree') {
      ctx.fillRect(-r * 0.34, -r * 0.2, r * 0.68, r * 1.05); ctx.strokeRect(-r * 0.34, -r * 0.2, r * 0.68, r * 1.05);
      for (let i = 0; i < 5; i++) {
        const a = i / 5 * TAU - Math.PI / 2, x = Math.cos(a) * r * 0.5, y = -r * 0.48 + Math.sin(a) * r * 0.43;
        ctx.beginPath(); ctx.arc(x, y, r * 0.36, 0, TAU); ctx.fill(); ctx.stroke();
        bridge.circle(x, y, r * 0.07, accent, 1.5);
      }
      bridge.line(0, -r * 0.1, 0, r * 0.72, c, 2);
    } else if (kind === 'blind') {
      ellipsePath(ctx, 0, r * 0.12, r * 0.82, r * 0.62); ctx.fill(); ctx.stroke();
      ellipsePath(ctx, 0, -r * 0.58, r * 0.46, r * 0.4); ctx.fill(); ctx.stroke();
      for (let i = 0; i < 9; i++) {
        const a = i / 9 * TAU, x = Math.cos(a) * r * 0.38, y = -r * 0.58 + Math.sin(a) * r * 0.32;
        bridge.line(x, y, x + Math.cos(a) * r * 0.35, y + Math.sin(a) * r * 0.35, c, 2.2);
      }
      bridge.line(-r * 0.65, r * 0.15, -r * 0.25, r * 0.28, c, 1.5); bridge.line(r * 0.65, r * 0.15, r * 0.25, r * 0.28, c, 1.5);
    } else if (kind === 'feather') {
      ctx.beginPath(); ctx.moveTo(0, r * 0.9); ctx.quadraticCurveTo(-r * 0.65, r * 0.25, 0, -r * 0.2); ctx.quadraticCurveTo(r * 0.5, -r * 0.55, 0, -r * 0.88); ctx.stroke();
      ellipsePath(ctx, 0, -r * 0.86, r * 0.34, r * 0.3); ctx.fill(); ctx.stroke();
      for (const side of [-1, 1]) for (let i = 0; i < 4; i++) {
        const y = -r * 0.3 + i * r * 0.25;
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(side * r * (0.9 - i * 0.08), y + r * 0.18); ctx.lineTo(side * r * 0.22, y + r * 0.32); ctx.closePath(); ctx.fill(); ctx.stroke();
      }
      bridge.circle(0, -r * 0.9, 2.5, accent, 1.5);
    } else if (kind === 'totem') {
      ctx.fillRect(-r * 0.52, -r * 0.95, r * 1.04, r * 1.75); ctx.strokeRect(-r * 0.52, -r * 0.95, r * 1.04, r * 1.75);
      for (let i = 0; i < 5; i++) {
        const y = -r * 0.72 + i * r * 0.32;
        ellipsePath(ctx, 0, y, r * 0.27, r * 0.12); ctx.stroke();
        bridge.circle(0, y, r * 0.055, body.phase === 2 ? accent : c, 1.4);
      }
      bridge.line(-r * 0.5, r * 0.82, r * 0.5, r * 0.82, c, 4);
    } else if (kind === 'mantis') {
      ellipsePath(ctx, 0, r * 0.18, r * 0.43, r * 0.82); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, -r * 1.25); ctx.lineTo(-r * 0.48, -r * 0.62); ctx.lineTo(r * 0.48, -r * 0.62); ctx.closePath(); ctx.fill(); ctx.stroke();
      for (const side of [-1, 1]) {
        bridge.line(side * r * 0.28, -r * 0.4, side * r * 0.85, -r * 0.85, c, 4);
        bridge.line(side * r * 0.85, -r * 0.85, side * r * 1.05, -r * 0.2, c, 4);
        bridge.line(side * r * 1.05, -r * 0.2, side * r * 0.62, -r * 0.45, c, 3);
        bridge.circle(side * r * 0.2, -r * 0.83, 2.6, accent, 1.5);
      }
    } else if (kind === 'mother') {
      ellipsePath(ctx, 0, 0, r * 0.82, r * 0.88); ctx.fill(); ctx.stroke();
      for (let i = 0; i < 6; i++) {
        const a = i / 6 * TAU, x = Math.cos(a) * r * 0.62, y = Math.sin(a) * r * 0.62;
        ellipsePath(ctx, x, y, r * 0.25, r * 0.38); ctx.fill(); ctx.stroke();
      }
      ctx.beginPath(); ctx.moveTo(-r * 0.25, -r * 0.7); ctx.lineTo(0, -r * 1.42); ctx.lineTo(r * 0.25, -r * 0.7); ctx.closePath(); ctx.fill(); ctx.stroke();
      for (let i = 0; i < 3 + body.phase; i++) bridge.circle((i - (2 + body.phase) / 2) * r * 0.18, -r * 0.2, 2.8, accent, 1.5);
      ellipsePath(ctx, 0, r * 0.22, r * 0.42, r * 0.4); ctx.lineWidth = 2; ctx.stroke();
    }
  }

  function drawPod(ctx, body, color, bridge) {
    const r = body.r || 24, c = color || '#353238';
    ctx.save(); ctx.fillStyle = '#fff2c8'; ellipsePath(ctx, body.x, body.y, r * 0.72, r); ctx.fill(); ctx.strokeStyle = c; ctx.lineWidth = 2.5; ctx.stroke();
    bridge.line(body.x, body.y - r, body.x + r * 0.25, body.y - r * 1.35, c, 2.5);
    bridge.line(body.x, body.y - r * 0.5, body.x, body.y + r * 0.65, c, 1.4);
    const ratio = Math.max(0, body.hp / body.maxhp);
    bridge.line(body.x - r, body.y + r * 1.25, body.x + r, body.y + r * 1.25, '#8f8a80', 2);
    bridge.line(body.x - r, body.y + r * 1.25, body.x - r + 2 * r * ratio, body.y + r * 1.25, '#7a9e01', 3);
    ctx.restore();
  }

  function draw(ctx, body, color, bridge) {
    const rig = ensure(body), poses = rig.getPose(body), r = body.r;
    const c = color || '#353238', accent = '#a85e55';
    ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (const pose of poses) {
      const leg = pose.leg, activeClaw = body.attack === 'feralClaw' && leg.index % 3 === 0;
      bridge.line(pose.hip.x, pose.hip.y, pose.knee.x, pose.knee.y, c, activeClaw ? 4.2 : 3.2);
      bridge.line(pose.knee.x, pose.knee.y, pose.foot.x, pose.foot.y, c, activeClaw ? 3.6 : 2.6);
      if (leg.state === 'planted') bridge.circle(pose.foot.x, pose.foot.y, 1.7, c, 1.1);
      else {
        ctx.save(); ctx.globalAlpha = 0.2;
        bridge.circle(pose.groundX, pose.groundY, 2.2, c, 1); ctx.restore();
      }
    }

    if (body.hexapod && body.hexapod !== 'feral') {
      drawVariant(ctx, body, c, bridge, rig); ctx.restore(); return;
    }
    const moving = Math.hypot(rig.vx, rig.vy) > 12;
    const bob = moving ? Math.sin((body.walk || 0) * 2.1) * r * 0.025 : 0;
    ctx.translate(body.x, body.y - bob); ctx.rotate(rig.angle);
    // 尾巴、躯干和头部使用不同轮廓，保持“六足兽”而非蜘蛛剪影。
    bridge.line(0, r * 0.66, -r * 0.18, r * 1.02, c, 4);
    bridge.line(-r * 0.18, r * 1.02, -r * 0.52, r * 1.12, c, 3.4);
    bridge.line(-r * 0.52, r * 1.12, -r * 0.68, r * 0.98, c, 3);
    ctx.fillStyle = 'rgba(255,250,238,0.94)'; ellipsePath(ctx, 0, 0, r * 0.63, r * 0.9); ctx.fill();
    ctx.strokeStyle = c; ctx.lineWidth = 3.4; ctx.stroke();
    ellipsePath(ctx, 0, r * 0.12, r * 0.43, r * 0.66); ctx.lineWidth = 1.5; ctx.stroke();
    for (const side of [-1, 1]) {
      bridge.line(side * r * 0.34, -r * 0.72, side * r * 0.48, -r * 1.08, c, 3);
      bridge.line(side * r * 0.48, -r * 1.08, side * r * 0.12, -r * 0.88, c, 3);
    }
    ctx.fillStyle = '#fffaf0'; ellipsePath(ctx, 0, -r * 0.75, r * 0.48, r * 0.43); ctx.fill();
    ctx.strokeStyle = c; ctx.lineWidth = 3; ctx.stroke();
    ellipsePath(ctx, 0, -r * 0.93, r * 0.24, r * 0.2); ctx.lineWidth = 1.8; ctx.stroke();
    for (const side of [-1, 1]) {
      bridge.circle(side * r * 0.18, -r * 0.79, r * 0.045, body.phase === 2 ? accent : c, 1.5);
      bridge.line(side * r * 0.1, -r * 1.02, side * r * 0.27, -r * 1.06, c, 2);
    }
    bridge.line(-r * 0.08, -r * 0.91, r * 0.08, -r * 0.91, c, 2.2);
    // 背脊的三道短线让移动中的朝向更容易辨认。
    for (let i = -1; i <= 1; i++) bridge.line(-r * 0.15, i * r * 0.28, r * 0.15, i * r * 0.28, c, 1.6);
    ctx.restore();
  }

  root.HexapodRuntime = { createFeralRig, ensure, update, draw, drawPod };
})(typeof globalThis !== 'undefined' ? globalThis : this);

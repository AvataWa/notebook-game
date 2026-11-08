/* 圆珠笔程序化生物绘制器，仅供独立造型总览使用。 */
(function (root) {
  'use strict';
  const P = root.CreatureDesigns.PALETTE;
  let seed = 1;
  const rnd = () => { seed = seed * 16807 % 2147483647; return (seed - 1) / 2147483646; };
  const TAU = Math.PI * 2;

  function line(ctx, x1, y1, x2, y2, color, width) {
    // 总览与正式游戏共用主绘制器的手绘线条，不再维护另一套笔触。
    if (root.doodleBridge) { root.doodleBridge.line(x1, y1, x2, y2, color, width); return; }
    const length = Math.hypot(x2 - x1, y2 - y1);
    const segments = Math.max(1, Math.min(8, Math.ceil(length / 9)));
    ctx.strokeStyle = color; ctx.lineWidth = width || 1.6; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath();
    for (let i = 0; i <= segments; i++) {
      const t = i / segments, jitter = i && i < segments ? 0.45 : 0;
      const x = x1 + (x2 - x1) * t + (rnd() - 0.5) * jitter;
      const y = y1 + (y2 - y1) * t + (rnd() - 0.5) * jitter;
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
    ctx.strokeStyle = color; ctx.lineWidth = width || 1.6; ctx.fillStyle = color;
    ctx.beginPath();
    for (let i = 0; i <= 20; i++) {
      const a = i / 20 * TAU, rr = r + (i < 20 ? (rnd() - 0.5) * 0.55 : 0);
      const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr;
      if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
    }
    if (fill) ctx.fill(); else ctx.stroke();
  }
  function rect(ctx, x, y, w, h, color, width) {
    if (root.doodleBridge) { root.doodleBridge.rect(x, y, w, h, color, width); return; }
    line(ctx, x, y, x + w, y, color, width); line(ctx, x + w, y, x + w, y + h, color, width);
    line(ctx, x + w, y + h, x, y + h, color, width); line(ctx, x, y + h, x, y, color, width);
  }
  function poly(ctx, points, color, width, close = true) {
    for (let i = 1; i < points.length; i++) line(ctx, ...points[i - 1], ...points[i], color, width);
    if (close && points.length > 2) line(ctx, ...points[points.length - 1], ...points[0], color, width);
  }
  function hatch(ctx, x, y, w, h, color, gap = 3) {
    ctx.save(); ctx.globalAlpha *= 0.42;
    for (let yy = y + 2; yy < y + h; yy += gap) line(ctx, x, yy, x + w, yy - 2, color, 0.8);
    ctx.restore();
  }
  function eye(ctx, x, y, r, color) { circle(ctx, x, y, r, color, 1.1, true); }
  function horns(ctx, w, y, color) {
    poly(ctx, [[-w * 0.55, y + 2], [-w * 0.95, y - w * 0.65], [-w * 0.15, y - w * 0.15]], color, 1.7, false);
    poly(ctx, [[w * 0.55, y + 2], [w * 0.95, y - w * 0.65], [w * 0.15, y - w * 0.15]], color, 1.7, false);
  }
  function humanoid(ctx, d, player) {
    const w = d.bodyW, h = d.bodyLen, c = d.color;
    const headR = d.shape === 'doodle' ? w * 0.58 : w * 0.43;
    circle(ctx, 0, -h * 0.52, headR, c, d.thick);
    line(ctx, 0, -h * 0.52 + headR, 0, h * 0.28, c, d.thick);
    const shoulder = d.shape === 'rage' ? w * 0.9 : w * 0.62;
    line(ctx, -shoulder, -h * 0.13, shoulder, -h * 0.13, c, d.thick);
    line(ctx, -shoulder, -h * 0.13, -w * 0.82, h * 0.25, c, d.thick);
    line(ctx, shoulder, -h * 0.13, w * 0.82, h * 0.25, c, d.thick);
    eye(ctx, -headR * 0.32, -h * 0.55, 0.85, c); eye(ctx, headR * 0.32, -h * 0.55, 0.85, c);
    if (d.horns) horns(ctx, headR, -h * 0.52 - headR * 0.7, c);
    if (player) {
      line(ctx, -w * 0.6, -h * 0.23, w * 0.8, -h * 0.05, d.accent, 2.2);
      line(ctx, w * 0.6, -h * 0.08, w * 1.25, h * 0.12, d.accent, 1.4);
    }
    if (d.shape === 'rage') hatch(ctx, -w * 0.6, -h * 0.15, w * 1.2, h * 0.45, c, 2.5);
  }
  function pencil(ctx, d, crown) {
    const w = d.bodyW, h = d.bodyLen, c = d.color;
    rect(ctx, -w / 2, -h * 0.55, w, h * 0.9, c, d.thick);
    hatch(ctx, -w * 0.35, -h * 0.48, w * 0.7, h * 0.65, d.accent, 4);
    poly(ctx, [[-w / 2, h * 0.35], [0, h * 0.72], [w / 2, h * 0.35]], c, d.thick);
    poly(ctx, [[-w * 0.13, h * 0.59], [0, h * 0.72], [w * 0.13, h * 0.59]], c, 1.3);
    rect(ctx, -w * 0.58, -h * 0.7, w * 1.16, h * 0.15, d.accent, 2);
    eye(ctx, -w * 0.2, -h * 0.15, 1.2, c); eye(ctx, w * 0.2, -h * 0.15, 1.2, c);
    if (crown) poly(ctx, [[-w * 0.65, -h * 0.72], [-w * 0.5, -h * 0.98], [0, -h * 0.78], [w * 0.5, -h * 0.98], [w * 0.65, -h * 0.72]], d.accent, 2, false);
  }
  function eraser(ctx, d) {
    const w = d.bodyW, h = d.bodyLen;
    rect(ctx, -w / 2, -h / 2, w, h, d.color, d.thick);
    ctx.save(); ctx.globalAlpha = 0.16; ctx.fillStyle = d.accent; ctx.fillRect(-w * 0.5, -h * 0.5, w, h * 0.5); ctx.restore();
    rect(ctx, -w / 2, -h / 2, w, h * 0.5, d.accent, 1.5);
    line(ctx, -w * 0.15, -h * 0.5, w * 0.08, 0, d.accent, 1.2);
    eye(ctx, -w * 0.18, h * 0.18, 1.5, d.color); eye(ctx, w * 0.18, h * 0.18, 1.5, d.color);
    line(ctx, -w * 0.13, h * 0.33, w * 0.13, h * 0.33, d.color, 1.6);
  }
  function dragon(ctx, d, origami) {
    const w = d.bodyW, h = d.bodyLen, c = d.color, a = d.accent;
    if (origami) {
      poly(ctx, [[-w * 0.2, -h * 0.2], [-w * 1.1, -h * 0.62], [-w * 0.75, h * 0.1], [-w * 0.2, h * 0.15]], a, 2.3);
      poly(ctx, [[w * 0.2, -h * 0.2], [w * 1.1, -h * 0.62], [w * 0.75, h * 0.1], [w * 0.2, h * 0.15]], a, 2.3);
      poly(ctx, [[0, -h * 0.5], [w * 0.42, 0], [0, h * 0.4], [-w * 0.42, 0]], c, 2.8);
    } else {
      poly(ctx, [[-w * 0.2, -h * 0.15], [-w * 1.05, -h * 0.55], [-w * 0.72, h * 0.12], [-w * 0.2, h * 0.15]], a, 2.1);
      poly(ctx, [[w * 0.2, -h * 0.15], [w * 1.05, -h * 0.55], [w * 0.72, h * 0.12], [w * 0.2, h * 0.15]], a, 2.1);
      circle(ctx, 0, 0, w * 0.38, c, d.thick); hatch(ctx, -w * 0.28, -h * 0.2, w * 0.56, h * 0.4, c, 5);
    }
    line(ctx, 0, -h * 0.25, 0, -h * 0.62, c, d.thick);
    circle(ctx, 0, -h * 0.68, w * 0.22, c, d.thick);
    eye(ctx, -w * 0.08, -h * 0.72, 1.5, a); eye(ctx, w * 0.08, -h * 0.72, 1.5, a);
    poly(ctx, [[0, h * 0.3], [w * 0.3, h * 0.58], [w * 0.75, h * 0.65]], c, d.thick, false);
    horns(ctx, w * 0.22, -h * 0.85, c);
  }

  function drawBody(ctx, d, time) {
    const c = d.color, a = d.accent, w = d.bodyW, h = d.bodyLen, r = d.r;
    switch (d.shape) {
      case 'player': humanoid(ctx, d, true); break;
      case 'stick': case 'doodle': case 'rage': humanoid(ctx, d, false); break;
      case 'spider':
        circle(ctx, 0, h * 0.15, w * 0.58, c, d.thick); circle(ctx, 0, -h * 0.42, w * 0.42, c, d.thick);
        eye(ctx, -w * 0.15, -h * 0.48, 1, c); eye(ctx, w * 0.15, -h * 0.48, 1, c); break;
      case 'crumple': {
        const pts = []; for (let i = 0; i < 11; i++) { const an = i / 11 * TAU, rr = r * (0.82 + rnd() * 0.28); pts.push([Math.cos(an) * rr, Math.sin(an) * rr]); }
        poly(ctx, pts, c, 2.2); poly(ctx, [[-r * 0.7, -r * 0.4], [r * 0.4, r * 0.45], [r * 0.65, -r * 0.55]], a, 1.2, false);
        eye(ctx, -5, -2, 1.5, c); eye(ctx, 5, -2, 1.5, c); poly(ctx, [[-6, 5], [-2, 2], [2, 7], [7, 4]], c, 1.6, false); break;
      }
      case 'scissors':
        circle(ctx, -w * 0.35, h * 0.28, w * 0.28, c, 2); circle(ctx, w * 0.35, h * 0.28, w * 0.28, c, 2);
        poly(ctx, [[-w * 0.2, h * 0.1], [-w * 0.75, -h * 0.65], [0, -h * 0.1]], c, 2.2);
        poly(ctx, [[w * 0.2, h * 0.1], [w * 0.75, -h * 0.65], [0, -h * 0.1]], c, 2.2);
        circle(ctx, 0, 0, 2.4, a, 1.8); break;
      case 'ink':
        circle(ctx, 0, 0, r * 0.88, c, 2.8, true); hatch(ctx, -r * 0.75, -r * 0.6, r * 1.5, r * 1.2, P.PAPER, 4);
        eye(ctx, -r * 0.28, -r * 0.12, 2, P.PAPER); eye(ctx, r * 0.28, -r * 0.12, 2, P.PAPER); break;
      case 'plane':
        poly(ctx, [[0, -h * 0.65], [-w * 0.75, h * 0.45], [0, h * 0.18], [w * 0.75, h * 0.45]], c, 2);
        line(ctx, 0, -h * 0.65, 0, h * 0.55, a, 1.4); line(ctx, 0, h * 0.18, -w * 0.22, h * 0.48, c, 1.2); break;
      case 'leech': case 'inkthief':
        circle(ctx, 0, 0, w * 0.47, c, d.thick); eye(ctx, -w * 0.16, -h * 0.15, 1.4, c); eye(ctx, w * 0.16, -h * 0.15, 1.4, c);
        line(ctx, -w * 0.24, h * 0.18, w * 0.24, h * 0.18, a, 2.5); line(ctx, 0, h * 0.18, 0, h * 0.52, a, 2);
        if (d.shape === 'inkthief') hatch(ctx, -w * 0.32, -h * 0.1, w * 0.64, h * 0.35, a, 3); break;
      case 'sprayer':
        circle(ctx, 0, -h * 0.1, w * 0.43, c, d.thick); circle(ctx, w * 0.58, h * 0.08, w * 0.42, a, 2.2);
        line(ctx, 0, -h * 0.35, 0, -h * 0.82, c, 2.4); circle(ctx, 0, -h * 0.86, 1.8, a, 1.4);
        eye(ctx, -w * 0.14, -h * 0.18, 1, c); eye(ctx, w * 0.14, -h * 0.18, 1, c); break;
      case 'inksac':
        poly(ctx, [[-w * 0.18, -h * 0.58], [-w * 0.48, -h * 0.15], [-w * 0.52, h * 0.3], [-w * 0.3, h * 0.52], [w * 0.3, h * 0.52], [w * 0.52, h * 0.3], [w * 0.48, -h * 0.15], [w * 0.18, -h * 0.58]], c, 2.5);
        line(ctx, -w * 0.24, -h * 0.52, w * 0.24, -h * 0.52, a, 2.6); hatch(ctx, -w * 0.38, h * 0.12, w * 0.76, h * 0.25, a, 3.5);
        eye(ctx, -w * 0.14, -h * 0.08, 1.4, c); eye(ctx, w * 0.14, -h * 0.08, 1.4, c); break;
      case 'pencilthrower':
        pencil(ctx, d, false); line(ctx, -w, -h * 0.2, w * 1.25, h * 0.25, c, 2.4); line(ctx, w * 1.25, h * 0.25, w * 1.5, h * 0.3, a, 1.6); break;
      case 'forkpen':
        pencil(ctx, d, false); line(ctx, -w * 0.45, -h * 0.75, -w * 0.7, -h * 1.05, c, 2.4); line(ctx, w * 0.45, -h * 0.75, w * 0.7, -h * 1.05, c, 2.4);
        circle(ctx, -w * 0.7, -h * 1.06, 1.6, a, 1.2); circle(ctx, w * 0.7, -h * 1.06, 1.6, a, 1.2); break;
      case 'elitePencil': pencil(ctx, d, true); break;
      case 'eliteCrossbow':
        eraser(ctx, d); poly(ctx, [[-w * 0.85, -h * 0.35], [0, 0], [w * 0.85, -h * 0.35]], c, 2.4, false);
        line(ctx, -w * 0.85, -h * 0.35, w * 0.85, -h * 0.35, P.RED, 1.4); line(ctx, 0, -h * 0.55, 0, h * 0.25, c, 2); break;
      case 'eliteEraser': eraser(ctx, d); break;
      case 'eliteEye':
        poly(ctx, [[-w * 0.55, 0], [-w * 0.25, -h * 0.38], [w * 0.25, -h * 0.38], [w * 0.55, 0], [w * 0.25, h * 0.38], [-w * 0.25, h * 0.38]], c, 2.7);
        circle(ctx, 0, 0, w * 0.2, a, 2.5); circle(ctx, 0, 0, w * 0.075, c, 1.5, true); break;
      case 'bossScribble':
        for (let i = 0; i < 6; i++) circle(ctx, (rnd() - 0.5) * w * 0.4, (rnd() - 0.5) * h * 0.4, w * (0.2 + rnd() * 0.18), c, 2);
        eye(ctx, -w * 0.16, -h * 0.08, 2.4, a); eye(ctx, w * 0.16, -h * 0.08, 2.4, a); horns(ctx, w * 0.4, -h * 0.5, c); break;
      case 'bossTape':
        rect(ctx, -w * 0.48, -h * 0.4, w * 0.96, h * 0.8, c, 3.5); circle(ctx, -w * 0.15, 0, h * 0.28, a, 3);
        circle(ctx, -w * 0.15, 0, h * 0.1, c, 2); rect(ctx, w * 0.2, -h * 0.15, w * 0.42, h * 0.3, c, 2); break;
      case 'bossJudge':
        humanoid(ctx, d, false); poly(ctx, [[0, -h * 0.9], [-w * 0.28, -h * 0.48], [0, -h * 0.58], [w * 0.28, -h * 0.48]], a, 2.6);
        line(ctx, -w * 0.75, -h * 0.15, -w * 0.75, h * 0.55, c, 3); break;
      case 'bossDragon': dragon(ctx, d, false); break;
      case 'bossOrigami': dragon(ctx, d, true); break;
      case 'bossKnight':
        circle(ctx, 0, h * 0.18, w * 0.42, c, 3); humanoid(ctx, Object.assign({}, d, { bodyLen: h * 0.65, bodyW: w * 0.6 }), false);
        line(ctx, w * 0.35, -h * 0.4, w * 1.25, h * 0.25, c, 3); poly(ctx, [[w * 1.25, h * 0.25], [w * 1.02, h * 0.12], [w * 1.1, h * 0.36]], a, 2); break;
      case 'bossElement':
        poly(ctx, [[0, -h * 0.58], [-w * 0.45, h * 0.1], [-w * 0.28, h * 0.45], [0, h * 0.55], [w * 0.28, h * 0.45], [w * 0.45, h * 0.1]], c, 3.2);
        circle(ctx, 0, h * 0.08, w * 0.23, a, 2.5); hatch(ctx, -w * 0.25, -h * 0.1, w * 0.5, h * 0.4, a, 5); break;
      case 'bossEraser': eraser(ctx, d); horns(ctx, w * 0.35, -h * 0.65, c); break;
      case 'bossAbyss':
        circle(ctx, 0, 0, w * 0.45, c, 3.5); circle(ctx, 0, 0, w * 0.31, a, 3); circle(ctx, 0, 0, w * 0.17, c, 2.5, true);
        for (let i = 0; i < 8; i++) { const an = i / 8 * TAU; line(ctx, Math.cos(an) * w * 0.32, Math.sin(an) * w * 0.32, Math.cos(an) * w * 0.43, Math.sin(an) * w * 0.43, a, 1.5); } break;
      case 'bossNotebook':
        poly(ctx, [[0, -h * 0.45], [-w * 0.52, -h * 0.58], [-w * 0.48, h * 0.42], [0, h * 0.32]], c, 3);
        poly(ctx, [[0, -h * 0.45], [w * 0.52, -h * 0.58], [w * 0.48, h * 0.42], [0, h * 0.32]], c, 3);
        line(ctx, 0, -h * 0.45, 0, h * 0.32, a, 2); hatch(ctx, -w * 0.4, -h * 0.35, w * 0.3, h * 0.5, OCHRE_SAFE, 6); hatch(ctx, w * 0.1, -h * 0.35, w * 0.3, h * 0.5, OCHRE_SAFE, 6);
        eye(ctx, -w * 0.12, -h * 0.05, 2.3, a); eye(ctx, w * 0.12, -h * 0.05, 2.3, a); break;
    }
  }
  const OCHRE_SAFE = '#9b8257';

  function drawFoot(ctx, foot, x, y, d) {
    if (d.foot === 'suction') circle(ctx, x, y, 1.8, d.accent, 1.1);
    else if (d.foot === 'block' || d.foot === 'shoe') rect(ctx, x - 1.8, y - 1, 3.6, 2, d.color, 1.2);
    else if (d.foot === 'claw') { line(ctx, x, y, x - 2.2, y + 1.8, d.color, 1); line(ctx, x, y, x + 2.2, y + 1.8, d.color, 1); }
    else if (d.foot === 'blade') poly(ctx, [[x - 1.5, y - 1], [x + 2.5, y], [x - 1.5, y + 1.5]], d.color, 1);
    else circle(ctx, x, y, 0.8, d.color, 1, true);
  }

  function draw(ctx, d, body, rig, time, cx, cy, maxW, maxH, options) {
    seed = 1 + d.id.split('').reduce((n, ch) => n + ch.charCodeAt(0), 0) + Math.floor(time * 3) * 17;
    const poses = rig ? rig.getPose(body) : [];
    let extentX = d.bodyW * (d.wings ? 1.25 : 0.8), extentY = d.bodyLen * 0.85;
    for (const p of poses) {
      extentX = Math.max(extentX, Math.abs(p.foot.x - body.x), Math.abs(p.hip.x - body.x));
      extentY = Math.max(extentY, Math.abs(p.foot.y - body.y), Math.abs(p.hip.y - body.y));
    }
    const fixedScale = options && Number.isFinite(options.scale) ? Math.max(0.05, options.scale) : null;
    const scale = fixedScale === null ? Math.max(0.45, Math.min(d.group === 'boss' ? 1.6 : 2.8, maxW / Math.max(1, extentX), maxH / Math.max(1, extentY))) : fixedScale;
    ctx.save(); ctx.translate(cx, cy); ctx.scale(scale, scale); ctx.translate(-body.x, -body.y);
    // 墨线蜘蛛直接走正式游戏的原始绘制路径，保证总览与原型一致。
    if (d.id === 'spider' && root.drawSpiderBaseline) {
      root.drawSpiderBaseline(body); ctx.restore(); return;
    }
    for (const p of poses) {
      line(ctx, p.hip.x, p.hip.y, p.knee.x, p.knee.y, d.color, d.thick);
      line(ctx, p.knee.x, p.knee.y, p.foot.x, p.foot.y, d.color, Math.max(1, d.thick * 0.82));
      drawFoot(ctx, p.leg, p.foot.x, p.foot.y, d);
    }
    const motion = body.motion || {};
    const bob = motion.bob || (poses.length ? poses.reduce((n, p) => n + p.leg.lift, 0) / poses.length * 0.12 : Math.sin(time * 5) * 1.5);
    ctx.save(); ctx.translate(body.x + (motion.swayX || 0), body.y - bob);
    if (rig) ctx.rotate(rig.angle - Math.PI / 2 + (motion.roll || 0) + (motion.lean || 0));
    else if (Number.isFinite(body.locomotionAngle)) ctx.rotate(body.locomotionAngle + (motion.roll || 0) + (motion.lean || 0));
    if (motion.softness) ctx.scale(1 + motion.softness, 1 - motion.softness);
    drawBody(ctx, d, time); ctx.restore(); ctx.restore();
  }
  root.CreatureRenderer = { draw };
})(typeof globalThis !== 'undefined' ? globalThis : this);

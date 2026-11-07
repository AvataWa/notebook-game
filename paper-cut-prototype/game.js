(() => {
  'use strict';
  const W = 375, H = 667;
  const PAPER = { x: 18, y: 96, w: 339, h: 474 };
  const C = {
    desk: '#302b27', paper: '#f5f1e6', paper2: '#e9e1d1', ink: '#1c2d78',
    red: '#c14b3f', teal: '#5f9890', amber: '#d8a64b', gray: '#817b70', line: '#b8cfce'
  };
  const FONT = '"Segoe Print","PingFang SC","Microsoft YaHei",sans-serif';
  const S = { mode: 'start', time: 0, duration: 75, hp: 100, score: 0, cut: 0, caught: 0, combo: 0, shake: 0,
    maxLine: 520, nextUpgrade: 3, lineLv: 0, speedLv: 0 };
  const player = { x: 190, y: 335, r: 9, speed: 142, face: 0, walk: 0, inv: 0 };
  const joy = { active: false, id: -1, bx: 0, by: 0, dx: 0, dy: 0 };
  const keys = {};
  let enemies = [], trail = [], cutouts = [], dolls = [], particles = [], notices = [];
  let spawnT = 0, nextId = 1, last = 0, boil = 0;

  function reset(mode = 'start') {
    Object.assign(S, { mode, time: 0, hp: 100, score: 0, cut: 0, caught: 0, combo: 0, shake: 0,
      maxLine: 520, nextUpgrade: 3, lineLv: 0, speedLv: 0 });
    Object.assign(player, { x: 190, y: 335, speed: 142, face: 0, walk: 0, inv: 0 });
    enemies = []; trail = [{ x: player.x, y: player.y }]; cutouts = []; dolls = []; particles = []; notices = [];
    spawnT = 0; nextId = 1; joy.active = false; joy.dx = joy.dy = 0;
  }
  function start() { reset('play'); for (let i = 0; i < 5; i++) spawnEnemy('doodle'); }
  function clampPlayer() {
    player.x = Math.max(PAPER.x + 15, Math.min(PAPER.x + PAPER.w - 15, player.x));
    player.y = Math.max(PAPER.y + 15, Math.min(PAPER.y + PAPER.h - 15, player.y));
  }
  function spawnEnemy(forceType) {
    const side = Math.floor(Math.random() * 4), m = 24;
    let x, y;
    if (side < 2) { x = side ? PAPER.x + PAPER.w - m : PAPER.x + m; y = PAPER.y + m + Math.random() * (PAPER.h - m * 2); }
    else { x = PAPER.x + m + Math.random() * (PAPER.w - m * 2); y = side === 2 ? PAPER.y + m : PAPER.y + PAPER.h - m; }
    const canSnip = S.time > 10 && enemies.filter(e => e.type === 'snip' && !e.dead).length < 2;
    const type = forceType || (canSnip && Math.random() < 0.16 ? 'snip' : 'doodle');
    enemies.push({ id: nextId++, type, x, y, r: type === 'snip' ? 10 : 9,
      speed: (type === 'snip' ? 50 : 43) + Math.min(22, S.time * 0.22), hitCd: 0, snipCd: 1.2, walk: Math.random() * 6, dead: false });
  }
  function cross(a, b, c) { return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x); }
  function segmentIntersection(a, b, c, d) {
    const den = (b.x - a.x) * (d.y - c.y) - (b.y - a.y) * (d.x - c.x);
    if (Math.abs(den) < 1e-8) return null;
    const t = ((c.x - a.x) * (d.y - c.y) - (c.y - a.y) * (d.x - c.x)) / den;
    const u = ((c.x - a.x) * (b.y - a.y) - (c.y - a.y) * (b.x - a.x)) / den;
    if (t < 0 || t > 1 || u < 0 || u > 1) return null;
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
  }
  function polygonArea(poly) {
    let a = 0;
    for (let i = 0; i < poly.length; i++) { const p = poly[i], q = poly[(i + 1) % poly.length]; a += p.x * q.y - q.x * p.y; }
    return Math.abs(a) / 2;
  }
  function pointInPolygon(p, poly) {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const a = poly[i], b = poly[j];
      if (((a.y > p.y) !== (b.y > p.y)) && p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x) inside = !inside;
    }
    return inside;
  }
  function distToSegment(p, a, b) {
    const dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy;
    if (!l2) return Math.hypot(p.x - a.x, p.y - a.y);
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2));
    return Math.hypot(p.x - a.x - dx * t, p.y - a.y - dy * t);
  }
  function trailLength(points = trail) {
    let total = 0;
    for (let i = 1; i < points.length; i++) total += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
    return total;
  }
  function keepTrailLength(limit) {
    if (trailLength() <= limit) return false;
    let remaining = limit;
    for (let i = trail.length - 1; i > 0; i--) {
      const a = trail[i - 1], b = trail[i], seg = Math.hypot(b.x - a.x, b.y - a.y);
      if (seg <= remaining) { remaining -= seg; continue; }
      const t = seg ? remaining / seg : 0;
      const cut = { x: b.x + (a.x - b.x) * t, y: b.y + (a.y - b.y) * t };
      trail = [cut, ...trail.slice(i)];
      return true;
    }
    return false;
  }
  function shortenTrail() {
    if (trailLength() < 170) return false;
    const kept = Math.min(125, trailLength() * 0.38);
    keepTrailLength(kept);
    notice('线被剪短了，手中这段还在', C.amber);
    for (let i = 0; i < 8; i++) particles.push({ x: trail[0].x, y: trail[0].y, vx: (Math.random() - 0.5) * 70, vy: -20 - Math.random() * 45, t: 0.55, col: C.amber });
    return true;
  }
  function applyUpgrade(kind) {
    if (kind === 'line') { S.maxLine += 140; S.lineLv++; notice('墨线上限 +140', C.teal); }
    else if (kind === 'speed') { player.speed *= 1.12; S.speedLv++; notice('移动速度 +12%', C.teal); }
    else return false;
    S.mode = 'play'; joy.active = false; joy.dx = joy.dy = 0;
    return true;
  }
  function findLoop(points) {
    const n = points.length;
    if (n < 12) return null;
    const a = points[n - 2], b = points[n - 1];
    for (let i = 0; i < n - 9; i++) {
      const hit = segmentIntersection(a, b, points[i], points[i + 1]);
      if (hit) {
        const poly = [hit, ...points.slice(i + 1, n - 1).map(p => ({ x: p.x, y: p.y }))];
        return polygonArea(poly) >= 120 ? poly : null;
      }
    }
    return null;
  }
  function notice(text, color = C.ink) { notices.unshift({ text, color, t: 1.4 }); notices.length = Math.min(3, notices.length); }
  function performCut(poly) {
    if (!poly || poly.length < 3) return { caught: 0, area: 0 };
    const area = polygonArea(poly), cx = poly.reduce((s, p) => s + p.x, 0) / poly.length, cy = poly.reduce((s, p) => s + p.y, 0) / poly.length;
    let caught = 0;
    for (const e of enemies) {
      if (!e.dead && pointInPolygon(e, poly)) {
        e.dead = true; caught++;
        dolls.push({ x: e.x, y: e.y, t: 1.35, max: 1.35, spin: (Math.random() - 0.5) * 1.8, type: e.type });
      }
    }
    enemies = enemies.filter(e => !e.dead);
    S.cut++; S.caught += caught; S.combo = caught > 0 ? S.combo + 1 : 0;
    const catchScore = caught ? 100 * Math.pow(2, caught - 1) : 0;
    S.score += Math.round(area / 18) + catchScore * Math.max(1, S.combo);
    cutouts.push({ poly: poly.map(p => ({ x: p.x, y: p.y })), cx, cy, t: 1.15, max: 1.15, spin: (Math.random() - 0.5) * 0.8, caught });
    for (let i = 0; i < 12 + caught * 3; i++) particles.push({ x: cx + (Math.random() - 0.5) * 45, y: cy + (Math.random() - 0.5) * 45,
      vx: (Math.random() - 0.5) * 75, vy: -25 - Math.random() * 65, t: 0.7 + Math.random() * 0.4, col: i % 3 ? C.paper2 : C.teal });
    notice(caught ? `一圈 ${caught} 只 · ${catchScore * Math.max(1, S.combo)} 分！` : '剪下一块纸 · 下次试着圈住怪物', caught ? C.red : C.teal);
    trail = [{ x: player.x, y: player.y }];
    if (S.cut >= S.nextUpgrade) { S.mode = 'upgrade'; S.nextUpgrade += 3; }
    return { caught, area, catchScore };
  }
  function update(dt) {
    if (S.mode !== 'play') return;
    dt = Math.min(0.04, dt); S.time += dt; S.shake = Math.max(0, S.shake - dt); player.inv = Math.max(0, player.inv - dt);
    let mx = 0, my = 0;
    if (keys.w || keys.arrowup) my--;
    if (keys.s || keys.arrowdown) my++;
    if (keys.a || keys.arrowleft) mx--;
    if (keys.d || keys.arrowright) mx++;
    if (joy.active) { mx = joy.dx; my = joy.dy; }
    const ml = Math.hypot(mx, my);
    if (ml > 0) {
      mx /= ml; my /= ml; player.x += mx * player.speed * dt; player.y += my * player.speed * dt; clampPlayer();
      player.face = Math.atan2(my, mx); player.walk += dt * 11;
      const prev = trail[trail.length - 1];
      if (Math.hypot(player.x - prev.x, player.y - prev.y) >= 3) {
        trail.push({ x: player.x, y: player.y });
        keepTrailLength(S.maxLine);
        const loop = findLoop(trail);
        if (loop) performCut(loop);
      }
    }
    spawnT -= dt;
    const interval = Math.max(0.65, 2.15 - S.time * 0.018);
    if (spawnT <= 0 && enemies.length < 34) { spawnT = interval; spawnEnemy(); }
    for (const e of enemies) {
      e.hitCd = Math.max(0, e.hitCd - dt); e.snipCd = Math.max(0, (e.snipCd || 0) - dt); e.walk += dt * 8;
      const dx = player.x - e.x, dy = player.y - e.y, d = Math.hypot(dx, dy) || 1;
      e.x += dx / d * e.speed * dt; e.y += dy / d * e.speed * dt;
      // 剪线小人只削掉旧线，角色手中最后一段始终保留
      if (e.type === 'snip' && e.snipCd <= 0 && trailLength() >= 170) {
        for (let i = 0; i < trail.length - 3; i++) {
          if (distToSegment(e, trail[i], trail[i + 1]) < e.r + 2 && shortenTrail()) { e.snipCd = 6; break; }
        }
      }
      if (player.inv <= 0 && Math.hypot(e.x - player.x, e.y - player.y) < e.r + player.r) {
        S.hp = Math.max(0, S.hp - 10); player.inv = 1; S.combo = 0; S.shake = 0.22;
        e.x -= dx / d * 28; e.y -= dy / d * 28; notice('被抓住了！', C.red);
      }
    }
    for (const c of cutouts) c.t -= dt; cutouts = cutouts.filter(c => c.t > 0);
    for (const d of dolls) d.t -= dt; dolls = dolls.filter(d => d.t > 0);
    for (const p of particles) { p.t -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 85 * dt; } particles = particles.filter(p => p.t > 0);
    for (const n of notices) n.t -= dt; notices = notices.filter(n => n.t > 0);
    if (S.hp <= 0 || S.time >= S.duration) S.mode = S.hp > 0 ? 'win' : 'over';
  }

  let canvas, ctx, scale = 1;
  function resize() {
    const dpr = window.devicePixelRatio || 1, s = Math.min(window.innerWidth / W, window.innerHeight / H);
    scale = s * dpr; canvas.width = Math.round(W * scale); canvas.height = Math.round(H * scale);
    canvas.style.width = W * s + 'px'; canvas.style.height = H * s + 'px';
  }
  function roughLine(a, b, color, width = 2, seed = 0) {
    const len = Math.hypot(b.x - a.x, b.y - a.y), n = Math.max(1, Math.ceil(len / 13));
    ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath();
    for (let i = 0; i <= n; i++) {
      const t = i / n, wobble = i && i < n ? Math.sin((i + seed + boil) * 12.37) * 0.75 : 0;
      const x = a.x + (b.x - a.x) * t + wobble, y = a.y + (b.y - a.y) * t - wobble * 0.6;
      if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
    }
    ctx.stroke();
  }
  function stick(x, y, size, color, walk = 0) {
    ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(x, y - size * 0.35, size * 0.2, 0, Math.PI * 2); ctx.stroke();
    const sw = Math.sin(walk) * size * 0.2;
    roughLine({ x, y: y - size * 0.15 }, { x, y: y + size * 0.23 }, color, 2, 2);
    roughLine({ x, y: y + size * 0.23 }, { x: x - size * 0.22 + sw, y: y + size * 0.55 }, color, 2, 3);
    roughLine({ x, y: y + size * 0.23 }, { x: x + size * 0.22 - sw, y: y + size * 0.55 }, color, 2, 4);
    roughLine({ x, y: y - size * 0.05 }, { x: x - size * 0.25 - sw, y: y + size * 0.14 }, color, 2, 5);
    roughLine({ x, y: y - size * 0.05 }, { x: x + size * 0.25 + sw, y: y + size * 0.14 }, color, 2, 6);
  }
  function drawSnip(e) {
    stick(e.x, e.y, 23, C.red, e.walk);
    ctx.strokeStyle = C.amber; ctx.lineWidth = 1.7;
    ctx.beginPath(); ctx.arc(e.x + 7, e.y + 4, 3, 0, 7); ctx.arc(e.x + 12, e.y + 6, 3, 0, 7); ctx.stroke();
    roughLine({ x: e.x + 8, y: e.y + 2 }, { x: e.x + 17, y: e.y - 8 }, C.amber, 1.7, e.id);
    roughLine({ x: e.x + 12, y: e.y + 3 }, { x: e.x + 6, y: e.y - 8 }, C.amber, 1.7, e.id + 1);
  }
  function paperPath() {
    ctx.beginPath(); ctx.moveTo(PAPER.x + 2, PAPER.y);
    for (let x = PAPER.x + 8; x < PAPER.x + PAPER.w; x += 9) ctx.lineTo(x, PAPER.y + Math.sin(x * 2.13) * 1.2);
    ctx.lineTo(PAPER.x + PAPER.w, PAPER.y + PAPER.h);
    for (let x = PAPER.x + PAPER.w; x > PAPER.x; x -= 8) ctx.lineTo(x, PAPER.y + PAPER.h + Math.sin(x * 1.77) * 1.4);
    ctx.closePath();
  }
  function drawDeskAndPaper() {
    ctx.fillStyle = C.desk; ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 0.09; ctx.strokeStyle = '#d4b58d';
    for (let i = 0; i < 28; i++) { const y = (i * 43) % H; ctx.beginPath(); ctx.moveTo(0, y); ctx.bezierCurveTo(100, y + 8, 260, y - 7, W, y + 3); ctx.stroke(); }
    ctx.globalAlpha = 1;
    ctx.save(); ctx.translate(3, 4); paperPath(); ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fill(); ctx.restore();
    paperPath(); ctx.fillStyle = C.paper; ctx.fill();
    ctx.save(); paperPath(); ctx.clip();
    ctx.strokeStyle = C.line; ctx.lineWidth = 0.8; ctx.globalAlpha = 0.7;
    for (let y = PAPER.y + 25; y < PAPER.y + PAPER.h; y += 24) { ctx.beginPath(); ctx.moveTo(PAPER.x, y); ctx.lineTo(PAPER.x + PAPER.w, y); ctx.stroke(); }
    ctx.strokeStyle = '#d9a29a'; ctx.beginPath(); ctx.moveTo(55, PAPER.y); ctx.lineTo(55, PAPER.y + PAPER.h); ctx.stroke();
    ctx.fillStyle = C.gray; ctx.globalAlpha = 0.12;
    for (let i = 0; i < 220; i++) { const x = PAPER.x + ((i * 73) % PAPER.w), y = PAPER.y + ((i * 131) % PAPER.h); ctx.fillRect(x, y, 0.7, 0.7); }
    ctx.globalAlpha = 1; ctx.restore();
    for (let y = PAPER.y + 18; y < PAPER.y + PAPER.h - 8; y += 31) {
      ctx.strokeStyle = '#a9a8a2'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(PAPER.x + 1, y, 9, -Math.PI / 2, Math.PI / 2, true); ctx.stroke();
      ctx.strokeStyle = '#ece9df'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(PAPER.x + 1, y - 1, 8, -Math.PI / 2, Math.PI / 2, true); ctx.stroke();
    }
  }
  function polyPath(poly) { ctx.beginPath(); poly.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.closePath(); }
  function drawGame() {
    ctx.save(); paperPath(); ctx.clip();
    if (trail.length > 1) {
      for (let i = 1; i < trail.length; i++) roughLine(trail[i - 1], trail[i], C.ink, 2.5, i);
      ctx.fillStyle = C.ink; ctx.beginPath(); ctx.arc(trail[0].x, trail[0].y, 3, 0, 7); ctx.fill();
    }
    for (const c of cutouts) {
      const p = 1 - c.t / c.max, lift = p * 42;
      ctx.save(); ctx.translate(c.cx, c.cy - lift); ctx.rotate(c.spin * p); ctx.translate(-c.cx, -c.cy);
      ctx.globalAlpha = Math.min(1, c.t * 2);
      ctx.save(); ctx.translate(3, 5); polyPath(c.poly); ctx.fillStyle = 'rgba(48,43,39,.2)'; ctx.fill(); ctx.restore();
      polyPath(c.poly); ctx.fillStyle = c.caught ? '#d9e6dc' : C.paper2; ctx.fill();
      ctx.setLineDash([6, 5]); ctx.strokeStyle = c.caught ? C.red : C.teal; ctx.lineWidth = 1.7; ctx.stroke(); ctx.setLineDash([]);
      ctx.restore();
    }
    for (const e of enemies) { if (e.type === 'snip') drawSnip(e); else stick(e.x, e.y, 23, C.red, e.walk); }
    for (const d of dolls) {
      const p = 1 - d.t / d.max; ctx.save(); ctx.translate(d.x, d.y - p * 48); ctx.rotate(d.spin * p); ctx.globalAlpha = Math.min(1, d.t * 2);
      ctx.fillStyle = C.paper; ctx.fillRect(-11, -16, 22, 31); ctx.strokeStyle = C.teal; ctx.strokeRect(-11, -16, 22, 31);
      stick(0, 0, 20, C.ink, 0); ctx.restore();
    }
    if (player.inv <= 0 || Math.floor(player.inv * 12) % 2 === 0) stick(player.x, player.y, 28, C.ink, player.walk);
    ctx.save(); ctx.translate(player.x + Math.cos(player.face) * 11, player.y + Math.sin(player.face) * 11); ctx.rotate(player.face + Math.PI / 2);
    ctx.fillStyle = C.amber; ctx.beginPath(); ctx.moveTo(0, -5); ctx.lineTo(3, 3); ctx.lineTo(-3, 3); ctx.closePath(); ctx.fill(); ctx.restore();
    for (const p of particles) { ctx.globalAlpha = Math.min(1, p.t * 2); ctx.fillStyle = p.col; ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.x * 0.07); ctx.fillRect(-2, -1, 5, 3); ctx.restore(); }
    ctx.globalAlpha = 1; ctx.restore();
  }
  function text(txt, x, y, size, color, align = 'left', weight = 400) {
    ctx.fillStyle = color; ctx.textAlign = align; ctx.font = `${weight} ${size}px ${FONT}`; ctx.fillText(txt, x, y);
  }
  function drawHUD() {
    text('圈地剪纸', 18, 31, 23, C.paper, 'left', 700);
    text('试验页 01 / 75 秒', 20, 52, 10, '#c9beac');
    const left = Math.max(0, Math.ceil(S.duration - S.time));
    text(String(left).padStart(2, '0'), 354, 36, 27, left <= 10 ? '#ee8d7e' : C.paper, 'right', 700);
    text('秒', 354, 52, 10, '#c9beac', 'right');
    text(`得分 ${S.score}`, 20, 78, 12, C.paper, 'left', 700);
    text(`剪下 ${S.caught}`, 122, 78, 11, '#c9beac');
    text('纸面', 244, 78, 10, '#c9beac');
    ctx.fillStyle = '#5b5149'; ctx.fillRect(278, 69, 76, 8); ctx.fillStyle = S.hp < 35 ? '#ee8d7e' : C.teal; ctx.fillRect(278, 69, 76 * S.hp / 100, 8);
    text('移动留线 · 交叉闭合 · 单圈 100×2ⁿ⁻¹', W / 2, 601, 12, C.paper, 'center', 700);
    const used = Math.round(trailLength());
    text(`线长 ${used}/${S.maxLine} · 移速 ${Math.round(player.speed)} · 黄剪会剪短旧线`, W / 2, 623, 10, '#c9beac', 'center');
    ctx.fillStyle = '#5b5149'; ctx.fillRect(66, 637, 243, 5);
    ctx.fillStyle = used > S.maxLine * 0.85 ? C.amber : C.teal; ctx.fillRect(66, 637, 243 * Math.min(1, used / S.maxLine), 5);
    notices.forEach((n, i) => { ctx.globalAlpha = Math.min(1, n.t * 2); text(n.text, W / 2, 126 + i * 22, 15, n.color, 'center', 700); }); ctx.globalAlpha = 1;
    if (joy.active) {
      ctx.globalAlpha = 0.35; ctx.strokeStyle = C.paper; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(joy.bx, joy.by, 42, 0, 7); ctx.stroke();
      ctx.fillStyle = C.paper; ctx.beginPath(); ctx.arc(joy.bx + joy.dx * 42, joy.by + joy.dy * 42, 13, 0, 7); ctx.fill(); ctx.globalAlpha = 1;
    }
  }
  function upgradeRects() {
    return [{ kind: 'line', x: 55, y: 258, w: 265, h: 76 }, { kind: 'speed', x: 55, y: 354, w: 265, h: 76 }];
  }
  function overlay() {
    if (S.mode === 'play') return;
    ctx.fillStyle = 'rgba(245,241,230,.96)'; ctx.fillRect(35, 154, 305, 340);
    ctx.strokeStyle = C.ink; ctx.lineWidth = 1.5; ctx.setLineDash([4, 5]); ctx.strokeRect(42, 161, 291, 326); ctx.setLineDash([]);
    if (S.mode === 'start') {
      text('别打怪了。', W / 2, 208, 25, C.ink, 'center', 700);
      text('把它们剪下来。', W / 2, 241, 25, C.red, 'center', 700);
      ctx.save(); ctx.translate(187, 302); ctx.rotate(-0.08); ctx.fillStyle = '#d9e6dc'; ctx.fillRect(-54, -34, 108, 68); ctx.setLineDash([5, 4]); ctx.strokeStyle = C.teal; ctx.strokeRect(-54, -34, 108, 68); ctx.setLineDash([]); stick(-15, 4, 26, C.red); stick(22, 6, 24, C.red); ctx.restore();
      text('摇杆移动就会自动留线', W / 2, 373, 13, C.ink, 'center');
      text('交叉闭合，纸块和圈内怪物一起剪下', W / 2, 397, 12, C.gray, 'center');
      text('点按纸面开始', W / 2, 449, 16, C.red, 'center', 700);
    } else if (S.mode === 'upgrade') {
      text('剪纸三次，选一个强化', W / 2, 211, 22, C.ink, 'center', 700);
      text('大圈更贪，快跑更稳', W / 2, 237, 11, C.gray, 'center');
      for (const r of upgradeRects()) {
        ctx.fillStyle = C.paper2; ctx.fillRect(r.x, r.y, r.w, r.h);
        ctx.strokeStyle = C.teal; ctx.lineWidth = 1.5; ctx.setLineDash([5, 4]); ctx.strokeRect(r.x, r.y, r.w, r.h); ctx.setLineDash([]);
        text(r.kind === 'line' ? `1 · 长墨线  Lv.${S.lineLv + 1}` : `2 · 快步  Lv.${S.speedLv + 1}`, r.x + 16, r.y + 29, 17, C.ink, 'left', 700);
        text(r.kind === 'line' ? '线长上限 +140，容纳更大的闭环' : '移动速度 +12%，更容易摆脱红人', r.x + 16, r.y + 54, 11, C.gray);
      }
    } else {
      text(S.mode === 'win' ? '这一页，剪完了。' : '纸面被剪碎了。', W / 2, 221, 24, S.mode === 'win' ? C.ink : C.red, 'center', 700);
      text(`${S.score} 分`, W / 2, 285, 37, C.ink, 'center', 700);
      text(`完成 ${S.cut} 次闭环 · 剪下 ${S.caught} 只`, W / 2, 329, 13, C.gray, 'center');
      text(`存活 ${Math.floor(S.time)} 秒`, W / 2, 354, 12, C.gray, 'center');
      text('点按再剪一页', W / 2, 438, 16, C.red, 'center', 700);
    }
  }
  function render(now = 0) {
    if (!ctx) return;
    boil = Math.floor(now / 125); ctx.setTransform(scale, 0, 0, scale, 0, 0); ctx.clearRect(0, 0, W, H);
    ctx.save(); if (S.shake > 0) ctx.translate((Math.random() - 0.5) * 5, (Math.random() - 0.5) * 5);
    drawDeskAndPaper(); drawGame(); ctx.restore(); drawHUD(); overlay();
  }
  function point(e) {
    const r = canvas.getBoundingClientRect();
    return { x: (e.clientX - r.left) / (r.width / W), y: (e.clientY - r.top) / (r.height / H) };
  }
  function init() {
    canvas = document.getElementById('game'); ctx = canvas.getContext('2d'); resize(); window.addEventListener('resize', resize);
    window.addEventListener('keydown', e => {
      keys[e.key.toLowerCase()] = true;
      if (S.mode === 'upgrade' && (e.key === '1' || e.key === '2')) applyUpgrade(e.key === '1' ? 'line' : 'speed');
      else if (S.mode !== 'play' && S.mode !== 'upgrade' && (e.key === 'Enter' || e.key === ' ')) start();
    });
    window.addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });
    canvas.addEventListener('pointerdown', e => {
      e.preventDefault(); const p = point(e);
      if (S.mode === 'upgrade') {
        const choice = upgradeRects().find(r => p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h);
        if (choice) applyUpgrade(choice.kind);
        return;
      }
      if (S.mode !== 'play') { start(); return; }
      if (joy.active || p.y < H * 0.32) return;
      joy.active = true; joy.id = e.pointerId; joy.bx = p.x; joy.by = p.y; joy.dx = joy.dy = 0;
      if (canvas.setPointerCapture) try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
    });
    canvas.addEventListener('pointermove', e => {
      if (!joy.active || e.pointerId !== joy.id) return; const p = point(e), max = 42;
      let dx = p.x - joy.bx, dy = p.y - joy.by, d = Math.hypot(dx, dy); if (d > max) { dx = dx / d * max; dy = dy / d * max; }
      joy.dx = dx / max; joy.dy = dy / max;
    });
    const end = e => { if (joy.active && e.pointerId === joy.id) { joy.active = false; joy.dx = joy.dy = 0; } };
    canvas.addEventListener('pointerup', end); canvas.addEventListener('pointercancel', end);
    reset('start');
    if (new URLSearchParams(location.search).has('play')) start();
    requestAnimationFrame(function loop(now) { const dt = Math.min(0.04, (now - last) / 1000 || 0.016); last = now; update(dt); render(now); requestAnimationFrame(loop); });
  }
  const api = { segmentIntersection, polygonArea, pointInPolygon, distToSegment, findLoop, performCut, spawnEnemy, update, start, reset,
    trailLength, keepTrailLength, shortenTrail, applyUpgrade,
    debug: { S, player, joy, get enemies() { return enemies; }, set enemies(v) { enemies = v; }, get trail() { return trail; }, set trail(v) { trail = v; },
      get cutouts() { return cutouts; }, get dolls() { return dolls; }, get notices() { return notices; } } };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') { window.PaperCut = api; window.addEventListener('DOMContentLoaded', init); }
})();

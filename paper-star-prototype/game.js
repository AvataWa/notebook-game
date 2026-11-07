(() => {
  'use strict';
  const W = 375, H = 667, ARENA = { x: 17, y: 102, w: 341, h: 448 };
  const C = { desk: '#302b27', paper: '#f5f1e6', paper2: '#e9e1d1', ink: '#1c2d78', red: '#c14b3f', teal: '#5f9890', amber: '#d8a64b', gray: '#817b70', line: '#b8cfce', ice: '#7ec8e3', thunder: '#5b5bd6', fire: '#e67e22' };
  const FONT = '"Segoe Print","PingFang SC","Microsoft YaHei",sans-serif';
  const SLOT_NAME = { head: '头部', body: '躯干', left: '左手', right: '右手', leg: '腿部' };
  const PARTS = {
    arc:     { slot: 'head',  name: '电弧荧光笔', short: '电弧', pen: '行笔', attr: 'thunder', status: null },
    candle:  { slot: 'head',  name: '蜡烛头',     short: '蜡烛', pen: '起笔', attr: 'fire',    status: 'burn' },
    inkrain: { slot: 'body',  name: '毒墨雨',     short: '墨雨', pen: '起笔', attr: 'fire',    status: 'ink' },
    cyclone: { slot: 'body',  name: '旋转蜡笔',   short: '蜡笔', pen: '行笔', attr: 'phys',    status: null },
    imps:    { slot: 'left',  name: '涂鸦小鬼',   short: '小鬼', pen: '行笔', attr: 'phys',    status: null },
    plane:   { slot: 'right', name: '分叉纸飞机', short: '飞机', pen: '收笔', attr: 'ice',     status: null },
    volcano: { slot: 'right', name: '火山压痕',   short: '火山', pen: '收笔', attr: 'fire',    status: null },
    spring:  { slot: 'leg',   name: '弹簧腿',     short: '弹簧', pen: '移动', attr: 'phys',    status: null }
  };
  const STAR_MUL = [0, 1, 1.65, 2.65];
  const S = { mode: 'start', time: 0, hp: 100, level: 1, xp: 0, xpNeed: 6, kills: 0, score: 0, castT: 0.3, orderIndex: 0, combo: '' };
  const player = { x: 188, y: 330, r: 10, speed: 142, face: 0, walk: 0, inv: 0 };
  const joy = { active: false, id: -1, bx: 0, by: 0, dx: 0, dy: 0 };
  const keys = {}, order = ['body', 'head', 'right', 'left'];
  let equipped = {}, bench = [], choices = [], selection = null, history = [];
  let enemies = [], bullets = [], zones = [], minions = [], effects = [], floats = [], notices = [];
  let spawnT = 0, nextId = 1, nextUid = 1, last = 0, boil = 0;
  let dockAnimations = [], planeAction = -10;

  function makePart(id, star = 1) { return { uid: nextUid++, id, star }; }
  function queueDock(slot, delay = 0) {
    const part = equipped[slot]; if (!part) return;
    dockAnimations = dockAnimations.filter(a => a.slot !== slot);
    dockAnimations.push({ slot, uid: part.uid, start: boil + delay, duration: 0.62 });
  }
  function queueFullAssembly() {
    dockAnimations = [];
    ['body', 'head', 'left', 'right', 'leg'].forEach((slot, i) => queueDock(slot, 0.12 + i * 0.18));
  }
  function reset(mode = 'start') {
    Object.assign(S, { mode, time: 0, hp: 100, level: 1, xp: 0, xpNeed: 6, kills: 0, score: 0, castT: 1.65, orderIndex: 0, combo: '' });
    Object.assign(player, { x: 188, y: 330, speed: 142, face: 0, walk: 0, inv: 0 });
    equipped = { head: makePart('arc'), body: makePart('inkrain'), left: makePart('imps'), right: makePart('plane'), leg: makePart('spring') };
    bench = []; choices = []; selection = null; history = []; order.splice(0, 4, 'body', 'head', 'right', 'left');
    enemies = []; bullets = []; zones = []; minions = []; effects = []; floats = []; notices = []; spawnT = 0; joy.active = false; joy.dx = joy.dy = 0;
    dockAnimations = []; planeAction = -10;
  }
  function start() { reset('play'); for (let i = 0; i < 6; i++) spawnEnemy(); queueFullAssembly(); }
  function notice(text, color = C.ink) { notices.unshift({ text, color, t: 1.6 }); notices.length = Math.min(3, notices.length); }
  function mergeParts() {
    for (let star = 1; star <= 2; star++) {
      for (const id of Object.keys(PARTS)) {
        const entries = [];
        for (const slot of Object.keys(equipped)) {
          const p = equipped[slot]; if (p && p.id === id && p.star === star) entries.push({ where: 'equipped', slot, uid: p.uid });
        }
        bench.forEach((p, index) => { if (p.id === id && p.star === star) entries.push({ where: 'bench', index, uid: p.uid }); });
        if (entries.length < 3) continue;
        const used = entries.slice(0, 3), target = used.find(e => e.where === 'equipped');
        const usedIds = used.map(e => e.uid);
        bench = bench.filter(p => !usedIds.includes(p.uid));
        const upgraded = makePart(id, star + 1);
        if (target) { equipped[target.slot] = upgraded; queueDock(target.slot); } else bench.push(upgraded);
        notice(`${SLOT_NAME[PARTS[id].slot]}·${PARTS[id].short} 升到 ${star + 1} 星！`, C.amber);
        effects.push({ kind: 'level', x: player.x, y: player.y, t: 0.8, max: 0.8, col: C.amber });
        return true;
      }
    }
    return false;
  }
  function addPart(id) {
    if (!PARTS[id]) return false;
    bench.push(makePart(id));
    while (mergeParts()) {}
    while (bench.length > 6) { bench.shift(); S.score += 50; notice('候补已满，最旧部件化为 50 分', C.gray); }
    return true;
  }
  function swapEquipBench(slot, index) {
    const bp = bench[index], ep = equipped[slot];
    if (!bp || !ep || PARTS[bp.id].slot !== slot) return false;
    equipped[slot] = bp; bench[index] = ep; queueDock(slot);
    while (mergeParts()) {}
    return true;
  }
  function swapOrder(i, j) {
    if (i === j || !order[i] || !order[j]) return false;
    [order[i], order[j]] = [order[j], order[i]]; return true;
  }
  function buildChoices() {
    const owned = new Set([...Object.values(equipped).map(p => p.id), ...bench.map(p => p.id)]);
    choices = Object.keys(PARTS).map(id => ({ id, w: Math.random() + (owned.has(id) ? 0.72 : 0) }))
      .sort((a, b) => b.w - a.w).slice(0, 3).map(x => x.id);
  }
  function chooseOption(i) { if (S.mode !== 'levelup' || !choices[i]) return false; addPart(choices[i]); S.mode = 'play'; return true; }
  function gainKill(e) {
    S.kills++; S.score += 10; S.xp++;
    if (S.xp >= S.xpNeed && S.mode === 'play') {
      S.xp -= S.xpNeed; S.level++; S.xpNeed = 6 + S.level * 3; buildChoices(); S.mode = 'levelup';
    }
  }
  function spawnEnemy() {
    const side = Math.floor(Math.random() * 4), m = 18; let x, y;
    if (side < 2) { x = side ? ARENA.x + ARENA.w - m : ARENA.x + m; y = ARENA.y + m + Math.random() * (ARENA.h - 2 * m); }
    else { x = ARENA.x + m + Math.random() * (ARENA.w - 2 * m); y = side === 2 ? ARENA.y + m : ARENA.y + ARENA.h - m; }
    const hp = 24 + S.time * 0.45;
    enemies.push({ id: nextId++, x, y, r: 10, hp, maxhp: hp, speed: 37 + Math.random() * 17 + Math.min(15, S.time * 0.12), walk: Math.random() * 6, status: null, statusT: 0, dead: false });
  }
  function nearest(x, y, range = 1e9, excluded = []) {
    let best = null, bd = range * range;
    for (const e of enemies) {
      if (e.dead || excluded.includes(e)) continue;
      const d2 = (e.x - x) ** 2 + (e.y - y) ** 2;
      if (d2 < bd) { bd = d2; best = e; }
    }
    return best;
  }
  function applyStatus(e, status) { if (status && !e.dead) { e.status = status; e.statusT = 4; } }
  function hurt(e, dmg, attr = 'phys') {
    if (!e || e.dead) return;
    e.hp -= dmg; e.flash = 0.12;
    floats.push({ x: e.x + (Math.random() - 0.5) * 20, y: e.y - 15, txt: Math.round(dmg), t: 0.65, col: C[attr] || C.gray });
    effects.push({ kind: 'hit', x: e.x, y: e.y, t: 0.16, max: 0.16, col: C[attr] || C.gray });
    if (e.hp <= 0) { e.dead = true; gainKill(e); }
  }
  function areaDamage(x, y, r, dmg, attr, status) {
    const donor = enemies.find(e => !e.dead && e.status);
    for (const e of enemies) if (!e.dead && Math.hypot(e.x - x, e.y - y) < r + e.r) { hurt(e, dmg, attr); applyStatus(e, status || (donor && donor.status)); }
  }
  function triggerCombo(start, middle, finisher) {
    if (!start || !middle || start.pen !== '起笔' || middle.pen !== '行笔' || finisher.pen !== '收笔') return null;
    const status = start.status; if (!status) return null;
    let name = status === 'burn' ? '燎原连爆' : (finisher.attr === 'ice' ? '碎墨处决' : '墨火爆破');
    const targets = enemies.filter(e => !e.dead && e.status === status);
    for (const e of targets) {
      effects.push({ kind: 'ring', x: e.x, y: e.y, t: 0.45, max: 0.45, col: finisher.attr === 'ice' ? C.ice : C.fire });
      hurt(e, 24 * finisher.star + 10 * middle.star, finisher.attr); e.status = null; e.statusT = 0;
    }
    S.combo = name; notice(`连携·${name}！${targets.length ? ' ×' + targets.length : ''}`, C.amber);
    return name;
  }
  function castSlot(slot) {
    const part = equipped[slot]; if (!part) return false;
    const def = PARTS[part.id], star = part.star, mul = STAR_MUL[star];
    const previous = history.slice(-2);
    if (part.id === 'inkrain') {
      const t = nearest(player.x, player.y, 360) || player;
      zones.push({ kind: 'ink', x: t.x, y: t.y, r: 58 + star * 13, t: 3.2 + star * 0.6, tick: 0, dmg: 5 * mul, status: 'ink' });
    } else if (part.id === 'candle') {
      zones.push({ kind: 'candle', x: player.x, y: player.y, r: 75 + star * 12, t: 2.4 + star * 0.5, tick: 0, dmg: 6 * mul, status: 'burn', follow: true });
    } else if (part.id === 'cyclone') {
      const r = 70 + star * 18; areaDamage(player.x, player.y, r, 13 * mul, 'phys');
      effects.push({ kind: 'ring', x: player.x, y: player.y, t: 0.4, max: 0.4, col: C.gray, r });
    } else if (part.id === 'arc') {
      let cur = nearest(player.x, player.y, 320), sx = player.x, sy = player.y, donor = null;
      const hit = [];
      for (let j = 0; cur && j < 2 + star * 2; j++) {
        if (!j) donor = cur.status; hurt(cur, 13 * mul, 'thunder'); if (donor) applyStatus(cur, donor);
        effects.push({ kind: 'bolt', x1: sx, y1: sy, x2: cur.x, y2: cur.y, t: 0.22, max: 0.22, col: C.thunder });
        hit.push(cur); sx = cur.x; sy = cur.y; cur = nearest(sx, sy, 155 + star * 15, hit);
      }
    } else if (part.id === 'imps') {
      for (let i = 0; i < star; i++) minions.push({ x: player.x + (i - (star - 1) / 2) * 14, y: player.y + 12, life: 4 + star * 1.5, dmg: 8 * mul, star, hitCd: 0, walk: i });
    } else if (part.id === 'plane') {
      planeAction = boil;
      const t = nearest(player.x, player.y, 400);
      if (t) for (let i = 0; i < star; i++) {
        const a = Math.atan2(t.y - player.y, t.x - player.x) + (i - (star - 1) / 2) * 0.2;
        bullets.push({ kind: 'plane', x: player.x, y: player.y, vx: Math.cos(a) * 250, vy: Math.sin(a) * 250, dmg: 18 * mul, life: 2.2, pierce: star, attr: 'ice' });
      }
    } else if (part.id === 'volcano') {
      const t = nearest(player.x, player.y, 360) || player, r = 55 + star * 17;
      areaDamage(t.x, t.y, r, 24 * mul, 'fire'); effects.push({ kind: 'ring', x: t.x, y: t.y, t: 0.5, max: 0.5, col: C.fire, r });
    }
    triggerCombo(previous[0] && { pen: PARTS[previous[0].id].pen, status: PARTS[previous[0].id].status },
      previous[1] && { pen: PARTS[previous[1].id].pen }, { pen: def.pen, attr: def.attr, star });
    history.push({ id: part.id, star }); if (history.length > 3) history.shift();
    return true;
  }
  function update(dt) {
    if (S.mode !== 'play') return;
    dt = Math.min(0.04, dt); S.time += dt; player.inv = Math.max(0, player.inv - dt);
    let mx = 0, my = 0;
    if (keys.w || keys.arrowup) my--; if (keys.s || keys.arrowdown) my++;
    if (keys.a || keys.arrowleft) mx--; if (keys.d || keys.arrowright) mx++;
    if (joy.active) { mx = joy.dx; my = joy.dy; }
    const ml = Math.hypot(mx, my), legStar = equipped.leg ? equipped.leg.star : 1;
    if (ml > 0) {
      mx /= ml; my /= ml; const speed = player.speed * (1 + 0.08 * (legStar - 1));
      player.x += mx * speed * dt; player.y += my * speed * dt; player.face = Math.atan2(my, mx); player.walk += dt * 11;
      player.x = Math.max(ARENA.x + 14, Math.min(ARENA.x + ARENA.w - 14, player.x));
      player.y = Math.max(ARENA.y + 14, Math.min(ARENA.y + ARENA.h - 14, player.y));
    }
    spawnT -= dt; if (spawnT <= 0 && enemies.length < 48) { spawnT = Math.max(0.4, 1.2 - S.time * 0.009); spawnEnemy(); }
    S.castT -= dt;
    if (S.castT <= 0) { S.castT = 0.82; castSlot(order[S.orderIndex]); S.orderIndex = (S.orderIndex + 1) % order.length; }
    for (const z of zones) {
      z.t -= dt; z.tick -= dt; if (z.follow) { z.x = player.x; z.y = player.y; }
      if (z.tick <= 0) { z.tick = 0.5; areaDamage(z.x, z.y, z.r, z.dmg, z.kind === 'candle' ? 'fire' : 'phys', z.status); }
    }
    zones = zones.filter(z => z.t > 0);
    for (const b of bullets) {
      b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
      for (const e of enemies) if (!e.dead && !b.dead && Math.hypot(e.x - b.x, e.y - b.y) < e.r + 7) {
        hurt(e, b.dmg, b.attr); b.pierce--; if (b.pierce < 0) b.dead = true;
      }
    }
    bullets = bullets.filter(b => b.life > 0 && !b.dead);
    for (const m of minions) {
      m.life -= dt; m.hitCd -= dt; m.walk += dt * 9;
      const t = nearest(m.x, m.y, 400);
      if (t) { const dx = t.x - m.x, dy = t.y - m.y, d = Math.hypot(dx, dy) || 1; m.x += dx / d * 125 * dt; m.y += dy / d * 125 * dt;
        if (d < t.r + 11 && m.hitCd <= 0) { m.hitCd = 0.55; hurt(t, m.dmg, 'phys'); const donor = enemies.find(e => !e.dead && e.status); if (donor) applyStatus(t, donor.status); } }
    }
    minions = minions.filter(m => m.life > 0);
    for (const e of enemies) {
      e.walk += dt * 8; e.flash = Math.max(0, (e.flash || 0) - dt); e.statusT -= dt; if (e.statusT <= 0) e.status = null;
      const dx = player.x - e.x, dy = player.y - e.y, d = Math.hypot(dx, dy) || 1;
      e.x += dx / d * e.speed * dt; e.y += dy / d * e.speed * dt;
      if (player.inv <= 0 && d < e.r + player.r) { S.hp -= 9; player.inv = 0.9; player.x -= dx / d * 16; player.y -= dy / d * 16; notice('纸人受击！', C.red); }
    }
    enemies = enemies.filter(e => !e.dead);
    for (const e of effects) e.t -= dt; effects = effects.filter(e => e.t > 0);
    for (const f of floats) { f.t -= dt; f.y -= 22 * dt; } floats = floats.filter(f => f.t > 0);
    for (const n of notices) n.t -= dt; notices = notices.filter(n => n.t > 0);
    if (S.hp <= 0 || S.time >= 90) S.mode = S.hp > 0 ? 'win' : 'over';
  }

  const api = {
    PARTS, addPart, mergeParts, swapEquipBench, swapOrder, castSlot, triggerCombo, start, reset, update, chooseOption, buildChoices,
    debug: {
      get S() { return S; }, get player() { return player; }, get order() { return order; },
      get equipped() { return equipped; }, set equipped(v) { equipped = v; },
      get bench() { return bench; }, set bench(v) { bench = v; },
      get enemies() { return enemies; }, set enemies(v) { enemies = v; },
      get choices() { return choices; }, get history() { return history; }, set history(v) { history = v; },
      get zones() { return zones; }, get bullets() { return bullets; }, get minions() { return minions; }
    }
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.PaperStar = api;
  if (typeof document === 'undefined') return;

  const canvas = document.getElementById('game'), ctx = canvas.getContext('2d');
  const SPRITES = {};
  for (const id of ['arc', 'inkrain', 'imps', 'plane', 'spring']) {
    const image = new Image(); image.src = `assets/${id}.png`; SPRITES[id] = image;
  }
  let viewScale = 1, viewLeft = 0, viewTop = 0;
  const ATTR = { phys: '物理', fire: '火', ice: '冰', thunder: '雷' };
  const EQUIP_SLOTS = ['head', 'body', 'left', 'right', 'leg'];
  const equipRects = EQUIP_SLOTS.map((slot, i) => ({ kind: 'equip', slot, x: 13 + i * 70, y: 148, w: 64, h: 79 }));
  const benchRects = Array.from({ length: 6 }, (_, i) => ({ kind: 'bench', index: i, x: 40 + (i % 3) * 100, y: 323 + Math.floor(i / 3) * 84, w: 94, h: 70 }));
  const orderRects = order.map((_, i) => ({ kind: 'order', index: i, x: 20 + i * 86, y: 510, w: 78, h: 61 }));
  const battleRects = order.map((_, i) => ({ x: 78 + i * 72, y: 574, w: 66, h: 70 }));
  const choiceRects = [0, 1, 2].map(i => ({ x: 37, y: 181 + i * 123, w: 301, h: 104 }));

  function resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = W * dpr; canvas.height = H * dpr;
    viewScale = Math.min(innerWidth / W, innerHeight / H);
    const cw = W * viewScale, ch = H * viewScale;
    viewLeft = (innerWidth - cw) / 2; viewTop = (innerHeight - ch) / 2;
    canvas.style.width = cw + 'px'; canvas.style.height = ch + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  function line(x1, y1, x2, y2, color = C.ink, width = 1.5) {
    ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  }
  function roughLine(x1, y1, x2, y2, color = C.ink, width = 1.5) {
    const mx = (x1 + x2) / 2 + Math.sin(boil * 7 + x1) * 0.7, my = (y1 + y2) / 2 + Math.cos(boil * 5 + y1) * 0.7;
    ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.quadraticCurveTo(mx, my, x2, y2); ctx.stroke();
  }
  function circle(x, y, r, color = C.ink, fill = null, width = 1.5) {
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); if (fill) { ctx.fillStyle = fill; ctx.fill(); } ctx.strokeStyle = color; ctx.lineWidth = width; ctx.stroke();
  }
  function text(str, x, y, size = 12, color = C.ink, align = 'left', weight = '400') {
    ctx.font = `${weight} ${size}px ${FONT}`; ctx.textAlign = align; ctx.textBaseline = 'middle'; ctx.fillStyle = color; ctx.fillText(str, x, y);
  }
  function rect(x, y, w, h, fill, stroke = null, width = 1.5) {
    if (fill) { ctx.fillStyle = fill; ctx.fillRect(x, y, w, h); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = width; ctx.strokeRect(x, y, w, h); }
  }
  function button(label, x, y, w, h, primary = false) {
    rect(x + 2, y + 3, w, h, 'rgba(28,45,120,.12)'); rect(x, y, w, h, primary ? C.ink : C.paper, C.ink, 1.5);
    text(label, x + w / 2, y + h / 2 + 1, 15, primary ? C.paper : C.ink, 'center', '700');
  }
  function paper() {
    rect(0, 0, W, H, C.desk);
    for (let i = 0; i < 70; i++) {
      const x = (i * 97) % W, y = (i * 53) % H; line(x, y, x + 5, y + 1, 'rgba(245,241,230,.035)', 1);
    }
    rect(8, 6, 359, 655, C.paper);
    for (let y = 30; y < H; y += 24) line(9, y, 366, y, 'rgba(95,152,144,.18)', 1);
    line(34, 7, 34, 660, 'rgba(193,75,63,.22)', 1);
    for (let y = 20; y < H; y += 44) { circle(14, y, 4, '#a9a397', C.desk, 1); circle(14, y, 2, '#171512', null, 1); }
  }
  function stars(n, x, y, size = 9) { text('★'.repeat(n), x, y, size, C.amber, 'center', '700'); }
  function poly(points, fill, stroke = C.ink, width = 1.4) {
    ctx.beginPath(); points.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); } if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = width; ctx.lineJoin = 'round'; ctx.stroke(); }
  }
  function joint(x, y, r, color = C.teal) {
    circle(x, y, r, C.ink, color, 1.4); circle(x, y, r * .38, C.ink, C.paper, 1);
  }
  function proceduralPartIcon(part, x, y, scale = 1) {
    if (!part) { text('＋', x, y, 22, '#a8a294', 'center'); return; }
    const id = part.id, star = part.star; ctx.save(); ctx.translate(x, y); ctx.scale(scale, scale);
    if (id === 'arc' || id === 'candle') {
      const main = id === 'arc' ? '#4c70a8' : '#cf6654';
      poly([[-12, 5], [-13, -7], [-7, -15], [7, -15], [13, -7], [12, 6], [7, 11], [-7, 11]], main, C.ink, 1.7);
      circle(0, -2, 8, C.ink, C.paper, 1.4); joint(-12, -1, 3.5, C.teal); joint(12, -1, 3.5, C.teal);
      if (id === 'arc') { poly([[-3, -15], [0, -23], [4, -15]], C.amber, C.ink, 1.2); roughLine(-2, -4, 1, -8, C.thunder, 1.5); roughLine(1, -8, 0, -2, C.thunder, 1.5); }
      else { ctx.fillStyle = C.fire; ctx.beginPath(); ctx.moveTo(0, -25); ctx.quadraticCurveTo(9, -16, 0, -13); ctx.quadraticCurveTo(-7, -18, 0, -25); ctx.fill(); }
      if (star > 1) { line(-8, -13, 7, -13, C.amber, 2); }
      if (star > 2) { poly([[-12, -9], [-19, -17], [-14, -3]], C.amber, C.ink, 1.2); poly([[12, -9], [19, -17], [14, -3]], C.amber, C.ink, 1.2); }
    } else if (id === 'inkrain' || id === 'cyclone') {
      const main = id === 'inkrain' ? C.teal : '#c85e50';
      poly([[-16, -12], [-7, -16], [7, -16], [16, -12], [12, 11], [5, 16], [-5, 16], [-12, 11]], main, C.ink, 1.8);
      joint(-16, -8, 4, C.amber); joint(16, -8, 4, C.amber);
      poly([[-7, -8], [7, -8], [0, 6]], C.amber, C.ink, 1.2);
      if (id === 'inkrain') { for (let i = -1; i <= 1; i++) { rect(i * 7 - 2, 10, 4, 4, C.ink); roughLine(i * 7, 16, i * 7 - 2, 21, C.thunder, 1.4); } }
      else { ctx.strokeStyle = C.paper; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, 12, boil, boil + 4.7); ctx.stroke(); }
      if (star > 1) { poly([[-14, -13], [-20, -8], [-15, 1], [-10, -5]], '#547fa1', C.ink, 1.2); poly([[14, -13], [20, -8], [15, 1], [10, -5]], '#547fa1', C.ink, 1.2); }
      if (star > 2) { line(-8, 12, 8, 12, C.paper, 2); joint(0, -11, 2.5, C.paper); }
    } else if (id === 'imps') {
      poly([[-13, -9], [3, -12], [11, -6], [8, 7], [-9, 10], [-15, 3]], '#5b9e96', C.ink, 1.7);
      joint(-10, 0, 4, C.amber); circle(5, -2, 3, C.ink, C.paper, 1.2);
      poly([[8, -5], [17, -13], [20, -9], [13, 0]], C.teal, C.ink, 1.4); poly([[9, 4], [19, 10], [16, 14], [7, 8]], C.teal, C.ink, 1.4);
      if (star > 1) poly([[-8, -10], [-4, -18], [2, -12]], C.amber, C.ink, 1.1);
      if (star > 2) { joint(18, 1, 3, C.red); line(-8, 5, 4, 5, C.paper, 1.4); }
    } else if (id === 'plane') {
      poly([[-17, -8], [5, -11], [15, -4], [12, 8], [-11, 11], [-18, 4]], '#5079a7', C.ink, 1.7);
      joint(-11, 1, 4, C.amber); poly([[0, -8], [21, -1], [1, 7], [6, 0]], '#d7edf0', C.ink, 1.4); line(6, 0, 21, -1, C.ice, 1.5);
      if (star > 1) poly([[-8, -10], [-2, -18], [8, -10]], C.amber, C.ink, 1.1);
      if (star > 2) { poly([[-6, 10], [2, 17], [9, 8]], C.ice, C.ink, 1.1); joint(12, 2, 2.5, C.red); }
    } else if (id === 'volcano') {
      poly([[-16, -11], [4, -13], [14, -5], [13, 10], [-9, 12], [-17, 4]], '#c85e50', C.ink, 1.8);
      for (let i = 0; i < 3; i++) rect(-5 + i * 6, -9, 4, 17, '#e7a091', C.ink, 1);
      joint(-12, 0, 4, C.amber);
      roughLine(-4, -13, -7, -21, C.fire, 2); roughLine(3, -13, 4, -23, C.fire, 2); roughLine(9, -11, 14, -18, C.fire, 2);
      if (star > 1) poly([[-9, 10], [12, 8], [8, 16], [-6, 17]], C.amber, C.ink, 1.2);
      if (star > 2) { joint(15, 2, 3.5, C.red); line(-3, -5, 8, -5, C.paper, 1.5); }
    } else if (id === 'spring') {
      poly([[-10, -16], [7, -16], [10, -10], [-8, -7]], '#517aa5', C.ink, 1.6);
      ctx.beginPath(); ctx.moveTo(0, -8); for (let i = 0; i < 6; i++) ctx.lineTo(i % 2 ? -6 : 6, -5 + i * 4); ctx.strokeStyle = C.ink; ctx.lineWidth = 2; ctx.stroke();
      poly([[-10, 14], [7, 12], [16, 19], [13, 24], [-12, 24]], C.amber, C.ink, 1.7); joint(6, 19, 3, C.red);
      if (star > 1) { line(-8, -12, 6, -12, C.paper, 1.5); rect(-12, 21, 26, 4, '#517aa5', C.ink, 1); }
      if (star > 2) { poly([[-10, 13], [-16, 7], [-13, 20]], C.teal, C.ink, 1.1); }
    }
    ctx.restore();
  }
  function spriteReady(id) { const im = SPRITES[id]; return im && im.complete && im.naturalWidth > 0; }
  function drawSprite(id, x, y, height, options = {}) {
    const im = SPRITES[id]; if (!spriteReady(id)) return false;
    const scale = height / im.naturalHeight, w = im.naturalWidth * scale;
    ctx.save(); ctx.translate(x, y); ctx.rotate((options.angle || 0) * Math.PI / 180);
    ctx.scale((options.mirror ? -1 : 1) * (options.xscale || 1), options.yscale || 1);
    ctx.globalAlpha *= options.alpha ?? 1;
    ctx.drawImage(im, -w / 2, -height / 2, w, height); ctx.restore(); return true;
  }
  function partIcon(part, x, y, scale = 1) {
    if (part && spriteReady(part.id)) {
      const h = 36 * (.9 + part.star * .05);
      drawSprite(part.id, x, y, h * scale, { alpha: .96 });
      if (part.star > 1) {
        ctx.save(); ctx.strokeStyle = C.amber; ctx.lineWidth = 1; ctx.setLineDash([2, 3]);
        ctx.beginPath(); ctx.arc(x, y, (18 + part.star * 2) * scale, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
      }
      return;
    }
    proceduralPartIcon(part, x, y, scale);
  }
  function drawEquippedPart(slot, part, x, y, height, options = {}, preview = false) {
    if (!part) return;
    let p = 1, anim = null;
    if (!preview) {
      anim = dockAnimations.find(a => a.slot === slot && a.uid === part.uid);
      if (anim) p = Math.max(0, Math.min(1, (boil - anim.start) / anim.duration));
    }
    const eased = 1 - (1 - p) ** 3;
    const offsets = { head: [0, -85], body: [-75, -45], left: [-80, 5], right: [85, -35], leg: [0, 85] };
    const off = offsets[slot] || [0, 0];
    const dx = off[0] * (1 - eased), dy = off[1] * (1 - eased);
    const angle = (options.angle || 0) + (slot === 'right' ? 100 : -90) * (1 - eased);
    const alpha = .25 + eased * .75;
    if (spriteReady(part.id)) {
      drawSprite(part.id, x + dx, y + dy, height * (.9 + part.star * .05), { ...options, angle, alpha });
    } else {
      ctx.save(); ctx.translate(x + dx, y + dy); ctx.rotate(angle * Math.PI / 180); ctx.globalAlpha *= alpha;
      proceduralPartIcon(part, 0, 0, .58); ctx.restore();
    }
    if (anim && p > .72 && p < 1) {
      const radius = 14 + (1 - p) * 70;
      for (let i = 0; i < 7; i++) { const a = i * Math.PI * 2 / 7; line(x + Math.cos(a) * 9, y + Math.sin(a) * 9, x + Math.cos(a) * radius, y + Math.sin(a) * radius, C.amber, 1.2); }
    }
  }
  function drawPlayer(x, y, scale = 1, preview = false) {
    ctx.save(); ctx.translate(x, y); ctx.scale(scale, scale);
    if (player.inv > 0 && !preview && Math.floor(player.inv * 15) % 2) ctx.globalAlpha = .4;
    const head = equipped.head, body = equipped.body, leg = equipped.leg;
    const moving = !preview && (joy.active || keys.w || keys.a || keys.s || keys.d || keys.arrowup || keys.arrowdown || keys.arrowleft || keys.arrowright);
    const walk = preview ? 0 : Math.sin(player.walk) * 2;
    const bob = preview ? 0 : (moving ? -Math.abs(Math.sin(player.walk * .55)) * 2.2 : Math.sin(boil * 3) * .35);
    ctx.translate(0, bob);
    if (body && body.id === 'inkrain') {
      ctx.save(); ctx.globalAlpha *= .09 + body.star * .02; circle(0, -12, 25 + body.star * 2, C.thunder, C.thunder, 1); ctx.restore();
    }
    if (body && body.id === 'cyclone') {
      ctx.strokeStyle = C.red; ctx.lineWidth = 1.5 + body.star * .35; ctx.setLineDash([6, 4]); ctx.beginPath(); ctx.arc(0, -1, 23 + body.star * 2, boil, boil + 5.4); ctx.stroke(); ctx.setLineDash([]);
    }
    // Exposed notebook stick figure behind the independent sprite modules.
    circle(0, -24, 8, C.ink, C.paper, 1.8);
    roughLine(0, -13, 0, 10, C.ink, 2.3);
    roughLine(0, -7, -17, 1 + walk * .2, C.ink, 2); roughLine(0, -7, 17, 1 - walk * .2, C.ink, 2);
    roughLine(-3, 8, -7, 25, C.ink, 2); roughLine(3, 8, 7, 25, C.ink, 2);
    circle(-2.7, -25, .9, C.ink, C.ink, 1); circle(2.7, -25, .9, C.ink, C.ink, 1); roughLine(-2.5, -20, 2.5, -20, C.ink, 1);
    const legFlex = preview ? 1 : 1 + Math.sin(player.walk * 1.1) * (moving ? .1 : .025);
    drawEquippedPart('leg', leg, -7, 18, 36, { yscale: legFlex }, preview);
    drawEquippedPart('leg', leg, 7, 18, 36, { mirror: true, yscale: 2 - legFlex }, preview);
    drawEquippedPart('left', equipped.left, -18, 1 + walk * .2, 34, { mirror: true }, preview);
    let planeWave = 0;
    if (!preview && equipped.right && equipped.right.id === 'plane') {
      const actionT = Math.max(0, Math.min(1, (boil - planeAction) / .58)); planeWave = Math.sin(actionT * Math.PI);
    }
    drawEquippedPart('right', equipped.right, 19 + planeWave * -3, 0 - walk * .2, 38, { angle: -15 * planeWave, xscale: 1 + planeWave * .16, yscale: 1 - planeWave * .06 }, preview);
    drawEquippedPart('body', body, 0, -2, 33, {}, preview);
    drawEquippedPart('head', head, 0, -25, 42, {}, preview);
    if (!preview) { const maxStar = Math.max(...Object.values(equipped).map(p => p.star)); if (maxStar > 1) stars(maxStar, 0, -54, 9); }
    ctx.restore();
  }
  function drawEnemy(e) {
    ctx.save(); ctx.translate(e.x, e.y); if (e.flash) ctx.scale(1.18, .78);
    const w = Math.sin(e.walk) * 2;
    roughLine(-4, 5, -7 + w, 15, C.red, 2); roughLine(4, 5, 7 - w, 15, C.red, 2); roughLine(0, -4, 0, 7, C.red, 2);
    roughLine(0, -1, -9, 5, C.red, 1.5); roughLine(0, -1, 9, 4, C.red, 1.5); circle(0, -9, 7, C.red, e.flash ? C.paper : '#ead9cc', 2);
    roughLine(-5, -14, -9, -19, C.red, 2); roughLine(5, -14, 9, -19, C.red, 2); line(-4, -10, -1, -8, C.red, 1.4); line(4, -10, 1, -8, C.red, 1.4);
    if (e.status) { text(e.status === 'burn' ? '燃' : '墨', 0, -27, 9, e.status === 'burn' ? C.fire : C.thunder, 'center', '700'); }
    ctx.restore();
    if (e.hp < e.maxhp) { rect(e.x - 10, e.y + 19, 20, 2, '#d9c6bd'); rect(e.x - 10, e.y + 19, 20 * Math.max(0, e.hp / e.maxhp), 2, C.red); }
  }
  function drawArena() {
    ctx.save(); ctx.beginPath(); ctx.rect(ARENA.x, ARENA.y, ARENA.w, ARENA.h); ctx.clip();
    rect(ARENA.x, ARENA.y, ARENA.w, ARENA.h, 'rgba(255,255,255,.18)');
    for (const z of zones) {
      ctx.globalAlpha = Math.min(.2, z.t * .08); circle(z.x, z.y, z.r, z.kind === 'candle' ? C.fire : C.thunder, z.kind === 'candle' ? C.fire : C.thunder, 2); ctx.globalAlpha = 1;
      ctx.setLineDash([5, 5]); circle(z.x, z.y, z.r, z.kind === 'candle' ? C.fire : C.thunder, null, 1.4); ctx.setLineDash([]);
      if (z.kind === 'ink') for (let i = 0; i < 8; i++) { const a = i * 2.4 + boil; roughLine(z.x + Math.sin(a) * z.r * .6, z.y - z.r * .7 + (i * 17 + boil * 25) % (z.r * 1.4), z.x + Math.sin(a) * z.r * .6 - 3, z.y - z.r * .5 + (i * 17 + boil * 25) % (z.r * 1.4), C.thunder, 1.3); }
    }
    for (const m of minions) partIcon({ id: 'imps', star: m.star }, m.x, m.y, .55);
    for (const b of bullets) {
      ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(Math.atan2(b.vy, b.vx));
      poly([[-9, -5], [11, 0], [-8, 6], [-3, 1]], '#d8edf0', C.ink, 1.2); line(-3, 1, 11, 0, C.ice, 1.2);
      roughLine(-15, 0, -10, 0, C.ice, 1.2); ctx.restore();
    }
    for (const e of enemies) drawEnemy(e);
    drawPlayer(player.x, player.y);
    for (const fx of effects) {
      const p = fx.t / fx.max;
      if (fx.kind === 'hit') {
        ctx.strokeStyle = fx.col; ctx.lineWidth = 1.5; for (let i = 0; i < 7; i++) { const a = i * Math.PI * 2 / 7; line(fx.x + Math.cos(a) * 4, fx.y + Math.sin(a) * 4, fx.x + Math.cos(a) * (15 - p * 5), fx.y + Math.sin(a) * (15 - p * 5), fx.col, 1.5); }
      } else if (fx.kind === 'ring' || fx.kind === 'level') { ctx.globalAlpha = p; circle(fx.x, fx.y, (fx.r || 45) * (1 - p * .6), fx.col, null, 2.5); ctx.globalAlpha = 1; }
      else if (fx.kind === 'bolt') {
        ctx.globalAlpha = Math.min(1, p * 2); ctx.strokeStyle = '#777cff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(fx.x1, fx.y1);
        for (let i = 1; i < 6; i++) { const q = i / 6; ctx.lineTo(fx.x1 + (fx.x2 - fx.x1) * q + (i % 2 ? 5 : -5), fx.y1 + (fx.y2 - fx.y1) * q + (i % 2 ? -3 : 3)); } ctx.lineTo(fx.x2, fx.y2); ctx.stroke(); ctx.globalAlpha = 1;
      }
    }
    for (const f of floats) { ctx.globalAlpha = Math.min(1, f.t * 3); text(f.txt, f.x, f.y, 13, f.col, 'center', '700'); } ctx.globalAlpha = 1;
    ctx.restore();
    ctx.setLineDash([3, 4]); ctx.strokeStyle = 'rgba(28,45,120,.35)'; ctx.lineWidth = 1; ctx.strokeRect(ARENA.x, ARENA.y, ARENA.w, ARENA.h); ctx.setLineDash([]);
  }
  function drawHUD() {
    text('我穿越到笔记本了', 21, 20, 15, C.ink, 'left', '700'); text('升星试验', 355, 20, 10, C.red, 'right', '700');
    text('生命', 20, 45, 10, C.gray); rect(55, 40, 132, 10, '#dfd6c8', C.ink, 1); rect(56, 41, 130 * Math.max(0, S.hp / 100), 8, C.red);
    text(`${Math.ceil(Math.max(0, S.hp))}/100`, 193, 45, 10, C.red);
    text(`Lv.${S.level}`, 250, 45, 11, C.ink, 'left', '700'); text(`${Math.floor(S.time)}″`, 354, 45, 12, C.ink, 'right', '700');
    rect(20, 62, 258, 7, '#ddd6ca'); rect(20, 62, 258 * S.xp / S.xpNeed, 7, C.teal); text(`${S.xp}/${S.xpNeed}`, 285, 66, 9, C.gray);
    button('整备', 302, 76, 54, 22); text(`击杀 ${S.kills}`, 20, 86, 10, C.gray); text(S.combo ? `连携：${S.combo}` : '按 起笔 → 行笔 → 收笔 连携', 188, 86, 10, S.combo ? C.amber : C.gray, 'center');
    notices.forEach((n, i) => { ctx.globalAlpha = Math.min(1, n.t * 2); text(n.text, 188, 113 + i * 16, 11, n.color, 'center', '700'); }); ctx.globalAlpha = 1;
  }
  function drawBattleRail() {
    text('自动轮转', 20, 565, 10, C.gray); text('单摇杆移动 · 技能自动施放', 355, 565, 9, C.gray, 'right');
    order.forEach((slot, i) => {
      const r = battleRects[i], p = equipped[slot], active = i === S.orderIndex && S.mode === 'play';
      if (active) rect(r.x - 3, r.y - 3, r.w + 6, r.h + 6, 'rgba(216,166,75,.16)', C.amber, 2);
      else rect(r.x, r.y, r.w, r.h, 'rgba(255,255,255,.28)', '#aaa294', 1);
      text(`${i + 1}`, r.x + 5, r.y + 8, 8, C.gray); partIcon(p, r.x + r.w / 2, r.y + 27, .72); text(PARTS[p.id].short, r.x + r.w / 2, r.y + 51, 10, C.ink, 'center', '700'); stars(p.star, r.x + r.w / 2, r.y + 63, 7);
      if (i < 3) text('→', r.x + r.w + 3, r.y + 32, 11, C.gray, 'center');
    });
    text('在战场左下区域拖动即可全速移动', 20, 653, 9, C.gray);
  }
  function drawJoystick() {
    if (!joy.active) return;
    ctx.globalAlpha = .5; circle(joy.bx, joy.by, 37, C.ink, null, 1.5); circle(joy.bx + joy.dx * 24, joy.by + joy.dy * 24, 15, C.ink, 'rgba(28,45,120,.12)', 1.5); ctx.globalAlpha = 1;
  }
  function drawStart() {
    rect(8, 6, 359, 655, 'rgba(245,241,230,.86)');
    text('我穿越到笔记本了', 188, 85, 24, C.ink, 'center', '700'); text('纸 人 升 星 · 试 验 页', 188, 117, 12, C.red, 'center', '700');
    roughLine(75, 137, 300, 137, C.ink, 1.5); drawPlayer(188, 228, 2.2, true);
    text('不是换一张技能卡，而是换一块身体。', 188, 322, 15, C.ink, 'center', '700');
    text('三张同名同星部件，自动合成更高一星', 188, 355, 12, C.gray, 'center');
    text('六个候补位  /  五个身体位  /  三星封顶', 188, 380, 12, C.gray, 'center');
    text('四技能自动轮转，排出你的连携顺序', 188, 417, 13, C.ink, 'center');
    button('醒来，进入笔记本', 77, 465, 221, 48, true);
    text('墨雨 → 电弧 → 纸飞机 = 碎墨处决', 188, 537, 11, C.thunder, 'center', '700');
    text('目标：在涂鸦围攻中坚持 90 秒', 188, 574, 10, C.gray, 'center');
    text('手机单摇杆 / 电脑 WASD · 战斗中可整备', 188, 616, 10, C.gray, 'center');
  }
  function drawLevelup() {
    rect(8, 6, 359, 655, 'rgba(245,241,230,.94)');
    text('捡到一块新涂鸦', 188, 83, 23, C.ink, 'center', '700'); text('选一块放入候补 · 三张同名同星自动升星', 188, 118, 11, C.gray, 'center');
    text(`候补 ${bench.length}/6`, 335, 146, 11, bench.length >= 6 ? C.red : C.gray, 'right', '700');
    choices.forEach((id, i) => {
      const r = choiceRects[i], def = PARTS[id], owned = [...Object.values(equipped), ...bench].filter(p => p.id === id).length;
      rect(r.x + 2, r.y + 3, r.w, r.h, 'rgba(28,45,120,.09)'); rect(r.x, r.y, r.w, r.h, C.paper, owned ? C.amber : C.ink, owned ? 2 : 1.2);
      partIcon({ id, star: 1 }, r.x + 49, r.y + 46, 1.25); text(def.name, r.x + 91, r.y + 25, 16, C.ink, 'left', '700');
      text(`${SLOT_NAME[def.slot]} · ${def.pen} · ${ATTR[def.attr]}`, r.x + 91, r.y + 50, 11, C.gray);
      text(owned ? `已有 ${owned} 块，继续凑升星` : '新部件，可替换对应身体位', r.x + 91, r.y + 76, 11, owned ? C.amber : C.teal, 'left', '700');
      text(`${i + 1}`, r.x + 281, r.y + 16, 10, C.gray, 'center');
    });
    text('满员时最旧的未合成部件会化为分数', 188, 580, 10, C.gray, 'center');
  }
  function partCell(r, part, label, selected) {
    rect(r.x, r.y, r.w, r.h, selected ? '#eee0b9' : 'rgba(255,255,255,.28)', selected ? C.amber : '#9e978b', selected ? 2 : 1);
    text(label, r.x + 4, r.y + 9, 9, C.gray); partIcon(part, r.x + r.w / 2, r.y + r.h * .46, r.w < 80 ? .72 : .85);
    if (part) { text(PARTS[part.id].short, r.x + r.w / 2, r.y + r.h - 18, 10, C.ink, 'center', '700'); stars(part.star, r.x + r.w / 2, r.y + r.h - 7, 7); }
  }
  function drawLoadout() {
    rect(8, 6, 359, 655, 'rgba(245,241,230,.97)');
    text('身体整备', 23, 34, 22, C.ink, 'left', '700'); text(`候补 ${bench.length}/6`, 351, 34, 12, bench.length >= 6 ? C.red : C.gray, 'right', '700');
    drawPlayer(72, 105, 1.1, true); text('点装备，再点同部位候补', 126, 84, 12, C.ink, 'left', '700'); text('三个同名同星 → 高一星', 126, 108, 11, C.gray); text('外观与技能同步进化', 126, 128, 10, C.teal);
    equipRects.forEach(r => partCell(r, equipped[r.slot], SLOT_NAME[r.slot], selection && selection.kind === 'equip' && selection.slot === r.slot));
    text('候补草图 · 六格', 24, 296, 13, C.ink, 'left', '700'); text('同名同星跨装备自动三合一', 351, 296, 10, C.gray, 'right');
    benchRects.forEach(r => partCell(r, bench[r.index], `候补 ${r.index + 1}`, selection && selection.kind === 'bench' && selection.index === r.index));
    text('连携顺序', 24, 486, 13, C.ink, 'left', '700'); text('点两个顺序格交换', 351, 486, 10, C.gray, 'right');
    orderRects.forEach(r => {
      const slot = order[r.index], p = equipped[slot]; partCell(r, p, `${r.index + 1} · ${SLOT_NAME[slot]}`, selection && selection.kind === 'order' && selection.index === r.index);
    });
    button('继续战斗', 106, 599, 163, 43, true); text('起笔 → 行笔 → 收笔 会引爆状态连携', 188, 653, 9, C.gray, 'center');
  }
  function drawResult() {
    rect(8, 6, 359, 655, 'rgba(245,241,230,.93)'); text(S.mode === 'win' ? '这一页，活下来了' : '涂鸦被擦掉了', 188, 143, 25, S.mode === 'win' ? C.ink : C.red, 'center', '700');
    drawPlayer(188, 250, 2, true); text(`坚持 ${Math.floor(S.time)} 秒  ·  击杀 ${S.kills}`, 188, 350, 16, C.ink, 'center', '700');
    text(`等级 ${S.level}  ·  得分 ${S.score}`, 188, 385, 13, C.gray, 'center'); button('再画一次', 89, 450, 197, 48, true);
  }
  function render() {
    ctx.clearRect(0, 0, W, H); paper();
    if (S.mode !== 'start') { drawArena(); drawHUD(); drawBattleRail(); drawJoystick(); }
    if (S.mode === 'start') drawStart(); else if (S.mode === 'levelup') drawLevelup(); else if (S.mode === 'loadout') drawLoadout(); else if (S.mode === 'win' || S.mode === 'over') drawResult();
  }
  function hit(x, y, r) { return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h; }
  function pos(ev) { const touch = ev.changedTouches ? ev.changedTouches[0] : ev; return { x: (touch.clientX - viewLeft) / viewScale, y: (touch.clientY - viewTop) / viewScale, id: touch.identifier ?? 0 }; }
  function down(ev) {
    ev.preventDefault(); const p = pos(ev);
    if (S.mode === 'start') { if (hit(p.x, p.y, { x: 77, y: 465, w: 221, h: 48 })) start(); return; }
    if (S.mode === 'win' || S.mode === 'over') { if (hit(p.x, p.y, { x: 89, y: 450, w: 197, h: 48 })) start(); return; }
    if (S.mode === 'levelup') { const i = choiceRects.findIndex(r => hit(p.x, p.y, r)); if (i >= 0) chooseOption(i); return; }
    if (S.mode === 'loadout') {
      if (hit(p.x, p.y, { x: 106, y: 599, w: 163, h: 43 })) { selection = null; S.mode = 'play'; return; }
      const eq = equipRects.find(r => hit(p.x, p.y, r)), be = benchRects.find(r => hit(p.x, p.y, r)), or = orderRects.find(r => hit(p.x, p.y, r));
      if (eq) {
        if (selection && selection.kind === 'bench' && swapEquipBench(eq.slot, selection.index)) selection = null;
        else selection = { kind: 'equip', slot: eq.slot };
      } else if (be && bench[be.index]) {
        if (selection && selection.kind === 'equip' && swapEquipBench(selection.slot, be.index)) selection = null;
        else selection = { kind: 'bench', index: be.index };
      } else if (or) {
        if (selection && selection.kind === 'order') { swapOrder(selection.index, or.index); selection = null; }
        else selection = { kind: 'order', index: or.index };
      } else selection = null;
      return;
    }
    if (S.mode === 'play') {
      if (hit(p.x, p.y, { x: 302, y: 76, w: 54, h: 22 })) { joy.active = false; selection = null; S.mode = 'loadout'; return; }
      if (p.y > ARENA.y && p.y < ARENA.y + ARENA.h && p.x < ARENA.x + ARENA.w * .62) {
        joy.active = true; joy.id = p.id; joy.bx = p.x; joy.by = p.y; joy.dx = joy.dy = 0;
      }
    }
  }
  function move(ev) {
    if (!joy.active) return; ev.preventDefault();
    const list = ev.changedTouches ? Array.from(ev.changedTouches) : [ev], t = list.find(v => (v.identifier ?? 0) === joy.id); if (!t) return;
    const p = pos(ev), dx = p.x - joy.bx, dy = p.y - joy.by, d = Math.hypot(dx, dy);
    if (d > 5) { joy.dx = dx / d; joy.dy = dy / d; }
  }
  function up(ev) {
    const list = ev.changedTouches ? Array.from(ev.changedTouches) : [ev]; if (!list.some(v => (v.identifier ?? 0) === joy.id)) return;
    joy.active = false; joy.dx = joy.dy = 0;
  }
  canvas.addEventListener('pointerdown', down); canvas.addEventListener('pointermove', move); canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
  window.addEventListener('keydown', ev => {
    keys[ev.key.toLowerCase()] = true;
    if (S.mode === 'levelup' && ['1', '2', '3'].includes(ev.key)) chooseOption(+ev.key - 1);
    if ((ev.key === 'Tab' || ev.key.toLowerCase() === 'i') && (S.mode === 'play' || S.mode === 'loadout')) { ev.preventDefault(); S.mode = S.mode === 'play' ? 'loadout' : 'play'; selection = null; }
  });
  window.addEventListener('keyup', ev => { keys[ev.key.toLowerCase()] = false; }); window.addEventListener('resize', resize);
  function frame(t) { const dt = last ? (t - last) / 1000 : 0; last = t; boil = t / 1000; update(dt); render(); requestAnimationFrame(frame); }
  reset(location.search.includes('play') ? 'play' : 'start'); if (location.search.includes('play')) { for (let i = 0; i < 6; i++) spawnEnemy(); queueFullAssembly(); }
  resize(); requestAnimationFrame(frame);
})();

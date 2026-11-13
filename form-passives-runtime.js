/* 每个主动一个一次性形态被动：改变结构，不占辅助槽。 */
(() => {
  'use strict';
  const FORMS = {
    cyclone: ['双星笔轨', '瞬时圆环变为 2 枚绕身蜡笔，持续 1.2 秒接触切割'],
    volcanic: ['环形火山带', '直线喷发改为围绕目标的环形喷发，最后中央收尾'],
    tornado: ['折线飞行', '纸飞机飞出一段距离后折转 90°，再命中分裂'],
    chainclip: ['闭环电网', '首目标与附近敌人形成闭合电网，持续伤害穿线敌人'],
    arc: ['雷迹留线', '每段电弧留下短暂电线，伤害穿过的敌人'],
    spark: ['悬浮墨雷', '墨滴首次命中或撞墙后变为感应墨雷'],
    ballista: ['双联炮管', '炮台每轮改为 2 发平行图钉，单发 70% 伤害'],
    boomerang: ['镜像橡皮', '每次投出 2 枚镜像橡皮，单枚 70% 伤害'],
    vortex: ['内外双阵', '碎片分到内外两圈反向旋转，内圈更快'],
    candle: ['回旋火舌', '周身灼烧改为旋转的 120° 火舌'],
    icespear: ['三叉冰锥', '每次射出 3 支冰锥，单支 70% 伤害并保留贯穿'],
    inkrain: ['移动积雨云', '毒云排成云带并缓慢向前移动'],
    ruler: ['十字裂地', '单排地刺改为十字裂地，横向造成 65% 伤害'],
    chalk: ['三连粉笔雨', '单颗流星改为 3 颗连续小流星，每颗 45% 伤害'],
    pinburst: ['环形蜂群', '扇形射击改为 360° 环形射击，单钉 75% 伤害'],
    absolve: ['双生赦免', '转化产生 2 只小鬼，每只继承 55% 伤害与持续时间'],
    brand: ['三角烙印', '连接 3 个目标形成三角，连线同样造成持续伤害'],
    cola: ['回卷冰浪', '新星扩散后再向内回卷，造成 60% 伤害并减速'],
    doommark: ['死线传染', '死线结算后跳向附近新目标，50% 伤害，最多 2 次'],
    pageslash: ['双弧断页', '单刀光改为两道交叉斩弧，每道 70% 伤害'],
    piercerush: ['四角贯阵', '双枪改为四角收束的 4 道枪影，保留中央爆发'],
    spinlance: ['螺旋钉点', '旋枪围绕钉点逐渐向外螺旋移动'],
    shieldrush: ['飞盾反击', '每消耗一层盾印，盾片飞向攻击者或最近敌人'],
    ricoshield: ['中途裂盾', '第 3 次弹射后裂为 2 面小盾，单盾 45% 伤害'],
    perfectarrow: ['箭后冰幕', '主箭首次命中后消失，在目标背后展开冰晶锥形剑气'],
    arrowfocus: ['包围箭阵', '箭矢在目标周围悬停成环，随后同时向中心收束'],
    magfist: ['双拳夹页', '下砸后左右追加磁墨拳夹击，各造成 45% 伤害'],
    inkgrenade: ['空中分弹', '主墨弹分为 3 枚平行墨弹，各造成 50% 伤害'],
    heatrail: ['扇面扫射', '扫射在目标方向来回扫过 60°，终末弹变为宽型热浪']
  };
  for (const [skill, def] of Object.entries(FORMS)) {
    const id = 'form_' + skill;
    PASSIVES.push({ id, form: true, skill, name: def[0], desc: def[1], once: true,
      available: () => player.actives.some(a => a.id === skill), fx: () => { player.taken[id] = true; } });
  }
  const S = { orbitals: [], mines: [], wires: [], polys: [], sweeps: [], waves: [], cones: [], noProc: false };
  const has = id => !!(player && player.taken && player.taken['form_' + id]);
  const cap = (arr, value, max) => { if (arr.length >= max) arr.shift(); arr.push(value); return value; };
  const copyC = (c, mul) => Object.assign({}, c, mul === undefined ? {} : { dmg: c.dmg * mul });
  const nearest = (x, y, range, excluded) => {
    const list = Array.isArray(excluded) ? excluded : [excluded];
    let best = null, bd = range * range;
    for (const e of enemies) {
      if (e.dead || list.includes(e) || list.includes(e.id)) continue;
      const d2 = (e.x - x) ** 2 + (e.y - y) ** 2;
      if (d2 < bd) { bd = d2; best = e; }
    }
    return best;
  };
  const distSeg = (p, a, b) => pointSegDist(p, a, b);
  function hitCircle(x, y, radius, damage, c, skill) {
    const cc = Object.assign({}, c, { hadesSkill: skill });
    for (const e of enemies) if (!e.dead && Math.hypot(e.x - x, e.y - y) < radius + e.r) areaHit(e, damage, cc, x, y, radius, Math.hypot(e.x - x, e.y - y));
    novas.push({ x, y, t: 0.28, max: radius, col: c.col, c: cc });
  }
  function addErupt(x, y, delay, dmg, r, c, extra) {
    erupts.push(Object.assign({ x, y, delay, dmg, r, c, done: false, t: 0 }, extra || {}));
  }
  function baseTarget(range) { return nearest(player.x, player.y, range); }

  const baseFireSkill = fireSkill;
  fireSkill = function(a, c) {
    if (!has(a.id)) return baseFireSkill(a, c);
    const px = player.x, py = player.y;
    if (a.id === 'cyclone') {
      cap(S.orbitals, { skill: a.id, t: 1.2, age: 0, c, damage: 11 * c.dmg, hits: Object.create(null) }, 12); return true;
    }
    if (a.id === 'volcanic') {
      const t = baseTarget(520 * c.rad); if (!t) return false;
      const n = 6 + Math.max(0, c.count || 0), ring = 92 * c.rad;
      for (let i = 0; i < n; i++) { const ang = i / n * Math.PI * 2; addErupt(t.x + Math.cos(ang) * ring, t.y + Math.sin(ang) * ring, i * 0.055, 26 * c.dmg * 0.72, 48 * c.rad, c); }
      addErupt(t.x, t.y, 0.42, 38 * c.dmg, 82 * c.rad, c); return true;
    }
    if (a.id === 'tornado') {
      const t = baseTarget(430); if (!t) return false;
      const base = Math.atan2(t.y - py, t.x - px), n = 1 + c.count;
      for (let i = 0; i < n; i++) fireBullet(px, py - 10, base + (i - (n - 1) / 2) * 0.18, 380 * c.proj,
        15 * c.dmg * (1 + c.bdmg), 'torn', Object.assign(projOpts(c, 1.6), { hits: 1 + c.pierce, extra: c.chain,
          gen: a.lvl >= 5 ? 2 : (a.lvl >= 3 ? 1 : 0), formTurn: i % 2 ? -1 : 1, formStartX: px, formStartY: py - 10 }));
      return true;
    }
    if (a.id === 'chainclip') {
      const t = baseTarget(430); if (!t) return false;
      const result = baseFireSkill(a, c), points = [t];
      for (let i = 0; i < 2; i++) { const n = nearest(t.x, t.y, 240, points); if (n) points.push(n); }
      if (points.length >= 2) cap(S.polys, { kind: 'clip', points, t: 1.5, tick: 0, c, damage: 8 * c.dmg, next: Object.create(null) }, 16);
      return result;
    }
    if (a.id === 'arc') {
      const first = lightnings.length, result = baseFireSkill(a, c);
      for (let i = first; i < lightnings.length; i++) { const l = lightnings[i]; cap(S.wires, { x1: l.x1, y1: l.y1, x2: l.x2, y2: l.y2, t: 1.2, c, damage: 8 * c.dmg, next: Object.create(null) }, 48); }
      return result;
    }
    if (a.id === 'spark') {
      const n = 5 + 2 * c.count, aimed = baseTarget(520), off = Math.random() * Math.PI * 2, aim = aimed ? Math.atan2(aimed.y - py, aimed.x - px) : off;
      for (let i = 0; i < n; i++) { const ang = i < 2 && aimed ? aim + (i ? 0.12 : -0.12) : off + i / n * Math.PI * 2;
        cap(S.mines, { x: px, y: py, vx: Math.cos(ang) * 160 * c.proj, vy: Math.sin(ang) * 160 * c.proj, c, damage: 12 * c.dmg * (1 + c.bdmg), state: 'fly', t: 2.6 * (1 + c.lifeMul), arm: 0 }, 60); }
      return true;
    }
    if (a.id === 'ballista') {
      const old = totems.length, result = baseFireSkill(a, c);
      for (let i = old; i < totems.length; i++) { totems[i].shots = 2 + c.count; totems[i].dmg *= 0.7; }
      return result;
    }
    if (a.id === 'boomerang') {
      const t = baseTarget(460), base = t ? Math.atan2(t.y - py, t.x - px) : player.faceA, n = 2 + c.count;
      for (let i = 0; i < n; i++) { const side = i % 2 ? -1 : 1, rank = Math.floor(i / 2);
        fireBullet(px, py, base + side * (0.45 + rank * 0.18), 330 * c.proj, 18 * c.dmg * (1 + c.bdmg) * 0.7, 'boom',
          Object.assign(projOpts(c, 2.4), { hits: 999, traveled: 0, returning: false })); }
      return true;
    }
    if (a.id === 'vortex') {
      const max = BATTLE.skills.vortexCap + c.count;
      for (let i = 0; i < BATTLE.skills.vortexPerCast; i++) cap(S.orbitals, { skill: 'vortex', t: 5 * c.areaT, age: 0, c, damage: 10 * c.dmg,
        ring: S.orbitals.filter(o => o.skill === 'vortex').length % 2, slot: S.orbitals.filter(o => o.skill === 'vortex').length, next: Object.create(null) }, 36);
      const mine = S.orbitals.filter(o => o.skill === 'vortex'); while (mine.length > max) { const idx = S.orbitals.indexOf(mine[0]); S.orbitals.splice(idx, 1); mine.shift(); }
      return true;
    }
    if (a.id === 'candle') {
      const t = baseTarget(400), angle = t ? Math.atan2(t.y - py, t.x - px) : player.faceA;
      cap(S.sweeps, { t: 0.34, total: 0.34, angle, c, damage: 7 * c.dmg, hit: Object.create(null) }, 12); return true;
    }
    if (a.id === 'icespear') {
      let best = null, priority = -1, far = -1;
      for (const e of enemies) { if (e.dead) continue; const d = (e.x - px) ** 2 + (e.y - py) ** 2, p = e.boss ? 2 : (e.elite ? 1 : 0);
        if (d < 620 ** 2 && (p > priority || p === priority && d > far)) { best = e; priority = p; far = d; } }
      if (!best) return false;
      const base = Math.atan2(best.y - py, best.x - px), n = 3 + c.count;
      for (let i = 0; i < n; i++) fireBullet(px, py - 10, base + (i - (n - 1) / 2) * 0.14, 460 * c.proj,
        30 * c.dmg * (1 + c.bdmg) * 0.7, 'ice', Object.assign(projOpts(c, 1.5), { hits: 3 + c.pierce, slow: 2, slowBonus: 1.25 }));
      return true;
    }
    if (a.id === 'inkrain') {
      const t = baseTarget(400), ang = t ? Math.atan2(t.y - py, t.x - px) : player.faceA, n = 3 + c.count;
      for (let i = 0; i < n; i++) { const offset = (i - (n - 1) / 2) * 65, x = (t ? t.x : px) - Math.sin(ang) * offset, y = (t ? t.y : py) + Math.cos(ang) * offset;
        clouds.push({ x, y, vx: Math.cos(ang) * 28, vy: Math.sin(ang) * 28, formCloud: true,
          t: 2.5 * (1 + c.lingerT), tick: 0.1 + i * 0.04, dmg: 8 * c.dmg, r: 55 * c.rad, c }); }
      return true;
    }
    if (a.id === 'ruler') {
      const t = baseTarget(520); if (!t) return false;
      const ang = Math.atan2(t.y - py, t.x - px), n = 5 + c.count;
      for (let k = 0; k < n; k++) for (const cross of [false, true]) { const aa = ang + (cross ? Math.PI / 2 : 0), d = (k - (n - 1) / 2) * 44;
        addErupt(t.x + Math.cos(aa) * d, t.y + Math.sin(aa) * d, k * 0.06, 22 * c.dmg * (cross ? 0.65 : 1), 26 * c.rad * (1 + c.sweep), c); }
      return true;
    }
    if (a.id === 'chalk') {
      const t = baseTarget(550), cx = t ? t.x : px + Math.cos(player.faceA) * 150, cy = t ? t.y : py + Math.sin(player.faceA) * 150, n = 3 + c.count;
      for (let i = 0; i < n; i++) { const ang = i / n * Math.PI * 2, d = i ? 55 * c.rad : 0;
        addErupt(cx + Math.cos(ang) * d, cy + Math.sin(ang) * d, 0.45 + i * 0.1, 45 * c.dmg * 0.45, 58 * c.rad, c, { warn: true }); }
      return true;
    }
    if (a.id === 'pinburst') {
      if (!baseTarget(420)) return false;
      const n = 6 + c.count, off = Math.random() * Math.PI * 2;
      for (let i = 0; i < n; i++) fireBullet(px, py - 8, off + i / n * Math.PI * 2, 430 * c.proj,
        12 * c.dmg * (1 + c.bdmg) * 0.75, 'pin', Object.assign(projOpts(c, 0.9), { hits: 1 + c.pierce, aoe: 8 * c.dmg * (1 + c.bdmg), aoeR: 40 * c.rad }));
      return true;
    }
    if (a.id === 'absolve') return baseFireSkill(a, c);
    if (a.id === 'brand') {
      const first = baseTarget(350 * c.rad); if (!first) return false;
      const points = [first]; for (let i = 0; i < 2; i++) { const n = nearest(first.x, first.y, 250 * c.rad, points); if (n) points.push(n); }
      cap(S.polys, { kind: 'brand', points, t: 4 * (1 + c.lingerT), tick: 0, c, damage: 9 * c.dmg, next: Object.create(null) }, 12); return true;
    }
    if (a.id === 'cola') {
      const result = baseFireSkill(a, c), rad = BATTLE.skills.colaRadius * c.rad;
      cap(S.waves, { x: px, y: py, t: 0.75, total: 0.75, r: rad, c, damage: 20 * c.dmg * 0.6, hit: Object.create(null) }, 12); return result;
    }
    if (a.id === 'doommark') {
      const result = baseFireSkill(a, c);
      for (const e of enemies) if (e.hadesDoom && e.formDoomJumps === undefined) { e.formDoomJumps = 0; e.formDoomArmed = true; }
      return result;
    }
    if (a.id === 'pageslash') {
      const result = baseFireSkill(a, c), list = window.__weaponRuntime.state.slashes, slash = list[list.length - 1];
      if (slash && slash.c === c) { slash.c = copyC(c, 0.7); cap(list, Object.assign({}, slash, { id: 100000 + Math.random(), angle: slash.angle + 0.72, c: copyC(c, 0.7), hit: false, echo: false, pull: false, age: 0 }), 8); }
      return result;
    }
    if (a.id === 'piercerush') {
      const result = baseFireSkill(a, c), list = window.__weaponRuntime.state.dashes, pair = list.slice(-2);
      if (pair.length === 2 && pair[0].c === c) {
        const cx = pair[0].crossX, cy = pair[0].crossY, group = pair[0].group;
        for (const d of pair) { const dx = d.x0 - cx, dy = d.y0 - cy, len = Math.hypot(dx, dy) || 1;
          d.x0 = cx + dx / len * 180; d.y0 = cy + dy / len * 180; d.x1 = cx - dx / len * 45; d.y1 = cy - dy / len * 45; d.angle = Math.atan2(d.y1 - d.y0, d.x1 - d.x0); d.hx = d.x0; d.hy = d.y0; d.c = copyC(c, 0.82); }
        for (const side of [-1, 1]) { const ang = Math.atan2(cy - py, cx - px) + side * Math.PI / 2, x0 = cx + Math.cos(ang) * 180, y0 = cy + Math.sin(ang) * 180;
          list.push({ id: 100000 + Math.random(), group, side, x0, y0, x1: cx - Math.cos(ang) * 45, y1: cy - Math.sin(ang) * 45, crossX: cx, crossY: cy,
            hx: x0, hy: y0, angle: ang + Math.PI, phase: 'aim', t: 0, c: copyC(c, 0.82), hits: Object.create(null), backHits: Object.create(null) }); }
      }
      return result;
    }
    if (a.id === 'spinlance') {
      const result = baseFireSkill(a, c); for (const l of window.__weaponRuntime.state.lances) if (l.c === c && !l.formSpiral) { l.formSpiral = true; l.anchorX = l.x; l.anchorY = l.y; l.formAge = 0; }
      return result;
    }
    if (a.id === 'shieldrush') {
      const result = baseFireSkill(a, c), d = window.__weaponRuntime.state.shieldRush; if (d && d.c === c) { d.formCounter = true; d.formLayers = d.layers; }
      return result;
    }
    if (a.id === 'ricoshield') {
      const result = baseFireSkill(a, c); for (const sh of window.__weaponRuntime.state.shields) if (sh.c === c) sh.formCanSplit = true; return result;
    }
    if (a.id === 'perfectarrow') {
      const result = baseFireSkill(a, c); for (const ch of window.__weaponRuntime.state.charges) if (ch.c === c) ch.formIce = true; return result;
    }
    if (a.id === 'arrowfocus') {
      const t = baseTarget(520); if (!t) return false;
      const count = 8 + (c.count || 0) + (player.taken.focus_more ? 4 : 0);
      for (let i = 0; i < count; i++) { const ang = i / count * Math.PI * 2;
        window.__weaponRuntime.spawnBolt({ kind: 'focus', skill: 'arrowfocus', targetId: t.id, x: t.x + Math.cos(ang) * 110 * c.rad,
          y: t.y + Math.sin(ang) * 110 * c.rad, angle: ang + Math.PI, speed: 0, damage: 11 * c.dmg * (1 + c.bdmg), c,
          radius: 5 * c.rad * (1 + c.brad), delay: 0, life: 1.6 * (1 + c.lifeMul), formHold: 0.5, formAngle: ang, formSpeed: 680 * c.proj }); }
      return true;
    }
    if (a.id === 'magfist') {
      const result = baseFireSkill(a, c); for (const f of window.__weaponRuntime.state.fists) if (f.c === c) f.formDouble = true; return result;
    }
    if (a.id === 'inkgrenade') {
      const result = baseFireSkill(a, c), list = window.__weaponRuntime.state.grenades, g = list[list.length - 1];
      if (g && g.c === c && g.main) { const angle = Math.atan2(g.ty - g.sy, g.tx - g.sx), nx = -Math.sin(angle), ny = Math.cos(angle);
        g.damage *= 0.5; g.formSplit = true; g.tx += nx * 55; g.ty += ny * 55;
        for (const side of [-1, 1]) cap(list, Object.assign({}, g, { id: 100000 + Math.random(), tx: g.tx + nx * 55 * side, ty: g.ty + ny * 55 * side, age: 0, done: false }), 18); }
      return result;
    }
    if (a.id === 'heatrail') {
      const result = baseFireSkill(a, c), r = window.__weaponRuntime.state.rail; if (r && r.c === c) { r.formSweep = true; r.formBaseAngle = r.angle; } return result;
    }
    return baseFireSkill(a, c);
  };

  const baseHurtEnemy = hurtEnemy;
  hurtEnemy = function(e, dmg, dotDps, sx, sy, vuln, critAdd, bossMul, hitCol, weakFloat, skillId) {
    if (skillId === 'perfectarrow' && has('perfectarrow') && !S.noProc && !e.dead) {
      const W = window.__weaponRuntime, bolt = W && W.state.bolts.find(b => b.kind === 'perfect' && Math.hypot(b.x - e.x, b.y - e.y) < e.r + 30);
      const a = player.actives.find(x => x.id === 'perfectarrow');
      if (bolt && a) {
        const c = bolt.c, angle = bolt.angle; bolt.life = 0;
        cap(S.cones, { x: e.x, y: e.y, angle, r: 170 * c.rad, t: 0.35, total: 0.35, col: c.col }, 20);
        S.noProc = true;
        try { for (const other of enemies) { if (other.dead || other === e) continue; const dx = other.x - e.x, dy = other.y - e.y, d = Math.hypot(dx, dy);
          const da = Math.atan2(Math.sin(Math.atan2(dy, dx) - angle), Math.cos(Math.atan2(dy, dx) - angle));
          if (d < 170 * c.rad + other.r && Math.abs(da) < Math.PI / 4) areaHit(other, 36 * c.dmg, c, e.x, e.y); } } finally { S.noProc = false; }
      }
    }
    const doomJump = skillId === 'doommark' && has('doommark') && e.formDoomArmed && !S.noProc;
    if (doomJump) e.formDoomArmed = false;
    const result = baseHurtEnemy(e, dmg, dotDps, sx, sy, vuln, critAdd, bossMul, hitCol, weakFloat, skillId);
    if (doomJump && (e.formDoomJumps || 0) < 2) {
      const next = nearest(e.x, e.y, 300, e);
      if (next && !next.hadesDoom) { next.hadesDoom = { t: 1, total: 1, dmg: dmg * 0.5, c: { col: ATTR_COLOR.thunder, hadesSkill: 'doommark', dmg: 1 }, sources: Object.create(null) };
        next.formDoomJumps = (e.formDoomJumps || 0) + 1; next.formDoomArmed = true; }
    }
    return result;
  };

  const baseKillEnemy = killEnemy;
  killEnemy = function(e) {
    const old = minions.length;
    baseKillEnemy(e);
    if (has('absolve') && e.absolveUntil >= gameTime && e.absolveC && !e.boss && minions.length > old) {
      const c = e.absolveC, first = minions[old]; first.dmg *= 0.55; first.t *= 0.55;
      minions.push(Object.assign({}, first, { x: first.x + 16, y: first.y + 8, atkCd: 0.2 }));
    }
  };

  function updateForm(dt) {
    for (const b of bullets) if (b.formTurn && !b.formTurned) {
      const d = Math.hypot(b.x - b.formStartX, b.y - b.formStartY);
      if (d >= 160) { const angle = Math.atan2(b.vy, b.vx) + b.formTurn * Math.PI / 2, speed = Math.hypot(b.vx, b.vy); b.vx = Math.cos(angle) * speed; b.vy = Math.sin(angle) * speed; b.formTurned = true; }
    }
    for (const o of S.orbitals) {
      o.t -= dt; o.age += dt;
      if (o.skill === 'cyclone') {
        for (let i = 0; i < 2; i++) { const ang = o.age * 7 + i * Math.PI, x = player.x + Math.cos(ang) * 125 * o.c.rad, y = player.y + Math.sin(ang) * 125 * o.c.rad;
          for (const e of enemies) { const key = e.id + '_' + i; if (e.dead || (o.hits[key] || 0) >= 2 || Math.hypot(e.x - x, e.y - y) > e.r + 22) continue;
            o.hits[key] = (o.hits[key] || 0) + 1; areaHit(e, o.damage, o.c, x, y); } }
      } else {
        const group = S.orbitals.filter(x => x.skill === 'vortex'), index = group.indexOf(o), sameRing = group.filter(x => x.ring === o.ring), ringIndex = sameRing.indexOf(o);
        const dir = o.ring ? -1 : 1, speed = o.ring ? 4.8 : 3.2, radius = (o.ring ? 150 : 80) * o.c.rad * (1 + (o.c.sweep || 0));
        const ang = o.age * speed * dir + ringIndex / Math.max(1, sameRing.length) * Math.PI * 2, x = player.x + Math.cos(ang) * radius, y = player.y + Math.sin(ang) * radius;
        o.x = x; o.y = y;
        for (const e of enemies) if (!e.dead && (o.next[e.id] || 0) <= gameTime && Math.hypot(e.x - x, e.y - y) < e.r + 13) { o.next[e.id] = gameTime + 0.35; areaHit(e, o.damage, o.c, x, y); }
      }
    }
    S.orbitals = S.orbitals.filter(o => o.t > 0);
    for (const m of S.mines) {
      m.t -= dt;
      if (m.state === 'fly') { m.x += m.vx * dt; m.y += m.vy * dt; const hit = enemies.find(e => !e.dead && Math.hypot(e.x - m.x, e.y - m.y) < e.r + 10);
        if (hit || m.x < WORLD_L + 8 || m.x > WORLD_R - 8 || m.y < WORLD_T + 8 || m.y > WORLD_B - 8) { m.state = 'arm'; m.arm = 0.6; m.vx = m.vy = 0; } }
      else { m.arm -= dt; if (m.arm <= 0) { const near = enemies.some(e => !e.dead && Math.hypot(e.x - m.x, e.y - m.y) < e.r + 62 * m.c.rad); if (near) { hitCircle(m.x, m.y, 62 * m.c.rad, m.damage * 1.5, m.c, 'spark'); m.t = 0; } } }
      if (m.t <= 0 && m.state !== 'done') { hitCircle(m.x, m.y, 52 * m.c.rad, m.damage, m.c, 'spark'); m.state = 'done'; }
    }
    S.mines = S.mines.filter(m => m.t > 0);
    for (const w of S.wires) { w.t -= dt; for (const e of enemies) if (!e.dead && (w.next[e.id] || 0) <= gameTime && distSeg(e, { x: w.x1, y: w.y1 }, { x: w.x2, y: w.y2 }) < e.r + 9) { w.next[e.id] = gameTime + 0.4; areaHit(e, w.damage, w.c, w.x1, w.y1); } }
    S.wires = S.wires.filter(w => w.t > 0);
    for (const p of S.polys) {
      p.t -= dt; p.tick -= dt;
      if (p.kind === 'brand') for (let i = 0; i < p.points.length; i++) if (p.points[i].dead) { const n = nearest(p.points[i].x, p.points[i].y, 220); if (n) p.points[i] = n; }
      if (p.tick <= 0) { p.tick = p.kind === 'brand' ? 0.7 / (1 + (p.c.retick || 0)) : 0.35;
        for (const e of enemies) { if (e.dead || (p.next[e.id] || 0) > gameTime) continue; let touched = false;
          for (let i = 0; i < p.points.length; i++) { const a = p.points[i], b = p.points[(i + 1) % p.points.length]; if (distSeg(e, a, b) < e.r + 10) touched = true; }
          if (p.kind === 'brand' && p.points.includes(e)) touched = true;
          if (touched) { p.next[e.id] = gameTime + 0.3; areaHit(e, p.damage, p.c, p.points[0].x, p.points[0].y); } } }
    }
    S.polys = S.polys.filter(p => p.t > 0 && p.points.some(e => !e.dead));
    for (const s of S.sweeps) { s.t -= dt; s.angle += dt * 5.2; const radius = BATTLE.skills.closeRadius * s.c.rad;
      for (const e of enemies) { if (e.dead || s.hit[e.id]) continue; const dx = e.x - player.x, dy = e.y - player.y, d = Math.hypot(dx, dy), da = Math.atan2(Math.sin(Math.atan2(dy, dx) - s.angle), Math.cos(Math.atan2(dy, dx) - s.angle));
        if (d < radius + e.r && Math.abs(da) < Math.PI / 3) { s.hit[e.id] = true; areaHit(e, s.damage, s.c, player.x, player.y); } } }
    S.sweeps = S.sweeps.filter(s => s.t > 0);
    for (const w of S.waves) { w.t -= dt; const p = 1 - w.t / w.total; if (p < 0.38) continue; const r = w.r * (1 - (p - 0.38) / 0.62);
      for (const e of enemies) if (!e.dead && !w.hit[e.id] && Math.abs(Math.hypot(e.x - w.x, e.y - w.y) - r) < e.r + 22) { w.hit[e.id] = true; e.slowT = Math.max(e.slowT || 0, 1.5); areaHit(e, w.damage, w.c, w.x, w.y); } }
    S.waves = S.waves.filter(w => w.t > 0);
    for (const c of S.cones) c.t -= dt; S.cones = S.cones.filter(c => c.t > 0);
    const W = window.__weaponRuntime;
    if (W) {
      for (const l of W.state.lances) if (l.formSpiral && !l.returning) { l.formAge += dt; const r = Math.min(90 * l.c.rad, l.formAge * 28), a = l.formAge * 2.8; l.x = l.anchorX + Math.cos(a) * r; l.y = l.anchorY + Math.sin(a) * r; }
      const shield = W.state.shieldRush;
      if (shield && shield.formCounter && shield.layers < shield.formLayers) { const count = shield.formLayers - shield.layers; shield.formLayers = shield.layers;
        for (let i = 0; i < count; i++) { const t = nearest(player.x, player.y, 420); if (t) W.spawnBolt({ kind: 'shieldpiece', skill: 'shieldrush', x: player.x, y: player.y,
          angle: Math.atan2(t.y - player.y, t.x - player.x), speed: 720, damage: 18 * shield.c.dmg, c: shield.c, radius: 8, life: 0.7, _noExpand: true }); } }
      for (const sh of W.state.shields) if (sh.formCanSplit && !sh.formSplit && sh.bounces >= 3) { sh.formSplit = true; sh.damage *= 0.45;
        const other = nearest(sh.x, sh.y, 460, sh.targetId); cap(W.state.shields, Object.assign({}, sh, { id: 100000 + Math.random(), targetId: other ? other.id : sh.targetId,
          formCanSplit: false, formSplit: true, angle: -sh.angle, spin: -sh.spin }), 4); }
      for (const b of W.state.bolts) {
        if (b.formHold !== undefined) { b.formHold -= dt; const t = enemies.find(e => e.id === b.targetId && !e.dead);
          if (b.formHold > 0) { b.life = Math.max(b.life, 0.8); b.speed = 0; b.vx = b.vy = 0; if (t) { b.x = t.x + Math.cos(b.formAngle) * 110 * b.c.rad; b.y = t.y + Math.sin(b.formAngle) * 110 * b.c.rad; b.px = b.x; b.py = b.y; } }
          else if (!b.formReleased) { b.formReleased = true; b.speed = b.formSpeed; } }
      }
      for (const f of W.state.fists) if (f.formDouble && f.slam && !f.formDoubleDone) { f.formDoubleDone = true;
        for (const side of [-1, 1]) addErupt(f.slamX + side * 75 * f.c.rad, f.slamY, 0.25, 43 * f.c.dmg * 0.45, 70 * f.c.rad, f.c); }
      const rail = W.state.rail; if (rail && rail.formSweep) rail.angle = rail.formBaseAngle + Math.sin(rail.age * 7) * Math.PI / 6;
      for (const b of W.state.bolts) if (b.kind === 'final' && has('heatrail') && !b.formWave) { b.formWave = true; b.radius *= 2.2; }
    }
  }

  function draw() {
    for (const o of S.orbitals) if (o.skill === 'cyclone') { for (let i = 0; i < 2; i++) { const a = o.age * 7 + i * Math.PI; jcircle(player.x + Math.cos(a) * 125 * o.c.rad, player.y + Math.sin(a) * 125 * o.c.rad, 17, o.c.col, 6); } }
      else { jcircle(o.x || player.x, o.y || player.y, 10, o.c.col, 4); }
    for (const m of S.mines) { jcircle(m.x, m.y, m.state === 'fly' ? 8 : 13 + Math.sin(gameTime * 12) * 2, m.c.col, 3); if (m.state !== 'fly') jcircle(m.x, m.y, 28 * m.c.rad, m.c.col, 1); }
    for (const w of S.wires) { ctx.globalAlpha = Math.min(0.65, w.t); jline(w.x1, w.y1, w.x2, w.y2, w.c.col, 3); }
    for (const p of S.polys) { ctx.globalAlpha = 0.8; for (let i = 0; i < p.points.length; i++) { const a = p.points[i], b = p.points[(i + 1) % p.points.length]; jline(a.x, a.y, b.x, b.y, p.c.col, p.kind === 'brand' ? 5 : 3); } }
    for (const s of S.sweeps) { const r = BATTLE.skills.closeRadius * s.c.rad; ctx.globalAlpha = 0.22; ctx.fillStyle = s.c.col; ctx.beginPath(); ctx.moveTo(player.x, player.y); ctx.arc(player.x, player.y, r, s.angle - Math.PI / 3, s.angle + Math.PI / 3); ctx.fill(); ctx.globalAlpha = 0.8; jline(player.x, player.y, player.x + Math.cos(s.angle) * r, player.y + Math.sin(s.angle) * r, s.c.col, 7); }
    for (const w of S.waves) { const p = 1 - w.t / w.total; if (p >= 0.38) { const r = w.r * (1 - (p - 0.38) / 0.62); ctx.globalAlpha = 0.8; jcircle(w.x, w.y, r, ICE_LIGHT, 7); } }
    for (const c of S.cones) { ctx.globalAlpha = c.t / c.total * 0.35; ctx.fillStyle = ICE_LIGHT; ctx.beginPath(); ctx.moveTo(c.x, c.y); ctx.arc(c.x, c.y, c.r, c.angle - Math.PI / 4, c.angle + Math.PI / 4); ctx.fill(); }
    ctx.globalAlpha = 1;
  }
  const baseUpdate = update;
  update = function(dt) { baseUpdate(dt); if (state === 'play') updateForm(dt); };
  const previousExtras = window.__drawWorldExtras;
  window.__drawWorldExtras = function() { if (previousExtras) previousExtras(); draw(); };
  const baseReset = resetGame;
  resetGame = function() { baseReset(); for (const key of Object.keys(S)) if (Array.isArray(S[key])) S[key].length = 0; S.noProc = false; };
  window.__formPassives = { state: S, forms: FORMS, update: updateForm };
})();

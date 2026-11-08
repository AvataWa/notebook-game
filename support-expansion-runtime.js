/* 通用辅助扩展：范围追加、子弹行为、打击派生与辅助匹配修复。 */
(() => {
  'use strict';

  const AREA_SKILLS = new Set(['cyclone', 'volcanic', 'arc', 'vortex', 'candle', 'inkrain', 'ruler', 'chalk', 'brand', 'cola', 'spinlance', 'inkgrenade']);
  const NATURAL_RETURN = new Set(['bloodcore', 'ricoshield', 'boomerang']);
  const NO_BOLT_BEHAVIOR = new Set(['bloodcore', 'ricoshield']);
  const NEW_SUPPORT_IDS = [
    'areastorm', 'areaspikes', 'areaouter', 'areagravity', 'areadeath', 'areastack',
    'projrepeat', 'projreturn', 'projendsplit', 'projpierceramp', 'projaccel', 'projback',
    'strikecross', 'strikethird', 'strikeaftershock', 'strikecrowd', 'strikeback', 'strikeexecute',
    'weakcount', 'weakpower'
  ];
  Object.assign(SUPPORTS, {
    areastorm: { name: '落雷批注', tag: 'area' }, areaspikes: { name: '墨刺丛生', tag: 'area' },
    areaouter: { name: '外圈齿线', tag: 'area' }, areagravity: { name: '引力草稿', tag: 'area' },
    areadeath: { name: '死亡溅墨', tag: 'area' }, areastack: { name: '逐层加深', tag: 'area' },
    projrepeat: { name: '连发', tag: 'proj' }, projreturn: { name: '折返笔迹', tag: 'proj' },
    projendsplit: { name: '末端分岔', tag: 'proj' }, projpierceramp: { name: '贯穿磨尖', tag: 'proj' },
    projaccel: { name: '逐笔加速', tag: 'proj' }, projback: { name: '背稿反射', tag: 'proj' },
    strikecross: { name: '交叉复审', tag: 'strike' }, strikethird: { name: '三段收笔', tag: 'strike' },
    strikeaftershock: { name: '落点余震', tag: 'strike' }, strikecrowd: { name: '破阵重笔', tag: 'strike' },
    strikeback: { name: '纸背反冲', tag: 'strike' }, strikeexecute: { name: '红笔收尾', tag: 'strike' },
    weakcount: { name: '红笔连批', tag: 'area' }, weakpower: { name: '扣分加重', tag: 'area' }
  });

  const baseSupDesc = supDesc;
  supDesc = function(id, l) {
    switch (id) {
      case 'areastorm': return '每 ' + Math.max(0.45, 0.8 - 0.05 * (l - 1)).toFixed(2) + ' 秒雷击范围内 1 敌，造成 ' + (30 + 15 * (l - 1)) + '% 技能伤害';
      case 'areaspikes': return '每秒生成 ' + (1 + l) + ' 根墨刺，每根造成 25% 技能伤害';
      case 'areaouter': return '每 0.7 秒对外侧 35% 环带造成 ' + (25 + 15 * (l - 1)) + '% 技能伤害';
      case 'areagravity': return '牵引普通怪，每秒造成 ' + (15 + 10 * (l - 1)) + '% 技能伤害';
      case 'areadeath': return '范围内敌人死亡时溅射 2 敌，造成 ' + (45 + 20 * (l - 1)) + '% 技能伤害';
      case 'areastack': return '每停留 0.5 秒受伤 +' + (6 + 3 * (l - 1)) + '%，最多 5 层';
      case 'projrepeat': return '每条弹道追加 ' + l + ' 枚 45% 伤害连发弹';
      case 'projreturn': return '子弹终点折返，返程造成 ' + (60 + 15 * (l - 1)) + '% 伤害';
      case 'projendsplit': return '子弹消失时分岔 ' + (1 + l) + ' 枚 40% 伤害子弹';
      case 'projpierceramp': return '每贯穿 1 敌，后续伤害 +' + (6 + 6 * l) + '%';
      case 'projaccel': return '每 0.2 秒加速 12%、伤害 +' + (4 + 4 * l) + '%，最多 5 层';
      case 'projback': return '向身后追加 ' + l + ' 枚 50% 伤害子弹';
      case 'strikecross': return '0.25 秒后追加交叉斩，造成 ' + (55 + 20 * (l - 1)) + '% 伤害';
      case 'strikethird': return '同目标第 3 次打击追加 ' + (80 + 40 * (l - 1)) + '% 伤害';
      case 'strikeaftershock': return '0.45 秒后在命中处追加 ' + (60 + 25 * (l - 1)) + '% 范围伤害';
      case 'strikecrowd': return '命中至少 3 敌时追加 ' + (40 + 20 * (l - 1)) + '% 伤害';
      case 'strikeback': return '向目标背后溅射 ' + (20 + 15 * (l - 1)) + '% 伤害';
      case 'strikeexecute': return '低血普通怪增伤 ' + (70 + 30 * (l - 1)) + '%，精英/Boss 增伤 ' + (25 + 10 * (l - 1)) + '%';
      case 'weakcount': return '虚弱目标数量 +' + l;
      case 'weakpower': return '虚弱减伤额外 +' + 4 * l + '%，总减伤最高 50%';
      default: return baseSupDesc(id, l);
    }
  };

  const baseSupportUsable = supportUsable;
  supportUsable = function(sid, aid) {
    if (aid === 'weakmark') return ['swift', 'wide', 'sheath', 'linger', 'weakcount', 'weakpower'].includes(sid);
    if (sid === 'chain' && (aid === 'arc' || aid === 'brand')) return true;
    if (sid === 'dur' && aid === 'ballista') return true;
    if (sid === 'weakcount' || sid === 'weakpower') return aid === 'weakmark';
    if (NEW_SUPPORT_IDS.includes(sid)) {
      const tags = SKILL_TAGS[aid] || [];
      if (sid.startsWith('area')) return AREA_SKILLS.has(aid) && tags.includes('area');
      if (sid.startsWith('strike')) return tags.includes('strike');
      if (!tags.includes('proj') || NO_BOLT_BEHAVIOR.has(aid)) return false;
      if (sid === 'projreturn' && NATURAL_RETURN.has(aid)) return false;
      if (sid === 'projpierceramp' && ['chainclip', 'arrowfocus', 'heatrail'].includes(aid)) return false;
      return true;
    }
    return baseSupportUsable(sid, aid);
  };

  const baseSkillCalc = skillCalc;
  skillCalc = function(a) {
    const c = baseSkillCalc(a);
    for (const sp of a.supports) {
      const l = sp.lvl;
      switch (sp.id) {
        case 'areastorm': c.areaStorm = l; break;
        case 'areaspikes': c.areaSpikes = l; break;
        case 'areaouter': c.areaOuter = l; break;
        case 'areagravity': c.areaGravity = l; break;
        case 'areadeath': c.areaDeath = l; break;
        case 'areastack': c.areaStack = l; break;
        case 'projrepeat': c.repeatShot = l; break;
        case 'projreturn': c.returnShot = l; break;
        case 'projendsplit': c.endSplit = l; break;
        case 'projpierceramp': c.pierceRamp = 0.06 + 0.06 * l; break;
        case 'projaccel': c.accelShot = l; break;
        case 'projback': c.backShot = l; break;
        case 'strikecross': c.crossStrike = l; break;
        case 'strikethird': c.thirdStrike = l; break;
        case 'strikeaftershock': c.strikeAftershock = l; break;
        case 'strikecrowd': c.crowdStrike = l; break;
        case 'strikeback': c.backSplash = l; break;
        case 'strikeexecute': c.executeStrike = l; break;
        case 'weakcount': c.count += l; break;
        case 'weakpower': c.weakPower = 0.04 * l; break;
      }
    }
    return c;
  };

  const S = {
    zones: [], delayed: [], queue: [], fx: [], castC: null, castId: null,
    preBullets: [], preBolts: [], strike: Object.create(null), inBonus: false, inDeath: false
  };
  const ZONE_DEFS = {
    cyclone: { follow: true, r: 150, duration: 1.2, base: 11 }, volcanic: { target: 520, r: 130, duration: 1.2, base: 26 },
    arc: { target: 330, r: 150, duration: 1.2, base: 22 }, vortex: { follow: true, r: 150, duration: 1.2, base: 10 },
    candle: { follow: true, r: 150, duration: 1.2, base: 4 }, inkrain: { target: 300, r: 55, duration: 2.5, base: 8 },
    ruler: { target: 520, r: 125, duration: 1.2, base: 22 }, chalk: { target: 550, r: 70, duration: 1.2, base: 35 },
    brand: { target: 350, r: 90, duration: 4, base: 9 }, cola: { r: 150, duration: 1.2, base: 20 },
    spinlance: { target: 430, r: 92, duration: 3.6, base: 16 }, inkgrenade: { target: 470, r: 105, duration: 1.2, base: 52 }
  };
  function cap(array, item, max) { if (array.length >= max) array.shift(); array.push(item); return item; }
  function hasAreaExpansion(c) { return c && (c.areaStorm || c.areaSpikes || c.areaOuter || c.areaGravity || c.areaDeath || c.areaStack); }
  function addFx(type, x, y, r, col, t, extra) { return cap(S.fx, Object.assign({ type, x, y, r, col: col || INK, t, total: t }, extra || {}), 72); }
  function skillKey(c) { return (c && c.hadesSkill) || S.castId || 'strike'; }
  function strikeWindow(c) {
    const key = skillKey(c);
    let w = S.strike[key];
    if (!w) w = S.strike[key] = { ids: [], t: -99, crowded: false, crossReady: -99, afterReady: -99 };
    if (gameTime - w.t > 0.22) { w.ids.length = 0; w.crowded = false; }
    w.t = gameTime;
    return w;
  }
  function inside(e, z) { return !e.dead && Math.hypot(e.x - z.x, e.y - z.y) <= z.r + e.r; }
  function candidates(z, outer) {
    return enemies.filter(e => {
      if (!inside(e, z)) return false;
      if (!outer) return true;
      const d = Math.hypot(e.x - z.x, e.y - z.y);
      return d >= z.r * 0.65 - e.r;
    });
  }
  function deal(e, amount, c, x, y) {
    if (!e || e.dead || amount <= 0) return;
    baseAreaHit(e, amount, c, x, y);
  }

  const baseFireSkill = fireSkill;
  fireSkill = function(a, c) {
    const oldC = S.castC, oldId = S.castId;
    S.castC = c; S.castId = a.id;
    try {
      const result = baseFireSkill(a, c);
      if (result !== false && hasAreaExpansion(c) && ZONE_DEFS[a.id]) {
        const d = ZONE_DEFS[a.id];
        const target = d.target ? nearestEnemy(player.x, player.y, d.target) : null;
        const radius = (a.id === 'cola' ? BATTLE.skills.colaRadius : d.r) * c.rad;
        cap(S.zones, {
          x: target ? target.x : player.x, y: target ? target.y : player.y,
          r: radius, follow: !!d.follow, t: d.duration * (1 + (c.lingerT || 0)), base: d.base,
          c, skill: a.id, stormT: 0.2, spikesT: 0.3, outerT: 0.25, gravityT: 0.2
        }, 28);
      }
      return result;
    } finally { S.castC = oldC; S.castId = oldId; }
  };

  const baseAreaHit = areaHit;
  areaHit = function(e, dmg, c, sx, sy, zoneR, dist) {
    if (!c || e.dead) return baseAreaHit(e, dmg, c, sx, sy, zoneR, dist);
    const raw = dmg, key = skillKey(c);
    if (c.areaStack) {
      const records = e.expAreaPresence || (e.expAreaPresence = Object.create(null));
      const rec = records[key];
      if (rec) {
        const stacks = Math.min(5, Math.floor(rec.t / 0.5));
        dmg *= 1 + stacks * (0.03 + 0.03 * c.areaStack);
      }
    }
    if (c.strike && c.executeStrike && e.hp / e.maxhp < 0.2) {
      const elite = e.elite || e.boss;
      dmg *= 1 + (elite ? 0.15 + 0.1 * c.executeStrike : 0.4 + 0.3 * c.executeStrike);
    }
    if (c.strike && c.thirdStrike) {
      const records = e.expThirdStrike || (e.expThirdStrike = Object.create(null));
      const rec = records[key] || (records[key] = { n: 0, t: -99 });
      if (gameTime - rec.t > 2) rec.n = 0;
      rec.n++; rec.t = gameTime;
      if (rec.n % 3 === 0) {
        dmg *= 1 + 0.4 + 0.4 * c.thirdStrike;
        floats.push({ x: e.x, y: e.y - e.r - 20, txt: '收笔！', t: 0.55, color: c.col || INK, crit: true });
      }
    }
    const result = baseAreaHit(e, dmg, c, sx, sy, zoneR, dist);
    if (!c.strike || S.inBonus || e.dead) return result;
    const w = strikeWindow(c);
    if (!w.ids.includes(e.id)) w.ids.push(e.id);
    if (c.backSplash) {
      const dx = e.x - (sx === undefined ? player.x : sx), dy = e.y - (sy === undefined ? player.y : sy);
      const len = Math.hypot(dx, dy) || 1, nx = dx / len, ny = dy / len;
      S.inBonus = true;
      try {
        for (const other of enemies) {
          if (other === e || other.dead) continue;
          const ox = other.x - e.x, oy = other.y - e.y, d = Math.hypot(ox, oy);
          if (d > 90 + other.r || (ox * nx + oy * ny) / (d || 1) < 0.45) continue;
          deal(other, raw * (0.05 + 0.15 * c.backSplash), c, e.x, e.y);
        }
      } finally { S.inBonus = false; }
      addFx('line', e.x, e.y, 65, c.col, 0.18, { x2: e.x + nx * 65, y2: e.y + ny * 65 });
    }
    if (c.crossStrike && gameTime >= w.crossReady) {
      w.crossReady = gameTime + 0.3;
      cap(S.delayed, { kind: 'cross', x: e.x, y: e.y, t: 0.25, c, dmg: raw * (0.35 + 0.2 * c.crossStrike),
        angle: Math.atan2(e.y - (sy || player.y), e.x - (sx || player.x)) + Math.PI / 2 }, 36);
    }
    if (c.strikeAftershock && gameTime >= w.afterReady) {
      w.afterReady = gameTime + 0.5;
      cap(S.delayed, { kind: 'aftershock', x: e.x, y: e.y, t: 0.45, c, dmg: raw * (0.35 + 0.25 * c.strikeAftershock) }, 36);
    }
    if (c.crowdStrike && !w.crowded && w.ids.length >= 3) {
      w.crowded = true; S.inBonus = true;
      try {
        for (const id of w.ids) {
          const other = enemies.find(x => x.id === id && !x.dead);
          if (other) deal(other, raw * (0.2 + 0.2 * c.crowdStrike), c, other.x, other.y);
        }
      } finally { S.inBonus = false; }
      addFx('ring', e.x, e.y, 70, c.col, 0.28);
    }
    return result;
  };

  function updateZones(dt) {
    for (const z of S.zones) {
      z.t -= dt; if (z.follow) { z.x = player.x; z.y = player.y; }
      if (z.c.areaGravity) {
        for (const e of candidates(z)) {
          if (!e.boss) {
            const dx = z.x - e.x, dy = z.y - e.y, d = Math.hypot(dx, dy) || 1;
            const pull = Math.min(d, (30 + 15 * z.c.areaGravity) * dt);
            e.x += dx / d * pull; e.y += dy / d * pull;
          }
        }
        z.gravityT -= dt;
        if (z.gravityT <= 0) {
          z.gravityT += 1;
          for (const e of candidates(z)) deal(e, z.base * z.c.dmg * (0.05 + 0.1 * z.c.areaGravity), z.c, z.x, z.y);
          addFx('gravity', z.x, z.y, z.r, z.c.col, 0.5);
        }
      }
      if (z.c.areaStack) {
        for (const e of candidates(z)) {
          const records = e.expAreaPresence || (e.expAreaPresence = Object.create(null));
          const rec = records[z.skill] || (records[z.skill] = { t: 0, last: gameTime });
          rec.t += dt; rec.last = gameTime;
        }
      }
      if (z.c.areaStorm) {
        z.stormT -= dt;
        if (z.stormT <= 0) {
          z.stormT += Math.max(0.45, 0.8 - 0.05 * (z.c.areaStorm - 1));
          const list = candidates(z);
          if (list.length) {
            const e = list[Math.floor(Math.random() * list.length)];
            deal(e, z.base * z.c.dmg * (0.15 + 0.15 * z.c.areaStorm), z.c, e.x, e.y - 80);
            lightnings.push({ x1: e.x, y1: e.y - 90, x2: e.x, y2: e.y, t: 0.2, delay: 0, prog: 1, c: z.c });
            addFx('ring', e.x, e.y, 28, ARC, 0.2);
          }
        }
      }
      if (z.c.areaSpikes) {
        z.spikesT -= dt;
        if (z.spikesT <= 0) {
          z.spikesT += 1;
          const list = candidates(z), count = 1 + z.c.areaSpikes;
          for (let i = 0; i < count; i++) {
            const e = list.length ? list[i % list.length] : null;
            const a = Math.random() * Math.PI * 2, d = Math.random() * z.r;
            const x = e ? e.x + (Math.random() - 0.5) * 18 : z.x + Math.cos(a) * d;
            const y = e ? e.y + (Math.random() - 0.5) * 18 : z.y + Math.sin(a) * d;
            for (const other of enemies) if (!other.dead && Math.hypot(other.x - x, other.y - y) < 22 + other.r)
              deal(other, z.base * z.c.dmg * 0.25, z.c, x, y);
            addFx('spike', x, y, 22, z.c.col, 0.32);
          }
        }
      }
      if (z.c.areaOuter) {
        z.outerT -= dt;
        if (z.outerT <= 0) {
          z.outerT += 0.7;
          for (const e of candidates(z, true)) deal(e, z.base * z.c.dmg * (0.1 + 0.15 * z.c.areaOuter), z.c, z.x, z.y);
          addFx('outer', z.x, z.y, z.r, z.c.col, 0.32);
        }
      }
    }
    for (let i = S.zones.length - 1; i >= 0; i--) if (S.zones[i].t <= 0) S.zones.splice(i, 1);
    for (const e of enemies) {
      if (!e.expAreaPresence) continue;
      for (const key of Object.keys(e.expAreaPresence)) if (gameTime - e.expAreaPresence[key].last > 2) delete e.expAreaPresence[key];
    }
  }
  function updateDelayed(dt) {
    for (const d of S.delayed) {
      d.t -= dt; if (d.t > 0) continue;
      const radius = d.kind === 'cross' ? 62 : 88;
      S.inBonus = true;
      try {
        for (const e of enemies) if (!e.dead && Math.hypot(e.x - d.x, e.y - d.y) < radius * d.c.rad + e.r)
          deal(e, d.dmg, d.c, d.x, d.y);
      } finally { S.inBonus = false; }
      addFx(d.kind, d.x, d.y, radius * d.c.rad, d.c.col, 0.3, { angle: d.angle || 0 });
    }
    for (let i = S.delayed.length - 1; i >= 0; i--) if (S.delayed[i].t <= 0) S.delayed.splice(i, 1);
  }

  const baseKillEnemy = killEnemy;
  killEnemy = function(e) {
    const x = e.x, y = e.y;
    const zones = S.inDeath ? [] : S.zones.filter(z => z.c.areaDeath && Math.hypot(x - z.x, y - z.y) <= z.r + e.r);
    baseKillEnemy(e);
    if (!zones.length) return;
    S.inDeath = true;
    try {
      for (const z of zones) {
        const targets = enemies.filter(other => !other.dead && other !== e && Math.hypot(other.x - x, other.y - y) < 150)
          .sort((a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y)).slice(0, 2);
        for (const other of targets) {
          deal(other, z.base * z.c.dmg * (0.25 + 0.2 * z.c.areaDeath), z.c, x, y);
          lightnings.push({ x1: x, y1: y, x2: other.x, y2: other.y, t: 0.18, delay: 0, prog: 1, c: z.c });
        }
        if (targets.length) addFx('ring', x, y, 65, z.c.col, 0.3);
      }
    } finally { S.inDeath = false; }
  };

  function expansionValues(c) {
    return c && (c.repeatShot || c.returnShot || c.endSplit || c.pierceRamp || c.accelShot || c.backShot);
  }
  function queue(type, template, c, delay, damageMul, angleOffset) {
    if (S.queue.length >= 120) return;
    S.queue.push({ type, template, c, delay, damageMul, angleOffset: angleOffset || 0 });
  }
  function decorate(entity, c, template, type) {
    if (!expansionValues(c) || entity._noExpand) return;
    entity._exp = { c, template, type, terminal: false, age: 0, accelN: 0, rampN: 0,
      lastHits: entity.hits, lastPierce: entity.pierce };
    if (c.repeatShot) for (let i = 0; i < c.repeatShot; i++) queue(type, template, c, 0.1 * (i + 1), 0.45, 0);
    if (c.backShot) for (let i = 0; i < c.backShot; i++) queue(type, template, c, 0, 0.5, Math.PI + (i - (c.backShot - 1) / 2) * 0.18);
  }
  function decorateBolt(bolt, c, options) {
    if (!options || options._noExpand || !c) return;
    decorate(bolt, c, Object.assign({}, options, { _noExpand: true }), 'bolt');
  }
  const baseFireBullet = fireBullet;
  fireBullet = function(x, y, ang, spd, dmg, kind, extra) {
    const first = bullets.length;
    baseFireBullet(x, y, ang, spd, dmg, kind, extra);
    if (!S.castC) return;
    for (let i = first; i < bullets.length; i++) {
      const b = bullets[i];
      decorate(b, S.castC, { x, y, ang, spd, dmg, kind, extra: Object.assign({}, extra || {}, { _noExpand: true }) }, 'main');
    }
  };
  function spawnQueued(q) {
    const c = q.c;
    if (q.type === 'main') {
      if (bullets.length >= 260) return;
      const t = q.template;
      baseFireBullet(t.x, t.y, t.ang + q.angleOffset, t.spd, t.dmg * q.damageMul, t.kind, t.extra);
    } else {
      const W = window.__weaponRuntime;
      if (!W || W.state.bolts.length >= 84) return;
      const t = Object.assign({}, q.template, { _noExpand: true });
      const baseAngle = t.angle || 0;
      t.angle = baseAngle + q.angleOffset;
      const speed = t.speed || Math.hypot(t.vx || 0, t.vy || 0) || 700;
      t.vx = Math.cos(t.angle) * speed; t.vy = Math.sin(t.angle) * speed;
      t.damage = (t.damage || 10) * q.damageMul;
      t.hits = Object.create(null); t.px = t.x; t.py = t.y;
      W.spawnBolt(t);
    }
  }
  function updateQueue(dt) {
    for (const q of S.queue) { q.delay -= dt; if (q.delay <= 0) spawnQueued(q); }
    for (let i = S.queue.length - 1; i >= 0; i--) if (S.queue[i].delay <= 0) S.queue.splice(i, 1);
  }
  function updateProjectile(entity, dt) {
    const x = entity._exp; if (!x) return;
    const c = x.c;
    x.age += dt;
    if (c.accelShot) {
      const n = Math.min(5, Math.floor(x.age / 0.2));
      while (x.accelN < n) {
        x.accelN++;
        const factor = 1 + 0.04 + 0.04 * c.accelShot;
        if (entity.dmg !== undefined) entity.dmg *= factor;
        if (entity.damage !== undefined) entity.damage *= factor;
        if (entity.vx !== undefined) { entity.vx *= 1.12; entity.vy *= 1.12; }
        if (entity.speed !== undefined) entity.speed *= 1.12;
      }
    }
    if (c.pierceRamp) {
      if (entity.hits !== undefined && entity.hits < x.lastHits) {
        const n = ++x.rampN, old = 1 + c.pierceRamp * (n - 1), next = 1 + c.pierceRamp * n;
        entity.dmg *= next / old; x.lastHits = entity.hits;
      }
      if (entity.pierce !== undefined && entity.pierce < x.lastPierce) {
        const n = ++x.rampN, old = 1 + c.pierceRamp * (n - 1), next = 1 + c.pierceRamp * n;
        entity.damage *= next / old; x.lastPierce = entity.pierce;
      }
    }
  }
  function terminal(entity, current, type) {
    const x = entity._exp;
    if (!x || x.terminal || current.includes(entity)) return;
    x.terminal = true;
    const c = x.c, t = x.template;
    if (c.returnShot) {
      const angle = Math.atan2(player.y - entity.y, player.x - entity.x);
      if (type === 'main') queue(type, Object.assign({}, t, { x: entity.x, y: entity.y, ang: angle }), c, 0, 0.45 + 0.15 * c.returnShot, 0);
      else queue(type, Object.assign({}, t, { x: entity.x, y: entity.y, angle }), c, 0, 0.45 + 0.15 * c.returnShot, 0);
    }
    if (c.endSplit) {
      const baseAngle = type === 'main' ? Math.atan2(entity.vy, entity.vx) : (entity.angle || 0);
      for (let i = 0; i < 1 + c.endSplit; i++) {
        const offset = (i - c.endSplit / 2) * 0.45;
        if (type === 'main') queue(type, Object.assign({}, t, { x: entity.x, y: entity.y, ang: baseAngle + offset }), c, 0, 0.4, 0);
        else queue(type, Object.assign({}, t, { x: entity.x, y: entity.y, angle: baseAngle + offset }), c, 0, 0.4, 0);
      }
    }
  }
  function preUpdate(dt) {
    updateQueue(dt);
    for (const b of bullets) updateProjectile(b, dt);
    const W = window.__weaponRuntime;
    if (W) for (const b of W.state.bolts) updateProjectile(b, dt);
    S.preBullets = bullets.slice(); S.preBolts = W ? W.state.bolts.slice() : [];
  }
  function postUpdate(dt) {
    const currentBolts = window.__weaponRuntime ? window.__weaponRuntime.state.bolts : [];
    for (const b of S.preBullets) terminal(b, bullets, 'main');
    for (const b of S.preBolts) terminal(b, currentBolts, 'bolt');
    updateZones(dt); updateDelayed(dt);
    for (const f of S.fx) f.t -= dt;
    for (let i = S.fx.length - 1; i >= 0; i--) if (S.fx[i].t <= 0) S.fx.splice(i, 1);
  }
  function reset() {
    S.zones.length = 0; S.delayed.length = 0; S.queue.length = 0; S.fx.length = 0;
    S.preBullets.length = 0; S.preBolts.length = 0; S.strike = Object.create(null);
    S.castC = null; S.castId = null; S.inBonus = false; S.inDeath = false;
  }
  const baseResetGame = resetGame;
  resetGame = function() { baseResetGame(); reset(); };
  const baseUpdate = update;
  update = function(dt) {
    if (state === 'play') preUpdate(dt);
    baseUpdate(dt);
    if (state === 'play') postUpdate(dt);
  };

  function draw() {
    for (const z of S.zones) {
      if (z.c.areaGravity) { ctx.globalAlpha = 0.16; jcircle(z.x, z.y, z.r * 0.7, z.c.col || INK, 1.5); }
      if (z.c.areaOuter) { ctx.globalAlpha = 0.12; jcircle(z.x, z.y, z.r * 0.825, z.c.col || INK, 4); }
    }
    ctx.globalAlpha = 1;
    for (const f of S.fx) {
      const p = 1 - f.t / f.total;
      ctx.globalAlpha = Math.max(0, 1 - p);
      if (f.type === 'line') jline(f.x, f.y, f.x2, f.y2, f.col, 3 * (1 - p) + 1);
      else if (f.type === 'spike') {
        jline(f.x - 5, f.y + 8, f.x, f.y - f.r * (1 - p * 0.4), f.col, 3);
        jline(f.x + 5, f.y + 8, f.x, f.y - f.r * (1 - p * 0.4), f.col, 2);
      } else if (f.type === 'cross') {
        const a = f.angle || 0, c = Math.cos(a), s = Math.sin(a), r = f.r * (0.5 + p * 0.5);
        jline(f.x - c * r, f.y - s * r, f.x + c * r, f.y + s * r, f.col, 5 * (1 - p) + 1);
        jline(f.x + s * r, f.y - c * r, f.x - s * r, f.y + c * r, f.col, 3 * (1 - p) + 1);
      } else if (f.type === 'gravity') {
        jcircle(f.x, f.y, f.r * (1 - p * 0.45), f.col, 3);
        jcircle(f.x, f.y, f.r * (0.65 - p * 0.35), f.col, 1.5);
      } else jcircle(f.x, f.y, f.r * (f.type === 'outer' ? 1 : (0.35 + p * 0.65)), f.col, f.type === 'outer' ? 5 : 4 * (1 - p) + 1);
    }
    ctx.globalAlpha = 1;
  }
  const previousExtras = window.__drawWorldExtras;
  window.__drawWorldExtras = function() { if (previousExtras) previousExtras(); draw(); };

  window.__supportExpansion = {
    state: S, decorateBolt, preUpdate, postUpdate, updateZones, updateDelayed, reset,
    get ids() { return NEW_SUPPORT_IDS.slice(); }
  };
  resetGame();
})();

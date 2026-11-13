/* 《哈迪斯》式构筑第一批：红芯回收与死线。 */
(() => {
  'use strict';

  const CORE_COL = '#c34a4a';
  const CORE_RETURN_DELAY = 3, CORE_RETURN_SPEED = 460;
  const WALL_COL = '#45506d';
  const hadesState = { shots: [], shards: [], walls: [], lines: [], nextId: 1, casting: null };
  const IDS = ['bloodcore', 'doommark'];

  Object.assign(SKILL_DEFS, {
    bloodcore: { name: '红芯投枪', desc: '默认 3 枚红芯，可分别嵌入怪物；死亡或到期后落地，3 秒后自动飞回，也可走近提前回收' },
    doommark: { name: '死线红勾', desc: '给 620 范围内最多 4 个高生命目标添加死线，1.5 秒后结算高伤；结算前不能重复添加' }
  });
  Object.assign(SKILL_TAGS, {
    bloodcore: ['proj'], doommark: ['strike']
  });
  Object.assign(SKILL_ATTR, { bloodcore: 'phys', doommark: 'thunder' });
  Object.assign(INK_COST, { bloodcore: 3, doommark: 4 });

  function has(id) { return !!(player && player.taken && player.taken[id]); }
  function active(id) { return player && player.actives.some(a => a.id === id); }
  function maxAmmo() { return 3 + (has('hdualcore') ? 1 : 0); }
  function reset() {
    hadesState.shots.length = 0; hadesState.shards.length = 0;
    hadesState.nextId = 1; hadesState.casting = null;
    player.hadesCoreAmmo = maxAmmo();
  }
  function passive(id, name, desc, requirements, onTake) {
    PASSIVES.push({
      id, name, desc, once: true,
      available: () => requirements.every(active),
      fx: () => { player.taken[id] = true; if (onTake) onTake(); }
    });
  }
  passive('hdualcore', '扩芯弹匣', '红芯上限与当前弹药 +1，可分别嵌入更多目标', ['bloodcore'], () => {
    player.hadesCoreAmmo = Math.min(maxAmmo(), (player.hadesCoreAmmo || 0) + 1);
  });
  passive('hcorewound', '拔芯创口', '红芯自然到期脱落时，对当前宿主造成一次高伤；死亡掉落不触发', ['bloodcore']);
  passive('hshardguard', '遗留守护', '地面上每枚未拾取红芯使你受伤 -6%，最多 -18%', ['bloodcore']);
  passive('hdoomhaste', '催命批注', '死线目标被两个不同主动命中后提前结算，但本次伤害降为 80%', ['doommark']);

  function highTarget(x, y, range, withoutCore) {
    let best = null, hp = -1;
    for (const e of enemies) {
      const reserved = withoutCore && hadesState.shots.some(shot => shot.life > 0 && shot.targetId === e.id);
      if (e.dead || (withoutCore && (e.hadesCoreT > 0 || reserved))) continue;
      if (Math.hypot(e.x - x, e.y - y) > range) continue;
      if (e.hp > hp) { hp = e.hp; best = e; }
    }
    return best;
  }
  function dropShard(x, y) {
    if (hadesState.shards.length >= 4) hadesState.shards.shift();
    hadesState.shards.push({ id: hadesState.nextId++, x, y, t: 0, returning: false });
  }
  function fireCore(a, c) {
    if ((player.hadesCoreAmmo || 0) <= 0 || hadesState.shots.length >= 6) return false;
    const target = highTarget(player.x, player.y, 520, true) || highTarget(player.x, player.y, 520, false);
    if (!target) return false;
    const angle = Math.atan2(target.y - player.y, target.x - player.x), speed = 520 * c.proj;
    player.hadesCoreAmmo--;
    hadesState.shots.push({
      id: hadesState.nextId++, targetId: target.id, x: player.x, y: player.y - 8,
      vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
      life: 1.3 * (1 + c.lifeMul), dmg: 32 * c.dmg * (1 + c.bdmg), c, rad: c.rad * (1 + c.brad)
    });
    return true;
  }
  function fireDoom(a, c) {
    const candidates = enemies.filter(e => !e.dead && !e.hadesDoom && Math.hypot(e.x - player.x, e.y - player.y) <= 620 * c.rad);
    candidates.sort((a0, b0) => b0.hp - a0.hp);
    const marked = candidates.slice(0, 4 + (c.count || 0));
    if (!marked.length) return false;
    for (const target of marked) {
      target.hadesDoom = { t: 1.5, total: 1.5, dmg: 48 * c.dmg, c, sources: Object.create(null) };
      floats.push({ x: target.x, y: target.y - target.r - 28, txt: '死线', t: 0.7, color: c.col, crit: true });
      sparks.push({ x: target.x, y: target.y, t: 0.24, color: c.col });
    }
    novas.push({ x: player.x, y: player.y, t: 0.45, max: 130 * c.rad, col: c.col, c });
    return true;
  }
  function fireRam(a, c) {
    const target = nearestEnemy(player.x, player.y, 185 * c.rad);
    if (!target) return false;
    const angle = Math.atan2(target.y - player.y, target.x - player.x);
    areaHit(target, 18 * c.dmg, c, player.x, player.y);
    if (target.dead) return true;
    const kb = (target.boss ? 90 : (target.elite ? 260 : 540)) * (1 + (c.shock || 0));
    target.kbx = Math.cos(angle) * kb; target.kby = Math.sin(angle) * kb;
    target.hadesRamT = 1.25; target.hadesRamDmg = 42 * c.dmg; target.hadesRamC = c;
    target.hadesBounceUsed = false; target.hadesLastWall = 0;
    return true;
  }
  function makeWall(angle, c) {
    const length = 140 * c.rad, cx = player.x + Math.cos(angle) * 150, cy = player.y + Math.sin(angle) * 150;
    const px = -Math.sin(angle) * length / 2, py = Math.cos(angle) * length / 2;
    return {
      id: hadesState.nextId++, x1: cx - px, y1: cy - py, x2: cx + px, y2: cy + py,
      x: cx, y: cy, t: 4 * c.areaT, c
    };
  }
  function fireWall(a, c) {
    const target = nearestEnemy(player.x, player.y, 430);
    const angle = target ? Math.atan2(target.y - player.y, target.x - player.x) : player.faceA;
    if (hadesState.walls.length >= 2) destroyWall(hadesState.walls[0]);
    hadesState.walls.push(makeWall(angle, c));
    return true;
  }
  function destroyWall(wall) {
    const index = hadesState.walls.indexOf(wall);
    if (index < 0) return;
    hadesState.walls.splice(index, 1);
    if (has('hwallline')) {
      if (hadesState.lines.length >= 2) hadesState.lines.shift();
      hadesState.lines.push({ id: hadesState.nextId++, x1: wall.x1, y1: wall.y1, x2: wall.x2, y2: wall.y2,
        t: 2.5, dmg: 20 * wall.c.dmg, c: wall.c, hits: Object.create(null) });
    }
    sparks.push({ x: wall.x, y: wall.y, t: 0.18, color: WALL_COL });
  }
  function crossing(a, b, c, d) {
    const den = (a.x - b.x) * (c.y - d.y) - (a.y - b.y) * (c.x - d.x);
    if (Math.abs(den) < 0.0001) return false;
    const t = ((a.x - c.x) * (c.y - d.y) - (a.y - c.y) * (c.x - d.x)) / den;
    const u = -((a.x - b.x) * (a.y - c.y) - (a.y - b.y) * (a.x - c.x)) / den;
    return t >= 0 && t <= 1 && u >= 0 && u <= 1;
  }
  function settleDoom(e, multiplier) {
    const doom = e.hadesDoom;
    if (!doom || e.dead) return;
    e.hadesDoom = null;
    const x = e.x, y = e.y, col = doom.c.col || ATTR_COLOR.thunder;
    // 死线也是打击：统一走 areaHit，确保暴击、连段、追加一笔、回锋等辅助真实生效。
    areaHit(e, doom.dmg * multiplier, doom.c, x, y - 30);
    novas.push({ x, y, t: 0.48, max: 82 * doom.c.rad, col, c: doom.c });
    novas.push({ x, y, t: 0.28, max: 48 * doom.c.rad, col: ICE_LIGHT, c: doom.c });
    for (let i = 0; i < 10; i++) {
      const angle = i * Math.PI * 0.2, radius = 16 + (i % 3) * 9;
      sparks.push({ x: x + Math.cos(angle) * radius, y: y + Math.sin(angle) * radius, t: 0.3, color: col });
    }
    floats.push({ x, y: y - e.r - 34, txt: '死线！', t: 0.7, color: col, crit: true });
    shakeT = Math.max(shakeT, 0.08);
  }
  function registerHit(e, skillId) {
    if (!skillId || skillId === 'doommark' || !e.hadesDoom || !has('hdoomhaste')) return;
    const doom = e.hadesDoom;
    doom.sources[skillId] = true;
    if (Object.keys(doom.sources).length >= 2) settleDoom(e, 0.8);
  }
  function bounceTarget(e, excludedWall) {
    let best = null, distance = Infinity;
    for (const wall of hadesState.walls) {
      if (wall.id === excludedWall) continue;
      const d = Math.hypot(wall.x - e.x, wall.y - e.y);
      if (d < distance) { distance = d; best = { x: wall.x, y: wall.y, id: wall.id }; }
    }
    if (best) return best;
    const horizontal = Math.abs(e.kbx) >= Math.abs(e.kby);
    return horizontal ? { x: e.kbx > 0 ? WORLD_L : WORLD_R, y: e.y, id: 0 } : { x: e.x, y: e.kby > 0 ? WORLD_T : WORLD_B, id: 0 };
  }
  function wallHit(e, wallId, multiplier, second) {
    if (e.dead || !(e.hadesRamT > 0) || (e.hadesWallCd || 0) > gameTime) return false;
    const base = e.hadesRamDmg * (multiplier || 1) * (second ? 1.5 : 1);
    e.hadesWallCd = gameTime + 0.45;
    hurtEnemy(e, base, 0, e.x - e.kbx * 0.02, e.y - e.kby * 0.02, 0, 0, 0, CORE_COL, false, 'ramruler');
    floats.push({ x: e.x, y: e.y - e.r - 18, txt: '撞墙！', t: 0.65, color: CORE_COL, crit: true });
    shakeT = Math.max(shakeT, 0.1);
    if (has('hwallwave')) {
      for (const other of enemies) {
        if (other === e || other.dead || Math.hypot(other.x - e.x, other.y - e.y) >= 70 + other.r) continue;
        hurtEnemy(other, base * 0.5, 0, e.x, e.y, 0, 0, 0, CORE_COL, false, 'ramruler');
      }
    }
    if (e.dead) return true;
    e.stunT = Math.max(e.stunT || 0, e.boss ? 0.12 : 0.5);
    if (has('hbounce') && !second) {
      const target = bounceTarget(e, wallId), angle = Math.atan2(target.y - e.y, target.x - e.x);
      e.kbx = Math.cos(angle) * 460; e.kby = Math.sin(angle) * 460;
      e.hadesRamT = 1.2; e.hadesBounceUsed = true; e.hadesLastWall = wallId || 0;
    } else {
      e.hadesRamT = 0; e.hadesRamDmg = 0;
    }
    return true;
  }

  const baseReset = resetGame;
  resetGame = function() { baseReset(); reset(); };

  const baseSupportUsable = supportUsable;
  supportUsable = function(sid, aid) {
    // 红芯采用独立弹药与回收机制，不提供普通弹幕的复放、分裂或命中后行为。
    if (aid === 'bloodcore' && ['multi', 'pierce', 'chain', 'homing', 'blast', 'unleash'].includes(sid)) return false;
    return baseSupportUsable(sid, aid);
  };
  const baseSkillCalc = skillCalc;
  skillCalc = function(a) {
    const c = baseSkillCalc(a); c.hadesSkill = a.id; return c;
  };
  const baseFireBullet = fireBullet;
  fireBullet = function(...args) {
    const first = bullets.length;
    baseFireBullet(...args);
    if (hadesState.casting) for (let i = first; i < bullets.length; i++) bullets[i].hadesSkill = hadesState.casting;
  };
  const baseFireSkill = fireSkill;
  fireSkill = function(a, c) {
    hadesState.casting = a.id;
    try {
      if (a.id === 'bloodcore') return fireCore(a, c);
      if (a.id === 'doommark') return fireDoom(a, c);
      return baseFireSkill(a, c);
    } finally { hadesState.casting = null; }
  };
  const baseUpdateSkills = updateSkills;
  updateSkills = function(dt) {
    if (!player.actives.some(a => a.id === 'bloodcore' && (player.hadesCoreAmmo || 0) <= 0)) return baseUpdateSkills(dt);
    const original = player.actives;
    player.actives = original.filter(a => a.id !== 'bloodcore' || (player.hadesCoreAmmo || 0) > 0);
    try { baseUpdateSkills(dt); } finally { player.actives = original; }
  };
  const baseHurtEnemy = hurtEnemy;
  hurtEnemy = function(e, dmg, dotDps, sx, sy, vuln, critAdd, bossMul, hitCol, weakFloat, skillId) {
    registerHit(e, skillId);
    return baseHurtEnemy(e, dmg, dotDps, sx, sy, vuln, critAdd, bossMul, hitCol, weakFloat, skillId);
  };
  const baseKillEnemy = killEnemy;
  killEnemy = function(e) {
    const core = e.hadesCoreT > 0;
    if (core) { dropShard(e.x, e.y); e.hadesCoreT = 0; }
    baseKillEnemy(e);
  };
  const baseHurtPlayer = hurtPlayer;
  hurtPlayer = function(dmg, kind, source) {
    if (has('hshardguard')) dmg *= 1 - Math.min(0.18, hadesState.shards.length * 0.06);
    return baseHurtPlayer(dmg, kind, source);
  };

  function updateShots(dt) {
    for (const shot of hadesState.shots) {
      shot.x += shot.vx * dt; shot.y += shot.vy * dt; shot.life -= dt;
      if (shot.life <= 0) { dropShard(shot.x, shot.y); continue; }
      for (const e of enemies) {
        // 已附着其他红芯的敌人不再拦截后续投枪，让三连发能到达各自目标。
        if (e.dead || (e.hadesCoreT > 0 && e.id !== shot.targetId) || Math.hypot(e.x - shot.x, e.y - shot.y) >= e.r + 7 * shot.rad) continue;
        hurtEnemy(e, shot.dmg, shot.dmg * shot.c.dot, shot.x, shot.y, shot.c.vuln, shot.c.bcrit, 0, CORE_COL, false, 'bloodcore');
        shot.life = 0;
        if (!e.dead) { e.hadesCoreT = 6; e.hadesCoreC = shot.c; }
        break;
      }
    }
    for (let i = hadesState.shots.length - 1; i >= 0; i--) if (hadesState.shots[i].life <= 0) hadesState.shots.splice(i, 1);
  }
  function updateCurses(dt) {
    for (const e of enemies) {
      if (e.dead) continue;
      e.hadesRamT = Math.max(0, (e.hadesRamT || 0) - dt);
      if (e.hadesDoom) {
        e.hadesDoom.t -= dt;
        if (e.hadesDoom.t <= 0) settleDoom(e, 1);
      }
      if (e.dead) continue;
      if (e.hadesCoreT > 0) {
        e.hadesCoreT -= dt;
        if (e.hadesCoreT <= 0) {
          const c = e.hadesCoreC;
          e.hadesCoreT = 0; dropShard(e.x, e.y);
          if (has('hcorewound') && c) hurtEnemy(e, 34 * c.dmg, 0, e.x, e.y - 20, 0, 0, 0, CORE_COL, false, 'bloodcore');
        }
      }
    }
  }
  function updateWallCollisions(dt) {
    for (const e of enemies) {
      if (e.dead) continue;
      const old = { x: e.hadesPrevX, y: e.hadesPrevY };
      if (e.hadesRamT > 0) {
        const left = WORLD_L + e.r, right = WORLD_R - e.r, top = WORLD_T + e.r, bottom = WORLD_B - e.r;
        if ((e.x <= left && e.hadesPrevKbX < -20) || (e.x >= right && e.hadesPrevKbX > 20) ||
            (e.y <= top && e.hadesPrevKbY < -20) || (e.y >= bottom && e.hadesPrevKbY > 20)) wallHit(e, 0, 1, e.hadesBounceUsed);
      }
      for (let i = hadesState.walls.length - 1; i >= 0; i--) {
        const wall = hadesState.walls[i];
        if (!crossing(old, e, { x: wall.x1, y: wall.y1 }, { x: wall.x2, y: wall.y2 })) continue;
        if (e.boss) { destroyWall(wall); continue; }
        e.x = old.x; e.y = old.y;
        if (e.hadesRamT > 0 && e.hadesLastWall !== wall.id) wallHit(e, wall.id, 1, e.hadesBounceUsed);
        else { e.kbx *= 0.25; e.kby *= 0.25; }
      }
      if (e.dead || !(e.hadesRamT > 0) || !has('henemywall')) continue;
      for (const other of enemies) {
        if (other === e || other.dead || Math.hypot(other.x - e.x, other.y - e.y) >= e.r + other.r + 3) continue;
        wallHit(e, -other.id, 0.6, e.hadesBounceUsed); break;
      }
    }
    for (const eb of ebullets) {
      if (eb.life <= 0) continue;
      const old = { x: eb.hadesPrevX, y: eb.hadesPrevY };
      for (const wall of hadesState.walls) {
        if (!crossing(old, eb, { x: wall.x1, y: wall.y1 }, { x: wall.x2, y: wall.y2 })) continue;
        eb.life = 0; sparks.push({ x: eb.x, y: eb.y, t: 0.18, color: WALL_COL }); break;
      }
    }
    for (let i = hadesState.walls.length - 1; i >= 0; i--) {
      hadesState.walls[i].t -= dt;
      if (hadesState.walls[i].t <= 0) destroyWall(hadesState.walls[i]);
    }
  }
  function updateLines(dt) {
    for (const line of hadesState.lines) {
      line.t -= dt;
      for (const e of enemies) {
        if (e.dead || (line.hits[e.id] || 0) > gameTime) continue;
        if (!crossing({ x: e.hadesPrevX, y: e.hadesPrevY }, e,
          { x: line.x1, y: line.y1 }, { x: line.x2, y: line.y2 })) continue;
        line.hits[e.id] = gameTime + 0.8;
        hurtEnemy(e, line.dmg, 0, e.hadesPrevX, e.hadesPrevY, 0, 0, 0, WALL_COL, false, 'rulerwall');
      }
    }
    for (let i = hadesState.lines.length - 1; i >= 0; i--) if (hadesState.lines[i].t <= 0) hadesState.lines.splice(i, 1);
  }
  function updatePickups(dt) {
    for (const shard of hadesState.shards) {
      shard.t += dt;
      if (shard.t >= CORE_RETURN_DELAY) shard.returning = true;
    }
    for (let i = hadesState.shards.length - 1; i >= 0; i--) {
      const shard = hadesState.shards[i];
      if ((player.hadesCoreAmmo || 0) >= maxAmmo()) continue;
      let dx = player.x - shard.x, dy = player.y - shard.y;
      let distance = Math.hypot(dx, dy);
      if (shard.returning && distance >= 27) {
        const speed = CORE_RETURN_SPEED + Math.min(360, (shard.t - CORE_RETURN_DELAY) * 180);
        const step = Math.min(distance, speed * dt);
        shard.x += dx / distance * step; shard.y += dy / distance * step;
        dx = player.x - shard.x; dy = player.y - shard.y; distance = Math.hypot(dx, dy);
      }
      if (distance >= 27) continue;
      player.hadesCoreAmmo++;
      hadesState.shards.splice(i, 1);
      floats.push({ x: player.x, y: player.y - 34, txt: '红芯回收', t: 0.65, color: CORE_COL, weak: true });
    }
  }
  const baseUpdate = update;
  update = function(dt) {
    for (const e of enemies) {
      e.hadesPrevX = e.x; e.hadesPrevY = e.y; e.hadesPrevKbX = e.kbx; e.hadesPrevKbY = e.kby;
    }
    for (const eb of ebullets) { eb.hadesPrevX = eb.x; eb.hadesPrevY = eb.y; }
    baseUpdate(dt);
    if (state !== 'play') return;
    updateShots(dt); updateCurses(dt); updateWallCollisions(dt); updateLines(dt); updatePickups(dt);
  };

  function draw() {
    for (const line of hadesState.lines) {
      ctx.globalAlpha = Math.min(0.75, line.t); jline(line.x1, line.y1, line.x2, line.y2, WALL_COL, 2);
    }
    ctx.globalAlpha = 1;
    for (const wall of hadesState.walls) {
      ctx.globalAlpha = Math.min(1, wall.t * 2);
      jline(wall.x1, wall.y1, wall.x2, wall.y2, WALL_COL, 7);
      jline(wall.x1, wall.y1, wall.x2, wall.y2, '#a9b2c6', 2);
      jcircle(wall.x1, wall.y1, 4, WALL_COL, 2); jcircle(wall.x2, wall.y2, 4, WALL_COL, 2);
    }
    ctx.globalAlpha = 1;
    for (const shard of hadesState.shards) {
      const y = shard.y + Math.sin(shard.t * 5) * (shard.returning ? 1 : 3);
      if (shard.returning) {
        const angle = Math.atan2(player.y - shard.y, player.x - shard.x), c = Math.cos(angle), s = Math.sin(angle);
        ctx.globalAlpha = 0.35;
        jline(shard.x - c * 24, y - s * 24, shard.x - c * 8, y - s * 8, CORE_COL, 3);
        ctx.globalAlpha = 0.75;
        jcircle(shard.x, y, 12 + Math.sin(shard.t * 10) * 2, CORE_COL, 1.8);
        ctx.globalAlpha = 1;
      }
      jline(shard.x, y - 9, shard.x + 7, y, CORE_COL, 2.5); jline(shard.x + 7, y, shard.x, y + 9, CORE_COL, 2.5);
      jline(shard.x, y + 9, shard.x - 7, y, CORE_COL, 2.5); jline(shard.x - 7, y, shard.x, y - 9, CORE_COL, 2.5);
      jcircle(shard.x, y, 2.5, CORE_COL, 2);
    }
    for (const shot of hadesState.shots) {
      const angle = Math.atan2(shot.vy, shot.vx), c = Math.cos(angle), s = Math.sin(angle);
      jline(shot.x - c * 12, shot.y - s * 12, shot.x + c * 10, shot.y + s * 10, CORE_COL, 3);
      jline(shot.x + c * 10, shot.y + s * 10, shot.x + c * 3 - s * 5, shot.y + s * 3 + c * 5, CORE_COL, 2);
      jline(shot.x + c * 10, shot.y + s * 10, shot.x + c * 3 + s * 5, shot.y + s * 3 - c * 5, CORE_COL, 2);
    }
    for (const e of enemies) {
      if (e.dead) continue;
      const y = e.y - e.r - 12;
      if (e.hadesCoreT > 0) {
        const pulse = 0.5 + Math.sin(gameTime * 8 + e.id) * 0.5;
        ctx.globalAlpha = 0.28 + pulse * 0.2;
        jcircle(e.x, e.y, e.r + 10 + pulse * 3, CORE_COL, 3);
        ctx.globalAlpha = 0.96;
        const sx = e.x + e.r * 0.45 + 8, sy = e.y - e.r - 27, ex = e.x - 4, ey = e.y + 5;
        jline(sx, sy, ex, ey, CORE_COL, 4);
        jline(ex, ey, ex + 1, ey - 10, CORE_COL, 2.5);
        jline(ex, ey, ex + 9, ey - 5, CORE_COL, 2.5);
        jline(sx - 6, sy + 2, sx + 3, sy - 5, '#f08a80', 2);
      }
      if (e.hadesDoom) {
        const doom = e.hadesDoom, doomCol = doom.c.col || ATTR_COLOR.thunder;
        const progress = 1 - doom.t / doom.total;
        const pulse = 1 + Math.sin(progress * Math.PI * 6) * 0.08;
        const size = (13 + e.r * 0.18) * pulse, cy = y - 10;
        ctx.globalAlpha = 0.3 + progress * 0.4;
        jcircle(e.x, e.y, e.r + 11 + progress * 5, doomCol, 2.2);
        ctx.globalAlpha = 0.95;
        ctx.beginPath(); ctx.arc(e.x, cy, size + 6, -Math.PI / 2, -Math.PI / 2 + progress * Math.PI * 2);
        ctx.strokeStyle = doomCol; ctx.lineWidth = 2; ctx.stroke();
        jline(e.x - size * 0.78, cy, e.x - size * 0.2, cy + size * 0.48, doomCol, 3.4);
        jline(e.x - size * 0.2, cy + size * 0.48, e.x + size * 0.88, cy - size * 0.68, doomCol, 3.4);
        ctx.globalAlpha = 0.32;
        jline(e.x - size * 0.72, cy + 2, e.x - size * 0.15, cy + size * 0.48 + 2, ICE_LIGHT, 1.3);
        jline(e.x - size * 0.15, cy + size * 0.48 + 2, e.x + size * 0.94, cy - size * 0.62, ICE_LIGHT, 1.3);
      }
    }
    ctx.globalAlpha = 1;
  }
  const previousExtras = window.__drawWorldExtras;
  window.__drawWorldExtras = function() { if (previousExtras) previousExtras(); draw(); };

  window.__hadesRuntime = {
    state: hadesState, reset, maxAmmo, dropShard, fireWall, wallHit, settleDoom, destroyWall,
    updateShots, updateCurses, updateWallCollisions, updateLines, updatePickups,
    get ids() { return IDS.slice(); }
  };
  resetGame();
})();

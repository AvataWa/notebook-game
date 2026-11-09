/* 其余 Boss 的通用招式框架：每名 Boss 有独立招式表，共用站位、锁定、连段与收招状态机。 */
(function () {
  'use strict';
  const AI = globalThis.BossAI || (typeof require !== 'undefined' ? require('./boss-ai-runtime.js') : null);
  const { clamp, distance, angleTo, turnToward, coneContains } = AI;
  const TAU = Math.PI * 2;
  const CTX = { get player() { return player; } };
  const facePoint = (e, a, d) => ({ x: e.x + Math.cos(a) * d, y: e.y + Math.sin(a) * d });
  const rest = (min, max) => ({ min, max });
  const enraged = id => e => e.phase === 2 ? [id] : [];
  const summonAvailable = () => normalEnemyCount() < normalEnemyCap();
  const move = (name, kind, data) => Object.assign({
    name, kind, weight: 1, cooldown: 0.6, zones: ['any'], rest: rest(0.35, 0.7)
  }, data);
  const cone = (name, data) => move(name, 'cone', Object.assign({
    minRange: 0, maxRange: 320, zones: ['front', 'side'], range: 270, arc: 1.8, damage: 0.85,
    windup: 0.5, active: 0.28, recover: 0.42, lockTime: 0.2
  }, data));
  const charge = (name, data) => move(name, 'charge', Object.assign({
    minRange: 220, maxRange: 920, zones: ['front', 'side'], range: 720, width: 58, speed: 820, damage: 1,
    windup: 0.68, active: 0.76, recover: 0.48, lockTime: 0.25, repositionBonus: 1.5
  }, data));
  const slam = (name, data) => move(name, 'slam', Object.assign({
    minRange: 0, maxRange: 225, radius: 155, damage: 1.05, unparryable: true,
    windup: 0.78, active: 0.4, recover: 0.72, lockTime: 0.34, cooldown: 1.2
  }, data));
  const leap = (name, data) => move(name, 'leap', Object.assign({
    minRange: 240, maxRange: 850, radius: 120, damage: 1, unparryable: true,
    windup: 0.72, active: 0.5, recover: 0.55, lockTime: 0.27, cooldown: 1
  }, data));
  const volley = (name, data) => move(name, 'volley', Object.assign({
    minRange: 230, maxRange: 900, zones: ['front', 'side'], range: 800, count: 3, speed: 360, damage: 0.6,
    windup: 0.68, active: 0.24, recover: 0.5, lockTime: 0.29, cooldown: 1.1
  }, data));
  const ring = (name, data) => move(name, 'ring', Object.assign({
    minRange: 0, maxRange: 720, count: 12, speed: 170, damage: 0.55,
    windup: 0.82, active: 0.3, recover: 0.65, lockTime: 0.35, cooldown: 1.8
  }, data));
  const meteor = (name, data) => move(name, 'meteor', Object.assign({
    minRange: 180, maxRange: 900, count: 5, radius: 58, damage: 0.75, unparryable: true,
    windup: 0.95, active: 0.34, recover: 0.68, lockTime: 0.42, cooldown: 1.8
  }, data));
  const summon = (name, data) => move(name, 'summon', Object.assign({
    minRange: 0, maxRange: 800, zones: ['back', 'side'], count: 3, mob: 'spider', cooldown: 7,
    windup: 0.9, active: 0.25, recover: 0.7, lockTime: 0.4, available: summonAvailable
  }, data));

  const PROFILES = {
    3: { style: 'charger', moves: {
      judgeSlash: cone('判官亲笔', { range: 285, arc: 1.35, combo: enraged('judgeSlash'), chainWindup: 0.32 }),
      judgeCross: cone('红叉宣判', { range: 320, arc: 2.15, damage: 0.95, windup: 0.58, combo: enraged('judgeSlash') }),
      judgeCharge: charge('长笔突刺', { speed: 920, combo: enraged('judgeCharge'), chainWindup: 0.4 }),
      judgeLeap: leap('跃页处刑', { radius: 110 }),
      judgeSlam: slam('朱印落地', { radius: 140 })
    } },
    4: { style: 'caster', moves: {
      dragonBreath: cone('空想龙息', { range: 430, arc: 0.85, active: 0.68, damage: 0.9, maxRange: 450 }),
      dragonMeteor: meteor('幻想陨星', { count: 5, radius: 56 }),
      dragonVolley: volley('星墨吐息', { count: 5 }),
      dragonWing: cone('双翼横扫', { range: 305, arc: 2.4, maxRange: 330 }),
      dragonLeap: leap('巨龙凌空', { radius: 135, combo: enraged('dragonMeteor') })
    } },
    5: { style: 'charger', moves: {
      knightLance: cone('团长骑枪', { range: 345, arc: 0.9, damage: 1, maxRange: 370 }),
      knightShield: charge('盾牌碾阵', { speed: 720, width: 82, unparryable: true, damage: 1.1 }),
      knightSweep: cone('骑士回旋', { range: 295, arc: 2.5, combo: enraged('knightSweep'), chainWindup: 0.34 }),
      knightSummon: summon('涂鸦列队', { mob: 'rage', count: 3 }),
      knightSlam: slam('盾面重击', { radius: 155 })
    } },
    6: { style: 'blob', moves: {
      elementRing: ring('元素墨环', { count: 14 }),
      elementInk: meteor('墨雨淤积', { count: 3, radius: 84, ink: true }),
      elementSlam: slam('液核心潮', { radius: 170 }),
      elementVolley: volley('凝墨喷流', { count: 4, speed: 310 }),
      elementSummon: summon('分裂墨蛛', { count: 3 })
    } },
    7: { style: 'caster', moves: {
      origamiBreath: cone('折纸焰息', { range: 460, arc: 0.72, active: 0.65, maxRange: 480 }),
      origamiMeteor: meteor('千纸坠落', { count: 7, radius: 53 }),
      origamiVolley: volley('纸刃齐射', { count: 7, speed: 400 }),
      origamiCharge: charge('龙王折冲', { speed: 850, combo: enraged('origamiCharge') }),
      origamiLeap: leap('展翼扑杀', { radius: 140 })
    } },
    8: { style: 'charger', moves: {
      eraserCharge: charge('暴走摩擦', { speed: 1020, active: 0.85, combo: enraged('eraserCharge'), chainWindup: 0.38 }),
      eraserSlam: slam('橡皮墩地', { radius: 180 }),
      eraserSweep: cone('包装纸横扫', { range: 305, arc: 2.2 }),
      eraserLeap: leap('橡皮弹跳', { radius: 135 }),
      eraserRing: ring('碎屑崩飞', { count: 10, speed: 230 })
    } },
    9: { style: 'blob', moves: {
      abyssRing: ring('深渊墨潮', { count: 18, speed: 185 }),
      abyssInk: meteor('万墨沉没', { count: 5, radius: 94, ink: true }),
      abyssSlam: slam('深渊张口', { radius: 195, damage: 1.15 }),
      abyssVolley: volley('触手喷墨', { count: 6, speed: 330 }),
      abyssSummon: summon('渊底孵化', { count: 4 })
    } },
    10: { style: 'caster', moves: {
      notebookSlash: cone('终页裁切', { range: 335, arc: 2, combo: enraged('notebookSlash') }),
      notebookMeteor: meteor('万页终局', { count: 8, radius: 60 }),
      notebookRing: ring('全书墨弹', { count: 20, speed: 195 }),
      notebookCharge: charge('封面撞击', { speed: 920, combo: enraged('notebookCharge') }),
      notebookInk: meteor('作者涂改', { count: 4, radius: 90, ink: true }),
      notebookSummon: summon('角色出库', { mob: 'rage', count: 4 })
    } }
  };

  const controllers = {};
  function profile(e) { return PROFILES[e.stage]; }
  function controllerFor(e) { return controllers[e.stage]; }
  function moveOf(e) { return profile(e).moves[e.attack]; }
  function warningColor(m) { return m.unparryable ? DARK : RED; }
  function phaseRest(e, m) {
    const r = m.rest || rest(0.35, 0.7);
    return (r.min + Math.random() * (r.max - r.min)) * (e.phase === 2 ? 0.82 : 1);
  }
  function parry(e, range) {
    if (player.absorbT <= 0 || distance(e, player) > range + player.absorbRadius) return false;
    hitStopT = Math.max(hitStopT, ABSORB_RULE.hitStop);
    hurtEnemy(e, e.dmg * 1.5 * (player.metaAbsorbMul || 1), 0, player.x, player.y, 0, 0, 0, inkFriendlyColor);
    rewardAbsorb(ABSORB_RULE.meleeInk); chargeParry();
    floats.push({ x: player.x, y: player.y - 45, txt: '弹反！', t: 0.7, color: inkFriendlyColor, crit: true });
    sparks.push({ x: e.x, y: e.y, t: 0.24, color: inkFriendlyColor });
    castMeleeInkSurge(); shakeT = Math.max(shakeT, 0.12);
    controllerFor(e).interrupt(e, 'recover', 0.95, CTX);
    return true;
  }
  function hitPlayer(e, m, point) {
    if (m.unparryable && player.absorbT > 0) unparryableFeedback(player.x, player.y);
    hurtPlayer(Math.round(e.dmg * m.damage), 'enemy', e);
    const x = point ? point.x : e.x, y = point ? point.y : e.y, col = warningColor(m);
    novas.push({ x, y, t: 0.24, max: m.radius || 65, col });
    for (let i = 0; i < 10; i++) {
      const a = i / 10 * TAU;
      sparks.push({ x: x + Math.cos(a) * 35, y: y + Math.sin(a) * 35, t: 0.3,
        color: m.unparryable && i % 3 === 0 ? WARN_YELLOW : col });
    }
  }
  function targetsFor(e, m) {
    if (e.standardTargets && e.standardTargetsMove === e.attack) return e.standardTargets;
    const targets = [], count = m.count || 1;
    for (let i = 0; i < count; i++) {
      if (i === 0) targets.push({ x: e.targetX, y: e.targetY });
      else {
        const a = (i - 1) / Math.max(1, count - 1) * TAU + e.id * 0.37, d = 90 + (i % 2) * 45;
        targets.push({ x: clampW(e.targetX + Math.cos(a) * d, m.radius), y: clampH(e.targetY + Math.sin(a) * d, m.radius) });
      }
    }
    return targets;
  }
  function resolveCone(e, m) {
    if (e.actionHit) return;
    const a = e.faceA || 0;
    if (!m.unparryable && player.absorbT > 0 && coneContains(e, a, m.range, m.arc, player, player.absorbRadius) && parry(e, m.range)) return;
    if (coneContains(e, a, m.range, m.arc, player, player.r)) {
      e.actionHit = true;
      if (m.unparryable && player.absorbT > 0) unparryableFeedback(player.x, player.y);
      hurtPlayer(Math.round(e.dmg * m.damage), 'enemy', e);
    }
  }
  function resolveSlam(e, m) {
    if (e.attackResolved) return;
    e.attackResolved = true;
    if (distance(e, player) < m.radius + player.r) hitPlayer(e, m);
    else {
      novas.push({ x: e.x, y: e.y, t: 0.24, max: m.radius, col: warningColor(m) });
      for (let i = 0; i < 10; i++) sparks.push({ x: e.x + Math.cos(i / 10 * TAU) * m.radius * 0.65,
        y: e.y + Math.sin(i / 10 * TAU) * m.radius * 0.65, t: 0.3, color: m.unparryable && i % 3 === 0 ? WARN_YELLOW : warningColor(m) });
    }
    shakeT = Math.max(shakeT, 0.25);
  }
  function resolveTargets(e, m) {
    if (e.attackResolved) return;
    e.attackResolved = true;
    for (const p of targetsFor(e, m)) {
      if (m.ink) addHostileInk(p.x, p.y, 2, m.radius, e.id);
      if (distance(p, player) < m.radius + player.r) hitPlayer(e, m, p);
      else {
        novas.push({ x: p.x, y: p.y, t: 0.24, max: m.radius, col: warningColor(m) });
        for (let i = 0; i < 5; i++) sparks.push({ x: p.x + Math.cos(i / 5 * TAU) * 30, y: p.y + Math.sin(i / 5 * TAU) * 30,
          t: 0.28, color: m.unparryable && i === 0 ? WARN_YELLOW : warningColor(m) });
      }
    }
    shakeT = Math.max(shakeT, 0.2);
  }
  function fireProjectiles(e, m) {
    const count = m.count + (e.phase === 2 && m.kind === 'volley' ? 2 : 0);
    for (let i = 0; i < count; i++) {
      const a = m.kind === 'ring' ? i / count * TAU + e.walk * 0.1 : (e.faceA || 0) + (i - (count - 1) / 2) * 0.16;
      ebullets.push({ x: e.x + Math.cos(a) * (e.r + 10), y: e.y + Math.sin(a) * (e.r + 10),
        vx: Math.cos(a) * m.speed, vy: Math.sin(a) * m.speed, dmg: Math.round(e.dmg * m.damage),
        life: 3.4, sourceId: e.id, reflectable: true });
    }
    shakeT = Math.max(shakeT, 0.12);
  }
  function releaseMinions(e, m) {
    const base = (e.faceA || 0) + Math.PI;
    for (let i = 0; i < m.count; i++) {
      const a = base + (i - (m.count - 1) / 2) * 0.5;
      summonMob(m.mob, e.x + Math.cos(a) * (e.r + 32), e.y + Math.sin(a) * (e.r + 32));
    }
    toast(e.name + ' 使用了 ' + m.name + '！');
  }
  function resolveLeap(e, m) {
    if (e.attackResolved) return;
    e.attackResolved = true;
    const p = { x: e.targetX, y: e.targetY };
    if (distance(p, player) < m.radius + player.r) hitPlayer(e, m, p);
    else novas.push({ x: p.x, y: p.y, t: 0.24, max: m.radius, col: DARK });
    shakeT = Math.max(shakeT, 0.22);
  }

  function hooks() {
    return {
      aim(e, ctx, m) {
        if (!['slam', 'ring', 'summon'].includes(m.kind)) e.faceA = angleTo(e, player);
        e.targetX = player.x; e.targetY = player.y;
        e.attackStartX = e.x; e.attackStartY = e.y;
        e.lockDx = Math.cos(e.faceA || 0); e.lockDy = Math.sin(e.faceA || 0);
        e.standardTargets = null; e.standardTargetsMove = null;
      },
      track(e, ctx, dt, m) {
        if (['slam', 'ring', 'summon'].includes(m.kind)) return;
        turnToward(e, angleTo(e, player), dt * (m.kind === 'charge' ? 1.9 : 2.6));
        e.lockDx = Math.cos(e.faceA || 0); e.lockDy = Math.sin(e.faceA || 0);
        if (['leap', 'meteor'].includes(m.kind)) {
          e.targetX = player.x; e.targetY = player.y; e.standardTargets = null;
        }
      },
      lock(e, ctx, m) {
        e.lockDx = Math.cos(e.faceA || 0); e.lockDy = Math.sin(e.faceA || 0);
        e.attackStartX = e.x; e.attackStartY = e.y;
        if (m.kind === 'meteor') { e.standardTargets = targetsFor(e, m); e.standardTargetsMove = e.attack; }
      },
      beginActive(e, ctx, m) {
        e.attackStartX = e.x; e.attackStartY = e.y;
        if (m.kind === 'volley' || m.kind === 'ring') fireProjectiles(e, m);
        else if (m.kind === 'meteor') resolveTargets(e, m);
        else if (m.kind === 'summon') releaseMinions(e, m);
      },
      active(e, ctx, dt, m) {
        const progress = clamp(1 - e.huntT / e.activeDuration, 0, 1);
        if (m.kind === 'cone') resolveCone(e, m);
        else if (m.kind === 'slam' && progress > 0.36) resolveSlam(e, m);
        else if (m.kind === 'meteor') resolveTargets(e, m);
        else if (m.kind === 'charge') {
          if (!m.unparryable && player.absorbT > 0 && distance(e, player) < e.r + player.absorbRadius + 18 && parry(e, e.r + 28)) return;
          const nx = clampW(e.x + e.lockDx * m.speed * dt, e.r), ny = clampH(e.y + e.lockDy * m.speed * dt, e.r);
          if (Math.abs(nx - e.x) < 0.001 && Math.abs(ny - e.y) < 0.001) e.huntT = 0;
          e.x = nx; e.y = ny;
          if (!e.actionHit && distance(e, player) < e.r + player.r + m.width * 0.3) {
            e.actionHit = true;
            if (m.unparryable && player.absorbT > 0) unparryableFeedback(player.x, player.y);
            hurtPlayer(Math.round(e.dmg * m.damage), 'enemy', e);
          }
        } else if (m.kind === 'leap') {
          e.x = e.attackStartX + (e.targetX - e.attackStartX) * progress;
          e.y = e.attackStartY + (e.targetY - e.attackStartY) * progress;
          e.pounceHeight = Math.sin(progress * Math.PI) * 52;
          if (progress > 0.82) resolveLeap(e, m);
        }
      },
      finishActive(e, ctx, m) {
        if (m.kind === 'leap') { e.x = e.targetX; e.y = e.targetY; e.pounceHeight = 0; resolveLeap(e, m); }
      },
      chase(e, ctx, dt) {
        const pa = angleTo(e, player), d = distance(e, player), style = profile(e).style;
        turnToward(e, pa, dt * 3.2);
        const ideal = style === 'caster' ? 310 : style === 'blob' ? 235 : 175;
        let dir = 0;
        if (d > ideal + 45) dir = 1; else if (d < ideal - 65) dir = -0.7;
        if (dir) {
          e.x = clampW(e.x + Math.cos(pa) * e.sp * dir * dt, e.r);
          e.y = clampH(e.y + Math.sin(pa) * e.sp * dir * dt, e.r);
        }
      },
      reposition(e, ctx, dt) {
        const pa = angleTo(e, player), a = pa + (e.ai.repositionSide || 1) * Math.PI / 2;
        turnToward(e, pa, dt * 4);
        e.x = clampW(e.x + Math.cos(a) * 150 * dt, e.r);
        e.y = clampH(e.y + Math.sin(a) * 150 * dt, e.r);
      },
      shouldReposition(e, ctx, m) { return m && !['slam', 'summon'].includes(m.kind) && Math.random() < 0.3; },
      nextDelay(e, ctx, m) { return phaseRest(e, m); },
      shouldFatigue: (e, ctx, count) => count >= (e.stage === 10 ? 7 : 5),
      fatigueDuration: e => e.stage === 10 ? 2.4 : 2.8,
      fatigued(e) { toast(e.name + ' 招式用尽，露出了破绽！'); shakeT = Math.max(shakeT, 0.18); },
      beforeUpdate(e, ctx, dt) {
        if (e.phase === 1 && e.hp < e.maxhp * (player.metaBossPhaseAt || 0.5)) {
          e.phase = 2; e.sp *= 1.12; crumpleT = 0.7; shakeT = 0.45;
          toast(e.name + ' 暴走了：招式派生与攻击节奏强化！');
        }
        e.walk += dt * (e.huntMode === 'chase' || e.huntMode === 'reposition' ? 4 : 1.4);
      }
    };
  }
  for (const [stage, p] of Object.entries(PROFILES)) controllers[stage] = AI.createController({ moves: p.moves, hooks: hooks() });

  function init(e) {
    if (!PROFILES[e.stage]) return;
    e.huntBoss = true; e.bossAI = 'standard'; e.faceA = angleTo(e, player);
    e.attack = null; e.pounceHeight = 0; e.standardTargets = null;
    controllerFor(e).init(e, CTX, 1);
  }
  function update(e, dt) {
    if (!e.huntBoss || e.bossAI !== 'standard' || !profile(e)) return false;
    controllerFor(e).update(e, CTX, dt); return true;
  }
  function drawSector(e, m, active) {
    const a = e.faceA || 0, a0 = a - m.arc / 2, a1 = a + m.arc / 2, col = active ? RED : ENEMY_AIM;
    ctx.save(); ctx.globalAlpha = active ? 0.16 : 0.24; ctx.fillStyle = col;
    if (active) { ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.arc(e.x, e.y, m.range, a0, a1); ctx.closePath(); ctx.fill(); }
    ctx.globalAlpha = active ? 0.92 : 0.48;
    for (const edge of [a0, a1]) jline(e.x, e.y, e.x + Math.cos(edge) * m.range, e.y + Math.sin(edge) * m.range, col, active ? 3.5 : 1.7);
    const sweep = active ? Math.max(0.12, (1 - e.huntT / e.activeDuration) * m.arc) : m.arc;
    for (let band = 0; band < (active ? 3 : 1); band++) {
      const rr = m.range * (active ? 0.65 + band * 0.15 : 1);
      for (let i = 0; i < 16; i++) {
        const aa = a0 + sweep * i / 16, bb = a0 + sweep * (i + 1) / 16;
        jline(e.x + Math.cos(aa) * rr, e.y + Math.sin(aa) * rr, e.x + Math.cos(bb) * rr, e.y + Math.sin(bb) * rr, col, active ? 4 : 1.7);
      }
    }
    ctx.restore();
  }
  function drawCircle(e, m, x, y, active, showLabel = true) {
    const r = m.radius;
    if (m.unparryable) drawUnparryableCircleArea(x, y, r, active);
    ctx.save(); ctx.globalAlpha = active ? 0.17 : 0.26; ctx.fillStyle = warningColor(m);
    if (active) { ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); }
    ctx.globalAlpha = active ? 0.95 : 0.68;
    jcircle(x, y, r, active ? warningColor(m) : (m.unparryable ? DARK : ENEMY_AIM), active ? 4.5 : 2);
    if (active) jcircle(x, y, r * 0.65, m.unparryable ? WARN_YELLOW : RED, 2.5);
    if (m.unparryable) { drawUnparryableMark(x, y, 11); if (!active && showLabel) drawDiveOnlyLabel({ x, y, r: 0 }); }
    ctx.restore();
  }
  function drawCharge(e, m, active) {
    const start = { x: e.x, y: e.y }, end = facePoint(e, e.faceA || 0, m.range);
    if (m.unparryable) drawUnparryableSegmentArea(start, end, m.width, active);
    ctx.save(); ctx.globalAlpha = active ? 0.9 : 0.46;
    for (let d = e.r + 12; d < m.range; d += 42) {
      const p0 = facePoint(e, e.faceA || 0, d), p1 = facePoint(e, e.faceA || 0, d + 24);
      jline(p0.x, p0.y, p1.x, p1.y, m.unparryable ? DARK : (active ? RED : ENEMY_AIM), active ? 4 : 2);
    }
    if (m.unparryable) { jline(start.x, start.y, end.x, end.y, WARN_YELLOW, active ? 3 : 1.5); drawUnparryableMark(end.x, end.y, 12); }
    ctx.restore();
  }
  function drawProjectiles(e, m, active) {
    const count = m.count + (e.phase === 2 && m.kind === 'volley' ? 2 : 0);
    ctx.save(); ctx.globalAlpha = active ? 0.85 : 0.38;
    for (let i = 0; i < count; i++) {
      const a = m.kind === 'ring' ? i / count * TAU + e.walk * 0.1 : (e.faceA || 0) + (i - (count - 1) / 2) * 0.16;
      const p0 = facePoint(e, a, e.r + 15), p1 = facePoint(e, a, e.r + 70);
      jline(p0.x, p0.y, p1.x, p1.y, active ? RED : ENEMY_AIM, active ? 3 : 1.6);
    }
    ctx.restore();
  }
  function drawSummon(e, active) {
    ctx.save(); ctx.globalAlpha = active ? 0.8 : 0.38;
    for (let i = 0; i < 3; i++) {
      const a = (e.faceA || 0) + Math.PI + (i - 1) * 0.55, p = facePoint(e, a, e.r + 34);
      jcircle(p.x, p.y, 17, active ? RED : ENEMY_AIM, 1.8);
    }
    ctx.restore();
  }
  function drawTelegraph(e) {
    const m = moveOf(e), active = e.huntMode === 'active';
    if (e.huntMode === 'reposition') { ctx.save(); ctx.globalAlpha = 0.2; jcircle(e.x, e.y, e.r + 13, ENEMY_AIM, 1.5); ctx.restore(); return; }
    if (!m || (e.huntMode !== 'windup' && !active)) return;
    if (m.kind === 'cone') drawSector(e, m, active);
    else if (m.kind === 'slam') drawCircle(e, m, e.x, e.y, active);
    else if (m.kind === 'leap') drawCircle(e, m, e.targetX, e.targetY, active);
    else if (m.kind === 'meteor') targetsFor(e, m).forEach((p, i) => drawCircle(e, m, p.x, p.y, active, i === 0));
    else if (m.kind === 'charge') drawCharge(e, m, active);
    else if (m.kind === 'volley' || m.kind === 'ring') drawProjectiles(e, m, active);
    else if (m.kind === 'summon') drawSummon(e, active);
  }
  function drawAttachments(e) {
    const m = moveOf(e);
    if (!m || e.huntMode !== 'active') return;
    if (m.kind === 'charge') {
      const nx = -e.lockDy, ny = e.lockDx;
      for (let i = 0; i < 7; i++) {
        const side = (i - 3) * 15, x = e.x + nx * side, y = e.y + ny * side;
        jline(x, y, x - e.lockDx * 65, y - e.lockDy * 65, m.unparryable && i === 3 ? WARN_YELLOW : warningColor(m), 3);
      }
    }
  }
  function drawHUD(e, bx, by) {
    if (!e.huntBoss || e.bossAI !== 'standard') return;
    const labels = { chase: '观察站位', reposition: '侧向换位', windup: '前摇', active: '出手', recover: '收招破绽', comboWait: '连段蓄势', fatigue: '疲惫大破绽' };
    const m = moveOf(e);
    ctx.textAlign = 'left'; ctx.font = 'bold 9px ' + FONT; ctx.fillStyle = e.huntMode === 'fatigue' ? PURPLE : DARK;
    ctx.fillText((m ? m.name + ' · ' : '') + (labels[e.huntMode] || '招式重整'), bx, by + 26);
  }

  globalThis.BossStandardRuntime = {
    PROFILES, init, update, drawTelegraph, drawAttachments, drawHUD,
    onDamage() {},
    chooseAttack: e => controllerFor(e).choose(e, CTX),
    startAttack: (e, kind, chained) => controllerFor(e).start(e, kind, CTX, { chained: !!chained }),
    finishMove: e => controllerFor(e).finishMove(e, CTX),
    debugCandidates: e => controllerFor(e).candidates(e, CTX).map(m => m.id)
  };
})();

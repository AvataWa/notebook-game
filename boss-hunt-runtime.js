/* 乱线魔王：基于通用 BossAI 的迅龙式站位、派生、连段与部位状态。 */
(function () {
  'use strict';
  const AI = globalThis.BossAI || (typeof require !== 'undefined' ? require('./boss-ai-runtime.js') : null);
  const { norm, clamp, distance, angleTo, turnToward, coneContains, pointSegmentDistance } = AI;
  const TAU = Math.PI * 2;
  const RULE = Object.freeze({
    hornHp: 320, tailHp: 190,
    biteRange: 185, biteArc: 0.95,
    clawRange: 310, clawArc: 2.2,
    tailRange: 290, tailArc: 2.5,
    spinRange: 250,
    tailSlamRange: 430, tailSlamWidth: 76,
    chargeRange: 720,
    comboSlashRange: 260, comboSlashArc: 1.45,
    pounceRadius: 200,
    quillRange: 900,
    fatigueMoves: 4, fatigueTime: 2.5, breakDownTime: 3,
    tailRegenTime: 8
  });
  const CTX = { get player() { return player; } };
  const facePoint = (e, angle, d) => ({ x: e.x + Math.cos(angle) * d, y: e.y + Math.sin(angle) * d });
  const rearAngle = e => (e.faceA || 0) + Math.PI;
  const hornPoint = e => facePoint(e, e.faceA || 0, e.r * 1.02);
  const tailPoint = e => facePoint(e, rearAngle(e), e.r * 1.15);
  const phaseCombo = id => e => e.phase === 2 ? [id] : [];
  const rest = (min, max) => ({ min, max });
  const MOVES = {
    bite: {
      minRange: 0, maxRange: 195, zones: ['front'], weight: 1.35, cooldown: 0.25,
      windup: 0.3, active: 0.16, recover: 0.24, lockTime: 0.1, rest: rest(0.12, 0.3)
    },
    claw: {
      minRange: 65, maxRange: 340, zones: ['front', 'side'], weight: 1.15, cooldown: 0.35,
      windup: 0.46, active: 0.24, recover: 0.3, lockTime: 0.15, rest: rest(0.15, 0.35)
    },
    tail: {
      minRange: 55, maxRange: 330, zones: ['back', 'side'], weight: 1.2, cooldown: 0.4,
      windup: 0.5, active: 0.26, recover: 0.32, lockTime: 0.16, rest: rest(0.15, 0.38)
    },
    spin: {
      minRange: 0, maxRange: 275, zones: ['any'], weight: 0.72, cooldown: 1.8,
      windup: 0.62, active: 0.36, recover: 0.45, lockTime: 0.2, comboDelay: 0.2,
      chainWindup: 0.34, chainRecover: 0.5, combo: phaseCombo('spin'), rest: rest(0.3, 0.55)
    },
    tailSlam: {
      minRange: 85, maxRange: 465, zones: ['back', 'side'], weight: 0.85, cooldown: 2.1,
      windup: 0.78, active: 0.22, recover: 1.45, lockTime: 0.28, comboDelay: 0.28,
      chainWindup: 0.48, chainRecover: 1.7, combo: phaseCombo('tailSlam'), rest: rest(0.45, 0.75)
    },
    charge: {
      minRange: 300, maxRange: 920, zones: ['front', 'side'], weight: 1.0, cooldown: 0.8,
      windup: 0.62, active: 0.8, recover: 0.38, lockTime: 0.22, comboDelay: 0.16,
      chainWindup: 0.38, combo: phaseCombo('charge'), rest: rest(0.2, 0.45)
    },
    comboSlash: {
      minRange: 220, maxRange: 720, zones: ['front', 'side'], weight: 1.05, cooldown: 2.2,
      windup: 0.46, active: 0.28, recover: 0.28, lockTime: 0.15, comboDelay: 0.15,
      chainWindup: 0.3, combo: () => ['comboSlash', 'pounce'], repositionBonus: 1.8, rest: rest(0.25, 0.45)
    },
    pounce: {
      minRange: 250, maxRange: 820, zones: ['any'], weight: 0.95, cooldown: 0.8,
      windup: 0.68, active: 0.5, recover: 0.5, lockTime: 0.25, chainWindup: 0.42, rest: rest(0.35, 0.65)
    },
    quills: {
      minRange: 320, maxRange: 920, zones: ['back', 'side'], weight: 1.1, cooldown: 3,
      windup: 0.72, active: 0.3, recover: 0.48, lockTime: 0.28, rest: rest(0.25, 0.5),
      available: e => e.tailSpikes > 0
    }
  };
  const ATTACKS = Object.freeze(Object.fromEntries(Object.entries(MOVES).map(([id, m]) => [id,
    Object.freeze({ windup: m.windup, active: m.active, recover: m.recover })])));

  function setFacingForMove(e, id) {
    const pa = angleTo(e, player);
    if (id === 'tail' || id === 'tailSlam' || id === 'quills') {
      // 尾部招式的“前方”保持远离玩家，不能起手时把尾巴转反。
      if (id !== 'tail' || Math.abs(norm(pa - (e.faceA || 0))) < Math.PI / 2) e.faceA = norm(pa + Math.PI);
    } else if (id !== 'spin') e.faceA = pa;
  }
  function approach(e, dt, speed, stop) {
    const d = distance(e, player), pa = angleTo(e, player);
    if (d <= stop || d > 520) return;
    const step = Math.min(speed * dt, d - stop);
    e.x = clampW(e.x + Math.cos(pa) * step, e.r);
    e.y = clampH(e.y + Math.sin(pa) * step, e.r);
  }
  function parry(e, range) {
    if (player.absorbT <= 0 || distance(e, player) > range + player.absorbRadius) return false;
    hitStopT = Math.max(hitStopT, ABSORB_RULE.hitStop);
    hurtEnemy(e, e.dmg * 1.5 * (player.metaAbsorbMul || 1), 0, player.x, player.y, 0, 0, 0, inkFriendlyColor);
    addPartDamage(e, 55);
    rewardAbsorb(ABSORB_RULE.meleeInk); chargeParry();
    floats.push({ x: player.x, y: player.y - 45, txt: '弹反！', t: 0.7, color: inkFriendlyColor, crit: true });
    sparks.push({ x: e.x, y: e.y, t: 0.24, color: inkFriendlyColor });
    castMeleeInkSurge(); shakeT = Math.max(shakeT, 0.1);
    if (!e.hornBroken) controller.interrupt(e, 'recover', 0.85, CTX);
    return true;
  }
  function resolveCone(e, id) {
    if (e.actionHit) return;
    let range, arc, angle, mul;
    if (id === 'bite') { range = RULE.biteRange; arc = RULE.biteArc; angle = e.faceA || 0; mul = 0.65; }
    else if (id === 'claw') { range = RULE.clawRange; arc = RULE.clawArc; angle = e.faceA || 0; mul = 0.85; }
    else if (id === 'comboSlash') { range = RULE.comboSlashRange; arc = RULE.comboSlashArc; angle = e.faceA || 0; mul = 0.75; }
    else { range = RULE.tailRange; arc = RULE.tailArc; angle = rearAngle(e); mul = 0.95; }
    if (player.absorbT > 0 && coneContains(e, angle, range, arc, player, player.absorbRadius) && parry(e, range)) return;
    if (coneContains(e, angle, range, arc, player, player.r)) {
      e.actionHit = true; hurtPlayer(Math.round(e.dmg * mul), 'enemy', e);
    }
  }
  function resolveSpin(e) {
    if (e.actionHit) return;
    const d = distance(e, player);
    if (player.absorbT > 0 && d < RULE.spinRange + player.absorbRadius && parry(e, RULE.spinRange)) return;
    if (d < RULE.spinRange + player.r) {
      e.actionHit = true; hurtPlayer(Math.round(e.dmg * 0.95), 'enemy', e);
    }
  }
  function slamSegment(e) {
    const start = { x: e.x, y: e.y }, end = facePoint(e, rearAngle(e), RULE.tailSlamRange);
    return { start, end };
  }
  function resolveTailSlam(e) {
    if (e.attackResolved) return;
    e.attackResolved = true;
    const { start, end } = slamSegment(e);
    const d = pointSegmentDistance(player, start, end);
    if (d < RULE.tailSlamWidth + player.r) {
      if (player.absorbT > 0) unparryableFeedback(player.x, player.y);
      hurtPlayer(Math.round(e.dmg * 1.3), 'enemy', e);
    }
    shakeT = Math.max(shakeT, 0.26);
    for (let i = 0; i < 10; i++) sparks.push({ x: end.x + (i - 5) * 8, y: end.y + Math.sin(i) * 18, t: 0.32, color: i % 3 === 0 ? WARN_YELLOW : DARK });
  }
  function resolvePounce(e) {
    if (e.attackResolved) return;
    e.attackResolved = true;
    const landing = { x: e.targetX, y: e.targetY };
    if (distance(landing, player) < RULE.pounceRadius + player.r) {
      if (player.absorbT > 0) unparryableFeedback(player.x, player.y);
      hurtPlayer(Math.round(e.dmg * 1.05), 'enemy', e);
    }
    novas.push({ x: landing.x, y: landing.y, t: 0.25, max: RULE.pounceRadius, col: DARK });
    shakeT = Math.max(shakeT, 0.22);
    for (let i = 0; i < 12; i++) {
      const a = i / 12 * TAU;
      sparks.push({ x: landing.x + Math.cos(a) * 45, y: landing.y + Math.sin(a) * 45, t: 0.28, color: i % 3 === 0 ? WARN_YELLOW : DARK });
    }
  }
  function fireQuills(e) {
    const count = e.phase === 2 ? 7 : 5, base = rearAngle(e), origin = tailPoint(e);
    for (let i = 0; i < count; i++) {
      const a = base + (i - (count - 1) / 2) * 0.17;
      ebullets.push({ x: origin.x, y: origin.y, vx: Math.cos(a) * 440, vy: Math.sin(a) * 440,
        dmg: Math.round(e.dmg * 0.55), life: 2.15, sourceId: e.id, reflectable: true, kind: 'quill' });
    }
    e.tailSpikes = 0; e.tailSpikeRegen = RULE.tailRegenTime;
    for (let i = 0; i < 8; i++) sparks.push({ x: origin.x + (i - 4) * 5, y: origin.y, t: 0.25, color: RED });
  }

  const controller = AI.createController({
    moves: MOVES,
    hooks: {
      aim(e, ctx, move) {
        setFacingForMove(e, move.id);
        e.attackStartX = e.x; e.attackStartY = e.y;
        e.targetX = player.x; e.targetY = player.y;
        e.lockDx = Math.cos(e.faceA || 0); e.lockDy = Math.sin(e.faceA || 0);
        if (move.id === 'spin') e.spinDir = (e.spinDir || 1) * -1;
      },
      track(e, ctx, dt, move) {
        const id = move.id, pa = angleTo(e, player);
        if (id === 'spin') return;
        const target = (id === 'tail' || id === 'tailSlam' || id === 'quills') ? norm(pa + Math.PI) : pa;
        turnToward(e, target, dt * (id === 'charge' ? 2.2 : 3.2));
        e.lockDx = Math.cos(e.faceA || 0); e.lockDy = Math.sin(e.faceA || 0);
        if (id === 'pounce') { e.targetX = player.x; e.targetY = player.y; }
        if (id === 'bite') approach(e, dt, 190, 70);
        else if (id === 'claw' || id === 'tail') approach(e, dt, 160, 90);
        else if (id === 'comboSlash') approach(e, dt, 140, 150);
      },
      lock(e, ctx, move) {
        e.lockDx = Math.cos(e.faceA || 0); e.lockDy = Math.sin(e.faceA || 0);
        e.attackStartX = e.x; e.attackStartY = e.y;
      },
      beginActive(e, ctx, move) {
        e.attackStartX = e.x; e.attackStartY = e.y;
        if (move.id === 'charge') shakeT = Math.max(shakeT, 0.12);
        else if (move.id === 'tailSlam') { shakeT = Math.max(shakeT, 0.2); resolveTailSlam(e); }
        else if (move.id === 'quills') fireQuills(e);
      },
      active(e, ctx, dt, move) {
        const id = move.id;
        if (id === 'bite' || id === 'claw' || id === 'tail' || id === 'comboSlash') resolveCone(e, id);
        if (id === 'comboSlash') {
          e.x = clampW(e.x + e.lockDx * 620 * dt, e.r);
          e.y = clampH(e.y + e.lockDy * 620 * dt, e.r);
        } else if (id === 'spin') resolveSpin(e);
        else if (id === 'tailSlam') resolveTailSlam(e);
        else if (id === 'charge') {
          if (parry(e, e.r + 8)) return;
          const nx = clampW(e.x + e.lockDx * 910 * dt, e.r), ny = clampH(e.y + e.lockDy * 910 * dt, e.r);
          if (Math.abs(nx - e.x) < 0.001 && Math.abs(ny - e.y) < 0.001) e.huntT = 0;
          e.x = nx; e.y = ny;
          if (!e.actionHit && distance(e, player) < e.r + player.r + 7) {
            e.actionHit = true; hurtPlayer(e.dmg, 'enemy', e);
          }
        } else if (id === 'pounce') {
          const t = clamp(1 - e.huntT / e.activeDuration, 0, 1);
          e.x = e.attackStartX + (e.targetX - e.attackStartX) * t;
          e.y = e.attackStartY + (e.targetY - e.attackStartY) * t;
          e.pounceHeight = Math.sin(t * Math.PI) * 56;
          if (t > 0.82) resolvePounce(e);
        }
      },
      finishActive(e, ctx, move) {
        if (move.id === 'pounce') {
          e.x = e.targetX; e.y = e.targetY; e.pounceHeight = 0; resolvePounce(e);
        }
        if (move.id === 'charge' && e.hornBroken) enterDown(e, 1.8, '断角失控，冲锋打滑！');
      },
      chase(e, ctx, dt) {
        const pa = angleTo(e, player), d = distance(e, player);
        turnToward(e, pa, dt * 5);
        if (d > 150) {
          const speed = e.sp * 1.3 * (e.phase === 2 ? 1.12 : 1);
          e.x = clampW(e.x + Math.cos(pa) * speed * dt, e.r);
          e.y = clampH(e.y + Math.sin(pa) * speed * dt, e.r);
        }
      },
      reposition(e, ctx, dt) {
        const pa = angleTo(e, player), side = e.ai.repositionSide || 1, a = pa + side * Math.PI / 2;
        turnToward(e, pa, dt * 7);
        e.x = clampW(e.x + Math.cos(a) * 330 * dt, e.r);
        e.y = clampH(e.y + Math.sin(a) * 330 * dt, e.r);
      },
      shouldReposition(e, ctx, move) {
        if (!move || move.id === 'tailSlam') return false;
        return Math.random() < (move.id === 'charge' ? 0.65 : 0.36);
      },
      nextDelay(e, ctx, move) {
        const r = move && move.rest ? move.rest : rest(0.2, 0.45);
        return (r.min + Math.random() * (r.max - r.min)) * (e.phase === 2 ? 0.75 : 1);
      },
      shouldFatigue: (e, ctx, count) => count >= RULE.fatigueMoves + (e.phase === 2 ? 1 : 0),
      fatigueDuration: () => RULE.fatigueTime,
      fatigued(e) {
        toast('乱线魔王线条散开，疲惫了！');
        for (let i = 0; i < 10; i++) {
          const a = i / 10 * TAU;
          sparks.push({ x: e.x + Math.cos(a) * e.r, y: e.y + Math.sin(a) * e.r, t: 0.45, color: HOSTILE_INK });
        }
      },
      endMove(e) {
        if (e.huntMode === 'fatigue') return;
      },
      beforeUpdate(e, ctx, dt) {
        e.hornFlash = Math.max(0, (e.hornFlash || 0) - dt);
        if (e.tailSpikes <= 0) {
          e.tailSpikeRegen = Math.max(0, (e.tailSpikeRegen || 0) - dt);
          if (e.tailSpikeRegen <= 0) { e.tailSpikes = 1; e.tailHp = e.tailMax; }
        }
        if (e.phase === 1 && e.hp < e.maxhp * (player.metaBossPhaseAt || 0.5)) {
          e.phase = 2; crumpleT = 0.7; shakeT = 0.5;
          toast('乱线魔王暴走了：回旋、尾砸与冲锋获得二连派生！');
        }
        e.walk += dt * (e.huntMode === 'chase' || e.huntMode === 'reposition' ? 7 : 3);
      }
    }
  });

  function init(e) {
    if (e.stage !== 1) return;
    e.huntBoss = true; e.faceA = angleTo(e, player);
    e.hornMax = RULE.hornHp; e.hornHp = RULE.hornHp; e.hornBroken = false; e.hornFlash = 0;
    e.tailMax = RULE.tailHp; e.tailHp = RULE.tailHp; e.tailSpikes = 1; e.tailSpikeRegen = 0;
    e.huntMoveCount = 0; e.huntLast = ''; e.attack = null; e.pounceHeight = 0;
    controller.init(e, CTX, 0.9);
  }
  function update(e, dt) {
    if (!e.huntBoss) return false;
    controller.update(e, CTX, dt);
    e.huntMoveCount = e.ai.moveCount;
    return true;
  }
  function enterDown(e, t, message) {
    controller.interrupt(e, 'down', t, CTX);
    e.stunT = 0; e.kbx = e.kby = 0;
    if (message) toast(message);
    shakeT = Math.max(shakeT, 0.28);
  }
  function addPartDamage(e, amount) {
    if (!e.huntBoss || e.hornBroken || e.dead || amount <= 0) return false;
    if (e.huntMode === 'fatigue' || e.huntMode === 'down') amount *= 1.35;
    e.hornHp = Math.max(0, e.hornHp - amount); e.hornFlash = 0.18;
    if (e.hornHp <= 0) {
      e.hornBroken = true; enterDown(e, RULE.breakDownTime, '尖角折断！乱线魔王倒地了！');
      const p = hornPoint(e);
      for (let i = 0; i < 12; i++) {
        const a = i / 12 * TAU;
        sparks.push({ x: p.x + Math.cos(a) * 15, y: p.y + Math.sin(a) * 15, t: 0.35, color: RED });
      }
      return true;
    }
    return false;
  }
  function addTailDamage(e, amount) {
    if (!e.huntBoss || e.tailSpikes <= 0 || amount <= 0) return false;
    e.tailHp = Math.max(0, e.tailHp - amount);
    if (e.tailHp <= 0) {
      e.tailSpikes = 0; e.tailSpikeRegen = RULE.tailRegenTime;
      if (e.attack === 'quills') controller.interrupt(e, 'recover', 0.7, CTX);
      toast('尾棘被涂散！暂时无法齐射！');
      return true;
    }
    return false;
  }
  function onDamage(e, sx, sy, dmg) {
    if (!e.huntBoss || sx === undefined || sy === undefined) return;
    const hp = hornPoint(e), tp = tailPoint(e);
    if (!e.hornBroken && Math.hypot(sx - hp.x, sy - hp.y) < 87) addPartDamage(e, dmg * 0.8);
    else if (e.tailSpikes > 0 && Math.hypot(sx - tp.x, sy - tp.y) < 82) addTailDamage(e, dmg * 0.55);
  }

  function drawSector(e, angle, range, arc, color, alpha) {
    ctx.save(); ctx.globalAlpha = alpha;
    const a0 = angle - arc / 2, a1 = angle + arc / 2;
    jline(e.x, e.y, e.x + Math.cos(a0) * range, e.y + Math.sin(a0) * range, color, 1.6);
    jline(e.x, e.y, e.x + Math.cos(a1) * range, e.y + Math.sin(a1) * range, color, 1.6);
    for (let i = 0; i < 12; i++) {
      const a = a0 + (a1 - a0) * i / 12, b = a0 + (a1 - a0) * (i + 1) / 12;
      jline(e.x + Math.cos(a) * range, e.y + Math.sin(a) * range, e.x + Math.cos(b) * range, e.y + Math.sin(b) * range, color, 1.6);
    }
    ctx.restore();
  }
  function drawStrikeSector(e, angle, range, arc) {
    const progress = clamp(1 - e.huntT / e.activeDuration, 0, 1), a0 = angle - arc / 2, a1 = angle + arc / 2;
    ctx.save(); ctx.globalAlpha = 0.14; ctx.fillStyle = RED;
    ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.arc(e.x, e.y, range, a0, a1); ctx.closePath(); ctx.fill();
    ctx.globalAlpha = 0.9;
    const sweep = Math.min(1, 0.22 + progress * 1.45);
    for (let band = 0; band < 3; band++) {
      const rr = range * (0.58 + band * 0.16), end = a0 + arc * sweep;
      for (let i = 0; i < 12; i++) {
        const a = a0 + (end - a0) * i / 12, b = a0 + (end - a0) * (i + 1) / 12;
        jline(e.x + Math.cos(a) * rr, e.y + Math.sin(a) * rr, e.x + Math.cos(b) * rr, e.y + Math.sin(b) * rr, RED, band === 1 ? 5 : 3);
      }
    }
    ctx.restore();
  }
  function drawSpin(e, active) {
    const progress = active ? clamp(1 - e.huntT / e.activeDuration, 0, 1) : 0;
    ctx.save(); ctx.globalAlpha = active ? 0.14 : 0.22; ctx.fillStyle = active ? RED : ENEMY_AIM;
    if (active) { ctx.beginPath(); ctx.arc(e.x, e.y, RULE.spinRange, 0, TAU); ctx.fill(); }
    ctx.globalAlpha = active ? 0.92 : 0.42;
    jcircle(e.x, e.y, RULE.spinRange, active ? RED : ENEMY_AIM, active ? 4 : 1.6);
    const start = (e.faceA || 0) + (e.spinDir || 1) * progress * TAU;
    const sweep = active ? Math.max(0.2, progress * TAU) : 0.8;
    for (let i = 0; i < 24; i++) {
      const a = start + (e.spinDir || 1) * sweep * i / 24, b = start + (e.spinDir || 1) * sweep * (i + 1) / 24;
      const rr = active ? RULE.spinRange * 0.83 : RULE.spinRange;
      jline(e.x + Math.cos(a) * rr, e.y + Math.sin(a) * rr, e.x + Math.cos(b) * rr, e.y + Math.sin(b) * rr, active ? RED : ENEMY_AIM, active ? 7 : 2);
    }
    ctx.restore();
  }
  function drawTailSlam(e, active) {
    const { start, end } = slamSegment(e), a = rearAngle(e), nx = -Math.sin(a), ny = Math.cos(a), w = RULE.tailSlamWidth;
    drawUnparryableSegmentArea(start, end, RULE.tailSlamWidth, active);
    ctx.save(); ctx.globalAlpha = active ? 0.18 : 0.3; ctx.fillStyle = DARK;
    if (active) {
      ctx.beginPath(); ctx.moveTo(start.x + nx * w, start.y + ny * w); ctx.lineTo(end.x + nx * w, end.y + ny * w);
      ctx.lineTo(end.x - nx * w, end.y - ny * w); ctx.lineTo(start.x - nx * w, start.y - ny * w); ctx.closePath(); ctx.fill();
    }
    ctx.globalAlpha = active ? 0.94 : 0.62;
    for (const s of [-1, 1]) jline(start.x + nx * w * s, start.y + ny * w * s, end.x + nx * w * s, end.y + ny * w * s, DARK, active ? 4 : 2.2);
    jline(end.x + nx * w, end.y + ny * w, end.x - nx * w, end.y - ny * w, DARK, active ? 5 : 2.2);
    if (active) {
      jline(start.x, start.y, end.x, end.y, DARK, 10);
      jline(start.x, start.y, end.x, end.y, WARN_YELLOW, 2.2);
      for (let i = -3; i <= 3; i++) jline(end.x, end.y, end.x + nx * i * 22 + Math.cos(a) * 35, end.y + ny * i * 22 + Math.sin(a) * 35, DARK, 3);
    }
    drawUnparryableMark(end.x, end.y, 12);
    if (!active) drawDiveOnlyLabel(e);
    ctx.restore();
  }
  function drawCharge(e, active) {
    ctx.save(); ctx.globalAlpha = active ? 0.85 : 0.35;
    for (let d = 22; d < RULE.chargeRange; d += 25) {
      const a = facePoint(e, e.faceA, d), b = facePoint(e, e.faceA, d + 15);
      jline(a.x, a.y, b.x, b.y, active ? RED : ENEMY_AIM, active ? 3 : 2);
    }
    if (active) {
      const nx = -e.lockDy, ny = e.lockDx;
      for (let i = 0; i < 9; i++) {
        const side = (i - 4) * 14, x = e.x + nx * side, y = e.y + ny * side;
        jline(x, y, x - e.lockDx * (48 + (i % 3) * 20), y - e.lockDy * (48 + (i % 3) * 20), RED, i % 2 ? 2.5 : 4);
      }
    }
    ctx.restore();
  }
  function drawPounce(e, active) {
    const progress = active ? clamp(1 - e.huntT / e.activeDuration, 0, 1) : 0;
    ctx.save(); ctx.globalAlpha = active ? 0.92 : 0.62;
    const rr = RULE.pounceRadius * (!active ? 0.72 + 0.28 * Math.min(1, e.huntT / e.windupDuration) : 1);
    drawUnparryableCircleArea(e.targetX, e.targetY, rr, active);
    jcircle(e.targetX, e.targetY, rr, DARK, active ? 3.5 : 2.2);
    jline(e.targetX - 9, e.targetY, e.targetX + 9, e.targetY, DARK, 1.8);
    jline(e.targetX, e.targetY - 9, e.targetX, e.targetY + 9, DARK, 1.8);
    if (active && progress > 0.72) {
      const burst = (progress - 0.72) / 0.28, br = RULE.pounceRadius * (0.38 + burst * 0.62);
      ctx.globalAlpha = 0.2; ctx.fillStyle = DARK; ctx.beginPath(); ctx.arc(e.targetX, e.targetY, br, 0, TAU); ctx.fill();
      ctx.globalAlpha = 0.94; jcircle(e.targetX, e.targetY, br, DARK, 5.5); jcircle(e.targetX, e.targetY, br * 0.58, WARN_YELLOW, 2.8);
      for (let i = 0; i < 16; i++) {
        const a = i / 16 * TAU;
        jline(e.targetX + Math.cos(a) * br * 0.68, e.targetY + Math.sin(a) * br * 0.68,
          e.targetX + Math.cos(a) * br, e.targetY + Math.sin(a) * br, DARK, 3);
      }
    }
    drawUnparryableMark(e.targetX, e.targetY, 12);
    if (!active) drawDiveOnlyLabel(e);
    ctx.restore();
  }
  function drawQuillTelegraph(e, active) {
    const count = e.phase === 2 ? 7 : 5, origin = tailPoint(e), base = rearAngle(e);
    ctx.save(); ctx.globalAlpha = active ? 0.85 : 0.32;
    for (let i = 0; i < count; i++) {
      const a = base + (i - (count - 1) / 2) * 0.17;
      for (let d = 20; d < RULE.quillRange; d += 55) {
        const p0 = facePoint(origin, a, d), p1 = facePoint(origin, a, d + 20);
        jline(p0.x, p0.y, p1.x, p1.y, active ? RED : ENEMY_AIM, active ? 2.5 : 1.3);
      }
    }
    ctx.restore();
  }
  function drawTelegraph(e) {
    if (e.huntMode === 'reposition') {
      ctx.save(); ctx.globalAlpha = 0.22;
      for (let i = 1; i <= 3; i++) jcircle(e.x - Math.cos(e.faceA || 0) * i * 9, e.y - Math.sin(e.faceA || 0) * i * 9, e.r * (1 - i * 0.12), ENEMY_AIM, 1);
      ctx.restore(); return;
    }
    const active = e.huntMode === 'active';
    if (e.huntMode !== 'windup' && !active) return;
    if (e.attack === 'spin') drawSpin(e, active);
    else if (e.attack === 'tailSlam') drawTailSlam(e, active);
    else if (e.attack === 'charge') drawCharge(e, active);
    else if (e.attack === 'pounce') drawPounce(e, active);
    else if (e.attack === 'quills') drawQuillTelegraph(e, active);
    else {
      let range, arc, angle;
      if (e.attack === 'bite') { range = RULE.biteRange; arc = RULE.biteArc; angle = e.faceA || 0; }
      else if (e.attack === 'claw') { range = RULE.clawRange; arc = RULE.clawArc; angle = e.faceA || 0; }
      else if (e.attack === 'comboSlash') { range = RULE.comboSlashRange; arc = RULE.comboSlashArc; angle = e.faceA || 0; }
      else { range = RULE.tailRange; arc = RULE.tailArc; angle = rearAngle(e); }
      if (active) drawStrikeSector(e, angle, range, arc);
      drawSector(e, angle, range, arc, active ? RED : ENEMY_AIM, active ? 0.82 : 0.32);
    }
  }
  function drawAttachments(e, c) {
    const r = e.r, active = e.huntMode === 'active', progress = active ? clamp(1 - e.huntT / e.activeDuration, 0, 1) : 0;
    let tailA = rearAngle(e), tailLen = r * 1.5;
    if (e.attack === 'spin' && active) { tailA = (e.faceA || 0) + (e.spinDir || 1) * progress * TAU; tailLen = RULE.spinRange * 0.8; }
    else if (e.attack === 'tailSlam' && active) tailLen = RULE.tailSlamRange;
    const base = tailPoint(e), tip = facePoint(e, tailA, tailLen);
    jline(base.x, base.y, tip.x, tip.y, c, e.attack === 'tailSlam' && active ? 6 : 3);
    if (e.tailSpikes > 0) {
      for (let i = 1; i <= 6; i++) {
        const d = r * 0.25 + i * (tailLen - r * 0.25) / 7, p = facePoint(e, tailA, d), side = i % 2 ? 1 : -1;
        jline(p.x, p.y, p.x + Math.cos(tailA + side * 0.85) * 10, p.y + Math.sin(tailA + side * 0.85) * 10, RED, 1.8);
      }
    }
    const hp = hornPoint(e), hornLen = e.hornBroken ? 5 : 18;
    for (const side of [-1, 1]) {
      const a = (e.faceA || 0) + side * 0.55;
      jline(hp.x, hp.y, hp.x + Math.cos(a) * hornLen, hp.y + Math.sin(a) * hornLen, e.hornFlash > 0 ? FLASH : (e.hornBroken ? GRAY : c), 3);
    }
    if (e.phase === 2) {
      const eye = facePoint(e, e.faceA || 0, r * 0.65);
      jline(eye.x - 5, eye.y - 4, eye.x + 5, eye.y + 4, RED, 2.5);
      jline(eye.x - 5, eye.y + 4, eye.x + 5, eye.y - 4, RED, 2.5);
    }
  }
  function drawHUD(e, bx, by, bw) {
    if (!e.huntBoss) return;
    ctx.textAlign = 'left'; ctx.font = 'bold 9px ' + FONT;
    ctx.fillStyle = e.hornBroken ? GRAY : DARK; ctx.fillText(e.hornBroken ? '尖角已破坏' : '尖角', bx, by + 24);
    const x = bx + 62, w = bw - 62, y = by + 18;
    setSeed(188); jrect(x, y, w, 5, e.hornBroken ? GRAY : ENEMY_AIM, 1);
    if (!e.hornBroken && e.hornHp > 0) {
      ctx.save(); ctx.beginPath(); ctx.rect(x + 1, y + 1, (w - 2) * e.hornHp / e.hornMax, 3); ctx.clip();
      setSeed(189); scribbleFill(x + 1, y + 1, w - 2, 3, ENEMY_AIM); ctx.restore();
    }
    ctx.fillStyle = e.tailSpikes > 0 ? DARK : GRAY;
    ctx.fillText(e.tailSpikes > 0 ? '尾棘' : '尾棘再生 ' + Math.ceil(e.tailSpikeRegen || 0) + 's', bx, by + 36);
  }

  globalThis.BossHuntRuntime = {
    RULE, ATTACKS, MOVES, init, update,
    chooseAttack: e => controller.choose(e, CTX),
    startAttack: (e, kind, chained) => controller.start(e, kind, CTX, { chained: !!chained }),
    finishMove: e => controller.finishMove(e, CTX), enterDown, addPartDamage, addTailDamage, onDamage,
    drawTelegraph, drawAttachments, drawHUD, hornPoint, tailPoint,
    debugCandidates: e => controller.candidates(e, CTX).map(m => m.id)
  };
})();

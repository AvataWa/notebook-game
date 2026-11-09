/* 涂改巨灵：六足重装站位、涂改带资源、区域封锁与固定愤怒派生。 */
(function () {
  'use strict';
  const AI = globalThis.BossAI || (typeof require !== 'undefined' ? require('./boss-ai-runtime.js') : null);
  const { clamp, distance, angleTo, turnToward, coneContains } = AI;
  const TAU = Math.PI * 2, TAPE = '#9b8257';
  const RULE = Object.freeze({
    stompRange: 180, swipeRange: 255, swipeArc: 1.9,
    shoveRange: 350, shoveWidth: 72,
    shotRange: 780, snareRange: 650, snareRadius: 108,
    fatigueMoves: 5, fatigueTime: 2.8
  });
  const CTX = { get player() { return player; } };
  const facePoint = (e, a, d) => ({ x: e.x + Math.cos(a) * d, y: e.y + Math.sin(a) * d });
  const rest = (min, max) => ({ min, max });
  const rageCombo = id => e => e.phase === 2 ? [id] : [];
  const MOVES = {
    stomp: {
      minRange: 0, maxRange: 205, zones: ['any'], weight: 1.25, cooldown: 0.8,
      windup: 0.72, active: 0.42, recover: 0.72, lockTime: 0.35, comboDelay: 0.3,
      chainWindup: 0.42, chainRecover: 0.85, combo: rageCombo('stomp'), rest: rest(0.45, 0.8)
    },
    swipe: {
      minRange: 45, maxRange: 285, zones: ['front', 'side'], weight: 1.15, cooldown: 0.45,
      windup: 0.58, active: 0.3, recover: 0.55, lockTime: 0.24, comboDelay: 0.24,
      chainWindup: 0.36, combo: rageCombo('swipe'), rest: rest(0.35, 0.7)
    },
    shove: {
      minRange: 130, maxRange: 410, zones: ['side', 'front'], weight: 1.0, cooldown: 1.5,
      windup: 0.76, active: 0.52, recover: 0.8, lockTime: 0.34, repositionBonus: 1.5, rest: rest(0.45, 0.85)
    },
    tapeShot: {
      minRange: 260, maxRange: 820, zones: ['front', 'side'], weight: 1.15, cooldown: 1.1,
      windup: 0.68, active: 0.2, recover: 0.5, lockTime: 0.3, rest: rest(0.35, 0.7),
      available: e => e.tapeStock > 0
    },
    tapeSnare: {
      minRange: 180, maxRange: RULE.snareRange, zones: ['any'], weight: 1.05, cooldown: 2.4,
      windup: 0.92, active: 0.28, recover: 0.62, lockTime: 0.38, comboDelay: 0.32,
      chainWindup: 0.5, combo: e => e.phase === 2 ? ['tapeSnare', 'tapeSnare'] : [], rest: rest(0.5, 0.85),
      available: e => e.tapeStock >= (e.phase === 2 ? 3 : 1)
    },
    release: {
      minRange: 0, maxRange: 720, zones: ['back', 'side'], weight: 0.8, cooldown: 7,
      windup: 0.85, active: 0.25, recover: 0.65, lockTime: 0.4, rest: rest(0.55, 0.9),
      available: () => normalEnemyCount() < normalEnemyCap()
    },
    reload: {
      minRange: 0, zones: ['any'], weight: 3, cooldown: 0,
      windup: 1.05, active: 0.22, recover: 1.0, lockTime: 0.8, rest: rest(0.65, 0.9),
      available: e => e.tapeStock <= 0
    }
  };
  const ATTACKS = Object.freeze(Object.fromEntries(Object.entries(MOVES).map(([id, m]) => [id,
    Object.freeze({ windup: m.windup, active: m.active, recover: m.recover })])));

  function parry(e, range) {
    if (player.absorbT <= 0 || distance(e, player) > range + player.absorbRadius) return false;
    hitStopT = Math.max(hitStopT, ABSORB_RULE.hitStop);
    hurtEnemy(e, e.dmg * 1.5 * (player.metaAbsorbMul || 1), 0, player.x, player.y, 0, 0, 0, inkFriendlyColor);
    rewardAbsorb(ABSORB_RULE.meleeInk); chargeParry();
    floats.push({ x: player.x, y: player.y - 45, txt: '弹反！', t: 0.7, color: inkFriendlyColor, crit: true });
    sparks.push({ x: e.x, y: e.y, t: 0.24, color: inkFriendlyColor });
    castMeleeInkSurge(); shakeT = Math.max(shakeT, 0.12);
    controller.interrupt(e, 'recover', 1.0, CTX);
    return true;
  }
  function resolveStomp(e) {
    if (e.attackResolved) return;
    e.attackResolved = true;
    if (distance(e, player) < RULE.stompRange + player.r) {
      if (player.absorbT > 0) unparryableFeedback(player.x, player.y);
      hurtPlayer(Math.round(e.dmg * 1.05), 'enemy', e);
    }
    novas.push({ x: e.x, y: e.y, t: 0.25, max: RULE.stompRange, col: DARK });
    shakeT = Math.max(shakeT, 0.28);
    for (let i = 0; i < 16; i++) {
      const a = i / 16 * TAU;
      sparks.push({ x: e.x + Math.cos(a) * RULE.stompRange * 0.65, y: e.y + Math.sin(a) * RULE.stompRange * 0.65, t: 0.36, color: i % 4 === 0 ? WARN_YELLOW : DARK });
    }
  }
  function resolveSwipe(e) {
    if (e.actionHit) return;
    const a = e.faceA || 0;
    if (player.absorbT > 0 && coneContains(e, a, RULE.swipeRange, RULE.swipeArc, player, player.absorbRadius) && parry(e, RULE.swipeRange)) return;
    if (coneContains(e, a, RULE.swipeRange, RULE.swipeArc, player, player.r)) {
      e.actionHit = true; hurtPlayer(Math.round(e.dmg * 0.9), 'enemy', e);
    }
  }
  function shoveSegment(e) {
    return { start: { x: e.attackStartX, y: e.attackStartY }, end: facePoint(e, e.faceA || 0, RULE.shoveRange) };
  }
  function fireTape(e) {
    const count = e.phase === 2 ? 3 : 1, base = e.faceA || 0;
    for (let i = 0; i < count; i++) {
      const a = base + (i - (count - 1) / 2) * 0.16;
      ebullets.push({ x: e.x + Math.cos(a) * (e.r + 12), y: e.y + Math.sin(a) * (e.r + 12),
        vx: Math.cos(a) * 330, vy: Math.sin(a) * 330, dmg: Math.round(e.dmg * 0.65),
        life: 2.4, sourceId: e.id, reflectable: true, kind: 'tape' });
    }
    e.tapeStock = Math.max(0, e.tapeStock - 1);
    shakeT = Math.max(shakeT, 0.1);
  }
  function resolveSnare(e) {
    if (e.attackResolved) return;
    e.attackResolved = true;
    const p = { x: e.targetX, y: e.targetY };
    addHostileInk(p.x, p.y, 1, RULE.snareRadius, e.id);
    if (distance(p, player) < RULE.snareRadius + player.r) {
      if (player.absorbT > 0) unparryableFeedback(player.x, player.y);
      hurtPlayer(Math.round(e.dmg * 0.75), 'enemy', e);
    }
    novas.push({ x: p.x, y: p.y, t: 0.25, max: RULE.snareRadius, col: DARK });
    e.tapeStock = Math.max(0, e.tapeStock - 1);
    shakeT = Math.max(shakeT, 0.16);
    for (let i = 0; i < 12; i++) {
      const a = i / 12 * TAU;
      sparks.push({ x: p.x + Math.cos(a) * 65, y: p.y + Math.sin(a) * 65, t: 0.32, color: i % 3 === 0 ? WARN_YELLOW : DARK });
    }
  }
  function releaseMinions(e) {
    const count = e.phase === 2 ? 4 : 3;
    for (let i = 0; i < count; i++) {
      const a = rearAngle(e) + (i - (count - 1) / 2) * 0.55;
      summonMob('spider', e.x + Math.cos(a) * (e.r + 32), e.y + Math.sin(a) * (e.r + 32));
    }
    toast('涂改巨灵打开纸带仓，放出了墨线蜘蛛！');
  }
  function rearAngle(e) { return (e.faceA || 0) + Math.PI; }

  const controller = AI.createController({
    moves: MOVES,
    hooks: {
      aim(e, ctx, move) {
        if (move.id !== 'stomp' && move.id !== 'release' && move.id !== 'reload') e.faceA = angleTo(e, player);
        e.attackStartX = e.x; e.attackStartY = e.y;
        e.targetX = player.x; e.targetY = player.y;
        e.lockDx = Math.cos(e.faceA || 0); e.lockDy = Math.sin(e.faceA || 0);
      },
      track(e, ctx, dt, move) {
        if (move.id === 'stomp' || move.id === 'release' || move.id === 'reload') return;
        const pa = angleTo(e, player);
        turnToward(e, pa, dt * (move.id === 'shove' ? 1.8 : 2.5));
        e.lockDx = Math.cos(e.faceA || 0); e.lockDy = Math.sin(e.faceA || 0);
        if (move.id === 'tapeSnare') { e.targetX = player.x; e.targetY = player.y; }
      },
      lock(e) {
        e.lockDx = Math.cos(e.faceA || 0); e.lockDy = Math.sin(e.faceA || 0);
        e.attackStartX = e.x; e.attackStartY = e.y;
      },
      beginActive(e, ctx, move) {
        e.attackStartX = e.x; e.attackStartY = e.y;
        if (move.id === 'tapeShot') fireTape(e);
        else if (move.id === 'tapeSnare') resolveSnare(e);
        else if (move.id === 'release') releaseMinions(e);
        else if (move.id === 'reload') {
          e.tapeStock = e.tapeMax;
          toast('涂改巨灵换好了涂改带！');
          for (let i = 0; i < 8; i++) sparks.push({ x: e.x + (i - 4) * 7, y: e.y - e.r, t: 0.35, color: TAPE });
        }
      },
      active(e, ctx, dt, move) {
        const progress = clamp(1 - e.huntT / e.activeDuration, 0, 1);
        if (move.id === 'stomp' && progress > 0.38) resolveStomp(e);
        else if (move.id === 'swipe') resolveSwipe(e);
        else if (move.id === 'shove') {
          const nx = clampW(e.x + e.lockDx * 620 * dt, e.r), ny = clampH(e.y + e.lockDy * 620 * dt, e.r);
          if (Math.abs(nx - e.x) < 0.001 && Math.abs(ny - e.y) < 0.001) e.huntT = 0;
          e.x = nx; e.y = ny;
          if (!e.actionHit && distance(e, player) < e.r + player.r + RULE.shoveWidth * 0.35) {
            e.actionHit = true;
            if (player.absorbT > 0) unparryableFeedback(player.x, player.y);
            hurtPlayer(Math.round(e.dmg * 1.15), 'enemy', e);
          }
        } else if (move.id === 'tapeSnare') resolveSnare(e);
      },
      chase(e, ctx, dt) {
        const pa = angleTo(e, player), d = distance(e, player);
        turnToward(e, pa, dt * 3.2);
        let dir = 0;
        if (d > 245) dir = 1; else if (d < 105) dir = -0.65;
        if (dir) {
          e.x = clampW(e.x + Math.cos(pa) * e.sp * dir * dt, e.r);
          e.y = clampH(e.y + Math.sin(pa) * e.sp * dir * dt, e.r);
        }
      },
      reposition(e, ctx, dt) {
        const pa = angleTo(e, player), a = pa + (e.ai.repositionSide || 1) * Math.PI / 2;
        turnToward(e, pa, dt * 4);
        e.x = clampW(e.x + Math.cos(a) * 145 * dt, e.r);
        e.y = clampH(e.y + Math.sin(a) * 145 * dt, e.r);
      },
      shouldReposition(e, ctx, move) {
        if (!move || move.id === 'reload' || move.id === 'stomp') return false;
        return Math.random() < (move.id === 'shove' ? 0.5 : 0.24);
      },
      nextDelay(e, ctx, move) {
        const r = move && move.rest ? move.rest : rest(0.4, 0.75);
        return (r.min + Math.random() * (r.max - r.min)) * (e.phase === 2 ? 0.82 : 1);
      },
      shouldFatigue: (e, ctx, count) => count >= RULE.fatigueMoves + (e.phase === 2 ? 1 : 0),
      fatigueDuration: () => RULE.fatigueTime,
      fatigued(e) {
        toast('涂改巨灵六足发软，沉重地坐下了！');
        shakeT = Math.max(shakeT, 0.2);
      },
      beforeUpdate(e, ctx, dt) {
        if (e.phase === 1 && e.hp < e.maxhp * (player.metaBossPhaseAt || 0.5)) {
          e.phase = 2; e.tapeMax = 3; e.tapeStock = Math.min(3, e.tapeStock + 1);
          crumpleT = 0.7; shakeT = 0.45;
          toast('涂改巨灵暴走了：连踩、双挥与三重封路！');
        }
        e.walk += dt * (e.huntMode === 'chase' || e.huntMode === 'reposition' ? 3.5 : 1.4);
      }
    }
  });

  function init(e) {
    if (e.stage !== 2) return;
    e.huntBoss = true; e.bossAI = 'tape'; e.faceA = angleTo(e, player);
    e.tapeMax = 2; e.tapeStock = 2; e.attack = null; e.pounceHeight = 0;
    controller.init(e, CTX, 1.1);
  }
  function update(e, dt) {
    if (!e.huntBoss || e.bossAI !== 'tape') return false;
    controller.update(e, CTX, dt); return true;
  }
  function onDamage() { /* 涂改巨灵没有乱线魔王的尖角与尾棘部位。 */ }

  function drawSector(e, range, arc, active) {
    const a = e.faceA || 0, a0 = a - arc / 2, a1 = a + arc / 2;
    ctx.save(); ctx.globalAlpha = active ? 0.14 : 0.24; ctx.fillStyle = active ? RED : ENEMY_AIM;
    if (active) { ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.arc(e.x, e.y, range, a0, a1); ctx.closePath(); ctx.fill(); }
    ctx.globalAlpha = active ? 0.9 : 0.4;
    for (const edge of [a0, a1]) jline(e.x, e.y, e.x + Math.cos(edge) * range, e.y + Math.sin(edge) * range, active ? RED : ENEMY_AIM, active ? 3 : 1.6);
    const sweep = active ? Math.max(0.15, (1 - e.huntT / e.activeDuration) * arc) : arc;
    for (let band = 0; band < (active ? 3 : 1); band++) {
      const rr = range * (active ? 0.65 + band * 0.15 : 1);
      for (let i = 0; i < 14; i++) {
        const aa = a0 + sweep * i / 14, bb = a0 + sweep * (i + 1) / 14;
        jline(e.x + Math.cos(aa) * rr, e.y + Math.sin(aa) * rr, e.x + Math.cos(bb) * rr, e.y + Math.sin(bb) * rr, active ? RED : ENEMY_AIM, active ? 4 : 1.6);
      }
    }
    ctx.restore();
  }
  function drawStomp(e, active) {
    const p = active ? clamp(1 - e.huntT / e.activeDuration, 0, 1) : 0;
    const rr = active ? RULE.stompRange * Math.min(1, 0.25 + p * 1.1) : RULE.stompRange;
    drawUnparryableCircleArea(e.x, e.y, rr, active);
    ctx.save(); ctx.globalAlpha = active ? 0.2 : 0.3; ctx.fillStyle = DARK;
    if (active) { ctx.beginPath(); ctx.arc(e.x, e.y, rr, 0, TAU); ctx.fill(); }
    ctx.globalAlpha = active ? 0.94 : 0.65;
    jcircle(e.x, e.y, rr, DARK, active ? 5.5 : 2.2);
    if (active) {
      jcircle(e.x, e.y, rr * 0.68, WARN_YELLOW, 2.8);
      for (let i = 0; i < 12; i++) {
        const a = i / 12 * TAU;
        jline(e.x + Math.cos(a) * rr * 0.75, e.y + Math.sin(a) * rr * 0.75, e.x + Math.cos(a) * rr, e.y + Math.sin(a) * rr, DARK, 3);
      }
    }
    drawUnparryableMark(e.x, e.y, 13);
    if (!active) drawDiveOnlyLabel(e);
    ctx.restore();
  }
  function drawShove(e, active) {
    const { start, end } = shoveSegment(e), a = e.faceA || 0, nx = -Math.sin(a), ny = Math.cos(a), w = RULE.shoveWidth;
    drawUnparryableSegmentArea(start, end, RULE.shoveWidth, active);
    ctx.save(); ctx.globalAlpha = active ? 0.18 : 0.3; ctx.fillStyle = DARK;
    if (active) {
      ctx.beginPath(); ctx.moveTo(start.x + nx * w, start.y + ny * w); ctx.lineTo(end.x + nx * w, end.y + ny * w);
      ctx.lineTo(end.x - nx * w, end.y - ny * w); ctx.lineTo(start.x - nx * w, start.y - ny * w); ctx.closePath(); ctx.fill();
    }
    ctx.globalAlpha = active ? 0.94 : 0.65;
    for (const s of [-1, 1]) jline(start.x + nx * w * s, start.y + ny * w * s, end.x + nx * w * s, end.y + ny * w * s, DARK, active ? 4 : 2.2);
    if (active) for (let i = 0; i < 7; i++) {
      const side = (i - 3) * 28, x = e.x + nx * side, y = e.y + ny * side;
      jline(x, y, x - e.lockDx * 65, y - e.lockDy * 65, i === 3 ? WARN_YELLOW : DARK, i % 2 ? 3 : 5);
    }
    drawUnparryableMark(end.x, end.y, 12);
    if (!active) drawDiveOnlyLabel(e);
    ctx.restore();
  }
  function drawShot(e, active) {
    const count = e.phase === 2 ? 3 : 1, base = e.faceA || 0;
    ctx.save(); ctx.globalAlpha = active ? 0.85 : 0.34;
    for (let i = 0; i < count; i++) {
      const a = base + (i - (count - 1) / 2) * 0.16;
      for (let d = e.r + 15; d < RULE.shotRange; d += 48) {
        const p0 = facePoint(e, a, d), p1 = facePoint(e, a, d + 25);
        jline(p0.x, p0.y, p1.x, p1.y, active ? RED : ENEMY_AIM, active ? 3 : 1.5);
      }
    }
    ctx.restore();
  }
  function drawSnare(e, active) {
    const r = RULE.snareRadius, x = e.targetX, y = e.targetY;
    drawUnparryableCircleArea(x, y, r, active);
    ctx.save(); ctx.globalAlpha = active ? 0.18 : 0.3; ctx.fillStyle = DARK;
    if (active) { ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); }
    ctx.globalAlpha = active ? 0.94 : 0.65; jcircle(x, y, r, DARK, active ? 4.5 : 2.2);
    for (let i = -2; i <= 2; i++) {
      jline(x - r * 0.7, y + i * 30 - 12, x + r * 0.7, y + i * 30 + 12, i === 0 ? WARN_YELLOW : DARK, active ? 4 : 1.8);
    }
    drawUnparryableMark(x, y, 13);
    if (!active) drawDiveOnlyLabel(e);
    ctx.restore();
  }
  function drawTelegraph(e) {
    const active = e.huntMode === 'active';
    if (e.huntMode === 'reposition') {
      ctx.save(); ctx.globalAlpha = 0.18; jcircle(e.x, e.y, e.r + 12, ENEMY_AIM, 1.5); ctx.restore(); return;
    }
    if (e.attack === 'reload' && e.huntMode === 'windup') {
      ctx.save(); ctx.globalAlpha = 0.45; jcircle(e.x, e.y, e.r + 22, TAPE, 2);
      const p = 1 - e.huntT / e.windupDuration;
      for (let i = 0; i < e.tapeMax; i++) if (i / e.tapeMax < p) jrect(e.x - 22 + i * 18, e.y - e.r - 24, 12, 16, TAPE, 2);
      ctx.restore(); return;
    }
    if (e.attack === 'release' && e.huntMode === 'windup') {
      ctx.save(); ctx.globalAlpha = 0.38;
      for (let i = 0; i < 3; i++) { const a = rearAngle(e) + (i - 1) * 0.55; const p = facePoint(e, a, e.r + 32); jcircle(p.x, p.y, 15, ENEMY_AIM, 1.5); }
      ctx.restore(); return;
    }
    if (e.huntMode !== 'windup' && !active) return;
    if (e.attack === 'stomp') drawStomp(e, active);
    else if (e.attack === 'swipe') drawSector(e, RULE.swipeRange, RULE.swipeArc, active);
    else if (e.attack === 'shove') drawShove(e, active);
    else if (e.attack === 'tapeShot') drawShot(e, active);
    else if (e.attack === 'tapeSnare') drawSnare(e, active);
  }
  function drawAttachments(e, c) {
    const front = facePoint(e, e.faceA || 0, e.r * 0.85);
    const tapeActive = e.attack === 'tapeShot' && e.huntMode === 'active';
    jline(front.x - 8, front.y - 5, front.x + 8, front.y + 5, tapeActive ? RED : c, tapeActive ? 4 : 2);
    if (e.attack === 'swipe' && e.huntMode === 'active') {
      const a = (e.faceA || 0) + (1 - e.huntT / e.activeDuration - 0.5) * RULE.swipeArc;
      const tip = facePoint(e, a, RULE.swipeRange * 0.85);
      jline(e.x, e.y, tip.x, tip.y, RED, 7);
    }
  }
  function drawHUD(e, bx, by, bw) {
    if (!e.huntBoss || e.bossAI !== 'tape') return;
    ctx.textAlign = 'left'; ctx.font = 'bold 9px ' + FONT; ctx.fillStyle = e.tapeStock > 0 ? DARK : GRAY;
    ctx.fillText(e.attack === 'reload' ? '换带中' : '涂改带 ' + e.tapeStock + '/' + e.tapeMax, bx, by + 26);
    for (let i = 0; i < e.tapeMax; i++) {
      const x = bx + 76 + i * 24;
      jrect(x, by + 17, 17, 10, i < e.tapeStock ? TAPE : GRAY, 1.3);
      if (i < e.tapeStock) jline(x + 3, by + 20, x + 14, by + 24, TAPE, 1.4);
    }
  }

  globalThis.BossTapeRuntime = {
    RULE, ATTACKS, MOVES, init, update, onDamage, drawTelegraph, drawAttachments, drawHUD,
    chooseAttack: e => controller.choose(e, CTX),
    startAttack: (e, kind, chained) => controller.start(e, kind, CTX, { chained: !!chained }),
    finishMove: e => controller.finishMove(e, CTX),
    debugCandidates: e => controller.candidates(e, CTX).map(m => m.id),
    shoveSegment
  };
})();

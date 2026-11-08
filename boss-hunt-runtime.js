/* 乱线魔王：方位选招、动作承诺、疲惫与尖角破坏。仅用于第一关。 */
(function () {
  'use strict';
  const RULE = Object.freeze({
    hornHp: 320,
    clawRange: 310,
    tailRange: 290,
    clawArc: 2.2,
    tailArc: 2.5,
    chargeRange: 720,
    pounceRadius: 200,
    fatigueMoves: 4,
    fatigueTime: 2.5,
    breakDownTime: 3
  });
  const ATTACKS = Object.freeze({
    claw:   { windup: 0.5,  active: 0.24, recover: 0.25 },
    tail:   { windup: 0.55, active: 0.26, recover: 0.3 },
    charge: { windup: 0.62, active: 0.8,  recover: 0.35 },
    pounce: { windup: 0.7,  active: 0.5,  recover: 0.4 }
  });
  const norm = a => {
    while (a > Math.PI) a -= Math.PI * 2;
    while (a < -Math.PI) a += Math.PI * 2;
    return a;
  };
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  function facePoint(e, angle, d) { return { x: e.x + Math.cos(angle) * d, y: e.y + Math.sin(angle) * d }; }
  function hornPoint(e) { return facePoint(e, e.faceA || 0, e.r * 1.02); }
  function turnToward(e, target, amount) { e.faceA = norm((e.faceA || 0) + norm(target - (e.faceA || 0)) * Math.min(1, amount)); }
  function setMode(e, mode, t) { e.huntMode = mode; e.huntT = t; }
  function enterRecover(e, t) {
    setMode(e, 'recover', t === undefined ? ATTACKS[e.attack].recover : t);
    e.actionHit = false;
    e.pounceHeight = 0;
  }
  function enterDown(e, t, message) {
    setMode(e, 'down', t);
    e.stunT = 0;
    e.actionHit = true;
    e.pounceHeight = 0;
    e.kbx = e.kby = 0;
    if (message) toast(message);
    shakeT = Math.max(shakeT, 0.28);
  }
  function finishMove(e) {
    e.huntMoveCount = (e.huntMoveCount || 0) + 1;
    e.huntLast = e.attack;
    e.attack = null;
    if (e.huntMoveCount >= RULE.fatigueMoves + (e.phase === 2 ? 1 : 0)) {
      e.huntMoveCount = 0;
      setMode(e, 'fatigue', RULE.fatigueTime);
      toast('乱线魔王线条散开，疲惫了！');
      for (let i = 0; i < 3; i++) sparks.push({ x: e.x + (i - 1) * 12, y: e.y + e.r * 0.7, t: 0.45, color: HOSTILE_INK });
    } else {
      setMode(e, 'chase', Math.random() * 2);
    }
  }
  function startAttack(e, kind, chained) {
    const def = ATTACKS[kind];
    if (!def) return;
    const pa = Math.atan2(player.y - e.y, player.x - e.x);
    e.attack = kind;
    // 甩尾保持前身朝向，让背后扇形真正覆盖玩家；其他招式正面朝目标。
    if (kind !== 'tail') e.faceA = pa;
    e.lockDx = Math.cos(e.faceA); e.lockDy = Math.sin(e.faceA);
    e.attackStartX = e.x; e.attackStartY = e.y;
    e.targetX = player.x; e.targetY = player.y;
    e.actionHit = false;
    e.attackResolved = false;
    e.pounceHeight = 0;
    if (!chained) e.chargeChain = e.phase === 2 && kind === 'charge' ? 1 : 0;
    e.windupDuration = chained ? 0.38 : def.windup;
    e.activeDuration = def.active;
    setMode(e, 'windup', e.windupDuration);
  }
  function chooseAttack(e) {
    const dx = player.x - e.x, dy = player.y - e.y;
    const d = Math.hypot(dx, dy) || 1;
    const relative = Math.abs(norm(Math.atan2(dy, dx) - (e.faceA || 0)));
    let next;
    if (d < 320 && relative > 2.05) next = 'tail';
    else if (d < 310) next = 'claw';
    else if (d > 360 && (e.huntLast === 'charge' || Math.random() < 0.42)) next = 'pounce';
    else next = 'charge';
    if (next === e.huntLast) {
      if (next === 'claw') next = 'tail';
      else if (next === 'tail') next = 'claw';
      else if (next === 'charge') next = 'pounce';
    }
    startAttack(e, next);
  }
  function addPartDamage(e, amount) {
    if (!e.huntBoss || e.hornBroken || e.dead || amount <= 0) return false;
    if (e.huntMode === 'fatigue' || e.huntMode === 'down') amount *= 1.35;
    e.hornHp = Math.max(0, e.hornHp - amount);
    e.hornFlash = 0.18;
    if (e.hornHp <= 0) {
      e.hornBroken = true;
      enterDown(e, RULE.breakDownTime, '尖角折断！乱线魔王倒地了！');
      const p = hornPoint(e);
      for (let i = 0; i < 12; i++) {
        const a = i / 12 * Math.PI * 2;
        sparks.push({ x: p.x + Math.cos(a) * 15, y: p.y + Math.sin(a) * 15, t: 0.35, color: RED });
      }
      return true;
    }
    return false;
  }
  function onDamage(e, sx, sy, dmg) {
    if (!e.huntBoss || e.hornBroken || sx === undefined || sy === undefined) return;
    const p = hornPoint(e), d = Math.hypot(sx - p.x, sy - p.y);
    if (d < 87) addPartDamage(e, dmg * 0.8);
  }
  function parry(e, range) {
    if (player.absorbT <= 0 || dist(e, player) > range + player.absorbRadius) return false;
    hitStopT = Math.max(hitStopT, ABSORB_RULE.hitStop);
    hurtEnemy(e, e.dmg * 1.5 * (player.metaAbsorbMul || 1), 0, player.x, player.y, 0, 0, 0, inkFriendlyColor);
    addPartDamage(e, 55);
    rewardAbsorb(ABSORB_RULE.meleeInk);
    chargeParry();
    floats.push({ x: player.x, y: player.y - 45, txt: '弹反！', t: 0.7, color: inkFriendlyColor, crit: true });
    sparks.push({ x: e.x, y: e.y, t: 0.24, color: inkFriendlyColor });
    castMeleeInkSurge();
    shakeT = Math.max(shakeT, 0.1);
    if (!e.hornBroken) enterRecover(e, 0.85);
    return true;
  }
  function coneContains(e, angle, range, arc, x, y, radius) {
    const dx = x - e.x, dy = y - e.y, d = Math.hypot(dx, dy);
    const pad = d > 0 ? Math.asin(Math.min(1, radius / d)) : Math.PI;
    return d < range + radius && Math.abs(norm(Math.atan2(dy, dx) - angle)) < arc / 2 + pad;
  }
  function resolveCone(e, kind) {
    if (e.actionHit) return;
    const claw = kind === 'claw';
    const range = claw ? RULE.clawRange : RULE.tailRange;
    const angle = (e.faceA || 0) + (claw ? 0 : Math.PI);
    const arc = claw ? RULE.clawArc : RULE.tailArc;
    if (player.absorbT > 0 && coneContains(e, angle, range, arc, player.x, player.y, player.absorbRadius) && parry(e, range)) return;
    if (coneContains(e, angle, range, arc, player.x, player.y, player.r)) {
      e.actionHit = true;
      hurtPlayer(Math.round(e.dmg * (claw ? 0.85 : 0.95)), 'enemy', e);
    }
  }
  function resolvePounce(e) {
    if (e.attackResolved) return;
    e.attackResolved = true;
    const landing = { x: e.targetX, y: e.targetY };
    if (player.absorbT > 0 && dist(landing, player) < RULE.pounceRadius + player.absorbRadius && parry(e, RULE.pounceRadius)) return;
    if (dist(landing, player) < RULE.pounceRadius + player.r) hurtPlayer(Math.round(e.dmg * 1.05), 'enemy', e);
    shakeT = Math.max(shakeT, 0.22);
    for (let i = 0; i < 8; i++) {
      const a = i / 8 * Math.PI * 2;
      sparks.push({ x: landing.x + Math.cos(a) * 35, y: landing.y + Math.sin(a) * 35, t: 0.25, color: RED });
    }
  }
  function beginActive(e) {
    e.actionHit = false;
    e.attackResolved = false;
    setMode(e, 'active', e.activeDuration);
    if (e.attack === 'pounce') {
      e.attackStartX = e.x; e.attackStartY = e.y;
    }
    if (e.attack === 'charge') shakeT = Math.max(shakeT, 0.12);
  }
  function finishActive(e) {
    if (e.attack === 'pounce') {
      e.x = e.targetX; e.y = e.targetY; e.pounceHeight = 0;
      resolvePounce(e);
      if (e.huntMode === 'recover' || e.huntMode === 'down') return;
    }
    if (e.attack === 'charge' && e.chargeChain > 0 && !e.hornBroken) {
      e.chargeChain--;
      startAttack(e, 'charge', true);
      return;
    }
    if (e.attack === 'charge' && e.hornBroken) {
      enterDown(e, 1.8, '断角失控，冲锋打滑！');
      return;
    }
    enterRecover(e);
  }
  function update(e, dt) {
    if (!e.huntBoss) return false;
    e.hornFlash = Math.max(0, (e.hornFlash || 0) - dt);
    if (e.phase === 1 && e.hp < e.maxhp * (player.metaBossPhaseAt || 0.5)) {
      e.phase = 2;
      crumpleT = 0.7; shakeT = 0.5;
      toast('乱线魔王暴走了：冲锋会变成二连击！');
    }
    e.walk += dt * (e.huntMode === 'chase' ? 6 : 3);
    if (e.huntMode === 'down' || e.huntMode === 'fatigue') {
      e.huntT -= dt;
      if (e.huntT <= 0) { e.attack = null; setMode(e, 'chase', 0.4); }
      return true;
    }
    if (e.huntMode === 'chase') {
      const pa = Math.atan2(player.y - e.y, player.x - e.x);
      turnToward(e, pa, dt * 5);
      const d = dist(e, player);
      if (d > 110) {
        const speed = e.sp * 1.3 * (e.phase === 2 ? 1.12 : 1);
        e.x += Math.cos(pa) * speed * dt;
        e.y += Math.sin(pa) * speed * dt;
      }
      e.huntT -= dt;
      if (e.huntT <= 0) chooseAttack(e);
      return true;
    }
    if (e.huntMode === 'windup') {
      e.huntT -= dt;
      // 前摇只允许有限转身，最后 0.22 秒彻底锁定，给玩家明确横移窗口。
      if (e.huntT > 0.22 && e.attack !== 'pounce') {
        const pa = Math.atan2(player.y - e.y, player.x - e.x) + (e.attack === 'tail' ? Math.PI : 0);
        turnToward(e, pa, dt * 2.2);
        e.lockDx = Math.cos(e.faceA); e.lockDy = Math.sin(e.faceA);
      }
      // 近距离挥击伴随短促逼进；末段与预警一起锁定，不再原地挥空。
      if ((e.attack === 'claw' || e.attack === 'tail') && e.huntT > 0.12) {
        const pa = Math.atan2(player.y - e.y, player.x - e.x);
        const d = dist(e, player);
        if (d > 90 && d < 480) {
          const step = Math.min(160 * dt, d - 90);
          e.x += Math.cos(pa) * step;
          e.y += Math.sin(pa) * step;
        }
      }
      if (e.huntT <= 0) beginActive(e);
      return true;
    }
    if (e.huntMode === 'active') {
      e.huntT -= dt;
      if (e.attack === 'claw' || e.attack === 'tail') resolveCone(e, e.attack);
      else if (e.attack === 'charge') {
        if (parry(e, e.r + 8)) return true;
        const speed = 910;
        e.x += e.lockDx * speed * dt; e.y += e.lockDy * speed * dt;
        if (!e.actionHit && dist(e, player) < e.r + player.r + 7) {
          e.actionHit = true;
          hurtPlayer(e.dmg, 'enemy', e);
        }
      } else if (e.attack === 'pounce') {
        const t = Math.max(0, Math.min(1, 1 - e.huntT / e.activeDuration));
        e.x = e.attackStartX + (e.targetX - e.attackStartX) * t;
        e.y = e.attackStartY + (e.targetY - e.attackStartY) * t;
        e.pounceHeight = Math.sin(t * Math.PI) * 42;
        if (t > 0.82) resolvePounce(e);
      }
      if (e.huntT <= 0) finishActive(e);
      return true;
    }
    if (e.huntMode === 'recover') {
      e.huntT -= dt;
      if (e.huntT <= 0) finishMove(e);
      return true;
    }
    return true;
  }
  function init(e) {
    if (e.stage !== 1) return;
    e.huntBoss = true;
    e.faceA = Math.atan2(player.y - e.y, player.x - e.x);
    e.hornMax = RULE.hornHp; e.hornHp = RULE.hornHp; e.hornBroken = false; e.hornFlash = 0;
    e.huntMoveCount = 0; e.huntLast = ''; e.attack = null; e.pounceHeight = 0;
    setMode(e, 'chase', 1.1);
  }
  function drawSector(e, angle, range, arc, color, alpha) {
    ctx.globalAlpha = alpha;
    const a0 = angle - arc / 2, a1 = angle + arc / 2;
    jline(e.x, e.y, e.x + Math.cos(a0) * range, e.y + Math.sin(a0) * range, color, 1.6);
    jline(e.x, e.y, e.x + Math.cos(a1) * range, e.y + Math.sin(a1) * range, color, 1.6);
    for (let i = 0; i < 12; i++) {
      const a = a0 + (a1 - a0) * i / 12, b = a0 + (a1 - a0) * (i + 1) / 12;
      jline(e.x + Math.cos(a) * range, e.y + Math.sin(a) * range, e.x + Math.cos(b) * range, e.y + Math.sin(b) * range, color, 1.6);
    }
    ctx.globalAlpha = 1;
  }
  function drawStrikeSector(e, angle, range, arc) {
    const progress = Math.max(0, Math.min(1, 1 - e.huntT / e.activeDuration));
    const a0 = angle - arc / 2, a1 = angle + arc / 2;
    ctx.save();
    ctx.globalAlpha = 0.14; ctx.fillStyle = RED;
    ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.arc(e.x, e.y, range, a0, a1); ctx.closePath(); ctx.fill();
    ctx.globalAlpha = 0.9;
    // 三道粗扫痕随攻击帧展开，和静止的预警细线明确区分。
    const sweep = Math.min(1, 0.22 + progress * 1.45);
    for (let band = 0; band < 3; band++) {
      const rr = range * (0.58 + band * 0.16), end = a0 + arc * sweep;
      for (let i = 0; i < 12; i++) {
        const a = a0 + (end - a0) * i / 12, b = a0 + (end - a0) * (i + 1) / 12;
        jline(e.x + Math.cos(a) * rr, e.y + Math.sin(a) * rr,
          e.x + Math.cos(b) * rr, e.y + Math.sin(b) * rr, RED, band === 1 ? 5 : 3);
      }
    }
    // 短促斜向笔锋，让“已经打出来”在余光里也能辨认。
    for (let i = 0; i < 5; i++) {
      const a = angle + (i - 2) * arc * 0.16 + (progress - 0.5) * 0.2;
      const p0 = facePoint(e, a - 0.08, range * 0.28), p1 = facePoint(e, a + 0.08, range * 0.94);
      jline(p0.x, p0.y, p1.x, p1.y, RED, 3.2);
    }
    ctx.restore();
  }
  function drawStrikeCharge(e) {
    ctx.save(); ctx.globalAlpha = 0.86;
    const nx = -e.lockDy, ny = e.lockDx;
    for (let i = 0; i < 9; i++) {
      const side = (i - 4) * 14, back = 12 + (i % 3) * 19;
      const x = e.x + nx * side - e.lockDx * back, y = e.y + ny * side - e.lockDy * back;
      jline(x, y, x - e.lockDx * (42 + (i % 2) * 24), y - e.lockDy * (42 + (i % 2) * 24), RED, i % 2 ? 2.5 : 4);
    }
    jcircle(e.x, e.y, e.r * 0.92, RED, 3.5);
    ctx.restore();
  }
  function drawStrikePounce(e) {
    const progress = Math.max(0, Math.min(1, 1 - e.huntT / e.activeDuration));
    if (progress < 0.72) return;
    const burst = (progress - 0.72) / 0.28, rr = RULE.pounceRadius * (0.38 + burst * 0.62);
    ctx.save();
    ctx.globalAlpha = 0.17 * (1 - burst * 0.45); ctx.fillStyle = RED;
    ctx.beginPath(); ctx.arc(e.targetX, e.targetY, rr, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 0.92;
    jcircle(e.targetX, e.targetY, rr, RED, 5);
    jcircle(e.targetX, e.targetY, rr * 0.58, RED, 2.5);
    for (let i = 0; i < 16; i++) {
      const a = i / 16 * Math.PI * 2, inner = rr * 0.68, outer = rr * (0.92 + (i % 2) * 0.12);
      jline(e.targetX + Math.cos(a) * inner, e.targetY + Math.sin(a) * inner,
        e.targetX + Math.cos(a) * outer, e.targetY + Math.sin(a) * outer, RED, 3);
    }
    ctx.restore();
  }
  function drawTelegraph(e) {
    const winding = e.huntMode === 'windup', active = e.huntMode === 'active';
    if (!winding && !active) return;
    const color = active ? RED : ENEMY_AIM;
    const alpha = active ? 0.82 : 0.28 + 0.16 * Math.sin(e.huntT * 18);
    if (e.attack === 'claw' || e.attack === 'tail') {
      const angle = (e.faceA || 0) + (e.attack === 'tail' ? Math.PI : 0);
      const range = e.attack === 'claw' ? RULE.clawRange : RULE.tailRange;
      const arc = e.attack === 'claw' ? RULE.clawArc : RULE.tailArc;
      if (active) drawStrikeSector(e, angle, range, arc);
      drawSector(e, angle, range, arc, color, alpha);
    } else if (e.attack === 'charge') {
      if (active) drawStrikeCharge(e);
      ctx.globalAlpha = alpha;
      for (let d = 22; d < RULE.chargeRange; d += 25) {
        const a = facePoint(e, e.faceA, d), b = facePoint(e, e.faceA, d + 15);
        jline(a.x, a.y, b.x, b.y, color, active ? 3 : 2);
      }
      ctx.globalAlpha = 1;
    } else if (e.attack === 'pounce') {
      if (active) drawStrikePounce(e);
      ctx.globalAlpha = alpha;
      const rr = RULE.pounceRadius * (winding ? 0.72 + 0.28 * Math.min(1, e.huntT / e.windupDuration) : 1);
      jcircle(e.targetX, e.targetY, rr, color, active ? 3 : 2);
      jline(e.targetX - 9, e.targetY, e.targetX + 9, e.targetY, color, 1.5);
      jline(e.targetX, e.targetY - 9, e.targetX, e.targetY + 9, color, 1.5);
      ctx.globalAlpha = 1;
    }
  }
  function drawBody(e, c) {
    const r = e.r;
    drawTelegraph(e);
    ctx.save();
    ctx.translate(e.x, e.y - (e.pounceHeight || 0));
    ctx.rotate(e.faceA || 0);
    if (e.huntMode === 'down') { ctx.translate(0, r * 0.28); ctx.scale(1.12, 0.68); }
    else if (e.huntMode === 'fatigue') ctx.scale(1.04, 0.9);
    else if (e.huntMode === 'windup' && e.attack === 'charge') ctx.scale(1.12, 0.84);
    // 四足、长身、前伸头角：轮廓和普通火柴人彻底区分。
    const step = Math.sin(e.walk) * r * 0.13;
    for (const side of [-1, 1]) for (const front of [-1, 1]) {
      const lx = front * r * 0.42, ly = side * r * 0.42;
      const footX = lx + (front > 0 ? step : -step);
      jline(lx, ly, footX, ly + side * r * 0.42, c, 2.5);
      jline(footX, ly + side * r * 0.42, footX + r * 0.22, ly + side * r * 0.42, c, 2);
    }
    jline(-r * 0.72, 0, -r * 1.25, Math.sin(e.walk * 0.7) * r * 0.22, c, 3);
    jline(-r * 1.25, Math.sin(e.walk * 0.7) * r * 0.22, -r * 1.55, -r * 0.18, c, 2);
    ctx.save(); ctx.scale(1.22, 0.78);
    ctx.fillStyle = 'rgba(245,241,230,0.76)'; ctx.beginPath(); ctx.arc(0, 0, r * 0.82, 0, 7); ctx.fill();
    jcircle(0, 0, r * 0.82, c, 3.2); ctx.restore();
    // 前爪在前摇时明显抬起，攻击时向前伸出。
    const clawRaise = e.attack === 'claw' && e.huntMode === 'windup' ? r * 0.45 : 0;
    const clawReach = e.attack === 'claw' && e.huntMode === 'active' ? r * 0.65 : 0;
    jline(r * 0.5, -r * 0.32, r * 0.98 + clawReach, -r * 0.65 - clawRaise, c, 3);
    for (let i = -1; i <= 1; i++) jline(r * 0.98 + clawReach, -r * 0.65 - clawRaise, r * 1.2 + clawReach, -r * 0.65 - clawRaise + i * 5, c, 1.6);
    ctx.fillStyle = 'rgba(245,241,230,0.88)'; ctx.beginPath(); ctx.arc(r * 0.94, 0, r * 0.5, 0, 7); ctx.fill();
    jcircle(r * 0.94, 0, r * 0.5, c, 3);
    ctx.fillStyle = '#fdfcf7'; ctx.beginPath(); ctx.arc(r * 1.05, -r * 0.17, r * 0.14, 0, 7); ctx.fill();
    if (e.huntMode === 'down' || e.huntMode === 'fatigue') jline(r * 0.95, -r * 0.17, r * 1.15, -r * 0.17, c, 2);
    else { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(r * 1.08, -r * 0.17, r * 0.05, 0, 7); ctx.fill(); }
    jline(r * 1.18, r * 0.1, r * 1.43, r * 0.16, c, 2.4);
    // 两根可破坏尖角，断裂后只留短茬。
    const hornColor = e.hornFlash > 0 ? FLASH : (e.hornBroken ? GRAY : c);
    const hornLen = e.hornBroken ? 0.12 : 0.52;
    for (const side of [-1, 1]) {
      jline(r * 0.55, side * r * 0.36, r * (0.65 + hornLen), side * r * 0.66, hornColor, 3);
      if (!e.hornBroken) jline(r * (0.65 + hornLen), side * r * 0.66, r * (0.83 + hornLen), side * r * 0.52, hornColor, 2);
    }
    if (e.phase === 2) {
      ctx.globalAlpha = 0.7;
      jline(-r * 0.6, -r * 0.58, r * 0.25, -r * 0.72, RED, 2);
      jline(-r * 0.45, r * 0.58, r * 0.35, r * 0.68, RED, 2);
      ctx.globalAlpha = 1;
    }
    if (e.huntMode === 'fatigue') {
      jcircle(r * 1.02, r * 0.55, 3.5, HOSTILE_INK, 1.5);
      jline(-r * 0.25, -r * 0.9, -r * 0.1, -r * 1.12, GRAY, 1.5);
    }
    ctx.restore();
  }
  function drawHUD(e, bx, by, bw) {
    if (!e.huntBoss) return;
    ctx.textAlign = 'left'; ctx.font = 'bold 9px ' + FONT;
    ctx.fillStyle = e.hornBroken ? GRAY : DARK;
    ctx.fillText(e.hornBroken ? '尖角已破坏' : '尖角', bx, by + 24);
    const x = bx + 62, w = bw - 62, y = by + 18;
    setSeed(188); jrect(x, y, w, 5, e.hornBroken ? GRAY : ENEMY_AIM, 1);
    if (!e.hornBroken && e.hornHp > 0) {
      ctx.save(); ctx.beginPath(); ctx.rect(x + 1, y + 1, (w - 2) * e.hornHp / e.hornMax, 3); ctx.clip();
      setSeed(189); scribbleFill(x + 1, y + 1, w - 2, 3, ENEMY_AIM); ctx.restore();
    }
  }
  globalThis.BossHuntRuntime = { RULE, ATTACKS, init, update, chooseAttack, startAttack, finishMove, enterDown, addPartDamage, onDamage, drawTelegraph, drawHUD, hornPoint };
})();

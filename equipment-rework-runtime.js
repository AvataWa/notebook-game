/* 装备机制重构：B/C 级装备不再提供生命门槛、持续回血或单纯地形移速。 */
(() => {
  'use strict';

  const RED_PEN = '#bd4a46';
  const PAPER_BLUE = '#357d91';
  const ERASER_COL = '#d7cbb8';
  const S = {
    noProc: false,
    hitCount: 0,
    parryCount: 0,
    parryShots: 0,
    surgeEye: null,
    echoes: [],
    decoys: [],
    gridDistance: 0,
    gridNodes: [],
    gridZone: null,
    gridCd: 0,
    gridTick: 0,
    dropAcc: 0,
    droplets: 0,
    bookmarkLevels: 0,
    lensAcc: 0,
    lensMarks: [],
    armorAcc: 0,
    armorLayers: 0,
    armorCd: 0,
    paperShield: 0,
    inkStored: 0,
    trackDistance: 0,
    trackPoints: [],
    eraserAcc: 0,
    eraserCd: 0,
    blankDistance: 0,
    blankBlades: [],
    recalls: [],
    rulerLines: []
  };

  function power() { return player.dmgMul * (1 + player.eqAtk / 100); }
  function effectC(col) { return { col: col || inkFriendlyColor, hadesSkill: 'other' }; }
  function blast(x, y, dmg, r, col, delay = 0.06) {
    if (!(dmg > 0)) return;
    erupts.push({ x, y, delay, dmg, r, c: effectC(col), done: false, t: 0, warn: true });
  }
  function shootAt(x, y, target, dmg, col, extra) {
    if (!target || !(dmg > 0)) return;
    const angle = Math.atan2(target.y - y, target.x - x);
    fireBullet(x, y, angle, 360, dmg, 'equip', Object.assign({
      life: 1.5, hits: 1, homing: 4, col: col || inkFriendlyColor,
      hadesSkill: 'other', critAdd: -1, size: 7
    }, extra || {}));
  }
  function pointSegmentDistance(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1, dy = y2 - y1, l2 = dx * dx + dy * dy || 1;
    const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / l2));
    return Math.hypot(px - (x1 + dx * t), py - (y1 + dy * t));
  }
  function inTriangle(x, y, nodes) {
    if (nodes.length < 3) return false;
    const [a, b, c] = nodes;
    const sign = (p1, p2, p3) => (p1.x - p3.x) * (p2.y - p3.y) - (p2.x - p3.x) * (p1.y - p3.y);
    const p = { x, y }, d1 = sign(p, a, b), d2 = sign(p, b, c), d3 = sign(p, c, a);
    return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0));
  }
  function eraseGray(x, y, radius) {
    const b = inkGridBounds(x, y, x, y, radius), rr = radius * radius;
    let erased = 0;
    for (let gy = b.y0; gy <= b.y1; gy++) for (let gx = b.x0; gx <= b.x1; gx++) {
      const wx = WORLD_L + (gx + 0.5) * INK_CELL - x, wy = WORLD_T + (gy + 0.5) * INK_CELL - y;
      const i = gy * INK_GW + gx;
      if (wx * wx + wy * wy > rr || inkOwner[i] !== 2) continue;
      inkOwner[i] = 0; inkAmount[i] = 0; inkPulse[i] = 0; inkPaintedCount--;
      setInkSource(i, 0); syncInkPixel(i); erased++;
    }
    if (erased) {
      putInkRegion(friendlyInkLayer, b.x0, b.y0, b.x1, b.y1);
      putInkRegion(hostileInkLayer, b.x0, b.y0, b.x1, b.y1);
    }
    return erased;
  }
  function priorityTarget(x, y) {
    let target = null, best = Infinity;
    for (const e of enemies) {
      if (e.dead) continue;
      const rank = e.boss ? 0 : e.elite ? 1 : 2;
      const score = rank * 100000 + Math.hypot(e.x - x, e.y - y);
      if (score < best) { best = score; target = e; }
    }
    return target;
  }
  function castAt(a, c, x, y) {
    const ox = player.x, oy = player.y;
    player.x = x; player.y = y;
    try { baseFireSkill(a, c); }
    finally { player.x = ox; player.y = oy; }
  }

  const baseFireSkill = fireSkill;
  fireSkill = function(a, c) {
    baseFireSkill(a, c);
    if (S.noProc) return;
    S.noProc = true;
    try {
      if (hasItem('blankcap') && (a.uc || 0) > 0 && a.uc % 4 === 0) {
        const empty = Math.max(0, MAX_ACTIVES - player.actives.length);
        const copyC = Object.assign({}, c, {
          dmg: c.dmg * itemV('blankcap', 'dmg') / 100,
          unleash: 0, followup: 0, reburst: 0
        });
        for (let i = 0; i < 1 + empty; i++) baseFireSkill(a, copyC);
        floats.push({ x: player.x, y: player.y - 38, txt: '临摹 ×' + (1 + empty), t: 0.7, color: c.col || INK, crit: true });
        novas.push({ x: player.x, y: player.y, t: 0.25, max: 45, col: c.col || INK });
      }
      if (hasItem('parrygrip') && S.parryShots > 0) {
        const n = S.parryShots; S.parryShots = 0;
        for (let i = 0; i < n; i++) {
          const target = nearestEnemy(player.x, player.y, 540);
          shootAt(player.x, player.y, target, itemV('parrygrip', 'dmg') * power(), INK, { life: 1.8 });
        }
        floats.push({ x: player.x, y: player.y - 32, txt: '返墨 ×' + n, t: 0.65, color: INK });
      }
      if (hasItem('surgeglove') && S.surgeEye) {
        const eye = S.surgeEye, target = nearestEnemy(eye.x, eye.y, 600);
        shootAt(eye.x, eye.y, target, itemV('surgeglove', 'dmg') * c.dmg, c.col || INK,
          { hits: 4, size: 11, homing: 1.2, life: 1.4 });
      }
      if (hasItem('pendant') && S.droplets > 0) {
        S.droplets--;
        shootAt(player.x, player.y, nearestEnemy(player.x, player.y, 540), itemV('pendant', 'dmg') * power(), PAPER_BLUE);
      }
      if (hasItem('fullink') && player.ink >= 80 && spendSkillInk(a, 8)) {
        S.echoes.push({ a, c: Object.assign({}, c, {
          dmg: c.dmg * itemV('fullink', 'dmg') / 100,
          unleash: 0, followup: 0, reburst: 0
        }), x: player.x, y: player.y, t: 1 });
        floats.push({ x: player.x, y: player.y - 32, txt: '满墨复爆', t: 0.65, color: c.col || INK });
      }
    } finally { S.noProc = false; }
  };

  const baseHurtEnemy = hurtEnemy;
  hurtEnemy = function(e, dmg, dotDps, sx, sy, vuln, critAdd, bossMul, hitCol, weakFloat, skillId) {
    const wasDead = e.dead;
    baseHurtEnemy(e, dmg, dotDps, sx, sy, vuln, critAdd, bossMul, hitCol, weakFloat, skillId);
    if (wasDead || S.noProc || !e.lastHitDamage) return;
    const hitDamage = e.lastHitDamage, hitSkill = e.lastHitSkill;
    if (hasItem('burstglove') && e.lastHitCrit && gameTime >= (e.burstMarkCd || 0)) {
      e.burstMarks = (e.burstMarks || 0) + 1;
        if (e.burstMarks >= 3) {
        e.burstMarks = 0; e.burstMarkCd = gameTime + 0.4;
        blast(e.x, e.y, hitDamage * itemV('burstglove', 'dmg') / 100, 65, RED_PEN, 0.04);
      }
    }
    if (!SKILL_DEFS[hitSkill]) return;
    if (hasItem('highscore')) {
      S.hitCount++;
      if (S.hitCount >= 5) {
        S.hitCount = 0;
        blast(e.x, e.y, hitDamage * itemV('highscore', 'dmg') / 100, 58, RED_PEN, 0.05);
      }
    }
    if (hasItem('rulerband')) {
      e.rulerHits = (e.rulerHits || 0) + 1;
      if (e.rulerHits >= 3) {
        e.rulerHits = 0;
        const angle = Math.atan2(e.y - player.y, e.x - player.x), length = 330 * player.radMul;
        const x2 = player.x + Math.cos(angle) * length, y2 = player.y + Math.sin(angle) * length;
        S.rulerLines.push({ x1: player.x, y1: player.y, x2, y2, t: 0.28, total: 0.28 });
        S.noProc = true;
        try {
          for (const target of enemies) {
            if (target.dead || pointSegmentDistance(target.x, target.y, player.x, player.y, x2, y2) > target.r + 17) continue;
            hurtEnemy(target, hitDamage * itemV('rulerband', 'dmg') / 100, 0, player.x, player.y,
              0, -1, 0, INK, false, 'other');
          }
        } finally { S.noProc = false; }
      }
    }
    if (hasItem('lowink') && player.ink < 20) {
      const fromX = sx === undefined ? player.x : sx, fromY = sy === undefined ? player.y : sy;
      const base = Math.atan2(e.y - fromY, e.x - fromX);
      for (const side of [-1, 1]) {
        const angle = base + side * 0.7;
        fireBullet(e.x, e.y, angle, 320, hitDamage * itemV('lowink', 'dmg') / 100, 'equip', {
          life: 0.85, hits: 1, col: cColor(hitCol), hadesSkill: 'other', critAdd: -1, size: 5
        });
      }
    }
  };
  function cColor(col) { return col || inkFriendlyColor; }

  const baseChargeParry = chargeParry;
  chargeParry = function() {
    baseChargeParry();
    if (hasItem('parrygrip')) S.parryShots = Math.min(3, S.parryShots + 1);
    if (hasItem('cloak')) {
      S.parryCount++;
      if (S.parryCount >= 3) {
        S.parryCount = 0;
        if (S.decoys.length >= 3) S.decoys.shift();
        S.decoys.push({ x: player.x, y: player.y, t: 4 });
        floats.push({ x: player.x, y: player.y - 34, txt: '勇者纸影', t: 0.7, color: INK });
      }
    }
  };

  const baseConvertGrayDisk = convertGrayDisk;
  convertGrayDisk = function(x, y, radius) {
    const converted = baseConvertGrayDisk(x, y, radius);
    if (hasItem('inklens') && converted > 0) {
      S.lensAcc += converted;
      while (S.lensAcc >= 120 && S.lensMarks.length < 8) {
        S.lensAcc -= 120;
        S.lensMarks.push({ x, y });
      }
      if (S.lensMarks.length >= 8) S.lensAcc = Math.min(S.lensAcc, 119);
    }
    return converted;
  };

  const baseCastInkSurge = castInkSurge;
  castInkSurge = function(radius, full) {
    const result = baseCastInkSurge(radius, full);
    if (!result) return result;
    if (full && hasItem('surgeglove')) S.surgeEye = { x: player.x, y: player.y, t: 5 };
    if (hasItem('inklens') && S.lensMarks.length) {
      const marks = S.lensMarks.splice(0);
      for (let i = 0; i < marks.length; i++)
        blast(marks[i].x, marks[i].y, itemV('inklens', 'dmg') * power(), 58, inkFriendlyColor, 0.06 + i * 0.035);
    }
    if (hasItem('inkarmor') && S.inkStored > 0) {
      const stored = S.inkStored; S.inkStored = 0;
      blast(player.x, player.y, stored, BATTLE.surge.radius * 0.75, inkFriendlyColor, 0.08);
      floats.push({ x: player.x, y: player.y - 40, txt: '墨囊反击 ' + Math.round(stored), t: 0.75, color: INK, crit: true });
    }
    return result;
  };

  const baseCastAbsorb = castAbsorb;
  castAbsorb = function() {
    const result = baseCastAbsorb();
    if (result && hasItem('blankshoes') && S.blankBlades.length) {
      const blades = S.blankBlades.splice(0);
      S.noProc = true;
      try {
        for (const blade of blades) {
          S.recalls.push({ x1: blade.x, y1: blade.y, x2: player.x, y2: player.y, t: 0.28, total: 0.28 });
          for (const e of enemies) {
            if (e.dead || pointSegmentDistance(e.x, e.y, blade.x, blade.y, player.x, player.y) > e.r + 13) continue;
            hurtEnemy(e, itemV('blankshoes', 'dmg') * power(), 0, blade.x, blade.y,
              0, -1, 0, PAPER_BLUE, false, 'other');
          }
        }
      } finally { S.noProc = false; }
      floats.push({ x: player.x, y: player.y - 35, txt: '纸刃召回 ×' + blades.length, t: 0.7, color: PAPER_BLUE });
    }
    return result;
  };

  const baseEnterDive = enterDive;
  enterDive = function() {
    baseEnterDive();
    S.trackDistance = 0; S.trackPoints.length = 0;
  };
  const baseExitDive = exitDive;
  exitDive = function() {
    const wasDiving = player.diving;
    baseExitDive();
    if (wasDiving && hasItem('trackshoes') && S.trackPoints.length) {
      const points = S.trackPoints.splice(0);
      for (let i = 0; i < points.length; i++)
        blast(points[i].x, points[i].y, itemV('trackshoes', 'dmg') * power(), 48, inkFriendlyColor, 0.04 + i * 0.08);
      floats.push({ x: player.x, y: player.y - 35, txt: '墨轨爆破 ×' + points.length, t: 0.7, color: INK });
    }
    S.trackDistance = 0; S.trackPoints.length = 0;
  };

  const baseUpdatePlayerInk = updatePlayerInk;
  updatePlayerInk = function(dt) {
    const before = player.ink, diving = player.diving;
    const own = playerOnOwnInk(), hostile = playerOnHostileInk();
    let regen = BATTLE.ink.regenBase;
    if (own) regen += BATTLE.ink.regenOwnBonus;
    if (hostile) regen = 0;
    const result = baseUpdatePlayerInk(dt);
    if (hasItem('pendant') && !diving && !hostile) {
      const raw = regen * (player.metaRegenMul || 1) * dt;
      const overflow = Math.max(0, before + raw - player.ink);
      S.dropAcc += overflow;
      while (S.dropAcc >= 8 && S.droplets < 6) { S.dropAcc -= 8; S.droplets++; }
      if (S.droplets >= 6) S.dropAcc = Math.min(S.dropAcc, 7.99);
    }
    return result;
  };

  const baseHurtPlayer = hurtPlayer;
  hurtPlayer = function(dmg, kind) {
    if (player.diving || hitStopT > 0 || player.goldT > 0 || player.hurtT > 0) return baseHurtPlayer(dmg, kind);
    if (hasItem('blotarmor') && S.armorLayers > 0) {
      S.armorLayers--;
      dmg *= 1 - itemV('blotarmor', 'dr') / 100;
      floats.push({ x: player.x, y: player.y - 32, txt: '纸甲减伤', t: 0.55, color: PAPER_BLUE });
    }
    if (hasItem('cliparmor') && S.paperShield > 0) {
      const absorbed = Math.min(S.paperShield, dmg);
      S.paperShield -= absorbed; dmg -= absorbed;
      floats.push({ x: player.x, y: player.y - 36, txt: '纸甲 -' + Math.round(absorbed), t: 0.55, color: PAPER_BLUE });
      if (dmg <= 0.001) return;
    }
    const oldHp = player.hp;
    baseHurtPlayer(dmg, kind);
    if (hasItem('inkarmor')) {
      const lost = Math.max(0, oldHp - player.hp);
      S.inkStored = Math.min(player.maxhp * 0.5, S.inkStored + lost * itemV('inkarmor', 'store') / 100);
    }
  };

  function onLevelUp() {
    if (!hasItem('bookmark')) return;
    S.bookmarkLevels++;
    const need = itemV('bookmark', 'levels');
    if (S.bookmarkLevels < need) return;
    S.bookmarkLevels = 0;
    const candidates = [];
    for (const a of player.actives) for (const sp of a.supports) if (sp.lvl < MAX_LVL) candidates.push({ a, sp });
    if (!candidates.length) return;
    const picked = candidates[Math.floor(Math.random() * candidates.length)];
    picked.sp.lvl++;
    toast('灵感抄录：' + SKILL_DEFS[picked.a.id].name + ' · ' + SUPPORTS[picked.sp.id].name + ' Lv.' + picked.sp.lvl);
  }

  const baseUpdate = update;
  update = function(dt) {
    const oldX = player.x, oldY = player.y;
    baseUpdate(dt);
    if (state !== 'play') return;
    const moved = Math.hypot(player.x - oldX, player.y - oldY);

    for (let i = S.echoes.length - 1; i >= 0; i--) {
      const echo = S.echoes[i]; echo.t -= dt;
      if (echo.t > 0) continue;
      S.echoes.splice(i, 1);
      if (!player.actives.includes(echo.a)) continue;
      S.noProc = true;
      try { castAt(echo.a, echo.c, echo.x, echo.y); novas.push({ x: echo.x, y: echo.y, t: 0.28, max: 48, col: echo.c.col || INK }); }
      finally { S.noProc = false; }
    }
    for (let i = S.rulerLines.length - 1; i >= 0; i--) {
      S.rulerLines[i].t -= dt; if (S.rulerLines[i].t <= 0) S.rulerLines.splice(i, 1);
    }
    for (let i = S.recalls.length - 1; i >= 0; i--) {
      S.recalls[i].t -= dt; if (S.recalls[i].t <= 0) S.recalls.splice(i, 1);
    }
    if (S.surgeEye) { S.surgeEye.t -= dt; if (S.surgeEye.t <= 0) S.surgeEye = null; }

    if (hasItem('gridshoes')) {
      S.gridCd = Math.max(0, S.gridCd - dt);
      S.gridDistance += moved;
      if (S.gridDistance >= 160 && S.gridCd <= 0) {
        S.gridDistance %= 160; S.gridNodes.push({ x: player.x, y: player.y });
        if (S.gridNodes.length >= 3) {
          const nodes = S.gridNodes.splice(0, 3);
          S.gridZone = { nodes, t: 3 }; S.gridTick = 0; S.gridCd = 4;
        }
      }
      if (S.gridZone) {
        S.gridZone.t -= dt; S.gridTick -= dt;
        if (S.gridTick <= 0) {
          S.gridTick = 0.25;
          S.noProc = true;
          try {
            for (const e of enemies) {
              if (e.dead || !inTriangle(e.x, e.y, S.gridZone.nodes)) continue;
              e.slowT = Math.max(e.slowT || 0, 0.3);
              hurtEnemy(e, itemV('gridshoes', 'dmg') * power(), 0, player.x, player.y,
                0, -1, 0, PAPER_BLUE, false, 'other');
            }
          } finally { S.noProc = false; }
        }
        if (S.gridZone.t <= 0) S.gridZone = null;
      }
    } else { S.gridDistance = 0; S.gridNodes.length = 0; S.gridZone = null; }

    for (let i = S.decoys.length - 1; i >= 0; i--) {
      const d = S.decoys[i]; d.t -= dt;
      for (const e of enemies) {
        if (e.dead || e.boss || Math.hypot(e.x - d.x, e.y - d.y) > 320) continue;
        const angle = Math.atan2(d.y - e.y, d.x - e.x);
        e.x += Math.cos(angle) * e.sp * dt * 0.8; e.y += Math.sin(angle) * e.sp * dt * 0.8;
      }
      if (d.t <= 0) {
        S.decoys.splice(i, 1);
        blast(d.x, d.y, BATTLE.surge.damage * power() * itemV('cloak', 'dmg') / 100,
          BATTLE.surge.radius * 0.75, inkFriendlyColor, 0.02);
      }
    }

    if (hasItem('trackshoes') && player.diving) {
      S.trackDistance += moved;
      while (S.trackDistance >= 100 && S.trackPoints.length < 8) {
        S.trackDistance -= 100; S.trackPoints.push({ x: player.x, y: player.y });
      }
    }
    // 普通移动也会铺墨，因此判断身前 28 像素是否仍为空白，而不是判断脚下轨迹。
    const blankAheadX = player.x + Math.cos(player.faceA) * 28;
    const blankAheadY = player.y + Math.sin(player.faceA) * 28;
    if (hasItem('blankshoes') && moved > 0 && !inkCircleHas(blankAheadX, blankAheadY, 4, false) &&
        !inkCircleHas(blankAheadX, blankAheadY, 4, true)) {
      S.blankDistance += moved;
      while (S.blankDistance >= 90 && S.blankBlades.length < 6) {
        S.blankDistance -= 90; S.blankBlades.push({ x: player.x, y: player.y, a: player.faceA });
      }
    }

    S.armorCd -= dt; S.eraserCd -= dt;
    if (playerOnHostileInk()) {
      if (hasItem('blotarmor') && S.armorCd <= 0) {
        S.armorCd = 0.15; S.armorAcc += eraseGray(player.x, player.y, 26);
        while (S.armorAcc >= 60 && S.armorLayers < 3) {
          S.armorAcc -= 60; S.armorLayers++;
          floats.push({ x: player.x, y: player.y - 30, txt: '纸甲 +' + S.armorLayers, t: 0.55, color: PAPER_BLUE });
        }
      }
      if (hasItem('erasershoes') && player.diving && S.eraserCd <= 0) {
        S.eraserCd = 0.12; S.eraserAcc += eraseGray(player.x, player.y, 20);
        while (S.eraserAcc >= 50) {
          S.eraserAcc -= 50;
          shootAt(player.x, player.y, priorityTarget(player.x, player.y), itemV('erasershoes', 'dmg') * power(), ERASER_COL,
            { homing: 5, size: 8 });
        }
      }
    }
    if (hasItem('cliparmor') && playerOnOwnInk() && !player.diving) {
      const cap = player.maxhp * itemV('cliparmor', 'cap') / 100;
      S.paperShield = Math.min(cap, S.paperShield + player.maxhp * itemV('cliparmor', 'rate') / 100 * dt);
    }
  };

  const baseResetGame = resetGame;
  resetGame = function() {
    baseResetGame();
    S.noProc = false; S.hitCount = 0; S.parryCount = 0; S.parryShots = 0; S.surgeEye = null;
    S.echoes.length = 0; S.decoys.length = 0; S.gridDistance = 0; S.gridNodes.length = 0; S.gridZone = null;
    S.gridCd = 0; S.gridTick = 0; S.dropAcc = 0; S.droplets = 0; S.bookmarkLevels = 0;
    S.lensAcc = 0; S.lensMarks.length = 0; S.armorAcc = 0; S.armorLayers = 0; S.armorCd = 0;
    S.paperShield = 0; S.inkStored = 0; S.trackDistance = 0; S.trackPoints.length = 0;
    S.eraserAcc = 0; S.eraserCd = 0; S.blankDistance = 0; S.blankBlades.length = 0;
    S.recalls.length = 0; S.rulerLines.length = 0;
  };

  function drawTriangle(nodes, col) {
    ctx.beginPath(); ctx.moveTo(nodes[0].x, nodes[0].y);
    ctx.lineTo(nodes[1].x, nodes[1].y); ctx.lineTo(nodes[2].x, nodes[2].y); ctx.closePath();
    ctx.globalAlpha = 0.12; ctx.fillStyle = col; ctx.fill();
    ctx.globalAlpha = 0.8; ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.stroke(); ctx.globalAlpha = 1;
  }
  function draw() {
    for (const d of S.decoys) {
      ctx.globalAlpha = Math.min(0.75, d.t); drawStick(d.x, d.y, 30, 0, INK);
      jcircle(d.x, d.y, 25 + Math.sin(d.t * 7) * 3, INK, 1.5); ctx.globalAlpha = 1;
    }
    if (S.surgeEye) {
      const eye = S.surgeEye; ctx.globalAlpha = Math.min(0.8, eye.t);
      jcircle(eye.x, eye.y, 22 + Math.sin(gameTime * 8) * 3, inkFriendlyColor, 3);
      jcircle(eye.x, eye.y, 8, inkFriendlyColor, 2); ctx.globalAlpha = 1;
    }
    for (const n of S.gridNodes) {
      jline(n.x - 7, n.y, n.x + 7, n.y, PAPER_BLUE, 2); jline(n.x, n.y - 7, n.x, n.y + 7, PAPER_BLUE, 2);
    }
    if (S.gridZone) drawTriangle(S.gridZone.nodes, PAPER_BLUE);
    for (const m of S.lensMarks) {
      jcircle(m.x, m.y, 12, inkFriendlyColor, 1.5); jline(m.x - 5, m.y, m.x + 5, m.y, inkFriendlyColor, 1.5);
    }
    for (const p of S.trackPoints) { jcircle(p.x, p.y, 9, inkFriendlyColor, 2); }
    for (const b of S.blankBlades) {
      ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.a); ctx.fillStyle = PAPER_BLUE;
      ctx.beginPath(); ctx.moveTo(10, 0); ctx.lineTo(-7, -5); ctx.lineTo(-3, 0); ctx.lineTo(-7, 5); ctx.closePath(); ctx.fill(); ctx.restore();
    }
    for (const r of S.recalls) {
      ctx.globalAlpha = r.t / r.total; jline(r.x1, r.y1, r.x2, r.y2, PAPER_BLUE, 5); ctx.globalAlpha = 1;
    }
    for (const r of S.rulerLines) {
      ctx.globalAlpha = r.t / r.total; jline(r.x1, r.y1, r.x2, r.y2, INK, 7);
      jline(r.x1, r.y1, r.x2, r.y2, '#f5f1e6', 1.5); ctx.globalAlpha = 1;
    }
    for (let i = 0; i < S.droplets; i++) {
      const angle = gameTime * 2.2 + i / Math.max(1, S.droplets) * Math.PI * 2;
      ctx.fillStyle = PAPER_BLUE; ctx.beginPath(); ctx.arc(player.x + Math.cos(angle) * 28, player.y - 10 + Math.sin(angle) * 17, 4, 0, Math.PI * 2); ctx.fill();
    }
    if (hasItem('blotarmor') && S.armorLayers > 0) {
      for (let i = 0; i < S.armorLayers; i++) jcircle(player.x, player.y, 20 + i * 4, PAPER_BLUE, 1.2);
    }
    if (hasItem('cliparmor') && S.paperShield > 0) {
      const cap = player.maxhp * itemV('cliparmor', 'cap') / 100;
      ctx.globalAlpha = 0.25 + 0.35 * S.paperShield / Math.max(1, cap);
      jcircle(player.x, player.y, 24, PAPER_BLUE, 4); ctx.globalAlpha = 1;
    }
  }
  const previousExtras = window.__drawWorldExtras;
  window.__drawWorldExtras = function() { if (previousExtras) previousExtras(); draw(); };

  window.__equipmentRework = {
    state: S,
    onLevelUp,
    blast,
    eraseGray,
    inTriangle,
    pointSegmentDistance
  };
})();

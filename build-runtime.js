/* 构筑系统运行时：把 content-config.js 的辅助与装备接入既有战斗循环。 */
(() => {
  'use strict';

  const baseHasAffix = hasAffix;
  hasAffix = function(skill, id) {
    return baseHasAffix(skill, id) || !!(player && player.taken && player.taken[id]);
  };

  const baseChargeTurf = chargeTurf;
  chargeTurf = function(amount) {
    const lens = !player.noLensCharge && hasItem('inklens') ? 1 + itemV('inklens', 'charge') / 100 : 1;
    baseChargeTurf(amount * lens);
  };
  const baseChargeParry = chargeParry;
  chargeParry = function() {
    player.noLensCharge = true;
    baseChargeParry();
    player.noLensCharge = false;
  };
  const baseCastInkSurge = castInkSurge;
  castInkSurge = function(radius, full) {
    player.noLensCharge = true;
    const result = baseCastInkSurge(radius, full);
    player.noLensCharge = false;
    return result;
  };

  const baseReflectEnemyBullet = reflectEnemyBullet;
  reflectEnemyBullet = function(eb) {
    const first = bullets.length, result = baseReflectEnemyBullet(eb);
    for (let i = first; i < bullets.length; i++) bullets[i].reflectTargetId = eb.sourceId;
    return result;
  };

  const baseLinkedTrail = addLinkedTrail;
  addLinkedTrail = function(owner, x, y, col, hostile, r, amount, spacing, xKey, yKey, refKey) {
    if (owner === player && player.diving && hasAffix('dive', 'widetrail')) r *= 1.6;
    if (owner && owner.kind === 'reflect' && owner.inkWide) r *= owner.inkWide;
    const covered = baseLinkedTrail(owner, x, y, col, hostile, r, amount, spacing, xKey, yKey, refKey);
    if (owner === player && player.diving && hasAffix('dive', 'washregen')) player.diveWashCover = (player.diveWashCover || 0) + covered;
    return covered;
  };

  const baseSkillCalc = skillCalc;
  skillCalc = function(a) {
    const c = baseSkillCalc(a), lowHp = player.hp < player.maxhp * 0.3;
    if (hasItem('cap4')) {
      c.dmg /= 1 + 0.08 * player.actives.length;
      c.dmg *= 1 + itemV('cap4', 'dmg') / 100 * player.actives.length;
    }
    if (hasItem('cloak') && lowHp) c.dmg *= (1 + itemV('cloak', 'dmg') / 100) / 1.4;
    if (hasItem('blankcap')) c.dmg *= 1 + itemV('blankcap', 'dmg') / 100 * (MAX_ACTIVES - player.actives.length);
    if (hasItem('lowink') && player.ink < 20) c.dmg *= 1 + itemV('lowink', 'dmg') / 100;
    return c;
  };

  updatePlayerInk = function(dt) {
    const own = playerOnOwnInk(), hostile = playerOnHostileInk();
    if (player.diving) {
      player.diveT += dt;
      player.diveEntryT = Math.max(0, player.diveEntryT - dt);
      player.diveEntryFreeT = Math.max(0, (player.diveEntryFreeT || 0) - dt);
      const cost = diveInkCost() * dt;
      const paid = player.diveEntryFreeT > 0 ? 0 : Math.min(player.ink, cost);
      player.ink = Math.max(0, player.ink - paid);
      player.diveSpent += paid;
      if (hasAffix('dive', 'washregen') && player.diveWashCover > 0) {
        const back = Math.min(cost * 0.5, player.diveWashCover * 0.025);
        player.ink = Math.min(player.maxInk, player.ink + back);
      }
      player.diveWashCover = 0;
      if (hasAffix('dive', 'divecharge')) {
        player.diveChargeAcc += dt;
        while (player.diveChargeAcc >= 1) {
          player.diveChargeAcc -= 1;
          player.noLensCharge = true; baseChargeTurf(4); player.noLensCharge = false;
        }
      }
      if (player.ink <= 0) { exitDive(); toast('墨水耗尽，退出潜墨'); }
    } else {
      player.diveT = 0; player.diveChargeAcc = 0; player.diveWashCover = 0;
      player.lastSeenX = player.x; player.lastSeenY = player.y;
      let regen = BATTLE.ink.regenBase + itemV('pendant', 'regen');
      if (own) regen += BATTLE.ink.regenOwnBonus;
      if (own && hasItem('cliparmor')) {
        const heal = player.maxhp * itemV('cliparmor', 'regen') / 100 * dt;
        player.hp = Math.min(player.maxhp, player.hp + heal);
      }
      if (hostile) regen = 0;
      player.ink = Math.min(player.maxInk, player.ink + regen * dt);
    }
    if (hostile) {
      player.grayTick += dt;
      if (player.grayTick >= BATTLE.ink.hostileTick) {
        player.grayTick -= BATTLE.ink.hostileTick;
        hurtPlayer(BATTLE.ink.hostileDamage, 'gray');
      }
    } else player.grayTick = 0;
    return { own, hostile };
  };

  const baseHurtPlayer = hurtPlayer;
  hurtPlayer = function(dmg, kind) {
    if (player.diving || hitStopT > 0 || player.hurtT > 0) return;
    let reduction = 0;
    if (player.exitShieldT > 0) reduction += 0.25;
    if (player.parryShieldT > 0) reduction += 0.25;
    if (player.surgeCharging && hasAffix('surge', 'chargeshield')) reduction += 0.3;
    if (kind === 'gray' && hasItem('blotarmor')) reduction += itemV('blotarmor', 'graydr') / 100;
    const adjusted = dmg * (1 - Math.min(0.85, reduction));
    const oldHp = player.hp;
    if (hasItem('tape') && adjusted >= player.hp && gameTime - player.lastRevive > itemV('tape', 'cd') && gameTime - player.lastRevive <= 30)
      player.lastRevive = gameTime - 31;
    baseHurtPlayer(adjusted);
    if (player.hp < oldHp && player.hurtT > 0) {
      player.hurtT = Math.max(player.hurtT, BATTLE.player.hitInvuln + itemV('stapler', 'invuln'));
      if (hasItem('erasershoes')) player.eraserT = itemV('erasershoes', 'duration');
      if (hasItem('inkarmor') && gameTime >= player.itemArmorCd) {
        player.itemArmorCd = gameTime + itemV('inkarmor', 'cd');
        addInkStain(player.x, player.y, 8, itemV('inkarmor', 'radius'), inkFriendlyColor, false, false);
        novas.push({ x: player.x, y: player.y, t: 0.3, max: itemV('inkarmor', 'radius'), col: inkFriendlyColor });
      }
    }
  };

  hurtEnemy = function(e, dmg, dotDps, sx, sy, vuln, critAdd, bossMul, hitCol) {
    if (e.dead) return;
    if (player.taken.inkpower && playerOnOwnInk()) dmg *= BATTLE.traits.inkDamageMul;
    if (e.vulnT > 0) dmg *= 1 + e.vuln;
    if (e.areaVulnT > 0) dmg *= 1 + e.areaVuln;
    if (e.paperVulnT > 0) dmg *= 1.2;
    if (e.boss && bossMul) dmg *= 1 + bossMul;
    if (vuln) { e.vuln = vuln; e.vulnT = 2; }
    let crit = false;
    const highscore = player.hp > player.maxhp * 0.8 ? itemV('highscore', 'crit') / 100 : 0;
    const critChance = player.crit + player.eqCrit + highscore + (critAdd || 0);
    const critMul = hasItem('glove') ? itemV('glove', 'mul') : 2;
    if (critChance > 0 && Math.random() < critChance) { dmg *= critMul; crit = true; }
    e.hp -= dmg; e.flash = 0.12; e.squash = SQUASH_T;
    const kx = e.x - (sx === undefined ? player.x : sx), ky = e.y - (sy === undefined ? player.y : sy);
    const kd = Math.hypot(kx, ky) || 1, kbMul = e.boss ? 0.1 : (e.elite ? 0.35 : 1);
    if (!(e.parryKbT > 0)) { e.kbx = kx / kd * KNOCK_V * kbMul; e.kby = ky / kd * KNOCK_V * kbMul; }
    if (dotDps) { e.dotDps = Math.max(e.dotDps, dotDps); e.dotT = 3; }
    sparks.push({ x: e.x + (Math.random() - 0.5) * e.r, y: e.y + (Math.random() - 0.5) * e.r, t: 0.18, color: hitCol || INK });
    floats.push({ x: e.x + (Math.random() - 0.5) * 40, y: e.y - e.r - 8 - Math.random() * 18, txt: Math.round(dmg) + (crit ? '!' : ''), t: 0.7, color: hitCol || INK, crit });
    if (crit && hasItem('burstglove') && player.itemBurstN < 6) {
      player.itemBurstN++;
      addInkStain(e.x, e.y, 2, itemV('burstglove', 'radius'), inkFriendlyColor, false, true);
    }
    if (e.hp <= 0) killEnemy(e);
  };

  const baseKillEnemy = killEnemy;
  killEnemy = function(e) {
    const oldDropCount = drops.length, seeded = hasAffix('surge', 'surgeseed') && e.surgeSeedT > 0;
    const savedHasItem = hasItem;
    hasItem = id => (id === 'bookmark' || id === 'pendant') ? false : savedHasItem(id);
    baseKillEnemy(e);
    hasItem = savedHasItem;
    for (let i = oldDropCount; i < drops.length; i++) if (drops[i].rarity === undefined) drops[i].rarity = rollRarity();
    if (seeded) addInkStain(e.x, e.y, 6, 35, inkFriendlyColor, false, false);
    if (hasItem('shredglove') && player.itemInkCd < itemV('shredglove', 'cap')) {
      let longest = null;
      for (const a of player.actives) if (!longest || a.t > longest.t) longest = a;
      if (longest) {
        const cut = Math.min(itemV('shredglove', 'cd'), itemV('shredglove', 'cap') - player.itemInkCd);
        longest.t = Math.max(0, longest.t - cut); player.itemInkCd += cut;
      }
    }
  };

  updateSkills = function(dt) {
    cycAng += dt * 6;
    if (player.diving) return;
    for (const a of player.actives) {
      a.t -= dt;
      if (a.t > 0) continue;
      let cost = INK_COST[a.id] || 2;
      if (player.itemParryT > 0 && hasItem('parrygrip')) cost *= 1 - itemV('parrygrip', 'discount') / 100;
      if (!spendSkillInk(a, cost)) {
        a.t = 0.2;
        if (player.noInkT <= 0) { toast('墨水不足，潜入己方墨迹补墨'); player.noInkT = 2.2; }
        continue;
      }
      const c = skillCalc(a);
      player.itemAmbushT = 0; player.itemSurgeT = 0; player.itemParryT = 0;
      const baseCd = { cyclone: 0.45, volcanic: 2.2, tornado: 0.8, chainclip: 0.9, arc: 1.6, spark: 1.8, srs: 3.5, ballista: 5,
        boomerang: 2.2, vortex: 1.5, candle: 0.25, icespear: 1.1, inkrain: 2.8, ruler: 2, chalk: 2.4,
        pinburst: 1.3, absolve: 2, brand: 2.5, cola: 1.8 }[a.id];
      a.t = baseCd * c.cd;
      if (a.id === 'cyclone' && a.lvl >= 5) a.t *= 0.72;
      if (a.id === 'candle') a.t /= 1 + (c.retick || 0);
      a.uc = (a.uc || 0) + 1;
      const reps = c.unleash > 0 && a.uc % 3 === 0 ? 1 + c.unleash : 1;
      for (let r = 0; r < reps; r++) { fireSkill(a, c); addSkillStain(a, c, cost / reps); }
    }
  };

  const baseEnemyInkFactor = enemyInkFactor;
  enemyInkFactor = function(e) {
    let factor = baseEnemyInkFactor(e);
    if (e.surgeSlowT > 0 && inkCircleHas(e.x, e.y, e.r * 0.35, false)) factor *= 0.82;
    return factor;
  };
  const baseUpdateShooter = updateShooter;
  updateShooter = function(e, dt) {
    if (!(e.sealT > 0)) return baseUpdateShooter(e, dt);
    const cd = e.shotCd, windup = e.shotWindup, burst = e.burstLeft;
    e.shotCd = 999; e.shotWindup = 0; e.burstLeft = 0;
    baseUpdateShooter(e, dt);
    e.shotCd = cd; e.shotWindup = windup; e.burstLeft = burst;
  };
  const baseUpdateBoss = updateBoss;
  updateBoss = function(e, dt) { if (!(e.sealT > 0)) baseUpdateBoss(e, dt); };

  function movingInput() {
      return joy.active && Math.hypot(joy.dx, joy.dy) > 0.1 || keys['w'] || keys['a'] || keys['s'] || keys['d'] ||
      keys['arrowup'] || keys['arrowdown'] || keys['arrowleft'] || keys['arrowright'];
  }
  function eraseGrayDisk(x, y, radius) {
    const b = inkGridBounds(x, y, x, y, radius), rr = radius * radius;
    for (let gy = b.y0; gy <= b.y1; gy++) for (let gx = b.x0; gx <= b.x1; gx++) {
      const wx = WORLD_L + (gx + 0.5) * INK_CELL - x, wy = WORLD_T + (gy + 0.5) * INK_CELL - y;
      const i = gy * INK_GW + gx;
      if (wx * wx + wy * wy <= rr && inkOwner[i] === 2) {
        inkOwner[i] = 0; inkAmount[i] = 0; inkPulse[i] = 0; inkPaintedCount--;
        setInkSource(i, 0); syncInkPixel(i);
      }
    }
    putInkRegion(friendlyInkLayer, b.x0, b.y0, b.x1, b.y1);
    putInkRegion(hostileInkLayer, b.x0, b.y0, b.x1, b.y1);
  }
  function applyLevelEquipment() {
    if (hasItem('looseleaf')) {
      const hp = itemV('looseleaf', 'hp'); player.bonusHp += hp; recomputeEquip();
      player.hp = Math.min(player.maxhp, player.hp + hp);
    }
    if (hasItem('bookmark')) { refundInk(itemV('bookmark', 'ink'), player.x, player.y - 30, '灵感'); player.absorbCd = 0; }
    player.itemRerolls = itemV('rerollnote', 'reroll');
  }
  function collectEquipment(dr) {
    const it = ITEM_DEFS[dr.item], cur = player.equip[it.slot];
    drops = drops.filter(d => d !== dr);
    if (!cur) {
      player.equip[it.slot] = { key: dr.item, rarity: rarityIndex(dr) }; recomputeEquip();
      toast('获得' + RARITY_LIST[rarityIndex(dr)].name + '【' + it.name + '】');
      return;
    }
    pendingEquipment = { drop: dr }; state = 'equipment';
    joy.active = false; joy.dx = 0; joy.dy = 0;
    if (player.surgeCharging) cancelInkSurgeCharge(player.surgePointerId);
  }
  function resolveEquipment(replace) {
    if (state !== 'equipment' || !pendingEquipment) return false;
    const dr = pendingEquipment.drop, it = ITEM_DEFS[dr.item];
    if (replace) {
      player.equip[it.slot] = { key: dr.item, rarity: rarityIndex(dr) }; recomputeEquip();
      toast('已替换为' + RARITY_LIST[rarityIndex(dr)].name + '【' + it.name + '】');
    } else toast('保留当前装备');
    pendingEquipment = null; state = 'play'; return true;
  }

  const baseUpdate = update;
  update = function(dt) {
    if (state !== 'play') return baseUpdate(dt);
    if (hitStopT > 0 && hasAffix('absorb', 'deepslow')) dt *= 0.07 / ABSORB_RULE.slowScale;
    const oldLevel = player.level, moving = movingInput();
    player.moveT = moving ? player.moveT + dt : 0;
    player.stillT = moving ? 0 : player.stillT + dt;
    for (const k of ['exitShieldT', 'parryShieldT', 'itemAmbushT', 'itemSurgeT', 'itemParryT'])
      player[k] = Math.max(0, player[k] - dt);
    player.itemBurstT += dt;
    if (player.itemBurstT >= 1) { player.itemBurstT %= 1; player.itemBurstN = 0; }
    player.itemInkCdT += dt;
    if (player.itemInkCdT >= 1) { player.itemInkCdT %= 1; player.itemInkCd = 0; }
    player.eraserT = Math.max(0, (player.eraserT || 0) - dt);
    player.diveCd = Math.max(0, (player.diveCd || 0) - dt);
    for (const d of diveDecoys) d.t -= dt;
    diveDecoys = diveDecoys.filter(d => d.t > 0);
    for (const e of enemies) {
      e.paperVulnT = Math.max(0, (e.paperVulnT || 0) - dt);
      e.surgeSlowT = Math.max(0, (e.surgeSlowT || 0) - dt);
      e.sealT = Math.max(0, (e.sealT || 0) - dt);
    }
    if (hasAffix('dive', 'divepaint')) player.taken.divepaint = true;

    const nearDrop = drops.find(dr => Math.hypot(player.x - dr.x, player.y - dr.y) < 22);
    if (nearDrop) {
      collectEquipment(nearDrop);
      if (state === 'equipment') return;
    }

    let speedFactor = 1;
    if (player.diving) {
      if (hasAffix('dive', 'lightspeed')) speedFactor *= 1.18;
      if (player.diveEntryT > 0 && hasAffix('dive', 'entryspeed')) speedFactor *= 1.45;
      if (player.hp < player.maxhp * 0.35 && hasAffix('dive', 'lowhpdive')) speedFactor *= 1.12;
    }
    if (player.surgeCharging && hasAffix('surge', 'chargemove')) speedFactor *= 1.2;
    if (player.moveT >= 2 && hasItem('gridshoes')) speedFactor *= 1 + itemV('gridshoes', 'speed') / 100;
    const own = playerOnOwnInk(), hostile = playerOnHostileInk();
    if (!own && !hostile && hasItem('blankshoes')) speedFactor *= 1 + itemV('blankshoes', 'speed') / 100;
    if (hasItem('shoes') && player.hurtBoostT > 0) speedFactor *= (1 + itemV('shoes', 'hurt') / 100) / 1.3;
    const oldOwnSpeed = BATTLE.ink.ownSpeed, oldHostileSpeed = BATTLE.ink.hostileSpeed;
    if (hasItem('trackshoes')) BATTLE.ink.ownSpeed = 1 + itemV('trackshoes', 'speed') / 100;
    if (hasItem('blankshoes')) BATTLE.ink.ownSpeed = 1;
    if (player.diving && hasAffix('dive', 'grayboat')) BATTLE.ink.hostileSpeed = 1;
    player.eqSpd *= speedFactor;
    baseUpdate(dt);
    player.eqSpd /= speedFactor;
    BATTLE.ink.ownSpeed = oldOwnSpeed; BATTLE.ink.hostileSpeed = oldHostileSpeed;

    if (player.level > oldLevel) applyLevelEquipment();
    if (player.diving && hasAffix('dive', 'paperpass')) {
      for (const e of enemies) if (!e.dead && Math.hypot(e.x - player.x, e.y - player.y) < e.r + player.r) e.paperVulnT = 4;
    }
    if (player.diving && diveDecoys.length) {
      const decoy = diveDecoys[diveDecoys.length - 1];
      player.lastSeenX = decoy.x; player.lastSeenY = decoy.y;
      for (const e of enemies) {
        if (e.dead || e.boss || isShooter(e) || Math.hypot(e.x - decoy.x, e.y - decoy.y) > 280) continue;
        const a = Math.atan2(decoy.y - e.y, decoy.x - e.x);
        e.x += Math.cos(a) * e.sp * dt * 0.65; e.y += Math.sin(a) * e.sp * dt * 0.65;
      }
    }
    for (const b of bullets) {
      if (b.kind !== 'reflect' || !b.homing || !b.reflectTargetId) continue;
      const source = enemies.find(e => e.id === b.reflectTargetId && !e.dead);
      if (!source) continue;
      const speed = Math.hypot(b.vx, b.vy), current = Math.atan2(b.vy, b.vx);
      let turn = Math.atan2(source.y - b.y, source.x - b.x) - current;
      while (turn > Math.PI) turn -= Math.PI * 2;
      while (turn < -Math.PI) turn += Math.PI * 2;
      const angle = current + Math.max(-b.homing * dt, Math.min(b.homing * dt, turn));
      b.vx = Math.cos(angle) * speed; b.vy = Math.sin(angle) * speed;
    }
    if (player.eraserT > 0) eraseGrayDisk(player.x, player.y, 13);
  };

  const baseApplyOption = applyOption;
  applyOption = function(i) {
    const chosen = cards[i];
    baseApplyOption(i);
    if (chosen && chosen.kind === 'opaffix') player.taken[chosen.id] = true;
  };

  const baseRender = render;
  const equipmentReplaceRect = { x: 195, y: 555, w: 140, h: 48 };
  const equipmentKeepRect = { x: 40, y: 555, w: 140, h: 48 };
  const rerollRect = { x: 122, y: 552, w: 131, h: 38 };
  function wrapText(text, x, y, maxWidth, lineHeight) {
    let line = '', row = 0;
    for (const ch of text) {
      if (ctx.measureText(line + ch).width > maxWidth && line) { ctx.fillText(line, x, y + row * lineHeight); line = ch; row++; }
      else line += ch;
    }
    if (line) ctx.fillText(line, x, y + row * lineHeight);
    return row + 1;
  }
  function drawEquipmentCard(eq, x, y, w, title) {
    const def = ITEM_DEFS[eq.key], rarity = RARITY_LIST[rarityIndex(eq)];
    ctx.fillStyle = 'rgba(255,250,238,0.94)'; ctx.fillRect(x, y, w, 235);
    jrect(x, y, w, 235, rarity.color, 2.5);
    ctx.textAlign = 'center'; ctx.fillStyle = DARK; ctx.font = 'bold 12px ' + FONT; ctx.fillText(title, x + w / 2, y + 24);
    ctx.fillStyle = rarity.color; ctx.font = 'bold 12px ' + FONT; ctx.fillText(rarity.name, x + w / 2, y + 47);
    ctx.fillStyle = INK; ctx.font = 'bold 16px ' + FONT; ctx.fillText(def.name, x + w / 2, y + 73);
    ctx.font = '11px ' + FONT; ctx.fillStyle = DARK;
    ctx.fillText('攻击 +' + Math.round(def.atk * rarity.mul) + '%  生命 +' + Math.round(def.hp * rarity.mul), x + w / 2, y + 96);
    ctx.textAlign = 'left'; ctx.font = '11px ' + FONT;
    wrapText(itemDescription(eq.key, rarityIndex(eq)), x + 12, y + 122, w - 24, 18);
  }
  function drawEquipmentChoice() {
    const dr = pendingEquipment.drop, it = ITEM_DEFS[dr.item], cur = player.equip[it.slot];
    ctx.fillStyle = 'rgba(35,31,28,0.8)'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(255,250,238,0.97)'; ctx.fillRect(18, 75, W - 36, 545);
    jrect(18, 75, W - 36, 545, INK, 2.5);
    ctx.textAlign = 'center'; ctx.fillStyle = INK; ctx.font = 'bold 21px ' + FONT;
    ctx.fillText('捡到' + SLOT_NAME[it.slot] + '装备', W / 2, 112);
    ctx.fillStyle = DARK; ctx.font = '12px ' + FONT; ctx.fillText('同部位已有装备，由你决定是否替换', W / 2, 136);
    drawEquipmentCard(cur, 30, 158, 150, '当前装备');
    drawEquipmentCard({ key: dr.item, rarity: rarityIndex(dr) }, 195, 158, 150, '新装备');
    for (const [rect, label, color] of [[equipmentReplaceRect, '替换新装备  [1]', INK], [equipmentKeepRect, '保留当前  [2]', DARK]]) {
      ctx.fillStyle = 'rgba(255,250,238,0.96)'; ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
      jrect(rect.x, rect.y, rect.w, rect.h, color, 2.2);
      ctx.fillStyle = color; ctx.font = 'bold 13px ' + FONT; ctx.textAlign = 'center'; ctx.fillText(label, rect.x + rect.w / 2, rect.y + 29);
    }
  }
  render = function() {
    baseRender();
    ctx.save(); ctx.setTransform(viewScale, 0, 0, viewScale, 0, 0); ctx.scale(ZOOM, ZOOM); ctx.translate(-camX, -camY);
    for (const dr of drops) {
      const rarity = RARITY_LIST[rarityIndex(dr)], bobY = dr.y + Math.sin(dr.bob) * 3;
      ctx.globalAlpha = 0.25; ctx.fillStyle = rarity.color; ctx.fillRect(dr.x - 10, bobY - 10, 20, 20); ctx.globalAlpha = 1;
      setSeed(7000 + Math.floor(dr.x)); jrect(dr.x - 10, bobY - 10, 20, 20, rarity.color, 2.6);
      ctx.fillStyle = rarity.color; ctx.font = 'bold 9px ' + FONT; ctx.textAlign = 'center'; ctx.fillText(rarity.name, dr.x, bobY - 15);
    }
    for (const d of diveDecoys) {
      ctx.globalAlpha = Math.min(0.65, d.t); drawStick(d.x, d.y, 27, 0, inkFriendlyColor);
      jcircle(d.x, d.y, 22 + Math.sin(d.t * 8) * 3, inkFriendlyColor, 1.2); ctx.globalAlpha = 1;
    }
    ctx.restore();
    SLOTS.forEach((s, i) => {
      const eq = player.equip[s]; if (!eq) return;
      const y = H - 103 + i * 14;
      ctx.fillStyle = 'rgba(255,250,238,0.9)'; ctx.fillRect(12, y, 151, 13);
      ctx.fillStyle = RARITY_LIST[rarityIndex(eq)].color; ctx.textAlign = 'left'; ctx.font = 'bold 10px ' + FONT;
      ctx.fillText('[' + SLOT_NAME[s] + ']' + RARITY_LIST[rarityIndex(eq)].name + '·' + ITEM_DEFS[eq.key].name, 16, y + 10);
    });
    if (state === 'levelup' && hasItem('rerollnote')) {
      ctx.fillStyle = 'rgba(255,250,238,0.9)'; ctx.fillRect(rerollRect.x, rerollRect.y, rerollRect.w, rerollRect.h);
      jrect(rerollRect.x, rerollRect.y, rerollRect.w, rerollRect.h, player.itemRerolls > 0 ? INK : GRAY, 2);
      ctx.fillStyle = player.itemRerolls > 0 ? INK : GRAY; ctx.textAlign = 'center'; ctx.font = 'bold 12px ' + FONT;
      ctx.fillText('刷新选项（' + player.itemRerolls + '）R', rerollRect.x + rerollRect.w / 2, rerollRect.y + 24);
    }
    if (state === 'equipment' && pendingEquipment) drawEquipmentChoice();
  };

  canvas.addEventListener('pointerdown', e => {
    const p = toLogical(e);
    if (state === 'equipment') {
      e.preventDefault(); e.stopImmediatePropagation();
      if (pointInRect(p, equipmentReplaceRect)) resolveEquipment(true);
      else if (pointInRect(p, equipmentKeepRect)) resolveEquipment(false);
    } else if (state === 'levelup' && pointInRect(p, rerollRect)) {
      e.preventDefault(); e.stopImmediatePropagation(); rerollOptions();
    }
  }, true);
  window.addEventListener('keydown', e => {
    if (state === 'equipment' && (e.key === '1' || e.key === '2')) {
      e.preventDefault(); e.stopImmediatePropagation(); resolveEquipment(e.key === '1');
    } else if (state === 'levelup' && e.key.toLowerCase() === 'r') {
      e.preventDefault(); e.stopImmediatePropagation(); rerollOptions();
    }
  }, true);

  window.__buildRuntime = { collectEquipment, resolveEquipment, applyLevelEquipment, eraseGrayDisk };
})();

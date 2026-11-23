/* 构筑优化：留墨墨斑、外圈/持续补偿，以及额外移速转化体系。 */
(() => {
  'use strict';

  delete SUPPORTS.fatpipe;
  SUPPORTS.inkpool = { name: '留墨笔尖', tag: 'proj' };

  const S = {
    pools: [], moveGrace: 0, hurtSpeedT: 0, hurtCdT: 0, hurtTrailReady: true,
    poolSerial: 1
  };

  const baseSupDesc = supDesc;
  supDesc = function(id, l) {
    switch (id) {
      case 'inkpool': return '子弹首次命中留下 2 秒墨斑，每秒造成 ' + 12 * l + '% 范围伤害，每颗子弹一次';
      case 'projspd': return '投射物速度 +' + 20 * l + '%，伤害 +' + 10 * l + '%';
      case 'wide': return '范围/半径 +' + 15 * l + '%，外侧 30% 环带伤害 +' + 15 * l + '%';
      case 'sweep': return '打击范围 +' + 15 * l + '%，外侧 30% 环带伤害 +' + 10 * l + '%';
      case 'linger': return '范围持续时间 +' + 35 * l + '%，对应技能伤害 +' + 10 * l + '%';
      case 'dur': return '持续/召唤时间 +' + 30 * l + '%，对应技能伤害 +' + 10 * l + '%';
      case 'shock': return '小怪击退 +' + 50 * l + '%、僵直 ' + (0.2 * l).toFixed(1) + ' 秒；Boss 改为 0.8 秒受伤 +10%';
      default: return baseSupDesc(id, l);
    }
  };

  function addPassive(id, name, desc) {
    if (PASSIVES.some(p => p.id === id)) return;
    PASSIVES.push({ id, name, desc, once: true, fx: () => { player.taken[id] = true; } });
  }
  addPassive('hastyscript', '急就章', '每 10% 额外移速使主动释放频率提升 3%，最多提升 36%');
  addPassive('movingwrite', '边走边写', '移动中每 10% 额外移速使主动伤害 +2%，最多 +24%；停笔保留 0.5 秒');
  addPassive('runningguard', '行间拖影', '持续移动 1 秒后，每 10% 额外移速提供 1.5% 减伤，最多 18%');
  addPassive('stumblewrite', '踉跄疾书', '每 6 秒最多触发一次；实际受伤后 3 秒移速 +40%，增速期间首次主动留下伤害墨痕');

  function supportLevel(a, id) {
    const sp = a && a.supports && a.supports.find(s => s.id === id);
    return sp ? sp.lvl : 0;
  }

  const baseSkillCalc = skillCalc;
  skillCalc = function(a) {
    const c = baseSkillCalc(a);
    c.outerDmg = c.outerDmg || 0;
    for (const sp of a.supports) {
      const l = sp.lvl;
      if (sp.id === 'inkpool') c.inkPool = l;
      else if (sp.id === 'projspd') {
        c.proj /= 1 + 0.3 * l;
        c.proj *= 1 + 0.2 * l;
      } else if (sp.id === 'wide') {
        c.rad /= 1 + 0.22 * l;
        c.rad *= 1 + 0.15 * l;
        c.outerDmg += 0.15 * l;
      } else if (sp.id === 'sweep') {
        c.sweep = Math.max(0, (c.sweep || 0) - 0.2 * l) + 0.15 * l;
        c.outerDmg += 0.1 * l;
      } else if (sp.id === 'linger') c.dmg *= 1 + 0.1 * l;
      else if (sp.id === 'dur') {
        c.areaT /= 1 + 0.4 * l;
        c.areaT *= 1 + 0.3 * l;
        c.dmg *= 1 + 0.1 * l;
      }
    }
    const extra = extraSpeed();
    if (player.taken.hastyscript) c.cd *= 1 - Math.min(0.36, extra * 0.003);
    if (player.taken.movingwrite && movingForDamage()) c.dmg *= 1 + Math.min(0.24, extra * 0.002);
    const feet = player.equip && player.equip.feet;
    if (feet) {
      c.dmg *= 1 + speedConversion(feet.key, 'speedDmg', 'speedDmgCap') / 100;
      c.cd *= 1 - speedConversion(feet.key, 'speedCd', 'speedCdCap') / 100;
    }
    return c;
  };

  const baseAreaHit = areaHit;
  areaHit = function(e, dmg, c, sx, sy, zoneR, dist) {
    if (c && zoneR && dist !== undefined && dist >= zoneR * 0.7 && c.outerDmg) dmg *= 1 + c.outerDmg;
    const result = baseAreaHit(e, dmg, c, sx, sy, zoneR, dist);
    if (c && c.strike && c.shock && e.boss && !e.dead) {
      e.vuln = Math.max(e.vuln || 0, 0.1);
      e.vulnT = Math.max(e.vulnT || 0, 0.8);
    }
    return result;
  };

  const baseChargeParry = chargeParry;
  chargeParry = function() {
    const result = baseChargeParry();
    if (player.taken.inkmaster) player.itemParryT = 2;
    return result;
  };

  function movingInput() {
    return !!(joy.active && Math.hypot(joy.dx, joy.dy) > 0.1 || keys.w || keys.a || keys.s || keys.d ||
      keys.arrowup || keys.arrowdown || keys.arrowleft || keys.arrowright);
  }
  function movingForDamage() {
    return movingInput() || player.moveT > 0 || S.moveGrace > 0;
  }
  function localShoeSpeed() {
    const feet = player.equip && player.equip.feet;
    if (!feet) return 0;
    let value = 0;
    if (playerOnOwnInk()) value += itemV(feet.key, 'ownInkSpeed');
    if (playerOnHostileInk()) value += itemV(feet.key, 'graySpeed');
    if ((player.moveT || 0) >= 1) value += itemV(feet.key, 'moveSpeed');
    return value;
  }
  function conditionalShoeSpeed() {
    const feet = player.equip && player.equip.feet;
    if (!feet) return 0;
    let value = localShoeSpeed();
    if (player.diving) value += itemV(feet.key, 'diveSpeed');
    const R = window.BossCollectionRuntime;
    if (R) {
      if (R.state('knights').bootHurtT > 0) value += itemV(feet.key, 'hurtSpeed');
      if (R.state('pods').onRoot) value += itemV(feet.key, 'linkSpeed');
    }
    return value;
  }
  function speedSources() {
    const sources = [];
    const add = (id, value) => { if (value > 0) sources.push({ id, value }); };
    const feet = player.equip && player.equip.feet;
    if (feet) {
      add('feet:' + feet.key, itemV(feet.key, 'speed'));
      add('feet:conditional', conditionalShoeSpeed());
    }
    add('passive:spd', ((player.passiveCounts && player.passiveCounts.spd) || 0) * 6);
    if (hasItem('shoes') && player.hurtBoostT > 0) add('shoes:hurt', itemV('shoes', 'hurt'));
    if (hasItem('scribblehide') && window.BossSetRuntime && BossSetRuntime.state.hurtBoostT > 0)
      add('scribblehide:hurt', itemV('scribblehide', 'hurtBoost'));
    if (player.taken.stumblewrite && S.hurtSpeedT > 0) add('stumblewrite', 40);
    if (player.diving) {
      if (hasAffix('dive', 'lightspeed')) add('lightspeed', 18);
      if (player.diveEntryT > 0 && hasAffix('dive', 'entryspeed')) add('entryspeed', 45);
      if (player.hp < player.maxhp * 0.35 && hasAffix('dive', 'lowhpdive')) add('lowhpdive', 12);
    }
    if (player.surgeCharging && hasAffix('surge', 'chargemove')) add('chargemove', 20);
    return sources;
  }
  function extraSpeed() {
    return Math.max(0, speedSources().reduce((sum, source) => sum + source.value, 0));
  }
  function speedConversion(key, prop, capProp) {
    const perTen = itemV(key, prop);
    if (!perTen) return 0;
    return Math.min(itemV(key, capProp), extraSpeed() * perTen / 10);
  }

  function spawnPool(x, y, options) {
    if (S.pools.length >= 48) S.pools.shift();
    const pool = Object.assign({
      x, y, r: 48, t: 2, total: 2, tick: 0.2, interval: 0.2,
      dps: 0, skill: 'other', col: inkFriendlyColor, seed: 9300 + S.poolSerial++, noProc: true
    }, options || {});
    S.pools.push(pool);
    return pool;
  }
  function bulletPoolLevel(b) {
    if (b.inkPool) return b.inkPool;
    const a = player.actives.find(skill => skill.id === (b.inkPoolSkill || b.hadesSkill || b.skill));
    return supportLevel(a, 'inkpool');
  }
  function makeBulletPool(b, x, y, custom) {
    if (b.inkPoolDone || b.life <= 0 || b.arm > 0) return false;
    const level = custom && b.c ? (b.c.inkPool || 0) : bulletPoolLevel(b);
    if (!level) return false;
    b.inkPoolDone = true;
    const damage = b.inkPoolDamage !== undefined ? b.inkPoolDamage : (b.dmg !== undefined ? b.dmg : b.damage);
    const rad = custom && b.c ? (b.c.rad || 1) : (b.rad || 1);
    spawnPool(x, y, {
      r: 48 * Math.min(1.6, Math.max(0.8, rad || 1)),
      dps: Math.max(0, damage || 0) * 0.12 * level,
      skill: b.inkPoolSkill || b.hadesSkill || b.skill || 'other',
      col: b.col || (b.c && b.c.col) || inkFriendlyColor
    });
    return true;
  }
  function prepareProjectilePools() {
    for (const b of bullets) {
      if (b.inkPoolDone || b.life <= 0 || b.arm > 0) continue;
      for (const e of enemies) {
        if (e.dead || (b.kind === 'boom' && e.boomCd > 0)) continue;
        if (Math.hypot(e.x - b.x, e.y - b.y) < e.r + 6 * (b.rad || 1) * (b.size || 1)) {
          makeBulletPool(b, b.x, b.y, false);
          break;
        }
      }
    }
    const W = window.__weaponRuntime;
    if (!W) return;
    for (const b of W.state.bolts) {
      if (b.inkPoolDone || b.life <= 0 || b.delay > 0 || !b.c || !b.c.inkPool) continue;
      for (const e of enemies) {
        if (e.dead || b.hits[e.id]) continue;
        if (Math.hypot(e.x - b.x, e.y - b.y) < e.r + (b.radius || 6)) {
          makeBulletPool(b, b.x, b.y, true);
          break;
        }
      }
    }
    for (const shield of W.state.shields) {
      if (shield.inkPoolDone || shield.done || shield.returning || !shield.c || !shield.c.inkPool) continue;
      for (const e of enemies) {
        if (e.dead) continue;
        if (Math.hypot(e.x - shield.x, e.y - shield.y) < e.r + 30) {
          makeBulletPool(shield, shield.x, shield.y, true);
          break;
        }
      }
    }
  }
  function dealPoolDamage(pool, e, amount) {
    if (e.dead || !(amount > 0)) return;
    const dealt = Math.min(Math.max(0, e.hp), amount);
    recordSkillDamage(pool.skill, dealt);
    e.hp -= amount;
    e.flash = Math.max(e.flash || 0, 0.06);
    if (pool.showFloat) floats.push({ x: e.x, y: e.y - e.r - 5,
      txt: Math.max(1, Math.round(amount)), t: 0.45, color: pool.col, weak: true });
    if (e.hp <= 0) killEnemy(e);
  }
  function updatePools(dt) {
    for (let i = S.pools.length - 1; i >= 0; i--) {
      const pool = S.pools[i];
      pool.t -= dt; pool.tick -= dt; pool.showFloat = !pool.showFloat;
      while (pool.tick <= 0 && pool.t > 0) {
        pool.tick += pool.interval;
        for (const e of enemies) {
          if (!e.dead && Math.hypot(e.x - pool.x, e.y - pool.y) < pool.r + e.r)
            dealPoolDamage(pool, e, pool.dps * pool.interval);
        }
      }
      if (pool.t <= 0) S.pools.splice(i, 1);
    }
  }

  const baseFireSkill = fireSkill;
  fireSkill = function(a, c) {
    const counter = player.taken.stumblewrite && S.hurtSpeedT > 0 && S.hurtTrailReady;
    if (counter) S.hurtTrailReady = false;
    const result = baseFireSkill(a, c);
    if (counter) spawnPool(player.x, player.y, {
      r: 58, t: 1.5, total: 1.5, interval: 0.25, tick: 0.05,
      dps: 36 * player.dmgMul * (1 + player.eqAtk / 100), skill: 'stumblewrite', col: inkFriendlyColor
    });
    return result;
  };

  const baseHurtPlayer = hurtPlayer;
  hurtPlayer = function(dmg, ...rest) {
    if (player.taken.runningguard && player.moveT >= 1)
      dmg *= 1 - Math.min(0.18, extraSpeed() * 0.0015);
    const feet = player.equip && player.equip.feet;
    if (feet) dmg *= 1 - speedConversion(feet.key, 'speedDr', 'speedDrCap') / 100;
    const oldHp = player.hp;
    const result = baseHurtPlayer(dmg, ...rest);
    if (player.taken.stumblewrite && player.hp < oldHp && S.hurtCdT <= 0) {
      S.hurtSpeedT = 3; S.hurtCdT = 6; S.hurtTrailReady = true;
      floats.push({ x: player.x, y: player.y - 40, txt: '踉跄疾书', t: 0.75, color: inkFriendlyColor, crit: true });
    }
    return result;
  };

  const baseUpdate = update;
  update = function(dt) {
    if (state !== 'play') return baseUpdate(dt);
    S.moveGrace = movingInput() ? 0.5 : Math.max(0, S.moveGrace - dt);
    S.hurtSpeedT = Math.max(0, S.hurtSpeedT - dt);
    S.hurtCdT = Math.max(0, S.hurtCdT - dt);
    prepareProjectilePools();
    const stumbleFactor = player.taken.stumblewrite && S.hurtSpeedT > 0 ? 1.4 : 1;
    const shoeFactor = 1 + localShoeSpeed() / 100;
    const speedFactor = stumbleFactor * shoeFactor;
    player.eqSpd *= speedFactor;
    try { baseUpdate(dt); } finally { player.eqSpd /= speedFactor; }
    if (state === 'play') updatePools(dt);
  };

  function drawPools() {
    for (const pool of S.pools) {
      const alpha = Math.min(1, pool.t * 2, (pool.total - pool.t) * 8 + 0.25);
      ctx.globalAlpha = 0.13 * alpha;
      ctx.fillStyle = pool.col; ctx.beginPath(); ctx.arc(pool.x, pool.y, pool.r, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 0.55 * alpha;
      setSeed(pool.seed); jcircle(pool.x, pool.y, pool.r, pool.col, 2);
      jcircle(pool.x + 2, pool.y - 1, pool.r * 0.78, pool.col, 1.2);
      for (let i = -2; i <= 2; i++) {
        const yy = pool.y + i * pool.r * 0.22;
        jline(pool.x - pool.r * 0.55, yy + 5, pool.x + pool.r * 0.55, yy - 5, pool.col, 1);
      }
    }
    ctx.globalAlpha = 1;
  }
  const previousExtras = window.__drawWorldExtras;
  window.__drawWorldExtras = function() { if (previousExtras) previousExtras(); drawPools(); };

  const baseResetGame = resetGame;
  resetGame = function() {
    baseResetGame();
    S.pools.length = 0; S.moveGrace = 0; S.hurtSpeedT = 0; S.hurtCdT = 0;
    S.hurtTrailReady = true; S.poolSerial = 1;
  };

  window.BuildOptimizationRuntime = {
    state: S, speedSources, extraSpeed, conditionalShoeSpeed, speedConversion,
    movingInput, movingForDamage, spawnPool, prepareProjectilePools, updatePools
  };
})();

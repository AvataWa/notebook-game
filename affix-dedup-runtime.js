/* 三选一去重：条件数值、属性行为、技能轮转与区域控制；暴击/收割连携不在本文件改动。 */
(() => {
  'use strict';

  const REMOVED = ['soak', 'projrepeat', 'followup'];
  for (const id of REMOVED) delete SUPPORTS[id];

  const S = {
    castC: null, lastSkill: null, sheathCasts: [], sheathSerial: 1,
    thunderStreak: Object.create(null), thunderStatic: Object.create(null), thunderCritCd: Object.create(null),
    proc: false
  };
  const DURATION = { cyclone: 1.2, volcanic: 1.2, arc: 1.2, vortex: 5, candle: 1.2, inkrain: 2.5,
    ruler: 1.2, chalk: 1.2, brand: 4, cola: 1.2, spinlance: 3.6, inkgrenade: 1.2, absolve: 3 };
  const ELEMENTAL_DMG = ['physdmg', 'firedmg', 'icedmg', 'thunderdmg'];
  const ELEMENTAL_CRIT = ['physcrit', 'firecrit', 'icecrit', 'thundercrit'];

  function active(skill) { return player.actives.find(a => a.id === skill); }
  function level(skill, id) {
    const a = active(skill), sp = a && a.supports.find(s => s.id === id);
    return sp ? sp.lvl : 0;
  }
  function distanceFromPlayer(e) { return Math.hypot(e.x - player.x, e.y - player.y); }
  function nearestOther(e, range) {
    let best = null, bd = range * range;
    for (const other of enemies) {
      if (other.dead || other === e) continue;
      const d = (other.x - e.x) ** 2 + (other.y - e.y) ** 2;
      if (d < bd) { bd = d; best = other; }
    }
    return best;
  }

  const baseSupDesc = supDesc;
  supDesc = function(id, l) {
    switch (id) {
      case 'brutal': return '伤害 +' + 25 * l + '%，释放频率降低 ' + 8 * l + '%';
      case 'swift': return '连续施放不同主动时，返还前一个技能 ' + 8 * l + '% 冷却；重复同一技能不触发';
      case 'sharpen': return '子弹命中 125 范围内敌人时，伤害 +' + 35 * l + '%';
      case 'heavynib': return '子弹目标越远暴击率越高，600 距离时 +' + 20 * l + '%';
      case 'saturate': return '单次范围命中至少 3 敌时，伤害 +' + 25 * l + '%';
      case 'sheath': return '范围技能结束时，每个命中过的不同敌人返还 ' + l + '% 冷却，最多 ' + 8 * l + '%';
      case 'heavyweight': return '距上次施放至少 2 秒时，本次打击伤害 +' + 40 * l + '%';
      case 'scrit': return '打击命中 110 范围内敌人时，暴击率 +' + 20 * l + '%';
      case 'sweep': return '打击范围 +' + 15 * l + '%；外圈命中将普通怪拖向中心';
      case 'linger': return '范围持续时间 +' + 35 * l + '%';
      case 'dur': return '持续/召唤时间 +' + 30 * l + '%；修正带与炮台存在上限 +' + l;
      case 'physdmg': return '物理命中叠加硬压，每层使后续物理伤害 +' + 4 * l + '%，最多 3 层，持续 3 秒';
      case 'physcrit': return '物理暴击使小怪僵直 ' + (0.25 + 0.05 * (l - 1)).toFixed(2) + ' 秒，并额外叠 1 层硬压';
      case 'physvuln': return '不同主动的物理命中叠加破纸，每层使后续物理伤害 +' + 6 * l + '%，最多 3 层；同主动连续命中不叠层';
      case 'firedmg': return '目标每层燃烧使火焰伤害 +' + 8 * l + '%，最多计算 3 层';
      case 'firecrit': return '火焰暴击向附近 1 敌传播 1 层燃烧；目标没有燃烧时也会生成';
      case 'fireblast': return '燃烧目标死亡爆出 ' + (60 + 20 * (l - 1)) + '% 范围伤害，并为命中敌人附加 1 层燃烧；爆炸本身不连锁';
      case 'icedmg': return '对减速目标冰伤 +' + 12 * l + '%；对冻结目标改为 +' + 24 * l + '%';
      case 'icecrit': return '冰霜暴击额外叠 1 层寒霜；满 3 层冻结普通怪 0.5 秒';
      case 'thunderdmg': return '连续命中不同敌人时，每个已有目标使雷伤 +' + 8 * l + '%，最多计算 3 个';
      case 'thundercrit': return '雷电暴击额外传导 1 敌，造成 ' + (50 + 10 * (l - 1)) + '% 伤害，内置 0.5 秒';
      case 'thunderstatic': return '雷伤命中 4 个不同敌人后，在当前目标落下 ' + (60 + 20 * (l - 1)) + '% 静电雷';
      case 'areaspikes': return '每秒生成 ' + (1 + l) + ' 根墨刺，每根造成 25% 技能伤害并减速；累计命中 3 次定身普通怪';
      default: return baseSupDesc(id, l);
    }
  };

  const baseSupportUsable = supportUsable;
  supportUsable = function(sid, aid) {
    if (REMOVED.includes(sid)) return false;
    return baseSupportUsable(sid, aid);
  };

  const baseSkillCalc = skillCalc;
  skillCalc = function(a) {
    const c = baseSkillCalc(a);
    for (const sp of a.supports) {
      const l = sp.lvl;
      switch (sp.id) {
        case 'brutal':
          c.cd /= 1 + 0.08 * l;
          c.cd /= Math.max(0.2, 1 - 0.08 * l);
          c.releaseRateDown = 0.08 * l;
          break;
        case 'swift': c.cd /= Math.max(0.05, 1 - 0.13 * l); c.rotationSwift = l; break;
        case 'sharpen': c.bdmg = Math.max(0, c.bdmg - 0.2 * l); c.closeShot = l; break;
        case 'heavynib': c.bcrit = Math.max(0, c.bcrit - 0.1 * l); c.distanceCrit = l; break;
        case 'saturate': c.admg = Math.max(0, c.admg - 0.2 * l); c.saturateCrowd = l; break;
        case 'sheath': c.cd /= Math.max(0.05, 1 - 0.1 * l); c.sheathRefund = l; break;
        case 'heavyweight': c.sdmg = Math.max(0, c.sdmg - 0.22 * l); c.heavyweightPulse = l; break;
        case 'scrit': c.scrit = Math.max(0, c.scrit - 0.1 * l); c.closeStrikeCrit = l; break;
        case 'sweep': c.outerDmg = Math.max(0, (c.outerDmg || 0) - 0.1 * l); c.sweepPull = l; break;
        case 'linger': c.dmg /= 1 + 0.1 * l; break;
        case 'dur':
          c.dmg /= 1 + 0.1 * l;
          c.durExtraCap = l;
          if (a.id === 'vortex' || a.id === 'ballista') c.count += l;
          break;
        case 'physdmg': case 'firedmg': case 'icedmg': case 'thunderdmg':
          c.dmg /= 1 + 0.2 * l;
          c[sp.id + 'Conditional'] = l;
          break;
      }
    }
    return c;
  };

  function addBurn(e, skill, hit, lvl, source) {
    if (!e || e.dead) return;
    const burns = e.elBurns || (e.elBurns = []);
    const a = active(skill), c = a ? skillCalc(a) : { dmg: 1, col: attrOf(skill), rad: 1 };
    burns.push({ skill, t: 3, dps: hit * (0.08 + 0.04 * (lvl - 1)),
      c: source || Object.assign({}, c, { hadesSkill: skill }), hit });
    while (burns.length > 3) burns.shift();
  }
  function addFrost(e, skill, lvl) {
    if (!e || e.dead) return;
    e.elFrostN = Math.min(3, (e.elFrostN || 0) + 1);
    e.elFrostT = 2; e.elFrostPower = Math.max(e.elFrostPower || 0, 0.06 + 0.02 * (lvl - 1));
    e.slowT = Math.max(e.slowT || 0, 2);
    if (e.elFrostN >= 3 && !e.boss && gameTime >= (e.elFreezeCd || 0)) {
      e.stunT = Math.max(e.stunT || 0, 0.5); e.elFreezeCd = gameTime + 2.5;
      novas.push({ x: e.x, y: e.y, t: 0.25, max: e.r + 24, col: ICE_LIGHT });
    }
  }
  function pressureLevel(skill) { return Math.max(level(skill, 'physdmg'), level(skill, 'physcrit')); }
  function addPressure(e, skill, count) {
    const lvl = pressureLevel(skill); if (!lvl || e.dead) return;
    e.dedupPressureN = Math.min(3, (e.dedupPressureN || 0) + count);
    e.dedupPressureL = Math.max(e.dedupPressureL || 0, lvl); e.dedupPressureT = 3;
  }
  function derivedProcHit(e, amount, skill, sx, sy) {
    if (!e || e.dead || amount <= 0) return;
    S.proc = true;
    const elemental = window.__elementalSupports && window.__elementalSupports.state;
    const oldNoProc = elemental && elemental.noProc;
    if (elemental) elemental.noProc = true;
    try { hurtEnemy(e, amount, 0, sx, sy, 0, 0, 0, attrOf(skill), false, skill); }
    finally { S.proc = false; if (elemental) elemental.noProc = oldNoProc; }
  }

  const baseFireSkill = fireSkill;
  fireSkill = function(a, c) {
    const oldCast = S.castC, oldTotems = totems.length;
    S.castC = c;
    if (c.heavyweightPulse) {
      const last = a._dedupHeavyCastAt;
      c.heavyReady = !!c.heavyReady || last === undefined || gameTime - last >= 2;
    }
    if (c.sheathRefund) {
      c._sheathCast = { id: S.sheathSerial++, skill: a.id, lvl: c.sheathRefund,
        t: (DURATION[a.id] || 1.2) * (c.areaT || 1), ids: new Set(), done: false };
      S.sheathCasts.push(c._sheathCast);
    }
    try {
      const result = baseFireSkill(a, c);
      if (result !== false) {
        if (c.heavyweightPulse) a._dedupHeavyCastAt = gameTime;
        if (c.rotationSwift) {
          const previous = S.lastSkill && active(S.lastSkill);
          if (previous && previous.id !== a.id) {
            const refund = BATTLE.activeCooldowns[previous.id] * skillCalc(previous).cd * 0.08 * c.rotationSwift;
            previous.t = Math.max(0, previous.t - refund);
            floats.push({ x: player.x, y: player.y - 42, txt: '轮转返笔', t: 0.55, color: c.col || INK, weak: true });
          }
        }
        S.lastSkill = a.id;
        if (c.durExtraCap && a.id === 'ballista') {
          for (let i = oldTotems; i < totems.length; i++) totems[i].shots = Math.max(1, totems[i].shots - c.durExtraCap);
        }
      }
      return result;
    } finally { S.castC = oldCast; }
  };

  const baseAreaHit = areaHit;
  areaHit = function(e, dmg, c, sx, sy, zoneR, dist) {
    if (!c || e.dead) return baseAreaHit(e, dmg, c, sx, sy, zoneR, dist);
    if (c._sheathCast && !c._sheathCast.done) c._sheathCast.ids.add(e.id);
    if (c.saturateCrowd) {
      const x = sx === undefined ? e.x : sx, y = sy === undefined ? e.y : sy;
      const radius = zoneR || 90 * (c.rad || 1);
      let count = 0;
      for (const other of enemies) if (!other.dead && Math.hypot(other.x - x, other.y - y) <= radius + other.r) count++;
      if (count >= 3) dmg *= 1 + 0.25 * c.saturateCrowd;
    }
    if (c.strike && c.heavyweightPulse && c.heavyReady) dmg *= 1 + 0.4 * c.heavyweightPulse;
    const result = baseAreaHit(e, dmg, c, sx, sy, zoneR, dist);
    if (c.strike && c.sweepPull && zoneR && dist !== undefined && dist >= zoneR * 0.7 && !e.boss && !e.dead) {
      const x = sx === undefined ? player.x : sx, y = sy === undefined ? player.y : sy;
      const dx = x - e.x, dy = y - e.y, d = Math.hypot(dx, dy) || 1;
      const pull = Math.min(d, 30 + 15 * c.sweepPull);
      e.x += dx / d * pull; e.y += dy / d * pull;
    }
    return result;
  };

  const baseHurtEnemy = hurtEnemy;
  hurtEnemy = function(e, dmg, dotDps, sx, sy, vuln, critAdd, bossMul, hitCol, weakFloat, skillId) {
    const a = active(skillId), attr = SKILL_ATTR[skillId];
    const oldElementalNoProc = window.__elementalSupports && window.__elementalSupports.state.noProc;
    if (!a || !attr || S.proc || oldElementalNoProc || e.dead)
      return baseHurtEnemy(e, dmg, dotDps, sx, sy, vuln, critAdd, bossMul, hitCol, weakFloat, skillId);

    const tags = SKILL_TAGS[skillId] || [], distance = distanceFromPlayer(e);
    const closeShot = level(skillId, 'sharpen'), distanceCrit = level(skillId, 'heavynib');
    const closeStrike = level(skillId, 'scrit');
    if (closeShot && tags.includes('proj') && distance <= 125) dmg *= 1 + 0.35 * closeShot;
    let nextCritAdd = critAdd || 0;
    if (distanceCrit && tags.includes('proj')) nextCritAdd += Math.min(0.2 * distanceCrit, distance / 600 * 0.2 * distanceCrit);
    if (closeStrike && tags.includes('strike') && distance <= 110) nextCritAdd += 0.2 * closeStrike;
    for (const id of ELEMENTAL_CRIT) nextCritAdd -= 0.08 * level(skillId, id);

    const physDmg = level(skillId, 'physdmg'), physVuln = level(skillId, 'physvuln');
    if (attr === 'phys') {
      const pl = pressureLevel(skillId);
      if (pl && e.dedupPressureT > 0) dmg *= 1 + (e.dedupPressureN || 0) * 0.04 * (e.dedupPressureL || pl);
      if (physVuln && e.dedupBreakT > 0) dmg *= 1 + (e.dedupBreakN || 0) * 0.06 * physVuln;
    }
    if (attr === 'fire' && level(skillId, 'firedmg'))
      dmg *= 1 + Math.min(3, (e.elBurns || []).length) * 0.08 * level(skillId, 'firedmg');
    if (attr === 'ice' && level(skillId, 'icedmg')) {
      const frozen = (e.elFrostN || 0) >= 3 && e.stunT > 0;
      const slowed = frozen || e.slowT > 0 || e.elIceFieldT > 0 || (e.elFrostN || 0) > 0;
      if (slowed) dmg *= 1 + (frozen ? 0.24 : 0.12) * level(skillId, 'icedmg');
    }
    let thunderStreak = null;
    if (attr === 'thunder' && level(skillId, 'thunderdmg')) {
      thunderStreak = S.thunderStreak[skillId];
      if (!thunderStreak || gameTime - thunderStreak.t > 0.8) thunderStreak = S.thunderStreak[skillId] = { t: gameTime, ids: new Set() };
      dmg *= 1 + Math.min(3, thunderStreak.ids.size) * 0.08 * level(skillId, 'thunderdmg');
    }

    // 中和旧属性运行时的直接易伤与同目标静电计数，保留其余属性机制。
    const savedPhysVuln = e.physVuln, savedPhysVulnT = e.physVulnT;
    if (physVuln) { e.physVuln = 0; e.physVulnT = 0; }
    const staticLvl = level(skillId, 'thunderstatic');
    const hadThunderCounts = !!e.elThunderN, oldThunderCounts = e.elThunderN;
    const hadThunderN = !!(oldThunderCounts && Object.prototype.hasOwnProperty.call(oldThunderCounts, skillId));
    const oldThunderN = hadThunderN ? oldThunderCounts[skillId] : 0;
    if (staticLvl) { const counts = e.elThunderN || (e.elThunderN = Object.create(null)); counts[skillId] = 1; }

    const floatIndex = floats.length, rawDmg = dmg;
    const result = baseHurtEnemy(e, dmg, dotDps, sx, sy, vuln, nextCritAdd, bossMul, hitCol, weakFloat, skillId);
    const crit = !!(floats[floatIndex] && floats[floatIndex].crit);
    if (physVuln) { e.physVuln = savedPhysVuln || 0; e.physVulnT = savedPhysVulnT || 0; }
    if (staticLvl) {
      if (hadThunderCounts) {
        e.elThunderN = oldThunderCounts;
        if (hadThunderN) oldThunderCounts[skillId] = oldThunderN;
        else delete oldThunderCounts[skillId];
      } else delete e.elThunderN;
    }

    if (attr === 'phys') {
      if (physDmg && !e.dead) addPressure(e, skillId, 1);
      if (physVuln && !e.dead) {
        if (e.dedupBreakLast && e.dedupBreakLast !== skillId) e.dedupBreakN = Math.min(3, (e.dedupBreakN || 0) + 1);
        else if (!e.dedupBreakLast) e.dedupBreakN = 1;
        e.dedupBreakLast = skillId; e.dedupBreakT = 3;
      }
      const cl = level(skillId, 'physcrit');
      if (cl && crit) {
        if (!e.boss && !e.elite && !e.dead) e.stunT = Math.max(e.stunT || 0, 0.25 + 0.05 * (cl - 1));
        if (!e.dead) addPressure(e, skillId, 1);
      }
    } else if (attr === 'fire') {
      const cl = level(skillId, 'firecrit');
      if (cl && crit) {
        const other = nearestOther(e, 170);
        if (other) {
          const burns = e.elBurns || [], latest = burns[burns.length - 1];
          if (latest) {
            const targetBurns = other.elBurns || (other.elBurns = []);
            targetBurns.push(Object.assign({}, latest)); while (targetBurns.length > 3) targetBurns.shift();
          } else addBurn(other, skillId, rawDmg, cl);
          lightnings.push({ x1: e.x, y1: e.y, x2: other.x, y2: other.y, t: 0.16, delay: 0, prog: 1, col: ATTR_COLOR.fire });
        }
      }
    } else if (attr === 'ice') {
      const cl = level(skillId, 'icecrit'); if (cl && crit && !e.dead) addFrost(e, skillId, cl);
    } else if (attr === 'thunder') {
      const cl = level(skillId, 'thundercrit');
      if (cl && crit && (S.thunderCritCd[skillId] || 0) <= gameTime) {
        const other = nearestOther(e, 180);
        if (other) {
          S.thunderCritCd[skillId] = gameTime + 0.5;
          derivedProcHit(other, rawDmg * (0.5 + 0.1 * (cl - 1)), skillId, e.x, e.y);
          lightnings.push({ x1: e.x, y1: e.y, x2: other.x, y2: other.y, t: 0.16, delay: 0, prog: 1, col: ATTR_COLOR.thunder });
        }
      }
      if (staticLvl) {
        let rec = S.thunderStatic[skillId];
        if (!rec || gameTime - rec.t > 1.2) rec = S.thunderStatic[skillId] = { t: gameTime, ids: new Set() };
        rec.ids.add(e.id); rec.t = gameTime;
        if (rec.ids.size >= 4) {
          if (!e.dead) {
            derivedProcHit(e, rawDmg * (0.6 + 0.2 * (staticLvl - 1)), skillId, e.x, e.y - 80);
            lightnings.push({ x1: e.x, y1: e.y - 90, x2: e.x, y2: e.y, t: 0.2, delay: 0, prog: 1, c: skillCalc(a) });
          }
          rec.ids.clear();
        }
      }
    }
    if (thunderStreak) { thunderStreak.ids.add(e.id); thunderStreak.t = gameTime; }
    return result;
  };

  const baseKillEnemy = killEnemy;
  killEnemy = function(e) {
    const burns = e.elBurns && e.elBurns.slice(), latest = burns && burns[burns.length - 1];
    const blastLvl = latest && level(latest.skill, 'fireblast');
    baseKillEnemy(e);
    if (!blastLvl || !latest || S.proc) return;
    const radius = 85 * ((latest.c && latest.c.rad) || 1);
    for (const other of enemies) {
      if (other.dead || Math.hypot(other.x - e.x, other.y - e.y) > radius + other.r) continue;
      const targetBurns = other.elBurns || (other.elBurns = []);
      targetBurns.push(Object.assign({}, latest)); while (targetBurns.length > 3) targetBurns.shift();
    }
  };

  function spikeHit(e) {
    if (!e || e.dead) return;
    e.dedupSpikeN = (e.dedupSpikeN || 0) + 1; e.slowT = Math.max(e.slowT || 0, 0.8);
    if (!e.boss && e.dedupSpikeN % 3 === 0) e.stunT = Math.max(e.stunT || 0, 0.35);
  }

  const baseUpdate = update;
  update = function(dt) {
    baseUpdate(dt);
    if (state !== 'play') return;
    for (const rec of S.sheathCasts) {
      rec.t -= dt;
      if (rec.t > 0 || rec.done) continue;
      rec.done = true;
      const a = active(rec.skill); if (!a) continue;
      const ratio = Math.min(0.08 * rec.lvl, rec.ids.size * 0.01 * rec.lvl);
      if (ratio > 0) {
        a.t = Math.max(0, a.t - BATTLE.activeCooldowns[a.id] * skillCalc(a).cd * ratio);
        floats.push({ x: player.x, y: player.y - 42, txt: '收笔 +' + Math.round(ratio * 100) + '%', t: 0.55, color: INK, weak: true });
      }
    }
    S.sheathCasts = S.sheathCasts.filter(rec => !rec.done);
    for (const e of enemies) {
      e.dedupPressureT = Math.max(0, (e.dedupPressureT || 0) - dt);
      if (e.dedupPressureT <= 0) e.dedupPressureN = 0;
      e.dedupBreakT = Math.max(0, (e.dedupBreakT || 0) - dt);
      if (e.dedupBreakT <= 0) { e.dedupBreakN = 0; e.dedupBreakLast = null; }
    }
  };

  const baseResetGame = resetGame;
  resetGame = function() {
    baseResetGame();
    S.castC = null; S.lastSkill = null; S.sheathCasts = []; S.sheathSerial = 1;
    S.thunderStreak = Object.create(null); S.thunderStatic = Object.create(null);
    S.thunderCritCd = Object.create(null); S.proc = false;
  };

  window.AffixDedupRuntime = { state: S, removed: REMOVED, level, addBurn, addFrost, addPressure, spikeHit };
})();

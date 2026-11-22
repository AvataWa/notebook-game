/* 连笔蜡笔专属辅助：同线爆发、残线铺色、刮蜡飞屑与多主动引爆。 */
(() => {
  'use strict';
  const IDS = ['cycloneline', 'cycloneresidue', 'cycloneshards', 'cyclonedetonate'];
  Object.assign(SUPPORTS, {
    cycloneline: { name: '一线到底', tag: 'strike', skills: ['cyclone'] },
    cycloneresidue: { name: '残蜡刻痕', tag: 'area', skills: ['cyclone'] },
    cycloneshards: { name: '飞屑刮刀', tag: 'strike', skills: ['cyclone'] },
    cyclonedetonate: { name: '裂蜡批注', tag: 'area', skills: ['cyclone'] }
  });

  const baseSupDesc = supDesc;
  supDesc = function(id, l) {
    switch (id) {
      case 'cycloneline': return '同线命中 ' + (l >= 3 ? 2 : 3) + ' 只及以上直接刮蜡' + (l >= 5 ? '，刮蜡后保留 1 层' : '');
      case 'cycloneresidue': return '其他怪穿线受 30% 伤害\n并叠 1 层；残线持续 ' + (1.6 + 0.4 * (l - 1)).toFixed(1) + ' 秒';
      case 'cycloneshards': return '刮蜡向两端发蜡屑\n造成 ' + (40 + 10 * (l - 1)) + '% 刮蜡伤害并叠 1 层' + (l >= 3 ? '；折返' : '');
      case 'cyclonedetonate': return '其他主动消耗 2 层蜡色引爆\n造成 ' + (60 + 10 * (l - 1)) + '% 刮蜡；单目标间隔 ' + Math.max(0.3, 0.6 - 0.05 * (l - 1)).toFixed(2) + ' 秒';
      default: return baseSupDesc(id, l);
    }
  };

  const baseSkillCalc = skillCalc;
  skillCalc = function(a) {
    const c = baseSkillCalc(a);
    if (a.id === 'cyclone') {
      for (const sp of a.supports) {
        if (sp.id === 'cycloneline') c.cycloneLine = sp.lvl;
        else if (sp.id === 'cycloneresidue') c.cycloneResidue = sp.lvl;
        else if (sp.id === 'cycloneshards') c.cycloneShards = sp.lvl;
        else if (sp.id === 'cyclonedetonate') c.cycloneDetonate = sp.lvl;
      }
    }
    return c;
  };

  const S = { residuals: [], shards: [] };
  const cap = (array, item, max) => { if (array.length >= max) array.shift(); array.push(item); return item; };

  // 一线到底只改变真实短直线的叠层规则；残线与蜡屑的 comboCount 固定为 1，不能套用同线爆发。
  const baseApplyCycloneWax = applyCycloneWax;
  applyCycloneWax = function(e, bl, combo) {
    if (!e || e.dead) return;
    e.waxAngle = bl.angle || 0;
    const level = bl.c.cycloneLine || 0, threshold = level >= 3 ? 2 : 3;
    if (level && (bl.comboCount || 0) >= threshold) {
      e.waxStacks = Math.max(e.waxStacks || 0, 2);
      baseApplyCycloneWax(e, bl, false);
      if (level >= 5 && !e.dead) e.waxStacks = Math.max(e.waxStacks || 0, 1);
      return;
    }
    return baseApplyCycloneWax(e, bl, combo);
  };

  function addResidual(bl) {
    const level = bl.c.cycloneResidue;
    if (!level || !bl.points || bl.points.length !== 2) return;
    cap(S.residuals, {
      points: bl.points.map(p => ({ x: p.x, y: p.y })), x: bl.x, y: bl.y,
      angle: bl.angle, length: bl.length, width: Math.max(4, bl.width * 0.65),
      damage: bl.damage * 0.3, c: bl.c, hitIds: bl.hitIds.slice(),
      arm: 0.32, t: 1.6 + 0.4 * (level - 1), maxT: 1.6 + 0.4 * (level - 1)
    }, 24);
  }
  const baseResolveCycloneStroke = resolveCycloneStroke;
  resolveCycloneStroke = function(bl) {
    const wasResolved = bl.resolved;
    const result = baseResolveCycloneStroke(bl);
    if (!wasResolved && bl.resolved) addResidual(bl);
    return result;
  };

  function spawnShards(e, bl) {
    const level = bl.c.cycloneShards;
    if (!level || bl.derived === 'shard') return;
    const angle = Number.isFinite(bl.angle) ? bl.angle : (e.waxAngle || 0);
    for (const dir of [-1, 1]) {
      const distance = 120 + 15 * (level - 1);
      cap(S.shards, {
        x: e.x, y: e.y, originX: e.x, originY: e.y, angle, dir,
        speed: 250, distance, remaining: distance, returns: level >= 3 ? 1 : 0,
        phase: 'out', hit: false, ignoreId: e.id, dead: false,
        damage: 18 * bl.c.dmg * (0.4 + 0.1 * (level - 1)), c: bl.c
      }, 40);
    }
  }
  const baseTriggerCycloneScrape = triggerCycloneScrape;
  triggerCycloneScrape = function(e, bl, damageScale = 1) {
    const before = e.waxScrapes || 0;
    const result = baseTriggerCycloneScrape(e, bl, damageScale);
    if ((e.waxScrapes || 0) > before) spawnShards(e, bl);
    return result;
  };

  function residualBl(r) {
    return { x: r.x, y: r.y, points: r.points, angle: r.angle, length: r.length,
      width: r.width, damage: r.damage, c: r.c, comboCount: 1, derived: 'residual' };
  }
  function shardBl(s) {
    return { x: s.x, y: s.y, points: [{ x: s.x - Math.cos(s.angle) * 8, y: s.y - Math.sin(s.angle) * 8 },
      { x: s.x + Math.cos(s.angle) * 8, y: s.y + Math.sin(s.angle) * 8 }],
      angle: s.angle, length: 16, width: 6, damage: s.damage, c: s.c, comboCount: 1, derived: 'shard' };
  }
  function updateResiduals(dt) {
    for (const r of S.residuals) {
      let activeDt = dt;
      if (r.arm > 0) {
        r.arm -= dt;
        if (r.arm > 0) continue;
        activeDt = Math.max(0, -r.arm); r.arm = 0;
      }
      r.t -= activeDt;
      const bl = residualBl(r);
      for (const e of enemies) {
        if (e.dead || r.hitIds.includes(e.id)) continue;
        if (pointSegDist(e, r.points[0], r.points[1]) >= e.r + r.width) continue;
        r.hitIds.push(e.id);
        areaHit(e, r.damage, r.c, r.x, r.y, r.length * 0.5, Math.hypot(e.x - r.x, e.y - r.y));
        if (!e.dead) applyCycloneWax(e, bl, false);
      }
    }
    for (let i = S.residuals.length - 1; i >= 0; i--) if (S.residuals[i].t <= 0) S.residuals.splice(i, 1);
  }
  function updateShards(dt) {
    for (const s of S.shards) {
      const step = Math.min(s.remaining, s.speed * dt);
      s.x += Math.cos(s.angle) * s.dir * step;
      s.y += Math.sin(s.angle) * s.dir * step;
      s.remaining -= step;
      if (!s.hit) {
        for (const e of enemies) {
          if (e.dead || (s.phase === 'out' && e.id === s.ignoreId)) continue;
          if (Math.hypot(e.x - s.x, e.y - s.y) >= e.r + 7) continue;
          s.hit = true;
          const bl = shardBl(s);
          areaHit(e, s.damage, s.c, s.x, s.y, 8, 0);
          if (!e.dead) applyCycloneWax(e, bl, false);
          break;
        }
      }
      if (s.remaining <= 0) {
        if (s.phase === 'out' && s.returns > 0) {
          s.phase = 'return'; s.dir *= -1; s.returns--;
          s.remaining = s.distance; s.hit = false;
        } else s.dead = true;
      }
    }
    for (let i = S.shards.length - 1; i >= 0; i--) if (S.shards[i].dead) S.shards.splice(i, 1);
  }
  function updateEffects(dt) { updateResiduals(dt); updateShards(dt); }

  function detonationSpec(e, skillId) {
    if (!e || e.dead || (e.waxStacks || 0) < 2 || skillId === 'cyclone' || !SKILL_DEFS[skillId]) return null;
    const a = player.actives.find(entry => entry.id === 'cyclone' && entry.supports.some(sp => sp.id === 'cyclonedetonate'));
    if (!a) return null;
    const support = a.supports.find(sp => sp.id === 'cyclonedetonate'), level = support.lvl;
    const interval = Math.max(0.3, 0.6 - 0.05 * (level - 1));
    if (gameTime - (e.cycloneDetonateAt === undefined ? -999 : e.cycloneDetonateAt) < interval) return null;
    return { c: skillCalc(a), ratio: 0.6 + 0.1 * (level - 1) };
  }
  function detonate(e, spec) {
    if (!e || e.dead) return;
    e.cycloneDetonateAt = gameTime;
    const angle = e.waxAngle || 0, length = e.r * 2 + 42;
    const c = Object.assign({}, spec.c, { hadesSkill: 'cyclone' });
    const bl = { x: e.x, y: e.y, angle, length, c, derived: 'detonate', comboCount: 1,
      points: [{ x: e.x - Math.cos(angle) * length * 0.5, y: e.y - Math.sin(angle) * length * 0.5 },
        { x: e.x + Math.cos(angle) * length * 0.5, y: e.y + Math.sin(angle) * length * 0.5 }] };
    triggerCycloneScrape(e, bl, spec.ratio);
  }
  const baseHurtEnemy = hurtEnemy;
  hurtEnemy = function(e, dmg, ...args) {
    const spec = detonationSpec(e, args[8]);
    const result = baseHurtEnemy(e, dmg, ...args);
    if (spec && !e.dead) detonate(e, spec);
    return result;
  };

  function draw() {
    for (const r of S.residuals) {
      if (r.arm > 0) continue;
      const a = r.points[0], b = r.points[1];
      ctx.globalAlpha = Math.min(0.38, Math.max(0, r.t / r.maxT) * 0.5);
      jline(a.x, a.y, b.x, b.y, r.c.col || INK, 2.4);
      const mx = (a.x + b.x) * 0.5, my = (a.y + b.y) * 0.5;
      const nx = -Math.sin(r.angle) * 5, ny = Math.cos(r.angle) * 5;
      jline(mx - nx, my - ny, mx + nx, my + ny, r.c.col || INK, 1.4);
    }
    ctx.globalAlpha = 0.9;
    for (const s of S.shards) {
      const cs = Math.cos(s.angle) * s.dir, sn = Math.sin(s.angle) * s.dir;
      jline(s.x - cs * 6, s.y - sn * 6, s.x + cs * 7, s.y + sn * 7, s.c.col || INK, 3.2);
      jline(s.x - sn * 3, s.y + cs * 3, s.x + sn * 3, s.y - cs * 3, s.c.col || INK, 1.4);
    }
    ctx.globalAlpha = 1;
  }
  function reset() { S.residuals.length = 0; S.shards.length = 0; }
  const baseResetGame = resetGame;
  resetGame = function() { baseResetGame(); reset(); };
  const baseUpdate = update;
  update = function(dt) { baseUpdate(dt); if (state === 'play') updateEffects(dt); };
  const previousExtras = window.__drawWorldExtras;
  window.__drawWorldExtras = function() { if (previousExtras) previousExtras(); draw(); };

  window.__cycloneSupports = { state: S, updateEffects, spawnShards, detonate, reset, get ids() { return IDS.slice(); } };
  resetGame();
})();

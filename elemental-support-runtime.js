/* 属性辅助：直接增伤、属性暴击与四系机制；删除八条低效辅助。 */
(() => {
  'use strict';
  const REMOVED = ['longshot', 'projpierceramp', 'projback', 'combo', 'counter', 'strikethird', 'strikeback', 'pressboss'];
  for (const id of REMOVED) delete SUPPORTS[id];
  const DEFS = {
    physdmg: ['硬压笔尖', 'phys', '物理伤害 +20%/级'], physcrit: ['重墨批注', 'phys', '物理暴击率 +8%/级'],
    physvuln: ['破纸', 'phys', '物理命中使后续物理伤害 +6%/级，持续 3 秒'],
    physburst: ['碎纸迸溅', 'phys', '同目标每第 4 次物理命中爆出 45% 范围伤害，每级 +15%'],
    firedmg: ['燃墨加温', 'fire', '火焰伤害 +20%/级'], firecrit: ['焦墨爆点', 'fire', '火焰暴击率 +8%/级'],
    fireburn: ['叠燃', 'fire', '火伤附加燃烧，每层 8%/秒、持续 3 秒，最多 3 层；每级 +4%'],
    firespark: ['火星四溅', 'fire', '燃烧敌人每 0.6 秒迸出 2 颗 25% 火星，每级 +10%'],
    fireblast: ['爆燃', 'fire', '燃烧目标死亡时爆出 60% 范围伤害，每级 +20%；不能连锁爆燃'],
    icedmg: ['低温凝墨', 'ice', '冰霜伤害 +20%/级'], icecrit: ['冰晶锋刃', 'ice', '冰霜暴击率 +8%/级'],
    icefrost: ['寒霜', 'ice', '冰伤叠加减速，满 3 层冻结普通怪 0.5 秒；Boss 只减速'],
    iceshard: ['碎冰', 'ice', '命中减速目标发射 3 枚 30% 碎冰，每级 +10%，每技能 0.3 秒间隔'],
    icefield: ['冰面留痕', 'ice', '冰技能留下 2 秒减速冰面，每级持续 +0.4 秒'],
    thunderdmg: ['过压墨迹', 'thunder', '雷电伤害 +20%/级'], thundercrit: ['雷击校准', 'thunder', '雷电暴击率 +8%/级'],
    thunderstatic: ['静电蓄能', 'thunder', '同目标每第 4 次雷伤落下 60% 静电雷，每级 +20%'],
    thunderchain: ['分叉导电', 'thunder', '雷伤额外传导 1 个目标，造成 50% 伤害，每级 +10%'],
    thundernet: ['雷网留线', 'thunder', '雷电路径留下 1 秒雷网，造成 20% 伤害，每级 +10%']
  };
  const ELEMENT_IDS = Object.keys(DEFS), CRIT_ID = { phys: 'physcrit', fire: 'firecrit', ice: 'icecrit', thunder: 'thundercrit' };
  const DMG_ID = { phys: 'physdmg', fire: 'firedmg', ice: 'icedmg', thunder: 'thunderdmg' };
  for (const [id, def] of Object.entries(DEFS)) SUPPORTS[id] = { name: def[0], tag: 'all', element: def[1],
    skills: Object.keys(SKILL_ATTR).filter(skill => skill !== 'bloodcore' && SKILL_ATTR[skill] === def[1]) };
  const baseSupportUsable = supportUsable;
  supportUsable = function(sid, aid) {
    if (!SUPPORTS[sid]) return false;
    if (ELEMENT_IDS.includes(sid)) return !!(SUPPORTS[sid].skills || []).includes(aid);
    return baseSupportUsable(sid, aid);
  };
  const baseSupDesc = supDesc;
  supDesc = function(id, l) {
    if (!DEFS[id]) return baseSupDesc(id, l);
    switch (id) {
      case 'physdmg': case 'firedmg': case 'icedmg': case 'thunderdmg': return '对应属性伤害 +' + 20 * l + '%';
      case 'physcrit': case 'firecrit': case 'icecrit': case 'thundercrit': return '对应属性暴击率 +' + 8 * l + '%';
      case 'physvuln': return '物理命中使后续物理伤害 +' + 6 * l + '%，持续 3 秒';
      case 'physburst': return '同目标每第 4 次物理命中爆出 ' + (45 + 15 * (l - 1)) + '% 范围伤害';
      case 'fireburn': return '燃烧每层每秒 ' + (8 + 4 * (l - 1)) + '% 伤害，持续 3 秒，最多 3 层';
      case 'firespark': return '燃烧敌人每 0.6 秒迸出 2 颗 ' + (25 + 10 * (l - 1)) + '% 火星';
      case 'fireblast': return '燃烧目标死亡爆出 ' + (60 + 20 * (l - 1)) + '% 范围伤害，不连锁';
      case 'icefrost': return '冰伤叠加 ' + (6 + 2 * (l - 1)) + '% 减速，最多 3 层；满层冻结普通怪 0.5 秒';
      case 'iceshard': return '命中减速目标发射 3 枚 ' + (30 + 10 * (l - 1)) + '% 碎冰，每技能 0.3 秒间隔';
      case 'icefield': return '冰技能留下 ' + (2 + 0.4 * (l - 1)).toFixed(1) + ' 秒减速冰面';
      case 'thunderstatic': return '同目标每第 4 次雷伤落下 ' + (60 + 20 * (l - 1)) + '% 静电雷';
      case 'thunderchain': return '雷伤额外传导 1 敌，造成 ' + (50 + 10 * (l - 1)) + '% 伤害';
      case 'thundernet': return '雷电路径留下 1 秒雷网，造成 ' + (20 + 10 * (l - 1)) + '% 伤害';
    }
    return DEFS[id][2];
  };
  const baseSkillCalc = skillCalc;
  skillCalc = function(a) {
    const c = baseSkillCalc(a), id = DMG_ID[SKILL_ATTR[a.id]];
    const sp = id && a.supports.find(s => s.id === id); if (sp) c.dmg *= 1 + 0.2 * sp.lvl;
    return c;
  };
  function active(skill) { return player.actives.find(a => a.id === skill); }
  function level(skill, id) { const a = active(skill), sp = a && a.supports.find(s => s.id === id); return sp ? sp.lvl : 0; }
  function nearestOther(e, range) {
    let best = null, bd = range * range;
    for (const other of enemies) { if (other.dead || other === e) continue; const d = (other.x - e.x) ** 2 + (other.y - e.y) ** 2; if (d < bd) { bd = d; best = other; } }
    return best;
  }
  const S = { noProc: false, iceZones: [], nets: [], shardCd: Object.create(null), netCd: Object.create(null) };
  function childC(skill) { const a = active(skill); return a ? Object.assign({}, skillCalc(a), { hadesSkill: skill }) : { dmg: 1, col: attrOf(skill), hadesSkill: skill }; }
  function procHit(e, amount, skill, x, y) {
    if (e.dead || amount <= 0) return;
    S.noProc = true;
    try { hurtEnemy(e, amount, 0, x === undefined ? e.x : x, y === undefined ? e.y : y, 0, 0, 0, attrOf(skill), false, skill); }
    finally { S.noProc = false; }
  }
  function areaProc(x, y, radius, amount, skill, c) {
    const cc = c || childC(skill); S.noProc = true;
    try { for (const other of enemies) if (!other.dead && Math.hypot(other.x - x, other.y - y) < radius + other.r)
      hurtEnemy(other, amount, 0, x, y, 0, 0, 0, cc.col || attrOf(skill), false, skill); }
    finally { S.noProc = false; }
    novas.push({ x, y, t: 0.28, max: radius, col: cc.col || attrOf(skill), c: cc });
  }
  function spawnShards(e, dmg, skill, c, count, ratio, kind) {
    if (bullets.length > 245) return;
    for (let i = 0; i < count; i++) { const ang = i / count * Math.PI * 2 + Math.random() * 0.25;
      fireBullet(e.x, e.y, ang, kind === 'ice' ? 540 : 420, dmg * ratio, kind || 'nib', { hits: 1, life: 0.55, col: c.col || attrOf(skill), hadesSkill: skill, rad: c.rad || 1, _noExpand: true }); }
  }

  const baseHurtEnemy = hurtEnemy;
  hurtEnemy = function(e, dmg, dotDps, sx, sy, vuln, critAdd, bossMul, hitCol, weakFloat, skillId) {
    const attr = SKILL_ATTR[skillId], a = active(skillId);
    if (!attr || !a || S.noProc || e.dead) return baseHurtEnemy(e, dmg, dotDps, sx, sy, vuln, critAdd, bossMul, hitCol, weakFloat, skillId);
    const crit = 0.08 * level(skillId, CRIT_ID[attr]);
    if (attr === 'phys' && e.physVulnT > 0) dmg *= 1 + (e.physVuln || 0);
    const result = baseHurtEnemy(e, dmg, dotDps, sx, sy, vuln, (critAdd || 0) + crit, bossMul, hitCol, weakFloat, skillId);
    if (e.dead) return result;
    if (attr === 'phys') {
      const vl = level(skillId, 'physvuln'); if (vl) { e.physVuln = 0.06 * vl; e.physVulnT = 3; }
      const bl = level(skillId, 'physburst');
      if (bl) { const counts = e.elPhysN || (e.elPhysN = Object.create(null)), n = (counts[skillId] || 0) + 1; counts[skillId] = n;
        if (n % 4 === 0) areaProc(e.x, e.y, 65, dmg * (0.45 + 0.15 * (bl - 1)), skillId, childC(skillId)); }
    } else if (attr === 'fire') {
      const bl = level(skillId, 'fireburn');
      if (bl) { const burns = e.elBurns || (e.elBurns = []), ratio = 0.08 + 0.04 * (bl - 1);
        burns.push({ skill: skillId, t: 3, dps: dmg * ratio, c: childC(skillId), hit: dmg });
        while (burns.length > 3) burns.shift(); }
    } else if (attr === 'ice') {
      const fl = level(skillId, 'icefrost');
      if (fl) { e.elFrostN = Math.min(3, (e.elFrostN || 0) + 1); e.elFrostT = 2; e.elFrostPower = 0.06 + 0.02 * (fl - 1); e.slowT = Math.max(e.slowT || 0, 2);
        if (e.elFrostN >= 3 && !e.boss && gameTime >= (e.elFreezeCd || 0)) { e.stunT = Math.max(e.stunT || 0, 0.5); e.elFreezeCd = gameTime + 2.5; novas.push({ x: e.x, y: e.y, t: 0.25, max: e.r + 24, col: ICE_LIGHT }); } }
      const sl = level(skillId, 'iceshard');
      if (sl && (e.slowT > 0 || e.elFrostN > 0) && (S.shardCd[skillId] || 0) <= gameTime) { S.shardCd[skillId] = gameTime + 0.3; spawnShards(e, dmg, skillId, childC(skillId), 3, 0.3 + 0.1 * (sl - 1), 'ice'); }
      const il = level(skillId, 'icefield');
      if (il && (S.netCd['ice' + skillId] || 0) <= gameTime) { S.netCd['ice' + skillId] = gameTime + 0.45;
        if (S.iceZones.length >= 40) S.iceZones.shift(); S.iceZones.push({ x: e.x, y: e.y, r: 45 * (childC(skillId).rad || 1), t: 2 + 0.4 * (il - 1), col: attrOf('ice') }); }
    } else if (attr === 'thunder') {
      const sl = level(skillId, 'thunderstatic');
      if (sl) { const counts = e.elThunderN || (e.elThunderN = Object.create(null)), n = (counts[skillId] || 0) + 1; counts[skillId] = n;
        if (n % 4 === 0) { procHit(e, dmg * (0.6 + 0.2 * (sl - 1)), skillId, e.x, e.y - 80); lightnings.push({ x1: e.x, y1: e.y - 90, x2: e.x, y2: e.y, t: 0.2, delay: 0, prog: 1, c: childC(skillId) }); } }
      const cl = level(skillId, 'thunderchain');
      if (cl) { const other = nearestOther(e, 180); if (other) { procHit(other, dmg * (0.5 + 0.1 * (cl - 1)), skillId, e.x, e.y); lightnings.push({ x1: e.x, y1: e.y, x2: other.x, y2: other.y, t: 0.15, delay: 0, prog: 1, col: attrOf('thunder') }); } }
      const nl = level(skillId, 'thundernet');
      if (nl && (S.netCd[skillId] || 0) <= gameTime) { S.netCd[skillId] = gameTime + 0.3; if (S.nets.length >= 48) S.nets.shift();
        S.nets.push({ x1: sx === undefined ? player.x : sx, y1: sy === undefined ? player.y : sy, x2: e.x, y2: e.y, t: 1, damage: dmg * (0.2 + 0.1 * (nl - 1)), skill: skillId, next: Object.create(null) }); }
    }
    return result;
  };

  const baseKillEnemy = killEnemy;
  killEnemy = function(e) {
    const burns = e.elBurns && e.elBurns.slice(), latest = burns && burns[burns.length - 1];
    baseKillEnemy(e);
    if (latest && !S.noProc) {
      const l = level(latest.skill, 'fireblast');
      if (l) areaProc(e.x, e.y, 85 * (latest.c.rad || 1), latest.hit * (0.6 + 0.2 * (l - 1)), latest.skill, latest.c);
    }
  };

  const baseUpdate = update;
  update = function(dt) {
    const slowed = [];
    if (state === 'play') for (const e of enemies) {
      e.physVulnT = Math.max(0, (e.physVulnT || 0) - dt); e.elFrostT = Math.max(0, (e.elFrostT || 0) - dt);
      if (e.elFrostT <= 0) e.elFrostN = 0;
      const fieldSlow = e.elIceFieldT > 0 ? 0.15 : 0, frostSlow = (e.elFrostN || 0) * (e.elFrostPower || 0);
      const factor = Math.max(0.35, 1 - fieldSlow - frostSlow); if (factor < 1) { slowed.push([e, e.sp]); e.sp *= factor; }
    }
    try { baseUpdate(dt); } finally { for (const pair of slowed) pair[0].sp = pair[1]; }
    if (state !== 'play') return;
    for (const e of enemies) {
      if (e.dead) continue;
      e.elIceFieldT = Math.max(0, (e.elIceFieldT || 0) - dt);
      if (e.elBurns) {
        let total = 0; for (const b of e.elBurns) { b.t -= dt; total += b.t > 0 ? b.dps : 0; }
        e.elBurns = e.elBurns.filter(b => b.t > 0);
        if (total > 0) { const dealt = Math.min(e.hp, total * dt); e.hp -= dealt; recordSkillDamage(e.elBurns[e.elBurns.length - 1].skill, dealt); if (e.hp <= 0) { killEnemy(e); continue; } }
        const latest = e.elBurns[e.elBurns.length - 1];
        if (latest) { const sl = level(latest.skill, 'firespark');
          if (sl) { const timers = e.elSparkT || (e.elSparkT = Object.create(null)); timers[latest.skill] = (timers[latest.skill] || 0) - dt;
            if (timers[latest.skill] <= 0) { timers[latest.skill] = 0.6; spawnShards(e, latest.hit, latest.skill, latest.c, 2, 0.25 + 0.1 * (sl - 1), 'nib'); } } }
      }
    }
    for (const z of S.iceZones) { z.t -= dt; for (const e of enemies) if (!e.dead && Math.hypot(e.x - z.x, e.y - z.y) < z.r + e.r) e.elIceFieldT = Math.max(e.elIceFieldT || 0, 0.2); }
    S.iceZones = S.iceZones.filter(z => z.t > 0);
    for (const n of S.nets) { n.t -= dt; for (const e of enemies) if (!e.dead && (n.next[e.id] || 0) <= gameTime && pointSegDist(e, { x: n.x1, y: n.y1 }, { x: n.x2, y: n.y2 }) < e.r + 9) {
      n.next[e.id] = gameTime + 0.4; procHit(e, n.damage, n.skill, n.x1, n.y1); } }
    S.nets = S.nets.filter(n => n.t > 0);
  };
  function draw() {
    for (const z of S.iceZones) { ctx.globalAlpha = Math.min(0.18, z.t * 0.1); ctx.fillStyle = ICE_LIGHT; ctx.beginPath(); ctx.arc(z.x, z.y, z.r, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 0.5; jcircle(z.x, z.y, z.r, ICE_DARK, 2); }
    for (const n of S.nets) { ctx.globalAlpha = Math.min(0.65, n.t); jline(n.x1, n.y1, n.x2, n.y2, ATTR_COLOR.thunder, 3); }
    ctx.globalAlpha = 1;
  }
  const previousExtras = window.__drawWorldExtras;
  window.__drawWorldExtras = function() { if (previousExtras) previousExtras(); draw(); };
  const baseReset = resetGame;
  resetGame = function() { baseReset(); S.iceZones.length = 0; S.nets.length = 0; S.shardCd = Object.create(null); S.netCd = Object.create(null); S.noProc = false; };
  window.__elementalSupports = { defs: DEFS, removed: REMOVED, state: S, level };
})();

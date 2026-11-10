/* 第二批武器专属被动扩展：每个主动由两条补足为四条，并接入真实战斗结算。 */
(() => {
  'use strict';

  const RED = '#b84747', BLUE = '#315fa8', PURPLE = '#76519b';
  const IDS = [
    'slash_charge', 'slash_crack', 'pierce_ramp', 'pierce_pin', 'spin_spear', 'spin_blast',
    'shield_ink', 'shield_charge', 'ricoshield_ramp', 'ricoshield_orbit', 'perfect_mark', 'perfect_rain',
    'focus_redirect', 'focus_intercept', 'fist_guard', 'fist_field', 'grenade_burn', 'grenade_bounce',
    'rail_hot', 'rail_chase'
  ];
  const S = { zones: [], orbiters: [], fx: [], preBolts: [], preGrenades: [] };
  function has(id) { return !!(player && player.taken && player.taken[id]); }
  function active(id) { return player && player.actives.some(a => a.id === id); }
  function passive(id, name, desc, skill) {
    PASSIVES.push({ id, name, desc, once: true, available: () => active(skill), fx: () => { player.taken[id] = true; } });
  }
  passive('slash_charge', '斩弹蓄锋', '断页斩每斩断 1 枚敌弹，下一斩伤害 +6%，最多 +30%；释放后清空', 'pageslash');
  passive('slash_crack', '裂口封路', '断页斩留下 2 秒斩痕，经过的敌人每 0.6 秒受到 25% 伤害', 'pageslash');
  passive('pierce_ramp', '串页', '交叉贯枪每道枪影各自累计贯穿，对后续目标伤害 +8%，每道最多 +40%', 'piercerush');
  passive('pierce_pin', '钉足红圈', '双枪终点普通怪定身 0.6 秒，精英/Boss 减速 35%，持续 1 秒', 'piercerush');
  passive('spin_spear', '旋枪飞刺', '钉页旋枪每 0.8 秒发射一枚 40% 伤害飞刺', 'spinlance');
  passive('spin_blast', '钉点爆页', '旋枪开始返回时，原钉点爆炸并造成 60% 伤害', 'spinlance');
  passive('shield_ink', '格挡回墨', '盾印每格挡 1 枚敌弹回复 2 墨，每次施放最多回复 12', 'shieldrush');
  passive('shield_charge', '守势蓄击', '盾印每格挡 1 弹，结束盾震伤害 +8%，最多 +48%', 'shieldrush');
  passive('ricoshield_ramp', '弹射增幅', '折跃飞盾每次弹射后下一击伤害 +12%，返回后重置', 'ricoshield');
  passive('ricoshield_orbit', '旋盾护体', '接盾后绕身 2 秒，每 0.4 秒造成 35% 接触伤害', 'ricoshield');
  passive('perfect_mark', '主靶批注', '完美一箭首个命中目标被标记 4 秒，其他主动对其伤害 +20%', 'perfectarrow');
  passive('perfect_rain', '箭雨落款', '完美箭消失时沿末段路径落下 3 支 40% 伤害小箭', 'perfectarrow');
  passive('focus_redirect', '靶死余箭', '群箭目标早亡时，剩余箭分散追击且伤害 +25%', 'arrowfocus');
  passive('focus_intercept', '悬箭护航', '悬停箭拦截敌弹后立即射出，本次伤害为 60%', 'arrowfocus');
  passive('fist_guard', '磁墨护膜', '磁墨每聚拢 1 敌获得 2% 减伤，持续 2 秒，最多 12%', 'magfist');
  passive('fist_field', '坠地磁场', '下砸留下 2.5 秒磁场，牵引并每 0.5 秒造成 20% 伤害', 'magfist');
  passive('grenade_burn', '焦土延烧', '墨榴弹纸洞持续 3 秒，每 0.5 秒造成 20% 伤害', 'inkgrenade');
  passive('grenade_bounce', '跳弹引信', '墨榴弹首次落地后再弹跳并二次爆炸，造成 60% 伤害', 'inkgrenade');
  passive('rail_hot', '红热贯穿', '过热扫射热量达到 70% 后，子弹穿透 +1、伤害 +20%', 'heatrail');
  passive('rail_chase', '终末追枪', '扫射期间击杀追加 40% 终末弹，每轮最多 2 次', 'heatrail');

  function W() { return window.__weaponRuntime; }
  function cap(array, item, max) { if (array.length >= max) array.shift(); array.push(item); return item; }
  function byId(id) { return enemies.find(e => e.id === id && !e.dead) || null; }
  function nearest(x, y, range, excluded) {
    let best = null, d0 = range * range;
    for (const e of enemies) {
      if (e.dead || e.id === excluded) continue;
      const d = (e.x - x) ** 2 + (e.y - y) ** 2;
      if (d < d0) { d0 = d; best = e; }
    }
    return best;
  }
  function fx(type, x, y, r, col, t, extra) {
    return cap(S.fx, Object.assign({ type, x, y, r, col: col || RED, t, total: t }, extra || {}), 48);
  }
  function hit(e, damage, c, skill, x, y) {
    if (!e || e.dead) return;
    areaHit(e, damage, c, x === undefined ? e.x : x, y === undefined ? e.y : y);
  }
  function spawnBolt(o) { const runtime = W(); return runtime ? runtime.spawnBolt(o) : null; }

  /* 小钩子由 hades-weapons-runtime.js 在对应结算点调用。 */
  function onSlashCut(slash) {
    if (!has('slash_charge')) return;
    slash.expCuts = Math.min(5, (slash.expCuts || 0) + 1);
  }
  function modifySlashDamage(slash, damage) {
    return has('slash_charge') ? damage * (1 + Math.min(0.3, 0.06 * (slash.expCuts || 0))) : damage;
  }
  function onSlashReleased(slash) {
    slash.expCuts = 0;
    if (has('slash_crack')) cap(S.zones, {
      kind: 'slash', x: slash.x, y: slash.y, r: slash.r, t: 2, c: slash.c,
      damage: 46 * slash.c.dmg * 0.25, next: Object.create(null), angle: slash.angle
    }, 24);
  }
  function modifyDashHit(dash, enemy, damage) {
    if (!has('pierce_ramp')) return damage;
    const n = Math.min(5, dash.expPierceN || 0);
    dash.expPierceN = n + 1;
    return damage * (1 + Math.min(0.4, n * 0.08));
  }
  function onDashEnd(dash, back) {
    if (back || !has('pierce_pin')) return;
    fx('pin', dash.x1, dash.y1, 62, RED, 0.6);
    for (const e of enemies) {
      if (e.dead || Math.hypot(e.x - dash.x1, e.y - dash.y1) > 62 + e.r) continue;
      if (e.elite || e.boss) e.expPinSlowT = Math.max(e.expPinSlowT || 0, 1);
      else e.stunT = Math.max(e.stunT || 0, 0.6);
    }
  }
  function onLanceReturn(lance) {
    if (!has('spin_blast') || lance.expReturnBlast) return;
    lance.expReturnBlast = true;
    const runtime = W(); if (runtime) runtime.blast(lance.x, lance.y, 92 * lance.c.rad, lance.damage * 0.6, lance.c, 'spinlance', BLUE);
  }
  function onShieldBlock(dash) {
    dash.expBlocks = (dash.expBlocks || 0) + 1;
    if (has('shield_ink') && (dash.expInk || 0) < 12) {
      const gained = dash.expInk || 0, amount = Math.min(2, 12 - gained);
      dash.expInk = gained + amount;
      player.ink = Math.min(player.maxInk, player.ink + amount);
    }
  }
  function modifyShieldBash(dash, damage) {
    return has('shield_charge') ? damage * (1 + Math.min(0.48, 0.08 * (dash.expBlocks || 0))) : damage;
  }
  function modifyRicoDamage(shield, damage) {
    return has('ricoshield_ramp') ? damage * (1 + Math.min(0.72, 0.12 * (shield.bounces || 0))) : damage;
  }
  function onShieldCatch(shield) {
    if (!has('ricoshield_orbit')) return;
    cap(S.orbiters, { t: 2, tick: 0, angle: 0, c: shield.c, damage: 29 * shield.c.dmg * (1 + shield.c.bdmg) * 0.35, hits: Object.create(null) }, 4);
  }
  function modifyBoltDamage(bolt, enemy, damage) {
    if (bolt.skill === 'heatrail' && has('rail_hot') && bolt.heat >= 0.7) {
      if (!bolt.expHotPierce) { bolt.expHotPierce = true; bolt.pierce = (bolt.pierce || 0) + 1; }
      return damage * 1.2;
    }
    return damage;
  }
  function onBoltHit(bolt, enemy) {
    if (bolt.kind === 'perfect' && has('perfect_mark') && !bolt.expMainMarked) {
      bolt.expMainMarked = true; enemy.perfectMainT = 4;
      fx('mark', enemy.x, enemy.y, enemy.r + 13, RED, 0.35);
    }
  }

  function updateLances(dt) {
    const runtime = W(); if (!runtime || !has('spin_spear')) return;
    for (const l of runtime.state.lances) {
      if (l.returning) continue;
      l.expSpearT = (l.expSpearT || 0) - dt;
      if (l.expSpearT > 0) continue;
      l.expSpearT += 0.8;
      const target = nearest(l.x, l.y, 480);
      if (!target) continue;
      const angle = Math.atan2(target.y - l.y, target.x - l.x);
      spawnBolt({ kind: 'lancespine', skill: 'spinlance', x: l.x, y: l.y, angle,
        speed: 760 * l.c.proj, damage: l.damage * 0.4, c: l.c, radius: 5, life: 0.75, pierce: 0, _noExpand: true });
    }
  }
  function focusHover(bolt) {
    const count = 8 + (has('focus_more') ? 4 : 0), spread = 45 + count * 2;
    const a = -Math.PI + bolt.hoverIndex / Math.max(1, count - 1) * Math.PI;
    return { x: player.x + Math.cos(a) * spread, y: player.y - 35 + Math.sin(a) * 28 };
  }
  function updateFocus() {
    const runtime = W(); if (!runtime) return;
    for (const b of runtime.state.bolts) {
      if (b.kind !== 'focus') continue;
      if (has('focus_redirect') && !b.expFocusBoost && !byId(b.targetId)) {
        const target = nearest(b.x, b.y, 520);
        if (target) { b.targetId = target.id; b.damage *= 1.25; b.expFocusBoost = true; }
      }
      if (!has('focus_intercept') || b.expIntercept || b.delay <= 0) continue;
      const p = focusHover(b);
      for (const eb of ebullets) {
        if (eb.life <= 0 || Math.hypot(eb.x - p.x, eb.y - p.y) > 16 + (eb.r || 4)) continue;
        eb.life = 0; b.delay = 0; b.damage *= 0.6; b.expIntercept = true;
        const target = byId(b.targetId) || nearest(p.x, p.y, 520);
        if (target) b.targetId = target.id;
        b.x = p.x; b.y = p.y; b.px = p.x; b.py = p.y;
        fx('ring', p.x, p.y, 25, BLUE, 0.24);
        break;
      }
    }
  }
  function updateFists() {
    const runtime = W(); if (!runtime) return;
    for (const f of runtime.state.fists) {
      if (f.pull && !f.expGuardCounted) {
        f.expGuardCounted = true;
        if (has('fist_guard')) {
          player.magGuardN = Math.min(6, f.pullCount || 0); player.magGuardT = 2;
        }
      }
      if (f.slam && !f.expField) {
        f.expField = true;
        if (has('fist_field')) cap(S.zones, { kind: 'fist', x: f.slamX, y: f.slamY, r: 110 * f.c.rad,
          t: 2.5, tick: 0, c: f.c, damage: 43 * f.c.dmg * 0.2 }, 24);
      }
    }
  }
  function updateZones(dt) {
    for (const z of S.zones) {
      z.t -= dt;
      if (z.kind === 'slash') {
        for (const e of enemies) {
          if (e.dead || Math.hypot(e.x - z.x, e.y - z.y) > z.r + e.r) continue;
          if ((z.next[e.id] || 0) > gameTime) continue;
          z.next[e.id] = gameTime + 0.6; hit(e, z.damage, z.c, 'pageslash', z.x, z.y);
        }
      } else {
        z.tick -= dt;
        if (z.kind === 'fist') {
          for (const e of enemies) {
            if (e.dead || e.boss) continue;
            const dx = z.x - e.x, dy = z.y - e.y, d = Math.hypot(dx, dy);
            if (d < z.r && d > 8) { const pull = Math.min(55 * dt, d - 8); e.x += dx / d * pull; e.y += dy / d * pull; }
          }
        }
        if (z.tick <= 0) {
          z.tick += 0.5;
          for (const e of enemies) if (!e.dead && Math.hypot(e.x - z.x, e.y - z.y) < z.r + e.r)
            hit(e, z.damage, z.c, z.kind === 'fist' ? 'magfist' : 'inkgrenade', z.x, z.y);
          fx('ring', z.x, z.y, z.r, z.kind === 'fist' ? PURPLE : RED, 0.3);
        }
      }
    }
    for (let i = S.zones.length - 1; i >= 0; i--) if (S.zones[i].t <= 0) S.zones.splice(i, 1);
  }
  function updateOrbiters(dt) {
    for (const o of S.orbiters) {
      o.t -= dt; o.angle += dt * 8; o.tick -= dt;
      o.x = player.x + Math.cos(o.angle) * 58; o.y = player.y + Math.sin(o.angle) * 58;
      if (o.tick <= 0) {
        o.tick += 0.4;
        for (const e of enemies) if (!e.dead && Math.hypot(e.x - o.x, e.y - o.y) < 30 + e.r)
          hit(e, o.damage, o.c, 'ricoshield', o.x, o.y);
      }
    }
    for (let i = S.orbiters.length - 1; i >= 0; i--) if (S.orbiters[i].t <= 0) S.orbiters.splice(i, 1);
  }
  function terminalProjectiles() {
    const runtime = W(); if (!runtime) return;
    const current = runtime.state.bolts;
    if (has('perfect_rain')) {
      for (const b of S.preBolts) {
        if (b.kind !== 'perfect' || current.includes(b)) continue;
        for (let i = 0; i < 3; i++) {
          const back = (2 - i) * 18, x = b.x - Math.cos(b.angle) * back, y = b.y - Math.sin(b.angle) * back;
          spawnBolt({ kind: 'rain', skill: 'perfectarrow', x, y, angle: b.angle, speed: 540 * b.c.proj,
            damage: b.damage * 0.4, c: b.c, radius: 5, life: 0.42, pierce: 0, _noExpand: true });
        }
        fx('ring', b.x, b.y, 36, RED, 0.24);
      }
    }
    if (has('grenade_burn') || has('grenade_bounce')) {
      for (const g of S.preGrenades) {
        if (!g.main || runtime.state.grenades.includes(g)) continue;
        if (has('grenade_burn')) cap(S.zones, { kind: 'burn', x: g.x, y: g.y, r: g.radius * 0.82,
          t: 3, tick: 0, c: g.c, damage: g.damage * 0.2 }, 24);
        if (has('grenade_bounce')) {
          const angle = Math.atan2(g.ty - g.sy, g.tx - g.sx) + 0.65;
          cap(runtime.state.grenades, { id: runtime.state.nextId++, sx: g.x, sy: g.y, x: g.x, y: g.y, z: 0,
            tx: g.x + Math.cos(angle) * 105, ty: g.y + Math.sin(angle) * 105, targetId: 0,
            age: 0, duration: 0.38, radius: g.radius * 0.8, damage: g.damage * 0.6, c: g.c, main: false, expBounce: true }, 18);
        }
      }
    }
  }
  function updateFx(dt) {
    for (const f of S.fx) f.t -= dt;
    for (let i = S.fx.length - 1; i >= 0; i--) if (S.fx[i].t <= 0) S.fx.splice(i, 1);
  }

  const baseHurtEnemy = hurtEnemy;
  hurtEnemy = function(e, dmg, dotDps, sx, sy, vuln, critAdd, bossMul, hitCol, weakFloat, skillId) {
    if (has('perfect_mark') && e.perfectMainT > 0 && skillId && skillId !== 'perfectarrow') dmg *= 1.2;
    return baseHurtEnemy(e, dmg, dotDps, sx, sy, vuln, critAdd, bossMul, hitCol, weakFloat, skillId);
  };
  const baseHurtPlayer = hurtPlayer;
  hurtPlayer = function(dmg, kind, source) {
    if (has('fist_guard') && player.magGuardT > 0) dmg *= 1 - Math.min(0.12, 0.02 * (player.magGuardN || 0));
    return baseHurtPlayer(dmg, kind, source);
  };
  const baseKillEnemy = killEnemy;
  killEnemy = function(e) {
    const runtime = W(), rail = runtime && runtime.state.rail;
    if (rail && has('rail_chase') && (rail.expChaseKills || 0) < 2) {
      rail.expChaseKills = (rail.expChaseKills || 0) + 1;
      const target = nearest(e.x, e.y, 520), angle = target ? Math.atan2(target.y - e.y, target.x - e.x) : rail.angle;
      spawnBolt({ kind: 'chase', skill: 'heatrail', x: e.x, y: e.y, angle, speed: 900 * rail.c.proj,
        damage: 44 * 0.4 * rail.c.dmg * (1 + rail.c.bdmg), c: rail.c, radius: 8, life: 0.65,
        pierce: 0, heat: rail.heat, _noExpand: true });
      fx('ring', e.x, e.y, 32, RED, 0.22);
    }
    baseKillEnemy(e);
  };

  const baseUpdate = update;
  update = function(dt) {
    const runtime = W();
    S.preBolts = runtime ? runtime.state.bolts.slice() : [];
    S.preGrenades = runtime ? runtime.state.grenades.slice() : [];
    const slowed = [];
    if (state === 'play') {
      for (const e of enemies) if (e.expPinSlowT > 0) { slowed.push([e, e.sp]); e.sp *= 0.65; }
    }
    try { baseUpdate(dt); } finally { for (const pair of slowed) pair[0].sp = pair[1]; }
    if (state !== 'play') return;
    updateLances(dt); updateFocus(); updateFists(); updateZones(dt); updateOrbiters(dt); terminalProjectiles(); updateFx(dt);
    player.magGuardT = Math.max(0, (player.magGuardT || 0) - dt);
    for (const e of enemies) {
      e.perfectMainT = Math.max(0, (e.perfectMainT || 0) - dt);
      e.expPinSlowT = Math.max(0, (e.expPinSlowT || 0) - dt);
    }
  };
  function reset() {
    S.zones.length = 0; S.orbiters.length = 0; S.fx.length = 0; S.preBolts.length = 0; S.preGrenades.length = 0;
    if (player) { player.magGuardT = 0; player.magGuardN = 0; }
  }
  const baseReset = resetGame;
  resetGame = function() { baseReset(); reset(); };

  function draw() {
    for (const z of S.zones) {
      if (z.kind === 'slash') {
        ctx.globalAlpha = Math.min(0.42, z.t * 0.25); jline(z.x - Math.cos(z.angle) * z.r * 0.65,
          z.y - Math.sin(z.angle) * z.r * 0.65, z.x + Math.cos(z.angle) * z.r * 0.65,
          z.y + Math.sin(z.angle) * z.r * 0.65, BLUE, 5);
      } else {
        ctx.globalAlpha = Math.min(0.2, z.t * 0.09); jcircle(z.x, z.y, z.r, z.kind === 'fist' ? PURPLE : RED, z.kind === 'fist' ? 2 : 7);
      }
    }
    for (const o of S.orbiters) {
      ctx.globalAlpha = Math.min(1, o.t * 2); jcircle(o.x, o.y, 18, BLUE, 5);
      jline(o.x - Math.cos(o.angle) * 22, o.y - Math.sin(o.angle) * 22,
        o.x + Math.cos(o.angle) * 22, o.y + Math.sin(o.angle) * 22, BLUE, 4);
    }
    for (const e of enemies) {
      if (e.dead || !(e.perfectMainT > 0)) continue;
      ctx.globalAlpha = 0.85; const r = e.r + 12;
      jcircle(e.x, e.y - e.r - 18, 8, RED, 2);
      jline(e.x - r, e.y - r, e.x - r + 9, e.y - r, RED, 2); jline(e.x - r, e.y - r, e.x - r, e.y - r + 9, RED, 2);
      jline(e.x + r, e.y + r, e.x + r - 9, e.y + r, RED, 2); jline(e.x + r, e.y + r, e.x + r, e.y + r - 9, RED, 2);
    }
    for (const f of S.fx) {
      const p = 1 - f.t / f.total; ctx.globalAlpha = Math.max(0, 1 - p);
      if (f.type === 'ring' || f.type === 'pin') jcircle(f.x, f.y, f.r * (0.4 + p * 0.6), f.col, f.type === 'pin' ? 5 : 3);
      else if (f.type === 'mark') jcircle(f.x, f.y, f.r * (1 + p * 0.4), f.col, 3);
    }
    ctx.globalAlpha = 1;
  }
  const previousExtras = window.__drawWorldExtras;
  window.__drawWorldExtras = function() { if (previousExtras) previousExtras(); draw(); };

  window.__weaponPassives = {
    state: S, reset, onSlashCut, modifySlashDamage, onSlashReleased, modifyDashHit, onDashEnd,
    onLanceReturn, onShieldBlock, modifyShieldBash, modifyRicoDamage, onShieldCatch,
    modifyBoltDamage, onBoltHit, updateLances, updateFocus, updateFists, updateZones, updateOrbiters,
    terminalProjectiles, get ids() { return IDS.slice(); }
  };
})();

/* 精准潜墨：真实命中触发；窗口与缓速按未缩放的帧时间独立计时。 */
(() => {
  'use strict';
  const WINDOW = 0.18, DURATION = 0.35, BASE_RADIUS = 24, MAX_RADIUS = 150;
  const SLOW_DURATION = 0.2, SLOW_SCALE = 0.3;

  const baseEnterDive = enterDive;
  enterDive = function () {
    const result = baseEnterDive();
    player.preciseDiveUsed = false;
    player.preciseDiveWindowT = WINDOW;
    return result;
  };

  function advance(realDt) {
    if (player.diving && !player.preciseDiveUsed)
      player.preciseDiveWindowT = Math.max(0, (player.preciseDiveWindowT || 0) - realDt);
    if ((player.preciseDiveSlowT || 0) > 0) {
      player.preciseDiveSlowT = Math.max(0, player.preciseDiveSlowT - realDt);
      return SLOW_SCALE;
    }
    return 1;
  }

  function trigger() {
    if (!player.diving || player.preciseDiveUsed || (player.preciseDiveWindowT || 0) <= 0) return false;
    player.preciseDiveUsed = true;
    player.preciseDiveWindowT = 0;
    player.preciseDiveSlowT = Math.max(player.preciseDiveSlowT || 0, SLOW_DURATION);
    const damage = ABSORB_RULE.meleeDamage * 0.8 * player.dmgMul * (1 + player.eqAtk / 100) * (player.metaDiveMul || 1);
    novas.push({ x: player.x, y: player.y, t: DURATION, max: MAX_RADIUS * player.radMul,
      col: INK, preciseDive: true, hit: new Set(), damage });
    floats.push({ x: player.x, y: player.y - 44, txt: '精准潜墨！', t: 0.75, color: INK, crit: true });
    sparks.push({ x: player.x, y: player.y, t: 0.28, color: INK });
    shakeT = Math.max(shakeT, 0.12);
    return true;
  }

  const baseHurtPlayer = hurtPlayer;
  hurtPlayer = function (dmg, kind, source) {
    // 所有近战、弹体和区域攻击都先经过这里；只有真实命中才能触发精准潜墨。
    if (player.diving) { trigger(); return; }
    return baseHurtPlayer(dmg, kind, source);
  };

  const baseUpdate = update;
  update = function (dt) {
    const result = baseUpdate(dt);
    for (const nv of novas) {
      if (!nv.preciseDive || nv.done) continue;
      const k = Math.max(0, Math.min(1, 1 - nv.t / DURATION));
      const radius = BASE_RADIUS + (nv.max - BASE_RADIUS) * k;
      for (const e of enemies) {
        if (e.dead || nv.hit.has(e.id) || Math.hypot(e.x - nv.x, e.y - nv.y) >= radius + e.r) continue;
        nv.hit.add(e.id);
        hurtEnemy(e, nv.damage, 0, nv.x, nv.y, 0, 0, 0, INK, false, 'dive');
        if (!e.dead && !e.boss) {
          const d = Math.hypot(e.x - nv.x, e.y - nv.y) || 1;
          e.kbx += (e.x - nv.x) / d * 55; e.kby += (e.y - nv.y) / d * 55;
        }
      }
      if (nv.t <= 0) { nv.done = true; nv.t = 0; }
    }
    return result;
  };

  globalThis.DiveCounterRuntime = { WINDOW, DURATION, BASE_RADIUS, MAX_RADIUS, SLOW_DURATION, SLOW_SCALE, advance, trigger };
})();

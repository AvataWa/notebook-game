/* 挂机者：随机双主动、持续恢复护盾与自然施法轮转；不改动其他角色的操作规则。 */
(() => {
  'use strict';
  const DISABLED_SUPPORTS = ['onabsorb', 'ondive', 'onsurge'];
  const BASE_SHIELD = 40, BASE_REGEN = 5, BASE_REGEN_DELAY = 2.5;
  const isIdle = () => typeof player !== 'undefined' && player && player.characterId === 'idle';
  const level = () => isIdle() ? (player.characterLevel || 1) : 0;
  const fullBuild = () => level() >= 4 && player.actives.length >= 4;
  const stacks = id => isIdle() ? Math.max(0, Number(player.taken[id]) || 0) : 0;
  const shieldMax = () => BASE_SHIELD * (1 + stacks('idlemax') * 0.25) * (level() >= 3 ? 1.25 : 1);
  const regenRate = () => BASE_REGEN * (1 + stacks('idleregen') * 0.3 + (level() >= 3 ? 0.3 : 0));
  const regenDelay = () => Math.max(1, BASE_REGEN_DELAY - (player.taken.idlequick ? 0.5 : 0));
  const fullShield = () => isIdle() && S.shield >= shieldMax() - 0.001;
  let S = fresh();

  function fresh() { return { shield: BASE_SHIELD, regenWait: 0, round: [], replaying: false }; }
  function makeActive(id) { return { id, lvl: 1, supports: [], t: 0.3, uc: 0 }; }
  function restoreShield(amount) {
    if (!isIdle() || amount <= 0) return 0;
    const before = S.shield;
    S.shield = Math.min(shieldMax(), S.shield + amount);
    return S.shield - before;
  }
  function setupRun() {
    if (!isIdle()) return;
    const pool = CHARACTER_CONFIG.singleStarters.filter(id => SKILL_DEFS[id]);
    const first = Math.floor(Math.random() * pool.length), firstId = pool.splice(first, 1)[0];
    const second = Math.floor(Math.random() * pool.length), secondId = pool[second];
    player.actives = [makeActive(firstId), makeActive(secondId)];
    player.diving = false; player.surgeCharging = false; player.special = 0;
    S = fresh(); S.shield = shieldMax();
    toast('挂机者 · 随机双主动 · ' + SKILL_DEFS[firstId].name + '／' + SKILL_DEFS[secondId].name);
  }

  const meta = window.__metaRuntime;
  const baseBeginRun = meta.beginRun;
  meta.beginRun = function(...args) { const result = baseBeginRun(...args); setupRun(); return result; };
  const baseBeginBossTest = meta.beginBossTest;
  meta.beginBossTest = function(...args) { const result = baseBeginBossTest(...args); setupRun(); return result; };

  const baseSupportUsable = supportUsable;
  supportUsable = function(sid, aid) {
    if (isIdle() && DISABLED_SUPPORTS.includes(sid)) return false;
    return baseSupportUsable(sid, aid);
  };

  const baseSkillCalc = skillCalc;
  skillCalc = function(a) {
    const c = baseSkillCalc(a);
    if (isIdle() && !fullBuild()) c.dmg *= 0.85;
    return c;
  };

  /* 满盾笔意放在统一敌人承伤口，技能、重播与持续伤害使用同一规则。 */
  const baseHurtEnemy = hurtEnemy;
  hurtEnemy = function(e, dmg, ...rest) {
    if (isIdle() && player.taken.idlesharp && fullShield()) dmg *= 1.15;
    return baseHurtEnemy(e, dmg, ...rest);
  };

  /* 不仅隐藏按钮：快捷键、调试入口与旧存档输入也无法绕过角色限制。 */
  const baseCastAbsorb = castAbsorb;
  castAbsorb = function(...args) { return isIdle() ? false : baseCastAbsorb(...args); };
  const baseToggleDive = toggleDive;
  toggleDive = function(...args) { return isIdle() ? false : baseToggleDive(...args); };
  const baseEnterDive = enterDive;
  enterDive = function(...args) { return isIdle() ? false : baseEnterDive(...args); };
  const baseStartSurge = startInkSurgeCharge;
  startInkSurgeCharge = function(...args) { return isIdle() ? false : baseStartSurge(...args); };
  const baseCastSurge = castInkSurge;
  castInkSurge = function(...args) { return isIdle() ? false : baseCastSurge(...args); };
  const baseChargeTurf = chargeTurf;
  chargeTurf = function(amount) { if (!isIdle()) baseChargeTurf(amount); };

  function breakNova() {
    novas.push({ x: player.x, y: player.y, t: 0.35, max: 52, col: ARC });
    floats.push({ x: player.x, y: player.y - 48, txt: '护盾破碎', t: 0.75, color: ARC });
    if (!player.taken.idleburst) return;
    novas.push({ x: player.x, y: player.y, t: 0.45, max: 150, col: ARC });
    floats.push({ x: player.x, y: player.y - 62, txt: '破膜新星', t: 0.9, color: ARC, crit: true });
    const damage = 30 + shieldMax() * 0.5;
    for (const e of enemies) {
      if (e.dead || Math.hypot(e.x - player.x, e.y - player.y) > 150 + e.r) continue;
      /* hurtEnemy 自带朝外击退；Boss 与精英使用既有击退衰减。 */
      hurtEnemy(e, damage, 0, player.x, player.y, 0, 0, 0, ARC, false, 'idleShield');
    }
  }

  /* 由 main.js 在减伤之后、生命与免死之前调用；返回仍需扣除生命的溢出伤害。 */
  function absorbDamage(dmg) {
    if (!isIdle() || dmg <= 0) return dmg;
    S.regenWait = regenDelay();
    if (S.shield <= 0) return dmg;
    const absorbed = Math.min(S.shield, dmg);
    S.shield = Math.max(0, S.shield - absorbed);
    dmg = Math.max(0, dmg - absorbed);
    floats.push({ x: player.x, y: player.y - 42, txt: '盾 -' + Math.round(absorbed), t: 0.75, color: ARC });
    novas.push({ x: player.x, y: player.y, t: 0.25, max: 40, col: ARC });
    if (S.shield <= 0) breakNova();
    return dmg;
  }

  function completeRound(last) {
    S.round = [];
    const reduction = fullBuild() ? 1.2 : 0.6;
    for (const a of player.actives) a.t = Math.max(0, a.t - reduction);
    floats.push({ x: player.x, y: player.y - 48, txt: '自动书写完成 · 冷却 -' + reduction + ' 秒', t: 0.9, color: INK, crit: true });
    if (player.taken.idleround) {
      const restored = restoreShield(8);
      if (restored > 0) floats.push({ x: player.x, y: player.y - 64, txt: '轮转充盾 +' + Math.round(restored), t: 0.8, color: ARC });
    }
    if (level() < 5 || !last) return;
    /* 直接调用施法，不经过 afterCast：免费重播不会推进下一轮，也不会形成死循环。 */
    S.replaying = true;
    try {
      const c = skillCalc(last); c.dmg *= 0.7;
      fireSkill(last, c); addSkillStain(last, c, 0);
      floats.push({ x: player.x, y: player.y - 66, txt: '整套放映 · ' + SKILL_DEFS[last.id].name, t: 1, color: PURPLE, crit: true });
    } finally { S.replaying = false; }
  }

  const baseAfterCast = CharacterRuntime.afterCast;
  CharacterRuntime.afterCast = function(a, c) {
    const result = baseAfterCast(a, c);
    if (!isIdle() || level() < 2 || S.replaying) return result;
    S.round = S.round.filter(active => player.actives.includes(active));
    if (!S.round.includes(a)) S.round.push(a);
    if (player.actives.length && player.actives.every(active => S.round.includes(active))) completeRound(a);
    return result;
  };

  const baseUpdate = update;
  update = function(dt) {
    if (isIdle()) {
      S.shield = Math.min(S.shield, shieldMax());
      const regenDt = Math.max(0, dt - S.regenWait);
      S.regenWait = Math.max(0, S.regenWait - dt);
      if (regenDt > 0 && S.shield < shieldMax()) restoreShield(regenRate() * regenDt);
      if (level() >= 3 && fullShield()) {
        const speed = player.speed;
        player.speed *= 1.1;
        try { return baseUpdate(dt); } finally { player.speed = speed; }
      }
    }
    return baseUpdate(dt);
  };

  function addShieldPassive(id, name, desc, once, fx) {
    PASSIVES.push({ id, name, desc, once, shield: true, available: isIdle, fx });
  }
  addShieldPassive('idlemax', '厚纸膜', '护盾上限 +25%，并补充新增部分的护盾', false, () => {
    const before = shieldMax();
    player.taken.idlemax = stacks('idlemax') + 1;
    S.shield = Math.min(shieldMax(), S.shield + shieldMax() - before);
  });
  addShieldPassive('idleregen', '持续供墨', '护盾恢复速度 +30%', false, () => {
    player.taken.idleregen = stacks('idleregen') + 1;
  });
  addShieldPassive('idlequick', '快速回墨', '受击后的护盾恢复等待 -0.5 秒', true, () => { player.taken.idlequick = true; });
  addShieldPassive('idlesharp', '满盾笔意', '满盾时全部伤害 +15%', true, () => { player.taken.idlesharp = true; });
  addShieldPassive('idleburst', '破膜新星', '护盾被击破时，对周围敌人造成伤害并击退', true, () => { player.taken.idleburst = true; });
  addShieldPassive('idleround', '轮转充盾', '每完成一次自动书写轮转，恢复 8 点护盾', true, () => { player.taken.idleround = true; });

  function txt(value, x, y, size, color, align = 'center', bold = false) {
    ctx.fillStyle = color; ctx.textAlign = align; ctx.font = (bold ? 'bold ' : '') + size + 'px ' + FONT; ctx.fillText(String(value), x, y);
  }
  function drawResources(resourceArc, x, y) {
    if (!isIdle()) return;
    const max = shieldMax(), ratio = Math.max(0, Math.min(1, S.shield / max));
    const color = S.regenWait > 0 && S.shield > 0 ? '#78a7b8' : ARC;
    resourceArc(33, 'rgba(245,241,230,0.86)', 2.8);
    if (ratio > 0) resourceArc(33, S.shield <= 0 ? GRAY : color, 1.8, ratio);
    txt('盾 ' + Math.ceil(S.shield) + '/' + Math.round(max), x, y + 43, 8, ratio > 0 ? color : GRAY, 'center', true);
  }
  function drawHUD(desktop) {
    if (!isIdle() || state !== 'play') return;
    const r = desktop ? { x: W - 414, y: H - 72, w: 386, h: 42 } : { x: W - 180, y: H - 145, w: 164, h: 42 };
    ctx.fillStyle = 'rgba(255,250,238,0.95)'; ctx.fillRect(r.x, r.y, r.w, r.h); jrect(r.x, r.y, r.w, r.h, INK, 2);
    const count = S.round.filter(a => player.actives.includes(a)).length;
    const rotation = level() >= 2 ? '自动书写 ' + count + '/' + player.actives.length : '自动施法 · ' + player.actives.length + ' 主动';
    txt(rotation, r.x + r.w / 2, r.y + (desktop ? 26 : 27), desktop ? 14 : 12, INK, 'center', true);
  }

  window.IdleRuntime = {
    absorbDamage, drawResources, drawHUD, restoreShield,
    get state() { return S; },
    get roundCount() { return S.round.filter(a => player.actives.includes(a)).length; },
    get shield() { return S.shield; },
    get shieldMax() { return shieldMax(); },
    get shieldRatio() { return Math.max(0, Math.min(1, S.shield / shieldMax())); },
    get shieldReady() { return fullShield(); }
  };
})();

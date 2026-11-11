/* 主动技能连携：操作、暴击与击杀事件额外施放已镶嵌的主动技能。 */
(() => {
  'use strict';

  // 红芯投枪下线：保留旧运行代码以免扩大改动，但主动池与专属词条不再提供它。
  delete SKILL_DEFS.bloodcore;
  delete SKILL_TAGS.bloodcore;
  delete SKILL_ATTR.bloodcore;
  delete INK_COST.bloodcore;
  const removedPassives = new Set(['hdualcore', 'hcorewound', 'hshardguard']);
  for (let i = PASSIVES.length - 1; i >= 0; i--) if (removedPassives.has(PASSIVES[i].id)) PASSIVES.splice(i, 1);

  const EVENT_SUPPORT = { absorb: 'onabsorb', dive: 'ondive', surge: 'onsurge', crit: 'oncrit', kill: 'onkill' };
  const ACTION_EVENTS = new Set(['absorb', 'dive', 'surge']);
  function cooldownFor(sp) { return Math.max(0.1, 1 - 0.1 * (sp.lvl - 1)); }

  function castTriggered(a, sp, event) {
    const c = skillCalc(a);
    if (ACTION_EVENTS.has(event)) c.dmg *= 1 + 0.15 * (sp.lvl - 1);
    a.uc = (a.uc || 0) + 1;
    const reps = c.unleash > 0 && a.uc % 3 === 0 ? 1 + c.unleash : 1;
    const stainAmount = (INK_COST[a.id] || 2) / reps;
    for (let i = 0; i < reps; i++) { fireSkill(a, c); addSkillStain(a, c, stainAmount); }
  }

  function trigger(event) {
    const supportId = EVENT_SUPPORT[event];
    if (!supportId || state !== 'play' || !player || !player.actives.length) return false;
    let fired = false;
    // 冷却在施放前写入，触发技能再次造成暴击或击杀时不会形成无限递归。
    for (const a of player.actives.slice()) {
      const sp = a.supports && a.supports.find(s => s.id === supportId);
      if (!sp) continue;
      if (!ACTION_EVENTS.has(event)) {
        const cds = a.triggerCds || (a.triggerCds = Object.create(null));
        if ((cds[event] === undefined ? -Infinity : cds[event]) > gameTime) continue;
        cds[event] = gameTime + cooldownFor(sp);
      }
      castTriggered(a, sp, event); fired = true;
    }
    return fired;
  }

  const baseCastAbsorb = castAbsorb;
  castAbsorb = function(...args) {
    const result = baseCastAbsorb(...args);
    if (result) trigger('absorb');
    return result;
  };
  const baseEnterDive = enterDive;
  enterDive = function(...args) {
    const wasDiving = player.diving;
    const result = baseEnterDive(...args);
    if (!wasDiving && player.diving) trigger('dive');
    return result;
  };
  const baseCastInkSurge = castInkSurge;
  castInkSurge = function(...args) {
    const result = baseCastInkSurge(...args);
    if (result) trigger('surge');
    return result;
  };

  const baseHurtEnemy = hurtEnemy;
  hurtEnemy = function(e, ...args) {
    const floatIndex = floats.length;
    const result = baseHurtEnemy(e, ...args);
    // 主伤害跳字先于击杀及嵌套连携产生，只读取这一颗，避免把后续技能暴击算到本次命中。
    if (floats[floatIndex] && floats[floatIndex].crit) trigger('crit');
    return result;
  };
  const baseKillEnemy = killEnemy;
  killEnemy = function(e) {
    const wasDead = e.dead;
    const result = baseKillEnemy(e);
    if (!wasDead && e.dead) trigger('kill');
    return result;
  };

  window.__triggerSupport = { trigger, cooldownFor };
})();

/* 三选一导演：相关卡、机制卡、自由卡；同模板互斥、近期降权与满栏入库规则。 */
(() => {
  'use strict';

  const NUMERIC_SUPPORTS = new Set([
    'brutal', 'projspd', 'wide', 'firstblood', 'rapid'
  ]);
  const NUMERIC_PASSIVES = new Set(['dmg', 'haste', 'spd', 'hpup', 'magnet', 'crit']);
  const SUPPORT_GROUPS = {
    brutal: 'directDamage',
    focus: 'vulnerability', areastack: 'vulnerability', physvuln: 'vulnerability',
    onabsorb: 'extraCast', ondive: 'extraCast', onsurge: 'extraCast', oncrit: 'extraCast', onkill: 'extraCast',
    multi: 'extraProjectile', projendsplit: 'extraProjectile', firespark: 'extraProjectile', iceshard: 'extraProjectile',
    inkpool: 'groundZone', thundernet: 'groundZone', icefield: 'groundZone', cycloneresidue: 'groundZone',
    strikecross: 'delayedBurst', strikeaftershock: 'delayedBurst', reburst: 'delayedBurst',
    rapid: 'frequency', retick: 'frequency'
  };
  const PASSIVE_GROUPS = {
    dmg: 'directDamage', haste: 'directCooldown', fountain: 'directCooldown', crit: 'directCrit',
    perfect_mark: 'vulnerability',
    spin_spear: 'extraProjectile', perfect_rain: 'extraProjectile', rail_double: 'extraProjectile',
    slash_crack: 'groundZone', fist_field: 'groundZone', grenade_burn: 'groundZone',
    slash_echo: 'delayedBurst', spin_blast: 'delayedBurst', grenade_bounce: 'delayedBurst', fist_aftershock: 'delayedBurst'
  };
  const S = { relatedMiss: false, rerolling: false, lastCards: [], recentCards: [] };

  function key(c) {
    return [c.kind, c.id || '', c.sup || '', c.skill || ''].join(':');
  }
  function skillOf(c) {
    if (c.kind === 'active') return c.id;
    if (c.kind === 'active+' || c.kind === 'support' || c.kind === 'support+') return c.skill;
    if (c.kind === 'passive') return c.skill || null;
    return null;
  }
  function category(c) {
    if (!c) return null;
    if (c.kind === 'support' || c.kind === 'support+') return SUPPORT_GROUPS[c.sup] || null;
    if (c.kind === 'passive') return PASSIVE_GROUPS[c.id] || null;
    return null;
  }
  function isRelated(c) {
    if (!player || !player.actives) return false;
    if (c.kind === 'active+' || c.kind === 'support' || c.kind === 'support+') {
      return player.actives.some(a => a.id === c.skill);
    }
    return c.kind === 'passive' && !!c.skill && player.actives.some(a => a.id === c.skill);
  }
  function isEvolution(c) {
    if (c.kind !== 'active+') return false;
    const a = getActive(c.skill), next = a ? a.lvl + 1 : 0;
    return !!(SKILL_EVOLUTIONS[c.skill] && SKILL_EVOLUTIONS[c.skill][next]);
  }
  function isPureNumeric(c) {
    if (c.kind === 'active+') return !isEvolution(c);
    if (c.kind === 'support' || c.kind === 'support+') return NUMERIC_SUPPORTS.has(c.sup);
    if (c.kind === 'passive') return NUMERIC_PASSIVES.has(c.id) && !c.skill && !c.form && !c.shield;
    return false;
  }
  function isMechanism(c) {
    if (c.kind === 'active' || c.kind === 'opaffix') return true;
    if (c.kind === 'active+') return isEvolution(c);
    if (c.kind === 'support' || c.kind === 'support+') return !NUMERIC_SUPPORTS.has(c.sup);
    if (c.kind === 'passive') return !isPureNumeric(c);
    return false;
  }
  function score(c) {
    let weight = 1;
    if (isEvolution(c)) weight = 1.5;
    else if (c.kind === 'passive' && (c.form || c.skill)) weight = 1.25;
    else if (c.kind === 'support+') weight = 1.1;
    else if (c.kind === 'support' && !NUMERIC_SUPPORTS.has(c.sup)) weight = 1.15;
    else if (c.kind === 'passive') weight = 0.85;
    else if (c.kind === 'support') weight = 0.75;
    const cardKey = key(c), recent = S.recentCards;
    if (recent.length && recent[recent.length - 1].includes(cardKey)) weight *= 0.2;
    else if (recent.length > 1 && recent[recent.length - 2].includes(cardKey)) weight *= 0.45;
    if (S.rerolling && S.lastCards.includes(cardKey) && isPureNumeric(c)) weight *= 0.35;
    const group = category(c), skill = skillOf(c), a = skill && getActive(skill);
    if (group && a && a.supports) {
      const owned = a.supports.filter(sp => SUPPORT_GROUPS[sp.id] === group).length;
      if (owned >= 2) weight *= 0.3;
    }
    return Math.max(0.01, (c.weight || 1) * weight);
  }

  function pick(pool, nPick) {
    const remaining = pool.slice(), picks = [], slots = [];
    const initialRelated = remaining.filter(isRelated);

    function take(preferred) {
      let candidates = preferred && preferred.length ? preferred : remaining;
      if (player.characterId !== 'single') {
        const filtered = candidates.filter(c => {
          const skill = skillOf(c);
          return !skill || picks.filter(p => skillOf(p) === skill).length < 2;
        });
        if (filtered.length) candidates = filtered;
      }
      const usedGroups = new Set(picks.map(category).filter(Boolean));
      if (usedGroups.size) {
        const filtered = candidates.filter(c => !category(c) || !usedGroups.has(category(c)));
        if (filtered.length) candidates = filtered;
      }
      if (!candidates.length) return false;
      const wrapped = candidates.map(card => ({ card, weight: score(card) }));
      const chosen = weightedOptionPicks(wrapped, 1)[0].card;
      const index = remaining.indexOf(chosen);
      if (index >= 0) remaining.splice(index, 1);
      picks.push(chosen);
      return true;
    }

    const relatedChance = S.relatedMiss ? 1 : 0.8;
    const useRelated = initialRelated.length > 0 && Math.random() < relatedChance;
    if (take(useRelated ? initialRelated : remaining)) slots.push(0);

    const mechanisms = remaining.filter(isMechanism);
    if (picks.length < nPick && take(mechanisms.length ? mechanisms : remaining)) slots.push(1);

    while (picks.length < nPick && remaining.length) {
      if (!take(remaining)) break;
      slots.push(2);
    }

    S.lastCards = picks.map(key);

    if (picks.length && Math.random() < 0.3) {
      const free = slots.map((slot, i) => slot >= 2 ? i : -1).filter(i => i >= 0);
      if (free.length) {
        const index = free[Math.floor(Math.random() * free.length)];
        picks[index] = { kind: 'heal', tag: '[恢复]', tagColor: '#2f9e68', name: '恢复生命', desc: '立即恢复 30% 最大生命值' };
      }
    }
    // 回血可能替换自由槽中的相关卡，补偿必须以最终展示结果为准。
    S.relatedMiss = initialRelated.length > 0 && !picks.some(isRelated);
    S.recentCards.push(picks.map(key));
    if (S.recentCards.length > 2) S.recentCards.shift();
    return picks;
  }

  const baseRerollOptions = rerollOptions;
  rerollOptions = function() {
    S.rerolling = true;
    try { return baseRerollOptions(); }
    finally { S.rerolling = false; }
  };

  const baseResetGame = resetGame;
  resetGame = function() {
    baseResetGame();
    S.relatedMiss = false; S.rerolling = false; S.lastCards = []; S.recentCards = [];
  };

  window.OptionDirectorRuntime = {
    state: S, pick, score, category, isRelated, isMechanism, isPureNumeric, isEvolution
  };
})();

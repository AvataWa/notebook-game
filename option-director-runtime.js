/* 三选一导演：相关卡、机制卡、自由卡；保留随机与满栏入库规则。 */
(() => {
  'use strict';

  const NUMERIC_SUPPORTS = new Set([
    'brutal', 'swift', 'sharpen', 'projspd', 'heavynib', 'fatpipe',
    'wide', 'saturate', 'sheath', 'pressboss', 'heavyweight', 'firstblood',
    'scrit', 'rapid', 'sweep', 'physdmg', 'physcrit', 'firedmg', 'firecrit',
    'icedmg', 'icecrit', 'thunderdmg', 'thundercrit'
  ]);
  const NUMERIC_PASSIVES = new Set(['dmg', 'haste', 'spd', 'hpup', 'magnet', 'crit']);
  const S = { relatedMiss: false, rerolling: false, lastCards: [] };

  function key(c) {
    return [c.kind, c.id || '', c.sup || '', c.skill || ''].join(':');
  }
  function skillOf(c) {
    if (c.kind === 'active') return c.id;
    if (c.kind === 'active+' || c.kind === 'support' || c.kind === 'support+') return c.skill;
    if (c.kind === 'passive') return c.skill || null;
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
    if (S.rerolling && S.lastCards.includes(key(c)) && isPureNumeric(c)) weight *= 0.35;
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
    const useMechanism = mechanisms.length > 0 && Math.random() < 0.65;
    if (picks.length < nPick && take(useMechanism ? mechanisms : remaining)) slots.push(1);

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
    S.relatedMiss = false; S.rerolling = false; S.lastCards = [];
  };

  window.OptionDirectorRuntime = {
    state: S, pick, score, isRelated, isMechanism, isPureNumeric, isEvolution
  };
})();

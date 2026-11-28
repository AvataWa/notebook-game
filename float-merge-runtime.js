/* 战斗跳字收拢：仅整理本次承伤新增的显示，不改变生命、护盾与减伤结算。 */
(() => {
  'use strict';
  const numberText = value => String(Math.round(value * 10) / 10);

  function mergeDamageFeedback(first) {
    let hpDamage = null, paper = 0, shield = 0, paperReduction = false;
    const remove = [];
    for (let i = first; i < floats.length; i++) {
      const txt = String(floats[i].txt || '');
      let match = txt.match(/^-(\d+(?:\.\d+)?)$/);
      if (match) { hpDamage = (hpDamage || 0) + Number(match[1]); remove.push(i); continue; }
      if (txt === '纸甲减伤') { paperReduction = true; remove.push(i); continue; }
      match = txt.match(/^纸甲 -(\d+(?:\.\d+)?)$/);
      if (match) { paper += Number(match[1]); remove.push(i); continue; }
      match = txt.match(/^盾 -(\d+(?:\.\d+)?)$/);
      if (match) { shield += Number(match[1]); remove.push(i); }
    }
    if (!remove.length) return;
    for (let i = remove.length - 1; i >= 0; i--) floats.splice(remove[i], 1);

    const blocked = paper + shield;
    let txt, color = RED;
    if (hpDamage !== null) {
      txt = '-' + numberText(hpDamage);
      if (paper > 0 && shield > 0) txt += '（防护挡 ' + numberText(blocked) + '）';
      else if (paper > 0) txt += '（纸甲挡 ' + numberText(paper) + '）';
      else if (shield > 0) txt += '（护盾挡 ' + numberText(shield) + '）';
      else if (paperReduction) txt += '（纸甲减伤）';
    } else if (paper > 0 && shield > 0) {
      txt = '防护挡 ' + numberText(blocked); color = ARC;
    } else if (paper > 0) {
      txt = '纸甲挡 ' + numberText(paper); color = ARC;
    } else if (shield > 0) {
      txt = '护盾挡 ' + numberText(shield); color = ARC;
    } else {
      txt = '纸甲减伤'; color = ARC;
    }
    floats.push({ x: player.x, y: player.y - 26, txt, t: 0.8, color });
  }

  const baseHurtPlayer = hurtPlayer;
  hurtPlayer = function(...args) {
    const first = floats.length;
    const result = baseHurtPlayer(...args);
    mergeDamageFeedback(first);
    return result;
  };

  window.FloatMergeRuntime = { mergeDamageFeedback };
})();

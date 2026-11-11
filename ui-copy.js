/* 界面短文案与完整详情：只组织展示，不改变任何战斗数值。 */
(() => {
  'use strict';
  function supportShort(id, l) {
    const n = Number(l) || 1;
    const text = {
      brutal: `伤害 +${25 * n}%，冷却 +${8 * n}%`,
      swift: `冷却 -${13 * n}%`,
      unleash: `每第 3 次施放，效果 x${1 + n}`,
      focus: `命中受伤 +${15 * n}%（2 秒）`,
      dot: `附加 ${18 * n}%/秒洇墨（3 秒）`,
      sharpen: `子弹伤害 +${20 * n}%`,
      projspd: `弹速 +${30 * n}%，伤害 +${10 * n}%`,
      heavynib: `子弹暴击率 +${10 * n}%`,
      longshot: `射程/存续 +${30 * n}%`,
      fatpipe: `子弹命中半径 +${25 * n}%`,
      multi: `弹数 +${n}，伤害 -${8 * n}%`,
      pierce: `穿透 +${n}，伤害 -${5 * n}%`,
      chain: `连锁/分裂/弹射 +${n}`,
      homing: `子弹追踪，转向 +${n} 档`,
      blast: `命中溅射 ${30 * n}% 伤害`,
      wide: `范围 +${22 * n}%`,
      saturate: `范围伤害 +${20 * n}%`,
      soak: `范围内受伤 +${8 * n}%`,
      sheath: `范围技能冷却 -${10 * n}%`,
      pressboss: `对 Boss 伤害 +${15 * n}%`,
      core: `区域内圈伤害 +${30 * n}%`,
      retick: `范围伤害频率 +${18 * n}%`,
      linger: `范围持续 +${35 * n}%`,
      reburst: `结束再爆发 ${50 + 25 * n}% 伤害`,
      stain: `离场余伤 ${1 + 0.5 * n} 秒`,
      heavyweight: `打击伤害 +${22 * n}%`,
      firstblood: `对满血怪伤害 +${40 * n}%`,
      combo: `连击每层伤害 +${6 * n}%，最多 5 层`,
      scrit: `打击暴击率 +${10 * n}%`,
      counter: `受击后打击伤害 +${30 * n}%（2 秒）`,
      rapid: `打击频率 +${15 * n}%`,
      sweep: `打击范围 +${20 * n}%`,
      followup: `命中追加 ${40 * n}% 伤害`,
      leech: `命中回复 ${(0.3 * n).toFixed(1)}% 生命`,
      shock: `击退 +${50 * n}%，僵直 ${(0.2 * n).toFixed(1)} 秒`,
      dur: `持续/召唤时间 +${40 * n}%`,
      onabsorb: `吸墨时施放，伤害 ${100 + 15 * (n - 1)}%`,
      ondive: `进入潜墨时施放，伤害 ${100 + 15 * (n - 1)}%`,
      onsurge: `墨潮时施放，伤害 ${100 + 15 * (n - 1)}%`,
      oncrit: `暴击时施放，冷却 ${(1 - 0.1 * (n - 1)).toFixed(1)} 秒`,
      onkill: `怪物死亡时施放，冷却 ${(1 - 0.1 * (n - 1)).toFixed(1)} 秒`
    };
    return text[id] || supDesc(id, n);
  }
  function skillShort(id) { return SKILL_DEFS[id] ? SKILL_DEFS[id].desc : ''; }
  function affixShort(def) { return def ? def.desc : ''; }
  function itemShort(key, rarity) { return itemDescription(key, rarity); }
  function show(data) { if (window.UIDetail) window.UIDetail.open(data); }
  function cardDetail(card) {
    if (!card) return;
    let body = card.desc || '', subtitle = card.tag || '';
    if (card.kind === 'active' || card.kind === 'start') body = skillShort(card.id);
    if (card.kind === 'active+') body = `${SKILL_DEFS[card.skill].desc}\n\n本次强化：${activeUpgradeDesc(card.skill, +String(card.name).match(/Lv(\d+)/)?.[1] || 1)}`;
    if (card.kind === 'support' || card.kind === 'support+') {
      const level = card.kind === 'support' ? 1 : (+String(card.name).match(/Lv(\d+)/)?.[1] || 1);
      subtitle = `${SUPPORTS[card.sup].name} → ${SKILL_DEFS[card.skill].name}`;
      body = supDesc(card.sup, level);
    }
    show({ title: card.name, subtitle, body, color: card.tagColor || INK });
  }
  function skillDetail(a) {
    const def = SKILL_DEFS[a.id];
    const lines = [def.desc, `等级 Lv.${a.lvl}　类型 ${(SKILL_TAGS[a.id] || []).map(t => TAG_NAME[t]).join(' / ')}`, `辅助 ${a.supports.length}/${MAX_SUPPORTS}`];
    if (!a.supports.length) lines.push('尚未镶嵌辅助技能');
    for (const sp of a.supports) lines.push(`◆ ${SUPPORTS[sp.id].name} Lv.${sp.lvl}`, supDesc(sp.id, sp.lvl));
    show({ title: def.name, subtitle: '主动技能 · 完整机制', body: lines.join('\n'), color: attrOf(a.id) });
  }
  function affixDetail(entry) {
    const def = entry.def || entry;
    const passive = entry.kind === 'passive' || !def.skill;
    const type = passive ? '通用被动' : ({ dive: '潜墨辅助', surge: '墨潮辅助', absorb: '吸墨辅助' })[def.skill];
    show({ title: def.name + (entry.count > 1 ? ` ×${entry.count}` : ''), subtitle: type, body: def.desc, color: passive ? DARK : INK });
  }
  function itemDetail(eq, slot, growth) {
    const def = ITEM_DEFS[eq.key], ri = rarityIndex(eq), rarity = RARITY_LIST[ri], stats = equipmentBaseStats(eq, growth);
    const body = `${equipmentProgressText(eq, growth)}　攻击 +${stats.atk}%　生命 +${stats.hp}\n每级强化部位基础攻防 +10%，所有掉落都会提供部位经验。\n\n${itemDescription(eq.key, ri)}`;
    show({ title: def.name, subtitle: `${rarity.name} · ${SLOT_NAME[slot || def.slot]}`, body, color: rarity.color });
  }
  window.UICopy = { skillShort, supportShort, affixShort, itemShort, cardDetail, skillDetail, affixDetail, itemDetail };
})();

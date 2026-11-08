/* 角色养成查看：打开即暂停，完整展示主动、辅助、操作词条与装备。 */
(() => {
  'use strict';

  let buildTab = 'skills', buildPage = 0, buildReturnState = 'play';
  const buildCloseRect = { x: 307, y: 41, w: 43, h: 31 };
  const buildTabRects = [
    { id: 'skills', name: '技能', x: 24, y: 86, w: 105, h: 36 },
    { id: 'affixes', name: '词条', x: 135, y: 86, w: 105, h: 36 },
    { id: 'equipment', name: '装备', x: 246, y: 86, w: 105, h: 36 }
  ];
  const buildPrevRect = { x: 28, y: 590, w: 82, h: 32 };
  const buildNextRect = { x: 265, y: 590, w: 82, h: 32 };

  function openBuildView() {
    if (state !== 'play' && state !== 'levelup' && state !== 'start') return false;
    buildReturnState = state;
    player.passiveCounts ||= {};
    if (player.surgeCharging) cancelInkSurgeCharge(player.surgePointerId);
    joy.active = false; joy.dx = 0; joy.dy = 0;
    for (const key of Object.keys(keys)) keys[key] = false;
    buildPage = 0; state = 'build';
    return true;
  }
  function closeBuildView() {
    if (state !== 'build') return false;
    state = buildReturnState; return true;
  }
  function setBuildTab(id) {
    if (!buildTabRects.some(t => t.id === id)) return false;
    buildTab = id; buildPage = 0; return true;
  }
  function buildEntries() {
    if (buildTab === 'skills') return player.actives;
    if (buildTab === 'affixes') {
      const result = [];
      const counts = player.passiveCounts || {};
      for (const p of PASSIVES) if (counts[p.id] > 0) result.push({ kind: 'passive', def: p, count: counts[p.id] });
      for (const a of OPERATION_AFFIX_LIST) if (hasAffix(a.skill, a.id)) result.push({ kind: 'operation', def: a });
      return result;
    }
    return SLOTS.filter(slot => player.equip[slot]).map(slot => ({ slot, eq: player.equip[slot] }));
  }
  function buildPerPage() { return buildTab === 'skills' ? 1 : (buildTab === 'affixes' ? 5 : 4); }
  function buildPageCount() { return Math.max(1, Math.ceil(buildEntries().length / buildPerPage())); }
  function changeBuildPage(dir) {
    buildPage = Math.max(0, Math.min(buildPageCount() - 1, buildPage + dir));
  }

  function buildWrap(text, x, y, maxWidth, lineHeight, maxLines = 3) {
    const lines = [];
    let line = '';
    for (const ch of String(text || '')) {
      if (ch === '\n') { lines.push(line); line = ''; continue; }
      if (line && ctx.measureText(line + ch).width > maxWidth) { lines.push(line); line = ch; }
      else line += ch;
    }
    if (line || !lines.length) lines.push(line);
    const shown = lines.slice(0, maxLines);
    shown.forEach((txt, i) => ctx.fillText(txt, x, y + i * lineHeight));
    return shown.length;
  }
  function buildButton(rect, label, enabled = true, active = false) {
    ctx.fillStyle = active ? 'rgba(210,225,255,0.98)' : 'rgba(255,250,238,0.94)';
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    jrect(rect.x, rect.y, rect.w, rect.h, enabled ? INK : GRAY, active ? 2.4 : 1.6);
    ctx.fillStyle = enabled ? INK : GRAY; ctx.textAlign = 'center'; ctx.font = 'bold 12px ' + FONT;
    ctx.fillText(label, rect.x + rect.w / 2, rect.y + rect.h / 2 + 4);
  }
  function buildCard(y, h, color = INK) {
    ctx.fillStyle = 'rgba(255,250,238,0.95)'; ctx.fillRect(24, y, 327, h);
    jrect(24, y, 327, h, color, 1.6);
  }
  function drawSkillEntry(a, y) {
    const def = SKILL_DEFS[a.id], c = skillCalc(a);
    buildCard(y, 423, attrOf(a.id));
    ctx.textAlign = 'left'; ctx.fillStyle = attrOf(a.id); ctx.font = 'bold 18px ' + FONT;
    ctx.fillText(def.name + '  Lv.' + a.lvl, 38, y + 29);
    ctx.textAlign = 'right'; ctx.fillStyle = GRAY; ctx.font = '10px ' + FONT;
    ctx.fillText((SKILL_TAGS[a.id] || []).map(t => TAG_NAME[t]).join(' · '), 337, y + 27);
    ctx.textAlign = 'left'; ctx.fillStyle = DARK; ctx.font = '11px ' + FONT;
    buildWrap(def.desc, 38, y + 51, 299, 16, 2);
    ctx.fillStyle = PURPLE; ctx.font = 'bold 12px ' + FONT;
    ctx.fillText('辅助 ' + a.supports.length + ' / ' + MAX_SUPPORTS, 38, y + 91);
    if (!a.supports.length) {
      ctx.fillStyle = GRAY; ctx.font = '11px ' + FONT; ctx.fillText('尚未镶嵌辅助技能', 38, y + 119);
    }
    a.supports.forEach((sp, i) => {
      const sy = y + 112 + i * 73;
      ctx.fillStyle = INK; ctx.font = 'bold 12px ' + FONT;
      ctx.fillText('◆ ' + SUPPORTS[sp.id].name + '  Lv.' + sp.lvl, 38, sy);
      ctx.fillStyle = DARK; ctx.font = '10px ' + FONT;
      buildWrap(supDesc(sp.id, sp.lvl), 48, sy + 20, 282, 15, 2);
    });
    ctx.fillStyle = GRAY; ctx.font = '10px ' + FONT; ctx.textAlign = 'right';
    const countText = (SKILL_TAGS[a.id] || []).includes('proj') ? '　当前弹数加成 +' + c.count : '';
    ctx.fillText('范围 x' + c.rad.toFixed(2) + countText, 337, y + 405);
  }
  function drawAffixEntry(entry, y) {
    const isPassive = entry.kind === 'passive', def = entry.def;
    const title = isPassive ? '通用被动' : ({ dive: '潜墨辅助', surge: '墨潮辅助', absorb: '吸墨辅助' })[def.skill];
    buildCard(y, 76, isPassive ? DARK : INK);
    ctx.textAlign = 'left'; ctx.fillStyle = isPassive ? DARK : INK; ctx.font = 'bold 13px ' + FONT;
    ctx.fillText(def.name + (isPassive && entry.count > 1 ? '  ×' + entry.count : ''), 38, y + 23);
    ctx.textAlign = 'right'; ctx.fillStyle = GRAY; ctx.font = '10px ' + FONT;
    ctx.fillText(title, 337, y + 22);
    ctx.textAlign = 'left'; ctx.fillStyle = DARK; ctx.font = '11px ' + FONT;
    buildWrap(def.desc, 38, y + 45, 299, 16, 2);
  }
  function drawEquipmentEntry(entry, y) {
    const eq = entry.eq, def = ITEM_DEFS[eq.key], ri = rarityIndex(eq), rarity = RARITY_LIST[ri];
    buildCard(y, 94, rarity.color);
    ctx.textAlign = 'left'; ctx.fillStyle = rarity.color; ctx.font = 'bold 14px ' + FONT;
    ctx.fillText(def.name, 38, y + 24);
    ctx.textAlign = 'right'; ctx.font = 'bold 11px ' + FONT;
    ctx.fillText(rarity.name + ' · ' + SLOT_NAME[entry.slot], 337, y + 23);
    ctx.textAlign = 'left'; ctx.fillStyle = DARK; ctx.font = '10px ' + FONT;
    ctx.fillText('攻击 +' + Math.round(def.atk * rarity.mul) + '%　生命 +' + Math.round(def.hp * rarity.mul), 38, y + 44);
    ctx.font = '11px ' + FONT;
    buildWrap(itemDescription(eq.key, ri), 38, y + 65, 299, 16, 2);
  }
  function drawBuildView() {
    ctx.fillStyle = 'rgba(35,31,28,0.8)'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(245,241,230,0.98)'; ctx.fillRect(12, 28, W - 24, 610);
    jrect(12, 28, W - 24, 610, INK, 2.4);
    ctx.textAlign = 'left'; ctx.fillStyle = INK; ctx.font = 'bold 21px ' + FONT;
    ctx.fillText('角色养成', 27, 61);
    buildButton(buildCloseRect, '返回');
    for (const tab of buildTabRects) buildButton(tab, tab.name, true, buildTab === tab.id);

    const entries = buildEntries(), perPage = buildPerPage();
    buildPage = Math.max(0, Math.min(buildPageCount() - 1, buildPage));
    const visible = entries.slice(buildPage * perPage, buildPage * perPage + perPage);
    if (!visible.length) {
      ctx.textAlign = 'center'; ctx.fillStyle = GRAY; ctx.font = '13px ' + FONT;
      const empty = buildTab === 'skills' ? '还没有主动技能' : (buildTab === 'affixes' ? '还没有获得词条' : '还没有装备');
      ctx.fillText(empty, W / 2, 330);
    } else if (buildTab === 'skills') {
      drawSkillEntry(visible[0], 137);
    } else if (buildTab === 'affixes') {
      visible.forEach((entry, i) => drawAffixEntry(entry, 137 + i * 83));
    } else {
      visible.forEach((entry, i) => drawEquipmentEntry(entry, 137 + i * 103));
    }

    buildButton(buildPrevRect, '上一页', buildPage > 0);
    buildButton(buildNextRect, '下一页', buildPage < buildPageCount() - 1);
    ctx.textAlign = 'center'; ctx.fillStyle = DARK; ctx.font = '11px ' + FONT;
    ctx.fillText((buildPage + 1) + ' / ' + buildPageCount(), W / 2, 604);
    ctx.fillStyle = GRAY; ctx.font = '10px ' + FONT;
    ctx.fillText('游戏已暂停 · 共 ' + entries.length + ' 项', W / 2, 624);
  }

  const baseApplyOptionForView = applyOption;
  applyOption = function(i) {
    const chosen = cards[i];
    baseApplyOptionForView(i);
    if (chosen && chosen.kind === 'passive') {
      player.passiveCounts ||= {};
      player.passiveCounts[chosen.id] = (player.passiveCounts[chosen.id] || 0) + 1;
    }
  };
  const baseRenderForView = render;
  render = function() {
    baseRenderForView();
    if (state === 'build') drawBuildView();
  };

  canvas.addEventListener('pointerdown', e => {
    const p = toLogical(e);
    if ((state === 'play' || state === 'levelup' || state === 'start') && pointInRect(p, buildRect)) {
      e.preventDefault(); e.stopImmediatePropagation(); openBuildView(); return;
    }
    if (state !== 'build') return;
    e.preventDefault(); e.stopImmediatePropagation();
    if (pointInRect(p, buildCloseRect)) { closeBuildView(); return; }
    for (const tab of buildTabRects) if (pointInRect(p, tab)) { setBuildTab(tab.id); return; }
    if (pointInRect(p, buildPrevRect)) changeBuildPage(-1);
    else if (pointInRect(p, buildNextRect)) changeBuildPage(1);
  }, true);
  window.addEventListener('keydown', e => {
    if (state === 'build' && e.key === 'Escape') {
      e.preventDefault(); e.stopImmediatePropagation(); closeBuildView();
    }
  }, true);

  window.__buildView = {
    open: openBuildView, close: closeBuildView, setTab: setBuildTab, changePage: changeBuildPage,
    entries: buildEntries,
    get tab() { return buildTab; }, get page() { return buildPage; }, get pageCount() { return buildPageCount(); }
  };
})();

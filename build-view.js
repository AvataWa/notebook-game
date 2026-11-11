/* 角色养成查看：打开即暂停；总览短文案，点按查看完整机制。 */
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
  function buildPerPage() { return buildTab === 'skills' ? 4 : (buildTab === 'affixes' ? 5 : 4); }
  function buildPageCount() { return Math.max(1, Math.ceil(buildEntries().length / buildPerPage())); }
  function changeBuildPage(dir) { buildPage = Math.max(0, Math.min(buildPageCount() - 1, buildPage + dir)); }
  function visibleEntries() {
    const entries = buildEntries(), per = buildPerPage();
    buildPage = Math.max(0, Math.min(buildPageCount() - 1, buildPage));
    return entries.slice(buildPage * per, buildPage * per + per);
  }
  function entryRect(i) {
    if (buildTab === 'skills') return { x: 24, y: 137 + i * 108, w: 327, h: 100 };
    if (buildTab === 'affixes') return { x: 24, y: 137 + i * 83, w: 327, h: 76 };
    return { x: 24, y: 137 + i * 103, w: 327, h: 94 };
  }
  function buildWrap(text, x, y, maxWidth, lineHeight, maxLines = 2) {
    const lines = []; let line = '';
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
  function buildCard(rect, color = INK) {
    ctx.fillStyle = 'rgba(255,250,238,0.95)'; ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    jrect(rect.x, rect.y, rect.w, rect.h, color, 1.6);
  }
  function detailHint(rect) {
    ctx.textAlign = 'right'; ctx.fillStyle = GRAY; ctx.font = '10px ' + FONT;
    ctx.fillText('详情 ›', rect.x + rect.w - 12, rect.y + rect.h - 10);
  }
  function drawSkillEntry(a, rect) {
    const def = SKILL_DEFS[a.id];
    buildCard(rect, attrOf(a.id));
    ctx.textAlign = 'left'; ctx.fillStyle = attrOf(a.id); ctx.font = 'bold 15px ' + FONT;
    ctx.fillText(def.name + '  Lv.' + a.lvl, rect.x + 14, rect.y + 23);
    ctx.textAlign = 'right'; ctx.fillStyle = PURPLE; ctx.font = 'bold 11px ' + FONT;
    ctx.fillText('辅 ' + a.supports.length + '/' + MAX_SUPPORTS, rect.x + rect.w - 14, rect.y + 22);
    ctx.textAlign = 'left'; ctx.fillStyle = DARK; ctx.font = '11px ' + FONT;
    buildWrap(window.UICopy ? window.UICopy.skillShort(a.id) : def.desc, rect.x + 14, rect.y + 47, rect.w - 28, 16, 2);
    detailHint(rect);
  }
  function drawAffixEntry(entry, rect) {
    const isPassive = entry.kind === 'passive', def = entry.def;
    const title = isPassive ? '通用被动' : ({ dive: '潜墨辅助', surge: '墨潮辅助', absorb: '吸墨辅助' })[def.skill];
    buildCard(rect, isPassive ? DARK : INK);
    ctx.textAlign = 'left'; ctx.fillStyle = isPassive ? DARK : INK; ctx.font = 'bold 13px ' + FONT;
    ctx.fillText(def.name + (isPassive && entry.count > 1 ? '  ×' + entry.count : ''), rect.x + 14, rect.y + 22);
    ctx.textAlign = 'right'; ctx.fillStyle = GRAY; ctx.font = '10px ' + FONT;
    ctx.fillText(title, rect.x + rect.w - 14, rect.y + 21);
    ctx.textAlign = 'left'; ctx.fillStyle = DARK; ctx.font = '11px ' + FONT;
    buildWrap(window.UICopy ? window.UICopy.affixShort(def) : def.desc, rect.x + 14, rect.y + 43, rect.w - 28, 15, 2);
  }
  function drawEquipmentEntry(entry, rect) {
    const eq = entry.eq, def = ITEM_DEFS[eq.key], ri = rarityIndex(eq), rarity = RARITY_LIST[ri], stats = equipmentBaseStats(eq);
    buildCard(rect, rarity.color);
    ctx.textAlign = 'left'; ctx.fillStyle = rarity.color; ctx.font = 'bold 14px ' + FONT;
    ctx.fillText(def.name, rect.x + 14, rect.y + 22);
    ctx.textAlign = 'right'; ctx.font = 'bold 11px ' + FONT;
    ctx.fillText(equipmentLevelText(eq) + ' · ' + rarity.name, rect.x + rect.w - 14, rect.y + 21);
    ctx.textAlign = 'left'; ctx.fillStyle = DARK; ctx.font = '10px ' + FONT;
    ctx.fillText('攻击 +' + stats.atk + '%　生命 +' + stats.hp, rect.x + 14, rect.y + 41);
    ctx.font = '11px ' + FONT;
    buildWrap(window.UICopy ? window.UICopy.itemShort(eq.key, ri) : itemDescription(eq.key, ri), rect.x + 14, rect.y + 60, rect.w - 28, 15, 2);
    detailHint(rect);
  }
  function openEntry(entry) {
    if (!window.UICopy) return;
    if (buildTab === 'skills') window.UICopy.skillDetail(entry);
    else if (buildTab === 'affixes') window.UICopy.affixDetail(entry);
    else window.UICopy.itemDetail(entry.eq, entry.slot);
  }
  function drawBuildView() {
    ctx.fillStyle = 'rgba(35,31,28,0.8)'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(245,241,230,0.98)'; ctx.fillRect(12, 28, W - 24, 610);
    jrect(12, 28, W - 24, 610, INK, 2.4);
    ctx.textAlign = 'left'; ctx.fillStyle = INK; ctx.font = 'bold 21px ' + FONT;
    ctx.fillText('角色养成', 27, 61);
    buildButton(buildCloseRect, '返回');
    for (const tab of buildTabRects) buildButton(tab, tab.name, true, buildTab === tab.id);
    const entries = buildEntries(), visible = visibleEntries();
    if (!visible.length) {
      ctx.textAlign = 'center'; ctx.fillStyle = GRAY; ctx.font = '13px ' + FONT;
      const empty = buildTab === 'skills' ? '还没有主动技能' : (buildTab === 'affixes' ? '还没有获得词条' : '还没有装备');
      ctx.fillText(empty, W / 2, 330);
    } else visible.forEach((entry, i) => {
      const rect = entryRect(i);
      if (buildTab === 'skills') drawSkillEntry(entry, rect);
      else if (buildTab === 'affixes') drawAffixEntry(entry, rect);
      else drawEquipmentEntry(entry, rect);
    });
    buildButton(buildPrevRect, '上一页', buildPage > 0);
    buildButton(buildNextRect, '下一页', buildPage < buildPageCount() - 1);
    ctx.textAlign = 'center'; ctx.fillStyle = DARK; ctx.font = '11px ' + FONT;
    ctx.fillText((buildPage + 1) + ' / ' + buildPageCount(), W / 2, 604);
    ctx.fillStyle = GRAY; ctx.font = '10px ' + FONT;
    ctx.fillText('已暂停 · 点按条目看详情', W / 2, 624);
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
  render = function() { baseRenderForView(); if (state === 'build') drawBuildView(); };

  canvas.addEventListener('pointerdown', e => {
    if (window.UIDetail && window.UIDetail.isOpen) return;
    const p = toLogical(e);
    if ((state === 'play' || state === 'levelup' || state === 'start') && pointInRect(p, buildRect)) {
      e.preventDefault(); e.stopImmediatePropagation(); openBuildView(); return;
    }
    if (state !== 'build') return;
    e.preventDefault(); e.stopImmediatePropagation();
    if (pointInRect(p, buildCloseRect)) { closeBuildView(); return; }
    for (const tab of buildTabRects) if (pointInRect(p, tab)) { setBuildTab(tab.id); return; }
    if (pointInRect(p, buildPrevRect)) { changeBuildPage(-1); return; }
    if (pointInRect(p, buildNextRect)) { changeBuildPage(1); return; }
    const visible = visibleEntries();
    for (let i = 0; i < visible.length; i++) if (pointInRect(p, entryRect(i))) { openEntry(visible[i]); return; }
  }, true);
  window.addEventListener('keydown', e => {
    if (window.UIDetail && window.UIDetail.isOpen) return;
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

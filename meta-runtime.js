/* 局外成长：本地存档、墨点天赋、装备收藏、段位考核与结算。 */
(() => {
  'use strict';
  const C = META_CONFIG;
  const memoryStore = {};
  const storage = {
    get(key) { try { return typeof localStorage !== 'undefined' ? localStorage.getItem(key) : (memoryStore[key] || null); } catch (_) { return memoryStore[key] || null; } },
    set(key, value) { memoryStore[key] = value; try { if (typeof localStorage !== 'undefined') localStorage.setItem(key, value); } catch (_) {} },
    remove(key) { delete memoryStore[key]; try { if (typeof localStorage !== 'undefined') localStorage.removeItem(key); } catch (_) {} }
  };
  const clone = obj => JSON.parse(JSON.stringify(obj));
  const clampInt = (v, min, max, fallback = min) => Number.isFinite(+v) ? Math.max(min, Math.min(max, Math.floor(+v))) : fallback;
  const validSkill = id => !!SKILL_DEFS[id] || C.inkSpecs.some(s => s.id === id);
  const validItem = eq => eq && ITEM_DEFS[eq.key] && Number.isFinite(+eq.rarity);

  function defaults() {
    return { version: 2, ink: 0, paper: 0, talents: {}, specs: {}, inventory: [], inherited: null, equipment: createEquipmentGrowth(),
      rank: 0, firstStages: [], firstBosses: [], stats: { runs: 0, wins: 0, highestStage: 1 } };
  }
  function validate(raw) {
    const d = defaults();
    if (!raw || typeof raw !== 'object') return d;
    d.ink = clampInt(raw.ink, 0, 99999999, 0); d.paper = clampInt(raw.paper, 0, 99999999, 0);
    d.rank = clampInt(raw.rank, 0, 18, 0);
    for (const b of C.basics) d.talents[b.id] = clampInt(raw.talents && raw.talents[b.id], 0, b.max, 0);
    for (const id of [...Object.keys(SKILL_DEFS), ...C.inkSpecs.map(s => s.id)]) d.specs[id] = clampInt(raw.specs && raw.specs[id], 0, 3, 0);
    const seen = new Set(), legacy = createEquipmentGrowth();
    if (Array.isArray(raw.inventory)) for (const eq of raw.inventory) {
      if (!validItem(eq)) continue;
      const clean = { key: eq.key, rarity: clampInt(eq.rarity, 0, 3, 0) }, id = clean.key + ':' + clean.rarity;
      const slot = ITEM_DEFS[clean.key].slot;
      legacy[slot].level = Math.max(legacy[slot].level, clampInt(eq.star, 0, equipmentRule().maxLevel, 0));
      if (seen.has(id)) continue;
      seen.add(id); d.inventory.push(clean);
    }
    if (validItem(raw.inherited)) {
      const eq = { key: raw.inherited.key, rarity: clampInt(raw.inherited.rarity, 0, 3, 0) }, slot = ITEM_DEFS[eq.key].slot;
      legacy[slot].level = Math.max(legacy[slot].level, clampInt(raw.inherited.star, 0, equipmentRule().maxLevel, 0));
      if (d.inventory.some(x => x.key === eq.key && x.rarity === eq.rarity)) d.inherited = eq;
    }
    for (const slot of SLOTS) {
      const saved = raw.equipment && raw.equipment[slot];
      d.equipment[slot].level = clampInt(saved && saved.level, 0, equipmentRule().maxLevel, legacy[slot].level);
      grantEquipmentExperience(d.equipment, slot, clampInt(saved && saved.xp, 0, 9999, 0));
    }
    d.firstStages = Array.isArray(raw.firstStages) ? [...new Set(raw.firstStages.map(x => clampInt(x, 1, 10, 1)))] : [];
    d.firstBosses = Array.isArray(raw.firstBosses) ? [...new Set(raw.firstBosses.map(x => clampInt(x, 1, 10, 1)))] : [];
    d.stats = { runs: clampInt(raw.stats && raw.stats.runs, 0, 999999, 0),
      wins: clampInt(raw.stats && raw.stats.wins, 0, 999999, 0), highestStage: clampInt(raw.stats && raw.stats.highestStage, 1, 10, 1) };
    return d;
  }
  let meta;
  try { meta = validate(JSON.parse(storage.get(C.storageKey) || 'null')); } catch (_) { meta = defaults(); }
  function save() { storage.set(C.storageKey, JSON.stringify(meta)); }
  let run = null, settlement = null, metaTab = 'basic', summaryTab = 'damage', metaPage = 0, inventorySlot = 'all', resetArmed = false, reforgePending = null, uiMessage = '';

  function rankInfo(index = meta.rank) {
    const i = clampInt(index, 0, 18, 0);
    if (i >= 18) return { index: 18, major: 5, minor: 2, name: '纸面传说·大师' };
    const major = Math.floor(i / 3), minor = i % 3;
    return { index: i, major, minor, name: C.rankNames[major] + C.rankMinor[minor] };
  }
  function rankMultipliers(index) {
    const r = rankInfo(index), i = Math.min(17, r.index), major = r.major;
    return { hp: 1 + i * 0.05 + (major >= 1 ? 0.1 : 0), dmg: 1 + i * 0.03 + (major >= 2 ? 0.15 : 0),
      bossHp: major >= 4 ? 1.3 : 1, attack: major >= 3 ? 0.9 : 1, cap: major >= 1 ? 5 : 0,
      eliteEarly: major >= 2 ? 60 : 0, phaseAt: major >= 4 ? 0.65 : 0.5 };
  }
  function inheritedDescription() {
    if (!meta.inherited) return '无';
    const eq = meta.inherited;
    return RARITY_LIST[eq.rarity].name + '·' + ITEM_DEFS[eq.key].name + '·' + equipmentLevelText(eq, meta.equipment);
  }
  function applyPlayer() {
    const t = meta.talents;
    player.metaDamageMul = 1 + (t.dmg || 0) * 0.03;
    player.metaHpBonus = (t.hp || 0) * 5;
    player.metaInkBonus = (t.ink || 0) * 5;
    player.metaSurgeMul = 1 + (meta.specs.surge || 0) * 0.05;
    player.metaAbsorbMul = 1 + (meta.specs.absorb || 0) * 0.05;
    player.metaDiveMul = 1 + (meta.specs.dive || 0) * 0.05;
    player.speed = BATTLE.player.speed * (1 + (t.speed || 0) * 0.015);
    player.metaEnemyAttackMul = 1; player.metaEliteEarly = 0;
    player.metaBossPhaseAt = 0.5; player.metaRegenMul = 1; player.metaNoRevive = false;
    player.equipGrowth = run ? run.growth : clone(meta.equipment);
    if (run && run.mode === 'ranked') {
      const m = rankMultipliers(run.rank);
      player.metaEnemyAttackMul = m.attack * (run.affixes.includes('急促铃') ? 0.9 : 1);
      player.metaEliteEarly = m.eliteEarly;
      player.metaBossPhaseAt = m.phaseAt; player.metaRegenMul = run.affixes.includes('断墨') ? 0.7 : 1;
      player.metaNoRevive = run.affixes.includes('不许返工');
    }
    if (meta.inherited) {
      const eq = clone(meta.inherited), slot = ITEM_DEFS[eq.key].slot;
      player.equip[slot] = eq;
    }
    recomputeEquip();
  }
  function beginRun(ranked = false) {
    const affixes = [];
    if (ranked && rankInfo().major >= 5) {
      const pool = C.examAffixes.slice();
      while (affixes.length < 2 && pool.length) affixes.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
    }
    run = { mode: ranked ? 'ranked' : 'normal', rank: meta.rank, found: [], bossStages: [], affixes, settled: false, uid: 1,
      growth: clone(meta.equipment), overflowPaper: 0 };
    settlement = null; resetGame(); applyPlayer(); state = 'start';
    if (ranked) toast('段位考核 · ' + rankInfo(run.rank).name + (affixes.length ? ' · ' + affixes.join(' / ') : ''));
    return true;
  }
  function beginBossTest(stage = 1) {
    const bossStage = clampInt(stage, 1, 10, 1);
    beginRun(false);
    run.mode = 'bossTest'; run.bossTestStage = bossStage;
    applyOption(0);   // 随机起手技能，跳过起手三选一，直接进入战斗。
    player.level = 10; player.xp = 0; player.xpNext = xpForNextLevel(10);
    curStage = bossStage; bossStageSpawned = bossStage;
    spawnBoss(bossStage);
    player.goldT = 1;
    state = 'play';
    toast('Boss 挑战 · ' + BOSS_DEFS[bossStage - 1].name + ' · 不计入局外收益');
    return true;
  }
  function openBossChallenge() { state = 'metaBossChallenge'; uiMessage = ''; }
  function recordEquipment(dr) {
    if (!run || run.settled || !dr || !ITEM_DEFS[dr.item]) return false;
    const rarity = rarityIndex(dr), slot = ITEM_DEFS[dr.item].slot;
    const xp = equipmentRule().rarityXp[rarity] + (dr.duplicate ? equipmentRule().duplicateXp : 0);
    const result = grantEquipmentExperience(run.growth, slot, xp);
    const paper = result.overflow > 0 ? Math.max(1, Math.round((C.scrapByRarity[rarity] || 0) * result.overflow / xp)) : 0;
    run.overflowPaper += paper;
    const found = { uid: run.uid++, key: dr.item, rarity, xp, paper, levels: result.levels };
    run.found.push(found);
    player.equipGrowth = run.growth; recomputeEquip();
    return found;
  }
  function addInventory(eq) {
    if (meta.inventory.some(x => x.key === eq.key && x.rarity === eq.rarity)) {
      uiMessage = ITEM_DEFS[eq.key].name + ' 已收录 · 经验已计入部位等级';
      return false;
    }
    meta.inventory.push({ key: eq.key, rarity: eq.rarity }); return true;
  }
  function settleRun(win) {
    if (!run || run.settled) return false;
    run.settled = true;
    meta.equipment = clone(run.growth); meta.paper += run.overflowPaper;
    const waves = clampInt(player.level, 1, 100, 1), bossCount = run.bossStages.length;
    const base = waves + bossCount * 15 + (win ? 50 : 0);
    let firstBonus = 0;
    for (let st = 1; st <= curSt(); st++) if (!meta.firstStages.includes(st)) { meta.firstStages.push(st); firstBonus += 10; }
    for (const st of run.bossStages) if (!meta.firstBosses.includes(st)) { meta.firstBosses.push(st); firstBonus += 20; }
    const oldRank = meta.rank;
    const multiplier = 1 + (run.mode === 'ranked' ? 0.2 : 0) + Math.min(5, Math.floor(oldRank / 3)) * 0.05;
    const earned = Math.round((base + firstBonus) * multiplier);
    meta.ink += earned; meta.stats.runs++; if (win) meta.stats.wins++;
    meta.stats.highestStage = Math.max(meta.stats.highestStage, curSt());
    let promoted = false;
    if (win && run.mode === 'ranked' && run.rank === meta.rank && meta.rank < 18) { meta.rank++; promoted = true; }
    const build = {
      actives: clone(player.actives), passives: clone(player.passiveCounts || {}),
      affixes: clone(player.affixes), taken: clone(player.taken), equip: clone(player.equip)
    };
    settlement = { win, mode: run.mode, earned, base, firstBonus, found: clone(run.found), selected: [], build,
      stage: curSt(), level: player.level, kills, time: gameTime, damage: clone(damageStats), growth: clone(run.growth), overflowPaper: run.overflowPaper,
      slots: run.mode === 'ranked' ? 0 : 1 + (run.bossStages.some(st => st >= 5) ? 1 : 0) + (win ? 1 : 0),
      promoted, oldRank, newRank: meta.rank, page: 0 };
    metaPage = 0; summaryTab = 'damage'; state = 'metaRunSummary'; save(); return true;
  }
  function continueSettlement() {
    if (!settlement || state !== 'metaRunSummary') return false;
    if (settlement.mode === 'ranked') return finishSettlement();
    metaPage = 0; state = 'metaSettlement'; return true;
  }
  function toggleSettlement(uid) {
    if (!settlement) return false;
    const at = settlement.selected.indexOf(uid);
    if (at >= 0) settlement.selected.splice(at, 1);
    else if (settlement.selected.length < settlement.slots && settlement.found.some(x => x.uid === uid)) settlement.selected.push(uid);
    return true;
  }
  function finishSettlement() {
    if (!settlement) return false;
    for (const eq of settlement.found) if (settlement.selected.includes(eq.uid)) addInventory(eq);
    save(); settlement = null; goHome(); return true;
  }
  function setInherited(key, rarity) {
    const eq = meta.inventory.find(x => x.key === key && x.rarity === rarity);
    if (!eq) return false;
    meta.inherited = { key, rarity }; save(); uiMessage = '已设为下局继承装备'; return true;
  }
  function reforge(key, rarity) {
    const index = meta.inventory.findIndex(x => x.key === key && x.rarity === rarity);
    if (index < 0) return false;
    const cost = C.reforgeCostByRarity[rarity], slot = ITEM_DEFS[key].slot;
    if (meta.paper < cost) { uiMessage = '碎纸不足'; return false; }
    const candidates = Object.keys(ITEM_DEFS).filter(k => ITEM_DEFS[k].slot === slot && k !== key && !meta.inventory.some(x => x.key === k && x.rarity === rarity));
    if (!candidates.length) { uiMessage = '该部位同品质已集齐'; return false; }
    const next = candidates[Math.floor(Math.random() * candidates.length)];
    meta.inventory[index].key = next; meta.paper -= cost;
    if (meta.inherited && meta.inherited.key === key && meta.inherited.rarity === rarity) meta.inherited.key = next;
    save(); uiMessage = '重铸为 ' + ITEM_DEFS[next].name; return true;
  }
  function talentEntries() {
    if (metaTab === 'basic') return C.basics.map(b => ({ id: b.id, name: b.name, desc: b.desc, level: meta.talents[b.id] || 0, max: b.max, costs: C.basicCosts, per: b.per, unit: b.unit }));
    if (metaTab === 'active') return Object.keys(SKILL_DEFS).map(id => ({ id, name: SKILL_DEFS[id].name, desc: '技能伤害', level: meta.specs[id] || 0, max: 3, costs: C.specCosts, per: 5, unit: '%' }));
    return C.inkSpecs.map(s => ({ id: s.id, name: s.name, desc: s.desc, level: meta.specs[s.id] || 0, max: 3, costs: C.specCosts, per: 5, unit: '%' }));
  }
  function upgradeTalent(id) {
    const entry = talentEntries().find(x => x.id === id);
    if (!entry || entry.level >= entry.max) return false;
    const cost = entry.costs[entry.level];
    if (meta.ink < cost) { uiMessage = '墨点不足'; return false; }
    meta.ink -= cost;
    if (metaTab === 'basic') meta.talents[id] = entry.level + 1; else meta.specs[id] = entry.level + 1;
    save(); uiMessage = entry.name + ' 升至 Lv.' + (entry.level + 1); return true;
  }
  function spentInk() {
    let sum = 0;
    for (const b of C.basics) for (let i = 0; i < (meta.talents[b.id] || 0); i++) sum += C.basicCosts[i];
    for (const id of Object.keys(meta.specs)) for (let i = 0; i < (meta.specs[id] || 0); i++) sum += C.specCosts[i];
    return sum;
  }
  function resetTalents() {
    meta.ink += spentInk();
    for (const b of C.basics) meta.talents[b.id] = 0;
    for (const id of Object.keys(meta.specs)) meta.specs[id] = 0;
    save(); uiMessage = '天赋已重置，墨点全部返还'; return true;
  }
  function goHome() { run = null; resetGame(); state = 'metaHome'; metaPage = 0; resetArmed = false; reforgePending = null; }

  /* 战斗接入：主动专精、段位强度、Boss 记录。 */
  const baseSkillCalc = skillCalc;
  skillCalc = function(a) {
    const c = baseSkillCalc(a);
    c.dmg *= 1 + (meta.specs[a.id] || 0) * 0.05;
    c.cd *= 1 - (meta.talents.cd || 0) * 0.01;
    return c;
  };
  const baseHurtEnemy = hurtEnemy;
  hurtEnemy = function(e, dmg, ...rest) { return baseHurtEnemy(e, dmg * (player.metaDamageMul || 1), ...rest); };
  const baseScaledEnemyStats = scaledEnemyStats;
  scaledEnemyStats = function(d0) {
    const s = baseScaledEnemyStats(d0);
    if (run && run.mode === 'ranked') { const m = rankMultipliers(run.rank); s.hp *= m.hp; s.dmg = Math.round(s.dmg * m.dmg); }
    return s;
  };
  const baseSpawnBoss = spawnBoss;
  spawnBoss = function(st) {
    const before = enemies.length; baseSpawnBoss(st);
    if (run && run.mode === 'ranked' && enemies.length > before) {
      const e = enemies[enemies.length - 1], m = rankMultipliers(run.rank);
      e.hp *= m.hp * m.bossHp; e.maxhp = e.hp; e.baseMaxHp = e.hp; e.dmg = Math.round(e.dmg * m.dmg); e.baseDmg = e.dmg;
    }
  };
  const baseNormalEnemyCap = normalEnemyCap;
  normalEnemyCap = function() {
    let extra = 0;
    if (run && run.mode === 'ranked') { const m = rankMultipliers(run.rank); extra = m.cap + (run.affixes.includes('群像') ? 10 : 0); }
    return baseNormalEnemyCap() + extra;
  };
  const baseKillEnemy = killEnemy;
  killEnemy = function(e) {
    baseKillEnemy(e);
    if (run && !run.settled) {
      if (e.boss && !run.bossStages.includes(e.stage)) run.bossStages.push(e.stage);
      if (run.mode === 'ranked' && e.boss && e.stage >= 1) state = 'win';
      if (run.mode === 'ranked' && run.affixes.includes('涂改') && !e.boss) addHostileInk(e.x, e.y, 3, 20, e.id);
    }
  };

  /* 局外 Canvas UI。 */
  function text(txt, x, y, size = 13, color = DARK, align = 'left', bold = false) {
    ctx.fillStyle = color; ctx.textAlign = align; ctx.font = (bold ? 'bold ' : '') + size + 'px ' + FONT; ctx.fillText(txt, x, y);
  }
  function wrap(txt, x, y, width, lineHeight = 15, maxLines = 2) {
    const lines = []; let line = '';
    for (const ch of String(txt || '')) {
      if (line && ctx.measureText(line + ch).width > width) { lines.push(line); line = ch; } else line += ch;
    }
    if (line) lines.push(line);
    lines.slice(0, maxLines).forEach((s, i) => ctx.fillText(s, x, y + i * lineHeight));
  }
  function button(rect, label, enabled = true, active = false) {
    ctx.fillStyle = active ? 'rgba(210,225,255,0.98)' : 'rgba(255,250,238,0.96)'; ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    jrect(rect.x, rect.y, rect.w, rect.h, enabled ? INK : GRAY, active ? 2.5 : 1.7);
    text(label, rect.x + rect.w / 2, rect.y + rect.h / 2 + 4, 12, enabled ? INK : GRAY, 'center', true);
  }
  function panel(title, subtitle) {
    ctx.fillStyle = PAPER; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(90,150,200,0.16)'; ctx.lineWidth = 1;
    for (let y = 80; y < H; y += 28) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
    text(title, 24, 49, 23, INK, 'left', true);
    if (subtitle) text(subtitle, W - 24, 46, 11, GRAY, 'right');
  }
  function backButton() { return { x: 296, y: 25, w: 58, h: 32 }; }
  function pager(count, perPage, y = 582) {
    const pages = Math.max(1, Math.ceil(count / perPage)); metaPage = Math.max(0, Math.min(pages - 1, metaPage));
    const prev = { x: 28, y, w: 78, h: 31 }, next = { x: 269, y, w: 78, h: 31 };
    button(prev, '上一页', metaPage > 0); button(next, '下一页', metaPage < pages - 1);
    text((metaPage + 1) + ' / ' + pages, W / 2, y + 20, 11, DARK, 'center');
    return { pages, prev, next };
  }
  function drawHome() {
    panel('我穿越到笔记本了', '局外手账');
    text(rankInfo().name, W / 2, 126, 23, INK, 'center', true);
    text('墨点 ' + meta.ink + '　碎纸 ' + meta.paper, W / 2, 158, 14, DARK, 'center');
    text('继承：' + inheritedDescription(), W / 2, 190, 12, GRAY, 'center');
    const rects = homeRects();
    button(rects.normal, '开始游戏');
    button(rects.ranked, meta.rank >= 18 ? '大师考核' : '段位考核');
    button(rects.inventory, '文具盒 ' + meta.inventory.length);
    button(rects.talents, '天赋');
    button(rects.bossChallenge, 'Boss 挑战');
    text(meta.stats.runs + ' 局 · ' + meta.stats.wins + ' 次通关 · 最高第 ' + meta.stats.highestStage + ' 页', W / 2, 566, 12, DARK, 'center');
    jcircle(25, 73, 14, GRAY, 1.6); text('删', 25, 78, 12, GRAY, 'center', true);
    if (resetArmed) {
      ctx.fillStyle = 'rgba(16,16,16,0.48)'; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = PAPER; ctx.fillRect(38, 230, 299, 190); jrect(38, 230, 299, 190, RED, 2.2);
      text('确认删除本地存档？', W / 2, 272, 18, RED, 'center', true);
      text('墨点、装备、天赋与段位都会被清除', W / 2, 306, 12, DARK, 'center');
      text('此操作无法撤销', W / 2, 330, 11, GRAY, 'center');
      button(rects.resetCancel, '取消'); button(rects.resetConfirm, '确认删除', true, true);
    }
  }
  function homeRects() {
    return { normal: { x: 58, y: 235, w: 259, h: 48 }, ranked: { x: 58, y: 299, w: 259, h: 48 },
      inventory: { x: 58, y: 363, w: 259, h: 48 }, talents: { x: 58, y: 427, w: 259, h: 48 },
      bossChallenge: { x: 58, y: 491, w: 259, h: 38 }, reset: { x: 11, y: 59, w: 28, h: 28 },
      resetCancel: { x: 58, y: 360, w: 118, h: 38 }, resetConfirm: { x: 199, y: 360, w: 118, h: 38 } };
  }
  function bossChallengeRects() {
    return BOSS_DEFS.map((def, i) => ({ x: i % 2 ? 193 : 24, y: 116 + Math.floor(i / 2) * 84, w: 158, h: 72 }));
  }
  function drawBossChallenge() {
    panel('Boss 挑战', '10 名 Boss'); button(backButton(), '返回');
    text('练习模式 · 无收益', W / 2, 88, 12, INK, 'center');
    const rects = bossChallengeRects(), archNames = { charger: '近战突袭', caster: '远程术式', blob: '区域压制' };
    BOSS_DEFS.forEach((def, i) => {
      const r = rects[i], cleared = meta.firstBosses.includes(i + 1);
      ctx.fillStyle = 'rgba(255,250,238,0.96)'; ctx.fillRect(r.x, r.y, r.w, r.h);
      jrect(r.x, r.y, r.w, r.h, cleared ? INK : DARK, cleared ? 2.3 : 1.5);
      text('第 ' + String(i + 1).padStart(2, '0') + ' 页', r.x + 12, r.y + 18, 9, GRAY);
      text(def.name, r.x + r.w / 2, r.y + 40, 13, INK, 'center', true);
      text(archNames[def.arch] + (cleared ? ' · 已讨伐' : ''), r.x + r.w / 2, r.y + 59, 9, cleared ? PURPLE : GRAY, 'center');
    });
  }
  function drawTalents() {
    panel('墨点天赋', '墨点 ' + meta.ink); button(backButton(), '返回');
    const tabs = [{ id: 'basic', name: '基础' }, { id: 'active', name: '主动' }, { id: 'ink', name: '墨水' }];
    tabs.forEach((t, i) => button({ x: 24 + i * 111, y: 79, w: 105, h: 34 }, t.name, true, metaTab === t.id));
    const entries = talentEntries(), per = 5, shown = entries.slice(metaPage * per, metaPage * per + per);
    shown.forEach((entry, i) => {
      const y = 128 + i * 84, maxed = entry.level >= entry.max, cost = maxed ? 0 : entry.costs[entry.level];
      const current = entry.level * entry.per, next = (entry.level + 1) * entry.per;
      ctx.fillStyle = 'rgba(255,250,238,0.92)'; ctx.fillRect(24, y, 327, 76); jrect(24, y, 327, 76, maxed ? GRAY : INK, 1.4);
      text(entry.name + '  Lv.' + entry.level + '/' + entry.max, 36, y + 25, 13, INK, 'left', true);
      text(entry.desc + ' +' + current + entry.unit + (maxed ? '' : ' → +' + next + entry.unit), 36, y + 51, 11, DARK);
      button({ x: 269, y: y + 22, w: 68, h: 34 }, maxed ? '已满' : String(cost), !maxed && meta.ink >= cost);
    });
    if (!shown.length) text('暂无可升级项目', W / 2, 300, 13, GRAY, 'center');
    const pg = pager(entries.length, per, 552); drawTalents.pg = pg;
    button({ x: 119, y: 603, w: 137, h: 32 }, '重置天赋');
    if (uiMessage) text(uiMessage, W / 2, 524, 11, PURPLE, 'center');
  }
  function inventoryEntries() {
    return meta.inventory.filter(eq => inventorySlot === 'all' || ITEM_DEFS[eq.key].slot === inventorySlot)
      .slice().sort((a, b) => SLOTS.indexOf(ITEM_DEFS[a.key].slot) - SLOTS.indexOf(ITEM_DEFS[b.key].slot) || b.rarity - a.rarity);
  }
  function reforgeRects() { return { cancel: { x: 58, y: 371, w: 118, h: 38 }, confirm: { x: 199, y: 371, w: 118, h: 38 } }; }
  function drawInventory() {
    panel('文具盒', '碎纸 ' + meta.paper); button(backButton(), '返回');
    text('下局继承：' + inheritedDescription(), 24, 72, 11, PURPLE);
    const filters = [{ id: 'all', name: '全部' }, ...SLOTS.map(s => ({ id: s, name: SLOT_NAME[s] }))];
    filters.forEach((f, i) => button({ x: 17 + i * 57, y: 84, w: 53, h: 31 }, f.name, true, inventorySlot === f.id));
    const entries = inventoryEntries(), per = 4, shown = entries.slice(metaPage * per, metaPage * per + per);
    shown.forEach((eq, i) => {
      const y = 128 + i * 105, def = ITEM_DEFS[eq.key], rarity = RARITY_LIST[eq.rarity];
      const inherited = meta.inherited && meta.inherited.key === eq.key && meta.inherited.rarity === eq.rarity;
      ctx.fillStyle = 'rgba(255,250,238,0.94)'; ctx.fillRect(24, y, 327, 96); jrect(24, y, 327, 96, rarity.color, 1.7);
      text(def.name, 36, y + 23, 14, rarity.color, 'left', true);
      text(equipmentProgressText(eq, meta.equipment) + ' · ' + rarity.name, 36, y + 42, 10, GRAY);
      ctx.font = '10px ' + FONT; ctx.fillStyle = DARK; ctx.textAlign = 'left'; wrap(window.UICopy ? window.UICopy.itemShort(eq.key, eq.rarity) : itemDescription(eq.key, eq.rarity), 36, y + 61, 204, 13, 2);
      text('详情 ›', 238, y + 88, 9, GRAY, 'right');
      button({ x: 250, y: y + 14, w: 88, h: 31 }, inherited ? '已继承' : '继承', !inherited, inherited);
      button({ x: 250, y: y + 53, w: 88, h: 31 }, '重铸 ' + C.reforgeCostByRarity[eq.rarity], meta.paper >= C.reforgeCostByRarity[eq.rarity]);
    });
    if (!shown.length) text('还没有装备', W / 2, 300, 13, GRAY, 'center');
    const pg = pager(entries.length, per, 554); drawInventory.pg = pg;
    if (uiMessage) text(uiMessage, W / 2, 534, 11, PURPLE, 'center');
    if (reforgePending) {
      const eq = reforgePending, r = reforgeRects();
      ctx.fillStyle = 'rgba(16,16,16,0.48)'; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = PAPER; ctx.fillRect(38, 225, 299, 204); jrect(38, 225, 299, 204, INK, 2.2);
      text('确认重铸？', W / 2, 267, 18, INK, 'center', true);
      text(ITEM_DEFS[eq.key].name + ' · ' + RARITY_LIST[eq.rarity].name + ' · ' + equipmentLevelText(eq, meta.equipment), W / 2, 298, 12, DARK, 'center');
      text('同部位同品质随机换装 · 等级不变', W / 2, 326, 11, DARK, 'center');
      text('消耗 ' + C.reforgeCostByRarity[eq.rarity] + ' 碎纸', W / 2, 349, 11, PURPLE, 'center');
      button(r.cancel, '取消'); button(r.confirm, '确认重铸', true, true);
    }
  }
  function summaryEntries() {
    if (!settlement) return [];
    const build = settlement.build;
    if (summaryTab === 'skills') return build.actives;
    if (summaryTab === 'affixes') {
      const entries = [];
      for (const p of PASSIVES) if ((build.passives[p.id] || 0) > 0) entries.push({ kind: 'passive', def: p, count: build.passives[p.id] });
      for (const a of OPERATION_AFFIX_LIST) if ((build.affixes[a.skill] && build.affixes[a.skill][a.id]) || build.taken[a.id]) entries.push({ kind: 'operation', def: a });
      return entries;
    }
    if (summaryTab === 'damage') {
      const stats = settlement.damage || {}, total = Object.values(stats).reduce((sum, value) => sum + value, 0);
      return Object.entries(stats).filter(([, value]) => value > 0).map(([id, value]) => ({ id, value, total }))
        .sort((a, b) => b.value - a.value);
    }
    return SLOTS.filter(slot => build.equip[slot]).map(slot => ({ slot, eq: build.equip[slot] }));
  }
  function summaryPerPage() { return summaryTab === 'skills' || summaryTab === 'equipment' ? 4 : 5; }
  function summaryRect(i) {
    if (summaryTab === 'skills') return { x: 24, y: 158 + i * 91, w: 327, h: 84 };
    if (summaryTab === 'affixes') return { x: 24, y: 158 + i * 74, w: 327, h: 68 };
    return { x: 24, y: 158 + i * 91, w: 327, h: 85 };
  }
  function drawSummary() {
    if (!settlement) return;
    panel('本关构筑回顾', settlement.mode === 'ranked' ? '段位考核' : '普通模式');
    const seconds = Math.floor(settlement.time || 0), timeText = Math.floor(seconds / 60) + ':' + String(seconds % 60).padStart(2, '0');
    text('第 ' + settlement.stage + ' 页 · Lv.' + settlement.level + ' · 击杀 ' + settlement.kills + ' · ' + timeText + ' · 墨点 +' + settlement.earned, W / 2, 78, 11, DARK, 'center');
    const resultText = settlement.win ? '挑战成功' : '挑战失败';
    const headline = settlement.promoted ? resultText + ' · ' + rankInfo(settlement.oldRank).name + ' → ' + rankInfo(settlement.newRank).name : resultText;
    text(headline, W / 2, 99, 14, settlement.win ? (settlement.promoted ? PURPLE : INK) : RED, 'center', true);
    const tabs = [{ id: 'skills', name: '技能' }, { id: 'affixes', name: '词条' }, { id: 'equipment', name: '装备' }, { id: 'damage', name: '伤害' }];
    tabs.forEach((t, i) => button({ x: 24 + i * 82, y: 113, w: 78, h: 32 }, t.name, true, summaryTab === t.id));
    const entries = summaryEntries(), per = summaryPerPage(), shown = entries.slice(metaPage * per, metaPage * per + per);
    if (summaryTab === 'skills') shown.forEach((a, i) => {
      const r = summaryRect(i), def = SKILL_DEFS[a.id];
      ctx.fillStyle = 'rgba(255,250,238,0.94)'; ctx.fillRect(r.x, r.y, r.w, r.h); jrect(r.x, r.y, r.w, r.h, attrOf(a.id), 1.7);
      text(def.name + '  Lv.' + a.lvl, 36, r.y + 23, 15, attrOf(a.id), 'left', true);
      text('辅 ' + a.supports.length + '/' + MAX_SUPPORTS, 339, r.y + 22, 11, PURPLE, 'right', true);
      ctx.font = '11px ' + FONT; ctx.fillStyle = DARK; ctx.textAlign = 'left'; wrap(window.UICopy ? window.UICopy.skillShort(a.id) : def.desc, 36, r.y + 45, 299, 15, 2);
      text('详情 ›', 339, r.y + 76, 9, GRAY, 'right');
    });
    if (summaryTab === 'affixes') shown.forEach((entry, i) => {
      const r = summaryRect(i), passive = entry.kind === 'passive', def = entry.def;
      ctx.fillStyle = 'rgba(255,250,238,0.94)'; ctx.fillRect(r.x, r.y, r.w, r.h); jrect(r.x, r.y, r.w, r.h, passive ? DARK : INK, 1.4);
      text(def.name + (passive && entry.count > 1 ? ' ×' + entry.count : ''), 36, r.y + 22, 13, INK, 'left', true);
      const type = passive ? '通用' : ({ dive: '潜墨', surge: '墨潮', absorb: '吸墨' })[def.skill];
      text(type, 339, r.y + 21, 10, GRAY, 'right');
      ctx.font = '10px ' + FONT; ctx.fillStyle = DARK; ctx.textAlign = 'left'; wrap(window.UICopy ? window.UICopy.affixShort(def) : def.desc, 36, r.y + 43, 299, 14, 2);
    });
    if (summaryTab === 'equipment') shown.forEach((entry, i) => {
      const r = summaryRect(i), eq = entry.eq, def = ITEM_DEFS[eq.key], rarity = RARITY_LIST[rarityIndex(eq)], stats = equipmentBaseStats(eq, settlement.growth);
      ctx.fillStyle = 'rgba(255,250,238,0.94)'; ctx.fillRect(r.x, r.y, r.w, r.h); jrect(r.x, r.y, r.w, r.h, rarity.color, 1.5);
      text(def.name, 36, r.y + 21, 13, rarity.color, 'left', true);
      text(equipmentLevelText(eq, settlement.growth) + ' · ' + rarity.name, 339, r.y + 20, 10, rarity.color, 'right');
      text('攻击 +' + stats.atk + '%　生命 +' + stats.hp, 36, r.y + 40, 10, DARK);
      ctx.font = '10px ' + FONT; ctx.fillStyle = DARK; ctx.textAlign = 'left'; wrap(window.UICopy ? window.UICopy.itemShort(eq.key, rarityIndex(eq)) : itemDescription(eq.key, rarityIndex(eq)), 36, r.y + 59, 270, 14, 2);
      text('详情 ›', 339, r.y + 76, 9, GRAY, 'right');
    });
    if (summaryTab === 'damage') {
      if (shown.length) text('伤害统计 ' + Math.round(shown[0].total).toLocaleString() + ' · 按来源排序', W / 2, 161, 11, DARK, 'center');
      const names = { surge: '墨潮', absorb: '吸墨／弹反', dive: '潜墨', other: '其他／墨迹' };
      shown.forEach((entry, i) => {
        const y = 177 + i * 68, name = (SKILL_DEFS[entry.id] && SKILL_DEFS[entry.id].name) || names[entry.id] || entry.id;
        const share = entry.total > 0 ? entry.value / entry.total : 0, color = entry.id === 'other' ? GRAY : attrOf(entry.id);
        ctx.fillStyle = 'rgba(255,250,238,0.94)'; ctx.fillRect(24, y, 327, 61); jrect(24, y, 327, 61, color, 1.4);
        text((metaPage * per + i + 1) + '. ' + name, 36, y + 20, 12, color, 'left', true);
        text(Math.round(entry.value).toLocaleString() + ' 伤害', 339, y + 20, 11, DARK, 'right');
        ctx.fillStyle = '#e4dfd3'; ctx.fillRect(36, y + 35, 238, 10);
        ctx.fillStyle = color; ctx.fillRect(36, y + 35, Math.max(1, 238 * share), 10);
        text((share * 100).toFixed(1) + '%', 339, y + 45, 11, color, 'right', true);
      });
    }
    if (!shown.length) text(summaryTab === 'skills' ? '本局没有主动技能' : (summaryTab === 'affixes' ? '本局没有选择词条' : (summaryTab === 'damage' ? '本局尚未造成伤害' : '本局没有装备')), W / 2, 310, 12, GRAY, 'center');
    const pg = pager(entries.length, per, 538); drawSummary.pg = pg;
    if (settlement.mode === 'ranked') text('装备经验已入账 · 免装订', W / 2, 585, 10, GRAY, 'center');
    button({ x: 62, y: 602, w: 251, h: 40 }, settlement.mode === 'ranked' ? '完成结算' : '下一步');
  }
  function drawSettlement() {
    if (!settlement) return;
    panel('装备装订', '墨点 +' + settlement.earned);
    text('装备经验已全部入账 · 装订用于继承', W / 2, 84, 13, INK, 'center', true);
    text('基础 ' + settlement.base + '　首次 +' + settlement.firstBonus, W / 2, 108, 11, DARK, 'center');
    text('装订 ' + settlement.selected.length + ' / ' + settlement.slots, W / 2, 130, 11, PURPLE, 'center');
    const per = 3, shown = settlement.found.slice(metaPage * per, metaPage * per + per);
    shown.forEach((eq, i) => {
      const y = 148 + i * 122, def = ITEM_DEFS[eq.key], rarity = RARITY_LIST[eq.rarity], selected = settlement.selected.includes(eq.uid), stats = equipmentBaseStats(eq, settlement.growth);
      ctx.fillStyle = 'rgba(255,250,238,0.94)'; ctx.fillRect(24, y, 327, 116); jrect(24, y, 327, 116, rarity.color, selected ? 2.8 : 1.5);
      text(def.name, 36, y + 23, 13, rarity.color, 'left', true);
      text(rarity.name + '·' + SLOT_NAME[def.slot] + '·' + equipmentLevelText(eq, settlement.growth) + '　攻 +' + stats.atk + '%　生 +' + stats.hp, 36, y + 43, 10, GRAY);
      ctx.font = '10px ' + FONT; ctx.fillStyle = DARK; ctx.textAlign = 'left'; wrap(window.UICopy ? window.UICopy.itemShort(eq.key, eq.rarity) : itemDescription(eq.key, eq.rarity), 36, y + 63, 299, 14, 2);
      text('部位经验 +' + eq.xp + (eq.paper ? ' · 溢出碎纸 +' + eq.paper : ''), 36, y + 102, 10, GRAY);
      text('详情 ›', 250, y + 102, 9, GRAY, 'right');
      button({ x: 263, y: y + 12, w: 74, h: 32 }, selected ? '已装订' : '装订', selected || settlement.selected.length < settlement.slots, selected);
    });
    if (!shown.length) text('本局没有新装备', W / 2, 285, 12, GRAY, 'center');
    const pg = pager(settlement.found.length, per, 526); drawSettlement.pg = pg;
    button({ x: 62, y: 583, w: 251, h: 43 }, '完成结算');
  }
  function testEndRects() { return { retry: { x: 75, y: 292, w: 225, h: 40 }, select: { x: 75, y: 344, w: 225, h: 40 }, home: { x: 75, y: 396, w: 225, h: 40 } }; }
  function drawTestEnd() {
    ctx.fillStyle = 'rgba(255,250,238,0.97)'; ctx.fillRect(45, 170, 285, 292);
    jrect(45, 170, 285, 292, state === 'win' ? INK : RED, 2.5);
    text(state === 'win' ? 'Boss 挑战完成' : 'Boss 挑战失败', W / 2, 218, 23, state === 'win' ? INK : RED, 'center', true);
    text(BOSS_DEFS[(run.bossTestStage || 1) - 1].name + ' · 不计入局外收益', W / 2, 254, 11, GRAY, 'center');
    const r = testEndRects(); button(r.retry, '再次挑战'); button(r.select, '选择其他 Boss'); button(r.home, '返回局外手账');
  }
  function drawMeta() {
    if (state === 'metaHome') drawHome();
    else if (state === 'metaBossChallenge') drawBossChallenge();
    else if (state === 'metaTalents') drawTalents();
    else if (state === 'metaInventory') drawInventory();
    else if (state === 'metaRunSummary') drawSummary();
    else if (state === 'metaSettlement') drawSettlement();
    else if ((state === 'over' || state === 'win') && run && run.mode === 'bossTest') drawTestEnd();
  }
  const baseRender = render;
  render = function() {
    // 胜利直接结算；失败先停在战斗失败页，由玩家点击后确认进入结算。
    if (state === 'win' && run && run.mode !== 'bossTest' && !run.settled) settleRun(true);
    baseRender(); drawMeta();
  };
  function hit(p, r) { return pointInRect(p, r); }
  canvas.addEventListener('pointerdown', e => {
    if (window.UIDetail && window.UIDetail.isOpen) return;
    if (state === 'over' && run && run.mode !== 'bossTest' && !run.settled) {
      e.preventDefault(); e.stopImmediatePropagation(); settleRun(false); return;
    }
    if ((state === 'over' || state === 'win') && run && run.mode === 'bossTest') {
      e.preventDefault(); e.stopImmediatePropagation();
      const p = toLogical(e), r = testEndRects();
      if (hit(p, r.retry)) beginBossTest(run.bossTestStage || 1);
      else if (hit(p, r.select)) openBossChallenge();
      else if (hit(p, r.home)) goHome();
      return;
    }
    if (!['metaHome', 'metaBossChallenge', 'metaTalents', 'metaInventory', 'metaRunSummary', 'metaSettlement'].includes(state)) return;
    e.preventDefault(); e.stopImmediatePropagation(); const p = toLogical(e); uiMessage = '';
    if (state === 'metaHome') {
      const r = homeRects();
      if (resetArmed) {
        if (hit(p, r.resetConfirm)) { storage.remove(C.storageKey); meta = defaults(); save(); goHome(); }
        else resetArmed = false;
        return;
      }
      if (hit(p, r.reset)) resetArmed = true;
      else if (hit(p, r.normal)) beginRun(false);
      else if (hit(p, r.ranked)) beginRun(true);
      else if (hit(p, r.inventory)) { state = 'metaInventory'; metaPage = 0; }
      else if (hit(p, r.talents)) { state = 'metaTalents'; metaPage = 0; }
      else if (hit(p, r.bossChallenge)) openBossChallenge();
      return;
    }
    if (state === 'metaBossChallenge') {
      if (hit(p, backButton())) { goHome(); return; }
      const rects = bossChallengeRects();
      for (let i = 0; i < rects.length; i++) if (hit(p, rects[i])) { beginBossTest(i + 1); return; }
      return;
    }
    if (state === 'metaInventory' && reforgePending) {
      const r = reforgeRects(), eq = reforgePending;
      if (hit(p, r.confirm)) { reforge(eq.key, eq.rarity); reforgePending = null; }
      else if (hit(p, r.cancel)) reforgePending = null;
      return;
    }
    if ((state === 'metaTalents' || state === 'metaInventory') && hit(p, backButton())) { goHome(); return; }
    if (state === 'metaTalents') {
      const tabs = ['basic', 'active', 'ink'];
      for (let i = 0; i < 3; i++) if (hit(p, { x: 24 + i * 111, y: 79, w: 105, h: 34 })) { metaTab = tabs[i]; metaPage = 0; return; }
      const entries = talentEntries(), per = 5, shown = entries.slice(metaPage * per, metaPage * per + per);
      for (let i = 0; i < shown.length; i++) if (hit(p, { x: 269, y: 128 + i * 84 + 22, w: 68, h: 34 })) { upgradeTalent(shown[i].id); return; }
      const pg = drawTalents.pg;
      if (pg && hit(p, pg.prev)) { metaPage = Math.max(0, metaPage - 1); return; }
      if (pg && hit(p, pg.next)) { metaPage = Math.min(pg.pages - 1, metaPage + 1); return; }
      if (hit(p, { x: 119, y: 603, w: 137, h: 32 })) resetTalents();
      return;
    }
    if (state === 'metaInventory') {
      const filters = ['all', ...SLOTS];
      for (let i = 0; i < filters.length; i++) if (hit(p, { x: 17 + i * 57, y: 84, w: 53, h: 31 })) { inventorySlot = filters[i]; metaPage = 0; return; }
      const entries = inventoryEntries(), per = 4, shown = entries.slice(metaPage * per, metaPage * per + per);
      for (let i = 0; i < shown.length; i++) {
        const eq = shown[i], y = 128 + i * 105;
        if (hit(p, { x: 250, y: y + 14, w: 88, h: 31 })) { setInherited(eq.key, eq.rarity); return; }
        if (hit(p, { x: 250, y: y + 53, w: 88, h: 31 })) { reforgePending = { key: eq.key, rarity: eq.rarity }; return; }
        if (hit(p, { x: 24, y, w: 215, h: 96 })) { if (window.UICopy) window.UICopy.itemDetail(eq, ITEM_DEFS[eq.key].slot, meta.equipment); return; }
      }
      const pg = drawInventory.pg;
      if (pg && hit(p, pg.prev)) { metaPage = Math.max(0, metaPage - 1); return; }
      if (pg && hit(p, pg.next)) { metaPage = Math.min(pg.pages - 1, metaPage + 1); return; }
      return;
    }
    if (state === 'metaRunSummary') {
      const tabs = ['skills', 'affixes', 'equipment', 'damage'];
      for (let i = 0; i < 4; i++) if (hit(p, { x: 24 + i * 82, y: 113, w: 78, h: 32 })) { summaryTab = tabs[i]; metaPage = 0; return; }
      const entries = summaryEntries(), per = summaryPerPage(), shown = entries.slice(metaPage * per, metaPage * per + per);
      if (summaryTab !== 'damage') for (let i = 0; i < shown.length; i++) if (hit(p, summaryRect(i))) {
        if (!window.UICopy) return;
        if (summaryTab === 'skills') window.UICopy.skillDetail(shown[i]);
        else if (summaryTab === 'affixes') window.UICopy.affixDetail(shown[i]);
        else window.UICopy.itemDetail(shown[i].eq, shown[i].slot, settlement.growth);
        return;
      }
      const pg = drawSummary.pg;
      if (pg && hit(p, pg.prev)) { metaPage = Math.max(0, metaPage - 1); return; }
      if (pg && hit(p, pg.next)) { metaPage = Math.min(pg.pages - 1, metaPage + 1); return; }
      if (hit(p, { x: 62, y: 602, w: 251, h: 40 })) continueSettlement();
      return;
    }
    if (state === 'metaSettlement') {
      const per = 3, shown = settlement.found.slice(metaPage * per, metaPage * per + per);
      for (let i = 0; i < shown.length; i++) {
        const y = 148 + i * 122;
        if (hit(p, { x: 263, y: y + 12, w: 74, h: 32 })) { toggleSettlement(shown[i].uid); return; }
        if (hit(p, { x: 24, y, w: 230, h: 116 })) { if (window.UICopy) window.UICopy.itemDetail(shown[i], ITEM_DEFS[shown[i].key].slot, settlement.growth); return; }
      }
      const pg = drawSettlement.pg;
      if (pg && hit(p, pg.prev)) { metaPage = Math.max(0, metaPage - 1); return; }
      if (pg && hit(p, pg.next)) { metaPage = Math.min(pg.pages - 1, metaPage + 1); return; }
      if (hit(p, { x: 62, y: 583, w: 251, h: 43 })) finishSettlement();
    }
  }, true);
  window.addEventListener('keydown', e => {
    if (window.UIDetail && window.UIDetail.isOpen) return;
    if (state === 'metaBossChallenge' || state === 'metaTalents' || state === 'metaInventory') { if (e.key === 'Escape') { e.preventDefault(); goHome(); } }
  }, true);

  window.__metaRuntime = {
    beginRun, beginBossTest, openBossChallenge, settleRun, recordEquipment, continueSettlement, finishSettlement, toggleSettlement, upgradeTalent, resetTalents,
    setInherited, reforge, rankMultipliers, rankInfo, applyPlayer, save, goHome,
    get data() { return meta; }, get run() { return run; }, get settlement() { return settlement; },
    get tab() { return metaTab; }, set tab(v) { metaTab = v; metaPage = 0; },
    get summaryTab() { return summaryTab; }, set summaryTab(v) { summaryTab = v; metaPage = 0; },
    resetAll() { storage.remove(C.storageKey); meta = defaults(); save(); goHome(); }
  };
  resetGame(); state = 'metaHome';
})();

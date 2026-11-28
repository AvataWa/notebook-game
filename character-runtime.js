/* 出战角色：选角、五级成长，以及共用战斗规则上的角色变体。 */
(() => {
  'use strict';
  const DEFS = CHARACTER_CONFIG.defs;
  const COLOR_WAVE_SPRITES = {
    straight: { src: 'assets/color-combo/straight.png', fw: 560, fh: 128, frames: 5 },
    crescent: { src: 'assets/color-combo/crescent.png?v=20261128-color-crescent-thin-v2', fw: 560, fh: 560, frames: 5 },
    ring: { src: 'assets/color-combo/ring.png', fw: 384, fh: 384, frames: 7 }
  };
  if (typeof Image !== 'undefined') {
    for (const sprite of Object.values(COLOR_WAVE_SPRITES)) {
      sprite.image = new Image(); sprite.image.src = sprite.src;
    }
  }
  const meta = () => window.__metaRuntime;
  const defOf = id => DEFS.find(c => c.id === id) || DEFS[0];
  const clone = obj => JSON.parse(JSON.stringify(obj));
  const is = id => typeof player !== 'undefined' && player && player.characterId === id;
  const lvl = () => player && player.characterLevel || 1;
  const fresh = () => ({
    extraUsed: false, finalDraft: false, reforgeUsed: false, inReroll: false,
    diveLog: [], echoes: [], echoRefund: 0, echoCasting: false,
    surgeLink: false, overcharge: 0, fullPageT: 0, surgeWaves: [],
    paperCasting: false, paperOverflowReady: 0,
    paperProxyReady: 5, paperProxyPending: false, paperProxyDeck: [], paperProxySerial: 0,
    colorPalette: Object.create(null), colorSlashes: [], colorBursts: [], colorVisuals: [],
    colorEmpower: false, colorFreecast: false, colorSpending: null,
    colorNext: 1, colorComboUntil: 0, colorBuffered: false,
    colorDiveUntil: 0, colorPreciseUntil: 0, colorAutoExitT: 0, colorPreciseStamp: -Infinity,
    colorDashT: 0, colorDashTotal: 0.12, colorDashX: 0, colorDashY: 0,
    colorKillRefundT: -Infinity
  });
  let S = fresh(), pending = null, viewId = meta().data.character || 'draft', hits = [];
  let detailScroll = 0, detailScrollMax = 0, detailDrag = null;
  const detailPanelRect = { x: 20, y: 379, w: 335, h: 176 };

  function selectedDef() { return defOf(meta().data.character); }
  function savedLevel(id) { return meta().data.characters[id] || 1; }
  function makeActive(id, level = 1) { return { id, lvl: level, supports: [], t: 0.3, uc: 0 }; }

  function showInitialSupport(id, tag) {
    const pool = Object.keys(SUPPORTS).filter(s => supportUsable(s, id));
    for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
    cards = pool.slice(0, 3).map(sup => ({ kind: 'support', skill: id, sup, tag, tagColor: PURPLE,
      name: supportName(sup) + ' → ' + SKILL_DEFS[id].name, desc: 'Lv1：' + supDesc(sup, 1) }));
    state = 'levelup'; levelupPickAfter = Date.now() + 500; layoutCards(cards.length);
  }

  function applyRun() {
    const d = selectedDef(), level = savedLevel(d.id);
    S = fresh();
    player.characterId = d.id; player.characterLevel = level;
    player.absorbT = 0; player.surgeCharging = false; player.surgeChargeT = 0; player.surgePointerId = null;
    syncJoystickHome();
    const pool = d.id === 'single' ? CHARACTER_CONFIG.singleStarters.filter(id => SKILL_DEFS[id]) : [];
    const initial = d.id === 'single' ? pool[Math.floor(Math.random() * pool.length)] : d.initial;
    player.actives = [makeActive(initial, d.id === 'single' ? 2 : 1)];
    player.itemRerolls = d.id === 'draft' ? (level >= 3 ? 2 : 1) : 0;
    state = 'play';
    toast(d.name + ' · ' + SKILL_DEFS[initial].name + ' · Lv.' + level);
    if (d.id === 'draft' && level >= 4) showInitialSupport(initial, '[草稿辅助]');
    if (d.id === 'single' && level >= 2) showInitialSupport(initial, '[专精辅助]');
  }

  const baseBeginRun = meta().beginRun;
  meta().beginRun = function(...args) { const result = baseBeginRun(...args); applyRun(); return result; };
  const baseBeginBossTest = meta().beginBossTest;
  meta().beginBossTest = function(...args) { const result = baseBeginBossTest(...args); applyRun(); return result; };

  function requestRun() {
    pending = { kind: 'run' }; viewId = meta().data.character; state = 'metaCharacterSelect'; return true;
  }
  function requestBoss(stage) {
    pending = { kind: 'boss', stage }; viewId = meta().data.character; state = 'metaCharacterSelect'; return true;
  }
  function openCharacters() { pending = null; viewId = meta().data.character; state = 'metaCharacters'; return true; }
  function selectCharacter(id) {
    if (!DEFS.some(c => c.id === id)) return false;
    viewId = id; meta().data.character = id; meta().save(); return true;
  }
  function upgradeCharacter(id) {
    const level = savedLevel(id);
    if (level >= 5) return false;
    const cost = CHARACTER_CONFIG.costs[level - 1];
    if (meta().data.ink < cost) return false;
    meta().data.ink -= cost; meta().data.characters[id] = level + 1; meta().save(); return true;
  }
  function confirmSelection() {
    if (!pending) return false;
    selectCharacter(viewId);
    const task = pending; pending = null;
    return task.kind === 'boss' ? meta().beginBossTest(task.stage) : meta().beginRun();
  }

  function activeCap() { return is('single') ? 1 : MAX_ACTIVES; }
  function supportCap() { return is('single') ? 8 : MAX_SUPPORTS; }
  function levelCap() { return is('single') ? (lvl() >= 5 ? 12 : 10) : MAX_LVL; }
  function extraChoice() {
    if (!is('draft') || lvl() < 2 || S.extraUsed) return false;
    S.extraUsed = true; return true;
  }
  function hasRerolls() { return is('draft'); }
  function allowDiveCasting() { return is('dive'); }
  function triggerCooldown(base, a, sp) {
    return is('single') && lvl() >= 4 && a && a.supports[7] === sp && ['oncrit', 'onkill'].includes(sp.id) ? base * 0.5 : base;
  }
  function canReforge() { return is('single') && lvl() >= 3 && !S.reforgeUsed && player.actives.some(a => a.supports.length); }
  function reforgeSupport() {
    if (!canReforge()) return false;
    const owned = [];
    for (const a of player.actives) for (const sp of a.supports) owned.push({ a, sp });
    const picked = owned[Math.floor(Math.random() * owned.length)];
    const pool = Object.keys(SUPPORTS).filter(id => supportUsable(id, picked.a.id) && !picked.a.supports.some(s => s.id === id));
    if (!pool.length) return false;
    picked.sp.id = pool[Math.floor(Math.random() * pool.length)];
    S.reforgeUsed = true; toast('辅助已重铸 · 等级保留'); return true;
  }

  /* 主动数值：角色减益只作用于本体，残影、纸偶和墨潮联动单独标记。 */
  const baseSkillCalc = skillCalc;
  skillCalc = function(a) {
    const c = baseSkillCalc(a);
    c.hadesSkill = c.hadesSkill || a.id;
    if (is('parry') && a.characterBoost) c.dmg *= 1 + a.characterBoost;
    if (is('parry') && a.characterRad) c.rad *= a.characterRad;
    if (is('dive') && !player.diving && !S.echoCasting) c.dmg *= 0.7;
    if (is('surge') && !S.surgeLink) c.dmg *= 0.75;
    if (is('summon') && !S.paperCasting) c.dmg *= 0.8;
    if (is('colors') && lvl() >= 2 && S.colorEmpower && S.colorSpending === a) c.dmg *= 1.35;
    if (is('single') && lvl() >= 4 && a.supports.length >= 8) {
      const without = baseSkillCalc(Object.assign({}, a, { supports: a.supports.slice(0, 7) }));
      for (const key of Object.keys(c)) {
        if (typeof c[key] === 'number' && typeof without[key] === 'number') c[key] += c[key] - without[key];
      }
    }
    if (is('single') && a.lvl >= 12) {
      const tags = SKILL_TAGS[a.id] || [];
      if (tags.includes('proj')) { c.count += 4; c.cd *= 0.7; }
      if (tags.includes('area')) c.reburst = (c.reburst || 0) + 1.5;
      if (tags.includes('strike')) c.followup = (c.followup || 0) + 1.2;
    }
    return c;
  };

  const baseSpendSkillInk = spendSkillInk;
  spendSkillInk = function(a, cost) {
    if (!is('colors')) return baseSpendSkillInk(a, cost);
    S.colorSpending = a;
    if (lvl() >= 2 && S.colorFreecast) return true;
    return baseSpendSkillInk(a, cost);
  };

  const baseChargeTurf = chargeTurf;
  function chargeColorSurge(amount) {
    if (!(amount > 0) || player.special >= 100) return 0;
    const before = player.special;
    player.special = Math.min(100, player.special + amount); player.turf += player.special - before;
    if (player.special >= 100 && !player.specialAnnounced) {
      player.specialAnnounced = true; toast('墨潮已满！点击「墨潮」立即释放');
    }
    return player.special - before;
  }
  chargeTurf = function(amount) {
    if (is('colors')) return 0; // 四色笔记只允许彩墨斩通过 chargeColorSurge 充能。
    return baseChargeTurf(is('single') ? amount * 0.75 : amount);
  };

  function refreshByParry(precise) {
    const count = precise && lvl() >= 5 ? player.actives.length : (precise ? 2 : 1);
    const targets = player.actives.filter(a => gameTime >= (a.characterRefreshT || 0)).sort((a, b) => b.t - a.t).slice(0, count);
    for (const a of targets) {
      a.t = 0; a.characterBoost = lvl() >= 2 ? 0.75 : 0.5; a.characterKillN = 0; a.characterRefreshT = gameTime + 0.5;
      a.characterRad = lvl() >= 5 && count >= 3 ? 1.2 : 1;
    }
    if (lvl() >= 3 && !precise) for (const a of player.actives) if (!targets.includes(a)) a.t = Math.max(0, a.t - 0.4);
    if (targets.length) floats.push({ x: player.x, y: player.y - 48, txt: precise ? '精准回锋 ×' + targets.length : '回锋 ×' + targets.length, t: 0.75, color: INK, crit: precise });
  }
  const baseChargeParry = chargeParry;
  chargeParry = function(...args) {
    const precise = player.absorbDuration - player.absorbT <= 0.12;
    const result = baseChargeParry(...args);
    if (is('parry')) refreshByParry(precise);
    return result;
  };

  function scheduleDiveEchoes() {
    if (!S.diveLog.length) return;
    const unique = new Set(S.diveLog.map(e => e.a.id)).size;
    const variety = lvl() >= 3 ? 1 + Math.min(4, unique) * 0.1 : 1;
    const mul = (lvl() >= 2 ? 0.7 : 0.6) * variety;
    for (const entry of S.diveLog) {
      S.echoes.push(Object.assign({}, entry, { t: 0.4, mul, second: false }));
      if (lvl() >= 5) S.echoes.push(Object.assign({}, entry, { t: 0.75, mul: 0.25, second: true }));
    }
    S.diveLog = []; S.echoRefund = 0;
  }
  const baseExitDive = exitDive;
  exitDive = function(...args) { const was = player.diving; const result = baseExitDive(...args); if (was && is('dive')) scheduleDiveEchoes(); return result; };

  function castEcho(entry) {
    const x = player.x, y = player.y;
    player.x = entry.x; player.y = entry.y; S.echoCasting = true;
    const c = Object.assign({}, entry.c, { dmg: entry.c.dmg * entry.mul, hadesSkill: entry.a.id });
    if (lvl() >= 2) c.rad *= 1.15;
    fireSkill(entry.a, c);
    S.echoCasting = false; player.x = x; player.y = y;
  }

  function linkedActives(x, y) {
    if (!player.actives.length) return;
    const ox = player.x, oy = player.y;
    if (x !== undefined) { player.x = x; player.y = y; }
    S.surgeLink = true;
    try {
      for (const a of player.actives) {
        const c = skillCalc(a); c.dmg *= (1 + S.overcharge * 0.4) * (lvl() >= 4 ? 1.25 : 1);
        fireSkill(a, c); addSkillStain(a, c, 0.5);
        a.t = BATTLE.activeCooldowns[a.id] * c.cd;
      }
    } finally {
      /* 满蓄三段共用同一次过蓄倍率，第三段结束后再清零。 */
      S.surgeLink = false; player.x = ox; player.y = oy;
    }
  }
  const baseUpdateSurgeCharge = updateInkSurgeCharge;
  updateInkSurgeCharge = function(dt) {
    baseUpdateSurgeCharge(dt);
    if (!is('surge') || lvl() < 3 || !player.surgeCharging) return;
    const base = surgeChargeTime();
    if (player.surgeChargeT >= base) player.surgeChargeT = Math.min(base * 1.5, player.surgeChargeT + dt);
    if (player.surgeChargeT >= base * 1.5) releaseInkSurgeCharge(player.surgePointerId);
  };

  function surgeBaseDamage(full) {
    let damage = BATTLE.surge.damage * player.dmgMul * (1 + player.eqAtk / 100) * (player.metaSurgeMul || 1);
    if (hasAffix('surge', 'surgedamage')) damage *= 1.3;
    if (full && hasAffix('surge', 'fulldamage')) damage *= 1.55;
    if (full && hasAffix('surge', 'inkburst') && player.ink >= 25) damage *= 1.8;
    damage *= 1 + Math.min(5, player.surgePower || 0) * 0.15;
    return damage;
  }
  function castSurgeWave(wave) {
    inkSurgePainting = true; S.surgeDamageMul = wave.mul;
    try {
      novas.push({ x: wave.x, y: wave.y, t: 0.3, max: wave.radius, col: wave.stage === 3 ? DARK : WARN_YELLOW });
      S.colorVisuals.push({ kind: 'overexpose', stage: wave.stage, x: wave.x, y: wave.y, r: wave.radius, t: 0.45, total: 0.45 });
      for (const e of enemies) {
        if (e.dead) continue;
        const d = Math.hypot(e.x - wave.x, e.y - wave.y);
        if (d >= wave.radius + e.r) continue;
        const hitDamage = wave.baseDamage * (hasAffix('surge', 'outerdamage') && d >= wave.radius * 0.7 ? 1.5 : 1);
        if (hasAffix('surge', 'surgeseed')) { e.surgeSeedT = 0.2; e.surgeSeedDamage = hitDamage * wave.mul * 0.35; }
        hurtEnemy(e, hitDamage, 0, wave.x, wave.y, 0, 0, 0, WARN_YELLOW, false, 'surge');
        if (!e.dead) {
          e.surgeSeedT = 0;
          const kb = hasAffix('surge', 'surgeknock') ? 3.52 : 2.2;
          e.kbx *= kb; e.kby *= kb;
          if (wave.full && hasAffix('surge', 'fullstun')) e.stunT = Math.max(e.stunT || 0, e.boss ? 0.15 : 0.6);
          if (hasAffix('surge', 'surgeslow')) e.surgeSlowT = 3;
          if (hasAffix('surge', 'silence') && (isShooter(e) || e.boss)) e.sealT = Math.max(e.sealT || 0, e.boss ? 0.6 : 2);
        }
      }
    } finally { S.surgeDamageMul = 0; inkSurgePainting = false; }
    /* 普通墨潮只联动第三段；满蓄的后续两段也都在各自命中后联动。 */
    if (wave.full || wave.stage === 3) linkedActives(wave.x, wave.y);
    if (wave.stage === 3) {
      S.overcharge = 0;
      if (wave.full && lvl() >= 2) for (const a of player.actives) a.t = Math.max(0, a.t - Math.min(2, wave.hitCount * 0.08));
      if (wave.full && lvl() >= 5) S.fullPageT = 6;
    }
  }
  const baseCastInkSurge = castInkSurge;
  castInkSurge = function(radius, full) {
    if (is('colors')) return castColorSurge();
    if (!is('surge')) return baseCastInkSurge(radius, full);
    const x = player.x, y = player.y, finalRadius = radius * player.radMul;
    const hitCount = full && lvl() >= 2 ? enemies.filter(e => !e.dead && Math.hypot(e.x - x, e.y - y) < finalRadius + e.r).length : 0;
    if (full && lvl() >= 3) S.overcharge = Math.max(0, Math.min(1, player.surgeChargeT / surgeChargeTime() - 1) / 0.5);
    const baseDamage = surgeBaseDamage(full);
    let result;
    S.surgeDamageMul = 0.55;
    try { result = baseCastInkSurge(radius, full); }
    finally { S.surgeDamageMul = 0; }
    if (!result) { S.overcharge = 0; return result; }
    S.colorVisuals.push({ kind: 'overexpose', stage: 1, x, y, r: finalRadius, t: 0.35, total: 0.35 });
    S.surgeWaves.push(
      { x, y, radius: finalRadius * 1.12, baseDamage, mul: 0.45, t: 0.18, stage: 2, full, hitCount },
      { x, y, radius: finalRadius * 1.25, baseDamage, mul: 0.7 * (1 + S.overcharge * 0.4), t: 0.4, stage: 3, full, hitCount }
    );
    if (full) linkedActives(x, y);
    return result;
  };

  const PAPER_XP = [0, 4, 12, 24, 40];
  function paperCap() { return 6; }
  function paperInherit() { return [0.2, 0.25, 0.3, 0.35, 0.4][Math.max(1, Math.min(5, lvl())) - 1]; }
  function paperAttackInterval() { return 0.85 / (lvl() >= 3 ? 1.2 : 1); }
  function paperLevelFromXp(xp) {
    let level = 1;
    for (let i = 1; i < PAPER_XP.length; i++) if (xp >= PAPER_XP[i]) level = i + 1;
    return level;
  }
  function addPaperXp(m, amount) {
    if (!m || !m.characterPaper || !(amount > 0)) return 0;
    const oldLevel = m.paperLvl || 1;
    m.paperXp = Math.min(PAPER_XP[4], (m.paperXp || 0) + amount);
    m.paperLvl = paperLevelFromXp(m.paperXp);
    m.paperWings = m.paperLvl >= 4 ? 6 : (m.paperLvl === 3 ? 4 : (m.paperLvl === 2 ? 2 : 0));
    if (m.paperLvl > oldLevel) {
      const names = ['毛虫', '毛虫', '双翼', '四翼', '六翼', '终稿'];
      novas.push({ x: m.x, y: m.y, t: 0.45, max: 48 + m.paperLvl * 5, col: ALLY, c: { col: ALLY } });
      floats.push({ x: m.x, y: m.y - 30, txt: '羽化 · ' + names[m.paperLvl], t: 0.85, color: ALLY, crit: m.paperLvl >= 4 });
    }
    return amount;
  }
  function paperXpValue(e) { return e && e.boss ? 12 : (e && e.elite ? 6 : 1); }
  function rememberPaperHit(e, m) {
    if (!e || e.dead || !m || !m.characterPaper) return;
    const hits = e.paperHits || (e.paperHits = []);
    const old = hits.find(h => h.m === m);
    if (old) old.t = gameTime;
    else hits.push({ m, t: gameTime });
  }
  function awardPaperParticipants(e, amount) {
    if (!e || !e.paperHits || !(amount > 0)) return;
    for (const hit of e.paperHits) {
      if (gameTime - hit.t <= 6 && minions.includes(hit.m)) addPaperXp(hit.m, amount);
    }
  }
  function paperActive(m, skillId = m.a.id) {
    const source = getActive(skillId) || (m.a.id === skillId ? m.a : makeActive(skillId));
    return Object.assign({}, source, { supports: lvl() >= 5 ? (source.supports || []) : [] });
  }
  function paperCalc(m, mul = 1, skillId = m.a.id) {
    /* 局外等级决定继承强度；来源主动后续升级与辅助也会同步到已有纸偶。 */
    const a = paperActive(m, skillId);
    S.paperCasting = true;
    try {
      const c = skillCalc(a); c.dmg *= paperInherit() * mul; c.paperSource = m; c.hadesSkill = skillId; return c;
    } finally { S.paperCasting = false; }
  }
  function paperProxyCooldown(papers) {
    const lowest = Math.min(...papers.map(m => m.paperLvl || 1));
    return Math.max(1, 6 - lowest) / (lvl() >= 3 ? 1.2 : 1);
  }
  function drawPaperProxySkill(used) {
    const ids = [...new Set(player.actives.map(a => a.id).filter(id => SKILL_DEFS[id]))];
    S.paperProxyDeck = S.paperProxyDeck.filter(id => ids.includes(id));
    if (!S.paperProxyDeck.length) {
      S.paperProxyDeck = ids.slice();
      for (let i = S.paperProxyDeck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [S.paperProxyDeck[i], S.paperProxyDeck[j]] = [S.paperProxyDeck[j], S.paperProxyDeck[i]];
      }
    }
    const available = S.paperProxyDeck.map((id, i) => ({ id, i })).filter(v => !used.includes(v.id));
    if (available.length) {
      const picked = available[Math.floor(Math.random() * available.length)];
      S.paperProxyDeck.splice(picked.i, 1); return picked.id;
    }
    /* 双蝶抽取时，若牌堆只剩本轮已用技能，临时从其他当前主动补抽，保留牌堆供下轮使用。 */
    const extras = ids.filter(id => !used.includes(id));
    return extras.length ? extras[Math.floor(Math.random() * extras.length)] : null;
  }
  function castPaperProxy(m, skillId) {
    const a = paperActive(m, skillId), c = paperCalc(m, 2, skillId);
    if ((m.paperLvl || 1) >= 3) c.rad *= 1.15;
    if ((m.paperLvl || 1) >= 4) c.dmg *= 1.2;
    c.paperProxy = true; m.c = c; m.paperProxyT = 0.45; m.paperProxySkill = skillId;
    m.paperProxyLast = ++S.paperProxySerial;
    const x = player.x, y = player.y;
    player.x = m.x; player.y = m.y;
    try {
      fireSkill(a, c);
      novas.push({ x: m.x, y: m.y, t: 0.28, max: 34, col: c.col || ALLY, c: { col: c.col || ALLY } });
    } finally { player.x = x; player.y = y; }
    return true;
  }
  function triggerPaperProxy() {
    const eligible = minions.filter(m => m.characterPaper && (m.paperLvl || 1) >= 2);
    if (!eligible.length || !player.actives.length || !enemies.some(e => !e.dead)) { S.paperProxyPending = true; return 0; }
    const count = Math.min(lvl() >= 4 ? 2 : 1, eligible.length, player.actives.length), used = [], chosen = [];
    for (let i = 0; i < count; i++) {
      const skillId = drawPaperProxySkill(used); if (!skillId) break;
      const candidates = eligible.filter(m => !chosen.some(v => v.m === m));
      candidates.sort((a, b) => (b.a.id === skillId) - (a.a.id === skillId) || (b.paperLvl || 1) - (a.paperLvl || 1) || (a.paperProxyLast || 0) - (b.paperProxyLast || 0));
      const m = candidates[0]; if (!m) break;
      castPaperProxy(m, skillId); chosen.push({ m, skillId }); used.push(skillId);
    }
    if (!chosen.length) { S.paperProxyPending = true; return 0; }
    S.paperProxyReady = paperProxyCooldown(chosen.map(v => v.m)); S.paperProxyPending = false;
    return chosen.length;
  }
  function updatePaperProxy(dt) {
    for (const m of minions) if (m.characterPaper) m.paperProxyT = Math.max(0, (m.paperProxyT || 0) - dt);
    S.paperProxyReady -= dt;
    if (S.paperProxyReady <= 0) triggerPaperProxy();
  }
  function pushPaperLaser(m, tgt, mul = 1, mode = '') {
    const c = paperCalc(m, mul); m.c = c;
    // 激光继承伤害的命中类辅助；接力不再触发接力，同调也不再递归触发同调。
    const laserC = Object.assign({}, c, {
      strike: true, sdmg: (c.sdmg || 0) + (c.bdmg || 0), scrit: (c.scrit || 0) + (c.bcrit || 0)
    });
    lightnings.push({ x1: m.x, y1: m.y - 3, x2: tgt.x, y2: tgt.y, t: 0.28, delay: 0, prog: 0,
      tgt, dmg: 12 * c.dmg, c: laserC, col: c.col, paperLaser: true, paperRelay: mode === 'relay', paperSync: mode === 'sync' });
    /* 局外四级：已进化来源主动以纸偶激光版触发，不递归生成新纸偶或联动。 */
    const source = getActive(m.a.id) || m.a;
    if (lvl() >= 4 && source.lvl >= 5) {
      if (m.a.id === 'chainclip') {
        let other = null, best = 190;
        for (const e of enemies) {
          if (e.dead || e === tgt) continue;
          const d = Math.hypot(e.x - tgt.x, e.y - tgt.y);
          if (d < best) { best = d; other = e; }
        }
        if (other) lightnings.push({ x1: tgt.x, y1: tgt.y, x2: other.x, y2: other.y, t: 0.24, delay: 0.06, prog: 0,
          tgt: other, dmg: 12 * c.dmg * 0.4, c: laserC, col: c.col, paperLaser: true, paperEvolutionDerived: true });
      } else if (m.a.id === 'ballista') {
        for (const side of [-1, 1]) lightnings.push({ x1: m.x + side * 5, y1: m.y - 6, x2: tgt.x, y2: tgt.y, t: 0.24, delay: 0.06, prog: 0,
          tgt, dmg: 12 * c.dmg * 0.5, c: laserC, col: c.col, paperLaser: true, paperEvolutionDerived: true });
      } else if (m.a.id === 'inkrain' && window.EvolutionRuntime) {
        EvolutionRuntime.addPuddle({ x: tgt.x, y: tgt.y, r: 38 * (c.rad || 1), dmg: 12 * c.dmg, c: laserC });
      }
    }
    return c;
  }
  function spawnPaper(e, xp = paperXpValue(e)) {
    const papers = minions.filter(m => m.characterPaper), cap = paperCap();
    if (papers.length >= cap) {
      /* 固定六只：溢出仍刷新齐射，并把本次成长经验交给最落后的成员。 */
      if (gameTime >= S.paperOverflowReady) {
        for (const p of papers) p.atkCd = 0;
        S.paperOverflowReady = gameTime + 0.5;
      }
      const lowest = papers.slice().sort((a, b) => (a.paperLvl || 1) - (b.paperLvl || 1) || (a.paperXp || 0) - (b.paperXp || 0))[0];
      addPaperXp(lowest, xp);
      return;
    }
    const id = SKILL_DEFS[e.characterKillSkill] ? e.characterKillSkill : selectedDef().initial;
    const source = getActive(id) || makeActive(id), a = makeActive(id, source.lvl);
    const m = { x: e.x, y: e.y, t: Infinity, atkCd: 0.4, walk: 0, rad: 1, c: { col: ALLY },
      characterPaper: true, paperLvl: 1, paperXp: 0, paperWings: 0, a, king: false, orbitR: 60, orbitA: Math.random() * Math.PI * 2, paperTarget: null,
      paperLink: null, paperLinkLead: false, paperLineNext: 0, paperRelayReady: 0, paperSyncGroup: -1, paperSyncLead: false,
      paperProxyT: 0, paperProxySkill: '', paperProxyLast: 0 };
    minions.push(m); novas.push({ x: e.x, y: e.y, t: 0.3, max: 58, col: ALLY, c: { col: ALLY } });
  }
  function castPaper(m, target) {
    if (!m || !m.a || !m.a.id) return false;
    const tgt = target && !target.dead && enemies.includes(target) ? target : nearestEnemy(m.x, m.y, 480);
    if (!tgt) return false;
    const sync = (m.paperLvl || 1) >= 4 && m.paperSyncGroup >= 0;
    if (sync) {
      const group = minions.filter(p => p.characterPaper && (p.paperLvl || 1) >= 4 && p.paperSyncGroup === m.paperSyncGroup);
      for (const p of group) {
        pushPaperLaser(p, tgt, 1.2, 'sync');
        p.atkCd = paperAttackInterval();
      }
    } else pushPaperLaser(m, tgt);
    /* 牵线双方至少一只四翼即可接力，每组共享一秒冷却。 */
    const partner = m.paperLink;
    if (partner && partner.characterPaper && ((m.paperLvl || 1) >= 3 || (partner.paperLvl || 1) >= 3) && gameTime >= (m.paperRelayReady || 0)) {
      pushPaperLaser(partner, tgt, 0.4, 'relay');
      m.paperRelayReady = partner.paperRelayReady = gameTime + 1;
    }
    return true;
  }
  function updatePaperNetwork() {
    const papers = minions.filter(m => m.characterPaper);
    for (const m of papers) {
      m.paperLink = null; m.paperLinkLead = false; m.paperSyncGroup = -1; m.paperSyncLead = false;
    }
    /* 个体双翼牵线：毛虫不参与，按稳定顺序就近配对。 */
    for (let i = 0; i < papers.length; i++) {
      const m = papers[i]; if (m.paperLink || (m.paperLvl || 1) < 2) continue;
      let best = null, bestDist = 160;
      for (let j = i + 1; j < papers.length; j++) {
        const q = papers[j]; if (q.paperLink || (q.paperLvl || 1) < 2) continue;
        const d = Math.hypot(q.x - m.x, q.y - m.y);
        if (d <= bestDist) { best = q; bestDist = d; }
      }
      if (!best) continue;
      m.paperLink = best; best.paperLink = m; m.paperLinkLead = true;
      if (gameTime >= (m.paperLineNext || 0)) {
        const c = paperCalc(m, 0.15), vx = best.x - m.x, vy = best.y - m.y, len2 = vx * vx + vy * vy || 1;
        for (const e of enemies) {
          if (e.dead) continue;
          const u = Math.max(0, Math.min(1, ((e.x - m.x) * vx + (e.y - m.y) * vy) / len2));
          const dx = e.x - (m.x + vx * u), dy = e.y - (m.y + vy * u);
          if (Math.hypot(dx, dy) <= e.r + 3) hurtEnemy(e, 12 * c.dmg, 0, (m.x + best.x) / 2, (m.y + best.y) / 2, 0, 0, 0, c.col || ALLY, false, m.a.id, m);
        }
        m.paperLineNext = best.paperLineNext = gameTime + 0.5;
      }
    }
    /* 个体六翼同调：三只同技能六翼组成小组，不消耗或合并个体。 */
    let group = 0;
    for (const m of papers) {
      if (m.paperSyncGroup >= 0 || (m.paperLvl || 1) < 4) continue;
      const near = papers.filter(p => p.paperSyncGroup < 0 && (p.paperLvl || 1) >= 4 && p.a.id === m.a.id && Math.hypot(p.x - m.x, p.y - m.y) <= 190);
      if (near.length < 3) continue;
      near.slice(0, 3).forEach((p, i) => { p.paperSyncGroup = group; p.paperSyncLead = i === 0; });
      group++;
    }
  }

  const COLOR_KEYS = ['phys', 'fire', 'ice', 'thunder'];
  const COLOR_SLASH_DAMAGE = [40, 50, 60, 70, 90], COLOR_SLASH_INK = [2, 5, 8, 11, 15];
  const COLOR_SLASH_CHARGE = [6, 20, 30, 40, 55];
  const COLOR_CHAIN_WINDOW = 0.3;
  const COLOR_COMBO = [
    { damage: 1, resource: 0.20, range: 145, halfArc: 1.35, recovery: 0.6, wave: 'straight', duration: 0.38, tilt: 0 },
    { damage: 1.5, resource: 0.20, range: 145, halfArc: 1.35, recovery: 0.6, wave: 'crescent', duration: 0.38, tilt: 0 },
    { damage: 1.5, resource: 0.25, range: 150, halfArc: 1.15, recovery: 0.6, wave: 'crescentMirror', duration: 0.42, tilt: 0 },
    { damage: 4, resource: 0.35, range: 155, halfArc: Math.PI, recovery: 0.8, wave: 'ring', duration: 0.52, tilt: 0 }
  ];
  let colorVisualSerial = 0;
  function queueColorVisual(stage, precise, colors, aim) {
    const spec = COLOR_COMBO[stage - 1], total = spec.duration;
    S.colorVisuals.push({ kind: 'combo', wave: spec.wave, stage, x: player.x, y: player.y, a: aim,
      r: spec.range * player.radMul * (hasAffix('absorb', 'wideabsorb') ? 1.2 : 1),
      colors: colors || COLOR_KEYS.filter(key => S.colorPalette[key]), precise, tilt: spec.tilt,
      seed: (++colorVisualSerial * 997) >>> 0, t: total, total });
  }
  function colorCount(e) {
    if (!e || !e.colorTags) return 0;
    let count = 0;
    for (const key of COLOR_KEYS) if ((e.colorTags[key] || 0) > gameTime) count++;
    return count;
  }
  function onColorHit(skillId, e) {
    const attr = SKILL_ATTR[skillId];
    if (!attr || !getActive(skillId) || !e || e.dead) return;
    const tags = e.colorTags || (e.colorTags = Object.create(null));
    tags[attr] = gameTime + 6 + (hasAffix('absorb', 'longabsorb') ? 3 : 0);
  }
  function colorPriority(a, b) {
    const dc = colorCount(b) - colorCount(a); if (dc) return dc;
    if (hasAffix('absorb', 'reflecthoming')) {
      const dr = (b.boss || b.elite ? 1 : 0) - (a.boss || a.elite ? 1 : 0); if (dr) return dr;
    }
    return Math.hypot(a.x - player.x, a.y - player.y) - Math.hypot(b.x - player.x, b.y - player.y);
  }
  function colorSlashAim() {
    let nearest = null, best = Infinity;
    for (const e of enemies) {
      if (e.dead) continue;
      const distance = Math.hypot(e.x - player.x, e.y - player.y);
      if (distance < best) { best = distance; nearest = e; }
    }
    if (nearest) return Math.atan2(nearest.y - player.y, nearest.x - player.x);
    for (let i = S.colorVisuals.length - 1; i >= 0; i--) if (S.colorVisuals[i].kind === 'combo') return S.colorVisuals[i].a;
    return 0;
  }
  function colorSlashTargets(stage, aim) {
    const spec = COLOR_COMBO[stage - 1];
    const range = spec.range * player.radMul * (hasAffix('absorb', 'wideabsorb') ? 1.2 : 1);
    return enemies.filter(e => {
      if (e.dead || Math.hypot(e.x - player.x, e.y - player.y) > range + e.r) return false;
      if (stage === 4) return true;
      const angle = Math.atan2(e.y - player.y, e.x - player.x);
      return Math.abs(Math.atan2(Math.sin(angle - aim), Math.cos(angle - aim))) <= spec.halfArc;
    }).sort(colorPriority);
  }
  function colorSlashTarget(e, stage, damageMul, resourceMul, primary, finale, aim) {
    if (!e || e.dead) return 0;
    const colors = COLOR_KEYS.filter(key => e.colorTags && e.colorTags[key] > gameTime), count = colors.length;
    e.colorTags = Object.create(null);
    const spec = COLOR_COMBO[stage - 1];
    const power = player.dmgMul * (1 + player.eqAtk / 100);
    let damage = COLOR_SLASH_DAMAGE[count] * power * spec.damage * damageMul * (finale ? 2.5 : 1);
    if (hasAffix('absorb', 'reflectdamage')) damage *= 1.3;
    if (hasAffix('absorb', 'reflecthoming') && (e.boss || e.elite)) damage *= 1.25;
    const wasDead = e.dead, angle = Math.atan2(e.y - player.y, e.x - player.x);
    const a = stage === 3 ? aim + 0.72 : angle + (stage === 2 ? 0.3 : 0);
    S.colorSlashes.push({ x: e.x, y: e.y, a, length: e.r * 2 + 58, t: 0.28, total: 0.32,
      colors: colors.length ? colors : ['none'] });
    // 每段只结算一次命中；第三段镜像刀波也不再拆成两次伤害。
    hurtEnemy(e, damage, 0, player.x, player.y, 0, -1, 0, count ? PURPLE : INK, false, 'other');
    if (!wasDead && e.dead && lvl() >= 3 && gameTime >= S.colorKillRefundT) {
      S.colorKillRefundT = gameTime + 1; player.diveCd = Math.max(0, player.diveCd * 0.3);
      floats.push({ x: player.x, y: player.y - 50, txt: '彩墨回收 · 潜墨返还', t: 0.7, color: PURPLE, weak: true });
    }
    if (count > 0) {
      const radius = (38 + count * 8) * (hasAffix('absorb', 'surgegrowth') ? 1.2 : 1);
      S.colorBursts.push({ x: e.x, y: e.y, r: radius, t: 0.35, total: 0.35, colors });
      if (resourceMul > 0) {
        const blastDamage = 10 * count * power * resourceMul * (hasAffix('absorb', 'surgegrowth') ? 1.5 : 1);
        for (const other of enemies) {
          if (other.dead || other === e || Math.hypot(other.x - e.x, other.y - e.y) >= radius + other.r) continue;
          hurtEnemy(other, blastDamage, 0, e.x, e.y, 0, -1, 0, PURPLE, true, 'other');
        }
      }
    }
    const ink = refundInk(COLOR_SLASH_INK[count] * resourceMul * (hasAffix('absorb', 'gaincap') ? 1.5 : 1), e.x, e.y, '彩墨斩');
    if (ink > 0) addPlayerInkFloat(ink, PURPLE);
    chargeColorSurge(COLOR_SLASH_CHARGE[count] * resourceMul);
    for (const key of colors) S.colorPalette[key] = true;
    return count;
  }
  function resetColorCombo() {
    S.colorNext = 1; S.colorComboUntil = 0; S.colorBuffered = false;
  }
  function colorMovement(x, y) {
    if (!is('colors')) return { x, y };
    const moving = Math.hypot(x, y) > 0.1;
    // 每段攻击只锁定前 0.1 秒；后摇结束后的 0.3 秒接续窗口内，实际移动仍会收笔。
    if (moving && player.absorbCd <= 0 && S.colorComboUntil) resetColorCombo();
    if (gameTime < (player.colorMoveUnlockT || 0) && !player.diving) return { x: 0, y: 0 };
    return { x, y };
  }
  function castColorSlash(fromBuffer = false) {
    if (state !== 'play') return false;
    if (!fromBuffer && player.absorbCd > 0) {
      // 只缓存后摇末尾 0.15 秒内的下一次输入，不允许连点越过动作恢复。
      if (player.absorbCd <= 0.15) S.colorBuffered = true;
      return S.colorBuffered;
    }
    S.colorBuffered = false;
    if (S.colorComboUntil && gameTime > S.colorComboUntil) resetColorCombo();
    const precise = S.colorPreciseUntil > 0 && gameTime <= S.colorPreciseUntil;
    const dived = !precise && S.colorDiveUntil > 0 && gameTime <= S.colorDiveUntil;
    const stage = precise ? 4 : (dived ? 2 : S.colorNext);
    if (precise) { S.colorPreciseUntil = 0; S.colorDiveUntil = 0; }
    else if (dived) S.colorDiveUntil = 0;
    if ((precise || dived) && player.diving) exitDive();

    const spec = COLOR_COMBO[stage - 1], aim = colorSlashAim();
    player.absorbT = 0; player.absorbRadius = 0; // 彩墨斩永不进入弹反判定。
    player.colorMoveUnlockT = gameTime + 0.1;
    player.absorbCd = spec.recovery * player.cdMul / (hasAffix('absorb', 'fastabsorb') ? 1.2 : 1);
    S.colorNext = stage === 4 ? 1 : stage + 1;
    S.colorComboUntil = stage === 4 ? 0 : gameTime + player.absorbCd + COLOR_CHAIN_WINDOW;
    const hits = colorSlashTargets(stage, aim);
    // 空放也出招、推进段数和进入后摇，但不生成任何资源或连携。
    if (!hits.length) {
      queueColorVisual(stage, precise, [], aim);
      return true;
    }

    const primary = hits[0], primaryCount = colorCount(primary);
    const targets = hits.map((e, i) => ({ e, damage: 1, resource: i === 0 ? spec.resource : 0, primary: i === 0 }));
    if (hasAffix('absorb', 'reflectsplit') && hits.length > 1) {
      // 分采把次优目标也提升为主采；其余范围命中仍只贡献颜色。
      targets[1].damage = 0.6; targets[1].resource = spec.resource * 0.5; targets[1].primary = true;
    }
    if (lvl() >= 4 && primaryCount === 4) {
      const extras = enemies.filter(e => !e.dead && !targets.some(t => t.e === e) && colorCount(e) > 0 && Math.hypot(e.x - primary.x, e.y - primary.y) <= 240 + e.r)
        .sort(colorPriority).slice(0, 3);
      for (const e of extras) targets.push({ e, damage: 0.6, resource: 0, primary: false });
    }
    const finale = stage === 4 && lvl() >= 5 && primaryCount === 4;
    let four = false;
    for (const entry of targets) if (colorSlashTarget(entry.e, stage, entry.damage, entry.resource, entry.primary, finale, aim) === 4) four = true;
    if (lvl() >= 2) { S.colorEmpower = true; S.colorFreecast = four; }
    if (four) floats.push({ x: primary.x, y: primary.y - primary.r - 24,
      txt: finale ? '四色终式 · 环斩 ×2.5！' : '四色彩墨斩！', t: 0.8, color: PURPLE, crit: true });
    queueColorVisual(stage, precise, undefined, aim);
    if (window.__equipmentRework && window.__equipmentRework.onColorSlash) window.__equipmentRework.onColorSlash(primary);
    if (window.__triggerSupport) window.__triggerSupport.trigger('absorb');
    return true;
  }
  const COLOR_DIVE_DASH_DISTANCE = 96;
  const baseColorEnterDive = enterDive;
  enterDive = function(...args) {
    const result = baseColorEnterDive(...args);
    if (is('colors') && player.diving) {
      S.colorAutoExitT = 0.3; S.colorDiveUntil = gameTime + 1; S.colorPreciseUntil = 0;
      S.colorPreciseStamp = player.preciseDiveSuccessT === undefined ? -Infinity : player.preciseDiveSuccessT;
      let dx = 0, dy = 0;
      if (joy.active) { dx = joy.dx; dy = joy.dy; }
      else {
        if (keys['d'] || keys['arrowright']) dx += 1;
        if (keys['a'] || keys['arrowleft']) dx -= 1;
        if (keys['s'] || keys['arrowdown']) dy += 1;
        if (keys['w'] || keys['arrowup']) dy -= 1;
      }
      const length = Math.hypot(dx, dy);
      if (length > 0.1) { dx /= length; dy /= length; }
      else { dx = Math.cos(player.faceA); dy = Math.sin(player.faceA); }
      S.colorDashX = dx; S.colorDashY = dy; S.colorDashT = S.colorDashTotal;
    }
    return result;
  };
  const baseCastAbsorb = castAbsorb;
  castAbsorb = function() {
    if (is('colors')) return castColorSlash();
    return baseCastAbsorb();
  };

  function castColorSurge() {
    if (state !== 'play') return false;
    if (player.special < 100) { toast('墨潮还未充满，用彩墨斩采集色签'); return false; }
    const x = player.x, y = player.y, colors = COLOR_KEYS.filter(key => S.colorPalette[key]);
    S.colorPalette = Object.create(null);
    player.special = 0; player.specialAnnounced = false; player.surgeCharging = false; player.surgeChargeT = 0; player.surgePointerId = null;
    const radius = BATTLE.surge.radius * player.radMul * 1.3 * (hasAffix('surge', 'surgewide') ? 1.18 : 1);
    let power = player.dmgMul * (1 + player.eqAtk / 100) * (player.metaSurgeMul || 1);
    if (hasAffix('surge', 'surgedamage')) power *= 1.3;
    const direct = colors.length ? colors.reduce((sum, key) => sum + ({ phys: 100, fire: 55, ice: 45, thunder: 70 })[key], 0) + (colors.length === 4 ? 35 : 0) : 55;
    inkSurgePainting = true;
    try {
      for (let i = 0; i < 3; i++) S.colorVisuals.push({
        kind: 'colorSurgeEllipse', wave: 'ring', x, y, r: radius * (0.88 + i * 0.06), colors,
        t: 0.24, total: 0.24, delay: i * 0.085, a: i * Math.PI / 3, seed: (++colorVisualSerial * 997) >>> 0
      });
      shakeT = Math.max(shakeT, colors.length === 4 ? 0.5 : 0.3);
      const hit = [];
      for (const e of enemies) {
        if (e.dead) continue;
        const d = Math.hypot(e.x - x, e.y - y); if (d >= radius + e.r) continue;
        let damage = direct * power;
        if (hasAffix('surge', 'outerdamage') && d >= radius * 0.7) damage *= 1.5;
        if (hasAffix('surge', 'surgeseed')) { e.surgeSeedT = 0.2; e.surgeSeedDamage = damage * 0.35; }
        const burn = colors.includes('fire') ? 25 * power : 0;
        hurtEnemy(e, damage, burn, x, y, 0, 0, 0, colors.length ? PURPLE : GRAY, false, 'surge');
        hit.push(e);
        if (!e.dead) {
          e.surgeSeedT = 0;
          e.kbx *= colors.includes('phys') ? 4.2 : 2.2; e.kby *= colors.includes('phys') ? 4.2 : 2.2;
          if (colors.includes('ice')) {
            e.slowT = Math.max(e.slowT || 0, 2.5); e.colorSlowT = Math.max(e.colorSlowT || 0, 2.5);
            if (!e.boss) e.stunT = Math.max(e.stunT || 0, 0.5);
          }
          if (hasAffix('surge', 'surgeslow')) e.surgeSlowT = 3;
          if (hasAffix('surge', 'silence') && (isShooter(e) || e.boss)) e.sealT = Math.max(e.sealT || 0, e.boss ? 0.6 : 2);
        }
      }
      if (colors.includes('thunder')) {
        const chained = new Set();
        for (let i = 0; i < 4; i++) {
          let next = null, best = Infinity;
          for (const e of enemies) {
            if (e.dead || chained.has(e)) continue;
            const d = Math.min(...hit.filter(h => !h.dead).map(h => Math.hypot(e.x - h.x, e.y - h.y)), Math.hypot(e.x - x, e.y - y));
            if (d < best && d <= 300) { best = d; next = e; }
          }
          if (!next) break;
          chained.add(next); lightnings.push({ x1: x, y1: y, x2: next.x, y2: next.y, t: 0.22, delay: 0, prog: 0, tgt: next, dmg: 0, c: { col: ATTR_COLOR.thunder }, col: ATTR_COLOR.thunder, colorOnly: true });
          hurtEnemy(next, 30 * power, 0, x, y, 0, -1, 0, ATTR_COLOR.thunder, true, 'other');
        }
      }
      if (hasAffix('surge', 'clearbullets')) for (const eb of ebullets) if (Math.hypot(eb.x - x, eb.y - y) < radius) eb.life = 0;
      if (hasAffix('surge', 'surgeprojectiles')) for (let i = 0; i < 8; i++) fireBullet(x, y, i / 8 * Math.PI * 2, 260, direct * power * 0.45, 'surge', { life: 1.2, col: PURPLE });
      if (hasAffix('surge', 'washink')) {
        const covered = convertGrayDisk(x, y, radius), gained = refundInk(Math.min(15, covered / 80), x, y - 30, '洗地');
        if (gained > 0) addPlayerInkFloat(gained, PURPLE);
        let longest = null; for (const a of player.actives) if (!longest || a.t > longest.t) longest = a;
        if (longest) longest.t = Math.max(0, longest.t - 1);
      }
      addInkStain(x, y, 28, radius, colors.length ? PURPLE : GRAY, false, false);
    } finally { inkSurgePainting = false; }
    player.surgeGrowth = 0; player.surgePower = 0;
    if (player.diving && !hasAffix('dive', 'divecast')) exitDive();
    if (window.__equipmentRework && window.__equipmentRework.onColorSurge) window.__equipmentRework.onColorSurge(x, y, radius);
    if (window.__triggerSupport) window.__triggerSupport.trigger('surge');
    floats.push({ x, y: y - 52, txt: colors.length ? colors.length + ' 色墨潮！' : '无色墨潮', t: 0.85, color: colors.length ? PURPLE : GRAY, crit: colors.length === 4 });
    return true;
  }
  const baseStartInkSurgeCharge = startInkSurgeCharge;
  startInkSurgeCharge = function(pointerId = null) {
    if (is('colors')) return castColorSurge();
    return baseStartInkSurgeCharge(pointerId);
  };
  const baseReleaseInkSurgeCharge = releaseInkSurgeCharge;
  releaseInkSurgeCharge = function(pointerId = null) {
    if (is('colors')) return false;
    return baseReleaseInkSurgeCharge(pointerId);
  };

  const baseUpdateSkills = updateSkills;
  updateSkills = function(dt) {
    if (is('parry')) dt *= 0.6;
    if (is('surge') && S.fullPageT > 0) dt *= 2;
    return baseUpdateSkills(dt);
  };

  function afterCast(a) {
    if (is('dive') && player.diving && !S.echoCasting) {
      S.diveLog.push({ x: player.x, y: player.y, a: clone(a), c: Object.assign({}, skillCalc(a)) });
    }
    if (is('colors')) { S.colorEmpower = false; S.colorFreecast = false; S.colorSpending = null; }
    if (a.characterBoost) { delete a.characterBoost; delete a.characterRad; }
  }

  const baseHurtEnemy = hurtEnemy;
  hurtEnemy = function(e, dmg, ...rest) {
    const skillId = rest[8], paperSource = rest[9], paperProxy = rest[10];
    if (is('summon')) {
      e.characterPaperProxyKill = !!paperProxy;
      if (paperSource) rememberPaperHit(e, paperSource);
    }
    if (is('surge') && skillId === 'surge' && S.surgeDamageMul > 0) dmg *= S.surgeDamageMul;
    if (skillId && getActive(skillId)) {
      e.characterKillSkill = skillId;
      const a = getActive(skillId);
      if (a && a.characterBoost) e.characterParrySkill = skillId;
    }
    const result = baseHurtEnemy(e, dmg, ...rest);
    if (is('summon') && e.boss && !e.dead) {
      const oldStage = e.characterPaperStage || 0;
      let stage = oldStage;
      while (stage < 3 && e.hp / e.maxhp <= 0.75 - stage * 0.25) {
        stage++; e.characterPaperStage = stage;
        if (!paperProxy) spawnPaper(e, 4);
      }
      if (stage > oldStage) awardPaperParticipants(e, 4 * (stage - oldStage));
    }
    if (is('parry') && lvl() >= 4 && e.dead && e.characterParrySkill) {
      const a = getActive(e.characterParrySkill);
      if (a && (a.characterKillN || 0) < 4) { a.characterKillN = (a.characterKillN || 0) + 1; player.absorbCd = Math.max(0, player.absorbCd - 0.15); }
    }
    if (is('surge') && lvl() >= 5 && S.fullPageT > 0 && skillId && getActive(skillId) && gameTime >= (e.characterFullPageT || 0)) {
      e.characterFullPageT = gameTime + 0.25; addInkStain(e.x, e.y, 0.7, 16, trailColorOf(skillId), false, true);
    }
    if (is('colors') && skillId) onColorHit(skillId, e);
    return result;
  };
  const baseKillEnemy = killEnemy;
  killEnemy = function(e) {
    const was = e.dead, result = baseKillEnemy(e);
    if (!was && e.dead) {
      if (is('summon')) {
        awardPaperParticipants(e, paperXpValue(e));
        if (!e.characterPaperProxyKill && (e.boss || e.elite || Math.random() < 0.1)) spawnPaper(e);
      }
      if (is('dive') && lvl() >= 4 && S.echoCasting && S.echoRefund < 10) { S.echoRefund += 2; refundInk(2, player.x, player.y - 30, '残影'); }
    }
    return result;
  };

  const baseUpdate = update;
  update = function(dt) {
    S.fullPageT = Math.max(0, S.fullPageT - dt);
    for (const echo of S.echoes) echo.t -= dt;
    const ready = S.echoes.filter(echo => echo.t <= 0); S.echoes = S.echoes.filter(echo => echo.t > 0);
    for (const echo of ready) castEcho(echo);
    if (is('surge') && S.surgeWaves.length) {
      for (const wave of S.surgeWaves) wave.t -= dt;
      const waves = S.surgeWaves.filter(wave => wave.t <= 0); S.surgeWaves = S.surgeWaves.filter(wave => wave.t > 0);
      for (const wave of waves) castSurgeWave(wave);
    }
    if (is('colors')) {
      player.absorbT = 0; player.surgeCharging = false; player.surgeChargeT = 0;
      if (player.diving && S.colorDashT > 0) {
        const step = Math.min(dt, S.colorDashT), distance = COLOR_DIVE_DASH_DISTANCE * step / S.colorDashTotal;
        player.x = clampW(player.x + S.colorDashX * distance, 14);
        player.y = clampH(player.y + S.colorDashY * distance, 14);
        S.colorDashT = Math.max(0, S.colorDashT - step);
      }
      if (player.diving && S.colorAutoExitT > 0) {
        S.colorAutoExitT = Math.max(0, S.colorAutoExitT - dt);
        if (S.colorAutoExitT === 0) exitDive();
      }
      const preciseStamp = player.preciseDiveSuccessT;
      if (preciseStamp !== undefined && preciseStamp > S.colorPreciseStamp) {
        S.colorPreciseStamp = preciseStamp; S.colorPreciseUntil = gameTime + 1;
      }
      if (S.colorComboUntil && gameTime > S.colorComboUntil) { S.colorNext = 1; S.colorComboUntil = 0; }
      if (S.colorBuffered && player.absorbCd <= 0) castColorSlash(true);
      for (const e of enemies) {
        e.colorSlowT = Math.max(0, (e.colorSlowT || 0) - dt);
        if (e.colorTags) for (const key of COLOR_KEYS) if (e.colorTags[key] <= gameTime) delete e.colorTags[key];
      }
    }
    for (const list of [S.colorSlashes, S.colorBursts, S.colorVisuals]) {
      for (const effect of list) {
        if (effect.kind === 'colorSurgeEllipse') { effect.x = player.x; effect.y = player.y; }
        if (effect.delay > 0) { effect.delay = Math.max(0, effect.delay - dt); continue; }
        effect.t -= dt;
      }
      for (let i = list.length - 1; i >= 0; i--) if (list[i].t <= 0) list.splice(i, 1);
    }
    if (is('summon')) { updatePaperProxy(dt); updatePaperNetwork(); }
    return baseUpdate(dt);
  };

  const baseApplyOption = applyOption;
  applyOption = function(i) {
    const chosen = cards[i], result = baseApplyOption(i);
    if (is('draft') && lvl() >= 5 && !S.finalDraft && chosen && chosen.kind === 'active+') {
      const a = getActive(chosen.skill);
      if (a && a.lvl >= MAX_LVL) { S.finalDraft = true; buildOptions(); state = 'levelup'; levelupPickAfter = Date.now() + 500; }
    }
    return result;
  };

  /* 角色页面：手机与桌面共用交互，主界面和每次开局使用同一组件。 */
  function text(txt, x, y, size = 13, color = DARK, align = 'left', bold = false, maxWidth) {
    const fontSize = isDesktopLayout() ? Math.round(size * 1.25) : size;
    ctx.fillStyle = color; ctx.textAlign = align; ctx.font = (bold ? 'bold ' : '') + fontSize + 'px ' + FONT; ctx.fillText(String(txt), x, y, maxWidth);
  }
  function wrapText(txt, x, y, width, lineHeight = 17, maxLines = 2) {
    const lines = [], size = parseFloat(ctx.font) || 13; let line = '';
    for (const ch of String(txt || '')) { if (line && ctx.measureText(line + ch).width > width) { lines.push(line); line = ch; } else line += ch; }
    if (line) lines.push(line); lines.slice(0, maxLines).forEach((s, i) => text(s, x, y + i * lineHeight, size));
    return lines.length;
  }
  function button(rect, label, action, enabled = true, active = false, color = INK) {
    ctx.fillStyle = active ? 'rgba(205,222,248,0.98)' : 'rgba(255,250,238,0.96)'; ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    jrect(rect.x, rect.y, rect.w, rect.h, enabled ? color : GRAY, active ? 2.6 : 1.6);
    text(label, rect.x + rect.w / 2, rect.y + rect.h / 2 + 4, 12, enabled ? color : GRAY, 'center', true);
    hits.push({ rect, action, enabled });
  }
  function panel(title, subtitle) {
    ctx.fillStyle = PAPER; ctx.fillRect(0, 0, W, H); ctx.strokeStyle = 'rgba(90,150,200,0.16)'; ctx.lineWidth = 1;
    for (let y = 80; y < H; y += 28) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
    text(title, isDesktopLayout() ? 48 : 24, isDesktopLayout() ? 58 : 49, isDesktopLayout() ? 28 : 23, INK, 'left', true);
    if (subtitle) text(subtitle, W - (isDesktopLayout() ? 48 : 24), isDesktopLayout() ? 54 : 46, 11, GRAY, 'right');
  }
  function inkPoly(points, color, width = 1.6, close = false) {
    for (let i = 1; i < points.length; i++) jline(points[i - 1][0], points[i - 1][1], points[i][0], points[i][1], color, width);
    if (close && points.length > 2) jline(points[points.length - 1][0], points[points.length - 1][1], points[0][0], points[0][1], color, width);
  }
  function arcStroke(x, y, r, from, to, color, width = 2) {
    const steps = Math.max(3, Math.ceil(Math.abs(to - from) * r / 12));
    for (let i = 0; i < steps; i++) {
      const a = from + (to - from) * i / steps, b = from + (to - from) * (i + 1) / steps;
      jline(x + Math.cos(a) * r, y + Math.sin(a) * r, x + Math.cos(b) * r, y + Math.sin(b) * r, color, width);
    }
  }
  function handBladeLine(x1, y1, x2, y2, color, width = 6) {
    const len = Math.max(1, Math.hypot(x2 - x1, y2 - y1)), nx = -(y2 - y1) / len, ny = (x2 - x1) / len;
    jline(x1, y1, x2, y2, color, width);
    jline(x1 + nx * 3.2, y1 + ny * 3.2, x2 + nx * 3.2, y2 + ny * 3.2, color, Math.max(1.2, width * 0.3));
    jline(x1 - nx * 1.4, y1 - ny * 1.4, x2 - nx * 1.4, y2 - ny * 1.4, PAPER, Math.max(1, width * 0.2));
  }
  function drawStraightColorWave(effect, keys, progress) {
    const ease = 1 - Math.pow(1 - progress, 3), r = effect.r, a = effect.a + effect.tilt;
    const c = Math.cos(a), s = Math.sin(a), nx = -s, ny = c;
    const travel = r * (0.2 + ease * 0.7), cx = effect.x + c * travel, cy = effect.y + s * travel;
    const half = r * (0.4 + Math.sin(progress * Math.PI) * 0.12), skew = (effect.stage === 1 ? -1 : 1) * r * 0.1;
    const x1 = cx - nx * half - c * skew, y1 = cy - ny * half - s * skew;
    const x2 = cx + nx * half + c * skew, y2 = cy + ny * half + s * skew;
    keys.forEach((key, i) => {
      const t0 = i / keys.length, t1 = (i + 1) / keys.length, col = ATTR_COLOR[key] || GRAY;
      handBladeLine(x1 + (x2 - x1) * t0, y1 + (y2 - y1) * t0,
        x1 + (x2 - x1) * t1, y1 + (y2 - y1) * t1, col, 7);
    });
    for (const side of [-1, 1]) {
      const ox = nx * half * side, oy = ny * half * side;
      jline(cx + ox - c * r * 0.3, cy + oy - s * r * 0.3, cx + ox + c * r * 0.08, cy + oy + s * r * 0.08, INK, 1.4);
      jline(cx + ox * 0.82 - c * r * 0.22, cy + oy * 0.82 - s * r * 0.22,
        cx + ox * 1.08 + c * r * 0.12, cy + oy * 1.08 + s * r * 0.12, ATTR_COLOR[keys[side > 0 ? keys.length - 1 : 0]] || GRAY, 2);
    }
    for (let i = 0; i < 5; i++) {
      const side = (i - 2) * 0.2, bx = cx + nx * half * side - c * r * 0.16, by = cy + ny * half * side - s * r * 0.16;
      jline(bx, by, bx + c * (8 + i * 2) + nx * (i % 2 ? 5 : -4), by + s * (8 + i * 2) + ny * (i % 2 ? 5 : -4), INK, 1.1);
    }
  }
  function drawCrossColorWave(effect, keys, progress) {
    const ease = 1 - Math.pow(1 - progress, 3), r = effect.r;
    const cx = effect.x + Math.cos(effect.a) * r * 0.52, cy = effect.y + Math.sin(effect.a) * r * 0.52;
    for (const side of [-1, 1]) {
      const a = effect.a + side * 0.72, half = r * (0.28 + ease * 0.25), dx = Math.cos(a) * half, dy = Math.sin(a) * half;
      const col = ATTR_COLOR[keys[side < 0 ? 0 : keys.length - 1]] || GRAY;
      handBladeLine(cx - dx, cy - dy, cx + dx, cy + dy, col, 7);
      jline(cx - dx * 0.72 - dy * 0.06, cy - dy * 0.72 + dx * 0.06,
        cx + dx * 0.84 - dy * 0.06, cy + dy * 0.84 + dx * 0.06, col, 1.4);
    }
  }
  function drawRingColorWave(effect, keys, progress) {
    const ease = 1 - Math.pow(1 - progress, 3), r = effect.r * (0.3 + ease * 0.7);
    const start = effect.a - Math.PI / 2, span = Math.PI * 2;
    keys.forEach((key, i) => {
      const col = ATTR_COLOR[key] || GRAY, from = start + span * i / keys.length, to = start + span * (i + 1) / keys.length + 0.025;
      arcStroke(effect.x, effect.y, r, from, to, col, 7.5);
      arcStroke(effect.x, effect.y, r + 5, from + 0.025, to - 0.07, col, 1.7);
      arcStroke(effect.x, effect.y, r - 4, from + 0.055, to - 0.045, PAPER, 1.4);
      const a = to - 0.04;
      jline(effect.x + Math.cos(a) * (r - 10), effect.y + Math.sin(a) * (r - 10),
        effect.x + Math.cos(a + 0.05) * (r + 13), effect.y + Math.sin(a + 0.05) * (r + 13), col, 2.2);
    });
    for (let i = 0; i < 12; i++) {
      const a = start + i * Math.PI / 6 + Math.sin(effect.seed + i) * 0.06, inner = r + 9 + (i % 3) * 3;
      jline(effect.x + Math.cos(a) * inner, effect.y + Math.sin(a) * inner,
        effect.x + Math.cos(a) * (inner + 7 + i % 4), effect.y + Math.sin(a) * (inner + 7 + i % 4), INK, 1.1);
    }
    if (effect.precise) {
      arcStroke(effect.x, effect.y, r + 14, start, start + span, WARN_YELLOW, 2.4);
      for (let i = 0; i < 4; i++) {
        const a = start + i * Math.PI / 2;
        jline(effect.x + Math.cos(a) * (r + 9), effect.y + Math.sin(a) * (r + 9),
          effect.x + Math.cos(a) * (r + 21), effect.y + Math.sin(a) * (r + 21), WARN_YELLOW, 2);
      }
    }
  }
  function drawSequenceColorWave(effect, progress) {
    const spriteKey = effect.wave === 'crescentMirror' ? 'crescent' : effect.wave;
    const sprite = COLOR_WAVE_SPRITES[spriteKey], image = sprite && sprite.image;
    if (!image || !image.complete || !image.naturalWidth) return false;
    const frame = Math.min(sprite.frames - 1, Math.floor(Math.max(0, Math.min(0.9999, progress)) * sprite.frames));
    ctx.save();
    ctx.translate(effect.x, effect.y);
    ctx.rotate(effect.a + effect.tilt);
    if (spriteKey === 'straight') {
      const width = effect.r * 1.9, height = width * sprite.fh / sprite.fw;
      // 横斩位于角色身前，并始终垂直于瞄准方向；向上攻击时仍是横向刀波。
      ctx.translate(effect.r * 0.68, 0); ctx.rotate(Math.PI / 2);
      ctx.drawImage(image, frame * sprite.fw, 0, sprite.fw, sprite.fh,
        -width / 2, -height / 2, width, height);
    } else if (spriteKey === 'crescent') {
      const scale = effect.r / 250;
      // 沿攻击轴上下镜像，保证第三段仍然斩向身前判定区。
      if (effect.wave === 'crescentMirror') ctx.scale(1, -1);
      ctx.drawImage(image, frame * sprite.fw, 0, sprite.fw, sprite.fh,
        -193 * scale, -280 * scale, sprite.fw * scale, sprite.fh * scale);
    } else {
      const scale = effect.r / 185;
      ctx.drawImage(image, frame * sprite.fw, 0, sprite.fw, sprite.fh,
        -188.36 * scale, -193.68 * scale, sprite.fw * scale, sprite.fh * scale);
    }
    ctx.restore();
    if (effect.wave === 'ring' && effect.precise) {
      const start = effect.a - Math.PI / 2;
      arcStroke(effect.x, effect.y, effect.r + 14, start, start + Math.PI * 2, WARN_YELLOW, 2.4);
    }
    return true;
  }
  function drawColorSurgeEllipse(effect, progress) {
    const ease = 1 - Math.pow(1 - progress, 2), r = effect.r * (0.58 + ease * 0.42);
    const keys = effect.colors.length ? effect.colors : ['none'];
    setSeed(effect.seed + Math.floor(progress * 5));
    ctx.save();
    ctx.translate(effect.x, effect.y); ctx.rotate(effect.a); ctx.scale(1.28, 0.72);
    const local = Object.assign({}, effect, { x: 0, y: 0, a: 0, tilt: 0, r, wave: 'ring', precise: false });
    if (!drawSequenceColorWave(local, progress)) arcStroke(0, 0, r, 0, Math.PI * 2, GRAY, 4);
    // 保留色签对应的墨潮颜色，同时让环斩序列帧承担主要手绘质感。
    keys.forEach((key, i) => {
      const from = i * Math.PI * 2 / keys.length, to = (i + 0.94) * Math.PI * 2 / keys.length;
      arcStroke(0, 0, r * 0.98, from, to, ATTR_COLOR[key] || GRAY, key === 'phys' ? 3.2 : 2.2);
    });
    ctx.restore();
  }
  function drawCrescentFallback(effect) {
    ctx.save();
    ctx.translate(effect.x, effect.y); ctx.rotate(effect.a + effect.tilt);
    if (effect.wave === 'crescentMirror') ctx.scale(1, -1);
    arcStroke(0, 0, effect.r, -Math.PI / 2, Math.PI / 2, ATTR_COLOR.phys, 5.5);
    arcStroke(0, 0, effect.r - 4, -Math.PI / 2 + 0.08, Math.PI / 2 - 0.12, PAPER, 1.2);
    ctx.restore();
  }
  function drawColorCombat() {
    ctx.save();
    if (is('colors')) {
      for (const e of enemies) {
        if (e.dead || !e.colorTags) continue;
        const marked = COLOR_KEYS.filter(key => e.colorTags[key] > gameTime);
        marked.forEach((key, i) => {
          const a = -Math.PI / 2 + i * Math.PI / 2, r = e.r + 9;
          arcStroke(e.x, e.y, r, a - 0.28, a + 0.28, ATTR_COLOR[key], 2.5);
          jline(e.x + Math.cos(a) * (r - 2), e.y + Math.sin(a) * (r - 2),
            e.x + Math.cos(a) * (r + 4), e.y + Math.sin(a) * (r + 4), ATTR_COLOR[key], 1.3);
        });
      }
    }
    for (const slash of S.colorSlashes) {
      ctx.globalAlpha = Math.min(1, slash.t / 0.12);
      const dx = Math.cos(slash.a) * slash.length / 2, dy = Math.sin(slash.a) * slash.length / 2;
      const cols = slash.colors.map(key => ATTR_COLOR[key] || GRAY);
      for (let i = 0; i < cols.length; i++) {
        const t0 = i / cols.length, t1 = (i + 1) / cols.length;
        jline(slash.x - dx + dx * 2 * t0, slash.y - dy + dy * 2 * t0,
          slash.x - dx + dx * 2 * t1, slash.y - dy + dy * 2 * t1, cols[i], 4);
      }
      jline(slash.x - dx * 0.85, slash.y - dy * 0.85, slash.x + dx * 0.85, slash.y + dy * 0.85, PAPER, 1);
    }
    for (const burst of S.colorBursts) {
      ctx.globalAlpha = Math.min(0.9, burst.t / burst.total);
      const radius = burst.r * (1.1 - burst.t / burst.total * 0.35);
      burst.colors.forEach((key, i) => arcStroke(burst.x, burst.y, radius, i * Math.PI * 2 / burst.colors.length,
        (i + 0.78) * Math.PI * 2 / burst.colors.length, ATTR_COLOR[key], 3));
    }
    for (const effect of S.colorVisuals) {
      if (effect.delay > 0) continue;
      const progress = 1 - effect.t / effect.total;
      ctx.globalAlpha = Math.min(1, effect.t / Math.min(0.18, effect.total));
      if (effect.kind === 'combo') {
        const keys = effect.colors.length ? effect.colors : ['none'];
        setSeed(effect.seed + Math.floor(progress * 4));
        if (!drawSequenceColorWave(effect, progress)) {
          if (effect.wave === 'straight') drawStraightColorWave(effect, keys, progress);
          else if (effect.wave === 'crescent' || effect.wave === 'crescentMirror') drawCrescentFallback(effect);
          else drawRingColorWave(effect, keys, progress);
        }
      } else if (effect.kind === 'colorSurgeEllipse') {
        drawColorSurgeEllipse(effect, progress);
      } else if (effect.kind === 'overexpose') {
        const r = effect.r * (0.82 + progress * 0.18);
        if (effect.stage === 1) { jcircle(effect.x, effect.y, r, WARN_YELLOW, 1.4); jcircle(effect.x, effect.y, r * 0.88, WARN_YELLOW, 0.8); }
        else if (effect.stage === 2) {
          jcircle(effect.x, effect.y, r, WARN_YELLOW, 2);
          jline(effect.x - r * 0.72, effect.y - r * 0.72, effect.x + r * 0.72, effect.y + r * 0.72, WARN_YELLOW, 1.5);
          jline(effect.x + r * 0.72, effect.y - r * 0.72, effect.x - r * 0.72, effect.y + r * 0.72, WARN_YELLOW, 1.5);
        } else {
          jcircle(effect.x, effect.y, r, DARK, 6); jcircle(effect.x, effect.y, r - 5, PAPER, 2.2);
          for (let i = 0; i < 8; i++) arcStroke(effect.x, effect.y, r + 7, i * Math.PI / 4, i * Math.PI / 4 + 0.16, DARK, 2.2);
        }
      } else {
        const keys = effect.colors.length ? effect.colors : ['none'], r = effect.r * (0.8 + progress * 0.2);
        keys.forEach((key, i) => {
          const col = ATTR_COLOR[key] || GRAY, from = i * Math.PI * 2 / keys.length, to = (i + 0.88) * Math.PI * 2 / keys.length;
          arcStroke(effect.x, effect.y, r, from, to, col, key === 'phys' ? 7 : 4);
          if (key === 'ice') arcStroke(effect.x, effect.y, r - 8, from, to, ICE_LIGHT, 1.8);
          if (key === 'fire') for (let n = 0; n < 4; n++) {
            const a = from + (to - from) * n / 4, b = from + (to - from) * (n + 0.5) / 4;
            jline(effect.x + Math.cos(a) * (r - 7), effect.y + Math.sin(a) * (r - 7),
              effect.x + Math.cos(b) * (r + 7), effect.y + Math.sin(b) * (r + 7), col, 2.4);
          }
          if (key === 'thunder') for (let n = 0; n < 3; n++) {
            const a = from + (to - from) * (n + 0.3) / 3;
            jline(effect.x + Math.cos(a) * (r - 12), effect.y + Math.sin(a) * (r - 12),
              effect.x + Math.cos(a + 0.08) * (r + 12), effect.y + Math.sin(a + 0.08) * (r + 12), WARN_YELLOW, 1.8);
          }
        });
      }
    }
    ctx.restore();
  }
  const previousCharacterExtras = window.__drawWorldExtras;
  window.__drawWorldExtras = function() { if (previousCharacterExtras) previousCharacterExtras(); drawColorCombat(); };

  /* 战斗挂件只消费骨架坐标；普通与潜墨姿态共用，永不另画一套直立小人。 */
  function drawBattleAccessories(c, pose, d, color) {
    const h = pose.head, p = pose.pelvis, n = pose.neck, r = 7.5;
    const hand = pose.arms[1].foot;
    c.save(); if (pose.swimming) c.globalAlpha *= 0.82;
    if (d.icon === 'draft') {
      /* 无名草稿保持干净圆头，只保留领口线条。 */
      inkPoly([[n.x - 2, n.y - 1], [n.x + 3, n.y + 3], [n.x - 1, n.y + 5]], color, 1.1);
    } else if (d.icon === 'parry') {
      /* 回锋头带 + 斜持直尺，尺子刻度在战斗缩放下仍可辨认。 */
      jline(h.x - r, h.y + r * 0.28, h.x + r, h.y + r * 0.28, WARN_YELLOW, 1.8);
      inkPoly([[h.x - r, h.y + r * 0.25], [h.x - r * 1.75, h.y + r * 0.65], [h.x - r * 1.25, h.y - r * 0.05]], WARN_YELLOW, 1.4);
      jline(hand.x - 8, hand.y - 7, hand.x + 9, hand.y + 7, color, 3);
      for (let i = -5; i <= 5; i += 5) jline(hand.x + i, hand.y + i * 0.75, hand.x + i + 2, hand.y + i * 0.75 - 2, WARN_YELLOW, 0.9);
    } else if (d.icon === 'dive') {
      /* 墨滴兜帽和背鳍沿头部／躯干挂接，游泳时自然转成水平轮廓。 */
      jcircle(h.x, h.y, r + 2, color, 1.35);
      inkPoly([[h.x - 3, h.y + r + 1], [h.x + 1, h.y + r + 6], [h.x + 4, h.y + r + 1]], color, 1.5);
      inkPoly([[p.x - 1, p.y + 3], [p.x - 8, p.y + 9], [n.x - 3, n.y + 1]], ICE_LIGHT, 1.7, true);
      jline(p.x - 10, p.y - 1, p.x - 4, p.y + 1, ICE_LIGHT, 1.1);
      jline(p.x - 11, p.y - 4, p.x - 6, p.y - 2, ICE_LIGHT, 1);
    } else if (d.icon === 'surge') {
      /* 双重曝光环使用两种金黄，放射线只放在头部，避免遮住战场。 */
      c.globalAlpha *= 0.72;
      jcircle(h.x, h.y, r + 3.5, WARN_YELLOW, 1.4);
      jcircle(h.x, h.y, r + 6.5, d.color, 1.1);
      for (let i = 0; i < 4; i++) {
        const a = i * Math.PI / 2 + 0.35;
        jline(h.x + Math.cos(a) * (r + 8), h.y + Math.sin(a) * (r + 8), h.x + Math.cos(a) * (r + 11), h.y + Math.sin(a) * (r + 11), WARN_YELLOW, 1.25);
      }
      jline(n.x - 4, n.y, n.x + 4, n.y, WARN_YELLOW, 2);
    } else if (d.icon === 'summon') {
      /* 折纸方头先盖住圆头，再补折角和表情；背后牵着一只小纸偶。 */
      c.fillStyle = PAPER; c.fillRect(h.x - r, h.y - r, r * 2, r * 2);
      jrect(h.x - r, h.y - r, r * 2, r * 2, color, 1.8);
      inkPoly([[h.x + 1, h.y + r], [h.x + r, h.y + 1], [h.x + 1, h.y + 1]], color, 1.1, true);
      jcircle(h.x + 2.4, h.y + 1.2, 0.8, color, 1);
      jline(h.x + 1, h.y - 2.5, h.x + 4, h.y - 3.5, color, 1);
      const x = p.x - 10, y = p.y + 11;
      jline(n.x - 2, n.y, x, y + 3, ALLY, 0.9);
      inkPoly([[x, y + 4], [x - 3, y + 1], [x, y - 2], [x + 3, y + 1]], ALLY, 1.2, true);
      jline(x, y - 2, x, y - 7, ALLY, 1.2);
      jline(x, y - 5, x - 3, y - 3, ALLY, 1); jline(x, y - 5, x + 3, y - 3, ALLY, 1);
    } else if (d.icon === 'colors') {
      /* 四色发束与背后四支笔一一对应四种属性。 */
      const cols = [ATTR_COLOR.phys, ATTR_COLOR.fire, ATTR_COLOR.ice, ATTR_COLOR.thunder];
      cols.forEach((col, i) => {
        const dx = (i - 1.5) * 3;
        jline(h.x + dx * 0.45, h.y + r * 0.8, h.x + dx, h.y + r + 4 + (i % 2) * 2, col, 2);
        jline(p.x + dx - 1, p.y + 1, n.x + dx + 1, n.y + 5, col, 1.8);
        jline(n.x + dx + 1, n.y + 5, n.x + dx + 1.8, n.y + 7, col, 1);
      });
    } else if (d.icon === 'single') {
      /* 高笔尖冠 + 从掌心拖出的连续一笔，轮廓和其余角色明显不同。 */
      inkPoly([[h.x - r * 0.85, h.y + r * 0.65], [h.x - r * 0.6, h.y + r * 1.6], [h.x, h.y + r * 0.95], [h.x + r * 0.55, h.y + r * 1.9], [h.x + r * 0.85, h.y + r * 0.65]], color, 1.9);
      jline(h.x + r * 0.55, h.y + r * 1.9, h.x + r * 0.48, h.y + r * 1.25, WARN_YELLOW, 1);
      inkPoly([[hand.x, hand.y], [hand.x + 7, hand.y - 2], [hand.x + 12, hand.y + 2], [hand.x + 16, hand.y - 1]], color, 1.7);
    } else if (d.icon === 'idle') {
      /* 软塌睡帽、页边 Z 字与青色护盾光晕，突出“只走位”的轻松感。 */
      inkPoly([[h.x - r, h.y - r * 0.25], [h.x - r * 0.35, h.y - r * 1.55], [h.x + r * 1.35, h.y - r * 0.75], [h.x + r, h.y]], color, 1.8, true);
      jcircle(h.x - r * 0.35, h.y - r * 1.55, 1.8, WARN_YELLOW, 1.2);
      inkPoly([[h.x + r * 1.35, h.y - r * 1.6], [h.x + r * 2.25, h.y - r * 1.6], [h.x + r * 1.35, h.y - r * 0.55], [h.x + r * 2.25, h.y - r * 0.55]], color, 1.2);
      if (window.IdleRuntime && IdleRuntime.shieldRatio > 0) {
        c.globalAlpha *= 0.25 + IdleRuntime.shieldRatio * 0.45; jcircle(p.x, p.y - 10, 27, ARC, 1.5);
        jline(p.x - 20, p.y - 29, p.x + 18, p.y + 7, ARC, 0.8);
      }
    }
    c.restore();
  }

  const battleDecorators = Object.create(null);
  function decoratorFor(d) {
    if (!battleDecorators[d.id]) battleDecorators[d.id] = (c, pose, display) => drawBattleAccessories(c, pose, d, display.color);
    return battleDecorators[d.id];
  }
  if (typeof CreatureGameRuntime !== 'undefined') {
    const baseDrawCharacter = CreatureGameRuntime.drawPlayer;
    CreatureGameRuntime.drawPlayer = function(c, body, color) {
      const d = defOf(body.characterId || meta().data.character);
      const bodyColor = !color || color === INK ? d.color : color;
      return baseDrawCharacter(c, body, bodyColor, decoratorFor(d));
    };
    const baseDrawDivingCharacter = CreatureGameRuntime.drawDivingPlayer;
    CreatureGameRuntime.drawDivingPlayer = function(c, body, color) {
      const d = defOf(body.characterId || meta().data.character);
      return baseDrawDivingCharacter(c, body, color || d.color, decoratorFor(d));
    };
  }

  function portrait(d, x, y, size) {
    drawStick(x, y, size, boilT * 0.05, d.color);
    const hx = x, hy = y - size * 0.62, hr = size * 0.28;
    if (d.icon === 'parry') {
      jline(x - size * 0.6, y + 4, x + size * 0.55, y - size * 0.6, d.color, 3);
      jline(hx - hr, hy, hx + hr, hy, WARN_YELLOW, 2);
      jline(hx - hr, hy, hx - hr * 1.8, hy + 5, WARN_YELLOW, 1.5);
    } else if (d.icon === 'dive') {
      jcircle(hx, hy, hr + 3, d.color, 1.8);
      inkPoly([[hx - 3, hy - hr - 2], [hx + 1, hy - hr - 8], [hx + 4, hy - hr - 2]], d.color, 1.6);
      inkPoly([[x, y], [x - size * 0.45, y - size * 0.25], [x - size * 0.2, y + size * 0.25]], ICE_LIGHT, 1.8, true);
    } else if (d.icon === 'surge') {
      jcircle(hx, hy, hr + 5, d.color, 2); jcircle(hx, hy, hr + 9, WARN_YELLOW, 1.4);
      for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2; jline(hx + Math.cos(a) * (hr + 11), hy + Math.sin(a) * (hr + 11), hx + Math.cos(a) * (hr + 14), hy + Math.sin(a) * (hr + 14), WARN_YELLOW, 1.5); }
    } else if (d.icon === 'summon') {
      ctx.fillStyle = PAPER; ctx.fillRect(hx - hr, hy - hr, hr * 2, hr * 2); jrect(hx - hr, hy - hr, hr * 2, hr * 2, d.color, 1.8);
      inkPoly([[hx, hy - hr], [hx + hr, hy], [hx, hy]], d.color, 1.1, true);
      drawStick(x + size * 0.65, y + 6, size * 0.45, -boilT * 0.05, ALLY); jline(x + 5, y - 5, x + size * 0.55, y, ALLY, 1.5);
    } else if (d.icon === 'colors') {
      [ATTR_COLOR.phys, ATTR_COLOR.fire, ATTR_COLOR.ice, ATTR_COLOR.thunder].forEach((col, i) => {
        const dx = (i - 1.5) * size * 0.16;
        jline(hx + dx * 0.5, hy - hr, hx + dx, hy - hr - 7 - (i % 2) * 2, col, 2.4);
        jline(x + dx * 0.5, y + size * 0.1, x + dx, y - size * 0.3, col, 2);
      });
    } else if (d.icon === 'single') {
      inkPoly([[hx - hr, hy - hr * 0.6], [hx - hr * 0.6, hy - hr * 1.8], [hx, hy - hr], [hx + hr * 0.55, hy - hr * 2.1], [hx + hr, hy - hr * 0.6]], d.color, 2);
      jline(x + size * 0.25, y, x + size * 0.75, y + size * 0.2, d.color, 2.2);
    } else if (d.icon === 'idle') {
      inkPoly([[hx - hr, hy], [hx - hr * 0.35, hy - hr * 1.8], [hx + hr * 1.4, hy - hr * 0.8], [hx + hr, hy + hr * 0.2]], d.color, 2, true);
      jcircle(hx - hr * 0.35, hy - hr * 1.8, 2.2, WARN_YELLOW, 1.3);
      inkPoly([[hx + hr * 1.4, hy - hr * 1.8], [hx + hr * 2.4, hy - hr * 1.8], [hx + hr * 1.4, hy - hr * 0.5], [hx + hr * 2.4, hy - hr * 0.5]], d.color, 1.5);
    }
  }
  function drawCharacters() {
    hits = []; const desktop = isDesktopLayout(), start = state === 'metaCharacterSelect';
    panel(start ? '选择出战角色' : '角色手账', start ? '每次战斗前可更换' : '墨点 ' + meta().data.ink);
    // 返回选角前的入口；Boss 选角单独保留来源。
    const goBack = () => { const source = pending && pending.kind === 'boss' ? 'metaBossChallenge' : 'metaHome'; pending = null; if (source === 'metaHome') meta().goHome(); else state = source; };
    button(desktop ? { x: 70, y: 630, w: 120, h: 40 } : { x: 296, y: 628, w: 58, h: 28 }, '返回', goBack);
    if (desktop) {
      DEFS.forEach((d, i) => {
        const col = i % 4, row = Math.floor(i / 4), r = { x: 48 + col * 302, y: 110 + row * 126, w: 278, h: 106 };
        ctx.fillStyle = 'rgba(255,250,238,0.96)'; ctx.fillRect(r.x, r.y, r.w, r.h); jrect(r.x, r.y, r.w, r.h, d.color, viewId === d.id ? 3 : 1.5);
        portrait(d, r.x + 42, r.y + 62, 30); text(d.name, r.x + 82, r.y + 36, 17, d.color, 'left', true);
        text(d.title + ' · Lv.' + savedLevel(d.id), r.x + 82, r.y + 63, 12, DARK);
        text(d.id === 'single' ? '随机主动 · 开局揭晓' : (d.id === 'idle' ? '随机双主动 · 开局揭晓' : '起手 · ' + SKILL_DEFS[d.initial].name), r.x + 82, r.y + 86, 11, GRAY);
        hits.push({ rect: r, action: () => { viewId = d.id; }, enabled: true });
      });
      const d = defOf(viewId), level = savedLevel(d.id), box = { x: 48, y: 374, w: 1184, h: 222 };
      const flavor = globalThis.NarrativeRuntime && NarrativeRuntime.copy.CHARACTER_LINES[d.id];
      ctx.fillStyle = 'rgba(255,250,238,0.96)'; ctx.fillRect(box.x, box.y, box.w, box.h); jrect(box.x, box.y, box.w, box.h, d.color, 2);
      portrait(d, 112, 486, 54); text(d.name + ' · ' + d.title, 184, 414, 22, d.color, 'left', true);
      text(d.short, 184, 444, 14, DARK); text('限制：' + d.limit, 184, 470, 13, RED);
      if (flavor) text('“' + flavor[1] + '”', 184, 496, 12, PURPLE);
      text('当前 Lv.' + level + '：' + d.levels[level - 1], 184, 526, 13, INK);
      if (!start) {
        if (level < 5) text('下一级：' + d.levels[level], 184, 554, 12, GRAY); else text('五项能力已全部解锁', 184, 554, 12, PURPLE);
      }
      if (!start) button({ x: 934, y: 406, w: 250, h: 46 }, meta().data.character === d.id ? '当前出战' : '设为出战', () => selectCharacter(d.id), meta().data.character !== d.id, meta().data.character === d.id);
      if (!start) button({ x: 934, y: 474, w: 250, h: 46 }, level >= 5 ? '已满级' : '升级 · ' + CHARACTER_CONFIG.costs[level - 1] + ' 墨点', () => upgradeCharacter(d.id), level < 5 && meta().data.ink >= CHARACTER_CONFIG.costs[level - 1]);
      button({ x: 934, y: 542, w: 250, h: 46 }, start ? '开始战斗' : '以此角色出战', () => start ? CharacterRuntime.confirmSelection() : selectCharacter(d.id), true, false, d.color);
    } else {
      DEFS.forEach((d, i) => {
        const col = i % 2, row = Math.floor(i / 2), r = { x: 20 + col * 170, y: 105 + row * 66, w: 165, h: 56 };
        ctx.fillStyle = 'rgba(255,250,238,0.96)'; ctx.fillRect(r.x, r.y, r.w, r.h); jrect(r.x, r.y, r.w, r.h, d.color, viewId === d.id ? 2.8 : 1.3);
        portrait(d, r.x + 23, r.y + 33, 19);
        text(d.name, r.x + 46, r.y + 23, 13, d.color, 'left', true); text(d.title + ' · Lv.' + savedLevel(d.id), r.x + 46, r.y + 43, 9, GRAY);
        hits.push({ rect: r, action: () => { viewId = d.id; detailScroll = 0; }, enabled: true });
      });
      const d = defOf(viewId), level = savedLevel(d.id);
      const flavor = globalThis.NarrativeRuntime && NarrativeRuntime.copy.CHARACTER_LINES[d.id];
      ctx.fillStyle = 'rgba(255,250,238,0.96)'; ctx.fillRect(20, 379, 335, 176); jrect(20, 379, 335, 176, d.color, 1.8);
      text(d.name + ' · Lv.' + level, 32, 404, 16, d.color, 'left', true);
      text(d.id === 'single' ? '随机主动 · 开局揭晓' : (d.id === 'idle' ? '随机双主动 · 开局揭晓' : '起手 · ' + SKILL_DEFS[d.initial].name), 343, 403, 10, GRAY, 'right');
      ctx.save(); ctx.beginPath(); ctx.rect(24, 413, 323, 137); ctx.clip();
      let y = 427 - detailScroll;
      ctx.font = '10px ' + FONT; y += wrapText(d.short, 32, y, 303, 15, 2) * 15 + 5;
      text('限制：' + d.limit, 32, y, 10, RED); y += 22;
      if (flavor) { ctx.font = '10px ' + FONT; y += wrapText('“' + flavor[1] + '”', 32, y, 303, 15, 2) * 15 + 5; }
      ctx.font = '10px ' + FONT; y += wrapText('当前：' + d.levels[level - 1], 32, y, 303, 15, 3) * 15 + 5;
      if (!start) {
        ctx.font = '10px ' + FONT;
        if (level < 5) y += wrapText('下级：' + d.levels[level], 32, y, 303, 15, 3) * 15;
        else text('五项能力已全部解锁', 32, y, 10, PURPLE);
      }
      detailScrollMax = Math.max(0, y + detailScroll - 540); detailScroll = Math.min(detailScroll, detailScrollMax);
      ctx.restore();
      if (detailScrollMax > 0) {
        const trackY = 420, trackH = 120, thumbH = Math.max(24, trackH * 120 / (120 + detailScrollMax));
        ctx.fillStyle = 'rgba(90,150,200,0.18)'; ctx.fillRect(345, trackY, 3, trackH);
        ctx.fillStyle = d.color; ctx.fillRect(345, trackY + (trackH - thumbH) * detailScroll / detailScrollMax, 3, thumbH);
        text('可滑动', 338, 547, 9, GRAY, 'right');
      }
      if (!start) {
        button({ x: 20, y: 568, w: 108, h: 38 }, meta().data.character === d.id ? '出战中' : '设为出战', () => selectCharacter(d.id), meta().data.character !== d.id, meta().data.character === d.id);
        button({ x: 137, y: 568, w: 218, h: 38 }, level >= 5 ? '已满级' : '升级 · ' + CHARACTER_CONFIG.costs[level - 1] + ' 墨点', () => upgradeCharacter(d.id), level < 5 && meta().data.ink >= CHARACTER_CONFIG.costs[level - 1]);
      } else button({ x: 58, y: 578, w: 259, h: 46 }, '开始战斗 · ' + d.name, () => CharacterRuntime.confirmSelection(), true, false, d.color);
    }
  }

  const baseRender = render;
  render = function() { baseRender(); if (state === 'metaCharacters' || state === 'metaCharacterSelect') drawCharacters(); };
  canvas.addEventListener('pointerdown', e => {
    if (state !== 'metaCharacters' && state !== 'metaCharacterSelect') return;
    e.preventDefault(); e.stopImmediatePropagation(); const p = toLogical(e);
    if (!isDesktopLayout() && pointInRect(p, detailPanelRect)) {
      detailDrag = { id: e.pointerId, y: p.y, start: detailScroll };
      if (canvas.setPointerCapture) canvas.setPointerCapture(e.pointerId);
      return;
    }
    for (let i = hits.length - 1; i >= 0; i--) if (hits[i].enabled && pointInRect(p, hits[i].rect)) { hits[i].action(); break; }
  }, true);
  canvas.addEventListener('pointermove', e => {
    if (!detailDrag || e.pointerId !== detailDrag.id) return;
    e.preventDefault(); e.stopImmediatePropagation();
    detailScroll = Math.max(0, Math.min(detailScrollMax, detailDrag.start + detailDrag.y - toLogical(e).y));
  }, true);
  const endDetailDrag = () => { detailDrag = null; };
  canvas.addEventListener('pointerup', endDetailDrag, true);
  canvas.addEventListener('pointercancel', endDetailDrag, true);
  canvas.addEventListener('wheel', e => {
    if (isDesktopLayout() || (state !== 'metaCharacters' && state !== 'metaCharacterSelect') || !pointInRect(toLogical(e), detailPanelRect)) return;
    e.preventDefault(); e.stopImmediatePropagation();
    detailScroll = Math.max(0, Math.min(detailScrollMax, detailScroll + e.deltaY * 0.5));
  }, { capture: true, passive: false });
  window.addEventListener('keydown', e => {
    if (state !== 'metaCharacters' && state !== 'metaCharacterSelect') return;
    if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); const source = pending && pending.kind === 'boss' ? 'metaBossChallenge' : 'metaHome'; pending = null; if (source === 'metaHome') meta().goHome(); else state = source; }
    if (e.key === 'Enter' && state === 'metaCharacterSelect') { e.preventDefault(); e.stopImmediatePropagation(); CharacterRuntime.confirmSelection(); }
  }, true);

  const COLOR_AFFIXES = {
    fastabsorb: { name: '快采', desc: '彩墨斩的段间后摇与收笔时间缩短 16.7%' },
    wideabsorb: { name: '宽采', desc: '彩墨斩攻击范围 +20%' },
    reflectdamage: { name: '重采', desc: '彩墨斩伤害 +30%' },
    longabsorb: { name: '留色', desc: '主动施加的色签持续时间由 6 秒提升至 9 秒' },
    reflectsplit: { name: '分采', desc: '每段额外选择 1 个主采目标，造成 60% 伤害并以半效率回收本段资源' },
    gaincap: { name: '墨囊扩容', desc: '彩墨斩的墨水回收量 +50%' },
    surgegrowth: { name: '混色重爆', desc: '彩墨斩的混色爆裂伤害 +50%、范围 +20%' },
    reflecthoming: { name: '追猎红勾', desc: '同色签时优先精英／Boss；彩墨斩对其伤害 +25%' }
  };
  const COLOR_SURGE_AFFIXES = new Set(['surgewide', 'surgedamage', 'outerdamage', 'surgeprojectiles', 'clearbullets',
    'washink', 'surgeslow', 'surgeknock', 'surgeseed', 'silence']);
  function operationAffix(def) {
    if (!is('colors')) return def;
    if (def.skill === 'absorb') {
      const mapped = COLOR_AFFIXES[def.id];
      return mapped ? Object.assign({}, def, mapped) : null;
    }
    if (def.skill === 'surge' && !COLOR_SURGE_AFFIXES.has(def.id)) return null;
    if (def.skill === 'dive' && ['divecharge', 'divefastcharge', 'entrywash'].includes(def.id)) return null;
    return def;
  }
  function supportName(id) { return is('colors') && id === 'onabsorb' ? '彩墨连携' : (SUPPORTS[id] && SUPPORTS[id].name) || ''; }
  const baseCharacterSupDesc = supDesc;
  supDesc = function(id, l) {
    if (is('colors') && id === 'onabsorb') return '每段彩墨斩首次命中后额外施放本技能，触发伤害为 ' + (100 + 15 * (l - 1)) + '%';
    return baseCharacterSupDesc(id, l);
  };
  const baseCharacterItemDescription = itemDescription;
  itemDescription = function(key, rarity = 0, roll = 100) {
    if (is('colors')) {
      const v = itemValues(key, rarity, roll);
      if (key === 'blankshoes') return '移速 +' + v.speed + '%；空白纸面移动留下至多 6 个纸刃；彩墨斩召回，每个造成 ' + v.dmg + ' 基础伤害';
      if (key === 'parrygrip') return '彩墨斩命中储存至多 3 枚返墨弹；下次施放主动技能时全部射出，每枚 ' + v.dmg + ' 基础伤害';
      if (key === 'cloak') return '每 3 次彩墨斩命中生成 4 秒纸影，消失释放 ' + v.dmg + '% 伤害的墨潮';
    }
    return baseCharacterItemDescription(key, rarity, roll);
  };

  window.CharacterRuntime = {
    requestRun, requestBoss, openCharacters, selectCharacter, upgradeCharacter, confirmSelection,
    activeCap, supportCap, levelCap, extraChoice, hasRerolls, allowDiveCasting, afterCast, triggerCooldown,
    canReforge, reforgeSupport, castPaper, paperAttackInterval, addPaperXp, paperLevelFromXp,
    triggerPaperProxy, paperProxyCooldown, operationAffix, supportName,
    castColorSlash, castColorSurge, colorMovement,
    get defs() { return DEFS; }, get state() { return S; }, get viewId() { return viewId; }
  };
})();

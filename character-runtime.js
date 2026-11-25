/* 出战角色：选角、五级成长，以及共用战斗规则上的角色变体。 */
(() => {
  'use strict';
  const DEFS = CHARACTER_CONFIG.defs;
  const meta = () => window.__metaRuntime;
  const defOf = id => DEFS.find(c => c.id === id) || DEFS[0];
  const clone = obj => JSON.parse(JSON.stringify(obj));
  const is = id => typeof player !== 'undefined' && player && player.characterId === id;
  const lvl = () => player && player.characterLevel || 1;
  const fresh = () => ({
    extraUsed: false, finalDraft: false, reforgeUsed: false, inReroll: false,
    diveLog: [], echoes: [], echoRefund: 0, echoCasting: false,
    surgeLink: false, overcharge: 0, fullPageT: 0,
    paperCasting: false,
    colorSet: Object.create(null), colorRound: Object.create(null), lastColor: '',
    colorBurst: false, colorCasting: false, rainbow: false, colorEffect: false
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
      name: SUPPORTS[sup].name + ' → ' + SKILL_DEFS[id].name, desc: 'Lv1：' + supDesc(sup, 1) }));
    state = 'levelup'; levelupPickAfter = Date.now() + 500; layoutCards(cards.length);
  }

  function applyRun() {
    const d = selectedDef(), level = savedLevel(d.id);
    S = fresh();
    player.characterId = d.id; player.characterLevel = level;
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
    if (is('colors') && S.colorCasting && lvl() >= 4) { c.dmg *= 1.35; c.rad *= 1.15; }
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

  const baseChargeTurf = chargeTurf;
  chargeTurf = function(amount) { return baseChargeTurf(is('single') ? amount * 0.75 : amount); };

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

  function linkedActives() {
    if (!player.actives.length) return;
    S.surgeLink = true;
    for (const a of player.actives) {
      const c = skillCalc(a); c.dmg *= (1 + S.overcharge * 0.4) * (lvl() >= 4 ? 1.25 : 1);
      fireSkill(a, c); addSkillStain(a, c, 0.5);
      a.t = BATTLE.activeCooldowns[a.id] * c.cd;
    }
    S.surgeLink = false; S.overcharge = 0;
  }
  const baseUpdateSurgeCharge = updateInkSurgeCharge;
  updateInkSurgeCharge = function(dt) {
    baseUpdateSurgeCharge(dt);
    if (!is('surge') || lvl() < 3 || !player.surgeCharging) return;
    const base = surgeChargeTime();
    if (player.surgeChargeT >= base) player.surgeChargeT = Math.min(base * 1.5, player.surgeChargeT + dt);
    if (player.surgeChargeT >= base * 1.5) releaseInkSurgeCharge(player.surgePointerId);
  };
  const baseCastInkSurge = castInkSurge;
  castInkSurge = function(radius, full) {
    const hitCount = full && is('surge') && lvl() >= 2 ? enemies.filter(e => !e.dead && Math.hypot(e.x - player.x, e.y - player.y) < radius + e.r).length : 0;
    if (full && is('surge') && lvl() >= 3) S.overcharge = Math.max(0, Math.min(1, player.surgeChargeT / surgeChargeTime() - 1) / 0.5);
    const result = baseCastInkSurge(radius, full);
    if (result && full && is('surge')) {
      linkedActives();
      if (lvl() >= 2) for (const a of player.actives) a.t = Math.max(0, a.t - Math.min(2, hitCount * 0.08));
      if (lvl() >= 5) S.fullPageT = 6;
    }
    return result;
  };

  function spawnPaper(e) {
    const cap = lvl() >= 2 ? 8 : 6;
    if (minions.filter(m => m.characterPaper).length >= cap) return;
    const id = SKILL_DEFS[e.characterKillSkill] ? e.characterKillSkill : selectedDef().initial;
    const source = getActive(id) || makeActive(id);
    const a = makeActive(id, source.lvl); if (lvl() >= 5) a.supports = clone(source.supports || []);
    const m = { x: e.x, y: e.y, t: 12, atkCd: 0.4, walk: 0, rad: 1, c: { col: ALLY },
      characterPaper: true, a, king: false, orbitR: 60, orbitA: Math.random() * Math.PI * 2, paperTarget: null };
    minions.push(m); novas.push({ x: e.x, y: e.y, t: 0.3, max: 44, col: ALLY, c: { col: ALLY } });
    if (lvl() >= 4) {
      const same = minions.filter(p => p.characterPaper && !p.king && p.a.id === id);
      if (same.length >= 3) {
        for (const p of same.slice(0, 3)) p.t = -1;
        m.king = true; m.t = 16; m.rad = 1.5;
        floats.push({ x: m.x, y: m.y - 35, txt: '纸蝶合体！', t: 0.9, color: PURPLE, crit: true });
      }
    }
  }
  function castPaper(m, target) {
    if (!m || !m.a || !m.a.id) return false;
    const tgt = target && !target.dead ? target : nearestEnemy(m.x, m.y, 480);
    if (!tgt) return false;
    S.paperCasting = true;
    try {
      const c = skillCalc(m.a), inherit = m.king && lvl() >= 5 ? 0.55 : (lvl() >= 2 ? 0.4 : 0.35);
      c.dmg *= inherit * (m.king ? 1.8 : 1); m.c = c;
      // 激光继承伤害的命中类辅助；不再临时改写玩家坐标，也不会换成其他技能形态。
      const laserC = Object.assign({}, c, {
        strike: true, sdmg: (c.sdmg || 0) + (c.bdmg || 0), scrit: (c.scrit || 0) + (c.bcrit || 0)
      });
      lightnings.push({ x1: m.x, y1: m.y - 3, x2: tgt.x, y2: tgt.y, t: 0.2, delay: 0, prog: 0,
        tgt, dmg: 12 * c.dmg, c: laserC, col: c.col, paperLaser: true });
      return true;
    } finally {
      S.paperCasting = false;
    }
  }

  function applyRainbow(e, strong) {
    if (e.dead) return;
    e.slowT = Math.max(e.slowT || 0, strong ? 2 : 0.8);
    e.kbx *= strong ? 2.2 : 1.25; e.kby *= strong ? 2.2 : 1.25;
    if (strong && !e.boss) e.stunT = Math.max(e.stunT || 0, 0.35);
    if (gameTime >= (e.characterRainbowT || 0)) {
      e.characterRainbowT = gameTime + (strong ? 0.25 : 0.6);
      erupts.push({ x: e.x, y: e.y, delay: 0.12, dmg: 8 * player.dmgMul * (strong ? 2 : 1), r: strong ? 45 : 28,
        c: { col: ATTR_COLOR.fire, hadesSkill: 'other' }, done: false, t: 0 });
    }
  }
  function onColorHit(skillId, e) {
    const attr = SKILL_ATTR[skillId];
    if (!attr || !getActive(skillId)) return;
    if (lvl() >= 5 && S.rainbow && !S.colorEffect) {
      S.colorEffect = true; applyRainbow(e, false); S.colorEffect = false;
    }
    if (S.colorCasting) { if (lvl() >= 3) applyRainbow(e, true); return; }
    if (S.lastColor !== attr) {
      S.lastColor = attr;
      if (!S.colorSet[attr]) {
        S.colorSet[attr] = true;
        const count = Object.keys(S.colorSet).length;
        if (count === 2 || count === 3) {
          const reduction = count === 2 ? 0.3 : 0.45;
          for (const a of player.actives) a.t = Math.max(0, a.t - reduction);
          floats.push({ x: player.x, y: player.y - 48, txt: count + ' 色共鸣 · 返还 ' + reduction + ' 秒当前冷却', t: 0.7, color: INK });
        }
        if (lvl() >= 2 && !S.colorRound[attr]) {
          S.colorRound[attr] = true;
          for (const a of player.actives) a.t = Math.max(0, a.t - 0.2);
        }
      }
    }
    if (['phys', 'fire', 'ice', 'thunder'].every(a => S.colorSet[a])) S.colorBurst = true;
  }
  function castColorBurst() {
    S.colorBurst = false; S.colorCasting = true;
    for (const a of player.actives) { const c = skillCalc(a); fireSkill(a, c); addSkillStain(a, c, 0.5); }
    S.colorCasting = false; S.colorSet = Object.create(null); S.colorRound = Object.create(null); S.lastColor = '';
    if (lvl() >= 5) S.rainbow = true;
    floats.push({ x: player.x, y: player.y - 50, txt: '四色混色！', t: 1, color: PURPLE, crit: true });
  }

  const baseUpdateSkills = updateSkills;
  updateSkills = function(dt) {
    if (is('parry')) dt *= 0.6;
    if (is('surge') && S.fullPageT > 0) dt *= 2;
    if (is('colors') && S.colorBurst) castColorBurst();
    return baseUpdateSkills(dt);
  };

  function afterCast(a) {
    if (is('dive') && player.diving && !S.echoCasting) {
      S.diveLog.push({ x: player.x, y: player.y, a: clone(a), c: Object.assign({}, skillCalc(a)) });
    }
    if (is('colors') && !S.colorCasting) {
      const attr = SKILL_ATTR[a.id];
      for (const other of player.actives) if (other !== a && SKILL_ATTR[other.id] === attr) other.t = Math.max(other.t, a.t);
    }
    if (a.characterBoost) { delete a.characterBoost; delete a.characterRad; }
  }

  const baseHurtEnemy = hurtEnemy;
  hurtEnemy = function(e, dmg, ...rest) {
    const skillId = rest[8];
    if (skillId && getActive(skillId)) {
      e.characterKillSkill = skillId;
      const a = getActive(skillId);
      if (a && a.characterBoost) e.characterParrySkill = skillId;
    }
    const result = baseHurtEnemy(e, dmg, ...rest);
    if (is('summon') && e.boss && !e.dead) {
      let stage = e.characterPaperStage || 0;
      while (stage < 3 && e.hp / e.maxhp <= 0.75 - stage * 0.25) { stage++; e.characterPaperStage = stage; spawnPaper(e); }
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
      if (is('summon') && (e.boss || e.elite || Math.random() < 0.2)) spawnPaper(e);
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
    if (is('summon') && lvl() >= 3) for (const m of minions) if (m.characterPaper && m.t > 0 && m.t - dt <= 0) castPaper(m);
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

  /* 战斗挂件只消费骨架坐标；普通与潜墨姿态共用，永不另画一套直立小人。 */
  function drawBattleAccessories(c, pose, d, color) {
    const h = pose.head, p = pose.pelvis, n = pose.neck, r = 7.5;
    const hand = pose.arms[1].foot;
    c.save(); if (pose.swimming) c.globalAlpha *= 0.82;
    if (d.icon === 'draft') {
      /* 耳后铅笔：橡皮、木杆和笔尖三段，保留无名草稿的学生感。 */
      jline(h.x + r * 0.62, h.y + r * 0.2, h.x + r * 1.5, h.y + r * 1.45, '#b88a4a', 2.4);
      jline(h.x + r * 0.53, h.y + r * 0.05, h.x + r * 0.7, h.y + r * 0.28, RED, 2.8);
      inkPoly([[h.x + r * 1.5, h.y + r * 1.45], [h.x + r * 1.72, h.y + r * 1.83], [h.x + r * 1.27, h.y + r * 1.6]], color, 1.2, true);
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
    if (d.icon === 'draft') {
      jline(hx + hr * 0.7, hy, hx + hr * 1.8, hy - hr * 1.5, '#b88a4a', 2.5);
      jline(hx + hr * 1.8, hy - hr * 1.5, hx + hr * 1.5, hy - hr * 1.2, d.color, 1.4);
    } else if (d.icon === 'parry') {
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

  window.CharacterRuntime = {
    requestRun, requestBoss, openCharacters, selectCharacter, upgradeCharacter, confirmSelection,
    activeCap, supportCap, levelCap, extraChoice, hasRerolls, allowDiveCasting, afterCast, triggerCooldown,
    canReforge, reforgeSupport, castPaper,
    get defs() { return DEFS; }, get state() { return S; }, get viewId() { return viewId; }
  };
})();

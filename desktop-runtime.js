/* Windows 桌面版：16:9 横屏、键鼠操作与桌面界面；战斗逻辑保持共用。 */
(() => {
  'use strict';
  const active = () => typeof isDesktopLayout === 'function' && isDesktopLayout();
  const meta = () => window.__metaRuntime;
  let hits = [], page = 0, lastState = '', resetArmed = false, reforgePending = null;

  function updateControls() {
    if (!active()) {
      Object.assign(JOY_HOME, { x: 72, y: H - 174, r: 52 });
      Object.assign(absorbRect, { x: W - 88, y: H - 157, w: 74, h: 64 });
      Object.assign(specialRect, { x: W - 172, y: H - 157, w: 74, h: 52 });
      Object.assign(diveRect, { x: W - 88, y: H - 221, w: 74, h: 52 });
      Object.assign(buildRect, { x: W / 2 - 42, y: H - 62, w: 84, h: 36 });
      return;
    }
    Object.assign(absorbRect, { x: W - 414, y: H - 82, w: 124, h: 58 });
    Object.assign(specialRect, { x: W - 276, y: H - 82, w: 124, h: 58 });
    Object.assign(diveRect, { x: W - 138, y: H - 82, w: 124, h: 58 });
    Object.assign(buildRect, { x: W - 142, y: 94, w: 124, h: 38 });
    joy.active = false; joy.dx = 0; joy.dy = 0;
    if (cards && cards.length) layoutCards(cards.length);
  }
  window.addEventListener('resize', updateControls);

  function txt(value, x, y, size = 14, color = DARK, align = 'left', bold = false, maxWidth) {
    const fontSize = Math.round(size * 1.12);
    ctx.fillStyle = color; ctx.textAlign = align; ctx.font = (bold ? 'bold ' : '') + fontSize + 'px ' + FONT;
    ctx.fillText(String(value), x, y, maxWidth);
  }
  function lines(value, x, y, width, lineHeight = 20, maxLines = 3) {
    const result = []; let line = '';
    for (const ch of String(value || '')) {
      if (ch === '\n') { result.push(line); line = ''; continue; }
      if (line && ctx.measureText(line + ch).width > width) { result.push(line); line = ch; }
      else line += ch;
    }
    if (line || !result.length) result.push(line);
    result.slice(0, maxLines).forEach((s, i) => txt(s, x, y + i * lineHeight));
    return Math.min(result.length, maxLines);
  }
  function button(rect, label, action, options = {}) {
    const enabled = options.enabled !== false, color = options.color || INK;
    ctx.fillStyle = options.active ? 'rgba(205,222,248,0.98)' : 'rgba(255,250,238,0.96)';
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    jrect(rect.x, rect.y, rect.w, rect.h, enabled ? color : GRAY, options.active ? 2.8 : 1.8);
    txt(label, rect.x + rect.w / 2, rect.y + rect.h / 2 + 5, options.size || 14, enabled ? color : GRAY, 'center', true);
    if (action) hits.push({ rect, action, enabled });
  }
  function panel(title, subtitle = '') {
    ctx.fillStyle = PAPER; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(90,150,200,0.15)'; ctx.lineWidth = 1;
    for (let y = 96; y < H; y += 30) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
    txt(title, 48, 58, 28, INK, 'left', true);
    if (subtitle) txt(subtitle, W - 48, 54, 13, GRAY, 'right');
  }
  function pager(count, perPage, y = 650) {
    const pages = Math.max(1, Math.ceil(count / perPage)); page = Math.max(0, Math.min(page, pages - 1));
    button({ x: W / 2 - 180, y, w: 110, h: 36 }, '← 上一页', () => { page = Math.max(0, page - 1); }, { enabled: page > 0 });
    txt((page + 1) + ' / ' + pages, W / 2, y + 23, 13, DARK, 'center');
    button({ x: W / 2 + 70, y, w: 110, h: 36 }, '下一页 →', () => { page = Math.min(pages - 1, page + 1); }, { enabled: page < pages - 1 });
  }
  function clearPageOnStateChange() {
    if (state !== lastState) { page = 0; lastState = state; reforgePending = null; }
  }

  /* 横向三选一：描述直接展示，数字键 1–4 与鼠标均可选择。 */
  const baseLayoutCards = layoutCards;
  layoutCards = function(n) {
    baseLayoutCards(n);
    if (!active()) return;
    const gap = 24, width = n === 4 ? 278 : 340, height = 312;
    const total = n * width + (n - 1) * gap, x0 = (W - total) / 2, y = 214;
    cardRects = cards.map((c, i) => ({ x: x0 + i * (width + gap), y, w: width, h: height }));
    cardDetailRects = [];
  };
  const baseDrawCards = drawCards;
  drawCards = function(title) {
    if (!active()) return baseDrawCards(title);
    hits = [];
    ctx.fillStyle = 'rgba(32,30,29,0.62)'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = PAPER; ctx.fillRect(26, 96, W - 52, 500);
    jrect(26, 96, W - 52, 500, INK, 2.2);
    txt(title, W / 2, 158, 28, INK, 'center', true);
    txt(state === 'start' ? '选择一种涂鸦开始穿越' : '时间已暂停 · 选择后继续战斗', W / 2, 187, 13, GRAY, 'center');
    const locked = state === 'levelup' && Date.now() < levelupPickAfter;
    cards.forEach((cd, i) => {
      const r = cardRects[i], color = cd.tagColor || INK;
      ctx.fillStyle = 'rgba(255,250,238,0.96)'; ctx.fillRect(r.x, r.y, r.w, r.h);
      jrect(r.x, r.y, r.w, r.h, color, 2.4);
      txt('[' + (i + 1) + ']', r.x + r.w - 20, r.y + 30, 13, GRAY, 'right');
      const iconMeta = window.SkillIconRuntime && SkillIconRuntime.cardMeta(cd);
      if (iconMeta) SkillIconRuntime.drawCard(cd, r.x + 20, r.y + 49, 58);
      const titleX = r.x + 20 + (iconMeta ? 70 : 0);
      const titleW = r.w - 40 - (iconMeta ? 70 : 0);
      txt(cd.name, titleX, r.y + 66, 20, INK, 'left', true, titleW);
      if (cd.typeLabel) drawTagChip(cd.typeLabel, titleX, r.y + 78, color, 12, titleW);
      ctx.font = '14px ' + FONT;
      const short = cd.shortDesc || String(cd.desc || '').replace(/^Lv1：/, '');
      const count = lines(short, r.x + 20, r.y + 136, r.w - 40, 22, 4);
      const detail = (cd.detailLines || []).join('');
      if (detail) { ctx.font = '12px ' + FONT; ctx.fillStyle = GRAY; lines(detail, r.x + 20, r.y + 146 + count * 22, r.w - 40, 18, 3); }
      txt(locked ? '0.5 秒后可选择' : '点击或按 ' + (i + 1) + ' 选择', r.x + 20, r.y + r.h - 24, 12, locked ? GRAY : color, 'left', true);
    });
  };

  const baseDrawBuildButton = drawBuildButton;
  drawBuildButton = function() {
    if (!active()) return baseDrawBuildButton();
    ctx.fillStyle = 'rgba(255,250,238,0.95)'; ctx.fillRect(buildRect.x, buildRect.y, buildRect.w, buildRect.h);
    jrect(buildRect.x, buildRect.y, buildRect.w, buildRect.h, INK, 1.8);
    txt('养成  Tab', buildRect.x + buildRect.w / 2, buildRect.y + 25, 14, INK, 'center', true);
  };
  const baseDrawHUD = drawHUD;
  drawHUD = function() {
    if (!active()) return baseDrawHUD();
    setSeed(42);
    const boss = enemies.find(e => e.boss && !e.dead), t = Math.floor(gameTime);
    const time = String(Math.floor(t / 60)).padStart(2, '0') + ':' + String(t % 60).padStart(2, '0');
    ctx.fillStyle = 'rgba(255,250,238,0.9)'; ctx.fillRect(12, 10, W - 24, 52);
    jline(18, 62, W - 18, 62, 'rgba(26,43,143,0.35)', 1.2);
    txt('Lv.' + player.level, 28, 34, 16, INK, 'left', true);
    jrect(92, 24, 220, 10, PICKUP, 1.5);
    const xpRatio = Math.max(0, Math.min(1, player.xp / player.xpNext));
    if (xpRatio > 0) { ctx.save(); ctx.beginPath(); ctx.rect(93, 25, 218 * xpRatio, 8); ctx.clip(); scribbleFill(93, 25, 218 * xpRatio, 8, PICKUP); ctx.restore(); }
    txt(curStage + '-' + (((player.level - 1) % 10) + 1), W / 2, 37, 23, INK, 'center', true);
    txt(time, W / 2, 55, 11, GRAY, 'center');
    txt('击杀 ' + kills + (killChain >= 5 ? ' · ' + killChain + ' 连擦' : ''), W - 30, 39, 15, killChain >= 25 ? RED : INK, 'right', true);
    if (boss) {
      const bw = 500, bx = (W - bw) / 2, by = 80;
      txt(boss.name + (boss.phase === 2 ? ' · 暴走' : ''), W / 2, by - 8, 15, RED, 'center', true);
      jrect(bx, by, bw, 15, RED, 2);
      const ratio = Math.max(0, boss.hp / boss.maxhp);
      if (ratio > 0) { ctx.save(); ctx.beginPath(); ctx.rect(bx + 2, by + 2, (bw - 4) * ratio, 11); ctx.clip(); scribbleFill(bx + 2, by + 2, (bw - 4) * ratio, 11, RED); ctx.restore(); }
      const controlled = controlledBossRuntime(boss); if (controlled) controlled.drawHUD(boss, bx, by, bw);
    }
    ctx.save(); ctx.shadowColor = PAPER; ctx.shadowBlur = 5;
    player.actives.forEach((a, i) => {
      const y = 100 + i * 28, icons = window.SkillIconRuntime;
      if (icons) icons.draw(a.id, 'active', 22, y - 18, 24, { level: a.lvl, state: a.supports.length + '/' + supportCap() });
      txt(SKILL_DEFS[a.id].name + (icons ? '' : '  Lv.' + a.lvl), icons ? 54 : 26, y, 14, attrOf(a.id), 'left', true);
      txt('辅 ' + a.supports.length + '/' + supportCap(), 226, y, 11, PURPLE, 'right');
    });
    const equipCount = SLOTS.filter(s => player.equip[s]).length;
    txt('装备 ' + equipCount + '/' + SLOTS.length, 26, 112 + player.actives.length * 28, 12, equipCount ? INK : GRAY);
    ctx.restore();
    toasts.forEach((toastValue, i) => {
      ctx.globalAlpha = Math.min(1, toastValue.t);
      txt(toastValue.txt, W / 2, H - 132 - i * 23, 15, DARK, 'center', true); ctx.globalAlpha = 1;
    });
    const controls = player.characterId === 'idle' ? [] : [
      [absorbRect, 'absorb', '左键', player.absorbT > 0 ? '吸墨中' : '吸墨 · 弹反', player.absorbCd <= 0 ? INK : GRAY, player.absorbCd > 0 ? player.absorbCd.toFixed(1) : '', player.absorbCd > 0],
      [specialRect, 'surge', '右键', player.surgeCharging ? '蓄力 ' + Math.round(inkSurgeChargeRatio() * 100) + '%' : (player.special >= 100 ? '墨潮 · 长按' : '墨潮 ' + Math.floor(player.special) + '%'), player.special >= 100 ? INK : GRAY, player.surgeCharging ? Math.round(inkSurgeChargeRatio() * 100) : Math.floor(player.special), player.special < 100 && !player.surgeCharging],
      [diveRect, 'dive', 'Space', player.diving ? '潜墨中' : '潜墨', player.ink > 0 && player.diveCd <= 0 ? INK : GRAY, player.diveCd > 0 ? player.diveCd.toFixed(1) : '', !(player.ink > 0 && player.diveCd <= 0) && !player.diving]
    ];
    for (const [r, id, key, label, color, iconState, disabled] of controls) {
      ctx.fillStyle = 'rgba(255,250,238,0.95)'; ctx.fillRect(r.x, r.y, r.w, r.h); jrect(r.x, r.y, r.w, r.h, color, 2);
      const icons = window.SkillIconRuntime;
      if (icons) icons.draw(id, 'ink', r.x + 8, r.y + 9, 40, { showLevel: false, state: iconState, disabled });
      const textX = r.x + (icons ? 56 : 12);
      txt(key, textX, r.y + 20, icons ? 11 : 12, color, 'left', true);
      txt(label, textX, r.y + 42, icons ? 11 : 13, color, 'left', true, icons ? r.w - 64 : r.w - 24);
    }
    if (player.characterId === 'idle' && window.IdleRuntime) IdleRuntime.drawHUD(true);
    txt(player.characterId === 'idle' ? 'WASD / 方向键移动　·　技能自动施放　·　Tab 养成　·　Esc 暂停' : 'WASD / 方向键移动　·　左键 / E 吸墨　·　右键 / Q 墨潮　·　空格潜墨　·　Esc 暂停', 26, H - 30, 13, DARK, 'left');
  };

  function drawHome() {
    panel('纸上涂鸦幻想', '桌面试玩版 · v' + '0.2.0');
    const m = meta();
    if (window.HomeDoodles) window.HomeDoodles.draw(true);
    txt(m ? m.rankInfo().name : '', 64, 142, 30, INK, 'left', true);
    if (m) {
      txt('段位手账 ›', 64, 177, 14, PURPLE, 'left', true);
      const homeCopy = window.NarrativeRuntime ? NarrativeRuntime.homeText() : '这一页还空着。来画下第一笔吧。';
      const homeLines = String(homeCopy || '').split('\n').filter(Boolean).slice(0, 2);
      homeLines.forEach((line, i) => txt(line, 64, (homeLines.length > 1 ? 201 : 211) + i * 20, 14, DARK));
      hits.push({ rect: { x: 48, y: 108, w: 390, h: 120 }, action: () => { state = 'metaRankDetails'; }, enabled: true });
    }
    button({ x: 64, y: 280, w: 360, h: 70 }, '开始游戏  →', () => CharacterRuntime.requestRun(), { size: 20 });
    button({ x: 486, y: 280, w: 250, h: 58 }, '文具盒', () => { state = 'metaInventory'; });
    button({ x: 756, y: 280, w: 250, h: 58 }, '墨点天赋', () => { state = 'metaTalents'; });
    button({ x: 486, y: 370, w: 250, h: 58 }, '角色', () => CharacterRuntime.openCharacters());
    button({ x: 756, y: 370, w: 250, h: 58 }, 'Boss 挑战', () => m.openBossChallenge());
    ctx.save(); ctx.translate(1050, 180); ctx.rotate(-0.08); setSeed(744);
    jrect(-100, -70, 200, 170, INK, 3); jline(-70, -38, 68, -38, LINE, 2); jline(-70, 0, 68, 0, LINE, 2); jline(-70, 38, 68, 38, LINE, 2);
    drawStick(0, 30, 68, boilT * 0.05, INK); ctx.restore();
    jcircle(32, 92, 16, GRAY, 1.6); txt('删', 32, 97, 13, GRAY, 'center', true);
    hits.push({ rect: { x: 14, y: 74, w: 36, h: 36 }, action: () => { resetArmed = true; }, enabled: true });
    if (resetArmed) {
      hits = []; ctx.fillStyle = 'rgba(16,16,16,0.58)'; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = PAPER; ctx.fillRect(W / 2 - 280, 238, 560, 242); jrect(W / 2 - 280, 238, 560, 242, RED, 2.4);
      txt('确认删除本地存档？', W / 2, 294, 23, RED, 'center', true);
      txt('墨点、装备、天赋与段位都会被清除，此操作无法撤销。', W / 2, 338, 14, DARK, 'center');
      button({ x: W / 2 - 220, y: 394, w: 190, h: 46 }, '取消', () => { resetArmed = false; });
      button({ x: W / 2 + 30, y: 394, w: 190, h: 46 }, '确认删除', () => { resetArmed = false; m.resetAll(); }, { color: RED });
    }
  }

  function drawRankDetails() {
    const m = meta(), progress = m.rankProgress();
    panel('段位手账', m.rankInfo().name);
    button({ x: 48, y: 630, w: 120, h: 40 }, '返回 Esc', () => m.goHome());
    txt('最佳三局认证', 70, 126, 21, INK, 'left', true);
    txt('三席平均 ' + (Math.round(progress.average * 10) / 10).toFixed(1), 1120, 126, 18, PURPLE, 'right', true);
    for (let i = 0; i < 3; i++) {
      const r = { x: 70 + i * 390, y: 158, w: 350, h: 158 }, value = progress.scores[i];
      ctx.fillStyle = 'rgba(255,250,238,0.94)'; ctx.fillRect(r.x, r.y, r.w, r.h); jrect(r.x, r.y, r.w, r.h, value == null ? GRAY : INK, 1.8);
      txt('第 ' + (i + 1) + ' 席', r.x + 24, r.y + 38, 14, GRAY);
      txt(value == null ? '--' : value, r.x + r.w / 2, r.y + 111, 46, value == null ? GRAY : INK, 'center', true);
    }
    const nextName = m.data.rank >= 18 ? '已达最高段位' : '下一认证 · ' + m.rankInfo(progress.nextRank).name;
    txt(nextName, 70, 373, 23, INK, 'left', true);
    txt(m.data.rank >= 18 ? '大师认证已完成' : '目标平均 ' + progress.target + ' 分', 70, 408, 16, DARK);
    txt(m.nextRankText(progress), 70, 447, 19, PURPLE, 'left', true);
    jline(70, 482, 1210, 482, GRAY, 1.2);
    txt('历史记录', 70, 526, 17, INK, 'left', true);
    txt('挑战局数  ' + m.data.stats.runs + '　·　完整通关  ' + m.data.stats.wins + '　·　最高第 ' + m.data.stats.highestStage + ' 页', 70, 562, 16, DARK);
    ctx.fillStyle = 'rgba(210,225,255,0.38)'; ctx.fillRect(690, 354, 500, 100); jrect(690, 354, 500, 100, LINE, 1.4);
    txt('表现分＝到达波数＋Boss 无伤数', 940, 391, 16, INK, 'center', true);
    txt('取最佳三局，空席计 0；段位只升不降', 940, 424, 14, GRAY, 'center');
  }

  function drawBossChallenge() {
    panel('Boss 挑战', '练习模式 · 无收益');
    button({ x: 48, y: 630, w: 120, h: 40 }, '返回 Esc', () => meta().goHome());
    const m = meta(), gap = 18, bw = 220, bh = 108, total = 5 * bw + 4 * gap, x0 = (W - total) / 2;
    BOSS_DEFS.forEach((def, i) => {
      const col = i % 5, row = Math.floor(i / 5), r = { x: x0 + col * (bw + gap), y: 140 + row * 125, w: bw, h: bh };
      const cleared = m.data.firstBosses.includes(i + 1), color = cleared ? INK : DARK;
      ctx.fillStyle = 'rgba(255,250,238,0.96)'; ctx.fillRect(r.x, r.y, r.w, r.h); jrect(r.x, r.y, r.w, r.h, color, cleared ? 2.5 : 1.6);
      txt('第 ' + String(def.page || i + 1).padStart(2, '0') + ' 页' + (def.hexapod ? ' · 六足' : ''), r.x + 16, r.y + 21, 12, GRAY);
      txt(def.name, r.x + r.w / 2, r.y + 49, 18, INK, 'center', true, r.w - 24);
      txt(({ charger: '近战突袭', caster: '远程术式', blob: '区域压制' })[def.arch] || 'Boss', r.x + r.w / 2, r.y + 74, 12, GRAY, 'center');
      txt(cleared ? '已讨伐' : '未讨伐', r.x + r.w / 2, r.y + 95, 11, cleared ? PURPLE : GRAY, 'center');
      hits.push({ rect: r, action: () => CharacterRuntime.requestBoss(i + 1), enabled: true });
    });
  }

  function talentEntries() {
    const m = meta(), tab = m.tab;
    if (tab === 'basic') return META_CONFIG.basics.map(b => ({ id: b.id, name: b.name, desc: b.desc, level: m.data.talents[b.id] || 0, max: b.max, costs: META_CONFIG.basicCosts, per: b.per, unit: b.unit }));
    if (tab === 'active') return Object.keys(SKILL_DEFS).map(id => ({ id, name: SKILL_DEFS[id].name, desc: '技能伤害', level: m.data.specs[id] || 0, max: 3, costs: META_CONFIG.specCosts, per: 5, unit: '%' }));
    return META_CONFIG.inkSpecs.map(s => ({ id: s.id, name: s.name, desc: s.desc, level: m.data.specs[s.id] || 0, max: 3, costs: META_CONFIG.specCosts, per: 5, unit: '%' }));
  }
  function drawTalents() {
    const m = meta(); panel('墨点天赋', '墨点 ' + m.data.ink);
    button({ x: 48, y: 630, w: 120, h: 40 }, '返回 Esc', () => m.goHome());
    [['basic', '基础'], ['active', '主动'], ['ink', '墨水']].forEach(([id, name], i) => button({ x: 48 + i * 150, y: 86, w: 134, h: 40 }, name, () => { m.tab = id; page = 0; }, { active: m.tab === id }));
    button({ x: W - 190, y: 86, w: 142, h: 40 }, '重置天赋', () => m.resetTalents(), { color: PURPLE });
    const entries = talentEntries(), per = 6, shown = entries.slice(page * per, page * per + per);
    shown.forEach((entry, i) => {
      const col = i % 2, row = Math.floor(i / 2), r = { x: 48 + col * 602, y: 158 + row * 142, w: 570, h: 118 };
      const maxed = entry.level >= entry.max, cost = maxed ? 0 : entry.costs[entry.level];
      ctx.fillStyle = 'rgba(255,250,238,0.94)'; ctx.fillRect(r.x, r.y, r.w, r.h); jrect(r.x, r.y, r.w, r.h, maxed ? GRAY : INK, 1.6);
      txt(entry.name + '  Lv.' + entry.level + '/' + entry.max, r.x + 18, r.y + 32, 17, INK, 'left', true);
      txt(entry.desc + ' +' + entry.level * entry.per + entry.unit + (maxed ? '' : ' → +' + (entry.level + 1) * entry.per + entry.unit), r.x + 18, r.y + 65, 14, DARK);
      button({ x: r.x + r.w - 122, y: r.y + 66, w: 100, h: 38 }, maxed ? '已满' : cost + ' 墨点', () => m.upgradeTalent(entry.id), { enabled: !maxed && m.data.ink >= cost });
    });
    pager(entries.length, per, 620);
  }

  function inventoryEntries() {
    const m = meta(); return m.data.inventory.filter(eq => inventoryEntries.filter === 'all' || ITEM_DEFS[eq.key].slot === inventoryEntries.filter)
      .slice().sort((a, b) => SLOTS.indexOf(ITEM_DEFS[a.key].slot) - SLOTS.indexOf(ITEM_DEFS[b.key].slot) || b.rarity - a.rarity);
  }
  inventoryEntries.filter = 'all';
  function drawInventory() {
    const m = meta(); panel('文具盒', '碎纸 ' + m.data.paper);
    button({ x: 48, y: 630, w: 120, h: 40 }, '返回 Esc', () => m.goHome());
    const filters = [{ id: 'all', name: '全部' }, ...SLOTS.map(s => ({ id: s, name: SLOT_NAME[s] }))];
    filters.forEach((f, i) => button({ x: 48 + i * 130, y: 84, w: 114, h: 38 }, f.name, () => { inventoryEntries.filter = f.id; page = 0; }, { active: inventoryEntries.filter === f.id }));
    const entries = inventoryEntries(), per = 4, shown = entries.slice(page * per, page * per + per);
    shown.forEach((eq, i) => {
      const col = i % 2, row = Math.floor(i / 2), r = { x: 48 + col * 602, y: 154 + row * 218, w: 570, h: 190 };
      const def = ITEM_DEFS[eq.key], rarity = RARITY_LIST[eq.rarity], inherited = m.data.inherited && m.data.inherited.key === eq.key && m.data.inherited.rarity === eq.rarity;
      ctx.fillStyle = 'rgba(255,250,238,0.95)'; ctx.fillRect(r.x, r.y, r.w, r.h); jrect(r.x, r.y, r.w, r.h, rarity.color, 1.8);
      txt(def.name, r.x + 18, r.y + 34, 19, rarity.color, 'left', true);
      txt(equipmentProgressText(eq, m.data.equipment) + ' · ' + rarity.name, r.x + 18, r.y + 60, 12, GRAY);
      ctx.font = '13px ' + FONT; ctx.fillStyle = DARK; lines(window.UICopy ? window.UICopy.itemShort(eq.key, eq.rarity, eq.roll) : itemDescription(eq.key, eq.rarity, eq.roll), r.x + 18, r.y + 92, 330, 20, 3);
      button({ x: r.x + 390, y: r.y + 36, w: 150, h: 42 }, inherited ? '已继承' : '设为继承', () => m.setInherited(eq.key, eq.rarity), { enabled: !inherited, active: inherited });
      button({ x: r.x + 390, y: r.y + 100, w: 150, h: 42 }, '重铸 ' + META_CONFIG.reforgeCostByRarity[eq.rarity], () => { reforgePending = eq; }, { enabled: m.data.paper >= META_CONFIG.reforgeCostByRarity[eq.rarity] });
      hits.push({ rect: { x: r.x, y: r.y, w: 365, h: r.h }, action: () => window.UICopy && window.UICopy.itemDetail(eq, def.slot, m.data.equipment), enabled: true });
    });
    if (!shown.length) txt('还没有装备', W / 2, 350, 18, GRAY, 'center');
    pager(entries.length, per, 614);
    if (reforgePending) {
      hits = []; const eq = reforgePending;
      ctx.fillStyle = 'rgba(16,16,16,0.58)'; ctx.fillRect(0, 0, W, H); ctx.fillStyle = PAPER; ctx.fillRect(W / 2 - 280, 220, 560, 270); jrect(W / 2 - 280, 220, 560, 270, INK, 2.4);
      txt('确认重铸？', W / 2, 278, 23, INK, 'center', true);
      txt(ITEM_DEFS[eq.key].name + ' · 同部位同品质三选一 · 等级不变', W / 2, 326, 14, DARK, 'center');
      txt('消耗 ' + META_CONFIG.reforgeCostByRarity[eq.rarity] + ' 碎纸', W / 2, 360, 14, PURPLE, 'center');
      button({ x: W / 2 - 220, y: 410, w: 190, h: 44 }, '取消', () => { reforgePending = null; });
      button({ x: W / 2 + 30, y: 410, w: 190, h: 44 }, '确认重铸', () => { m.reforge(eq.key, eq.rarity); reforgePending = null; }, { active: true });
    } else if (m.reforgeOffers) {
      hits = []; const offer = m.reforgeOffers, count = offer.candidates.length, cardW = 260, gap = 20;
      const startX = W / 2 - (count * cardW + (count - 1) * gap) / 2;
      ctx.fillStyle = 'rgba(16,16,16,0.62)'; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = PAPER; ctx.fillRect(W / 2 - 450, 150, 900, 420); jrect(W / 2 - 450, 150, 900, 420, INK, 2.4);
      txt('选择重铸结果', W / 2, 204, 25, INK, 'center', true);
      txt(RARITY_LIST[offer.rarity].name + ' · ' + SLOT_NAME[ITEM_DEFS[offer.key].slot] + ' · 选定后消耗 ' + offer.cost + ' 碎纸', W / 2, 238, 14, PURPLE, 'center');
      offer.candidates.forEach((key, i) => {
        const r = { x: startX + i * (cardW + gap), y: 275, w: cardW, h: 180 };
        ctx.fillStyle = 'rgba(255,250,238,0.97)'; ctx.fillRect(r.x, r.y, r.w, r.h); jrect(r.x, r.y, r.w, r.h, INK, 1.8);
        txt('[' + (i + 1) + '] ' + ITEM_DEFS[key].name, r.x + 16, r.y + 35, 18, INK, 'left', true, r.w - 32);
        ctx.font = '13px ' + FONT; ctx.fillStyle = DARK;
        lines(window.UICopy ? window.UICopy.itemShort(key, offer.rarity) : itemDescription(key, offer.rarity), r.x + 16, r.y + 72, r.w - 32, 21, 3);
        hits.push({ rect: r, enabled: true, action: () => m.chooseReforge(i) });
      });
      button({ x: W / 2 - 130, y: 495, w: 260, h: 44 }, '取消 · 不消耗碎纸', () => m.cancelReforge());
    }
  }

  function summaryEntries() {
    const s = meta().settlement; if (!s) return [];
    if (meta().summaryTab === 'skills') return s.build.actives;
    if (meta().summaryTab === 'affixes') {
      const result = [];
      for (const p of PASSIVES) if ((s.build.passives[p.id] || 0) > 0) result.push({ kind: 'passive', def: p, count: s.build.passives[p.id] });
      for (const a of OPERATION_AFFIX_LIST) if ((s.build.affixes[a.skill] && s.build.affixes[a.skill][a.id]) || s.build.taken[a.id]) result.push({ kind: 'operation', def: a });
      return result;
    }
    if (meta().summaryTab === 'damage') {
      const total = Object.values(s.damage || {}).reduce((sum, v) => sum + v, 0);
      return Object.entries(s.damage || {}).filter(([, v]) => v > 0).map(([id, value]) => ({ id, value, total })).sort((a, b) => b.value - a.value);
    }
    return SLOTS.filter(slot => s.build.equip[slot]).map(slot => ({ slot, eq: s.build.equip[slot] }));
  }
  function drawSummary() {
    const m = meta(), s = m.settlement; if (!s) return;
    panel('本关构筑回顾', '普通模式');
    const seconds = Math.floor(s.time || 0), time = Math.floor(seconds / 60) + ':' + String(seconds % 60).padStart(2, '0');
    txt((s.win ? '挑战成功' : '挑战失败') + ' · 第 ' + s.stage + ' 页 · Lv.' + s.level + ' · 击杀 ' + s.kills + ' · ' + time + ' · 墨点 +' + s.earned, 48, 88, 14, s.win ? INK : RED, 'left', true);
    txt('本局表现 ' + s.score + ' = 深度 ' + s.depthScore + ' + Boss 无伤 ' + s.flawlessBosses, 48, 116, 15, INK, 'left', true);
    const scores = [0, 1, 2].map(i => s.rankScores[i] == null ? '--' : s.rankScores[i]).join(' / ');
    txt('认证 ' + scores + ' · 平均 ' + (Math.round(s.rankAverage * 10) / 10).toFixed(1), 48, 140, 14, DARK);
    const progress = m.rankProgress();
    const next = m.data.rank >= 18 ? '大师认证已完成' : (progress.needsClear && progress.requiredScore <= 0 ? '完成一次通关晋升大师' : (progress.requiredScore > 100 ? '先提升前两席成绩' : '再打出 ' + progress.requiredScore + ' 分晋升'));
    txt(next + (s.promoted ? ' · 已晋升 ' + m.rankInfo(s.newRank).name : ''), 48, 162, 13, PURPLE, 'left', true);
    [['skills', '技能'], ['affixes', '词条'], ['equipment', '装备'], ['damage', '伤害']].forEach(([id, name], i) => button({ x: 48 + i * 140, y: 174, w: 124, h: 34 }, name, () => { m.summaryTab = id; page = 0; }, { active: m.summaryTab === id }));
    const entries = summaryEntries(), per = 6, shown = entries.slice(page * per, page * per + per);
    shown.forEach((entry, i) => {
      const col = i % 2, row = Math.floor(i / 2), r = { x: 48 + col * 602, y: 224 + row * 126, w: 570, h: 104 };
      let name = '', color = INK, desc = '', right = '';
      if (m.summaryTab === 'skills') { name = SKILL_DEFS[entry.id].name + ' Lv.' + entry.lvl; color = attrOf(entry.id); desc = window.UICopy ? window.UICopy.skillShort(entry.id) : SKILL_DEFS[entry.id].desc; right = '辅 ' + entry.supports.length + '/' + supportCap(); }
      else if (m.summaryTab === 'affixes') { name = entry.def.name + (entry.count > 1 ? ' ×' + entry.count : ''); desc = window.UICopy ? window.UICopy.affixShort(entry.def) : entry.def.desc; }
      else if (m.summaryTab === 'equipment') { const eq = entry.eq; name = ITEM_DEFS[eq.key].name; color = RARITY_LIST[rarityIndex(eq)].color; desc = window.UICopy ? window.UICopy.itemShort(eq.key, rarityIndex(eq), eq.roll) : itemDescription(eq.key, rarityIndex(eq), eq.roll); right = equipmentLevelText(eq, s.growth); }
      else { const names = { surge: '墨潮', absorb: '吸墨／弹反', dive: '潜墨', other: '其他／墨迹' }; name = (SKILL_DEFS[entry.id] && SKILL_DEFS[entry.id].name) || names[entry.id] || entry.id; color = entry.id === 'other' ? GRAY : attrOf(entry.id); right = Math.round(entry.value).toLocaleString() + ' 伤害'; desc = '伤害占比 ' + (entry.total ? (entry.value / entry.total * 100).toFixed(1) : '0.0') + '%'; }
      ctx.fillStyle = 'rgba(255,250,238,0.94)'; ctx.fillRect(r.x, r.y, r.w, r.h); jrect(r.x, r.y, r.w, r.h, color, 1.6);
      txt(name, r.x + 16, r.y + 30, 16, color, 'left', true); txt(right, r.x + r.w - 16, r.y + 29, 12, DARK, 'right');
      ctx.font = '12px ' + FONT; ctx.fillStyle = DARK; lines(desc, r.x + 16, r.y + 60, r.w - 32, 18, 2);
      if (m.summaryTab !== 'damage') hits.push({ rect: r, action: () => { if (!window.UICopy) return; if (m.summaryTab === 'skills') window.UICopy.skillDetail(entry); else if (m.summaryTab === 'affixes') window.UICopy.affixDetail(entry); else window.UICopy.itemDetail(entry.eq, entry.slot, s.growth); }, enabled: true });
    });
    if (!shown.length) txt('本局暂无记录', W / 2, 350, 17, GRAY, 'center');
    pager(entries.length, per, 590);
    button({ x: W / 2 - 150, y: 638, w: 300, h: 46 }, '下一步', () => m.continueSettlement(), { size: 16 });
  }

  function drawSettlement() {
    const m = meta(), s = m.settlement; if (!s) return;
    panel('装备装订', '墨点 +' + s.earned + ' · 装订 ' + s.selected.length + '/' + s.slots);
    txt('装备经验已全部入账，装订装备可在后续局继承。', 48, 98, 14, DARK);
    const per = 4, shown = s.found.slice(page * per, page * per + per);
    shown.forEach((eq, i) => {
      const col = i % 2, row = Math.floor(i / 2), r = { x: 48 + col * 602, y: 138 + row * 218, w: 570, h: 190 };
      const def = ITEM_DEFS[eq.key], rarity = RARITY_LIST[eq.rarity], selected = s.selected.includes(eq.uid);
      ctx.fillStyle = 'rgba(255,250,238,0.95)'; ctx.fillRect(r.x, r.y, r.w, r.h); jrect(r.x, r.y, r.w, r.h, rarity.color, selected ? 2.8 : 1.6);
      txt(def.name, r.x + 18, r.y + 34, 18, rarity.color, 'left', true);
      txt(rarity.name + ' · ' + SLOT_NAME[def.slot] + ' · ' + equipmentLevelText(eq, s.growth), r.x + 18, r.y + 60, 12, GRAY);
      ctx.font = '13px ' + FONT; ctx.fillStyle = DARK; lines(window.UICopy ? window.UICopy.itemShort(eq.key, eq.rarity, eq.roll) : itemDescription(eq.key, eq.rarity, eq.roll), r.x + 18, r.y + 92, 350, 20, 3);
      txt('部位经验 +' + eq.xp, r.x + 18, r.y + 158, 12, GRAY);
      button({ x: r.x + 410, y: r.y + 70, w: 130, h: 46 }, selected ? '已装订' : '装订', () => m.toggleSettlement(eq.uid), { enabled: selected || s.selected.length < s.slots, active: selected });
    });
    if (!shown.length) txt('本局没有新装备', W / 2, 340, 17, GRAY, 'center');
    const salvage = m.settlementSalvage();
    txt('未装订／重复普通装备回收 ' + salvage.count + ' 件 · 碎纸 +' + salvage.paper, W / 2, 120, 13, salvage.count ? PURPLE : GRAY, 'center');
    pager(s.found.length, per, 590);
    button({ x: W / 2 - 150, y: 648, w: 300, h: 44 }, '完成结算', () => m.finishSettlement(), { size: 16 });
  }

  function drawTestEnd() {
    const m = meta(); hits = [];
    ctx.fillStyle = 'rgba(255,250,238,0.97)'; ctx.fillRect(W / 2 - 300, 150, 600, 420); jrect(W / 2 - 300, 150, 600, 420, state === 'win' ? INK : RED, 2.5);
    txt(state === 'win' ? 'Boss 挑战完成' : 'Boss 挑战失败', W / 2, 230, 28, state === 'win' ? INK : RED, 'center', true);
    txt(BOSS_DEFS[(m.run.bossTestStage || 1) - 1].name + ' · 不计入局外收益', W / 2, 272, 14, GRAY, 'center');
    button({ x: W / 2 - 180, y: 326, w: 360, h: 50 }, '再次挑战', () => CharacterRuntime.requestBoss(m.run.bossTestStage || 1));
    button({ x: W / 2 - 180, y: 396, w: 360, h: 50 }, '选择其他 Boss', () => m.openBossChallenge());
    button({ x: W / 2 - 180, y: 466, w: 360, h: 50 }, '返回主界面', () => m.goHome());
  }

  function drawMeta() {
    if (!active()) return false;
    const owned = ['metaHome', 'metaRankDetails', 'metaBossChallenge', 'metaTalents', 'metaInventory', 'metaRunSummary', 'metaSettlement'].includes(state)
      || ((state === 'over' || state === 'win') && meta().run && meta().run.mode === 'bossTest');
    // 战斗、三选一和装备弹窗会继续复用各自点击区域，不能在这里清空。
    if (!owned) return false;
    clearPageOnStateChange(); hits = [];
    if (state === 'metaHome') drawHome();
    else if (state === 'metaRankDetails') drawRankDetails();
    else if (state === 'metaBossChallenge') drawBossChallenge();
    else if (state === 'metaTalents') drawTalents();
    else if (state === 'metaInventory') drawInventory();
    else if (state === 'metaRunSummary') drawSummary();
    else if (state === 'metaSettlement') drawSettlement();
    else if ((state === 'over' || state === 'win') && meta().run && meta().run.mode === 'bossTest') drawTestEnd();
    else return false;
    return true;
  }

  function drawBuild() {
    const view = window.__buildView; if (!view) return;
    hits = []; ctx.fillStyle = 'rgba(32,30,29,0.76)'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = PAPER; ctx.fillRect(40, 42, W - 80, H - 84); jrect(40, 42, W - 80, H - 84, INK, 2.4);
    txt('角色养成', 70, 88, 25, INK, 'left', true); txt('已暂停 · 点击条目查看详情', 270, 86, 13, GRAY);
    button({ x: W - 230, y: 624, w: 160, h: 38 }, '返回 Esc', () => view.close());
    [['skills', '技能'], ['affixes', '词条'], ['equipment', '装备']].forEach(([id, name], i) => button({ x: 70 + i * 150, y: 112, w: 134, h: 40 }, name, () => view.setTab(id), { active: view.tab === id }));
    const character = window.CharacterRuntime && CHARACTER_CONFIG.defs.find(c => c.id === player.characterId);
    if (character) {
      txt(character.name + ' Lv.' + player.characterLevel + ' · ' + character.title, 70, 174, 14, character.color, 'left', true);
      txt(character.short, 400, 174, 12, GRAY);
    }
    const entries = view.entries(), per = view.tab === 'affixes' ? 6 : 4, shown = entries.slice(view.page * per, view.page * per + per);
    shown.forEach((entry, i) => {
      const col = i % 2, row = Math.floor(i / 2), r = { x: 70 + col * 580, y: 196 + row * (per === 6 ? 108 : 174), w: 550, h: per === 6 ? 90 : 150 };
      let name = '', desc = '', color = INK, right = '', tag = '', iconMeta = null, equipmentIcon = null;
      if (view.tab === 'skills') { name = SKILL_DEFS[entry.id].name; desc = window.UICopy ? window.UICopy.skillShort(entry.id) : SKILL_DEFS[entry.id].desc; color = attrOf(entry.id); right = '辅 ' + entry.supports.length + '/' + supportCap(); tag = '主动 · ' + skillTagText(entry.id); iconMeta = { id: entry.id, kind: 'active', level: entry.lvl, state: entry.supports.length + '/' + supportCap() }; }
      else if (view.tab === 'affixes') { name = entry.def.name + (entry.count > 1 ? ' ×' + entry.count : ''); desc = window.UICopy ? window.UICopy.affixShort(entry.def) : entry.def.desc; }
      else { const eq = entry.eq, ri = rarityIndex(eq); name = ITEM_DEFS[eq.key].name; desc = window.UICopy ? window.UICopy.itemShort(eq.key, ri, eq.roll) : itemDescription(eq.key, ri, eq.roll); color = RARITY_LIST[ri].color; right = equipmentLevelText(eq) + ' · ' + RARITY_LIST[ri].name; equipmentIcon = eq; }
      ctx.fillStyle = 'rgba(255,250,238,0.95)'; ctx.fillRect(r.x, r.y, r.w, r.h); jrect(r.x, r.y, r.w, r.h, color, 1.7);
      const hasIcon = (iconMeta && window.SkillIconRuntime) || (equipmentIcon && window.EquipmentIconRuntime);
      if (iconMeta && window.SkillIconRuntime) SkillIconRuntime.draw(iconMeta.id, iconMeta.kind, r.x + 14, r.y + 14, 66, iconMeta);
      else if (equipmentIcon && window.EquipmentIconRuntime) {
        const level = +String(equipmentLevelText(equipmentIcon)).match(/\d+/)?.[0] || 1;
        EquipmentIconRuntime.draw(equipmentIcon, r.x + 14, r.y + 14, 66, { level });
      }
      const entryTextX = r.x + (hasIcon ? 94 : 16), entryTextW = r.w - (hasIcon ? 110 : 32);
      txt(name, entryTextX, r.y + 30, 17, color, 'left', true, entryTextW - 90); txt(right, r.x + r.w - 16, r.y + 29, 12, PURPLE, 'right');
      if (tag) drawTagChip(tag, entryTextX, r.y + 39, color, 11, entryTextW);
      ctx.font = '13px ' + FONT; ctx.fillStyle = DARK; lines(desc, entryTextX, r.y + (tag ? 76 : 62), entryTextW, 19, tag ? 2 : 3);
      txt('详情 ›', r.x + r.w - 16, r.y + r.h - 12, 11, GRAY, 'right');
      hits.push({ rect: r, action: () => { if (!window.UICopy) return; if (view.tab === 'skills') window.UICopy.skillDetail(entry); else if (view.tab === 'affixes') window.UICopy.affixDetail(entry); else window.UICopy.itemDetail(entry.eq, entry.slot); }, enabled: true });
    });
    if (!shown.length) txt('暂无内容', W / 2, 360, 18, GRAY, 'center');
    if (view.tab === 'skills' && player.characterId === 'single' && player.characterLevel >= 3) {
      button({ x: W / 2 - 100, y: 566, w: 200, h: 40 }, CharacterRuntime.state.reforgeUsed ? '本局已重铸' : '免费重铸一次辅助', () => CharacterRuntime.reforgeSupport(), { enabled: CharacterRuntime.canReforge() });
    }
    button({ x: W / 2 - 180, y: 624, w: 110, h: 38 }, '← 上一页', () => view.changePage(-1), { enabled: view.page > 0 });
    txt((view.page + 1) + ' / ' + view.pageCount, W / 2, 649, 13, DARK, 'center');
    button({ x: W / 2 + 70, y: 624, w: 110, h: 38 }, '下一页 →', () => view.changePage(1), { enabled: view.page < view.pageCount - 1 });
  }

  function drawEquipment() {
    if (!pendingEquipment) return;
    hits = []; const dr = pendingEquipment.drop, it = ITEM_DEFS[dr.item], cur = player.equip[it.slot];
    const locked = Date.now() < equipmentPickAfter, remaining = Math.max(0, (equipmentPickAfter - Date.now()) / 1000).toFixed(1);
    ctx.fillStyle = 'rgba(32,30,29,0.76)'; ctx.fillRect(0, 0, W, H); ctx.fillStyle = PAPER; ctx.fillRect(180, 72, 920, 576); jrect(180, 72, 920, 576, INK, 2.5);
    txt('捡到' + SLOT_NAME[it.slot] + '装备', W / 2, 124, 25, INK, 'center', true);
    txt(locked ? '请看清装备 · ' + remaining + ' 秒后可选择' : '点击装备卡直接选择 · 换装共用部位等级', W / 2, 154, 13, GRAY, 'center');
    [[cur, 250, '当前装备', false], [{ key: dr.item, rarity: rarityIndex(dr), roll: dr.roll }, 680, '新装备', true]].forEach(([eq, x, title, replace]) => {
      const def = ITEM_DEFS[eq.key], rarity = RARITY_LIST[rarityIndex(eq)], stats = equipmentBaseStats(eq);
      ctx.fillStyle = 'rgba(255,250,238,0.96)'; ctx.fillRect(x, 190, 350, 280); jrect(x, 190, 350, 280, rarity.color, 2.2);
      txt(title, x + 175, 224, 14, DARK, 'center'); txt(rarity.name + ' · ' + equipmentLevelText(eq), x + 175, 254, 13, rarity.color, 'center');
      if (window.EquipmentIconRuntime) {
        const level = +String(equipmentLevelText(eq)).match(/\d+/)?.[0] || 1;
        EquipmentIconRuntime.draw(eq, x + 24, 270, 62, { level });
        txt(def.name, x + 102, 301, 20, INK, 'left', true, 222);
      } else txt(def.name, x + 175, 298, 22, INK, 'center', true);
      txt('攻击 +' + stats.atk + '%　生命 +' + stats.hp, x + 175, 352, 14, DARK, 'center');
      ctx.font = '13px ' + FONT; ctx.fillStyle = DARK; lines(itemDescription(eq.key, rarityIndex(eq), eq.roll), x + 24, 382, 302, 21, 4);
      hits.push({ rect: { x, y: 190, w: 350, h: 280 }, action: () => window.__buildRuntime.resolveEquipment(replace), enabled: !locked });
    });
    button({ x: 250, y: 524, w: 350, h: 54 }, locked ? remaining + ' 秒后可选择' : '替换新装备 [1]', () => window.__buildRuntime.resolveEquipment(true), { enabled: !locked });
    button({ x: 680, y: 524, w: 350, h: 54 }, locked ? remaining + ' 秒后可选择' : '保留当前 [2]', () => window.__buildRuntime.resolveEquipment(false), { enabled: !locked, color: DARK });
  }

  function drawDetail(detail) {
    hits = []; const layout = window.UIDetail.getLayout(), p = layout.panel, r = layout.close;
    const x = p.x, y = p.y, w = p.w, h = p.h;
    ctx.fillStyle = 'rgba(25,23,22,0.74)'; ctx.fillRect(0, 0, W, H); ctx.fillStyle = PAPER; ctx.fillRect(x, y, w, h); jrect(x, y, w, h, detail.color, 2.2);
    const tagOffset = detail.tag ? 22 : 0;
    const icon = detail.icon && (detail.icon.kind === 'equipment' ? window.EquipmentIconRuntime : window.SkillIconRuntime);
    if (icon) {
      if (detail.icon.kind === 'equipment') EquipmentIconRuntime.draw(detail.icon.id, x + 22, y + 15, 62, detail.icon);
      else SkillIconRuntime.draw(detail.icon.id, detail.icon.kind, x + 22, y + 15, 62, detail.icon);
    }
    const titleX = x + (icon ? 98 : 24), titleW = w - (icon ? 122 : 48);
    txt(detail.title, titleX, y + 42, 21, detail.color, 'left', true, titleW);
    if (detail.tag) drawTagChip(detail.tag, titleX, y + 50, detail.color, 12, titleW);
    if (detail.subtitle) txt(detail.subtitle, titleX, y + 68 + tagOffset, 12, GRAY, 'left', false, titleW);
    jline(x + 24, y + 86 + tagOffset, x + w - 24, y + 86 + tagOffset, detail.color, 1.1);
    ctx.font = '13px ' + FONT; ctx.fillStyle = DARK; lines(detail.body, x + 24, y + 116 + tagOffset, w - 48, 21, 10);
    button(r, '返回  Esc', () => window.UIDetail.close());
    return r;
  }

  function drawPause() {
    hits = []; ctx.fillStyle = 'rgba(25,23,22,0.72)'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = PAPER; ctx.fillRect(W / 2 - 260, 130, 520, 470); jrect(W / 2 - 260, 130, 520, 470, INK, 2.5);
    txt('暂停', W / 2, 200, 32, INK, 'center', true); txt('这一页先停在这里', W / 2, 234, 14, GRAY, 'center');
    button({ x: W / 2 - 170, y: 284, w: 340, h: 54 }, '继续战斗  Esc', () => { state = 'play'; }, { size: 17 });
    button({ x: W / 2 - 170, y: 358, w: 340, h: 50 }, '查看角色养成  Tab', () => { state = 'play'; window.__buildView.open(); });
    button({ x: W / 2 - 170, y: 428, w: 340, h: 50 }, '游戏设置', () => SettingsRuntime.open());
    button({ x: W / 2 - 170, y: 498, w: 340, h: 50 }, '返回主界面', () => meta().goHome(), { color: RED });
  }

  function runHit(e) {
    const p = toLogical(e);
    for (let i = hits.length - 1; i >= 0; i--) if (hits[i].enabled && pointInRect(p, hits[i].rect)) { hits[i].action(); return true; }
    return false;
  }
  function handleMetaPointer(e) {
    if (!active()) return false;
    if (meta().confirmDefeat()) return true;
    const states = ['metaHome', 'metaRankDetails', 'metaBossChallenge', 'metaTalents', 'metaInventory', 'metaRunSummary', 'metaSettlement'];
    if (!states.includes(state) && !((state === 'over' || state === 'win') && meta().run && meta().run.mode === 'bossTest')) return false;
    runHit(e); return true;
  }
  function handleBuildPointer(e) { if (!active() || state !== 'build') return false; runHit(e); return true; }
  function handleEquipmentPointer(e) { if (!active() || state !== 'equipment') return false; runHit(e); return true; }

  const baseRender = render;
  render = function() {
    baseRender();
    if (!active()) return;
    if (state === 'desktopPause') drawPause();
  };
  canvas.addEventListener('pointerdown', e => {
    if (!active()) return;
    if (state === 'desktopPause') {
      e.preventDefault(); e.stopImmediatePropagation(); runHit(e); return;
    }
    if (state !== 'play' || e.pointerType === 'touch' || (e.button !== 0 && e.button !== 2)) return;
    const p = toLogical(e);
    // 保留潜墨与养成按钮自身行为，其余战斗区域使用鼠标技能快捷键。
    if (pointInRect(p, diveRect) || pointInRect(p, buildRect)) return;
    e.preventDefault(); e.stopImmediatePropagation();
    if (player.characterId === 'idle') return;
    if (e.button === 0) castAbsorb();
    else if (startInkSurgeCharge(e.pointerId) && canvas.setPointerCapture) canvas.setPointerCapture(e.pointerId);
  }, true);
  window.addEventListener('keydown', e => {
    if (!active() || e.defaultPrevented) return;
    if (e.key === 'Tab') {
      if (state === 'desktopPause') { state = 'play'; window.__buildView.open(); }
      else window.__buildView.open();
      e.preventDefault(); e.stopImmediatePropagation(); return;
    }
    if (e.key === 'Escape') {
      if (state === 'desktopPause') state = 'play';
      else if (state === 'play') {
        if (player.surgeCharging) cancelInkSurgeCharge(player.surgePointerId);
        joy.active = false; for (const key of Object.keys(keys)) keys[key] = false; state = 'desktopPause';
      } else return;
      e.preventDefault(); e.stopImmediatePropagation();
    }
  }, true);
  window.addEventListener('blur', () => {
    if (active() && state === 'play') {
      joy.active = false; for (const key of Object.keys(keys)) keys[key] = false; state = 'desktopPause';
    }
  });

  window.DesktopRuntime = {
    drawMeta, handleMetaPointer, drawBuild, handleBuildPointer, drawEquipment, handleEquipmentPointer, drawDetail,
    get active() { return active(); }
  };
  updateControls();
})();

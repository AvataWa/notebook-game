/* 乱线猎手：Boss 专属掉落、永久材料、五部位配置与尾刺套装。 */
(() => {
  'use strict';
  const SET = 'scribble';
   const GOLD_KEYS = ['tailgrip', 'lineboots', 'scribblecrown', 'scribblehide', 'huntergall'];
  const ALL_KEYS = [...GOLD_KEYS];
  const COL = '#8b52b5', GOLD = '#c28a24';
  const CRAFT_COST = { ink: 80, cores: 4, horns: 1 };
  // 各主动的一次代表性基础命中；尾刺只取一次，不随弹数、复放或持续 tick 重复生成。
  const BASE_HIT = {
    cyclone: 11, volcanic: 26, tornado: 15, chainclip: 13, arc: 22, spark: 12,
    ballista: 12, boomerang: 18, vortex: 10, candle: 7, icespear: 30, inkrain: 8,
    ruler: 22, chalk: 45, pinburst: 12, brand: 9, cola: 20,
    bloodcore: 34, doommark: 24, shieldrush: 28, starfall: 30
  };
  const S = {
    charge: 0, distance: 0, hurtBoostT: 0, tails: [], echoes: [], lastSetCount: 0,
    castRefunds: Object.create(null),
    tab: 'loadout', slot: 'head', page: 0, message: '', hits: [], craftKey: 'scribblecrown', craftOpen: false
  };
  const meta = () => window.__metaRuntime;
  const data = () => meta() && meta().data.bossSets ? meta().data.bossSets.scribble : null;
  const clone = obj => JSON.parse(JSON.stringify(obj));
  const roll = (min = 50) => Math.max(50, Math.min(100, Math.floor(min + Math.random() * (101 - min))));
  const isSetItem = key => !!(ITEM_DEFS[key] && ITEM_DEFS[key].bossSet === SET);

  function spawnBossRewards(enemy) {
    if (!enemy || enemy.stage !== 1) return false;
    const m = meta(), d = data();
    if (!m || !m.run || m.run.mode === 'bossTest' || !d) return false;
    // 五件金装全部改为制作，Boss 只掉落通用与专属制作材料。
    const cores = 2 + (enemy.bossTookHit ? 0 : 1);
    drops.push({ kind: 'material', bossSet: SET, material: 'cores', amount: cores, x: enemy.x - 34, y: enemy.y + 24, bob: 1.7 });
    const horn = !d.firstHorn || d.hornDry >= 2 || Math.random() < 0.35;
    d.kills++;
    if (horn) {
      drops.push({ kind: 'material', bossSet: SET, material: 'horns', amount: 1, x: enemy.x + 34, y: enemy.y + 24, bob: 3.4 });
      d.firstHorn = true; d.hornDry = 0;
    } else d.hornDry = Math.min(2, d.hornDry + 1);
    m.save();
    return true;
  }

  function collectMaterial(dr) {
    const d = data();
    if (!dr || dr.kind !== 'material' || dr.bossSet !== SET || !d || !['cores', 'horns'].includes(dr.material)) return false;
    const amount = Math.max(1, Math.floor(dr.amount || 1));
    d[dr.material] = Math.min(999999, (d[dr.material] || 0) + amount);
    drops = drops.filter(x => x !== dr);
    meta().save();
    const name = dr.material === 'cores' ? '领主墨核' : '乱线残角';
    floats.push({ x: dr.x, y: dr.y - 18, txt: name + ' +' + amount, t: 1.1, color: dr.material === 'cores' ? COL : GOLD });
    toast(name + ' +' + amount + ' · 已收入文具盒');
    return true;
  }

  function onEquipmentCollected(dr) {
    const m = meta();
    if (!m || !dr || dr.bossSet !== SET || !isSetItem(dr.item)) return false;
    const added = m.addInventory({ key: dr.item, rarity: dr.rarity, roll: dr.roll });
    m.save();
    return added;
  }

  function owned(key) { return meta() && meta().data.inventory.find(eq => eq.key === key); }
  function syncLoadout(eq) {
    const m = meta(), slot = ITEM_DEFS[eq.key].slot, current = m.data.loadout[slot];
    if (current && current.key === eq.key) m.data.loadout[slot] = clone(eq);
    if (m.data.inherited && m.data.inherited.key === eq.key) m.data.inherited = clone(eq);
  }
  function toggleEquip(key) {
    const m = meta(), eq = owned(key);
    if (!m || !eq) return false;
    const slot = ITEM_DEFS[key].slot, current = m.data.loadout[slot];
    if (current && current.key === key) {
      m.data.loadout[slot] = null;
      if (m.data.inherited && m.data.inherited.key === key) m.data.inherited = null;
      S.message = '已卸下 ' + ITEM_DEFS[key].name;
    } else {
      m.data.loadout[slot] = clone(eq); m.data.inherited = clone(eq);
      S.message = '下局穿戴 ' + ITEM_DEFS[key].name + ' · Lv.1';
    }
    m.save(); return true;
  }
  function craftInkCost() {
    const m = meta();
    const crafted = m ? m.data.inventory.filter(eq => ITEM_DEFS[eq.key] && ITEM_DEFS[eq.key].bossSet).length : 0;
    return crafted < 5 ? 40 : CRAFT_COST.ink;
  }
  function craft(key) {
    const m = meta(), d = data(), inkCost = craftInkCost();
    if (!m || !d || !GOLD_KEYS.includes(key)) return false;
    if (owned(key)) { S.message = '这件金装已经制作过了'; return false; }
    if (m.data.ink < inkCost || d.cores < CRAFT_COST.cores || d.horns < CRAFT_COST.horns) {
      S.message = '材料不足：需要墨点 ' + inkCost + '、乱线残角 1、领主墨核 4'; return false;
    }
    m.data.ink -= inkCost; d.cores -= CRAFT_COST.cores; d.horns -= CRAFT_COST.horns;
    const eq = { key, rarity: 3, roll: roll(), rerollFloor: 50 };
    m.addInventory(eq); m.save();
    S.message = '制作完成：' + ITEM_DEFS[key].name + ' · 词条 ' + eq.roll + '%';
    return true;
  }
  function reroll(key) {
    const m = meta(), d = data(), eq = owned(key);
    if (!m || !d || !eq || !isSetItem(key)) return false;
    if (eq.roll >= 100) { S.message = '词条已经完美'; return false; }
    if (d.horns < 1) { S.message = '需要 1 个乱线残角'; return false; }
    d.horns--;
    const before = eq.roll, next = roll(Math.max(50, eq.rerollFloor || 50));
    if (next <= before) {
      eq.rerollFloor = Math.min(100, before + 5);
      S.message = '重描没有提升 · 下次至少 ' + eq.rerollFloor + '%';
    } else {
      eq.roll = next; eq.rerollFloor = 50;
      S.message = '重描成功：' + before + '% → ' + next + '%';
    }
    syncLoadout(eq); m.save(); return true;
  }
  function perfectSet() { return ALL_KEYS.every(key => owned(key) && owned(key).roll >= 100); }
  function exchange() {
    const m = meta(), d = data();
    if (!m || !d || !perfectSet()) { S.message = '全套词条达到 100% 后开放兑换'; return false; }
    if (d.horns < 1) { S.message = '需要 1 个乱线残角'; return false; }
    d.horns--; d.cores += 2; m.save(); S.message = '乱线残角 1 → 领主墨核 2'; return true;
  }

  function setCount(equipment) {
    const eq = equipment || (typeof player !== 'undefined' && player ? player.equip : null);
    if (!eq) return 0;
    let count = 0;
    for (const slot of SLOTS) if (eq[slot] && isSetItem(eq[slot].key)) count++;
    return count;
  }
  function spawnTail(a, c) {
    if (S.tails.length >= 24) S.tails.shift();
    const target = nearestEnemy(player.x, player.y, 650);
    const angle = target ? Math.atan2(target.y - player.y, target.x - player.x) : player.faceA;
    const headMul = 1 + itemV('scribblecrown', 'tailDmg') / 100;
    const damage = (BASE_HIT[a.id] || 20) * c.dmg * 1.4 * headMul;
    S.tails.push({ x: player.x, y: player.y - 5, vx: Math.cos(angle) * 720, vy: Math.sin(angle) * 720,
      life: 0.95, damage, hitIds: new Set(), inkReturned: 0, reflected: false, angle });
    novas.push({ x: player.x, y: player.y, t: 0.24, max: 38, col: COL });
    floats.push({ x: player.x, y: player.y - 40, txt: '满层尾刺', t: 0.7, color: COL, crit: true });
  }
  function reflectTail(tail, target) {
    let next = null, best = 480 * 480;
    for (const e of enemies) {
      if (e.dead || tail.hitIds.has(e.id)) continue;
      const d2 = (e.x - target.x) ** 2 + (e.y - target.y) ** 2;
      if (d2 < best) { best = d2; next = e; }
    }
    const damage = tail.damage * (next ? 0.7 : (target.boss ? 0.5 : 0));
    const end = next || target;
    if (S.echoes.length >= 24) S.echoes.shift();
    S.echoes.push({ x1: target.x, y1: target.y, x2: end.x, y2: end.y, t: 0.22, total: 0.22 });
    if (damage > 0) hurtEnemy(end, damage, 0, target.x, target.y, 0, -1, 0, COL, false, 'scribbleEcho');
  }
  function updateTails(dt) {
    for (let i = S.tails.length - 1; i >= 0; i--) {
      const tail = S.tails[i], ox = tail.x, oy = tail.y;
      tail.x += tail.vx * dt; tail.y += tail.vy * dt; tail.life -= dt;
      for (const e of enemies) {
        if (e.dead || tail.hitIds.has(e.id)) continue;
        if (pointSegDist({ x: e.x, y: e.y }, { x: ox, y: oy }, { x: tail.x, y: tail.y }) > e.r + 11) continue;
        tail.hitIds.add(e.id);
        hurtEnemy(e, tail.damage, 0, ox, oy, 0, -1, 0, COL, false, 'scribbleTail');
        if (setCount() >= 3) e.scribbleMarkT = gameTime + 3;
        if (hasItem('huntergall') && tail.inkReturned < 10) {
          const amount = Math.min(10 - tail.inkReturned, itemV('huntergall', 'ink'));
          tail.inkReturned += amount;
          const gained = refundInk(amount);
          addPlayerInkFloat(gained, COL);
        }
        if (setCount() >= 5 && !tail.reflected) { tail.reflected = true; reflectTail(tail, e); }
      }
      if (tail.life <= 0) S.tails.splice(i, 1);
    }
    for (let i = S.echoes.length - 1; i >= 0; i--) {
      S.echoes[i].t -= dt; if (S.echoes[i].t <= 0) S.echoes.splice(i, 1);
    }
  }

  const baseSkillCalc = skillCalc;
  skillCalc = function(a) {
    const c = baseSkillCalc(a);
    if (hasItem('scribblecrown')) c.dmg *= 1 + itemV('scribblecrown', 'activeDmg') / 100;
    if (S.charge > 0 && setCount() > 0) {
      c.scribbleCharge = S.charge;
      if (hasItem('tailgrip')) c.dmg *= 1 + S.charge * itemV('tailgrip', 'chargeDmg') / 100;
    }
    return c;
  };
  const baseFireSkill = fireSkill;
  fireSkill = function(a, c) {
    if (hasItem('huntergall')) S.castRefunds[a.id] = true;
    if (c.scribbleCharge > 0 && !c.scribbleConsumed) {
      const charges = c.scribbleCharge;
      c.scribbleConsumed = true;
      S.charge = 0; S.distance = 0;
      if (charges >= 5 && setCount() >= 2) spawnTail(a, c);
    }
    return baseFireSkill(a, c);
  };
  const baseHurtEnemy = hurtEnemy;
  hurtEnemy = function(e, dmg, ...rest) {
    if (e.scribbleMarkT > gameTime) dmg *= 1.15;
    const skillId = rest[8];
    if (hasItem('huntergall') && skillId && S.castRefunds[skillId]) {
      delete S.castRefunds[skillId];
      refundInk(itemV('huntergall', 'castInk'), e.x, e.y - e.r - 12, '猎手回墨');
    }
    return baseHurtEnemy(e, dmg, ...rest);
  };
  const baseHurtPlayer = hurtPlayer;
  hurtPlayer = function(dmg, ...rest) {
    if (hasItem('scribblehide') && S.hurtBoostT > 0) dmg *= 1 - itemV('scribblehide', 'hurtDr') / 100;
    const oldHp = player.hp, oldHurt = player.hurtT;
    const result = baseHurtPlayer(dmg, ...rest);
    if (hasItem('scribblehide') && (player.hp < oldHp || player.hurtT > oldHurt)) S.hurtBoostT = 3;
    return result;
  };
  const baseUpdate = update;
  update = function(dt) {
    if (state !== 'play') return baseUpdate(dt);
    const oldX = player.x, oldY = player.y;
    const speedBoost = hasItem('scribblehide') && S.hurtBoostT > 0 ? 1 + itemV('scribblehide', 'hurtBoost') / 100 : 1;
    player.eqSpd *= speedBoost;
    baseUpdate(dt);
    player.eqSpd /= speedBoost;
    if (state !== 'play') return;
    S.hurtBoostT = Math.max(0, S.hurtBoostT - dt);
    const count = setCount(), moved = Math.hypot(player.x - oldX, player.y - oldY);
    if (count > 0 && S.charge < 5 && moved > 0) {
      const efficiency = hasItem('scribblehide') && S.hurtBoostT > 0 ? 1 + itemV('scribblehide', 'hurtBoost') / 100 : 1;
      S.distance += moved * efficiency;
      while (S.distance >= 120 && S.charge < 5) { S.distance -= 120; S.charge++; }
      if (S.charge >= 5) S.distance = 0;
    }
    if (count === 0) { S.charge = 0; S.distance = 0; }
    if (count < S.lastSetCount && S.lastSetCount >= 2) toast('乱线套装件数不足 · 套装效果已失效');
    S.lastSetCount = count;
    updateTails(dt);
  };
  const baseResetGame = resetGame;
  resetGame = function() {
    baseResetGame();
    S.charge = 0; S.distance = 0; S.hurtBoostT = 0; S.lastSetCount = 0;
    S.castRefunds = Object.create(null);
    S.tails.length = 0; S.echoes.length = 0;
  };

  function drawCombat() {
    for (const tail of S.tails) {
      const speed = Math.hypot(tail.vx, tail.vy) || 1, nx = -tail.vy / speed, ny = tail.vx / speed;
      const bx = tail.x - tail.vx * 0.055, by = tail.y - tail.vy * 0.055;
      jline(bx, by, tail.x, tail.y, COL, 5);
      jline(bx + nx * 7, by + ny * 7, tail.x, tail.y, COL, 2);
      jline(bx - nx * 7, by - ny * 7, tail.x, tail.y, COL, 2);
    }
    for (const echo of S.echoes) {
      ctx.globalAlpha = echo.t / echo.total;
      jline(echo.x1, echo.y1, echo.x2, echo.y2, COL, 3); ctx.globalAlpha = 1;
    }
    for (const e of enemies) if (!e.dead && e.scribbleMarkT > gameTime) {
      jline(e.x - 7, e.y - e.r - 8, e.x + 7, e.y - e.r + 4, COL, 1.5);
      jline(e.x + 7, e.y - e.r - 8, e.x - 7, e.y - e.r + 4, COL, 1.5);
    }
    if (setCount() > 0) for (let i = 0; i < 5; i++) {
      const x = player.x - 20 + i * 10, y = player.y - 48;
      jline(x, y, x + 5, y - (i < S.charge ? 9 : 4), i < S.charge ? COL : GRAY, 2);
    }
  }
  const previousExtras = window.__drawWorldExtras;
  window.__drawWorldExtras = function() { if (previousExtras) previousExtras(); drawCombat(); };

  /* 局外文具盒：手机与桌面共用操作逻辑，仅改变排版。 */
  function txt(value, x, y, size = 12, color = DARK, align = 'left', bold = false, maxWidth) {
    ctx.fillStyle = color; ctx.textAlign = align; ctx.font = (bold ? 'bold ' : '') + size + 'px ' + FONT;
    ctx.fillText(String(value), x, y, maxWidth);
  }
  function wrap(value, x, y, width, lineHeight = 14, maxLines = 2, size = 10, color = DARK) {
    ctx.font = size + 'px ' + FONT; ctx.fillStyle = color; ctx.textAlign = 'left';
    const lines = []; let line = '';
    for (const ch of String(value || '')) {
      if (line && ctx.measureText(line + ch).width > width) { lines.push(line); line = ch; } else line += ch;
    }
    if (line) lines.push(line);
    lines.slice(0, maxLines).forEach((s, i) => ctx.fillText(s, x, y + i * lineHeight));
  }
  function button(rect, label, action, enabled = true, active = false, color = INK, size = 11) {
    ctx.fillStyle = active ? 'rgba(215,205,235,0.92)' : 'rgba(255,250,238,0.96)'; ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    jrect(rect.x, rect.y, rect.w, rect.h, enabled ? color : GRAY, active ? 2.4 : 1.5);
    txt(label, rect.x + rect.w / 2, rect.y + rect.h / 2 + 4, size, enabled ? color : GRAY, 'center', true, rect.w - 8);
    S.hits.push({ rect, action, enabled });
  }
  function panel(title, subtitle, desktop) {
    ctx.fillStyle = PAPER; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(90,150,200,0.15)'; ctx.lineWidth = 1;
    for (let y = 82; y < H; y += 28) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
    txt(title, desktop ? 48 : 20, 44, desktop ? 26 : 22, INK, 'left', true);
    if (subtitle) txt(subtitle, W - (desktop ? 48 : 20), 43, desktop ? 13 : 10, GRAY, 'right');
  }
  function itemName(eq) {
    const def = ITEM_DEFS[eq.key];
    return def.name + (isSetItem(eq.key) ? ' · ' + eq.roll + '%' : '');
  }
  function drawLoadout(desktop) {
    const m = meta(), margin = desktop ? 48 : 18, gap = desktop ? 14 : 6;
    const slotW = (W - margin * 2 - gap * 4) / 5, y = desktop ? 128 : 132;
    const defaultKeys = { head: 'crown', body: 'cloak', hands: 'glove', feet: 'shoes', acc: 'pendant' };
    SLOTS.forEach((slot, i) => {
      const eq = m.data.loadout[slot], r = { x: margin + i * (slotW + gap), y, w: slotW, h: desktop ? 72 : 62 };
      const owned = m.data.inventory.filter(item => ITEM_DEFS[item.key].slot === slot)
        .sort((a, b) => b.rarity - a.rarity || (b.roll || 0) - (a.roll || 0));
      const shownEq = eq || owned[0], stateText = eq ? '已穿' : (owned.length ? owned.length + '件' : '空');
      const icons = window.EquipmentIconRuntime;
      if (icons) {
        const color = shownEq ? RARITY_LIST[shownEq.rarity].color : GRAY;
        ctx.fillStyle = S.slot === slot ? 'rgba(215,205,235,0.92)' : 'rgba(255,250,238,0.96)'; ctx.fillRect(r.x, r.y, r.w, r.h);
        jrect(r.x, r.y, r.w, r.h, color, S.slot === slot ? 2.4 : 1.5);
        if (desktop) {
          icons.draw(shownEq || { key: defaultKeys[slot] }, r.x + 8, r.y + 11, 48, { showLevel: !!eq, disabled: !shownEq });
          txt(SLOT_NAME[slot] + ' · ' + stateText, r.x + 66, r.y + 28, 13, shownEq ? DARK : GRAY, 'left', true);
          txt(eq ? ITEM_DEFS[eq.key].name : (owned.length ? '未穿戴' : '未装备'), r.x + 66, r.y + 49, 11, shownEq ? DARK : GRAY, 'left', false, r.w - 74);
        } else {
          icons.draw(shownEq || { key: defaultKeys[slot] }, r.x + r.w / 2 - 18, r.y + 3, 36, { showLevel: !!eq, disabled: !shownEq });
          txt(SLOT_NAME[slot] + '·' + stateText, r.x + r.w / 2, r.y + 55, 9, shownEq ? DARK : GRAY, 'center', true, r.w - 4);
        }
        S.hits.push({ rect: r, action: () => { S.slot = slot; S.page = 0; }, enabled: true });
      } else {
        button(r, SLOT_NAME[slot] + '·' + stateText, () => { S.slot = slot; S.page = 0; }, true, S.slot === slot, shownEq ? RARITY_LIST[shownEq.rarity].color : GRAY, desktop ? 13 : 11);
        txt(eq ? ITEM_DEFS[eq.key].name : (owned.length ? '未穿戴' : '未装备'), r.x + r.w / 2, y + (desktop ? 49 : 43), desktop ? 11 : 9, shownEq ? DARK : GRAY, 'center', false, r.w - 8);
      }
    });
    const entries = m.data.inventory.filter(eq => ITEM_DEFS[eq.key].slot === S.slot)
      .slice().sort((a, b) => b.rarity - a.rarity || (b.roll || 0) - (a.roll || 0));
    const per = desktop ? 6 : 3, pages = Math.max(1, Math.ceil(entries.length / per));
    S.page = Math.max(0, Math.min(S.page, pages - 1));
    const shown = entries.slice(S.page * per, S.page * per + per);
    const cols = desktop ? 2 : 1, cardGap = desktop ? 16 : 10, startY = desktop ? 222 : 216;
    const cardW = desktop ? (W - margin * 2 - cardGap) / 2 : W - margin * 2, cardH = desktop ? 112 : 96;
    shown.forEach((eq, i) => {
      const col = i % cols, row = Math.floor(i / cols), x = margin + col * (cardW + cardGap), cy = startY + row * (cardH + cardGap);
      const rarity = RARITY_LIST[eq.rarity], current = m.data.loadout[S.slot] && m.data.loadout[S.slot].key === eq.key;
      ctx.fillStyle = 'rgba(255,250,238,0.94)'; ctx.fillRect(x, cy, cardW, cardH); jrect(x, cy, cardW, cardH, rarity.color, current ? 2.6 : 1.5);
      const icons = window.EquipmentIconRuntime, iconSize = desktop ? 58 : 50;
      if (icons) icons.draw(eq, x + 10, cy + 17, iconSize, { level: 1 });
      const bx = x + cardW - (desktop ? 154 : 140), bw = desktop ? 142 : 128;
      const textX = x + (icons ? iconSize + 20 : 12), textW = bx - textX - 10;
      txt(itemName(eq), textX, cy + 23, desktop ? 14 : 12, rarity.color, 'left', true, textW);
      txt(rarity.name + ' · Lv.1', textX, cy + 42, 9, GRAY);
      wrap(itemDescription(eq.key, eq.rarity, eq.roll), textX, cy + 61, textW, 14, 2, desktop ? 11 : 9);
      button({ x: bx, y: cy + 12, w: bw, h: 30 }, current ? '卸下' : '穿戴', () => toggleEquip(eq.key), true, current, INK, 11);
      if (isSetItem(eq.key)) button({ x: bx, y: cy + 50, w: bw, h: 30 }, eq.roll >= 100 ? '词条完美' : '重描 · 残角 1', () => reroll(eq.key), eq.roll < 100 && data().horns > 0, false, COL, 10);
      else button({ x: bx, y: cy + 50, w: bw, h: 30 }, '重铸', () => { if (!m.reforge(eq.key, eq.rarity)) S.message = '无法重铸：检查碎纸或收藏'; }, true, false, GRAY, 10);
      S.hits.push({ rect: { x, y: cy, w: cardW - bw - 20, h: cardH }, enabled: true, action: () => { if (window.UICopy) UICopy.itemDetail(eq, S.slot, m.data.equipment); } });
    });
    if (!shown.length) txt('这个部位还没有装备', W / 2, startY + 100, 13, GRAY, 'center');
    if (pages > 1) {
      const py = desktop ? 620 : 540;
      button({ x: margin, y: py, w: 90, h: 32 }, '上一页', () => S.page--, S.page > 0);
      txt((S.page + 1) + ' / ' + pages, W / 2, py + 21, 11, DARK, 'center');
      button({ x: W - margin - 90, y: py, w: 90, h: 32 }, '下一页', () => S.page++, S.page < pages - 1);
    }
  }
  const SET_BY_SLOT = { head: 'scribblecrown', body: 'scribblehide', hands: 'tailgrip', feet: 'lineboots', acc: 'huntergall' };

  /* 制作页统一隐藏局外等级和部位角标；词条数值仍取实时存档。 */
  function drawSetItemIcon(key, cx, cy, size, color) {
    if (window.EquipmentIconRuntime) {
      const eq = owned(key);
      EquipmentIconRuntime.draw({ key, roll: eq && eq.roll }, cx - size / 2, cy - size / 2, size,
        { showLevel: false, showType: false });
      return;
    }
    ctx.fillStyle = PAPER; ctx.fillRect(cx - size / 2, cy - size / 2, size, size);
    jrect(cx - size / 2, cy - size / 2, size, size, color, 1.5);
    txt(SLOT_NAME[ITEM_DEFS[key].slot], cx, cy + 4, Math.max(9, size * .2), color, 'center', true);
  }
  function drawMaterialIcon(kind, cx, cy, size, color) {
    if (kind === 'ink') {
      ctx.fillStyle = color; ctx.beginPath(); ctx.arc(cx, cy, size * 0.34, 0, Math.PI * 2); ctx.fill();
      jline(cx - size * 0.45, cy + size * 0.42, cx + size * 0.45, cy + size * 0.42, color, 1.4);
    } else if (kind === 'cores') {
      ctx.strokeStyle = color; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(cx, cy, size * 0.38, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(cx, cy, size * 0.17, 0, Math.PI * 2); ctx.stroke();
    } else {
      jline(cx - size * 0.32, cy + size * 0.35, cx, cy - size * 0.4, color, 2.4);
      jline(cx, cy - size * 0.4, cx + size * 0.32, cy + size * 0.35, color, 2.4);
      jline(cx - size * 0.32, cy + size * 0.35, cx + size * 0.32, cy + size * 0.35, color, 1.4);
    }
  }
  function craftSelectionGrid(rect, desktop) {
    const compact = !desktop && rect.w < 290;
    txt('乱线猎手 · 装备', rect.x, rect.y + 18, desktop ? 16 : 12, COL, 'left', true, rect.w - 62);
    txt('点选详情', rect.x + rect.w, rect.y + 17, desktop ? 11 : 8, GRAY, 'right');
    const rowH = desktop ? 62 : 57, gap = desktop ? 9 : 7, startY = rect.y + 34;
    SLOTS.forEach((slot, i) => {
      const key = SET_BY_SLOT[slot], def = ITEM_DEFS[key], eq = owned(key);
      const gold = GOLD_KEYS.includes(key), rarity = RARITY_LIST[gold ? 3 : 2];
      const equipped = meta().data.loadout[slot] && meta().data.loadout[slot].key === key;
      const r = { x: rect.x, y: startY + i * (rowH + gap), w: rect.w, h: rowH };
      ctx.fillStyle = 'rgba(255,250,238,0.94)'; ctx.fillRect(r.x, r.y, r.w, r.h);
      jrect(r.x, r.y, r.w, r.h, rarity.color, 1.4);
      const iconSize = desktop ? 48 : (compact ? 38 : 43);
      drawSetItemIcon(key, r.x + 8 + iconSize / 2, r.y + rowH / 2, iconSize, rarity.color);
      const tx = r.x + iconSize + 16;
      txt(def.name, tx, r.y + (desktop ? 25 : 22), desktop ? 14 : (compact ? 11 : 12), rarity.color, 'left', true,
        rect.w - iconSize - (compact ? 101 : 122));
      txt(SLOT_NAME[slot] + ' · ' + (gold ? '金色制作' : '紫色掉落'), tx, r.y + (desktop ? 46 : 41), desktop ? 11 : (compact ? 8 : 9), GRAY);
      txt(equipped ? '已穿戴' : (eq ? '已拥有·' + eq.roll + '%' : '未拥有'), r.x + r.w - 9,
        r.y + rowH / 2 + 4, desktop ? 12 : (compact ? 9 : 10), equipped ? INK : (eq ? rarity.color : GRAY), 'right', true);
      S.hits.push({ rect: r, enabled: true, action: () => {
        S.craftKey = key; S.craftOpen = true; S.message = '';
      } });
    });
    const footY = startY + 5 * (rowH + gap) + 4;
    if (perfectSet()) button({ x: rect.x, y: footY - 5, w: rect.w, h: 28 }, '残角 1 → 墨核 2', exchange, data().horns > 0, false, GOLD, 9);
    else txt('5 件金色装备 · 全部制作', rect.x, footY + 10, desktop ? 11 : 8, GRAY);
  }
  function drawCraftSetSummary(rect, desktop, sectionY) {
    const summaries = window.BossCollectionRuntime && BossCollectionRuntime.setById.scribble ? BossCollectionRuntime.setById.scribble.summary : [
      '2 件：移动积累乱线充能，满 5 层后下次主动技能生成 140% 贯穿尾刺',
      '3 件：尾刺附加 3 秒受伤 +15% 标记',
      '5 件：70% 折射；无其他目标时 Boss 追加 50%'
    ];
    const pad = desktop ? 22 : 14, n = setCount(meta().data.loadout), setY = sectionY + (desktop ? 125 : 118);
    txt('乱线猎手 · 当前穿戴 ' + n + '/5', rect.x + pad, setY, desktop ? 13 : 11, n ? COL : GRAY, 'left', true);
    summaries.forEach((line, i) => {
      const active = n >= (i === 2 ? 5 : i + 2);
      wrap((active ? '● ' : '○ ') + line, rect.x + pad, setY + (desktop ? 28 : 24) + i * (desktop ? 48 : 40),
        rect.w - pad * 2, desktop ? 17 : 12, 2, desktop ? 11 : 9, active ? COL : GRAY);
    });
  }
  function craftDetail(rect, desktop) {
    const m = meta(), d = data(), key = S.craftKey, def = ITEM_DEFS[key], eq = owned(key);
    const isGold = GOLD_KEYS.includes(key), rarity = RARITY_LIST[isGold ? 3 : 2], color = isGold ? GOLD : COL;
    const pad = desktop ? 22 : 14;
    ctx.fillStyle = 'rgba(255,250,238,0.99)'; ctx.fillRect(rect.x, rect.y, rect.w, rect.h); jrect(rect.x, rect.y, rect.w, rect.h, color, eq ? 2.5 : 1.6);
    txt(def.name, rect.x + pad, rect.y + (desktop ? 34 : 25), desktop ? 20 : 15, color, 'left', true, rect.w - pad * 2 - 42);
    txt((isGold ? '金色制作' : '紫色掉落') + ' · ' + SLOT_NAME[def.slot] + (eq ? ' · 词条 ' + eq.roll + '%' : ' · 未拥有'), rect.x + pad, rect.y + (desktop ? 59 : 45), desktop ? 12 : 9, eq ? INK : GRAY);
    drawSetItemIcon(key, rect.x + pad + (desktop ? 55 : 35), rect.y + (desktop ? 132 : 96), desktop ? 88 : 54, color);
    wrap(itemDescription(key, isGold ? 3 : 2, eq ? eq.roll : 100), rect.x + pad + (desktop ? 132 : 86), rect.y + (desktop ? 105 : 80), rect.w - pad * 2 - (desktop ? 132 : 86), desktop ? 21 : 15, desktop ? 4 : 3, desktop ? 13 : 10);
    txt('固定词条 · 随机数值 50%—100%', rect.x + pad, rect.y + (desktop ? 202 : 137), desktop ? 11 : 9, GRAY);
    const sectionY = rect.y + (desktop ? 242 : 165);
    txt(isGold ? '所需材料' : (eq ? '重描材料' : '获取方式'), rect.x + pad, sectionY, desktop ? 14 : 11, INK, 'left', true);
    if (isGold) {
      txt('持有 / 需要', rect.x + rect.w - pad, sectionY, desktop ? 10 : 8, GRAY, 'right');
      const rows = [
        { kind: 'ink', name: '墨点', have: m.data.ink, need: craftInkCost() },
        { kind: 'horns', name: '乱线残角', have: d.horns, need: 1 },
        { kind: 'cores', name: '领主墨核', have: d.cores, need: 4 }
      ];
      rows.forEach((row, i) => {
        const y = sectionY + (desktop ? 35 : 25) + i * (desktop ? 39 : 27), enough = row.have >= row.need;
        drawMaterialIcon(row.kind, rect.x + pad + 9, y - 4, desktop ? 25 : 19, enough ? color : RED);
        txt(row.name, rect.x + pad + (desktop ? 32 : 26), y, desktop ? 13 : 10, enough ? DARK : RED);
        txt(row.have + ' / ' + row.need, rect.x + rect.w - pad, y, desktop ? 13 : 10, enough ? DARK : RED, 'right', true);
      });
    } else if (eq) {
      drawMaterialIcon('horns', rect.x + pad + 9, sectionY + 29, desktop ? 25 : 19, d.horns > 0 ? COL : RED);
      txt('乱线残角', rect.x + pad + (desktop ? 32 : 26), sectionY + (desktop ? 35 : 34), desktop ? 13 : 10, d.horns > 0 ? DARK : RED);
      txt(d.horns + ' / 1', rect.x + rect.w - pad, sectionY + (desktop ? 35 : 34), desktop ? 13 : 10, d.horns > 0 ? DARK : RED, 'right', true);
      txt('重描不会降低当前词条数值', rect.x + pad, sectionY + (desktop ? 76 : 61), desktop ? 11 : 9, GRAY);
    } else {
      txt('正式主线 · 乱线魔王', rect.x + pad, sectionY + (desktop ? 37 : 31), desktop ? 14 : 11, COL, 'left', true);
      wrap('击败后两件紫装随机掉落一件，走近地面装备即可永久收录。', rect.x + pad, sectionY + (desktop ? 65 : 53), rect.w - pad * 2, desktop ? 20 : 15, 2, desktop ? 12 : 9);
    }
    drawCraftSetSummary(rect, desktop, sectionY);
    const actionRect = { x: rect.x + pad, y: rect.y + rect.h - (desktop ? 62 : 53), w: rect.w - pad * 2, h: desktop ? 42 : 36 };
    if (eq) button(actionRect, eq.roll >= 100 ? '词条已完美' : '重描 · 乱线残角 1', () => reroll(key), eq.roll < 100 && d.horns > 0, false, COL, desktop ? 13 : 11);
    else if (isGold) button(actionRect, '制作 ' + def.name, () => craft(key), m.data.ink >= craftInkCost() && d.cores >= 4 && d.horns >= 1, false, GOLD, desktop ? 13 : 11);
    else button(actionRect, '仅正式主线 Boss 掉落', () => {}, false, false, COL, desktop ? 12 : 10);
    if (S.message) txt(S.message, rect.x + rect.w / 2, actionRect.y - 12, desktop ? 11 : 9, COL, 'center', false, rect.w - pad * 2);
    button({ x: rect.x + rect.w - 43, y: rect.y + 9, w: 32, h: 28 }, '×', () => {
      S.craftOpen = false; S.message = '';
    }, true, false, GRAY, 17);
  }
  function drawCraft(desktop) {
    if (!ALL_KEYS.includes(S.craftKey)) S.craftKey = 'scribblecrown';
    const margin = desktop ? 48 : 18, leftW = desktop ? 180 : 82, gap = desktop ? 14 : 8;
    craftSelectionGrid({ x: margin + leftW + gap, y: 140,
      w: W - margin * 2 - leftW - gap, h: desktop ? 430 : 405 }, desktop);
    if (!S.craftOpen) return;
    S.hits.push({ rect: { x: 0, y: 0, w: W, h: H }, enabled: true, action: () => {
      S.craftOpen = false; S.message = '';
    } });
    ctx.fillStyle = 'rgba(38,42,58,0.38)'; ctx.fillRect(0, 0, W, H);
    const rect = desktop ? { x: W / 2 - 275, y: 48, w: 550, h: 620 } : { x: 18, y: 54, w: W - 36, h: 560 };
    S.hits.push({ rect, enabled: true, action: () => {} });
    craftDetail(rect, desktop);
  }
  function drawReforgeOffers(desktop) {
    const m = meta(), offer = m.reforgeOffers; if (!offer) return;
    S.hits = [];
    const rect = desktop ? { x: W / 2 - 450, y: 140, w: 900, h: 420 } : { x: 18, y: 142, w: W - 36, h: 374 };
    ctx.fillStyle = 'rgba(16,16,16,0.62)'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = PAPER; ctx.fillRect(rect.x, rect.y, rect.w, rect.h); jrect(rect.x, rect.y, rect.w, rect.h, INK, 2.3);
    txt('选择重铸结果', W / 2, rect.y + (desktop ? 60 : 38), desktop ? 25 : 18, INK, 'center', true);
    txt(RARITY_LIST[offer.rarity].name + ' · ' + SLOT_NAME[ITEM_DEFS[offer.key].slot] + ' · 选定后消耗 ' + offer.cost + ' 碎纸',
      W / 2, rect.y + (desktop ? 96 : 63), desktop ? 14 : 10, PURPLE, 'center');
    const count = offer.candidates.length, gap = desktop ? 20 : 10, cardW = desktop ? 260 : rect.w - 36;
    const startX = desktop ? W / 2 - (count * cardW + (count - 1) * gap) / 2 : rect.x + 18;
    offer.candidates.forEach((key, i) => {
      const r = desktop ? { x: startX + i * (cardW + gap), y: rect.y + 135, w: cardW, h: 170 } :
        { x: startX, y: rect.y + 83 + i * 72, w: cardW, h: 62 };
      ctx.fillStyle = 'rgba(255,250,238,0.97)'; ctx.fillRect(r.x, r.y, r.w, r.h); jrect(r.x, r.y, r.w, r.h, INK, 1.6);
      txt((i + 1) + '. ' + ITEM_DEFS[key].name, r.x + 12, r.y + (desktop ? 34 : 23), desktop ? 18 : 13, INK, 'left', true, r.w - 24);
      wrap(itemDescription(key, offer.rarity), r.x + 12, r.y + (desktop ? 72 : 44), r.w - 24, desktop ? 21 : 12, desktop ? 3 : 1, desktop ? 13 : 9);
      S.hits.push({ rect: r, enabled: true, action: () => m.chooseReforge(i) });
    });
    button({ x: W / 2 - (desktop ? 130 : 85), y: rect.y + rect.h - (desktop ? 65 : 54), w: desktop ? 260 : 170, h: desktop ? 44 : 38 },
      '取消 · 不消耗碎纸', () => m.cancelReforge(), true, false, INK, desktop ? 13 : 10);
  }
  function drawInventory() {
    if (state !== 'metaInventory' || !meta()) return false;
    const desktop = typeof isDesktopLayout === 'function' && isDesktopLayout();
    S.hits = [];
    const d = data();
    panel('文具盒', S.tab === 'craft' ? '第 1 页 · 乱线魔王' : '', desktop);
    const tabY = 72, tabW = desktop ? 130 : 108;
    button({ x: desktop ? 48 : 24, y: tabY, w: tabW, h: 34 }, '穿戴', () => { S.tab = 'loadout'; S.page = 0; S.craftOpen = false; S.message = ''; }, true, S.tab === 'loadout');
    button({ x: (desktop ? 48 : 24) + tabW + 10, y: tabY, w: tabW, h: 34 }, '制作', () => { S.tab = 'craft'; S.page = 0; S.craftOpen = false; S.message = ''; }, true, S.tab === 'craft', GOLD);
    if (S.tab === 'craft') txt('墨核 ' + d.cores + ' · 乱线残角 ' + d.horns,
      W - (desktop ? 48 : 18), desktop ? 94 : 127, desktop ? 11 : 8, GRAY, 'right');
    if (S.tab === 'loadout') drawLoadout(desktop); else drawCraft(desktop);
    if (meta().reforgeOffers) { drawReforgeOffers(desktop); return true; }
    if (S.tab === 'craft' && S.craftOpen) return true;
    if (S.message) txt(S.message, W / 2, desktop ? 625 : 594, desktop ? 12 : 10, COL, 'center', false, W - 150);
    const backW = desktop ? 100 : 82, backX = W - (desktop ? 48 : 18) - backW;
    button({ x: backX, y: desktop ? 656 : 620, w: backW, h: 32 }, '返回', () => { S.message = ''; meta().goHome(); }, true, false, INK, 11);
    return true;
  }
  function handlePointer(e) {
    if (state !== 'metaInventory') return false;
    const p = toLogical(e);
    for (let i = S.hits.length - 1; i >= 0; i--) {
      const hit = S.hits[i];
      if (!pointInRect(p, hit.rect)) continue;
      if (hit.enabled && hit.action) hit.action();
      return true;
    }
    return true;
  }

  window.BossSetRuntime = {
    spawnBossRewards, collectMaterial, onEquipmentCollected, craft, craftInkCost, reroll, toggleEquip, exchange,
    setCount, spawnTail, updateTails, drawInventory, drawReforgeOffers, handlePointer,
    get state() { return S; }, get perfectSet() { return perfectSet; }
  };
})();

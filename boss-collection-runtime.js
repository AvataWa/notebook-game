/* 其余 19 套 Boss 装备：统一奖励、制作、战斗事件、实体与文具盒。 */
(() => {
  'use strict';
  const Legacy = window.BossSetRuntime || null;
  const C = typeof BOSS_SET_COLLECTION !== 'undefined' ? BOSS_SET_COLLECTION : { list: [], byId: {}, byStage: {}, baseHit: {} };
  const SCRIBBLE = { id: 'scribble', stage: 1, boss: '乱线魔王', name: '乱线猎手', color: '#8b52b5', special: '乱线残角',
    keys: { hands: 'tailgrip', feet: 'lineboots', head: 'scribblecrown', body: 'scribblehide', acc: 'huntergall' },
    purple: [], gold: ['tailgrip', 'lineboots', 'scribblecrown', 'scribblehide', 'huntergall'],
    all: ['tailgrip', 'lineboots', 'scribblecrown', 'scribblehide', 'huntergall'], summary: [
      '2 件：移动积累乱线充能，满 5 层后下次主动技能生成 140% 贯穿尾刺',
      '3 件：尾刺附加 3 秒受伤 +15% 标记',
      '5 件：70% 折射；无其他目标时 Boss 追加 50%'
    ] };
  const sets = [SCRIBBLE, ...C.list], setById = Object.assign({ scribble: SCRIBBLE }, C.byId);
  const hooks = Object.create(null), states = Object.create(null), lastCasts = Object.create(null);
  const U = { selected: 'scribble', hits: [], setPage: 0 };
  const FX = { delays: [], lines: [], zones: [], projectiles: [] };
  const FIRST_HIT_ACC = new Set(['judgeseal', 'knightbadge', 'abyssgall', 'mantisgall']);
  const FOURTH_CAST_ACC = new Set(['tapecore', 'dragonorb', 'origamiheart', 'flowergall', 'featherheart']);
  const GRAY_ACC = new Set(['elementcore', 'eraserpack']);
  const DIVE_ACC = new Set(['feralbell', 'blindgall']);
  const HURT_BODIES = new Set(['tapearmor', 'dragonhide', 'knightarmor', 'origamiarmor', 'eraserarmor', 'abyssarmor', 'authorarmor',
    'feralhide', 'turtlearmor', 'flowerarmor', 'rhinoarmor', 'podarmor', 'blindhide', 'featherarmor', 'mantisarmor', 'motherarmor']);
  const SPEED_BODIES = new Set(['dragonhide', 'feralhide', 'blindhide', 'motherarmor']);
  const GOLD = '#c28a24';
  const meta = () => window.__metaRuntime;
  const clone = obj => JSON.parse(JSON.stringify(obj));
  const roll = (min = 50) => Math.max(50, Math.min(100, Math.floor(min + Math.random() * (101 - min))));
  const equippedSet = id => { const eq = player && player.equip; return !!(eq && SLOTS.some(slot => eq[slot] && ITEM_DEFS[eq[slot].key] && ITEM_DEFS[eq[slot].key].bossSet === id)); };
  function activeSets() { const found = []; if (!player || !player.equip) return found; for (const slot of SLOTS) { const eq = player.equip[slot], id = eq && ITEM_DEFS[eq.key] && ITEM_DEFS[eq.key].bossSet; if (id && id !== 'scribble' && setById[id] && !found.includes(id)) found.push(id); } return found; }
  function count(id, equipment) {
    const eq = equipment || (typeof player !== 'undefined' && player ? player.equip : null); if (!eq || !setById[id]) return 0;
    let n = 0; for (const slot of SLOTS) if (eq[slot] && ITEM_DEFS[eq[slot].key] && ITEM_DEFS[eq[slot].key].bossSet === id) n++; return n;
  }
  function data(id) {
    const m = meta(); if (!m || !setById[id]) return null;
    if (!m.data.bossSets) m.data.bossSets = {};
    if (!m.data.bossSets[id]) m.data.bossSets[id] = { cores: 0, horns: 0, kills: 0, hornDry: 0, firstHorn: false };
    return m.data.bossSets[id];
  }
  function owned(key) { const m = meta(); return m && m.data.inventory.find(eq => eq.key === key); }
  function setOfItem(key) { const def = ITEM_DEFS[key]; return def && def.bossSet ? setById[def.bossSet] : null; }
  function syncLoadout(eq) {
    const m = meta(), slot = ITEM_DEFS[eq.key].slot, current = m.data.loadout[slot];
    if (current && current.key === eq.key) m.data.loadout[slot] = clone(eq);
    if (m.data.inherited && m.data.inherited.key === eq.key) m.data.inherited = clone(eq);
  }
  function toggleEquip(key) {
    const set = setOfItem(key); if (set && set.id === 'scribble' && Legacy) return Legacy.toggleEquip(key);
    const m = meta(), eq = owned(key); if (!m || !eq) return false;
    const slot = ITEM_DEFS[key].slot, current = m.data.loadout[slot], ui = Legacy ? Legacy.state : U;
    if (current && current.key === key) {
      m.data.loadout[slot] = null; if (m.data.inherited && m.data.inherited.key === key) m.data.inherited = null;
      ui.message = '已卸下 ' + ITEM_DEFS[key].name;
    } else {
      m.data.loadout[slot] = clone(eq); m.data.inherited = clone(eq); ui.message = '下局穿戴 ' + ITEM_DEFS[key].name + ' · Lv.1';
    }
    m.save(); return true;
  }
  function craftInkCost() { return Legacy && Legacy.craftInkCost ? Legacy.craftInkCost() : 80; }
  function craft(key) {
    const set = setOfItem(key); if (!set) return false; if (set.id === 'scribble' && Legacy) return Legacy.craft(key);
    const m = meta(), d = data(set.id), ui = Legacy ? Legacy.state : U, inkCost = craftInkCost(); if (!m || !d || !set.gold.includes(key)) return false;
    if (owned(key)) { ui.message = '这件金装已经制作过了'; return false; }
    if (m.data.ink < inkCost || d.cores < 4 || d.horns < 1) { ui.message = '材料不足：需要墨点 ' + inkCost + '、' + set.special + ' 1、领主墨核 4'; return false; }
    m.data.ink -= inkCost; d.cores -= 4; d.horns--;
    const eq = { key, rarity: 3, roll: roll(), rerollFloor: 50 }; m.addInventory(eq); m.save();
    ui.message = '制作完成：' + ITEM_DEFS[key].name + ' · 词条 ' + eq.roll + '%'; return true;
  }
  function reroll(key) {
    const set = setOfItem(key); if (!set) return false; if (set.id === 'scribble' && Legacy) return Legacy.reroll(key);
    const m = meta(), d = data(set.id), eq = owned(key), ui = Legacy ? Legacy.state : U; if (!m || !d || !eq) return false;
    if (eq.roll >= 100) { ui.message = '词条已经完美'; return false; }
    if (d.horns < 1) { ui.message = '需要 1 个' + set.special; return false; }
    d.horns--; const before = eq.roll, next = roll(Math.max(50, eq.rerollFloor || 50));
    if (next <= before) { eq.rerollFloor = Math.min(100, before + 5); ui.message = '重描没有提升 · 下次至少 ' + eq.rerollFloor + '%'; }
    else { eq.roll = next; eq.rerollFloor = 50; ui.message = '重描成功：' + before + '% → ' + next + '%'; }
    syncLoadout(eq); m.save(); return true;
  }
  function perfectSet(id) {
    id = id || U.selected; const set = setById[id]; if (!set) return false;
    if (id === 'scribble' && Legacy) return Legacy.perfectSet();
    return set.all.every(key => owned(key) && owned(key).roll >= 100);
  }
  function exchange(id) {
    id = id || U.selected; const set = setById[id]; if (!set) return false;
    if (id === 'scribble' && Legacy) return Legacy.exchange();
    const m = meta(), d = data(id), ui = Legacy ? Legacy.state : U;
    if (!perfectSet(id)) { ui.message = '全套词条达到 100% 后开放兑换'; return false; }
    if (!d || d.horns < 1) { ui.message = '需要 1 个' + set.special; return false; }
    d.horns--; d.cores += 2; m.save(); ui.message = set.special + ' 1 → 领主墨核 2'; return true;
  }
  function spawnBossRewards(enemy) {
    if (!enemy) return false; if (enemy.stage === 1 && Legacy) return Legacy.spawnBossRewards(enemy);
    const set = C.byStage[enemy.stage], m = meta(); if (!set || !m || !m.run || m.run.mode === 'bossTest') return false;
    const d = data(set.id);
    // 五件金装全部通过制作获得，Boss 只掉落制作材料。
    const cores = 2 + (enemy.bossTookHit ? 0 : 1);
    drops.push({ kind: 'material', bossSet: set.id, material: 'cores', amount: cores, x: enemy.x - 34, y: enemy.y + 24, bob: 1.7 });
    const special = !d.firstHorn || d.hornDry >= 2 || Math.random() < 0.35; d.kills++;
    if (special) {
      drops.push({ kind: 'material', bossSet: set.id, material: 'horns', amount: 1, x: enemy.x + 34, y: enemy.y + 24, bob: 3.4 });
      d.firstHorn = true; d.hornDry = 0;
    } else d.hornDry = Math.min(2, d.hornDry + 1);
    m.save(); return true;
  }
  function collectMaterial(dr) {
    if (dr && dr.bossSet === 'scribble' && Legacy) return Legacy.collectMaterial(dr);
    if (!dr || dr.kind !== 'material' || !setById[dr.bossSet] || !['cores', 'horns'].includes(dr.material)) return false;
    const d = data(dr.bossSet); if (!d) return false;
    const amount = Math.max(1, Math.floor(dr.amount || 1)); d[dr.material] = Math.min(999999, (d[dr.material] || 0) + amount);
    drops = drops.filter(x => x !== dr); meta().save();
    const name = dr.material === 'cores' ? '领主墨核' : setById[dr.bossSet].special;
    floats.push({ x: dr.x, y: dr.y - 18, txt: name + ' +' + amount, t: 1.1, color: dr.material === 'cores' ? setById[dr.bossSet].color : GOLD });
    toast(name + ' +' + amount + ' · 已收入文具盒'); return true;
  }
  function onEquipmentCollected(dr) {
    if (dr && dr.bossSet === 'scribble' && Legacy) return Legacy.onEquipmentCollected(dr);
    const m = meta(); if (!m || !dr || !setOfItem(dr.item) || setOfItem(dr.item).id !== dr.bossSet) return false;
    const added = m.addInventory({ key: dr.item, rarity: dr.rarity, roll: dr.roll }); m.save(); return added;
  }

  /* 战斗公共层：派生伤害不再次计作主动施放，实体全部设上限。 */
  function register(id, definition) { if (!setById[id] || id === 'scribble') return; hooks[id] = definition || {}; if (!states[id]) states[id] = {}; }
  function setState(id) {
    if (!states[id]) states[id] = {};
    const s = states[id]; if (s.casts === undefined) s.casts = 0; if (!s.refunds) s.refunds = Object.create(null); return s;
  }
  function baseDamage(a, c) { return ((C.baseHit[a.id] || 20) * (c && c.dmg || 1)); }
  function setDamage(id, amount) {
    const set = setById[id], head = set.keys.head, feet = set.keys.feet;
    let shoeMul = 1;
    if (window.BuildOptimizationRuntime && hasItem(feet)) {
      const perTen = itemV(feet, 'setSpeedDmg');
      if (perTen) shoeMul += Math.min(itemV(feet, 'setSpeedDmgCap'), window.BuildOptimizationRuntime.extraSpeed() * perTen / 10) / 100;
    }
    return amount * (hasItem(head) ? 1 + itemV(head, 'setDmg') / 100 : 1) * shoeMul;
  }
  function skillKind(id, kind) { return 'boss-' + id + (kind ? '-' + kind : ''); }
  function hit(e, damage, id, sx, sy, kind, options) {
    if (!e || e.dead || !(damage > 0)) return false;
    if (hasItem('podbranch') && (kind === 'summon' || kind === 'root' || kind === 'shadow')) damage *= 1 + itemV('podbranch', 'summonDmg') / 100;
    hurtEnemy(e, damage, 0, sx === undefined ? player.x : sx, sy === undefined ? player.y : sy,
      0, -1, 0, setById[id].color, false, skillKind(id, kind));
    if (options && options.mark && count(id) >= 3) mark(e, id, options.mark === true ? 3 : options.mark);
    if (options && options.slow && !e.dead) e.slowT = Math.max(e.slowT || 0, options.slow);
    if (options && options.stun && !e.dead) e.stunT = Math.max(e.stunT || 0, e.boss ? Math.min(.15, options.stun) : options.stun);
    return true;
  }
  function blast(id, x, y, radius, damage, options = {}) {
    const hits = []; if (options.boost !== false) damage = setDamage(id, damage);
    novas.push({ x, y, t: options.visual || .28, max: radius, col: setById[id].color });
    for (const e of enemies) {
      if (e.dead || Math.hypot(e.x - x, e.y - y) > radius + e.r) continue;
      if (hit(e, damage, id, x, y, options.kind, options)) hits.push(e);
    }
    return hits;
  }
  function line(id, x1, y1, x2, y2, width, damage, options = {}) {
    if (options.boost !== false) damage = setDamage(id, damage);
    if (FX.lines.length >= 96) FX.lines.shift(); FX.lines.push({ x1, y1, x2, y2, width, color: setById[id].color, t: .3, total: .3 });
    const hits = [], unique = options.unique || null;
    for (const e of enemies) {
      if (e.dead || (unique && unique.has(e.id)) || pointSegDist({ x: e.x, y: e.y }, { x: x1, y: y1 }, { x: x2, y: y2 }) > e.r + width) continue;
      if (unique) unique.add(e.id); if (hit(e, damage, id, x1, y1, options.kind, options)) hits.push(e);
    }
    return hits;
  }
  function delay(id, seconds, fn) { if (FX.delays.length >= 120) FX.delays.shift(); FX.delays.push({ t: Math.max(0, seconds), fn, id }); }
  function zone(id, x, y, radius, duration, options = {}) {
    if (FX.zones.length >= 48) FX.zones.shift();
    const z = { id, x, y, r: radius, t: duration, total: duration, tick: 0, interval: options.interval || .5,
      damage: options.damage || 0, mark: !!options.mark, slow: options.slow || 0, kind: options.kind || 'zone' };
    FX.zones.push(z); return z;
  }
  function projectile(id, options) {
    if (FX.projectiles.length >= 72) FX.projectiles.shift();
    const p = Object.assign({ id, x: player.x, y: player.y, angle: player.faceA, speed: 430, distance: 0, maxDistance: 250,
      damage: 20, phase: 'out', life: 2.4, radius: 12, hits: new Set(), split: false, ink: 0, inkCap: 8 }, options || {});
    FX.projectiles.push(p); return p;
  }
  function echo(id, source, damage, otherRatio, bossRatio, options = {}) {
    if (!source || source.dead) return false;
    const next = nearestEnemy(source.x, source.y, 480, source);
    if (next) {
      if (FX.lines.length >= 96) FX.lines.shift(); FX.lines.push({ x1: source.x, y1: source.y, x2: next.x, y2: next.y, width: 4, color: setById[id].color, t: .24, total: .24 });
      return hit(next, damage * otherRatio, id, source.x, source.y, 'echo', options);
    }
    if (source.boss) return hit(source, damage * bossRatio, id, source.x, source.y, 'bossEcho', options);
    return false;
  }
  function mark(e, id, duration = 3) { if (!e || e.dead) return; if (!e.bossSetMarks) e.bossSetMarks = Object.create(null); e.bossSetMarks[id] = gameTime + duration; }
  function marked(e) { return !!(e && e.bossSetMarks && Object.values(e.bossSetMarks).some(t => t > gameTime)); }
  function addShield(percent, label) {
    const cap = player.maxhp * .6, amount = player.maxhp * percent / 100;
    const before = player.bossPaperShield || 0;
    player.bossPaperShield = Math.min(cap, before + amount);
    addPaperShieldFloat(player.bossPaperShield - before);
  }
  function refundFor(id, key, prop, cap, bucket) {
    if (!hasItem(key) || !bucket || (bucket.ink || 0) >= cap) return 0;
    const amount = Math.min(cap - (bucket.ink || 0), itemV(key, prop)); bucket.ink = (bucket.ink || 0) + amount;
    return refundInk(amount, player.x, player.y - 32, setById[id].name);
  }
  function baseForSkill(skillId) { const cast = lastCasts[skillId]; return cast ? cast.damage : 20 * player.dmgMul * (1 + player.eqAtk / 100); }
  function friendlySummonExists() {
    if ((typeof totems !== 'undefined' && totems.some(t => t.t > 0)) ||
        (typeof minions !== 'undefined' && minions.some(m => m.t > 0))) return true;
    const pods = states.pods && states.pods.pods;
    if (pods && pods.some(p => p.t > 0)) return true;
    const shadow = states.knights && states.knights.shadow;
    return !!(shadow && shadow.t > 0);
  }
  function consumeBlock(kind, source) {
    if (kind !== 'enemy' || !source || source.boss) return false;
    for (const id of activeSets()) if (hooks[id] && hooks[id].consumeBlock && hooks[id].consumeBlock(source)) return true;
    return false;
  }

  const baseSkillCalc = skillCalc;
  skillCalc = function(a) {
    const c = baseSkillCalc(a), tags = SKILL_TAGS[a.id] || [], active = activeSets();
    const area = tags.includes('area'), proj = tags.includes('proj'), strike = tags.includes('strike');
    for (const id of active) {
      const s = setState(id), n = count(id), head = setById[id].keys.head;
      if (hasItem(head)) {
        let mul = 0;
        if (['correction', 'dragon', 'element', 'abyss', 'flower'].includes(id) && area) mul = itemV(head, 'activeDmg');
        else if (id === 'judge' && !area) mul = itemV(head, 'activeDmg');
        else if (id === 'knights' && (strike || ['piercerush', 'shieldrush'].includes(a.id))) mul = itemV(head, 'activeDmg');
        else if (['origami', 'feather'].includes(id) && proj) mul = itemV(head, 'activeDmg');
        else if (id === 'author' && new Set(player.actives.map(x => x.id)).size >= 4) mul = itemV(head, 'activeDmg');
        else if (id === 'rhino' && (strike || (s.dashT || 0) > 0)) mul = itemV(head, 'activeDmg');
        else if (id === 'totem' && (proj || a.id === 'ruler')) mul = itemV(head, 'activeDmg');
        else if (id === 'pods' && friendlySummonExists()) mul = itemV(head, 'activeDmg');
        else if (id === 'mother' && new Set(player.actives.map(x => x.id)).size >= 3) mul = itemV(head, 'activeDmg');
        c.dmg *= 1 + mul / 100;
      }
      if (['eraser', 'feral', 'blind'].includes(id)) {
        let dive = 0; for (const key of [setById[id].keys.hands, head]) if (hasItem(key)) dive += itemV(key, 'diveDmg');
        if ((s.diveBoostT || 0) > 0) c.dmg *= 1 + dive / 100;
      }
      if (id === 'author' && hasItem('authorpen')) c.dmg *= 1 + Math.min(4, s.sequence || 0) * itemV('authorpen', 'chargeDmg') / 100;
      if (id === 'mother' && hasItem('motherclaw')) c.dmg *= 1 + Math.min(3, s.sequence || 0) * itemV('motherclaw', 'chargeDmg') / 100;
      if (id === 'rhino' && hasItem('rhinofist') && (s.charge || 0) > 0) c.dmg *= 1 + itemV('rhinofist', 'chargeDmg') / 100;
      if (id === 'totem' && hasItem('totemboots') && player.stillT >= 1) c.rad *= 1 + itemV('totemboots', 'stillRad') / 100;
      if (hooks[id] && hooks[id].calc) hooks[id].calc(c, n, a);
    }
    return c;
  };

  const baseFireSkill = fireSkill;
  fireSkill = function(a, c) {
    const active = activeSets(), target = nearestEnemy(player.x, player.y, 650);
    lastCasts[a.id] = { a, c, damage: baseDamage(a, c), x: player.x, y: player.y, target };
    for (const id of active) if (hooks[id] && hooks[id].beforeCast) hooks[id].beforeCast({ a, c, target, count: count(id), damage: baseDamage(a, c), state: setState(id) });
    const result = baseFireSkill(a, c);
    for (const id of active) {
      const s = setState(id); s.casts++; const set = setById[id], acc = set.keys.acc;
      if (hasItem(acc)) {
        if (FIRST_HIT_ACC.has(acc)) s.castRefund = true;
        if (FOURTH_CAST_ACC.has(acc) && s.casts % 4 === 0) refundInk(itemV(acc, 'castInk'), player.x, player.y - 32, set.name);
      }
      if (hooks[id] && hooks[id].onCast) hooks[id].onCast({ a, c, target, count: count(id), casts: s.casts, damage: baseDamage(a, c), state: s });
    }
    return result;
  };

  const baseHurtEnemy = hurtEnemy;
  hurtEnemy = function(e, dmg, ...rest) {
    if (!e || e.dead) return baseHurtEnemy(e, dmg, ...rest);
    const skillId = rest[8], activeSkill = !!SKILL_DEFS[skillId], active = activeSets();
    if (marked(e)) dmg *= 1.15;
    if (activeSkill) {
      if (hasItem('tapegrip') && (e.slowT > 0 || inkCircleHas(e.x, e.y, e.r * .3, true))) dmg *= 1 + itemV('tapegrip', 'dmg') / 100;
      if (hasItem('judgegloves')) dmg *= 1 + Math.min(5, e.judgeStacks || 0) * itemV('judgegloves', 'chargeDmg') / 100;
      if (hasItem('dragonclaw') && (SKILL_TAGS[skillId] || []).includes('proj')) dmg *= 1 + itemV('dragonclaw', 'projDmg') / 100;
      if (hasItem('origamiclaw') && (SKILL_TAGS[skillId] || []).includes('proj')) dmg *= 1 + itemV('origamiclaw', 'projDmg') / 100;
      if (hasItem('featherpen') && (SKILL_TAGS[skillId] || []).includes('proj')) dmg *= 1 + itemV('featherpen', 'projDmg') / 100;
      if (hasItem('lancegrip') && Math.hypot(e.x - player.x, e.y - player.y) < 145) dmg *= 1 + itemV('lancegrip', 'closeDmg') / 100;
      if (hasItem('elementglove') && playerOnOwnInk()) dmg *= 1 + itemV('elementglove', 'inkDmg') / 100;
      if (hasItem('abyssgrip') && inkCircleHas(e.x, e.y, e.r * .3, true)) dmg *= 1 + itemV('abyssgrip', 'grayDmg') / 100;
      if (hasItem('flowerbranch') && (e.slowT > 0 || e.stunT > 0)) dmg *= 1 + itemV('flowerbranch', 'controlDmg') / 100;
      if (hasItem('turtlefist') && player.hp / player.maxhp > .8) dmg *= 1 + itemV('turtlefist', 'highHpDmg') / 100;
      if (hasItem('totempen') && Math.hypot(e.x - player.x, e.y - player.y) > 180) dmg *= 1 + itemV('totempen', 'farDmg') / 100;
      if (hasItem('mantisclaw') && ((SKILL_TAGS[skillId] || []).includes('strike') || ['pageslash', 'piercerush'].includes(skillId))) dmg *= 1 + itemV('mantisclaw', 'meleeDmg') / 100;
      if (hasItem('mantiscrown') && e.hp / e.maxhp < .4) dmg *= 1 + itemV('mantiscrown', 'executeDmg') / 100;
      if (hasItem('feralclaw')) {
        const fromX = rest[1] === undefined ? player.x : rest[1], fromY = rest[2] === undefined ? player.y : rest[2];
        const angle = Math.atan2(fromY - e.y, fromX - e.x), front = Math.abs(Math.atan2(Math.sin(angle - (e.faceA || 0)), Math.cos(angle - (e.faceA || 0)))) < Math.PI / 2;
        if (!front) dmg *= 1 + itemV('feralclaw', 'backDmg') / 100;
      }
    }
    for (const id of active) if (hooks[id] && hooks[id].beforeHit) dmg = hooks[id].beforeHit(e, dmg, skillId, activeSkill) || dmg;
    const before = e.hp, result = baseHurtEnemy(e, dmg, ...rest), dealt = Math.max(0, before - e.hp);
    if (dealt > 0 && activeSkill) for (const id of active) {
      const s = setState(id), acc = setById[id].keys.acc;
      if (s.castRefund && hasItem(acc) && FIRST_HIT_ACC.has(acc)) { s.castRefund = false; refundInk(itemV(acc, 'castInk'), e.x, e.y - e.r - 10, setById[id].name); }
    }
    if (dealt > 0) for (const id of active) if (hooks[id] && hooks[id].onHit) hooks[id].onHit(e, dealt, skillId, activeSkill);
    return result;
  };

  const baseHurtPlayer = hurtPlayer;
  hurtPlayer = function(dmg, kind, source) {
    const active = activeSets(), oldHp = player.hp, oldHurt = player.hurtT;
    if (hasItem('judgerobe') && player.hp / player.maxhp < .5) dmg *= 1 - itemV('judgerobe', 'lowHpDr') / 100;
    if (hasItem('elementarmor') && playerOnOwnInk()) dmg *= 1 - itemV('elementarmor', 'inkDr') / 100;
    if (hasItem('totemarmor') && player.stillT >= 1) dmg *= 1 - itemV('totemarmor', 'stillDr') / 100;
    if (hasItem('turtlearmor')) {
      const s = setState('turtle'); if (s.hurtT > 0) dmg *= 1 - itemV('turtlearmor', 'hurtDr') / 100;
      dmg *= 1 - Math.min(.36, (s.shell || 0) * itemV('turtlearmor', 'shellDr') / 100);
    }
    for (const id of active) {
      const body = setById[id].keys.body, s = setState(id);
      if (HURT_BODIES.has(body) && body !== 'turtlearmor' && s.hurtT > 0) dmg *= 1 - itemV(body, 'hurtDr') / 100;
    }
    if ((player.bossPaperShield || 0) > 0 && !(player.diving || player.goldT > 0 || player.hurtT > 0)) {
      const absorbed = Math.min(player.bossPaperShield, dmg); player.bossPaperShield -= absorbed; dmg -= absorbed;
      floats.push({ x: player.x, y: player.y - 35, txt: '纸甲 -' + Math.round(absorbed), t: .55, color: ARC });
      if (dmg <= .001) { player.hurtT = Math.max(player.hurtT, .25); return; }
    }
    if (consumeBlock(kind, source)) {
      player.hurtT = Math.max(player.hurtT, .25); floats.push({ x: player.x, y: player.y - 38, txt: '纸影挡下碰撞', t: .65, color: ARC }); return;
    }
    const result = baseHurtPlayer(dmg, kind, source), actual = player.hp < oldHp || player.hurtT > oldHurt;
    if (actual) {
      let kbResist = 0; for (const key of ['tapeboots', 'turtleboots']) if (hasItem(key)) kbResist = Math.max(kbResist, itemV(key, 'kb'));
      if (source && (player.bossStaggerImmuneT || 0) <= 0) {
        const angle = Math.atan2(player.y - source.y, player.x - source.x), push = 12 * (1 - kbResist / 100);
        player.x = clampW(player.x + Math.cos(angle) * push, player.r); player.y = clampH(player.y + Math.sin(angle) * push, player.r);
      }
      for (const id of active) {
        const body = setById[id].keys.body; if (HURT_BODIES.has(body)) setState(id).hurtT = 3;
        if (hasItem('knightboots')) setState('knights').bootHurtT = 2;
        if (hooks[id] && hooks[id].onHurt) hooks[id].onHurt(source, kind);
      }
    }
    return result;
  };

  const baseConvertGrayDisk = convertGrayDisk;
  convertGrayDisk = function(x, y, radius) {
    const wasDiving = player.diving, converted = baseConvertGrayDisk(x, y, radius);
    if (converted > 0) for (const id of activeSets()) {
      const s = setState(id), acc = setById[id].keys.acc;
      if (GRAY_ACC.has(acc) && hasItem(acc) && gameTime >= (s.grayRefundT || 0)) { s.grayRefundT = gameTime + 1.5; refundInk(itemV(acc, 'grayInk'), x, y - 20, setById[id].name); }
      if (hooks[id] && hooks[id].onGray) hooks[id].onGray(x, y, radius, converted, wasDiving);
    }
    return converted;
  };
  const baseExitDive = exitDive;
  exitDive = function() {
    const was = player.diving; baseExitDive(); if (!was) return;
    for (const id of activeSets()) {
      const s = setState(id), acc = setById[id].keys.acc;
      if (DIVE_ACC.has(acc) && hasItem(acc)) refundInk(itemV(acc, 'diveInk'), player.x, player.y - 30, setById[id].name);
      if (['eraser', 'feral', 'blind'].includes(id)) s.diveBoostT = 3;
      if (hooks[id] && hooks[id].onDiveExit) hooks[id].onDiveExit();
    }
  };
  const baseCastAbsorb = castAbsorb;
  castAbsorb = function() { const result = baseCastAbsorb(); if (result) for (const id of activeSets()) if (hooks[id] && hooks[id].onAbsorb) hooks[id].onAbsorb(); return result; };
  const baseCastInkSurge = castInkSurge;
  castInkSurge = function(radius, full) { const result = baseCastInkSurge(radius, full); if (result) for (const id of activeSets()) if (hooks[id] && hooks[id].onSurge) hooks[id].onSurge(radius, full); return result; };

  function updateFx(dt) {
    for (let i = FX.delays.length - 1; i >= 0; i--) { const d = FX.delays[i]; d.t -= dt; if (d.t <= 0) { FX.delays.splice(i, 1); d.fn(); } }
    for (let i = FX.lines.length - 1; i >= 0; i--) { FX.lines[i].t -= dt; if (FX.lines[i].t <= 0) FX.lines.splice(i, 1); }
    for (let i = FX.zones.length - 1; i >= 0; i--) {
      const z = FX.zones[i]; z.t -= dt; z.tick -= dt;
      if (z.tick <= 0 && z.t > 0) {
        z.tick += z.interval;
        for (const e of enemies) {
          if (e.dead || Math.hypot(e.x - z.x, e.y - z.y) > z.r + e.r) continue;
          if (z.slow) e.slowT = Math.max(e.slowT || 0, z.slow);
          if (z.damage) hit(e, setDamage(z.id, z.damage * z.interval), z.id, z.x, z.y, z.kind, { mark: z.mark });
          else if (z.mark && count(z.id) >= 3) mark(e, z.id);
        }
      }
      if (z.t <= 0) FX.zones.splice(i, 1);
    }
    for (let i = FX.projectiles.length - 1; i >= 0; i--) {
      const p = FX.projectiles[i], ox = p.x, oy = p.y; p.life -= dt;
      if (p.phase === 'out') {
        const step = p.speed * dt; p.x += Math.cos(p.angle) * step; p.y += Math.sin(p.angle) * step; p.distance += step;
        if (p.distance >= p.maxDistance) { p.phase = 'back'; p.hits.clear(); p.onReturn && p.onReturn(p); }
      } else {
        const angle = Math.atan2(player.y - p.y, player.x - p.x); p.x += Math.cos(angle) * p.speed * dt; p.y += Math.sin(angle) * p.speed * dt;
        if (Math.hypot(player.x - p.x, player.y - p.y) < 22) p.life = 0;
      }
      for (const e of enemies) {
        if (e.dead || p.hits.has(e.id) || pointSegDist({ x: e.x, y: e.y }, { x: ox, y: oy }, { x: p.x, y: p.y }) > e.r + p.radius) continue;
        p.hits.add(e.id); hit(e, p.damage, p.id, ox, oy, 'blade', { mark: p.phase === 'back' && count(p.id) >= 3 });
        if (p.accKey) refundFor(p.id, p.accKey, 'hitInk', p.inkCap, p);
        p.onHit && p.onHit(p, e);
      }
      if (p.life <= 0) FX.projectiles.splice(i, 1);
    }
  }
  const baseUpdate = update;
  update = function(dt) {
    if (state !== 'play') return baseUpdate(dt);
    const oldX = player.x, oldY = player.y, active = activeSets();
    let speed = 1;
    for (const id of active) {
      const s = setState(id), body = setById[id].keys.body;
      if (SPEED_BODIES.has(body) && s.hurtT > 0) speed *= 1 + itemV(body, 'speed') / 100;
      if (id === 'knights' && s.bootHurtT > 0 && hasItem('knightboots')) speed *= 1 + itemV('knightboots', 'hurtSpeed') / 100;
      if (player.diving) for (const key of ['feralboots', 'blindboots', 'motherboots', 'eraserboots']) if (hasItem(key)) speed *= 1 + itemV(key, 'diveSpeed') / 100;
      if (id === 'pods' && hasItem('podboots') && s.onRoot) speed *= 1 + itemV('podboots', 'linkSpeed') / 100;
      if (hooks[id] && hooks[id].speed) speed *= hooks[id].speed(dt);
    }
    const oldHostile = BATTLE.ink.hostileSpeed;
    if (hasItem('abyssboots')) BATTLE.ink.hostileSpeed = Math.min(1, oldHostile + (1 - oldHostile) * itemV('abyssboots', 'graySlow') / 100);
    if (hasItem('elementboots') && playerOnOwnInk()) BATTLE.ink.hostileSpeed = 1;
    player.eqSpd *= speed; try { baseUpdate(dt); } finally { player.eqSpd /= speed; BATTLE.ink.hostileSpeed = oldHostile; }
    if (state !== 'play') return;
    for (const id of active) {
      const s = setState(id); s.hurtT = Math.max(0, (s.hurtT || 0) - dt); s.bootHurtT = Math.max(0, (s.bootHurtT || 0) - dt);
      s.diveBoostT = Math.max(0, (s.diveBoostT || 0) - dt); s.dashT = Math.max(0, (s.dashT || 0) - dt);
      if (hasItem('totemorb') && player.stillT >= 1) { s.stillAcc = (s.stillAcc || 0) + dt; while (s.stillAcc >= 1) { s.stillAcc -= 1; refundInk(itemV('totemorb', 'stillInk'), player.x, player.y - 28, '旋眼墨珠'); } } else s.stillAcc = 0;
      if (hooks[id] && hooks[id].update) hooks[id].update(dt, oldX, oldY);
    }
    player.bossStaggerImmuneT = Math.max(0, (player.bossStaggerImmuneT || 0) - dt);
    updateFx(dt);
  };

  const baseRecomputeEquip = recomputeEquip;
  recomputeEquip = function() {
    baseRecomputeEquip();
    if (hasItem('turtlecrown')) { const ratio = player.maxhp > 0 ? player.hp / player.maxhp : 1; player.maxhp = Math.round(player.maxhp * (1 + itemV('turtlecrown', 'hp') / 100)); player.hp = Math.max(1, Math.round(player.maxhp * ratio)); }
  };
  const baseResetGame = resetGame;
  resetGame = function() {
    baseResetGame(); for (const key of Object.keys(FX)) FX[key].length = 0;
    for (const id of Object.keys(states)) { states[id] = {}; if (hooks[id] && hooks[id].reset) hooks[id].reset(); }
    for (const key of Object.keys(lastCasts)) delete lastCasts[key];
  };

  function drawFx() {
    for (const l of FX.lines) { ctx.globalAlpha = Math.max(0, l.t / l.total); jline(l.x1, l.y1, l.x2, l.y2, l.color, l.width); }
    ctx.globalAlpha = 1;
    for (const z of FX.zones) {
      ctx.globalAlpha = Math.min(.24, z.t * .12); ctx.fillStyle = setById[z.id].color; ctx.beginPath(); ctx.arc(z.x, z.y, z.r, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = Math.min(.8, z.t); jcircle(z.x, z.y, z.r, setById[z.id].color, 2);
    }
    ctx.globalAlpha = 1;
    for (const p of FX.projectiles) {
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.phase === 'out' ? p.angle : Math.atan2(player.y - p.y, player.x - p.x));
      jline(-13, -7, 13, 0, setById[p.id].color, 3); jline(-13, 7, 13, 0, setById[p.id].color, 2); ctx.restore();
    }
    for (const id of activeSets()) if (hooks[id] && hooks[id].draw) hooks[id].draw();
    if ((player.bossPaperShield || 0) > 0) { ctx.globalAlpha = .45; jcircle(player.x, player.y, player.r + 10, ARC, 2); ctx.globalAlpha = 1; }
  }
  const previousExtras = window.__drawWorldExtras;
  window.__drawWorldExtras = function() { if (previousExtras) previousExtras(); drawFx(); };

  /* 通用文具盒；乱线套装保留原界面，并从右下角进入其余套装。 */
  function txt(value, x, y, size = 12, color = DARK, align = 'left', bold = false, maxWidth) {
    ctx.fillStyle = color; ctx.textAlign = align; ctx.font = (bold ? 'bold ' : '') + size + 'px ' + FONT; ctx.fillText(String(value), x, y, maxWidth);
  }
  function wrap(value, x, y, width, lineHeight = 14, maxLines = 2, size = 10, color = DARK) {
    ctx.font = size + 'px ' + FONT; ctx.fillStyle = color; ctx.textAlign = 'left'; const lines = []; let line = '';
    for (const ch of String(value || '')) { if (line && ctx.measureText(line + ch).width > width) { lines.push(line); line = ch; } else line += ch; }
    if (line) lines.push(line); lines.slice(0, maxLines).forEach((s, i) => ctx.fillText(s, x, y + i * lineHeight));
  }
  function button(rect, label, action, enabled = true, active = false, color = INK, size = 11) {
    ctx.fillStyle = active ? 'rgba(215,225,238,.94)' : 'rgba(255,250,238,.96)'; ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    jrect(rect.x, rect.y, rect.w, rect.h, enabled ? color : GRAY, active ? 2.4 : 1.5); txt(label, rect.x + rect.w / 2, rect.y + rect.h / 2 + 4, size, enabled ? color : GRAY, 'center', true, rect.w - 7);
    U.hits.push({ rect, action, enabled });
  }
  function selectSet(id) {
    if (!setById[id]) return false;
    U.selected = id; U.setPage = Math.floor(sets.findIndex(set => set.id === id) / 8);
    const ui = Legacy ? Legacy.state : U;
    ui.page = 0; ui.message = ''; ui.craftKey = setById[id].keys.head; ui.craftOpen = false;
    return true;
  }
  function cycleSet(dir) { const i = sets.findIndex(s => s.id === U.selected); selectSet(sets[(i + dir + sets.length) % sets.length].id); }
  function craftColumns(desktop) {
    const margin = desktop ? 48 : 18, leftW = desktop ? 180 : 82, gap = desktop ? 14 : 8;
    return { margin, leftW, gap, rightX: margin + leftW + gap, rightW: W - margin * 2 - leftW - gap };
  }
  function drawSetList(desktop, top) {
    const { margin, leftW } = craftColumns(desktop), per = 8, pages = Math.ceil(sets.length / per);
    U.setPage = Math.max(0, Math.min(pages - 1, U.setPage || 0));
    txt('套装列表', margin, top + 18, desktop ? 14 : 10, INK, 'left', true);
    const rowH = desktop ? 44 : 38, gap = desktop ? 7 : 5, startY = top + 34;
    sets.slice(U.setPage * per, U.setPage * per + per).forEach((set, i) => {
      const selected = set.id === U.selected;
      const r = { x: margin, y: startY + i * (rowH + gap), w: leftW, h: rowH };
      ctx.fillStyle = selected ? 'rgba(215,225,238,.96)' : 'rgba(255,250,238,.9)'; ctx.fillRect(r.x, r.y, r.w, r.h);
      jrect(r.x, r.y, r.w, r.h, set.color, selected ? 2.5 : 1.2);
      txt(set.stage, r.x + (desktop ? 12 : 7), r.y + rowH / 2 + 4, desktop ? 12 : 9, set.color, 'left', true);
      txt(set.name, r.x + (desktop ? 39 : 25), r.y + rowH / 2 + 4, desktop ? 12 : 9,
        selected ? INK : DARK, 'left', selected, leftW - (desktop ? 48 : 30));
      U.hits.push({ rect: r, enabled: true, action: () => selectSet(set.id) });
    });
    const py = startY + per * (rowH + gap) + 3;
    button({ x: margin, y: py, w: desktop ? 42 : 26, h: 26 }, '‹', () => U.setPage--, U.setPage > 0, false, INK, 13);
    txt((U.setPage + 1) + '/' + pages, margin + leftW / 2, py + 17, desktop ? 11 : 9, GRAY, 'center', true);
    button({ x: margin + leftW - (desktop ? 42 : 26), y: py, w: desktop ? 42 : 26, h: 26 }, '›', () => U.setPage++, U.setPage < pages - 1, false, INK, 13);
  }
  function icon(key, x, y, size, disabled, craftMode = false) {
    const eq = owned(key); if (window.EquipmentIconRuntime) EquipmentIconRuntime.draw({ key, roll: eq && eq.roll }, x, y, size,
      craftMode ? { showLevel: false, showType: false, disabled } : { level: 1, disabled });
    else { jrect(x, y, size, size, ITEM_DEFS[key].bossSet ? setById[ITEM_DEFS[key].bossSet].color : INK, 1.5); txt(SLOT_NAME[ITEM_DEFS[key].slot], x + size / 2, y + size / 2 + 4, 10, DARK, 'center', true); }
  }
  function panel(set, desktop, craftMode) {
    ctx.fillStyle = PAPER; ctx.fillRect(0, 0, W, H); ctx.strokeStyle = 'rgba(90,150,200,.15)'; ctx.lineWidth = 1;
    for (let y = 82; y < H; y += 28) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
    txt('文具盒', desktop ? 48 : 20, 44, desktop ? 26 : 22, INK, 'left', true);
    if (craftMode) txt('第 ' + set.stage + ' 页 · ' + set.boss, W - (desktop ? 48 : 20), 43, desktop ? 13 : 10, GRAY, 'right');
  }
  function drawLoadout(desktop) {
    const ui = Legacy.state, m = meta(), margin = desktop ? 48 : 18, gap = desktop ? 14 : 6, y = desktop ? 128 : 132;
    const cellW = (W - margin * 2 - gap * 4) / 5;
    SLOTS.forEach((slot, i) => {
      const eq = m.data.loadout[slot], r = { x: margin + i * (cellW + gap), y, w: cellW, h: desktop ? 72 : 62 };
      const owned = m.data.inventory.filter(item => ITEM_DEFS[item.key].slot === slot)
        .sort((a, b) => b.rarity - a.rarity || (b.roll || 0) - (a.roll || 0));
      const shownEq = eq || owned[0], stateText = eq ? '已穿' : (owned.length ? owned.length + '件' : '空');
      ctx.fillStyle = ui.slot === slot ? 'rgba(215,225,238,.8)' : 'rgba(255,250,238,.9)'; ctx.fillRect(r.x, r.y, r.w, r.h);
      jrect(r.x, r.y, r.w, r.h, shownEq ? RARITY_LIST[shownEq.rarity].color : GRAY, ui.slot === slot ? 2.5 : 1.3);
      if (shownEq) icon(shownEq.key, r.x + 5, r.y + 5, desktop ? 48 : 34, false); else txt('空', r.x + r.w / 2, r.y + 27, 12, GRAY, 'center');
      txt(SLOT_NAME[slot] + '·' + stateText, r.x + r.w / 2, r.y + r.h - 7, desktop ? 11 : 8, shownEq ? DARK : GRAY, 'center', true);
      if (desktop && shownEq) txt(eq ? ITEM_DEFS[eq.key].name : '未穿戴', r.x + 60, r.y + 32, 11, DARK, 'left', true, r.w - 65);
      U.hits.push({ rect: r, enabled: true, action: () => { ui.slot = slot; ui.page = 0; } });
    });
    const entries = m.data.inventory.filter(eq => ITEM_DEFS[eq.key].slot === ui.slot)
      .slice().sort((a, b) => b.rarity - a.rarity || (b.roll || 0) - (a.roll || 0));
    const per = desktop ? 6 : 3, pages = Math.max(1, Math.ceil(entries.length / per)); ui.page = Math.max(0, Math.min(ui.page, pages - 1));
    const shown = entries.slice(ui.page * per, ui.page * per + per), cols = desktop ? 2 : 1;
    const cardGap = desktop ? 16 : 10, startY = desktop ? 222 : 216;
    const cardW = desktop ? (W - margin * 2 - cardGap) / 2 : W - margin * 2, cardH = desktop ? 112 : 96;
    shown.forEach((eq, i) => {
      const x = margin + (i % cols) * (cardW + cardGap), cy = startY + Math.floor(i / cols) * (cardH + cardGap);
      const current = m.data.loadout[ui.slot] && m.data.loadout[ui.slot].key === eq.key, rarity = RARITY_LIST[eq.rarity];
      ctx.fillStyle = 'rgba(255,250,238,.95)'; ctx.fillRect(x, cy, cardW, cardH); jrect(x, cy, cardW, cardH, rarity.color, current ? 2.5 : 1.4);
      const iconSize = desktop ? 58 : 50; icon(eq.key, x + 10, cy + 17, iconSize, false);
      const bx = x + cardW - (desktop ? 154 : 140), bw = desktop ? 142 : 128;
      const tx = x + iconSize + 20, textW = bx - tx - 10;
      txt(ITEM_DEFS[eq.key].name + (ITEM_DEFS[eq.key].bossSet ? ' · ' + eq.roll + '%' : ''), tx, cy + 23, desktop ? 14 : 12, rarity.color, 'left', true, textW);
      txt(rarity.name + ' · Lv.1', tx, cy + 42, 9, GRAY);
      wrap(itemDescription(eq.key, eq.rarity, eq.roll), tx, cy + 61, textW, 14, 2, desktop ? 11 : 9);
      button({ x: bx, y: cy + 12, w: bw, h: 30 }, current ? '卸下' : '穿戴', () => toggleEquip(eq.key), true, current, INK, 11);
      const itemSet = setById[ITEM_DEFS[eq.key].bossSet];
      if (itemSet) button({ x: bx, y: cy + 50, w: bw, h: 30 }, eq.roll >= 100 ? '词条完美' : '重描 · ' + itemSet.special + ' 1',
        () => reroll(eq.key), eq.roll < 100 && data(itemSet.id).horns > 0, false, itemSet.color, 10);
      else button({ x: bx, y: cy + 50, w: bw, h: 30 }, '重铸', () => {
        if (!m.reforge(eq.key, eq.rarity)) ui.message = '无法重铸：检查碎纸或收藏';
      }, true, false, GRAY, 10);
      U.hits.push({ rect: { x, y: cy, w: cardW - bw - 20, h: cardH }, enabled: true, action: () => {
        if (window.UICopy) UICopy.itemDetail(eq, ui.slot, m.data.equipment);
      } });
    });
    if (!shown.length) txt('这个部位还没有装备', W / 2, startY + 100, 13, GRAY, 'center');
    if (pages > 1) {
      const py = desktop ? 620 : 540;
      button({ x: margin, y: py, w: 90, h: 32 }, '上一页', () => ui.page--, ui.page > 0);
      txt((ui.page + 1) + ' / ' + pages, W / 2, py + 21, 11, DARK, 'center');
      button({ x: W - margin - 90, y: py, w: 90, h: 32 }, '下一页', () => ui.page++, ui.page < pages - 1);
    }
  }
  function drawCraftSetSummary(set, rect, desktop, sectionY) {
    const pad = desktop ? 22 : 14, n = count(set.id, meta().data.loadout), setY = sectionY + (desktop ? 125 : 118);
    txt(set.name + ' · 当前穿戴 ' + n + '/5', rect.x + pad, setY, desktop ? 13 : 11, n ? set.color : GRAY, 'left', true);
    set.summary.forEach((line, i) => {
      const active = n >= (i === 2 ? 5 : i + 2);
      wrap((active ? '● ' : '○ ') + line, rect.x + pad, setY + (desktop ? 28 : 24) + i * (desktop ? 48 : 40),
        rect.w - pad * 2, desktop ? 17 : 12, 2, desktop ? 11 : 9, active ? set.color : GRAY);
    });
  }
  function drawCraft(set, desktop) {
    const ui = Legacy.state, m = meta(), d = data(set.id);
    const { rightX, rightW } = craftColumns(desktop), compact = !desktop && rightW < 290;
    if (!set.all.includes(ui.craftKey)) ui.craftKey = set.keys.head;
    drawSetList(desktop, 140);
    txt(set.name + ' · 装备', rightX, 158, desktop ? 16 : 12, set.color, 'left', true, rightW - 62);
    txt('点选详情', rightX + rightW, 157, desktop ? 11 : 8, GRAY, 'right');
    const rowH = desktop ? 62 : 57, gap = desktop ? 9 : 7, startY = 174;
    SLOTS.forEach((slot, i) => {
      const key = set.keys[slot], def = ITEM_DEFS[key], eq = owned(key), gold = set.gold.includes(key);
      const equipped = m.data.loadout[slot] && m.data.loadout[slot].key === key;
      const r = { x: rightX, y: startY + i * (rowH + gap), w: rightW, h: rowH };
      ctx.fillStyle = 'rgba(255,250,238,.95)'; ctx.fillRect(r.x, r.y, r.w, r.h);
      jrect(r.x, r.y, r.w, r.h, gold ? GOLD : set.color, 1.4);
      const iconSize = desktop ? 48 : (compact ? 38 : 43);
      icon(key, r.x + 8, r.y + (rowH - iconSize) / 2, iconSize, false, true);
      const tx = r.x + iconSize + 16;
      txt(def.name, tx, r.y + (desktop ? 25 : 22), desktop ? 14 : (compact ? 11 : 12), gold ? GOLD : set.color, 'left', true,
        r.w - iconSize - (compact ? 101 : 122));
      txt(SLOT_NAME[slot] + ' · ' + (gold ? '金色制作' : '紫色掉落'), tx, r.y + (desktop ? 46 : 41), desktop ? 11 : (compact ? 8 : 9), GRAY);
      txt(equipped ? '已穿戴' : (eq ? '已拥有·' + eq.roll + '%' : '未拥有'), r.x + r.w - 9,
        r.y + rowH / 2 + 4, desktop ? 12 : (compact ? 9 : 10), equipped ? INK : (eq ? (gold ? GOLD : set.color) : GRAY), 'right', true);
      U.hits.push({ rect: r, enabled: true, action: () => {
        ui.craftKey = key; ui.craftOpen = true; ui.message = '';
      } });
    });
    const footY = startY + 5 * (rowH + gap) + 4;
    if (perfectSet(set.id)) button({ x: rightX, y: footY - 5, w: rightW, h: 28 }, set.special + ' 1 → 墨核 2', () => exchange(set.id), d.horns > 0, false, GOLD, 9);
    else txt('5 件金色装备 · 全部制作', rightX, footY + 10, desktop ? 11 : 8, GRAY);
    if (!ui.craftOpen) return;
    U.hits.push({ rect: { x: 0, y: 0, w: W, h: H }, enabled: true, action: () => {
      ui.craftOpen = false; ui.message = '';
    } });
    ctx.fillStyle = 'rgba(38,42,58,.38)'; ctx.fillRect(0, 0, W, H);
    const rect = desktop ? { x: W / 2 - 275, y: 48, w: 550, h: 620 } : { x: 18, y: 54, w: W - 36, h: 560 };
    U.hits.push({ rect, enabled: true, action: () => {} });
    const key = ui.craftKey, def = ITEM_DEFS[key], eq = owned(key), gold = set.gold.includes(key);
    const color = gold ? GOLD : set.color, pad = desktop ? 22 : 14;
    ctx.fillStyle = 'rgba(255,250,238,.99)'; ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    jrect(rect.x, rect.y, rect.w, rect.h, color, eq ? 2.5 : 1.6);
    txt(def.name, rect.x + pad, rect.y + (desktop ? 34 : 25), desktop ? 20 : 15, color, 'left', true, rect.w - pad * 2 - 42);
    txt((gold ? '金色制作' : '紫色掉落') + ' · ' + SLOT_NAME[def.slot] + (eq ? ' · 词条 ' + eq.roll + '%' : ' · 未拥有'),
      rect.x + pad, rect.y + (desktop ? 59 : 45), desktop ? 12 : 9, eq ? INK : GRAY);
    icon(key, rect.x + pad, rect.y + (desktop ? 88 : 70), desktop ? 82 : 58, false, true);
    const tx = rect.x + pad + (desktop ? 112 : 76);
    wrap(itemDescription(key, gold ? 3 : 2, eq ? eq.roll : 100), tx, rect.y + (desktop ? 105 : 83),
      rect.x + rect.w - pad - tx, desktop ? 21 : 15, desktop ? 4 : 4, desktop ? 13 : 10);
    txt('固定词条 · 随机数值 50%—100%', rect.x + pad, rect.y + (desktop ? 202 : 151), desktop ? 11 : 9, GRAY);
    const sectionY = rect.y + (desktop ? 242 : 181);
    txt(gold ? '所需材料 · 持有 / 需要' : (eq ? '重描材料' : '获取方式'), rect.x + pad, sectionY, desktop ? 14 : 11, INK, 'left', true);
    if (gold) {
      const rows = [['墨点', m.data.ink, craftInkCost()], [set.special, d.horns, 1], ['领主墨核', d.cores, 4]];
      rows.forEach((row, i) => {
        const enough = row[1] >= row[2];
        txt(row[0], rect.x + pad, sectionY + (desktop ? 35 : 28) + i * (desktop ? 30 : 25), desktop ? 13 : 10, enough ? DARK : RED);
        txt(row[1] + ' / ' + row[2], rect.x + rect.w - pad, sectionY + (desktop ? 35 : 28) + i * (desktop ? 30 : 25),
          desktop ? 13 : 10, enough ? DARK : RED, 'right', true);
      });
    } else if (eq) {
      txt(set.special, rect.x + pad, sectionY + (desktop ? 38 : 32), desktop ? 13 : 10, d.horns > 0 ? DARK : RED);
      txt(d.horns + ' / 1', rect.x + rect.w - pad, sectionY + (desktop ? 38 : 32), desktop ? 13 : 10, d.horns > 0 ? DARK : RED, 'right', true);
      txt('重描不会降低当前词条数值', rect.x + pad, sectionY + (desktop ? 72 : 60), desktop ? 11 : 9, GRAY);
    } else {
      txt('正式主线 · ' + set.boss, rect.x + pad, sectionY + (desktop ? 38 : 32), desktop ? 14 : 11, set.color, 'left', true);
      wrap('击败后两件紫装随机掉落一件，走近地面装备即可永久收录。', rect.x + pad,
        sectionY + (desktop ? 66 : 56), rect.w - pad * 2, desktop ? 20 : 15, 2, desktop ? 12 : 9);
    }
    drawCraftSetSummary(set, rect, desktop, sectionY);
    const actionRect = { x: rect.x + pad, y: rect.y + rect.h - (desktop ? 62 : 53), w: rect.w - pad * 2, h: desktop ? 42 : 36 };
    const label = eq ? (eq.roll >= 100 ? '词条已完美' : '重描 · ' + set.special + ' 1') : (gold ? '制作 ' + def.name : '仅正式主线掉落');
    button(actionRect, label, () => eq ? reroll(key) : craft(key),
      eq ? eq.roll < 100 && d.horns > 0 : gold && m.data.ink >= craftInkCost() && d.cores >= 4 && d.horns >= 1,
      false, color, desktop ? 13 : 10);
    if (ui.message) txt(ui.message, rect.x + rect.w / 2, actionRect.y - 12, desktop ? 11 : 9, set.color, 'center', false, rect.w - pad * 2);
    button({ x: rect.x + rect.w - 43, y: rect.y + 9, w: 32, h: 28 }, '×', () => {
      ui.craftOpen = false; ui.message = '';
    }, true, false, GRAY, 17);
  }
  function drawInventory() {
    if (state !== 'metaInventory' || !meta()) return false; U.hits = [];
    if (U.selected === 'scribble' && Legacy) {
      const result = Legacy.drawInventory(), desktop = isDesktopLayout();
      if (Legacy.state.tab === 'craft' && !Legacy.state.craftOpen) drawSetList(desktop, 140);
      return result;
    }
    const set = setById[U.selected], desktop = isDesktopLayout(), ui = Legacy ? Legacy.state : U, d = data(set.id);
    panel(set, desktop, ui.tab === 'craft');
    const tabX = desktop ? 48 : 24, tabW = desktop ? 130 : 108;
    button({ x: tabX, y: 72, w: tabW, h: 34 }, '穿戴', () => { ui.tab = 'loadout'; ui.page = 0; ui.craftOpen = false; ui.message = ''; }, true, ui.tab === 'loadout');
    button({ x: tabX + tabW + 10, y: 72, w: tabW, h: 34 }, '制作', () => { ui.tab = 'craft'; ui.page = 0; ui.craftOpen = false; ui.message = ''; }, true, ui.tab === 'craft', GOLD);
    if (ui.tab === 'craft') txt('墨核 ' + d.cores + ' · ' + set.special + ' ' + d.horns,
      W - (desktop ? 48 : 18), desktop ? 94 : 127, desktop ? 11 : 8, GRAY, 'right');
    if (ui.tab === 'loadout') drawLoadout(desktop); else drawCraft(set, desktop);
    if (meta().reforgeOffers && Legacy && Legacy.drawReforgeOffers) {
      Legacy.drawReforgeOffers(desktop); U.hits = Legacy.state.hits; return true;
    }
    if (ui.tab === 'craft' && ui.craftOpen) return true;
    if (ui.message) txt(ui.message, W / 2, desktop ? 620 : 599, desktop ? 12 : 9, ui.tab === 'craft' ? set.color : INK, 'center', false, W - 120);
    const backW = desktop ? 100 : 82, backX = W - (desktop ? 48 : 18) - backW;
    button({ x: backX, y: desktop ? 656 : 620, w: backW, h: 32 }, '返回', () => { ui.message = ''; meta().goHome(); }, true, false, INK, 10);
    return true;
  }
  function handlePointer(e) {
    if (state !== 'metaInventory') return false; const p = toLogical(e);
    for (let i = U.hits.length - 1; i >= 0; i--) { const h = U.hits[i]; if (!pointInRect(p, h.rect)) continue; if (h.enabled && h.action) h.action(); return true; }
    if (U.selected === 'scribble' && Legacy) return Legacy.handlePointer(e); return true;
  }

  const API = {
    spawnBossRewards, collectMaterial, onEquipmentCollected, craft, craftInkCost, reroll, toggleEquip, exchange, perfectSet,
    setCount(id, equipment) { return typeof id === 'string' ? count(id, equipment) : (Legacy ? Legacy.setCount(id) : 0); },
    drawInventory, handlePointer, selectSet,
    get state() { return Legacy ? Legacy.state : U; }, get collectionState() { return U; }, get sets() { return sets; }
  };
  window.BossSetRuntime = API; if (typeof globalThis !== 'undefined') globalThis.BossSetRuntime = API;
  window.BossCollectionRuntime = {
    register, hooks, states, state: setState, count, activeSets, data, baseDamage, baseForSkill, setDamage, hit, blast, line, delay, zone, projectile,
    echo, mark, marked, addShield, refundFor, consumeBlock, fx: FX, lastCasts, setById,
    updateFx, drawInventory, craft, reroll, toggleEquip, exchange, perfectSet, spawnBossRewards,
    inventoryStatus() { return { state, meta: !!meta(), selected: U.selected, sets: sets.length }; }
  };
})();

/* 哈迪斯武器启发第二批：十个高辨识度主动与二十条专属辅助。 */
(() => {
  'use strict';

  // 技能表现统一读取 calc 缓存的属性色；红色只保留给敌方攻击。
  const IDS = ['pageslash', 'piercerush', 'spinlance', 'shieldrush', 'ricoshield',
    'perfectarrow', 'arrowfocus', 'magfist', 'inkgrenade', 'heatrail'];
  const S = {
    slashes: [], dashes: [], lances: [], shields: [], charges: [], bolts: [], fists: [], grenades: [], fx: [],
    shieldRush: null, rail: null, nextId: 1
  };

  Object.assign(SKILL_DEFS, {
    pageslash: { name: '断页斩', desc: '短暂蓄力后斩出 240° 大刀光，高伤并斩断敌弹，纸面留下裂痕' },
    piercerush: { name: '交叉贯枪', desc: '双枪影交叉贯穿，交叉点产生剪切爆发，角色原地施放' },
    spinlance: { name: '钉页旋枪', desc: '投出长枪钉在远处持续旋转，到期后飞回并切割沿途敌人' },
    shieldrush: { name: '三层盾印', desc: '获得三层盾印，受击消耗一层并减伤反击，结束时按剩余层数盾震' },
    ricoshield: { name: '折跃飞盾', desc: '大盾在敌人之间弹射，最后返回；接住盾牌可立即再投' },
    perfectarrow: { name: '完美一箭', desc: '自动完成蓄力，在完美区间释放高伤贯穿箭' },
    arrowfocus: { name: '群箭批注', desc: '标记目标并悬停箭阵，随后依次转向集火同一目标' },
    magfist: { name: '磁墨升拳', desc: '在远程目标点聚怪并浮空，随后上勾下砸，角色原地施放' },
    inkgrenade: { name: '墨榴弹', desc: '向远处抛出大墨弹，落地延迟后重爆炸并留下焦黑纸洞' },
    heatrail: { name: '过热扫射', desc: '自动进行短连射并积热，结束时发射一枚高伤终末弹' }
  });
  Object.assign(SKILL_TAGS, {
    pageslash: ['strike'], piercerush: ['strike'], spinlance: ['area'], shieldrush: ['strike'], ricoshield: ['proj'],
    perfectarrow: ['proj'], arrowfocus: ['proj'], magfist: ['strike'], inkgrenade: ['area'], heatrail: ['proj']
  });
  Object.assign(SKILL_ATTR, {
    pageslash: 'phys', piercerush: 'phys', spinlance: 'ice', shieldrush: 'phys', ricoshield: 'ice',
    perfectarrow: 'ice', arrowfocus: 'thunder', magfist: 'phys', inkgrenade: 'fire', heatrail: 'fire'
  });
  Object.assign(INK_COST, { pageslash: 5, piercerush: 5, spinlance: 6, shieldrush: 5, ricoshield: 5,
    perfectarrow: 4, arrowfocus: 6, magfist: 5, inkgrenade: 6, heatrail: 6 });

  function has(id) { return !!(player && player.taken && player.taken[id]); }
  function active(id) { return player && player.actives.some(a => a.id === id); }
  function passive(id, name, desc, skill) {
    PASSIVES.push({ id, name, desc, once: true, available: () => active(skill), fx: () => { player.taken[id] = true; } });
  }
  passive('slash_echo', '余锋裂纸', '断页斩的斩痕二次爆裂，造成 60% 伤害', 'pageslash');
  passive('slash_pull', '回锋收页', '断页斩回卷，将外圈小怪拖近并追加反向斩', 'pageslash');
  passive('pierce_long', '一线到底', '双枪距离与宽度 +30%，两个终点产生范围冲击', 'piercerush');
  passive('pierce_return', '去而复返', '双枪到达终点后沿原路返回，造成 60% 伤害', 'piercerush');
  passive('spin_double', '双枪钉页', '额外投出一柄旋枪，单柄伤害 -25%', 'spinlance');
  passive('spin_pull', '收枪聚纸', '旋枪返回时拖拽敌人，聚拢时追加碰撞伤害', 'spinlance');
  passive('shield_reflect', '盾面反批', '盾印格挡敌弹时将其原路弹回', 'shieldrush');
  passive('shield_bash', '碎页守城', '盾印结算时强化盾震，剩余层数提高范围与伤害', 'shieldrush');
  passive('ricoshield_double', '双盾轮转', '同时掷出第二面盾牌，单盾伤害 -20%', 'ricoshield');
  passive('ricoshield_catch', '接盾震页', '接住盾牌时释放近身冲击并重置投掷', 'ricoshield');
  passive('perfect_tail', '裂帛箭尾', '完美射击穿过目标后追加冰晶剑气', 'perfectarrow');
  passive('perfect_split', '一箭双星', '完美命中后向两侧分裂箭矢，射击附近目标', 'perfectarrow');
  passive('focus_more', '悬箭扩编', '集火箭矢 +4，悬停阵列扩大', 'arrowfocus');
  passive('focus_burst', '满批电叉', '同一目标被集火命中 6 次后触发电叉爆裂', 'arrowfocus');
  passive('fist_aftershock', '坠地余震', '下砸后再次扩散一次 50% 伤害的冲击环', 'magfist');
  passive('fist_juggle', '浮空追打', '对浮空目标伤害 +35%，下砸后再次小幅弹起', 'magfist');
  passive('grenade_cluster', '子母墨弹', '主爆炸后抛出 5 枚依次落地的小墨弹', 'inkgrenade');
  passive('grenade_sticky', '黏纸雷壳', '墨弹黏在首个目标身上，爆炸范围 +30%', 'inkgrenade');
  passive('rail_double', '双线枪机', '每第 5 发子弹额外射出两条侧向弹道', 'heatrail');
  passive('rail_final', '红热终章', '终末弹按剩余热量产生范围爆炸', 'heatrail');

  const COMMON = ['brutal', 'swift', 'focus', 'dot'];
  const STRIKE = ['heavyweight', 'firstblood', 'combo', 'scrit', 'counter', 'rapid', 'followup', 'leech', 'shock'];
  const AREA = ['wide', 'saturate', 'soak', 'sheath', 'pressboss', 'stain'];
  const PROJ = ['sharpen', 'projspd', 'heavynib', 'longshot', 'fatpipe'];
  const ALLOWED = {
    pageslash: COMMON.concat(STRIKE), piercerush: COMMON.concat(STRIKE), spinlance: COMMON.concat(AREA, ['dur']),
    shieldrush: COMMON.concat(STRIKE), ricoshield: COMMON.concat(PROJ), perfectarrow: COMMON.concat(PROJ),
    arrowfocus: COMMON.concat(PROJ), magfist: COMMON.concat(STRIKE), inkgrenade: COMMON.concat(AREA), heatrail: COMMON.concat(PROJ)
  };
  if (SUPPORTS.dur.skills && !SUPPORTS.dur.skills.includes('spinlance')) SUPPORTS.dur.skills.push('spinlance');
  const baseSupportUsable = supportUsable;
  supportUsable = function(sid, aid) {
    if (ALLOWED[aid]) return ALLOWED[aid].includes(sid);
    return baseSupportUsable(sid, aid);
  };

  function cap(array, item, max) { if (array.length >= max) array.shift(); array.push(item); return item; }
  function fx(type, x, y, radius, color, duration, extra) {
    return cap(S.fx, Object.assign({ type, x, y, r: radius, col: color || INK, t: duration, total: duration }, extra || {}), 56);
  }
  function byId(id) { return enemies.find(e => e.id === id && !e.dead) || null; }
  function nearest(x, y, range, excluded) {
    let best = null, dist = range * range;
    for (const e of enemies) {
      if (e.dead || e.id === excluded) continue;
      const d = (e.x - x) ** 2 + (e.y - y) ** 2;
      if (d < dist) { dist = d; best = e; }
    }
    return best;
  }
  function angleDiff(a, b) { return Math.atan2(Math.sin(a - b), Math.cos(a - b)); }
  function segmentDistance(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1, dy = y2 - y1, length = dx * dx + dy * dy || 1;
    const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / length));
    return Math.hypot(px - (x1 + dx * t), py - (y1 + dy * t));
  }
  function areaDamage(e, amount, c, skill, x, y) {
    if (!e || e.dead) return;
    if (skill === 'magfist' && e.weaponAirT > 0 && has('fist_juggle')) amount *= 1.35;
    areaHit(e, amount, c, x, y);
  }
  function directDamage(e, amount, c, skill, x, y) {
    if (!e || e.dead) return;
    hurtEnemy(e, amount, amount * (c.dot || 0), x, y, c.vuln || 0, c.bcrit || 0, 0,
      c.col || attrOf(skill), false, skill);
  }
  function blast(x, y, radius, damage, c, skill, color) {
    const col = color || (c && c.col) || attrOf(skill);
    fx('blast', x, y, radius, col, 0.42);
    fx('crack', x, y, radius * 0.72, col, 2.4);
    shakeT = Math.max(shakeT, Math.min(0.18, radius / 700));
    hitStopT = Math.max(hitStopT, radius >= 100 ? 0.035 : 0.018);
    for (const e of enemies) if (!e.dead && Math.hypot(e.x - x, e.y - y) < radius + e.r) areaDamage(e, damage, c, skill, x, y);
  }

  function firePageslash(a, c) {
    const target = nearest(player.x, player.y, 300 * c.rad);
    if (!target) return false;
    const angle = Math.atan2(target.y - player.y, target.x - player.x);
    cap(S.slashes, { id: S.nextId++, x: player.x, y: player.y, angle, r: 195 * c.rad, age: 0, c,
      hit: false, echo: false, pull: false }, 8);
    return true;
  }
  function updateSlashes(dt) {
    for (const slash of S.slashes) {
      slash.age += dt;
      if (!slash.hit && slash.age >= 0.18) {
        slash.hit = true;
        const hooks = window.__weaponPassives;
        for (const e of enemies) {
          const d = Math.hypot(e.x - slash.x, e.y - slash.y);
          if (e.dead || d > slash.r + e.r || Math.abs(angleDiff(Math.atan2(e.y - slash.y, e.x - slash.x), slash.angle)) > Math.PI * 2 / 3) continue;
          const damage = hooks ? hooks.modifySlashDamage(slash, 46 * slash.c.dmg) : 46 * slash.c.dmg;
          areaDamage(e, damage, slash.c, 'pageslash', slash.x, slash.y);
          if (has('slash_pull') && d > slash.r * 0.52 && !e.boss) {
            const pull = Math.min(48, d * 0.3); e.x -= Math.cos(slash.angle) * pull; e.y -= Math.sin(slash.angle) * pull;
          }
        }
        for (const eb of ebullets) if (Math.hypot(eb.x - slash.x, eb.y - slash.y) < slash.r) {
          eb.life = 0; if (hooks) hooks.onSlashCut(slash, eb);
        }
        fx('slash', slash.x, slash.y, slash.r, slash.c.col, 0.48, { angle: slash.angle });
        if (has('slash_pull')) {
          fx('slash', slash.x, slash.y, slash.r * 0.88, slash.c.col, 0.42, { angle: slash.angle + Math.PI, reverse: true });
          for (const e of enemies) if (!e.dead && Math.hypot(e.x - slash.x, e.y - slash.y) < slash.r * 0.9 + e.r)
            areaDamage(e, 18 * slash.c.dmg, slash.c, 'pageslash', slash.x, slash.y);
        }
        if (hooks) hooks.onSlashReleased(slash);
      }
      if (slash.hit && !slash.echo && has('slash_echo') && slash.age >= 0.58) {
        slash.echo = true; blast(slash.x + Math.cos(slash.angle) * slash.r * 0.45, slash.y + Math.sin(slash.angle) * slash.r * 0.45,
          slash.r * 0.75, 27.6 * slash.c.dmg, slash.c, 'pageslash', slash.c.col);
      }
    }
    for (let i = S.slashes.length - 1; i >= 0; i--) if (S.slashes[i].age > 0.95) S.slashes.splice(i, 1);
  }

  function firePiercerush(a, c) {
    const target = nearest(player.x, player.y, 470);
    if (!target || S.dashes.length > 2) return false;
    const angle = Math.atan2(target.y - player.y, target.x - player.x);
    const extension = 155 * (has('pierce_long') ? 1.3 : 1), group = { burst: false };
    for (const side of [-1, 1]) {
      const x0 = player.x - Math.sin(angle) * side * 62, y0 = player.y + Math.cos(angle) * side * 62;
      const spearAngle = Math.atan2(target.y - y0, target.x - x0);
      const x1 = target.x + Math.cos(spearAngle) * extension, y1 = target.y + Math.sin(spearAngle) * extension;
      S.dashes.push({ id: S.nextId++, group, side, x0, y0, x1, y1, crossX: target.x, crossY: target.y,
        hx: x0, hy: y0, angle: spearAngle, phase: 'aim', t: 0, c,
        hits: Object.create(null), backHits: Object.create(null) });
    }
    return true;
  }
  function dashHits(d, x1, y1, x2, y2, multiplier, table) {
    const width = 24 * d.c.rad * (has('pierce_long') ? 1.3 : 1);
    const hooks = window.__weaponPassives;
    for (const e of enemies) {
      if (e.dead || table[e.id] || segmentDistance(e.x, e.y, x1, y1, x2, y2) > width + e.r) continue;
      table[e.id] = true;
      const raw = 42 * d.c.dmg * 0.55 * multiplier, damage = hooks ? hooks.modifyDashHit(d, e, raw) : raw;
      areaDamage(e, damage, d.c, 'piercerush', x1, y1);
      if (!e.boss) { e.kbx += Math.cos(d.angle) * 150; e.kby += Math.sin(d.angle) * 150; }
    }
  }
  function updateDashes(dt) {
    for (const d of S.dashes) {
      d.t += dt;
      if (d.phase === 'aim') {
        if (d.t >= 0.18) { d.phase = 'out'; d.t = 0; fx('line', d.x0, d.y0, 0, d.c.col, 0.3, { x2: d.x1, y2: d.y1 }); }
        continue;
      }
      const back = d.phase === 'back', duration = 0.24, p = Math.min(1, d.t / duration);
      const sx = back ? d.x1 : d.x0, sy = back ? d.y1 : d.y0, ex = back ? d.x0 : d.x1, ey = back ? d.y0 : d.y1;
      const oldX = d.hx, oldY = d.hy;
      d.hx = sx + (ex - sx) * p; d.hy = sy + (ey - sy) * p;
      dashHits(d, oldX, oldY, d.hx, d.hy, back ? 0.6 : 1, back ? d.backHits : d.hits);
      fx('spear', d.hx, d.hy, 25, d.c.col, 0.18, { angle: d.angle + (back ? Math.PI : 0) });
      if (p >= 1) {
        if (!back && !d.group.burst) {
          d.group.burst = true;
          blast(d.crossX, d.crossY, 82 * d.c.rad, 16 * d.c.dmg, d.c, 'piercerush', d.c.col);
          fx('crosscut', d.crossX, d.crossY, 64 * d.c.rad, d.c.col, 0.38, { angle: d.angle });
        }
        if (!back && has('pierce_long')) blast(d.x1, d.y1, 76 * d.c.rad, 14 * d.c.dmg, d.c, 'piercerush', d.c.col);
        if (window.__weaponPassives) window.__weaponPassives.onDashEnd(d, back);
        if (!back && has('pierce_return')) { d.phase = 'back'; d.t = 0; }
        else d.done = true;
      }
    }
    for (let i = S.dashes.length - 1; i >= 0; i--) if (S.dashes[i].done) S.dashes.splice(i, 1);
  }

  function makeLance(x, y, c, targetId) {
    cap(S.lances, { id: S.nextId++, x, y, angle: Math.random() * Math.PI, t: 3.6 * c.areaT, tick: 0,
      c, targetId: targetId || 0, returning: false, hits: Object.create(null),
      damage: 16 * c.dmg * (has('spin_double') ? 0.75 : 1) }, 4);
  }
  function fireSpinlance(a, c) {
    const target = nearest(player.x, player.y, 430);
    const angle = target ? Math.atan2(target.y - player.y, target.x - player.x) : player.faceA;
    const x = target ? target.x : player.x + Math.cos(angle) * 180, y = target ? target.y : player.y + Math.sin(angle) * 180;
    makeLance(x, y, c, target && target.id);
    if (has('spin_double')) makeLance(x + Math.cos(angle + Math.PI / 2) * 115, y + Math.sin(angle + Math.PI / 2) * 115, c, target && target.id);
    return true;
  }
  function updateLances(dt) {
    for (const l of S.lances) {
      l.angle += dt * 9;
      if (!l.returning) {
        l.t -= dt; l.tick -= dt;
        if (l.tick <= 0) {
          l.tick += 0.36;
          for (const e of enemies) if (!e.dead && Math.hypot(e.x - l.x, e.y - l.y) < 92 * l.c.rad + e.r) {
            e.spinSlowT = Math.max(e.spinSlowT || 0, 0.45);   // 冰旋枪范围内减速 20%
            areaDamage(e, l.damage, l.c, 'spinlance', l.x, l.y);
          }
        }
        if (l.t <= 0 || (l.targetId && !byId(l.targetId))) {
          l.returning = true;
          if (window.__weaponPassives) window.__weaponPassives.onLanceReturn(l);
        }
      } else {
        const angle = Math.atan2(player.y - l.y, player.x - l.x), oldX = l.x, oldY = l.y;
        l.x += Math.cos(angle) * 610 * dt; l.y += Math.sin(angle) * 610 * dt;
        for (const e of enemies) {
          if (e.dead || l.hits[e.id] || segmentDistance(e.x, e.y, oldX, oldY, l.x, l.y) > 35 + e.r) continue;
          l.hits[e.id] = true; areaDamage(e, l.damage * 1.6, l.c, 'spinlance', oldX, oldY);
          if (has('spin_pull') && !e.boss) {
            const d = Math.hypot(player.x - e.x, player.y - e.y);
            if (d > 42) { e.x += (player.x - e.x) / d * Math.min(65, d - 42); e.y += (player.y - e.y) / d * Math.min(65, d - 42); }
            areaDamage(e, l.damage * 0.45, l.c, 'spinlance', player.x, player.y);
          }
        }
        if (Math.hypot(player.x - l.x, player.y - l.y) < 24) l.done = true;
      }
    }
    for (let i = S.lances.length - 1; i >= 0; i--) if (S.lances[i].done) S.lances.splice(i, 1);
  }

  function fireShieldrush(a, c) {
    if (S.shieldRush) return false;
    const target = nearest(player.x, player.y, 380);
    const angle = target ? Math.atan2(target.y - player.y, target.x - player.x) : player.faceA;
    S.shieldRush = { angle, t: 0, duration: 3.6, layers: 3, c, counters: 0, done: false };
    fx('ring', player.x, player.y, 58, c.col, 0.35);
    return true;
  }
  function finishShieldRush(d) {
    if (!d || d.done) return;
    d.done = true;
    const hooks = window.__weaponPassives;
    let raw = (14 + d.layers * 8) * d.c.dmg;
    if (has('shield_bash')) raw += (24 + d.layers * 6) * d.c.dmg;
    raw *= 1 + Math.min(0.36, d.counters * 0.12);   // 每次真实格挡强化结束盾震，最多 +36%
    const damage = hooks ? hooks.modifyShieldBash(d, raw) : raw;
    blast(player.x, player.y, (82 + d.layers * 18) * d.c.rad, damage, d.c, 'shieldrush', d.c.col);
    S.shieldRush = null;
  }
  function consumeShieldRush(d) {
    if (!d || d.done || d.layers <= 0) return;
    d.layers--; d.counters++;
    blast(player.x, player.y, 76 * d.c.rad, 18 * d.c.dmg, d.c, 'shieldrush', d.c.col);
    fx('shieldbreak', player.x, player.y, 54, d.c.col, 0.32, { layer: d.layers });
    if (d.layers <= 0) finishShieldRush(d);
  }
  function updateShieldRush(dt) {
    const d = S.shieldRush; if (!d) return;
    const hooks = window.__weaponPassives;
    d.t += dt;
    for (const eb of ebullets) {
      if (eb.life <= 0 || Math.hypot(eb.x - player.x, eb.y - player.y) > 76 + (eb.r || 0)) continue;
      eb.life = 0; fx('ring', eb.x, eb.y, 28, d.c.col, 0.2);
      if (hooks) hooks.onShieldBlock(d, eb);
      if (has('shield_reflect')) {
        const dx = eb.x - player.x, dy = eb.y - player.y;
        spawnBolt({ kind: 'rail', skill: 'shieldrush', x: eb.x, y: eb.y,
          angle: Math.atan2(-dy, -dx), speed: 640, damage: 34 * d.c.dmg, c: d.c, radius: 5, life: 0.8 });
      }
    }
    if (d.t >= d.duration) finishShieldRush(d);
  }

  function fireRicoshield(a, c) {
    const target = nearest(player.x, player.y, 440 * (1 + c.lifeMul));
    if (!target) return false;
    const count = has('ricoshield_double') ? 2 : 1;
    for (let i = 0; i < count; i++) cap(S.shields, { id: S.nextId++, x: player.x, y: player.y, px: player.x, py: player.y,
      targetId: target.id, lastId: 0, bounces: 0, angle: i * Math.PI, spin: i ? -11 : 11, returning: false,
      damage: 29 * c.dmg * (1 + c.bdmg) * (count > 1 ? 0.8 : 1), c }, 4);
    return true;
  }
  function updateRicoshields(dt) {
    for (const shield of S.shields) {
      shield.px = shield.x; shield.py = shield.y; shield.angle += shield.spin * dt;
      let target = shield.returning ? player : byId(shield.targetId);
      if (!shield.returning && !target) {
        target = nearest(shield.x, shield.y, 460 * (1 + shield.c.lifeMul), shield.lastId);
        if (target) shield.targetId = target.id; else shield.returning = true;
      }
      target = shield.returning ? player : target; if (!target) { shield.done = true; continue; }
      const angle = Math.atan2(target.y - shield.y, target.x - shield.x), speed = 540 * shield.c.proj;
      shield.x += Math.cos(angle) * speed * dt; shield.y += Math.sin(angle) * speed * dt;
      const hitRadius = shield.returning ? 25 : target.r + 15 * (1 + shield.c.brad);
      if (Math.hypot(target.x - shield.x, target.y - shield.y) > hitRadius) continue;
      if (shield.returning) {
        shield.done = true;
        if (window.__weaponPassives) window.__weaponPassives.onShieldCatch(shield);
        if (has('ricoshield_catch')) {
          blast(player.x, player.y, 105 * shield.c.rad, 20 * shield.c.dmg, shield.c, 'ricoshield', shield.c.col);
          for (const a of player.actives) if (a.id === 'ricoshield') a.t = 0;
        }
      } else {
        const repeat = target.id === shield.lastId;
        const baseDamage = shield.damage * (repeat ? 0.45 : 1);   // 单目标也可继续回弹，重复命中递减
        const damage = window.__weaponPassives ? window.__weaponPassives.modifyRicoDamage(shield, baseDamage) : baseDamage;
        directDamage(target, damage, shield.c, 'ricoshield', shield.x, shield.y);
        shield.lastId = target.id; shield.bounces++; shield.returning = shield.bounces >= 6;
        if (!shield.returning) {
          const next = nearest(shield.x, shield.y, 460 * (1 + shield.c.lifeMul), target.id);
          if (next) shield.targetId = next.id;
          else if (!target.dead) shield.targetId = target.id;
          else shield.returning = true;
        }
        fx('ring', shield.x, shield.y, 32 * (1 + shield.c.brad), shield.c.col, 0.2);
      }
    }
    for (let i = S.shields.length - 1; i >= 0; i--) if (S.shields[i].done) S.shields.splice(i, 1);
  }

  function firePerfectarrow(a, c) {
    const target = nearest(player.x, player.y, 560);
    if (!target) return false;
    cap(S.charges, { id: S.nextId++, targetId: target.id, age: 0, c, angle: 0 }, 4);
    return true;
  }
  function spawnBolt(o) {
    const angle = o.angle || 0, speed = o.speed || 700;
    const bolt = cap(S.bolts, Object.assign({ id: S.nextId++, x: player.x, y: player.y, px: player.x, py: player.y,
      angle, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, speed, radius: 5, life: 0.9,
      damage: 10, skill: 'heatrail', kind: 'rail', hits: Object.create(null), pierce: 0, delay: 0 }, o), 84);
    if (window.__supportExpansion && window.__supportExpansion.decorateBolt) window.__supportExpansion.decorateBolt(bolt, bolt.c, o);
    return bolt;
  }
  function updateCharges(dt) {
    for (const charge of S.charges) {
      charge.age += dt;
      const target = byId(charge.targetId) || nearest(player.x, player.y, 560);
      if (target) { charge.targetId = target.id; charge.angle = Math.atan2(target.y - player.y, target.x - player.x); }
      if (charge.age >= 0.58) {
        spawnBolt({ kind: 'perfect', skill: 'perfectarrow', x: player.x, y: player.y, angle: charge.angle,
          speed: 1050 * charge.c.proj, damage: 72 * charge.c.dmg * (1 + charge.c.bdmg), c: charge.c,
          radius: 10 * charge.c.rad * (1 + charge.c.brad), life: 0.75 * (1 + charge.c.lifeMul), pierce: 99 });
        fx('flash', player.x + Math.cos(charge.angle) * 35, player.y + Math.sin(charge.angle) * 35, 35, charge.c.col, 0.16);
        charge.done = true;
      }
    }
    for (let i = S.charges.length - 1; i >= 0; i--) if (S.charges[i].done) S.charges.splice(i, 1);
  }

  function fireArrowfocus(a, c) {
    const target = nearest(player.x, player.y, 520);
    if (!target) return false;
    target.weaponMarkHits = 0; target.weaponMarkT = 4;
    const count = 8 + (c.count || 0) + (has('focus_more') ? 4 : 0);
    for (let i = 0; i < count; i++) spawnBolt({ kind: 'focus', skill: 'arrowfocus', targetId: target.id,
      x: player.x, y: player.y, angle: -Math.PI + i / Math.max(1, count - 1) * Math.PI, hoverIndex: i,
      speed: 680 * c.proj, damage: 11 * c.dmg * (1 + c.bdmg), c, radius: 5 * c.rad * (1 + c.brad),
      delay: 0.5 + i * 0.055, life: 1.6 * (1 + c.lifeMul) });
    return true;
  }

  function fireMagfist(a, c) {
    const target = nearest(player.x, player.y, 430 * c.rad);
    if (!target) return false;
    cap(S.fists, { id: S.nextId++, targetId: target.id, x: target.x, y: target.y, age: 0, c,
      pull: false, pullCount: 0, upper: false, slam: false, after: false }, 3);
    return true;
  }
  function updateFists(dt) {
    for (const fist of S.fists) {
      fist.age += dt;
      let target = byId(fist.targetId) || nearest(fist.x, fist.y, 150 * fist.c.rad);
      if (target) fist.targetId = target.id;
      if (!fist.pull && fist.age >= 0.12) {
        fist.pull = true;
        for (const e of enemies) {
          const dx = fist.x - e.x, dy = fist.y - e.y, d = Math.hypot(dx, dy);
          if (e.dead || d >= 150 * fist.c.rad) continue;
          fist.pullCount++;
          if (!e.boss && d > 5) {
            const pull = Math.min(72, d * 0.72, d - 5);
            e.x += dx / d * pull; e.y += dy / d * pull;
          }
        }
        fx('magnet', fist.x, fist.y, 150 * fist.c.rad, fist.c.col, 0.42);
      }
      if (!fist.upper && fist.age >= 0.28 && target) {
        fist.upper = true;
        areaDamage(target, 32 * fist.c.dmg * (target.boss ? 1.35 : 1), fist.c, 'magfist', fist.x, fist.y);
        if (!target.boss) { target.weaponAirT = target.weaponAirTotal = 0.82; target.weaponAirLift = 38; }
        fx('upper', target.x, target.y, 64, fist.c.col, 0.36);
      }
      if (!fist.slam && fist.age >= 0.64) {
        fist.slam = true;
        fist.slamX = target ? target.x : fist.x; fist.slamY = target ? target.y : fist.y;
        if (target) target.weaponAirT = 0;
        blast(fist.slamX, fist.slamY, 110 * fist.c.rad, 43 * fist.c.dmg, fist.c, 'magfist', fist.c.col);
        if (target && has('fist_juggle') && !target.dead && !target.boss) {
          target.weaponAirT = target.weaponAirTotal = 0.48; target.weaponAirLift = 22;
        }
      }
      if (fist.slam && !fist.after && has('fist_aftershock') && fist.age >= 1.05) {
        fist.after = true; blast(fist.slamX, fist.slamY, 135 * fist.c.rad, 21.5 * fist.c.dmg, fist.c, 'magfist', fist.c.col);
      }
      if (fist.age > 1.25) fist.done = true;
    }
    for (let i = S.fists.length - 1; i >= 0; i--) if (S.fists[i].done) S.fists.splice(i, 1);
    for (const e of enemies) {
      e.weaponAirT = Math.max(0, (e.weaponAirT || 0) - dt);
      e.weaponMarkT = Math.max(0, (e.weaponMarkT || 0) - dt);
    }
  }

  function fireInkgrenade(a, c) {
    const target = nearest(player.x, player.y, 470);
    if (!target) return false;
    cap(S.grenades, { id: S.nextId++, sx: player.x, sy: player.y, x: player.x, y: player.y, z: 0,
      tx: target.x, ty: target.y, targetId: has('grenade_sticky') ? target.id : 0, age: 0, duration: 0.82,
      radius: 105 * c.rad * (has('grenade_sticky') ? 1.3 : 1), damage: 52 * c.dmg, c, main: true }, 18);
    return true;
  }
  function explodeGrenade(g) {
    blast(g.x, g.y, g.radius, g.damage, g.c, 'inkgrenade', g.c.col);
    if (g.main && has('grenade_cluster')) {
      const count = g.formSplit ? 3 : 5;
      for (let i = 0; i < count; i++) {
        const angle = i / count * Math.PI * 2;
        cap(S.grenades, { id: S.nextId++, sx: g.x, sy: g.y, x: g.x, y: g.y, z: 0,
          tx: g.x + Math.cos(angle) * 105, ty: g.y + Math.sin(angle) * 105, targetId: 0,
          age: 0, duration: 0.32 + i * 0.07, radius: 46 * g.c.rad, damage: 19 * g.c.dmg, c: g.c, main: false }, 18);
      }
    }
    g.done = true;
  }
  function updateGrenades(dt) {
    // 本帧生成的子母弹从下一帧才开始计时，保留可见的抛物线与依次爆炸。
    const count = S.grenades.length;
    for (let index = 0; index < count; index++) {
      const g = S.grenades[index];
      g.age += dt;
      const target = g.targetId ? byId(g.targetId) : null;
      if (target) { g.tx = target.x; g.ty = target.y; }
      const p = Math.min(1, g.age / g.duration);
      g.x = g.sx + (g.tx - g.sx) * p; g.y = g.sy + (g.ty - g.sy) * p; g.z = Math.sin(p * Math.PI) * 80;
      if (p >= 1) explodeGrenade(g);
    }
    for (let i = S.grenades.length - 1; i >= 0; i--) if (S.grenades[i].done) S.grenades.splice(i, 1);
  }

  function fireHeatrail(a, c) {
    const target = nearest(player.x, player.y, 500);
    if (!target || S.rail) return false;
    S.rail = { age: 0, shotT: 0, shots: 0, heat: 0, angle: Math.atan2(target.y - player.y, target.x - player.x), c };
    return true;
  }
  function railShot(rail, angle, damage, kind) {
    spawnBolt({ kind: kind || 'rail', skill: 'heatrail', x: player.x + Math.cos(angle) * 18, y: player.y + Math.sin(angle) * 18,
      angle, speed: 830 * rail.c.proj, damage: damage * rail.c.dmg * (1 + rail.c.bdmg), c: rail.c,
      radius: (kind === 'final' ? 13 : 4.5) * rail.c.rad * (1 + rail.c.brad), life: 0.82 * (1 + rail.c.lifeMul),
      pierce: kind === 'final' ? 3 : 0, heat: rail.heat });
  }
  function updateRail(dt) {
    const rail = S.rail; if (!rail) return;
    rail.age += dt; rail.shotT -= dt;
    const target = nearest(player.x, player.y, 520);
    if (target) rail.angle = Math.atan2(target.y - player.y, target.x - player.x);
    if (rail.shotT <= 0 && rail.shots < 12) {
      rail.shotT += 0.09; rail.shots++; rail.heat = Math.min(1, rail.shots / 12);
      railShot(rail, rail.angle, 8.5, 'rail');
      if (has('rail_double') && rail.shots % 5 === 0) {
        railShot(rail, rail.angle - 0.18, 6.5, 'rail'); railShot(rail, rail.angle + 0.18, 6.5, 'rail');
      }
      fx('muzzle', player.x + Math.cos(rail.angle) * 24, player.y + Math.sin(rail.angle) * 24, 22, rail.c.col, 0.12);
    }
    player.weaponHeat = rail.heat;
    if (rail.shots >= 12 && rail.age >= 1.12) {
      railShot(rail, rail.angle, 44 * (1 + rail.heat), 'final');
      fx('flash', player.x + Math.cos(rail.angle) * 30, player.y + Math.sin(rail.angle) * 30, 45, rail.c.col, 0.2);
      player.weaponHeat = 0; S.rail = null;
    }
  }

  function updateBolts(dt) {
    for (const b of S.bolts) {
      b.px = b.x; b.py = b.y;
      if (b.delay > 0) { b.delay -= dt; continue; }
      b.life -= dt; if (b.life <= 0) continue;
      if (b.kind === 'focus') {
        let target = byId(b.targetId);
        if (!target) { target = nearest(b.x, b.y, 500); if (target) b.targetId = target.id; }
        if (target) { const a = Math.atan2(target.y - b.y, target.x - b.x); b.angle = a; b.vx = Math.cos(a) * b.speed; b.vy = Math.sin(a) * b.speed; }
      }
      b.x += b.vx * dt; b.y += b.vy * dt;
      for (const e of enemies) {
        if (e.dead || b.hits[e.id] || segmentDistance(e.x, e.y, b.px, b.py, b.x, b.y) > b.radius + e.r) continue;
        b.hits[e.id] = true;
        const hooks = window.__weaponPassives, damage = hooks ? hooks.modifyBoltDamage(b, e, b.damage) : b.damage;
        directDamage(e, damage, b.c, b.skill, b.x, b.y);
        if (hooks) hooks.onBoltHit(b, e);
        if (b.kind === 'perfect') {
          if (has('perfect_tail') && !b.tailDone) {
            b.tailDone = true;
            const tx = e.x + Math.cos(b.angle) * 48, ty = e.y + Math.sin(b.angle) * 48;
            fx('line', e.x, e.y, 0, b.c.col, 0.35, { x2: tx, y2: ty });
            for (const other of enemies) if (!other.dead && segmentDistance(other.x, other.y, e.x, e.y, tx, ty) < 28 + other.r)
              directDamage(other, 24 * b.c.dmg, b.c, 'perfectarrow', e.x, e.y);
          }
          if (has('perfect_split') && !b.splitDone) {
            b.splitDone = true;
            for (const side of [-1, 1]) spawnBolt({ kind: 'split', skill: 'perfectarrow', x: e.x, y: e.y,
              angle: b.angle + side * 0.62, speed: 760, damage: 24 * b.c.dmg, c: b.c, radius: 6, life: 0.65, pierce: 1 });
          }
        } else if (b.kind === 'focus') {
          e.weaponMarkHits = (e.weaponMarkHits || 0) + 1; e.weaponMarkT = 2; e.weaponMarkC = b.c.col;
          if (has('focus_burst') && e.weaponMarkHits >= 6) {
            e.weaponMarkHits = 0; blast(e.x, e.y, 72 * b.c.rad, 34 * b.c.dmg, b.c, 'arrowfocus', b.c.col);
          }
        } else if (b.kind === 'final' && has('rail_final') && !b.exploded) {
          b.exploded = true; blast(b.x, b.y, 65 + 85 * b.heat, 32 * b.heat * b.c.dmg, b.c, 'heatrail', b.c.col);
        }
        if (b.pierce > 0) b.pierce--; else { b.life = 0; break; }
      }
    }
    for (let i = S.bolts.length - 1; i >= 0; i--) if (S.bolts[i].life <= 0) S.bolts.splice(i, 1);
  }

  function updateFx(dt) {
    for (const f of S.fx) f.t -= dt;
    for (let i = S.fx.length - 1; i >= 0; i--) if (S.fx[i].t <= 0) S.fx.splice(i, 1);
  }
  function updateWeapons(dt) {
    updateSlashes(dt); updateDashes(dt); updateLances(dt); updateShieldRush(dt); updateRicoshields(dt);
    updateCharges(dt); updateFists(dt); updateGrenades(dt); updateRail(dt); updateBolts(dt); updateFx(dt);
    camX = player.x - VIEW_W / 2; camY = player.y - VIEW_H / 2;
  }

  function reset() {
    for (const key of ['slashes', 'dashes', 'lances', 'shields', 'charges', 'bolts', 'fists', 'grenades', 'fx']) S[key].length = 0;
    S.shieldRush = null; S.rail = null; S.nextId = 1; player.weaponHeat = 0;
  }
  const baseReset = resetGame;
  resetGame = function() { baseReset(); reset(); };
  const baseFireSkill = fireSkill;
  fireSkill = function(a, c) {
    if (a.id === 'pageslash') return firePageslash(a, c);
    if (a.id === 'piercerush') return firePiercerush(a, c);
    if (a.id === 'spinlance') return fireSpinlance(a, c);
    if (a.id === 'shieldrush') return fireShieldrush(a, c);
    if (a.id === 'ricoshield') return fireRicoshield(a, c);
    if (a.id === 'perfectarrow') return firePerfectarrow(a, c);
    if (a.id === 'arrowfocus') return fireArrowfocus(a, c);
    if (a.id === 'magfist') return fireMagfist(a, c);
    if (a.id === 'inkgrenade') return fireInkgrenade(a, c);
    if (a.id === 'heatrail') return fireHeatrail(a, c);
    return baseFireSkill(a, c);
  };
  const baseHurtPlayer = hurtPlayer;
  hurtPlayer = function(dmg, kind, source) {
    // 与基础受伤入口共用免疫条件：潜墨、弹反慢放和受击保护不会白耗盾印。
    if (player.diving || hitStopT > 0 || player.goldT > 0 || player.hurtT > 0) return baseHurtPlayer(dmg, kind, source);
    const shield = S.shieldRush;
    if (shield && shield.layers > 0) {
      const result = baseHurtPlayer(dmg * 0.25, kind, source);
      consumeShieldRush(shield);
      return result;
    }
    return baseHurtPlayer(dmg, kind, source);
  };
  const baseUpdate = update;
  update = function(dt) { baseUpdate(dt); if (state === 'play') updateWeapons(dt); };

  function line(x1, y1, x2, y2, color, width) { jline(x1, y1, x2, y2, color, width); }
  function polygon(points, color, width) {
    for (let i = 0; i < points.length; i++) { const a = points[i], b = points[(i + 1) % points.length]; line(a[0], a[1], b[0], b[1], color, width); }
  }
  function drawEffects() {
    for (const f of S.fx) {
      const p = 1 - f.t / f.total;
      ctx.globalAlpha = Math.max(0, 1 - p);
      if (f.type === 'blast') {
        ctx.fillStyle = p < 0.22 ? 'rgba(255,250,235,0.8)' : f.col; ctx.globalAlpha = p < 0.22 ? 0.75 : (1 - p) * 0.22;
        ctx.beginPath(); ctx.arc(f.x, f.y, f.r * Math.min(1, p * 2.4), 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1 - p; jcircle(f.x, f.y, f.r * Math.min(1, p * 1.8), f.col, 7 * (1 - p) + 1);
        for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; line(f.x + Math.cos(a) * f.r * p * 0.5,
          f.y + Math.sin(a) * f.r * 0.5, f.x + Math.cos(a) * f.r * p, f.y + Math.sin(a) * f.r * p, f.col, 2); }
      } else if (f.type === 'crack') {
        ctx.globalAlpha = Math.min(0.36, f.t / f.total * 0.36); jcircle(f.x, f.y, f.r * 0.75, f.col, 9);
        for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; line(f.x, f.y, f.x + Math.cos(a) * f.r, f.y + Math.sin(a) * f.r, f.col, 1.5); }
      } else if (f.type === 'slash') {
        ctx.globalAlpha = Math.min(1, f.t * 4); ctx.lineCap = 'round';
        for (let i = 0; i < 3; i++) {
          ctx.beginPath(); ctx.arc(f.x, f.y, f.r * (0.72 + i * 0.11), f.angle - Math.PI * 2 / 3 + p * 0.5,
            f.angle + Math.PI * 2 / 3 + p * 0.5); ctx.strokeStyle = f.col; ctx.lineWidth = 7 - i * 1.8; ctx.stroke();
        }
      } else if (f.type === 'line') line(f.x, f.y, f.x2, f.y2, f.col, 5 * (1 - p) + 1);
      else if (f.type === 'spear') {
        const c = Math.cos(f.angle), s = Math.sin(f.angle), nx = -s, ny = c;
        line(f.x - c * 42, f.y - s * 42, f.x + c * 22, f.y + s * 22, f.col, 6);
        line(f.x + c * 22, f.y + s * 22, f.x + c * 8 + nx * 9, f.y + s * 8 + ny * 9, f.col, 4);
        line(f.x + c * 22, f.y + s * 22, f.x + c * 8 - nx * 9, f.y + s * 8 - ny * 9, f.col, 4);
      } else if (f.type === 'crosscut') {
        const r = f.r * (0.35 + p * 0.65);
        line(f.x - r, f.y - r, f.x + r, f.y + r, f.col, 9 * (1 - p) + 2);
        line(f.x + r, f.y - r, f.x - r, f.y + r, f.col, 9 * (1 - p) + 2);
      } else if (f.type === 'magnet') {
        jcircle(f.x, f.y, f.r * (1 - p * 0.65), f.col, 4);
        jcircle(f.x, f.y, f.r * (0.72 - p * 0.45), f.col, 2);
        for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; line(f.x + Math.cos(a) * f.r,
          f.y + Math.sin(a) * f.r, f.x + Math.cos(a) * f.r * 0.55, f.y + Math.sin(a) * f.r * 0.55, f.col, 2); }
      } else if (f.type === 'shieldbreak') {
        for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2, r = f.r * (0.35 + p); line(f.x + Math.cos(a) * r * 0.55,
          f.y + Math.sin(a) * r * 0.55, f.x + Math.cos(a) * r, f.y + Math.sin(a) * r, f.col, 4); }
      } else if (f.type === 'ghost') {
        const c = Math.cos(f.angle), s = Math.sin(f.angle); jcircle(f.x, f.y - 18, 9, f.col, 2.5);
        line(f.x, f.y - 9, f.x - c * 9, f.y + 15, f.col, 4); line(f.x - c * 9, f.y + 15, f.x - c * 18 - s * 8, f.y + 26, f.col, 3);
        if (f.shield) { ctx.beginPath(); ctx.arc(f.x + c * 16, f.y + s * 16, 25, f.angle - 1.2, f.angle + 1.2); ctx.strokeStyle = f.col; ctx.lineWidth = 6; ctx.stroke(); }
        if (f.fist) jcircle(f.x + c * 22, f.y + s * 22 - 8, 12, f.col, 5);
      } else if (f.type === 'ring' || f.type === 'flash') jcircle(f.x, f.y, f.r * (0.4 + p), f.col, f.type === 'flash' ? 7 : 3);
      else if (f.type === 'upper') { line(f.x, f.y + 20, f.x, f.y - f.r * (0.5 + p), f.col, 10); jcircle(f.x, f.y - f.r * (0.5 + p), 15, f.col, 5); }
      else if (f.type === 'muzzle') { for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; line(f.x, f.y, f.x + Math.cos(a) * f.r * (1 - p), f.y + Math.sin(a) * f.r * (1 - p), f.col, 2); } }
    }
    ctx.globalAlpha = 1;
  }
  function drawSlashes() {
    for (const s of S.slashes) if (!s.hit) {
      const sc = s.c.col || attrOf('pageslash');
      const p = Math.min(1, s.age / 0.18); ctx.globalAlpha = 0.18 + p * 0.35;
      ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.arc(s.x, s.y, s.r, s.angle - Math.PI * 2 / 3, s.angle + Math.PI * 2 / 3); ctx.closePath();
      ctx.fillStyle = sc; ctx.fill(); ctx.globalAlpha = 0.8; jcircle(s.x, s.y, s.r * p, sc, 2);
    }
    ctx.globalAlpha = 1;
  }
  function drawDashes() {
    for (const d of S.dashes) {
      const dc = d.c.col || attrOf('piercerush');
      if (d.phase === 'aim') {
        ctx.globalAlpha = 0.4 + Math.min(0.5, d.t * 3); line(d.x0, d.y0, d.x1, d.y1, dc, 2 + d.t * 12);
        line(d.x0, d.y0, d.x0 + (d.x1 - d.x0) * Math.min(1, d.t / 0.18), d.y0 + (d.y1 - d.y0) * Math.min(1, d.t / 0.18), dc, 5);
        if (d.side < 0) { const r = 13 + d.t * 25; line(d.crossX - r, d.crossY - r, d.crossX + r, d.crossY + r, dc, 3); line(d.crossX + r, d.crossY - r, d.crossX - r, d.crossY + r, dc, 3); }
      } else {
        const sx = d.phase === 'back' ? d.x1 : d.x0, sy = d.phase === 'back' ? d.y1 : d.y0;
        ctx.globalAlpha = 0.55; line(sx, sy, d.hx, d.hy, dc, 5);
      }
    }
    ctx.globalAlpha = 1;
  }
  function drawLances() {
    for (const l of S.lances) {
      const c = Math.cos(l.angle), s = Math.sin(l.angle), lc = l.c.col || attrOf('spinlance');
      ctx.globalAlpha = l.returning ? 0.9 : 0.35; jcircle(l.x, l.y, 92 * l.c.rad, lc, 2);
      ctx.globalAlpha = 1; line(l.x - c * 65, l.y - s * 65, l.x + c * 65, l.y + s * 65, lc, 6);
      line(l.x + c * 65, l.y + s * 65, l.x + c * 48 - s * 9, l.y + s * 48 + c * 9, ICE_LIGHT, 3);
      line(l.x + c * 65, l.y + s * 65, l.x + c * 48 + s * 9, l.y + s * 48 - c * 9, ICE_LIGHT, 3);
      drawIceCrystal(l.x, l.y, 25, l.angle * 0.45, 0.9);
      for (let i = 0; i < 4; i++) {
        const a = l.angle * 0.35 + i * Math.PI / 2;
        drawIceCrystal(l.x + Math.cos(a) * 76 * l.c.rad, l.y + Math.sin(a) * 76 * l.c.rad, 8, a, 0.7);
      }
    }
    ctx.globalAlpha = 1;
  }
  function drawShieldRush() {
    const d = S.shieldRush; if (!d) return;
    const dc = d.c.col || attrOf('shieldrush');
    ctx.globalAlpha = d.t > d.duration - 0.6 ? 0.5 + Math.sin(d.t * 28) * 0.3 : 0.9;
    ctx.beginPath(); ctx.arc(player.x, player.y, 52, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - d.t / d.duration));
    ctx.strokeStyle = dc; ctx.lineWidth = 2; ctx.stroke();
    for (let i = 0; i < d.layers; i++) {
      const a = d.angle + d.t * 0.55 + (i - (d.layers - 1) / 2) * 0.9;
      const x = player.x + Math.cos(a) * 48, y = player.y + Math.sin(a) * 48;
      const c = Math.cos(a), s = Math.sin(a), nx = -s, ny = c;
      polygon([[x + c * 13, y + s * 13], [x + nx * 11, y + ny * 11], [x - c * 15, y - s * 15], [x - nx * 11, y - ny * 11]], dc, 5);
      line(x - c * 7, y - s * 7, x + c * 7, y + s * 7, dc, 2);
    }
    ctx.globalAlpha = 1;
  }
  function drawShields() {
    for (const s of S.shields) {
      const sc = s.c.col || attrOf('ricoshield');
      line(s.px, s.py, s.x, s.y, sc, 7);
      const points = [];
      for (let i = 0; i < 3; i++) { const a = s.angle + i / 3 * Math.PI * 2; points.push([s.x + Math.cos(a) * 17, s.y + Math.sin(a) * 17]); }
      polygon(points, sc, 4); jcircle(s.x, s.y, 5, ICE_LIGHT, 2);
      drawIceCrystal(s.x, s.y, 23, s.angle * 0.5, 0.8);
    }
  }
  function drawCharges() {
    for (const charge of S.charges) {
      const cc = charge.c.col || attrOf('perfectarrow');
      const p = Math.min(1, charge.age / 0.58), c = Math.cos(charge.angle), s = Math.sin(charge.angle);
      ctx.globalAlpha = 0.35 + p * 0.6; line(player.x, player.y, player.x + c * 520, player.y + s * 520, cc, 1 + p * 3);
      ctx.beginPath(); ctx.arc(player.x, player.y, 25, charge.angle - 1.2, charge.angle + 1.2); ctx.strokeStyle = cc; ctx.lineWidth = 3; ctx.stroke();
      line(player.x - s * 22, player.y + c * 22, player.x + c * (35 - p * 20), player.y + s * (35 - p * 20), cc, 2);
      if (p > 0.65) { jcircle(player.x + c * 35, player.y + s * 35, 8 + p * 5, ICE_LIGHT, 3); drawIceCrystal(player.x + c * 35, player.y + s * 35, 13, charge.age * 3, p); }
    }
    ctx.globalAlpha = 1;
  }
  function drawBolts() {
    for (const b of S.bolts) {
      const color = b.c.col || attrOf(b.skill);
      if (b.delay > 0) {
        const count = 8 + (has('focus_more') ? 4 : 0), spread = 45 + count * 2, a = -Math.PI + b.hoverIndex / Math.max(1, count - 1) * Math.PI;
        const x = player.x + Math.cos(a) * spread, y = player.y - 35 + Math.sin(a) * 28;
        const target = byId(b.targetId), ang = target ? Math.atan2(target.y - y, target.x - x) : 0;
        line(x - Math.cos(ang) * 9, y - Math.sin(ang) * 9, x + Math.cos(ang) * 9, y + Math.sin(ang) * 9, color, 2.5); continue;
      }
      const length = b.kind === 'perfect' ? 38 : (b.kind === 'final' ? 34 : 15);
      line(b.x - Math.cos(b.angle) * length, b.y - Math.sin(b.angle) * length, b.x, b.y, color, b.kind === 'final' ? 9 : (b.kind === 'perfect' ? 5 : 2.5));
      if (b.kind === 'perfect' || b.kind === 'final') jcircle(b.x, b.y, b.radius, color, 2.5);
      if (b.skill === 'perfectarrow') drawIceCrystal(b.x, b.y, b.kind === 'perfect' ? 15 : 8, b.angle, 0.85);
    }
  }
  function drawFists() {
    for (const f of S.fists) {
      const fc = f.c.col || attrOf('magfist'), target = byId(f.targetId);
      if (f.age < 0.28) {
        ctx.globalAlpha = 0.45; jcircle(f.x, f.y, 150 * f.c.rad * (1 - f.age / 0.34), fc, 3);
        for (let i = 0; i < 4; i++) { const a = i / 4 * Math.PI * 2 + f.age * 4; line(f.x + Math.cos(a) * 95,
          f.y + Math.sin(a) * 95, f.x + Math.cos(a) * 42, f.y + Math.sin(a) * 42, fc, 3); }
      }
      if (target && f.upper && !f.slam) { ctx.globalAlpha = 0.8; jcircle(target.x, target.y - 28, 22, fc, 6); }
    }
    ctx.globalAlpha = 1;
  }
  function drawGrenades() {
    for (const g of S.grenades) {
      const gc = g.c.col || attrOf('inkgrenade');
      const p = Math.min(1, g.age / g.duration);
      ctx.globalAlpha = 0.2 + p * 0.45; jcircle(g.tx, g.ty, g.radius * (1 - p * 0.45), gc, 3);
      ctx.globalAlpha = 1; jcircle(g.x, g.y - g.z, g.main ? 12 : 6, gc, g.main ? 5 : 3);
      line(g.x, g.y - g.z, g.x, g.y, gc, 1.5);
      if (g.main) { line(g.x - 5, g.y - g.z - 10, g.x + 5, g.y - g.z - 16, PAPER, 2); }
    }
    ctx.globalAlpha = 1;
  }
  function drawRail() {
    const r = S.rail; if (!r) return;
    const rc = r.c.col || attrOf('heatrail'), c = Math.cos(r.angle), s = Math.sin(r.angle);
    line(player.x, player.y - 5, player.x + c * 34, player.y + s * 34 - 5, rc, 7);
    ctx.globalAlpha = r.heat * 0.5; jcircle(player.x + c * 28, player.y + s * 28 - 5, 9 + r.heat * 10, rc, 3); ctx.globalAlpha = 1;
  }
  function drawMarks() {
    for (const e of enemies) {
      if (e.dead || !(e.weaponMarkT > 0)) continue;
      const mc = e.weaponMarkC || attrOf('arrowfocus');
      const y = e.y - e.r - 19, hits = Math.min(6, e.weaponMarkHits || 0);
      jcircle(e.x, y, 11, mc, 2); line(e.x - 8, y - 8, e.x + 8, y + 8, mc, 2); line(e.x + 8, y - 8, e.x - 8, y + 8, mc, 2);
      for (let i = 0; i < hits; i++) line(e.x - 9 + i * 3.5, y + 13, e.x - 7 + i * 3.5, y + 17, mc, 2);
    }
  }
  function draw() {
    drawSlashes(); drawDashes(); drawLances(); drawShieldRush(); drawShields(); drawCharges(); drawBolts();
    drawFists(); drawGrenades(); drawRail(); drawMarks(); drawEffects();
  }
  const previousExtras = window.__drawWorldExtras;
  window.__drawWorldExtras = function() { if (previousExtras) previousExtras(); draw(); };
  const baseRender = render;
  render = function() {
    const airborne = [];
    for (const e of enemies) if (!e.dead && e.weaponAirT > 0) {
      const p = 1 - e.weaponAirT / (e.weaponAirTotal || 1), lift = Math.sin(p * Math.PI) * (e.weaponAirLift || 32);
      airborne.push([e, e.y]); e.y -= lift;
    }
    try { baseRender(); } finally { for (const pair of airborne) pair[0].y = pair[1]; }
  };

  window.__weaponRuntime = {
    state: S, reset, update: updateWeapons, updateSlashes, updateDashes, updateLances, updateShieldRush,
    updateRicoshields, updateCharges, updateFists, updateGrenades, updateRail, updateBolts,
    firePageslash, firePiercerush, fireSpinlance, fireShieldrush, fireRicoshield, firePerfectarrow,
    fireArrowfocus, fireMagfist, fireInkgrenade, fireHeatrail, blast, spawnBolt,
    get ids() { return IDS.slice(); }
  };
  resetGame();
})();

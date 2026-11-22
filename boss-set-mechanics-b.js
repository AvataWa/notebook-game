/* 第 11—20 页 Boss 套装：单件联动与 2／3／5 件套战斗机制。 */
(() => {
  'use strict';
  const R = window.BossCollectionRuntime; if (!R) return;
  const pos = target => ({ x: target && !target.dead ? target.x : player.x, y: target && !target.dead ? target.y : player.y });
  const base = () => R.baseForSkill('__boss_set_fallback');
  const cap = () => ({ ink: 0 });
  const reward = (id, key, prop, bucket, maximum = 8) => R.refundFor(id, key, prop, maximum, bucket);
  const finish = (id, hits, damage, other = .6, boss = .4, options = {}) => {
    if (R.count(id) >= 5 && hits.length) R.echo(id, hits[0], damage, other, boss, options);
  };
  const segDistance = (p, a, b) => pointSegDist(p, a, b);

  R.register('feral', {
    update(dt, oldX, oldY) {
      const s = R.state('feral'); if (R.count('feral') < 2 || !player.diving) return;
      s.travel = (s.travel || 0) + Math.hypot(player.x - oldX, player.y - oldY);
      if (s.travel >= 70) { s.travel -= 70; s.tracks = Math.min(3, (s.tracks || 0) + 1); }
    },
    onHurt() {
      const s = R.state('feral'); if (!hasItem('feralhide') || gameTime < (s.hurtTrackT || 0)) return;
      s.hurtTrackT = gameTime + 3; s.tracks = Math.min(3, (s.tracks || 0) + 2);
    },
    onDiveExit() {
      const s = R.state('feral'), n = R.count('feral'), charges = s.tracks || 0; if (n < 2 || !charges) return;
      s.tracks = 0; const target = nearestEnemy(player.x, player.y, 420); if (!target) return;
      const bucket = cap(); let firstHits = [];
      for (let i = 0; i < charges; i++) R.delay('feral', i * .13, () => {
        const hits = R.blast('feral', target.x, target.y, 75, base() * .4, { mark: n >= 3, kind: 'pounce' });
        for (const e of hits) reward('feral', 'feralbell', 'hitInk', bucket);
        if (!firstHits.length) firstHits = hits;
        if (i === charges - 1) finish('feral', firstHits, base() * .4, .6, .4);
      });
    }
  });

  R.register('turtle', {
    update(dt, oldX, oldY) {
      const s = R.state('turtle'), n = R.count('turtle');
      if (n >= 2 && playerOnOwnInk() && Math.hypot(player.x - oldX, player.y - oldY) < 1.2) {
        s.shellAcc = (s.shellAcc || 0) + dt;
        if (s.shellAcc >= 1.6) { s.shellAcc = 0; s.shell = Math.min(3, (s.shell || 0) + 1); }
      } else s.shellAcc = 0;
      if (hasItem('turtleorb') && s.shell > 0) {
        s.inkAcc = (s.inkAcc || 0) + dt;
        while (s.inkAcc >= 1) { s.inkAcc -= 1; refundInk(itemV('turtleorb', 'shellInk') * s.shell, player.x, player.y - 30, '壳心墨珠'); }
      } else s.inkAcc = 0;
    },
    onHurt() {
      const s = R.state('turtle'), n = R.count('turtle'); if (n < 2 || !(s.shell > 0)) return;
      s.shell--; const bucket = cap(), hits = R.blast('turtle', player.x, player.y, 130, base() * 1.4, { mark: n >= 3, kind: 'shellShock' });
      for (const e of hits) reward('turtle', 'turtleorb', 'hitInk', bucket);
      if (n >= 3) player.bossStaggerImmuneT = Math.max(player.bossStaggerImmuneT || 0, .8);
      finish('turtle', hits, base() * 1.4, .65, .5);
    },
    draw() {
      const s = R.state('turtle'); for (let i = 0; i < (s.shell || 0); i++) jcircle(player.x, player.y, player.r + 8 + i * 4, '#5c785a', 1.5);
    }
  });

  R.register('flower', {
    onCast({ target, count, casts, damage }) {
      if (count < 2 || casts % 5) return;
      const p = pos(target); if (hasItem('flowerarmor')) R.addShield(itemV('flowerarmor', 'shield'), '花笼纸甲');
      R.zone('flower', p.x, p.y, 100, 1.25, { slow: 1 });
      R.delay('flower', 1.15, () => {
        const bucket = cap(), hits = R.blast('flower', p.x, p.y, 108, damage, { mark: count >= 3, slow: 3, stun: 1.1, kind: 'cage' });
        for (const e of hits) reward('flower', 'flowergall', 'hitInk', bucket);
        finish('flower', hits, damage, .5, .4);
      });
    }
  });

  R.register('rhino', {
    update(dt, oldX, oldY) {
      const s = R.state('rhino'), dx = player.x - oldX, dy = player.y - oldY, distance = Math.hypot(dx, dy);
      if (R.count('rhino') < 2 || distance < .05) return;
      const dir = Math.atan2(dy, dx);
      if (s.dir !== undefined && Math.abs(Math.atan2(Math.sin(dir - s.dir), Math.cos(dir - s.dir))) > .55) { s.travel = 0; s.charge = 0; s.fullRefund = false; }
      s.dir = dir; const efficiency = hasItem('rhinoboots') ? 1 + itemV('rhinoboots', 'efficiency') / 100 : 1;
      s.travel = (s.travel || 0) + distance * efficiency;
      while (s.travel >= 100 && (s.charge || 0) < 3) {
        s.travel -= 100; s.charge = (s.charge || 0) + 1;
        if (s.charge >= 3 && !s.fullRefund) { s.fullRefund = true; if (hasItem('rhinoaxis')) refundInk(itemV('rhinoaxis', 'chargeInk'), player.x, player.y - 30, '双轨轴心'); }
      }
      if ((s.charge || 0) >= 3) s.travel = Math.min(s.travel, 99);
    },
    onHurt() {
      const s = R.state('rhino'); if (!hasItem('rhinoarmor') || gameTime < (s.hurtChargeT || 0)) return;
      s.hurtChargeT = gameTime + 3; s.charge = Math.min(3, (s.charge || 0) + 2);
    },
    onCast({ target, count, damage, state: s }) {
      if (count < 2 || (s.charge || 0) < 3) return;
      s.charge = 0; s.travel = 0; s.fullRefund = false; s.dashT = 3;
      const p = pos(target), angle = Math.atan2(p.y - player.y, p.x - player.x), length = 350;
      const x2 = player.x + Math.cos(angle) * length, y2 = player.y + Math.sin(angle) * length, bucket = cap();
      const hits = R.line('rhino', player.x, player.y, x2, y2, 28, damage * 1.5, { mark: count >= 3, kind: 'lane' });
      for (const e of hits) reward('rhino', 'rhinoaxis', 'hitInk', bucket);
      if (count >= 3) R.blast('rhino', x2, y2, 75, damage * .6, { mark: true, kind: 'chargeEnd' });
      if (count >= 5) {
        const ox = Math.cos(angle + Math.PI / 2) * 65, oy = Math.sin(angle + Math.PI / 2) * 65;
        R.line('rhino', player.x + ox, player.y + oy, x2 + ox, y2 + oy, 24, damage * .75, { kind: 'sideLane' });
        if (hits.length === 1 && hits[0].boss) R.hit(hits[0], damage * .5, 'rhino', player.x, player.y, 'bossEcho');
      }
    }
  });

  R.register('pods', {
    onCast({ target, count, casts, state: s }) {
      if (count < 2 || casts % 4) return;
      if (!s.pods) s.pods = [];
      if (s.pods.length >= 3) s.pods.shift();
      const p = pos(target), angle = Math.random() * Math.PI * 2;
      s.pods.push({ x: p.x + Math.cos(angle) * 50, y: p.y + Math.sin(angle) * 50, t: 8, block: hasItem('podarmor') });
      if (hasItem('podheart')) refundInk(itemV('podheart', 'podInk'), player.x, player.y - 30, '育母树心');
    },
    update(dt) {
      const s = R.state('pods'), n = R.count('pods'); if (!s.pods) s.pods = [];
      s.pods = s.pods.filter(p => (p.t -= dt) > 0); s.onRoot = false; s.tick = (s.tick || 0) - dt; s.contract = (s.contract || 2.8) - dt;
      for (let i = 0; i < s.pods.length; i++) for (let j = i + 1; j < s.pods.length; j++) {
        const a = s.pods[i], b = s.pods[j]; if (segDistance(player, a, b) < 18) s.onRoot = true;
        if (s.tick <= 0) R.line('pods', a.x, a.y, b.x, b.y, 10, base() * .16, { kind: 'root' });
      }
      if (s.tick <= 0) s.tick = .55;
      if (n >= 3 && s.contract <= 0 && s.pods.length >= 2) {
        s.contract = 3; const bucket = cap(); let allHits = [];
        for (let i = 0; i < s.pods.length; i++) for (let j = i + 1; j < s.pods.length; j++) {
          const hits = R.line('pods', s.pods[i].x, s.pods[i].y, s.pods[j].x, s.pods[j].y, 24, base() * .45, { mark: true, slow: 2, kind: 'rootContract' });
          allHits.push(...hits); for (const e of hits) reward('pods', 'podheart', 'hitInk', bucket);
        }
        if (n >= 5) { for (const p of s.pods) R.blast('pods', p.x, p.y, 70, base() * .5, { kind: 'podBurst' }); finish('pods', allHits, base() * .5, .5, .4); }
      }
    },
    consumeBlock() {
      const pods = R.state('pods').pods || [], pod = pods.find(p => p.block); if (!pod) return false; pod.block = false; return true;
    },
    draw() {
      const pods = R.state('pods').pods || [];
      for (let i = 0; i < pods.length; i++) { jcircle(pods[i].x, pods[i].y, 13, '#798848', 3); for (let j = i + 1; j < pods.length; j++) jline(pods[i].x, pods[i].y, pods[j].x, pods[j].y, '#798848', 2); }
    }
  });

  R.register('blind', {
    update(dt, oldX, oldY) {
      const s = R.state('blind'); if (R.count('blind') < 2 || !player.diving) return;
      if (!s.path) s.path = []; const last = s.path[s.path.length - 1];
      if (!last || Math.hypot(player.x - last.x, player.y - last.y) >= 32) {
        s.path.push({ x: player.x, y: player.y }); if (s.path.length > 20) s.path.shift();
      }
    },
    onDiveExit() {
      const s = R.state('blind'), n = R.count('blind'), path = (s.path || []).slice(); s.path = []; if (n < 2 || !path.length) return;
      if (hasItem('blindhide')) R.addShield(itemV('blindhide', 'shield'), '回迹纸甲');
      const bucket = cap(), damage = base() * 1.3 / path.length;
      path.forEach((p, i) => R.delay('blind', i * .07, () => {
        const hits = R.blast('blind', p.x, p.y, 55, damage, { mark: n >= 3, kind: 'replay' });
        for (const e of hits) reward('blind', 'blindgall', 'hitInk', bucket);
      }));
      if (n >= 5) path.slice().reverse().forEach((p, i) => R.delay('blind', path.length * .07 + .18 + i * .06, () =>
        R.blast('blind', p.x, p.y, 48, base() * .75 / path.length, { kind: 'reverseReplay' })));
    },
    draw() {
      const path = R.state('blind').path || []; for (let i = 1; i < path.length; i++) jline(path[i - 1].x, path[i - 1].y, path[i].x, path[i].y, '#477c78', 2);
    }
  });

  R.register('feather', {
    onHit(e, dealt, skillId, active) {
      const s = R.state('feather'); if (!active || R.count('feather') < 2 || gameTime < (s.nextFeatherT || 0)) return;
      if (!s.feathers) s.feathers = []; if (s.feathers.length >= 6) return;
      s.nextFeatherT = gameTime + .12; s.feathers.push({ x: e.x, y: e.y, damage: R.baseForSkill(skillId) });
    },
    onAbsorb() {
      const s = R.state('feather'), n = R.count('feather'), feathers = (s.feathers || []).splice(0); if (n < 2 || !feathers.length) return;
      const bucket = cap(); if (hasItem('featherarmor')) R.addShield(itemV('featherarmor', 'shield'), '归羽纸甲');
      for (const f of feathers) R.projectile('feather', {
        x: f.x, y: f.y, phase: 'back', damage: f.damage * .45, life: 1.5, accKey: 'featherheart', inkCap: 8,
        onHit(p, e) { if (n >= 3) R.mark(e, 'feather'); if (n >= 5 && e.boss && enemies.filter(x => !x.dead && x !== e).length === 0) R.hit(e, f.damage * .18, 'feather', f.x, f.y, 'bossEcho'); }
      });
      if (n >= 5) R.delay('feather', .7, () => R.blast('feather', player.x, player.y, 100, base() * .5, { kind: 'scatter' }));
    },
    draw() { for (const f of R.state('feather').feathers || []) { jline(f.x - 8, f.y + 7, f.x + 9, f.y - 9, '#4b9fc4', 3); jline(f.x - 2, f.y + 1, f.x + 9, f.y + 2, '#4b9fc4', 1.5); } }
  });

  R.register('totem', {
    onCast({ target, count, casts, damage }) {
      if (count < 2 || casts % 4) return;
      const p = pos(target), length = 310, unique = new Set(), bucket = cap();
      if (hasItem('totemarmor')) R.addShield(itemV('totemarmor', 'shield'), '象限纸甲');
      let hits = R.line('totem', p.x - length, p.y, p.x + length, p.y, 18, damage * 1.5, { unique, kind: 'gaze' });
      hits.push(...R.line('totem', p.x, p.y - length, p.x, p.y + length, 18, damage * 1.5, { unique, kind: 'gaze' }));
      for (const e of hits) reward('totem', 'totemorb', 'hitInk', bucket);
      if (count >= 3) R.zone('totem', p.x, p.y, 120, 3, { mark: true });
      if (count >= 5) {
        const d = length / Math.sqrt(2);
        R.line('totem', p.x - d, p.y - d, p.x + d, p.y + d, 16, damage * .75, { kind: 'rotatedGaze' });
        R.line('totem', p.x - d, p.y + d, p.x + d, p.y - d, 16, damage * .75, { kind: 'rotatedGaze' });
        if (hits.length === 1 && hits[0].boss) R.hit(hits[0], damage * .5, 'totem', p.x, p.y, 'bossEcho');
      }
    }
  });

  R.register('mantis', {
    onCast({ target, count, casts, damage, state: s }) {
      if (count < 2) return;
      if (s.armed && s.lines && s.lines.length) {
        const p = pos(target), bucket = cap(); let allHits = [];
        for (const l of s.lines) {
          const hits = R.line('mantis', l.x, l.y, p.x, p.y, 15, l.damage * .45, { mark: count >= 3, kind: 'sheath' });
          allHits.push(...hits); for (const e of hits) reward('mantis', 'mantisgall', 'hitInk', bucket);
          if (count >= 5) R.line('mantis', l.x - 45, l.y + 45, p.x + 45, p.y - 45, 12, l.damage * .27, { kind: 'crossReplay' });
        }
        if (count >= 5 && allHits.length === 1 && allHits[0].boss) R.hit(allHits[0], damage * .4, 'mantis', p.x, p.y, 'bossEcho');
        s.lines = []; s.armed = false;
      }
      if (casts % 3 === 0) {
        if (!s.lines) s.lines = []; if (s.lines.length >= 4) s.lines.shift();
        s.lines.push({ x: player.x, y: player.y, damage }); s.armed = true;
        if (hasItem('mantisarmor')) R.addShield(itemV('mantisarmor', 'shield'), '六肢纸甲');
      }
    }
  });

  R.register('mother', {
    onCast({ a, target, count, casts, damage, state: s }) {
      if (!s.sequenceIds) s.sequenceIds = [];
      if (!s.sequenceIds.includes(a.id)) s.sequenceIds.push(a.id); else s.sequenceIds = [a.id];
      s.sequence = Math.min(3, s.sequenceIds.length); if (s.sequenceIds.length > 3) s.sequenceIds.shift();
      if (count < 2 || casts % 3) return;
      const part = (s.cycle || 0) % 3, p = pos(target), bucket = cap(); let hits = [];
      if (part === 0) hits = R.blast('mother', p.x, p.y, 105, damage * .75, { kind: 'claw' });
      else if (part === 1) { hits = R.blast('mother', p.x, p.y, 90, damage * .75, { kind: 'brood' }); R.zone('mother', p.x, p.y, 95, 3, { slow: 1 }); }
      else hits = R.line('mother', player.x, player.y, p.x, p.y, 32, damage * .75, { kind: 'trail' });
      for (const e of hits) {
        reward('mother', 'mothercore', 'hitInk', bucket);
        if (!e.motherParts) e.motherParts = {};
        e.motherParts[part] = gameTime + 9;
        const complete = [0, 1, 2].every(i => (e.motherParts[i] || 0) > gameTime);
        if (complete) {
          e.motherParts = {}; if (count >= 3) R.mark(e, 'mother');
          if (count >= 5) R.hit(e, damage * .6, 'mother', p.x, p.y, 'fusion');
        }
      }
      if (hasItem('motherarmor')) R.addShield(itemV('motherarmor', 'shield'), '混生纸甲');
      s.cycle = (s.cycle || 0) + 1;
      if (s.cycle % 3 === 0 && hasItem('mothercore')) refundInk(itemV('mothercore', 'cycleInk'), player.x, player.y - 30, '终页母核');
      if (count >= 5 && hits.length === 1 && hits[0].boss) R.hit(hits[0], damage * .4, 'mother', p.x, p.y, 'bossEcho');
    }
  });
})();

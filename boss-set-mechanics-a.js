/* 第 2—10 页 Boss 套装：单件联动与 2／3／5 件套战斗机制。 */
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

  R.register('correction', {
    onCast({ target, count, casts, damage }) {
      if (count < 2 || casts % 4) return;
      const p = pos(target);
      R.delay('correction', 2, () => {
        const bucket = cap(), hits = R.blast('correction', p.x, p.y, 112, damage, { mark: count >= 3, slow: 3, kind: 'tape' });
        for (const e of hits) reward('correction', 'tapecore', 'hitInk', bucket);
        if (count >= 3) R.addShield(4, '涂改纸甲');
        finish('correction', hits, damage, .5, .4, { mark: count >= 3 });
      });
    },
    onHurt() {
      const s = R.state('correction'); if (!hasItem('tapearmor') || gameTime < (s.hurtTapeT || 0)) return;
      s.hurtTapeT = gameTime + 5; R.zone('correction', player.x, player.y, 70, 3, { slow: 1.2 });
    }
  });

  function execution(e, damage, count) {
    if (!e || e.dead) return;
    e.judgeStacks = 0; const bucket = cap();
    R.hit(e, R.setDamage('judge', damage * 1.2), 'judge', player.x, player.y, 'execution', { mark: count >= 3 });
    reward('judge', 'judgeseal', 'hitInk', bucket);
    if (count >= 5) R.echo('judge', e, damage * 1.2, .6, .4, { mark: count >= 3 });
  }
  R.register('judge', {
    onHit(e, dealt, skillId, active) {
      if (!active || R.count('judge') < 2 || e.dead) return;
      e.judgeStacks = Math.min(5, (e.judgeStacks || 0) + 1);
      if (e.judgeStacks >= 5) execution(e, R.baseForSkill(skillId), R.count('judge'));
    },
    onHurt(source) {
      const s = R.state('judge'), n = R.count('judge'); if (!source || source.dead || !hasItem('judgerobe') || gameTime < (s.counterT || 0)) return;
      s.counterT = gameTime + 3; source.judgeStacks = Math.min(5, (source.judgeStacks || 0) + 2);
      if (n >= 2 && source.judgeStacks >= 5) execution(source, base(), n);
    }
  });

  function meteor(target, damage, count) {
    const p = pos(target), bucket = cap(), hits = R.blast('dragon', p.x, p.y, 118, damage * 1.1, { kind: 'meteor' });
    for (const e of hits) reward('dragon', 'dragonorb', 'hitInk', bucket);
    if (count >= 3) R.zone('dragon', p.x, p.y, 105, 3, { mark: true });
    finish('dragon', hits, damage * 1.1, .55, .4);
  }
  R.register('dragon', {
    onCast({ target, count, damage, state: s }) {
      if (count < 2) return; s.stars = Math.min(5, (s.stars || 0) + 1);
      if (s.stars >= 5) { s.stars = 0; meteor(target, damage, count); }
    },
    onHurt() {
      const s = R.state('dragon'); if (!hasItem('dragonhide') || gameTime < (s.starHurtT || 0)) return;
      s.starHurtT = gameTime + 3; s.stars = Math.min(5, (s.stars || 0) + 2);
    }
  });

  R.register('knights', {
    onCast({ a, c, target, count, casts, damage, state: s }) {
      if (count < 2 || casts % 4) return;
      const p = pos(target); s.shadow = { x: player.x - 30, y: player.y + 20, t: 4, tick: .15, damage, a: a.id, c,
        targetX: p.x, targetY: p.y, block: hasItem('knightarmor') };
    },
    update(dt) {
      const s = R.state('knights'), sh = s.shadow, n = R.count('knights'); if (!sh) return;
      sh.t -= dt; sh.tick -= dt;
      const target = nearestEnemy(player.x, player.y, 500);
      if (target) { sh.x += (target.x - 45 - sh.x) * Math.min(1, dt * 3); sh.y += (target.y - sh.y) * Math.min(1, dt * 3); }
      if (sh.tick <= 0 && sh.t > 0) {
        sh.tick += .75; const p = target || { x: sh.targetX, y: sh.targetY };
        R.blast('knights', p.x, p.y, 74, sh.damage * .45, { mark: n >= 3, kind: 'shadow' });
      }
      if (sh.t <= 0) {
        const p = target || { x: sh.targetX, y: sh.targetY };
        if (n >= 5) {
          const hits = R.line('knights', sh.x, sh.y, p.x, p.y, 25, sh.damage * .6, { mark: n >= 3, kind: 'charge' });
          finish('knights', hits, sh.damage * .6, .6, .4);
        }
        if (hasItem('knightbadge')) refundInk(itemV('knightbadge', 'endInk'), sh.x, sh.y, '团长军徽');
        s.shadow = null;
      }
    },
    consumeBlock() {
      const sh = R.state('knights').shadow; if (!sh || !sh.block) return false; sh.block = false; return true;
    },
    draw() {
      const sh = R.state('knights').shadow; if (!sh) return;
      ctx.globalAlpha = Math.min(.65, sh.t); jcircle(sh.x, sh.y, 18, '#4f7f68', 3); jline(sh.x, sh.y, sh.x + 28, sh.y - 24, '#4f7f68', 4); ctx.globalAlpha = 1;
    }
  });

  R.register('element', {
    onGray(x, y, radius, converted) {
      const s = R.state('element'); if (R.count('element') >= 2) s.charge = Math.min(3, (s.charge || 0) + Math.min(1, converted));
    },
    onSurge() {
      const s = R.state('element'), n = R.count('element'), charges = s.charge || 0; if (n < 2 || !charges) return;
      s.charge = 0; let firstHits = [];
      for (let i = 0; i < charges; i++) {
        const angle = i * Math.PI * 2 / charges, x = player.x + Math.cos(angle) * 35, y = player.y + Math.sin(angle) * 35;
        const bucket = cap(), hits = R.blast('element', x, y, 105, base() * .45, { kind: 'elementBurst' });
        for (const e of hits) reward('element', 'elementcore', 'hitInk', bucket);
        if (n >= 3) R.zone('element', x, y, 90, 3, { mark: true });
        if (!firstHits.length) firstHits = hits;
      }
      if (hasItem('elementarmor')) R.addShield(itemV('elementarmor', 'shield'), '元素纸甲');
      finish('element', firstHits, base() * .45, .6, .4);
    }
  });

  R.register('origami', {
    onCast({ target, count, casts, damage }) {
      if (count < 2 || casts % 4) return;
      const p = pos(target), aim = Math.atan2(p.y - player.y, p.x - player.x);
      for (let i = -1; i <= 1; i++) R.projectile('origami', {
        x: player.x, y: player.y, angle: aim + i * .24, damage: damage * .4, maxDistance: 240, accKey: 'origamiheart',
        onReturn(projectile) {
          if (hasItem('origamiarmor') && !projectile.shielded) { projectile.shielded = true; R.addShield(itemV('origamiarmor', 'shield'), '千折纸甲'); }
          if (count >= 5 && !projectile.split) R.projectile('origami', {
            x: projectile.x, y: projectile.y, angle: projectile.angle + .65, damage: damage * .2, maxDistance: 130, split: true
          });
        },
        onHit(projectile, e) {
          if (count >= 5 && projectile.phase === 'back' && e.boss && enemies.filter(x => !x.dead && x !== e).length === 0)
            R.hit(e, damage * .16, 'origami', projectile.x, projectile.y, 'bossEcho');
        }
      });
    }
  });

  R.register('eraser', {
    onGray(x, y, radius, converted, diving) {
      const s = R.state('eraser'); if (!diving || R.count('eraser') < 2) return;
      const efficiency = hasItem('eraserboots') ? 1 + itemV('eraserboots', 'efficiency') / 100 : 1;
      s.friction = Math.min(100, (s.friction || 0) + converted * 25 * efficiency);
    },
    onHurt() {
      const s = R.state('eraser'); if (!hasItem('eraserarmor') || gameTime < (s.hurtChargeT || 0)) return;
      s.hurtChargeT = gameTime + 3; s.friction = Math.min(100, (s.friction || 0) + itemV('eraserarmor', 'charge'));
    },
    onCast({ target, count, damage, state: s }) {
      if (count < 2 || (s.friction || 0) < 100) return;
      s.friction = 0; const p = pos(target), bucket = cap(), hits = R.blast('eraser', p.x, p.y, 120, damage * 1.1, { mark: count >= 3, kind: 'crumb' });
      for (const e of hits) reward('eraser', 'eraserpack', 'hitInk', bucket);
      finish('eraser', hits, damage * 1.1, .6, .4);
    }
  });

  function abyssBurst(target, damage, count) {
    const p = pos(target), bucket = cap(), hits = R.blast('abyss', p.x, p.y, 118, damage * 1.2, { kind: 'tentacle' });
    for (const e of hits) reward('abyss', 'abyssgall', 'hitInk', bucket, 10);
    if (count >= 3) R.zone('abyss', p.x, p.y, 110, 3, { mark: true, slow: 1 });
    finish('abyss', hits, damage * 1.2, .6, .4);
  }
  R.register('abyss', {
    onGray() { const s = R.state('abyss'); if (R.count('abyss') >= 2) s.charge = Math.min(5, (s.charge || 0) + 1); },
    onHurt() {
      const s = R.state('abyss'); if (!hasItem('abyssarmor') || gameTime < (s.hurtChargeT || 0)) return;
      s.hurtChargeT = gameTime + 3; s.charge = Math.min(5, (s.charge || 0) + 2);
    },
    onCast({ target, count, damage, state: s }) {
      if (count >= 2 && (s.charge || 0) >= 5) { s.charge = 0; abyssBurst(target, damage, count); }
    },
    update(dt) {
      const s = R.state('abyss'); if (R.count('abyss') < 2 || !playerOnHostileInk()) return;
      s.contactT = (s.contactT || 0) + dt; if (s.contactT >= .7) { s.contactT = 0; s.charge = Math.min(5, (s.charge || 0) + 1); }
    }
  });

  R.register('author', {
    onCast({ a, target, count, damage, state: s }) {
      // 书写进度与单件回墨不依赖两件套；只有终页爆发属于套装机制。
      if (s.pageReady && count >= 2) {
        s.pageReady = false; s.sequenceIds = []; s.sequence = 0;
        const p = pos(target), bucket = cap(), hits = R.blast('author', p.x, p.y, 130, damage * 1.2, { mark: count >= 3, kind: 'lastPage' });
        for (const e of hits) reward('author', 'authorbookmark', 'hitInk', bucket);
        finish('author', hits, damage * 1.2, .6, .4);
      }
      if (!s.sequenceIds) s.sequenceIds = [];
      if (!s.sequenceIds.includes(a.id)) s.sequenceIds.push(a.id); else s.sequenceIds = [a.id];
      s.sequence = s.sequenceIds.length;
      if (s.sequenceIds.length >= 4) {
        s.pageReady = true;
        if (hasItem('authorarmor')) R.addShield(itemV('authorarmor', 'shield'), '封面纸甲');
        if (hasItem('authorbookmark')) refundInk(itemV('authorbookmark', 'pageInk'), player.x, player.y - 30, '作者书签');
      }
    }
  });
})();

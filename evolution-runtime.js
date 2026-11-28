/* 老主动等级进化：回形针、炮台、毒墨雨。 */
(() => {
  'use strict';

  const S = {
    mergeT: 0, puddles: [], preClouds: []
  };

  function derivedC(c, skill) {
    return Object.assign({}, c || {}, {
      hadesSkill: skill, followup: 0, reburst: 0
    });
  }

  const baseFireSkill = fireSkill;
  fireSkill = function(a, c) {
    const bulletStart = bullets.length, totemStart = totems.length, cloudStart = clouds.length;
    const result = baseFireSkill(a, c);
    if (result === false) return result;

    if (a.id === 'chainclip') {
      for (let i = bulletStart; i < bullets.length; i++) {
        const b = bullets[i];
        if (b.kind !== 'chain') continue;
        b.c = c;                       // 闭链与既有续击都需要完整辅助参数
        b.evoChain = {
          lvl: a.lvl, baseDmg: b.dmg, charges: 0, used: 0,
          hitIds: [], first: null, closed: false,
          charged: false, prevDmg: b.dmg
        };
      }
    } else if (a.id === 'ballista') {
      for (let i = totemStart; i < totems.length; i++) {
        const tt = totems[i];
        tt.evoLevel = a.lvl;
        tt.evoBasePierce = tt.pierce || 0;
        tt.evoVolleyReady = 0;
      }
    } else if (a.id === 'inkrain') {
      for (let i = cloudStart; i < clouds.length; i++) {
        clouds[i].evoLevel = a.lvl;
        clouds[i].evoMerges = 0;
      }
    }
    return result;
  };

  /* 主循环在回形针伤害结算前后调用，避免复制整段碰撞逻辑。 */
  function beforeChainHit(b, e) {
    const x = b.evoChain;
    if (!x) return;
    x.prevDmg = b.dmg;
    x.charged = false;
    if (x.lvl < 3 || x.charges <= 0 || x.used >= 2 || !x.hitIds.includes(e.id)) return;
    x.charged = true;
    x.charges--;
    x.used++;
    b.chainLeft++;                 // 抵消主循环随后的一次消耗
    b.dmg = x.baseDmg * 0.55;
  }

  function afterChainHit(b, e) {
    const x = b.evoChain;
    if (!x) return;
    if (!x.hitIds.includes(e.id)) {
      x.hitIds.push(e.id);
      if (!x.first) x.first = e;
      if (x.lvl >= 3) x.charges = Math.min(2, x.charges + 1);
      if (x.lvl >= 5 && !x.closed && x.hitIds.length >= 3 && x.first && x.first !== e) {
        x.closed = true;
        const c = derivedC(b.c, 'chainclip');
        for (const target of [x.first, e]) {
          lightnings.push({
            x1: x.first.x, y1: x.first.y, x2: e.x, y2: e.y,
            t: 0.2, delay: 0.12, prog: 0, tgt: target,
            dmg: x.baseDmg * 0.4, c, col: b.col, evoDerived: true
          });
        }
        floats.push({ x: e.x, y: e.y - e.r - 18, txt: '闭链！', t: 0.55, color: b.col || ARC, crit: true });
      }
    }
    if (x.charged) b.dmg = x.prevDmg;
    x.charged = false;
  }

  function updateTotems() {
    for (const tt of totems) {
      if (!tt.evoLevel) continue;
      tt.pierce = (tt.evoBasePierce || 0) + (tt.evoLevel >= 3 && (tt.ramp || 0) >= 3 ? 1 : 0);
      if (tt.evoLevel < 5 || !tt.sameId || gameTime < (tt.evoVolleyReady || 0)) continue;
      const locked = enemies.some(e => !e.dead && e.id === tt.sameId);
      if (locked) continue;
      const target = nearestEnemy(tt.x, tt.y, 380 * (tt.rad || 1));
      if (!target) continue;

      tt.ramp = Math.min(3, tt.ramp || 0);
      tt.sameId = target.id;
      tt.fireCd = Math.max(tt.fireCd, 0.18);
      tt.evoVolleyReady = gameTime + 1.5;
      const base = Math.atan2(target.y - tt.y, target.x - tt.x);
      for (const side of [-1, 1]) {
        fireBullet(tt.x, tt.y - 14, base + side * 0.08,
          BATTLE.skills.ballistaBulletSpeed * tt.proj, tt.dmg * 0.5, 'nib',
          Object.assign({}, tt.ex, {
            hits: 1 + (tt.pierce || 0), hadesSkill: 'ballista', _noExpand: true
          }));
      }
      novas.push({ x: tt.x, y: tt.y, t: 0.2, max: 24, col: (tt.ex && tt.ex.col) || INK, c: { col: INK } });
    }
  }

  function mergeClouds() {
    let merged = 0;
    for (let i = 0; i < clouds.length && merged < 4; i++) {
      const a = clouds[i];
      if (!a || a.t <= 0 || a.evoLevel < 3 || (a.evoMerges || 0) >= 2) continue;
      let pair = -1;
      for (let j = i + 1; j < clouds.length; j++) {
        const b = clouds[j];
        if (!b || b.t <= 0 || b.evoLevel < 3 || (b.evoMerges || 0) >= 2) continue;
        if (Math.hypot(a.x - b.x, a.y - b.y) < Math.min(a.r, b.r) * 0.7) { pair = j; break; }
      }
      if (pair < 0) continue;
      const b = clouds[pair];
      const capR = 55 * (a.c.rad || 1) * 1.5;
      a.x = (a.x + b.x) * 0.5;
      a.y = (a.y + b.y) * 0.5;
      a.vx = ((a.vx || 0) + (b.vx || 0)) * 0.5;
      a.vy = ((a.vy || 0) + (b.vy || 0)) * 0.5;
      a.r = Math.min(capR, Math.max(a.r, b.r) * 1.2);
      a.dmg += b.dmg * 0.75;
      a.t = Math.min(3.5, Math.max(a.t, b.t));
      a.evoMerges = Math.max(a.evoMerges || 0, b.evoMerges || 0) + 1;
      b.evoMerged = true;
      clouds.splice(pair, 1);
      merged++;
      i = -1;                       // 合并后重新检查，允许每轮最多四次
    }
  }

  function addPuddle(cl) {
    if (S.puddles.length >= 24) S.puddles.shift();
    S.puddles.push({
      x: cl.x, y: cl.y, r: cl.r * 0.9, t: 2, tick: 0.08,
      dmg: cl.dmg * 0.6, c: derivedC(cl.c, 'inkrain')
    });
  }

  function updatePuddles(dt) {
    for (const p of S.puddles) {
      p.t -= dt; p.tick -= dt;
      if (p.tick > 0) continue;
      p.tick += 0.5;
      for (const e of enemies) {
        if (e.dead) continue;
        const d = Math.hypot(e.x - p.x, e.y - p.y);
        if (d < p.r + e.r) areaHit(e, p.dmg, p.c, p.x, p.y, p.r, d);
      }
    }
    for (let i = S.puddles.length - 1; i >= 0; i--) if (S.puddles[i].t <= 0) S.puddles.splice(i, 1);
  }

  const baseUpdate = update;
  update = function(dt) {
    if (state === 'play') {
      updateTotems();
      for (const cl of clouds) {
        if (!cl.formCloud) continue;
        cl.x = clampW(cl.x + (cl.vx || 0) * dt, 40);
        cl.y = clampH(cl.y + (cl.vy || 0) * dt, 40);
      }
      S.mergeT -= dt;
      if (S.mergeT <= 0) { S.mergeT += 0.12; mergeClouds(); }
      S.preClouds = clouds.slice();
    }
    baseUpdate(dt);
    if (state !== 'play') return;
    for (const cl of S.preClouds) {
      if (cl.evoLevel >= 5 && cl.t <= 0 && !cl.evoMerged) addPuddle(cl);
    }
    S.preClouds = [];
    updatePuddles(dt);
  };

  function drawPuddles() {
    for (const p of S.puddles) {
      const col = p.c.col || INK;
      ctx.globalAlpha = Math.min(0.16, p.t * 0.08);
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = Math.min(0.5, p.t * 0.3);
      jcircle(p.x, p.y, p.r, col, 1.5);
      jcircle(p.x + p.r * 0.15, p.y - p.r * 0.1, p.r * 0.55, col, 1);
    }
    ctx.globalAlpha = 1;
  }
  const previousExtras = window.__drawWorldExtras;
  window.__drawWorldExtras = function() { if (previousExtras) previousExtras(); drawPuddles(); };

  const baseResetGame = resetGame;
  resetGame = function() {
    baseResetGame();
    S.mergeT = 0; S.puddles.length = 0; S.preClouds.length = 0;
  };

  window.EvolutionRuntime = {
    state: S, beforeChainHit, afterChainHit, updateTotems, mergeClouds, addPuddle
  };
})();

/* 通用 Boss 行为状态机：站位评估、招式筛选、方向锁定、固定连段与状态中断。 */
(function (root) {
  'use strict';
  const TAU = Math.PI * 2;
  const norm = a => {
    while (a > Math.PI) a -= TAU;
    while (a < -Math.PI) a += TAU;
    return a;
  };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const angleTo = (a, b) => Math.atan2(b.y - a.y, b.x - a.x);
  const zoneOf = (e, target) => {
    const relative = Math.abs(norm(angleTo(e, target) - (e.faceA || 0)));
    return relative <= Math.PI / 3 ? 'front' : relative >= Math.PI * 2 / 3 ? 'back' : 'side';
  };
  const turnToward = (e, target, maxStep) => {
    e.faceA = norm((e.faceA || 0) + clamp(norm(target - (e.faceA || 0)), -maxStep, maxStep));
    return e.faceA;
  };
  const coneContains = (e, angle, range, arc, target, radius) => {
    const dx = target.x - e.x, dy = target.y - e.y, d = Math.hypot(dx, dy);
    const pad = d > 0 ? Math.asin(Math.min(1, (radius || 0) / d)) : Math.PI;
    return d < range + (radius || 0) && Math.abs(norm(Math.atan2(dy, dx) - angle)) < arc / 2 + pad;
  };
  const pointSegmentDistance = (p, a, b) => {
    const dx = b.x - a.x, dy = b.y - a.y, ll = dx * dx + dy * dy;
    const t = ll ? clamp(((p.x - a.x) * dx + (p.y - a.y) * dy) / ll, 0, 1) : 0;
    return Math.hypot(p.x - (a.x + dx * t), p.y - (a.y + dy * t));
  };

  function createController(config) {
    const moves = config.moves;
    const hooks = config.hooks || {};
    for (const [id, move] of Object.entries(moves)) move.id = id;
    const random = ctx => ctx && ctx.random ? ctx.random() : Math.random();
    const ensure = e => {
      if (!e.ai) e.ai = { cooldowns: {}, history: [], combo: [], moveCount: 0, repositionSide: 1, justRepositioned: false };
      return e.ai;
    };
    const state = (e, mode, time) => {
      e.huntMode = mode;
      e.huntT = Math.max(0, time || 0);
    };
    const moveOf = e => moves[e.attack] || null;
    const call = (name, e, ctx, ...args) => hooks[name] ? hooks[name](e, ctx, ...args) : undefined;

    function init(e, ctx, delay) {
      const ai = ensure(e);
      ai.cooldowns = {}; ai.history = []; ai.combo = []; ai.moveCount = 0;
      ai.repositionSide = random(ctx) < 0.5 ? -1 : 1; ai.justRepositioned = false;
      e.attack = null; e.pounceHeight = 0;
      state(e, 'chase', delay === undefined ? 0.8 : delay);
    }

    function start(e, id, ctx, options) {
      const move = moves[id];
      if (!move) return false;
      const ai = ensure(e), opts = options || {};
      e.attack = id;
      e.actionHit = false; e.attackResolved = false; e.pounceHeight = 0;
      if (!opts.chained) {
        ai.combo = typeof move.combo === 'function' ? move.combo(e, ctx).slice() : (move.combo || []).slice();
        ai.comboRoot = id;
      }
      e.chargeChain = ai.combo.filter(next => next === 'charge').length;
      e.windupDuration = opts.windup !== undefined ? opts.windup :
        (opts.chained && move.chainWindup !== undefined ? move.chainWindup : move.windup);
      e.activeDuration = move.active;
      e.recoverDuration = opts.recover !== undefined ? opts.recover :
        (opts.chained && move.chainRecover !== undefined ? move.chainRecover : move.recover);
      call('aim', e, ctx, move, opts);
      state(e, 'windup', e.windupDuration);
      return true;
    }

    function candidates(e, ctx) {
      const ai = ensure(e), d = distance(e, ctx.player), zone = zoneOf(e, ctx.player);
      return Object.values(moves).filter(move => {
        if (d < (move.minRange || 0) || d > (move.maxRange === undefined ? Infinity : move.maxRange)) return false;
        if (move.zones && !move.zones.includes(zone) && !move.zones.includes('any')) return false;
        if (move.phases && !move.phases.includes(e.phase || 1)) return false;
        if ((ai.cooldowns[move.id] || 0) > 0) return false;
        return !move.available || move.available(e, ctx);
      });
    }

    function choose(e, ctx) {
      const ai = ensure(e);
      let pool = candidates(e, ctx);
      if (pool.length > 1 && ai.history.length) {
        const withoutLast = pool.filter(move => move.id !== ai.history[ai.history.length - 1]);
        if (withoutLast.length) pool = withoutLast;
      }
      if (!pool.length) {
        ai.repositionSide *= -1;
        state(e, 'reposition', 0.3);
        return null;
      }
      const weights = pool.map(move => {
        let w = typeof move.weight === 'function' ? move.weight(e, ctx) : (move.weight || 1);
        if (ai.justRepositioned && move.repositionBonus) w *= move.repositionBonus;
        if (ai.history.slice(-2).includes(move.id)) w *= 0.45;
        return Math.max(0.01, w);
      });
      let roll = random(ctx) * weights.reduce((a, b) => a + b, 0), picked = pool[pool.length - 1];
      for (let i = 0; i < pool.length; i++) { roll -= weights[i]; if (roll <= 0) { picked = pool[i]; break; } }
      ai.justRepositioned = false;
      start(e, picked.id, ctx);
      return picked.id;
    }

    function finishMove(e, ctx) {
      const ai = ensure(e), move = moveOf(e);
      if (move) {
        ai.cooldowns[move.id] = move.cooldown || 0;
        ai.history.push(move.id); if (ai.history.length > 5) ai.history.shift();
      }
      ai.moveCount++;
      call('endMove', e, ctx, move);
      e.huntLast = e.attack; e.attack = null; e.pounceHeight = 0;
      if (call('shouldFatigue', e, ctx, ai.moveCount)) {
        ai.moveCount = 0; ai.combo = [];
        call('fatigued', e, ctx);
        state(e, 'fatigue', call('fatigueDuration', e, ctx) || 2.5);
        return;
      }
      if (call('shouldReposition', e, ctx, move)) {
        ai.repositionSide = random(ctx) < 0.5 ? -1 : 1;
        state(e, 'reposition', 0.28 + random(ctx) * 0.16);
        return;
      }
      const rest = call('nextDelay', e, ctx, move);
      state(e, 'chase', rest === undefined ? 0.35 : rest);
    }

    function finishActive(e, ctx) {
      const ai = ensure(e), move = moveOf(e);
      call('finishActive', e, ctx, move);
      if (e.huntMode !== 'active') return;
      if (ai.combo.length) {
        const next = ai.combo.shift();
        e.chargeChain = ai.combo.filter(id => id === 'charge').length;
        ai.nextCombo = next;
        state(e, 'comboWait', move.comboDelay === undefined ? 0.18 : move.comboDelay);
        return;
      }
      e.chargeChain = 0;
      state(e, 'recover', e.recoverDuration);
    }

    function interrupt(e, mode, duration, ctx) {
      const ai = ensure(e);
      ai.combo = []; ai.nextCombo = null; e.chargeChain = 0;
      e.actionHit = true; e.pounceHeight = 0;
      state(e, mode, duration);
      call('interrupted', e, ctx, mode);
    }

    function update(e, ctx, dt) {
      const ai = ensure(e);
      for (const id of Object.keys(ai.cooldowns)) ai.cooldowns[id] = Math.max(0, ai.cooldowns[id] - dt);
      call('beforeUpdate', e, ctx, dt);
      const move = moveOf(e);
      if (e.huntMode === 'down' || e.huntMode === 'fatigue') {
        e.huntT -= dt;
        if (e.huntT <= 0) { e.attack = null; state(e, 'chase', 0.35); }
        return;
      }
      if (e.huntMode === 'chase') {
        call('chase', e, ctx, dt);
        e.huntT -= dt;
        if (e.huntT <= 0) choose(e, ctx);
        return;
      }
      if (e.huntMode === 'reposition') {
        call('reposition', e, ctx, dt);
        e.huntT -= dt;
        if (e.huntT <= 0) { ai.justRepositioned = true; choose(e, ctx); }
        return;
      }
      if (!move) { state(e, 'chase', 0.2); return; }
      if (e.huntMode === 'windup') {
        e.huntT -= dt;
        if (e.huntT > move.lockTime) call('track', e, ctx, dt, move);
        if (e.huntT <= 0) {
          call('lock', e, ctx, move);
          e.actionHit = false; e.attackResolved = false;
          state(e, 'active', e.activeDuration);
          call('beginActive', e, ctx, move);
        }
        return;
      }
      if (e.huntMode === 'active') {
        e.huntT -= dt;
        call('active', e, ctx, dt, move);
        if (e.huntMode === 'active' && e.huntT <= 0) finishActive(e, ctx);
        return;
      }
      if (e.huntMode === 'comboWait') {
        e.huntT -= dt;
        if (e.huntT <= 0 && ai.nextCombo) {
          const next = ai.nextCombo; ai.nextCombo = null;
          start(e, next, ctx, { chained: true });
        }
        return;
      }
      if (e.huntMode === 'recover') {
        e.huntT -= dt;
        if (e.huntT <= 0) finishMove(e, ctx);
      }
    }

    return { init, start, choose, update, finishMove, interrupt, candidates, moves, state };
  }

  root.BossAI = { createController, norm, clamp, distance, angleTo, zoneOf, turnToward, coneContains, pointSegmentDistance };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.BossAI;
})(typeof globalThis !== 'undefined' ? globalThis : this);

/* 战斗打击感：三级命中反馈、四类笔触、分级镜头与纸面合成音效。 */
(() => {
  'use strict';

  const DEFAULTS = {
    heavyFreeze: 0.045, critFreeze: 0.055, impactTime: 0.18, deathTime: 0.42,
    maxImpacts: 90, maxDeaths: 50, maxCameraKicks: 4,
    heavyShake: 1.1, eliteShake: 1.8, bossShake: 3.5
  };
  const CFG = Object.assign({}, DEFAULTS, BATTLE.feel || {});
  const SOUND_RECT = { x: W - 42, y: 58, w: 30, h: 30 };
  const impacts = [], deaths = [], cameraKicks = [];
  let preciseObserved = false, muted = false;

  try { muted = globalThis.localStorage && localStorage.getItem('notebook-muted') === '1'; } catch (_) { /* 无存储时仅本次有效 */ }

  const SLASH = new Set(['cyclone', 'vortex', 'pageslash', 'ruler', 'absolve']);
  const PIERCE = new Set(['tornado', 'chainclip', 'boomerang', 'icespear', 'pinburst', 'bloodcore', 'piercerush', 'spinlance', 'ricoshield', 'perfectarrow', 'arrowfocus', 'heatrail']);
  const BLAST = new Set(['volcanic', 'cola', 'chalk', 'brand', 'doommark', 'inkgrenade', 'magfist', 'shieldrush', 'surge', 'absorb', 'dive']);
  const SUSTAIN = new Set(['candle', 'vortex', 'inkrain', 'clouds', 'fields']);
  const HEAVY = new Set(['volcanic', 'cola', 'chalk', 'doommark', 'inkgrenade', 'magfist', 'shieldrush', 'pageslash', 'piercerush', 'surge', 'absorb', 'dive']);

  function familyOf(skillId) {
    if (SLASH.has(skillId)) return 'slash';
    if (BLAST.has(skillId)) return 'blast';
    if (PIERCE.has(skillId)) return 'pierce';
    if (SUSTAIN.has(skillId)) return 'sustain';
    return 'pierce';
  }
  function cap(list, item, max) {
    if (list.length >= max) list.splice(0, list.length - max + 1);
    list.push(item); return item;
  }
  function cameraKick(dx, dy, amount, shake = 0, duration = 0.12, zoom = 0) {
    const length = Math.hypot(dx, dy) || 1;
    cap(cameraKicks, {
      x: dx / length * amount, y: dy / length * amount,
      shake, zoom, t: duration, total: duration
    }, CFG.maxCameraKicks);
  }
  function cameraOffset() {
    let x = 0, y = 0, shake = 0, zoom = 1;
    // 同时触发时取最强震动与缩放，位移只做有上限的合成，不叠成剧烈晃屏。
    for (const k of cameraKicks) {
      const left = Math.max(0, k.t / k.total);
      x += k.x * left; y += k.y * left;
      shake = Math.max(shake, k.shake * left); zoom = Math.max(zoom, 1 + k.zoom * left);
    }
    const length = Math.hypot(x, y);
    if (length > 4) { x *= 4 / length; y *= 4 / length; }
    return { x, y, shake, zoom };
  }
  function addAction(kind, x, y, color, radius = 70, angle = 0, duration = 0.35) {
    return cap(impacts, { kind, family: kind, x, y, col: color || INK, r: radius, angle,
      t: duration, maxT: duration, heavy: true, seed: (nextId++ * 97) % 100000 }, CFG.maxImpacts);
  }

  /* ---------- 轻量 Web Audio：笔尖、纸面、拍墨，无外部音频资源 ---------- */
  let audio = null, master = null, voices = 0;
  const soundTimes = Object.create(null);
  function ensureAudio() {
    if (audio || muted || typeof window === 'undefined') return audio;
    const AudioCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtor) return null;
    try {
      audio = new AudioCtor(); master = audio.createGain(); master.gain.value = 0.72; master.connect(audio.destination);
    } catch (_) { audio = null; master = null; }
    return audio;
  }
  function unlockAudio() {
    const ac = ensureAudio();
    if (ac && ac.state === 'suspended') ac.resume().catch(() => {});
  }
  function canSound(kind, interval) {
    if (muted || voices >= 12 || !ensureAudio() || audio.state !== 'running') return false;
    const now = audio.currentTime;
    if ((soundTimes[kind] || -99) + interval > now) return false;
    soundTimes[kind] = now; return true;
  }
  function tone(freq, duration, volume, type = 'sine', endFreq = 0) {
    const osc = audio.createOscillator(), gain = audio.createGain(), now = audio.currentTime;
    osc.type = type; osc.frequency.setValueAtTime(Math.max(30, freq), now);
    if (endFreq) osc.frequency.exponentialRampToValueAtTime(Math.max(30, endFreq), now + duration);
    gain.gain.setValueAtTime(volume, now); gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(gain); gain.connect(master); voices++;
    osc.onended = () => { voices = Math.max(0, voices - 1); osc.disconnect(); gain.disconnect(); };
    osc.start(now); osc.stop(now + duration);
  }
  function paperNoise(duration, volume, frequency) {
    const length = Math.max(1, Math.floor(audio.sampleRate * duration));
    const buffer = audio.createBuffer(1, length, audio.sampleRate), data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const source = audio.createBufferSource(), filter = audio.createBiquadFilter(), gain = audio.createGain();
    source.buffer = buffer; filter.type = 'bandpass'; filter.frequency.value = frequency; filter.Q.value = 0.7;
    gain.gain.value = volume; source.connect(filter); filter.connect(gain); gain.connect(master); voices++;
    source.onended = () => { voices = Math.max(0, voices - 1); source.disconnect(); filter.disconnect(); gain.disconnect(); };
    source.start();
  }
  function sound(kind, family = 'pierce') {
    const interval = kind === 'hit' ? 0.045 : (kind === 'kill' ? 0.065 : 0.025);
    if (!canSound(kind + (kind === 'hit' ? family : ''), interval)) return;
    if (kind === 'hit') {
      paperNoise(0.035, 0.018, family === 'slash' ? 2100 : (family === 'blast' ? 650 : 1500));
      if (family === 'blast') tone(105, 0.055, 0.018, 'triangle', 70);
    } else if (kind === 'heavy') {
      paperNoise(0.075, 0.038, 900); tone(115, 0.09, 0.032, 'triangle', 58);
    } else if (kind === 'kill') {
      paperNoise(0.085, 0.026, 2400); tone(210, 0.055, 0.012, 'sine', 130);
    } else if (kind === 'parry') {
      paperNoise(0.045, 0.025, 3100); tone(680, 0.12, 0.035, 'triangle', 310);
    } else if (kind === 'dive') {
      paperNoise(0.1, 0.035, 800); tone(130, 0.16, 0.028, 'sine', 430);
    } else if (kind === 'surge') {
      paperNoise(0.18, 0.055, 520); tone(92, 0.2, 0.045, 'triangle', 42);
    } else if (kind === 'charge') {
      paperNoise(0.055, 0.018, 1800); tone(180, 0.08, 0.012, 'sine', 250);
    }
  }
  function toggleMute() {
    muted = !muted;
    try { if (globalThis.localStorage) localStorage.setItem('notebook-muted', muted ? '1' : '0'); } catch (_) { /* 忽略隐私模式 */ }
    if (master) master.gain.value = muted ? 0 : 0.72;
    if (!muted) unlockAudio();
    return muted;
  }

  /* ---------- 命中：普通只画笔尖爆点，暴击/重击才局部停顿与轻推镜头 ---------- */
  const baseHurtEnemy = hurtEnemy;
  hurtEnemy = function(e, dmg, dotDps, sx, sy, vuln, critAdd, bossMul, hitCol, weakFloat, skillId) {
    if (e.dead) return baseHurtEnemy(e, dmg, dotDps, sx, sy, vuln, critAdd, bossMul, hitCol, weakFloat, skillId);
    const oldHp = e.hp, sparkCount = sparks.length, floatCount = floats.length;
    const result = baseHurtEnemy(e, dmg, dotDps, sx, sy, vuln, critAdd, bossMul, hitCol, weakFloat, skillId);
    if (e.hp >= oldHp) return result;
    const crit = floats.slice(floatCount).some(f => f.crit);
    const heavy = !weakFloat && (crit || HEAVY.has(skillId));
    const family = weakFloat ? 'sustain' : familyOf(skillId);
    // 统一结算原本附带的圆点爆点由方向化笔触替换，避免两层特效叠成噪点。
    if (!weakFloat && sparks.length > sparkCount) sparks.splice(sparkCount, 1);
    if (!weakFloat) {
      const originX = sx === undefined ? player.x : sx, originY = sy === undefined ? player.y : sy;
      const angle = Math.atan2(e.y - originY, e.x - originX);
      e.impactAngle = angle; e.impactT = heavy ? 0.14 : 0.08; e.outlineT = heavy ? 0.12 : 0.055;
      cap(impacts, { kind: 'hit', family, x: e.x, y: e.y, angle, col: hitCol || INK,
        r: Math.max(10, e.r * (heavy ? 1.45 : 1)), t: heavy ? CFG.impactTime * 1.35 : CFG.impactTime,
        maxT: heavy ? CFG.impactTime * 1.35 : CFG.impactTime, heavy, crit,
        seed: (e.id * 131 + nextId * 17) % 100000 }, CFG.maxImpacts);
      if (heavy) {
        const freeze = crit ? CFG.critFreeze : CFG.heavyFreeze;
        e.impactFreezeT = Math.max(e.impactFreezeT || 0, freeze);
        cameraKick(e.x - player.x, e.y - player.y, crit ? 1.5 : 1.05, CFG.heavyShake, 0.1);
        sound('heavy', family);
      } else sound('hit', family);
    }
    return result;
  };

  const baseKillEnemy = killEnemy;
  killEnemy = function(e) {
    if (!e.dead) {
      const count = e.boss ? 14 : (e.elite ? 9 : 6), bits = [];
      for (let i = 0; i < count; i++) bits.push({
        a: i / count * Math.PI * 2 + (e.id % 5) * 0.13,
        speed: 25 + (i % 4) * 15, len: 3 + (i % 3) * 2, spin: (i % 2 ? 1 : -1) * (2 + i % 3)
      });
      cap(deaths, { x: e.x, y: e.y, r: e.r, col: DARK, bits,
        t: e.boss ? 0.9 : CFG.deathTime, maxT: e.boss ? 0.9 : CFG.deathTime,
        hold: e.boss ? 0.09 : 0.055, elite: e.elite, boss: e.boss, seed: e.id * 73 }, CFG.maxDeaths);
      if (e.boss) cameraKick(e.x - player.x, e.y - player.y, 3, CFG.bossShake, 0.22, 0.012);
      else if (e.elite) cameraKick(e.x - player.x, e.y - player.y, 1.8, CFG.eliteShake, 0.14);
      sound('kill');
    }
    return baseKillEnemy(e);
  };

  /* ---------- 核心操作：统一在真实成功入口触发，失败输入不会产生反馈 ---------- */
  const baseChargeParry = chargeParry;
  chargeParry = function() {
    const result = baseChargeParry();
    addAction('parry', player.x, player.y, inkFriendlyColor, Math.max(65, player.absorbRadius || 65), player.faceA || 0, 0.34);
    cameraKick(Math.cos(player.faceA || 0), Math.sin(player.faceA || 0), -1.4, 0.8, 0.14, 0.009);
    sound('parry'); return result;
  };
  const baseCastInkSurge = castInkSurge;
  castInkSurge = function(radius, full) {
    const result = baseCastInkSurge(radius, full);
    if (result) {
      addAction('surge', player.x, player.y, player.actives.length ? trailColorOf(player.actives[0].id) : INK,
        radius * player.radMul, 0, 0.42);
      cameraKick(1, 0, 0, 2.2, 0.18, 0.012); sound('surge');
    }
    return result;
  };
  const baseStartCharge = startInkSurgeCharge;
  startInkSurgeCharge = function(pointerId = null) {
    const result = baseStartCharge(pointerId);
    if (result && player.surgeCharging) sound('charge');
    return result;
  };

  const baseUpdate = update;
  update = function(dt) {
    const result = baseUpdate(dt);
    for (let i = impacts.length - 1; i >= 0; i--) { impacts[i].t -= dt; if (impacts[i].t <= 0) impacts.splice(i, 1); }
    for (let i = deaths.length - 1; i >= 0; i--) { deaths[i].t -= dt; if (deaths[i].t <= 0) deaths.splice(i, 1); }
    for (let i = cameraKicks.length - 1; i >= 0; i--) { cameraKicks[i].t -= dt; if (cameraKicks[i].t <= 0) cameraKicks.splice(i, 1); }
    for (const e of enemies) {
      e.impactT = Math.max(0, (e.impactT || 0) - dt);
      e.outlineT = Math.max(0, (e.outlineT || 0) - dt);
    }
    const precise = !!(player.diving && player.preciseDiveUsed && (player.preciseDiveSlowT || 0) > 0);
    if (precise && !preciseObserved) {
      addAction('dive', player.x, player.y, INK, 150 * player.radMul, 0, 0.38);
      cameraKick(1, 0, 0, 1.25, 0.13, 0.008); sound('dive');
    }
    preciseObserved = precise;
    return result;
  };

  const baseResetGame = resetGame;
  resetGame = function() {
    const result = baseResetGame();
    impacts.length = 0; deaths.length = 0; cameraKicks.length = 0; preciseObserved = false;
    return result;
  };

  /* ---------- 世界层绘制：复用现有抖线，保持圆珠笔而不是光效贴图 ---------- */
  function drawHit(fx) {
    const progress = 1 - fx.t / fx.maxT, alpha = Math.max(0, fx.t / fx.maxT);
    const c = Math.cos(fx.angle), s = Math.sin(fx.angle), size = fx.r * (0.75 + progress * 0.7);
    setSeed(fx.seed); ctx.globalAlpha = alpha;
    if (fx.family === 'slash') {
      ctx.save(); ctx.translate(fx.x, fx.y); ctx.rotate(fx.angle + 0.35);
      jline(-size, -size * 0.35, size, size * 0.35, fx.col, fx.heavy ? 3.8 : 2.4);
      jline(-size * 0.75, size * 0.2, size * 0.65, -size * 0.45, fx.col, 1.4);
      ctx.restore();
    } else if (fx.family === 'pierce') {
      jline(fx.x - c * size, fx.y - s * size, fx.x + c * size * 0.85, fx.y + s * size * 0.85, fx.col, fx.heavy ? 3.2 : 2);
      jline(fx.x - s * 4, fx.y + c * 4, fx.x + s * 4, fx.y - c * 4, fx.col, 1.4);
      jcircle(fx.x, fx.y, 2 + progress * 3, fx.col, 1.2);
    } else if (fx.family === 'blast') {
      jcircle(fx.x, fx.y, size, fx.col, fx.heavy ? 4.2 : 2.6);
      jcircle(fx.x, fx.y, Math.max(2, size * 0.35), fx.col, 1.5);
      for (let i = 0; i < (fx.heavy ? 8 : 5); i++) {
        const a = i / (fx.heavy ? 8 : 5) * Math.PI * 2;
        jline(fx.x + Math.cos(a) * size * 0.7, fx.y + Math.sin(a) * size * 0.7,
          fx.x + Math.cos(a) * size * 1.25, fx.y + Math.sin(a) * size * 1.25, fx.col, 1.5);
      }
    } else {
      for (let i = -1; i <= 1; i++) jline(fx.x - 6, fx.y + i * 4, fx.x + 7, fx.y + i * 4 - 3, fx.col, 1.1);
    }
    ctx.globalAlpha = 1;
  }
  function drawAction(fx) {
    const p = 1 - fx.t / fx.maxT, alpha = Math.max(0, fx.t / fx.maxT);
    setSeed(fx.seed); ctx.globalAlpha = alpha;
    if (fx.kind === 'parry') {
      const r = fx.r * (0.45 + p * 0.35);
      jline(fx.x - r * 0.6, fx.y - r * 0.6, fx.x + r * 0.6, fx.y + r * 0.6, fx.col, 4);
      jline(fx.x + r * 0.6, fx.y - r * 0.6, fx.x - r * 0.6, fx.y + r * 0.6, fx.col, 4);
      jcircle(fx.x, fx.y, r, fx.col, 2.5);
    } else if (fx.kind === 'dive' || fx.kind === 'surge') {
      const r = fx.kind === 'dive' ? 24 + (fx.r - 24) * p : fx.r * (0.15 + 0.85 * p);
      jcircle(fx.x, fx.y, r, fx.col, fx.kind === 'surge' ? 5 : 3.5);
      const lines = fx.kind === 'surge' ? 20 : 14;
      for (let i = 0; i < lines; i++) {
        const a = i / lines * Math.PI * 2, inner = r * 0.91;
        jline(fx.x + Math.cos(a) * inner, fx.y + Math.sin(a) * inner,
          fx.x + Math.cos(a + 0.035) * r * 0.78, fx.y + Math.sin(a + 0.035) * r * 0.78, fx.col, 1.25);
      }
    }
    ctx.globalAlpha = 1;
  }
  function drawDeath(fx) {
    const age = fx.maxT - fx.t, alpha = Math.max(0, fx.t / fx.maxT);
    setSeed(fx.seed); ctx.globalAlpha = alpha;
    if (age < fx.hold) {
      jcircle(fx.x, fx.y, Math.max(3, fx.r * 0.75), fx.col, fx.boss ? 4 : 2.4);
      jline(fx.x - fx.r, fx.y, fx.x + fx.r, fx.y, fx.col, 2);
    }
    const moveAge = Math.max(0, age - fx.hold);
    for (const bit of fx.bits) {
      const d = moveAge * bit.speed, x = fx.x + Math.cos(bit.a) * d, y = fx.y + Math.sin(bit.a) * d + moveAge * moveAge * 28;
      const a = bit.a + moveAge * bit.spin, c = Math.cos(a) * bit.len, s = Math.sin(a) * bit.len;
      jline(x - c, y - s, x + c, y + s, fx.col, fx.boss ? 2.2 : 1.4);
    }
    ctx.globalAlpha = 1;
  }
  function drawCharge() {
    if (!player.surgeCharging) return;
    const ratio = inkSurgeChargeRatio(), radius = inkSurgeChargeRadius();
    const col = player.actives.length ? trailColorOf(player.actives[0].id) : INK;
    setSeed(48918); ctx.globalAlpha = 0.22 + ratio * 0.5;
    for (let i = 0; i < 14; i++) {
      const a = i / 14 * Math.PI * 2 + Math.sin(boilT * 0.3 + i) * 0.025;
      const outer = radius + 18 - ratio * 8;
      jline(player.x + Math.cos(a) * outer, player.y + Math.sin(a) * outer,
        player.x + Math.cos(a + 0.04) * (radius - 7), player.y + Math.sin(a + 0.04) * (radius - 7), col, 1.2 + ratio);
    }
    ctx.globalAlpha = 1;
  }
  function drawWorld() {
    drawCharge();
    for (const fx of deaths) drawDeath(fx);
    for (const fx of impacts) {
      if (fx.x < camX - 240 || fx.x > camX + VIEW_W + 240 || fx.y < camY - 240 || fx.y > camY + VIEW_H + 240) continue;
      if (fx.kind === 'hit') drawHit(fx); else drawAction(fx);
    }
    for (const e of enemies) {
      if (e.dead || !(e.outlineT > 0)) continue;
      ctx.globalAlpha = Math.min(0.65, e.outlineT * 6); setSeed(e.id + 448);
      jcircle(e.x, e.y, e.r + 3, e.flash > 0 ? DARK : INK, 2.2);
    }
    ctx.globalAlpha = 1;
  }
  const previousExtras = window.__drawWorldExtras;
  window.__drawWorldExtras = function() {
    if (previousExtras) previousExtras();
    drawWorld();
  };

  function drawSoundButton() {
    if (state !== 'play') return;
    setSeed(488); ctx.globalAlpha = 0.72;
    jcircle(W - 27, 73, 12, muted ? GRAY : INK, 1.5);
    ctx.fillStyle = muted ? GRAY : INK; ctx.textAlign = 'center'; ctx.font = 'bold 10px ' + FONT;
    ctx.fillText(muted ? '静' : '声', W - 27, 77); ctx.globalAlpha = 1;
  }
  const baseRender = render;
  render = function() { const result = baseRender(); drawSoundButton(); return result; };

  canvas.addEventListener('pointerdown', unlockAudio, true);
  canvas.addEventListener('pointerdown', function(e) {
    if (state !== 'play') return;
    const p = toLogical(e);
    if (!pointInRect(p, SOUND_RECT)) return;
    e.preventDefault(); e.stopImmediatePropagation(); toggleMute();
  }, true);
  window.addEventListener('keydown', function(e) {
    if (!e.repeat && e.key.toLowerCase() === 'm') toggleMute();
  });

  globalThis.CombatFeelRuntime = {
    cameraOffset, familyOf, sound, toggleMute, ensureAudio,
    get impacts() { return impacts; }, get deaths() { return deaths; }, get cameraKicks() { return cameraKicks; },
    get muted() { return muted; }, get soundRect() { return SOUND_RECT; }, get config() { return CFG; }
  };
})();

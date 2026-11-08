/* 正式战斗角色接入：只负责运动与身体绘制，不改碰撞、伤害或攻击计时。 */
(function (root, factory) {
  const deps = {
    designs: root.CreatureDesigns || (typeof require !== 'undefined' ? require('./creature-designs.js') : null),
    bio: root.CreatureBioRig || (typeof require !== 'undefined' ? require('./creature-bio-rig.js') : null),
    renderer: root.CreatureRenderer || (typeof require !== 'undefined' ? require('./creature-design-renderer.js') : null),
    biped: root.BipedLocomotion || (typeof require !== 'undefined' ? require('./biped-locomotion.js') : null),
    bipedRenderer: root.BipedRenderer || (typeof require !== 'undefined' ? require('./biped-renderer.js') : null)
  };
  const api = factory(deps);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.CreatureGameRuntime = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (deps) {
  'use strict';
  const root = typeof globalThis !== 'undefined' ? globalThis : this;
  const { designs, bio, renderer, biped, bipedRenderer } = deps;

  const BIPED_IDS = new Set(['player', 'stick', 'doodle', 'rage', 'pencilthrower', 'elitePencil', 'eliteCrossbow', 'bossJudge']);
  const BOSS_IDS = ['bossScribble', 'bossTape', 'bossJudge', 'bossDragon', 'bossKnight', 'bossElement', 'bossOrigami', 'bossEraser', 'bossAbyss', 'bossNotebook'];
  const MULTI_LOD_INTERVALS = [0, 1 / 30, 1 / 12, 1 / 8];
  const designMap = new Map(designs.DEFS.map(d => [d.id, d]));
  const displayDefCache = new Map();

  function resolveEnemyId(body) {
    if (!body) return null;
    if (body.boss) return BOSS_IDS[Math.max(0, Math.min(BOSS_IDS.length - 1, (body.stage || 1) - 1))];
    return designMap.has(body.type) ? body.type : null;
  }

  function displayDef(id, color) {
    const key = id + ':' + (color || '');
    if (displayDefCache.has(key)) return displayDefCache.get(key);
    let def;
    if (BIPED_IDS.has(id)) {
      def = Object.assign({}, biped.getDef(id));
      if (color) {
        def.color = color;
        if (id === 'player') def.accent = color;
      }
    } else {
      def = Object.assign({}, designMap.get(id));
      if (color) def.color = color;
    }
    displayDefCache.set(key, def);
    return def;
  }

  function attachPlayer(body) {
    if (!body) return null;
    if (!body.bipedRig || body.creatureId !== 'player') {
      body.creatureId = 'player'; body.creatureKind = 'biped';
      body.bipedRig = new biped.BipedRig(displayDef('player'));
      body.creatureLastX = body.x; body.creatureLastY = body.y;
      body.creatureFacing = 1; body.creatureTime = 0;
    }
    return body.bipedRig;
  }

  function attachEnemy(body) {
    const id = resolveEnemyId(body);
    if (!id || id === 'spider') return null;
    if (body.creatureId === id && (body.bipedRig || body.creatureRig || id === 'plane')) return id;
    body.creatureId = id; body.creatureTime = 0; body.creatureLod = 0; body.creatureAccum = 0;
    body.creatureLastX = body.x; body.creatureLastY = body.y; body.creatureFacing = 1;
    if (BIPED_IDS.has(id)) {
      body.creatureKind = 'biped';
      body.bipedRig = new biped.BipedRig(displayDef(id));
      body.creatureRig = null;
    } else {
      body.creatureKind = designMap.get(id).legs ? 'multileg' : 'flight';
      body.creatureRig = bio.createBioRig(designMap.get(id), body);
      body.bipedRig = null;
    }
    return id;
  }

  function actualMotion(body, dt) {
    const lastX = Number.isFinite(body.creatureLastX) ? body.creatureLastX : body.x;
    const lastY = Number.isFinite(body.creatureLastY) ? body.creatureLastY : body.y;
    const dx = body.x - lastX, dy = body.y - lastY;
    body.creatureLastX = body.x; body.creatureLastY = body.y;
    if (Math.abs(dx) > 0.01) body.creatureFacing = dx < 0 ? -1 : 1;
    const distance = Math.hypot(dx, dy);
    if (!(dt > 0) || !Number.isFinite(distance)) return { speed: 0, dx: 0, dy: 0, teleported: false };
    return { speed: Math.min(500, distance / dt), dx, dy, teleported: distance > 180 };
  }

  function updatePlayer(body, dt) {
    const rig = attachPlayer(body);
    const motion = actualMotion(body, dt);
    body.creatureTime += Math.max(0, dt || 0);
    rig.update(dt, motion.teleported ? rig.def.speed : motion.speed);
  }

  function updateEnemy(body, dt, distanceToViewer, onscreen) {
    const id = attachEnemy(body);
    if (!id || id === 'spider') return false;
    const motion = actualMotion(body, dt);
    body.creatureTime += Math.max(0, dt || 0);
    if (body.creatureKind === 'biped') {
      body.bipedRig.update(dt, motion.teleported ? body.bipedRig.def.speed : motion.speed);
      return true;
    }
    if (id === 'plane') {
      body.locomotionAngle = Math.atan2(body.vy || 0, body.vx || 1) + Math.PI / 2;
      bio.updateBio(designMap.get(id), body, null, dt, body.creatureTime);
      return true;
    }
    const distance = Number.isFinite(distanceToViewer) ? distanceToViewer : 0;
    const level = !onscreen ? 3 : distance <= 190 ? 0 : distance <= 360 ? 1 : 2;
    body.creatureLod = level;
    body.creatureAccum = (body.creatureAccum || 0) + Math.max(0, dt || 0);
    const interval = MULTI_LOD_INTERVALS[level];
    if (interval === 0 || body.creatureAccum >= interval) {
      const step = body.creatureAccum;
      body.creatureAccum = 0;
      bio.updateBio(designMap.get(id), body, body.creatureRig, step, body.creatureTime);
    }
    return true;
  }

  function bipedScale(body, rig) {
    const d = rig.def;
    const naturalHeight = (d.upperLen + d.lowerLen) * d.hipHeight + d.torsoH + d.headR * 1.92;
    const heightFactor = body.boss ? 2.5 : body.elite ? 2.2 : 2.5;
    return Math.max(0.1, body.r * heightFactor / Math.max(1, naturalHeight));
  }

  function drawBiped(ctx, body, color) {
    const rig = body.bipedRig;
    bipedRenderer.draw(ctx, rig, {
      cx: body.x, groundY: body.y + body.r * 0.75,
      scale: bipedScale(body, rig), facing: body.creatureFacing || 1,
      def: displayDef(body.creatureId, color)
    });
  }

  function drawBossState(ctx, body) {
    if (!body.boss || !root.doodleBridge) return;
    const bridge = root.doodleBridge;
    if (body.arch === 'charger' && body.mode === 'aim') {
      ctx.save(); ctx.globalAlpha = 0.35 + 0.35 * Math.sin(body.modeT * 30);
      for (let d = 20; d < 280; d += 26) {
        bridge.line(body.x + body.chargeDx * d, body.y + body.chargeDy * d,
          body.x + body.chargeDx * (d + 14), body.y + body.chargeDy * (d + 14), '#a85e55', 2.5);
      }
      ctx.restore();
    }
    if (body.phase === 2) bridge.circle(body.x, body.y, body.r + 7, '#a85e55', 1.5);
  }

  function drawEnemyBody(ctx, body, color) {
    const id = attachEnemy(body);
    if (!id || id === 'spider') return false;
    if (body.creatureKind === 'biped') drawBiped(ctx, body, color);
    else {
      const def = displayDef(id, color);
      renderer.draw(ctx, def, body, body.creatureRig, body.creatureTime || 0,
        body.x, body.y, 0, 0, { scale: body.r / Math.max(1, designMap.get(id).r) });
    }
    drawBossState(ctx, body);
    return true;
  }

  function drawPlayer(ctx, body, color) {
    attachPlayer(body);
    drawBiped(ctx, body, color || '#1a2b8f');
    return true;
  }

  function drawDivingPlayer(ctx, body, color) {
    const rig = attachPlayer(body);
    const col = color || '#1a2b8f', bridge = root.doodleBridge;
    const t = rig.time || 0, drift = Math.sin(t * 5) * 2;
    // 保留主角本体，只用低平涟漪表现正在墨中游动。
    ctx.save(); ctx.globalAlpha = 0.42;
    bridge.line(body.x - 28 + drift, body.y + 13, body.x - 12 + drift, body.y + 13, col, 1.25);
    bridge.line(body.x + 10 - drift, body.y + 14, body.x + 27 - drift, body.y + 14, col, 1.25);
    ctx.globalAlpha = 0.24;
    bridge.line(body.x - 20 - drift * 0.5, body.y + 17, body.x + 18 - drift * 0.5, body.y + 17, col, 1);
    ctx.restore();
    bipedRenderer.draw(ctx, rig, {
      cx: body.x, groundY: body.y + 8, swimming: true,
      scale: bipedScale(body, rig), facing: body.creatureFacing || 1,
      def: displayDef('player', col)
    });
    return true;
  }

  function requiresLiveBody(body) {
    const id = resolveEnemyId(body);
    return !!(id && id !== 'spider' && !BIPED_IDS.has(id));
  }

  function getDebugState(body) {
    return { id: body.creatureId || null, kind: body.creatureKind || null,
      lod: body.creatureLod || 0, facing: body.creatureFacing || 1,
      legs: body.creatureRig ? body.creatureRig.legs.length : body.bipedRig ? 2 : 0 };
  }

  return { BIPED_IDS, BOSS_IDS, resolveEnemyId, attachPlayer, attachEnemy,
    updatePlayer, updateEnemy, drawEnemyBody, drawPlayer, drawDivingPlayer, requiresLiveBody, getDebugState };
});

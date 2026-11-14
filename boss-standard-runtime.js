/* 其余 Boss 的通用招式框架：每名 Boss 有独立招式表，共用站位、锁定、连段与收招状态机。 */
(function () {
  'use strict';
  const AI = globalThis.BossAI || (typeof require !== 'undefined' ? require('./boss-ai-runtime.js') : null);
  const { clamp, distance, angleTo, turnToward, coneContains } = AI;
  const TAU = Math.PI * 2;
  const CTX = { get player() { return player; } };
  const facePoint = (e, a, d) => ({ x: e.x + Math.cos(a) * d, y: e.y + Math.sin(a) * d });
  const rest = (min, max) => ({ min, max });
  const enraged = id => e => e.phase === 2 ? [id] : [];
  const summonAvailable = () => normalEnemyCount() < normalEnemyCap();
  const move = (name, kind, data) => Object.assign({
    name, kind, weight: 1, cooldown: 0.6, zones: ['any'], rest: rest(0.35, 0.7)
  }, data);
  const cone = (name, data) => move(name, 'cone', Object.assign({
    minRange: 0, maxRange: 320, zones: ['front', 'side'], range: 270, arc: 1.8, damage: 0.85,
    windup: 0.5, active: 0.28, recover: 0.42, lockTime: 0.2
  }, data));
  const charge = (name, data) => move(name, 'charge', Object.assign({
    minRange: 220, maxRange: 920, zones: ['front', 'side'], range: 720, width: 58, speed: 820, damage: 1,
    windup: 0.68, active: 0.76, recover: 0.48, lockTime: 0.25, repositionBonus: 1.5
  }, data));
  const slam = (name, data) => move(name, 'slam', Object.assign({
    minRange: 0, maxRange: 225, radius: 155, damage: 1.05, unparryable: true,
    windup: 0.78, active: 0.4, recover: 0.72, lockTime: 0.34, cooldown: 1.2
  }, data));
  const leap = (name, data) => move(name, 'leap', Object.assign({
    minRange: 240, maxRange: 850, radius: 120, damage: 1, unparryable: true,
    windup: 0.72, active: 0.5, recover: 0.55, lockTime: 0.27, cooldown: 1
  }, data));
  const volley = (name, data) => move(name, 'volley', Object.assign({
    minRange: 230, maxRange: 900, zones: ['front', 'side'], range: 800, count: 3, speed: 360, damage: 0.6,
    windup: 0.68, active: 0.24, recover: 0.5, lockTime: 0.29, cooldown: 1.1
  }, data));
  const ring = (name, data) => move(name, 'ring', Object.assign({
    minRange: 0, maxRange: 720, count: 12, speed: 170, damage: 0.55,
    windup: 0.82, active: 0.3, recover: 0.65, lockTime: 0.35, cooldown: 1.8
  }, data));
  const meteor = (name, data) => move(name, 'meteor', Object.assign({
    minRange: 180, maxRange: 900, count: 5, radius: 58, damage: 0.75, unparryable: true,
    windup: 0.95, active: 0.34, recover: 0.68, lockTime: 0.42, cooldown: 1.8
  }, data));
  const summon = (name, data) => move(name, 'summon', Object.assign({
    minRange: 0, maxRange: 800, zones: ['back', 'side'], count: 3, mob: 'spider', cooldown: 7,
    windup: 0.9, active: 0.25, recover: 0.7, lockTime: 0.4, available: summonAvailable
  }, data));
  const shape = (name, kind, data) => move(name, kind, Object.assign({
    minRange: 0, maxRange: 900, damage: 0.9, windup: 0.72, active: 0.55,
    recover: 0.55, lockTime: 0.3, cooldown: 0.9
  }, data));
  const hasPath = e => !!(e.pathPoints && e.pathPoints.length > 1);
  const hasPods = e => enemies.some(n => n.pod && n.ownerId === e.id && !n.dead);
  const hasFeathers = e => ebullets.some(b => b.sourceId === e.id && b.feather && b.life > 0);

  const PROFILES = {
    3: { style: 'charger', moves: {
      judgeSlash: cone('判官亲笔', { range: 285, arc: 1.35, combo: enraged('judgeSlash'), chainWindup: 0.32 }),
      judgeCross: cone('红叉宣判', { range: 320, arc: 2.15, damage: 0.95, windup: 0.58, combo: enraged('judgeSlash') }),
      judgeCharge: charge('长笔突刺', { speed: 920, combo: enraged('judgeCharge'), chainWindup: 0.4 }),
      judgeLeap: leap('跃页处刑', { radius: 110 }),
      judgeSlam: slam('朱印落地', { radius: 140 })
    } },
    4: { style: 'caster', moves: {
      dragonBreath: cone('空想龙息', { range: 430, arc: 0.85, active: 0.68, damage: 0.9, maxRange: 450 }),
      dragonMeteor: meteor('幻想陨星', { count: 5, radius: 56 }),
      dragonVolley: volley('星墨吐息', { count: 5 }),
      dragonWing: cone('双翼横扫', { range: 305, arc: 2.4, maxRange: 330 }),
      dragonLeap: leap('巨龙凌空', { radius: 135, combo: enraged('dragonMeteor') })
    } },
    5: { style: 'charger', moves: {
      knightLance: cone('团长骑枪', { range: 345, arc: 0.9, damage: 1, maxRange: 370 }),
      knightShield: charge('盾牌碾阵', { speed: 720, width: 82, unparryable: true, damage: 1.1 }),
      knightSweep: cone('骑士回旋', { range: 295, arc: 2.5, combo: enraged('knightSweep'), chainWindup: 0.34 }),
      knightSummon: summon('涂鸦列队', { mob: 'rage', count: 3 }),
      knightSlam: slam('盾面重击', { radius: 155 })
    } },
    6: { style: 'blob', moves: {
      elementRing: ring('元素墨环', { count: 14 }),
      elementInk: meteor('墨雨淤积', { count: 3, radius: 84, ink: true }),
      elementSlam: slam('液核心潮', { radius: 170 }),
      elementVolley: volley('凝墨喷流', { count: 4, speed: 310 }),
      elementSummon: summon('分裂墨蛛', { count: 3 })
    } },
    7: { style: 'caster', moves: {
      origamiBreath: cone('折纸焰息', { range: 460, arc: 0.72, active: 0.65, maxRange: 480 }),
      origamiMeteor: meteor('千纸坠落', { count: 7, radius: 53 }),
      origamiVolley: volley('纸刃齐射', { count: 7, speed: 400 }),
      origamiCharge: charge('龙王折冲', { speed: 850, combo: enraged('origamiCharge') }),
      origamiLeap: leap('展翼扑杀', { radius: 140 })
    } },
    8: { style: 'charger', moves: {
      eraserCharge: charge('暴走摩擦', { speed: 1020, active: 0.85, combo: enraged('eraserCharge'), chainWindup: 0.38 }),
      eraserSlam: slam('橡皮墩地', { radius: 180 }),
      eraserSweep: cone('包装纸横扫', { range: 305, arc: 2.2 }),
      eraserLeap: leap('橡皮弹跳', { radius: 135 }),
      eraserRing: ring('碎屑崩飞', { count: 10, speed: 230 })
    } },
    9: { style: 'blob', moves: {
      abyssRing: ring('深渊墨潮', { count: 18, speed: 185 }),
      abyssInk: meteor('万墨沉没', { count: 5, radius: 94, ink: true }),
      abyssSlam: slam('深渊张口', { radius: 195, damage: 1.15 }),
      abyssVolley: volley('触手喷墨', { count: 6, speed: 330 }),
      abyssSummon: summon('渊底孵化', { count: 4 })
    } },
    10: { style: 'caster', moves: {
      notebookSlash: cone('终页裁切', { range: 335, arc: 2, combo: enraged('notebookSlash') }),
      notebookMeteor: meteor('万页终局', { count: 8, radius: 60 }),
      notebookRing: ring('全书墨弹', { count: 20, speed: 195 }),
      notebookCharge: charge('封面撞击', { speed: 920, combo: enraged('notebookCharge') }),
      notebookInk: meteor('作者涂改', { count: 4, radius: 90, ink: true }),
      notebookSummon: summon('角色出库', { mob: 'rage', count: 4 })
    } },
    11: { style: 'charger', moves: {
      // 左右爪是两条窄环带，不是同一张大扇形重复两次。
      feralClaw: cone('裂纸爪', { kind: 'crescent', range: 300, innerRange: 150, arc: 0.92,
        clawOffset: 48, clawForward: 24, damage: 0.85, windup: 0.45,
        active: 0.24, recover: 0.38, lockTime: 0.25, combo: enraged('feralClaw'), chainWindup: 0.3 }),
      // 落地后沿锁定方向继续滑行，滑行路径也有独立危险提示。
      feralPounce: leap('荒原扑杀', { radius: 105, slide: 80, slideTime: 0.24,
        damage: 1.05, windup: 0.72, active: 0.5, recover: 0.55 }),
      // 二段沿平行偏移通道折返；aim 在预警开始前就写入返程坐标。
      feralCharge: charge('折返奔袭', { range: 680, width: 65, speed: 850, damage: 1,
        windup: 0.65, combo: enraged('feralCharge'), chainWindup: 0.38, returnOffset: 110 }),
      // 先走 120 的弧线侧移，再攻击 start 时记录的位置，出手阶段不再吸附玩家。
      feralFlank: cone('侧步反扑', { kind: 'flank', minRange: 0, maxRange: 340, zones: ['back', 'side'],
        range: 250, arc: 1.45, flankDistance: 120, damage: 0.8, windup: 0.68, active: 0.28,
        recover: 0.45, lockTime: 0.18, cooldown: 5 }),
      feralStomp: slam('六足踏裂', { radius: 155, damage: 1.15, windup: 0.85 })
    } },
    12: { style: 'blob', moves: {
      turtlePress: slam('山龟坐压', { radius: 115, damage: 1.2, combo: ['turtleRing'] }),
      turtleRing: shape('壳震外环', 'annulus', { innerRange: 120, range: 225, unparryable: true,
        damage: 1.05, windup: 0.62, active: 0.48, recover: 0.72 }),
      turtleSweep: cone('旋甲巡扫', { range: 245, arc: Math.PI * 1.5, damage: 0.9, windup: 0.7,
        combo: enraged('turtleSweep'), chainRotate: Math.PI, chainWindup: 0.42 }),
      turtleSpikes: shape('甲角突出', 'lines', { pattern: 'radial', count: 6, range: 205,
        startRadius: 68, width: 38, damage: 0.8, active: 0.85 })
    } },
    13: { style: 'caster', moves: {
      flowerVines: shape('双蔓夹取', 'curves', { count: 2, range: 310, width: 40,
        damage: 0.8, combo: ['flowerBite'] }),
      flowerBite: cone('花冠咬合', { range: 250, arc: 1.22, damage: 1, windup: 0.48 }),
      flowerPetals: shape('花瓣五杀', 'lines', { pattern: 'petals', count: 5, range: 260,
        startRadius: 45, width: 56, damage: 0.85, active: 0.8 }),
      flowerClose: shape('捕笼闭合', 'closure', { radius: 175, unparryable: true,
        damage: 1.1, windup: 0.95, active: 0.75, trackTarget: true }),
      flowerArches: shape('根须拱门', 'curves', { count: 2, range: 350, width: 34,
        damage: 0.85, unparryable: true, active: 0.95, delay: 0.5 })
    } },
    14: { style: 'charger', moves: {
      rhinoLong: charge('长角车道', { range: 880, width: 62, speed: 960, damage: 1.05 }),
      rhinoTurn: charge('直角折冲', { range: 580, width: 68, speed: 850, turnAngle: Math.PI / 2,
        combo: e => e.phase === 2 ? ['rhinoTurn', 'rhinoTurn'] : ['rhinoTurn'], chainWindup: 0.42 }),
      rhinoTwin: charge('双轨碾行', { range: 620, width: 62, speed: 780, twinOffset: 147,
        combo: ['rhinoTwin'], chainWindup: 0.45 }),
      rhinoPillars: shape('角柱破土', 'lines', { pattern: 'pillars', count: 5, range: 95,
        width: 48, spacing: 70, damage: 0.85, unparryable: true, active: 1.05, trackTarget: true })
    } },
    15: { style: 'blob', moves: {
      treeSeed: shape('荚果播种', 'nodes', { count: 3, radius: 24, windup: 0.85, active: 0.3, cooldown: 4 }),
      treeLinks: shape('根网连线', 'lines', { pattern: 'nodes', width: 38, damage: 0.8,
        available: hasPods, active: 0.8 }),
      treeClose: shape('多边形收缩', 'lines', { pattern: 'nodeClose', width: 48, damage: 1.05,
        unparryable: true, available: hasPods, active: 0.95 }),
      treeSweep: cone('枝干半圆', { range: 285, arc: Math.PI, damage: 0.95, maxRange: 340 })
    } },
    16: { style: 'charger', moves: {
      blindSwim: shape('潜墨曲游', 'path', { range: 390, damage: 0.85, windup: 0.58, active: 0.85 }),
      blindReplay: shape('根迹回放', 'lines', { pattern: 'path', width: 42, damage: 0.9,
        unparryable: true, available: hasPath, active: 1.15, windup: 0.8 }),
      blindTwin: shape('双纹换位', 'curves', { count: 2, range: 360, width: 38, fakeSecond: true,
        unparryable: true, damage: 0.9, active: 0.9 }),
      blindEcho: shape('回声突袭', 'lines', { pattern: 'path', reverse: true, width: 42,
        unparryable: true, available: hasPath, damage: 1, active: 1.05, windup: 0.72 })
    } },
    17: { style: 'caster', moves: {
      featherBoom: shape('回旋羽刃', 'boomerang', { count: 2, speed: 290, damage: 0.7, active: 0.3 }),
      featherSpiral: shape('螺旋散羽', 'spiral', { count: 10, speed: 175, damage: 0.55,
        windup: 0.85, active: 0.35, cooldown: 1.5 }),
      featherSweep: cone('旋镜扇面', { range: 330, arc: 1.8, damage: 0.85, active: 0.75 }),
      featherRecall: shape('万羽归巢', 'recall', { available: hasFeathers, windup: 0.62,
        active: 0.25, damage: 0.7, cooldown: 2.2 })
    } },
    18: { style: 'caster', moves: {
      totemCross: shape('正交凝视', 'lines', { pattern: 'cross', count: 4, range: 430,
        width: 50, damage: 0.8 }),
      totemRotate: shape('旋眼十字', 'lines', { pattern: 'cross', count: 4, range: 430,
        width: 48, damage: 0.85, combo: ['totemRotate'], chainRotate: Math.PI / 2 }),
      totemGrid: shape('三行网格', 'lines', { pattern: 'grid', count: 3, range: 900,
        width: 64, spacing: 140, damage: 0.8, active: 1.05, trackTarget: true }),
      totemQuadrants: shape('象限落印', 'boxes', { count: 4, size: 190, spacing: 105,
        damage: 0.9, unparryable: true, active: 1.2, trackTarget: true }),
      totemMove: shape('碑身迁移', 'relocate', { range: 240, damage: 0, windup: 0.4,
        active: 0.65, recover: 0.35, cooldown: 3 })
    } },
    19: { style: 'charger', moves: {
      mantisCrescent: cone('斜月斩', { kind: 'crescent', range: 275, innerRange: 80, arc: 1.2,
        clawOffset: 55, clawForward: 35, damage: 0.85, combo: ['mantisCrescent'], chainWindup: 0.32 }),
      mantisX: shape('X 形截线', 'lines', { pattern: 'x', range: 520, width: 36,
        centerGap: 70, storeLines: true, damage: 0.9, trackTarget: true }),
      mantisEcho: shape('残线收刀', 'lines', { pattern: 'stored', width: 36, damage: 0.85,
        available: e => !!(e.storedLines && e.storedLines.length), active: 0.8 }),
      mantisCharge: charge('交叉位移', { range: 520, width: 48, speed: 920, combo: enraged('mantisEcho') }),
      mantisExecute: shape('六肢处刑', 'lines', { pattern: 'grid', count: 3, range: 620,
        width: 38, spacing: 90, damage: 0.8, combo: ['mantisCharge'], trackTarget: true })
    } },
    20: { style: 'blob', moves: {
      motherClaw: cone('终页交替斩', { kind: 'crescent', phases: [1], range: 310, innerRange: 115,
        arc: 1, clawOffset: 60, clawForward: 30, combo: ['motherClaw'] }),
      motherCharge: charge('终页折返', { phases: [1], range: 720, width: 66, returnOffset: 110,
        combo: ['motherCharge'] }),
      motherPounce: leap('终页扑杀', { phases: [1], radius: 115, slide: 80, slideTime: 0.24 }),
      motherSeed: shape('涂改节点', 'nodes', { phases: [2], count: 3, radius: 26, active: 0.3 }),
      motherLinks: shape('终稿根网', 'lines', { phases: [2], pattern: 'nodes', width: 46,
        unparryable: true, available: hasPods }),
      motherClose: shape('终稿收缩', 'lines', { phases: [2], pattern: 'nodeClose', width: 54,
        unparryable: true, available: hasPods, active: 0.95 }),
      motherSweep: cone('母体半圆', { phases: [2], range: 310, arc: Math.PI, damage: 1 }),
      motherPath: shape('终章螺旋', 'path', { phases: [3], range: 430, curve: 220, active: 1 }),
      motherReplay: shape('顺序爆发', 'lines', { phases: [3], pattern: 'path', width: 48,
        unparryable: true, available: hasPath, active: 1.2 }),
      motherRing: shape('终页外环', 'annulus', { phases: [3], innerRange: 130, range: 250,
        unparryable: true, damage: 1.1 }),
      motherX: shape('最终交叉', 'lines', { phases: [3], pattern: 'x', range: 570,
        width: 42, centerGap: 70, damage: 1, trackTarget: true })
    } }
  };

  const controllers = {};
  function profile(e) { return PROFILES[e.stage]; }
  function controllerFor(e) { return controllers[e.stage]; }
  function moveOf(e) { return profile(e).moves[e.attack]; }
  function warningColor(m) { return m.unparryable ? DARK : RED; }
  function phaseRest(e, m) {
    const r = m.rest || rest(0.35, 0.7);
    return (r.min + Math.random() * (r.max - r.min)) * (e.phase === 2 ? 0.82 : 1);
  }
  function parry(e, range) {
    if (player.absorbT <= 0 || distance(e, player) > range + player.absorbRadius) return false;
    hitStopT = Math.max(hitStopT, ABSORB_RULE.hitStop);
    hurtEnemy(e, e.dmg * 1.5 * (player.metaAbsorbMul || 1), 0, player.x, player.y, 0, 0, 0, inkFriendlyColor, false, 'absorb');
    rewardAbsorb(ABSORB_RULE.meleeInk); chargeParry();
    floats.push({ x: player.x, y: player.y - 45, txt: '弹反！', t: 0.7, color: inkFriendlyColor, crit: true });
    sparks.push({ x: e.x, y: e.y, t: 0.24, color: inkFriendlyColor });
    castMeleeInkSurge(); shakeT = Math.max(shakeT, 0.12);
    controllerFor(e).interrupt(e, 'recover', 0.95, CTX);
    return true;
  }
  function hitPlayer(e, m, point) {
    if (m.unparryable && player.absorbT > 0) unparryableFeedback(player.x, player.y);
    hurtPlayer(Math.round(e.dmg * m.damage), 'enemy', e);
    const x = point ? point.x : e.x, y = point ? point.y : e.y, col = warningColor(m);
    novas.push({ x, y, t: 0.24, max: m.radius || 65, col });
    for (let i = 0; i < 10; i++) {
      const a = i / 10 * TAU;
      sparks.push({ x: x + Math.cos(a) * 35, y: y + Math.sin(a) * 35, t: 0.3,
        color: m.unparryable && i % 3 === 0 ? WARN_YELLOW : col });
    }
  }
  function targetsFor(e, m) {
    if (e.standardTargets && e.standardTargetsMove === e.attack) return e.standardTargets;
    const targets = [], count = m.count || 1;
    for (let i = 0; i < count; i++) {
      if (i === 0) targets.push({ x: e.targetX, y: e.targetY });
      else {
        const a = (i - 1) / Math.max(1, count - 1) * TAU + e.id * 0.37, d = 90 + (i % 2) * 45;
        targets.push({ x: clampW(e.targetX + Math.cos(a) * d, m.radius), y: clampH(e.targetY + Math.sin(a) * d, m.radius) });
      }
    }
    return targets;
  }
  function crescentOrigin(e, m) {
    const a = e.faceA || 0, side = e.clawSide || 1;
    return {
      x: e.x + Math.cos(a) * (m.clawForward || 0) - Math.sin(a) * (m.clawOffset || 0) * side,
      y: e.y + Math.sin(a) * (m.clawForward || 0) + Math.cos(a) * (m.clawOffset || 0) * side
    };
  }
  function crescentContains(origin, angle, m, target, radius) {
    const dx = target.x - origin.x, dy = target.y - origin.y, d = Math.hypot(dx, dy), r = radius || 0;
    if (d + r < m.innerRange || d - r > m.range) return false;
    const pad = d > 0 ? Math.asin(Math.min(1, r / d)) : Math.PI;
    return Math.abs(AI.norm(Math.atan2(dy, dx) - angle)) < m.arc / 2 + pad;
  }
  function attackContains(e, m, target, radius) {
    return m.kind === 'crescent'
      ? crescentContains(crescentOrigin(e, m), e.faceA || 0, m, target, radius)
      : coneContains(e, e.faceA || 0, m.range, m.arc, target, radius);
  }
  function resolveCone(e, m) {
    if (e.actionHit) return;
    if (!m.unparryable && player.absorbT > 0 && attackContains(e, m, player, player.absorbRadius) && parry(e, m.range)) return;
    if (attackContains(e, m, player, player.r)) {
      e.actionHit = true;
      if (m.unparryable && player.absorbT > 0) unparryableFeedback(player.x, player.y);
      hurtPlayer(Math.round(e.dmg * m.damage), 'enemy', e);
    }
  }
  function resolveSlam(e, m) {
    if (e.attackResolved) return;
    e.attackResolved = true;
    if (distance(e, player) < m.radius + player.r) hitPlayer(e, m);
    else {
      novas.push({ x: e.x, y: e.y, t: 0.24, max: m.radius, col: warningColor(m) });
      for (let i = 0; i < 10; i++) sparks.push({ x: e.x + Math.cos(i / 10 * TAU) * m.radius * 0.65,
        y: e.y + Math.sin(i / 10 * TAU) * m.radius * 0.65, t: 0.3, color: m.unparryable && i % 3 === 0 ? WARN_YELLOW : warningColor(m) });
    }
    shakeT = Math.max(shakeT, 0.25);
  }
  function resolveTargets(e, m) {
    if (e.attackResolved) return;
    e.attackResolved = true;
    for (const p of targetsFor(e, m)) {
      if (m.ink) addHostileInk(p.x, p.y, 2, m.radius, e.id);
      if (distance(p, player) < m.radius + player.r) hitPlayer(e, m, p);
      else {
        novas.push({ x: p.x, y: p.y, t: 0.24, max: m.radius, col: warningColor(m) });
        for (let i = 0; i < 5; i++) sparks.push({ x: p.x + Math.cos(i / 5 * TAU) * 30, y: p.y + Math.sin(i / 5 * TAU) * 30,
          t: 0.28, color: m.unparryable && i === 0 ? WARN_YELLOW : warningColor(m) });
      }
    }
    shakeT = Math.max(shakeT, 0.2);
  }
  function fireProjectiles(e, m) {
    const count = m.count + (e.phase === 2 && m.kind === 'volley' ? 2 : 0);
    for (let i = 0; i < count; i++) {
      const a = m.kind === 'ring' ? i / count * TAU + e.walk * 0.1 : (e.faceA || 0) + (i - (count - 1) / 2) * 0.16;
      ebullets.push({ x: e.x + Math.cos(a) * (e.r + 10), y: e.y + Math.sin(a) * (e.r + 10),
        vx: Math.cos(a) * m.speed, vy: Math.sin(a) * m.speed, dmg: Math.round(e.dmg * m.damage),
        life: 3.4, sourceId: e.id, reflectable: true });
    }
    shakeT = Math.max(shakeT, 0.12);
  }
  function releaseMinions(e, m) {
    const base = (e.faceA || 0) + Math.PI;
    for (let i = 0; i < m.count; i++) {
      const a = base + (i - (m.count - 1) / 2) * 0.5;
      summonMob(m.mob, e.x + Math.cos(a) * (e.r + 32), e.y + Math.sin(a) * (e.r + 32));
    }
    toast(e.name + ' 使用了 ' + m.name + '！');
  }
  function resolveLeap(e, m) {
    if (e.attackResolved) return;
    e.attackResolved = true;
    const p = { x: e.targetX, y: e.targetY };
    if (distance(p, player) < m.radius + player.r) hitPlayer(e, m, p);
    else novas.push({ x: p.x, y: p.y, t: 0.24, max: m.radius, col: DARK });
    shakeT = Math.max(shakeT, 0.22);
  }

  // 扩展 Boss 共用同一组几何数据生成预警和真实判定，避免两套坐标漂移。
  const seg = (a, b, width, delay = 0, fake = false) => ({ a, b, width, delay, fake });
  function livePods(e) { return enemies.filter(n => n.pod && n.ownerId === e.id && !n.dead); }
  function buildPath(e, m) {
    const a = e.faceA || 0, dx = Math.cos(a), dy = Math.sin(a), side = e.ai.repositionSide || 1;
    const start = { x: e.x, y: e.y }, end = { x: e.targetX, y: e.targetY };
    const bend = m.curve || 120, points = [];
    for (let i = 0; i <= 16; i++) {
      const t = i / 16, q = 1 - t;
      const cx = (start.x + end.x) / 2 - dy * bend * side, cy = (start.y + end.y) / 2 + dx * bend * side;
      points.push({ x: clampW(q * q * start.x + 2 * q * t * cx + t * t * end.x, e.r),
        y: clampH(q * q * start.y + 2 * q * t * cy + t * t * end.y, e.r) });
    }
    e.pathPoints = points;
  }
  function lineSpecs(e, m, progress = 0) {
    if (m.pattern === 'stored') return e.storedLines || [];
    if (m.pattern === 'path') {
      const pts = (e.pathPoints || []).slice(); if (m.reverse) pts.reverse();
      return pts.slice(1).map((p, i) => seg(pts[i], p, m.width, i / Math.max(1, pts.length - 1) * 0.72));
    }
    if (m.pattern === 'nodes' || m.pattern === 'nodeClose') {
      const pods = livePods(e), out = [];
      const center = pods.reduce((p, n) => ({ x: p.x + n.x / pods.length, y: p.y + n.y / pods.length }), { x: 0, y: 0 });
      if (m.pattern === 'nodes') {
        for (let i = 0; i < pods.length; i++) for (let j = i + 1; j < pods.length; j++)
          out.push(seg({ x: pods[i].x, y: pods[i].y }, { x: pods[j].x, y: pods[j].y }, m.width, out.length * 0.08));
      } else {
        pods.forEach((n, i) => {
          const p = { x: n.x + (center.x - n.x) * progress * 0.65, y: n.y + (center.y - n.y) * progress * 0.65 };
          out.push(seg(p, center, m.width, i * 0.08));
        });
      }
      return out;
    }
    const out = [], a = e.faceA || 0, dx = Math.cos(a), dy = Math.sin(a), nx = -dy, ny = dx;
    const target = m.trackTarget ? { x: e.targetX, y: e.targetY } : { x: e.x, y: e.y };
    if (m.pattern === 'x') {
      for (const off of [-Math.PI / 4, Math.PI / 4]) {
        const ax = Math.cos(a + off), ay = Math.sin(a + off), half = m.range / 2, gap = (m.centerGap || 0) / 2;
        out.push(seg({ x: target.x - ax * half, y: target.y - ay * half }, { x: target.x - ax * gap, y: target.y - ay * gap }, m.width));
        out.push(seg({ x: target.x + ax * gap, y: target.y + ay * gap }, { x: target.x + ax * half, y: target.y + ay * half }, m.width));
      }
      return out;
    }
    if (m.pattern === 'pillars' || m.pattern === 'grid') {
      for (let i = 0; i < m.count; i++) {
        const off = (i - (m.count - 1) / 2) * m.spacing;
        const c = { x: target.x + nx * off, y: target.y + ny * off };
        out.push(seg({ x: c.x - dx * m.range / 2, y: c.y - dy * m.range / 2 },
          { x: c.x + dx * m.range / 2, y: c.y + dy * m.range / 2 }, m.width, i / Math.max(1, m.count - 1) * 0.72));
      }
      return out;
    }
    for (let i = 0; i < m.count; i++) {
      const aa = a + i / m.count * TAU + (m.pattern === 'petals' && e.phase === 2 ? Math.PI / 5 : 0);
      const start = m.startRadius || 0;
      out.push(seg({ x: e.x + Math.cos(aa) * start, y: e.y + Math.sin(aa) * start },
        { x: e.x + Math.cos(aa) * m.range, y: e.y + Math.sin(aa) * m.range }, m.width, i / Math.max(1, m.count - 1) * 0.55));
    }
    return out;
  }
  function curveSpecs(e, m) {
    const out = [], a = e.faceA || 0, dx = Math.cos(a), dy = Math.sin(a);
    for (let n = 0; n < m.count; n++) {
      const side = n % 2 ? 1 : -1, points = [];
      for (let i = 0; i <= 16; i++) {
        const t = i / 16, q = 1 - t;
        const sx = e.x, sy = e.y, ex = e.x + dx * m.range, ey = e.y + dy * m.range;
        const cx = (sx + ex) / 2 - dy * m.range * 0.55 * side, cy = (sy + ey) / 2 + dx * m.range * 0.55 * side;
        points.push({ x: q * q * sx + 2 * q * t * cx + t * t * ex, y: q * q * sy + 2 * q * t * cy + t * t * ey });
      }
      out.push({ points, fake: !!(m.fakeSecond && n === 1) });
    }
    return out;
  }
  function boxSpecs(e, m) {
    const out = [];
    for (let i = 0; i < m.count; i++) {
      const x = e.targetX + (i % 2 ? 1 : -1) * m.spacing, y = e.targetY + (i > 1 ? 1 : -1) * m.spacing;
      out.push({ x, y, size: m.size, delay: [0, 2, 1, 3][i] * 0.2 });
    }
    return out;
  }
  function resolveAnnulus(e, m, progress) {
    if (e.attackResolved || progress < 0.32) return;
    e.attackResolved = true;
    const d = distance(e, player);
    if (d + player.r >= m.innerRange && d - player.r <= m.range) hitPlayer(e, m);
    else { novas.push({ x: e.x, y: e.y, t: 0.3, max: m.range, col: warningColor(m) }); shakeT = Math.max(shakeT, 0.22); }
  }
  function resolveClosure(e, m, progress) {
    if (e.attackResolved || progress < 0.72) return;
    e.attackResolved = true;
    const r = m.radius * (1 - progress * 0.65), p = { x: e.targetX, y: e.targetY };
    if (distance(p, player) < r + player.r) hitPlayer(e, m, p);
    else novas.push({ x: p.x, y: p.y, t: 0.25, max: r, col: DARK });
  }
  function resolveLines(e, m, progress) {
    if (e.actionHit) return;
    if (!e.resolvedLines) e.resolvedLines = new Set();
    const specs = lineSpecs(e, m, progress);
    specs.forEach((s, i) => {
      if (e.actionHit || s.fake || progress + 0.0001 < s.delay || e.resolvedLines.has(i)) return;
      e.resolvedLines.add(i);
      if (!m.unparryable && player.absorbT > 0 && AI.pointSegmentDistance(player, s.a, s.b) < s.width / 2 + player.absorbRadius) {
        parry(e, distance(e, player) + 10); return;
      }
      if (AI.pointSegmentDistance(player, s.a, s.b) < s.width / 2 + player.r) {
        e.actionHit = true; hitPlayer(e, m, { x: player.x, y: player.y });
      }
    });
  }
  function resolveBoxes(e, m, progress) {
    if (!e.resolvedLines) e.resolvedLines = new Set();
    boxSpecs(e, m).forEach((b, i) => {
      if (e.resolvedLines.has(i) || progress < b.delay) return;
      e.resolvedLines.add(i);
      if (Math.abs(player.x - b.x) < b.size / 2 + player.r && Math.abs(player.y - b.y) < b.size / 2 + player.r)
        hitPlayer(e, m, { x: b.x, y: b.y });
    });
  }
  function resolveCurves(e, m, progress) {
    if (e.actionHit || progress < (m.delay || 0) / Math.max(0.001, m.active)) return;
    for (const curve of curveSpecs(e, m)) {
      if (curve.fake) continue;
      for (let i = 1; i < curve.points.length; i++) {
        if (AI.pointSegmentDistance(player, curve.points[i - 1], curve.points[i]) >= m.width / 2 + player.r) continue;
        if (!m.unparryable && player.absorbT > 0) { parry(e, distance(e, player) + 10); return; }
        e.actionHit = true; hitPlayer(e, m, { x: player.x, y: player.y }); return;
      }
    }
  }
  function spawnPods(e, m) {
    livePods(e).forEach(n => { n.dead = true; });
    for (let i = 0; i < m.count; i++) {
      const a = i / m.count * TAU + (e.faceA || 0), x = clampW(e.targetX + Math.cos(a) * 135, 28), y = clampH(e.targetY + Math.sin(a) * 135, 28);
      const n = summonMob('spider', x, y); if (!n) continue;
      n.type = 'pod'; n.pod = true; n.ownerId = e.id; n.name = '荚果节点'; n.r = m.radius;
      n.hp = n.maxhp = Math.max(300, e.maxhp * 0.045); n.sp = 0; n.dmg = 0; n.xp = 0;
      n.stunT = 99999; n.kbx = n.kby = 0; n.hexapod = null;
    }
  }
  function fireExpansionProjectiles(e, m) {
    for (let i = 0; i < m.count; i++) {
      const a = (e.faceA || 0) + (m.kind === 'spiral' ? i / m.count * TAU : (i ? 0.55 : -0.55));
      ebullets.push({ x: e.x + Math.cos(a) * (e.r + 8), y: e.y + Math.sin(a) * (e.r + 8),
        vx: Math.cos(a) * m.speed, vy: Math.sin(a) * m.speed, dmg: Math.round(e.dmg * m.damage),
        life: m.kind === 'spiral' ? 3.8 : 3.2, sourceId: e.id, reflectable: true, feather: true,
        bossProjectile: m.kind, age: 0, baseAngle: a, originX: e.x, originY: e.y, outTime: 0.75 });
    }
  }
  function recallFeathers(e) {
    for (const b of ebullets) if (b.sourceId === e.id && b.feather && !b.inkConverted) {
      b.returning = true; b.life = Math.max(b.life, 1.8);
    }
  }
  function updateProjectile(b, dt) {
    if (!b.bossProjectile || b.inkConverted) return false;
    b.age += dt;
    if (b.bossProjectile === 'spiral') {
      const r = Math.hypot(b.vx, b.vy) * b.age, a = b.baseAngle + b.age * 2.8;
      const nx = b.originX + Math.cos(a) * r, ny = b.originY + Math.sin(a) * r;
      b.vx = (nx - b.x) / Math.max(0.001, dt); b.vy = (ny - b.y) / Math.max(0.001, dt); b.x = nx; b.y = ny;
      return true;
    }
    if (b.age >= b.outTime || b.returning) {
      const owner = enemies.find(e => e.id === b.sourceId && !e.dead);
      if (owner) {
        const a = angleTo(b, owner), speed = Math.max(290, Math.hypot(b.vx, b.vy));
        b.vx = Math.cos(a) * speed; b.vy = Math.sin(a) * speed;
      }
    }
    b.x += b.vx * dt; b.y += b.vy * dt; return true;
  }

  function hooks() {
    return {
      aim(e, ctx, m, opts) {
        const previousDx = e.lockDx, previousDy = e.lockDy;
        const previousFaceA = Number.isFinite(e.faceA) ? e.faceA : angleTo(e, player);
        if (!['slam', 'ring', 'summon'].includes(m.kind)) e.faceA = angleTo(e, player);
        if (opts.chained && m.chainRotate) e.faceA = previousFaceA + m.chainRotate;
        e.targetX = player.x; e.targetY = player.y;
        e.attackStartX = e.x; e.attackStartY = e.y;
        e.lockDx = Math.cos(e.faceA || 0); e.lockDy = Math.sin(e.faceA || 0);
        e.standardTargets = null; e.standardTargetsMove = null;
        e.chargeShiftX = null; e.chargeShiftY = null; e.resolvedLines = new Set();
        e.chargeFixed = m.kind === 'charge' && opts.chained && !!(m.returnOffset || m.twinOffset || m.turnAngle);
        if (m.kind === 'crescent') {
          e.clawSide = opts.chained ? -(e.clawSide || 1) : (e.feralNextClaw || 1);
          e.feralNextClaw = -e.clawSide;
        }
        if (m.kind === 'path') buildPath(e, m);
        if (m.kind === 'flank') {
          e.flankTargetX = player.x; e.flankTargetY = player.y;
          e.flankRadius = Math.max(80, distance(e, player));
          e.flankBaseA = angleTo(player, e);
          e.flankSide = e.ai.repositionSide || 1;
        }
        if (m.kind === 'charge' && (m.returnOffset || m.twinOffset || m.turnAngle)) {
          if (opts.chained) {
            const dx = m.turnAngle ? (previousDx || 1) : (e.chargeRootDx || 1);
            const dy = m.turnAngle ? (previousDy || 0) : (e.chargeRootDy || 0);
            const side = e.chargeReturnSide || (e.ai.repositionSide || 1);
            if (m.turnAngle) {
              e.faceA = Math.atan2(dy, dx) + m.turnAngle * side;
            } else {
              e.faceA = Math.atan2(m.returnOffset ? -dy : dy, m.returnOffset ? -dx : dx);
              const offset = m.returnOffset || m.twinOffset;
              e.chargeMoveStartX = e.x; e.chargeMoveStartY = e.y;
              e.chargeShiftX = clampW(e.x - dy * offset * side, e.r);
              e.chargeShiftY = clampH(e.y + dx * offset * side, e.r);
            }
            e.lockDx = Math.cos(e.faceA); e.lockDy = Math.sin(e.faceA);
          } else {
            e.chargeRootX = e.x; e.chargeRootY = e.y;
            e.chargeRootDx = e.lockDx; e.chargeRootDy = e.lockDy;
            e.chargeReturnSide = e.ai.repositionSide || 1;
          }
        }
      },
      track(e, ctx, dt, m) {
        if (['slam', 'ring', 'summon'].includes(m.kind)) return;
        if (m.kind === 'charge' && e.chargeShiftX !== null) {
          const p = clamp(1 - e.huntT / Math.max(0.001, e.windupDuration), 0, 1);
          const ease = p * p * (3 - 2 * p);
          e.x = e.chargeMoveStartX + (e.chargeShiftX - e.chargeMoveStartX) * ease;
          e.y = e.chargeMoveStartY + (e.chargeShiftY - e.chargeMoveStartY) * ease;
        } else if (m.kind === 'flank') {
          const p = clamp(1 - (e.huntT - m.lockTime) / Math.max(0.001, e.windupDuration - m.lockTime), 0, 1);
          const a = e.flankBaseA + e.flankSide * m.flankDistance / e.flankRadius * p;
          e.x = clampW(e.flankTargetX + Math.cos(a) * e.flankRadius, e.r);
          e.y = clampH(e.flankTargetY + Math.sin(a) * e.flankRadius, e.r);
          turnToward(e, angleTo(e, { x: e.flankTargetX, y: e.flankTargetY }), dt * 5);
        } else if (!(m.kind === 'charge' && e.chargeFixed)) {
          turnToward(e, angleTo(e, player), dt * (m.kind === 'charge' ? 1.9 : 2.6));
        }
        e.lockDx = Math.cos(e.faceA || 0); e.lockDy = Math.sin(e.faceA || 0);
        if (['leap', 'meteor'].includes(m.kind) || m.trackTarget || m.kind === 'path') {
          e.targetX = player.x; e.targetY = player.y; e.standardTargets = null;
          if (m.kind === 'path') buildPath(e, m);
        }
      },
      lock(e, ctx, m) {
        if (m.kind === 'charge' && e.chargeShiftX !== null) { e.x = e.chargeShiftX; e.y = e.chargeShiftY; }
        if (m.kind === 'flank') {
          const a = e.flankBaseA + e.flankSide * m.flankDistance / e.flankRadius;
          e.x = clampW(e.flankTargetX + Math.cos(a) * e.flankRadius, e.r);
          e.y = clampH(e.flankTargetY + Math.sin(a) * e.flankRadius, e.r);
          e.faceA = angleTo(e, { x: e.flankTargetX, y: e.flankTargetY });
        }
        if (m.kind === 'path') buildPath(e, m);
        e.lockDx = Math.cos(e.faceA || 0); e.lockDy = Math.sin(e.faceA || 0);
        e.attackStartX = e.x; e.attackStartY = e.y; e.resolvedLines = new Set();
        if (m.kind === 'meteor') { e.standardTargets = targetsFor(e, m); e.standardTargetsMove = e.attack; }
        if (m.storeLines) e.storedLines = lineSpecs(e, m, 0);
      },
      beginActive(e, ctx, m) {
        e.attackStartX = e.x; e.attackStartY = e.y; e.slideHit = false; e.resolvedLines = new Set(); e.pathInkIndex = -1;
        if (m.kind === 'volley' || m.kind === 'ring') fireProjectiles(e, m);
        else if (m.kind === 'meteor') resolveTargets(e, m);
        else if (m.kind === 'summon') releaseMinions(e, m);
        else if (m.kind === 'nodes') spawnPods(e, m);
        else if (m.kind === 'boomerang' || m.kind === 'spiral') fireExpansionProjectiles(e, m);
        else if (m.kind === 'recall') recallFeathers(e);
      },
      active(e, ctx, dt, m) {
        const progress = clamp(1 - e.huntT / e.activeDuration, 0, 1);
        if (m.kind === 'cone' || m.kind === 'crescent' || m.kind === 'flank') resolveCone(e, m);
        else if (m.kind === 'slam' && progress > 0.36) resolveSlam(e, m);
        else if (m.kind === 'meteor') resolveTargets(e, m);
        else if (m.kind === 'annulus') resolveAnnulus(e, m, progress);
        else if (m.kind === 'closure') resolveClosure(e, m, progress);
        else if (m.kind === 'lines') resolveLines(e, m, progress);
        else if (m.kind === 'boxes') resolveBoxes(e, m, progress);
        else if (m.kind === 'curves') resolveCurves(e, m, progress);
        else if (m.kind === 'path') {
          const pts = e.pathPoints || [];
          if (pts.length > 1) {
            const f = progress * (pts.length - 1), i = Math.min(pts.length - 2, Math.floor(f)), t = f - i;
            const a = pts[i], b = pts[i + 1], oldX = e.x, oldY = e.y;
            e.x = a.x + (b.x - a.x) * t; e.y = a.y + (b.y - a.y) * t;
            e.faceA = Math.atan2(b.y - a.y, b.x - a.x); e.lockDx = Math.cos(e.faceA); e.lockDy = Math.sin(e.faceA);
            if (i !== e.pathInkIndex) { e.pathInkIndex = i; addHostileInk(e.x, e.y, 2.5, 28, e.id); }
            if (!e.actionHit && distance(e, player) < e.r + player.r + 12) {
              if (player.absorbT > 0 && parry(e, e.r + 30)) return;
              e.actionHit = true; hurtPlayer(Math.round(e.dmg * m.damage), 'enemy', e);
            }
            if (!Number.isFinite(e.x) || !Number.isFinite(e.y)) { e.x = oldX; e.y = oldY; }
          }
        }
        else if (m.kind === 'relocate') {
          e.x = e.attackStartX + (e.targetX - e.attackStartX) * progress;
          e.y = e.attackStartY + (e.targetY - e.attackStartY) * progress;
        }
        else if (m.kind === 'charge') {
          if (!m.unparryable && player.absorbT > 0 && distance(e, player) < e.r + player.absorbRadius + 18 && parry(e, e.r + 28)) return;
          const nx = clampW(e.x + e.lockDx * m.speed * dt, e.r), ny = clampH(e.y + e.lockDy * m.speed * dt, e.r);
          if (Math.abs(nx - e.x) < 0.001 && Math.abs(ny - e.y) < 0.001) e.huntT = 0;
          e.x = nx; e.y = ny;
          if (!e.actionHit && distance(e, player) < e.r + player.r + m.width * 0.3) {
            e.actionHit = true;
            if (m.unparryable && player.absorbT > 0) unparryableFeedback(player.x, player.y);
            hurtPlayer(Math.round(e.dmg * m.damage), 'enemy', e);
          }
        } else if (m.kind === 'leap') {
          const airTime = m.slide ? m.active - m.slideTime : m.active;
          const airProgress = clamp(progress * m.active / airTime, 0, 1);
          e.x = e.attackStartX + (e.targetX - e.attackStartX) * airProgress;
          e.y = e.attackStartY + (e.targetY - e.attackStartY) * airProgress;
          e.pounceHeight = Math.sin(airProgress * Math.PI) * 52;
          if (airProgress >= 1) {
            resolveLeap(e, m);
            if (m.slide) {
              const slideP = clamp((progress * m.active - airTime) / m.slideTime, 0, 1);
              const slideStart = { x: e.targetX, y: e.targetY };
              e.x = clampW(e.targetX + e.lockDx * m.slide * slideP, e.r);
              e.y = clampH(e.targetY + e.lockDy * m.slide * slideP, e.r);
              if (!e.slideHit && AI.pointSegmentDistance(player, slideStart, e) < m.radius * 0.55 + player.r) {
                e.slideHit = true; hitPlayer(e, m, { x: e.x, y: e.y });
              }
            }
          }
        }
      },
      finishActive(e, ctx, m) {
        if (m.kind === 'leap') {
          e.x = clampW(e.targetX + (m.slide ? e.lockDx * m.slide : 0), e.r);
          e.y = clampH(e.targetY + (m.slide ? e.lockDy * m.slide : 0), e.r);
          e.pounceHeight = 0; resolveLeap(e, m);
        }
      },
      chase(e, ctx, dt) {
        const pa = angleTo(e, player), d = distance(e, player), style = profile(e).style;
        turnToward(e, pa, dt * 3.2);
        const ideal = style === 'caster' ? 310 : style === 'blob' ? 235 : 175;
        let dir = 0;
        if (d > ideal + 45) dir = 1; else if (d < ideal - 65) dir = -0.7;
        if (dir) {
          e.x = clampW(e.x + Math.cos(pa) * e.sp * dir * dt, e.r);
          e.y = clampH(e.y + Math.sin(pa) * e.sp * dir * dt, e.r);
        }
      },
      reposition(e, ctx, dt) {
        const pa = angleTo(e, player), a = pa + (e.ai.repositionSide || 1) * Math.PI / 2;
        turnToward(e, pa, dt * 4);
        e.x = clampW(e.x + Math.cos(a) * 150 * dt, e.r);
        e.y = clampH(e.y + Math.sin(a) * 150 * dt, e.r);
      },
      shouldReposition(e, ctx, m) { return m && !['slam', 'summon'].includes(m.kind) && Math.random() < 0.3; },
      nextDelay(e, ctx, m) { return phaseRest(e, m); },
      shouldFatigue: (e, ctx, count) => count >= (e.stage === 10 ? 7 : 5),
      fatigueDuration: e => e.stage === 10 ? 2.4 : 2.8,
      fatigued(e) { toast(e.name + ' 招式用尽，露出了破绽！'); shakeT = Math.max(shakeT, 0.18); },
      beforeUpdate(e, ctx, dt) {
        if (e.phase === 1 && e.hp < e.maxhp * (player.metaBossPhaseAt || 0.5)) {
          e.phase = 2; e.sp *= 1.12; crumpleT = 0.7; shakeT = 0.45;
          toast(e.name + ' 暴走了：招式派生与攻击节奏强化！');
        } else if (e.stage === 20 && e.phase === 2 && e.hp < e.maxhp * 0.33) {
          e.phase = 3; e.sp *= 1.08; crumpleT = 0.8; shakeT = 0.5;
          livePods(e).forEach(n => { n.dead = true; });
          toast('终页·混生母体进入终章：路径将按顺序爆发！');
        }
        e.walk += dt * (e.huntMode === 'chase' || e.huntMode === 'reposition' ? 4 : 1.4);
      }
    };
  }
  for (const [stage, p] of Object.entries(PROFILES)) controllers[stage] = AI.createController({ moves: p.moves, hooks: hooks() });

  function init(e) {
    if (!PROFILES[e.stage]) return;
    e.huntBoss = true; e.bossAI = 'standard'; e.faceA = angleTo(e, player);
    e.attack = null; e.pounceHeight = 0; e.standardTargets = null;
    controllerFor(e).init(e, CTX, 1);
  }
  function update(e, dt) {
    if (!e.huntBoss || e.bossAI !== 'standard' || !profile(e)) return false;
    controllerFor(e).update(e, CTX, dt); return true;
  }
  function drawSector(e, m, active) {
    const a = e.faceA || 0, a0 = a - m.arc / 2, a1 = a + m.arc / 2, col = active ? RED : ENEMY_AIM;
    ctx.save(); ctx.globalAlpha = active ? 0.16 : 0.24; ctx.fillStyle = col;
    if (active) { ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.arc(e.x, e.y, m.range, a0, a1); ctx.closePath(); ctx.fill(); }
    ctx.globalAlpha = active ? 0.92 : 0.48;
    for (const edge of [a0, a1]) jline(e.x, e.y, e.x + Math.cos(edge) * m.range, e.y + Math.sin(edge) * m.range, col, active ? 3.5 : 1.7);
    const sweep = active ? Math.max(0.12, (1 - e.huntT / e.activeDuration) * m.arc) : m.arc;
    for (let band = 0; band < (active ? 3 : 1); band++) {
      const rr = m.range * (active ? 0.65 + band * 0.15 : 1);
      for (let i = 0; i < 16; i++) {
        const aa = a0 + sweep * i / 16, bb = a0 + sweep * (i + 1) / 16;
        jline(e.x + Math.cos(aa) * rr, e.y + Math.sin(aa) * rr, e.x + Math.cos(bb) * rr, e.y + Math.sin(bb) * rr, col, active ? 4 : 1.7);
      }
    }
    ctx.restore();
  }
  function drawCrescent(e, m, active) {
    const o = crescentOrigin(e, m), a = e.faceA || 0, a0 = a - m.arc / 2, a1 = a + m.arc / 2;
    const col = active ? RED : ENEMY_AIM;
    ctx.save();
    if (active) {
      ctx.globalAlpha = 0.2; ctx.fillStyle = col; ctx.beginPath();
      ctx.arc(o.x, o.y, m.range, a0, a1); ctx.arc(o.x, o.y, m.innerRange, a1, a0, true); ctx.closePath(); ctx.fill();
    }
    ctx.globalAlpha = active ? 0.95 : 0.58;
    for (const edge of [a0, a1]) {
      jline(o.x + Math.cos(edge) * m.innerRange, o.y + Math.sin(edge) * m.innerRange,
        o.x + Math.cos(edge) * m.range, o.y + Math.sin(edge) * m.range, col, active ? 3.5 : 1.8);
    }
    const sweep = active ? Math.max(0.12, (1 - e.huntT / e.activeDuration) * m.arc) : m.arc;
    for (let band = 0; band < (active ? 3 : 2); band++) {
      const rr = active ? m.innerRange + (m.range - m.innerRange) * (0.25 + band * 0.3) : (band ? m.range : m.innerRange);
      for (let i = 0; i < 12; i++) {
        const aa = a0 + sweep * i / 12, bb = a0 + sweep * (i + 1) / 12;
        jline(o.x + Math.cos(aa) * rr, o.y + Math.sin(aa) * rr,
          o.x + Math.cos(bb) * rr, o.y + Math.sin(bb) * rr, col, active ? 4 : 1.8);
      }
    }
    ctx.restore();
  }
  function drawCircle(e, m, x, y, active, showLabel = true) {
    const r = m.radius;
    if (m.unparryable) drawUnparryableCircleArea(x, y, r, active);
    ctx.save(); ctx.globalAlpha = active ? 0.17 : 0.26; ctx.fillStyle = warningColor(m);
    if (active) { ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); }
    ctx.globalAlpha = active ? 0.95 : 0.68;
    jcircle(x, y, r, active ? warningColor(m) : (m.unparryable ? DARK : ENEMY_AIM), active ? 4.5 : 2);
    if (active) jcircle(x, y, r * 0.65, m.unparryable ? WARN_YELLOW : RED, 2.5);
    if (m.unparryable) { drawUnparryableMark(x, y, 11); if (!active && showLabel) drawDiveOnlyLabel({ x, y, r: 0 }); }
    ctx.restore();
  }
  function drawPounce(e, m, active) {
    drawCircle(e, m, e.targetX, e.targetY, active);
    if (!m.slide) return;
    const start = { x: e.targetX, y: e.targetY };
    const end = { x: e.targetX + e.lockDx * m.slide, y: e.targetY + e.lockDy * m.slide };
    drawUnparryableSegmentArea(start, end, m.radius * 1.1, active);
    ctx.save(); ctx.globalAlpha = active ? 0.95 : 0.65;
    jline(start.x, start.y, end.x, end.y, WARN_YELLOW, active ? 3 : 1.6);
    jline(end.x - e.lockDy * 18, end.y + e.lockDx * 18, end.x, end.y, DARK, 3);
    jline(end.x + e.lockDy * 18, end.y - e.lockDx * 18, end.x, end.y, DARK, 3);
    ctx.restore();
  }
  function drawCharge(e, m, active) {
    const preview = !active && e.chargeShiftX !== null && e.chargeShiftX !== undefined;
    const start = preview ? { x: e.chargeShiftX, y: e.chargeShiftY } : { x: e.x, y: e.y };
    const a = e.faceA || 0, end = facePoint(start, a, m.range);
    if (m.unparryable) drawUnparryableSegmentArea(start, end, m.width, active);
    ctx.save(); ctx.globalAlpha = active ? 0.9 : 0.78;
    for (let d = e.r + 12; d < m.range; d += 42) {
      const p0 = facePoint(start, a, d), p1 = facePoint(start, a, d + 24);
      jline(p0.x, p0.y, p1.x, p1.y, m.unparryable ? DARK : (active ? RED : ENEMY_AIM), active ? 4 : 3);
    }
    if (preview) {
      ctx.globalAlpha = 0.7;
      jline(e.x, e.y, start.x, start.y, ENEMY_AIM, 2);
      jcircle(start.x, start.y, e.r + 8, ENEMY_AIM, 1.5);
    }
    if (m.unparryable) { jline(start.x, start.y, end.x, end.y, WARN_YELLOW, active ? 3 : 1.5); drawUnparryableMark(end.x, end.y, 12); }
    ctx.restore();
  }
  function drawProjectiles(e, m, active) {
    const count = m.count + (e.phase === 2 && m.kind === 'volley' ? 2 : 0);
    ctx.save(); ctx.globalAlpha = active ? 0.85 : 0.38;
    for (let i = 0; i < count; i++) {
      const a = m.kind === 'ring' || m.kind === 'spiral' ? i / count * TAU + (m.kind === 'ring' ? e.walk * 0.1 : e.faceA || 0)
        : m.kind === 'boomerang' ? (e.faceA || 0) + (i ? 0.55 : -0.55)
        : (e.faceA || 0) + (i - (count - 1) / 2) * 0.16;
      const p0 = facePoint(e, a, e.r + 15), p1 = facePoint(e, a, e.r + 70);
      jline(p0.x, p0.y, p1.x, p1.y, active ? RED : ENEMY_AIM, active ? 3 : 1.6);
    }
    ctx.restore();
  }
  function drawSummon(e, active) {
    ctx.save(); ctx.globalAlpha = active ? 0.8 : 0.38;
    for (let i = 0; i < 3; i++) {
      const a = (e.faceA || 0) + Math.PI + (i - 1) * 0.55, p = facePoint(e, a, e.r + 34);
      jcircle(p.x, p.y, 17, active ? RED : ENEMY_AIM, 1.8);
    }
    ctx.restore();
  }
  function drawFlank(e, m, active) {
    drawSector(e, m, active);
    if (active) return;
    ctx.save(); ctx.globalAlpha = 0.62;
    jcircle(e.flankTargetX, e.flankTargetY, 13, ENEMY_AIM, 1.8);
    let prev = { x: e.x, y: e.y };
    for (let i = 1; i <= 10; i++) {
      const a = e.flankBaseA + e.flankSide * m.flankDistance / e.flankRadius * (i / 10);
      const p = { x: e.flankTargetX + Math.cos(a) * e.flankRadius, y: e.flankTargetY + Math.sin(a) * e.flankRadius };
      jline(prev.x, prev.y, p.x, p.y, ENEMY_AIM, 1.5); prev = p;
    }
    ctx.restore();
  }
  function drawAnnulus(e, m, active) {
    ctx.save();
    if (active) {
      ctx.globalAlpha = 0.25; ctx.fillStyle = m.unparryable ? DARK : RED; ctx.beginPath();
      ctx.arc(e.x, e.y, m.range, 0, TAU); ctx.arc(e.x, e.y, m.innerRange, 0, TAU, true); ctx.fill();
    }
    ctx.globalAlpha = active ? 0.95 : 0.65;
    jcircle(e.x, e.y, m.range, m.unparryable ? DARK : (active ? RED : ENEMY_AIM), active ? 5 : 2.2);
    jcircle(e.x, e.y, m.innerRange, m.unparryable ? WARN_YELLOW : ENEMY_AIM, active ? 3.5 : 1.8);
    if (m.unparryable) drawUnparryableMark(e.x, e.y + (m.range + m.innerRange) / 2, 11);
    ctx.restore();
  }
  function drawLines(e, m, active) {
    const progress = active ? clamp(1 - e.huntT / e.activeDuration, 0, 1) : 0;
    const specs = lineSpecs(e, m, progress);
    ctx.save();
    specs.forEach(s => {
      const fired = active && progress >= s.delay, col = s.fake ? '#8f8a80' : (m.unparryable ? DARK : (fired ? RED : ENEMY_AIM));
      ctx.globalAlpha = s.fake ? 0.25 : (active ? (fired ? 0.95 : 0.25) : 0.82);
      if (m.unparryable && !s.fake) drawUnparryableSegmentArea(s.a, s.b, s.width, fired);
      jline(s.a.x, s.a.y, s.b.x, s.b.y, col, fired ? Math.max(4, s.width * 0.12) : 3.2);
      if (m.unparryable && !s.fake) jline(s.a.x, s.a.y, s.b.x, s.b.y, WARN_YELLOW, fired ? 2.5 : 1.2);
    });
    ctx.restore();
  }
  function drawBoxes(e, m, active) {
    const progress = active ? clamp(1 - e.huntT / e.activeDuration, 0, 1) : 0;
    ctx.save();
    boxSpecs(e, m).forEach(b => {
      const fired = active && progress >= b.delay;
      ctx.globalAlpha = fired ? 0.28 : 0.55; ctx.fillStyle = DARK;
      if (fired) ctx.fillRect(b.x - b.size / 2, b.y - b.size / 2, b.size, b.size);
      jrect(b.x - b.size / 2, b.y - b.size / 2, b.size, b.size, fired ? WARN_YELLOW : DARK, fired ? 4 : 2);
      drawUnparryableMark(b.x, b.y, 10);
    });
    ctx.restore();
  }
  function drawCurves(e, m, active) {
    ctx.save();
    for (const curve of curveSpecs(e, m)) {
      ctx.globalAlpha = curve.fake ? 0.22 : (active ? 0.92 : 0.8);
      for (let i = 1; i < curve.points.length; i++) {
        const a = curve.points[i - 1], b = curve.points[i];
        const col = curve.fake ? '#8f8a80' : (m.unparryable ? DARK : (active ? RED : ENEMY_AIM));
        jline(a.x, a.y, b.x, b.y, col, active ? Math.max(4, m.width * 0.12) : 3);
        if (m.unparryable && !curve.fake && i % 3 === 0) jline(a.x, a.y, b.x, b.y, WARN_YELLOW, 1.4);
      }
    }
    ctx.restore();
  }
  function drawNodes(e, m, active) {
    ctx.save(); ctx.globalAlpha = active ? 0.85 : 0.5;
    for (let i = 0; i < m.count; i++) {
      const a = i / m.count * TAU + (e.faceA || 0);
      const x = e.targetX + Math.cos(a) * 135, y = e.targetY + Math.sin(a) * 135;
      jcircle(x, y, m.radius, ENEMY_AIM, active ? 3 : 1.8);
      jline(x - 8, y, x + 8, y, ENEMY_AIM, 1.5);
    }
    ctx.restore();
  }
  function drawPath(e, m, active) {
    const pts = e.pathPoints || []; if (pts.length < 2) return;
    ctx.save(); ctx.globalAlpha = active ? 0.9 : 0.8;
    for (let i = 1; i < pts.length; i++) jline(pts[i - 1].x, pts[i - 1].y, pts[i].x, pts[i].y,
      active ? RED : ENEMY_AIM, active ? 3.5 : 3);
    ctx.restore();
  }
  function drawRecall(e, active) {
    ctx.save(); ctx.globalAlpha = active ? 0.85 : 0.42;
    for (const b of ebullets) if (b.sourceId === e.id && b.feather && b.life > 0)
      jline(b.x, b.y, e.x, e.y, active ? RED : ENEMY_AIM, active ? 3 : 1.5);
    ctx.restore();
  }
  function drawTelegraph(e) {
    const m = moveOf(e), active = e.huntMode === 'active';
    if (e.huntMode === 'reposition') { ctx.save(); ctx.globalAlpha = 0.2; jcircle(e.x, e.y, e.r + 13, ENEMY_AIM, 1.5); ctx.restore(); return; }
    if (!m || (e.huntMode !== 'windup' && !active)) return;
    if (m.kind === 'cone') drawSector(e, m, active);
    else if (m.kind === 'crescent') drawCrescent(e, m, active);
    else if (m.kind === 'flank') drawFlank(e, m, active);
    else if (m.kind === 'slam') drawCircle(e, m, e.x, e.y, active);
    else if (m.kind === 'leap') drawPounce(e, m, active);
    else if (m.kind === 'meteor') targetsFor(e, m).forEach((p, i) => drawCircle(e, m, p.x, p.y, active, i === 0));
    else if (m.kind === 'charge') drawCharge(e, m, active);
    else if (m.kind === 'annulus') drawAnnulus(e, m, active);
    else if (m.kind === 'closure') {
      const p = active ? clamp(1 - e.huntT / e.activeDuration, 0, 1) : 0;
      drawCircle(e, Object.assign({}, m, { radius: m.radius * (1 - p * 0.65) }), e.targetX, e.targetY, active);
    }
    else if (m.kind === 'lines') drawLines(e, m, active);
    else if (m.kind === 'boxes') drawBoxes(e, m, active);
    else if (m.kind === 'curves') drawCurves(e, m, active);
    else if (m.kind === 'nodes') drawNodes(e, m, active);
    else if (m.kind === 'path') drawPath(e, m, active);
    else if (m.kind === 'recall') drawRecall(e, active);
    else if (m.kind === 'relocate') {
      ctx.save(); ctx.globalAlpha = 0.45; jline(e.x, e.y, e.targetX, e.targetY, ENEMY_AIM, 2); ctx.restore();
    }
    else if (m.kind === 'volley' || m.kind === 'ring' || m.kind === 'boomerang' || m.kind === 'spiral') drawProjectiles(e, m, active);
    else if (m.kind === 'summon') drawSummon(e, active);
  }
  function drawAttachments(e) {
    const m = moveOf(e);
    if (!m || e.huntMode !== 'active') return;
    if (m.kind === 'charge') {
      const nx = -e.lockDy, ny = e.lockDx;
      for (let i = 0; i < 7; i++) {
        const side = (i - 3) * 15, x = e.x + nx * side, y = e.y + ny * side;
        jline(x, y, x - e.lockDx * 65, y - e.lockDy * 65, m.unparryable && i === 3 ? WARN_YELLOW : warningColor(m), 3);
      }
    }
  }
  function drawHUD(e, bx, by) {
    if (!e.huntBoss || e.bossAI !== 'standard') return;
    const labels = { chase: '观察站位', reposition: '侧向换位', windup: '前摇', active: '出手', recover: '收招破绽', comboWait: '连段蓄势', fatigue: '疲惫大破绽' };
    const m = moveOf(e);
    ctx.textAlign = 'left'; ctx.font = 'bold 9px ' + FONT; ctx.fillStyle = e.huntMode === 'fatigue' ? PURPLE : DARK;
    ctx.fillText((m ? m.name + ' · ' : '') + (labels[e.huntMode] || '招式重整'), bx, by + 26);
  }

  globalThis.BossStandardRuntime = {
    PROFILES, init, update, drawTelegraph, drawAttachments, drawHUD,
    onDamage() {},
    chooseAttack: e => controllerFor(e).choose(e, CTX),
    startAttack: (e, kind, chained) => controllerFor(e).start(e, kind, CTX, { chained: !!chained }),
    finishMove: e => controllerFor(e).finishMove(e, CTX),
    updateProjectile,
    debugCandidates: e => controllerFor(e).candidates(e, CTX).map(m => m.id),
    debugLines: (e, kind, progress = 0) => lineSpecs(e, PROFILES[e.stage].moves[kind], progress),
    debugCurves: (e, kind) => curveSpecs(e, PROFILES[e.stage].moves[kind]),
    debugPods: e => livePods(e)
  };
})();

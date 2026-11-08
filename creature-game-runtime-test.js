// 正式战斗接入：29 个角色逐个生成、运动、绘制，并验证战斗参数不被外观层修改
const files = [
  'battle-config.js', 'enemy-config.js', 'content-config.js', 'procedural-locomotion.js',
  'creature-designs.js', 'creature-bio-rig.js', 'creature-design-renderer.js',
  'biped-locomotion.js', 'biped-renderer.js', 'creature-game-runtime.js', 'main.js', 'build-runtime.js'
];
const src = files.map(f => require('fs').readFileSync(__dirname + '/' + f, 'utf8').replace("'use strict';", '')).join('\n');
const fakeCtx = new Proxy({}, {
  get(t, k) {
    if (k === 'measureText') return text => ({ width: String(text).length * 10 });
    if (k === 'createImageData') return (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) });
    return () => {};
  },
  set() { return true; }
});
function makeCanvas() {
  return { getContext: () => fakeCtx, width: 0, height: 0, style: {}, addEventListener() {},
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 375, height: 667 }) };
}
const canvas = makeCanvas();
global.window = { addEventListener() {}, devicePixelRatio: 1, innerWidth: 375, innerHeight: 667,
  matchMedia: () => ({ matches: false }) };
global.document = { getElementById: () => canvas, createElement: () => makeCanvas() };
global.requestAnimationFrame = () => {};

eval(src + `
;globalThis.G = {
  resetGame, applyOption, spawnEnemy, spawnBoss, update, drawEnemyFull, render,
  runtime: CreatureGameRuntime, enemyDefs: ENEMY_DEFS,
  get player() { return player; }, get enemies() { return enemies; },
  get state() { return state; }
};`);

let failed = 0;
function test(name, fn) {
  try { fn(); console.log('OK  ' + name); }
  catch (e) { failed++; console.log('ERR ' + name + ': ' + e.stack.split('\n').slice(0, 2).join('\n')); }
}
function assert(ok, msg) { if (!ok) throw new Error(msg); }
function fresh() {
  G.resetGame(); G.applyOption(0); G.player.xpNext = 99999999;
  G.player.hp = G.player.maxhp = 99999; G.enemies.splice(0);
}
function finitePoint(p) { return p && Number.isFinite(p.x) && Number.isFinite(p.y); }
function checkPose(e) {
  if (e.bipedRig) {
    const pose = e.bipedRig.getPose();
    assert(finitePoint(pose.pelvis) && finitePoint(pose.head), e.creatureId + ' 双足身体坐标异常');
    for (const leg of pose.legs) assert(finitePoint(leg.hip) && finitePoint(leg.knee) && finitePoint(leg.foot), e.creatureId + ' 双足 IK 异常');
  } else if (e.creatureRig) {
    for (const pose of e.creatureRig.getPose(e)) assert(finitePoint(pose.hip) && finitePoint(pose.knee) && finitePoint(pose.foot), e.creatureId + ' 多足 IK 异常');
  }
}

test('设计表与正式实体映射覆盖主角、普通怪、精英和 10 个 Boss', () => {
  const normalIds = Object.keys(G.enemyDefs);
  const ids = new Set(['player', ...normalIds, ...G.runtime.BOSS_IDS]);
  assert(ids.size === CreatureDesigns.DEFS.length && ids.size === 29, '角色覆盖数量不是 29');
  for (const id of ids) assert(CreatureDesigns.DEFS.some(d => d.id === id), '缺少角色定义：' + id);
});

test('全部普通怪与精英在正式更新和绘制后坐标有限，蜘蛛保留原始 rig', () => {
  fresh();
  const types = Object.keys(G.enemyDefs);
  types.forEach((type, i) => G.spawnEnemy(type, 30 + i * 8, (i % 3 - 1) * 30));
  assert(G.enemies.length === types.length, '普通怪或精英生成数量错误');
  G.update(1 / 60);
  for (const e of G.enemies) {
    if (e.type === 'spider') assert(e.locomotionRig && !e.creatureId, '蜘蛛没有保留原始运动模组');
    else assert(e.creatureId === e.type, '正式角色 ID 映射错误：' + e.type);
    checkPose(e); G.drawEnemyFull(e);
  }
});

test('10 个 Boss 全部使用各自新造型，红笔判官使用独立双足', () => {
  fresh();
  for (let stage = 1; stage <= 10; stage++) G.spawnBoss(stage);
  G.update(1 / 60);
  for (const e of G.enemies) {
    assert(e.creatureId === G.runtime.BOSS_IDS[e.stage - 1], 'Boss 映射错误：' + e.stage);
    if (e.stage === 3) assert(e.bipedRig && !e.creatureRig, '红笔判官没有使用独立双足');
    else assert(e.creatureRig && !e.bipedRig, '多足 Boss 使用了错误骨架：' + e.stage);
    checkPose(e); G.drawEnemyFull(e);
  }
});

test('主角按真实位移驱动双足，反向只镜像身体且不倾斜', () => {
  fresh();
  for (let i = 0; i < 30; i++) { G.player.x += 2.2; G.runtime.updatePlayer(G.player, 1 / 60); }
  assert(G.player.creatureFacing === 1 && G.player.bipedRig.steps > 0, '主角右移没有产生实际迈步');
  const pose = G.player.bipedRig.getPose();
  assert(pose.pelvis.x === pose.chest.x && pose.chest.x === pose.neck.x, '主角身体仍然倾斜');
  for (let i = 0; i < 20; i++) { G.player.x -= 2.2; G.runtime.updatePlayer(G.player, 1 / 60); }
  assert(G.player.creatureFacing === -1, '主角左移没有切换镜像');
  checkPose(G.player); G.render();
});

test('外观接入不改变碰撞半径、生命、伤害和攻击范围', () => {
  fresh(); G.spawnEnemy('stick', 80, 0); const e = G.enemies[0];
  const before = { r: e.r, hp: e.hp, dmg: e.dmg, range: enemySwingRange(e) };
  G.update(1 / 60); G.drawEnemyFull(e);
  assert(e.r === before.r && e.hp === before.hp && e.dmg === before.dmg && enemySwingRange(e) === before.range, '战斗参数被外观层修改');
});

test('潜墨复用主角骨架绘制游泳动作，不改变坐标与战斗状态', () => {
  fresh(); G.player.diving = true; G.player.walk = 2.4;
  const before = { x: G.player.x, y: G.player.y, r: G.player.r, diving: G.player.diving };
  assert(typeof G.runtime.drawDivingPlayer === 'function', '缺少潜墨绘制入口');
  let swimCalls = 0;
  const getSwimPose = G.player.bipedRig.getSwimPose.bind(G.player.bipedRig);
  G.player.bipedRig.getSwimPose = () => { swimCalls++; return getSwimPose(); };
  G.runtime.drawDivingPlayer(fakeCtx, G.player, '#1a2b8f');
  assert(swimCalls === 1 && getSwimPose().swimming, '潜墨没有调用主角游泳骨架');
  G.render();
  assert(G.player.x === before.x && G.player.y === before.y && G.player.r === before.r && G.player.diving === before.diving, '潜墨绘制修改了战斗状态');
});

test('主角绘制放大 1.5 倍，人形怪绘制放大 1.3 倍且不改碰撞', () => {
  fresh();
  const pd = G.player.bipedRig.def;
  const ph = (pd.upperLen + pd.lowerLen) * pd.hipHeight + pd.torsoH + pd.headR * 1.92;
  const ps = G.runtime.bipedScale(G.player, G.player.bipedRig);
  assert(Math.abs(ps - G.player.r * 2.5 / ph * 1.5) < 0.000001, '主角绘制倍率不是 1.5');
  G.spawnEnemy('stick', 80, 0); const e = G.enemies[0];
  G.runtime.attachEnemy(e);
  const radius = e.r, d = e.bipedRig.def;
  const nh = (d.upperLen + d.lowerLen) * d.hipHeight + d.torsoH + d.headR * 1.92;
  const es = G.runtime.bipedScale(e, e.bipedRig);
  assert(Math.abs(es - e.r * 2.5 / nh * 1.3) < 0.000001, '人形怪绘制倍率不是 1.3');
  assert(e.r === radius, '外观放大修改了怪物碰撞半径');
});

console.log(failed ? 'CREATURE_GAME_TEST_FAILURES: ' + failed : 'CREATURE_GAME_TEST_OK (7/7)');
process.exit(failed ? 1 : 0);

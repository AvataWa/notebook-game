// 九只扩展六足 Boss：生成、招式状态机、几何判定、弹体与阶段专项测试。
require('./creature-designs.js');
require('./creature-design-renderer.js');
require('./creature-game-runtime.js');
require('./procedural-locomotion.js');
require('./hexapod-runtime.js');
const fs = require('fs');
const src = fs.readFileSync(__dirname + '/enemy-config.js', 'utf8') + '\n'
  + fs.readFileSync(__dirname + '/main.js', 'utf8').replace("'use strict';", '') + '\n'
  + fs.readFileSync(__dirname + '/boss-ai-runtime.js', 'utf8') + '\n'
  + fs.readFileSync(__dirname + '/boss-standard-runtime.js', 'utf8');
const fakeCtx = new Proxy({}, { get(t, k) { if (k === 'measureText') return () => ({ width: 10 }); return () => {}; }, set() { return true; } });
const fakeCanvas = { getContext: () => fakeCtx, width: 0, height: 0, style: {}, addEventListener() {}, getBoundingClientRect: () => ({ left: 0, top: 0, width: 375, height: 667 }) };
global.window = { addEventListener() {}, devicePixelRatio: 1, innerWidth: 375, innerHeight: 667 };
global.document = { getElementById: () => fakeCanvas }; global.requestAnimationFrame = () => {};
eval(src + `
;globalThis.G = {
  resetGame, spawnBoss, render, hurtEnemy,
  get BOSS_DEFS() { return BOSS_DEFS; },
  get player() { return player; }, get enemies() { return enemies; },
  get ebullets() { return ebullets; }, get enemyInkCells() { return enemyInkCells; },
  set state(v) { state = v; }
};`);
const S = globalThis.BossStandardRuntime, AI = globalThis.BossAI;
let failed = 0, passed = 0;
function test(name, fn) { try { fn(); passed++; console.log('OK  ' + name); } catch (e) { failed++; console.log('ERR ' + name + ': ' + e.stack); } }
function assert(ok, msg) { if (!ok) throw new Error(msg); }
function close(a, b, eps = 0.001) { return Math.abs(a - b) <= eps; }
function freshBoss(stage) {
  G.resetGame(); G.state = 'play'; G.player.xpNext = 99999; G.spawnBoss(stage);
  const e = G.enemies[G.enemies.length - 1];
  e.x = 0; e.y = 0; e.faceA = 0; e.kbx = e.kby = 0;
  G.player.x = 260; G.player.y = 40; G.player.hurtT = 0; G.player.goldT = 0;
  G.player.crit = 0; G.player.eqCrit = 0; G.player.hp = G.player.maxhp = 999999;
  return e;
}
function beginActive(e) { e.huntT = 0; S.update(e, 0.001); }
function activeAt(e, progress) { e.huntT = Math.max(0.001, e.activeDuration * (1 - progress)); S.update(e, 0.001); }

test('20 只 Boss 均可生成，编号 11—20 的页码、六足外形和标准控制器完整', () => {
  const kinds = ['feral', 'turtle', 'flower', 'rhino', 'tree', 'blind', 'feather', 'totem', 'mantis', 'mother'];
  assert(G.BOSS_DEFS.length === 20, 'Boss 总数不是 20');
  for (let stage = 1; stage <= 20; stage++) {
    const e = freshBoss(stage);
    assert(e.boss && e.stage === stage && e.hp > 0, '阶段 ' + stage + ' 生成失败');
    if (stage >= 11) {
      assert(e.bossAI === 'standard' && e.huntBoss, '阶段 ' + stage + ' 未使用标准控制器');
      assert(e.hexapod === kinds[stage - 11] && G.BOSS_DEFS[stage - 1].page === stage + 8, '阶段 ' + stage + ' 外形或页码错误');
      assert(S.PROFILES[stage] && Object.keys(S.PROFILES[stage].moves).length >= 4, '阶段 ' + stage + ' 招式表不完整');
    }
  }
});

for (let stage = 12; stage <= 20; stage++) {
  test(G.BOSS_DEFS[stage - 1].name + '：每招均经过前摇、出手、收招并可渲染', () => {
    for (const kind of Object.keys(S.PROFILES[stage].moves)) {
      const e = freshBoss(stage);
      if (stage === 20) e.phase = S.PROFILES[stage].moves[kind].phases[0];
      assert(S.startAttack(e, kind) !== false && e.huntMode === 'windup' && e.attack === kind, kind + ' 未进入前摇');
      G.render(); beginActive(e);
      assert(e.huntMode === 'active', kind + ' 未进入出手');
      activeAt(e, 0.5); G.render();
      e.huntT = 0; S.update(e, 0.001); G.render();
      assert(e.huntMode !== 'active' && e.huntMode !== 'windup', kind + ' 未能结束出手');
    }
  });
}

test('墨壳山龟：外环中心安全、环带有伤害，正背面减伤不同', () => {
  let e = freshBoss(12); G.player.x = 0; G.player.y = 0;
  S.startAttack(e, 'turtleRing'); beginActive(e); const hp = G.player.hp; activeAt(e, 0.5);
  assert(G.player.hp === hp, '外环中心不应受伤');
  e = freshBoss(12); G.player.x = 170; G.player.y = 0;
  S.startAttack(e, 'turtleRing'); beginActive(e); const hp2 = G.player.hp; activeAt(e, 0.5);
  assert(G.player.hp < hp2, '外环环带没有伤害');
  e = freshBoss(12); e.faceA = 0; let old = e.hp;
  G.hurtEnemy(e, 1000, 0, 100, 0); const front = old - e.hp;
  old = e.hp; G.hurtEnemy(e, 1000, 0, -100, 0); const back = old - e.hp;
  assert(close(front, 550) && close(back, 1000), '正面 55% / 背面 100% 减伤错误：' + front + '/' + back);
  e.phase = 2; old = e.hp; G.hurtEnemy(e, 1000, 0, 100, 0);
  assert(close(old - e.hp, 800), '二阶段正面减伤未减弱');
});

test('钉角六足犀：连冲严格转 90°，双轨中心偏移 147', () => {
  let e = freshBoss(14); G.player.x = 300; G.player.y = 0; S.startAttack(e, 'rhinoTurn');
  e.x = 100; e.y = 50; G.player.x = 100; G.player.y = 400; S.startAttack(e, 'rhinoTurn', true);
  assert(close(Math.abs(AI.norm(e.faceA)), Math.PI / 2), '第二冲不是相对上一招的直角');
  e = freshBoss(14); S.startAttack(e, 'rhinoTwin'); const x = e.x, y = e.y;
  S.startAttack(e, 'rhinoTwin', true);
  assert(close(Math.hypot(e.chargeShiftX - x, e.chargeShiftY - y), 147), '双轨中心偏移不是 147');
  assert(e.x === x && e.y === y, '双轨在预警开始前瞬移');
});

test('百荚育母树：生成三个可击破豆荚，击破后实时减少连线', () => {
  const e = freshBoss(15); S.startAttack(e, 'treeSeed'); beginActive(e);
  const pods = S.debugPods(e);
  assert(pods.length === 3 && pods.every(p => p.pod && p.hp > 0), '没有生成三个真实豆荚');
  assert(S.debugLines(e, 'treeLinks').length === 3, '三节点应形成三条连线');
  G.hurtEnemy(pods[0], pods[0].hp + 1, 0, pods[0].x, pods[0].y);
  assert(S.debugPods(e).length === 2 && S.debugLines(e, 'treeLinks').length === 1, '击破后节点连线未减少');
});

test('盲根泽兽：曲游留下路径，正反回放共用同一组轨迹点', () => {
  const e = freshBoss(16); S.startAttack(e, 'blindSwim'); beginActive(e);
  const pts = e.pathPoints.map(p => ({ x: p.x, y: p.y }));
  activeAt(e, 0.4);
  assert(pts.length === 17 && e.pathInkIndex >= 0 && (G.enemyInkCells.get(e.id) || new Set()).size > 0, '曲游没有留下实际墨迹');
  const forward = S.debugLines(e, 'blindReplay'), reverse = S.debugLines(e, 'blindEcho');
  assert(forward.length === 16 && reverse.length === 16, '轨迹段数错误');
  assert(close(forward[0].a.x, pts[0].x) && close(reverse[0].a.x, pts[16].x), '反向回放没有从终点开始');
  S.startAttack(e, 'blindSwim'); beginActive(e);
  assert(e.pathInkIndex === -1, '重复曲游没有重置留墨索引');
});

test('折光羽蛇：羽刃真实返程、螺旋弹移动、召回立即转向', () => {
  let e = freshBoss(17); S.startAttack(e, 'featherBoom'); beginActive(e);
  assert(G.ebullets.length === 2, '回旋羽刃数量错误');
  const b = G.ebullets[0]; for (let i = 0; i < 16; i++) S.updateProjectile(b, 0.05);
  assert(b.vx * (e.x - b.x) + b.vy * (e.y - b.y) > 0, '羽刃没有返程朝向 Boss');
  S.startAttack(e, 'featherRecall'); beginActive(e);
  assert(G.ebullets.every(p => p.returning), '召回没有标记所有羽刃');
  e = freshBoss(17); S.startAttack(e, 'featherSpiral'); beginActive(e);
  const p = G.ebullets[0], x = p.x, y = p.y; S.updateProjectile(p, 0.2);
  assert(Math.hypot(p.x - x, p.y - y) > 1 && G.ebullets.length === 10, '螺旋弹没有按轨迹移动');
});

test('百眼图腾兽：三行网格与四象限按各自延迟顺序结算', () => {
  const e = freshBoss(18), grid = S.debugLines(e, 'totemGrid');
  assert(grid.length === 3 && grid[0].delay < grid[1].delay && grid[1].delay < grid[2].delay, '网格没有顺序延迟');
  S.startAttack(e, 'totemQuadrants'); beginActive(e); G.player.x = 1000; G.player.y = 1000;
  activeAt(e, 0.15); assert(e.resolvedLines.size === 1, '象限第一时间应只结算一个');
  activeAt(e, 0.5); assert(e.resolvedLines.size === 3, '象限后续顺序结算错误');
  activeAt(e, 0.9); assert(e.resolvedLines.size === 4, '四个象限未全部结算');
});

test('断线螳王：X 斩保留中心缺口，旧斩线可以再次结算', () => {
  const e = freshBoss(19); S.startAttack(e, 'mantisX');
  const specs = S.debugLines(e, 'mantisX');
  assert(specs.length === 4 && specs.every(s => AI.pointSegmentDistance({ x: e.targetX, y: e.targetY }, s.a, s.b) >= 35 - 0.001), 'X 斩中心缺口错误');
  beginActive(e); assert(e.storedLines.length === 4, 'X 斩没有保存旧斩线');
  S.startAttack(e, 'mantisEcho'); assert(S.debugLines(e, 'mantisEcho').length === 4, '残线收刀没有复用旧斩线');
  beginActive(e); activeAt(e, 0.5); assert(e.resolvedLines.size === 4, '旧斩线没有再次结算');
});

test('终页·混生母体：50% 进入二阶段，33% 进入三阶段并清除旧豆荚', () => {
  const e = freshBoss(20); e.hp = e.maxhp * 0.49; S.update(e, 0.001);
  assert(e.phase === 2, '50% 血量未进入二阶段');
  e.pathPoints = [{ x: 0, y: 0 }, { x: 1, y: 1 }];
  e.hp = e.maxhp * 0.32; S.update(e, 0.001);
  assert(e.phase === 3, '33% 血量未进入三阶段');
  assert(S.debugCandidates(e).some(id => id === 'motherPath' || id === 'motherX'), '三阶段没有终章招式');
});

if (failed) { console.error('HEXAPOD_EXPANSION_TEST_FAILED (' + failed + ')'); process.exit(1); }
console.log('HEXAPOD_EXPANSION_TEST_OK (' + passed + '/' + passed + ')');

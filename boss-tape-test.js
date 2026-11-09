// 涂改巨灵专项：重装站位、涂改带资源、区域封锁、愤怒派生、召唤与真实判定。
require('./creature-designs.js');
require('./creature-design-renderer.js');
require('./creature-game-runtime.js');
const src = require('fs').readFileSync(__dirname + '/enemy-config.js', 'utf8') + '\n'
  + require('fs').readFileSync(__dirname + '/main.js', 'utf8').replace("'use strict';", '') + '\n'
  + require('fs').readFileSync(__dirname + '/boss-tape-runtime.js', 'utf8');
const fakeCtx = new Proxy({}, { get(t, k) { if (k === 'measureText') return () => ({ width: 10 }); return () => {}; }, set() { return true; } });
const fakeCanvas = { getContext: () => fakeCtx, width: 0, height: 0, style: {}, addEventListener() {}, getBoundingClientRect: () => ({ left: 0, top: 0, width: 375, height: 667 }) };
global.window = { addEventListener() {}, devicePixelRatio: 1, innerWidth: 375, innerHeight: 667 };
global.document = { getElementById: () => fakeCanvas }; global.requestAnimationFrame = () => {};
eval(src + `
;globalThis.G = {
  resetGame, spawnBoss, update, hurtEnemy, castAbsorb, render, inkCircleHas,
  get player() { return player; }, get enemies() { return enemies; }, get floats() { return floats; },
  get ebullets() { return ebullets; }, get bullets() { return bullets; },
  set state(v) { state = v; }
};`);
let failed = 0, passed = 0;
function test(name, fn) { try { fn(); passed++; console.log('OK  ' + name); } catch (e) { failed++; console.log('ERR ' + name + ': ' + e.stack); } }
function assert(ok, msg) { if (!ok) throw new Error(msg); }
function freshBoss() {
  G.resetGame(); G.state = 'play'; G.player.xpNext = 99999;
  G.spawnBoss(2);
  const e = G.enemies[G.enemies.length - 1];
  e.x = 0; e.y = 0; e.faceA = 0; e.kbx = e.kby = 0;
  G.player.x = 70; G.player.y = 0;
  return e;
}
function beginActive(e) { e.huntT = 0; globalThis.BossTapeRuntime.update(e, 0.001); }
function forceActive(e) { e.huntMode = 'active'; e.huntT = 0.001; }
function nextCombo(e) { e.huntT = 0; globalThis.BossTapeRuntime.update(e, 0.001); globalThis.BossTapeRuntime.update(e, 0.34); }
const T = globalThis.BossTapeRuntime;

test('保留六足涂改巨灵原型和两卷初始涂改带', () => {
  const e = freshBoss(); G.render();
  assert(e.huntBoss && e.bossAI === 'tape' && e.creatureId === 'bossTape', 'Boss 控制器或原型错误');
  assert(e.creatureRig.legs.length === 6 && e.r === 40, '六足步态或体型被替换');
  assert(e.tapeStock === 2 && e.tapeMax === 2 && e.huntMode === 'chase', '涂改带资源未初始化');
});
test('近身、侧面、背后形成不同的重装招式池', () => {
  const e = freshBoss(); let pool = T.debugCandidates(e);
  assert(pool.includes('stomp') && pool.includes('swipe'), '近身缺少震地或挥击');
  assert(!pool.includes('tapeShot') && !pool.includes('release'), '近身错误出现远程或侧后仓口招式');
  G.player.x = 0; G.player.y = 200; pool = T.debugCandidates(e);
  assert(pool.includes('shove') && pool.includes('release') && pool.includes('tapeSnare'), '侧面派生不完整');
  G.player.x = -300; G.player.y = 0; pool = T.debugCandidates(e);
  assert(pool.includes('release') && pool.includes('tapeSnare'), '背后缺少召唤或封路');
  assert(!pool.includes('swipe') && !pool.includes('tapeShot'), '背后错误出现头前招式');
});
test('重装追击会接近远处玩家，也会从贴身距离后撤', () => {
  const e = freshBoss(); G.player.x = 400; e.huntT = 99;
  const far = Math.abs(G.player.x - e.x); T.update(e, 0.5);
  assert(Math.abs(G.player.x - e.x) < far, '远距离没有逼近');
  G.player.x = 50; e.x = 0; const near = Math.abs(G.player.x - e.x); T.update(e, 0.5);
  assert(Math.abs(G.player.x - e.x) > near, '贴身时没有重装后撤');
});
test('侧向撞击前摇有限修正，末段锁定方向', () => {
  const e = freshBoss(); G.player.x = 300; G.player.y = 0; T.startAttack(e, 'shove');
  G.player.y = 160; e.huntT = 0.5; T.update(e, 0.05);
  assert(e.faceA > 0 && e.faceA < Math.atan2(160, 300), '撞击前摇没有有限转向');
  e.huntT = 0.2; const face = e.faceA, dx = e.lockDx, dy = e.lockDy;
  G.player.x = -200; G.player.y = -100; T.update(e, 0.01);
  assert(e.faceA === face && e.lockDx === dx && e.lockDy === dy, '撞击末段仍追踪玩家');
});
test('封路落点前摇追踪，末段锁定后保持不动', () => {
  const e = freshBoss(); G.player.x = 400; G.player.y = 0; T.startAttack(e, 'tapeSnare');
  G.player.x = 450; G.player.y = 100; e.huntT = 0.6; T.update(e, 0.01);
  assert(e.targetX === 450 && e.targetY === 100, '封路前摇没有更新目标');
  e.huntT = 0.2; const x = e.targetX, y = e.targetY;
  G.player.x = -200; G.player.y = -100; T.update(e, 0.01);
  assert(e.targetX === x && e.targetY === y, '封路末段仍追踪玩家');
});
test('普通涂改带射击消耗储量，耗尽后只能换带再射', () => {
  const e = freshBoss(); G.player.x = 400; T.startAttack(e, 'tapeShot'); beginActive(e);
  assert(G.ebullets.length === 1 && G.ebullets[0].kind === 'tape' && e.tapeStock === 1, '普通射击弹体或消耗错误');
  T.startAttack(e, 'tapeShot'); beginActive(e);
  assert(G.ebullets.length === 2 && e.tapeStock === 0, '第二发射击未耗尽储量');
  const pool = T.debugCandidates(e);
  assert(!pool.includes('tapeShot') && !pool.includes('tapeSnare') && pool.includes('reload'), '耗尽后资源限制或换带候选错误');
});
test('愤怒射击改为三条真实弹体', () => {
  const e = freshBoss(); e.phase = 2; e.tapeMax = 3; e.tapeStock = 3; G.player.x = 400;
  T.startAttack(e, 'tapeShot'); beginActive(e);
  assert(G.ebullets.length === 3 && G.ebullets.every(b => b.kind === 'tape'), '愤怒三连射未生效');
  assert(e.tapeStock === 2 && new Set(G.ebullets.map(b => b.vy)).size === 3, '三连射没有扇形差异或储量错误');
});
test('封路产生真实敌方墨迹、一次伤害和储量消耗', () => {
  const e = freshBoss(); G.player.x = 300; G.player.y = 0; T.startAttack(e, 'tapeSnare');
  const hp = G.player.hp; beginActive(e);
  assert(G.player.hp < hp && e.tapeStock === 1, '封路伤害或消耗未生效');
  assert(G.inkCircleHas(300, 0, 2, true), '落点没有形成真实敌方墨迹');
  assert(e.attackResolved, '封路没有记录攻击结算');
});
test('愤怒封路需要三卷储量，并连续执行三次落点', () => {
  const e = freshBoss(); e.phase = 2; e.tapeMax = 3; e.tapeStock = 2; G.player.x = 300;
  assert(!T.debugCandidates(e).includes('tapeSnare'), '储量不足仍能发动三重封路');
  e.tapeStock = 3; T.startAttack(e, 'tapeSnare');
  assert(e.ai.combo.join(',') === 'tapeSnare,tapeSnare', '没有储存后续两次封路');
  beginActive(e); assert(e.tapeStock === 2 && e.huntMode === 'active', '第一次封路未执行');
  e.huntT = 0; T.update(e, 0.001); assert(e.huntMode === 'comboWait', '第一次封路后未进入连段等待');
  nextCombo(e); beginActive(e); assert(e.tapeStock === 1 && e.huntMode === 'active', '第二次封路未执行');
  e.huntT = 0; T.update(e, 0.001); assert(e.huntMode === 'comboWait', '第二次封路后未进入连段等待');
  nextCombo(e); beginActive(e); assert(e.tapeStock === 0 && e.attackResolved, '第三次封路未执行');
});
test('换带是真实招式，完成后恢复全部储量', () => {
  const e = freshBoss(); e.tapeStock = 0; T.startAttack(e, 'reload');
  assert(e.huntMode === 'windup' && e.windupDuration === 1.05, '换带没有独立前摇');
  beginActive(e);
  assert(e.tapeStock === e.tapeMax && e.huntMode === 'active', '换带没有恢复储量');
  e.huntT = 0; T.update(e, 0.001);
  assert(e.huntMode === 'recover' && e.recoverDuration === 1, '换带缺少长收招输出窗口');
});
test('纸带仓真实释放三只蜘蛛，愤怒释放四只', () => {
  let e = freshBoss(); G.player.x = -300; T.startAttack(e, 'release'); beginActive(e);
  assert(G.enemies.filter(x => x.type === 'spider').length === 3, '普通召唤数量错误');
  e = freshBoss(); e.phase = 2; G.player.x = -300; T.startAttack(e, 'release'); beginActive(e);
  assert(G.enemies.filter(x => x.type === 'spider').length === 4, '愤怒召唤数量错误');
});
test('震地使用真实圆形范围，愤怒带第二段连踩', () => {
  const e = freshBoss(); e.phase = 2; G.player.x = 70; T.startAttack(e, 'stomp');
  assert(e.ai.combo.join(',') === 'stomp', '愤怒没有储存第二次震地');
  const hp = G.player.hp; forceActive(e); e.huntT = 0.1; T.update(e, 0.001);
  assert(G.player.hp < hp && e.attackResolved, '震地范围内没有伤害');
  e.huntT = 0; T.update(e, 0.001);
  assert(e.huntMode === 'comboWait' && e.ai.nextCombo === 'stomp', '第二段连踩未进入等待');
});
test('愤怒挥击执行双挥，近战挥击可以弹反', () => {
  let e = freshBoss(); e.phase = 2; T.startAttack(e, 'swipe');
  assert(e.ai.combo.join(',') === 'swipe', '愤怒没有储存第二次挥击');
  forceActive(e); e.huntT = 0; T.update(e, 0.001);
  assert(e.huntMode === 'comboWait', '双挥没有进入连段等待');
  e = freshBoss(); G.player.x = 65; G.castAbsorb(); const hp = G.player.hp;
  T.startAttack(e, 'swipe'); e.huntMode = 'active'; e.huntT = 0.1; T.update(e, 0.001);
  assert(G.player.hp === hp && e.huntMode === 'recover', '挥击弹反未生效');
  assert(G.floats.some(f => f.txt === '弹反！'), '挥击弹反缺少反馈');
});
test('涂改带弹体可以被吸墨弹反', () => {
  const e = freshBoss(); G.player.x = 70; G.castAbsorb();
  G.ebullets.push({ x: 72, y: 0, vx: -100, vy: 0, dmg: 10, life: 2, sourceId: e.id, reflectable: true, kind: 'tape' });
  const hp = G.player.hp; G.update(0.001);
  assert(G.player.hp === hp && G.ebullets.length === 0, '涂改带没有被弹反');
  assert(G.bullets.some(b => b.reflected), '涂改带弹反没有生成己方弹体');
});
test('半血愤怒补充储量和连段能力，但不改动原型', () => {
  const e = freshBoss(); e.hp = e.maxhp * 0.4; e.tapeStock = 1;
  T.update(e, 0.01);
  assert(e.phase === 2 && e.tapeMax === 3 && e.tapeStock === 2, '愤怒资源变化错误');
  assert(e.creatureId !== 'bossScribble' && e.bossAI === 'tape', '愤怒错误替换 Boss');
});
test('完成五轮招式后进入疲惫，且无贴身碰撞伤害', () => {
  const e = freshBoss(); e.ai.moveCount = 4; e.attack = 'swipe'; e.huntMode = 'recover'; e.huntT = 0;
  T.update(e, 0.001);
  assert(e.huntMode === 'fatigue' && e.huntT > 2.7, '没有进入疲惫');
  const hp = e.hp; G.hurtEnemy(e, 100, 0, -500, -500);
  assert(Math.round(hp - e.hp) === 120, '疲惫受伤加深未生效');
  G.player.x = e.x; G.player.y = e.y; const playerHp = G.player.hp; G.update(0.001);
  assert(G.player.hp === playerHp, '疲惫时仍有贴身碰撞伤害');
});
test('七种行为与重装状态渲染均不报错', () => {
  const e = freshBoss();
  for (const kind of Object.keys(T.MOVES)) {
    if (kind === 'reload') e.tapeStock = 0; else e.tapeStock = e.tapeMax;
    T.startAttack(e, kind); G.render();
    e.huntMode = 'active'; e.huntT = e.activeDuration * 0.5; G.render();
  }
  e.huntMode = 'reposition'; G.render();
  e.huntMode = 'fatigue'; G.render();
});
if (failed) { console.error('BOSS_TAPE_TEST_FAILED (' + failed + ')'); process.exit(1); }
console.log('BOSS_TAPE_TEST_OK (' + passed + '/' + passed + ')');

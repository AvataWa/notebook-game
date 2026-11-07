// 地面墨迹回归：无浓度覆盖、持久领地、来源转化、怪物铺墨与潜墨索敌
const src = require('fs').readFileSync(__dirname + '/enemy-config.js', 'utf8') + '\n' + require('fs').readFileSync(__dirname + '/main.js', 'utf8').replace("'use strict';", '');
const fakeCtx = new Proxy({}, { get(t, k) { if (k === 'measureText') return () => ({ width: 10 }); return () => {}; }, set() { return true; } });
const fakeCanvas = { getContext: () => fakeCtx, width: 0, height: 0, style: {}, addEventListener() {}, getBoundingClientRect: () => ({ left: 0, top: 0, width: 375, height: 667 }) };
global.window = { addEventListener() {}, devicePixelRatio: 1, innerWidth: 375, innerHeight: 667 };
global.document = { getElementById: () => fakeCanvas }; global.requestAnimationFrame = () => {};
eval(src + `
;globalThis.G = {
  resetGame, addInkStain, addHostileInk, addLinkedTrail, updateInkStains, toggleDive, inkCellAt, inkStats,
  spawnEnemy, killEnemy, update, updateBoss, spawnBoss, render,
  get enemies() { return enemies; }, get ebullets() { return ebullets; }, get player() { return player; }, set state(v) { state = v; }
};`);
let failed = 0;
function test(name, fn) { try { fn(); console.log('OK  ' + name); } catch (e) { failed++; console.log('ERR ' + name + ': ' + e.message); } }
function assert(ok, msg) { if (!ok) throw new Error(msg); }
function fresh() { G.resetGame(); G.state = 'play'; G.player.xpNext = 999; G.player.hp = G.player.maxhp = 9999; }

test('墨迹不再积累浓度，任意笔触都只有有或无', () => {
  fresh(); G.addInkStain(0, 0, 10, 25, '#6b6b6b'); G.addInkStain(0, 0, 10, 25, '#6b6b6b');
  assert(G.inkCellAt(0, 0).amount === 1, '同色重复涂抹仍积累浓度');
  G.addInkStain(0, 0, 200, 25, '#6b6b6b'); assert(G.inkCellAt(0, 0).amount === 1, '大笔触仍改变浓度');
});
test('后覆盖前不经过浓度抵消，双方都是一次换色', () => {
  fresh(); G.addHostileInk(0, 0, 200, 30); G.addInkStain(0, 0, 1, 30, '#1a2b8f');
  assert(G.inkCellAt(0, 0).owner === 1 && G.inkCellAt(0, 0).amount === 1, '己方没有一次覆盖灰墨');
  G.addHostileInk(0, 0, 1, 30); assert(G.inkCellAt(0, 0).owner === 2 && G.inkCellAt(0, 0).amount === 1, '敌方没有一次覆盖彩墨');
});
test('墨迹不按时间消失，也不按历史数量回收', () => {
  fresh(); G.addInkStain(0, 0, 10, 25, '#e67e22'); const before = G.inkStats().friendly; G.updateInkStains(20);
  assert(G.inkStats().friendly === before, '领地时间或数量回收错误'); G.render();
});
test('技能墨迹保留持续脉冲，普通轨迹不脉冲', () => {
  fresh(); G.addInkStain(0, 0, 1, 45, '#e67e22'); G.spawnEnemy('stick', 0, 0);
  const e = G.enemies[0], hp = e.hp; G.updateInkStains(0.02); assert(e.hp < hp, '技能墨迹没有造成伤害');
});
test('击杀在死亡位置爆开己方轨迹，不直接返墨', () => {
  fresh(); G.spawnEnemy('stick', 70, 30); G.player.ink = 50; G.killEnemy(G.enemies[0]);
  assert(G.inkCellAt(70, 30).owner === 1 && G.inkCellAt(70, 30).pulse === 0, '击杀爆墨位置或类型错误'); assert(G.player.ink === 50, '普通击杀错误返墨');
});
test('喷墨怪留灰墨，墨囊怪死亡墨渍立即转成己方', () => {
  fresh(); G.spawnEnemy('sprayer', 100, 100); G.enemies[0].inkCd = 0; G.update(1 / 60); assert(G.inkStats().hostile > 0, '喷墨怪没有留灰墨');
  fresh(); G.spawnEnemy('inksac', 50, 50); G.killEnemy(G.enemies[0]);
  assert(G.inkCellAt(50, 50).owner === 1 && G.inkCellAt(50, 50).amount === 1, '墨囊怪死亡墨渍没有转化');
});
test('Boss 墨弹攻击同时铺设带来源的灰墨', () => {
  fresh(); G.spawnBoss(6); const boss = G.enemies.find(e => e.boss); boss.ringCd = 0; G.updateBoss(boss, 1 / 60);
  assert(G.inkStats().hostile > 0 && G.ebullets.length > 0 && G.ebullets.every(b => b.sourceId === boss.id), 'Boss 墨迹或墨弹来源错误');
});
test('击杀只转化该怪物留下的轨迹，其他怪物轨迹不变', () => {
  fresh(); G.spawnEnemy('stick', -200, -200); G.spawnEnemy('stick', 200, 200); const a = G.enemies[0], b = G.enemies[1];
  G.addLinkedTrail(a, -150, -200, '#70645e', true, 12, 1.5, 12, 'trailX', 'trailY', 'trailS');
  G.addLinkedTrail(b, 150, 200, '#70645e', true, 12, 1.5, 12, 'trailX', 'trailY', 'trailS'); G.killEnemy(a);
  assert(G.inkCellAt(-175, -200).owner === 1 && G.inkCellAt(-175, -200).pulse === 0, '死亡怪物远处轨迹没有转化');
  assert(G.inkCellAt(175, 200).owner === 2, '其他怪物轨迹被误转化');
});
test('交叉墨迹属于最后覆盖者，击杀前一只不会夺回', () => {
  fresh(); G.spawnEnemy('stick', 200, 200); G.spawnEnemy('stick', 200, 200); const a = G.enemies[0], b = G.enemies[1];
  G.addHostileInk(0, 0, 8, 25, a.id); G.addHostileInk(0, 0, 8, 25, b.id); G.killEnemy(a);
  assert(G.inkCellAt(0, 0).owner === 2, '前一只怪物死亡夺回后覆盖者的墨迹'); G.killEnemy(b);
  assert(G.inkCellAt(0, 0).owner === 1, '最后覆盖者死亡后没有转化');
});
test('怪物死亡后，其存活墨弹的新旧路径都会转成己方', () => {
  fresh(); G.player.x = 300; G.player.y = 300; G.spawnEnemy('stick', 200, 200); const e = G.enemies[0];
  G.ebullets.push({ x: -100, y: 0, vx: 400, vy: 0, dmg: 1, life: 1, sourceId: e.id }); G.update(0.2);
  assert(G.inkCellAt(-50, 0).owner === 2, '墨弹没有形成灰墨路径'); G.killEnemy(e);
  assert(G.inkCellAt(-50, 0).owner === 1 && G.inkCellAt(-50, 0).pulse === 0, '墨弹旧路径没有随来源怪物死亡转化');
  G.update(0.2); assert(G.inkCellAt(40, 0).owner === 1 && G.inkCellAt(40, 0).pulse === 0, '来源死亡后的墨弹新路径仍变灰');
});
test('远距离普通怪追踪最后可见位置，近身仍追踪真人', () => {
  fresh(); G.addInkStain(0, 0, 10, 50, '#1a2b8f'); G.spawnEnemy('stick', 250, 0);
  const e = G.enemies[0]; e.sp = 50; e.hitCd = 99; G.toggleDive(); G.player.lastSeenX = 0; G.player.lastSeenY = 0; G.player.x = 0; G.player.y = 180;
  G.update(0.1); assert(e.y > 0, '普通怪没有追向最后可见位置'); e.x = 0; e.y = 175; e.kbx = e.kby = 0; const x = e.x; G.update(0.1);
  assert(e.y > 175 && Math.abs(e.x - x) < 1e-8, '近身怪没有恢复追踪真人');
});
console.log(failed ? 'INK_GROUND_TEST_FAILURES: ' + failed : 'INK_GROUND_TEST_OK (11/11)');
process.exit(failed ? 1 : 0);

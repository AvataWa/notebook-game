'use strict';
const assert = require('assert');
const G = require('./game.js');
let passed = 0;
function test(name, fn) { fn(); passed++; console.log('OK  ' + name); }
function squareTrail() {
  const pts = [{ x: 100, y: 100 }];
  const line = (x, y) => { const p = pts[pts.length - 1], n = Math.ceil(Math.hypot(x - p.x, y - p.y) / 15); for (let i = 1; i <= n; i++) pts.push({ x: p.x + (x - p.x) * i / n, y: p.y + (y - p.y) * i / n }); };
  line(200, 100); line(200, 200); line(100, 200); line(100, 100);
  return pts;
}

test('线段交叉能返回真实交点', () => {
  const p = G.segmentIntersection({ x: 0, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }, { x: 10, y: 0 });
  assert(p && Math.abs(p.x - 5) < 1e-8 && Math.abs(p.y - 5) < 1e-8);
});
test('移动轨迹可识别闭环并生成多边形', () => {
  const poly = G.findLoop(squareTrail());
  assert(poly && poly.length >= 12, '未识别闭环');
  assert(Math.abs(G.polygonArea(poly) - 10000) < 1, '闭环面积错误');
});
test('剪纸只捕获圈内怪物并生成纸块纸偶', () => {
  G.reset('play');
  G.debug.enemies = [
    { id: 1, type: 'doodle', x: 150, y: 150, r: 9, dead: false },
    { id: 2, type: 'doodle', x: 260, y: 150, r: 9, dead: false }
  ];
  const poly = [{ x: 100, y: 100 }, { x: 200, y: 100 }, { x: 200, y: 200 }, { x: 100, y: 200 }];
  const result = G.performCut(poly);
  assert.strictEqual(result.caught, 1);
  assert.strictEqual(G.debug.enemies.length, 1);
  assert.strictEqual(G.debug.cutouts.length, 1);
  assert.strictEqual(G.debug.dolls.length, 1);
  assert.strictEqual(G.debug.S.caught, 1);
});
test('怪物不会断线，只有本体碰撞造成损伤', () => {
  G.reset('play');
  G.debug.trail = [{ x: 100, y: 100 }, { x: 120, y: 120 }, { x: 140, y: 140 }, { x: 160, y: 160 }];
  G.debug.enemies = [{ id: 9, type: 'doodle', x: G.debug.player.x, y: G.debug.player.y, r: 9, speed: 43, hitCd: 0, walk: 0, dead: false }];
  const hp = G.debug.S.hp, points = G.debug.trail.length;
  G.update(0.04);
  assert.strictEqual(G.debug.trail.length, points, '墨线被错误清除');
  assert.strictEqual(G.debug.S.hp, hp - 10, '本体碰撞未扣血');
});
test('倒计时结束进入完成状态', () => {
  G.reset('play'); G.debug.S.time = G.debug.S.duration - 0.01;
  G.update(0.04);
  assert.strictEqual(G.debug.S.mode, 'win');
});
test('超长墨线只裁掉旧端并限制总长度', () => {
  G.reset('play');
  G.debug.trail = Array.from({ length: 7 }, (_, i) => ({ x: i * 100, y: 200 }));
  assert.strictEqual(G.keepTrailLength(200), true);
  assert(Math.abs(G.trailLength() - 200) < 1e-8);
  assert.strictEqual(G.debug.trail[G.debug.trail.length - 1].x, 600);
  assert.strictEqual(G.debug.trail[0].x, 400);
});
test('剪线小人剪短后仍保留角色一端', () => {
  G.reset('play');
  G.debug.trail = Array.from({ length: 5 }, (_, i) => ({ x: i * 100, y: 200 }));
  assert.strictEqual(G.shortenTrail(), true);
  assert(Math.abs(G.trailLength() - 125) < 1e-8);
  assert.strictEqual(G.debug.trail[G.debug.trail.length - 1].x, 400);
  assert(G.debug.trail.length >= 2);
});
test('单圈三只按指数获得四百分', () => {
  G.reset('play');
  G.debug.enemies = [120, 150, 180].map((x, i) => ({ id: i, type: 'doodle', x, y: 150, r: 9, dead: false }));
  const result = G.performCut([{ x: 100, y: 100 }, { x: 200, y: 100 }, { x: 200, y: 200 }, { x: 100, y: 200 }]);
  assert.strictEqual(result.caught, 3);
  assert.strictEqual(result.catchScore, 400);
});
test('线长与移速强化均可生效', () => {
  G.reset('upgrade');
  const line = G.debug.S.maxLine, speed = G.debug.player.speed;
  G.applyUpgrade('line');
  assert.strictEqual(G.debug.S.maxLine, line + 140);
  G.debug.S.mode = 'upgrade'; G.applyUpgrade('speed');
  assert(Math.abs(G.debug.player.speed - speed * 1.12) < 1e-8);
  assert.strictEqual(G.debug.S.mode, 'play');
});
console.log(`PAPER_CUT_TEST_OK (${passed}/9)`);

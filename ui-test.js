// 升级延迟与左右手触控布局回归
const src = require('fs').readFileSync(__dirname + '/enemy-config.js', 'utf8') + '\n' + require('fs').readFileSync(__dirname + '/main.js', 'utf8').replace("'use strict';", '');
const handlers = {};
const fakeCtx = new Proxy({}, { get(t, k) { if (k === 'measureText') return () => ({ width: 10 }); return () => {}; }, set() { return true; } });
const fakeCanvas = {
  getContext: () => fakeCtx, width: 0, height: 0, style: {},
  addEventListener(type, fn) { handlers[type] = fn; },
  getBoundingClientRect: () => ({ left: 0, top: 0, width: 375, height: 667 })
};
global.window = { addEventListener() {}, devicePixelRatio: 1, innerWidth: 375, innerHeight: 667 };
global.document = { getElementById: () => fakeCanvas }; global.requestAnimationFrame = () => {};
eval(src + `
;globalThis.G = {
  resetGame, applyOption, update, render,
  get state() { return state; }, get player() { return player; }, get cards() { return cards; },
  get joy() { return joy; }, get levelupDelay() { return levelupDelayT; },
  get joyHome() { return JOY_HOME; }, get absorbRect() { return absorbRect; },
  get diveRect() { return diveRect; }, get specialRect() { return specialRect; },
  get cam() { return { x: camX, y: camY }; }, get view() { return { w: VIEW_W, h: VIEW_H }; },
  get bounds() { return { l: WORLD_L, r: WORLD_R, t: WORLD_T, b: WORLD_B }; }
};`);
let failed = 0;
function test(name, fn) { try { fn(); console.log('OK  ' + name); } catch (e) { failed++; console.log('ERR ' + name + ': ' + e.message); } }
function assert(ok, msg) { if (!ok) throw new Error(msg); }
function fresh() { G.resetGame(); G.applyOption(0); }
function pointer(type, id, x, y) { handlers[type]({ pointerId: id, clientX: x, clientY: y, preventDefault() {} }); }
function center(r) { return { x: r.x + r.w / 2, y: r.y + r.h / 2 }; }

test('经验满后等待 0.5 秒才弹出升级三选一', () => {
  fresh(); G.player.xp = G.player.xpNext;
  G.update(0.1);
  assert(G.state === 'play' && G.player.level === 1 && Math.abs(G.levelupDelay - 0.4) < 1e-8, '升级等待没有开始或提前弹窗');
  G.update(0.39);
  assert(G.state === 'play' && G.player.level === 1 && G.cards.length === 0, '0.5 秒未到就弹出选项');
  G.update(0.02);
  assert(G.state === 'levelup' && G.player.level === 2 && G.cards.length === 3, '等待结束后没有升级三选一');
});
test('左下固定摇杆只在左侧启动并决定方向', () => {
  fresh(); const home = G.joyHome;
  pointer('pointerdown', 1, home.x, home.y);
  pointer('pointermove', 1, home.x + 40, home.y);
  assert(G.joy.active && G.joy.bx === home.x && G.joy.by === home.y && G.joy.dx > 0, '固定摇杆没有响应左手拖动');
  G.update(0.016);
  assert(G.player.x > 0, '摇杆向右拖但角色没有向右移动');
  pointer('pointerup', 1, home.x + 40, home.y);
  assert(!G.joy.active && G.joy.dx === 0, '松开摇杆后仍保持移动输入');
});
test('右手空白区域不会抢走摇杆输入', () => {
  fresh(); pointer('pointerdown', 2, 195, 390);
  assert(!G.joy.active, '右侧空白区域错误启动了摇杆');
});
test('保持左手移动时右手可以释放吸墨和潜墨', () => {
  fresh(); const home = G.joyHome;
  pointer('pointerdown', 1, home.x, home.y);
  let p = center(G.absorbRect); pointer('pointerdown', 2, p.x, p.y);
  assert(G.joy.active && G.player.absorbT > 0, '吸墨按钮与摇杆触点冲突');
  p = center(G.diveRect); pointer('pointerdown', 3, p.x, p.y);
  assert(G.joy.active && G.player.diving, '潜墨按钮与摇杆触点冲突');
});
test('右手墨潮按钮可独立长按蓄力、松开释放，三个按钮均在右半屏', () => {
  fresh(); G.player.special = 100;
  const p = center(G.specialRect); pointer('pointerdown', 4, p.x, p.y);
  assert(G.player.surgeCharging && G.player.special === 100, '按下墨潮没有蓄力或提前消耗资源');
  G.update(0.6); assert(Math.abs(G.player.surgeChargeT - 0.6) < 1e-8, '长按没有累计蓄力时间');
  pointer('pointerup', 4, p.x, p.y);
  assert(G.player.special === 0 && !G.player.surgeCharging, '松开墨潮按钮没有释放技能');
  assert(G.diveRect.y < G.absorbRect.y && G.diveRect.x === G.absorbRect.x, '潜墨与吸墨按钮没有上下互换');
  assert([G.absorbRect, G.diveRect, G.specialRect].every(r => r.x >= 187.5), '技能按钮未全部放在右半屏');
  assert(G.joyHome.x + G.joyHome.r < 187.5, '摇杆越过了左半屏');
  G.render();
});
test('角色位于四个场景角落时仍保持屏幕正中央', () => {
  fresh(); const b = G.bounds;
  for (const [x, y] of [[b.l + 14, b.t + 14], [b.r - 14, b.t + 14], [b.l + 14, b.b - 14], [b.r - 14, b.b - 14]]) {
    G.player.x = x; G.player.y = y; G.update(0);
    assert(Math.abs(G.player.x - G.cam.x - G.view.w / 2) < 1e-8, '水平方向没有居中：' + x + ',' + y);
    assert(Math.abs(G.player.y - G.cam.y - G.view.h / 2) < 1e-8, '垂直方向没有居中：' + x + ',' + y);
  }
});
console.log(failed ? 'UI_TEST_FAILURES: ' + failed : 'UI_TEST_OK (6/6)');
process.exit(failed ? 1 : 0);

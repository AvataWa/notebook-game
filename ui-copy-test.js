// 短文案、详情弹层、输入隔离与精简界面的专项回归
const fs = require('fs');
const files = ['battle-config.js', 'enemy-config.js', 'content-config.js', 'main.js', 'build-runtime.js',
  'build-view.js', 'meta-config.js', 'meta-runtime.js', 'ui-copy.js', 'ui-detail-runtime.js'];
const src = files.map(f => fs.readFileSync(__dirname + '/' + f, 'utf8').replace("'use strict';", '')).join('\n');
const canvasHandlers = [], keyHandlers = [], drawTexts = [];
const fakeCtx = new Proxy({}, { get(t, k) {
  if (k === 'measureText') return txt => ({ width: String(txt).length * 10 });
  if (k === 'fillText') return txt => { drawTexts.push(String(txt)); };
  return () => {};
}, set() { return true; } });
const fakeCanvas = {
  getContext: () => fakeCtx, width: 0, height: 0, style: {},
  addEventListener(type, fn, capture) { if (type === 'pointerdown') canvasHandlers.push({ fn, capture: capture === true }); },
  getBoundingClientRect: () => ({ left: 0, top: 0, width: 375, height: 667 })
};
global.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
global.window = { addEventListener(type, fn, capture) { if (type === 'keydown') keyHandlers.push({ fn, capture: capture === true }); }, devicePixelRatio: 1, innerWidth: 375, innerHeight: 667 };
global.document = { getElementById: () => fakeCanvas }; global.requestAnimationFrame = () => {};
eval(src + `
;globalThis.G = {
  render, buildOptions,
  get state() { return state; }, set state(v) { state = v; },
  get cards() { return cards; }, get cardRects() { return cardRects; }, get cardDetailRects() { return cardDetailRects; },
  get player() { return player; }, set levelupPickAfter(v) { levelupPickAfter = v; },
  get meta() { return window.__metaRuntime; }, get build() { return window.__buildView; },
  get copy() { return window.UICopy; }, get detail() { return window.UIDetail; },
  get SUPPORTS() { return SUPPORTS; }, get SKILL_DEFS() { return SKILL_DEFS; }
};`);
let failed = 0, passed = 0;
function test(name, fn) { try { fn(); passed++; console.log('OK  ' + name); } catch (e) { failed++; console.log('ERR ' + name + ': ' + e.stack.split('\n')[0]); } }
function assert(ok, msg) { if (!ok) throw new Error(msg); }
function pointer(x, y) {
  const e = { clientX: x, clientY: y, pointerId: 1, stopped: false,
    preventDefault() {}, stopImmediatePropagation() { this.stopped = true; } };
  for (const h of canvasHandlers.filter(h => h.capture)) { h.fn(e); if (e.stopped) return; }
  for (const h of canvasHandlers.filter(h => !h.capture)) { h.fn(e); if (e.stopped) return; }
}
function center(r) { return { x: r.x + r.w / 2, y: r.y + r.h / 2 }; }
function levelup() {
  G.meta.beginRun(false); G.state = 'levelup'; G.buildOptions(); G.levelupPickAfter = Date.now() + 500;
}

test('全部主动与辅助都有短文案，完整说明仍保留', () => {
  for (const id of Object.keys(G.SKILL_DEFS)) assert(G.copy.skillShort(id).length > 0 && G.copy.skillShort(id).length <= 30, id + ' 主动短文案异常');
  for (const id of Object.keys(G.SUPPORTS)) {
    const short = G.copy.supportShort(id, 2);
    assert(short && !short.includes('undefined') && short.length <= 31, id + ' 辅助短文案异常：' + short);
  }
  assert(G.copy.supportShort('multi', 2) === '弹数 +2，伤害 -16%', '辅助等级数值没有保留');
  assert(G.copy.supportShort('shock', 1).includes('僵直'), '负面或控制信息被短文案遗漏');
});

test('三选一没有详情热区，输入锁结束后点卡片直接选择', () => {
  levelup();
  assert(G.cardDetailRects.length === 0, '详情热区仍然存在');
  let p = center(G.cardRects[1]); pointer(p.x, p.y);
  assert(!G.detail.isOpen && G.state === 'levelup', '输入锁失效或误开详情');
  G.levelupPickAfter = 0; p = center(G.cardRects[1]); pointer(p.x, p.y);
  assert(G.state === 'play' && G.cards.length === 0, '解锁后无法正常选卡');
});

test('死亡先显示战斗失败，点击屏幕后才进入构筑结算', () => {
  G.meta.resetAll(); G.meta.beginRun(false); G.state = 'over'; drawTexts.length = 0; G.render();
  assert(G.state === 'over' && !G.meta.run.settled, '死亡后未经点击就进入结算');
  assert(drawTexts.includes('战斗失败') && drawTexts.includes('点击屏幕查看战斗结算'), '失败确认页文案缺失');
  pointer(180, 400);
  assert(G.state === 'metaRunSummary' && G.meta.settlement && !G.meta.settlement.win, '点击后没有进入失败构筑结算');
});

test('养成默认同页展示四个主动，详情关闭不会退出养成', () => {
  G.meta.beginRun(false); G.state = 'play';
  G.player.actives = Object.keys(G.SKILL_DEFS).slice(0, 4).map(id => ({ id, lvl: 1, supports: [], t: 0, uc: 0 }));
  assert(G.build.open() && G.build.pageCount === 1 && G.build.entries().length === 4, '四技能总览或分页错误');
  G.render(); pointer(100, 160);
  assert(G.detail.isOpen && G.state === 'build' && G.detail.current.body.includes('辅助 0/4'), '主动完整详情没有打开');
  pointer(180, 585);
  assert(!G.detail.isOpen && G.state === 'build', '关闭详情误触了底层养成按钮');
  assert(G.build.close() && G.state === 'play', '养成返回状态错误');
});

test('主界面、天赋和 Boss 挑战使用精简标签', () => {
  G.meta.goHome(); drawTexts.length = 0; G.render();
  for (const label of ['开始游戏', '段位考核', '文具盒 0', '天赋', 'Boss 挑战']) assert(drawTexts.includes(label), '首页缺少：' + label);
  assert(!drawTexts.some(t => t.includes('段位只升不降') || t.includes('选择讨伐目标')), '首页仍有过长规则说明');
  G.meta.data.ink = 1000; G.meta.tab = 'basic'; G.state = 'metaTalents'; drawTexts.length = 0; G.render();
  assert(drawTexts.includes('全部伤害 +0% → +3%') && drawTexts.includes('30'), '天赋当前/下级或成本显示错误');
  G.meta.openBossChallenge(); drawTexts.length = 0; G.render();
  assert(drawTexts.includes('练习模式 · 无收益') && !drawTexts.some(t => t.includes('完整招式 AI')), 'Boss 挑战说明未精简');
  pointer(180, 600); assert(G.state === 'metaBossChallenge', '已删除的底部返回按钮仍有隐形热区');
});

test('文具盒重铸先确认，详情与按钮输入互不串联', () => {
  G.meta.resetAll(); G.meta.data.inventory.push({ key: 'glove', rarity: 0 }); G.meta.data.paper = 200;
  G.state = 'metaInventory'; G.render();
  pointer(100, 160); assert(G.detail.isOpen && G.detail.current.title === '红笔指套', '装备详情无法打开');
  pointer(180, 585); assert(!G.detail.isOpen && G.state === 'metaInventory', '装备详情关闭异常');
  pointer(290, 196);
  assert(G.meta.data.inventory[0].key === 'glove' && G.meta.data.paper === 200, '点击重铸未等待确认就扣费换装');
  drawTexts.length = 0; G.render(); assert(drawTexts.some(t => t.includes('同部位同品质随机换装')), '重铸确认缺少规则');
  pointer(250, 390);
  assert(G.meta.data.inventory[0].key !== 'glove' && G.meta.data.paper === 160, '确认重铸没有正确执行');
});

console.log(failed ? 'UI_COPY_TEST_FAILURES: ' + failed : 'UI_COPY_TEST_OK (' + passed + '/' + passed + ')');
process.exit(failed ? 1 : 0);

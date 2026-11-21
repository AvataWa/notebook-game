// 满栏刷新、备用库入库与可取消二次确认替换专项测试
const fs = require('fs');
const files = [
  'battle-config.js', 'enemy-config.js', 'content-config.js', 'main.js', 'build-runtime.js',
  'hades-runtime.js', 'hades-weapons-runtime.js', 'weapon-passives-expansion.js',
  'form-passives-runtime.js', 'evolution-runtime.js', 'support-expansion-runtime.js', 'elemental-support-runtime.js',
  'trigger-support-runtime.js', 'build-view.js', 'meta-config.js', 'character-config.js',
  'dive-counter-runtime.js', 'combat-feel-runtime.js', 'equipment-rework-runtime.js',
  'meta-runtime.js', 'character-runtime.js', 'ui-copy.js', 'ui-detail-runtime.js',
  'desktop-runtime.js', 'loadout-runtime.js', 'acquisition-runtime.js', 'option-director-runtime.js'
];
const src = files.map(f => fs.readFileSync(__dirname + '/' + f, 'utf8').replace("'use strict';", '')).join('\n');
const fakeCtx = new Proxy({}, { get(t, k) {
  if (k === 'measureText') return txt => ({ width: String(txt).length * 10 });
  return () => {};
}, set() { return true; } });
const fakeCanvas = {
  getContext: () => fakeCtx, width: 0, height: 0, style: {}, addEventListener() {},
  setPointerCapture() {}, releasePointerCapture() {},
  getBoundingClientRect: () => ({ left: 0, top: 0, right: 375, bottom: 667, width: 375, height: 667 })
};
const stored = Object.create(null), windowListeners = Object.create(null);
global.localStorage = { getItem: k => stored[k] || null, setItem: (k, v) => { stored[k] = String(v); }, removeItem: k => { delete stored[k]; } };
global.window = global;
global.PointerEvent = function PointerEvent() {};
Object.assign(global, {
  addEventListener(type, fn) { (windowListeners[type] ||= []).push(fn); },
  devicePixelRatio: 1, innerWidth: 375, innerHeight: 667, matchMedia: () => ({ matches: true })
});
global.document = { getElementById: () => fakeCanvas, createElement: () => fakeCanvas };
global.requestAnimationFrame = () => {};
function fireWindow(type, props = {}) {
  const e = Object.assign({ clientX: 0, clientY: 0, pointerId: 1, button: 0,
    preventDefault() { this.defaultPrevented = true; }, stopImmediatePropagation() { this.stopped = true; } }, props);
  for (const fn of (windowListeners[type] || []).slice()) { fn(e); if (e.stopped) break; }
  return e;
}
eval(src + `\n;globalThis.G = { render, buildOptions, applyOption, weightedOptionPicks,
  get player() { return player; }, get state() { return state; }, set state(v) { state = v; },
  get cards() { return cards; }, set cards(v) { cards = v; },
  get levelupPickAfter() { return levelupPickAfter; }, set levelupPickAfter(v) { levelupPickAfter = v; },
  get M() { return window.__metaRuntime; }, get C() { return window.CharacterRuntime; },
  get L() { return window.LoadoutRuntime; }, get A() { return window.AcquisitionRuntime; }
};`);
let failed = 0, passed = 0;
const realRandom = Math.random;
function test(name, fn) { try { fn(); passed++; console.log('OK  ' + name); } catch (e) { failed++; console.log('ERR ' + name + ': ' + e.stack.split('\n')[0]); } finally { Math.random = realRandom; } }
function assert(ok, msg) { if (!ok) throw new Error(msg); }
function active(id, lvl = 1, supports = []) { return { id, lvl, supports, t: 1.25, uc: 4 }; }
function fresh(id = 'draft') {
  Math.random = realRandom;
  G.M.resetAll(); G.C.selectCharacter(id); G.M.beginRun(false);
  if (G.state === 'levelup') G.state = 'play';
  G.player.actives = [active('ruler', 5, [{ id: 'brutal', lvl: 5 }, { id: 'swift', lvl: 5 }, { id: 'unleash', lvl: 5 }, { id: 'focus', lvl: 5 }]),
    active('cyclone', 5), active('arc', 5), active('spark', 5)];
  G.L.ensureReserve().fill(null);
  G.state = 'levelup'; G.levelupPickAfter = 0;
  return G.player;
}
function activeCard(id = 'cola') { return { kind: 'active', id, acquire: true, storeOnly: true, weight: 0.65, name: id, desc: '' }; }
function supportCard(sup = 'dot', skill = 'ruler') { return { kind: 'support', sup, skill, acquire: true, storeOnly: true, weight: 0.65, name: sup, desc: '' }; }
function fillReserve(p, kind = 'support') {
  const ids = ['wide', 'dot', 'onkill', 'oncrit'];
  p.reserve = ids.map((id, i) => kind === 'active'
    ? { kind, value: active(['boomerang', 'candle', 'brand', 'chalk'][i], 3, [{ id: 'wide', lvl: 2 }]) }
    : { kind, value: { id, lvl: i + 1 } });
}
const A = i => ({ type: 'active', index: i });
const S = (a, s) => ({ type: 'support', activeIndex: a, supportIndex: s });
const R = i => ({ type: 'reserve', index: i });

test('满主动仍刷新未拥有主动，场上和备用库主动不重复', () => {
  const p = fresh(); p.reserve[0] = { kind: 'active', value: active('cola', 4) };
  Math.random = () => 0; G.buildOptions();
  const acquired = G.cards.filter(c => c.kind === 'active');
  assert(acquired.length > 0 && acquired.every(c => c.acquire && c.storeOnly), '满主动后没有新主动入库卡');
  assert(acquired.every(c => c.weight === 0.65 && c.id !== 'cola' && !p.actives.some(a => a.id === c.id)), '新主动权重或去重错误');
  assert(acquired.every(c => c.tag === '[新主动·入库]'), '新主动缺少入库标识');
});

test('满辅助仍刷新未拥有辅助，满级辅助不出升级卡', () => {
  const p = fresh(); p.actives = [p.actives[0]];
  let found = null;
  for (let i = 0; i < 300 && !found; i++) { G.buildOptions(); found = G.cards.find(c => c.kind === 'support' && c.acquire); }
  assert(found && found.weight === 0.65 && found.storeOnly, '满辅助后没有 65% 权重的新辅助入库卡');
  assert(!G.cards.some(c => c.kind === 'support+'), '满级辅助仍刷新升级卡');
  assert(found.tag === '[新辅助·入库]', '新辅助缺少入库标识');
});

test('加权不重复抽取采用 0.65 与 1 的相对权重', () => {
  const pool = [{ id: 'new', weight: 0.65 }, { id: 'normal', weight: 1 }];
  Math.random = () => 0; assert(G.weightedOptionPicks(pool, 1)[0].id === 'new', '低随机数未按权重命中新卡');
  Math.random = () => 0.7; assert(G.weightedOptionPicks(pool, 1)[0].id === 'normal', '普通卡权重未生效');
  Math.random = () => 0.4;
  const picks = G.weightedOptionPicks(pool, 5);
  assert(picks.length === 2 && new Set(picks.map(c => c.id)).size === 2 && pool.length === 2, '抽卡重复或修改了原选项池');
});

test('空备用库自动入库主动，场上构筑不变且新技能为 Lv.1', () => {
  const p = fresh(), before = JSON.stringify(p.actives);
  G.cards = [activeCard()]; assert(G.applyOption(0), '主动入库未生效');
  assert(G.state === 'play' && G.cards.length === 0 && JSON.stringify(p.actives) === before, '入库错误改变场上主动或选卡状态');
  assert(p.reserve[0].kind === 'active' && p.reserve[0].value.id === 'cola' && p.reserve[0].value.lvl === 1 && p.reserve[0].value.supports.length === 0, '主动备用对象结构错误');
});

test('空备用库自动入库辅助，非入库卡仍走原有装备规则', () => {
  const p = fresh(); G.cards = [supportCard()]; G.applyOption(0);
  assert(p.reserve[0].kind === 'support' && p.reserve[0].value.id === 'dot' && p.reserve[0].value.lvl === 1, '辅助未以 Lv.1 入库');
  p.actives = p.actives.slice(0, 3); p.reserve.fill(null); G.state = 'levelup';
  G.cards = [{ kind: 'active', id: 'cola', name: '可乐', desc: '' }]; G.applyOption(0);
  assert(p.actives.length === 4 && p.actives[3].id === 'cola' && p.reserve.every(x => !x), '普通新主动被错误拦截入库');
});

test('满库取消恢复原有选项且不消耗升级机会', () => {
  const p = fresh(); fillReserve(p); p.goldT = 0;
  const original = [activeCard(), { kind: 'heal', name: '恢复生命' }], before = JSON.stringify(p.actives);
  G.cards = original; G.applyOption(0);
  assert(G.state === 'acquireReplace' && G.A.pending && G.cards === original && G.A.targets().length === 4, '满库未进入替换页或原卡丢失');
  assert(G.A.cancel() && G.state === 'levelup' && G.cards === original && !G.A.pending && G.levelupPickAfter === 0, '取消没有恢复原选卡');
  assert(JSON.stringify(p.actives) === before && p.goldT === 0, '取消消耗了升级或改变构筑');
});

test('主动替换必须先选目标再确认，等级重置且旧辅助消失', () => {
  const p = fresh(); fillReserve(p); const before = JSON.stringify(p.actives);
  G.cards = [activeCard()]; G.applyOption(0);
  assert(!G.A.confirm() && JSON.stringify(p.actives) === before, '未选目标也能确认替换');
  assert(G.A.selectTarget(A(0)) && JSON.stringify(p.actives) === before, '第一次点选目标就直接替换');
  assert(G.A.confirm() && G.state === 'play' && !G.A.pending, '确认替换未完成');
  assert(p.actives[0].id === 'cola' && p.actives[0].lvl === 1 && p.actives[0].supports.length === 0, '替换主动继承等级或旧辅助未清除');
});

test('辅助只能替换适配目标，同名辅助所在主动不可重复镶嵌', () => {
  const p = fresh(); p.actives = [active('ruler', 5, [{ id: 'wide', lvl: 3 }]), active('spark', 5, [{ id: 'wide', lvl: 4 }, { id: 'sharpen', lvl: 2 }])];
  fillReserve(p); G.cards = [supportCard('sharpen', 'spark')]; G.applyOption(0);
  const list = G.A.targets();
  assert(!list.some(t => t.ref.type === 'support' && t.ref.activeIndex === 0), '打击范围主动错误接受子弹辅助');
  assert(!list.some(t => t.ref.type === 'support' && t.ref.activeIndex === 1 && t.ref.supportIndex === 0), '其他辅助槽可造成同名重复：' + JSON.stringify(list));
  assert(list.some(t => t.ref.type === 'support' && t.ref.activeIndex === 1 && t.ref.supportIndex === 1), '同名旧辅助自身不能作为替换目标');
  assert(!G.A.selectTarget(S(0, 0)), '不适配辅助目标仍可选择');
  assert(list.some(t => t.ref.type === 'reserve'), '兼容的备用辅助未列为可替换目标');
  assert(G.A.selectTarget(R(0)) && G.A.confirm() && p.reserve[0].value.id === 'sharpen' && p.reserve[0].value.lvl === 1, '备用辅助替换或等级重置失败');
});

test('一笔到底满一主动八辅助仍可获得入库卡', () => {
  const p = fresh('single');
  p.actives = [active('ruler', 12, [{ id: 'brutal', lvl: 5 }, { id: 'swift', lvl: 5 }, { id: 'unleash', lvl: 5 }, { id: 'focus', lvl: 5 },
    { id: 'wide', lvl: 5 }, { id: 'dot', lvl: 5 }, { id: 'giant', lvl: 5 }, { id: 'repeat', lvl: 5 }])];
  Math.random = () => 0; G.buildOptions();
  assert(G.cards.some(c => c.kind === 'active' && c.acquire), '一笔到底满主动后不再刷新新主动');
  Math.random = realRandom;
  let support = null;
  for (let i = 0; i < 300 && !support; i++) { G.buildOptions(); support = G.cards.find(c => c.kind === 'support' && c.acquire); }
  assert(support, '一笔到底满八辅助后不再刷新新辅助');
  assert(G.L.ensureReserve().length === 4 && p.actives.length === 1 && p.actives[0].supports.length === 8, '一笔到底槽位上限被改变');
});

test('选卡输入锁与新局清理替换状态均有效', () => {
  const p = fresh(); G.cards = [activeCard()]; G.levelupPickAfter = Date.now() + 10000;
  assert(G.applyOption(0) === false && G.state === 'levelup' && p.reserve.every(x => !x), '输入锁期间仍能入库');
  G.levelupPickAfter = 0; fillReserve(p); G.applyOption(0); assert(G.state === 'acquireReplace', '替换页前置状态失败');
  G.M.beginRun(false); assert(!G.A.pending && G.state !== 'acquireReplace', '新局残留替换状态');
});

test('手机替换页点选与确认按钮可完成完整操作', () => {
  const p = fresh(); fillReserve(p); G.cards = [activeCard()]; G.applyOption(0); G.render();
  const hits = G.A.hits; assert(hits.length >= 6, '替换页没有绘制目标与按钮');
  const target = hits[0].rect; fireWindow('pointerdown', { clientX: target.x + 5, clientY: target.y + 5 });
  assert(G.A.selected && G.A.selected.type === 'active', '手机点选替换目标无响应');
  G.render(); const updated = G.A.hits, confirm = updated[updated.length - 1];
  assert(confirm.enabled, '选择目标后确认按钮仍不可用');
  fireWindow('pointerdown', { clientX: confirm.rect.x + 5, clientY: confirm.rect.y + 5 });
  assert(G.state === 'play' && p.actives[0].id === 'cola' && p.actives[0].lvl === 1, '手机确认按钮未完成替换');
});

test('桌面二十个替换目标分两页绘制，分页与底部按钮不重叠', () => {
  const oldWidth = global.innerWidth, oldHeight = global.innerHeight, oldMatch = global.matchMedia;
  try {
    const p = fresh(), sets = [['brutal', 'swift', 'focus', 'wide'], ['brutal', 'swift', 'focus', 'pierce'],
      ['brutal', 'swift', 'focus', 'chain'], ['brutal', 'swift', 'focus', 'projspd']];
    p.actives.forEach((a, i) => { a.supports = sets[i].map((id, j) => ({ id, lvl: j + 1 })); });
    fillReserve(p); global.innerWidth = 1280; global.innerHeight = 720; global.matchMedia = () => ({ matches: false });
    fireWindow('resize'); G.cards = [supportCard('unleash')]; G.applyOption(0); G.render();
    assert(DesktopRuntime.active && G.A.targets().length === 20 && G.A.page === 0, '桌面替换目标或分页数量错误');
    const hits = G.A.hits, next = hits[13], cancel = hits[14];
    assert(hits.length === 16 && next.rect.y + next.rect.h <= cancel.rect.y, '分页按钮与底部操作重叠');
    G.A.setPage(1); G.render();
    assert(G.A.page === 1 && G.A.hits.length === 12, '第二页目标或按钮绘制不完整');
  } finally {
    global.innerWidth = oldWidth; global.innerHeight = oldHeight; global.matchMedia = oldMatch; fireWindow('resize');
  }
});

console.log(failed ? 'ACQUISITION_TEST_FAILURES: ' + failed : 'ACQUISITION_TEST_OK (' + passed + '/' + passed + ')');
process.exit(failed ? 1 : 0);

// 局内备用库与拖动交换：数据完整性、适配限制和角色槽位专项测试
const fs = require('fs');
const files = [
  'battle-config.js', 'enemy-config.js', 'content-config.js', 'main.js', 'build-runtime.js',
  'hades-runtime.js', 'hades-weapons-runtime.js', 'weapon-passives-expansion.js',
  'form-passives-runtime.js', 'support-expansion-runtime.js', 'elemental-support-runtime.js',
  'trigger-support-runtime.js', 'build-view.js', 'meta-config.js', 'character-config.js',
  'dive-counter-runtime.js', 'combat-feel-runtime.js', 'equipment-rework-runtime.js',
  'meta-runtime.js', 'character-runtime.js', 'ui-copy.js', 'ui-detail-runtime.js',
  'desktop-runtime.js', 'loadout-runtime.js'
];
const src = files.map(f => fs.readFileSync(__dirname + '/' + f, 'utf8').replace("'use strict';", '')).join('\n');
const fakeCtx = new Proxy({}, { get(t, k) {
  if (k === 'measureText') return txt => ({ width: String(txt).length * 10 });
  return () => {};
}, set() { return true; } });
const fakeCanvas = {
  getContext: () => fakeCtx, width: 0, height: 0, style: {}, addEventListener() {},
  getBoundingClientRect: () => ({ left: 0, top: 0, width: 375, height: 667 })
};
const stored = Object.create(null);
global.localStorage = { getItem: k => stored[k] || null, setItem: (k, v) => { stored[k] = String(v); }, removeItem: k => { delete stored[k]; } };
global.window = global;
Object.assign(global, { addEventListener() {}, devicePixelRatio: 1, innerWidth: 375, innerHeight: 667, matchMedia: () => ({ matches: true }) });
global.document = { getElementById: () => fakeCanvas, createElement: () => fakeCanvas };
global.requestAnimationFrame = () => {};
eval(src + `\n;globalThis.G = { render, supportUsable,
  get player() { return player; }, get state() { return state; }, set state(v) { state = v; },
  get M() { return window.__metaRuntime; }, get C() { return window.CharacterRuntime; }, get L() { return window.LoadoutRuntime; }
};`);
let failed = 0, passed = 0;
function test(name, fn) { try { fn(); passed++; console.log('OK  ' + name); } catch (e) { failed++; console.log('ERR ' + name + ': ' + e.stack.split('\n')[0]); } }
function assert(ok, msg) { if (!ok) throw new Error(msg); }
function active(id, lvl = 1, supports = []) { return { id, lvl, supports, t: 1.25, uc: 4 }; }
function fresh(id = 'draft') {
  G.M.resetAll(); G.C.selectCharacter(id); G.M.beginRun(false);
  if (G.state === 'levelup') G.state = 'play';
  G.player.actives = [active('ruler', 3, [{ id: 'wide', lvl: 2 }]), active('cyclone', 2, [{ id: 'swift', lvl: 1 }])];
  return G.player;
}
const A = i => ({ type: 'active', index: i });
const S = (a, s) => ({ type: 'support', activeIndex: a, supportIndex: s });
const R = i => ({ type: 'reserve', index: i });

test('主动进入空备用格，等级、冷却和辅助对象完整保留', () => {
  const p = fresh(), original = p.actives[0];
  assert(G.L.move(A(0), R(0)) && p.actives.length === 1 && p.actives[0].id === 'cyclone', '主动移出后场上顺序错误');
  assert(G.L.readSlot(R(0)).value === original && original.lvl === 3 && original.t === 1.25 && original.uc === 4, '主动等级或冷却状态丢失');
  assert(original.supports.length === 1 && original.supports[0].id === 'wide' && original.supports[0].lvl === 2, '主动携带辅助丢失');
});

test('备用主动回到场上，以及已装备主动互换位置', () => {
  const p = fresh(), ruler = p.actives[0], cyclone = p.actives[1];
  G.L.move(A(0), R(0)); assert(G.L.move(R(0), A(1)), '备用主动无法回到空主动位');
  assert(p.actives[0] === cyclone && p.actives[1] === ruler, '备用主动回场位置错误');
  assert(G.L.move(A(0), A(1)) && p.actives[0] === ruler && p.actives[1] === cyclone, '两个主动没有互换');
});

test('主动落到目标卡的辅助区域仍交换两个主动', () => {
  const p = fresh(), ruler = p.actives[0], cyclone = p.actives[1];
  const target = G.L.resolveDropTarget(A(0), S(1, 0));
  assert(target.type === 'active' && target.index === 1, '主动落点没有归并到目标主动卡');
  assert(G.L.move(A(0), target) && p.actives[0] === cyclone && p.actives[1] === ruler, '落到辅助区域时主动仍未交换');
});

test('辅助落到主动卡标题或空白处时进入第一个空辅助槽', () => {
  const p = fresh();
  const target = G.L.resolveDropTarget(S(0, 0), A(1));
  assert(target.type === 'support' && target.activeIndex === 1 && target.supportIndex === 1, '辅助没有定位到目标主动的空槽');
  assert(G.L.move(S(0, 0), target) && p.actives[1].supports[1].id === 'wide' && p.actives[0].supports.length === 0, '辅助拖到主动卡空白处未生效');
  p.actives[1].supports = Array.from({ length: 4 }, () => ({ id: 'swift', lvl: 1 }));
  assert(G.L.resolveDropTarget(S(1, 0), A(1)).type === 'active', '辅助栏已满时落点规则异常');
});

test('辅助跨主动移动与交换均保留等级', () => {
  const p = fresh();
  assert(G.L.move(S(0, 0), S(1, 1)), '辅助无法移到另一主动的空槽');
  assert(p.actives[0].supports.length === 0 && p.actives[1].supports[1].id === 'wide' && p.actives[1].supports[1].lvl === 2, '辅助移动或等级保留错误');
  assert(G.L.move(S(1, 0), S(1, 1)), '同一主动内辅助互换失败');
  assert(p.actives[1].supports[0].id === 'wide' && p.actives[1].supports[1].id === 'swift', '同一主动内辅助顺序错误');
  assert(G.L.move(S(1, 0), S(0, 0)), '辅助无法跨主动交换到空位');
});

test('不适配、重复辅助与主动辅助类型错配均安全拒绝', () => {
  const p = fresh();
  p.actives[1].supports = [{ id: 'wide', lvl: 1 }];
  assert(!G.L.move(S(0, 0), S(1, 1)) && p.actives[0].supports[0].lvl === 2 && p.actives[1].supports.length === 1, '同名辅助被重复镶嵌');
  p.actives[0].supports = [{ id: 'sharpen', lvl: 4 }];
  assert(!G.L.move(S(0, 0), S(1, 1)) && p.actives[0].supports[0].id === 'sharpen', '不适配辅助被移动');
  const before = JSON.stringify(p.actives);
  assert(!G.L.move(A(0), S(1, 0)) && JSON.stringify(p.actives) === before, '主动被塞入辅助位');
  assert(!G.L.move(S(0, 0), A(3)) && JSON.stringify(p.actives) === before, '辅助被塞入主动位');
});

test('备用库满时拖到已有格执行互换，不覆盖吞掉技能', () => {
  const p = fresh(), ruler = p.actives[0], arc = active('arc', 4);
  p.reserve = [
    { kind: 'active', value: arc },
    { kind: 'support', value: { id: 'swift', lvl: 3 } },
    { kind: 'active', value: active('cola', 2) },
    { kind: 'support', value: { id: 'onkill', lvl: 1 } }
  ];
  assert(G.L.move(A(0), R(0)), '满备用库不能互换');
  assert(p.reserve[0].kind === 'active' && p.reserve[0].value === ruler, '备用格没有获得场上主动');
  assert(p.actives.length === 2 && p.actives[0] === arc && p.actives[1].id === 'cyclone', '换入主动未回到场上');
  assert(p.reserve[0].value.lvl === 3 && p.reserve[0].value.supports[0].id === 'wide', '换出主动的等级或辅助丢失');
});

test('备用库中的辅助可镶嵌，场上辅助也可存入备用格', () => {
  const p = fresh();
  p.reserve[0] = { kind: 'support', value: { id: 'brutal', lvl: 5 } };
  assert(G.L.move(R(0), S(0, 1)) && !p.reserve[0], '备用辅助无法镶嵌');
  assert(p.actives[0].supports[1].id === 'brutal' && p.actives[0].supports[1].lvl === 5, '备用辅助等级丢失');
  assert(G.L.move(S(0, 1), R(2)) && p.reserve[2].value.id === 'brutal' && p.actives[0].supports.length === 1, '场上辅助无法存入备用库');
});

test('一笔到底仍限制一个主动并开放八个辅助槽', () => {
  const p = fresh('single');
  p.actives = [active('ruler', 8, Array.from({ length: 7 }, () => ({ id: 'wide', lvl: 1 })))];
  const original = p.actives[0];
  assert(!G.L.canMove(R(0), A(1)), '一笔到底出现第二个主动槽');
  assert(G.L.move(A(0), R(0)) && p.actives.length === 0 && G.L.move(R(0), A(0)), '唯一主动不能移出并放回');
  assert(p.actives[0] === original && G.L.canAccept(S(0, 7), { kind: 'support', value: { id: 'onkill', lvl: 2 } }), '八辅助上限未生效');
});

test('普通新局与 Boss 新局都会清空备用库', () => {
  const p = fresh(); p.reserve[0] = { kind: 'active', value: p.actives[0] };
  G.M.beginRun(false); assert(G.player.reserve.length === 4 && G.player.reserve.every(x => x === null), '普通新局继承备用库');
  G.player.reserve[1] = { kind: 'support', value: { id: 'wide', lvl: 1 } };
  G.M.beginBossTest(2); assert(G.player.reserve.every(x => x === null), 'Boss 新局继承备用库');
});

console.log(failed ? 'LOADOUT_TEST_FAILURES: ' + failed : 'LOADOUT_TEST_OK (' + passed + '/' + passed + ')');
process.exit(failed ? 1 : 0);

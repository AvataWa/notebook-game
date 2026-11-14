// 部位装备经验、单局成长重置、装备继承与拾取防误触专项测试
const fs = require('fs');
const files = ['battle-config.js', 'enemy-config.js', 'content-config.js', 'main.js', 'build-runtime.js', 'build-view.js', 'meta-config.js', 'meta-runtime.js', 'ui-copy.js', 'ui-detail-runtime.js'];
const src = files.map(f => fs.readFileSync(__dirname + '/' + f, 'utf8').replace("'use strict';", '')).join('\n');
const fakeCtx = new Proxy({}, { get(t, k) {
  if (k === 'measureText') return txt => ({ width: String(txt).length * 10 });
  return () => {};
}, set() { return true; } });
const fakeCanvas = { getContext: () => fakeCtx, width: 0, height: 0, style: {}, addEventListener() {}, getBoundingClientRect: () => ({ left: 0, top: 0, width: 375, height: 667 }) };
const stored = {};
global.localStorage = { getItem: k => Object.prototype.hasOwnProperty.call(stored, k) ? stored[k] : null, setItem: (k, v) => { stored[k] = String(v); }, removeItem: k => { delete stored[k]; } };
global.window = { addEventListener() {}, devicePixelRatio: 1, innerWidth: 375, innerHeight: 667 };
global.document = { getElementById: () => fakeCanvas }; global.requestAnimationFrame = () => {};
eval(src + `
;globalThis.G = {
  resetGame, update, recomputeEquip, itemV,
  get BATTLE() { return BATTLE; }, get player() { return player; },
  get drops() { return drops; }, set drops(v) { drops = v; },
  get state() { return state; }, set state(v) { state = v; },
  get pendingEquipment() { return pendingEquipment; },
  get runtime() { return window.__buildRuntime; }, get meta() { return window.__metaRuntime; }
};`);
const M = G.meta;
let failed = 0, passed = 0;
function test(name, fn) { try { fn(); passed++; console.log('OK  ' + name); } catch (e) { failed++; console.log('ERR ' + name + ': ' + e.stack.split('\n')[0]); } }
function assert(ok, msg) { if (!ok) throw new Error(msg); }
function fresh() { M.resetAll(); M.beginRun(false); G.state = 'play'; G.player.xpNext = 999999; G.player.actives = []; }
function wear(key, rarity = 0) { const slot = G.player.equip.hands && key ? 'hands' : 'hands'; G.player.equip[slot] = { key, rarity }; G.recomputeEquip(); }

test('普通与同名经验按曲线升级，特殊词条不被部位等级放大', () => {
  fresh();
  const normal = M.recordEquipment({ item: 'glove', rarity: 0 });
  assert(normal.xp === 1 && M.run.growth.hands.level === 0 && M.run.growth.hands.xp === 1, '普通装备不是 1 点经验');
  const duplicate = M.recordEquipment({ item: 'glove', rarity: 0, duplicate: true });
  assert(duplicate.xp === 2 && M.run.growth.hands.level === 1 && M.run.growth.hands.xp === 1, '同名额外经验或溢出保留错误');
  wear('glove', 0);
  assert(G.player.eqAtk === 11 && G.player.eqCrit === 0.15 && G.itemV('glove', 'crit', 15) === 15, '基础攻击或暴击特殊词条倍率错误');
});

test('不同装备保留与替换都入账，0/499ms 拒绝且 500ms 解锁', () => {
  fresh(); wear('glove', 0);
  const realNow = Date.now; let now = 10000; Date.now = () => now;
  try {
    G.drops = [{ x: 0, y: 0, item: 'compass', rarity: 1, bob: 0 }];
    G.runtime.collectEquipment(G.drops[0]);
    assert(!G.runtime.resolveEquipment(false), '0ms 可以保留');
    now += 499; assert(!G.runtime.resolveEquipment(false), '499ms 可以保留');
    now += 1; assert(G.runtime.resolveEquipment(false), '500ms 无法保留');
    assert(G.player.equip.hands.key === 'glove' && M.run.growth.hands.level === 1 && M.run.growth.hands.xp === 0, '保留装备未获得 2 点经验');
    G.drops = [{ x: 0, y: 0, item: 'compass', rarity: 2, bob: 0 }];
    G.runtime.collectEquipment(G.drops[0]);
    assert(!G.runtime.resolveEquipment(true), '第二次替换未锁定');
    now += 500; assert(G.runtime.resolveEquipment(true), '第二次替换解锁失败');
    assert(G.player.equip.hands.key === 'compass' && M.run.growth.hands.level === 2 && M.run.growth.hands.xp === 0, '替换装备经验或部位等级错误');
  } finally { Date.now = realNow; }
});

test('本局换装共用部位等级，下局与重铸后成长归零但装备仍继承', () => {
  fresh(); M.recordEquipment({ item: 'glove', rarity: 0 }); M.settleRun(false); M.continueSettlement();
  M.toggleSettlement(M.settlement.found[0].uid); M.finishSettlement();
  assert(M.setInherited('glove', 0), '继承设置失败');
  M.beginRun(false);
  assert(G.player.equip.hands.key === 'glove', '下局没有穿上继承装备');
  assert(G.player.equipGrowth.hands.level === 0 && G.player.equipGrowth.hands.xp === 0, '下局错误继承部位成长');
  M.recordEquipment({ item: 'glove', rarity: 1 });
  assert(G.player.equipGrowth.hands.level === 1 && G.player.equipGrowth.hands.xp === 0, '本局部位成长失效');
  M.settleRun(false); M.continueSettlement(); M.finishSettlement(); M.data.paper = 99;
  assert(M.reforge('glove', 0) && M.data.equipment.hands.level === 0 && M.data.equipment.hands.xp === 0, '重铸后部位成长未归零');
  const next = M.data.inherited.key;
  assert(next !== 'glove', '重铸没有同步继承装备');
  M.beginRun(false);
  assert(G.player.equip.hands.key === next && G.player.equipGrowth.hands.level === 0 && G.player.equipGrowth.hands.xp === 0, '重铸后的装备继承或成长重置错误');
});

test('失败结算不保留部位经验，未装订不碎纸且装订不重复经验', () => {
  fresh(); M.recordEquipment({ item: 'glove', rarity: 1 }); M.settleRun(false);
  assert(M.settlement.growth.hands.level === 1 && M.settlement.growth.hands.xp === 0, '结算回顾没有保留本局成长');
  assert(M.data.equipment.hands.level === 0 && M.data.equipment.hands.xp === 0 && M.data.paper === 0, '失败结算保留了经验或错误碎纸');
  M.continueSettlement(); M.toggleSettlement(M.settlement.found[0].uid);
  const before = JSON.stringify(M.data.equipment);
  M.finishSettlement();
  assert(JSON.stringify(M.data.equipment) === before && M.data.inventory.length === 1 && M.data.paper === 0, '装订重复发放经验或碎纸');
});

test('本局满级史诗溢出折算 25 碎纸，结算后局外成长归零', () => {
  fresh(); M.run.growth.hands = { level: 10, xp: 0 }; G.player.equipGrowth = M.run.growth;
  const found = M.recordEquipment({ item: 'glove', rarity: 3 });
  assert(found.xp === 5 && found.paper === 25 && found.levels === 0, '满级史诗溢出折算错误');
  M.settleRun(false);
  assert(M.data.paper === 25 && M.data.equipment.hands.level === 0 && M.data.equipment.hands.xp === 0, '满级碎纸或成长重置错误');
});

test('装备拾取距离 39 生效、41 不生效', () => {
  fresh(); G.drops = [{ x: 39, y: 0, item: 'glove', rarity: 0, bob: 0 }]; G.update(0.016);
  assert(G.drops.length === 0 && M.run.growth.hands.xp === 1, '距离 39 未拾取');
  fresh(); G.drops = [{ x: 41, y: 0, item: 'glove', rarity: 0, bob: 0 }]; G.update(0.016);
  assert(G.drops.length === 1 && M.run.growth.hands.xp === 0 && !G.player.equip.hands, '距离 41 被错误拾取');
});

test('版本 2 存档保留五部位结构且成长始终为零', () => {
  fresh(); M.save();
  const parsed = JSON.parse(stored['notebook-meta-v1']);
  assert(parsed.version === 2, '存档版本错误');
  assert(['head', 'body', 'hands', 'feet', 'acc'].every(slot => parsed.equipment[slot] && parsed.equipment[slot].level === 0 && parsed.equipment[slot].xp === 0), '存档部位缺失或成长未归零');
});

console.log(failed ? 'EQUIPMENT_GROWTH_TEST_FAILURES: ' + failed : 'EQUIPMENT_GROWTH_TEST_OK (' + passed + '/' + passed + ')');
process.exit(failed ? 1 : 0);

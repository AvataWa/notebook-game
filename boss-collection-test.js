// 19 套 Boss 装备：配置、正式掉落、永久材料、制作、重描、兑换、穿戴与练习隔离。
const fs = require('fs');
const files = ['battle-config.js', 'enemy-config.js', 'content-config.js', 'boss-collection-config.js', 'main.js', 'build-runtime.js', 'build-view.js',
  'equipment-rework-runtime.js', 'boss-set-runtime.js', 'build-optimization-runtime.js', 'boss-collection-runtime.js',
  'boss-set-mechanics-a.js', 'boss-set-mechanics-b.js', 'meta-config.js', 'meta-runtime.js'];
const src = files.map(f => fs.readFileSync(__dirname + '/' + f, 'utf8').replace("'use strict';", '')).join('\n');
const drawTexts = [];
const fakeCtx = new Proxy({}, { get(t, k) { if (k === 'measureText') return txt => ({ width: String(txt).length * 7 }); if (k === 'fillText') return txt => { drawTexts.push(String(txt)); }; return () => {}; }, set() { return true; } });
const fakeCanvas = { getContext: () => fakeCtx, width: 0, height: 0, style: {}, addEventListener() {}, getBoundingClientRect: () => ({ left: 0, top: 0, width: 375, height: 667 }) };
const stored = {};
global.localStorage = { getItem: k => stored[k] || null, setItem: (k, v) => { stored[k] = String(v); }, removeItem: k => { delete stored[k]; } };
global.window = { addEventListener() {}, devicePixelRatio: 1, innerWidth: 375, innerHeight: 667 };
global.document = { getElementById: () => fakeCanvas, createElement: () => fakeCanvas }; global.requestAnimationFrame = () => {};
eval(src + `
;globalThis.G = {
  resetGame, render, update, skillCalc, fireSkill, hurtEnemy, hurtPlayer, spawnEnemy, spawnBoss, killEnemy, recomputeEquip,
  makeEquipmentDrop, collectEquipment: window.__buildRuntime.collectEquipment,
  get ITEM_DEFS() { return ITEM_DEFS; }, get ITEM_KEYS() { return EQUIPMENT_ITEM_KEYS; },
  get player() { return player; }, set player(v) { player = v; }, get enemies() { return enemies; }, get drops() { return drops; }, set drops(v) { drops = v; },
  get state() { return state; }, set state(v) { state = v; }, get meta() { return window.__metaRuntime; },
  get stages() { return STAGE_NAMES.length; }, curSt, collection: BOSS_SET_COLLECTION
};`);
const B = window.BossSetRuntime, R = window.BossCollectionRuntime, C = G.collection, M = G.meta;
global.BossSetRuntime = B; global.BossCollectionRuntime = R; global.BuildOptimizationRuntime = window.BuildOptimizationRuntime;
let failed = 0, passed = 0;
function test(name, fn) { try { fn(); passed++; console.log('OK  ' + name); } catch (e) { failed++; console.log('ERR ' + name + ': ' + e.stack.split('\n').slice(0, 2).join('\n')); } }
function assert(ok, msg) { if (!ok) throw new Error(msg); }
function fresh() { M.resetAll(); M.beginRun(); G.state = 'play'; G.player.xpNext = 999999; G.drops = []; }
function give(key, roll = 100) { M.addInventory({ key, rarity: 3, roll, rerollFloor: 50 }); return M.data.inventory.find(x => x.key === key); }

test('19 套共 95 件，五部位完整且全部金色制作，普通池严格隔离', () => {
  assert(C.list.length === 19 && C.list.every(s => s.all.length === 5 && s.purple.length === 0 && s.gold.length === 5), '套装数量错误');
  const keys = C.list.flatMap(s => s.all); assert(new Set(keys).size === 95 && keys.every(k => G.ITEM_KEYS.includes(k)), '装备键未进入装备系统');
  for (const set of C.list) {
    assert(new Set(set.all.map(k => G.ITEM_DEFS[k].slot)).size === 5, set.id + ' 五部位不完整');
    assert(set.all.every(k => G.ITEM_DEFS[k].bossSet === set.id && G.ITEM_DEFS[k].bossStage === set.stage && G.ITEM_DEFS[k].craftOnly), set.id + ' 来源错误');
  }
  fresh(); for (let i = 0; i < 300; i++) { const dr = G.makeEquipmentDrop(0, 0); assert((dr.rarity === 0 || dr.rarity === 1) && !G.ITEM_DEFS[dr.item].bossSet, '普通池出现专属或紫金'); }
  assert(G.stages === 20, '主线不是二十页');
});

test('普通装备第 5 页开放紫装、第 10 页开放金装，品质边界正确且始终排除 Boss 套装', () => {
  fresh();
  const cases = [
    [1, [[0, 0], [.7199, 0], [.72, 1], [.9999, 1]]],
    [4, [[0, 0], [.72, 1], [.9999, 1]]],
    [5, [[0, 0], [.56, 1], [.88, 2], [.9999, 2]]],
    [9, [[0, 0], [.56, 1], [.88, 2], [.9999, 2]]],
    [10, [[0, 0], [.45, 1], [.77, 2], [.95, 3], [.9999, 3]]],
    [14, [[0, 0], [.45, 1], [.77, 2], [.95, 3], [.9999, 3]]],
    [15, [[0, 0], [.35, 1], [.65, 2], [.9, 3], [.9999, 3]]],
    [20, [[0, 0], [.35, 1], [.65, 2], [.9, 3], [.9999, 3]]]
  ];
  const random = Math.random;
  try {
    for (const [stage, rolls] of cases) {
      G.player.level = stage === 1 ? 1 : stage * 10;
      for (const [roll, expected] of rolls) {
        Math.random = () => roll;
        const dr = G.makeEquipmentDrop(0, 0);
        assert(dr.rarity === expected, '第 ' + stage + ' 页随机值 ' + roll + ' 得到品质 ' + dr.rarity + '，预期 ' + expected);
        assert(!G.ITEM_DEFS[dr.item].bossSet, '第 ' + stage + ' 页普通池出现 Boss 套装');
      }
    }
  } finally { Math.random = random; }
});

test('每个正式主线 Boss 只生成墨核和首次专属制作材料', () => {
  for (const set of C.list) {
    fresh(); const boss = { stage: set.stage, x: 20, y: 30, bossTookHit: false };
    assert(B.spawnBossRewards(boss), set.id + ' 正式奖励未接管');
    const core = G.drops.find(d => d.material === 'cores'), horn = G.drops.find(d => d.material === 'horns');
    assert(!G.drops.some(d => d.kind === 'bossEquip'), set.id + ' 仍直接掉落装备');
    assert(core && core.amount === 3 && horn && horn.amount === 1, set.id + ' 材料错误');
    assert(M.data.bossSets[set.id].kills === 1 && M.data.bossSets[set.id].firstHorn, set.id + ' 奖励进度未保存');
  }
});

test('制作材料实际拾取后永久入库，失败不清除', () => {
  fresh(); const set = C.byId.correction; B.spawnBossRewards({ stage: 2, x: 0, y: 0, bossTookHit: true });
  assert(M.data.bossSets.correction.cores === 0 && !M.data.inventory.some(x => set.all.includes(x.key)), '未拾取已入库');
  for (const dr of G.drops.slice()) if (dr.kind === 'material') B.collectMaterial(dr);
  assert(M.data.bossSets.correction.cores === 2 && M.data.bossSets.correction.horns === 1, '材料拾取数量错误');
  M.settleRun(false); M.continueSettlement(); M.finishSettlement();
  assert(M.data.bossSets.correction.cores === 2 && M.data.bossSets.correction.horns === 1, '失败结算丢材料');
  const saved = JSON.parse(stored['notebook-meta-v1']); assert(saved.bossSets.mother && saved.firstStages && saved.stats.highestStage <= 20, '新套装存档结构缺失');
});

test('全部 95 件金装可制作并正确扣费，重复制作不重复扣费', () => {
  fresh(); M.data.ink = 100000;
  for (const set of C.list) { const d = M.data.bossSets[set.id]; d.cores = 1000; d.horns = 100; }
  const random = Math.random; Math.random = () => 0;
  try { for (const set of C.list) for (const key of set.gold) assert(B.craft(key), key + ' 无法制作'); } finally { Math.random = random; }
  assert(M.data.ink === 100000 - (5 * 40 + 90 * 80), '首五件折扣与后续墨点成本错误');
  assert(C.list.every(s => M.data.bossSets[s.id].cores === 980 && M.data.bossSets[s.id].horns === 95), '材料成本错误');
  assert(C.list.every(s => s.gold.every(k => { const eq = M.data.inventory.find(x => x.key === k); return eq && eq.rarity === 3 && eq.roll === 50; })), '制作品质或词条错误');
  const before = M.data.ink; assert(!B.craft('mothercore') && M.data.ink === before, '重复制作扣费');
});

test('前五件折扣跨套装共享，第六件恢复原价，旧有 Boss 装占用额度', () => {
  fresh(); M.data.ink = 1000;
  for (const id of ['scribble', C.list[0].id, C.list[1].id, C.list[2].id]) Object.assign(M.data.bossSets[id], { cores: 20, horns: 20 });
  const keys = ['scribblecrown', C.list[0].gold[0], C.list[0].gold[1], C.list[1].gold[0], C.list[1].gold[1]];
  const random = Math.random; Math.random = () => 0;
  try {
    keys.forEach((key, i) => { assert(B.craftInkCost() === 40 && B.craft(key), '第 ' + (i + 1) + ' 件未享受折扣'); });
    assert(M.data.ink === 800 && B.craftInkCost() === 80, '五件后未恢复 80 墨点');
    assert(B.craft(C.list[2].gold[0]) && M.data.ink === 720, '第六件原价扣费错误');
  } finally { Math.random = random; }
  fresh(); for (const key of C.list[0].gold) give(key);
  assert(B.craftInkCost() === 80, '旧存档已有五件 Boss 装未占用折扣额度');
});

test('重描只升不降并提供五点保底，全套完美后兑换通用墨核', () => {
  fresh(); const set = C.byId.mother, eq = give('mothercore', 90); M.data.bossSets.mother.horns = 3;
  const random = Math.random; Math.random = () => 0;
  try {
    assert(B.reroll('mothercore') && eq.roll === 90 && eq.rerollFloor === 95, '重描降低数值');
    assert(B.reroll('mothercore') && eq.roll === 95 && eq.rerollFloor === 50, '重描保底失效');
  } finally { Math.random = random; }
  for (const key of set.all) give(key, 100); eq.roll = 100; assert(B.perfectSet('mother') && B.exchange('mother'), '完美兑换未开放');
  assert(M.data.bossSets.mother.cores === 2 && M.data.bossSets.mother.horns === 0, '兑换比例错误');
});

test('十九套均可五部位穿戴，下局统一 Lv.1，局内脱装不污染局外', () => {
  for (const set of C.list) {
    M.resetAll(); for (const key of set.all) give(key); for (const key of set.all) B.toggleEquip(key);
    M.beginRun(); G.state = 'play'; assert(B.setCount(set.id) === 5, set.id + ' 未五件带入');
    assert(Object.values(G.player.equipGrowth).every(g => g.level === 1 && g.xp === 0), set.id + ' 局外等级未归零');
    G.player.equip.head = null; G.recomputeEquip(); assert(M.data.loadout.head && B.setCount(set.id) === 4, set.id + ' 局内换装污染局外');
  }
});

test('后期两件散件金装与三件乱线套装可同时开局，五部位 Lv.1 且三件套激活', () => {
  M.resetAll();
  for (const key of ['cap4', 'glove']) {
    assert(M.addInventory({ key, rarity: 3 }), key + ' 金装未入库');
    assert(M.setInherited(key, 3), key + ' 金装未设为开局穿戴');
  }
  for (const key of ['scribblehide', 'lineboots', 'huntergall']) {
    give(key); assert(B.toggleEquip(key), key + ' 套装部件未穿戴');
  }
  M.beginRun(); G.state = 'play';
  const expected = { head: 'cap4', hands: 'glove', body: 'scribblehide', feet: 'lineboots', acc: 'huntergall' };
  for (const [slot, key] of Object.entries(expected)) {
    const eq = G.player.equip[slot];
    assert(eq && eq.key === key && eq.rarity === 3, slot + ' 未正确带入 ' + key + ' 金装');
    assert(G.player.equipGrowth[slot].level === 1 && G.player.equipGrowth[slot].xp === 0, slot + ' 开局不是 Lv.1');
  }
  assert(!G.ITEM_DEFS[G.player.equip.head.key].bossSet && !G.ITEM_DEFS[G.player.equip.hands.key].bossSet, '两件散件错误属于套装');
  assert(B.setCount('scribble') === 3, '三件乱线套装没有按实际件数激活');
});

test('全部 Boss 练习始终无专属装备、材料及奖励进度', () => {
  for (const set of C.list) {
    M.resetAll(); M.beginBossTest(set.stage); G.state = 'play'; G.drops = [];
    const enemy = G.enemies[G.enemies.length - 1]; G.killEnemy(enemy);
    assert(!G.drops.some(d => d.bossSet === set.id || d.kind === 'material'), set.id + ' 练习仍有收益');
    const d = M.data.bossSets[set.id]; assert(d.kills === 0 && d.cores === 0 && d.horns === 0, set.id + ' 练习仍记进度');
  }
});

test('最终 Boss 等待地面战利品实际拾取后才结算胜利', () => {
  fresh(); G.spawnBoss(20); const boss = G.enemies[G.enemies.length - 1]; boss.hp = 1; G.killEnemy(boss);
  assert(G.state === 'play' && G.drops.some(dr => dr.bossSet === 'mother'), '终页未等待地面奖励');
  for (const dr of G.drops.slice()) { if (dr.kind === 'material') B.collectMaterial(dr); else G.collectEquipment(dr); }
  G.update(.01); assert(G.state === 'win', '战利品拾取后未完成胜利结算');
});

test('专属材料连续两次空掉后第三次必掉', () => {
  fresh(); const d = M.data.bossSets.correction; d.firstHorn = true; const random = Math.random; Math.random = () => .99;
  try {
    B.spawnBossRewards({ stage: 2, x: 0, y: 0, bossTookHit: true }); assert(d.hornDry === 1 && !G.drops.some(x => x.material === 'horns'), '首次空掉错误');
    G.drops = []; B.spawnBossRewards({ stage: 2, x: 0, y: 0, bossTookHit: true }); assert(d.hornDry === 2 && !G.drops.some(x => x.material === 'horns'), '二次空掉错误');
    G.drops = []; B.spawnBossRewards({ stage: 2, x: 0, y: 0, bossTookHit: true }); assert(d.hornDry === 0 && G.drops.some(x => x.material === 'horns'), '第三次保底失败');
  } finally { Math.random = random; }
});

test('套装列表切换后右侧装备同步更新，并可分页浏览全部套装', () => {
  fresh(); G.state = 'metaInventory'; B.state.tab = 'craft'; B.selectSet('correction');
  drawTexts.length = 0; G.render();
  const set = C.byId.correction;
  assert(B.collectionState.selected === 'correction' && drawTexts.includes('套装列表'), '套装选择未生效');
  assert(Object.values(set.keys).every(key => drawTexts.includes(G.ITEM_DEFS[key].name)), '右侧未显示当前套装五件装备');
  B.collectionState.setPage = 1; drawTexts.length = 0; G.render();
  assert(drawTexts.includes(B.sets[8].name) && drawTexts.includes(B.sets[15].name), '套装列表第二页内容缺失');
  B.selectSet('scribble');
  assert(B.collectionState.setPage === 0 && B.collectionState.selected === 'scribble', '切换套装后分页未回到选中套装');
});

test('穿戴页隐藏套装上下文，制作页保留套装列表与材料信息', () => {
  fresh(); G.state = 'metaInventory'; B.selectSet('feather'); B.state.tab = 'loadout'; B.state.slot = 'head';
  drawTexts.length = 0; G.render();
  assert(!drawTexts.some(t => /折光|墨核|上一套|下一套|乱线套装/.test(t)), '穿戴页仍显示当前套装、材料或套装跳转');
  const back = B.collectionState.hits.find(h => h.rect.y === 620);
  assert(back && back.rect.x > 250, '其他套装穿戴页返回按钮未放在右下角');
  B.state.tab = 'craft'; drawTexts.length = 0; G.render();
  const set = C.byId.feather;
  assert(drawTexts.includes('套装列表') && drawTexts.includes(set.name + ' · 装备'), '制作页套装上下文缺失');
  assert(drawTexts.some(t => t.includes(set.boss) && t.includes('第 17 页')) && drawTexts.some(t => t.includes('墨核')), '制作页 Boss 或材料信息缺失');
});

test('套装穿戴页的部位按钮也显示背包持有数量，不把未穿戴误判为空', () => {
  fresh(); M.addInventory({ key: 'erasershoes', rarity: 1 }); M.addInventory({ key: 'trackshoes', rarity: 0 });
  G.state = 'metaInventory'; B.selectSet('feather'); B.state.tab = 'loadout'; B.state.slot = 'feet';
  drawTexts.length = 0; G.render();
  assert(drawTexts.includes('脚部·2件') && !drawTexts.includes('脚部·空'), '持有鞋子仍显示空位或数量错误');
  assert(drawTexts.includes('头部·空'), '未持有的头部不再显示空位');
  B.toggleEquip('erasershoes'); drawTexts.length = 0; G.render();
  assert(drawTexts.includes('脚部·已穿'), '穿戴后未切换为已穿状态');
});

test('其余套装详情显示完整套装效果和两件激活状态', () => {
  M.resetAll(); for (const key of ['featherpen', 'featherboots']) { give(key); B.toggleEquip(key); }
  G.state = 'metaInventory'; B.selectSet('feather'); B.state.tab = 'craft'; B.state.craftKey = 'featherboots'; B.state.craftOpen = true;
  drawTexts.length = 0; G.render(); const set = C.byId.feather;
  assert(drawTexts.some(t => t.includes(set.name + ' · 当前穿戴 2/5')), '其他套装当前穿戴数量缺失');
  assert(drawTexts.some(t => t.startsWith('● ' + set.summary[0])), '两件套没有显示为已激活');
  assert(drawTexts.some(t => t.startsWith('○ ' + set.summary[1])) && drawTexts.some(t => t.startsWith('○ ' + set.summary[2])), '未达件数的效果仍显示激活');
});

test('全部 20 双 Boss 鞋均有基础移速和额外速度收益', () => {
  const extra = ['speedDmg', 'setSpeedDmg', 'speedCd', 'speedDr', 'ownInkSpeed', 'graySpeed', 'moveSpeed', 'diveSpeed', 'hurtSpeed', 'linkSpeed'];
  for (const set of B.sets) {
    const key = set.keys.feet, def = G.ITEM_DEFS[key];
    assert(def.v.speed[3] > 0, key + ' 缺少基础移速');
    assert(extra.some(prop => def.v[prop] && def.v[prop][3] > 0), key + ' 缺少条件增速或移速转化');
    const description = def.text(Object.fromEntries(Object.entries(def.v).map(([k, v]) => [k, v[3]])));
    assert(/移速|移动速度/.test(description), key + ' 描述未说明速度收益');
  }
});

test('鞋子移速转化真实影响主动、套装、冷却和减伤', () => {
  const O = window.BuildOptimizationRuntime;
  M.resetAll(); M.beginRun(); G.state = 'play';
  G.player.actives = [{ id: 'cyclone', lvl: 1, supports: [], t: 0, uc: 1 }];
  G.player.equip.feet = { key: 'lineboots', rarity: 3, roll: 100 }; G.recomputeEquip();
  assert(Math.abs(O.speedConversion('lineboots', 'speedDmg', 'speedDmgCap') - 1.6) < 0.001, '线靴主动伤害转化异常');
  M.resetAll(); M.beginRun(); G.state = 'play'; G.player.actives = [{ id: 'cyclone', lvl: 1, supports: [], t: 0, uc: 1 }];
  G.player.equip.feet = { key: 'authorshoes', rarity: 3, roll: 100 }; G.recomputeEquip();
  assert(Math.abs(O.speedConversion('authorshoes', 'speedCd', 'speedCdCap') - 1.2) < 0.001, '作者鞋冷却转化数值异常');
  M.resetAll(); M.beginRun(); G.state = 'play'; G.player.equip.feet = { key: 'featherboots', rarity: 3, roll: 100 }; G.recomputeEquip();
  assert(Math.abs(R.setDamage('feather', 100) - 102.4) < 0.001, '羽鞋套装伤害转化异常');
  M.resetAll(); M.beginRun(); G.state = 'play'; G.player.equip.feet = { key: 'eraserboots', rarity: 3, roll: 100 }; G.recomputeEquip();
  G.player.diving = true; assert(Math.abs(O.conditionalShoeSpeed() - 15) < 0.001 && Math.abs(O.extraSpeed() - 27) < 0.001, '橡皮鞋潜墨增速异常');
  M.resetAll(); M.beginRun(); G.state = 'play'; G.player.equip.feet = { key: 'turtleboots', rarity: 3, roll: 100 }; G.recomputeEquip();
  assert(Math.abs(O.speedConversion('turtleboots', 'speedDr', 'speedDrCap') - 1) < 0.001, '山龟鞋减伤转化异常');
});

console.log(failed ? 'BOSS_COLLECTION_TEST_FAILURES: ' + failed : 'BOSS_COLLECTION_TEST_OK (' + passed + '/' + passed + ')');
process.exit(failed ? 1 : 0);

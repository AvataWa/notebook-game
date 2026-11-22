// 乱线猎手：Boss 地面奖励、永久材料、制作穿戴、重描与尾刺套装专项回归
const fs = require('fs');
const files = ['battle-config.js', 'enemy-config.js', 'content-config.js', 'main.js', 'build-runtime.js', 'build-view.js',
  'equipment-rework-runtime.js', 'boss-set-runtime.js', 'meta-config.js', 'meta-runtime.js', 'ui-copy.js', 'ui-detail-runtime.js'];
const src = files.map(f => fs.readFileSync(__dirname + '/' + f, 'utf8').replace("'use strict';", '')).join('\n');
const drawTexts = [];
const fakeCtx = new Proxy({}, { get(t, k) {
  if (k === 'measureText') return txt => ({ width: String(txt).length * 7 });
  if (k === 'fillText') return txt => { drawTexts.push(String(txt)); };
  return () => {};
}, set() { return true; } });
const fakeCanvas = { getContext: () => fakeCtx, width: 0, height: 0, style: {}, addEventListener() {}, getBoundingClientRect: () => ({ left: 0, top: 0, width: 375, height: 667 }) };
const stored = {};
global.localStorage = { getItem: k => stored[k] || null, setItem: (k, v) => { stored[k] = String(v); }, removeItem: k => { delete stored[k]; } };
global.window = { addEventListener() {}, devicePixelRatio: 1, innerWidth: 375, innerHeight: 667 };
global.document = { getElementById: () => fakeCanvas }; global.requestAnimationFrame = () => {};
eval(src + `
;globalThis.G = {
  resetGame, render, update, skillCalc, fireSkill, hurtEnemy, hurtPlayer, spawnEnemy, spawnBoss, killEnemy, recomputeEquip,
  makeEquipmentDrop, itemV, itemDescription,
  get BATTLE() { return BATTLE; }, get ITEM_DEFS() { return ITEM_DEFS; },
  get player() { return player; }, get enemies() { return enemies; }, get drops() { return drops; }, set drops(v) { drops = v; },
  get keys() { return keys; },
  get state() { return state; }, set state(v) { state = v; }, get meta() { return window.__metaRuntime; },
  get build() { return window.__buildRuntime; }
};`);
const B = window.BossSetRuntime; global.BossSetRuntime = B;
const M = G.meta;
let failed = 0, passed = 0;
function test(name, fn) { try { fn(); passed++; console.log('OK  ' + name); } catch (e) { failed++; console.log('ERR ' + name + ': ' + e.stack.split('\n')[0]); } }
function assert(ok, msg) { if (!ok) throw new Error(msg); }
function near(a, b, eps = 0.01) { return Math.abs(a - b) < eps; }
function fresh() { M.resetAll(); M.beginRun(); G.state = 'play'; G.player.xpNext = 999999; B.state.tails.length = 0; B.state.echoes.length = 0; }
function give(key, roll = 100) {
  const rarity = ITEM_RARITY(key);
  const eq = { key, rarity, roll, rerollFloor: 50 };
  M.addInventory(eq); return M.data.inventory.find(x => x.key === key);
}
function ITEM_RARITY(key) { return G.ITEM_DEFS[key].bossSet ? 3 : 0; }
function wear(key, roll = 100) {
  const eq = give(key, roll); B.toggleEquip(key); M.applyPlayer();
  const slot = G.ITEM_DEFS[key].slot;
  if (G.player.equip[slot]) G.player.equip[slot].roll = roll;
  G.recomputeEquip(); return eq;
}
function enemy(x, y, boss = false) {
  if (boss) G.spawnBoss(1); else G.spawnEnemy('stick', x, y);
  const e = G.enemies[G.enemies.length - 1]; e.x = x; e.y = y; e.hp = e.maxhp = 99999; return e;
}
function castTail(id = 'tornado') {
  const a = { id, lvl: 1, supports: [], t: 0, uc: 1 };
  G.player.actives = [a]; B.state.charge = 5;
  const c = G.skillCalc(a); G.fireSkill(a, c); return c;
}

test('五件专属装备均为金色制作，部位完整且普通池严格绿蓝', () => {
  fresh();
  const keys = ['tailgrip', 'lineboots', 'scribblecrown', 'scribblehide', 'huntergall'];
  assert(keys.every(k => G.ITEM_DEFS[k].bossSet === 'scribble' && G.ITEM_DEFS[k].craftOnly), '专属套装或制作标记缺失');
  assert(keys.every(k => ITEM_RARITY(k) === 3), '五件装备没有统一为金色');
  assert(new Set(keys.map(k => G.ITEM_DEFS[k].slot)).size === 5, '五部位不完整');
  for (let i = 0; i < 200; i++) {
    const dr = G.makeEquipmentDrop(0, 0);
    assert(dr.rarity === 0 || dr.rarity === 1, '普通池出现紫金');
    assert(!G.ITEM_DEFS[dr.item].bossSet, '普通池出现 Boss 专属装备');
  }
  assert(G.itemDescription('tailgrip', 3, 50).includes('1.5%') && G.itemDescription('tailgrip', 3, 100).includes('3%'), '随机词条说明没有随完成度变化');
});

test('正式主线乱线魔王只掉制作材料，无伤多一墨核', () => {
  fresh(); const boss = enemy(0, 0, true); G.killEnemy(boss);
  assert(!G.drops.some(d => d.kind === 'bossEquip'), 'Boss 仍直接掉落装备');
  const core = G.drops.find(d => d.material === 'cores'), horn = G.drops.find(d => d.material === 'horns');
  assert(core && core.amount === 3 && horn && horn.amount === 1, '无伤材料数量或首次保底错误');
  assert(M.data.bossSets.scribble.kills === 1 && M.data.bossSets.scribble.firstHorn, 'Boss 奖励进度未保存');
});

test('Boss 练习模式完全没有装备、材料和奖励进度', () => {
  M.resetAll(); M.beginBossTest(1); G.state = 'play';
  G.killEnemy(G.enemies[G.enemies.length - 1]);
  assert(G.drops.length === 0, '练习模式仍生成掉落');
  assert(M.data.bossSets.scribble.kills === 0 && M.data.bossSets.scribble.cores === 0 && M.data.bossSets.scribble.horns === 0, '练习模式仍积累奖励');
});

test('材料必须实际拾取才永久入库，随后失败也不丢失', () => {
  fresh(); const boss = enemy(0, 0, true); G.killEnemy(boss);
  assert(M.data.bossSets.scribble.cores === 0, '未拾取就直接发材料');
  for (const dr of G.drops.slice()) if (dr.kind === 'material') B.collectMaterial(dr);
  assert(M.data.bossSets.scribble.cores === 3 && M.data.bossSets.scribble.horns === 1, '拾取数量错误');
  const saved = JSON.parse(stored['notebook-meta-v1']);
  assert(saved.bossSets.scribble.cores === 3 && saved.bossSets.scribble.horns === 1, '材料没有立即写入存档');
  M.settleRun(false); M.continueSettlement(); M.finishSettlement();
  assert(M.data.bossSets.scribble.cores === 3 && M.data.bossSets.scribble.horns === 1, '失败结算丢失材料');
});

test('旧 Boss 紫装收录时自动升金并保留 roll，局内成长不受影响', () => {
  fresh();
  const dr = { kind: 'bossEquip', bossSet: 'scribble', item: 'tailgrip', rarity: 2, roll: 73, x: 0, y: 0 };
  G.build.collectEquipment(dr);
  const saved = M.data.inventory.find(eq => eq.key === dr.item);
  assert(saved && saved.rarity === 3 && saved.roll === 73, '旧紫装未升金或 roll 丢失');
  const slot = G.ITEM_DEFS[dr.item].slot;
  assert(G.player.equip[slot].roll === 73 && G.player.equipGrowth[slot].level > 0, '局内装备词条或部位成长错误');
});

test('金装制作扣除墨点与两类材料，重复制作不重复扣费', () => {
  fresh(); M.data.ink = 200; M.data.bossSets.scribble.cores = 8; M.data.bossSets.scribble.horns = 2;
  const random = Math.random; Math.random = () => 0;
  try { assert(B.craft('scribblecrown'), '材料足够仍无法制作'); } finally { Math.random = random; }
  const eq = M.data.inventory.find(x => x.key === 'scribblecrown');
  assert(eq && eq.rarity === 3 && eq.roll === 50, '金装品质或 roll 错误');
  assert(M.data.ink === 160 && M.data.bossSets.scribble.cores === 4 && M.data.bossSets.scribble.horns === 1, '首件折扣制作成本错误');
  assert(!B.craft('scribblecrown') && M.data.ink === 160 && M.data.bossSets.scribble.horns === 1, '重复制作重复扣费');
});

test('局外五部位各穿一件，下一局统一 Lv.1 且局内换装不改配置', () => {
  fresh(); for (const key of ['tailgrip', 'lineboots', 'scribblecrown', 'scribblehide', 'huntergall']) give(key);
  for (const key of ['tailgrip', 'lineboots', 'scribblecrown', 'scribblehide', 'huntergall']) B.toggleEquip(key);
  M.beginRun(); G.state = 'play';
  assert(B.setCount() === 5, '五件套没有全部带入');
  assert(Object.values(G.player.equipGrowth).every(g => g.level === 1 && g.xp === 0), '局外装备不是统一 Lv.1');
  G.player.equip.head = null; G.recomputeEquip();
  assert(M.data.loadout.head.key === 'scribblecrown' && B.setCount() === 4, '局内换装污染局外配置或套装计数');
});

test('重描只升不降，失败为下次提供至少五个百分点保底', () => {
  fresh(); const eq = give('tailgrip', 90); M.data.bossSets.scribble.horns = 2;
  const random = Math.random; Math.random = () => 0;
  try {
    assert(B.reroll('tailgrip') && eq.roll === 90 && eq.rerollFloor === 95, '未提升时下限记录错误');
    assert(B.reroll('tailgrip') && eq.roll === 95 && eq.rerollFloor === 50, '保底重描没有至少提升五点');
  } finally { Math.random = random; }
  assert(M.data.bossSets.scribble.horns === 0, '重描材料消耗错误');
  eq.roll = 100; assert(!B.reroll('tailgrip'), '完美词条仍可重描');
});

test('全套完美后专属材料可兑换通用材料', () => {
  fresh(); for (const key of ['tailgrip', 'lineboots', 'scribblecrown', 'scribblehide', 'huntergall']) give(key, 100);
  M.data.bossSets.scribble.horns = 1;
  assert(B.perfectSet() && B.exchange(), '完美套装兑换未开放');
  assert(M.data.bossSets.scribble.horns === 0 && M.data.bossSets.scribble.cores === 2, '兑换比例错误');
});

test('每层充能提高下一主动，满层只生成一道尾刺并清空充能', () => {
  fresh(); wear('tailgrip', 100); wear('lineboots', 100);
  const a = { id: 'tornado', lvl: 1, supports: [], t: 0, uc: 1 }; G.player.actives = [a];
  B.state.charge = 0; const base = G.skillCalc(a).dmg;
  B.state.charge = 5; const c = G.skillCalc(a);
  assert(near(c.dmg, base * 1.15), '五层满词条不是 15% 增伤');
  G.fireSkill(a, c); G.fireSkill(a, c);
  assert(B.state.tails.length === 1 && B.state.charge === 0, '复放重复生成尾刺或未清充能');
  assert(near(B.state.tails[0].damage, 15 * c.dmg * 1.4), '尾刺不是主动的 140% 基础伤害');
});

test('三件套用原始尾刺贯穿、标记并逐目标回墨，单次最多十墨', () => {
  fresh(); wear('tailgrip'); wear('lineboots'); wear('huntergall');
  const first = enemy(50, 0), second = enemy(140, 0); G.player.ink = 0;
  castTail(); B.updateTails(0.08); B.updateTails(0.12);
  assert(first.hp < first.maxhp && second.hp < second.maxhp, '尾刺没有贯穿两个目标');
  assert(first.scribbleMarkT > 0 && second.scribbleMarkT > 0, '三件套乱线标记缺失');
  assert(near(G.player.ink, 4), '每目标回墨或折射误回墨错误：' + G.player.ink);
  const before = first.hp; G.hurtEnemy(first, 100, 0, 0, 0, 0, -1, 0, undefined, false, 'other');
  assert(near(before - first.hp, 115), '乱线标记没有提供 15% 易伤');
});

test('五件套首次命中仅折射一次，折射不回墨也不继续折射', () => {
  fresh(); for (const key of ['tailgrip', 'lineboots', 'scribblecrown', 'scribblehide', 'huntergall']) wear(key);
  const first = enemy(50, 0), second = enemy(105, 45), third = enemy(180, 80); G.player.ink = 0;
  castTail(); B.updateTails(0.075);
  assert(B.state.echoes.length === 1, '首次命中没有且仅有一次折射');
  assert(second.hp < second.maxhp, '折射没有伤害另一名敌人');
  assert(near(G.player.ink, 2), '折射错误回墨');
  B.updateTails(0.2);
  assert(B.state.echoes.length <= 1 && G.player.ink <= 6, '后续命中递归折射或超出回墨上限');
});

test('线靴移速和兽皮受击增益真实生效', () => {
  fresh(); wear('lineboots', 50); assert(near(G.player.eqSpd, 1.08), '50% 线靴不是 8% 移速');
  wear('scribblehide', 100); G.player.hurtT = 0; G.player.goldT = 0; G.player.diving = false;
  G.hurtPlayer(1); assert(B.state.hurtBoostT === 3, '受击没有启动三秒兽皮增益');
});

test('连续两次未掉残角后第三次必掉', () => {
  fresh(); const d = M.data.bossSets.scribble; d.firstHorn = true;
  const random = Math.random; Math.random = () => 0.99;
  try {
    B.spawnBossRewards({ stage: 1, x: 0, y: 0, bossTookHit: true });
    assert(!G.drops.some(x => x.material === 'horns') && d.hornDry === 1, '第一次空掉计数错误');
    G.drops = []; B.spawnBossRewards({ stage: 1, x: 0, y: 0, bossTookHit: true });
    assert(!G.drops.some(x => x.material === 'horns') && d.hornDry === 2, '第二次空掉计数错误');
    G.drops = []; B.spawnBossRewards({ stage: 1, x: 0, y: 0, bossTookHit: true });
    assert(G.drops.some(x => x.material === 'horns') && d.hornDry === 0, '第三次残角保底未触发');
  } finally { Math.random = random; }
});

test('原两件紫装现在也可消耗相同材料制作金装', () => {
  fresh(); M.data.ink = 80; M.data.bossSets.scribble.cores = 8; M.data.bossSets.scribble.horns = 2;
  assert(B.craft('tailgrip') && B.craft('lineboots'), '原紫装部位无法制作');
  assert(['tailgrip', 'lineboots'].every(key => {
    const eq = M.data.inventory.find(x => x.key === key); return eq && eq.rarity === 3;
  }), '制作结果不是金色');
  assert(M.data.ink === 0 && M.data.bossSets.scribble.cores === 0 && M.data.bossSets.scribble.horns === 0, '两件制作成本错误');
});

test('单体 Boss 没有折射目标时追加百分之五十伤害', () => {
  fresh(); for (const key of ['tailgrip', 'lineboots', 'scribblecrown', 'scribblehide', 'huntergall']) wear(key);
  const boss = enemy(50, 0, true), before = boss.hp;
  const a = { id: 'tornado', lvl: 1, supports: [], t: 0, uc: 1 }; G.player.actives = [a];
  B.spawnTail(a, G.skillCalc(a)); const tail = B.state.tails[0]; B.updateTails(0.075);
  assert(B.state.echoes.length === 1, '单体 Boss 没有生成折射反馈');
  assert(near(before - boss.hp, tail.damage * 1.575, 0.1), '单体 Boss 追加伤害或标记易伤错误：实际 ' + (before - boss.hp) + '，预期 ' + (tail.damage * 1.575));
});

test('实际移动一百二十像素才获得一层充能', () => {
  fresh(); wear('tailgrip'); G.keys.d = true;
  try {
    G.update(0.5); assert(B.state.charge === 0 && B.state.distance > 0, '不足 120 像素就充能');
    G.update(0.25); assert(B.state.charge === 1, '累计移动 120 像素后没有充能');
  } finally { G.keys.d = false; }
});

test('一道尾刺命中多个目标最多返还十墨', () => {
  fresh(); wear('tailgrip'); wear('lineboots'); wear('huntergall');
  for (let i = 0; i < 8; i++) enemy(50 + i * 45, 0);
  G.player.ink = 0; castTail();
  for (let i = 0; i < 10; i++) B.updateTails(0.08);
  assert(near(G.player.ink, 10), '单次主动回墨没有封顶十墨：' + G.player.ink);
});

test('手机制作页默认逐行清单，点击后弹窗显示完整材料成本', () => {
  fresh(); M.data.ink = 80; M.data.bossSets.scribble.cores = 4; M.data.bossSets.scribble.horns = 1;
  G.state = 'metaInventory'; drawTexts.length = 0; G.render();
  assert(drawTexts.includes('文具盒') && drawTexts.includes('穿戴') && drawTexts.includes('制作'), '文具盒页签缺失');
  B.state.tab = 'craft'; B.state.craftOpen = false; drawTexts.length = 0; G.render();
  assert(drawTexts.some(t => t.includes('乱线猎手 · 装备')), '装备栏标题缺失');
  assert(['scribblecrown', 'scribblehide', 'tailgrip', 'lineboots', 'huntergall'].every(key => drawTexts.includes(G.ITEM_DEFS[key].name)), '五件装备没有逐行列出');
  assert(drawTexts.filter(t => t.includes('金色制作')).length === 5 && !drawTexts.some(t => t.includes('紫色掉落')), '五件装备没有全部标为金色制作');
  assert(!drawTexts.includes('所需材料') && !drawTexts.some(t => t.startsWith('制作 乱线')), '默认清单仍展开详情');
  B.state.craftOpen = true; drawTexts.length = 0; G.render();
  assert(drawTexts.some(t => t.includes('乱线角冠')) && drawTexts.includes('所需材料'), '点击后选中详情缺失');
  assert(drawTexts.some(t => t.includes('墨点')) && drawTexts.includes('80 / 40') && drawTexts.includes('1 / 1') && drawTexts.includes('4 / 4'), '首件折扣材料持有量与成本未展示');
  assert(drawTexts.includes('×') && drawTexts.some(t => t.startsWith('制作 乱线角冠')), '弹窗关闭或制作按钮缺失');
  for (const key of ['scribblehide', 'huntergall']) {
    B.state.craftKey = key; drawTexts.length = 0; G.render();
    assert(drawTexts.some(t => t.includes(G.ITEM_DEFS[key].name)), '切换制作详情失败：' + key);
  }
});


test('穿戴页仅显示全局装备，隐藏套装上下文并统一右下返回', () => {
  fresh(); give('lineboots', 62); B.toggleEquip('lineboots');
  B.state.tab = 'loadout'; B.state.slot = 'head'; G.state = 'metaInventory'; drawTexts.length = 0; G.render();
  assert(drawTexts.includes('脚部·已穿') && drawTexts.includes('头部·空'), '部位已穿与空位状态不清楚');
  assert(!drawTexts.some(t => /乱线猎手|乱线魔王|墨核|残角|其他套装|上一套|下一套/.test(t)), '穿戴页仍显示套装或材料信息');
  const back = B.state.hits.find(h => h.rect.y === 620);
  assert(back && back.rect.x > 250, '穿戴页返回按钮未放在右下角');
  const description = G.itemDescription('lineboots', 3, 62);
  assert(description.includes('额外移速') && description.includes('主动技能伤害'), '线靴缺少独立移速转主动技能伤害：' + description);
});

test('部位按钮区分未穿戴与未持有，鞋子入库后显示数量和图标状态', () => {
  fresh(); M.addInventory({ key: 'erasershoes', rarity: 1 }); M.addInventory({ key: 'trackshoes', rarity: 0 });
  B.state.tab = 'loadout'; B.state.slot = 'feet'; G.state = 'metaInventory'; drawTexts.length = 0; G.render();
  assert(drawTexts.includes('脚部·2件') && !drawTexts.includes('脚部·空'), '持有鞋子仍显示空位或数量错误');
  assert(drawTexts.includes('头部·空') && drawTexts.includes('未装备'), '真正未持有的部位不再显示空位');
  B.toggleEquip('erasershoes'); drawTexts.length = 0; G.render();
  assert(drawTexts.includes('脚部·已穿'), '穿戴后未切换为已穿状态');
});

test('乱线制作详情展示完整套装效果与当前激活状态', () => {
  fresh(); give('tailgrip'); give('lineboots'); B.toggleEquip('tailgrip'); B.toggleEquip('lineboots');
  G.state = 'metaInventory'; B.state.tab = 'craft'; B.state.craftKey = 'lineboots'; B.state.craftOpen = true;
  drawTexts.length = 0; G.render();
  assert(drawTexts.some(t => t.includes('乱线猎手 · 当前穿戴 2/5')), '套装当前穿戴数量缺失');
  assert(drawTexts.some(t => t.startsWith('● 2 件：')) && drawTexts.some(t => t.startsWith('○ 3 件：')) && drawTexts.some(t => t.startsWith('○ 5 件：')), '套装激活与未激活标记错误');
  assert(drawTexts.some(t => t.includes('140% 贯穿尾刺')) && drawTexts.some(t => t.includes('70% 折射')), '套装效果描述不完整');
  B.toggleEquip('scribblehide') || give('scribblehide');
  if (!M.data.loadout.body || M.data.loadout.body.key !== 'scribblehide') B.toggleEquip('scribblehide');
  drawTexts.length = 0; G.render();
  assert(drawTexts.some(t => t.includes('当前穿戴 3/5')) && drawTexts.some(t => t.startsWith('● 3 件：')), '三件套激活状态未更新');
});

console.log(failed ? 'BOSS_SET_TEST_FAILURES: ' + failed : 'BOSS_SET_TEST_OK (' + passed + '/' + passed + ')');
process.exit(failed ? 1 : 0);

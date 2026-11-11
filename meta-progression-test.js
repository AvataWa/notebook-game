// 局外存档、墨点天赋、装备继承、段位与结算的快速专项测试
const fs = require('fs');
const files = ['battle-config.js', 'enemy-config.js', 'content-config.js', 'main.js', 'build-runtime.js', 'build-view.js', 'meta-config.js', 'meta-runtime.js', 'ui-copy.js', 'ui-detail-runtime.js'];
const src = files.map(f => fs.readFileSync(__dirname + '/' + f, 'utf8').replace("'use strict';", '')).join('\n');
const drawTexts = [];
const fakeCtx = new Proxy({}, { get(t, k) {
  if (k === 'measureText') return txt => ({ width: String(txt).length * 10 });
  if (k === 'fillText') return txt => { drawTexts.push(String(txt)); };
  return () => {};
}, set() { return true; } });
const fakeCanvas = { getContext: () => fakeCtx, width: 0, height: 0, style: {}, addEventListener() {}, getBoundingClientRect: () => ({ left: 0, top: 0, width: 375, height: 667 }) };
const stored = { 'notebook-meta-v1': '{broken json' };
global.localStorage = { getItem: k => Object.prototype.hasOwnProperty.call(stored, k) ? stored[k] : null, setItem: (k, v) => { stored[k] = String(v); }, removeItem: k => { delete stored[k]; } };
global.window = { addEventListener() {}, devicePixelRatio: 1, innerWidth: 375, innerHeight: 667 };
global.document = { getElementById: () => fakeCanvas }; global.requestAnimationFrame = () => {};
eval(src + `
;globalThis.G = {
  resetGame, render, skillCalc, hurtEnemy, spawnEnemy, killEnemy, recomputeEquip,
  get BATTLE() { return BATTLE; }, get SKILL_DEFS() { return SKILL_DEFS; }, get ITEM_DEFS() { return ITEM_DEFS; },
  get player() { return player; }, get enemies() { return enemies; }, get drops() { return drops; },
  get damageStats() { return damageStats; },
  get state() { return state; }, set state(v) { state = v; }, get meta() { return window.__metaRuntime; }
};`);
const M = G.meta;
let failed = 0, passed = 0;
function test(name, fn) { try { fn(); passed++; console.log('OK  ' + name); } catch (e) { failed++; console.log('ERR ' + name + ': ' + e.stack.split('\n')[0]); } }
function assert(ok, msg) { if (!ok) throw new Error(msg); }
function near(a, b, eps = 0.001) { return Math.abs(a - b) < eps; }
function firstItems() { return Object.keys(G.ITEM_DEFS).slice(0, 2); }

test('非法存档回退默认值，首页与 21 条专精入口完整', () => {
  assert(G.state === 'metaHome', '初始状态不是局外手账');
  assert(M.data.ink === 0 && M.data.paper === 0 && M.data.rank === 0, '默认资源或段位错误');
  assert(M.data.inventory.length === 0 && !M.data.inherited, '默认背包不为空');
  assert(Object.keys(G.SKILL_DEFS).length === 18, '主动技能不是 18 个');
  drawTexts.length = 0; G.render();
  assert(drawTexts.includes('我穿越到笔记本了') && drawTexts.includes('天赋') && drawTexts.includes('文具盒 0'), '局外首页未完整绘制');
  assert(drawTexts.some(s => s.includes('开始游戏')) && drawTexts.some(s => s.includes('段位考核')), '开局入口缺失');
});

test('基础天赋购买扣费，免费重置全额返还', () => {
  M.resetAll(); M.data.ink = 1000; M.tab = 'basic';
  assert(M.upgradeTalent('hp') && M.data.talents.hp === 1 && M.data.ink === 970, '厚纸一级购买错误');
  assert(M.upgradeTalent('hp') && M.data.talents.hp === 2 && M.data.ink === 910, '厚纸二级购买错误');
  M.tab = 'active'; assert(M.upgradeTalent('cyclone') && M.data.ink === 870 && M.data.specs.cyclone === 1, '主动专精购买错误');
  assert(M.resetTalents() && M.data.ink === 1000, '重置没有全额退款');
  assert(M.data.talents.hp === 0 && M.data.specs.cyclone === 0, '重置后等级未清零');
});

test('开局实际应用生命、墨水、移速、笔锋、冷却与专精', () => {
  M.resetAll();
  Object.assign(M.data.talents, { dmg: 5, hp: 5, speed: 5, ink: 5, cd: 5 });
  M.data.specs.cyclone = 3;
  M.beginRun(false); G.state = 'play';
  assert(G.player.maxhp === G.BATTLE.player.hp + 25, '生命天赋未生效');
  assert(G.player.maxInk === G.BATTLE.player.maxInk + 25, '墨囊天赋未生效');
  assert(near(G.player.speed, G.BATTLE.player.speed * 1.075), '移速天赋未生效');
  const c = G.skillCalc({ id: 'cyclone', lvl: 1, supports: [] });
  assert(near(c.dmg, 1.15) && near(c.cd, 0.95), '主动专精或冷却倍率错误：' + c.dmg + '/' + c.cd);
  G.spawnEnemy('stick', 100, 0); const e = G.enemies[G.enemies.length - 1]; e.hp = e.maxhp = 9999;
  G.hurtEnemy(e, 100, 0, 0, 0, 0, 0, 0);
  assert(near(e.maxhp - e.hp, 115), '笔锋没有正确放大实际伤害');
});

test('普通失败保留全部部位经验，装订不重复给经验或碎纸', () => {
  M.resetAll(); M.beginRun(false); G.state = 'play'; G.player.level = 3;
  const keys = firstItems();
  assert(M.recordEquipment({ item: keys[0], rarity: 1 }), '第一件装备未记录');
  assert(M.recordEquipment({ item: keys[1], rarity: 2 }), '第二件装备未记录');
  assert(M.settleRun(false), '失败没有进入结算');
  assert(G.state === 'metaRunSummary', '失败后没有先进入构筑回顾');
  assert(M.settlement.earned === 13, '失败基础与首次到关奖励错误：' + M.settlement.earned);
  assert(M.settlement.slots === 1, '普通失败装订次数错误');
  assert(M.continueSettlement() && G.state === 'metaSettlement', '无法从构筑回顾进入装订');
  drawTexts.length = 0; G.render();
  assert(drawTexts.includes('装备装订') && drawTexts.some(t => t.includes('攻 +')) && drawTexts.some(t => t.includes('部位经验 +')), '装订页缺少标题、属性或经验');
  const uid = M.settlement.found[0].uid; M.toggleSettlement(uid);
  assert(M.finishSettlement(), '无法完成结算');
  assert(M.data.inventory.length === 1 && M.data.inventory[0].key === keys[0] && M.data.inventory[0].rarity === 1, '装订装备未入库');
  assert(M.data.equipment.head.level === 2 && M.data.equipment.head.xp === 0, '两件头部装备没有累计 5 点经验并升至 2 级');
  assert(M.data.paper === 0, '未满级装备仍被错误化为碎纸：' + M.data.paper);
  assert(G.state === 'metaHome', '结算后未返回手账');
});

test('构筑回顾保存主动辅助、三选一词条和当前装备', () => {
  M.resetAll(); M.beginRun(false); G.state = 'play';
  G.player.actives = [{ id: 'cyclone', lvl: 3, supports: [{ id: 'wide', lvl: 2 }], t: 0, uc: 0 }];
  G.player.passiveCounts = { dmg: 2 }; G.player.affixes.dive.fastdive = true;
  G.player.equip.hands = { key: 'glove', rarity: 2 }; G.recomputeEquip();
  M.settleRun(false);
  assert(M.settlement.build.actives[0].supports[0].id === 'wide' && M.settlement.build.passives.dmg === 2, '构筑快照不完整');
  assert(M.summaryTab === 'damage', '构筑回顾没有默认展示伤害统计');
  M.summaryTab = 'skills'; drawTexts.length = 0; G.render(); assert(drawTexts.some(t => t.includes('挑战失败')) && drawTexts.some(t => t.includes('Lv.3')) && drawTexts.includes('辅 1/4'), '失败结果或主动辅助回顾缺失');
  M.summaryTab = 'affixes'; drawTexts.length = 0; G.render(); assert(drawTexts.some(t => t.includes('×2')) && drawTexts.includes('潜墨'), '三选一词条回顾缺失');
  M.summaryTab = 'equipment'; drawTexts.length = 0; G.render(); assert(drawTexts.includes(G.ITEM_DEFS.glove.name) && drawTexts.some(t => t.includes('攻击 +')), '装备回顾缺失');
  M.continueSettlement(); M.finishSettlement();
});

test('伤害统计按实际扣血记录来源、排序占比并随新局清空', () => {
  M.resetAll(); M.beginRun(false); G.state = 'play';
  G.spawnEnemy('stick', 100, 0); const first = G.enemies[G.enemies.length - 1]; first.hp = first.maxhp = 40;
  G.hurtEnemy(first, 100, 0, 0, 0, 0, 0, 0, '#000', false, 'cyclone');
  G.spawnEnemy('stick', -100, 0); const second = G.enemies[G.enemies.length - 1]; second.hp = second.maxhp = 100;
  G.hurtEnemy(second, 25, 0, 0, 0, 0, 0, 0, '#000', false, 'surge');
  assert(near(G.damageStats.cyclone, 40) && near(G.damageStats.surge, 25), '伤害来源或过量伤害截断错误');
  M.settleRun(false);
  assert(near(M.settlement.damage.cyclone, 40) && near(M.settlement.damage.surge, 25), '结算没有保存伤害快照');
  M.summaryTab = 'damage'; drawTexts.length = 0; G.render();
  assert(drawTexts.some(t => t.startsWith('伤害统计 ')) && drawTexts.some(t => t.includes('1. 旋转蜡笔')) && drawTexts.includes('61.5%'), '伤害统计页排序或占比错误：' + drawTexts.join(' | '));
  M.continueSettlement(); M.finishSettlement(); M.beginRun(false);
  assert(Object.keys(G.damageStats).length === 0, '新局没有清空伤害统计');
});

test('段位考核第 1 关 Boss 即通关，免装订且保留部位经验', () => {
  M.resetAll(); M.beginRun(true); G.state = 'play';
  M.recordEquipment({ item: 'glove', rarity: 1 });
  G.killEnemy({ id: 998, boss: true, stage: 1, name: '第一关 Boss', x: 0, y: 0, r: 20, dead: false });
  assert(G.state === 'win', '第 1 关 Boss 后试炼仍未完成');
  G.render();
  assert(G.state === 'metaRunSummary' && M.settlement.promoted && M.data.rank === 1 && drawTexts.some(t => t.includes('挑战成功')), '试炼成功结果、晋升或构筑回顾错误');
  assert(M.settlement.slots === 0, '试炼仍提供装订次数');
  assert(M.continueSettlement() && G.state === 'metaHome', '试炼没有跳过装订直接返回');
  assert(M.data.equipment.hands.level === 1 && M.data.equipment.hands.xp === 0, '试炼稀有装备没有提供 2 点部位经验');
  assert(M.data.inventory.length === 0 && M.data.paper === 0, '免装订试炼错误入库或将未满级装备化为碎纸');
});

test('继承装备进入下局，局内替换不修改仓库', () => {
  M.resetAll(); M.beginRun(false); M.recordEquipment({ item: 'glove', rarity: 1 }); M.settleRun(false); M.continueSettlement();
  M.toggleSettlement(M.settlement.found[0].uid); M.finishSettlement();
  const eq = M.data.inventory[0], slot = G.ITEM_DEFS[eq.key].slot;
  assert(M.setInherited(eq.key, eq.rarity), '无法设置继承装备');
  M.beginRun(false);
  assert(G.player.equip[slot] && G.player.equip[slot].key === eq.key && G.player.equip[slot].rarity === eq.rarity, '下局未穿上继承装备');
  const oldMax = G.player.maxhp; G.player.equip[slot] = null; G.recomputeEquip();
  assert(G.player.maxhp <= oldMax && M.data.inventory.some(x => x.key === eq.key && x.rarity === eq.rarity), '局内替换影响了仓库');
  assert(M.data.inherited.key === eq.key, '局内替换清除了继承选择');
});

test('只有考核胜利晋级，失败与普通胜利不晋级', () => {
  M.resetAll(); M.beginRun(true); G.player.level = 1;
  M.settleRun(false); assert(M.data.rank === 0 && M.data.ink === 13, '考核失败段位或墨点错误');
  M.continueSettlement();
  M.beginRun(true); M.settleRun(true);
  assert(M.data.rank === 1 && M.settlement.promoted, '考核胜利没有晋级');
  assert(M.data.ink === 13 + 61, '考核胜利墨点奖励错误：' + M.data.ink);
  M.continueSettlement(); M.beginRun(false); M.settleRun(true);
  assert(M.data.rank === 1, '普通胜利错误晋级');
  M.continueSettlement(); M.finishSettlement();
});

test('第 5 关 Boss 与通关增加装订次数，Boss 记录来自实际击杀', () => {
  M.resetAll(); M.beginRun(false); G.state = 'play';
  G.killEnemy({ id: 999, boss: true, stage: 5, name: '测试 Boss', x: 0, y: 0, r: 20, dead: false });
  assert(M.run.bossStages.includes(5), 'Boss 击杀未记录');
  M.settleRun(false); assert(M.settlement.slots === 2, '第 5 关 Boss 未增加装订次数');
  M.continueSettlement(); M.finishSettlement(); M.beginRun(false);
  G.killEnemy({ id: 1000, boss: true, stage: 5, name: '测试 Boss', x: 0, y: 0, r: 20, dead: false });
  M.settleRun(true); assert(M.settlement.slots === 3, 'Boss 加通关装订次数不是 3');
  M.continueSettlement(); M.finishSettlement();
});

test('段位倍率与大段规则正确', () => {
  const a = M.rankMultipliers(0), b = M.rankMultipliers(3), c = M.rankMultipliers(12);
  assert(a.hp === 1 && a.dmg === 1 && a.cap === 0 && a.phaseAt === 0.5, '初始段位倍率错误');
  assert(near(b.hp, 1.25) && b.cap === 5 && near(b.dmg, 1.09), '第二大段强化错误');
  assert(c.bossHp === 1.3 && c.phaseAt === 0.65 && c.attack === 0.9 && !('gray' in c), '高段 Boss 与攻击规则错误');
});

test('存档写入合法 JSON，重置返回干净首页', () => {
  M.data.ink = 123; M.save();
  const parsed = JSON.parse(stored['notebook-meta-v1']);
  assert(parsed.ink === 123 && parsed.version === 2 && Array.isArray(parsed.inventory), '存档结构不合法');
  assert(['head', 'body', 'hands', 'feet', 'acc'].every(slot => parsed.equipment[slot] && Number.isInteger(parsed.equipment[slot].level)), '存档缺少五部位成长数据');
  M.resetAll(); const clean = JSON.parse(stored['notebook-meta-v1']);
  assert(clean.ink === 0 && clean.rank === 0 && clean.inventory.length === 0 && G.state === 'metaHome', '清空存档未恢复默认');
});

console.log(failed ? 'META_PROGRESSION_TEST_FAILURES: ' + failed : 'META_PROGRESSION_TEST_OK (' + passed + '/' + passed + ')');
process.exit(failed ? 1 : 0);

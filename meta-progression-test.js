// 局外存档、墨点天赋、装备继承、最佳三局段位认证与结算的快速专项测试
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
  resetGame, render, skillCalc, hurtEnemy, hurtPlayer, spawnEnemy, spawnBoss, killEnemy, recomputeEquip,
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
function playScore(score, win = false) {
  M.beginRun(); G.state = 'play'; G.player.level = score; M.settleRun(win);
  const result = M.settlement; M.continueSettlement(); M.finishSettlement(); return result;
}

test('非法存档回退默认值，首页只保留上局文案与功能入口', () => {
  assert(G.state === 'metaHome', '初始状态不是局外手账');
  assert(M.data.ink === 0 && M.data.paper === 0 && M.data.rank === 0, '默认资源或段位错误');
  assert(M.data.inventory.length === 0 && !M.data.inherited && M.data.rankScores.length === 0, '默认背包或成绩席不为空');
  assert(Object.keys(G.SKILL_DEFS).length === 17 && !G.SKILL_DEFS.absolve, '基础主动技能不是 17 个或赦免粉笔仍存在');
  drawTexts.length = 0; G.render();
  assert(drawTexts.includes('纸上涂鸦幻想') && drawTexts.includes('天赋') && drawTexts.includes('文具盒 0'), '局外首页未完整绘制');
  assert(drawTexts.some(s => s.includes('开始游戏')) && drawTexts.includes(M.rankInfo().name), '开局或当前段位缺失');
  assert(drawTexts.includes('这一页还空着。来画下第一笔吧。') && drawTexts.includes('段位手账 ›'), '首页文案或手账入口缺失');
  assert(!drawTexts.includes(M.nextRankText()), '首页仍显示晋升分数目标');
  assert(!drawTexts.some(s => s.includes('最佳三局认证') || s.includes('成绩席') || s.includes('墨点 ') || s.includes('出战：') || s.includes('继承：')), '首页仍堆叠详细数据');
  assert(!drawTexts.some(s => s.includes('段位考核') || s.includes('大师考核')), '首页仍残留考核入口');
});

test('段位手账集中展示最佳三局、晋升目标与历史统计', () => {
  M.data.rankScores = [82, 47, 41]; M.data.stats.runs = 9; M.data.stats.wins = 1; M.data.stats.highestStage = 7;
  G.state = 'metaRankDetails'; drawTexts.length = 0; G.render();
  assert(drawTexts.includes('段位手账') && drawTexts.includes('最佳三局认证'), '段位手账标题或认证信息缺失');
  assert(drawTexts.includes('82') && drawTexts.includes('47') && drawTexts.includes('41'), '三席成绩未完整展示');
  assert(drawTexts.some(s => s.includes('三席平均')) && drawTexts.includes('9') && drawTexts.includes('第 7 页'), '平均分或历史统计缺失');
  assert(drawTexts.some(s => s.includes('表现分＝到达波数＋Boss 无伤数')), '表现分规则缺失');
  G.state = 'metaHome';
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
  M.beginRun(); G.state = 'play';
  assert(M.run.mode === 'normal' && G.player.maxhp === G.BATTLE.player.hp + 25, '普通局模式或生命天赋错误');
  assert(G.player.maxInk === G.BATTLE.player.maxInk + 25, '墨囊天赋未生效');
  assert(near(G.player.speed, G.BATTLE.player.speed * 1.075), '移速天赋未生效');
  const c = G.skillCalc({ id: 'cyclone', lvl: 1, supports: [] });
  assert(near(c.dmg, 1.15) && near(c.cd, 0.95), '主动专精或冷却倍率错误：' + c.dmg + '/' + c.cd);
  G.spawnEnemy('stick', 100, 0); const e = G.enemies[G.enemies.length - 1]; e.hp = e.maxhp = 9999;
  G.hurtEnemy(e, 100, 0, 0, 0, 0, 0, 0);
  assert(near(e.maxhp - e.hp, 115), '笔锋没有正确放大实际伤害');
});

test('普通失败保留构筑与表现分，未装订紫装自动回收碎纸', () => {
  M.resetAll(); M.beginRun(); G.state = 'play'; G.player.level = 3;
  const keys = firstItems();
  assert(M.recordEquipment({ item: keys[0], rarity: 1 }), '第一件装备未记录');
  assert(M.recordEquipment({ item: keys[1], rarity: 2 }), '第二件装备未记录');
  assert(M.settleRun(false), '失败没有进入结算');
  assert(G.state === 'metaRunSummary', '失败后没有先进入构筑回顾');
  assert(M.settlement.earned === 13, '失败基础与首次到关奖励错误：' + M.settlement.earned);
  assert(M.settlement.score === 3 && M.settlement.depthScore === 3 && M.settlement.flawlessBosses === 0, '失败局表现分错误');
  assert(M.data.rankScores.length === 1 && M.data.rankScores[0] === 3, '失败局没有进入成绩席');
  assert(M.settlement.slots === 1, '普通失败装订次数错误');
  assert(M.continueSettlement() && G.state === 'metaSettlement', '无法从构筑回顾进入装订');
  drawTexts.length = 0; G.render();
  assert(drawTexts.includes('装备装订') && drawTexts.some(t => t.includes('攻 +')) && drawTexts.some(t => t.includes('部位经验 +')), '装订页缺少标题、属性或经验');
  const uid = M.settlement.found[0].uid; M.toggleSettlement(uid);
  assert(M.settlement.growth.head.level === 2 && M.settlement.growth.head.xp === 0, '本局两件头部装备没有累计 5 点经验并升至 2 级');
  assert(M.finishSettlement(), '无法完成结算');
  assert(M.data.inventory.length === 1 && M.data.inventory[0].key === keys[0] && M.data.inventory[0].rarity === 1, '装订装备未入库');
  assert(M.data.equipment.head.level === 0 && M.data.equipment.head.xp === 0, '部位经验错误保留到局外');
  assert(M.data.paper === 12, '未装订紫装没有回收为 12 碎纸：' + M.data.paper);
  assert(G.state === 'metaHome', '结算后未返回手账');
});

test('构筑回顾保存主动辅助、词条、装备和认证信息', () => {
  M.resetAll(); M.beginRun(); G.state = 'play';
  G.player.actives = [{ id: 'cyclone', lvl: 3, supports: [{ id: 'wide', lvl: 2 }], t: 0, uc: 0 }];
  G.player.passiveCounts = { dmg: 2 }; G.player.affixes.dive.fastdive = true;
  G.player.equip.hands = { key: 'glove', rarity: 2 }; G.recomputeEquip();
  M.settleRun(false);
  assert(M.settlement.build.actives[0].supports[0].id === 'wide' && M.settlement.build.passives.dmg === 2, '构筑快照不完整');
  assert(M.summaryTab === 'damage', '构筑回顾没有默认展示伤害统计');
  M.summaryTab = 'skills'; drawTexts.length = 0; G.render();
  assert(drawTexts.some(t => t.includes('挑战失败')) && drawTexts.some(t => t.includes('Lv.3')) && drawTexts.includes('辅 1/4'), '失败结果或主动辅助回顾缺失');
  assert(drawTexts.some(t => t.includes('本局表现 1')) && drawTexts.some(t => t.includes('认证 1 / -- / --')), '结算认证信息缺失');
  M.summaryTab = 'affixes'; drawTexts.length = 0; G.render(); assert(drawTexts.some(t => t.includes('×2')) && drawTexts.includes('潜墨'), '三选一词条回顾缺失');
  M.summaryTab = 'equipment'; drawTexts.length = 0; G.render(); assert(drawTexts.includes(G.ITEM_DEFS.glove.name) && drawTexts.some(t => t.includes('攻击 +')), '装备回顾缺失');
  M.continueSettlement(); M.finishSettlement();
});

test('伤害统计按实际扣血记录来源、排序占比并随新局清空', () => {
  M.resetAll(); M.beginRun(); G.state = 'play';
  G.spawnEnemy('stick', 100, 0); const first = G.enemies[G.enemies.length - 1]; first.hp = first.maxhp = 40;
  G.hurtEnemy(first, 100, 0, 0, 0, 0, 0, 0, '#000', false, 'cyclone');
  G.spawnEnemy('stick', -100, 0); const second = G.enemies[G.enemies.length - 1]; second.hp = second.maxhp = 100;
  G.hurtEnemy(second, 25, 0, 0, 0, 0, 0, 0, '#000', false, 'surge');
  assert(near(G.damageStats.cyclone, 40) && near(G.damageStats.surge, 25), '伤害来源或过量伤害截断错误');
  M.settleRun(false);
  assert(near(M.settlement.damage.cyclone, 40) && near(M.settlement.damage.surge, 25), '结算没有保存伤害快照');
  M.summaryTab = 'damage'; drawTexts.length = 0; G.render();
  assert(drawTexts.some(t => t.startsWith('伤害统计 ')) && drawTexts.some(t => t.includes('1. 连笔蜡笔')) && drawTexts.includes('61.5%'), '伤害统计页排序或占比错误：' + drawTexts.join(' | '));
  M.continueSettlement(); M.finishSettlement(); M.beginRun();
  assert(Object.keys(G.damageStats).length === 0, '新局没有清空伤害统计');
});

test('普通局 Boss 无伤增加表现分，装备成长仍仅本局有效', () => {
  M.resetAll(); M.beginRun(); G.state = 'play'; G.player.level = 10;
  M.recordEquipment({ item: 'glove', rarity: 1 });
  G.spawnBoss(1); const boss = G.enemies[G.enemies.length - 1]; G.killEnemy(boss);
  assert(M.run.bossStages.includes(1) && M.run.flawlessBosses === 1, 'Boss 击杀或无痛记录错误');
  M.settleRun(false);
  assert(M.settlement.score === 11 && M.settlement.depthScore === 10 && M.settlement.flawlessBosses === 1, 'Boss 无伤没有正确加分');
  assert(M.settlement.slots === 1 && M.continueSettlement() && G.state === 'metaSettlement', '普通局结算流程错误');
  assert(M.settlement.growth.hands.level === 1 && M.settlement.growth.hands.xp === 0, '结算回顾未保留本局部位成长');
  M.finishSettlement();
  assert(M.data.equipment.hands.level === 0 && M.data.equipment.hands.xp === 0, '部位经验错误带入局外');
});

test('继承装备进入下局统一 Lv.1，局内替换不修改仓库', () => {
  M.resetAll(); M.beginRun(); M.recordEquipment({ item: 'glove', rarity: 1 }); M.settleRun(false); M.continueSettlement();
  M.toggleSettlement(M.settlement.found[0].uid); M.finishSettlement();
  const eq = M.data.inventory[0], slot = G.ITEM_DEFS[eq.key].slot;
  assert(M.setInherited(eq.key, eq.rarity), '无法设置继承装备');
  M.beginRun();
  assert(G.player.equip[slot] && G.player.equip[slot].key === eq.key && G.player.equip[slot].rarity === eq.rarity, '下局未穿上继承装备');
  assert(G.player.equipGrowth[slot].level === 1 && G.player.equipGrowth[slot].xp === 0, '局外装备没有统一从 Lv.1 开始');
  const oldMax = G.player.maxhp; G.player.equip[slot] = null; G.recomputeEquip();
  assert(G.player.maxhp <= oldMax && M.data.inventory.some(x => x.key === eq.key && x.rarity === eq.rarity), '局内替换影响了仓库');
  assert(M.data.inherited.key === eq.key, '局内替换清除了继承选择');
});

test('最佳三局平均认证：空席计零、低分不晋升、刷新第三席晋升', () => {
  M.resetAll();
  playScore(82);
  assert(M.data.rankScores.join('/') === '82' && M.data.rank === 5, '单局高分或空席平均规则错误：' + M.data.rank);
  playScore(47); const third = playScore(41);
  assert(M.data.rankScores.join('/') === '82/47/41', '三席排序错误');
  assert(near(M.rankAverage(), (82 + 47 + 41) / 3) && M.data.rank === 11 && third.promoted, '三局平均或段位计算错误');
  assert(M.rankProgress().requiredScore === 51, '下一席目标不是 51 分');
  const low = playScore(40);
  assert(M.data.rankScores.join('/') === '82/47/41' && M.data.rank === 11 && !low.promoted, '重复低分错误推进段位');
  const promoted = playScore(51);
  assert(M.data.rankScores.join('/') === '82/51/47' && near(M.rankAverage(), 60) && M.data.rank === 12 && promoted.promoted, '刷新第三席没有正确晋升');
});

test('Boss 战实际扣血取消无伤奖励，修正带不参与额外扣分', () => {
  M.resetAll(); M.beginRun(); G.state = 'play';
  G.spawnBoss(1); let boss = G.enemies[G.enemies.length - 1]; G.hurtPlayer(5); G.killEnemy(boss);
  assert(M.run.flawlessBosses === 0, 'Boss 战实际受击仍获得无伤');
  M.settleRun(false); assert(M.settlement.score === 1 && M.settlement.flawlessBosses === 0, '受击局成绩错误');
  M.continueSettlement(); M.finishSettlement();
  M.beginRun(); G.state = 'play'; G.spawnBoss(1); boss = G.enemies[G.enemies.length - 1]; G.killEnemy(boss);
  M.settleRun(false);
  assert(M.settlement.score === 2 && M.settlement.flawlessBosses === 1, '无伤局没有获得深度加一');
  assert(!('revivePenalty' in M.settlement), '结算仍包含免死或复活惩罚');
  M.continueSettlement(); M.finishSettlement();
});

test('第 5 关 Boss 与通关增加装订次数，Boss 记录来自实际击杀', () => {
  M.resetAll(); M.beginRun(); G.state = 'play';
  G.spawnBoss(5); G.killEnemy(G.enemies[G.enemies.length - 1]);
  assert(M.run.bossStages.includes(5), 'Boss 击杀未记录');
  M.settleRun(false); assert(M.settlement.slots === 2, '第 5 关 Boss 未增加装订次数');
  M.continueSettlement(); M.finishSettlement(); M.beginRun();
  G.spawnBoss(5); G.killEnemy(G.enemies[G.enemies.length - 1]);
  M.settleRun(true); assert(M.settlement.slots === 3, 'Boss 加通关装订次数不是 3');
  M.continueSettlement(); M.finishSettlement();
});

test('段位阈值与大师完整通关条件正确', () => {
  M.resetAll(); M.data.rankScores = [82, 47, 41];
  assert(near(M.rankAverage(), 56.666666, 0.001) && M.rankForScores() === 11, '马克笔段位阈值错误');
  M.data.rankScores = [100]; assert(M.rankForScores() === 6, '单次满分错误直接送入高段');
  M.data.rankScores = [90, 90, 90]; M.data.stats.wins = 0;
  assert(M.rankForScores() === 17, '未通关也能成为大师');
  M.data.stats.wins = 1; assert(M.rankForScores() === 18, '平均九十且通关后未成为大师');
});

test('墨点收益计到 200 级，表现分仍截到 100 级', () => {
  M.resetAll(); M.data.firstStages = Array.from({ length: 20 }, (_, i) => i + 1); M.beginRun(); G.state = 'play'; G.player.level = 200;
  M.settleRun(false);
  assert(M.settlement.earned === 200 && M.settlement.base === 200, '200 级墨点收益错误：' + M.settlement.earned);
  assert(M.settlement.score === 100 && M.settlement.depthScore === 100, '表现分没有保持 100 上限');
  M.continueSettlement(); M.finishSettlement();
});

test('重复装订与未装订普通装自动回收，Boss 金装不回收且结算只入账一次', () => {
  M.resetAll(); const keys = firstItems(), bossKey = Object.keys(G.ITEM_DEFS).find(key => G.ITEM_DEFS[key].bossSet);
  M.addInventory({ key: keys[0], rarity: 2 }); M.beginRun(); G.state = 'play';
  M.recordEquipment({ item: keys[0], rarity: 2 });
  M.recordEquipment({ item: keys[1], rarity: 1 });
  M.recordEquipment({ item: bossKey, rarity: 3 });
  M.settleRun(false); M.continueSettlement(); M.toggleSettlement(M.settlement.found[0].uid);
  const preview = M.settlementSalvage();
  assert(preview.count === 2 && preview.paper === 17, '回收预览应为重复紫 12 + 未装订蓝 5，实际：' + JSON.stringify(preview));
  drawTexts.length = 0; G.render(); assert(drawTexts.some(t => t.includes('回收 2 件') && t.includes('碎纸 +17')), '结算页未展示回收预览');
  assert(M.finishSettlement() && M.data.paper === 17, '回收碎纸未正确入账');
  assert(M.data.inventory.length === 1 && !M.data.inventory.some(eq => eq.key === bossKey), 'Boss 金装被错误回收或入库');
  assert(!M.finishSettlement() && M.data.paper === 17, '重复完成结算导致碎纸重复入账');
});

test('重铸最多三件未持有候选，生成与取消不扣费，选定后才替换并同步配置', () => {
  M.resetAll(); M.data.paper = 500; M.addInventory({ key: 'glove', rarity: 1 }); M.setInherited('glove', 1);
  const random = Math.random; Math.random = () => 0;
  let offers;
  try {
    offers = M.reforge('glove', 1);
    assert(Array.isArray(offers) && offers.length >= 1 && offers.length <= 3 && new Set(offers).size === offers.length, '候选数量或去重错误');
    assert(offers.every(key => key !== 'glove' && !G.ITEM_DEFS[key].bossSet && G.ITEM_DEFS[key].slot === 'hands'), '候选部位或来源错误');
    assert(M.data.paper === 500 && M.data.inventory[0].key === 'glove' && M.reforgeOffers, '生成候选提前扣费或换装备');
    assert(M.cancelReforge() && !M.reforgeOffers && M.data.paper === 500 && M.data.inventory[0].key === 'glove', '取消重铸产生消耗');
    offers = M.reforge('glove', 1); const next = offers[0];
    assert(M.chooseReforge(0) && M.data.paper === 420 && M.data.inventory[0].key === next, '选定候选后扣费或替换错误');
    assert(M.data.inherited.key === next && M.data.loadout.hands.key === next && !M.reforgeOffers, '重铸未同步继承配置或未关闭候选');
    assert(!M.chooseReforge(0) && M.data.paper === 420, '重复选择导致重复扣费');
    for (const key of Object.keys(G.ITEM_DEFS)) if (!G.ITEM_DEFS[key].bossSet && G.ITEM_DEFS[key].slot === 'hands') M.addInventory({ key, rarity: 1 });
    assert(!M.reforge(next, 1) && M.data.paper === 420, '同部位同品质集齐后仍可重铸');
  } finally { Math.random = random; }
  M.resetAll(); M.data.paper = 500;
  const keys = Object.keys(G.ITEM_DEFS).filter(key => !G.ITEM_DEFS[key].bossSet && G.ITEM_DEFS[key].slot === 'hands');
  M.addInventory({ key: keys[0], rarity: 0 }); for (let i = 2; i < keys.length; i++) M.addInventory({ key: keys[i], rarity: 0 });
  offers = M.reforge(keys[0], 0);
  assert(offers.length === 1 && offers[0] === keys[1] && M.data.paper === 500, '仅剩一个候选时未按实际数量展示');
  M.cancelReforge();
});

test('存档写入合法 JSON，重置返回干净首页', () => {
  M.data.ink = 123; M.save();
  const parsed = JSON.parse(stored['notebook-meta-v1']);
  assert(parsed.ink === 123 && parsed.version === 3 && Array.isArray(parsed.inventory) && Array.isArray(parsed.rankScores), '存档结构不合法');
  assert(['head', 'body', 'hands', 'feet', 'acc'].every(slot => parsed.equipment[slot] && parsed.equipment[slot].level === 0 && parsed.equipment[slot].xp === 0), '存档缺少五部位结构或成长未归零');
  M.resetAll(); const clean = JSON.parse(stored['notebook-meta-v1']);
  assert(clean.ink === 0 && clean.rank === 0 && clean.rankScores.length === 0 && clean.inventory.length === 0 && G.state === 'metaHome', '清空存档未恢复默认');
});

console.log(failed ? 'META_PROGRESSION_TEST_FAILURES: ' + failed : 'META_PROGRESSION_TEST_OK (' + passed + '/' + passed + ')');
process.exit(failed ? 1 : 0);

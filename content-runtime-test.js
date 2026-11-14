// 62 条操作辅助、32 件四品质装备与手动替换的综合回归
const fs = require('fs');
const src = ['battle-config.js', 'enemy-config.js', 'content-config.js', 'main.js', 'build-runtime.js']
  .map(f => fs.readFileSync(__dirname + '/' + f, 'utf8').replace("'use strict';", '')).join('\n');
const drawTexts = [];
const fakeCtx = new Proxy({}, { get(t, k) {
  if (k === 'measureText') return () => ({ width: 10 });
  if (k === 'fillText') return txt => { drawTexts.push(String(txt)); };
  return () => {};
}, set() { return true; } });
const fakeCanvas = { getContext: () => fakeCtx, width: 0, height: 0, style: {}, addEventListener() {}, getBoundingClientRect: () => ({ left: 0, top: 0, width: 375, height: 667 }) };
global.window = { addEventListener() {}, devicePixelRatio: 1, innerWidth: 375, innerHeight: 667 };
global.document = { getElementById: () => fakeCanvas }; global.requestAnimationFrame = () => {};
eval(src + `
;globalThis.G = {
  resetGame, update, updatePlayerInk, render, toggleDive, enterDive, exitDive, castAbsorb, reflectEnemyBullet,
  castInkSurge, buildOptions, rerollOptions, applyOption, recomputeEquip, itemV, itemDescription, makeEquipmentDrop, hurtPlayer, inkCellAt,
  spawnEnemy, addInkStain, addHostileInk, updateInkStains, killEnemy, hurtEnemy,
  get BATTLE() { return BATTLE; }, get keys() { return keys; }, get erupts() { return erupts; },
  get gameTime() { return gameTime; }, set gameTime(v) { gameTime = v; },
  get toasts() { return toasts; },
  get RARITIES() { return RARITIES; }, get OPERATION_AFFIXES() { return OPERATION_AFFIXES; },
  get EQUIPMENT_ITEM_DEFS() { return EQUIPMENT_ITEM_DEFS; }, get PASSIVES() { return PASSIVES; },
  get player() { return player; }, get enemies() { return enemies; }, get bullets() { return bullets; }, get floats() { return floats; },
  get drops() { return drops; }, set drops(v) { drops = v; }, get pendingEquipment() { return pendingEquipment; },
  get state() { return state; }, set state(v) { state = v; }, get cards() { return cards; },
  get runtime() { return window.__buildRuntime; }
};`);
let failed = 0;
function test(name, fn) { try { fn(); console.log('OK  ' + name); } catch (e) { failed++; console.log('ERR ' + name + ': ' + e.stack.split('\n')[0]); } }
function assert(ok, msg) { if (!ok) throw new Error(msg); }
function fresh() { G.resetGame(); G.state = 'play'; G.player.xpNext = 999999; G.player.hp = G.player.maxhp = 9999; G.player.actives = [{ id: 'cyclone', lvl: 1, supports: [], t: 999, uc: 0 }]; }
function equip(key, rarity = 0) { const slot = G.EQUIPMENT_ITEM_DEFS[key].slot; G.player.equip[slot] = { key, rarity }; G.recomputeEquip(); }

test('内容数量完整：10 被动、62 辅助、32 装备，潜墨 22 条', () => {
  fresh();
  assert(G.PASSIVES.length === 10, '通用被动数量错误');
  assert(G.OPERATION_AFFIXES.length === 62, '专属辅助数量错误');
  assert(new Set(G.OPERATION_AFFIXES.map(a => a.id)).size === 62, '辅助 ID 重复');
  for (const [skill, count] of [['dive', 22], ['surge', 20], ['absorb', 20]]) assert(G.OPERATION_AFFIXES.filter(a => a.skill === skill).length === count, skill + ' 数量错误');
  assert(Object.keys(G.EQUIPMENT_ITEM_DEFS).length === 32, '装备数量错误');
  for (const slot of ['head', 'body', 'hands', 'feet', 'acc']) {
    const expected = slot === 'head' || slot === 'acc' ? 7 : 6;
    assert(Object.values(G.EQUIPMENT_ITEM_DEFS).filter(d => d.slot === slot).length === expected, slot + ' 装备数量错误');
  }
});
test('四品质概率、颜色与数值倍率完整且递增', () => {
  assert(G.RARITIES.length === 4, '品质不是四档');
  assert(G.RARITIES.reduce((s, r) => s + r.weight, 0) === 100, '掉落权重不是 100');
  assert(G.RARITIES.every((r, i, a) => r.color && (!i || r.mul > a[i - 1].mul)), '颜色或倍率不正确');
  for (const [key, def] of Object.entries(G.EQUIPMENT_ITEM_DEFS)) {
    for (const prop of Object.keys(def.v)) assert(def.v[prop].length === 4, key + '.' + prop + ' 不是四档');
    assert(G.itemDescription(key, 3), key + ' 缺少描述');
  }
  for (let i = 0; i < 40; i++) { const dr = G.makeEquipmentDrop(0, 0); assert(dr.rarity >= 0 && dr.rarity < 4, '掉落没有合法品质'); }
});
test('空部位直接装备，品质与掉落经验同时生效', () => {
  fresh(); G.drops = [{ x: 0, y: 0, item: 'glove', rarity: 3, bob: 0 }];
  G.runtime.collectEquipment(G.drops[0]);
  assert(G.player.equip.hands.key === 'glove' && G.player.equip.hands.rarity === 3, '空部位未直接装备');
  assert(G.player.equipGrowth.hands.level === 2 && G.player.equipGrowth.hands.xp === 0, '史诗 5 点经验没有按 2/3 点需求连升两级');
  assert(G.player.eqAtk === 28 && G.player.eqCrit === 0.35, '部位等级加成或特殊词条数值错误');
  assert(G.state === 'play' && G.drops.length === 0, '直接装备后状态或掉落错误');
});
test('相邻两件装备只走新拾取逻辑，不再弹出 undefined', () => {
  fresh(); G.drops = [{ x: 0, y: 0, item: 'glove', rarity: 3, bob: 0 }, { x: 0, y: 0, item: 'compass', rarity: 2, bob: 0 }];
  G.update(0.016);
  assert(G.player.equip.hands.key === 'glove' && G.player.equip.hands.rarity === 3 && !G.player.equip.hands.lvl, '第一件装备走进了旧强化逻辑');
  assert(G.drops.length === 1, '第一件拾取后掉落数量错误');
  G.update(0.016); drawTexts.length = 0; G.render();
  assert(G.state === 'equipment' && G.pendingEquipment.drop.item === 'compass', '第二件装备未进入替换弹窗');
  assert(!G.toasts.some(t => String(t.txt).includes('undefined')) && !drawTexts.some(t => t.includes('undefined')), '拾取提示或弹窗仍含 undefined');
});
test('Boss 掉落通过统一入口生成并带有合法品质', () => {
  fresh(); G.killEnemy({ id: 999, boss: true, stage: 1, name: '测试 Boss', x: 100, y: 100, r: 20, dead: false });
  assert(G.drops.length === 1 && Number.isInteger(G.drops[0].rarity) && G.drops[0].rarity >= 0 && G.drops[0].rarity < 4, 'Boss 掉落缺少品质');
});
test('不同装备弹窗有输入锁，替换后共用部位等级', () => {
  fresh(); equip('glove', 0); G.player.equipGrowth.hands.level = 2; G.drops = [{ x: 0, y: 0, item: 'compass', rarity: 2, bob: 0 }];
  const realNow = Date.now; let now = 10000; Date.now = () => now;
  try {
    G.runtime.collectEquipment(G.drops[0]);
    assert(G.state === 'equipment' && G.pendingEquipment, '未进入替换选择');
    assert(G.player.equip.hands.key === 'glove', '询问前已自动替换');
    assert(!G.runtime.resolveEquipment(true), '0.5 秒输入锁未生效');
    now += 500; G.render(); assert(G.runtime.resolveEquipment(true), '解锁后替换操作失败');
  } finally { Date.now = realNow; }
  assert(G.state === 'play' && !G.pendingEquipment && G.player.equip.hands.key === 'compass' && G.player.equip.hands.rarity === 2, '替换结果错误');
  assert(G.player.equipGrowth.hands.level === 2 && G.player.equipGrowth.hands.xp === 3, '换装没有保留部位等级或掉落经验');
});
test('同名重复提供额外经验且不弹窗，保留原品质', () => {
  fresh(); equip('glove', 1); G.drops = [{ x: 0, y: 0, item: 'glove', rarity: 3, bob: 0 }];
  const oldAtk = G.player.eqAtk;
  G.runtime.collectEquipment(G.drops[0]);
  assert(G.state === 'play' && !G.pendingEquipment, '同名装备错误弹窗');
  assert(G.player.equip.hands.rarity === 1 && G.player.equipGrowth.hands.level === 2 && G.player.equipGrowth.hands.xp === 1, '同名 6 点经验或原品质错误');
  assert(G.player.eqAtk > oldAtk && G.drops.length === 0, '部位升级没有提高基础攻击');
});
test('入墨无息与潜行蓄潮实际生效', () => {
  fresh(); G.player.affixes.dive.freeentry = true; G.player.affixes.dive.divecharge = true; G.player.ink = 100;
  G.enterDive(); G.updatePlayerInk(0.2);
  assert(G.player.ink === 100, '入墨免费时间仍扣墨');
  G.updatePlayerInk(0.9);
  assert(G.player.special === 4, '潜行蓄潮没有每秒充能 4%');
  assert(G.player.ink < 100 && G.player.diveSpent > 0, '免费期后没有正常耗墨');
});
test('散返生成三颗返还弹，每颗墨轨生成三个真实伤害墨点', () => {
  fresh(); G.player.affixes.absorb.reflectsplit = true; G.player.affixes.absorb.reflecttrail = true;
  G.castAbsorb();
  const eb = { x: 0, y: 0, vx: -100, vy: 0, dmg: 10, life: 2, sourceId: 0, reflectable: true };
  assert(G.reflectEnemyBullet(eb), '弹反失败');
  assert(G.bullets.length === 3 && G.bullets.every(b => b.inkWide === 1.8), '散返或墨轨未生效');
  assert(G.erupts.length === 9 && G.erupts.every(er => Math.abs(er.dmg - G.bullets[0].dmg * 0.2) < 1e-8), '墨轨墨点数量或伤害错误');
});
test('刷新便利贴提供次数并实际刷新选项', () => {
  fresh(); equip('rerollnote', 2); G.runtime.applyLevelEquipment();
  assert(G.player.itemRerolls === 2, '稀有便利贴不是两次刷新');
  G.buildOptions(); G.state = 'levelup';
  assert(G.rerollOptions() && G.player.itemRerolls === 1 && G.cards.length >= 3, '刷新未生效');
  assert(G.rerollOptions() && !G.rerollOptions(), '刷新次数没有正确耗尽');
});
test('活页背心升级成长保留，灵感书签旧回墨效果移除', () => {
  fresh(); equip('looseleaf', 0); equip('bookmark', 0);
  G.player.ink = 10; G.player.absorbCd = 3; const hp = G.player.maxhp;
  G.runtime.applyLevelEquipment();
  assert(G.player.maxhp === hp + 3, '活页背心未增加最大生命');
  assert(G.player.ink === 10 && G.player.absorbCd === 3, '灵感书签旧回墨或清冷却仍然残留');
});
test('高品质修正带鞋按自身冷却再次抵挡致命伤', () => {
  fresh(); equip('tape', 3); G.player.hp = 10; G.gameTime = 100; G.player.lastRevive = 75;
  G.hurtPlayer(20);
  assert(G.player.hp === 1 && G.player.lastRevive === 100, '史诗修正带鞋 20 秒冷却未生效');
});
test('满蓄溢墨形成 45 像素外圈，环带和内圆都是彩墨', () => {
  fresh(); G.player.affixes.surge.outerink = true; G.player.special = 100;
  G.castInkSurge(100, true);
  assert(G.inkCellAt(80, 0).owner === 1 && G.inkCellAt(140, 0).owner === 1, '溢墨外圈宽度或覆盖错误');
  assert(G.inkCellAt(150, 0).owner === 0, '溢墨超出约定的 45 像素外圈');
});
test('追返子弹记录发射者，供逐帧追踪使用', () => {
  fresh(); G.player.affixes.absorb.reflecthoming = true; G.castAbsorb();
  G.reflectEnemyBullet({ x: 0, y: 0, vx: -100, vy: 0, dmg: 10, life: 2, sourceId: 77, reflectable: true });
  assert(G.bullets.length === 1 && G.bullets[0].reflectTargetId === 77 && G.bullets[0].homing > 0, '追返没有记录发射者');
});
test('默认放潮退出潜墨，潜潮连笔可保持潜墨', () => {
  fresh(); G.player.special = 100;
  assert(G.toggleDive() && G.castInkSurge(), '默认潜墨放潮失败');
  assert(!G.player.diving && G.player.diveCd === 1, '默认放潮没有退出并进入冷却');
  fresh(); G.player.affixes.dive.divecast = true; G.player.special = 100;
  assert(G.toggleDive() && G.castInkSurge(), '潜潮连笔放潮失败');
  assert(G.player.diving && G.player.diveCd === 0, '潜潮连笔错误退出潜墨');
});
test('潜墨冷却 1 秒，快速回潜缩短为 0.5 秒', () => {
  fresh(); assert(G.toggleDive() && G.toggleDive(), '无法进入或退出潜墨');
  assert(G.player.diveCd === 1 && !G.toggleDive(), '冷却期间仍可进入潜墨');
  G.update(0.6); assert(Math.abs(G.player.diveCd - 0.4) < 0.001, '冷却没有逐帧递减');
  G.update(0.5); assert(G.toggleDive(), '冷却结束后无法重新潜墨');
  fresh(); G.player.affixes.dive.fastdive = true; G.toggleDive(); G.toggleDive();
  assert(G.player.diveCd === 0.5 && !G.toggleDive(), '快速回潜没有缩短到 0.5 秒');
  G.update(0.6); assert(G.toggleDive(), '快速回潜冷却后无法进入');
});
test('选择升级词条后获得完整 1 秒无敌，结束后才恢复受伤', () => {
  fresh(); G.buildOptions(); G.state = 'levelup'; G.applyOption(0);
  const hp = G.player.hp;
  assert(G.state === 'play' && G.player.goldT === 1 && G.player.hurtT === 0, '选词后没有获得独立 1 秒金色保护');
  G.hurtPlayer(50); assert(G.player.hp === hp, '选词保护期间仍然掉血');
  G.update(0.6); G.hurtPlayer(50);
  assert(G.player.hp === hp && G.player.goldT > 0 && G.player.hurtT === 0, '金色保护误用了受击红闪或提前结束');
  G.update(0.41); G.hurtPlayer(50);
  assert(G.player.hp < hp, '保护结束后没有恢复伤害结算');
});
test('装备品质框在世界层绘制，不覆盖 HUD 和升级卡片', () => {
  fresh(); G.drops = [{ x: 0, y: 0, item: 'glove', rarity: 3, bob: 0 }]; G.state = 'levelup';
  drawTexts.length = 0; G.render();
  const drop = drawTexts.indexOf('史诗'), hud = drawTexts.indexOf('击杀 0');
  const card = drawTexts.findIndex(t => t.startsWith('升级！'));
  assert(drop >= 0 && hud >= 0 && card >= 0, '缺少掉落、HUD 或升级卡片绘制');
  assert(drop < hud && drop < card, '装备品质框仍绘制在 HUD 或卡片之上');
});
test('装备运行层同样保留墨迹持续伤害弱跳字', () => {
  fresh(); G.spawnEnemy('stick', 50, 0); G.addInkStain(50, 0, 10, 40, '#1a2b8f');
  G.updateInkStains.dotT = 0; G.updateInkStains.poolT = 0; G.updateInkStains(0);
  assert(G.floats.length === 2 && G.floats.every(f => f.weak), '装备运行层覆盖了弱跳字标记');
});
test('吸墨纸甲旧灰墨抗减速效果已移除', () => {
  fresh(); G.addHostileInk(10, 0, 10, 50); equip('blotarmor', 0);
  assert(G.itemDescription('blotarmor', 0).includes('减伤 35%'), '装备说明未同步');
  G.keys.d = true; G.update(0.1); G.keys.d = false;
  const expected = G.BATTLE.player.speed * 0.58 * 0.1;
  assert(Math.abs(G.player.x - expected) < 0.001, '灰墨抗减速效果错误：' + G.player.x + ' / ' + expected);
});
test('入墨起笔减少冷却且两秒内不重复触发', () => {
  fresh(); G.player.actives[0].t = 5; G.player.affixes.dive.divepaint = true;
  G.enterDive(); assert(Math.abs(G.player.actives[0].t - 4.65) < 1e-8, '首次入墨未减冷却');
  G.exitDive(); G.player.diveCd = 0; G.gameTime = 1; G.enterDive();
  assert(Math.abs(G.player.actives[0].t - 4.65) < 1e-8, '入墨起笔冷却内重复触发');
  G.exitDive(); G.player.diveCd = 0; G.gameTime = 2.01; G.enterDive();
  assert(Math.abs(G.player.actives[0].t - 4.3) < 1e-8, '入墨起笔冷却结束后未再次触发');
});
test('灰墨渡船将潜墨探索速度倍率由 0.2 提升至 0.6', () => {
  fresh(); G.player.affixes.dive.grayboat = true; G.toggleDive(); G.keys.d = true; G.update(0.1); G.keys.d = false;
  const expected = G.BATTLE.player.speed * G.BATTLE.dive.speed * 0.6 * 0.1;
  assert(Math.abs(G.player.x - expected) < 0.001, '灰墨渡船探索速度错误：' + G.player.x + ' / ' + expected);
});
test('墨路回响按移动距离叠层并在退出时结算四层伤害', () => {
  fresh(); G.player.affixes.dive.widetrail = true; G.toggleDive();
  G.player.diveEchoDist = 89; G.player.diveEchoStacks = 3; G.keys.d = true; G.update(0.1); G.keys.d = false;
  assert(G.player.diveEchoStacks === 4, '移动距离没有叠到四层');
  G.spawnEnemy('stick', G.player.x + 20, G.player.y); const e = G.enemies[G.enemies.length - 1]; e.hp = e.maxhp = 500; e.sp = 0;
  G.exitDive(); assert(Math.abs(e.hp - 420) < 1e-8, '四层墨路回响不是 80 伤害：' + e.hp);
});
test('洗墨反击覆盖灰墨时发射真实墨刺并回复一墨水', () => {
  fresh(); G.addHostileInk(0, 0, 10, 80); G.spawnEnemy('stick', 150, 0); G.player.affixes.dive.washregen = true; G.player.ink = 50;
  G.toggleDive(); G.keys.d = true; G.update(0.1); G.keys.d = false;
  assert(G.bullets.some(b => b.kind === 'dive' && b.dmg === 25), '覆盖灰墨没有发射 25 伤害墨刺');
  const expected = 50 - G.BATTLE.dive.otherCost * 0.1 + 1;
  assert(Math.abs(G.player.ink - expected) < 0.001, '洗墨反击回墨错误：' + G.player.ink + ' / ' + expected);
});
test('入墨洗地无灰墨也充能，净化灰墨额外充能', () => {
  fresh(); G.player.affixes.dive.entrywash = true; G.enterDive(); assert(G.player.special === 5, '无灰墨时没有基础充能');
  fresh(); G.addHostileInk(0, 0, 10, 80); G.player.affixes.dive.entrywash = true; G.enterDive();
  assert(G.player.special === 15 && G.inkCellAt(0, 0).owner === 1, '净化灰墨没有额外充能或转为彩墨');
});
test('一线残影对滑行路径造成 45 点真实伤害', () => {
  fresh(); G.spawnEnemy('stick', 30, 0); const e = G.enemies[G.enemies.length - 1]; e.hp = e.maxhp = 500; e.sp = 0;
  G.player.affixes.dive.exitdash = true; G.player.faceA = 0; G.enterDive(); G.exitDive();
  assert(G.player.x === 55 && Math.abs(e.hp - 455) < 1e-8, '残影位移或路径伤害错误');
});
test('洗地始终减少最长主动冷却，覆盖大量灰墨回墨封顶 15', () => {
  fresh(); G.player.affixes.surge.washink = true; G.player.actives[0].t = 5; G.player.special = 100;
  G.castInkSurge(100, false); assert(G.player.actives[0].t === 4, '无灰墨时没有减少最长主动冷却');
  fresh(); G.addHostileInk(0, 0, 10, 400); G.player.affixes.surge.washink = true; G.player.ink = 20; G.player.special = 100;
  G.castInkSurge(400, false); assert(G.player.ink === 35, '洗地回墨没有封顶 15：' + G.player.ink);
});
test('墨潮领地让目标站在彩墨上实际受伤增加 20%', () => {
  fresh(); G.spawnEnemy('stick', 50, 0); const e = G.enemies[G.enemies.length - 1]; e.hp = e.maxhp = 500; e.sp = 0;
  G.player.affixes.surge.surgeslow = true; G.player.special = 100; G.castInkSurge(100, false);
  const hp = e.hp; G.hurtEnemy(e, 100, 0, 0, 0, 0, 0, 0, '#1a2b8f', false, 'cyclone');
  assert(Math.abs(hp - e.hp - 120) < 1e-8, '墨潮领地易伤未进入真实结算');
});
test('溢墨外圈延迟爆裂且只结算环带目标', () => {
  fresh(); G.spawnEnemy('stick', 130, 0); const e = G.enemies[G.enemies.length - 1]; e.hp = e.maxhp = 500; e.sp = 0;
  G.player.affixes.surge.outerink = true; G.player.special = 100; G.castInkSurge(100, true);
  assert(e.hp === 500 && G.erupts.some(er => er.ringInner === 100), '外圈目标被内圈误伤或缺少环形爆发');
  G.update(0.26); assert(e.hp < 500, '溢墨外圈延迟后没有真实伤害');
});
test('墨种爆炸真实击杀附近目标且不会继续连锁', () => {
  fresh(); G.player.affixes.surge.surgeseed = true;
  G.spawnEnemy('stick', 30, 0); const first = G.enemies[G.enemies.length - 1]; first.hp = first.maxhp = 1; first.sp = 0;
  G.spawnEnemy('stick', 65, 0); const second = G.enemies[G.enemies.length - 1]; second.hp = second.maxhp = 1; second.sp = 0;
  G.player.special = 100; G.castInkSurge(40, false);
  assert(first.dead && !second.dead && G.erupts.length === 1, '墨种没有只在墨潮击杀后生成爆炸');
  G.update(0.1); assert(second.dead && !G.erupts.some(er => !er.done), '墨种爆炸未击杀或错误继续连锁');
});
test('反击领地造成真实范围伤害并遵守 0.8 秒冷却', () => {
  fresh(); G.spawnEnemy('stick', 50, 0); const e = G.enemies[G.enemies.length - 1]; e.hp = e.maxhp = 500; e.sp = 0;
  G.player.affixes.absorb.bulletink = true; G.castAbsorb();
  const eb = { x: 0, y: 0, vx: -100, vy: 0, dmg: 10, life: 2, sourceId: e.id, reflectable: true };
  G.reflectEnemyBullet(eb); assert(Math.abs(e.hp - 470) < 1e-8, '反击领地没有造成 30 伤害');
  G.reflectEnemyBullet({ ...eb, life: 2 }); assert(Math.abs(e.hp - 470) < 1e-8, '反击领地冷却内重复造成伤害');
});
console.log(failed ? 'CONTENT_RUNTIME_TEST_FAILURES: ' + failed : 'CONTENT_RUNTIME_TEST_OK (31/31)');
process.exit(failed ? 1 : 0);

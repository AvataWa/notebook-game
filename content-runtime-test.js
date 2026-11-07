// 62 条操作辅助、30 件四品质装备与手动替换的综合回归
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
  get gameTime() { return gameTime; }, set gameTime(v) { gameTime = v; },
  get RARITIES() { return RARITIES; }, get OPERATION_AFFIXES() { return OPERATION_AFFIXES; },
  get EQUIPMENT_ITEM_DEFS() { return EQUIPMENT_ITEM_DEFS; }, get PASSIVES() { return PASSIVES; },
  get player() { return player; }, get enemies() { return enemies; }, get bullets() { return bullets; },
  get drops() { return drops; }, set drops(v) { drops = v; }, get pendingEquipment() { return pendingEquipment; },
  get state() { return state; }, set state(v) { state = v; }, get cards() { return cards; },
  get runtime() { return window.__buildRuntime; }
};`);
let failed = 0;
function test(name, fn) { try { fn(); console.log('OK  ' + name); } catch (e) { failed++; console.log('ERR ' + name + ': ' + e.stack.split('\n')[0]); } }
function assert(ok, msg) { if (!ok) throw new Error(msg); }
function fresh() { G.resetGame(); G.state = 'play'; G.player.xpNext = 999999; G.player.hp = G.player.maxhp = 9999; G.player.actives = [{ id: 'cyclone', lvl: 1, supports: [], t: 999, uc: 0 }]; }
function equip(key, rarity = 0) { const slot = G.EQUIPMENT_ITEM_DEFS[key].slot; G.player.equip[slot] = { key, rarity }; G.recomputeEquip(); }

test('内容数量完整：11 被动、62 辅助、30 装备，潜墨 22 条', () => {
  fresh();
  assert(G.PASSIVES.length === 11, '通用被动数量错误');
  assert(G.OPERATION_AFFIXES.length === 62, '专属辅助数量错误');
  assert(new Set(G.OPERATION_AFFIXES.map(a => a.id)).size === 62, '辅助 ID 重复');
  for (const [skill, count] of [['dive', 22], ['surge', 20], ['absorb', 20]]) assert(G.OPERATION_AFFIXES.filter(a => a.skill === skill).length === count, skill + ' 数量错误');
  assert(Object.keys(G.EQUIPMENT_ITEM_DEFS).length === 30, '装备数量错误');
  for (const slot of ['head', 'body', 'hands', 'feet', 'acc']) assert(Object.values(G.EQUIPMENT_ITEM_DEFS).filter(d => d.slot === slot).length === 6, slot + ' 不是 6 件');
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
test('空部位直接装备，品质影响基础攻防', () => {
  fresh(); G.drops = [{ x: 0, y: 0, item: 'glove', rarity: 3, bob: 0 }];
  G.runtime.collectEquipment(G.drops[0]);
  assert(G.player.equip.hands.key === 'glove' && G.player.equip.hands.rarity === 3, '空部位未直接装备');
  assert(G.player.eqAtk === 23 && G.player.eqCrit === 0.35, '史诗属性或暴击数值错误');
  assert(G.state === 'play' && G.drops.length === 0, '直接装备后状态或掉落错误');
});
test('同部位拾取必须询问，替换会穿上新装备', () => {
  fresh(); equip('glove', 0); G.drops = [{ x: 0, y: 0, item: 'compass', rarity: 2, bob: 0 }];
  G.runtime.collectEquipment(G.drops[0]);
  assert(G.state === 'equipment' && G.pendingEquipment, '未进入替换选择');
  assert(G.player.equip.hands.key === 'glove', '询问前已自动替换');
  G.render(); assert(G.runtime.resolveEquipment(true), '替换操作失败');
  assert(G.state === 'play' && !G.pendingEquipment && G.player.equip.hands.key === 'compass' && G.player.equip.hands.rarity === 2, '替换结果错误');
});
test('同名同部位也必须询问，保留不会变化', () => {
  fresh(); equip('glove', 1); G.drops = [{ x: 0, y: 0, item: 'glove', rarity: 3, bob: 0 }];
  G.runtime.collectEquipment(G.drops[0]);
  assert(G.state === 'equipment', '同名装备没有询问');
  G.runtime.resolveEquipment(false);
  assert(G.player.equip.hands.rarity === 1 && G.state === 'play' && G.drops.length === 0, '保留当前的结果错误');
});
test('入墨无息与潜行蓄潮实际生效', () => {
  fresh(); G.player.affixes.dive.freeentry = true; G.player.affixes.dive.divecharge = true; G.player.ink = 100;
  G.enterDive(); G.updatePlayerInk(0.2);
  assert(G.player.ink === 100, '入墨免费时间仍扣墨');
  G.updatePlayerInk(0.9);
  assert(G.player.special === 4, '潜行蓄潮没有每秒充能 4%');
  assert(G.player.ink < 100 && G.player.diveSpent > 0, '免费期后没有正常耗墨');
});
test('散返生成三颗返还弹，墨轨宽度数据进入子弹', () => {
  fresh(); G.player.affixes.absorb.reflectsplit = true; G.player.affixes.absorb.reflecttrail = true;
  G.castAbsorb();
  const eb = { x: 0, y: 0, vx: -100, vy: 0, dmg: 10, life: 2, sourceId: 0, reflectable: true };
  assert(G.reflectEnemyBullet(eb), '弹反失败');
  assert(G.bullets.length === 3 && G.bullets.every(b => b.inkWide === 1.8), '散返或墨轨未生效');
});
test('刷新便利贴提供次数并实际刷新选项', () => {
  fresh(); equip('rerollnote', 2); G.runtime.applyLevelEquipment();
  assert(G.player.itemRerolls === 2, '稀有便利贴不是两次刷新');
  G.buildOptions(); G.state = 'levelup';
  assert(G.rerollOptions() && G.player.itemRerolls === 1 && G.cards.length >= 3, '刷新未生效');
  assert(G.rerollOptions() && !G.rerollOptions(), '刷新次数没有正确耗尽');
});
test('活页背心与灵感书签在升级时结算', () => {
  fresh(); equip('looseleaf', 0); equip('bookmark', 0);
  G.player.ink = 10; G.player.absorbCd = 3; const hp = G.player.maxhp;
  G.runtime.applyLevelEquipment();
  assert(G.player.maxhp === hp + 3, '活页背心未增加最大生命');
  assert(G.player.ink === Math.min(G.player.maxInk, 60) && G.player.absorbCd === 0, '灵感书签未回墨或清冷却');
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
  assert(G.state === 'play' && G.player.hurtT === 1, '选词后没有获得 1 秒保护');
  G.hurtPlayer(50); assert(G.player.hp === hp, '选词保护期间仍然掉血');
  G.update(0.6); G.hurtPlayer(50);
  assert(G.player.hp === hp && G.player.hurtT > 0, '1 秒尚未结束就失去保护');
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
console.log(failed ? 'CONTENT_RUNTIME_TEST_FAILURES: ' + failed : 'CONTENT_RUNTIME_TEST_OK (16/16)');
process.exit(failed ? 1 : 0);

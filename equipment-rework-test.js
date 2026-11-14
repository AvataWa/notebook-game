// 19 件 B/C 装备的新机制触发回归：不包含难度或数值平衡测试。
const fs = require('fs');
const src = ['battle-config.js', 'enemy-config.js', 'content-config.js', 'main.js', 'build-runtime.js', 'equipment-rework-runtime.js']
  .map(f => fs.readFileSync(__dirname + '/' + f, 'utf8').replace("'use strict';", '')).join('\n');
const fakeCtx = new Proxy({}, { get(t, k) {
  if (k === 'measureText') return () => ({ width: 10 });
  return () => {};
}, set() { return true; } });
const fakeCanvas = { getContext: () => fakeCtx, width: 0, height: 0, style: {}, addEventListener() {}, getBoundingClientRect: () => ({ left: 0, top: 0, width: 375, height: 667 }) };
global.window = { addEventListener() {}, devicePixelRatio: 1, innerWidth: 375, innerHeight: 667 };
global.document = { getElementById: () => fakeCanvas }; global.requestAnimationFrame = () => {};
eval(src + `
;globalThis.G = {
  resetGame, update, updatePlayerInk, fireSkill, skillCalc, chargeParry, castInkSurge, castAbsorb,
  enterDive, exitDive, convertGrayDisk, hurtEnemy, hurtPlayer, spawnEnemy, addInkStain, addHostileInk,
  recomputeEquip, itemDescription,
  get BATTLE() { return BATTLE; }, get EQUIPMENT_ITEM_DEFS() { return EQUIPMENT_ITEM_DEFS; },
  get player() { return player; }, get enemies() { return enemies; }, get bullets() { return bullets; },
  get erupts() { return erupts; }, get state() { return state; }, set state(v) { state = v; },
  get keys() { return keys; }, get S() { return window.__equipmentRework.state; },
  get runtime() { return window.__buildRuntime; }
};`);
let failed = 0;
function test(name, fn) { try { fn(); console.log('OK  ' + name); } catch (e) { failed++; console.log('ERR ' + name + ': ' + e.stack.split('\n')[0]); } }
function assert(ok, msg) { if (!ok) throw new Error(msg); }
function near(a, b, msg) { assert(Math.abs(a - b) < 1e-6, msg + ': ' + a + ' / ' + b); }
function fresh() {
  G.resetGame(); G.state = 'play'; G.player.xpNext = 999999;
  G.player.actives = [{ id: 'cyclone', lvl: 1, supports: [], t: 999, uc: 0 }];
  G.player.hp = G.player.maxhp = 9999; G.player.ink = 100;
}
function equip(key, rarity = 0) {
  const slot = G.EQUIPMENT_ITEM_DEFS[key].slot; G.player.equip[slot] = { key, rarity }; G.recomputeEquip();
  G.player.hp = G.player.maxhp = 9999; G.player.ink = 100;
}
function target(x = 50, y = 0) {
  G.spawnEnemy('stick', x, y); const e = G.enemies[G.enemies.length - 1];
  e.hp = e.maxhp = 10000; e.sp = 0; return e;
}
function hit(e, dmg = 10, skill = 'cyclone') { G.hurtEnemy(e, dmg, 0, 0, 0, 0, 0, 0, '#1a2b8f', false, skill); }

test('01 留白笔帽：第四次施放按空槽无耗墨临摹', () => {
  fresh(); equip('blankcap'); const e = target(), a = G.player.actives[0]; a.uc = 4;
  G.fireSkill(a, G.skillCalc(a));
  near(10000 - e.hp, 11 * 1.12 * (1 + 4 * 0.4), '四次临摹伤害错误');
  assert(G.S.echoes.length === 0 && G.player.ink === 100, '临摹额外耗墨或错误复爆');
});
test('02 高分头带：第五次主动命中生成红叉范围伤害', () => {
  fresh(); equip('highscore'); const e = target();
  for (let i = 0; i < 5; i++) hit(e);
  assert(G.erupts.some(er => er.dmg === 8 && er.c.hadesSkill === 'other'), '红叉没有生成或伤害错误');
});
test('03 定规头带：同目标三命中触发贯穿斩', () => {
  fresh(); equip('rulerband'); const e = target();
  hit(e); hit(e); hit(e);
  assert(G.S.rulerLines.length === 1, '定规斩没有视觉轨迹');
  near(10000 - e.hp, 37, '定规斩没有结算 70% 伤害');
});
test('04 勇者披风：三次弹反生成纸影，结束释放墨潮', () => {
  fresh(); equip('cloak'); for (let i = 0; i < 3; i++) G.chargeParry();
  assert(G.S.decoys.length === 1 && G.S.decoys[0].t === 4, '纸影未生成');
  G.S.decoys[0].t = 0.01; G.update(0.02);
  assert(G.S.decoys.length === 0 && G.erupts.some(er => er.dmg === 22), '纸影消失墨潮未生效');
});
test('05 吸墨纸甲：吸收灰墨叠甲并按层减伤', () => {
  fresh(); G.addHostileInk(0, 0, 10, 60); equip('blotarmor'); G.update(0.16);
  assert(G.S.armorLayers > 0, '灰墨没有转化为纸甲');
  const layers = G.S.armorLayers, hp = G.player.hp; G.hurtPlayer(100);
  assert(G.S.armorLayers === layers - 1, '受击没有消耗纸甲');
  near(hp - G.player.hp, 65, '普通纸甲减伤不是 35%');
});
test('06 墨囊护甲：储存实际受击伤害并由下一墨潮释放', () => {
  fresh(); equip('inkarmor'); G.hurtPlayer(100);
  near(G.S.inkStored, 40, '受击储存比例错误');
  G.player.special = 100; assert(G.castInkSurge(100, false), '墨潮释放失败');
  assert(G.S.inkStored === 0 && G.erupts.some(er => er.dmg === 40), '储存伤害没有释放');
});
test('07 纸夹胸甲：只积攒护盾，不持续回血', () => {
  fresh(); G.addInkStain(0, 0, 10, 60, '#1a2b8f'); equip('cliparmor'); G.update(0.5);
  assert(G.S.paperShield > 0, '己方墨迹没有积攒纸甲');
  const hp = G.player.hp; G.hurtPlayer(Math.min(10, G.S.paperShield));
  assert(G.player.hp === hp, '纸甲吸收时仍然扣血');
  assert(!G.itemDescription('cliparmor').includes('回复'), '仍保留持续回血文案');
});
test('08 爆墨手套：三次暴击标记触发范围爆炸', () => {
  fresh(); equip('burstglove'); const e = target(); G.player.eqCrit = 1;
  hit(e); hit(e); assert(e.burstMarks === 2, '暴击层数错误'); hit(e);
  assert(e.burstMarks === 0 && G.erupts.some(er => er.dmg === 12), '三层爆墨没有爆炸');
});
test('09 回墨握把：弹反储能由下一主动全部射出', () => {
  fresh(); equip('parrygrip'); target(); for (let i = 0; i < 3; i++) G.chargeParry();
  const a = G.player.actives[0]; G.fireSkill(a, G.skillCalc(a));
  assert(G.S.parryShots === 0 && G.bullets.length === 3, '返墨弹数量或消耗错误');
  assert(G.bullets.every(b => b.dmg === 18 * 1.1 && b.homing === 4), '返墨弹伤害或追踪错误');
});
test('10 潮涌指套：满蓄留下潮眼，主动触发墨浪', () => {
  fresh(); equip('surgeglove'); target(); G.player.special = 100; G.castInkSurge(100, true);
  assert(G.S.surgeEye && G.S.surgeEye.t === 5, '潮眼未生成');
  const a = G.player.actives[0]; G.fireSkill(a, G.skillCalc(a));
  assert(G.bullets.some(b => b.dmg === 12 * 1.1 && b.hits === 4), '主动没有触发潮眼墨浪');
});
test('11 格线跑鞋：三点成区并每 0.25 秒结算', () => {
  fresh(); equip('gridshoes'); const e = target(0, 0);
  G.S.gridZone = { nodes: [{ x: -50, y: -30 }, { x: 50, y: -30 }, { x: 0, y: 50 }], t: 3 };
  G.S.gridTick = 0; G.update(0.01);
  near(10000 - e.hp, 8, '格线三角伤害错误');
  assert(e.slowT > 0, '格线三角没有减速');
});
test('12 墨轨滑鞋：潜墨距离产生爆点，退出依次引爆', () => {
  fresh(); equip('trackshoes'); G.enterDive(); G.S.trackDistance = 99.9;
  G.keys.d = true; G.update(0.02); G.keys.d = false;
  assert(G.S.trackPoints.length === 1, '潜墨爆点未按距离生成');
  G.exitDive(); assert(G.S.trackPoints.length === 0 && G.erupts.some(er => er.dmg === 16), '退出没有引爆墨轨');
});
test('13 橡皮鞋底：潜墨擦灰产生追踪橡皮屑', () => {
  fresh(); G.addHostileInk(0, 0, 10, 65); equip('erasershoes'); target(100, 0); G.enterDive(); G.update(0.13);
  assert(G.bullets.some(b => b.col === '#d7cbb8' && b.dmg === 14), '擦灰没有发射橡皮屑');
});
test('14 空白舞鞋：空白移动布刃，吸墨召回造成伤害', () => {
  fresh(); equip('blankshoes'); G.S.blankDistance = 89;
  G.keys.d = true; G.update(0.02); G.keys.d = false;
  assert(G.S.blankBlades.length === 1, '空白移动没有留下纸刃');
  const e = target(50, 0); G.player.x = 100;
  assert(G.castAbsorb(), '吸墨释放失败');
  assert(G.S.blankBlades.length === 0 && G.S.recalls.length === 1, '纸刃没有召回');
  near(10000 - e.hp, 18, '召回纸刃伤害错误');
});
test('15 墨胆吊坠：溢出回墨形成墨滴，主动消耗发射', () => {
  fresh(); G.addInkStain(0, 0, 10, 60, '#1a2b8f'); equip('pendant'); G.player.ink = G.player.maxInk;
  G.updatePlayerInk(100); assert(G.S.droplets === 6, '溢出墨滴没有达到上限');
  target(); const a = G.player.actives[0]; G.fireSkill(a, G.skillCalc(a));
  assert(G.S.droplets === 5 && G.bullets.some(b => b.dmg === 16 * 1.08), '主动没有消耗墨滴发射墨弹');
  assert(G.player.maxInk === 100, '旧墨水上限词条仍然残留');
});
test('16 灵感书签：每三次升级提升一个未满级辅助', () => {
  fresh(); equip('bookmark'); G.player.actives[0].supports = [{ id: 'wide', lvl: 1 }];
  G.runtime.applyLevelEquipment(); G.runtime.applyLevelEquipment(); G.runtime.applyLevelEquipment();
  assert(G.player.actives[0].supports[0].lvl === 2, '辅助没有被抄录升级');
});
test('17 低压墨囊：低墨主动命中分裂两枚碎墨', () => {
  fresh(); equip('lowink'); const e = target(); G.player.ink = 0; hit(e);
  assert(G.bullets.length === 2 && G.bullets.every(b => b.dmg === 3.5), '低墨碎墨数量或伤害错误');
});
test('18 满墨瓶塞：额外耗墨并在一秒后原位置复爆', () => {
  fresh(); equip('fullink'); target(); const a = G.player.actives[0]; G.fireSkill(a, G.skillCalc(a));
  assert(G.S.echoes.length === 1 && G.player.ink === 92, '满墨复爆没有储存或额外耗墨错误');
  G.update(1.01); assert(G.S.echoes.length === 0, '一秒后复爆没有执行');
});
test('19 墨渍放大镜：覆盖灰墨留标记，墨潮全部引爆', () => {
  fresh(); G.addHostileInk(0, 0, 10, 70); equip('inklens'); G.convertGrayDisk(0, 0, 70);
  assert(G.S.lensMarks.length > 0, '覆盖灰墨没有留下标记');
  const count = G.S.lensMarks.length; G.player.special = 100; G.castInkSurge(100, false);
  assert(G.S.lensMarks.length === 0 && G.erupts.filter(er => er.dmg === 18 * 1.06).length === count, '墨潮没有引爆全部标记');
});
test('装备文案与旧数值：无生命门槛、持续回血和新鞋移速残留', () => {
  const ids = ['highscore', 'cloak', 'cliparmor'];
  for (const id of ids) for (let r = 0; r < 4; r++) {
    const text = G.itemDescription(id, r);
    assert(!/生命高于|生命低于|每秒回复|每秒回复|持续回复/.test(text), id + ' 仍有禁用设计：' + text);
  }
  for (const id of ['gridshoes', 'trackshoes', 'erasershoes', 'blankshoes']) {
    fresh(); equip(id); assert(G.player.eqSpd === 1 && !G.itemDescription(id).includes('移速'), id + ' 旧移速仍残留');
  }
});
test('金色保护期间不会消耗纸甲或储存受击伤害', () => {
  fresh(); equip('blotarmor'); G.S.armorLayers = 2; G.player.goldT = 1;
  const hp = G.player.hp; G.hurtPlayer(100);
  assert(G.player.hp === hp && G.S.armorLayers === 2 && G.S.inkStored === 0, '无敌期间错误消耗装备资源');
});

if (failed) { console.error('EQUIPMENT_REWORK_TEST_FAILURES: ' + failed); process.exit(1); }
console.log('EQUIPMENT_REWORK_TEST_OK: 21');

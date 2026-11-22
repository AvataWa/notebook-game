// 主动技能范围、弹数、连续刀阵、新装备与暂停式养成面板的快速单元测试
const fs = require('fs');
const src = ['battle-config.js', 'enemy-config.js', 'content-config.js', 'main.js', 'build-runtime.js', 'build-view.js', 'form-passives-runtime.js']
  .map(f => fs.readFileSync(__dirname + '/' + f, 'utf8').replace("'use strict';", '')).join('\n');
const drawTexts = [];
const fakeCtx = new Proxy({}, { get(t, k) {
  if (k === 'measureText') return txt => ({ width: String(txt).length * 10 });
  if (k === 'fillText') return txt => { drawTexts.push(String(txt)); };
  return () => {};
}, set() { return true; } });
const fakeCanvas = { getContext: () => fakeCtx, width: 0, height: 0, style: {}, addEventListener() {}, getBoundingClientRect: () => ({ left: 0, top: 0, width: 375, height: 667 }) };
global.window = { addEventListener() {}, devicePixelRatio: 1, innerWidth: 375, innerHeight: 667 };
global.document = { getElementById: () => fakeCanvas }; global.requestAnimationFrame = () => {};
eval(src + `
;globalThis.G = {
  resetGame, update, render, loop, skillCalc, fireSkill, fireBullet, spawnEnemy, spawnCycloneStroke, applyOption, recomputeEquip, itemV,
  get BATTLE() { return BATTLE; }, get SKILL_DEFS() { return SKILL_DEFS; }, get ITEM_DEFS() { return ITEM_DEFS; },
  get player() { return player; }, get enemies() { return enemies; }, get bullets() { return bullets; },
  get blades() { return blades; }, get totems() { return totems; }, get state() { return state; }, set state(v) { state = v; },
  get cards() { return cards; }, set cards(v) { cards = v; }, get gameTime() { return gameTime; },
  get buildView() { return window.__buildView; }
};`);
let failed = 0, passed = 0;
function test(name, fn) { try { fn(); passed++; console.log('OK  ' + name); } catch (e) { failed++; console.log('ERR ' + name + ': ' + e.stack.split('\n')[0]); } }
function assert(ok, msg) { if (!ok) throw new Error(msg); }
function near(a, b, eps = 0.001) { return Math.abs(a - b) < eps; }
function fresh(id = 'cyclone', lvl = 1) {
  G.resetGame(); G.state = 'play'; G.player.xpNext = 999999; G.player.hp = G.player.maxhp = 9999;
  G.player.actives = [{ id, lvl, supports: [], t: 999, uc: 0 }];
}
function equip(key, rarity = 0) {
  const slot = G.ITEM_DEFS[key].slot; G.player.equip[slot] = { key, rarity }; G.recomputeEquip();
}
function target(x, y) {
  G.spawnEnemy('stick', x, y);
  const e = G.enemies[G.enemies.length - 1]; e.hp = e.maxhp = 9999; e.stunT = 999; e.r = 4; return e;
}

test('主动池为 18 个且不含涂鸦小鬼，赦免粉笔保留环绕激光纸蝶', () => {
  fresh();
  assert(Object.keys(G.SKILL_DEFS).length === 18, '主动数量不是 18');
  assert(!G.SKILL_DEFS.srs, '涂鸦小鬼仍在主动池');
  assert(G.SKILL_DEFS.absolve && G.SKILL_DEFS.absolve.desc.includes('激光纸蝶'), '赦免粉笔的环绕激光纸蝶被误删');
});

test('连笔短直线独立落在怪物身上，同线近敌叠两层而线外敌人不受影响', () => {
  fresh('cyclone'); let e = target(120, 0); const close = target(140, 0), far = target(190, 0);
  const c = G.skillCalc(G.player.actives[0]);
  const stroke = G.spawnCycloneStroke(c, 0, 1, 0, e, { angle: 0 });
  assert(G.blades.length === 1 && stroke.kind === 'scribble' && stroke.points.length === 2, '连笔没有生成两个端点的短直线');
  assert(near(stroke.x, e.x) && near(stroke.y, e.y), '短直线中心不在主目标身上');
  assert(near(stroke.length, (e.r * 2 + 42) * c.rad), '短直线长度没有按目标体型生成');
  assert(stroke.points.every(p => Math.hypot(p.x - G.player.x, p.y - G.player.y) > 1), '短直线仍与玩家相连');
  assert(e.hp < e.maxhp && close.hp < close.maxhp && far.hp === far.maxhp, '同一直线的碰撞范围错误');
  assert(e.waxStacks === 2 && close.waxStacks === 2 && !far.waxStacks, '同线多怪没有正确叠加两层蜡色');
  assert(stroke.comboCount === 2 && stroke.hitIds.includes(e.id) && stroke.hitIds.includes(close.id) && !stroke.hitIds.includes(far.id), '同线命中记录错误');
  fresh('candle'); e = target(120, 0); G.fireSkill(G.player.actives[0], G.skillCalc(G.player.actives[0]));
  assert(e.hp < e.maxhp, '125 像素蜡烛头未命中 120 像素目标');
  fresh('cola'); e = target(140, 0); G.fireSkill(G.player.actives[0], G.skillCalc(G.player.actives[0]));
  assert(e.hp < e.maxhp, '150 像素冰可乐新星未命中 140 像素目标');
});

test('单怪三次独立涂抹依次叠一层、两层并触发刮蜡爆发', () => {
  fresh('cyclone'); const e = target(120, 0), c = G.skillCalc(G.player.actives[0]), damage = [];
  for (let i = 0; i < 3; i++) {
    const hp = e.hp;
    G.spawnCycloneStroke(c, 0, 1, 0, e, { angle: 0 });
    damage.push(hp - e.hp);
    if (i < 2) assert(e.waxStacks === i + 1 && !e.waxScrapes, '第 ' + (i + 1) + ' 次涂抹的蜡色层数错误');
  }
  assert(e.waxStacks === 0 && e.waxScrapes === 1, '第三层没有清空蜡色并触发刮蜡');
  assert(damage[2] > damage[0] * 2, '刮蜡没有造成明显的额外爆发伤害');
});

test('连笔升级增加独立短直涂抹次数，不生成玩家轨迹或连敌路径', () => {
  for (const [lvl, count] of [[1, 1], [3, 2], [5, 3]]) {
    fresh('cyclone', lvl); const e = target(120, 0);
    G.fireSkill(G.player.actives[0], G.skillCalc(G.player.actives[0]));
    assert(G.blades.length === count, 'Lv' + lvl + ' 短直涂抹次数错误');
    assert(G.blades.every(b => b.points.length === 2 && near(b.x, e.x) && near(b.y, e.y)), 'Lv' + lvl + ' 的补写没有独立落在目标身上');
    assert(G.blades.every(b => !b.routeIds && b.points.every(p => Math.hypot(p.x - G.player.x, p.y - G.player.y) > 1)), 'Lv' + lvl + ' 仍残留玩家轨迹或连敌路径');
  }
});

test('子弹技能 Lv2、Lv4 各加一弹，冰锥图钉真实扇形多发', () => {
  for (const [lvl, bonus] of [[1, 0], [2, 1], [4, 2]]) {
    fresh('icespear', lvl); const a = G.player.actives[0];
    assert(G.skillCalc(a).count === bonus, 'Lv' + lvl + ' 弹数成长错误');
    target(100, 0); G.fireSkill(a, G.skillCalc(a));
    assert(G.bullets.length === 1 + bonus, '冰锥图钉 Lv' + lvl + ' 实际子弹数错误');
    assert(G.bullets.every(b => b.size === 1.2), '子弹没有统一放大 20%');
  }
});

test('炮台使用统一配置弹速，升级弹数会传给每座炮台', () => {
  fresh('ballista', 4); const a = G.player.actives[0];
  G.fireSkill(a, G.skillCalc(a)); target(110, 0);
  assert(G.totems.length === 1 && G.totems[0].shots === 3, '炮台没有保存三弹射击');
  G.update(0.5);
  const shots = G.bullets.filter(b => b.kind === 'nib');
  assert(shots.length === 3, '炮台没有实际发射三颗子弹');
  assert(shots.every(b => near(Math.hypot(b.vx, b.vy), G.BATTLE.skills.ballistaBulletSpeed)), '炮台没有读取统一弹速配置');
});

test('涂改带每次两条、上限六条，固定落点不跟随角色移动', () => {
  fresh('vortex'); const a = G.player.actives[0], c = G.skillCalc(a);
  for (let i = 0; i < 4; i++) G.fireSkill(a, c);
  assert(G.blades.length === 6 && G.blades.every(b => b.kind === 'tape'), '涂改带数量或类型错误');
  const positions = G.blades.map(b => [b.x, b.y, b.ang]);
  G.player.x += 200; G.player.y += 120; G.update(0.016);
  assert(G.blades.every((b, i) => b.x === positions[i][0] && b.y === positions[i][1] && b.ang === positions[i][2]), '涂改带仍围绕角色运动');
});

test('涂改带封锁 0.35 秒后整片撕起，矩形内目标受伤并减速', () => {
  fresh('vortex'); const a = G.player.actives[0], c = G.skillCalc(a), e = target(100, 0);
  G.fireSkill(a, c);
  assert(e.hp === e.maxhp, '涂改带铺下时提前造成伤害');
  G.update(0.2); assert(e.hp === e.maxhp && !G.blades[0].torn, '封锁延迟不足');
  G.update(0.2);
  assert(e.hp < e.maxhp && G.blades[0].torn, '撕页没有命中矩形区域');
  assert(e.slowT > 0, '撕页没有施加减速');
});

test('形态被动追加回锋笔痕与垂直封条，不再创建环绕物', () => {
  fresh('cyclone'); G.player.taken.form_cyclone = true; const e = target(100, 0);
  G.fireSkill(G.player.actives[0], G.skillCalc(G.player.actives[0]));
  assert(G.blades.length === 2 && G.blades.every(b => b.kind === 'scribble'), '回锋连写没有追加反向笔痕');
  assert(G.blades[1].delay > 0 && G.blades[1].x === e.x && G.blades[1].y === e.y, '回锋笔痕延迟或瞄准中心错误');
  assert(G.blades[1].points.every((p, i, arr) => {
    const source = G.blades[0].points[arr.length - 1 - i];
    return p.x === source.x && p.y === source.y;
  }), '回锋没有沿同一直线反向返回');
  const hp = e.hp; G.update(0.15); assert(e.hp <= hp - 7.7, '回锋笔痕没有实际补伤');
  fresh('vortex'); G.player.taken.form_vortex = true; target(100, 0);
  G.fireSkill(G.player.actives[0], G.skillCalc(G.player.actives[0]));
  assert(G.blades.length === 4 && G.blades.every(b => b.kind === 'tape'), '十字封页没有生成四条涂改封条');
  assert(near(Math.abs(Math.sin(G.blades[0].ang - G.blades[2].ang)), 1), '追加封条没有垂直交叉');
});

test('散墨头带增加弹数，广角书签增加所有主动范围', () => {
  fresh('icespear', 4); equip('scatterband', 3); equip('widependant', 2);
  const c = G.skillCalc(G.player.actives[0]);
  assert(c.count === 4, '史诗散墨头带没有额外增加 2 弹');
  assert(near(c.rad, 1.26), '传说广角书签没有增加 26% 范围');
  fresh('candle'); equip('widependant', 0);
  assert(near(G.skillCalc(G.player.actives[0]).rad, 1.15), '范围装备对非子弹技能无效');
});

test('重复通用被动正确计数，养成三页都能读取当前构筑', () => {
  fresh();
  for (let i = 0; i < 2; i++) { G.cards = [{ kind: 'passive', id: 'dmg' }]; G.state = 'levelup'; G.applyOption(0); }
  assert(G.player.passiveCounts.dmg === 2, '重复被动没有累计层数');
  G.player.affixes.dive.fastdive = true;
  G.player.actives[0].supports.push({ id: 'wide', lvl: 2 });
  equip('widependant', 1);
  assert(G.buildView.open() && G.state === 'build', '养成面板无法打开');
  assert(G.buildView.entries().length === 1, '技能页读取错误');
  G.buildView.setTab('affixes');
  assert(G.buildView.entries().some(e => e.kind === 'passive' && e.count === 2), '词条页没有重复被动层数');
  assert(G.buildView.entries().some(e => e.kind === 'operation'), '词条页没有操作辅助');
  G.buildView.setTab('equipment');
  assert(G.buildView.entries().length === 1 && G.buildView.entries()[0].eq.key === 'widependant', '装备页读取错误');
});

test('养成面板渲染完整且暂停战斗计时，返回后恢复', () => {
  fresh(); const before = G.gameTime;
  G.buildView.open(); G.buildView.setTab('skills'); drawTexts.length = 0; G.loop(1000);
  assert(G.gameTime === before, '面板打开后战斗计时仍然推进');
  assert(drawTexts.includes('角色养成'), '养成标题未绘制：' + drawTexts.slice(-12).join('|'));
  assert(drawTexts.includes('已暂停 · 点按条目看详情'), '暂停信息未绘制：' + drawTexts.slice(-12).join('|'));
  G.buildView.setTab('affixes'); G.render(); assert(drawTexts.includes('词条'), '词条页签无法切换');
  G.buildView.setTab('equipment'); G.render(); assert(drawTexts.includes('装备'), '装备页签无法切换');
  assert(G.buildView.close() && G.state === 'play', '返回战斗失败');
});

test('养成面板可从战斗和三选一打开，返回后保留原界面与卡牌', () => {
  fresh(); G.state = 'levelup'; G.cards = [{ kind: 'passive', id: 'dmg' }];
  const levelCards = G.cards;
  assert(G.buildView.open() && G.state === 'build', '升级三选一无法打开养成');
  assert(G.buildView.close() && G.state === 'levelup' && G.cards === levelCards, '返回后未恢复升级三选一');
  G.resetGame(); const startCards = G.cards;
  assert(G.buildView.open() && G.state === 'build', '起手三选一无法打开养成');
  assert(G.buildView.close() && G.state === 'start' && G.cards === startCards, '返回后未恢复起手三选一');
});

console.log(failed ? 'ACTIVE_REWORK_TEST_FAILURES: ' + failed : 'ACTIVE_REWORK_TEST_OK (' + passed + '/' + passed + ')');
process.exit(failed ? 1 : 0);

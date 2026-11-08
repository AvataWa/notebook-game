// 主动技能范围、弹数、连续刀阵、新装备与暂停式养成面板的快速单元测试
const fs = require('fs');
const src = ['battle-config.js', 'enemy-config.js', 'content-config.js', 'main.js', 'build-runtime.js', 'build-view.js']
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
  resetGame, update, render, loop, skillCalc, fireSkill, fireBullet, spawnEnemy, applyOption, recomputeEquip, itemV,
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

test('主动池为 18 个且不含涂鸦小鬼，友方转化系统仍保留', () => {
  fresh();
  assert(Object.keys(G.SKILL_DEFS).length === 18, '主动数量不是 18');
  assert(!G.SKILL_DEFS.srs, '涂鸦小鬼仍在主动池');
  assert(G.SKILL_DEFS.absolve && G.SKILL_DEFS.absolve.desc.includes('己方小鬼'), '赦免粉笔的友方小鬼被误删');
});

test('旋转蜡笔、蜡烛头与冰可乐新星按新半径实际命中', () => {
  fresh('cyclone'); let e = target(120, 0); G.fireSkill(G.player.actives[0], G.skillCalc(G.player.actives[0]));
  assert(e.hp < e.maxhp, '125 像素旋转蜡笔未命中 120 像素目标');
  fresh('candle'); e = target(120, 0); G.fireSkill(G.player.actives[0], G.skillCalc(G.player.actives[0]));
  assert(e.hp < e.maxhp, '125 像素蜡烛头未命中 120 像素目标');
  fresh('cola'); e = target(140, 0); G.fireSkill(G.player.actives[0], G.skillCalc(G.player.actives[0]));
  assert(e.hp < e.maxhp, '150 像素冰可乐新星未命中 140 像素目标');
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

test('炮台弹速 620，升级弹数会传给每座炮台', () => {
  fresh('ballista', 4); const a = G.player.actives[0];
  G.fireSkill(a, G.skillCalc(a)); target(110, 0);
  assert(G.totems.length === 1 && G.totems[0].shots === 3, '炮台没有保存三弹射击');
  G.update(0.5);
  const shots = G.bullets.filter(b => b.kind === 'nib');
  assert(shots.length === 3, '炮台没有实际发射三颗子弹');
  assert(shots.every(b => near(Math.hypot(b.vx, b.vy), 620)), '炮台弹速不是 620');
});

test('刀阵每次两枚、上限六枚，并严格均匀分布在 125 像素整圈', () => {
  fresh('vortex'); const a = G.player.actives[0], c = G.skillCalc(a);
  for (let i = 0; i < 4; i++) G.fireSkill(a, c);
  assert(G.blades.length === 6, '刀阵上限不是 6');
  G.update(0.016);
  assert(G.blades.every(b => near(Math.hypot(b.x - G.player.x, b.y - G.player.y), 125, 0.01)), '刀阵轨道半径错误');
  const angles = G.blades.map(b => Math.atan2(b.y - G.player.y, b.x - G.player.x)).sort((a, b) => a - b);
  for (let i = 0; i < angles.length; i++) {
    const next = i === angles.length - 1 ? angles[0] + Math.PI * 2 : angles[i + 1];
    assert(near(next - angles[i], Math.PI * 2 / 6, 0.0001), '刀阵不是均匀整圈');
  }
});

test('刀阵使用连续扫线命中，轨迹中段远离端点也能受伤', () => {
  fresh('vortex'); const a = G.player.actives[0], c = G.skillCalc(a);
  G.fireSkill(a, c); G.update(0.016);
  const bl = G.blades[0], nextA = bl.ang + 0.2 * 3.2;
  const nx = G.player.x + Math.cos(nextA) * 125, ny = G.player.y + Math.sin(nextA) * 125;
  const e = target((bl.x + nx) / 2, (bl.y + ny) / 2);
  const oldHp = e.hp; G.update(0.2);
  assert(e.hp < oldHp, '怪物位于扫线中段却没有被命中');
});

test('散墨头带增加弹数，广角书签增加所有主动范围', () => {
  fresh('icespear', 4); equip('scatterband', 3); equip('widependant', 2);
  const c = G.skillCalc(G.player.actives[0]);
  assert(c.count === 4, '史诗散墨头带没有额外增加 2 弹');
  assert(near(c.rad, 1.34), '传说广角书签没有增加 34% 范围');
  fresh('candle'); equip('widependant', 0);
  assert(near(G.skillCalc(G.player.actives[0]).rad, 1.2), '范围装备对非子弹技能无效');
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
  assert(drawTexts.includes('游戏已暂停 · 共 1 项'), '暂停信息未绘制：' + drawTexts.slice(-12).join('|'));
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

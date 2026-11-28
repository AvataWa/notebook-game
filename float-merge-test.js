// 战斗跳字合并回归：只检查显示聚合，并核对真实伤害、资源结算不变。
const fs = require('fs');
const src = ['battle-config.js', 'enemy-config.js', 'content-config.js', 'main.js', 'build-runtime.js', 'float-merge-runtime.js']
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
  resetGame, hurtEnemy, hurtPlayer, castAbsorb, showParryFloat, rewardAbsorb, refundInk, addPlayerInkFloat,
  addPlayerHealFloat, addPaperShieldFloat, spawnEnemy,
  mergeDamageFeedback(first) { return window.FloatMergeRuntime.mergeDamageFeedback(first); },
  get player() { return player; }, get enemies() { return enemies; }, get floats() { return floats; },
  get gameTime() { return gameTime; }, set gameTime(v) { gameTime = v; },
  get state() { return state; }, set state(v) { state = v; }
};`);
let failed = 0;
function test(name, fn) { try { fn(); console.log('OK  ' + name); } catch (e) { failed++; console.log('ERR ' + name + ': ' + e.stack.split('\n')[0]); } }
function assert(ok, msg) { if (!ok) throw new Error(msg); }
function fresh() {
  G.resetGame(); G.state = 'play'; G.player.hp = G.player.maxhp = 9999;
  G.player.actives = [{ id: 'cyclone', lvl: 1, supports: [], t: 999, uc: 0 }];
}
function enemy() { G.spawnEnemy('stick', 50, 0); return G.enemies[G.enemies.length - 1]; }

test('同怪同来源持续伤害在 0.3 秒内累计，实际扣血不丢失', () => {
  fresh(); const e = enemy(), hp = e.hp;
  G.hurtEnemy(e, 2, 0, e.x, e.y, 0, -1, 0, '#123456', true, 'candle');
  G.hurtEnemy(e, 3, 0, e.x, e.y, 0, -1, 0, '#123456', true, 'candle');
  assert(G.floats.length === 1 && G.floats[0].txt === '5', '持续伤害没有累计：' + G.floats.map(f => f.txt));
  assert(hp - e.hp === 5, '合并显示改变了实际伤害');
  G.gameTime = 0.31;
  G.hurtEnemy(e, 4, 0, e.x, e.y, 0, -1, 0, '#123456', true, 'candle');
  assert(G.floats.length === 2 && G.floats[1].txt === '4', '窗口结束后仍被错误合并');
});

test('不同怪物、不同来源与直接命中不互相合并', () => {
  fresh(); const a = enemy(), b = enemy();
  G.hurtEnemy(a, 2, 0, 0, 0, 0, -1, 0, '#123456', true, 'candle');
  G.hurtEnemy(a, 3, 0, 0, 0, 0, -1, 0, '#123456', true, 'frost');
  G.hurtEnemy(b, 4, 0, 0, 0, 0, -1, 0, '#123456', true, 'candle');
  G.hurtEnemy(a, 5, 0, 0, 0, 0, -1, 0, '#123456', false, 'candle');
  assert(G.floats.length === 4, '不同伤害来源被错误合并');
  assert(G.floats.filter(f => f.mergeKey).length === 3, '直接命中不应带持续伤害合并键');
});

test('同次吸墨弹反累计，下一次吸墨重新显示单次弹反', () => {
  fresh(); assert(G.castAbsorb(), '首次吸墨未成功');
  G.showParryFloat(); G.showParryFloat();
  assert(G.floats.filter(f => f.txt.startsWith('弹反')).length === 1 && G.floats[0].txt === '弹反 ×2', '同次弹反未合并');
  G.player.absorbCd = 0; assert(G.castAbsorb(), '第二次吸墨未成功'); G.showParryFloat();
  const parries = G.floats.filter(f => f.txt.startsWith('弹反'));
  assert(parries.length === 2 && parries[1].txt === '弹反！', '不同吸墨被错误合并');
});

test('玩家墨水收益在 0.4 秒内汇总且实际到账不变', () => {
  fresh(); G.player.ink = 40; G.player.maxInk = 100;
  const gainedA = G.refundInk(2), gainedB = G.refundInk(3);
  G.addPlayerInkFloat(gainedA); G.addPlayerInkFloat(gainedB);
  assert(G.player.ink === 45 && G.floats.length === 1 && G.floats[0].txt === '墨 +5', '墨水收益或累计文字错误');
  G.gameTime = 0.41; G.addPlayerInkFloat(G.refundInk(1));
  assert(G.player.ink === 46 && G.floats.length === 2 && G.floats[1].txt === '墨 +1', '墨水收益窗口结束处理错误');
});

test('弹反返墨保持实际到账，但不再显示墨水收益数字', () => {
  fresh(); G.player.ink = 50; G.player.maxInk = 100;
  assert(G.castAbsorb(), '吸墨未成功');
  assert(G.rewardAbsorb(3) === 3 && G.player.ink === 53, '弹反实际返墨被改变');
  G.showParryFloat();
  assert(G.floats.some(f => f.txt === '弹反！'), '普通角色缺少弹反反馈');
  assert(!G.floats.some(f => f.txt.startsWith('墨 +')), '弹反仍显示返墨数字');
});

test('治疗提示在 0.4 秒内弱显累计，显示合并不修改生命', () => {
  fresh(); G.player.hp = 80; G.player.maxhp = 100;
  G.addPlayerHealFloat(2); G.addPlayerHealFloat(3);
  assert(G.player.hp === 80, '显示合并意外修改了生命');
  assert(G.floats.length === 1 && G.floats[0].txt === '+5' && G.floats[0].weak, '治疗提示没有累计并弱显');
  G.gameTime = 0.41; G.addPlayerHealFloat(1);
  assert(G.floats.length === 2 && G.floats[1].txt === '+1', '治疗提示窗口结束处理错误');
});

test('纸甲获得在 0.4 秒内弱显累计', () => {
  fresh(); G.addPaperShieldFloat(1); G.addPaperShieldFloat(2);
  assert(G.floats.length === 1 && G.floats[0].txt === '纸甲 +3' && G.floats[0].weak, '纸甲获得没有累计并弱显');
  G.gameTime = 0.41; G.addPaperShieldFloat(1);
  assert(G.floats.length === 2 && G.floats[1].txt === '纸甲 +1', '纸甲获得窗口结束处理错误');
});

test('普通承伤仍扣相同生命，只保留一条结果', () => {
  fresh(); G.player.hp = G.player.maxhp = 100;
  G.hurtPlayer(12, 'enemy');
  assert(G.player.hp === 88, '普通承伤结算改变');
  assert(G.floats.length === 1 && G.floats[0].txt === '-12', '普通承伤跳字错误：' + G.floats.map(f => f.txt));
});

test('扣血与纸甲合并，且不误删同次装备触发名', () => {
  fresh(); G.floats.push({ txt: '既有提示' }); const first = G.floats.length;
  G.floats.push({ txt: '纸甲 -8' }, { txt: '-12' }, { txt: '踉跄疾书' });
  G.mergeDamageFeedback(first);
  assert(G.floats.length === 3 && G.floats[0].txt === '既有提示' && G.floats[1].txt === '踉跄疾书', '既有文字或装备触发名被误删');
  const merged = G.floats.find(f => f.txt.includes('纸甲挡'));
  assert(merged && merged.txt === '-12（纸甲挡 8）', '扣血与纸甲未正确合并');
});

test('完全吸收与双层防护各显示一条明确结果', () => {
  fresh(); G.floats.push({ txt: '纸甲 -12' }); G.mergeDamageFeedback(0);
  assert(G.floats.length === 1 && G.floats[0].txt === '纸甲挡 12', '完全纸甲吸收显示错误');
  fresh(); G.floats.push({ txt: '盾 -4' }, { txt: '纸甲 -8' }, { txt: '-12' }); G.mergeDamageFeedback(0);
  assert(G.floats.length === 1 && G.floats[0].txt === '-12（防护挡 12）', '双层防护合并显示错误');
});

if (failed) { console.error('FLOAT_MERGE_TEST_FAILURES: ' + failed); process.exit(1); }
console.log('FLOAT_MERGE_TEST_OK');

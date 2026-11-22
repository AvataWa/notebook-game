// 通用辅助扩展：匹配、范围派生、弹道行为、打击派生与虚弱专项测试
const fs = require('fs');
const src = ['battle-config.js', 'enemy-config.js', 'content-config.js', 'main.js', 'build-runtime.js', 'hades-runtime.js', 'hades-weapons-runtime.js', 'weapon-passives-expansion.js', 'form-passives-runtime.js', 'support-expansion-runtime.js', 'elemental-support-runtime.js', 'trigger-support-runtime.js', 'build-optimization-runtime.js', 'affix-dedup-runtime.js']
  .map(f => fs.readFileSync(__dirname + '/' + f, 'utf8').replace("'use strict';", '')).join('\n');
const fakeCtx = new Proxy({}, { get(t, k) {
  if (k === 'measureText') return txt => ({ width: String(txt).length * 10 });
  return () => {};
}, set() { return true; } });
const fakeCanvas = { getContext: () => fakeCtx, width: 0, height: 0, style: {}, addEventListener() {}, getBoundingClientRect: () => ({ left: 0, top: 0, width: 375, height: 667 }) };
global.window = { addEventListener() {}, devicePixelRatio: 1, innerWidth: 375, innerHeight: 667 };
global.document = { getElementById: () => fakeCanvas }; global.requestAnimationFrame = () => {};
eval(src + `
;globalThis.G = {
  resetGame, fireSkill, skillCalc, spawnEnemy, hurtEnemy, hurtPlayer, killEnemy, areaHit, applyOption, supportUsable, supDesc,
  get SKILL_DEFS() { return SKILL_DEFS; }, get SUPPORTS() { return SUPPORTS; }, get PASSIVES() { return PASSIVES; },
  get player() { return player; }, get enemies() { return enemies; }, get bullets() { return bullets; },
  get ebullets() { return ebullets; }, get lightnings() { return lightnings; }, get floats() { return floats; },
  get followups() { return followups; }, get state() { return state; }, set state(v) { state = v; },
  get cards() { return cards; }, set cards(v) { cards = v; }, get gameTime() { return gameTime; }, set gameTime(v) { gameTime = v; },
  get E() { return window.__supportExpansion; }, get H() { return window.__hadesRuntime; }, get W() { return window.__weaponRuntime; }
};`);
global.AffixDedupRuntime = window.AffixDedupRuntime;
let failed = 0, passed = 0;
function test(name, fn) { try { fn(); passed++; console.log('OK  ' + name); } catch (e) { failed++; console.log('ERR ' + name + ': ' + e.stack.split('\n')[0]); } }
function assert(ok, msg) { if (!ok) throw new Error(msg); }
function fresh(id = 'cyclone', supports = []) {
  G.resetGame(); G.state = 'play'; G.player.xpNext = 999999; G.player.hp = G.player.maxhp = 9999;
  G.player.actives = [{ id, lvl: 1, supports: supports.map(id => ({ id, lvl: 1 })), t: 999, uc: 0 }];
}
function target(x, y) {
  G.spawnEnemy('stick', x, y); const e = G.enemies[G.enemies.length - 1];
  e.hp = e.maxhp = 9999; e.stunT = 999; e.r = 4; e.dmg = 20; return e;
}
function calc() { const a = G.player.actives[0]; return G.skillCalc(a); }
function cast() { return G.fireSkill(G.player.actives[0], calc()); }

test('保留的扩展辅助均有描述，匹配修复与排斥关系正确', () => {
  fresh(); assert(Object.keys(G.SUPPORTS).length === 67 && G.E.ids.filter(id => G.SUPPORTS[id]).length === 13, '扩展辅助数量错误：' + Object.keys(G.SUPPORTS).length);
  for (const id of G.E.ids.filter(id => G.SUPPORTS[id])) assert(G.supDesc(id, 1).length > 0, id + ' 缺少描述');
  assert(!G.SUPPORTS.weakcount && !G.SUPPORTS.weakpower && !G.SKILL_DEFS.weakmark, '红笔减分或专属辅助仍存在');
  assert(G.supportUsable('chain', 'arc') && G.supportUsable('chain', 'brand') && G.supportUsable('dur', 'ballista'), '连锁或炮台持续未开放');
  for (const id of ['sharpen','inkpool']) assert(G.supportUsable(id, 'ricoshield'), '飞盾缺少 ' + id);
  assert(!G.SUPPORTS.projrepeat && !G.supportUsable('projrepeat', 'icespear'), '连发仍可获取');
  assert(!G.supportUsable('projreturn', 'boomerang'), '自然折返弹道被错误追加返程');
});

test('落雷批注按周期雷击范围内敌人', () => {
  fresh('cyclone', ['areastorm']); const e = target(60, 0); cast(); const hp = e.hp;
  G.E.updateZones(0.25); assert(e.hp < hp && G.lightnings.length > 0, '落雷没有真实伤害或表现');
});

test('墨刺丛生每秒生成多根有伤害的墨刺', () => {
  fresh('cyclone', ['areaspikes']); const e = target(50, 0); cast(); const hp = e.hp;
  G.E.updateZones(0.35); assert(e.hp < hp && G.E.state.fx.some(f => f.type === 'spike'), '墨刺没有伤害或实体表现');
});

test('外圈齿线只伤害外侧环带', () => {
  fresh('cyclone', ['areaouter']); const outer = target(125, 0), inner = target(15, 0); cast();
  const outerHp = outer.hp, innerHp = inner.hp; G.E.updateZones(0.3);
  assert(outer.hp < outerHp && inner.hp === innerHp, '外圈伤害误伤内圈或没有命中外圈');
});

test('蜡笔引力锚定短直线目标，不会把怪物牵引向角色', () => {
  fresh('cyclone', ['areagravity']); const focus = target(110, 0), pulled = target(160, 0); cast();
  const zone = G.E.state.zones[G.E.state.zones.length - 1];
  assert(zone && zone.x === focus.x && zone.y === focus.y && !zone.follow, '引力区域没有锚定短直线目标');
  const x = pulled.x, hp = pulled.hp; G.E.updateZones(0.25);
  assert(pulled.x < x && pulled.hp < hp, '近敌没有被拉向短直线中心或受到周期伤害');
  assert(focus.x === 110 && G.player.x === 0, '牵引错误移动了主目标或角色');
  const zx = zone.x; G.player.x = -100; G.E.updateZones(0.1);
  assert(zone.x === zx, '角色移动仍然带走了蜡笔牵引区域');
});

test('死亡溅墨由范围内死亡向两个目标传播', () => {
  fresh('cyclone', ['areadeath']); const dead = target(30, 0), a = target(50, 0), b = target(70, 0); cast();
  dead.hp = 1; const ah = a.hp, bh = b.hp; G.killEnemy(dead);
  assert(a.hp < ah && b.hp < bh, '死亡溅墨没有溅射两个敌人');
});

test('逐层加深按区域停留层数提高后续伤害', () => {
  fresh('cyclone', ['areastack']); const e = target(40, 0), c = calc();
  e.expAreaPresence = { cyclone: { t: 1, last: G.gameTime } }; const hp = e.hp;
  G.areaHit(e, 100, c, 0, 0); assert(Math.abs((hp - e.hp) - 112) < 0.001, '两层停留没有提供 12% 增伤：' + (hp - e.hp));
});

test('连发合并后由多重描线直接增加真实弹道', () => {
  fresh('icespear', ['multi']); target(150, 0); cast();
  assert(G.bullets.length === 2 && G.E.state.queue.length === 0, '多重描线没有直接增加子弹');
  assert(!G.SUPPORTS.projrepeat && !G.supportUsable('projrepeat', 'icespear'), '旧连发仍可获取');
});

test('折返笔迹与末端分岔在弹道终止时真实生成', () => {
  fresh('icespear', ['projreturn','projendsplit']); target(150, 0); cast(); const b = G.bullets[0];
  b.x = 200; b.y = 0; G.E.preUpdate(0.01); G.bullets.splice(0); G.E.postUpdate(0.016);
  assert(G.E.state.queue.length === 3, '终止后没有生成一枚返程和两枚分岔');
  G.E.preUpdate(0); assert(G.bullets.length === 3, '终止派生弹没有进入战斗');
});

test('逐笔加速每 0.2 秒提高速度和伤害', () => {
  fresh('icespear', ['projaccel']); target(150, 0); cast(); const b = G.bullets[0];
  const damage = b.dmg, speed = Math.hypot(b.vx, b.vy); G.E.preUpdate(0.21);
  assert(b.dmg > damage && Math.hypot(b.vx, b.vy) > speed, '子弹没有逐笔加速增伤');
});

test('交叉复审与落点余震分别延迟结算', () => {
  fresh('pageslash', ['strikecross','strikeaftershock']); const e = target(30, 0), c = calc(), hp = e.hp;
  G.areaHit(e, 20, c, 0, 0); assert(G.E.state.delayed.length === 2 && e.hp === hp - 20, '延迟打击创建或基础结算错误');
  G.E.updateDelayed(0.3); assert(e.hp < hp - 20 && G.E.state.delayed.length === 1, '交叉复审没有先结算');
  G.E.updateDelayed(0.2); assert(G.E.state.delayed.length === 0, '落点余震没有结算');
});

test('破阵重笔在单次命中至少三个敌人时追加结算', () => {
  fresh('pageslash', ['strikecrowd']); const c = calc(), es = [target(20, 0), target(30, 0), target(40, 0)];
  for (const e of es) G.areaHit(e, 10, c, 0, 0);
  assert(es.every(e => Math.abs((9999 - e.hp) - 14) < 0.001), '三敌命中没有全部追加 40% 伤害');
});

test('红笔收尾对低血普通怪与精英使用不同增幅', () => {
  fresh('pageslash', ['strikeexecute']); const normal = target(30, 0), elite = target(50, 0), c = calc();
  normal.hp = 100; elite.hp = 100; elite.elite = true;
  G.areaHit(normal, 10, c, 0, 0); G.areaHit(elite, 10, c, 0, 0);
  assert(Math.abs(normal.hp - 83) < 0.001 && Math.abs(elite.hp - 87.5) < 0.001, '低血增伤比例错误');
});

test('死线红勾由落点余震承接延迟爆发，并保留震荡', () => {
  fresh('doommark', ['strikeaftershock','shock']); const e = target(80, 0); cast(); e.stunT = 0;
  G.H.settleDoom(e, 1);
  assert(G.E.state.delayed.some(d => d.kind === 'aftershock') && e.stunT > 0, '死线未触发落点余震或震荡');
  assert(!G.SUPPORTS.followup && G.followups.length === 0, '旧追加一笔仍进入结算');
});

test('群箭数量和飞盾数值辅助真实生效', () => {
  fresh('arrowfocus', ['multi']); target(120, 0); cast();
  assert(G.W.state.bolts.length === 9, '群箭弹数错误');
  fresh('ricoshield', ['sharpen','inkpool']); const e = target(100, 0); cast(); const shield = G.W.state.shields[0], hp = e.hp;
  G.W.updateRicoshields(0.2); assert(hp - e.hp > 29 && shield.bounces === 1, '飞盾削尖笔尖没有增伤');
});

console.log(failed ? 'SUPPORT_EXPANSION_TEST_FAILURES: ' + failed : 'SUPPORT_EXPANSION_TEST_OK (' + passed + '/' + passed + ')');
process.exit(failed ? 1 : 0);

// 哈迪斯式第一批主动与被动的专项单元测试
const fs = require('fs');
const src = ['battle-config.js', 'enemy-config.js', 'content-config.js', 'main.js', 'build-runtime.js', 'hades-runtime.js']
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
  resetGame, update, fireSkill, skillCalc, spawnEnemy, hurtEnemy, hurtPlayer, updateSkills, updateMeleeSwing,
  buildOptions, applyOption, render, killEnemy, supportUsable,
  get SKILL_DEFS() { return SKILL_DEFS; }, get PASSIVES() { return PASSIVES; },
  get player() { return player; }, get enemies() { return enemies; }, get bullets() { return bullets; },
  get ebullets() { return ebullets; }, get floats() { return floats; }, get novas() { return novas; }, get sparks() { return sparks; },
  get state() { return state; }, set state(v) { state = v; }, get cards() { return cards; }, set cards(v) { cards = v; },
  get gameTime() { return gameTime; }, set gameTime(v) { gameTime = v; },
  get WORLD_R() { return WORLD_R; }, get H() { return window.__hadesRuntime; }
};`);
let failed = 0, passed = 0;
function test(name, fn) { try { fn(); passed++; console.log('OK  ' + name); } catch (e) { failed++; console.log('ERR ' + name + ': ' + e.stack.split('\n')[0]); } }
function assert(ok, msg) { if (!ok) throw new Error(msg); }
function fresh(id = 'bloodcore') {
  G.resetGame(); G.state = 'play'; G.player.xpNext = 999999; G.player.hp = G.player.maxhp = 9999;
  G.player.actives = [{ id, lvl: 1, supports: [], t: 999, uc: 0 }];
}
function target(x, y) {
  G.spawnEnemy('stick', x, y);
  const e = G.enemies[G.enemies.length - 1]; e.hp = e.maxhp = 9999; e.stunT = 999; e.r = 4; e.dmg = 20; return e;
}
function take(id) { G.cards = [{ kind: 'passive', id }]; G.state = 'levelup'; G.applyOption(0); G.state = 'play'; }
function cast() { const a = G.player.actives[0]; return G.fireSkill(a, G.skillCalc(a)); }
function hit(e, skill) { G.hurtEnemy(e, 1, 0, e.x, e.y, 0, 0, 0, '#000', false, skill); }

test('内容池增加三个主动和六条有前置条件的被动', () => {
  fresh('cyclone');
  assert(Object.keys(G.SKILL_DEFS).length === 21, '主动总数不是 21');
  assert(G.PASSIVES.length === 16, '被动总数不是 16');
  assert(!G.SKILL_DEFS.ramruler && !G.SKILL_DEFS.rulerwall, '撞墙主动仍在内容池');
  assert(!G.PASSIVES.some(p => ['henemywall', 'hbounce', 'hwallwave', 'hwallline'].includes(p.id)), '撞墙被动仍在内容池');
  assert(!G.PASSIVES.find(p => p.id === 'hdualcore').available(), '没有红芯投枪时仍提供扩芯弹匣');
  G.player.actives[0].id = 'bloodcore';
  assert(G.PASSIVES.find(p => p.id === 'hdualcore').available(), '有红芯投枪后仍无法获得扩芯弹匣');
});

test('红芯投枪不会提供无实际效果的普通弹幕辅助', () => {
  for (const id of ['multi', 'pierce', 'chain', 'homing', 'blast', 'unleash']) {
    assert(!G.supportUsable(id, 'bloodcore'), id + ' 仍可用于红芯投枪');
  }
  for (const id of ['brutal', 'swift', 'sharpen', 'projspd', 'heavynib', 'longshot', 'fatpipe']) {
    assert(G.supportUsable(id, 'bloodcore'), id + ' 被错误过滤');
  }
});

test('红芯默认三枚并可分别附着三个目标', () => {
  fresh(); const es = [target(100, 0), target(150, 0), target(200, 0)];
  assert(G.H.maxAmmo() === 3 && G.player.hadesCoreAmmo === 3, '默认红芯数量不是 3');
  assert(cast() && cast() && cast() && G.player.hadesCoreAmmo === 0 && G.H.state.shots.length === 3, '三枚红芯没有连续射出');
  for (let i = 0; i < 25; i++) G.H.updateShots(0.016);
  assert(es.every(e => e.hadesCoreT === 6), '三枚红芯没有分别附着目标：' + es.map(e => e.hadesCoreT).join(','));
});

test('红芯射出、嵌入、到期掉落和走近回收形成完整循环', () => {
  fresh(); const e = target(100, 0);
  assert(cast() && G.player.hadesCoreAmmo === 2, '红芯没有消耗弹药');
  assert(G.H.state.shots.length === 1 && G.bullets.length === 0, '红芯错误进入普通往返弹系统');
  G.H.updateShots(0.2);
  assert(e.hadesCoreT === 6 && e.hp < e.maxhp, '红芯没有命中并嵌入');
  G.H.updateCurses(6.1);
  assert(!e.hadesCoreT && G.H.state.shards.length === 1, '到期没有掉落红芯');
  G.player.x = e.x; G.player.y = e.y; G.H.updatePickups(0.016);
  assert(G.player.hadesCoreAmmo === 3 && !G.H.state.shards.length, '拾取没有恢复弹药');
});

test('落地红芯三秒后自动飞向玩家并恢复弹药', () => {
  fresh(); G.player.hadesCoreAmmo = 2; G.H.dropShard(180, 0);
  G.H.updatePickups(2.9);
  assert(!G.H.state.shards[0].returning && G.H.state.shards[0].x === 180 && G.player.hadesCoreAmmo === 2, '红芯提前自动回归');
  G.H.updatePickups(0.11);
  assert(G.H.state.shards[0].returning && G.H.state.shards[0].x < 180, '红芯到期后没有飞向玩家');
  G.H.updatePickups(0.5);
  assert(G.player.hadesCoreAmmo === 3 && !G.H.state.shards.length, '自动回归没有恢复弹药');
});

test('无红芯时自动施放等待且不消耗墨水', () => {
  fresh(); const a = G.player.actives[0]; a.t = 0; G.player.hadesCoreAmmo = 0; G.player.ink = 88;
  G.updateSkills(0.1);
  assert(G.player.ink === 88 && a.t === 0 && !G.H.state.shots.length, '无弹药仍扣墨或施放');
});

test('扩芯弹匣增加上限，拔芯创口只在自然到期时结算', () => {
  fresh(); take('hdualcore'); take('hcorewound');
  assert(G.H.maxAmmo() === 4 && G.player.hadesCoreAmmo === 4, '扩芯弹匣数值错误');
  const e = target(100, 0); cast(); G.H.updateShots(0.2); const hp = e.hp;
  G.H.updateCurses(6.1);
  assert(e.hp < hp && G.H.state.shards.length === 1, '自然脱落没有创口或重复掉落');
  e.dead = true;
  const e2 = target(110, 0); cast(); G.H.updateShots(0.2); const hp2 = e2.hp;
  G.killEnemy(e2);
  assert(e2.hp === hp2 && G.H.state.shards.length === 2, '死亡掉落错误触发创口或没有红芯');
});

test('虚弱降低真实来源伤害，死亡后半时传播', () => {
  fresh('weakmark'); target(100, 0); target(120, 0); target(140, 0); const spreadTarget = target(160, 0); cast();
  const weakened = G.enemies.filter(x => x.hadesWeakT > 0);
  assert(weakened.length === 3, '虚弱目标数量不是 3');
  G.player.hurtT = 0; const hp = G.player.hp; G.hurtPlayer(20, 'enemy', weakened[0]);
  assert(Math.round(hp - G.player.hp) === 14, '虚弱没有降低 30% 实际扣血');
  take('hweakspread'); const source = weakened[0], before = source.hadesWeakT;
  for (const other of weakened.slice(1)) other.dead = true;
  G.killEnemy(source);
  assert(Math.abs(spreadTarget.hadesWeakT - before / 2) < 0.0001, '虚弱没有按剩余半时传播：' + JSON.stringify(G.enemies.map(x => ({ id: x.id, dead: x.dead, weak: x.hadesWeakT }))));
});

test('死线延迟结算且不能刷新，两个不同主动可提前催动', () => {
  fresh('doommark'); const e = target(100, 0); cast(); const first = e.hadesDoom; const hp = e.hp;
  assert(first && !cast() && e.hadesDoom === first, '死线被重复刷新');
  G.H.updateCurses(1.4); assert(e.hp === hp && e.hadesDoom, '死线提前结算');
  G.H.updateCurses(0.2); assert(e.hp < hp && !e.hadesDoom, '死线到期未结算');
  fresh('doommark'); G.player.actives.push({ id: 'cyclone', lvl: 1, supports: [], t: 999, uc: 0 });
  take('hdoomhaste'); const e2 = target(100, 0); cast(); const hp2 = e2.hp;
  hit(e2, 'cyclone'); assert(e2.hadesDoom, '一个主动就提前催动了死线');
  hit(e2, 'volcanic'); assert(!e2.hadesDoom && hp2 - e2.hp > 38, '两个主动未按 80% 提前结算');
});

test('死线一次标记 4 个高生命目标，覆盖 620 范围并强化结算表现', () => {
  fresh('doommark');
  const near = target(100, 0), second = target(200, 0), third = target(300, 0), far = target(350, 350), outside = target(450, 450);
  near.hp = 100; second.hp = 200; third.hp = 300; far.hp = 400; outside.hp = 9999;
  assert(cast(), '范围内有目标但施放失败');
  const marked = G.enemies.filter(e => e.hadesDoom);
  assert(marked.length === 4 && far.hadesDoom && !outside.hadesDoom, '目标数量或 620 范围错误');
  assert(!cast() && marked.every(e => e.hadesDoom), '已有标记时错误刷新目标');
  assert(G.novas.some(n => n.max >= 130), '缺少施放范围表现'); G.render();
  G.H.updateCurses(1.6);
  assert(G.novas.some(n => n.max >= 82) && G.sparks.length >= 40, '结算爆发范围或爆点数量不足');
  assert(G.floats.some(f => f.txt === '死线！' && f.crit), '缺少强化结算跳字');
});

test('双重审问真实延长攻击前摇', () => {
  fresh('doommark'); const e = target(20, 0); cast(); G.H.applyWeak(e, 5, G.skillCalc(G.player.actives[0])); take('hdoublequestion');
  e.swingT = 0.5; G.updateMeleeSwing(e, 0.1);
  assert(Math.abs(e.swingT - (0.5 - 0.1 / 1.3)) < 0.0001, '前摇没有按 1.3 倍延长');
});

test('红芯、虚弱与死线渲染不报错', () => {
  fresh('doommark'); const e = target(200, 0); cast(); G.H.applyWeak(e, 5, null); e.hadesCoreT = 4;
  G.H.dropShard(30, 30); G.render();
  assert(e.hadesDoom && G.H.state.shards.length === 1, '渲染过程破坏了状态');
});

console.log(failed ? 'HADES_RUNTIME_TEST_FAILURES: ' + failed : 'HADES_RUNTIME_TEST_OK (' + passed + '/' + passed + ')');
process.exit(failed ? 1 : 0);

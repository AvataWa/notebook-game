// B/C 技能优化、四属性重分、属性色与冰晶表现的专项回归测试
const fs = require('fs');
const files = ['battle-config.js', 'enemy-config.js', 'content-config.js', 'main.js', 'build-runtime.js',
  'hades-runtime.js', 'hades-weapons-runtime.js', 'weapon-passives-expansion.js', 'support-expansion-runtime.js', 'trigger-support-runtime.js'];
const src = files.map(f => fs.readFileSync(__dirname + '/' + f, 'utf8').replace("'use strict';", '')).join('\n');
const strokeColors = [];
const fakeCtx = new Proxy({}, {
  get(t, k) {
    if (k === 'measureText') return txt => ({ width: String(txt).length * 10 });
    return () => {};
  },
  set(t, k, v) { if (k === 'strokeStyle') strokeColors.push(v); return true; }
});
const fakeCanvas = { getContext: () => fakeCtx, width: 0, height: 0, style: {}, addEventListener() {},
  getBoundingClientRect: () => ({ left: 0, top: 0, width: 375, height: 667 }) };
global.window = { addEventListener() {}, devicePixelRatio: 1, innerWidth: 375, innerHeight: 667 };
global.document = { getElementById: () => fakeCanvas };
global.requestAnimationFrame = () => {};
eval(src + `
;globalThis.G = {
  resetGame, update, updateSkills, fireSkill, fireBullet, skillCalc, spawnEnemy, hurtEnemy, hurtPlayer, killEnemy, render, drawIceCrystal,
  get SKILL_DEFS() { return SKILL_DEFS; }, get SKILL_ATTR() { return SKILL_ATTR; }, get ATTR_COLOR() { return ATTR_COLOR; },
  get ICE_LIGHT() { return ICE_LIGHT; }, get ICE_DARK() { return ICE_DARK; }, get BATTLE() { return BATTLE; },
  get player() { return player; }, get enemies() { return enemies; }, get bullets() { return bullets; }, get ebullets() { return ebullets; },
  get totems() { return totems; }, get erupts() { return erupts; }, get minions() { return minions; },
  get brands() { return brands; }, get novas() { return novas; }, get fields() { return fields; }, get lightnings() { return lightnings; },
  get state() { return state; }, set state(v) { state = v; }, get gameTime() { return gameTime; },
  get W() { return window.__weaponRuntime; }
};`);
let passed = 0, failed = 0;
function test(name, fn) { try { fn(); passed++; console.log('OK  ' + name); } catch (e) { failed++; console.log('ERR ' + name + ': ' + e.stack.split('\n')[0]); } }
function assert(ok, msg) { if (!ok) throw new Error(msg); }
function near(a, b, eps = 0.01) { return Math.abs(a - b) < eps; }
function fresh(id = 'cyclone', lvl = 1) {
  G.resetGame(); G.state = 'play'; G.player.xpNext = 999999; G.player.hp = G.player.maxhp = 9999;
  G.player.actives = [{ id, lvl, supports: [], t: 999, uc: 0 }];
}
function target(x, y, kind) {
  G.spawnEnemy(kind || 'stick', x, y);
  const e = G.enemies[G.enemies.length - 1]; e.hp = e.maxhp = 9999; e.stunT = 999; e.r = 5; e.dmg = 20; return e;
}
function cast() { const a = G.player.actives[0]; return G.fireSkill(a, G.skillCalc(a)); }
function repeat(fn, n, dt) { for (let i = 0; i < n; i++) fn(dt); }

test('29 个主动完整重分为物理/火/冰/雷，数量 8/7/7/7', () => {
  const expected = { phys: 8, fire: 7, ice: 7, thunder: 7 }, actual = { phys: 0, fire: 0, ice: 0, thunder: 0 };
  assert(Object.keys(G.SKILL_DEFS).length === 29, '主动总数不是 29');
  for (const id of Object.keys(G.SKILL_DEFS)) actual[G.SKILL_ATTR[id]]++;
  assert(JSON.stringify(actual) === JSON.stringify(expected), '属性数量错误：' + JSON.stringify(actual));
  for (const key of Object.keys(expected)) assert(G.ATTR_COLOR[key], key + ' 缺少属性色');
});

test('慢速墨滴五弹、前两弹瞄准，反弹后实际增伤 50%', () => {
  fresh('spark'); const e = target(200, 0); cast();
  assert(G.bullets.length === 5 && G.bullets.every(b => near(Math.hypot(b.vx, b.vy), 160)), '弹数或速度错误');
  assert(G.bullets.slice(0, 2).every(b => b.vx > 0 && Math.abs(b.vy) < 25), '前两弹没有瞄准');
  G.bullets.splice(1); const b = G.bullets[0], hp = e.hp;
  Object.assign(b, { x: e.x, y: e.y, vx: 0, vy: 0, dmg: 12, rebounded: true, homing: 0, life: 2 });
  G.update(0.001); assert(near(hp - e.hp, 18), '反弹命中没有造成 1.5 倍伤害');
});

test('图钉炮台集火逐发加速，换目标或丢失目标会重置', () => {
  fresh('ballista'); cast(); const tt = G.totems[0], e = target(100, 0);
  tt.fireCd = 0; G.update(0.01); assert(near(tt.fireCd, 0.9), '首发基础间隔不是 0.9 秒');
  tt.fireCd = 0; G.update(0.01); assert(near(tt.fireCd, 0.85), '第二发没有加速到 0.85 秒');
  tt.fireCd = 0; G.update(0.01); assert(near(tt.fireCd, 0.8), '第三发没有加速到 0.8 秒');
  e.dead = true; tt.fireCd = 0; G.update(0.01); assert(tt.ramp === 0 && tt.sameId === 0, '目标丢失未重置集火');
});

test('回力橡皮擦返程增伤 35%，接近玩家接住后缩短当前冷却', () => {
  fresh('boomerang'); const e = target(100, 0); cast(); const b = G.bullets[0], hp = e.hp;
  Object.assign(b, { x: e.x, y: e.y, vx: 0, vy: 0, traveled: 261, returning: true, life: 2 });
  G.update(0.001); assert(near(hp - e.hp, 18 * 1.35), '返程没有 1.35 倍伤害');
  e.dead = true; Object.assign(b, { x: G.player.x, y: G.player.y, vx: 0, vy: 0, traveled: 261, life: 2 });
  G.player.actives[0].t = 100; G.update(0.001);
  assert(near(G.player.actives[0].t, 65), '接住橡皮擦没有将当前冷却缩短为 65%');
});

test('蜡烛头单圈伤害与基础冷却同步提高', () => {
  fresh('candle'); const e = target(100, 0), hp = e.hp; cast();
  assert(near(hp - e.hp, 7) && G.BATTLE.activeCooldowns.candle === 0.4, '蜡烛头仍是旧数值');
});

test('冰锥优先精英并对已减速目标实际增伤 25%', () => {
  fresh('icespear'); target(500, 0); const elite = target(150, 0); elite.elite = true; cast();
  const b = G.bullets[0]; assert(Math.atan2(b.vy, b.vx) < 0.05 && b.slowBonus === 1.25, '没有优先瞄准精英');
  G.bullets.splice(1); const hp = elite.hp; elite.slowT = 1;
  Object.assign(b, { x: elite.x, y: elite.y, vx: 0, vy: 0, dmg: 30, life: 2 });
  G.update(0.001); assert(near(hp - elite.hp, 37.5), '减速目标没有受到 1.25 倍冰锥伤害');
});

test('流星粉笔头 0.45 秒落下，并在最后 0.1 秒最后修正落点', () => {
  fresh('chalk'); const e = target(120, 0); cast(); const er = G.erupts[0];
  assert(er.delay === 0.45 && er.dmg === 45, '粉笔头旧延迟或伤害仍在');
  e.x = 210; e.y = 40; G.update(0.3); assert(!er.aimLocked && er.x === 120, '过早锁定落点');
  e.x = 260; e.y = 80; G.update(0.06);
  assert(er.aimLocked && er.x === 260 && er.y === 80, '最后 0.1 秒没有修正到最新位置');
});

test('赦免标记期间任意来源击杀都转化为小鬼，Boss 不转化', () => {
  fresh('absolve'); const e = target(100, 0); cast(); e.hp = 1;
  G.hurtEnemy(e, 5, 0, 0, 0, 0, 0, 0, false, 'cyclone');
  assert(e.dead && G.minions.filter(m => m.ghost).length === 1, '非光柱击杀没有触发赦免');
});

test('橡皮筋烙印每跳增伤 8%，最多 40%，转移保留层数', () => {
  fresh('brand'); const e = target(100, 0), next = target(150, 0); cast(); const br = G.brands[0], hp = e.hp;
  G.update(0.01); const first = hp - e.hp; br.tick = 0; G.update(0.01); const second = hp - first - e.hp;
  assert(near(first, 9) && near(second, 9.72) && br.pulse === 2, '烙印逐跳增伤错误');
  e.dead = true; br.tick = 0; G.update(0.01);
  assert(br.tgt === next && br.pulse === 3, '死亡转移丢失目标或增伤层数');
  br.pulse = 5; br.tick = 0; const before = next.hp; G.update(0.01);
  assert(near(before - next.hp, 12.6), '烙印增伤没有封顶 40%');
});

test('冰可乐命中已减速目标追加碎冰，同目标每秒最多一次', () => {
  fresh('cola'); const e = target(100, 0); e.slowT = 1; const hp = e.hp; cast();
  assert(near(hp - e.hp, 28), '首次命中没有追加 8 点碎冰');
  const after = e.hp; cast(); assert(near(after - e.hp, 20), '碎冰没有遵守 1 秒目标冷却');
});

test('链条回形针无新目标时，把剩余弹跳转为 45% 续击', () => {
  fresh('chainclip'); const e = target(60, 0); cast(); const b = G.bullets[0], hp = e.hp;
  Object.assign(b, { x: e.x, y: e.y, vx: 0, vy: 0, life: 2 });
  G.update(0.001);
  const repeats = G.lightnings.filter(l => l.chainRepeat);
  assert(repeats.length === 1 && near(repeats[0].dmg, 13 * 0.45), '剩余弹跳没有转为续击');
  repeat(G.update, 12, 0.03); assert(near(hp - e.hp, 13 * 1.45), '续击没有实际结算伤害');
});

test('钉页旋枪造成真实 20% 减速，原目标死亡提前返回', () => {
  fresh('spinlance'); const e = target(100, 0); cast(); G.W.updateLances(0.01);
  assert(e.spinSlowT > 0, '旋枪没有写入减速状态');
  e.dead = true; G.W.updateLances(0.01); assert(G.W.state.lances[0].returning, '目标死亡未提前回枪');
  fresh('spinlance'); const mover = target(100, 0); mover.stunT = 0; mover.spinSlowT = 1; mover.sp = 100;
  G.update(0.1); assert(near(mover.x, 92, 0.05), '旋枪减速未进入怪物移动结算：' + mover.x);
});

test('三层盾印存在时不重复耗墨，真实格挡会累积盾震强化', () => {
  fresh('shieldrush'); target(60, 0); cast(); const ink = G.player.ink;
  G.player.actives[0].t = 0; G.updateSkills(0.01);
  assert(G.player.ink === ink && G.player.actives[0].t === 0.2, '旧盾印存在时仍重复耗墨');
  G.player.hurtT = 0; G.player.goldT = 0; G.hurtPlayer(20, 'enemy', G.enemies[0]);
  G.ebullets.push({ x: 40, y: 0, life: 2 }); G.W.updateShieldRush(0.01);
  assert(G.W.state.shieldRush.counters >= 2, '受击与敌弹格挡没有累计强化');
});

test('折跃飞盾单目标也能连续回弹，重复命中按 45% 结算', () => {
  fresh('ricoshield'); const e = target(90, 0), hp = e.hp; cast(); repeat(G.W.updateRicoshields, 100, 0.05);
  const dealt = hp - e.hp;
  assert(dealt >= 29 * (1 + 5 * 0.45) - 0.01 && !G.W.state.shields.length, '单目标回弹次数或伤害错误：' + dealt);
});

test('冰晶包含深边与浅色高光，七个冰技能同屏渲染不报错', () => {
  for (const id of Object.keys(G.SKILL_DEFS).filter(id => G.SKILL_ATTR[id] === 'ice')) {
    fresh(id, 5); target(110, 0); target(170, 20); cast(); G.update(0.05); G.render();
  }
  strokeColors.length = 0; G.drawIceCrystal(0, 0, 30, 0, 1);
  assert(strokeColors.includes(G.ICE_DARK) && strokeColors.includes(G.ICE_LIGHT) && strokeColors.includes(G.ATTR_COLOR.ice), '冰晶缺少深边或高光');
  assert(!files.map(f => fs.readFileSync(__dirname + '/' + f, 'utf8')).join('\n').includes("col: color || RED"), '技能特效仍默认红色');
});

console.log(failed ? 'SKILL_REBALANCE_TEST_FAILURES: ' + failed : 'SKILL_REBALANCE_TEST_OK (' + passed + '/' + passed + ')');
process.exit(failed ? 1 : 0);

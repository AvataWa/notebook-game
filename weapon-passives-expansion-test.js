// 第二批十个武器主动的新专属被动：二十条逐项触发测试
const fs = require('fs');
const src = ['battle-config.js', 'enemy-config.js', 'content-config.js', 'main.js', 'build-runtime.js', 'hades-runtime.js', 'hades-weapons-runtime.js', 'weapon-passives-expansion.js', 'support-expansion-runtime.js']
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
  resetGame, fireSkill, skillCalc, spawnEnemy, hurtEnemy, hurtPlayer, killEnemy, render, applyOption,
  get PASSIVES() { return PASSIVES; }, get player() { return player; }, get enemies() { return enemies; },
  get ebullets() { return ebullets; }, get state() { return state; }, set state(v) { state = v; },
  get cards() { return cards; }, set cards(v) { cards = v; }, get W() { return window.__weaponRuntime; },
  get P() { return window.__weaponPassives; }
};`);
let failed = 0, passed = 0;
function test(name, fn) { try { fn(); passed++; console.log('OK  ' + name); } catch (e) { failed++; console.log('ERR ' + name + ': ' + e.stack.split('\n')[0]); } }
function assert(ok, msg) { if (!ok) throw new Error(msg); }
function near(a, b, eps = 0.001) { return Math.abs(a - b) < eps; }
function fresh(id) {
  G.resetGame(); G.state = 'play'; G.player.xpNext = 999999; G.player.hp = G.player.maxhp = 9999;
  G.player.actives = [{ id, lvl: 1, supports: [], t: 999, uc: 0 }];
}
function target(x, y) {
  G.spawnEnemy('stick', x, y); const e = G.enemies[G.enemies.length - 1];
  e.hp = e.maxhp = 9999; e.stunT = 999; e.r = 4; e.dmg = 20; return e;
}
function take(id) { G.cards = [{ kind: 'passive', id }]; G.state = 'levelup'; G.applyOption(0); G.state = 'play'; }
function cast() { return G.fireSkill(G.player.actives[0], G.skillCalc(G.player.actives[0])); }
function c() { return G.skillCalc(G.player.actives[0]); }

test('斩弹蓄锋提高下一斩并在释放后清空，裂口封路持续伤害', () => {
  fresh('pageslash'); take('slash_charge'); take('slash_crack'); const e = target(100, 0);
  G.ebullets.push({ x: 90, y: 0, life: 2 }); cast(); G.W.updateSlashes(0.2);
  assert(G.P.state.zones.some(z => z.kind === 'slash' && z.t === 2), '斩痕区域没有生成');
  assert(G.W.state.slashes[0].expCuts === 0, '斩弹蓄锋没有在释放后清空');
  e.hp = e.maxhp; cast(); const slash = G.W.state.slashes[G.W.state.slashes.length - 1]; slash.expCuts = 5;
  G.W.updateSlashes(0.2); assert(near(9999 - e.hp, 46 * 1.3), '五层斩弹没有提供 30% 下一斩增伤：' + (9999 - e.hp));
  G.P.state.zones.splice(0, G.P.state.zones.length - 1);
  const hp = e.hp; G.P.updateZones(0); assert(near(hp - e.hp, 46 * 0.25), '斩痕没有造成 25% 持续伤害：' + (hp - e.hp));
});

test('双枪各自串页递增并叠加交叉爆发，终点定身且角色不动', () => {
  fresh('piercerush'); take('pierce_ramp'); take('pierce_pin');
  const a = target(100, 0), b = target(140, 24.8), normal = target(180, 49.6), elite = target(210, 68.2);
  const px = G.player.x, py = G.player.y; normal.stunT = 0; elite.elite = true;
  cast(); G.W.updateDashes(0.18); G.W.updateDashes(0.24);
  assert(near(9999 - a.hp, 42 * 0.55 * 2 + 16), '交叉点双枪与剪切爆发伤害错误：' + (9999 - a.hp));
  assert(near(9999 - b.hp, 42 * 0.55 * 1.08 + 16), '单道枪影的后续目标没有递增 8%：' + (9999 - b.hp));
  assert(normal.stunT >= 0.6 && elite.expPinSlowT === 1, '终点普通定身或精英减速未生效');
  assert(G.player.x === px && G.player.y === py, '贯枪被动结算移动了角色');
});

test('旋枪飞刺周期发射，钉点爆页在返回瞬间结算', () => {
  fresh('spinlance'); take('spin_spear'); take('spin_blast'); const e = target(80, 0); cast();
  G.P.updateLances(0.81); assert(G.W.state.bolts.some(b => b.kind === 'lancespine' && near(b.damage, 16 * 0.4)), '旋枪没有发射 40% 飞刺');
  const l = G.W.state.lances[0], hp = e.hp; l.t = 0; G.W.updateLances(0.01);
  assert(l.returning && l.expReturnBlast && e.hp < hp && G.W.state.fx.some(f => f.type === 'blast'), '返回钉点没有爆炸');
});

test('盾印格挡回墨封顶十二，守势蓄击按剩余三层强化结束盾震', () => {
  fresh('shieldrush'); take('shield_bash'); take('shield_ink'); take('shield_charge'); const e = target(110, 0);
  const px = G.player.x, py = G.player.y; G.player.ink = 0; cast();
  for (let i = 0; i < 7; i++) G.ebullets.push({ x: 40, y: 0, life: 2 });
  G.W.updateShieldRush(0.01); const d = G.W.state.shieldRush;
  assert(G.player.ink === 12 && d.expBlocks === 7 && d.layers === 3, '格挡回墨、计数或免耗层规则错误');
  G.W.updateShieldRush(3.6);
  assert(near(9999 - e.hp, (38 + 42) * 1.48), '三层盾震没有按六层格挡上限增伤：' + (9999 - e.hp));
  assert(G.player.x === px && G.player.y === py, '盾震结算移动了角色');
});

test('弹射增幅逐次提高飞盾伤害，接盾生成真实旋盾', () => {
  fresh('ricoshield'); take('ricoshield_ramp'); take('ricoshield_orbit'); const a = target(100, 0), b = target(170, 0); cast();
  G.W.updateRicoshields(0.2); assert(near(9999 - a.hp, 29), '飞盾首击伤害错误');
  for (let i = 0; i < 8 && b.hp === b.maxhp; i++) G.W.updateRicoshields(0.05);
  assert(b.hp < b.maxhp && 9999 - b.hp > 29, '弹射后的下一击没有增伤');
  const shield = G.W.state.shields[0]; shield.returning = true; shield.x = G.player.x; shield.y = G.player.y;
  G.W.updateRicoshields(0.01); assert(G.P.state.orbiters.length === 1, '接盾没有生成旋盾');
  const o = G.P.state.orbiters[0], victim = target(58, 0); o.angle = 0; o.tick = 0; const hp = victim.hp;
  G.P.updateOrbiters(0); assert(victim.hp < hp, '旋盾没有接触伤害');
});

test('主靶批注强化其他主动，箭雨落款生成三支小箭', () => {
  fresh('perfectarrow'); take('perfect_mark'); take('perfect_rain'); const e = target(110, 0); cast();
  G.W.updateCharges(0.6); G.W.updateBolts(0.12); assert(e.perfectMainT === 4, '首个命中目标没有主靶标记');
  const hp = e.hp; G.hurtEnemy(e, 10, 0, 0, 0, 0, 0, 0, '#000', false, 'cyclone');
  assert(near(hp - e.hp, 12), '其他主动没有对主靶增伤 20%');
  const bolt = G.W.state.bolts.find(b => b.kind === 'perfect'); G.W.state.bolts.splice(G.W.state.bolts.indexOf(bolt), 1);
  G.P.state.preBolts = [bolt]; G.P.terminalProjectiles();
  assert(G.W.state.bolts.filter(b => b.kind === 'rain').length === 3, '箭雨落款不是三支小箭');
});

test('靶死余箭重新分散追击，悬箭护航拦截后立即射出', () => {
  fresh('arrowfocus'); take('focus_redirect'); take('focus_intercept'); const first = target(100, 0), second = target(220, 0); cast();
  const b = G.W.state.bolts[0], original = b.damage;
  G.ebullets.push({ x: -61, y: -35, life: 2, r: 4 }); G.P.updateFocus();
  assert(b.expIntercept && b.delay === 0 && near(b.damage, original * 0.6) && G.ebullets[0].life === 0, '悬箭没有拦截并以 60% 伤害射出');
  G.killEnemy(first); G.P.updateFocus();
  assert(G.W.state.bolts.every(x => x.targetId === second.id && x.expFocusBoost), '目标死亡后余箭没有重新追击并增伤');
});

test('远程磁墨按实际聚怪数生成护膜，坠地磁场牵引且角色不动', () => {
  fresh('magfist'); take('fist_guard'); take('fist_field');
  const e = target(100, 0), near1 = target(125, 0), near2 = target(140, 0);
  const px = G.player.x, py = G.player.y; cast();
  G.W.updateFists(0.13); G.P.updateFists(); assert(G.player.magGuardN === 3 && G.player.magGuardT === 2, '聚怪没有生成三层护膜');
  assert(G.player.x === px && G.player.y === py, '磁墨护膜阶段移动了角色');
  G.player.hurtT = 0; G.player.goldT = 0; const hp = G.player.hp; G.hurtPlayer(100, 'enemy', e);
  assert(near(hp - G.player.hp, 94), '三层护膜没有减伤 6%：' + (hp - G.player.hp));
  G.W.updateFists(0.16); G.W.updateFists(0.36); G.P.updateFists();
  assert(G.P.state.zones.some(z => z.kind === 'fist' && z.t === 2.5), '下砸没有留下磁场');
  near1.x = 150; const x = near1.x, ehp = near1.hp; G.P.updateZones(0.01);
  assert(near1.x < x && near1.hp < ehp && G.player.x === px && G.player.y === py, '磁场牵引、周期伤害或原地规则失效');
});

test('焦土延烧留下伤害纸洞，跳弹引信只再爆炸一次', () => {
  fresh('inkgrenade'); take('grenade_burn'); take('grenade_bounce'); const e = target(130, 0); cast();
  const g = G.W.state.grenades[0]; G.P.state.preGrenades = [g]; G.W.updateGrenades(0.83); G.P.terminalProjectiles();
  assert(G.P.state.zones.some(z => z.kind === 'burn' && z.t === 3), '焦土区域没有生成');
  const bounced = G.W.state.grenades.find(x => x.expBounce); assert(bounced && near(bounced.damage, g.damage * 0.6), '没有生成 60% 二次跳弹');
  const hp = e.hp; G.P.updateZones(0.01); assert(e.hp < hp, '焦土没有周期伤害');
  G.P.state.preGrenades = [bounced]; G.W.updateGrenades(0.39); G.P.terminalProjectiles();
  assert(!G.W.state.grenades.some(x => x.expBounce), '二次跳弹错误循环生成');
});

test('红热贯穿强化高热子弹，终末追枪每轮击杀最多追加两次', () => {
  fresh('heatrail'); take('rail_hot'); take('rail_chase'); const a = target(105, 0), b = target(115, 0); cast();
  const rail = G.W.state.rail; rail.heat = 0.75; G.W.state.bolts.length = 0;
  G.W.spawnBolt({ kind: 'rail', skill: 'heatrail', x: 100, y: 0, angle: 0, speed: 830, damage: 10, c: c(), radius: 5, life: 1, heat: 0.75 });
  G.W.updateBolts(0.01); assert(a.hp < a.maxhp && b.hp < b.maxhp && near(9999 - a.hp, 12), '高热子弹没有增伤或额外贯穿');
  for (let i = 0; i < 3; i++) { const e = target(200 + i * 10, 0); e.hp = 1; G.killEnemy(e); }
  assert(G.W.state.bolts.filter(x => x.kind === 'chase').length === 2 && rail.expChaseKills === 2, '终末追枪没有限制每轮两次');
});

test('新增区域、旋盾、主靶和弹道同屏渲染无错误', () => {
  G.render(); assert(G.P.state.zones.length <= 24 && G.P.state.orbiters.length <= 4 && G.P.state.fx.length <= 48, '扩展实体池超过预算');
});

console.log(failed ? 'WEAPON_PASSIVES_EXPANSION_TEST_FAILURES: ' + failed : 'WEAPON_PASSIVES_EXPANSION_TEST_OK (' + passed + '/' + passed + ')');
process.exit(failed ? 1 : 0);

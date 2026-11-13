// 十个哈迪斯武器启发主动与四十条专属被动的专项测试
const fs = require('fs');
const src = ['battle-config.js', 'enemy-config.js', 'content-config.js', 'main.js', 'build-runtime.js', 'hades-runtime.js', 'hades-weapons-runtime.js', 'weapon-passives-expansion.js', 'form-passives-runtime.js', 'support-expansion-runtime.js', 'elemental-support-runtime.js', 'trigger-support-runtime.js']
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
  resetGame, update, fireSkill, skillCalc, spawnEnemy, hurtEnemy, hurtPlayer, updateSkills, render, applyOption, supportUsable,
  get SKILL_DEFS() { return SKILL_DEFS; }, get PASSIVES() { return PASSIVES; }, get SUPPORTS() { return SUPPORTS; }, get player() { return player; },
  get BATTLE() { return BATTLE; },
  get enemies() { return enemies; }, get ebullets() { return ebullets; }, get bullets() { return bullets; },
  get floats() { return floats; }, get state() { return state; }, set state(v) { state = v; },
  get cards() { return cards; }, set cards(v) { cards = v; }, get W() { return window.__weaponRuntime; },
  get P() { return window.__weaponPassives; }, get E() { return window.__supportExpansion; }
};`);
let failed = 0, passed = 0;
function test(name, fn) { try { fn(); passed++; console.log('OK  ' + name); } catch (e) { failed++; console.log('ERR ' + name + ': ' + e.stack.split('\n')[0]); } }
function assert(ok, msg) { if (!ok) throw new Error(msg); }
function fresh(id = 'pageslash') {
  G.resetGame(); G.state = 'play'; G.player.xpNext = 999999; G.player.hp = G.player.maxhp = 9999;
  G.player.actives = [{ id, lvl: 1, supports: [], t: 999, uc: 0 }];
}
function target(x, y) {
  G.spawnEnemy('stick', x, y);
  const e = G.enemies[G.enemies.length - 1]; e.hp = e.maxhp = 9999; e.stunT = 999; e.r = 5; e.dmg = 20; return e;
}
function take(id) { G.cards = [{ kind: 'passive', id }]; G.state = 'levelup'; G.applyOption(0); G.state = 'play'; }
function cast() { const a = G.player.actives[0]; return G.fireSkill(a, G.skillCalc(a)); }
function repeat(fn, n, dt) { for (let i = 0; i < n; i++) fn(dt); }

test('内容池达到二十九主动、八十被动和七十辅助，四十条武器被动均有前置', () => {
  fresh('cyclone');
  assert(Object.keys(G.SKILL_DEFS).length === 29, '主动总数不是 29');
  assert(G.PASSIVES.length === 80, '被动总数不是 80');
  assert(Object.keys(G.SUPPORTS).length === 70, '辅助总数不是 70');
  const ids = ['slash_echo','slash_pull','slash_charge','slash_crack','pierce_long','pierce_return','pierce_ramp','pierce_pin',
    'spin_double','spin_pull','spin_spear','spin_blast','shield_reflect','shield_bash','shield_ink','shield_charge',
    'ricoshield_double','ricoshield_catch','ricoshield_ramp','ricoshield_orbit','perfect_tail','perfect_split','perfect_mark','perfect_rain',
    'focus_more','focus_burst','focus_redirect','focus_intercept','fist_aftershock','fist_juggle','fist_guard','fist_field',
    'grenade_cluster','grenade_sticky','grenade_burn','grenade_bounce','rail_double','rail_final','rail_hot','rail_chase'];
  assert(ids.length === 40 && G.P.ids.length === 20, '武器被动清单数量错误');
  for (const id of ids) {
    const p = G.PASSIVES.find(x => x.id === id); assert(p && !p.available(), id + ' 缺少或前置失效');
  }
});

test('二十九主动共用唯一基础冷却表，修改表值会直接改变实际间隔', () => {
  const table = G.BATTLE.activeCooldowns, ids = Object.keys(G.SKILL_DEFS);
  assert(Object.keys(table).length === 29, '基础冷却表不是 29 项');
  for (const id of ids) assert(Number.isFinite(table[id]) && table[id] > 0, id + ' 缺少有效基础冷却');
  fresh('piercerush'); target(100, 0);
  const a = G.player.actives[0], previous = table.piercerush;
  try {
    table.piercerush = 3.217; a.t = 0; G.updateSkills(0.01);
    const expected = 3.217 * G.skillCalc(a).cd;
    assert(Math.abs(a.t - expected) < 0.0001, '实际施放间隔没有读取统一冷却表：' + a.t + ' != ' + expected);
  } finally { table.piercerush = previous; }
});

test('新技能只提供实际接入的通用辅助', () => {
  for (const id of G.W.ids) {
    assert(!G.supportUsable('unleash', id), id + ' 仍提供重复施放');
    assert(G.supportUsable('brutal', id) && G.supportUsable('swift', id), id + ' 基础辅助被误删');
  }
  assert(!G.supportUsable('multi', 'perfectarrow') && G.supportUsable('projspd', 'perfectarrow'), '弓辅助过滤错误');
  assert(G.supportUsable('dur', 'spinlance') && !G.supportUsable('pierce', 'ricoshield'), '旋枪或飞盾辅助过滤错误');
});

test('断页斩具有前摇、斩弹、回锋牵引与余锋爆裂', () => {
  fresh(); take('slash_echo'); take('slash_pull'); const e = target(110, 0), outer = target(175, 0); const hp = e.hp;
  G.ebullets.push({ x: 100, y: 0, life: 2 }); cast(); G.W.updateSlashes(0.1);
  assert(e.hp === hp, '断页斩没有前摇'); G.W.updateSlashes(0.1);
  assert(e.hp < hp && G.ebullets[0].life === 0, '断页斩未命中或斩弹');
  assert(outer.x < 175, '回锋没有牵引外圈怪'); const blasts = G.W.state.fx.filter(f => f.type === 'blast').length;
  G.W.updateSlashes(0.5); assert(G.W.state.fx.filter(f => f.type === 'blast').length > blasts, '余锋没有二次爆裂');
});

test('交叉贯枪双枪交叉爆发，往返全程不移动角色', () => {
  fresh('piercerush'); take('pierce_long'); take('pierce_return'); const e = target(180, 0);
  const px = G.player.x, py = G.player.y; cast();
  assert(G.W.state.dashes.length === 2, '没有生成两道交叉枪影');
  G.W.updateDashes(0.18); assert(G.W.state.dashes.every(d => d.phase === 'out'), '贯枪未完成瞄准');
  G.W.updateDashes(0.24);
  assert(G.player.x === px && G.player.y === py && e.hp < e.maxhp, '交叉贯枪移动了角色或未命中');
  assert(G.W.state.dashes.every(d => d.phase === 'back'), '双枪未进入返程');
  assert(G.W.state.fx.some(f => f.type === 'crosscut') && G.W.state.fx.some(f => f.type === 'blast'), '交叉剪切或终点冲击未生效');
  G.W.updateDashes(0.24);
  assert(G.player.x === px && G.player.y === py && !G.W.state.dashes.length, '枪影返程移动了角色或未回收');
});

test('双枪钉页持续切割，返回时拖拽并追加碰撞伤害', () => {
  fresh('spinlance'); take('spin_double'); take('spin_pull'); const e = target(70, 0); cast();
  assert(G.W.state.lances.length === 2, '双枪没有生成'); const hp = e.hp; G.W.updateLances(0.01);
  assert(e.hp < hp, '旋枪没有持续切割');
  const l = G.W.state.lances[0]; l.x = 95; l.y = 0; l.t = 0; const before = e.x, hp2 = e.hp;
  G.W.updateLances(0.05); G.W.updateLances(0.05);
  assert(l.returning && e.hp < hp2 && e.x !== before, '回枪没有拖拽或碰撞伤害');
});

test('三层盾印真实受击消耗并反击，免疫不误耗，结束按剩余层数盾震', () => {
  fresh('shieldrush'); take('shield_reflect'); take('shield_bash'); const e = target(60, 0);
  const px = G.player.x, py = G.player.y; cast();
  assert(G.W.state.shieldRush.layers === 3, '施放后不是三层盾印');
  G.player.hurtT = 0; G.player.goldT = 0; const hp = G.player.hp; G.hurtPlayer(20, 'enemy', e);
  assert(Math.round(hp - G.player.hp) === 5 && G.W.state.shieldRush.layers === 2, '盾印没有减伤 75% 或消耗一层');
  assert(e.hp < e.maxhp && G.W.state.shieldRush.counters === 1, '受击没有触发盾片反击');
  G.hurtPlayer(20, 'enemy', e); assert(G.W.state.shieldRush.layers === 2, '受击保护期间错误消耗盾印');
  G.ebullets.push({ x: 40, y: 0, life: 2 }); G.W.updateShieldRush(0.01);
  assert(G.ebullets[0].life === 0 && G.W.state.bolts.length === 1 && G.W.state.shieldRush.layers === 2, '格挡反弹或免耗层规则失效');
  G.W.updateShieldRush(3.6);
  assert(!G.W.state.shieldRush && G.W.state.fx.some(f => f.type === 'blast'), '剩余盾印没有结算盾震');
  assert(G.player.x === px && G.player.y === py, '盾印施放或结算移动了角色');
});

test('双盾弹射并返回，接盾冲击且重置主动冷却', () => {
  fresh('ricoshield'); take('ricoshield_double'); take('ricoshield_catch'); target(100, 0); target(170, 0); cast();
  assert(G.W.state.shields.length === 2, '双盾没有生成'); G.W.updateRicoshields(0.2);
  assert(G.W.state.shields.some(s => s.bounces > 0), '飞盾没有弹射命中');
  G.player.actives[0].t = 99; repeat(G.W.updateRicoshields, 45, 0.05);
  assert(!G.W.state.shields.length && G.player.actives[0].t === 0, '接盾没有回收或重置冷却');
  assert(G.W.state.fx.some(f => f.type === 'blast'), '接盾没有范围冲击');
});

test('完美一箭蓄力贯穿，箭尾剑气与双星分裂均命中', () => {
  fresh('perfectarrow'); take('perfect_tail'); take('perfect_split'); const e = target(110, 0), other = target(145, 20); cast();
  G.W.updateCharges(0.5); assert(!G.W.state.bolts.length, '完美箭没有蓄力前摇');
  G.W.updateCharges(0.09); assert(G.W.state.bolts.length === 1, '完美区间没有释放箭矢');
  const hp = e.hp, otherHp = other.hp; G.W.updateBolts(0.12);
  assert(e.hp < hp && other.hp < otherHp, '贯穿、箭尾或分裂没有造成伤害');
  assert(G.W.state.bolts.some(b => b.kind === 'split'), '一箭双星没有生成分裂箭');
});

test('群箭扩编为十二支，逐支集火并触发六次红叉爆裂', () => {
  fresh('arrowfocus'); take('focus_more'); take('focus_burst'); const e = target(130, 0); cast();
  assert(G.W.state.bolts.length === 12, '扩编后不是十二支箭');
  assert(G.W.state.bolts.every(b => b.delay > 0), '箭阵没有悬停阶段');
  repeat(G.W.updateBolts, 45, 0.05);
  assert(e.hp < e.maxhp && G.W.state.fx.some(f => f.type === 'blast'), '集火或红叉爆裂没有结算');
});

test('磁墨升拳在远程目标点聚怪，浮空下砸且角色原地不动', () => {
  fresh('magfist'); take('fist_aftershock'); take('fist_juggle'); const e = target(260, 0), near = target(330, 0);
  const px = G.player.x, py = G.player.y; cast();
  G.W.updateFists(0.13);
  assert(near.x < 330 && Math.abs(near.x - 260) < 70, '磁墨没有把附近怪物拉向远程目标点');
  assert(G.player.x === px && G.player.y === py, '磁墨聚怪移动了角色');
  G.W.updateFists(0.16); assert(e.weaponAirT > 0 && G.player.x === px, '上勾没有造成浮空或移动了角色');
  G.W.updateFists(0.36); assert(G.W.state.fx.some(f => f.type === 'blast') && e.weaponAirT > 0, '下砸或再次弹起未生效');
  const count = G.W.state.fx.filter(f => f.type === 'blast').length; G.W.updateFists(0.45);
  assert(G.W.state.fx.filter(f => f.type === 'blast').length > count && G.player.y === py, '坠地余震没有二次结算或移动了角色');
});

test('黏纸雷壳扩大主爆炸，子母弹生成五枚并依次爆炸', () => {
  fresh('inkgrenade'); take('grenade_cluster'); take('grenade_sticky'); const e = target(130, 0); cast();
  const g = G.W.state.grenades[0]; assert(g.targetId === e.id && g.radius > 105, '黏着或范围加成未生效');
  G.W.updateGrenades(0.83); assert(G.W.state.grenades.filter(x => !x.main).length === 5, '子母弹不是五枚');
  assert(G.W.state.fx.some(f => f.type === 'blast' && f.r === g.radius), '主爆炸没有按黏着范围结算');
  G.W.updateGrenades(0.33); assert(G.W.state.grenades.filter(x => !x.main && !x.done).length < 5, '小墨弹没有依次爆炸');
});

test('扫射积热、每五发双线、终末弹按热量爆炸', () => {
  fresh('heatrail'); take('rail_double'); take('rail_final'); target(120, 0); cast();
  repeat(G.W.updateRail, 11, 0.1); G.W.updateRail(0.2);
  assert(!G.W.state.rail && G.W.state.bolts.length === 17, '十二发、四条侧弹和终末弹数量错误：' + G.W.state.bolts.length);
  const final = G.W.state.bolts.find(b => b.kind === 'final'); assert(final && final.heat === 1, '终末弹没有记录满热量');
  G.W.updateBolts(0.15); assert(G.W.state.fx.some(f => f.type === 'blast'), '红热终章没有爆炸');
});

test('所有新状态同屏渲染不报错，实体池保持上限', () => {
  const ids = G.W.ids;
  for (const id of ids) {
    fresh(id); target(110, 0); target(170, 25); cast();
    for (const p of G.PASSIVES.filter(p => typeof p.available === 'function' && p.available() && p.once)) take(p.id);
    G.W.update(0.7); G.W.update(0.7); G.render();
  }
  assert(G.W.state.bolts.length <= 84 && G.W.state.fx.length <= 56 && G.W.state.grenades.length <= 18, '实体池超过预算');
});

console.log(failed ? 'HADES_WEAPONS_TEST_FAILURES: ' + failed : 'HADES_WEAPONS_TEST_OK (' + passed + '/' + passed + ')');
process.exit(failed ? 1 : 0);

// 挂机者：随机双主动、操作禁用、持续护盾、专属词条、五级轮转与界面专项回归
const fs = require('fs');
const files = [
  'battle-config.js', 'enemy-config.js', 'content-config.js', 'procedural-locomotion.js',
  'creature-designs.js', 'creature-bio-rig.js', 'creature-design-renderer.js',
  'biped-locomotion.js', 'biped-renderer.js', 'creature-game-runtime.js', 'main.js', 'build-runtime.js',
  'hades-runtime.js', 'hades-weapons-runtime.js', 'weapon-passives-expansion.js',
  'form-passives-runtime.js', 'support-expansion-runtime.js', 'elemental-support-runtime.js',
  'trigger-support-runtime.js', 'build-view.js', 'meta-config.js', 'character-config.js',
  'dive-counter-runtime.js', 'combat-feel-runtime.js', 'equipment-rework-runtime.js',
  'meta-runtime.js', 'character-runtime.js', 'idle-runtime.js', 'ui-copy.js', 'ui-detail-runtime.js'
];
const src = files.map(f => fs.readFileSync(__dirname + '/' + f, 'utf8').replace("'use strict';", '')).join('\n');
const drawTexts = [];
const fakeCtx = new Proxy({}, { get(t, k) {
  if (k === 'measureText') return txt => ({ width: String(txt).length * 10 });
  if (k === 'fillText') return txt => { drawTexts.push(String(txt)); };
  return () => {};
}, set() { return true; } });
const fakeCanvas = {
  getContext: () => fakeCtx, width: 0, height: 0, style: {}, addEventListener() {},
  getBoundingClientRect: () => ({ left: 0, top: 0, width: 375, height: 667 })
};
const stored = Object.create(null);
global.localStorage = {
  getItem: k => Object.prototype.hasOwnProperty.call(stored, k) ? stored[k] : null,
  setItem: (k, v) => { stored[k] = String(v); }, removeItem: k => { delete stored[k]; }
};
global.window = global;
Object.assign(global, { addEventListener() {}, devicePixelRatio: 1, innerWidth: 375, innerHeight: 667,
  matchMedia: () => ({ matches: true }) });
global.document = { getElementById: () => fakeCanvas, createElement: () => fakeCanvas };
global.requestAnimationFrame = () => {};
eval(src + `
;globalThis.G = {
  render, skillCalc, buildOptions, supportUsable, castAbsorb, toggleDive, startInkSurgeCharge,
  castInkSurge, chargeTurf, hurtPlayer, hurtEnemy, update, spawnEnemy, cardTypeLabel, PASSIVES,
  get player() { return player; }, get enemies() { return enemies; }, get bullets() { return bullets; },
  get lightnings() { return lightnings; }, get cards() { return cards; }, get floats() { return floats; }, get keys() { return keys; },
  get state() { return state; }, set state(v) { state = v; }, get joyHome() { return JOY_HOME; },
  get M() { return window.__metaRuntime; }, get C() { return window.CharacterRuntime; },
  get I() { return window.IdleRuntime; }
};`);
let failed = 0, passed = 0;
function test(name, fn) { try { fn(); passed++; console.log('OK  ' + name); } catch (e) { failed++; console.log('ERR ' + name + ': ' + e.stack.split('\n')[0]); } }
function assert(ok, msg) { if (!ok) throw new Error(msg); }
function near(a, b, eps = 0.001) { return Math.abs(a - b) < eps; }
function active(id) { return { id, lvl: 1, supports: [], t: 999, uc: 0 }; }
function fresh(level = 1) {
  G.M.resetAll(); G.C.selectCharacter('idle'); G.M.data.characters.idle = level; G.M.beginRun(false);
  if (G.state === 'levelup') G.state = 'play';
  G.player.xpNext = 999999; G.player.hp = G.player.maxhp = 9999; G.player.ink = G.player.maxInk = 999;
  G.player.actives.forEach(a => { a.t = 999; });
  return G.player;
}
function passive(id) { const p = G.PASSIVES.find(p => p.id === id); assert(p, '缺少护盾词条 ' + id); return p; }
function isolate(p) { p.goldT = 0; p.hurtT = 0; }

test('挂机者普通局与 Boss 局均为随机两个不同主动，一级伤害修正为 85%', () => {
  const original = Math.random; Math.random = () => 0;
  try {
    const p = fresh();
    assert(p.actives.length === 2 && p.actives[0].id !== p.actives[1].id, '普通局不是两个不同主动');
    assert(p.actives[0].id === 'cyclone' && p.actives[1].id === 'volcanic', '固定随机序列的开局结果错误');
    assert(near(G.skillCalc(p.actives[0]).dmg, 0.85), '一级主动伤害惩罚错误');
    G.C.requestBoss(2); G.C.selectCharacter('idle'); G.C.confirmSelection();
    assert(G.player.characterId === 'idle' && G.player.actives.length === 2 && G.M.run.bossTestStage === 2, 'Boss 局没有正确生成挂机者双主动');
  } finally { Math.random = original; }
});

test('吸墨、潜墨、墨潮及其连携被真实禁用', () => {
  const p = fresh(5); p.special = 100;
  assert(!G.castAbsorb() && !G.toggleDive() && !G.startInkSurgeCharge() && !G.castInkSurge(), '仍可通过技能入口绕过禁用');
  G.chargeTurf(20); assert(p.special === 100 && !p.surgeCharging && !p.diving, '墨潮充能或技能状态仍然变化');
  assert(!G.supportUsable('onabsorb', 'cyclone') && !G.supportUsable('ondive', 'cyclone') && !G.supportUsable('onsurge', 'cyclone'), '禁用连携仍可使用');
  assert(G.supportUsable('oncrit', 'cyclone'), '其他通用连携被误禁用');
  for (let i = 0; i < 30; i++) {
    G.buildOptions();
    assert(!G.cards.some(c => ['onabsorb', 'ondive', 'onsurge'].includes(c.sup)), '选项池出现禁用连携');
    assert(!G.cards.some(c => c.kind === 'opaffix' && ['absorb', 'dive', 'surge'].includes(c.skill)), '选项池出现吸墨／潜墨／墨潮操作词条');
  }
});

test('40 点护盾先承伤，破盾只把溢出部分扣入生命', () => {
  const p = fresh(), hp = p.hp;
  assert(G.I.shield === 40 && G.I.shieldMax === 40, '开局不是 40/40 护盾');
  G.hurtPlayer(30); assert(p.hp === hp && G.I.shield === 10 && p.hurtT > 0, '部分护盾吸收或受击保护错误');
  p.hurtT = 0; G.hurtPlayer(10); assert(p.hp === hp && G.I.shield === 0, '剩余护盾没有完整承伤');
  p.hurtT = 0; G.hurtPlayer(50); assert(p.hp === hp - 50 && G.I.shield === 0, '空盾后没有扣除生命');
  const overflow = fresh(), overflowHp = overflow.hp;
  G.hurtPlayer(50); assert(overflow.hp === overflowHp - 10 && G.I.shield === 0, '破盾溢出伤害不是 10 点');
});

test('受击 2.5 秒后每秒恢复 5 点，三级变为 50 上限与 6.5 点每秒', () => {
  const p = fresh(); isolate(p); G.hurtPlayer(40); p.goldT = 9999;
  for (let i = 0; i < 20; i++) G.update(0.1);
  assert(G.I.shield === 0, '恢复等待结束前护盾提前增长');
  for (let i = 0; i < 5; i++) G.update(0.1);
  G.update(1); assert(near(G.I.shield, 5), '一级恢复速度不是 5 点每秒：' + G.I.shield);
  const third = fresh(3); assert(G.I.shieldMax === 50 && G.I.shield === 50, '三级护盾上限不是 50');
  isolate(third); G.hurtPlayer(50); third.goldT = 9999;
  for (let i = 0; i < 25; i++) G.update(0.1);
  G.update(1); assert(near(G.I.shield, 6.5), '三级恢复速度不是 6.5 点每秒：' + G.I.shield);
});

test('六个护盾词条仅挂机者可用，标签与唯一性正确', () => {
  const p = fresh(), ids = ['idlemax', 'idleregen', 'idlequick', 'idlesharp', 'idleburst', 'idleround'];
  for (const id of ids) assert(passive(id).available(), id + ' 没有向挂机者开放');
  assert(!passive('idlemax').once && !passive('idleregen').once, '可叠加词条被错误设为唯一');
  for (const id of ids.slice(2)) assert(passive(id).once, id + ' 应为唯一词条');
  assert(G.cardTypeLabel({ kind: 'passive', tag: '[护盾]' }) === '通用', '护盾词条应归入通用标签');
  p.characterId = 'single';
  for (const id of ids) assert(!passive(id).available(), id + ' 泄漏到了其他角色');
});

test('厚纸膜与持续供墨按加法叠加，并立即补充新增护盾', () => {
  const p = fresh(), max = passive('idlemax'), regen = passive('idleregen');
  max.fx(); assert(G.I.shieldMax === 50 && G.I.shield === 50, '第一层厚纸膜错误');
  max.fx(); assert(G.I.shieldMax === 60 && G.I.shield === 60, '第二层厚纸膜不是加法叠加');
  regen.fx(); regen.fx(); isolate(p); G.hurtPlayer(60); p.goldT = 9999;
  for (let i = 0; i < 25; i++) G.update(0.1);
  G.update(1); assert(near(G.I.shield, 8), '两层持续供墨不是每秒 8 点：' + G.I.shield);
});

test('快速回墨把恢复等待缩短到 2 秒', () => {
  const p = fresh(); passive('idlequick').fx(); isolate(p); G.hurtPlayer(20); p.goldT = 9999;
  for (let i = 0; i < 19; i++) G.update(0.1);
  assert(G.I.shield === 20, '快速回墨仍在 2 秒前恢复');
  for (let i = 0; i < 2; i++) G.update(0.1);
  assert(G.I.shield > 20, '快速回墨等待结束后没有恢复');
});

test('满盾笔意只在满盾时提供 15% 全部伤害', () => {
  const p = fresh(); passive('idlesharp').fx();
  G.spawnEnemy('stick', 80, 0); const full = G.enemies[G.enemies.length - 1], fullHp = full.hp;
  G.hurtEnemy(full, 100); assert(near(fullHp - full.hp, 115), '满盾伤害不是 115');
  G.I.state.shield = 0; G.spawnEnemy('stick', 80, 0); const empty = G.enemies[G.enemies.length - 1], emptyHp = empty.hp;
  G.hurtEnemy(empty, 100); assert(near(emptyHp - empty.hp, 100), '非满盾仍获得增伤');
});

test('破膜新星在护盾归零时伤害并击退周围敌人', () => {
  const p = fresh(); passive('idleburst').fx(); G.I.state.shield = 5;
  G.spawnEnemy('stick', 70, 0); const e = G.enemies[G.enemies.length - 1], hp = e.hp;
  G.hurtPlayer(10);
  assert(near(hp - e.hp, 50), '破膜新星没有造成 50 点基础伤害');
  assert(Math.abs(e.kbx) > 0 || e.dead, '破膜新星没有触发击退');
});

test('二级轮转减少冷却，轮转充盾恢复 8 点', () => {
  const p = fresh(2); p.actives = [active('cyclone'), active('arc')];
  p.actives[0].t = 5; p.actives[1].t = 7;
  G.C.afterCast(p.actives[0], {});
  assert(G.I.roundCount === 1 && p.actives[0].t === 5 && p.actives[1].t === 7, '单个主动就错误完成轮转');
  G.C.afterCast(p.actives[0], {});
  assert(G.I.roundCount === 1, '同一主动重复施放累计了多格');
  G.I.state.shield = 0; passive('idleround').fx(); G.C.afterCast(p.actives[1], {});
  assert(G.I.roundCount === 0 && near(p.actives[0].t, 4.4) && near(p.actives[1].t, 6.4), '完整轮转冷却缩减错误');
  assert(G.I.shield === 8, '轮转充盾没有恢复 8 点');
});

test('四级四主动取消伤害惩罚并将轮转缩减提高至 1.2 秒', () => {
  const p = fresh(4); p.actives = ['cyclone', 'arc', 'volcanic', 'ruler'].map(active);
  assert(near(G.skillCalc(p.actives[0]).dmg, 1), '四级满编仍保留伤害惩罚');
  for (const a of p.actives) { a.t = 5; G.C.afterCast(a, {}); }
  assert(p.actives.every(a => near(a.t, 3.8)), '四级满编轮转没有减少 1.2 秒');
});

test('五级重播真实施放最后主动，造成 70% 修正且不累计下一轮', () => {
  const p = fresh(5); p.actives = [active('cyclone'), active('arc')];
  G.spawnEnemy('stick', 80, 0);
  G.C.afterCast(p.actives[0], {});
  const before = G.lightnings.length;
  G.C.afterCast(p.actives[1], {});
  assert(G.lightnings.length > before, '整套放映没有真实施放落雷批注');
  assert(G.I.roundCount === 0, '免费重播推进了下一轮');
  assert(G.floats.some(f => f.txt.includes('整套放映')), '缺少整套放映反馈');
});

test('三级只有满盾时移动速度提高 10%', () => {
  const withShield = fresh(3); G.keys.d = true; G.update(0.1); G.keys.d = false;
  const shieldX = withShield.x;
  const withoutShield = fresh(3); G.I.state.shield = 39;
  G.keys.d = true; G.update(0.1); G.keys.d = false;
  assert(near(shieldX, withoutShield.x * 1.1, 0.02), '满盾移动速度加成错误：' + shieldX + '/' + withoutShield.x);
});

test('挂机者手机摇杆水平居中，移除技能与自动施放按钮且不影响其他角色', () => {
  fresh(2); drawTexts.length = 0; G.render();
  assert(G.joyHome.x === 187.5, '挂机者默认摇杆没有位于屏幕水平正中');
  assert(!drawTexts.includes('吸墨') && !drawTexts.includes('潜墨') && !drawTexts.includes('墨潮'), '手机技能按钮仍然显示');
  assert(!drawTexts.some(t => t.includes('自动施法') || t.includes('自动书写')), '自动施放状态按钮仍然显示');
  assert(drawTexts.includes('盾 40/40'), '脚下护盾数值没有显示');
  assert(!drawTexts.some(t => t.includes('护盾恢复') || t.includes('修正带护盾已就绪')), '旧护盾倒计时仍然存在');
  G.C.requestRun(); G.C.selectCharacter('draft'); G.C.confirmSelection();
  assert(G.joyHome.x === 72, '其他角色的摇杆位置被挂机者布局影响');
});

console.log(failed ? 'IDLE_CHARACTER_TEST_FAILURES: ' + failed : 'IDLE_CHARACTER_TEST_OK (' + passed + '/' + passed + ')');
process.exit(failed ? 1 : 0);

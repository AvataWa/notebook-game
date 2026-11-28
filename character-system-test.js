// 出战角色：存档、选角、固定起手、五级成长与七类战斗规则专项测试
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
const drawTexts = [], drawFonts = [], canvasHandlers = [], keyHandlers = [];
const fakeCtx = new Proxy({}, { get(t, k) {
  if (k === 'measureText') return txt => ({ width: String(txt).length * 10 });
  if (k === 'fillText') return txt => { drawTexts.push(String(txt)); drawFonts.push(t.font); };
  return () => {};
}, set(t, k, v) { t[k] = v; return true; } });
const fakeCanvas = {
  getContext: () => fakeCtx, width: 0, height: 0, style: {},
  addEventListener(type, fn, capture) { if (type === 'pointerdown') canvasHandlers.push({ fn, capture: capture === true }); },
  getBoundingClientRect: () => ({ left: 0, top: 0, width: 375, height: 667 })
};
const stored = Object.create(null);
global.localStorage = {
  getItem: k => Object.prototype.hasOwnProperty.call(stored, k) ? stored[k] : null,
  setItem: (k, v) => { stored[k] = String(v); }, removeItem: k => { delete stored[k]; }
};
global.window = global;
Object.assign(global, { addEventListener(type, fn, capture) { if (type === 'keydown') keyHandlers.push({ fn, capture: capture === true }); },
  devicePixelRatio: 1, innerWidth: 375, innerHeight: 667, matchMedia: () => ({ matches: true }) });
global.document = { getElementById: () => fakeCanvas, createElement: () => fakeCanvas };
global.requestAnimationFrame = () => {};
eval(src + `
;globalThis.G = {
  resetGame, resetInkField, render, resize, skillCalc, buildOptions, applyOption, rerollOptions,
  applyLevelEquipment: (...args) => window.__buildRuntime.applyLevelEquipment(...args),
  chargeParry, chargeTurf, showParryFloat, updateSkills, enterDive, exitDive, toggleDive, update, castAbsorb, castInkSurge,
  reflectEnemyBullet, reflectMeleeSwing, hurtEnemy, hurtPlayer, killEnemy, spawnEnemy, supportUsable,
  get player() { return player; }, get enemies() { return enemies; }, get minions() { return minions; },
  get bullets() { return bullets; }, get ebullets() { return ebullets; }, get cards() { return cards; }, get floats() { return floats; },
  get lightnings() { return lightnings; }, get BATTLE() { return BATTLE; }, get keys() { return keys; },
  get camX() { return camX; }, get camY() { return camY; }, get VIEW_W() { return VIEW_W; }, get VIEW_H() { return VIEW_H; },
  get state() { return state; }, set state(v) { state = v; },
  get gameTime() { return gameTime; }, set gameTime(v) { gameTime = v; },
  get levelupPickAfter() { return levelupPickAfter; }, set levelupPickAfter(v) { levelupPickAfter = v; },
  get M() { return window.__metaRuntime; }, get C() { return window.CharacterRuntime; },
  get SUPPORTS() { return SUPPORTS; }
};`);
let failed = 0, passed = 0;
function test(name, fn) { try { fn(); passed++; console.log('OK  ' + name); } catch (e) { failed++; console.log('ERR ' + name + ': ' + e.stack.split('\n')[0]); } }
function assert(ok, msg) { if (!ok) throw new Error(msg); }
function near(a, b, eps = 0.001) { return Math.abs(a - b) < eps; }
function dispatch(handlers, e) {
  for (const h of handlers.filter(h => h.capture)) { h.fn(e); if (e.stopped) return; }
  for (const h of handlers.filter(h => !h.capture)) { h.fn(e); if (e.stopped) return; }
}
function press(key) {
  dispatch(keyHandlers, { key, repeat: false, stopped: false, preventDefault() {}, stopImmediatePropagation() { this.stopped = true; } });
}
function pointer(x, y) {
  dispatch(canvasHandlers, { clientX: x, clientY: y, pointerId: 1, stopped: false,
    preventDefault() {}, stopImmediatePropagation() { this.stopped = true; } });
}
function fresh(id = 'draft', level = 1) {
  G.M.resetAll(); G.C.selectCharacter(id); G.M.data.characters[id] = level; G.M.beginRun(false);
  if (G.state === 'levelup') G.state = 'play';
  G.player.xpNext = 999999; G.player.hp = G.player.maxhp = 9999; G.player.ink = G.player.maxInk = 999;
  G.player.actives.forEach(a => { a.t = 999; });
  return G.player;
}
function target() {
  G.spawnEnemy('stick', 50, 0); const e = G.enemies[G.enemies.length - 1];
  e.hp = e.maxhp = 9999; e.stunT = 999; e.r = 8; return e;
}

test('存档包含角色与五级数据，升级扣墨点并持久化', () => {
  G.M.resetAll();
  assert(G.M.data.character === 'draft' && G.M.data.characters.draft === 1, '默认角色存档错误');
  G.M.data.ink = 1000;
  assert(G.C.upgradeCharacter('draft') && G.M.data.characters.draft === 2 && G.M.data.ink === 920, '角色一级升级扣费错误');
  G.M.data.characters.draft = 4; G.M.data.ink = 600;
  assert(G.C.upgradeCharacter('draft') && G.M.data.characters.draft === 5 && G.M.data.ink === 0, '五级升级扣费错误');
  assert(!G.C.upgradeCharacter('draft'), '满级后仍可消费');
  assert(G.C.selectCharacter('parry') && JSON.parse(stored['notebook-meta-v1']).character === 'parry', '出战选择没有保存');
});

test('普通局和 Boss 都经过选角，并使用所选角色起手', () => {
  G.M.resetAll(); G.C.requestRun(); assert(G.state === 'metaCharacterSelect', '普通局未进入选角');
  G.C.selectCharacter('dive'); G.C.confirmSelection();
  assert(G.M.run.mode === 'normal' && G.player.characterId === 'dive' && G.player.actives[0].id === 'boomerang', '普通局角色或起手错误');
  G.C.requestBoss(3); assert(G.state === 'metaCharacterSelect', 'Boss 未进入选角');
  G.C.selectCharacter('summon'); G.C.confirmSelection();
  assert(G.M.run.mode === 'bossTest' && G.M.run.bossTestStage === 3 && G.player.actives[0].id === 'icespear', 'Boss 选角或关卡错误');
});

test('八名角色都有符合规则的初始主动', () => {
  for (const d of G.C.defs) {
    fresh(d.id);
    const expected = d.id === 'idle' ? 2 : 1;
    assert(G.player.actives.length === expected, d.name + ' 起手数量错误');
    if (!['single', 'idle'].includes(d.id)) assert(G.player.actives[0].id === d.initial, d.name + ' 固定起手错误');
    if (d.id === 'idle') assert(G.player.actives[0].id !== G.player.actives[1].id, '挂机者两个起手主动重复');
    assert(G.player.characterId === d.id && G.player.characterLevel === 1, d.name + ' 身份或等级错误');
  }
});

test('无名草稿四选一仅首次，免费重随不会每级恢复', () => {
  fresh('draft', 2); G.buildOptions(); assert(G.cards.length === 4, '二级首次不是四选一');
  G.buildOptions(); assert(G.cards.length === 3, '第二次仍是四选一');
  G.state = 'levelup'; G.levelupPickAfter = 0;
  assert(G.rerollOptions() && G.player.itemRerolls === 0, '免费重随未消耗');
  G.applyLevelEquipment(); G.buildOptions();
  assert(G.player.itemRerolls === 0, '免费重随在下一组选项中错误恢复');
});

test('回锋弹反刷新主动，单个主动有刷新间隔，五级精准刷新全部', () => {
  const p = fresh('parry', 2);
  p.actives = [{ id: 'ruler', lvl: 1, supports: [], t: 5 }, { id: 'cyclone', lvl: 1, supports: [], t: 3 }];
  p.absorbDuration = 0.3; p.absorbT = 0.1; G.chargeParry();
  assert(p.actives[0].t === 0 && p.actives[1].t === 3, '普通弹反刷新目标错误');
  assert(near(G.skillCalc(p.actives[0]).dmg, 1.75), '回锋二级增伤错误');
  p.actives[0].t = 2; G.chargeParry();
  assert(p.actives[0].t === 2, '同一主动在 0.5 秒内被重复刷新');
  fresh('parry', 5); G.player.actives = ['ruler', 'cyclone', 'arc'].map((id, i) => ({ id, lvl: 1, supports: [], t: 3 + i }));
  G.player.absorbDuration = 0.3; G.player.absorbT = 0.3; G.chargeParry();
  assert(G.player.actives.every(a => a.t === 0 && a.characterRad === 1.2), '五级精准弹反没有刷新全部并扩大范围');
  G.showParryFloat();
  assert(G.floats.some(f => f.txt === '精准回锋 ×3'), '精准弹反缺少回锋反馈');
  assert(!G.floats.some(f => f.txt.startsWith('弹反')), '回锋角色仍重复显示通用弹反');
});

test('墨底游降低纸面减伤，潜墨施放记录残影并实际重演', () => {
  const p = fresh('dive');
  assert(near(G.skillCalc(p.actives[0]).dmg, 0.7), '墨底游纸面减伤不是 30%');
  p.diving = true; p.actives[0].t = 0; G.updateSkills(0.01);
  assert(G.C.state.diveLog.length === 1, '潜墨施放没有记录残影');
  G.exitDive(); assert(G.C.state.echoes.length === 1 && near(G.C.state.echoes[0].mul, 0.6), '退出潜墨残影数值错误');
  const before = G.bullets.length; G.update(0.41);
  assert(G.bullets.length > before && G.C.state.echoes.length === 0, '残影没有实际施放');
});

test('过曝三段定点结算，满蓄每一段都联动全部主动', () => {
  const p = fresh('surge'); p.actives.push({ id: 'arc', lvl: 1, supports: [], t: 99, uc: 0 });
  p.actives.forEach(a => { a.t = 99; }); p.special = 100;
  assert(near(G.skillCalc(p.actives[0]).dmg, 0.75), '过曝普通主动减伤未生效');
  assert(G.castInkSurge(100, true), '满蓄墨潮施放失败');
  assert(p.actives.every(a => a.t > 0 && a.t < 90) && G.C.state.surgeWaves.length === 2, '满蓄首段没有联动或没有排入后续两段');
  p.actives.forEach(a => { a.t = 99; });
  G.update(0.19); assert(p.actives.every(a => a.t > 0 && a.t < 90) && G.C.state.surgeWaves.length === 1, '满蓄第二段没有联动全部主动');
  p.actives.forEach(a => { a.t = 99; });
  G.update(0.22); assert(p.actives.every(a => a.t > 0 && a.t < 90) && G.C.state.surgeWaves.length === 0, '满蓄第三段没有联动全部主动');
});

test('过曝非满蓄连续墨潮也都会在第三段联动全部主动', () => {
  const p = fresh('surge'); p.actives.push({ id: 'arc', lvl: 1, supports: [], t: 99, uc: 0 });
  for (let cast = 0; cast < 2; cast++) {
    p.actives.forEach(a => { a.t = 99; }); p.special = 100;
    assert(G.castInkSurge(100, false), '非满蓄墨潮施放失败');
    assert(p.actives.every(a => a.t === 99), '非满蓄首段提前联动');
    G.update(0.19); assert(p.actives.every(a => a.t > 90), '非满蓄第二段提前联动');
    G.update(0.22); assert(p.actives.every(a => a.t > 0 && a.t < 90), '非满蓄第三段没有联动全部主动');
  }
});

test('纸偶永久存在，精英击杀与 Boss 血量阶段都会生成纸偶', () => {
  const p = fresh('summon');
  assert(near(G.skillCalc(p.actives[0]).dmg, 0.8), '纸偶师主动减伤不是 20%');
  const e = target(); e.elite = true;
  G.hurtEnemy(e, 99999, 0, 0, 0, 0, 0, 0, '#000', false, 'icespear');
  const papers = G.minions.filter(m => m.characterPaper);
  assert(e.dead && papers.length === 1 && papers[0].a.id === 'icespear', '纸偶未生成或继承技能错误');
  assert(papers[0].t === Infinity, '纸偶仍然存在持续时间');
  target(); assert(G.C.castPaper(papers[0]) && papers[0].c, '纸偶无法释放继承技能');
  assert(near(papers[0].c.dmg, G.skillCalc(papers[0].a).dmg / 0.8 * 0.2), '一级纸偶继承伤害不是 20%');
  assert(G.lightnings.some(l => l.paperLaser && l.t === 0.28), '纸偶激光显示时间不是 0.28 秒');
  const boss = target(); boss.boss = true;
  G.hurtEnemy(boss, 2500, 0, 0, 0, 0, 0, 0, '#000', false, 'icespear');
  assert(G.minions.filter(m => m.characterPaper).length === 2 && boss.characterPaperStage === 1, 'Boss 损失 25% 生命没有生成纸偶');
});

test('局外等级只提高纸偶继承倍率，不再决定数量或形态', () => {
  const inherits = [0.2, 0.25, 0.3, 0.35, 0.4];
  for (let level = 1; level <= 5; level++) {
    fresh('summon', level); const e = target(); e.elite = true;
    G.hurtEnemy(e, 99999, 0, 0, 0, 0, 0, 0, '#000', false, 'icespear');
    const m = G.minions.find(v => v.characterPaper); target();
    assert(m.paperLvl === 1 && m.paperXp === 0 && m.paperWings === 0, level + ' 级局外等级错误决定了局内形态');
    assert(G.C.castPaper(m), level + ' 级纸偶无法施放');
    assert(near(m.c.dmg, G.skillCalc(m.a).dmg / 0.8 * inherits[level - 1]), level + ' 级纸偶继承倍率错误');
  }
});

test('纸偶固定六只，满编刷新全队攻击并把经验交给最落后成员', () => {
  fresh('summon', 1);
  for (let i = 0; i < 6; i++) { const e = target(); e.elite = true; G.hurtEnemy(e, 99999, 0, 0, 0, 0, 0, 0, '#000', false, 'icespear'); }
  const papers = G.minions.filter(m => m.characterPaper); papers.forEach(m => { m.atkCd = 5; });
  G.C.addPaperXp(papers[0], 4); papers.slice(1).forEach(m => G.C.addPaperXp(m, 2));
  const e = target(); e.elite = true; G.hurtEnemy(e, 99999, 0, 0, 0, 0, 0, 0, '#000', false, 'icespear');
  assert(papers.length === 6 && papers.every(m => m.t === Infinity && m.atkCd === 0), '固定六只或满编齐射规则错误');
  assert(papers[1].paperXp === 8 && papers[0].paperXp === 4 && papers.slice(2).every(m => m.paperXp === 2), '满编经验没有交给等级最低、经验最少的成员');
});

test('每只纸偶按个体经验独立羽化，混合形态同时存在并显示等级', () => {
  fresh('summon', 1); const e = target(); e.elite = true;
  G.hurtEnemy(e, 99999, 0, 0, 0, 0, 0, 0, '#000', false, 'icespear');
  const m = G.minions.find(v => v.characterPaper);
  const expected = [[0, 1, 0], [4, 2, 2], [12, 3, 4], [24, 4, 6], [40, 5, 6]];
  for (const [xp, level, wings] of expected) {
    m.paperXp = 0; m.paperLvl = 1; G.C.addPaperXp(m, xp);
    assert(m.paperXp === xp && m.paperLvl === level && m.paperWings === wings && m.rad === 1, '个体经验 ' + xp + ' 对应形态错误');
    drawTexts.length = 0; G.render();
    assert(drawTexts.includes('Lv.' + level), '纸偶缺少个体 Lv.' + level + ' 标识');
  }
  const other = target(); other.elite = true;
  G.hurtEnemy(other, 99999, 0, 0, 0, 0, 0, 0, '#000', false, 'icespear');
  const papers = G.minions.filter(v => v.characterPaper);
  assert(papers[0].paperLvl === 5 && papers[1].paperLvl === 1 && papers[1].paperWings === 0, '新纸偶没有独立从毛虫开始');
});

test('近六秒参与命中的纸偶获得击杀经验，不要求最后一击', () => {
  fresh('summon');
  for (let i = 0; i < 2; i++) { const e = target(); e.elite = true; G.hurtEnemy(e, 99999, 0, 0, 0, 0, 0, 0, '#000', false, 'icespear'); }
  const papers = G.minions.filter(m => m.characterPaper); papers.forEach(m => { m.atkCd = 999; });
  const e = target(); e.hp = e.maxhp = 99999;
  G.C.castPaper(papers[0], e); G.update(0.08);
  assert(e.paperHits && e.paperHits.some(h => h.m === papers[0]), '纸偶激光没有登记击杀参与');
  G.hurtEnemy(e, 999999, 0, 0, 0, 0, 0, 0, '#000', false, 'icespear');
  assert(papers[0].paperXp === 1 && papers[1].paperXp === 0, '参与经验错误或未命中纸偶也获得经验');
});

test('双翼牵线对穿线敌人造成周期伤害且每半秒最多一次', () => {
  const p = fresh('summon', 1);
  for (let i = 0; i < 2; i++) { const e = target(); e.elite = true; G.hurtEnemy(e, 99999, 0, 0, 0, 0, 0, 0, '#000', false, 'icespear'); }
  const papers = G.minions.filter(m => m.characterPaper), e = target();
  papers.forEach(m => G.C.addPaperXp(m, 4));
  papers[0].x = p.x - 50; papers[1].x = p.x + 50; papers.forEach(m => { m.y = p.y - 50; m.atkCd = 999; });
  e.x = p.x; e.y = p.y - 50; const hp = e.hp;
  G.update(0);
  assert(papers[0].paperLink === papers[1] && papers[1].paperLink === papers[0], '双翼纸蝶没有互相牵线');
  assert(e.hp < hp, '牵线没有伤害穿线敌人');
  const after = e.hp;
  G.update(0.1);
  assert(e.hp === after, '牵线伤害没有间隔限制');
  /* 隔离 0.1 秒内的环绕位移，只验证下一次周期结算。 */
  papers[0].x = p.x - 50; papers[1].x = p.x + 50;
  papers.forEach(m => { m.y = p.y - 50; });
  G.gameTime += 0.5;
  G.update(0);
  assert(e.hp < after, '牵线半秒后没有再次结算');
});

test('牵线双方至少一只四翼即可接力且不会递归', () => {
  const p = fresh('summon', 3);
  for (let i = 0; i < 2; i++) { const e = target(); e.elite = true; G.hurtEnemy(e, 99999, 0, 0, 0, 0, 0, 0, '#000', false, 'icespear'); }
  const papers = G.minions.filter(m => m.characterPaper), e = target();
  G.C.addPaperXp(papers[0], 12); G.C.addPaperXp(papers[1], 4);
  papers.forEach((m, i) => { m.x = p.x + i * 60; m.y = p.y - 60; m.atkCd = 999; }); G.update(0);
  const before = G.lightnings.length; G.C.castPaper(papers[0], e);
  const shots = G.lightnings.slice(before), relay = shots.filter(l => l.paperRelay);
  assert(relay.length === 1 && relay[0].tgt === e && near(relay[0].dmg, shots[0].dmg * 0.4), '接力目标、次数或伤害错误');
  const relayCount = G.lightnings.filter(l => l.paperRelay).length; G.C.castPaper(papers[0], e);
  assert(G.lightnings.filter(l => l.paperRelay).length === relayCount, '接力没有冷却或发生递归');
  assert(near(G.C.paperAttackInterval(), 0.85 / 1.2), '局外三级释放频率提升未生效');
});

test('三只同技能六翼纸蝶同调齐射且不再合体消耗', () => {
  const p = fresh('summon', 4);
  for (let i = 0; i < 3; i++) {
    const e = target(); e.elite = true;
    G.hurtEnemy(e, 99999, 0, 0, 0, 0, 0, 0, '#000', false, 'icespear');
  }
  const papers = G.minions.filter(m => m.characterPaper), e = target();
  papers.forEach(m => G.C.addPaperXp(m, 24));
  papers.forEach((m, i) => { m.x = p.x + (i - 1) * 60; m.y = p.y - 60; m.atkCd = 999; }); G.update(0);
  assert(papers.length === 3 && papers.every(m => m.paperWings === 6 && m.paperSyncGroup === 0 && m.t === Infinity), '六翼同调分组或永久状态错误');
  const before = G.lightnings.length; G.C.castPaper(papers[0], e);
  const shots = G.lightnings.slice(before).filter(l => l.paperSync);
  assert(shots.length === 3 && shots.every(l => l.tgt === e), '同调没有让三只纸蝶同步攻击');
  const expected = 12 * G.skillCalc(papers[0].a).dmg / 0.8 * 0.35 * 1.2;
  assert(shots.every(l => near(l.dmg, expected)), '同调 20% 增伤未正确生效');
});

test('局外四级纸偶继承来源主动进化，回形针激光追加闭链', () => {
  const p = fresh('summon', 4);
  p.actives[0] = { id: 'chainclip', lvl: 5, supports: [], t: 999, uc: 0 };
  const dead = target(); dead.elite = true;
  G.hurtEnemy(dead, 99999, 0, 0, 0, 0, 0, 0, '#000', false, 'chainclip');
  const m = G.minions.find(v => v.characterPaper), first = target(), second = target();
  second.x = first.x + 80;
  assert(G.C.castPaper(m, first), '回形针纸偶施放失败');
  const derived = G.lightnings.filter(l => l.paperEvolutionDerived);
  assert(derived.length === 1 && derived[0].tgt === second, '已进化回形针没有追加闭链或目标错误');
  assert(near(derived[0].dmg, 12 * m.c.dmg * 0.4), '纸偶闭链伤害倍率错误');
});

test('局外五级既有纸偶动态同步来源主动辅助', () => {
  const p = fresh('summon', 5), dead = target(); dead.elite = true;
  G.hurtEnemy(dead, 99999, 0, 0, 0, 0, 0, 0, '#000', false, 'icespear');
  const m = G.minions.find(v => v.characterPaper), e = target();
  p.actives[0].supports = [{ id: 'brutal', lvl: 1 }];
  G.C.castPaper(m, e); const before = m.c.dmg;
  p.actives[0].supports[0].lvl = 2; p.actives[0].supports.push({ id: 'dot', lvl: 1 });
  G.C.castPaper(m, e);
  assert(m.c.dmg > before && m.c.dot > 0 && m.c.paperSource === m, '既有纸偶没有同步后续辅助或命中来源');
});

test('纸偶参与 Boss 多阶段扣血时逐阶段获得经验', () => {
  fresh('summon'); const dead = target(); dead.elite = true;
  G.hurtEnemy(dead, 99999, 0, 0, 0, 0, 0, 0, '#000', false, 'icespear');
  const m = G.minions.find(v => v.characterPaper), boss = target();
  boss.boss = true; boss.hp = boss.maxhp = 10000; m.atkCd = 999;
  G.C.castPaper(m, boss); G.update(0.08);
  G.hurtEnemy(boss, 5000, 0, 0, 0, 0, 0, 0, '#000', false, 'icespear');
  assert(boss.characterPaperStage === 2 && m.paperXp === 8 && m.paperLvl === 2, 'Boss 连跨两阶段没有各结算四点经验');
});

test('双翼解锁真实主动代笔，从蝴蝶位置施放且不移动角色', () => {
  const p = fresh('summon'), dead = target(); dead.elite = true;
  G.hurtEnemy(dead, 99999, 0, 0, 0, 0, 0, 0, '#000', false, 'icespear');
  const m = G.minions.find(v => v.characterPaper), e = target();
  m.x = 0; m.y = 0; e.x = 100; e.y = 0; p.x = 400; p.y = 400;
  assert(G.C.triggerPaperProxy() === 0 && G.C.state.paperProxyPending, '毛虫不应代笔或没有保留待释放机会');
  G.C.addPaperXp(m, 4);
  assert(G.C.triggerPaperProxy() === 1, '双翼没有成功代笔');
  const b = G.bullets.find(v => v.paperProxy);
  assert(b && b.x === 0 && b.y === -10 && b.paperSource === m, '代笔没有从蝴蝶位置生成真实冰锥或丢失来源');
  assert(p.x === 400 && p.y === 400 && near(G.C.state.paperProxyReady, 4), '代笔移动了角色或双翼冷却不是四秒');
  drawTexts.length = 0; G.render();
  assert(m.paperProxySkill === 'icespear' && drawTexts.includes('代'), '代笔缺少技能与表现标识');
});

test('代笔冷却随个体等级降低，双蝶按较低等级且受局外频率加成', () => {
  const p = fresh('summon'), m = { paperLvl: 1 };
  for (let level = 1; level <= 5; level++) {
    m.paperLvl = level;
    assert(near(G.C.paperProxyCooldown([m]), 6 - level), '个体 Lv.' + level + ' 代笔冷却错误');
  }
  const other = { paperLvl: 2 }; m.paperLvl = 5;
  assert(near(G.C.paperProxyCooldown([m, other]), 4), '双蝶没有按较低个体等级计算');
  p.characterLevel = 3;
  assert(near(G.C.paperProxyCooldown([m, other]), 4 / 1.2), '代笔没有继承局外三级释放频率');
});

test('局外四级两只蝴蝶同时代笔不同主动，技能池不重复轮转', () => {
  const p = fresh('summon', 4);
  p.actives = ['icespear', 'arc'].map(id => ({ id, lvl: 1, supports: [], t: 999, uc: 0 }));
  for (const id of ['icespear', 'arc']) {
    const dead = target(); dead.elite = true;
    G.hurtEnemy(dead, 99999, 0, 0, 0, 0, 0, 0, '#000', false, id);
  }
  const papers = G.minions.filter(m => m.characterPaper); papers.forEach(m => G.C.addPaperXp(m, 24)); target();
  assert(G.C.triggerPaperProxy() === 2, '局外四级没有双蝶代笔');
  assert(new Set(papers.map(m => m.paperProxySkill)).size === 2 && papers.every(m => m.paperProxyT > 0), '双蝶施放了相同主动或表现缺失');
  assert(G.bullets.some(b => b.paperProxy) && G.lightnings.some(l => l.c && l.c.paperProxy), '双蝶没有分别生成冰锥与雷电');
  assert(near(G.C.state.paperProxyReady, 2 / 1.2), '双六翼代笔没有在两秒冷却上应用局外频率加成');
  const first = papers.map(m => m.paperProxySkill).join(','); G.C.triggerPaperProxy();
  assert(papers.every(m => m.paperProxySkill) && new Set(papers.map(m => m.paperProxySkill)).size === 2, '双蝶第二轮没有保持不同主动');
  assert(papers.map(m => m.paperProxySkill).join(',') !== first || papers[0].paperProxyLast !== 1, '代笔选取顺序没有推进');
});

test('单蝴蝶代笔按轮抽取不同主动，代笔击杀结算经验但不生成纸偶', () => {
  const p = fresh('summon');
  p.actives = ['icespear', 'arc'].map(id => ({ id, lvl: 1, supports: [], t: 999, uc: 0 }));
  let dead = target(); dead.elite = true;
  G.hurtEnemy(dead, 99999, 0, 0, 0, 0, 0, 0, '#000', false, 'icespear');
  const m = G.minions.find(v => v.characterPaper); G.C.addPaperXp(m, 4); target();
  G.C.triggerPaperProxy(); const first = m.paperProxySkill; G.C.triggerPaperProxy();
  assert(m.paperProxySkill !== first, '同一轮代笔重复抽取了相同主动');
  p.actives = [{ id: 'candle', lvl: 1, supports: [], t: 999, uc: 0 }];
  const e = target(); e.elite = true; e.hp = 1; e.x = m.x; e.y = m.y;
  const before = G.minions.filter(v => v.characterPaper).length;
  assert(G.C.triggerPaperProxy() === 1 && e.dead, '蜡烛代笔没有实际造成击杀');
  assert(m.paperXp === 10 && G.minions.filter(v => v.characterPaper).length === before, '代笔击杀经验错误或递归生成了纸偶');
});

test('纸偶离屏后主动飞回可视区域', () => {
  const p = fresh('summon', 2), dead = target(); dead.elite = true;
  G.hurtEnemy(dead, 99999, 0, 0, 0, 0, 0, 0, '#000', false, 'icespear');
  const m = G.minions.find(v => v.characterPaper), e = target();
  e.x = p.x; e.y = p.y; m.paperTarget = e; m.atkCd = 999;
  G.update(0); // 先同步相机，确保布置的是真实屏幕外起点。
  m.x = G.camX - 140; m.y = G.camY + G.VIEW_H / 2;
  const startX = m.x; G.update(0.1);
  assert(m.x > startX, '离屏纸偶没有开始向屏幕内飞行');
  for (let i = 0; i < 20; i++) G.update(0.05);
  assert(m.x >= G.camX + 20 && m.x <= G.camX + G.VIEW_W - 20 && m.y >= G.camY + 20 && m.y <= G.camY + G.VIEW_H - 20, '纸偶没有飞回可视区域');
});

test('纸蝶锁定目标环绕约 60 距离，激光独立结算且不移动玩家', () => {
  const p = fresh('summon'), px = p.x, py = p.y;
  const dead = target(); dead.elite = true;
  G.hurtEnemy(dead, 99999, 0, 0, 0, 0, 0, 0, '#000', false, 'icespear');
  const m = G.minions.find(v => v.characterPaper), e = target();
  e.x = 140; e.y = 0; m.x = 80; m.y = 0; m.orbitA = Math.PI; m.paperTarget = e; m.atkCd = 0;
  const hp = e.hp;
  G.update(0.05); G.update(0.05);
  assert(G.lightnings.some(l => l.paperLaser && l.tgt === e), '纸蝶没有向锁定目标生成激光');
  assert(e.hp < hp, '纸蝶激光没有造成真实伤害');
  for (let i = 0; i < 20; i++) G.update(0.05);
  const dist = Math.hypot(e.x - m.x, e.y - m.y);
  assert(dist >= 45 && dist <= 85, '纸蝶没有维持在目标约 60 的环绕距离：' + dist);
  assert(m.paperTarget === e && p.x === px && p.y === py, '纸蝶目标发生漂移或施法改写了玩家坐标');
});

test('毛虫按水平移动方向转向，左移时头部与触角朝左', () => {
  const p = fresh('summon'), dead = target(); dead.elite = true;
  G.hurtEnemy(dead, 99999, 0, 0, 0, 0, 0, 0, '#000', false, 'icespear');
  const m = G.minions.find(v => v.characterPaper), e = target();
  m.x = 100; m.y = 0; e.x = 200; e.y = 0; m.orbitA = Math.PI; m.paperTarget = e; m.atkCd = 999;
  G.update(0.05);
  assert(m.paperFacing === 1, '毛虫右移时没有朝右');
  const rightX = m.x; e.x = 0; m.orbitA = 0; G.update(0.05);
  assert(m.paperFacing === -1 && m.x < rightX, '毛虫左移时没有朝左');
  G.render();
});

test('关卡切换移除旧目标后纸偶立即重选并攻击 Boss', () => {
  const p = fresh('summon'), dead = target(); dead.elite = true;
  G.hurtEnemy(dead, 99999, 0, 0, 0, 0, 0, 0, '#000', false, 'icespear');
  const m = G.minions.find(v => v.characterPaper), stale = target();
  m.paperTarget = stale; G.enemies.splice(G.enemies.indexOf(stale), 1);
  const boss = target(); boss.boss = true; boss.x = 130; boss.y = 0;
  m.x = 0; m.y = 0; m.orbitA = Math.PI; m.atkCd = 0;
  const hp = boss.hp; G.update(0);
  assert(m.paperTarget === boss, '纸偶仍锁定已离场的旧目标');
  const aimed = G.lightnings.some(l => l.paperLaser && l.tgt === boss); G.update(0.08);
  assert(aimed && boss.hp < hp, '纸偶没有实际攻击新 Boss');
});

test('四色笔记主动挂色，第一段按 20% 权重采集四色并瞬发清空调色槽', () => {
  const p = fresh('colors');
  p.actives = ['arc', 'cyclone', 'volcanic', 'icespear'].map(id => ({ id, lvl: 1, supports: [], t: 999, uc: 0 }));
  const e = target();
  for (const id of ['arc', 'cyclone', 'volcanic', 'icespear']) G.hurtEnemy(e, 1, 0, 0, 0, 0, 0, 0, '#000', false, id);
  assert(Object.keys(e.colorTags).length === 4 && p.special === 0, '主动命中没有挂齐色签或错误充能');
  p.ink = 100; const ink = p.ink;
  assert(G.C.castColorSlash() && p.absorbT === 0 && Object.keys(e.colorTags).length === 0, '彩墨斩未消耗色签或错误进入弹反');
  assert(near(p.special, 11) && near(p.ink, ink + 3) && Object.keys(G.C.state.colorPalette).length === 4, '第一段四色资源权重或调色槽错误');
  p.special = 100; p.specialAnnounced = true;
  assert(G.C.castColorSurge() && p.special === 0 && !p.surgeCharging && Object.keys(G.C.state.colorPalette).length === 0, '四色墨潮没有瞬发并清空调色槽');
});

test('彩墨斩四段均为单次命中，伤害为 1／1.5／1.5／4，第四段后回到第一段', () => {
  const p = fresh('colors'), e = target(), expected = [40, 60, 60, 160], waves = ['straight', 'crescent', 'crescentMirror', 'ring'], recovery = [0.6, 0.6, 0.6, 0.8];
  for (let stage = 1; stage <= 4; stage++) {
    p.absorbCd = 0; e.x = 50; e.y = 0; p.faceA = 0;
    const hp = e.hp, slashesBefore = G.C.state.colorSlashes.length; if (stage === 3) G.floats.length = 0;
    assert(G.C.castColorSlash(), '第 ' + stage + ' 段无法释放');
    assert(near(e.hp, hp - expected[stage - 1]), '第 ' + stage + ' 段伤害错误：' + (hp - e.hp));
    assert(near(p.absorbCd, recovery[stage - 1]), '第 ' + stage + ' 段默认攻击间隔错误：' + p.absorbCd);
    assert(G.C.state.colorNext === (stage === 4 ? 1 : stage + 1), '第 ' + stage + ' 段没有正确推进');
    const visual = G.C.state.colorVisuals[G.C.state.colorVisuals.length - 1];
    assert(visual.stage === stage && visual.wave === waves[stage - 1], '第 ' + stage + ' 段缺少对应手绘刀波');
    assert(visual.total >= 0.38 && visual.seed > 0, '第 ' + stage + ' 段刀波持续时间或抖线种子缺失');
    visual.t = visual.total * 0.55; G.render(); // 实际执行直线、镜像半圆与 360° 环刃绘制路径。
    if (stage === 3) {
      const hits = G.floats.filter(f => f.txt === '60');
      assert(hits.length === 1 && G.C.state.colorSlashes.length === slashesBefore + 1, '第三段不是一次命中、一次伤害');
    }
  }
  const behind = target(); behind.x = -50; behind.y = 0; p.faceA = 0; p.absorbCd = 0;
  const behindHp = behind.hp; G.C.castColorSlash();
  assert(behind.hp === behindHp, '第一段错误命中了身后目标');
  p.absorbCd = 0; G.C.state.colorNext = 4; G.C.castColorSlash();
  assert(behind.hp < behindHp, '第四段 360° 环斩没有命中身后目标');
});

test('彩墨斩自动瞄准最近怪物，摇杆朝右时仍命中正上方目标', () => {
  const p = fresh('colors'), above = target(), right = target();
  above.x = 0; above.y = -70; right.x = 110; right.y = 0; p.faceA = 0; p.absorbCd = 0;
  const aboveHp = above.hp, rightHp = right.hp;
  assert(G.C.castColorSlash(), '自动瞄准第一段无法释放');
  const visual = G.C.state.colorVisuals[G.C.state.colorVisuals.length - 1];
  assert(near(visual.a, -Math.PI / 2), '刀波没有瞄准最近怪物：' + visual.a);
  assert(above.hp < aboveHp && right.hp === rightHp, '第一段没有按最近怪物方向命中');
});

test('彩墨斩仅前 0.1 秒锁定普通移动，保留接续窗口且允许潜墨', () => {
  let p = fresh('colors'); p.actives = [];
  G.C.castColorSlash();
  const x = p.x, y = p.y;
  G.keys.d = true; G.update(0.05); G.keys.d = false;
  assert(p.x === x && p.y === y && G.C.state.colorNext === 2, '攻击前 0.1 秒内角色仍能普通移动');
  assert(near(p.colorMoveUnlockT - G.gameTime, 0.05), '移动解锁时刻不是攻击后 0.1 秒');
  G.keys.d = true; G.update(0.06); G.keys.d = false;
  assert(p.x > x && G.C.state.colorNext === 2, '攻击 0.1 秒后仍不能移动，或提前移动错误重置连招');
  assert(near(G.C.state.colorComboUntil, G.gameTime + p.absorbCd + 0.3), '后摇后的接续窗口不是 0.3 秒');
  assert(G.toggleDive() && p.diving, '攻击后无法潜墨');
  const beforeDive = p.x; G.keys.d = true; G.update(0.1); G.keys.d = false;
  assert(p.x > beforeDive, '潜墨状态仍被错误锁定移动');

  p = fresh('colors'); p.actives = []; G.C.castColorSlash(); G.update(0.61);
  const move = G.C.colorMovement(1, 0);
  assert(move.x === 1 && G.C.state.colorNext === 1 && G.C.state.colorComboUntil === 0, '接续窗口移动没有重置连招');
  p = fresh('colors'); p.actives = []; G.C.castColorSlash(); G.update(0.61);
  G.C.castColorSlash();
  assert(G.C.state.colorVisuals[G.C.state.colorVisuals.length - 1].stage === 2, '无移动时不能接续第二段');
  p = fresh('colors'); p.actives = []; G.C.castColorSlash(); G.update(0.91); G.update(0);
  assert(G.C.state.colorNext === 1 && G.C.state.colorComboUntil === 0, '超过接续窗口没有自动收笔');
});

test('第三段单次命中只采集一次，空放推进但不产生资源', () => {
  const p = fresh('colors'), e = target();
  p.actives = ['arc', 'cyclone', 'volcanic', 'icespear'].map(id => ({ id, lvl: 1, supports: [], t: 999, uc: 0 }));
  for (const id of ['arc', 'cyclone', 'volcanic', 'icespear']) G.hurtEnemy(e, 1, 0, 0, 0, 0, 0, 0, '#000', false, id);
  p.ink = 100; G.C.state.colorNext = 3;
  assert(G.C.castColorSlash() && near(p.special, 13.75) && near(p.ink, 103.75), '第三段重复采集或资源权重错误：special=' + p.special + ' ink=' + p.ink + ' stage=' + G.C.state.colorNext);
  assert(Object.keys(e.colorTags).length === 0 && Object.keys(G.C.state.colorPalette).length === 4, '第三段没有一次清空并记录四色');
  G.enemies.length = 0; p.absorbCd = 0; const ink = p.ink, special = p.special;
  assert(G.C.castColorSlash() && G.C.state.colorNext === 1 && p.ink === ink && p.special === special, '第四段空放没有收笔或产生了资源');
});

test('四色普通潜墨 0.3 秒自动退出并可派生第二段，精准成功优先派生第四段', () => {
  let p = fresh('colors');
  assert(G.toggleDive() && p.diving, '四色无法进入潜墨');
  G.update(0.31); assert(!p.diving, '四色潜墨没有自动退出');
  p.absorbCd = 0; G.C.castColorSlash();
  assert(G.C.state.colorNext === 3 && G.C.state.colorVisuals[G.C.state.colorVisuals.length - 1].stage === 2, '普通潜墨没有派生第二段');
  p = fresh('colors'); G.toggleDive(); G.hurtPlayer(5, 'melee', null); G.update(0);
  assert(p.preciseDiveSuccessT === G.gameTime && p.diving, '精准潜墨事件没有记录');
  G.C.castColorSlash();
  const visual = G.C.state.colorVisuals[G.C.state.colorVisuals.length - 1];
  assert(G.C.state.colorNext === 1 && visual.stage === 4 && visual.precise && !p.diving, '精准潜墨没有优先派生第四段或未及时退潜');
  p = fresh('colors'); G.toggleDive(); G.update(1.01); p.absorbCd = 0; G.C.castColorSlash();
  assert(G.C.state.colorNext === 2, '超过一秒后仍错误使用潜墨派生');
});

test('彩墨斩仅缓存后摇末尾输入，五级四色第四段整次环斩增伤 2.5 倍', () => {
  let p = fresh('colors');
  G.C.castColorSlash();
  assert(!G.C.castColorSlash() && !G.C.state.colorBuffered, '后摇早期输入被错误缓存');
  p.absorbCd = 0.1; assert(G.C.castColorSlash() && G.C.state.colorBuffered, '后摇末尾输入没有缓存');
  G.update(0.11); G.update(0);
  assert(G.C.state.colorNext === 3 && !G.C.state.colorBuffered, '缓存输入没有在后摇结束后自动接第三段');
  p = fresh('colors', 5); const e = target();
  p.actives = ['arc', 'cyclone', 'volcanic', 'icespear'].map(id => ({ id, lvl: 1, supports: [], t: 999, uc: 0 }));
  for (const id of ['arc', 'cyclone', 'volcanic', 'icespear']) G.hurtEnemy(e, 1, 0, 0, 0, 0, 0, 0, '#000', false, id);
  p.ink = 100; G.C.state.colorNext = 4; const hp = e.hp;
  G.C.castColorSlash();
  assert(near(e.hp, hp - 900) && near(p.special, 19.25) && near(p.ink, 105.25), '四色终式伤害或 35% 资源权重错误');
  assert(G.floats.some(f => f.txt === '四色终式 · 环斩 ×2.5！'), '四色终式缺少明确反馈');
});

test('彩墨斩击杀返还 70% 潜墨当前冷却，并受一秒触发间隔限制', () => {
  const p = fresh('colors', 3); let e = target(); e.hp = 1; p.diveCd = 4;
  G.C.castColorSlash(); assert(e.dead && near(p.diveCd, 1.2), '击杀没有返还潜墨当前冷却');
  p.absorbCd = 0; G.gameTime += 0.5; e = target(); e.hp = 1;
  G.C.castColorSlash(); assert(e.dead && near(p.diveCd, 1.2), '一秒内重复返还了潜墨冷却');
});

test('死亡页点击、Space 与 Enter 都先结算，不会裸重置角色状态', () => {
  for (const input of ['pointer', ' ', 'Enter']) {
    const p = fresh(input === 'pointer' ? 'colors' : 'surge', 4), original = p;
    G.state = 'over'; G.render();
    const realNow = Date.now; Date.now = () => realNow() + 501;
    if (input === 'pointer') pointer(180, 400); else press(input);
    Date.now = realNow;
    assert(G.state === 'metaRunSummary' && G.M.settlement && !G.M.settlement.win, input + ' 没有进入失败结算');
    assert(G.player === original && G.player.characterId === p.characterId && G.player.actives.length > 0, input + ' 绕过结算裸重置了角色');
  }
  const p = fresh('colors', 4); G.C.requestRun(); G.C.confirmSelection();
  assert(G.player !== p && G.player.characterId === 'colors' && G.player.characterLevel === 4 && G.player.actives[0].id === 'arc', '再次开局没有完整应用角色能力');
});

test('Boss 结束页键盘不裸重开，再次挑战仍经过选角并完整应用能力', () => {
  fresh('dive', 2); G.M.beginBossTest(2); const original = G.player;
  G.state = 'over'; press('Enter');
  assert(G.state === 'over' && G.player === original, 'Boss 结束页 Enter 裸重置了战斗');
  pointer(180, 312);
  assert(G.state === 'metaCharacterSelect' && G.player === original, '再次挑战没有进入既有选角流程');
  G.C.confirmSelection();
  assert(G.state === 'play' && G.player !== original && G.player.characterId === 'dive' && G.player.characterLevel === 2 &&
    G.player.actives[0].id === 'boomerang' && G.M.run.mode === 'bossTest' && G.M.run.bossTestStage === 2, 'Boss 再次挑战角色身份、等级或起手丢失');
});

test('一笔到底限制单主动，开放八辅助、十二级与重铸', () => {
  const p = fresh('single', 5);
  assert(p.actives[0].lvl === 2 && G.C.activeCap() === 1 && G.C.supportCap() === 8 && G.C.levelCap() === 12, '单技能角色上限错误');
  G.buildOptions(); assert(G.cards.every(c => c.kind !== 'active' || c.acquire), '一笔到底出现直接装备其他主动的选项');
  const sp = { id: 'oncrit', lvl: 1 }; p.actives[0].supports = Array.from({ length: 7 }, () => ({ id: 'wide', lvl: 1 })).concat(sp);
  assert(near(G.C.triggerCooldown(1, p.actives[0], sp), 0.5), '第八槽连携冷却没有减半');
  p.characterLevel = 3; p.actives[0].supports = [{ id: 'wide', lvl: 3 }];
  assert(G.C.canReforge() && G.C.reforgeSupport(), '免费重铸入口逻辑不可用');
  assert(p.actives[0].supports[0].lvl === 3 && G.C.state.reforgeUsed && !G.C.reforgeSupport(), '重铸未保留等级或没有限制一次');
});

test('一笔到底每局随机唯一主动，不提供自选入口', () => {
  G.M.resetAll(); G.C.requestRun(false); G.C.selectCharacter('single');
  drawTexts.length = 0; G.render();
  assert(drawTexts.some(t => t.includes('随机主动')) && !drawTexts.includes('选择唯一主动'), '选角页仍有自选入口或未标明随机');
  const originalRandom = Math.random; Math.random = () => 0;
  G.C.confirmSelection(); Math.random = originalRandom;
  assert(G.state === 'play' && G.player.actives.length === 1 && G.player.actives[0].id === 'cyclone', '开局没有按随机结果使用唯一主动');
});

test('角色手账、开局选角与构筑界面实际绘制角色信息', () => {
  G.M.resetAll(); G.C.openCharacters(); drawTexts.length = 0; G.render();
  assert(drawTexts.includes('角色手账') && G.C.defs.every(d => drawTexts.some(t => t.includes(d.name))), '角色手账缺角色');
  G.C.requestRun(false); drawTexts.length = 0; G.render();
  assert(drawTexts.includes('选择出战角色') && drawTexts.some(t => t.includes('开始战斗')), '开局选角界面不完整');
  G.C.selectCharacter('single'); G.C.confirmSelection(); window.__buildView.open(); drawTexts.length = 0; G.render();
  assert(drawTexts.some(t => t.includes('一笔到底 Lv.1 · 单技能极限')), '构筑界面缺少角色名称、等级或流派');
});

test('横版选角页独立放大名称、说明与按钮，手机字号保持不变', () => {
  const oldWidth = global.innerWidth, oldHeight = global.innerHeight, oldMatch = global.matchMedia;
  try {
    G.M.resetAll(); G.C.requestRun(false); drawFonts.length = 0; G.render();
    assert(drawFonts.some(font => font && font.startsWith('bold 13px')), '手机角色名称字号被横版规则影响');
    global.innerWidth = 1280; global.innerHeight = 720; global.matchMedia = () => ({ matches: false }); G.resize();
    drawFonts.length = 0; G.render();
    assert(drawFonts.some(font => font && font.startsWith('bold 21px')), '横版角色名称没有放大到 21px');
    assert(drawFonts.some(font => font && font.startsWith('16px')), '横版角色说明没有放大到 16px');
    assert(drawFonts.some(font => font && font.startsWith('bold 15px')), '横版返回或战斗按钮没有放大到 15px');
  } finally {
    global.innerWidth = oldWidth; global.innerHeight = oldHeight; global.matchMedia = oldMatch; G.resize();
  }
});

test('八名角色战斗本体使用各自颜色与骨架挂件，潜墨沿用同一外观', () => {
  const seen = [], baseDraw = global.BipedRenderer.draw;
  global.BipedRenderer.draw = function(c, rig, options) {
    if (G.player.bipedRig && rig === G.player.bipedRig) seen.push({ color: options.def.color, decorate: options.decorate, swimming: !!options.swimming });
    return baseDraw(c, rig, options);
  };
  try {
    for (const d of G.C.defs) {
      fresh(d.id); seen.length = 0; G.render();
      const last = seen[seen.length - 1];
      assert(last && last.color === d.color && typeof last.decorate === 'function' && !last.swimming, d.name + ' 战斗外观未接入');
    }
    const p = fresh('dive'); p.diving = true; seen.length = 0; G.render();
    const dive = seen[seen.length - 1];
    assert(dive && dive.swimming && typeof dive.decorate === 'function', '潜墨没有使用同一角色挂件');
    p.diving = false; p.hurtT = 0.2; seen.length = 0; G.render();
    assert(seen[seen.length - 1].color === '#c0392b', '角色主色覆盖了受伤红色闪烁');
  } finally { global.BipedRenderer.draw = baseDraw; }
});

test('四色只能由彩墨斩充能，空放不耗资源，同色去重且过期色签不能采集', () => {
  let p = fresh('colors');
  G.chargeTurf(50);
  assert(p.special === 0, '四色仍能通过普通涂地充能');
  const emptyInk = p.ink;
  assert(G.C.castColorSlash() && p.absorbCd > 0 && G.C.state.colorNext === 2 && p.ink === emptyInk && p.special === 0 && p.absorbT === 0, '空放没有推进段数，或产生了资源与弹反窗口');
  p = fresh('colors'); let e = target();
  for (let i = 0; i < 2; i++) G.hurtEnemy(e, 1, 0, 0, 0, 0, 0, 0, '#000', false, 'arc');
  p.ink = 100;
  assert(G.C.castColorSlash() && Object.keys(G.C.state.colorPalette).join(',') === 'thunder' && near(p.special, 4) && near(p.ink, 101), '重复同色没有按单色及第一段权重采集');
  p = fresh('colors'); e = target();
  G.hurtEnemy(e, 1, 0, 0, 0, 0, 0, 0, '#000', false, 'arc');
  G.gameTime += 6.01; p.ink = 100;
  assert(G.C.castColorSlash() && Object.keys(G.C.state.colorPalette).length === 0 && near(p.special, 1.2) && near(p.ink, 100.4), '过期色签仍被采集');
});

test('四色彩墨斩不提供弹反，无名草稿保留标准吸墨与单段墨潮', () => {
  let p = fresh('colors'); const e = target();
  assert(G.C.castColorSlash() && p.absorbT === 0 && p.absorbRadius === 0, '彩墨斩打开了弹反判定');
  const eb = { x: p.x, y: p.y, vx: 10, vy: 0, dmg: 5, life: 1, reflectable: true };
  const special = p.special;
  assert(!G.reflectEnemyBullet(eb) && eb.life === 1 && p.special === special, '四色仍能弹反敌弹');
  e.swingDamage = false; e.swingUnparryable = false;
  assert(!G.reflectMeleeSwing(e) && !G.floats.some(f => f.txt.startsWith('弹反')), '四色仍能弹反近战');
  p = fresh('draft'); const standardTarget = target();
  assert(G.castAbsorb() && p.absorbT > 0 && p.absorbRadius > 0, '无名草稿标准吸墨被改动');
  const standardBullet = { x: p.x, y: p.y, vx: 10, vy: 0, dmg: 5, life: 1, reflectable: true, sourceId: standardTarget.id };
  assert(G.reflectEnemyBullet(standardBullet) && standardBullet.life === 0 && p.special >= 20, '无名草稿标准弹反被改动：' + p.special);
  p.special = 100; p.absorbT = 0; const hp = standardTarget.hp;
  assert(G.castInkSurge(100, false) && near(standardTarget.hp, hp - 55) && G.C.state.surgeWaves.length === 0, '无名草稿标准墨潮被改成多段或伤害变化');
});

test('四色无色墨潮可立即释放，物理火焰冰霜效果真实结算', () => {
  let p = fresh('colors'), e = target(); p.special = 100;
  const hp = e.hp;
  assert(G.C.castColorSurge() && near(e.hp, hp - 55) && p.special === 0 && !p.surgeCharging, '无色墨潮不能释放或伤害错误');
  p = fresh('colors'); e = target(); e.stunT = 0; p.special = 100;
  G.C.state.colorPalette.phys = true; G.C.state.colorPalette.fire = true; G.C.state.colorPalette.ice = true;
  const mixedHp = e.hp;
  assert(G.C.castColorSurge() && near(e.hp, mixedHp - 200), '物理／火焰／冰霜混合直击伤害错误');
  assert(e.kbx > 600 && e.dotDps === 25 && e.dotT === 3 && e.colorSlowT === 2.5 && e.stunT >= 0.5, '四色击退、灼烧、减速或冻结没有真实生效');
});

test('四色雷潮最多连锁四个目标，表现连线不会二次结算', () => {
  const p = fresh('colors'); p.radMul = 0.5; p.special = 100; G.C.state.colorPalette.thunder = true; // 缩小直击圈，隔离雷链测试。
  const targets = [190, 220, 250, 280, 300].map(x => { const e = target(); e.x = x; return e; });
  const before = targets.map(e => e.hp);
  assert(G.C.castColorSurge(), '雷色墨潮释放失败');
  assert(G.lightnings.filter(l => l.colorOnly).length === 4, '雷色墨潮连锁数量不是四');
  for (let i = 0; i < 4; i++) assert(near(targets[i].hp, before[i] - 30), '第 ' + (i + 1) + ' 个连锁目标伤害错误');
  assert(targets[4].hp === before[4], '第五个目标被超额连锁');
  const after = targets.map(e => e.hp); G.update(0.1);
  assert(targets.every((e, i) => e.hp === after[i]), '纯表现雷电又造成了一次伤害');
});

test('过曝单目标总伤为基础墨潮 170%，移动后后续段仍在原位置命中', () => {
  const p = fresh('surge'), e = target(); p.actives = []; e.parryKbT = 999; p.special = 100; // 隔离击退、主动联动与环境墨迹，只验证三段直击。
  const hp = e.hp;
  assert(G.castInkSurge(100, false) && near(e.hp, hp - 55 * 0.55), '过曝首段不是 55%');
  G.resetInkField(); p.x = 500; p.y = 500;
  G.update(0.19); assert(near(e.hp, hp - 55), '过曝第二段未在原位置造成 45% 伤害');
  G.update(0.22); assert(near(e.hp, hp - 55 * 1.7) && G.C.state.surgeWaves.length === 0, '过曝三段总伤不是 170%');
});

test('过曝后续段继承外圈增伤，墨潮连携整次只触发一次', () => {
  let p = fresh('surge'); p.actives = []; p.affixes.surge.outerdamage = true;
  const e = target(); e.x = 90; e.parryKbT = 999; p.special = 100; const hp = e.hp;
  G.castInkSurge(100, false); G.resetInkField(); p.x = 500; G.update(0.19); G.update(0.22);
  assert(near(e.hp, hp - 55 * 1.7 * 1.5), '过曝后续段丢失外圈增伤');
  p = fresh('surge'); p.actives[0].supports = [{ id: 'onsurge', lvl: 1 }];
  p.actives.push({ id: 'arc', lvl: 1, supports: [], t: 99, uc: 0 }); p.actives[0].t = 99; p.special = 100;
  G.castInkSurge(100, true); G.update(0.19); G.update(0.22);
  assert(p.actives[0].uc === 1 && G.C.state.surgeWaves.length === 0, '过曝三段重复触发墨潮连携');
  p = fresh('colors'); p.actives[0].supports = [{ id: 'onsurge', lvl: 1 }]; p.special = 100;
  G.C.castColorSurge();
  assert(p.actives[0].uc === 1, '四色瞬发墨潮没有触发或重复触发墨潮连携');
});

test('四色潜墨沿按下方向突进 96，并保留 0.3 秒自动退出', () => {
  const p = fresh('colors'); p.actives = []; p.faceA = Math.PI;
  G.keys.d = true; assert(G.toggleDive() && p.diving, '四色无法开始方向突进'); G.keys.d = false;
  const x = p.x, y = p.y;
  G.update(0.06);
  assert(near(p.x - x, 48, 0.01) && near(p.y, y), '潜墨突进前半程距离或方向错误：' + (p.x - x));
  G.update(0.07);
  assert(near(p.x - x, 96, 0.01) && near(G.C.state.colorDashT, 0), '潜墨突进总距离不是 96：' + (p.x - x));
  G.update(0.18);
  assert(!p.diving, '方向突进破坏了 0.3 秒自动退出');
});

test('四色墨潮生成三次跟随角色的椭圆序列帧，但整次仍只结算一次伤害', () => {
  const p = fresh('colors'), e = target(); p.actives = []; p.special = 100;
  const hp = e.hp, radius = G.BATTLE.surge.radius * p.radMul * 1.3;
  assert(G.C.castColorSurge() && near(e.hp, hp - 55), '无色墨潮原始直击伤害错误');
  const waves = G.C.state.colorVisuals.filter(v => v.kind === 'colorSurgeEllipse');
  assert(waves.length === 3 && waves.every(v => v.wave === 'ring' && near(v.total, 0.24)), '墨潮没有生成恰好三次椭圆序列帧');
  assert(near(waves[0].delay, 0) && near(waves[1].delay, 0.085) && near(waves[2].delay, 0.17), '三段椭圆波的错峰时间错误');
  assert(waves.every((v, i) => near(v.r, radius * (0.88 + i * 0.06)) && near(v.a, i * Math.PI / 3)), '椭圆波范围不是 1.3 倍，或三次角度没有错开 60°');
  waves.forEach(v => { v.delay = 0; v.t = v.total * 0.5; });
  p.x += 37; p.y -= 21; G.update(0); G.render();
  assert(waves.every(v => v.x === p.x && v.y === p.y), '三段椭圆波没有跟随角色中心');
  const after = e.hp; G.update(0.06); G.render();
  assert(e.hp === after && waves.every(v => v.t > 0), '椭圆表现重复扣血或尚未播完就消失');
  G.update(0.3);
  assert(e.hp === after && G.C.state.colorVisuals.every(v => v.kind !== 'colorSurgeEllipse'), '墨潮结束后仍扣血或残留椭圆表现');
});

test('四色墨潮按扩大 30% 的正圆判定，四个方向一致且覆盖原范围外目标', () => {
  const p = fresh('colors'); p.actives = []; p.special = 100;
  const oldRadius = G.BATTLE.surge.radius * p.radMul, radius = oldRadius * 1.3;
  const inside = [0, Math.PI / 2, Math.PI, Math.PI * 1.5].map(a => {
    const e = target(); e.x = Math.cos(a) * radius * 0.95; e.y = Math.sin(a) * radius * 0.95; return e;
  });
  const expanded = target(); expanded.x = oldRadius * 1.15; expanded.y = 0;
  const outside = target(); outside.x = radius + outside.r + 1; outside.y = 0;
  const hp = inside.map(e => e.hp), expandedHp = expanded.hp, outsideHp = outside.hp;
  assert(G.C.castColorSurge(), '扩大后的墨潮释放失败');
  inside.forEach((e, i) => assert(near(e.hp, hp[i] - 55), '正圆第 ' + (i + 1) + ' 个方向判定不一致'));
  assert(near(expanded.hp, expandedHp - 55), '原范围 1.15 倍处的目标没有被扩大后的墨潮命中');
  assert(outside.hp === outsideHp, '正圆范围外的目标被错误命中');
});

console.log(failed ? 'CHARACTER_SYSTEM_TEST_FAILURES: ' + failed : 'CHARACTER_SYSTEM_TEST_OK (' + passed + '/' + passed + ')');
process.exit(failed ? 1 : 0);

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
const drawTexts = [], drawFonts = [];
const fakeCtx = new Proxy({}, { get(t, k) {
  if (k === 'measureText') return txt => ({ width: String(txt).length * 10 });
  if (k === 'fillText') return txt => { drawTexts.push(String(txt)); drawFonts.push(t.font); };
  return () => {};
}, set(t, k, v) { t[k] = v; return true; } });
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
  resetGame, render, resize, skillCalc, buildOptions, applyOption, rerollOptions,
  applyLevelEquipment: (...args) => window.__buildRuntime.applyLevelEquipment(...args),
  chargeParry, updateSkills, enterDive, exitDive, update, castInkSurge, hurtEnemy, killEnemy, spawnEnemy,
  supportUsable,
  get player() { return player; }, get enemies() { return enemies; }, get minions() { return minions; },
  get bullets() { return bullets; }, get cards() { return cards; }, get floats() { return floats; },
  get lightnings() { return lightnings; },
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
  assert(G.M.run.mode === 'bossTest' && G.M.run.bossTestStage === 3 && G.player.actives[0].id === 'absolve', 'Boss 选角或关卡错误');
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

test('过曝降低普通减伤，满蓄墨潮联动所有主动并重置冷却', () => {
  const p = fresh('surge'); p.actives.push({ id: 'arc', lvl: 1, supports: [], t: 99, uc: 0 });
  p.actives.forEach(a => { a.t = 99; }); p.special = 100;
  assert(near(G.skillCalc(p.actives[0]).dmg, 0.75), '过曝普通主动减伤未生效');
  assert(G.castInkSurge(100, true), '满蓄墨潮施放失败');
  assert(p.actives.every(a => a.t > 0 && a.t < 99), '墨潮没有联动并重置主动冷却');
});

test('纸偶师精英击杀与 Boss 血量阶段都会生成纸偶', () => {
  const p = fresh('summon');
  assert(near(G.skillCalc(p.actives[0]).dmg, 0.8), '纸偶师主动减伤不是 20%');
  const e = target(); e.elite = true;
  G.hurtEnemy(e, 99999, 0, 0, 0, 0, 0, 0, '#000', false, 'absolve');
  const papers = G.minions.filter(m => m.characterPaper);
  assert(e.dead && papers.length === 1 && papers[0].a.id === 'absolve', '纸偶未生成或继承技能错误');
  target(); assert(G.C.castPaper(papers[0]) && papers[0].c, '纸偶无法释放继承技能');
  const boss = target(); boss.boss = true;
  G.hurtEnemy(boss, 2500, 0, 0, 0, 0, 0, 0, '#000', false, 'absolve');
  assert(G.minions.filter(m => m.characterPaper).length === 2 && boss.characterPaperStage === 1, 'Boss 损失 25% 生命没有生成纸偶');
});

test('纸蝶锁定目标环绕约 60 距离，激光独立结算且不移动玩家', () => {
  const p = fresh('summon'), px = p.x, py = p.y;
  const dead = target(); dead.elite = true;
  G.hurtEnemy(dead, 99999, 0, 0, 0, 0, 0, 0, '#000', false, 'absolve');
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

test('四色笔记两色、三色提供阶段收益，四色触发混色', () => {
  const p = fresh('colors');
  p.actives = ['arc', 'cyclone', 'volcanic', 'icespear'].map(id => ({ id, lvl: 1, supports: [], t: 999, uc: 0 }));
  const e = target();
  G.hurtEnemy(e, 1, 0, 0, 0, 0, 0, 0, '#000', false, 'arc');
  G.hurtEnemy(e, 1, 0, 0, 0, 0, 0, 0, '#000', false, 'cyclone');
  assert(near(p.actives[0].t, 998.7), '两色共鸣没有缩短全部主动冷却');
  for (const id of ['volcanic', 'icespear']) G.hurtEnemy(e, 1, 0, 0, 0, 0, 0, 0, '#000', false, id);
  assert(G.C.state.colorBurst, '四种属性命中没有准备混色');
  G.updateSkills(0);
  assert(!G.C.state.colorBurst && Object.keys(G.C.state.colorSet).length === 0, '混色后四色槽没有清空');
  assert(G.floats.some(f => f.txt === '四色混色！'), '缺少混色爆发反馈');
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

console.log(failed ? 'CHARACTER_SYSTEM_TEST_FAILURES: ' + failed : 'CHARACTER_SYSTEM_TEST_OK (' + passed + '/' + passed + ')');
process.exit(failed ? 1 : 0);

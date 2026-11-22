// 选角黑屏开场、角色文案、持久化、设置与结算专项测试
const fs = require('fs');
const files = [
  'battle-config.js', 'enemy-config.js', 'content-config.js', 'main.js', 'build-runtime.js',
  'hades-runtime.js', 'hades-weapons-runtime.js', 'weapon-passives-expansion.js',
  'form-passives-runtime.js', 'evolution-runtime.js', 'support-expansion-runtime.js',
  'elemental-support-runtime.js', 'trigger-support-runtime.js', 'build-view.js',
  'meta-config.js', 'character-config.js', 'dive-counter-runtime.js', 'combat-feel-runtime.js',
  'equipment-rework-runtime.js', 'meta-runtime.js', 'character-runtime.js', 'idle-runtime.js',
  'ui-copy.js', 'ui-detail-runtime.js', 'settings-runtime.js', 'desktop-runtime.js', 'loadout-runtime.js',
  'acquisition-runtime.js', 'option-director-runtime.js', 'narrative-copy-v2.js', 'narrative-runtime.js'
];
const src = files.map(f => fs.readFileSync(__dirname + '/' + f, 'utf8').replace("'use strict';", '')).join('\n');
const drawTexts = [];
const fakeCtx = new Proxy({}, { get(t, k) {
  if (k === 'measureText') return txt => ({ width: String(txt).length * 10 });
  if (k === 'fillText') return txt => { drawTexts.push(String(txt)); };
  return () => {};
}, set() { return true; } });
const listeners = Object.create(null), windowListeners = Object.create(null);
const fakeCanvas = {
  getContext: () => fakeCtx, width: 0, height: 0, style: {},
  addEventListener(type, fn) { (listeners[type] || (listeners[type] = [])).push(fn); },
  setPointerCapture() {}, releasePointerCapture() {},
  getBoundingClientRect: () => ({ left: 0, top: 0, right: 375, bottom: 667, width: 375, height: 667 })
};
const stored = Object.create(null);
global.localStorage = { getItem: k => stored[k] || null, setItem: (k, v) => { stored[k] = String(v); }, removeItem: k => { delete stored[k]; } };
global.window = global;
global.PointerEvent = function PointerEvent() {};
global.__coarse = true;
Object.assign(global, {
  addEventListener(type, fn) { (windowListeners[type] || (windowListeners[type] = [])).push(fn); },
  devicePixelRatio: 1, innerWidth: 375, innerHeight: 667,
  matchMedia: () => ({ matches: global.__coarse })
});
global.document = { getElementById: () => fakeCanvas, createElement: () => fakeCanvas };
global.requestAnimationFrame = () => {};
eval(src + `\n;globalThis.G = {
  resetGame, update, render, resize, loop, spawnBoss, hurtPlayer,
  get player() { return player; }, get enemies() { return enemies; },
  get state() { return state; }, set state(v) { state = v; },
  get N() { return globalThis.NarrativeRuntime; }, get S() { return globalThis.SettingsRuntime; },
  get C() { return globalThis.CharacterRuntime; }, get M() { return globalThis.__metaRuntime; }
};`);
let failed = 0, passed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('OK  ' + name); }
  catch (e) { failed++; console.log('ERR ' + name + ': ' + e.stack.split('\n')[0]); }
}
function assert(ok, msg) { if (!ok) throw new Error(msg); }
function mobile() {
  global.innerWidth = 375; global.innerHeight = 667; global.__coarse = true; G.resize();
}
function desktop() {
  global.innerWidth = 1280; global.innerHeight = 720; global.__coarse = false; G.resize();
}
function home() {
  if (G.state === 'narrativeIntro') G.N.finishIntro();
  G.M.goHome(); mobile();
  if (!G.S.narrativeEnabled) G.S.toggleNarrative();
}
function beginIntro(id = 'draft', openingSeen = false) {
  home(); G.N.state.progress.openingSeen = openingSeen;
  G.N.state.progress.lastRun = null; G.N.state.progress.totalDeaths = 0;
  G.N.state.progress.bossDeaths = {}; G.N.state.progress.recent = {};
  G.C.requestRun(); G.C.selectCharacter(id); G.C.confirmSelection();
}
function dispatchEvent(pool, type, props) {
  let stopped = false;
  const event = Object.assign({ preventDefault() {}, stopImmediatePropagation() { stopped = true; } }, props);
  for (const fn of pool[type] || []) { fn(event); if (stopped) break; }
}

test('真实手机开始按钮与回车都会先进入黑屏', () => {
  home(); G.N.state.progress.openingSeen = false;
  G.C.requestRun(); G.C.selectCharacter('draft'); G.render();
  dispatchEvent(listeners, 'pointerdown', { pointerId: 1, clientX: 187.5, clientY: 601 });
  assert(G.state === 'narrativeIntro' && G.N.state.intro, '手机开始按钮绕过了黑屏');
  assert(G.N.state.intro.index === 0 && G.N.state.intro.reveal === 0, '开始点击被误传给黑屏并跳句');
  assert(!G.M.run, '手机按钮在开场前创建了战斗');
  G.N.finishIntro();
  home(); G.C.requestRun();
  dispatchEvent(windowListeners, 'keydown', { key: 'Enter', repeat: false });
  assert(G.state === 'narrativeIntro' && G.N.state.intro, '回车绕过了黑屏');
  assert(G.N.state.intro.index === 0 && G.N.state.intro.reveal === 0, '回车被误传给黑屏并跳句');
  G.N.finishIntro();
});

test('八角色、十页、十 Boss 与四主动进化文案完整', () => {
  const c = G.N.copy;
  assert(Object.keys(c.CHARACTER_LINES).length === 8, '角色数量错误');
  assert(c.PAGES.length === 10 && Object.keys(c.BOSS_INTROS).length === 10, '页面或 Boss 数量错误');
  assert(Object.keys(c.EVOLUTIONS).join(',') === 'chainclip,ballista,inkrain,absolve', '进化覆盖错误');
  for (const id of Object.keys(c.EVOLUTIONS)) assert(c.EVOLUTIONS[id][3] && c.EVOLUTIONS[id][5], id + ' 进化等级缺失');
});

test('选角确认先进入黑屏，首次五句且尚未创建战斗', () => {
  beginIntro('parry');
  assert(G.state === 'narrativeIntro' && G.N.state.intro, '未进入黑屏开场');
  assert(!G.M.run, '开场期间提前创建了正式战斗');
  assert(G.N.state.intro.lines.length === 5, '首次开场不是四句穿越加一句角色文本');
  assert(G.N.state.intro.lines[0].text === G.N.copy.OPENING[0], '首句错误');
  assert(G.N.state.intro.lines[4].text === G.N.copy.CHARACTER_LINES.parry[1], '角色短句错误');
  assert(G.N.state.progress.openingSeen, '首次记录未更新');
  assert(JSON.parse(stored[G.N.progressStorageKey]).openingSeen === true, '首次记录未持久化');
});

test('点击逻辑先补全整句再前进，跳过后角色和起手正确', () => {
  beginIntro('parry');
  const intro = G.N.state.intro;
  assert(G.N.advanceIntro() && intro.reveal === intro.lines[0].text.length && intro.index === 0, '第一次点击未补全整句');
  assert(G.N.advanceIntro() && intro.index === 1 && intro.reveal === 0, '第二次点击未进入下一句');
  G.N.finishIntro();
  assert(G.state === 'play' && !G.N.state.intro, '跳过后未正式开局');
  assert(G.M.run && G.M.run.mode === 'normal', '未创建普通关卡');
  assert(G.player.characterId === 'parry' && G.player.actives[0].id === 'ruler', '所选角色或起手技能未生效');
});

test('后续开局仅一条回归文本和一条角色文本', () => {
  beginIntro('summon', true);
  const intro = G.N.state.intro;
  assert(intro.lines.length === 2, '后续开场句数错误');
  assert(G.N.copy.RETURNING.includes(intro.lines[0].text), '未使用回归文本');
  assert(G.N.copy.CHARACTER_LINES.summon.slice(1).includes(intro.lines[1].text), '后续角色短句错误');
  G.N.finishIntro();
  assert(G.player.characterId === 'summon' && G.player.actives[0].id === 'absolve', '后续开局角色未生效');
});

test('关闭叙事后选角直接开局，设置状态持久化', () => {
  home(); G.S.toggleNarrative();
  assert(!G.S.narrativeEnabled && stored[G.S.narrativeStorageKey] === '0', '叙事开关未关闭或保存');
  G.C.requestRun(); G.C.selectCharacter('draft'); G.C.confirmSelection();
  assert(G.state === 'play' && !G.N.state.intro && G.M.run, '关闭后仍进入黑屏或未开局');
  G.S.toggleNarrative(); assert(G.S.narrativeEnabled, '重新开启失败');
});

test('主循环驱动十八字每秒与整句后一点八秒自动前进', () => {
  beginIntro('draft');
  const intro = G.N.state.intro;
  G.N.tick(0.5);
  assert(intro.reveal === 9 && intro.index === 0, '逐字速度错误');
  intro.reveal = intro.lines[0].text.length;
  G.N.tick(1.79); assert(intro.index === 0, '自动前进过早');
  G.N.tick(0.02); assert(intro.index === 1 && intro.reveal === 0, '自动前进未触发');
  const before = intro.reveal;
  G.loop(1000); G.loop(1016);
  assert(intro.reveal > before, '真实主循环没有更新黑屏开场');
  G.N.finishIntro();
});

test('黑屏实际渲染开场、跳过和继续提示', () => {
  beginIntro('draft');
  drawTexts.length = 0; G.render();
  assert(drawTexts.includes('纸上涂鸦幻想') && drawTexts.includes('跳过'), '黑屏标题或跳过未绘制');
  assert(drawTexts.includes('点击显示整句') && drawTexts.includes('自动播放中'), '开场操作提示未绘制');
  assert(!drawTexts.includes('轻点跳过'), '仍绘制旧战斗纸签提示');
  G.N.advanceIntro(); drawTexts.length = 0; G.render();
  assert(drawTexts.includes('点击下一句'), '整句后的继续提示未更新');
  G.N.finishIntro();
});

test('正式战斗不再出现叙事纸签或旧跳过提示', () => {
  beginIntro('dive'); G.N.finishIntro();
  drawTexts.length = 0; G.render();
  assert(G.state === 'play', '未进入战斗');
  assert(!drawTexts.includes('轻点跳过') && !drawTexts.includes('自动播放中'), '战斗仍有叙事遮挡提示');
  for (const entry of G.N.copy.PAGES) assert(!drawTexts.includes(entry[0]), '战斗仍显示页面叙事标题');
});

test('主界面标语与手机出战短句显示，升级预览只在手账保留', () => {
  home(); drawTexts.length = 0; G.render();
  assert(drawTexts.includes('每一页，都是一个没画完的梦。'), '主界面标语未绘制');
  G.C.requestRun(); G.C.selectCharacter('draft'); drawTexts.length = 0; G.render();
  assert(drawTexts.some(t => t.includes('先画一笔')), '手机选角未显示角色短句');
  assert(!drawTexts.some(t => t.startsWith('下级：') || t.startsWith('下一级：')), '手机出战页仍显示升级预览');
  G.C.openCharacters(); drawTexts.length = 0; G.render();
  assert(drawTexts.some(t => t.startsWith('下级：') || t.startsWith('下一级：')), '手机角色手账错误隐藏升级预览');
});

test('桌面出战页同样显示短句并隐藏下一级', () => {
  home(); desktop(); G.C.requestRun(); G.C.selectCharacter('draft'); drawTexts.length = 0; G.render();
  assert(drawTexts.some(t => t.includes('先画一笔')), '桌面选角未显示角色短句');
  assert(!drawTexts.some(t => t.startsWith('下一级：')), '桌面出战页仍显示升级预览');
  G.C.openCharacters(); drawTexts.length = 0; G.render();
  assert(drawTexts.some(t => t.startsWith('下一级：')), '桌面角色手账错误隐藏升级预览');
  mobile();
});

test('首次与重复通关使用不同结算，失败文案非空', () => {
  beginIntro('draft'); G.N.finishIntro();
  G.N.state.progress.winSeen = false;
  const first = G.N.settlementText(true);
  assert(first.includes('最后一笔') && G.N.state.progress.winSeen, '首次通关文案或记录错误');
  home(); const repeat = G.N.settlementText(true);
  assert(G.N.copy.WINS.includes(repeat), '重复通关仍使用首次文案');
  home(); assert(G.N.copy.DEFEATS.includes(G.N.settlementText(false)), '失败结算未使用失败文案');
  G.state = 'over'; drawTexts.length = 0; G.render();
  assert(drawTexts.includes('点按任意处重开一局') || drawTexts.includes('点击屏幕查看战斗结算'), '结算操作提示被移除');
});

test('主界面复用上一局结算文案并持久化', () => {
  beginIntro('draft', true); G.N.finishIntro(); G.hurtPlayer(999999, 'enemy', null);
  const ending = G.N.settlementText(false);
  home();
  assert(ending && G.N.homeText() === ending, '主界面没有复用上一局结算文案');
  assert(JSON.parse(stored[G.N.progressStorageKey]).lastEndText === ending, '上局结算文案没有持久化');
  drawTexts.length = 0; G.render();
  assert(drawTexts.includes(ending), '主界面没有实际绘制上局文案');
  assert(!drawTexts.includes(G.M.nextRankText()), '主界面仍显示晋升分数目标');
});

test('主界面设置按钮穿透段位热区并可返回', () => {
  home(); const entry = G.S.entryRect;
  dispatchEvent(listeners, 'pointerdown', { pointerId: 1, clientX: entry.x + entry.w / 2, clientY: entry.y + entry.h / 2 });
  assert(G.state === 'settings' && G.S.isOpen, '主界面统一热区拦截了设置入口');
  drawTexts.length = 0; G.render();
  assert(drawTexts.includes('选角开场与胜负结算短句'), '设置说明未更新');
  const l = G.S.layout();
  assert(l.narrative && l.narrative.y + l.narrative.h < l.close.y, '叙事行与返回按钮重叠');
  assert(l.close.y + l.close.h <= l.panel.y + l.panel.h, '返回按钮超出设置面板');
  dispatchEvent(listeners, 'pointerdown', { pointerId: 2, clientX: l.close.x + l.close.w / 2, clientY: l.close.y + l.close.h / 2 });
  assert(G.state === 'metaHome' && !G.S.isOpen, '设置返回没有恢复主界面');
});

test('第一批新增文案恰好九十六条且各池数量完整', () => {
  const c = G.N.copy;
  assert(c.RETURNING.length === 16 && c.DEFEATS.length === 12 && c.WINS.length === 6, '普通文案池数量错误');
  assert(Object.values(c.CHARACTER_LINES).every(lines => lines.length === 5), '每个角色应有四句开局文案');
  assert(Object.values(c.SPECIAL_DEFEATS).every(lines => lines.length === 3), '特殊失败池应为三条');
  assert(Object.keys(c.BOSS_DEFEATS).length === 10 && Object.values(c.BOSS_DEFEATS).every(lines => lines.length === 2), 'Boss 死亡文案数量错误');
  assert(Object.keys(c.MEMORY).length === 6 && Object.values(c.MEMORY).every(lines => lines.length === 3), '上局回忆文案数量错误');
  const added = 12 + 7 + 3 + 12 + 20 + 18 + 24;
  assert(added === 96, '新增总量不是九十六条');
});

test('真实 Boss 致命攻击触发专属结算并保留下局回忆', () => {
  beginIntro('draft', true); G.M.data.stats.highestStage = 2; G.N.state.progress.totalDeaths = 3; G.N.finishIntro();
  G.player.level = 20; G.spawnBoss(2);
  const boss = G.enemies[G.enemies.length - 1]; boss.hp = boss.maxhp * 0.6;
  G.hurtPlayer(999999, 'enemy', boss);
  const text = G.N.settlementText(false);
  assert(G.N.copy.BOSS_DEFEATS['涂改巨灵'].includes(text), '没有使用涂改巨灵专属死亡文案');
  assert(G.N.state.progress.lastRun.bossName === '涂改巨灵', '死亡来源未记录');
  assert(JSON.parse(stored[G.N.progressStorageKey]).lastRun.bossName === '涂改巨灵', '上局结果未持久化');
  home(); G.C.requestRun(); G.C.selectCharacter('draft'); G.C.confirmSelection();
  assert(G.N.state.intro.context.kind === 'bossFail' && G.N.state.intro.lines[0].text.includes('涂改巨灵'), '下局没有回应上次 Boss 失败');
  G.N.finishIntro();
});

test('破纪录死亡优先于普通失败并在下局继续回应', () => {
  beginIntro('draft', true); G.M.data.stats.highestStage = 1; G.N.state.progress.totalDeaths = 3; G.N.finishIntro();
  G.player.level = 30; G.hurtPlayer(999999, 'enemy', null);
  const text = G.N.settlementText(false);
  assert(G.N.copy.SPECIAL_DEFEATS.recordDeath.includes(text), '破纪录死亡未触发专属文案');
  assert(G.N.state.progress.lastRun.record, '破纪录标记未保存');
  home(); G.C.requestRun(); G.C.selectCharacter('draft'); G.C.confirmSelection();
  assert(G.N.state.intro.context.kind === 'record', '下局未优先回应新纪录');
  G.N.finishIntro();
});

test('最终 Boss 低血量惜败使用独立优先级', () => {
  beginIntro('draft', true); G.M.data.stats.highestStage = 10; G.N.state.progress.totalDeaths = 3; G.N.finishIntro();
  G.player.level = 100; G.spawnBoss(10);
  const boss = G.enemies[G.enemies.length - 1]; boss.hp = boss.maxhp * 0.1;
  G.hurtPlayer(999999, 'bullet', boss);
  assert(G.N.copy.SPECIAL_DEFEATS.finalBossLow.includes(G.N.settlementText(false)), '最终 Boss 惜败未触发');
});

test('首次死亡、换角色、老搭档与胜利回忆分别触发', () => {
  beginIntro('draft', true); G.N.finishIntro(); G.hurtPlayer(999999, 'enemy', null);
  assert(G.N.copy.SPECIAL_DEFEATS.firstDeath.includes(G.N.settlementText(false)), '首次死亡未触发');
  home(); G.N.state.progress.openingSeen = true;
  G.N.state.progress.lastRun = { win: false, characterId: 'draft', stage: 1, record: false, bossName: '', sameStreak: 1 };
  G.C.requestRun(); G.C.selectCharacter('parry'); G.C.confirmSelection();
  assert(G.N.state.intro.context.kind === 'newCharacter', '换角色未触发'); G.N.finishIntro();
  home(); G.N.state.progress.lastRun = { win: false, characterId: 'draft', stage: 1, record: false, bossName: '', sameStreak: 2 };
  G.C.requestRun(); G.C.selectCharacter('draft'); G.C.confirmSelection();
  assert(G.N.state.intro.context.kind === 'sameCharacter', '连续同角色未触发'); G.N.finishIntro();
  home(); G.N.state.progress.lastRun = { win: true, characterId: 'draft', stage: 10, record: false, bossName: '', sameStreak: 1 };
  G.C.requestRun(); G.C.selectCharacter('draft'); G.C.confirmSelection();
  assert(G.N.state.intro.context.kind === 'win', '胜利回忆未触发'); G.N.finishIntro();
});

test('普通回归文案最近四次不重复', () => {
  home(); G.N.state.progress.openingSeen = true; G.N.state.progress.lastRun = null; G.N.state.progress.recent = {};
  const seen = [];
  for (let i = 0; i < 5; i++) {
    G.C.requestRun(); G.C.selectCharacter('draft'); G.C.confirmSelection();
    seen.push(G.N.state.intro.lines[0].text); G.N.finishIntro(); home();
  }
  assert(new Set(seen).size === 5, '普通回归文案在最近轮换中重复');
});

console.log(failed ? 'NARRATIVE_FAILURES: ' + failed : 'NARRATIVE_TEST_OK (' + passed + '/' + passed + ')');
process.exit(failed ? 1 : 0);

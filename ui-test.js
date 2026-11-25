// 升级延迟与左右手触控布局回归
const src = ['battle-config.js', 'enemy-config.js', 'content-config.js', 'procedural-locomotion.js',
  'creature-designs.js', 'creature-bio-rig.js', 'creature-design-renderer.js',
  'biped-locomotion.js', 'biped-renderer.js', 'creature-game-runtime.js', 'main.js']
  .map(f => require('fs').readFileSync(__dirname + '/' + f, 'utf8').replace("'use strict';", '')).join('\n')
  .replace(/function isDesktopLayout\(\) \{[\s\S]*?\r?\n\}/, 'function isDesktopLayout() { return false; }');
const handlers = {};
const drawTexts = [], drawRects = [], drawArcs = [], drawStrokes = [];
const fakeCtx = new Proxy({}, { get(t, k) {
  if (k in t) return t[k];
  if (k === 'measureText') return text => ({ width: String(text).length * 10 });
  if (k === 'fillText') return (txt, x, y) => { drawTexts.push({ txt: String(txt), x, y, color: t.fillStyle, font: t.font, alpha: t.globalAlpha, shadowBlur: t.shadowBlur || 0 }); };
  if (k === 'fillRect') return (x, y, w, h) => { drawRects.push({ x, y, w, h, color: t.fillStyle }); };
  if (k === 'arc') return (x, y, r, start, end) => { drawArcs.push({ x, y, r, start, end, color: t.strokeStyle, width: t.lineWidth, alpha: t.globalAlpha === undefined ? 1 : t.globalAlpha }); };
  if (k === 'stroke') return () => { drawStrokes.push({ width: t.lineWidth, color: t.strokeStyle, shadowColor: t.shadowColor, alpha: t.globalAlpha === undefined ? 1 : t.globalAlpha }); };
  return () => {};
}, set(t, k, v) { t[k] = v; return true; } });
const fakeCanvas = {
  getContext: () => fakeCtx, width: 0, height: 0, style: {},
  addEventListener(type, fn) { handlers[type] = fn; },
  getBoundingClientRect: () => ({ left: 0, top: 0, width: 375, height: 667 })
};
global.window = { addEventListener() {}, devicePixelRatio: 1, innerWidth: 375, innerHeight: 667 };
global.document = { getElementById: () => fakeCanvas }; global.requestAnimationFrame = () => {};
eval(src + `
// 本套件专测移动布局；正式网页默认 PC，测试中显式切回触屏模式。
isDesktopLayout = () => false; resize();
;globalThis.G = {
  resetGame, applyOption, buildOptions, update, render, floatPopScale, floatIsFlashing, drawPlayerResources,
  layoutCards, drawCards, cardTypeLabel, cardTypeColor, cardRoleLabel, drawCardTypeBadge, drawCoreDamageZone, drawOuterSurgeDamageZone,
  spawnEnemy, drawMeleeTelegraph, enemySwingRange,
  get state() { return state; }, set state(v) { state = v; }, get player() { return player; }, get cards() { return cards; }, get enemies() { return enemies; },
  get cardRects() { return cardRects; }, get erupts() { return erupts; }, get novas() { return novas; }, get floats() { return floats; },
  set hitStop(v) { hitStopT = v; },
  get joy() { return joy; }, get levelupDelay() { return levelupDelayT; },
  get levelupPickAfter() { return levelupPickAfter; }, set levelupPickAfter(v) { levelupPickAfter = v; },
  get joyHome() { return JOY_HOME; }, get absorbRect() { return absorbRect; },
  get diveRect() { return diveRect; }, get specialRect() { return specialRect; }, get buildY() { return buildRect.y; },
  get cam() { return { x: camX, y: camY }; }, get view() { return { w: VIEW_W, h: VIEW_H }; },
  get bounds() { return { l: WORLD_L, r: WORLD_R, t: WORLD_T, b: WORLD_B }; }
};`);
let failed = 0;
function test(name, fn) { try { fn(); console.log('OK  ' + name); } catch (e) { failed++; console.log('ERR ' + name + ': ' + e.message); } }
function assert(ok, msg) { if (!ok) throw new Error(msg); }
function fresh() { G.resetGame(); G.applyOption(0); }
function pointer(type, id, x, y) { handlers[type]({ pointerId: id, clientX: x, clientY: y, preventDefault() {} }); }
function center(r) { return { x: r.x + r.w / 2, y: r.y + r.h / 2 }; }

test('经验满后等待 0.5 秒才弹出升级三选一', () => {
  fresh(); G.player.xp = G.player.xpNext;
  G.update(0.1);
  assert(G.state === 'play' && G.player.level === 1 && Math.abs(G.levelupDelay - 0.4) < 1e-8, '升级等待没有开始或提前弹窗');
  G.update(0.39);
  assert(G.state === 'play' && G.player.level === 1 && G.cards.length === 0, '0.5 秒未到就弹出选项');
  G.update(0.02);
  assert(G.state === 'levelup' && G.player.level === 2 && G.cards.length === 3, '等待结束后没有升级三选一');
  assert(G.levelupPickAfter - Date.now() > 400 && G.levelupPickAfter - Date.now() <= 500, '三选一没有设置 0.5 秒输入锁');
  assert(G.applyOption(0) === false && G.state === 'levelup' && G.cards.length === 3, '输入锁期间仍能选卡');
  drawTexts.length = 0; G.render();
  assert(drawTexts.some(t => t.txt === '0.5 秒后可选择'), '输入锁期间缺少不可选提示');
  G.levelupPickAfter = 0; G.applyOption(0);
  assert(G.state === 'play' && G.cards.length === 0, '输入锁结束后无法正常选卡');
});
test('墨潮蓄力暂停升级三选一，释放或取消后继续倒计时并弹出', () => {
  for (const end of ['pointerup', 'pointercancel']) {
    fresh(); G.player.special = 100; G.player.xp = G.player.xpNext;
    const p = center(G.specialRect), id = end === 'pointerup' ? 71 : 72;
    pointer('pointerdown', id, p.x, p.y); G.update(0.6);
    assert(G.player.surgeCharging && G.state === 'play' && G.player.level === 1 && G.levelupDelay === 0.5, end + ' 前蓄力仍被升级打断');
    G.update(0.5);
    assert(G.state === 'play' && G.cards.length === 0 && G.levelupDelay === 0.5, end + ' 前蓄力期间弹出了三选一或倒计时未暂停');
    pointer(end, id, p.x, p.y); G.update(0.49);
    assert(G.state === 'play' && G.player.level === 1, end + ' 后没有保留原有升级等待');
    G.update(0.02);
    assert(!G.player.surgeCharging && G.state === 'levelup' && G.player.level === 2 && G.cards.length === 3, end + ' 后没有继续升级三选一');
  }
});
test('恢复生命按 30% 概率替换构筑卡且不增加选项数量', () => {
  const oldRandom = Math.random;
  try {
    fresh(); Math.random = () => 0.31; G.buildOptions();
    assert(G.cards.length === 3 && !G.cards.some(c => c.kind === 'heal'), '未触发概率时仍出现恢复卡');
    Math.random = () => 0.29; G.buildOptions();
    assert(G.cards.length === 3 && G.cards.filter(c => c.kind === 'heal').length === 1, '恢复卡没有替换一个构筑槽或新增了选项');
    assert(G.cards.some(c => c.kind === 'heal' && c.typeLabel === '恢复' && c.tagColor === '#2f9e68'), '恢复卡标签或颜色错误');
    G.player.maxhp = 100; G.player.hp = 50; G.levelupPickAfter = 0;
    G.applyOption(G.cards.findIndex(c => c.kind === 'heal'));
    assert(G.player.hp === 80 && G.floats.some(f => f.txt === '+30'), '恢复卡没有正确回血 30%');
    fresh(); Math.random = () => 0.29; G.buildOptions(); G.player.maxhp = 100; G.player.hp = 90;
    G.applyOption(G.cards.findIndex(c => c.kind === 'heal'));
    assert(G.player.hp === 100, '恢复卡使生命超过上限');
  } finally { Math.random = oldRandom; }
});
test('普通角色在左侧识别区按下时，以触点作为浮动摇杆中心', () => {
  fresh(); const home = G.joyHome, startX = home.x + 15, startY = home.y - 12;
  pointer('pointerdown', 1, startX, startY);
  pointer('pointermove', 1, startX + 40, startY);
  assert(G.joy.active && G.joy.bx === startX && G.joy.by === startY && G.joy.dx > 0, '浮动摇杆没有以触点为中心响应拖动');
  G.update(0.016);
  assert(G.player.x > 0, '摇杆向右拖但角色没有向右移动');
  pointer('pointerup', 1, startX + 40, startY);
  assert(!G.joy.active && G.joy.dx === 0, '松开摇杆后仍保持移动输入');
});
test('普通角色右手空白区域不会抢走摇杆输入', () => {
  fresh(); pointer('pointerdown', 2, 195, 390);
  assert(!G.joy.active, '右侧空白区域错误启动了摇杆');
});
test('挂机者整个下半屏均可生成浮动摇杆，上半屏与养成按钮除外', () => {
  fresh(); G.player.characterId = 'idle';
  pointer('pointerdown', 20, 300, 300);
  assert(!G.joy.active, '挂机者上半屏错误启动了摇杆');
  pointer('pointerdown', 21, 300, 400);
  assert(G.joy.active && G.joy.bx === 300 && G.joy.by === 400, '挂机者右侧下半屏没有以触点生成摇杆');
  pointer('pointermove', 21, 335, 430);
  assert(G.joy.dx > 0 && G.joy.dy > 0, '挂机者浮动摇杆方向错误');
  pointer('pointerup', 21, 335, 430);
  pointer('pointerdown', 22, 187.5, G.buildY + 18);
  assert(!G.joy.active, '养成按钮被下半屏摇杆热区抢走');
});
test('保持左手移动时右手可以释放吸墨和潜墨', () => {
  fresh(); const home = G.joyHome;
  pointer('pointerdown', 1, home.x, home.y);
  let p = center(G.absorbRect); pointer('pointerdown', 2, p.x, p.y);
  assert(G.joy.active && G.player.absorbT > 0, '吸墨按钮与摇杆触点冲突');
  p = center(G.diveRect); pointer('pointerdown', 3, p.x, p.y);
  assert(G.joy.active && G.player.diving, '潜墨按钮与摇杆触点冲突');
});
test('右手墨潮按钮可独立长按蓄力、松开释放，三个按钮均在右半屏', () => {
  fresh(); G.player.special = 100;
  const p = center(G.specialRect); pointer('pointerdown', 4, p.x, p.y);
  assert(G.player.surgeCharging && G.player.special === 100, '按下墨潮没有蓄力或提前消耗资源');
  G.update(0.6); assert(Math.abs(G.player.surgeChargeT - 0.6) < 1e-8, '长按没有累计蓄力时间');
  pointer('pointerup', 4, p.x, p.y);
  assert(G.player.special === 0 && !G.player.surgeCharging, '松开墨潮按钮没有释放技能');
  assert(G.diveRect.y < G.absorbRect.y && G.diveRect.x === G.absorbRect.x, '潜墨与吸墨按钮没有上下互换');
  assert([G.absorbRect, G.diveRect, G.specialRect].every(r => r.x >= 187.5), '技能按钮未全部放在右半屏');
  assert(G.joyHome.x + G.joyHome.r < 187.5, '摇杆越过了左半屏');
  G.render();
});
test('角色位于四个场景角落时仍保持屏幕正中央', () => {
  fresh(); const b = G.bounds;
  for (const [x, y] of [[b.l + 14, b.t + 14], [b.r - 14, b.t + 14], [b.l + 14, b.b - 14], [b.r - 14, b.b - 14]]) {
    G.player.x = x; G.player.y = y; G.update(0);
    assert(Math.abs(G.player.x - G.cam.x - G.view.w / 2) < 1e-8, '水平方向没有居中：' + x + ',' + y);
    assert(Math.abs(G.player.y - G.cam.y - G.view.h / 2) < 1e-8, '垂直方向没有居中：' + x + ',' + y);
  }
});
test('长按选择、系统菜单与浏览器缩放手势均被阻止', () => {
  fresh();
  for (const type of ['contextmenu', 'selectstart', 'dragstart', 'gesturestart', 'gesturechange', 'gestureend', 'touchmove']) {
    assert(typeof handlers[type] === 'function', type + ' 没有防误触处理');
    let prevented = false; handlers[type]({ preventDefault() { prevented = true; } });
    assert(prevented, type + ' 没有阻止浏览器默认行为');
  }
});
test('左手保持摇杆时右手长按墨潮，松开技能不影响移动触点', () => {
  fresh(); G.player.special = 100; const home = G.joyHome;
  pointer('pointerdown', 1, home.x, home.y); pointer('pointermove', 1, home.x + 35, home.y);
  const p = center(G.specialRect); pointer('pointerdown', 4, p.x, p.y); G.update(0.6);
  assert(G.joy.active && G.joy.dx > 0 && G.player.surgeCharging, '双指时长按墨潮打断摇杆');
  pointer('pointerup', 4, p.x, p.y);
  assert(G.joy.active && G.joy.dx > 0 && !G.player.surgeCharging && G.player.special === 0, '松开墨潮影响摇杆或未释放技能');
  pointer('pointerup', 1, home.x + 35, home.y);
});
test('跳字两帧长到 2 倍，闪白延长一帧后恢复并回缩', () => {
  const f = { t: 0.8 };
  assert(G.floatPopScale(f) === 1.5 && G.floatIsFlashing(f), '跳字初始不是 1.5 倍或没有闪白');
  f.t = f.maxT - 1 / 60;
  assert(Math.abs(G.floatPopScale(f) - 1.75) < 1e-8, '第一帧没有展示到 1.75 倍');
  f.t = f.maxT - 2 / 60;
  assert(Math.abs(G.floatPopScale(f) - 2) < 1e-8, '第二帧没有长到 2 倍');
  f.t = f.maxT - (2 / 60 + 0.06);
  assert(Math.abs(G.floatPopScale(f) - 1.625) < 1e-8 && G.floatIsFlashing(f), '跳字回缩曲线或延长后的闪白窗口错误');
  f.t = f.maxT - 0.1;
  assert(!G.floatIsFlashing(f), '闪白超过增加一帧后的时长仍未结束');
  f.t = 0;
  assert(G.floatPopScale(f) === 1.5, '跳字稳定尺寸不是 1.5 倍');
});
test('触屏按钮不显示快捷键，辅助与装备折叠且紧跟技能列表', () => {
  fresh(); G.player.special = 100; drawTexts.length = 0; drawRects.length = 0; G.render();
  const texts = drawTexts.map(t => t.txt);
  for (const label of ['弹反', '长按', '位移']) assert(texts.includes(label), '按钮缺少文字：' + label);
  for (const forbidden of ['弹反 · E', '长按 · Q', '位移 · 空格', 'E 吸墨弹反 · 空格潜墨']) {
    assert(!texts.includes(forbidden), '按钮仍显示快捷键：' + forbidden);
  }
  assert(!texts.some(t => t.startsWith('墨水 ') || /^墨潮 \d/.test(t)), '右下角仍重复显示资源信息');
  assert(G.absorbRect.y === 510 && G.absorbRect.h === 64 && G.specialRect.y === 510 && G.diveRect.y === 446, '按钮布局或吸墨向下扩展错误');
  const skills = drawTexts.filter(t => t.x === 16 && t.y === 70);
  const equipment = drawTexts.filter(t => t.x === 16 && /^装备 \d+\/5$/.test(t.txt));
  assert(skills.length > 0 && equipment.length === 1 && equipment[0].y > skills[skills.length - 1].y, '折叠装备没有紧跟技能列表');
  assert(texts.some(t => /^辅 \d+\/4$/.test(t)) && !texts.some(t => t.startsWith('[头]')), '辅助或装备仍展开显示');
  assert(!drawRects.some(r => r.x === 10 && r.y === 58), '技能和装备仍有白色背景板');
  assert([...skills, ...equipment].every(t => t.shadowBlur === 4), '技能和装备文字缺少浅色阴影');
});
test('角色血量与墨量使用整圆三分之一的细圆弧，并按比例绘制', () => {
  fresh(); G.player.x = 12; G.player.y = 34;
  G.player.hp = 50; G.player.maxhp = 100; G.player.ink = 25; G.player.maxInk = 100;
  drawArcs.length = 0; G.drawPlayerResources();
  assert(drawArcs.length === 4, '双资源圆弧及其底色数量错误');
  assert(drawArcs.every(a => a.x === 12 && a.y === 38 && Math.abs(a.start - Math.PI / 6) < 1e-8 && a.end <= Math.PI * 5 / 6 && a.width <= 2.8), '120° 圆弧位置、方向或线宽错误');
  const hp = drawArcs.find(a => a.color === '#c0392b'), ink = drawArcs.find(a => a.color === '#1a2b8f');
  assert(hp && hp.r === 28 && hp.width === 1.6 && Math.abs(hp.end - Math.PI / 2) < 1e-8, '50% 血量圆弧终点错误');
  assert(ink && ink.r === 23 && ink.width === 1.4 && Math.abs(ink.end - Math.PI / 3) < 1e-8, '25% 墨量圆弧终点错误');
});
test('三选一主说明最多两行，补充机制灰字显示且无详情按钮', () => {
  fresh(); G.cards.length = 0;
  G.cards.push(
    { kind: 'active+', skill: 'cyclone', tag: '[强化]', tagColor: '#6c4da1', name: '长描述测试', desc: '这是一段用于验证自动换行的超长词条描述，必须在卡片内部完整显示并且不能超出边界或遮挡选择提示。' },
    { tag: '[被动]', tagColor: '#333', name: '普通词条', desc: '普通长度描述' },
    { tag: '[主动]', tagColor: '#1a2b8f', name: '另一个词条', desc: '另一个普通描述' }
  );
  G.layoutCards(3); drawTexts.length = 0; drawRects.length = 0; G.drawCards('测试');
  const r = G.cardRects[0], lines = G.cards[0].descLines, details = G.cards[0].detailLines;
  assert(drawRects[0] && drawRects[0].color === 'rgba(245,241,230,0.78)', '三选一背景遮罩不足，战斗信息容易干扰阅读');
  assert(drawRects.some(rect => rect.x === r.x && rect.y === r.y && rect.color === 'rgba(255,250,238,0.94)'), '卡片底色不够不透明');
  assert(G.cards[0].typeLabel === '升级' && G.cards[0].tagColor === '#d77b24', '主动升级标签或颜色错误');
  assert(lines.length === 2 && details.length > 0 && r.h === 94 + 12 + details.length * 12, '主说明、补充说明或卡片高度错误');
  assert(lines.every(line => line.length * 10 <= r.w - 32), '换行后的描述仍超出卡片宽度');
  const firstLine = drawTexts.find(t => t.txt === lines[0] && t.font.startsWith('12px'));
  assert(firstLine && firstLine.y - 12 >= r.y + 11 + 46 + 8, '主说明与技能图标之间不足 8px 间距');
  const lastY = r.y + 50 + 12 + (lines.length - 1) * 14;
  assert(lastY <= r.y + r.h - 25, '描述末行压到卡片底部选择提示');
  const lastDetailY = r.y + 51 + 12 + lines.length * 14 + (details.length - 1) * 12;
  assert(lastDetailY <= r.y + r.h - 22, '补充说明末行压到卡片底部选择提示');
  assert(!drawTexts.some(t => t.txt === G.cards[0].desc), '绘制时仍把长描述作为单行输出');
  lines.forEach(line => assert(drawTexts.some(t => t.txt === line && t.x === r.x + 16), '换行文本没有实际绘制：' + line));
  details.forEach(line => assert(drawTexts.some(t => t.txt === line && t.font.startsWith('10px')), '灰字补充说明没有实际绘制：' + line));
  assert(!drawTexts.some(t => t.txt === '详情'), '三选一仍显示详情按钮');
});
test('五类大标签置于卡片顶部，原技能定位保留为小标签', () => {
  const cases = [
    [{ kind: 'start', id: 'cyclone' }, '新主动', '#1a2b8f', '主动 · 打击 / 范围'],
    [{ kind: 'active', id: 'cola' }, '新主动', '#1a2b8f', '主动 · 范围'],
    [{ kind: 'support', skill: 'cyclone', sup: 'brutal' }, '新辅助', '#6c3483', '辅助 · 通用'],
    [{ kind: 'active+', skill: 'cyclone', tag: '[形态进化]' }, '升级', '#d77b24', '主动 · 打击 / 范围'],
    [{ kind: 'support+', skill: 'cola', sup: 'multi' }, '升级', '#d77b24', '辅助 · 子弹'],
    [{ kind: 'passive', tag: '[形态]' }, '升级', '#d77b24', '形态 · 专属'],
    [{ kind: 'opaffix', tag: '[墨潮辅助]' }, '升级', '#d77b24', '墨潮辅助 · 通用'],
    [{ kind: 'passive', tag: '[被动]' }, '通用', '#6b6b6b', '被动 · 通用'],
    [{ kind: 'passive', tag: '[护盾]' }, '通用', '#6b6b6b', '被动 · 护盾'],
    [{ kind: 'heal' }, '恢复', '#2f9e68', '恢复 · 生命']
  ];
  for (const [card, label, color, role] of cases) {
    assert(G.cardTypeLabel(card) === label, '选项大标签未正确收敛：' + card.kind + ' / ' + (card.tag || ''));
    assert(G.cardTypeColor(card) === color, '选项大标签颜色错误：' + label);
    assert(G.cardRoleLabel(card) === role, '原技能定位小标签错误：' + role);
  }
  assert(new Set(cases.map(entry => entry[1])).size === 5, '主标签数量不是五类');
  assert(G.cardTypeLabel({ kind: 'active', id: 'cyclone', acquire: true }) === '新主动 · 入库', '新主动入库状态缺失');
  assert(G.cardTypeLabel({ kind: 'support', skill: 'cyclone', sup: 'brutal', acquire: true }) === '新辅助 · 入库', '新辅助入库状态缺失');
  G.cards.length = 0;
  G.cards.push({ kind: 'active', id: 'cyclone', tagColor: '#000000', name: '连笔蜡笔', desc: '测试' });
  G.layoutCards(1);
  assert(G.cards[0].typeLabel === '新主动' && G.cards[0].roleLabel === '主动 · 打击 / 范围' && G.cards[0].tagColor === '#1a2b8f', '卡片布局未同步大小标签与颜色');
  const rect = G.cardRects[0];
  drawTexts.length = 0;
  const badge = G.drawCardTypeBadge(G.cards[0], rect);
  assert(badge.y < rect.y && badge.y + badge.h > rect.y, '大标签没有跨放在卡片顶边上');
  assert(Math.abs(badge.x + badge.w / 2 - rect.x - rect.w / 2) < 1e-8, '大标签没有水平居中');
  assert(drawTexts.some(t => t.txt === '新主动' && t.font.startsWith('bold 13px')), '顶部大标签没有使用醒目字号');
  drawTexts.length = 0; G.drawCards('测试');
  assert(drawTexts.some(t => t.txt === '新主动') && drawTexts.some(t => t.txt === '主动 · 打击 / 范围'), '实际卡片没有同时绘制大标签与定位小标签');
});
test('竖屏四选一紧凑居中且避开养成，普通三选一宽度不变', () => {
  fresh(); G.cards.length = 0;
  for (let i = 0; i < 4; i++) G.cards.push({ kind: 'heal', tagColor: '#2f9e68', name: '恢复生命', desc: '立即恢复 30% 最大生命值' });
  G.layoutCards(4);
  assert(G.cardRects.every(r => r.w === 230 && Math.abs(r.x + r.w / 2 - 187.5) < 1e-8), '四选一卡片未按 230 宽度居中');
  assert(G.cards.every(c => c.descLines.every(line => line.length * 10 <= 198)), '四选一描述没有按收窄后的宽度换行');
  const last = G.cardRects[G.cardRects.length - 1];
  assert(last.y + last.h <= 593, '四选一仍进入养成按钮区域：' + (last.y + last.h));
  G.cards.length = 0;
  for (let i = 0; i < 3; i++) G.cards.push({ kind: 'heal', tagColor: '#2f9e68', name: '恢复生命', desc: '立即恢复 30% 最大生命值' });
  G.layoutCards(3);
  assert(G.cardRects.every(r => r.w === 280 && r.x === 47), '普通三选一卡片宽度被意外修改');
});
test('最长三选一收窄后仍为刷新按钮和养成预留间距', () => {
  fresh(); G.state = 'levelup'; G.player.characterId = 'draft'; G.cards.length = 0;
  window.CharacterRuntime = global.CharacterRuntime = { hasRerolls: () => true };
  try {
    for (let i = 0; i < 3; i++) G.cards.push({ kind: 'active+', skill: 'cyclone', tag: '[强化]', tagColor: '#6c4da1', name: '长描述测试', desc: '这是一段用于验证自动换行的超长词条描述，必须在卡片内部完整显示并且不能超出边界或遮挡选择提示。' });
    G.layoutCards(3);
    const last = G.cardRects[G.cardRects.length - 1];
    const total = last.y + last.h - G.cardRects[0].y;
    assert(total <= 430, '三选一双标签布局总高度超出预算：' + total);
    assert(last.y + last.h <= 536, '最长卡片进入刷新按钮预留区域：' + (last.y + last.h));
    assert(last.y + last.h + 12 + 38 <= 593, '刷新按钮与养成按钮间距不足');
  } finally { delete window.CharacterRuntime; delete global.CharacterRuntime; }
});
test('圆心与墨潮外圈增伤标注严格对应 50% 和 70% 半径', () => {
  fresh(); drawArcs.length = 0; drawTexts.length = 0;
  G.drawCoreDamageZone(12, 34, 80, { core: 0.3, col: '#1a2b8f' });
  assert(drawArcs.some(a => a.x === 12 && a.y === 34 && a.r === 40), '圆心增伤内圈不是区域半径的 50%');
  assert(drawTexts.some(t => t.txt === '圆心增伤 +30%'), '缺少圆心增伤数值标注');
  G.drawOuterSurgeDamageZone(12, 34, 100);
  assert(drawArcs.some(a => a.x === 12 && a.y === 34 && a.r === 70), '墨潮外圈内边界不是半径的 70%');
  assert(drawTexts.some(t => t.txt === '外圈增伤 +50%'), '缺少墨潮外圈增伤标注');
});
test('区域技能与墨潮新星在实际渲染中调用增伤范围标注', () => {
  fresh();
  G.erupts.push({ x: 12, y: 34, r: 80, c: { core: 0.3, col: '#1a2b8f' }, done: false, delay: 0, t: 0 });
  G.novas.push({ x: 12, y: 34, t: 0.35, max: 100, col: '#1a2b8f', outerDamage: true });
  drawArcs.length = 0; drawTexts.length = 0; G.render();
  assert(drawArcs.some(a => a.r === 40) && drawArcs.some(a => a.r === 70), '实际战斗渲染缺少增伤边界');
  assert(drawTexts.some(t => t.txt === '圆心增伤 +30%') && drawTexts.some(t => t.txt === '外圈增伤 +50%'), '实际战斗渲染缺少增伤文字');
});
test('近战预警外圈低于半透，生成打击后才恢复高亮', () => {
  fresh(); G.spawnEnemy('stick', 100, 0); const e = G.enemies[G.enemies.length - 1];
  e.swingT = 0.3; drawStrokes.length = 0; G.drawMeleeTelegraph(e);
  const warning = drawStrokes.find(s => s.width === 1.8);
  assert(warning && warning.alpha <= 0.38, '未生成打击时外圈仍过于醒目');
  e.swingT = 0.1; drawStrokes.length = 0; G.drawMeleeTelegraph(e);
  const active = drawStrokes.find(s => Math.abs(s.width - 3) < 1e-8);
  assert(active && active.alpha === 0.8 && warning.alpha < active.alpha * 0.5, '打击生成后没有与预警外圈形成明显区分');
});
test('吸墨按钮向下延伸后的底部区域仍可触发弹反', () => {
  fresh(); const r = G.absorbRect;
  pointer('pointerdown', 8, r.x + r.w / 2, r.y + r.h - 3);
  assert(G.player.absorbT > 0, '向下新增的触控区域没有响应');
});
test('选词与弹反无敌显示金色描边，真实受击不显示金光', () => {
  fresh(); G.player.goldT = 1; drawStrokes.length = 0; G.render();
  assert(drawStrokes.some(s => s.color === '#d8a64b' && s.shadowColor === '#d8a64b'), '选词保护没有金色描边');
  G.player.goldT = 0; G.hitStop = 0.3; drawStrokes.length = 0; G.render();
  assert(drawStrokes.some(s => s.color === '#d8a64b'), '弹反保护没有金色描边');
  G.hitStop = 0; G.player.hurtT = 0.5; drawStrokes.length = 0; G.render();
  assert(!drawStrokes.some(s => s.color === '#d8a64b'), '真实受击仍被画成金色保护');
});
test('跳字闪白延长一帧，结束后恢复原色并保留原色光晕', () => {
  fresh(); const f = { x: 0, y: 0, txt: '99', t: 0.7, color: '#1a2b8f' }; G.floats.push(f);
  drawTexts.length = 0; G.render(); let text = drawTexts.find(t => t.txt === '99');
  assert(text && text.color === '#ffffff' && text.shadowBlur === 5, '跳字首帧没有白色闪光和原色光晕');
  f.t = f.maxT - 0.09; drawTexts.length = 0; G.render(); text = drawTexts.find(t => t.txt === '99');
  assert(text && text.color === '#ffffff', '原闪白结束后额外一帧没有保持白色');
  f.t = f.maxT - 0.1; drawTexts.length = 0; G.render(); text = drawTexts.find(t => t.txt === '99');
  assert(text && text.color === '#1a2b8f', '延长闪白结束后没有恢复原色');
});
test('墨迹持续伤害跳字使用低透小字且不闪白', () => {
  fresh(); G.floats.push({ x: 0, y: 0, txt: '2', t: 0.7, color: '#1a2b8f', weak: true });
  drawTexts.length = 0; G.render(); const text = drawTexts.find(t => t.txt === '2');
  assert(text && text.color === '#1a2b8f' && text.shadowBlur === 0, '持续伤害跳字仍闪白或带光晕');
  assert(text.font.startsWith('10px') && Math.abs(text.alpha - 0.58) < 1e-8, '持续伤害跳字没有使用低透小字');
});
console.log(failed ? 'UI_TEST_FAILURES: ' + failed : 'UI_TEST_OK (23/23)');
process.exit(failed ? 1 : 0);

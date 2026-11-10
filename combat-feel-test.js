// 打击感专项：反馈分级、方向化笔触、局部顿帧、核心操作与实体上限
const fs = require('fs');
const src = ['battle-config.js', 'enemy-config.js', 'content-config.js', 'main.js', 'build-runtime.js',
  'hades-runtime.js', 'hades-weapons-runtime.js', 'weapon-passives-expansion.js',
  'support-expansion-runtime.js', 'dive-counter-runtime.js', 'combat-feel-runtime.js']
  .map(f => fs.readFileSync(__dirname + '/' + f, 'utf8').replace("'use strict';", '')).join('\n');
const drawTexts = [];
const fakeCtx = new Proxy({}, { get(t, k) {
  if (k in t) return t[k];
  if (k === 'measureText') return txt => ({ width: String(txt).length * 10 });
  if (k === 'fillText') return txt => { drawTexts.push(String(txt)); };
  return () => {};
}, set(t, k, v) { t[k] = v; return true; } });
const handlers = {};
const fakeCanvas = {
  getContext: () => fakeCtx, width: 0, height: 0, style: {},
  addEventListener(type, fn) { (handlers[type] || (handlers[type] = [])).push(fn); },
  getBoundingClientRect: () => ({ left: 0, top: 0, width: 375, height: 667 })
};
const stored = Object.create(null);
global.localStorage = { getItem: k => stored[k] || null, setItem: (k, v) => { stored[k] = v; } };
global.window = { addEventListener() {}, devicePixelRatio: 1, innerWidth: 375, innerHeight: 667 };
global.document = { getElementById: () => fakeCanvas }; global.requestAnimationFrame = () => {};
eval(src + `
;globalThis.G = {
  resetGame, update, render, hurtEnemy, killEnemy, spawnEnemy, chargeParry, castInkSurge,
  get player() { return player; }, get enemies() { return enemies; }, get F() { return CombatFeelRuntime; },
  get state() { return state; }, set state(v) { state = v; }, get D() { return DiveCounterRuntime; }
};`);
let failed = 0, passed = 0;
function test(name, fn) { try { fn(); passed++; console.log('OK  ' + name); } catch (e) { failed++; console.log('ERR ' + name + ': ' + e.stack.split('\n')[0]); } }
function assert(ok, msg) { if (!ok) throw new Error(msg); }
function fresh() {
  G.resetGame(); G.state = 'play'; G.player.xpNext = 999999; G.player.hp = G.player.maxhp = 9999;
  G.player.actives = [];
}
function target(hp = 9999) {
  G.spawnEnemy('stick', 100, 0); const e = G.enemies[G.enemies.length - 1];
  e.hp = e.maxhp = hp; e.stunT = 0; e.r = 12; e.kbx = e.kby = 0; return e;
}
function hit(e, skill = 'tornado', weak = false) { G.hurtEnemy(e, 10, 0, 0, 0, 0, 0, 0, '#1a2b8f', weak, skill); }

test('普通命中生成方向化爆点，但不触发局部顿帧或镜头冲击', () => {
  fresh(); const e = target(); hit(e, 'tornado');
  assert(G.F.impacts.length === 1 && G.F.impacts[0].family === 'pierce', '普通穿刺命中没有对应笔触');
  assert(!(e.impactFreezeT > 0) && G.F.cameraKicks.length === 0, '普通命中错误触发重击反馈');
  assert(Number.isFinite(e.impactAngle) && e.impactT > 0, '命中方向或轮廓反馈缺失');
});

test('暴击与重击只冻结受击怪物，冻结结束后恢复移动', () => {
  fresh(); G.player.crit = 1; const e = target(); hit(e, 'tornado');
  assert(Math.abs(e.impactFreezeT - G.F.config.critFreeze) < 1e-8, '暴击没有使用局部顿帧');
  assert(G.F.cameraKicks.length === 1, '暴击没有轻镜头冲击');
  const walk = e.walk; G.update(0.016);
  assert(e.walk === walk, '局部顿帧期间怪物 AI 与步态仍然推进');
  G.update(0.05); assert(e.walk !== walk, '局部顿帧结束后怪物 AI 没有恢复');
});

test('持续伤害不叠加爆点、顿帧和震屏', () => {
  fresh(); const e = target(); hit(e, 'candle', true); hit(e, 'inkrain', true);
  assert(G.F.impacts.length === 0 && G.F.cameraKicks.length === 0, '持续伤害错误触发重反馈');
  assert(!(e.impactFreezeT > 0), '持续伤害错误停顿怪物');
});

test('斩击、穿刺、爆炸和持续攻击具有独立反馈分类', () => {
  assert(G.F.familyOf('pageslash') === 'slash', '斩击分类错误');
  assert(G.F.familyOf('piercerush') === 'pierce', '穿刺分类错误');
  assert(G.F.familyOf('inkgrenade') === 'blast', '爆炸分类错误');
  assert(G.F.familyOf('candle') === 'sustain', '持续分类错误');
  fresh(); const e = target(); hit(e, 'inkgrenade');
  assert(G.F.impacts[0].family === 'blast' && e.impactFreezeT > 0, '爆炸重击没有升级反馈');
});

test('击杀生成纸屑，精英与Boss使用分级镜头反馈', () => {
  fresh(); const e = target(1); hit(e, 'tornado');
  assert(e.dead && G.F.deaths.length === 1 && G.F.deaths[0].bits.length === 6, '普通击杀没有纸屑收束');
  assert(G.F.cameraKicks.length === 0, '普通击杀错误震屏');
  const elite = target(1); elite.elite = true; G.killEnemy(elite);
  assert(G.F.deaths[1].bits.length === 9 && G.F.cameraKicks.length === 1, '精英击杀反馈没有升级');
});

test('弹反成功只生成一次交叉格挡线', () => {
  fresh(); G.chargeParry(); G.chargeParry();
  const parries = G.F.impacts.filter(f => f.kind === 'parry');
  assert(parries.length === 2 && parries.every(f => f.r >= 65), '弹反交叉格挡线数量或范围错误');
  assert(G.F.cameraKicks.every(k => k.zoom > 0), '弹反缺少短促镜头回弹');
});

test('精准潜墨在真实成功状态出现后触发一次排线波', () => {
  fresh(); G.player.diving = true; G.player.preciseDiveWindowT = G.D.WINDOW; G.player.preciseDiveUsed = false;
  assert(G.D.trigger(), '精准潜墨没有成功触发'); G.update(0.001);
  assert(G.F.impacts.filter(f => f.kind === 'dive').length === 1, '精准潜墨排线波没有生成或重复生成');
  G.update(0.001); assert(G.F.impacts.filter(f => f.kind === 'dive').length === 1, '精准潜墨后续帧重复反馈');
});

test('墨潮释放生成外扩余波，蓄力与释放音效入口安全', () => {
  fresh(); G.player.special = 100;
  assert(G.castInkSurge(150, true), '墨潮释放失败');
  assert(G.F.impacts.some(f => f.kind === 'surge' && f.r === 150), '墨潮余波范围与实际释放不一致');
  assert(G.F.cameraKicks.some(k => k.shake > 0), '墨潮缺少分级镜头反馈');
});

test('高频命中与连续击杀的特效、纸屑和镜头事件均有硬上限', () => {
  fresh(); const e = target(999999);
  for (let i = 0; i < 240; i++) { G.player.crit = i % 9 === 0 ? 1 : 0; hit(e, i % 2 ? 'pageslash' : 'tornado'); }
  assert(G.F.impacts.length <= G.F.config.maxImpacts, '命中特效池越界');
  assert(G.F.cameraKicks.length <= G.F.config.maxCameraKicks, '镜头冲击池越界');
  for (let i = 0; i < 70; i++) G.killEnemy(target(1));
  assert(G.F.deaths.length <= G.F.config.maxDeaths, '死亡纸屑池越界');
  const cam = G.F.cameraOffset(); assert(Math.hypot(cam.x, cam.y) <= 4.00001, '镜头位移叠加越界');
});

test('全部反馈同屏渲染不报错，静音设置可持久化', () => {
  G.render();
  const before = G.F.muted; G.F.toggleMute();
  assert(stored['notebook-muted'] === (G.F.muted ? '1' : '0'), '静音状态没有持久化');
  assert(G.F.muted !== before, '静音开关没有生效');
  G.render();
});

console.log('COMBAT_FEEL_TEST_' + (failed ? 'FAILED' : 'OK') + ' (' + passed + '/' + (passed + failed) + ')');
if (failed) process.exit(1);

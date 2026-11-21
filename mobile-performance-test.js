// 手机渲染分辨率、墨迹轨迹采样、怪物缓存与自动画质分级回归
const src = ['battle-config.js', 'enemy-config.js', 'content-config.js', 'procedural-locomotion.js',
  'creature-designs.js', 'creature-bio-rig.js', 'creature-design-renderer.js',
  'biped-locomotion.js', 'biped-renderer.js', 'creature-game-runtime.js', 'main.js']
  .map(f => require('fs').readFileSync(__dirname + '/' + f, 'utf8').replace("'use strict';", '')).join('\n');
let mainDrawImages = 0, inkUploads = 0;
function makeCtx(main) {
  return new Proxy({}, {
    get(t, k) {
      if (k === 'measureText') return () => ({ width: 10 });
      if (k === 'createImageData') return (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) });
      if (k === 'putImageData') return () => { inkUploads++; };
      if (k === 'drawImage' && main) return () => { mainDrawImages++; };
      return () => {};
    },
    set() { return true; }
  });
}
function makeCanvas(main = false) {
  const context = makeCtx(main);
  return {
    width: 0, height: 0, style: {}, getContext: () => context,
    addEventListener() {}, getBoundingClientRect: () => ({ left: 0, top: 0, width: 375, height: 667 })
  };
}
const mainCanvas = makeCanvas(true);
global.window = {
  addEventListener() {}, devicePixelRatio: 3, innerWidth: 375, innerHeight: 667,
  matchMedia: () => ({ matches: true })
};
global.document = { getElementById: () => mainCanvas, createElement: () => makeCanvas(false) };
global.requestAnimationFrame = () => {};
eval(src + `
;globalThis.G = {
  resetGame, applyOption, spawnEnemy, drawEnemy, shouldUseEnemySprite, render, resize,
  setRenderQuality, updateAdaptiveQuality, perfStats, addLinkedTrail, addInkStroke, flushInkRegions, shouldSkipRender,
  get renderQuality() { return renderQuality; }, get viewScale() { return viewScale; },
  get player() { return player; }, get enemies() { return enemies; },
  get cacheSize() { return enemySpriteCache.size; }, set state(v) { state = v; },
  set renderFrame(v) { renderFrame = v; },
  resetQualityTimers() { qualityBadT = 0; qualityGoodT = 0; }
};`);
let failed = 0;
function test(name, fn) { try { fn(); console.log('OK  ' + name); } catch (e) { failed++; console.log('ERR ' + name + ': ' + e.stack.split('\n')[0]); } }
function assert(ok, msg) { if (!ok) throw new Error(msg); }
function fresh() {
  G.resetGame(); G.applyOption(0); G.player.level = 61; // 第 7 关上限 80，允许构造 71 只怪物的性能场景
  G.player.xpNext = 999999; G.player.hp = G.player.maxhp = 9999;
  G.resetQualityTimers(); G.flushInkRegions();
}
function farEnemy(type = 'stick') { G.spawnEnemy(type, 250, 250); const e = G.enemies[G.enemies.length - 1]; e.flash = e.squash = e.ink = e.dotT = e.shotWindup = 0; return e; }

test('高分屏手机按画质档限制 DPR 为 1.5、1.25、1', () => {
  fresh(); G.setRenderQuality(0); G.resize(); assert(G.perfStats.dpr === 1.5, '手机默认 DPR 不是 1.5');
  G.setRenderQuality(1); assert(G.perfStats.dpr === 1.25, '中档 DPR 不是 1.25');
  G.setRenderQuality(2); assert(G.perfStats.dpr === 1, '低档 DPR 不是 1');
});

test('墨迹轨迹累计距离后补画，静止时不重复上传画布', () => {
  fresh(); const owner = { trailX: 0, trailY: 0, trailS: null, sourceId: 9001 };
  let before = inkUploads;
  G.addLinkedTrail(owner, 10, 0, '#9a8872', true, 12, 1.5, 12, 'trailX', 'trailY', 'trailS');
  assert(inkUploads === before && owner.trailX === 0 && owner.trailS.x === 10, '未到距离阈值仍重复铺墨');
  G.addLinkedTrail(owner, 14, 0, '#9a8872', true, 12, 1.5, 12, 'trailX', 'trailY', 'trailS');
  assert(inkUploads === before && owner.trailX === 14, '轨迹尚未合并到渲染前提交');
  G.flushInkRegions();
  assert(inkUploads === before + 2, '累计距离后没有提交完整轨迹');
  before = inkUploads;
  for (let i = 0; i < 60; i++) G.addLinkedTrail(owner, 14, 0, '#9a8872', true, 12, 1.5, 12, 'trailX', 'trailY', 'trailS');
  G.flushInkRegions();
  assert(inkUploads === before, '静止轨迹仍逐帧上传画布');
  G.addLinkedTrail(owner, 20, 0, '#9a8872', true, 12, 1.5, 12, 'trailX', 'trailY', 'trailS');
  G.addLinkedTrail(owner, 27, 0, '#9a8872', true, 12, 1.5, 12, 'trailX', 'trailY', 'trailS');
  G.flushInkRegions();
  assert(inkUploads === before + 2 && owner.trailX === 27 && owner.trailS.x === 27, '短距离累计或笔端同步错误');
});

test('同帧多段轨迹按墨迹层合并为一次脏矩形上传', () => {
  fresh(); const before = inkUploads;
  for (let i = 0; i < 6; i++) G.addInkStroke(i * 30, -40, i * 30 + 20, 40, '#9a8872', true, 9100 + i);
  assert(inkUploads === before, '每条轨迹仍立即上传画布');
  G.flushInkRegions();
  assert(inkUploads === before + 2, '同帧轨迹没有按两个墨迹层合并上传');
  G.flushInkRegions();
  assert(inkUploads === before + 2, '无脏区域时仍重复上传画布');
});

test('怪物密集时远处普通怪使用并复用缓存动作帧', () => {
  fresh(); G.setRenderQuality(0); let e; for (let i = 0; i < 71; i++) e = farEnemy();
  assert(G.shouldUseEnemySprite(e), '71 只怪物时远处普通怪未启用缓存');
  const before = mainDrawImages; G.drawEnemy(e); G.drawEnemy(e);
  assert(mainDrawImages === before + 2, '缓存怪物没有通过 drawImage 绘制');
  assert(G.cacheSize === 1, '相同动作帧没有复用缓存');
});

test('近身、精英、Boss 和攻击预警保留完整绘制', () => {
  fresh(); G.setRenderQuality(1); const e = farEnemy();
  assert(G.shouldUseEnemySprite(e), '降级后远怪仍未缓存');
  e.x = 50; e.y = 0; assert(!G.shouldUseEnemySprite(e), '近身怪被错误简化');
  e.x = 250; e.y = 250; e.elite = true; assert(!G.shouldUseEnemySprite(e), '精英被错误简化');
  e.elite = false; e.boss = true; assert(!G.shouldUseEnemySprite(e), 'Boss 被错误简化');
  e.boss = false; e.shotWindup = 0.2; assert(!G.shouldUseEnemySprite(e), '攻击预警被错误简化');
});

test('持续高帧耗时自动降两级，怪物减少后逐档恢复', () => {
  fresh(); G.setRenderQuality(0); for (let i = 0; i < 50; i++) farEnemy();
  G.perfStats.frameMs = 30; G.updateAdaptiveQuality(0.6); G.updateAdaptiveQuality(0.6);
  assert(G.renderQuality === 1, '卡顿后没有降到中档');
  G.perfStats.frameMs = 30; G.updateAdaptiveQuality(0.6); G.updateAdaptiveQuality(0.6);
  assert(G.renderQuality === 2, '持续卡顿没有降到低档');
  G.enemies.splice(0); farEnemy(); G.perfStats.frameMs = 16;
  for (let i = 0; i < 380; i++) G.updateAdaptiveQuality(0.016);
  assert(G.renderQuality === 1, '怪物减少后没有恢复到中档');
  for (let i = 0; i < 380; i++) G.updateAdaptiveQuality(0.016);
  assert(G.renderQuality === 0, '持续流畅后没有恢复到高档');
});

test('怪物较少但墨迹或弹幕造成高帧耗时时也自动降档', () => {
  fresh(); G.setRenderQuality(0); for (let i = 0; i < 10; i++) farEnemy();
  for (let i = 0; i < 2; i++) { G.perfStats.frameMs = 30; G.updateAdaptiveQuality(0.6); }
  assert(G.renderQuality === 1, '怪少时高帧耗时没有触发降档');
  for (let i = 0; i < 2; i++) { G.perfStats.frameMs = 30; G.updateAdaptiveQuality(0.6); }
  assert(G.renderQuality === 2, '怪少时持续卡顿没有降到低档');
});

test('低画质在严重卡顿时也能隔帧渲染，非战斗界面不跳帧', () => {
  fresh(); G.setRenderQuality(2); G.state = 'play';
  G.renderFrame = 1; assert(G.shouldSkipRender(), '低画质奇数帧没有跳过渲染');
  G.renderFrame = 2; assert(!G.shouldSkipRender(), '低画质偶数帧没有正常渲染');
  G.state = 'pause'; G.renderFrame = 1; assert(!G.shouldSkipRender(), '暂停界面被错误跳帧');
});

console.log(failed ? 'MOBILE_PERFORMANCE_TEST_FAILURES: ' + failed : 'MOBILE_PERFORMANCE_TEST_OK (8/8)');
process.exit(failed ? 1 : 0);

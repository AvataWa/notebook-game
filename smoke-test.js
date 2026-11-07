// 无头冒烟测试：模拟一整局 10 关 100 波，验证关卡制 + Boss 链 + 胜利条件
const src = require('fs').readFileSync(__dirname + '/enemy-config.js', 'utf8') + '\n' + require('fs').readFileSync(__dirname + '/main.js', 'utf8').replace("'use strict';", '');

const fakeCtx = new Proxy({}, {
  get(t, k) {
    if (k === 'measureText') return () => ({ width: 10 });
    return () => {};
  },
  set() { return true; }
});
const fakeCanvas = {
  getContext: () => fakeCtx,
  width: 0, height: 0, style: {},
  addEventListener() {},
  getBoundingClientRect: () => ({ left: 0, top: 0, width: 375, height: 667 })
};
global.window = { addEventListener() {}, devicePixelRatio: 1, innerWidth: 375, innerHeight: 667 };
global.document = { getElementById: () => fakeCanvas };
global.requestAnimationFrame = () => {};

eval(src + `
;globalThis.G = {
  resetGame, applyOption, update, render,
  get state() { return state; }, get gameTime() { return gameTime; },
  get kills() { return kills; }, get player() { return player; },
  get cards() { return cards; }, get enemies() { return enemies; },
  get curStage() { return curStage; }, get hazards() { return hazards; },
  get ebullets() { return ebullets; }
};`);

G.resetGame();
G.applyOption(0);
const dt = 1 / 60;
let steps = 0, err = null;
const bossSeen = new Set();
let maxStage = 0, sawPhase2 = false, sawHazard = false, sawEbullet = false;
try {
  while (G.state !== 'win' && G.state !== 'over' && steps < 60 * 2400) {
    if (G.state === 'levelup') G.applyOption(Math.floor(Math.random() * G.cards.length));
    else if (G.state === 'play') {
      // 锁血 + 加攻 + 随机瞬移：只验证流程不验证平衡
      G.player.hp = G.player.maxhp = 99999;
      G.player.ink = G.player.maxInk = 999;
      G.player.dmgMul = 200;
      if (steps % 150 === 0) { G.player.x += (Math.random() - 0.5) * 500; G.player.y += (Math.random() - 0.5) * 500; }
      G.update(dt);
      if (steps % 10 === 0) G.render();   // 渲染每 10 帧抽验一次即可
      for (const e of G.enemies) {
        if (e.boss && !e.dead) { bossSeen.add(e.stage + ':' + e.name); if (e.phase === 2) sawPhase2 = true; }
      }
      if (G.hazards.length > 0) sawHazard = true;
      if (G.ebullets.length > 0) sawEbullet = true;
      maxStage = Math.max(maxStage, G.curStage);
    }
    steps++;
  }
} catch (ex) { err = ex; }
console.log('结局:', G.state, '| 时间:', (G.gameTime / 60).toFixed(1) + 'min', '| 击杀:', G.kills, '| 等级:', G.player.level, '| 到达关卡:', maxStage);
console.log('出场Boss:', [...bossSeen].join(' | '));
console.log('二阶段暴走:', sawPhase2, '| 龙息/陨石预警:', sawHazard, '| 墨弹弹幕:', sawEbullet);
if (err) { console.log('ERROR:', err.stack.split('\n').slice(0, 4).join('\n')); process.exit(1); }
if (G.state !== 'win') { console.log('FAIL: 未能通关'); process.exit(1); }
console.log('SMOKE_OK');

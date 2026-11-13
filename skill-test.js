// 逐技能覆盖测试：每个主动技能 + 其全部合法辅助各跑一段战斗，确保不崩溃且能打出伤害
const src = require('fs').readFileSync(__dirname + '/battle-config.js', 'utf8') + '\n' + require('fs').readFileSync(__dirname + '/enemy-config.js', 'utf8') + '\n' + require('fs').readFileSync(__dirname + '/main.js', 'utf8').replace("'use strict';", '');

const fakeCtx = new Proxy({}, {
  get(t, k) { if (k === 'measureText') return () => ({ width: 10 }); return () => {}; },
  set() { return true; }
});
const fakeCanvas = {
  getContext: () => fakeCtx, width: 0, height: 0, style: {},
  addEventListener() {}, getBoundingClientRect: () => ({ left: 0, top: 0, width: 375, height: 667 })
};
global.window = { addEventListener() {}, devicePixelRatio: 1, innerWidth: 375, innerHeight: 667 };
global.document = { getElementById: () => fakeCanvas };
global.requestAnimationFrame = () => {};

eval(src + `
;globalThis.G = {
  resetGame, applyOption, update, render, spawnEnemy, skillCalc,
  get state() { return state; }, set state(v) { state = v; },
  get player() { return player; }, get enemies() { return enemies; },
  get bullets() { return bullets; }, get blades() { return blades; },
  get clouds() { return clouds; }, get brands() { return brands; },
  get minions() { return minions; }, get totems() { return totems; },
  get SKILL_DEFS() { return SKILL_DEFS; }, get SUPPORTS() { return SUPPORTS; },
  supportUsable
};`);

const dt = 1 / 60;
let fail = 0;
for (const id of Object.keys(G.SKILL_DEFS)) {
  try {
    G.resetGame();
    G.state = 'play';
    G.player.actives = [{
      id, lvl: 5, t: 0, uc: 0,
      supports: Object.keys(G.SUPPORTS)
        .filter(s => G.supportUsable(s, id))
        .slice(process.argv[2] === 'tail' ? -4 : (process.argv[2] === 'mid' ? 5 : 0), process.argv[2] === 'tail' ? undefined : (process.argv[2] === 'mid' ? 9 : 4)).map(s => ({ id: s, lvl: 3 }))
    }];
    G.player.hp = G.player.maxhp = 99999;
    for (let i = 0; i < 14; i++) { G.spawnEnemy(); }
    // 把怪拉到玩家周围，保证索敌/连锁/光环都能触发
    for (const e of G.enemies) {
      const a = Math.random() * Math.PI * 2, d = 60 + Math.random() * 260;
      e.x = Math.cos(a) * d; e.y = Math.sin(a) * d;
    }
    for (let s = 0; s < 60 * 12; s++) {
      G.update(dt);
      if (s % 30 === 0) G.render();
      if (s % 240 === 0) for (let i = 0; i < 3; i++) G.spawnEnemy();
      if (G.player.x !== G.player.x) throw new Error('player.x NaN');
    }
    console.log('OK  ' + id.padEnd(10) + ' 辅助:' + G.player.actives[0].supports.map(s => s.id).join(','));
  } catch (ex) {
    fail++;
    console.log('ERR ' + id + ': ' + ex.stack.split('\n').slice(0, 3).join(' | '));
  }
}
console.log(fail === 0 ? 'ALL_SKILLS_OK (19/19)' : 'FAILURES: ' + fail);
process.exit(fail ? 1 : 0);

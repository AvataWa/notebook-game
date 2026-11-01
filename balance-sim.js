// 数值对比模拟：正常攻击/生命，固定种子，自动走位与选卡；不修改 main.js
const fs = require('fs');
const baseSrc = fs.readFileSync(__dirname + '/main.js', 'utf8').replace("'use strict';", '');
const variants = [
  { name: '当前', base: 1, time: 0.35, stage: 0.22, boss: 1 },
  { name: '保守推荐', base: 1.2, time: 0.38, stage: 0.24, boss: 1.1 },
  { name: '温和', base: 1.2, time: 0.40, stage: 0.25, boss: 1.15 },
  { name: '激进', base: 1.35, time: 0.45, stage: 0.28, boss: 1.25 }
];
const RUNS = 12;
const fakeCtx = new Proxy({}, {
  get(t, k) { if (k === 'measureText') return () => ({ width: 10 }); return () => {}; },
  set() { return true; }
});
const fakeCanvas = {
  getContext: () => fakeCtx, width: 0, height: 0, style: {}, addEventListener() {},
  getBoundingClientRect: () => ({ left: 0, top: 0, width: 375, height: 667 })
};
global.window = { addEventListener() {}, devicePixelRatio: 1, innerWidth: 375, innerHeight: 667 };
global.document = { getElementById: () => fakeCanvas };
global.requestAnimationFrame = () => {};

function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}
function scoreCard(c) {
  if (c.kind === 'support' || c.kind === 'support+') {
    return ({ heavyweight: 110, rapid: 105, followup: 100, sweep: 95, multi: 95, pierce: 90, chain: 90, wide: 85, saturate: 85, brutal: 80, swift: 80 }[c.sup] || 45);
  }
  if (c.kind === 'active+') return 88;
  if (c.kind === 'active') return 65;
  if (c.kind === 'passive') return ({ dmg: 100, haste: 92, hpup: 90, crit: 86, magnet: 75, spd: 70 }[c.id] || 60);
  if (c.kind === 'notable') return 78;
  return 0;
}
function run(v, seed) {
  let src = baseSrc
    .replace('const scale = (1 + t / 60 * 0.35) * (1 + (st - 1) * 0.22);', `const scale = (1 + t / 60 * ${v.time}) * (1 + (st - 1) * ${v.stage});`)
    .replace('const d0 = ENEMY_DEFS[type], s2 = (1 + gameTime / 60 * 0.35) * (1 + (curSt() - 1) * 0.22);', `const d0 = ENEMY_DEFS[type], s2 = (1 + gameTime / 60 * ${v.time}) * (1 + (curSt() - 1) * ${v.stage});`)
    .replace('hp: d0.hp * scale,', `hp: d0.hp * scale * ${v.base},`)
    .replace('hp: d0.hp * s2,', `hp: d0.hp * s2 * ${v.base},`)
    .replace('name: def.name, r: def.r, hp: def.hp,', `name: def.name, r: def.r, hp: def.hp * ${v.boss},`);
  Math.random = rng(seed);
  eval(src + `
  ;globalThis.G = {
    resetGame, applyOption, update,
    get state() { return state; }, set state(v) { state = v; },
    get gameTime() { return gameTime; }, get kills() { return kills; },
    get player() { return player; }, get enemies() { return enemies; },
    get gems() { return gems; }, get cards() { return cards; },
    get curStage() { return curStage; }, get joy() { return joy; }
  };`);
  G.resetGame();
  G.state = 'play';
  G.player.actives = [{ id: 'tornado', lvl: 1, supports: [], t: 0.2, uc: 0 }];
  const dt = 1 / 60;
  let steps = 0;
  while (G.state !== 'win' && G.state !== 'over' && steps < 60 * 600) {
    if (G.state === 'levelup') {
      let best = 0, bestScore = -1;
      G.cards.forEach((c, i) => { const s = scoreCard(c); if (s > bestScore) { bestScore = s; best = i; } });
      G.applyOption(best);
    } else if (G.state === 'play') {
      const p = G.player;
      let nearest = null, nd = Infinity;
      for (const e of G.enemies) {
        if (e.dead) continue;
        const d = Math.hypot(e.x - p.x, e.y - p.y);
        if (d < nd) { nd = d; nearest = e; }
      }
      let mx = 0, my = 0;
      if (nearest && nd < 190) {
        mx = (p.x - nearest.x) / (nd || 1) + -(p.y - nearest.y) / (nd || 1) * 0.55;
        my = (p.y - nearest.y) / (nd || 1) + (p.x - nearest.x) / (nd || 1) * 0.55;
      } else {
        let gem = null, gd = 320;
        for (const g of G.gems) {
          const d = Math.hypot(g.x - p.x, g.y - p.y);
          if (d < gd) { gd = d; gem = g; }
        }
        if (gem) { mx = (gem.x - p.x) / (gd || 1); my = (gem.y - p.y) / (gd || 1); }
        else { const a = G.gameTime * 0.45; mx = Math.cos(a); my = Math.sin(a); }
      }
      const ml = Math.hypot(mx, my) || 1;
      G.joy.active = true; G.joy.dx = mx / ml; G.joy.dy = my / ml;
      G.update(dt);
    }
    steps++;
  }
  return { result: G.state, stage: G.curStage, level: G.player.level, minutes: G.gameTime / 60, kills: G.kills, hp: Math.max(0, G.player.hp) };
}
function median(a) { const s = [...a].sort((x, y) => x - y); return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2; }
for (const v of variants) {
  const runs = [];
  for (let i = 0; i < RUNS; i++) runs.push(run(v, 20261102 + i * 97));
  const wins = runs.filter(r => r.result === 'win').length;
  console.log(JSON.stringify({
    方案: v.name,
    参数: `基础x${v.base}/分钟${v.time}/关卡${v.stage}/Boss x${v.boss}`,
    胜率: `${wins}/${RUNS}`,
    中位关卡: median(runs.map(r => r.stage)),
    中位等级: median(runs.map(r => r.level)),
    中位时间: median(runs.map(r => r.minutes)).toFixed(1) + 'min',
    中位击杀: Math.round(median(runs.map(r => r.kills))),
    明细: runs.map(r => `${r.result}@${r.stage}/Lv${r.level}/${r.minutes.toFixed(1)}m`).join(' ')
  }));
}
console.log('普通怪生命对照（火柴人/重拳怪，未含 Boss）：');
for (const v of variants) {
  const vals = [[0, 1], [5, 4], [10, 7], [15, 10]].map(([minute, stage]) => {
    const scale = (1 + minute * v.time) * (1 + (stage - 1) * v.stage) * v.base;
    return `${minute}m/${stage}关:${Math.round(20 * scale)}/${Math.round(85 * scale)}`;
  });
  console.log(v.name + ' ' + vals.join(' | '));
}

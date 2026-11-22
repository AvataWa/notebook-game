// 装备替换页：图标、基础属性和词条描述必须保持可见间距。
const fs = require('fs');
const src = ['battle-config.js', 'enemy-config.js', 'content-config.js', 'main.js', 'build-runtime.js']
  .map(f => fs.readFileSync(__dirname + '/' + f, 'utf8').replace("'use strict';", '')).join('\n');
const texts = [];
const fakeCtx = new Proxy({}, { get(t, k) {
  if (k in t) return t[k];
  if (k === 'measureText') return text => ({ width: String(text).length * 6 });
  if (k === 'fillText') return (txt, x, y) => texts.push({ txt: String(txt), x, y, font: t.font });
  return () => {};
}, set(t, k, v) { t[k] = v; return true; } });
const fakeCanvas = { getContext: () => fakeCtx, width: 0, height: 0, style: {}, addEventListener() {}, getBoundingClientRect: () => ({ left: 0, top: 0, width: 375, height: 667 }) };
global.window = { addEventListener() {}, devicePixelRatio: 1, innerWidth: 375, innerHeight: 667, EquipmentIconRuntime: { draw() {} } };
global.document = { getElementById: () => fakeCanvas }; global.requestAnimationFrame = () => {};
eval(src + `;globalThis.G = { resetGame, render,
  get player() { return player; }, get state() { return state; }, get runtime() { return window.__buildRuntime; } };`);
function assert(ok, message) { if (!ok) throw new Error(message); }
G.resetGame(); G.state = 'play';
G.player.equip.feet = { key: 'erasershoes', rarity: 0 };
G.runtime.collectEquipment({ item: 'trackshoes', rarity: 2, x: 0, y: 0 });
assert(G.state === 'equipment', '没有打开装备替换页');
texts.length = 0; G.render();
const stats = texts.filter(t => t.txt.startsWith('攻击 +'));
assert(stats.length === 2, '当前装备和新装备的属性没有完整显示');
for (const line of stats) {
  const fontSize = parseFloat(line.font) || 11;
  assert(line.y - fontSize >= 158 + 54 + 46 + 4, '属性文字仍与图标下缘重叠');
  assert(texts.some(t => t.txt.includes('移速 +') && t.y >= line.y + 24), '词条描述与属性文字间距不足');
}
console.log('EQUIPMENT_LAYOUT_TEST_OK (2/2 张装备卡)');

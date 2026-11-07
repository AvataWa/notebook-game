'use strict';
const assert = require('assert');
const game = require('./game.js');
const d = game.debug;
const results = [];
function test(name, fn) { fn(); results.push(name); console.log('✓ ' + name); }

test('三张同名同星部件自动合成二星', () => {
  game.reset();
  game.addPart('arc'); game.addPart('arc');
  assert.strictEqual(d.equipped.head.id, 'arc');
  assert.strictEqual(d.equipped.head.star, 2);
  assert.strictEqual(d.bench.filter(p => p.id === 'arc').length, 0);
});

test('初始一张加八张最终合成三星', () => {
  game.reset();
  for (let i = 0; i < 8; i++) game.addPart('arc');
  assert.strictEqual(d.equipped.head.star, 3);
  assert.strictEqual(d.bench.filter(p => p.id === 'arc').length, 0);
});

test('候补席最多保留六个部件', () => {
  game.reset(); d.equipped = {};
  const ids = Object.keys(game.PARTS);
  for (let i = 0; i < 7; i++) game.addPart(ids[i]);
  assert.strictEqual(d.bench.length, 6);
  assert.strictEqual(d.bench.some(p => p.id === ids[0]), false);
});

test('不同身体类型不能交换，同类型可以交换', () => {
  game.reset(); game.addPart('candle');
  const index = d.bench.findIndex(p => p.id === 'candle');
  assert.strictEqual(game.swapEquipBench('left', index), false);
  const before = d.equipped.head.id;
  assert.strictEqual(game.swapEquipBench('head', index), true);
  assert.strictEqual(d.equipped.head.id, 'candle');
  assert.strictEqual(d.bench[index].id, before);
});

test('两个轮转顺序格可以交换', () => {
  game.reset();
  assert.strictEqual(game.swapOrder(0, 2), true);
  assert.deepStrictEqual([...d.order], ['right', 'head', 'body', 'left']);
});

for (const item of [
  { name: '燎原连爆', status: 'burn', attr: 'ice' },
  { name: '碎墨处决', status: 'ink', attr: 'ice' },
  { name: '墨火爆破', status: 'ink', attr: 'fire' }
]) {
  test(`连携名称与伤害结算正确：${item.name}`, () => {
    game.reset();
    const enemy = { x: 100, y: 100, r: 10, hp: 1000, maxhp: 1000, status: item.status, statusT: 4, dead: false };
    d.enemies = [enemy];
    const name = game.triggerCombo(
      { pen: '起笔', status: item.status },
      { pen: '行笔', star: 1 },
      { pen: '收笔', attr: item.attr, star: 1 }
    );
    assert.strictEqual(name, item.name);
    assert.strictEqual(d.S.combo, item.name);
    assert.strictEqual(enemy.hp, 966);
    assert.strictEqual(enemy.status, null);
  });
}

test('四个主动技能按设定顺序自动施放', () => {
  game.reset('play'); d.enemies = []; d.history = [];
  const cast = [];
  for (let i = 0; i < 4; i++) { d.S.castT = 0; game.update(0.01); cast.push(d.history[d.history.length - 1].id); }
  assert.deepStrictEqual(cast, ['inkrain', 'arc', 'plane', 'imps']);
  assert.strictEqual(d.S.orderIndex, 0);
});

console.log(`\n${results.length} 项测试全部通过。`);

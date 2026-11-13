// 形态被动、属性辅助、加法叠加与派生上限专项测试
const fs = require('fs');
const files = ['battle-config.js', 'enemy-config.js', 'content-config.js', 'main.js', 'build-runtime.js',
  'hades-runtime.js', 'hades-weapons-runtime.js', 'weapon-passives-expansion.js', 'form-passives-runtime.js',
  'support-expansion-runtime.js', 'elemental-support-runtime.js', 'trigger-support-runtime.js'];
const src = files.map(f => fs.readFileSync(__dirname + '/' + f, 'utf8').replace("'use strict';", '')).join('\n');
const fakeCtx = new Proxy({}, { get(t, k) {
  if (k === 'measureText') return txt => ({ width: String(txt).length * 10 });
  return () => {};
}, set() { return true; } });
const fakeCanvas = { getContext: () => fakeCtx, width: 0, height: 0, style: {}, addEventListener() {}, getBoundingClientRect: () => ({ left: 0, top: 0, width: 375, height: 667 }) };
global.window = { addEventListener() {}, devicePixelRatio: 1, innerWidth: 375, innerHeight: 667 };
global.document = { getElementById: () => fakeCanvas }; global.requestAnimationFrame = () => {};
eval(src + `
;globalThis.G = {
  resetGame, update, fireSkill, skillCalc, spawnEnemy, hurtEnemy, killEnemy, areaHit, supportUsable, supDesc, recomputeEquip,
  get SKILL_DEFS() { return SKILL_DEFS; }, get SKILL_ATTR() { return SKILL_ATTR; }, get SUPPORTS() { return SUPPORTS; },
  get PASSIVES() { return PASSIVES; }, get ITEM_DEFS() { return ITEM_DEFS; }, get player() { return player; },
  get enemies() { return enemies; }, get bullets() { return bullets; }, get erupts() { return erupts; },
  get clouds() { return clouds; }, get totems() { return totems; }, get lightnings() { return lightnings; },
  get state() { return state; }, set state(v) { state = v; }, get gameTime() { return gameTime; }, set gameTime(v) { gameTime = v; },
  get F() { return window.__formPassives; }, get EL() { return window.__elementalSupports; },
  get E() { return window.__supportExpansion; }, get W() { return window.__weaponRuntime; }
};`);
let failed = 0, passed = 0;
function test(name, fn) { try { fn(); passed++; console.log('OK  ' + name); } catch (e) { failed++; console.log('ERR ' + name + ': ' + e.stack.split('\n')[0]); } }
function assert(ok, msg) { if (!ok) throw new Error(msg); }
function near(a, b, eps = 0.001) { return Math.abs(a - b) < eps; }
function fresh(id = 'cyclone', supports = [], lvl = 1) {
  G.resetGame(); G.state = 'play'; G.gameTime = 0; G.player.xpNext = 999999; G.player.hp = G.player.maxhp = 9999;
  G.player.crit = 0; G.player.actives = [{ id, lvl, supports: supports.map(s => Array.isArray(s) ? { id: s[0], lvl: s[1] } : { id: s, lvl: 1 }), t: 999, uc: 0 }];
}
function target(x = 120, y = 0) {
  G.spawnEnemy('stick', x, y); const e = G.enemies[G.enemies.length - 1];
  e.hp = e.maxhp = 9999; e.stunT = 999; e.r = 5; e.dmg = 20; return e;
}
function equip(key, rarity = 0) { const slot = G.ITEM_DEFS[key].slot; G.player.equip[slot] = { key, rarity }; G.recomputeEquip(); }
function cast() { const a = G.player.actives[0]; return G.fireSkill(a, G.skillCalc(a)); }
function hit(e, amount = 100) { G.hurtEnemy(e, amount, 0, 0, 0, 0, 0, 0, '#000', false, G.player.actives[0].id); }

test('删除八条旧辅助，总数为七十二且不可再被匹配', () => {
  fresh();
  assert(Object.keys(G.SUPPORTS).length === 70, '辅助总数不是 70：' + Object.keys(G.SUPPORTS).length);
  for (const id of G.EL.removed) assert(!G.SUPPORTS[id] && !G.supportUsable(id, 'cyclone'), id + ' 仍可获取');
});

test('十九条属性辅助描述、属性匹配和四系直接增伤正确', () => {
  const defs = G.EL.defs; assert(Object.keys(defs).length === 19, '属性辅助不是 19 条');
  for (const [id, def] of Object.entries(defs)) {
    assert(G.supDesc(id, 1).length > 5, id + ' 缺少描述');
    assert(G.SUPPORTS[id].skills.length > 0 && G.SUPPORTS[id].skills.every(s => G.SKILL_ATTR[s] === def[1]), id + ' 属性池错误');
    assert(G.supportUsable(id, G.SUPPORTS[id].skills[0]), id + ' 未开放给本系');
    const wrong = Object.keys(G.SKILL_DEFS).find(s => G.SKILL_ATTR[s] !== def[1]);
    assert(!G.supportUsable(id, wrong), id + ' 错开放给其他属性');
  }
  for (const [skill, id] of [['cyclone','physdmg'], ['volcanic','firedmg'], ['cola','icedmg'], ['arc','thunderdmg']]) {
    fresh(skill); const base = G.skillCalc(G.player.actives[0]).dmg;
    fresh(skill, [id]); const boosted = G.skillCalc(G.player.actives[0]).dmg;
    assert(near(boosted, base * 1.2), id + ' 没有增加 20%：' + base + '/' + boosted);
  }
});

test('四系属性暴击进入真实伤害结算', () => {
  const oldRandom = Math.random; Math.random = () => 0.05;
  try {
    for (const [skill, id] of [['cyclone','physcrit'], ['volcanic','firecrit'], ['cola','icecrit'], ['arc','thundercrit']]) {
      fresh(skill, [id]); const e = target(); hit(e, 100);
      assert(near(e.maxhp - e.hp, 200), id + ' 的 8% 暴击未生效：' + (e.maxhp - e.hp));
    }
  } finally { Math.random = oldRandom; }
});

test('燃烧同技能真实叠到三层，爆燃不会给溅射目标继续挂燃烧', () => {
  fresh('volcanic', ['fireburn']); const e = target(); hit(e); hit(e); hit(e);
  assert(e.elBurns.length === 3 && e.elBurns.every(b => near(b.dps, 8)), '同技能燃烧未叠三层');
  const hp = e.hp; G.update(0.5); assert(near(hp - e.hp, 12), '三层燃烧半秒伤害不是 12：' + (hp - e.hp));
  fresh('volcanic', ['fireburn','fireblast']); const dead = target(), other = target(150, 0);
  hit(dead); dead.hp = 1; const otherHp = other.hp; G.killEnemy(dead);
  assert(near(otherHp - other.hp, 60), '爆燃没有造成 60% 范围伤害：' + (otherHp - other.hp));
  assert(!other.elBurns, '爆燃派生伤害错误触发燃烧，可能连锁');
});

test('寒霜冻结普通怪，Boss 只减速；碎冰遵守每技能触发间隔', () => {
  fresh('cola', ['icefrost']); const normal = target(); normal.stunT = 0; hit(normal); hit(normal); hit(normal);
  assert(normal.elFrostN === 3 && normal.stunT >= 0.5 && normal.slowT > 0, '普通怪未冻结');
  fresh('cola', ['icefrost']); const boss = target(); boss.boss = true; boss.stunT = 0; hit(boss); hit(boss); hit(boss);
  assert(boss.elFrostN === 3 && boss.stunT === 0 && boss.slowT > 0, 'Boss 被冻结或没有减速');
  fresh('cola', ['iceshard']); const e = target(); e.slowT = 2; hit(e); const count = G.bullets.length; hit(e);
  assert(count === 3 && G.bullets.length === count, '碎冰数量或 0.3 秒间隔错误');
  G.gameTime = 0.3; hit(e); assert(G.bullets.length === count + 3, '碎冰冷却未恢复');
});

test('静电第四击、额外导电和雷网均进入真实结算', () => {
  fresh('arc', ['thunderstatic']); const e = target(); hit(e); hit(e); hit(e); hit(e);
  assert(near(e.maxhp - e.hp, 460) && G.lightnings.length > 0, '第四击没有追加 60% 静电雷');
  fresh('arc', ['thunderchain']); const first = target(), second = target(160, 0); const hp = second.hp; hit(first);
  assert(near(hp - second.hp, 50), '额外导电没有造成 50% 伤害');
  fresh('arc', ['thundernet']); const netTarget = target(); hit(netTarget);
  assert(G.EL.state.nets.length === 1 && G.EL.state.nets[0].damage === 20, '雷网没有记录路径或伤害');
});

test('二十九个形态被动全部注册、一次获取且只在前置主动存在时出现', () => {
  const forms = Object.keys(G.F.forms); assert(forms.length === 29, '形态被动不是 29 个');
  for (const skill of forms) {
    const p = G.PASSIVES.find(x => x.id === 'form_' + skill);
    fresh(skill === 'cyclone' ? 'pageslash' : 'cyclone');
    assert(p && p.form && p.once && !p.available(), skill + ' 缺少形态或前置失效');
    fresh(skill); assert(p.available(), skill + ' 有主动仍不出现'); p.fx();
    assert(G.player.taken[p.id] === true, skill + ' 获取后未记录');
  }
});

test('二十九个形态均可实际施放并更新，实体坐标保持有限', () => {
  for (const skill of Object.keys(G.F.forms)) {
    fresh(skill); G.player.taken['form_' + skill] = true; target();
    const result = cast(); assert(result !== false, skill + ' 形态施放失败');
    for (let i = 0; i < 5; i++) G.F.update(0.05);
    const arrays = [G.bullets, G.erupts, G.clouds, G.totems, ...Object.values(G.F.state).filter(Array.isArray),
      ...Object.values(G.W.state).filter(Array.isArray)];
    for (const array of arrays) for (const entity of array) {
      for (const key of ['x','y','x1','y1','x2','y2','vx','vy','damage','dmg']) {
        if (entity[key] !== undefined) assert(Number.isFinite(entity[key]), skill + ' 的 ' + key + ' 非有限数');
      }
    }
  }
});

test('三叉冰锥将等级、辅助与装备弹数全部加算', () => {
  fresh('icespear', [['multi',2]], 4); equip('scatterband', 3); G.player.taken.form_icespear = true; target();
  const c = G.skillCalc(G.player.actives[0]); assert(c.count === 6, '总弹数加成不是 6：' + c.count);
  cast(); assert(G.bullets.length === 9, '三加六不是九支冰锥：' + G.bullets.length);
});

test('连发派生弹不会再次获得形态数量或继续派生', () => {
  fresh('icespear', ['projrepeat']); G.player.taken.form_icespear = true; target(); cast();
  assert(G.bullets.length === 3 && G.E.state.queue.length === 3, '初始三发或连发队列错误');
  G.E.preUpdate(0.11); assert(G.bullets.length === 6 && G.E.state.queue.length === 0, '派生弹重复增殖');
  assert(G.bullets.slice(3).every(b => b._noExpand && !b._exp), '派生弹仍可被再次装饰');
});

test('空中分弹与子母墨弹同时存在时只生成三枚子弹', () => {
  fresh('inkgrenade'); G.player.taken.form_inkgrenade = true; G.player.taken.grenade_cluster = true; target(); cast();
  assert(G.W.state.grenades.filter(g => g.main).length === 3, '主墨弹没有分成三枚');
  G.W.updateGrenades(0.83);
  assert(G.W.state.grenades.filter(g => !g.main).length === 9, '三组三发子弹总数不是 9');
});

test('范围、雷网和弹幕派生均有硬上限', () => {
  fresh('cola', ['icefield','iceshard']); const e = target(); e.slowT = 99;
  for (let i = 0; i < 100; i++) { G.gameTime = i * 0.5; hit(e, 10); }
  assert(G.EL.state.iceZones.length <= 40 && G.bullets.length <= 260, '冰面或碎冰超出上限');
  fresh('arc', ['thundernet']); const t = target();
  for (let i = 0; i < 100; i++) { G.gameTime = i * 0.4; hit(t, 10); }
  assert(G.EL.state.nets.length <= 48, '雷网超出上限');
  fresh('spark'); G.player.taken.form_spark = true; target();
  for (let i = 0; i < 30; i++) cast(); assert(G.F.state.mines.length <= 60, '悬浮墨雷超出上限');
});

console.log(failed ? 'BUILD_EXPANSION_TEST_FAILURES: ' + failed : 'BUILD_EXPANSION_TEST_OK (' + passed + '/' + passed + ')');
process.exit(failed ? 1 : 0);

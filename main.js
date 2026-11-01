'use strict';
/* ============================================================
   《我穿越到笔记本了》 M2 原型 v12
   关卡制：A-B（关卡-波数）· 10 种作业本底纹 · 每关一个 Boss
   升级=波数+1，每 10 波换一关，涂掉第 10 关 Boss 即胜利
   20 个主动技能 × 12 种辅助（辅助按技能过滤有效组合）· 技能/辅助 1-5 级 · 装备系统
   破绽标记易伤 · 冰冻减速 · 回力镖往返 · 墨滴撞纸边反弹 · 刀阵/墨云/烙印/新星
   ============================================================ */

const W = 375, H = 667;
const ZOOM = 0.8;
const VIEW_W = W / ZOOM, VIEW_H = H / ZOOM;
// 地图 = 一本 16 开笔记本（184×260mm，高:宽 = 1.413），左装订三边纸边
const WORLD_W = 950, WORLD_H = 1342;
const WORLD_L = -WORLD_W / 2, WORLD_R = WORLD_W / 2, WORLD_T = -WORLD_H / 2, WORLD_B = WORLD_H / 2;
function clampW(v, m) { return Math.max(WORLD_L + m, Math.min(WORLD_R - m, v)); }
function clampH(v, m) { return Math.max(WORLD_T + m, Math.min(WORLD_B - m, v)); }
const INK = '#1a2b8f', ALLY = '#6b6b6b', PICKUP = '#7a9e01';
const DARK = '#2b2b2b', RED = '#c0392b', PURPLE = '#6c3483';
const ARC = '#4d9fff';
const FLASH = '#b9b9ae';
const PAPER = '#f5f1e6', LINE = '#c3d6ec', GRAY = '#9a9a9a';
const FONT = '"Comic Sans MS","Segoe Print","Yuanti SC",cursive';
/* 照片级写实素材：木纹桌面 + 金属铁环（衬托纸面的手绘涂鸦） */
const IMG = {};
if (typeof Image !== 'undefined') {
  for (const kv of [['desk', 'assets/desk.jpg'], ['ring', 'assets/ring.png']]) {
    const im = new Image(); im.src = kv[1]; IMG[kv[0]] = im;
  }
}
function imgReady(im) { return !!im && im.complete && im.naturalWidth > 0; }
const MAX_ACTIVES = 4, MAX_SUPPORTS = 4, MAX_LVL = 5;
const SQUASH_T = 0.22, KNOCK_V = 150;

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
let viewScale = 1;
function resize() {
  const dpr = window.devicePixelRatio || 1;
  const s = Math.min(window.innerWidth / W, window.innerHeight / H);
  viewScale = s * dpr;
  canvas.width = Math.round(W * viewScale);
  canvas.height = Math.round(H * viewScale);
  canvas.style.width = (W * s) + 'px';
  canvas.style.height = (H * s) + 'px';
}
window.addEventListener('resize', resize);
resize();

/* ---------- 手抖涂鸦渲染器 ---------- */
let _seed = 1, boilT = 0;
function srand() { _seed = (_seed * 16807) % 2147483647; return (_seed - 1) / 2147483646; }
function setSeed(n) { _seed = ((n * 2654435761) ^ (boilT * 40503)) >>> 0; _seed %= 2147483646; if (_seed <= 0) _seed = 12345; }

function jline(x1, y1, x2, y2, color, lw) {
  const len = Math.hypot(x2 - x1, y2 - y1);
  const seg = Math.max(2, Math.min(14, Math.floor(len / 9)));
  ctx.strokeStyle = color; ctx.lineWidth = lw || 2; ctx.lineCap = 'round';
  ctx.beginPath();
  for (let i = 0; i <= seg; i++) {
    const t = i / seg;
    let x = x1 + (x2 - x1) * t, y = y1 + (y2 - y1) * t;
    if (i > 0 && i < seg) { x += (srand() - 0.5) * 2.6; y += (srand() - 0.5) * 2.6; }
    if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
  }
  ctx.stroke();
}
function jcircle(x, y, r, color, lw) {
  const seg = Math.max(8, Math.min(24, Math.floor(r * 1.2)));
  ctx.strokeStyle = color; ctx.lineWidth = lw || 2; ctx.lineCap = 'round';
  ctx.beginPath();
  for (let i = 0; i <= seg; i++) {
    const a = i / seg * Math.PI * 2, rr = r + (srand() - 0.5) * 2.4;
    const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr;
    if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
  }
  ctx.stroke();
}
function jrect(x, y, w, h, color, lw) {
  jline(x, y, x + w, y, color, lw); jline(x + w, y, x + w, y + h, color, lw);
  jline(x + w, y + h, x, y + h, color, lw); jline(x, y + h, x, y, color, lw);
}
function scribbleFill(x, y, w, h, color) {
  ctx.strokeStyle = color; ctx.lineWidth = 1.3; ctx.beginPath();
  for (let yy = y + 2; yy < y + h - 1; yy += 3.2) {
    ctx.moveTo(x + 1, yy);
    ctx.lineTo(x + w - 1, yy + (srand() - 0.5) * 2);
  }
  ctx.stroke();
}
function drawStick(x, y, size, walk, color) {
  jcircle(x, y - size * 0.62, size * 0.28, color, 2);
  const neckY = y - size * 0.34, hipY = y + size * 0.1;
  jline(x, neckY, x, hipY, color, 2);
  const sw = Math.sin(walk) * size * 0.28;
  jline(x, hipY, x - sw, y + size * 0.5, color, 2);
  jline(x, hipY, x + sw, y + size * 0.5, color, 2);
  jline(x, neckY + size * 0.15, x - size * 0.3 + sw * 0.5, neckY + size * 0.42, color, 2);
  jline(x, neckY + size * 0.15, x + size * 0.3 - sw * 0.5, neckY + size * 0.42, color, 2);
}

/* ---------- Build 定义 ---------- */
const SKILL_DEFS = {
  cyclone:  { name: '旋转蜡笔',   desc: '蜡笔环绕切割身边敌人' },
  volcanic: { name: '火山压痕',   desc: '重击纸面，裂缝朝最近的怪物连续喷发' },
  tornado:  { name: '分叉纸飞机', desc: '纸飞机命中后向四周分裂' },
  chainclip:{ name: '链条回形针', desc: '回形针在敌人之间连锁弹跳' },
  arc:      { name: '电弧荧光笔', desc: '闪电在敌群间自动连锁' },
  spark:    { name: '慢速墨滴',   desc: '喷出一圈慢速墨滴，撞到纸边会反弹' },
  srs:      { name: '涂鸦小鬼',   desc: '召唤小鬼自动索敌撕咬' },
  ballista: { name: '图钉炮台',   desc: '钉下炮台自动射击周围敌人' },
  boomerang:{ name: '回力橡皮擦', desc: '掷出橡皮擦，飞出去再旋回来' },
  vortex:   { name: '涂改带刀阵', desc: '涂改带碎片环绕身体，越叠越多' },
  candle:   { name: '蜡烛头',     desc: '头顶点起蜡烛，持续灼烧周围敌人' },
  icespear: { name: '冰锥图钉',   desc: '射出贯穿冰锥，命中减速' },
  inkrain:  { name: '毒墨雨',     desc: '召唤数片毒墨云，持续淋伤下方敌人' },
  ruler:    { name: '裂地直尺',   desc: '直尺劈落，地刺成排刺出并余震' },
  chalk:    { name: '流星粉笔头', desc: '粉笔头从天而降，砸出大坑' },
  pinburst: { name: '蜂群大头钉', desc: '扇形射出一把大头钉，钉尖爆裂' },
  absolve:  { name: '赦免粉笔',   desc: '光柱劈最强的敌人，劈死则化为己方小鬼' },
  brand:    { name: '橡皮筋烙印', desc: '给敌人套上橡皮筋，持续电击并弹向周围' },
  cola:     { name: '冰可乐新星', desc: '冰可乐炸开，冻慢身边一圈敌人' },
  dash:     { name: '闪现粉笔',   desc: '向前方瞬移一段，路径留下伤敌墨痕' }
};
/* 技能标签：proj=子弹 area=范围 strike=打击（辅助按标签过滤，双标签可吃两系） */
const SKILL_TAGS = {
  cyclone: ['strike', 'area'], volcanic: ['area', 'strike'], tornado: ['proj'], chainclip: ['proj'],
  arc: ['area'], spark: ['proj'], srs: ['strike'], ballista: ['proj'], boomerang: ['proj'],
  vortex: ['strike', 'area'], candle: ['area'], icespear: ['proj'], inkrain: ['area'],
  ruler: ['area', 'strike'], chalk: ['area'], pinburst: ['proj'], absolve: ['strike'],
  brand: ['area'], cola: ['area'], dash: ['strike']
};
/* 技能属性：phys 物理灰 / fire 火橙 / ice 冰浅蓝 / thunder 雷蓝紫（每系 5 个） */
const SKILL_ATTR = {
  cyclone: 'phys', srs: 'phys', ballista: 'phys', vortex: 'phys', ruler: 'phys',
  volcanic: 'fire', candle: 'fire', chalk: 'fire', inkrain: 'fire', pinburst: 'fire',
  tornado: 'ice', spark: 'ice', boomerang: 'ice', icespear: 'ice', cola: 'ice',
  chainclip: 'thunder', arc: 'thunder', absolve: 'thunder', brand: 'thunder', dash: 'thunder'
};
const ATTR_COLOR = { phys: '#6b6b6b', fire: '#e67e22', ice: '#7ec8e3', thunder: '#5b5bd6' };
const ATTR_NAME = { phys: '物理', fire: '火', ice: '冰', thunder: '雷' };
const TAG_NAME = { proj: '子弹', area: '范围', strike: '打击' };
function attrOf(aid) { return ATTR_COLOR[SKILL_ATTR[aid]] || INK; }

const SUPPORTS = {
  // tag: all=全部 / proj=子弹 / area=范围 / strike=打击；skills=额外白名单（可选）
  brutal:  { name: '用力描粗', tag: 'all' },
  swift:   { name: '连笔速写', tag: 'all' },
  unleash: { name: '蓄力重描', tag: 'all' },
  focus:   { name: '破绽标记', tag: 'all' },
  dot:     { name: '洇墨',     tag: 'all' },
  // 子弹·数值
  sharpen: { name: '削尖笔尖', tag: 'proj' },
  projspd: { name: '快干墨',   tag: 'proj' },
  heavynib:{ name: '重墨弹头', tag: 'proj' },
  longshot:{ name: '长距墨水', tag: 'proj' },
  fatpipe: { name: '粗管笔',   tag: 'proj' },
  // 子弹·表现
  multi:   { name: '多重描线', tag: 'proj' },
  pierce:  { name: '穿透描边', tag: 'proj' },
  chain:   { name: '连环引线', tag: 'proj' },
  homing:  { name: '追踪笔迹', tag: 'proj' },
  blast:   { name: '爆裂笔尖', tag: 'proj' },
  // 范围（10 个：5 数值 + 5 表现）
  wide:    { name: '浓墨重彩', tag: 'area' },
  saturate:{ name: '重色涂满', tag: 'area' },
  soak:    { name: '纸面浸透', tag: 'area' },
  sheath:  { name: '收笔回锋', tag: 'area' },
  pressboss:{ name: '压纸重涂', tag: 'area' },
  core:    { name: '圆心浓墨', tag: 'area', skills: ['volcanic', 'ruler', 'candle', 'inkrain', 'chalk', 'cola', 'cyclone'] },
  retick:  { name: '反复涂抹', tag: 'area', skills: ['candle', 'inkrain', 'brand'] },
  linger:  { name: '余墨',     tag: 'area', skills: ['inkrain', 'brand'] },
  reburst: { name: '二次晕染', tag: 'area', skills: ['volcanic', 'ruler', 'chalk', 'inkrain', 'cola', 'brand'] },
  stain:   { name: '墨渍残留', tag: 'area' },
  // 打击·数值
  heavyweight:{ name: '落笔千钧', tag: 'strike' },
  firstblood:{ name: '重描落笔', tag: 'strike' },
  combo:   { name: '连笔渐重', tag: 'strike' },
  scrit:   { name: '寸劲',     tag: 'strike' },
  counter: { name: '反震纸背', tag: 'strike' },
  // 打击·表现
  rapid:   { name: '疾笔',     tag: 'strike' },
  sweep:   { name: '大开大合', tag: 'strike', skills: ['cyclone', 'vortex', 'dash', 'srs', 'volcanic', 'ruler'] },
  followup:{ name: '追加一笔', tag: 'strike' },
  leech:   { name: '回锋',     tag: 'strike' },
  shock:   { name: '震荡纸面', tag: 'strike' },
  dur:     { name: '持久墨水', tag: 'strike', skills: ['srs', 'vortex', 'absolve'] }
};
function supportUsable(sid, aid) {
  const sp = SUPPORTS[sid];
  if (sp.skills && !sp.skills.includes(aid)) return false;
  return sp.tag === 'all' || (SKILL_TAGS[aid] || []).includes(sp.tag);
}
function supDesc(id, l) {           // 辅助在 l 级时的效果描述
  switch (id) {
    case 'brutal':  return '伤害 +' + 25 * l + '%，冷却 +' + 8 * l + '%';
    case 'swift':   return '冷却 -' + 13 * l + '%';
    case 'unleash': return '每第 3 次施放效果 x' + (1 + l);
    case 'focus':   return '命中使怪物受伤加深 +' + 15 * l + '%，持续 2 秒';
    case 'dot':     return '命中附加 ' + 18 * l + '%/秒 洇墨伤害，持续 3 秒';
    case 'sharpen': return '子弹伤害 +' + 20 * l + '%';
    case 'projspd': return '投射物速度 +' + 30 * l + '%，伤害 +' + 10 * l + '%';
    case 'heavynib':return '子弹暴击率 +' + 10 * l + '%';
    case 'longshot':return '射程/存活时间 +' + 30 * l + '%';
    case 'fatpipe': return '子弹命中半径 +' + 25 * l + '%';
    case 'multi':   return '弹道/数量 +' + l + '，伤害 -' + 8 * l + '%';
    case 'pierce':  return '穿透 +' + l + '，伤害 -' + 5 * l + '%';
    case 'chain':   return '连锁/分裂/弹射 +' + l;
    case 'homing':  return '子弹追踪敌人，转向速度 +' + l + ' 档';
    case 'blast':   return '命中爆出墨花，溅射 ' + 30 * l + '% 伤害';
    case 'wide':    return '范围/半径 +' + 22 * l + '%';
    case 'saturate':return '范围伤害 +' + 20 * l + '%';
    case 'soak':    return '范围内怪物受伤加深 +' + 8 * l + '%';
    case 'sheath':  return '范围技能冷却 -' + 10 * l + '%';
    case 'pressboss':return '范围技能对 Boss 伤害 +' + 15 * l + '%';
    case 'core':    return '区域中心一半半径内伤害 +' + 30 * l + '%';
    case 'retick':  return '范围伤害频率 +' + 18 * l + '%';
    case 'linger':  return '范围持续时间 +' + 35 * l + '%';
    case 'reburst': return '范围结束后原地再爆发 ' + (50 + 25 * l) + '% 伤害';
    case 'stain':   return '怪物离开范围仍受余伤，持续 ' + (1 + 0.5 * l) + ' 秒';
    case 'heavyweight':return '打击伤害 +' + 22 * l + '%';
    case 'firstblood':return '对满血怪物伤害 +' + 40 * l + '%';
    case 'combo':   return '连续命中同一目标伤害递增 +' + 6 * l + '%，最多 5 层，2 秒未命中清零';
    case 'scrit':   return '打击暴击率 +' + 10 * l + '%';
    case 'counter': return '受击后 2 秒内打击伤害 +' + 30 * l + '%';
    case 'rapid':   return '打击施放/攻击频率 +' + 15 * l + '%';
    case 'sweep':   return '打击范围 +' + 20 * l + '%';
    case 'followup':return '命中 0.4 秒后追加 ' + 40 * l + '% 伤害';
    case 'leech':   return '打击命中回复 ' + (0.3 * l).toFixed(1) + '% 最大生命，每秒最多 3 次';
    case 'shock':   return '小怪击退 +' + 50 * l + '%，并僵直 ' + (0.2 * l).toFixed(1) + ' 秒（Boss 免疫僵直）';
    case 'dur':     return '持续/召唤时间 +' + 40 * l + '%';
  }
  return '';
}
const PASSIVES = [
  { id: 'dmg',    name: '笔力', desc: '全部伤害 +10%',          fx: () => player.dmgMul *= 1.1 },
  { id: 'haste',  name: '速写', desc: '技能冷却 -6%',            fx: () => player.cdMul *= 0.94 },
  { id: 'spd',    name: '碎步', desc: '移动速度 +6%',            fx: () => player.speed *= 1.06 },
  { id: 'hpup',   name: '厚纸', desc: '最大生命 +20 并回复 20',   fx: () => { player.maxhp += 20; player.hp = Math.min(player.maxhp, player.hp + 20); } },
  { id: 'magnet', name: '吸墨', desc: '拾取范围 +35%',           fx: () => player.pickup *= 1.35 },
  { id: 'crit',   name: '重墨', desc: '暴击率 +10%（双倍伤害）',  fx: () => player.crit += 0.1 }
];
const NOTABLES = [
  { id: 'twin',      name: '大节点·双生画笔', desc: '小鬼/炮台上限 +1',        fx: () => player.taken.twin = true },
  { id: 'inkmaster', name: '大节点·泼墨',     desc: '全部技能范围 +20%',        fx: () => player.radMul *= 1.2 },
  { id: 'fountain',  name: '大节点·笔芯连供', desc: '冷却 -12%，但伤害 -8%',    fx: () => { player.cdMul *= 0.88; player.dmgMul *= 0.92; } }
];

/* ---------- 装备定义 ---------- */
const SLOTS = ['head', 'body', 'hands', 'feet', 'acc'];
const SLOT_NAME = { head: '头部', body: '上身', hands: '手部', feet: '脚部', acc: '饰品' };
const ITEM_DEFS = {
  crown:   { slot: 'head',  name: '涂鸦王冠', atk: 15, hp: 30, fx: '升级时四选一' },
  cap4:    { slot: 'head',  name: '四色笔帽', atk: 12, hp: 0,  fx: '每个不同主动技能使伤害 +8%' },
  cloak:   { slot: 'body',  name: '勇者披风', atk: 0,  hp: 50, fx: '生命低于 30% 时伤害 +40%' },
  stapler: { slot: 'body',  name: '订书机甲', atk: 0,  hp: 70, fx: '受到伤害 -15%' },
  glove:   { slot: 'hands', name: '红笔指套', atk: 10, hp: 0,  fx: '暴击率 +15%，暴击伤害 x2.5' },
  compass: { slot: 'hands', name: '圆规护腕', atk: 10, hp: 0,  fx: '技能范围 +15%' },
  shoes:   { slot: 'feet',  name: '弹簧拖鞋', atk: 0,  hp: 20, fx: '移速 +12%，受击后 2 秒移速再 +30%' },
  tape:    { slot: 'feet',  name: '修正带鞋', atk: 0,  hp: 25, fx: '每 30 秒抵挡一次致命伤害' },
  pendant: { slot: 'acc',   name: '墨胆吊坠', atk: 8,  hp: 20, fx: '拾取墨水珠回复 1 点生命' },
  bookmark:{ slot: 'acc',   name: '灵感书签', atk: 6,  hp: 15, fx: '击杀 8% 概率额外掉一颗墨水珠' }
};
const ITEM_KEYS = Object.keys(ITEM_DEFS);

/* ---------- 游戏状态 ---------- */
let state, gameTime, kills, camX, camY, shakeT, cycAng, crumpleT;
let player, enemies, bullets, ebullets, gems, drops, floats, lightnings, erupts, minions, totems, sparks, toasts, cards, cardRects, hazards, blades, clouds, brands, novas, followups;
let spawnAcc, nextId, bossStageSpawned, curStage;
const keys = {};
const joy = { active: false, id: -1, bx: 0, by: 0, dx: 0, dy: 0 };

function resetGame() {
  state = 'start'; gameTime = 0; kills = 0; shakeT = 0; cycAng = 0; crumpleT = 0;
  camX = 0; camY = 0; spawnAcc = 0; nextId = 1;
  bossStageSpawned = 0; curStage = 0;
  enemies = []; bullets = []; ebullets = []; gems = []; drops = []; floats = []; lightnings = [];
  erupts = []; minions = []; totems = []; sparks = []; toasts = []; cards = []; cardRects = []; hazards = [];
  blades = []; clouds = []; brands = []; novas = []; followups = [];
  player = {
    x: 0, y: 0, r: 12, hp: 100, maxhp: 100, speed: 168, faceA: 0,
    level: 1, xp: 0, xpNext: 8, pickup: 60,
    dmgMul: 1, cdMul: 1, radMul: 1, crit: 0, condDmg: 1,
    eqAtk: 0, eqCrit: 0, eqSpd: 1, eqDr: 0, eqRad: 1,
    hurtBoostT: 0, lastRevive: -999, leechT: 0, leechN: 0,
    walk: 0, hurtT: 0, taken: {},
    equip: { head: null, body: null, hands: null, feet: null, acc: null },
    actives: []
  };
  buildStartCards();
  // 调试：?skill=xxx 直接以指定技能开局
  const dbg = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('skill') : null;
  if (dbg && SKILL_DEFS[dbg]) { player.actives.push({ id: dbg, lvl: 1, supports: [], t: 0.3, uc: 0 }); state = 'play'; }
}
function hasItem(id) { return SLOTS.some(s => player.equip[s] && player.equip[s].key === id); }
function getActive(id) { return player.actives.find(a => a.id === id); }
function recomputeEquip() {
  player.eqAtk = 0; player.eqCrit = 0; player.eqSpd = 1; player.eqDr = 0; player.eqRad = 1;
  let hpBonus = 0;
  for (const s of SLOTS) {
    const eq = player.equip[s]; if (!eq) continue;
    const key = eq.key, it = ITEM_DEFS[key];
    const mul = 1 + 0.2 * (eq.lvl - 1);   // 装备每级属性 +20%
    player.eqAtk += Math.round(it.atk * mul); hpBonus += Math.round(it.hp * mul);
    if (key === 'glove') player.eqCrit += 0.15;
    if (key === 'shoes') player.eqSpd *= 1.12;
    if (key === 'stapler') player.eqDr = 0.15;
    if (key === 'compass') player.eqRad *= 1.15;
  }
  const ratio = player.maxhp > 0 ? player.hp / player.maxhp : 1;
  player.maxhp = 100 + hpBonus;
  player.hp = Math.max(1, Math.round(player.maxhp * ratio));
}
function skillCalc(a) {
  // 主动等级：每级 伤害+15%、冷却-4%
  const isStrike = (SKILL_TAGS[a.id] || []).includes('strike');
  let dmg = 1 + 0.15 * (a.lvl - 1), cd = 1 - 0.04 * (a.lvl - 1);
  let count = 0, rad = 1, pierce = 0, chain = 0, dot = 0, proj = 1, areaT = 1, unleash = 0, vuln = 0;
  let bdmg = 0, bcrit = 0, brad = 0, lifeMul = 0, homing = 0, blast = 0;
  let admg = 0, soak = 0, bossMul = 0, core = 0, retick = 0, lingerT = 0, reburst = 0, stain = 0;
  let sdmg = 0, firstblood = 0, combo = 0, scrit = 0, counter = 0;
  let rapid = 0, sweep = 0, followup = 0, leech = 0, shock = 0;
  for (const sp of a.supports) {
    const s = sp.id, l = sp.lvl;
    if (s === 'multi') { count += l; dmg *= Math.pow(0.92, l); }
    else if (s === 'brutal') { dmg *= 1 + 0.25 * l; cd *= 1 + 0.08 * l; }
    else if (s === 'swift') cd *= 1 - 0.13 * l;
    else if (s === 'wide') rad *= 1 + 0.22 * l;
    else if (s === 'pierce') { pierce += l; dmg *= 1 - 0.05 * l; }
    else if (s === 'chain') chain += l;
    else if (s === 'unleash') unleash = l;
    else if (s === 'focus') vuln += 0.15 * l;
    else if (s === 'dot') dot += 0.18 * l;
    else if (s === 'projspd') { proj *= 1 + 0.3 * l; dmg *= 1 + 0.1 * l; }
    else if (s === 'dur') areaT *= 1 + 0.4 * l;
    else if (s === 'sharpen') bdmg += 0.2 * l;
    else if (s === 'heavynib') bcrit += 0.1 * l;
    else if (s === 'longshot') lifeMul += 0.3 * l;
    else if (s === 'fatpipe') brad += 0.25 * l;
    else if (s === 'homing') homing += 1.5 * l;
    else if (s === 'blast') blast += 0.3 * l;
    else if (s === 'saturate') admg += 0.2 * l;
    else if (s === 'soak') soak += 0.08 * l;
    else if (s === 'sheath') cd *= 1 - 0.1 * l;
    else if (s === 'pressboss') bossMul += 0.15 * l;
    else if (s === 'core') core += 0.3 * l;
    else if (s === 'retick') retick += 0.18 * l;
    else if (s === 'linger') lingerT += 0.35 * l;
    else if (s === 'reburst') reburst += 0.25 * l;
    else if (s === 'stain') stain += 0.5 * l;
    else if (s === 'heavyweight') sdmg += 0.22 * l;
    else if (s === 'firstblood') firstblood += 0.4 * l;
    else if (s === 'combo') combo += 0.06 * l;
    else if (s === 'scrit') scrit += 0.1 * l;
    else if (s === 'counter') counter += 0.3 * l;
    else if (s === 'rapid') rapid += 0.15 * l;
    else if (s === 'sweep') sweep += 0.2 * l;
    else if (s === 'followup') followup += 0.4 * l;
    else if (s === 'leech') leech += 0.003 * l;
    else if (s === 'shock') shock += 0.5 * l;
  }
  if (isStrike && rapid) cd /= 1 + rapid;
  return {
    dmg: dmg * player.dmgMul * (1 + player.eqAtk / 100) * player.condDmg,
    cd: cd * player.cdMul, count, rad: rad * player.radMul * player.eqRad,
    pierce, chain, dot, proj, areaT, unleash, vuln,
    bdmg, bcrit, brad, lifeMul, homing: homing ? 2 + homing : 0, blast,
    admg, soak, bossMul, core, retick, lingerT, reburst, stain,
    strike: isStrike, sdmg, firstblood, combo, scrit, counter, rapid, sweep, followup, leech, shock,
    col: attrOf(a.id)
  };
}
function toast(txt) { toasts.push({ txt, t: 2.8 }); if (toasts.length > 3) toasts.shift(); }

/* ---------- 敌人 ---------- */
const ENEMY_DEFS = {
  stick:  { hp: 20, sp: 55,  dmg: 14, r: 12, xp: 1 },
  spider: { hp: 10, sp: 105, dmg: 9,  r: 9,  xp: 1 },
  rage:   { hp: 85, sp: 32,  dmg: 22, r: 16, xp: 3 },
  plane:  { hp: 14, sp: 175, dmg: 12, r: 10, xp: 1 }
};
/* ---------- 关卡定义：10 页作业本 ---------- */
const STAGE_NAMES = ['横线练习本', '数学方格本', '田字格本', '英语本', '米字格本', '作文本', '五线谱本', '点阵本', '坐标纸', '草稿纸'];
// 每关纸色：米白/淡绿/米黄/淡蓝/暖黄/奶油/灰白/淡紫灰/淡青/旧黄
const STAGE_PAPER = ['#f5f1e6', '#eaf2e6', '#f7efdc', '#ecf1f8', '#f6eeda', '#fdf4e8', '#f0eee8', '#efeff4', '#eaf2f6', '#eee2cc'];
const BOSS_DEFS = [
  { name: '乱线魔王',       arch: 'charger', hp: 2200,  r: 34, dmg: 30, sp: 64 },
  { name: '涂改巨灵',       arch: 'blob',    hp: 3400,  r: 40, dmg: 32, sp: 36 },
  { name: '红笔判官',       arch: 'charger', hp: 4200,  r: 30, dmg: 36, sp: 90 },
  { name: '空想巨龙',       arch: 'caster',  hp: 6000,  r: 62, dmg: 38, sp: 40 },
  { name: '涂鸦骑士团长',   arch: 'charger', hp: 7800,  r: 38, dmg: 42, sp: 72 },
  { name: '墨水元素',       arch: 'blob',    hp: 9500,  r: 46, dmg: 44, sp: 42 },
  { name: '折纸龙王',       arch: 'caster',  hp: 11500, r: 58, dmg: 48, sp: 50 },
  { name: '暴走橡皮',       arch: 'charger', hp: 13500, r: 42, dmg: 52, sp: 84 },
  { name: '万墨之渊',       arch: 'blob',    hp: 16500, r: 54, dmg: 55, sp: 36 },
  { name: '笔记本之主',     arch: 'caster',  hp: 22000, r: 70, dmg: 60, sp: 46 }
];
function curSt() { return Math.min(10, Math.ceil(player.level / 10)); }
function spawnEnemy() {
  if (enemies.length > 260) return;
  const t = gameTime, r = Math.random();
  let type = 'stick';
  if (t > 150 && r < 0.15) type = 'plane';
  else if (t > 90 && r < 0.30) type = 'rage';
  else if (t > 45 && r < 0.55) type = 'spider';
  const a = Math.random() * Math.PI * 2, d = 430 + Math.random() * 120;
  const d0 = ENEMY_DEFS[type];
  const st = curSt();
  const scale = (1 + t / 60 * 0.38) * (1 + (st - 1) * 0.24);
  const e = {
    id: nextId++, type, x: clampW(player.x + Math.cos(a) * d, 20), y: clampH(player.y + Math.sin(a) * d, 20),
    r: d0.r, hp: d0.hp * scale * 1.2, sp: d0.sp, dmg: Math.round(d0.dmg * (1 + t / 60 * 0.15) * (1 + (st - 1) * 0.12)), xp: d0.xp + st,
    walk: Math.random() * 6, hitCd: 0, flash: 0, squash: 0, dotT: 0, dotDps: 0,
    vx: 0, vy: 0, kbx: 0, kby: 0
  };
  e.maxhp = e.hp;
  if (type === 'plane') {
    const aa = Math.atan2(player.y - e.y, player.x - e.x);
    e.vx = Math.cos(aa); e.vy = Math.sin(aa);
  }
  enemies.push(e);
}
/* ---------- Boss（三种原型：charger 冲刺 / caster 龙息陨石 / blob 弹幕召唤） ---------- */
function spawnBoss(st) {
  const def = BOSS_DEFS[st - 1];
  const a = Math.random() * Math.PI * 2;
  const e = {
    id: nextId++, type: 'boss', boss: true, arch: def.arch, stage: st,
    name: def.name, r: def.r, hp: def.hp * 1.1, sp: def.sp, dmg: def.dmg, xp: 20 + st * 6,
    x: clampW(player.x + Math.cos(a) * 400, def.r + 20), y: clampH(player.y + Math.sin(a) * 400, def.r + 20),
    walk: 0, hitCd: 0, flash: 0, squash: 0, dotT: 0, dotDps: 0,
    vx: 0, vy: 0, kbx: 0, kby: 0,
    mode: 'chase', modeT: 2.5, chargeDx: 0, chargeDy: 0, summonT: 5,
    breathCd: 3.5, meteorCd: 2, ringCd: 2, sumCd: 4, phase: 1
  };
  e.maxhp = e.hp;
  enemies.push(e);
  crumpleT = 0.7; shakeT = 0.5;
  toast('纸面被揉皱了…… ' + def.name + ' 爬了出来！');
}
function summonMob(type, x, y) {
  const d0 = ENEMY_DEFS[type], s2 = (1 + gameTime / 60 * 0.38) * (1 + (curSt() - 1) * 0.24);
  const e = {
    id: nextId++, type, x, y,
    r: d0.r, hp: d0.hp * s2 * 1.2, sp: d0.sp, dmg: Math.round(d0.dmg * (1 + gameTime / 60 * 0.15)), xp: d0.xp + curSt(),
    walk: Math.random() * 6, hitCd: 0, flash: 0, squash: 0, dotT: 0, dotDps: 0, vx: 0, vy: 0, kbx: 0, kby: 0
  };
  e.maxhp = e.hp;
  enemies.push(e);
}
function updateBoss(e, dt) {
  const pa = Math.atan2(player.y - e.y, player.x - e.x);
  if (e.phase === 1 && e.hp < e.maxhp * 0.5) {
    e.phase = 2; e.sp *= 1.35; crumpleT = 0.7; shakeT = 0.5;
    toast(e.name + ' 暴走了！线条开始崩坏！');
  }
  const rate = e.phase === 2 ? 0.6 : 1;
  e.walk += dt * 5;
  if (e.arch === 'charger') {
    e.modeT -= dt; e.summonT -= dt;
    if (e.mode === 'chase') {
      e.x += Math.cos(pa) * e.sp * dt; e.y += Math.sin(pa) * e.sp * dt;
      if (e.modeT <= 0) { e.mode = 'aim'; e.modeT = 0.55; }
    } else if (e.mode === 'aim') {
      e.chargeDx = Math.cos(pa); e.chargeDy = Math.sin(pa);
      if (e.modeT <= 0) { e.mode = 'charge'; e.modeT = 0.7; shakeT = Math.max(shakeT, 0.15); }
    } else if (e.mode === 'charge') {
      e.x += e.chargeDx * e.sp * 6 * dt; e.y += e.chargeDy * e.sp * 6 * dt;
      if (e.modeT <= 0) { e.mode = 'chase'; e.modeT = (3 + Math.random() * 1.5) * rate; }
    }
    if (e.summonT <= 0 && enemies.length < 250) {
      e.summonT = 7 * rate;
      for (let i = 0; i < 4; i++) {
        const aa = i / 4 * Math.PI * 2 + Math.random();
        summonMob(e.stage >= 5 ? 'rage' : 'stick', e.x + Math.cos(aa) * (e.r + 26), e.y + Math.sin(aa) * (e.r + 26));
      }
    }
  } else if (e.arch === 'caster') {
    const dist = Math.hypot(player.x - e.x, player.y - e.y);
    const want = 200;
    const mv = dist > want + 30 ? e.sp : (dist < want - 40 ? -e.sp * 0.7 : 0);
    e.x += Math.cos(pa) * mv * dt; e.y += Math.sin(pa) * mv * dt;
    e.x += Math.cos(pa + Math.PI / 2) * 32 * dt; e.y += Math.sin(pa + Math.PI / 2) * 32 * dt;
    e.breathCd -= dt; e.meteorCd -= dt;
    if (e.breathCd <= 0) {
      e.breathCd = 6.5 * rate;
      hazards.push({ kind: 'cone', x: e.x, y: e.y, ang: pa, arc: 0.75, range: 300, delay: 0.9, dmg: Math.round(e.dmg * 0.9), t: 0.6, done: false });
    }
    if (e.meteorCd <= 0) {
      e.meteorCd = (e.phase === 2 ? 2.2 : 3.2);
      const n = (e.phase === 2 ? 7 : 5) + Math.floor(e.stage / 3);
      for (let i = 0; i < n; i++) {
        hazards.push({
          kind: 'meteor', x: player.x + (Math.random() - 0.5) * 340, y: player.y + (Math.random() - 0.5) * 340,
          r: 46, delay: 0.85 + Math.random() * 0.4, dmg: Math.round(e.dmg * 0.7), t: 0.35, done: false
        });
      }
    }
  } else {  // blob：慢速逼近 + 环形墨弹 + 召唤蜘蛛
    e.x += Math.cos(pa) * e.sp * dt; e.y += Math.sin(pa) * e.sp * dt;
    e.ringCd -= dt; e.sumCd -= dt;
    if (e.ringCd <= 0) {
      e.ringCd = 3.4 * rate;
      const n = 8 + e.stage;
      for (let i = 0; i < n; i++) {
        const a = i / n * Math.PI * 2 + e.walk;
        ebullets.push({ x: e.x, y: e.y, vx: Math.cos(a) * 135, vy: Math.sin(a) * 135, dmg: Math.round(e.dmg * 0.55), life: 3.2 });
      }
    }
    if (e.sumCd <= 0 && enemies.length < 250) {
      e.sumCd = 6 * rate;
      for (let i = 0; i < 3; i++) summonMob('spider', e.x + (Math.random() - 0.5) * 80, e.y + (Math.random() - 0.5) * 80);
    }
  }
}
function killEnemy(e) {
  if (e.dead) return;
  e.dead = true; kills++;
  gems.push({ x: e.x, y: e.y, v: e.xp });
  if (e.boss) {
    shakeT = 0.5;
    drops.push({ x: e.x, y: e.y, item: ITEM_KEYS[Math.floor(Math.random() * ITEM_KEYS.length)], bob: 0 });
    for (let i = 0; i < 12; i++) gems.push({ x: e.x + (Math.random() - 0.5) * 80, y: e.y + (Math.random() - 0.5) * 80, v: 3 + e.stage });
    if (e.stage >= 10) { crumpleT = 0.8; state = 'win'; }
    else toast(e.name + ' 被涂掉了！第 ' + e.stage + ' 页通过！');
    return;
  }
  if (hasItem('bookmark') && Math.random() < 0.08) gems.push({ x: e.x + 8, y: e.y + 8, v: 1 });
  const rate = e.type === 'rage' ? 0.15 : 0.025;
  if (Math.random() < rate && drops.length < 12) {
    drops.push({ x: e.x, y: e.y, item: ITEM_KEYS[Math.floor(Math.random() * ITEM_KEYS.length)], bob: Math.random() * 6 });
  }
}
function hurtEnemy(e, dmg, dotDps, sx, sy, vuln, critAdd, bossMul, hitCol) {
  if (e.dead) return;
  if (e.vulnT > 0) dmg *= 1 + e.vuln;   // 破绽标记：受伤加深
  if (e.areaVulnT > 0) dmg *= 1 + e.areaVuln;   // 纸面浸透：区域易伤
  if (e.boss && bossMul) dmg *= 1 + bossMul;    // 压纸重涂：对 Boss 加伤
  if (vuln) { e.vuln = vuln; e.vulnT = 2; }
  let crit = false;
  const critChance = player.crit + player.eqCrit + (critAdd || 0);
  const critMul = hasItem('glove') ? 2.5 : 2;
  if (critChance > 0 && Math.random() < critChance) { dmg *= critMul; crit = true; }
  e.hp -= dmg; e.flash = 0.12; e.squash = SQUASH_T;
  const kx = e.x - (sx === undefined ? player.x : sx);
  const ky = e.y - (sy === undefined ? player.y : sy);
  const kd = Math.hypot(kx, ky) || 1;
  e.kbx = kx / kd * KNOCK_V * (e.boss ? 0.1 : 1); e.kby = ky / kd * KNOCK_V * (e.boss ? 0.1 : 1);
  if (dotDps) { e.dotDps = Math.max(e.dotDps, dotDps); e.dotT = 3; }
  sparks.push({ x: e.x + (Math.random() - 0.5) * e.r, y: e.y + (Math.random() - 0.5) * e.r, t: 0.18, color: hitCol || INK });
  floats.push({ x: e.x, y: e.y - e.r - 6, txt: Math.round(dmg) + '', t: 0.7, color: crit ? RED : (hitCol || INK), crit });
  if (e.hp <= 0) killEnemy(e);
}
// 范围/打击统一命中结算；双标签技能可同时获得两系辅助，纯范围技能不吃打击加成
function areaHit(e, dmg, c, sx, sy, zoneR, dist) {
  if (!c || e.dead) return;
  const rawDmg = dmg;
  dmg *= 1 + (c.admg || 0);
  if (c.core && zoneR && dist !== undefined && dist < zoneR * 0.5) dmg *= 1 + c.core;
  if (c.strike) {
    dmg *= 1 + (c.sdmg || 0);
    if (c.firstblood && e.maxhp && e.hp >= e.maxhp) dmg *= 1 + c.firstblood;
    if (c.counter && player.hurtBoostT > 0) dmg *= 1 + c.counter;
    if (c.combo) {
      e.comboN = e.comboT > 0 ? Math.min(5, (e.comboN || 0) + 1) : 1;
      e.comboT = 2;
      dmg *= 1 + c.combo * Math.max(0, e.comboN - 1);
    }
  }
  if (c.soak) { e.areaVuln = c.soak; e.areaVulnT = 0.6; }
  if (c.stain) { e.stainDps = dmg * 0.6; e.stainT = 1 + c.stain; }
  if (c.strike && c.followup) {
    followups.push({ e, t: 0.4, dmg: rawDmg * c.followup, c: Object.assign({}, c, { followup: 0 }), sx, sy });
  }
  hurtEnemy(e, dmg, dmg * (c.dot || 0), sx, sy, c.vuln, c.strike ? c.scrit : 0, c.bossMul, c.col);
  if (c.strike && c.shock && !e.dead) {
    e.kbx *= 1 + c.shock; e.kby *= 1 + c.shock;
    if (!e.boss) e.stunT = Math.max(e.stunT || 0, c.shock * 0.4);   // 0.2 秒/级
  }
  if (c.strike && c.leech && player.leechN < 3) {
    const heal = player.maxhp * c.leech;
    player.leechN++;
    player.hp = Math.min(player.maxhp, player.hp + heal);
    floats.push({ x: player.x, y: player.y - 28, txt: '+' + (heal < 10 ? heal.toFixed(1) : Math.round(heal)), t: 0.6, color: '#2f9e68' });
  }
}
function hurtPlayer(dmg) {
  dmg = Math.round(dmg * (1 - player.eqDr));
  if (player.hp - dmg <= 0 && hasItem('tape') && gameTime - player.lastRevive > 30) {
    player.lastRevive = gameTime;
    player.hp = 1; player.hurtT = 0.6; shakeT = 0.3;
    toast('修正带挡下了致命一击！');
    return;
  }
  player.hp -= dmg; player.hurtT = 0.3; player.hurtBoostT = 2; shakeT = 0.18;
  floats.push({ x: player.x, y: player.y - 26, txt: '-' + dmg, t: 0.8, color: RED });
  if (player.hp <= 0) { player.hp = 0; state = 'over'; }
}

/* ---------- 主动技能施放 ---------- */
function nearestEnemy(x, y, maxD, exclude) {
  let best = null, bd = maxD * maxD;
  for (const e of enemies) {
    if (e.dead || e === exclude) continue;
    const d2 = (e.x - x) ** 2 + (e.y - y) ** 2;
    if (d2 < bd) { bd = d2; best = e; }
  }
  return best;
}
function fireBullet(x, y, ang, spd, dmg, kind, extra) {
  bullets.push(Object.assign({
    x, y, vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd,
    dmg, dot: 0, kind: kind || 'nib', hits: 1, chainLeft: 0, life: 1.4, split: false, extra: 0, proj: 1
  }, extra || {}));
}
// 子弹类技能的统一辅助参数包（伤害倍率在施放处另乘 1+c.bdmg）
function projOpts(c, life) {
  return {
    dot: c.dot, proj: c.proj, rad: c.rad * (1 + c.brad), vuln: c.vuln,
    life: life * (1 + c.lifeMul), critAdd: c.bcrit, homing: c.homing,
    blast: c.blast, chainN: c.chain, col: c.col
  };
}
function fireSkill(a, c) {
  const px = player.x, py = player.y;
  if (a.id === 'cyclone') {
    const rad = 74 * c.rad * (1 + c.sweep);
    for (const e of enemies) {
      const d = Math.hypot(e.x - px, e.y - py);
      if (!e.dead && d < rad + e.r) areaHit(e, 11 * c.dmg, c, px, py, rad, d);
    }
  } else if (a.id === 'volcanic') {
    const tgt = nearestEnemy(px, py, 520 * c.rad);   // 朝最近的怪物方向喷发
    const va = tgt ? Math.atan2(tgt.y - py, tgt.x - px) : player.faceA;
    for (let k = 0; k < 3 + c.count; k++) {
      erupts.push({
        x: px + Math.cos(va) * (60 + k * 66),
        y: py + Math.sin(va) * (60 + k * 66),
        delay: k * 0.22, dmg: 26 * c.dmg, r: 52 * c.rad * (1 + c.sweep), c, done: false, t: 0
      });
    }
  } else if (a.id === 'tornado') {
    const t0 = nearestEnemy(px, py, 430);
    if (!t0) return;
    const base = Math.atan2(t0.y - py, t0.x - px), n = 1 + c.count;
    for (let i = 0; i < n; i++) {
      fireBullet(px, py - 10, base + (i - (n - 1) / 2) * 0.15, 380 * c.proj, 15 * c.dmg * (1 + c.bdmg), 'torn',
        Object.assign(projOpts(c, 1.3), { hits: 1 + c.pierce, extra: c.chain }));
    }
  } else if (a.id === 'chainclip') {
    const t0 = nearestEnemy(px, py, 430);
    if (!t0) return;
    const base = Math.atan2(t0.y - py, t0.x - px), n = 1 + c.count;
    for (let i = 0; i < n; i++) {
      fireBullet(px, py - 10, base + (i - (n - 1) / 2) * 0.2, 400 * c.proj, 13 * c.dmg * (1 + c.bdmg), 'chain',
        Object.assign(projOpts(c, 1.5), { hits: 1, chainLeft: 2 + c.chain }));
    }
  } else if (a.id === 'arc') {
    let cur = nearestEnemy(px, py, 330 * c.rad);
    if (!cur) return;
    let sx = px, sy = py - 10, dmg = 22 * c.dmg;
    const hitSet = [];
    const jumps = 3 + c.chain;
    for (let j = 0; j <= jumps && cur; j++) {
      // 逐段飞行：电弧头沿路径飞过去，到达目标才结算伤害
      lightnings.push({ x1: sx, y1: sy, x2: cur.x, y2: cur.y, t: 0.25, delay: 0.03 + j * 0.09, prog: 0, tgt: cur, dmg, c });
      hitSet.push(cur);
      sx = cur.x; sy = cur.y; dmg *= 0.85;
      let nxt = null;
      let bd = 150 * c.rad * (150 * c.rad);
      for (const e of enemies) {
        if (e.dead || hitSet.includes(e)) continue;
        const d2 = (e.x - sx) ** 2 + (e.y - sy) ** 2;
        if (d2 < bd) { bd = d2; nxt = e; }
      }
      cur = nxt;
    }
    sparks.push({ x: px, y: py - 10, t: 0.18, color: c.col });  // 笔尖端口亮一下
  } else if (a.id === 'spark') {
    // 真环形发射 + 撞纸边反弹
    const n = 5 + 2 * c.count, off = Math.random() * Math.PI * 2;
    for (let i = 0; i < n; i++) {
      fireBullet(px, py, off + i / n * Math.PI * 2 + (Math.random() - 0.5) * 0.15, 130 * c.proj, 12 * c.dmg * (1 + c.bdmg), 'ink',
        Object.assign(projOpts(c, 2.6), { hits: 2 + c.pierce, bounce: 2 }));
    }
  } else if (a.id === 'srs') {
    const cap = 4 + c.count + (player.taken.twin ? 1 : 0);
    if (minions.length < cap) {
      minions.push({
        x: px + (Math.random() - 0.5) * 40, y: py + (Math.random() - 0.5) * 40,
        t: 8 * c.areaT, atkCd: 0, dmg: 7 * c.dmg, dot: c.dot, walk: Math.random() * 6,
        rad: c.rad, vuln: c.vuln, c
      });
    }
  } else if (a.id === 'ballista') {
    const cap = 2 + c.count + (player.taken.twin ? 1 : 0);
    if (totems.length < cap) {
      totems.push({
        x: px + (Math.random() - 0.5) * 30, y: py + 18,
        t: 8 * c.areaT, fireCd: 0.4, dmg: 12 * c.dmg * (1 + c.bdmg), dot: c.dot,
        pierce: c.pierce, proj: c.proj, rad: c.rad, vuln: c.vuln, ex: projOpts(c, 1.2)
      });
    }
  } else if (a.id === 'boomerang') {   // 回力橡皮擦：飞出后旋回来，往返都能刮人
    const t0 = nearestEnemy(px, py, 460);
    const base = t0 ? Math.atan2(t0.y - py, t0.x - px) : player.faceA, n = 1 + c.count;
    for (let i = 0; i < n; i++) {
      fireBullet(px, py, base + (i - (n - 1) / 2) * 0.35, 330 * c.proj, 18 * c.dmg * (1 + c.bdmg), 'boom',
        Object.assign(projOpts(c, 2.4), { hits: 999, traveled: 0 }));
    }
  } else if (a.id === 'vortex') {      // 涂改带刀阵：每次施放叠一片环绕碎片
    const cap = 3 + c.count;
    blades.push({ ang: Math.random() * Math.PI * 2, t: 4 * c.areaT, dmg: 10 * c.dmg, c, rad: c.rad, x: px, y: py });
    while (blades.length > cap) blades.shift();
  } else if (a.id === 'candle') {      // 蜡烛头：常驻灼烧光环（高频小伤害）
    const rad = 90 * c.rad;
    for (const e of enemies) {
      const d = Math.hypot(e.x - px, e.y - py);
      if (!e.dead && d < rad + e.r) areaHit(e, 4 * c.dmg, c, px, py, rad, d);
    }
  } else if (a.id === 'icespear') {    // 冰锥图钉：射最远的敌人，命中减速
    let best = null, bd = -1;
    for (const e of enemies) {
      if (e.dead) continue;
      const d2 = (e.x - px) ** 2 + (e.y - py) ** 2;
      if (d2 > bd && d2 < 620 * 620) { bd = d2; best = e; }
    }
    if (!best) return;
    fireBullet(px, py - 10, Math.atan2(best.y - py, best.x - px), 460 * c.proj, 30 * c.dmg * (1 + c.bdmg), 'ice',
      Object.assign(projOpts(c, 1.5), { hits: 3 + c.pierce, slow: 2 }));
  } else if (a.id === 'inkrain') {     // 毒墨雨：数片毒墨云落向敌群，持续淋伤
    const n = 3 + c.count;
    for (let i = 0; i < n; i++) {
      const t0 = nearestEnemy(px + (Math.random() - 0.5) * 300, py + (Math.random() - 0.5) * 300, 300);
      clouds.push({
        x: clampW(t0 ? t0.x : px + (Math.random() - 0.5) * 250, 40),
        y: clampH(t0 ? t0.y : py + (Math.random() - 0.5) * 250, 40),
        t: 2.5 * (1 + c.lingerT), tick: 0.1, dmg: 8 * c.dmg, r: 55 * c.rad, c
      });
    }
  } else if (a.id === 'ruler') {       // 裂地直尺：一排地刺 + 0.5 秒后余震
    const t0 = nearestEnemy(px, py, 520);
    const va = t0 ? Math.atan2(t0.y - py, t0.x - px) : player.faceA, n = 5 + c.count;
    for (let k = 0; k < n; k++) {
      erupts.push({ x: px + Math.cos(va) * (40 + k * 44), y: py + Math.sin(va) * (40 + k * 44),
        delay: k * 0.07, dmg: 22 * c.dmg, r: 26 * c.rad * (1 + c.sweep), c, done: false, t: 0 });
      erupts.push({ x: px + Math.cos(va) * (40 + k * 44), y: py + Math.sin(va) * (40 + k * 44),
        delay: 0.55 + k * 0.07, dmg: 22 * c.dmg * 0.6, r: 26 * c.rad * (1 + c.sweep), c, done: false, t: 0 });
    }
  } else if (a.id === 'chalk') {       // 流星粉笔头：延迟落点 AoE 大坑
    const n = 1 + c.count;
    for (let i = 0; i < n; i++) {
      const t1 = nearestEnemy(px + (Math.random() - 0.5) * 200, py + (Math.random() - 0.5) * 200, 550);
      erupts.push({
        x: t1 ? t1.x : px + Math.cos(player.faceA) * 150,
        y: t1 ? t1.y : py + Math.sin(player.faceA) * 150,
        delay: 0.7, dmg: 35 * c.dmg, r: 70 * c.rad, c, done: false, t: 0, warn: true
      });
    }
  } else if (a.id === 'pinburst') {    // 蜂群大头钉：锥形散射，钉尖小爆裂
    const t0 = nearestEnemy(px, py, 420);
    if (!t0) return;
    const base = Math.atan2(t0.y - py, t0.x - px), n = 3 + c.count;
    for (let i = 0; i < n; i++) {
      fireBullet(px, py - 8, base + (i - (n - 1) / 2) * 0.16, 430 * c.proj, 12 * c.dmg * (1 + c.bdmg), 'pin',
        Object.assign(projOpts(c, 0.9), { hits: 1 + c.pierce, aoe: 8 * c.dmg * (1 + c.bdmg), aoeR: 40 * c.rad }));
    }
  } else if (a.id === 'absolve') {     // 赦免粉笔：光柱劈血最厚的，劈死化为己方小鬼
    let best = null, bh = -1;
    for (const e of enemies) {
      if (e.dead) continue;
      const d2 = (e.x - px) ** 2 + (e.y - py) ** 2;
      if (d2 < 400 * 400 && e.hp > bh) { bh = e.hp; best = e; }
    }
    if (!best) return;
    lightnings.push({ x1: best.x, y1: best.y - 260, x2: best.x, y2: best.y, t: 0.3, delay: 0, prog: 1, pillar: true, c });
    areaHit(best, 30 * c.dmg, c, best.x, best.y - 100);
    if (best.dead) {
      minions.push({ x: best.x, y: best.y, t: 6 * c.areaT, atkCd: 0, dmg: 9 * c.dmg, dot: c.dot, walk: 0, rad: c.rad, vuln: c.vuln, ghost: true, c });
    }
  } else if (a.id === 'brand') {       // 橡皮筋烙印：套上持续电击并弹向周围
    const t0 = nearestEnemy(px, py, 350 * c.rad);
    if (!t0) return;
    brands.push({ tgt: t0, t: 4 * (1 + c.lingerT), tick: 0, dmg: 9 * c.dmg, chain: 1 + c.chain, c });
  } else if (a.id === 'cola') {        // 冰可乐新星：冻慢身边一圈
    const rad = 110 * c.rad;
    novas.push({ x: px, y: py, t: 0.35, max: rad, col: c.col });
    for (const e of enemies) {
      const d = Math.hypot(e.x - px, e.y - py);
      if (!e.dead && d < rad + e.r) {
        e.slowT = Math.max(e.slowT || 0, 1.5);
        areaHit(e, 20 * c.dmg, c, px, py, rad, d);
      }
    }
    if (c.reburst) {   // 二次晕染：新星后再爆发一次
      erupts.push({ x: px, y: py, delay: 0.5, dmg: 20 * c.dmg * (0.5 + c.reburst), r: rad,
        c: Object.assign({}, c, { reburst: 0 }), done: false, t: 0 });
    }
  } else if (a.id === 'dash') {        // 闪现粉笔：瞬移一段，路径留下伤敌墨痕
    const dx = Math.cos(player.faceA), dy = Math.sin(player.faceA), dist = 90;
    const nx = clampW(px + dx * dist, 14), ny = clampH(py + dy * dist, 14);
    for (const e of enemies) {
      if (e.dead) continue;
      const t = Math.max(0, Math.min(1, ((e.x - px) * dx + (e.y - py) * dy) / (dist * dist)));
      if (Math.hypot(e.x - (px + dx * dist * t), e.y - (py + dy * dist * t)) < e.r + 20 * c.rad * (1 + c.sweep))
        areaHit(e, 15 * c.dmg, c, px, py);
    }
    lightnings.push({ x1: px, y1: py, x2: nx, y2: ny, t: 0.25, delay: 0, prog: 1, dash: true, c });
    sparks.push({ x: px, y: py, t: 0.18, color: c.col }); sparks.push({ x: nx, y: ny, t: 0.18, color: c.col });
    player.x = nx; player.y = ny;
  }
}
function updateSkills(dt) {
  cycAng += dt * 6;
  for (const a of player.actives) {
    a.t -= dt;
    if (a.t > 0) continue;
    const c = skillCalc(a);
    let baseCd = {
      cyclone: 0.45, volcanic: 2.2, tornado: 0.8, chainclip: 0.9, arc: 1.6, spark: 1.8, srs: 3.5, ballista: 5,
      boomerang: 2.2, vortex: 1.5, candle: 0.25, icespear: 1.1, inkrain: 2.8, ruler: 2.0, chalk: 2.4,
      pinburst: 1.3, absolve: 2.0, brand: 2.5, cola: 1.8, dash: 3
    }[a.id];
    a.t = baseCd * c.cd;
    if (a.id === 'candle') a.t /= 1 + (c.retick || 0);   // 反复涂抹：灼烧更频繁
    a.uc = (a.uc || 0) + 1;
    const reps = (c.unleash > 0 && a.uc % 3 === 0) ? 1 + c.unleash : 1;
    for (let r = 0; r < reps; r++) fireSkill(a, c);
  }
}

/* ---------- 选卡（起手 / 升级共用） ---------- */
function layoutCards(n) {
  const h = n === 4 ? 84 : 92, gap = n === 4 ? 14 : 18;
  const total = n * h + (n - 1) * gap, y0 = 130 + (430 - total) / 2;
  cardRects = cards.map((c, i) => ({ x: 47, y: y0 + i * (h + gap), w: 280, h }));
}
function buildStartCards() {
  const ids = Object.keys(SKILL_DEFS);
  for (let i = ids.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [ids[i], ids[j]] = [ids[j], ids[i]]; }
  cards = ids.slice(0, 3).map(id => ({ kind: 'start', id, tag: '[起手]', tagColor: INK, name: SKILL_DEFS[id].name, desc: SKILL_DEFS[id].desc }));
  layoutCards(3);
}
function buildOptions() {
  const pool = [];
  // 新主动技能
  if (player.actives.length < MAX_ACTIVES) {
    for (const id of Object.keys(SKILL_DEFS)) {
      if (!getActive(id)) pool.push({ kind: 'active', id, tag: '[主动]', tagColor: INK, name: SKILL_DEFS[id].name, desc: SKILL_DEFS[id].desc });
    }
  }
  for (const a of player.actives) {
    // 主动技能升级（数值）
    if (a.lvl < MAX_LVL) pool.push({
      kind: 'active+', skill: a.id, tag: '[强化]', tagColor: INK,
      name: SKILL_DEFS[a.id].name + ' Lv' + (a.lvl + 1), desc: '伤害 +15%，冷却 -4%（当前 Lv' + a.lvl + '）'
    });
    // 已有辅助升级（效果档位）
    for (const sp of a.supports) {
      if (sp.lvl < MAX_LVL) pool.push({
        kind: 'support+', skill: a.id, sup: sp.id, tag: '[辅助↑]', tagColor: PURPLE,
        name: SUPPORTS[sp.id].name + ' Lv' + (sp.lvl + 1) + ' → ' + SKILL_DEFS[a.id].name,
        desc: supDesc(sp.id, sp.lvl + 1)
      });
    }
    // 新辅助（按标签过滤：全部/子弹/范围/打击，双标签技能可吃两系）
    if (a.supports.length < MAX_SUPPORTS) {
      for (const s of Object.keys(SUPPORTS)) {
        if (!supportUsable(s, a.id)) continue;
        if (!a.supports.some(sp => sp.id === s)) pool.push({
          kind: 'support', skill: a.id, sup: s, tag: '[辅助]', tagColor: PURPLE,
          name: SUPPORTS[s].name + ' → ' + SKILL_DEFS[a.id].name, desc: 'Lv1：' + supDesc(s, 1)
        });
      }
    }
  }
  for (const p of PASSIVES) pool.push({ kind: 'passive', id: p.id, tag: '[被动]', tagColor: DARK, name: p.name, desc: p.desc });
  for (const n of NOTABLES) {
    if (!player.taken[n.id]) pool.push({ kind: 'notable', id: n.id, tag: '[大节点]', tagColor: RED, name: n.name, desc: n.desc });
  }
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  const nPick = hasItem('crown') ? 4 : 3;
  const picks = pool.slice(0, nPick);
  if (!picks.some(c => c.kind === 'passive' || c.kind === 'notable')) {
    const idx = pool.findIndex(c => c.kind === 'passive' || c.kind === 'notable');
    if (idx >= 0) picks[picks.length - 1] = pool[idx];
  }
  cards = picks;
  layoutCards(cards.length);
}
function applyOption(i) {
  const c = cards[i]; if (!c) return;
  if (c.kind === 'active' || c.kind === 'start') player.actives.push({ id: c.id, lvl: 1, supports: [], t: 0.3, uc: 0 });
  else if (c.kind === 'active+') { const a = getActive(c.skill); if (a && a.lvl < MAX_LVL) a.lvl++; }
  else if (c.kind === 'support') { const a = getActive(c.skill); if (a) a.supports.push({ id: c.sup, lvl: 1 }); }
  else if (c.kind === 'support+') {
    const a = getActive(c.skill);
    const sp = a && a.supports.find(s => s.id === c.sup);
    if (sp && sp.lvl < MAX_LVL) sp.lvl++;
  }
  else if (c.kind === 'passive') PASSIVES.find(p => p.id === c.id).fx();
  else if (c.kind === 'notable') NOTABLES.find(n => n.id === c.id).fx();
  cards = []; state = 'play';
}

/* ---------- 输入 ---------- */
window.addEventListener('keydown', e => {
  keys[e.key.toLowerCase()] = true;
  if ((state === 'levelup' || state === 'start') && ['1', '2', '3', '4'].includes(e.key)) applyOption(+e.key - 1);
  if ((state === 'over' || state === 'win') && (e.key === ' ' || e.key === 'Enter')) resetGame();
});
window.addEventListener('keyup', e => keys[e.key.toLowerCase()] = false);

function toLogical(e) {
  const r = canvas.getBoundingClientRect();
  return { x: (e.clientX - r.left) / (r.width / W), y: (e.clientY - r.top) / (r.height / H) };
}
canvas.addEventListener('pointerdown', e => {
  e.preventDefault();
  const p = toLogical(e);
  if (state === 'levelup' || state === 'start') {
    for (let i = 0; i < cardRects.length; i++) {
      const r = cardRects[i];
      if (p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h) { applyOption(i); return; }
    }
    return;
  }
  if (state === 'over' || state === 'win') { resetGame(); return; }
  if (p.y > H * 0.4 && !joy.active) {
    joy.active = true; joy.id = e.pointerId; joy.bx = p.x; joy.by = p.y; joy.dx = 0; joy.dy = 0;
  }
});
canvas.addEventListener('pointermove', e => {
  if (!joy.active || e.pointerId !== joy.id) return;
  const p = toLogical(e);
  let dx = p.x - joy.bx, dy = p.y - joy.by;
  const len = Math.hypot(dx, dy), max = 55;
  if (len > max) { dx = dx / len * max; dy = dy / len * max; }
  joy.dx = dx / max; joy.dy = dy / max;
});
function endJoy(e) { if (joy.active && e.pointerId === joy.id) { joy.active = false; joy.dx = 0; joy.dy = 0; } }
canvas.addEventListener('pointerup', endJoy);
canvas.addEventListener('pointercancel', endJoy);

/* ---------- 主更新 ---------- */
function update(dt) {
  gameTime += dt;
  crumpleT = Math.max(0, crumpleT - dt);
  const st = curSt();
  if (st !== curStage) {   // 翻页：换关卡底纹
    curStage = st; crumpleT = Math.max(crumpleT, 0.45);
    toast('翻到第 ' + st + ' 页 · ' + STAGE_NAMES[st - 1]);
  }
  if (player.level % 10 === 0 && bossStageSpawned < st) { bossStageSpawned = st; spawnBoss(st); }

  player.condDmg = 1;
  if (hasItem('cloak') && player.hp < player.maxhp * 0.3) player.condDmg *= 1.4;
  if (hasItem('cap4')) player.condDmg *= 1 + 0.08 * player.actives.length;

  let mx = 0, my = 0;
  if (keys['w'] || keys['arrowup']) my -= 1;
  if (keys['s'] || keys['arrowdown']) my += 1;
  if (keys['a'] || keys['arrowleft']) mx -= 1;
  if (keys['d'] || keys['arrowright']) mx += 1;
  if (joy.active) { mx = joy.dx; my = joy.dy; }
  const ml = Math.hypot(mx, my);
  if (ml > 1) { mx /= ml; my /= ml; }
  player.hurtBoostT = Math.max(0, player.hurtBoostT - dt);
  player.leechT += dt;
  if (player.leechT >= 1) { player.leechT %= 1; player.leechN = 0; }
  const spdNow = player.speed * player.eqSpd * (hasItem('shoes') && player.hurtBoostT > 0 ? 1.3 : 1);
  player.x += mx * spdNow * dt;
  player.y += my * spdNow * dt;
  player.x = clampW(player.x, 14); player.y = clampH(player.y, 14);
  if (ml > 0.1) { player.walk += dt * 10; player.faceA = Math.atan2(my, mx); }
  player.hurtT = Math.max(0, player.hurtT - dt);
  shakeT = Math.max(0, shakeT - dt);

  const bossAlive = enemies.some(e => e.boss && !e.dead);
  if (!bossAlive) {   // Boss 在场：停刷小怪、冻结波数，Boss 死后才翻页继续
    const interval = Math.max(0.18, 1.1 - gameTime * 0.0015);
    spawnAcc += dt;
    while (spawnAcc > interval) { spawnAcc -= interval; spawnEnemy(); }
    if (player.xp >= player.xpNext) {
      player.xp -= player.xpNext; player.level++;
      // 升级需求随等级加速增长：前期快、后期明显变慢
      player.xpNext = 6 + Math.round(player.level * 1.8 + player.level * player.level * 0.06);
      buildOptions(); state = 'levelup';
    }
  }

  updateSkills(dt);

  const kbDecay = Math.exp(-dt * 12);
  for (const e of enemies) {
    if (e.dead) continue;
    e.hitCd = Math.max(0, e.hitCd - dt);
    e.flash = Math.max(0, e.flash - dt);
    e.squash = Math.max(0, e.squash - dt);
    e.vulnT = Math.max(0, (e.vulnT || 0) - dt);
    e.slowT = Math.max(0, (e.slowT || 0) - dt);
    e.boomCd = Math.max(0, (e.boomCd || 0) - dt);
    e.vorCd = Math.max(0, (e.vorCd || 0) - dt);
    e.areaVulnT = Math.max(0, (e.areaVulnT || 0) - dt);
    e.stunT = Math.max(0, (e.stunT || 0) - dt);
    e.comboT = Math.max(0, (e.comboT || 0) - dt);
    if (e.comboT <= 0) e.comboN = 0;
    if (e.stainT > 0) {   // 墨渍残留：离开范围后仍受余伤
      e.stainT -= dt; e.hp -= e.stainDps * dt;
      if (e.hp <= 0) { killEnemy(e); continue; }
    }
    const sf = e.slowT > 0 ? 0.5 : 1;   // 冰冻减速
    if (e.dotT > 0) {
      e.dotT -= dt; e.hp -= e.dotDps * dt;
      if (e.hp <= 0) { killEnemy(e); continue; }
    }
    if (e.stunT <= 0) {   // 震荡僵直：停止移动和 Boss AI，但保留击退位移
      if (e.boss) updateBoss(e, dt * (e.slowT > 0 ? 0.55 : 1));
      else if (e.type === 'plane') { e.x += e.vx * e.sp * sf * dt; e.y += e.vy * e.sp * sf * dt; }
      else {
        const a = Math.atan2(player.y - e.y, player.x - e.x);
        e.x += Math.cos(a) * e.sp * sf * dt; e.y += Math.sin(a) * e.sp * sf * dt;
        e.walk += dt * (e.type === 'spider' ? 14 : 8);
      }
    }
    e.x += e.kbx * dt; e.y += e.kby * dt;
    e.x = clampW(e.x, e.r); e.y = clampH(e.y, e.r);
    e.kbx *= kbDecay; e.kby *= kbDecay;
    const d = Math.hypot(player.x - e.x, player.y - e.y);
    if (e.stunT <= 0 && d < e.r + 10 && e.hitCd <= 0) {
      e.hitCd = 0.9;
      hurtPlayer(e.dmg);
      if (state === 'over') return;
    }
  }

  for (const b of bullets) {
    if (b.homing) {   // 追踪笔迹：限速度转向最近敌人
      const ht = nearestEnemy(b.x, b.y, 520);
      if (ht) {
        const cur = Math.atan2(b.vy, b.vx);
        let da = Math.atan2(ht.y - b.y, ht.x - b.x) - cur;
        while (da > Math.PI) da -= Math.PI * 2;
        while (da < -Math.PI) da += Math.PI * 2;
        const turn = Math.max(-b.homing * dt, Math.min(b.homing * dt, da));
        const sp0 = Math.hypot(b.vx, b.vy);
        b.vx = Math.cos(cur + turn) * sp0; b.vy = Math.sin(cur + turn) * sp0;
      }
    }
    const spd = Math.hypot(b.vx, b.vy) || 1;
    b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
    if (b.kind === 'boom') {   // 回力橡皮擦：飞出 260 后旋回；有弹射次数时优先弹向其他敌人
      b.traveled = (b.traveled || 0) + spd * dt;
      if (b.traveled > 260) {
        const bt = b.chainN > 0 ? nearestEnemy(b.x, b.y, 400) : null;
        const ra = bt ? Math.atan2(bt.y - b.y, bt.x - b.x) : Math.atan2(player.y - b.y, player.x - b.x);
        b.vx = Math.cos(ra) * spd; b.vy = Math.sin(ra) * spd;
      }
    }
    if (b.kind === 'ink' && b.bounce > 0) {   // 墨滴撞纸边反弹
      if (b.x < WORLD_L + 6 || b.x > WORLD_R - 6) { b.vx = -b.vx; b.bounce--; b.x = clampW(b.x, 6); }
      if (b.y < WORLD_T + 6 || b.y > WORLD_B - 6) { b.vy = -b.vy; b.bounce--; b.y = clampH(b.y, 6); }
    }
    if (b.life <= 0) continue;
    for (const e of enemies) {
      if (e.dead) continue;
      if (b.kind === 'boom' && e.boomCd > 0) continue;   // 往返多次命中：0.4s 免疫
      if (Math.hypot(e.x - b.x, e.y - b.y) < e.r + 6 * (b.rad || 1)) {
        if (b.kind === 'torn' && !b.split) {
          b.split = true; b.life = 0;
          hurtEnemy(e, b.dmg, b.dmg * b.dot, b.x, b.y, b.vuln, b.critAdd, 0, b.col);
          const n = 4 + b.extra;
          for (let i = 0; i < n; i++) {
            const ang = (i / n) * Math.PI * 2 + Math.random() * 0.4;
            fireBullet(b.x, b.y, ang, 300 * b.proj, b.dmg * 0.6, 'nib',
              { hits: 1, dot: b.dot, rad: b.rad, vuln: b.vuln, life: 0.7, critAdd: b.critAdd, col: b.col });
          }
          break;
        }
        if (b.kind === 'chain' && b.chainLeft > 0) {
          hurtEnemy(e, b.dmg, b.dmg * b.dot, b.x, b.y, b.vuln, b.critAdd, 0, b.col);
          b.chainLeft--; b.dmg *= 0.7;
          const nxt = nearestEnemy(b.x, b.y, 170, e);
          if (nxt) {
            const a = Math.atan2(nxt.y - b.y, nxt.x - b.x), s = Math.hypot(b.vx, b.vy);
            b.vx = Math.cos(a) * s; b.vy = Math.sin(a) * s;
            lightnings.push({ x1: b.x, y1: b.y, x2: nxt.x, y2: nxt.y, t: 0.12, col: b.col });
          } else b.life = 0;
          break;
        }
        if (b.kind === 'boom') {
          e.boomCd = 0.4;
          hurtEnemy(e, b.dmg, b.dmg * b.dot, b.x, b.y, b.vuln, b.critAdd, 0, b.col);
          if (b.chainN > 0) b.chainN--;
          continue;
        }
        hurtEnemy(e, b.dmg, b.dmg * b.dot, b.x, b.y, b.vuln, b.critAdd, 0, b.col);
        if (b.slow) e.slowT = Math.max(e.slowT || 0, b.slow);
        if (b.blast) {   // 爆裂笔尖：命中溅射墨花
          for (const e2 of enemies) {
            if (!e2.dead && e2 !== e && Math.hypot(e2.x - b.x, e2.y - b.y) < 60 + e2.r)
              hurtEnemy(e2, b.dmg * b.blast, 0, b.x, b.y, undefined, 0, 0, b.col);
          }
          sparks.push({ x: b.x, y: b.y, t: 0.18, color: b.col });
        }
        if (b.kind === 'pin' && b.aoe) {   // 大头钉命中小爆裂
          for (const e2 of enemies) {
            if (!e2.dead && e2 !== e && Math.hypot(e2.x - b.x, e2.y - b.y) < b.aoeR + e2.r)
              hurtEnemy(e2, b.aoe, 0, b.x, b.y, b.vuln, 0, 0, b.col);
          }
          sparks.push({ x: b.x, y: b.y, t: 0.18, color: b.col });
          if (b.chainN > 0) {   // 爆裂后仍可弹射
            b.chainN--;
            const nxt = nearestEnemy(b.x, b.y, 170, e);
            if (nxt) {
              const a = Math.atan2(nxt.y - b.y, nxt.x - b.x), s = Math.hypot(b.vx, b.vy);
              b.vx = Math.cos(a) * s; b.vy = Math.sin(a) * s;
              b.dmg *= 0.8;
              break;
            }
          }
          b.life = 0; break;
        }
        if (b.chainN > 0) {   // 连环引线：普通子弹命中后弹射
          b.chainN--;
          const nxt = nearestEnemy(b.x, b.y, 170, e);
          if (nxt) {
            const a = Math.atan2(nxt.y - b.y, nxt.x - b.x), s = Math.hypot(b.vx, b.vy);
            b.vx = Math.cos(a) * s; b.vy = Math.sin(a) * s;
            b.dmg *= 0.8;
            lightnings.push({ x1: b.x, y1: b.y, x2: nxt.x, y2: nxt.y, t: 0.12, col: b.col });
            break;
          }
        }
        if (--b.hits <= 0) { b.life = 0; break; }
      }
    }
  }
  bullets = bullets.filter(b => b.life > 0);

  for (const er of erupts) {
    if (!er.done) {
      er.delay -= dt;
      if (er.delay <= 0) {
        er.done = true; er.t = 0.3;
        for (const e of enemies) {
          const d = Math.hypot(e.x - er.x, e.y - er.y);
          if (!e.dead && d < er.r + e.r) areaHit(e, er.dmg, er.c, er.x, er.y, er.r, d);
        }
      }
    } else {
      er.t -= dt;
      if (er.t <= 0 && er.c && er.c.reburst && !er.reburstDone) {   // 二次晕染：原地再爆发
        er.reburstDone = true;
        erupts.push({ x: er.x, y: er.y, delay: 0.25, dmg: er.dmg * (0.5 + er.c.reburst), r: er.r,
          c: Object.assign({}, er.c, { reburst: 0 }), done: false, t: 0 });
      }
    }
  }
  erupts = erupts.filter(er => !er.done || er.t > 0);

  // Boss 危险区（龙息锥形 / 陨石涂鸦雨）
  for (const hz of hazards) {
    if (!hz.done) {
      hz.delay -= dt;
      if (hz.delay <= 0) {
        hz.done = true; shakeT = Math.max(shakeT, 0.12);
        let hit = false;
        if (hz.kind === 'meteor') {
          hit = Math.hypot(player.x - hz.x, player.y - hz.y) < hz.r + 8;
          sparks.push({ x: hz.x, y: hz.y, t: 0.18 });
        } else {
          const d = Math.hypot(player.x - hz.x, player.y - hz.y);
          let da = Math.atan2(player.y - hz.y, player.x - hz.x) - hz.ang;
          while (da > Math.PI) da -= Math.PI * 2;
          while (da < -Math.PI) da += Math.PI * 2;
          hit = d < hz.range && Math.abs(da) < hz.arc / 2;
        }
        if (hit) { hurtPlayer(hz.dmg); if (state === 'over') return; }
      }
    } else hz.t -= dt;
  }
  hazards = hazards.filter(h => !h.done || h.t > 0);

  // 敌方墨弹（blob 系 Boss）
  for (const eb of ebullets) {
    eb.x += eb.vx * dt; eb.y += eb.vy * dt; eb.life -= dt;
    if (eb.life > 0 && Math.hypot(player.x - eb.x, player.y - eb.y) < 16) {
      eb.life = 0;
      hurtPlayer(eb.dmg);
      if (state === 'over') return;
    }
  }
  ebullets = ebullets.filter(b => b.life > 0);

  for (const m of minions) {
    m.t -= dt; m.atkCd = Math.max(0, m.atkCd - dt); m.walk += dt * 10;
    const t0 = nearestEnemy(m.x, m.y, 9999);
    if (t0) {
      const a = Math.atan2(t0.y - m.y, t0.x - m.x);
      m.x += Math.cos(a) * 230 * dt; m.y += Math.sin(a) * 230 * dt;
      if (Math.hypot(t0.x - m.x, t0.y - m.y) < t0.r + 16 * (m.rad || 1) * (1 + (m.c.sweep || 0)) && m.atkCd <= 0) {
        m.atkCd = 0.6 / (1 + (m.c.rapid || 0));
        areaHit(t0, m.dmg, m.c, m.x, m.y);
      }
    }
  }
  minions = minions.filter(m => m.t > 0);

  for (const tt of totems) {
    tt.t -= dt; tt.fireCd -= dt;
    if (tt.fireCd <= 0) {
      const t0 = nearestEnemy(tt.x, tt.y, 380 * (tt.rad || 1));
      if (t0) {
        tt.fireCd = 0.9;
        fireBullet(tt.x, tt.y - 14, Math.atan2(t0.y - tt.y, t0.x - tt.x), 380 * tt.proj, tt.dmg, 'nib',
          Object.assign({ hits: 1 + tt.pierce }, tt.ex));
      } else tt.fireCd = 0.2;
    }
  }
  totems = totems.filter(tt => tt.t > 0);

  // 涂改带刀阵：环绕碎片接触伤害
  for (let i = 0; i < blades.length; i++) {
    const bl = blades[i];
    bl.t -= dt; bl.ang += dt * 3.2;
    bl.x = player.x + Math.cos(bl.ang + i * 2.1) * 64 * bl.rad;
    bl.y = player.y + Math.sin(bl.ang + i * 2.1) * 64 * bl.rad;
    for (const e of enemies) {
      if (e.dead || e.vorCd > 0) continue;
      if (Math.hypot(e.x - bl.x, e.y - bl.y) < e.r + 10 * (1 + (bl.c.sweep || 0))) {
        e.vorCd = 0.35;
        areaHit(e, bl.dmg, bl.c, bl.x, bl.y);
      }
    }
  }
  blades = blades.filter(b => b.t > 0);

  // 追加一笔：延迟结算，目标已死亡则取消；副本关闭 followup 避免无限递归
  for (const f of followups) {
    f.t -= dt;
    if (f.t <= 0 && !f.e.dead) {
      areaHit(f.e, f.dmg, f.c, f.sx, f.sy);
      sparks.push({ x: f.e.x, y: f.e.y, t: 0.18, color: f.c.col });
    }
  }
  followups = followups.filter(f => f.t > 0);

  // 毒墨云：持续淋伤下方敌人（反复涂抹加快 tick，余墨延长，结束可二次晕染）
  for (const cl of clouds) {
    cl.t -= dt; cl.tick -= dt;
    if (cl.tick <= 0) {
      cl.tick = 0.3 / (1 + (cl.c.retick || 0));
      for (const e of enemies) {
        const d = Math.hypot(e.x - cl.x, e.y - cl.y);
        if (!e.dead && d < cl.r + e.r) areaHit(e, cl.dmg, cl.c, cl.x, cl.y, cl.r, d);
      }
    }
    if (cl.t <= 0 && cl.c.reburst && !cl.reburstDone) {
      cl.reburstDone = true;
      erupts.push({ x: cl.x, y: cl.y, delay: 0.1, dmg: cl.dmg * 4 * (0.5 + cl.c.reburst), r: cl.r,
        c: Object.assign({}, cl.c, { reburst: 0 }), done: false, t: 0 });
    }
  }
  clouds = clouds.filter(c => c.t > 0);

  // 橡皮筋烙印：周期电击并连锁，目标死亡则跳向附近敌人
  for (const br of brands) {
    br.t -= dt; br.tick -= dt;
    if (br.tgt.dead) {
      const nxt = nearestEnemy(br.tgt.x, br.tgt.y, 200);
      if (nxt) br.tgt = nxt; else { br.t = 0; }
    }
    if (br.t <= 0) {
      if (br.c.reburst && !br.reburstDone) {   // 二次晕染：烙印结束爆一下
        br.reburstDone = true;
        erupts.push({ x: br.tgt.x, y: br.tgt.y, delay: 0.1, dmg: br.dmg * 3 * (0.5 + br.c.reburst), r: 70,
          c: Object.assign({}, br.c, { reburst: 0 }), done: false, t: 0 });
      }
      continue;
    }
    if (br.tick <= 0) {
      br.tick = 0.7 / (1 + (br.c.retick || 0));
      const t0 = br.tgt;
      areaHit(t0, br.dmg, br.c, t0.x, t0.y);
      let sx = t0.x, sy = t0.y;
      const hitSet = [t0];
      for (let j = 0; j < br.chain; j++) {
        let nxt = null, bd = 150 * 150;
        for (const e of enemies) {
          if (e.dead || hitSet.includes(e)) continue;
          const d2 = (e.x - sx) ** 2 + (e.y - sy) ** 2;
          if (d2 < bd) { bd = d2; nxt = e; }
        }
        if (!nxt) break;
        lightnings.push({ x1: sx, y1: sy, x2: nxt.x, y2: nxt.y, t: 0.12, delay: 0, col: br.c.col });
        areaHit(nxt, br.dmg * 0.7, br.c, sx, sy);
        hitSet.push(nxt); sx = nxt.x; sy = nxt.y;
      }
    }
  }
  brands = brands.filter(b => b.t > 0);

  // 冰可乐新星扩散圈
  for (const nv of novas) nv.t -= dt;
  novas = novas.filter(n => n.t > 0);

  for (const l of lightnings) {
    if (l.delay > 0) { l.delay -= dt; continue; }
    if (l.prog !== undefined && l.prog < 1) {
      l.prog = Math.min(1, l.prog + dt / 0.07);   // 电弧头飞行
      if (l.prog >= 1 && l.tgt && !l.tgt.dead) {
        if (l.c) areaHit(l.tgt, l.dmg, l.c, l.x1, l.y1);
        else hurtEnemy(l.tgt, l.dmg, l.dmg * (l.dot || 0), l.x1, l.y1, l.vuln, 0, 0, l.col);
      }
    } else l.t -= dt;
  }
  lightnings = lightnings.filter(l => l.t > 0);
  for (const s of sparks) s.t -= dt;
  sparks = sparks.filter(s => s.t > 0);

  for (const dr of drops) {
    dr.bob += dt * 4;
    if (Math.hypot(player.x - dr.x, player.y - dr.y) < 20) {
      dr.got = true;
      const it = ITEM_DEFS[dr.item];
      const cur = player.equip[it.slot];
      if (cur && cur.key === dr.item) {   // 重复获得 → 强化，最高 Lv10
        if (cur.lvl < 10) { cur.lvl++; toast('【' + it.name + '】强化到 Lv' + cur.lvl + '！属性 +' + 20 * (cur.lvl - 1) + '%'); }
        else { toast('【' + it.name + '】已是 Lv10，化作墨水珠'); gems.push({ x: dr.x, y: dr.y, v: 10 }); }
      } else {
        player.equip[it.slot] = { key: dr.item, lvl: 1 };
        toast('获得【' + it.name + '】' + it.fx);
      }
      recomputeEquip();
    }
  }
  drops = drops.filter(dr => !dr.got);

  for (const g of gems) {
    const d = Math.hypot(player.x - g.x, player.y - g.y);
    if (d < player.pickup) {
      const a = Math.atan2(player.y - g.y, player.x - g.x), v = 260 + (player.pickup - d) * 6;
      g.x += Math.cos(a) * v * dt; g.y += Math.sin(a) * v * dt;
    }
    if (d < 14) {
      g.got = true; player.xp += g.v;
      if (hasItem('pendant')) player.hp = Math.min(player.maxhp, player.hp + 1);
    }
  }
  gems = gems.filter(g => !g.got);
  enemies = enemies.filter(e => !e.dead);

  for (const f of floats) { f.t -= dt; f.y -= 30 * dt; }
  floats = floats.filter(f => f.t > 0);
  for (const ts of toasts) ts.t -= dt;
  toasts = toasts.filter(ts => ts.t > 0);

  camX = Math.max(WORLD_L - 70, Math.min(WORLD_R + 70 - VIEW_W, player.x - VIEW_W / 2));
  camY = Math.max(WORLD_T - 70, Math.min(WORLD_B + 70 - VIEW_H, player.y - VIEW_H / 2));
}

/* ---------- 渲染 ---------- */
function drawPaper(st) {
  const x0 = camX - 80, y0 = camY - 80, x1 = camX + VIEW_W + 80, y1 = camY + VIEW_H + 80;
  // 桌面（纸外区域）：照片级木纹平铺，加载失败时退回纯色
  if (imgReady(IMG.desk)) {
    const ts = 620;
    for (let tx = Math.floor(x0 / ts) * ts; tx < x1; tx += ts)
      for (let ty = Math.floor(y0 / ts) * ts; ty < y1; ty += ts)
        ctx.drawImage(IMG.desk, tx, ty, ts, ts);
  } else {
    ctx.fillStyle = '#a58c70'; ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
    ctx.fillStyle = 'rgba(0,0,0,0.06)';
    for (let y = Math.floor(y0 / 90) * 90; y < y1; y += 90) ctx.fillRect(x0, y, x1 - x0, 1);
  }
  // 保留木纹质感，但整体提亮，避免桌面上的 HUD 被深色背景吃掉
  ctx.fillStyle = 'rgba(255,244,224,0.38)';
  ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
  // 纸张投影 + 纸面
  ctx.fillStyle = 'rgba(40,30,20,0.28)';
  ctx.fillRect(WORLD_L + 9, WORLD_T + 11, WORLD_W, WORLD_H);
  ctx.fillStyle = STAGE_PAPER[st - 1]; ctx.fillRect(WORLD_L, WORLD_T, WORLD_W, WORLD_H);
  ctx.save();
  ctx.beginPath(); ctx.rect(WORLD_L, WORLD_T, WORLD_W, WORLD_H); ctx.clip();
  // 纸质噪点 + 纸纤维（静止，不随沸腾抖动）
  const _bt = boilT; boilT = 0;
  for (let gx = Math.floor(x0 / 120) * 120; gx < x1; gx += 120)
    for (let gy = Math.floor(y0 / 120) * 120; gy < y1; gy += 120) {
      setSeed(gx * 7 + gy * 13);
      ctx.fillStyle = 'rgba(120,110,88,0.12)';
      for (let i = 0; i < 4; i++) ctx.fillRect(gx + srand() * 120, gy + srand() * 120, 1.6, 1.6);
      if (srand() < 0.4) {  // 纸纤维短丝
        const fx = gx + srand() * 120, fy = gy + srand() * 120, fa = srand() * Math.PI;
        jline(fx, fy, fx + Math.cos(fa) * 9, fy + Math.sin(fa) * 9, 'rgba(140,130,105,0.18)', 0.8);
      }
    }
  boilT = _bt;
  ctx.lineWidth = 1;
  const hlines = (gap, off, color) => {
    ctx.strokeStyle = color || LINE; ctx.beginPath();
    for (let y = Math.floor(y0 / gap) * gap + off; y < y1; y += gap) { ctx.moveTo(x0, y); ctx.lineTo(x1, y); }
    ctx.stroke();
  };
  const vlines = (gap, off, color) => {
    ctx.strokeStyle = color || LINE; ctx.beginPath();
    for (let x = Math.floor(x0 / gap) * gap + off; x < x1; x += gap) { ctx.moveTo(x, y0); ctx.lineTo(x, y1); }
    ctx.stroke();
  };
  if (st === 1) {          // 横线练习本 + 红边
    hlines(32, 0);
    ctx.strokeStyle = 'rgba(192,57,43,.5)'; ctx.lineWidth = 1.5; ctx.beginPath();
    for (let wx = Math.floor(x0 / 600) * 600; wx < x1 + 600; wx += 600) { ctx.moveTo(wx + 48, y0); ctx.lineTo(wx + 48, y1); }
    ctx.stroke();
  } else if (st === 2) {   // 数学方格本
    hlines(32, 0); vlines(32, 0);
  } else if (st === 3) {   // 田字格
    hlines(64, 0); vlines(64, 0);
    ctx.setLineDash([4, 4]); hlines(64, 32); vlines(64, 32); ctx.setLineDash([]);
  } else if (st === 4) {   // 英语本（四线三格）
    for (let y = Math.floor(y0 / 64) * 64; y < y1; y += 64) {
      ctx.strokeStyle = LINE; ctx.beginPath();
      ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke();
      ctx.setLineDash([3, 3]); ctx.beginPath();
      for (const o of [16, 32, 48]) { ctx.moveTo(x0, y + o); ctx.lineTo(x1, y + o); }
      ctx.stroke(); ctx.setLineDash([]);
    }
  } else if (st === 5) {   // 米字格
    hlines(64, 0); vlines(64, 0);
    ctx.setLineDash([4, 4]); hlines(64, 32); vlines(64, 32);
    ctx.strokeStyle = LINE; ctx.beginPath();
    for (let x = Math.floor(x0 / 64) * 64; x < x1; x += 64)
      for (let y = Math.floor(y0 / 64) * 64; y < y1; y += 64) {
        ctx.moveTo(x, y); ctx.lineTo(x + 64, y + 64);
        ctx.moveTo(x + 64, y); ctx.lineTo(x, y + 64);
      }
    ctx.stroke(); ctx.setLineDash([]);
  } else if (st === 6) {   // 作文本（小方格）
    hlines(36, 0); vlines(36, 0);
  } else if (st === 7) {   // 五线谱本
    ctx.strokeStyle = '#a8b6c8'; ctx.beginPath();
    for (let y = Math.floor(y0 / 72) * 72; y < y1; y += 72)
      for (let o = 0; o < 5; o++) { ctx.moveTo(x0, y + o * 8); ctx.lineTo(x1, y + o * 8); }
    ctx.stroke();
  } else if (st === 8) {   // 点阵本
    ctx.fillStyle = LINE;
    for (let x = Math.floor(x0 / 24) * 24; x < x1; x += 24)
      for (let y = Math.floor(y0 / 24) * 24; y < y1; y += 24) ctx.fillRect(x - 1, y - 1, 2, 2);
  } else if (st === 9) {   // 坐标纸（细格+粗格）
    hlines(16, 0, '#dce8f6'); vlines(16, 0, '#dce8f6');
    hlines(80, 0); vlines(80, 0);
  } else {                 // 草稿纸：散落的大涂鸦圈
    setSeed(999);
    for (let wx = Math.floor(x0 / 500) * 500; wx < x1 + 500; wx += 500)
      for (let wy = Math.floor(y0 / 500) * 500; wy < y1 + 500; wy += 500) {
        setSeed(wx * 13 + wy);
        jcircle(wx + 150 + srand() * 200, wy + 150 + srand() * 200, 30 + srand() * 40, '#ddd5c0', 1.5);
      }
  }
  ctx.restore();
  // 左侧铁环装订：打孔 + 露出纸面的铁环 + 装订压痕
  setSeed(77);
  ctx.setLineDash([3, 4]); ctx.strokeStyle = 'rgba(0,0,0,0.13)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(WORLD_L + 26, WORLD_T + 10); ctx.lineTo(WORLD_L + 26, WORLD_B - 10); ctx.stroke();
  ctx.setLineDash([]);
  for (let y = WORLD_T + 50; y < WORLD_B - 30; y += 80) {
    if (imgReady(IMG.ring)) {
      // 照片级金属铁环：只画纸外的金属弧，伸进纸里的弧线整段藏到纸下，只露两个穿孔铁环头
      ctx.fillStyle = 'rgba(0,0,0,0.22)';
      ctx.beginPath(); ctx.ellipse(WORLD_L + 2, y + 13, 15, 4, 0, 0, 7); ctx.fill();
      ctx.save();
      ctx.beginPath(); ctx.rect(x0, y0, WORLD_L - x0, y1 - y0); ctx.clip();   // 纸面以外才绘制
      ctx.drawImage(IMG.ring, WORLD_L - 25, y - 18, 36, 36);
      ctx.restore();
      // 两个穿纸孔（深色小孔）
      ctx.fillStyle = 'rgba(30,25,20,0.85)';
      ctx.beginPath(); ctx.ellipse(WORLD_L + 4, y - 6.5, 3.2, 1.6, 0, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.ellipse(WORLD_L + 4, y + 6.5, 3.2, 1.6, 0, 0, 7); ctx.fill();
      // 孔口露出的两小段金属（从原图右弧裁出）
      const s = 36 / 256;
      ctx.drawImage(IMG.ring, 198, 26, 58, 70, WORLD_L - 25 + 198 * s, y - 18 + 26 * s, 58 * s, 70 * s);
      ctx.drawImage(IMG.ring, 198, 160, 58, 70, WORLD_L - 25 + 198 * s, y - 18 + 160 * s, 58 * s, 70 * s);
    } else {
      jcircle(WORLD_L - 7, y, 11, '#8a8a8a', 3);  // 退回手绘铁环
    }
  }
  // 上/右/下三边：真实纸张裁切边，不再画手绘线（保留纸张投影即可）
}

function drawBoss(e, c) {
  const x = e.x, y = e.y, r = e.r, w = e.walk;
  const swing = Math.sin(w) * r * 0.16;
  const blob = (bx, by, bw, bh, lw) => {   // 不规则豆子形轮廓
    const n = 16;
    ctx.strokeStyle = c; ctx.lineWidth = lw || 3; ctx.lineCap = 'round';
    ctx.beginPath();
    for (let i = 0; i <= n; i++) {
      const a = i / n * Math.PI * 2;
      const wob = 1 + (srand() - 0.5) * 0.18;
      const px = bx + Math.cos(a) * bw * 0.5 * wob, py = by + Math.sin(a) * bh * 0.5 * wob;
      if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
    }
    ctx.closePath(); ctx.stroke();
  };
  const feet = (ly, len) => {   // L 形小短腿
    const L = len || 0.26;
    for (const sgn of [-1, 1]) {
      const fx = x + sgn * r * 0.3 + (sgn < 0 ? -swing : swing);
      jline(x + sgn * r * 0.3, y + ly, fx, y + ly + r * L, c, 2.5);
      jline(fx, y + ly + r * L, fx + sgn * r * 0.2, y + ly + r * L, c, 2.5);
    }
  };
  const arms = (ay, spread) => {
    jline(x - r * spread, y + ay, x - r * (spread + 0.32), y + ay + r * 0.2 + swing * 1.2, c, 2.5);
    jline(x + r * spread, y + ay, x + r * (spread + 0.32), y + ay + r * 0.2 - swing * 1.2, c, 2.5);
  };
  const eye = (ex, ey, er, inv) => {   // 大眼（inv=黑底白睛，用于填充系Boss）
    ctx.fillStyle = inv ? '#fdfcf7' : '#fdfcf7';
    ctx.beginPath(); ctx.arc(ex, ey, er, 0, 7); ctx.fill();
    jcircle(ex, ey, er, inv ? '#fdfcf7' : c, 2);
    ctx.fillStyle = c; ctx.beginPath(); ctx.arc(ex, ey, er * 0.38, 0, 7); ctx.fill();
  };
  const mouth = (my, mw, mh) => {  // 大张嘴 + 上下锯齿牙
    ctx.fillStyle = c; ctx.beginPath(); ctx.ellipse(x, y + my, mw, mh, 0, 0, 7); ctx.fill();
    for (let i = 0; i < 4; i++) {
      const tx = x - mw + (i + 0.5) * mw / 2;
      jline(tx - mw * 0.16, y + my - mh + 1, tx, y + my - mh * 0.3, '#fdfcf7', 1.8);
      jline(tx, y + my - mh * 0.3, tx + mw * 0.16, y + my - mh + 1, '#fdfcf7', 1.8);
      jline(tx - mw * 0.16, y + my + mh - 1, tx, y + my + mh * 0.3, '#fdfcf7', 1.5);
      jline(tx, y + my + mh * 0.3, tx + mw * 0.16, y + my + mh - 1, '#fdfcf7', 1.5);
    }
  };

  if (e.stage === 1) {          // 乱线魔王：炸毛豆子（头顶乱线）
    blob(x, y, r * 1.5, r * 1.6, 3);
    for (let i = 0; i < 8; i++) {  // 炸毛
      const a = -Math.PI * 0.85 + i / 8 * Math.PI * 0.7;
      jline(x + Math.cos(a + Math.PI / 2) * r * 0.55, y - r * 0.55 + Math.sin(a) * r * 0.2,
            x + Math.cos(a + Math.PI / 2) * r * 0.95 + (srand() - 0.5) * 8, y - r * 1.05 + (srand() - 0.5) * 6, c, 2);
    }
    eye(x, y - r * 0.18, r * 0.34);
    mouth(r * 0.38, r * 0.42, r * 0.24);
    arms(r * 0.08, 0.72);
    feet(r * 0.72);
  } else if (e.stage === 2) {   // 涂改巨灵：又宽又扁 + 下挂滴液
    blob(x, y, r * 2.3, r * 1.0, 3);
    for (const [ox, oy] of [[-0.6, -0.55], [0, -0.72], [0.6, -0.55]]) {
      jline(x + ox * r, y - r * 0.18, x + ox * r, y + oy * r, c, 2);
      eye(x + ox * r, y + oy * r, r * 0.15);
    }
    mouth(r * 0.15, r * 0.6, r * 0.16);
    for (let i = 0; i < 6; i++) {  // 挂着一排滴液腿
      const tx = x - r * 0.75 + i * r * 0.3;
      const dy = y + r * 0.42 + Math.abs(Math.sin(w + i)) * 8;
      jline(tx, y + r * 0.4, tx, dy, c, 2);
      jcircle(tx, dy + 4, 3, c, 2);
    }
  } else if (e.stage === 3) {   // 红笔判官：高瘦长条 + 红笔当剑
    blob(x, y, r * 1.0, r * 2.1, 3);
    eye(x, y - r * 0.55, r * 0.26);
    jline(x - r * 0.3, y + r * 0.05, x + r * 0.3, y + r * 0.05, c, 3);  // 抿嘴
    jline(x + r * 0.55, y + r * 0.1, x + r * 1.1, y - r * 0.7, RED, 4);  // 红笔
    jline(x + r * 1.1, y - r * 0.7, x + r * 1.2, y - r * 0.85, RED, 2);
    arms(r * 0.05, 0.5);
    feet(r * 0.95, 0.34);
  } else if (e.stage === 4) {   // 空想巨龙：横行长条身 + 大三角翼
    const dir = Math.sign(player.x - x) || 1;
    const flap = Math.sin(w * 2.2) * r * 0.14;
    // 尾（身后波浪线）
    jline(x - dir * r * 0.8, y, x - dir * r * 1.3, y - r * 0.2 + flap, c, 2.5);
    jline(x - dir * r * 1.3, y - r * 0.2 + flap, x - dir * r * 1.7, y + r * 0.1 - flap, c, 2.5);
    // 大翅膀（头顶两只大三角）
    for (const sgn of [0.35, 1]) {
      jline(x - dir * r * sgn, y - r * 0.35, x - dir * r * sgn + dir * r * 0.2, y - r * 1.5 - flap, c, 3);
      jline(x - dir * r * sgn + dir * r * 0.2, y - r * 1.5 - flap, x - dir * r * sgn + dir * r * 0.9, y - r * 0.5, c, 3);
    }
    blob(x, y, r * 2.1, r * 1.1, 3);           // 横长身体
    blob(x + dir * r * 1.0, y - r * 0.25, r * 0.95, r * 0.85, 3);  // 前伸大头
    eye(x + dir * r * 1.05, y - r * 0.35, r * 0.16);
    jline(x + dir * r * 1.3, y - r * 0.05, x + dir * r * 1.55, y + r * 0.05, c, 2.5);  // 吻
    jline(x + dir * r * 0.85, y - r * 0.6, x + dir * r * 0.75, y - r * 0.9, c, 2.5);   // 角
    feet(r * 0.42);
  } else if (e.stage === 5) {   // 涂鸦骑士团长：举盾持剑头盔
    blob(x, y, r * 1.6, r * 1.6, 3);
    ctx.beginPath(); ctx.strokeStyle = c; ctx.lineWidth = 3.5;
    ctx.arc(x, y - r * 0.08, r * 0.72, Math.PI * 1.05, Math.PI * -0.05); ctx.stroke();
    jline(x - r * 0.15, y - r * 0.85, x + r * 0.15, y - r * 0.85, c, 2.5);  // 十字盔缨
    jline(x, y - r * 0.95, x, y - r * 0.75, c, 2.5);
    jrect(x - r * 0.55, y + r * 0.05, r * 0.6, r * 0.75, c, 2.5);   // 盾牌（左前）
    jline(x - r * 0.25, y + r * 0.05, x - r * 0.25, y + r * 0.8, c, 1.5);
    jline(x + r * 0.75, y, x + r * 1.3, y - r * 0.75, c, 3);        // 剑（右举）
    jline(x + r * 1.15, y - r * 0.5, x + r * 1.42, y - r * 0.62, c, 2);
    eye(x - r * 0.18, y + r * 0.02, r * 0.14);
    eye(x + r * 0.3, y + r * 0.02, r * 0.14);
    feet(r * 0.74);
  } else if (e.stage === 6) {   // 墨水元素：水滴形悬浮（无腿）
    blob(x, y, r * 1.25, r * 1.7, 3);
    jline(x - r * 0.3, y - r * 0.75, x, y - r * 1.15, c, 3);   // 尖头顶
    jline(x + r * 0.3, y - r * 0.75, x, y - r * 1.15, c, 3);
    eye(x - r * 0.2, y - r * 0.35, r * 0.17);
    eye(x + r * 0.22, y - r * 0.1, r * 0.15);
    eye(x - r * 0.05, y + r * 0.15, r * 0.2);
    for (let i = 0; i < 3; i++)   // 悬浮滴墨
      jcircle(x - r * 0.4 + i * r * 0.4, y + r * 1.05 + Math.sin(w * 1.5 + i * 2) * 6, 4, c, 2);
    arms(r * 0.1, 0.62);
  } else if (e.stage === 7) {   // 折纸龙王：全直线折纸（没有曲线）
    const dir = Math.sign(player.x - x) || 1;
    const T = (x1, y1, x2, y2, x3, y3) => { jline(x1, y1, x2, y2, c, 2.5); jline(x2, y2, x3, y3, c, 2.5); jline(x3, y3, x1, y1, c, 2.5); };
    T(x - r * 0.7, y - r * 0.5, x + r * 0.7, y - r * 0.5, x, y + r * 0.8);          // 菱形身下半
    T(x - r * 0.7, y - r * 0.5, x + r * 0.7, y - r * 0.5, x, y - r * 1.3);          // 上半
    jline(x, y - r * 1.3, x, y + r * 0.8, c, 1.8);                                   // 折痕
    T(x + dir * r * 0.7, y - r * 0.75, x + dir * r * 1.45, y - r * 0.55, x + dir * r * 0.9, y - r * 0.15);  // 三角头
    eye(x + dir * r * 0.98, y - r * 0.52, r * 0.13);
    T(x - dir * r * 0.7, y - r * 0.55, x - dir * r * 1.5, y - r * 1.1 + Math.sin(w * 2) * 8, x - dir * r * 0.5, y - r * 0.1);  // 折纸翼
    jline(x - dir * r * 0.2, y + r * 0.75, x - dir * r * 0.9, y + r * 1.0, c, 2.5);  // 折纸尾
    jline(x - dir * r * 0.9, y + r * 1.0, x - dir * r * 0.6, y + r * 1.2, c, 2.5);
    feet(r * 0.78);
  } else if (e.stage === 8) {   // 暴走橡皮：又低又宽方墩
    blob(x, y, r * 2.1, r * 1.15, 3.5);
    jline(x - r * 0.95, y - r * 0.1, x + r * 0.95, y - r * 0.1, c, 2);   // 包装带
    jline(x - r * 0.95, y + r * 0.08, x + r * 0.95, y + r * 0.08, c, 2);
    jline(x - r * 0.5, y - r * 0.45, x - r * 0.18, y - r * 0.28, RED, 3.5);
    jline(x + r * 0.5, y - r * 0.45, x + r * 0.18, y - r * 0.28, RED, 3.5);
    eye(x - r * 0.32, y + r * 0.02, r * 0.16);
    eye(x + r * 0.32, y + r * 0.02, r * 0.16);
    mouth(r * 0.34, r * 0.42, r * 0.1);
    arms(r * 0.05, 1.0);
    feet(r * 0.5);
  } else if (e.stage === 9) {   // 万墨之渊：涂黑实心团（唯一填充系）
    ctx.save();
    ctx.beginPath(); ctx.arc(x, y, r * 0.85, 0, 7); ctx.clip();
    scribbleFill(x - r * 0.9, y - r * 0.9, r * 1.8, r * 1.8, c);
    ctx.restore();
    blob(x, y, r * 1.9, r * 1.8, 3);
    eye(x - r * 0.32, y - r * 0.35, r * 0.18);
    eye(x + r * 0.3, y - r * 0.2, r * 0.14);
    eye(x - r * 0.05, y + r * 0.12, r * 0.21);
    eye(x + r * 0.42, y + r * 0.28, r * 0.12);
    for (let i = 0; i < 6; i++) {  // 触手腿
      const a = Math.PI * 0.1 + i / 6 * Math.PI * 0.8;
      const bx = x + Math.cos(a) * r * 0.8, by = y + Math.sin(a) * r * 0.78;
      jline(bx, by, bx + Math.cos(a) * r * 0.4 + Math.sin(w + i) * 7, by + Math.sin(a) * r * 0.4 + 8, c, 2.5);
    }
  } else {                      // 笔记本之主：披风王冠巨口（最大只）
    jline(x - r * 0.7, y - r * 0.3, x - r * 1.3, y + r * 0.9, c, 3);   // 披风
    jline(x + r * 0.7, y - r * 0.3, x + r * 1.3, y + r * 0.9, c, 3);
    jline(x - r * 1.3, y + r * 0.9, x + r * 1.3, y + r * 0.9, c, 2.5);
    blob(x, y, r * 1.8, r * 1.7, 3.5);
    for (let i = 0; i < 3; i++) {  // 铅笔王冠
      const cx = x - r * 0.42 + i * r * 0.42;
      jline(cx, y - r * 0.72, cx, y - r * 1.12, c, 3);
      jline(cx, y - r * 1.12, cx + 3.5, y - r * 1.0, c, 2);
      jline(cx, y - r * 1.12, cx - 3.5, y - r * 1.0, c, 2);
    }
    eye(x - r * 0.34, y - r * 0.3, r * 0.19);
    eye(x + r * 0.34, y - r * 0.3, r * 0.19);
    eye(x, y - r * 0.02, r * 0.26);
    mouth(r * 0.5, r * 0.55, r * 0.28);
    arms(r * 0.02, 0.88);
    feet(r * 0.78);
  }
  if (e.arch === 'charger' && e.mode === 'aim') {  // 冲刺预警：红色虚线
    ctx.globalAlpha = 0.35 + 0.35 * Math.sin(e.modeT * 30);
    for (let d = 20; d < 280; d += 26)
      jline(e.x + e.chargeDx * d, e.y + e.chargeDy * d, e.x + e.chargeDx * (d + 14), e.y + e.chargeDy * (d + 14), RED, 2.5);
    ctx.globalAlpha = 1;
  }
  if (e.phase === 2) {  // 暴走：红笔描边
    setSeed(e.id + 77);
    jcircle(x, y, r + 7, RED, 1.5);
  }
}
function drawEnemy(e) {
  setSeed(e.id);
  const c = e.flash > 0 ? FLASH : DARK;
  const p = 1 - e.squash / SQUASH_T;
  const k = Math.pow(Math.max(0, 1 - p), 0.6);
  ctx.save();
  if (k > 0.01) {
    ctx.translate(e.x + (srand() - 0.5) * 3 * k, e.y + (srand() - 0.5) * 2.5 * k);
    ctx.scale(1 + 0.5 * k, 1 - 0.42 * k);
    ctx.translate(-e.x, -e.y);
  }
  if (e.type === 'stick') drawStick(e.x, e.y, 26, e.walk, c);
  else if (e.type === 'spider') {
    jcircle(e.x, e.y, e.r, c, 2);
    for (let i = 0; i < 8; i++) {
      const a = i / 8 * Math.PI * 2 + Math.sin(e.walk) * 0.25;
      jline(e.x + Math.cos(a) * e.r * 0.6, e.y + Math.sin(a) * e.r * 0.6,
            e.x + Math.cos(a) * e.r * 2.1, e.y + Math.sin(a) * e.r * 2.1, c, 1.5);
    }
  } else if (e.type === 'rage') {
    jcircle(e.x, e.y, e.r, c, 2.5);
    jline(e.x - e.r * 0.55, e.y - e.r * 0.45, e.x - e.r * 0.12, e.y - e.r * 0.12, c, 2);
    jline(e.x + e.r * 0.55, e.y - e.r * 0.45, e.x + e.r * 0.12, e.y - e.r * 0.12, c, 2);
    jline(e.x - e.r * 0.4, e.y + e.r * 0.5, e.x + e.r * 0.4, e.y + e.r * 0.5, c, 2);
  } else if (e.type === 'plane') {
    const a = Math.atan2(e.vy, e.vx), c1 = Math.cos(a), s1 = Math.sin(a);
    const tx = e.x + c1 * 16, ty = e.y + s1 * 16;
    const lx = e.x - c1 * 8 - s1 * 10, ly = e.y - s1 * 8 + c1 * 10;
    const rx = e.x - c1 * 8 + s1 * 10, ry = e.y - s1 * 8 - c1 * 10;
    jline(tx, ty, lx, ly, c, 2); jline(tx, ty, rx, ry, c, 2); jline(lx, ly, rx, ry, c, 2);
  } else if (e.boss) drawBoss(e, c);
  if (e.dotT > 0) {
    setSeed(e.id + 31);
    const ey = e.y - e.r - 8;
    jline(e.x - 6, ey, e.x - 2, ey - 3, RED, 1.5);
    jline(e.x - 2, ey - 3, e.x + 2, ey, RED, 1.5);
    jline(e.x + 2, ey, e.x + 6, ey - 3, RED, 1.5);
  }
  ctx.restore();
}

function render() {
  ctx.setTransform(viewScale, 0, 0, viewScale, 0, 0);
  ctx.fillStyle = PAPER; ctx.fillRect(0, 0, W, H);
  ctx.save();
  if (shakeT > 0) ctx.translate((Math.random() - 0.5) * 5, (Math.random() - 0.5) * 5);
  // camX/camY 已经是缩放后视野的世界左上角，直接平移即可让玩家保持屏幕居中
  ctx.scale(ZOOM, ZOOM);
  ctx.translate(-camX, -camY);

  drawPaper(curStage || 1);

  for (const er of erupts) {
    setSeed(3000 + Math.floor(er.x));
    const ec = er.c && er.c.col ? er.c.col : INK;
    if (!er.done && er.warn) {   // 粉笔头落点：属性色涂鸦预警圈（随延迟收缩）
      ctx.globalAlpha = 0.4 + 0.3 * Math.sin(er.delay * 20);
      jcircle(er.x, er.y, er.r * (0.5 + er.delay), ec, 1.8);
      jline(er.x - 8, er.y, er.x + 8, er.y, ec, 1.5);
      jline(er.x, er.y - 8, er.x, er.y + 8, ec, 1.8);
      ctx.globalAlpha = 1;
    }
    if (er.done) {   // 火山压痕无预警，直接喷发
      ctx.globalAlpha = er.t / 0.3;
      jcircle(er.x, er.y, er.r * (1.3 - er.t), ec, 2.5);
      for (let i = 0; i < 5; i++) {
        const a = i / 5 * Math.PI * 2;
        jline(er.x, er.y, er.x + Math.cos(a) * er.r, er.y + Math.sin(a) * er.r, ec, 1.5);
      }
      ctx.globalAlpha = 1;
    }
  }
  // Boss 危险区渲染：预警(红叉/红线) → 爆发
  for (const hz of hazards) {
    setSeed(2000 + Math.floor(hz.x * 3 + hz.y));
    if (hz.kind === 'meteor') {
      if (!hz.done) {
        ctx.globalAlpha = 0.45 + 0.35 * Math.sin(hz.delay * 25);
        jline(hz.x - 10, hz.y - 10, hz.x + 10, hz.y + 10, RED, 2.5);
        jline(hz.x + 10, hz.y - 10, hz.x - 10, hz.y + 10, RED, 2.5);
        jcircle(hz.x, hz.y, hz.r * 0.62, RED, 1.2);
      } else {
        ctx.globalAlpha = hz.t / 0.35;
        jcircle(hz.x, hz.y, hz.r * (1.25 - hz.t), RED, 2.5);
        for (let i = 0; i < 5; i++) {
          const a = i / 5 * Math.PI * 2;
          jline(hz.x, hz.y, hz.x + Math.cos(a) * hz.r * 0.9, hz.y + Math.sin(a) * hz.r * 0.9, RED, 1.5);
        }
      }
      ctx.globalAlpha = 1;
    } else {
      const a0 = hz.ang - hz.arc / 2, a1 = hz.ang + hz.arc / 2;
      if (!hz.done) {
        ctx.globalAlpha = 0.35 + 0.3 * Math.sin(hz.delay * 22);
        jline(hz.x, hz.y, hz.x + Math.cos(a0) * hz.range, hz.y + Math.sin(a0) * hz.range, RED, 2);
        jline(hz.x, hz.y, hz.x + Math.cos(a1) * hz.range, hz.y + Math.sin(a1) * hz.range, RED, 2);
        jline(hz.x, hz.y, hz.x + Math.cos(hz.ang) * hz.range, hz.y + Math.sin(hz.ang) * hz.range, RED, 1.2);
      } else {
        ctx.globalAlpha = hz.t / 0.6 * 0.9;
        for (let i = 0; i <= 8; i++) {
          const a = a0 + (a1 - a0) * i / 8;
          const rr = hz.range * (0.55 + srand() * 0.45);
          jline(hz.x + Math.cos(a) * 20, hz.y + Math.sin(a) * 20, hz.x + Math.cos(a) * rr, hz.y + Math.sin(a) * rr, RED, 2);
        }
      }
      ctx.globalAlpha = 1;
    }
  }
  for (const g of gems) {
    ctx.fillStyle = PICKUP;
    ctx.beginPath(); ctx.arc(g.x, g.y, 4, 0, 7); ctx.fill();
    setSeed(5000 + Math.floor(g.x * 7 + g.y)); jcircle(g.x, g.y, 4.5, PICKUP, 1.2);
  }
  for (const dr of drops) {
    const bobY = dr.y + Math.sin(dr.bob) * 3;
    setSeed(7000 + Math.floor(dr.x));
    jrect(dr.x - 8, bobY - 8, 16, 16, PICKUP, 2);
    jline(dr.x - 4, bobY, dr.x + 4, bobY, PICKUP, 2);
  }
  for (const e of enemies) drawEnemy(e);
  for (const m of minions) {
    setSeed(m.walk * 1000 | 0);
    if (m.ghost) {   // 赦免粉笔拉起来的幽灵小鬼：半透明描边
      ctx.globalAlpha = 0.55;
      drawStick(m.x, m.y, 18, m.walk, INK);
      jline(m.x - 5, m.y + 9, m.x - 2, m.y + 5, INK, 1.2);
      jline(m.x - 2, m.y + 5, m.x + 1, m.y + 9, INK, 1.2);
      jline(m.x + 1, m.y + 9, m.x + 4, m.y + 5, INK, 1.2);
      ctx.globalAlpha = 1;
    } else drawStick(m.x, m.y, 18, m.walk, ALLY);
  }
  for (const tt of totems) {
    setSeed(7000 + Math.floor(tt.x));
    jcircle(tt.x, tt.y - 10, 7, ALLY, 2.5);
    jline(tt.x, tt.y - 4, tt.x, tt.y + 8, DARK, 2.5);
    scribbleFill(tt.x - 5, tt.y - 13, 10, 6, ALLY);
  }
  // 毒墨云：涂鸦云团 + 雨线
  for (const cl of clouds) {
    setSeed(7300 + Math.floor(cl.x));
    const cc = cl.c.col || INK;
    ctx.globalAlpha = Math.min(0.85, cl.t);
    jcircle(cl.x - cl.r * 0.4, cl.y - cl.r * 0.7, cl.r * 0.32, cc, 2);
    jcircle(cl.x + cl.r * 0.1, cl.y - cl.r * 0.85, cl.r * 0.4, cc, 2);
    jcircle(cl.x + cl.r * 0.5, cl.y - cl.r * 0.65, cl.r * 0.28, cc, 2);
    scribbleFill(cl.x - cl.r * 0.6, cl.y - cl.r * 0.95, cl.r * 1.2, cl.r * 0.5, cc);
    for (let i = 0; i < 4; i++) {
      const rx = cl.x - cl.r * 0.5 + i * cl.r * 0.33 + (srand() - 0.5) * 6;
      jline(rx, cl.y - cl.r * 0.3, rx - 3, cl.y + cl.r * 0.35 + srand() * 8, cc, 1.3);
    }
    ctx.globalAlpha = 1;
  }
  // 涂改带刀阵：环绕的锯齿碎片
  for (const bl of blades) {
    setSeed(7600 + Math.floor(bl.ang * 10));
    const bc0 = bl.c.col || INK;
    ctx.globalAlpha = Math.min(1, bl.t * 2);
    const ba = bl.ang + Math.PI / 2, bc = Math.cos(ba), bs = Math.sin(ba);
    jline(bl.x + bc * 7, bl.y + bs * 7, bl.x - bc * 7 - bs * 4, bl.y - bs * 7 + bc * 4, bc0, 2.5);
    jline(bl.x + bc * 7, bl.y + bs * 7, bl.x - bc * 7 + bs * 4, bl.y - bs * 7 - bc * 4, bc0, 2.5);
    jline(bl.x - bc * 7 - bs * 4, bl.y - bs * 7 + bc * 4, bl.x - bc * 7 + bs * 4, bl.y - bs * 7 - bc * 4, bc0, 1.5);
    ctx.globalAlpha = 1;
  }
  // 橡皮筋烙印：目标身上的拉伸橡皮筋圈
  for (const br of brands) {
    setSeed(7900 + br.tgt.id);
    ctx.globalAlpha = Math.min(1, br.t);
    jcircle(br.tgt.x, br.tgt.y, br.tgt.r + 5 + Math.sin(br.t * 10) * 2, br.c.col || PURPLE, 2.5);
    ctx.globalAlpha = 1;
  }
  // 冰可乐新星：扩散的泡泡圈
  for (const nv of novas) {
    const k = 1 - nv.t / 0.35;
    setSeed(7950);
    ctx.globalAlpha = 1 - k;
    jcircle(nv.x, nv.y, nv.max * (0.3 + 0.7 * k), nv.col || ARC, 3);
    jcircle(nv.x, nv.y, nv.max * (0.2 + 0.6 * k), nv.col || INK, 1.5);
    ctx.globalAlpha = 1;
  }
  if (getActive('cyclone')) {
    const cc = skillCalc(getActive('cyclone'));
    const rad = 74 * cc.rad * (1 + cc.sweep);
    for (let i = 0; i < 3; i++) {
      const a = cycAng + i * Math.PI * 2 / 3;
      const x1 = player.x + Math.cos(a) * rad, y1 = player.y + Math.sin(a) * rad;
      const x2 = player.x + Math.cos(a + 0.9) * rad, y2 = player.y + Math.sin(a + 0.9) * rad;
      setSeed(8800 + i);
      jline(x1, y1, x2, y2, cc.col, 4);
    }
  }
  for (const b of bullets) {
    setSeed(6000 + (b.kind === 'ink' ? 7 : 0));
    const a = Math.atan2(b.vy, b.vx);
    const bc = b.col || INK;   // 属性色：物理灰/火橙/冰浅蓝/雷蓝紫
    if (b.kind === 'torn') {
      const c1 = Math.cos(a), s1 = Math.sin(a);
      jline(b.x + c1 * 8, b.y + s1 * 8, b.x - c1 * 5 - s1 * 6, b.y - s1 * 5 + c1 * 6, bc, 1.8);
      jline(b.x + c1 * 8, b.y + s1 * 8, b.x - c1 * 5 + s1 * 6, b.y - s1 * 5 - c1 * 6, bc, 1.8);
    } else if (b.kind === 'chain') {
      jrect(b.x - 3, b.y - 5, 6, 10, bc, 1.8);
    } else if (b.kind === 'ink') {
      jcircle(b.x, b.y, 4, bc, 2);
    } else if (b.kind === 'boom') {   // 回旋的橡皮擦：小方块 + 包装带
      const c1 = Math.cos(a), s1 = Math.sin(a);
      jline(b.x - c1 * 6 - s1 * 4, b.y - s1 * 6 + c1 * 4, b.x + c1 * 6 - s1 * 4, b.y + s1 * 6 + c1 * 4, bc, 2.5);
      jline(b.x + c1 * 6 - s1 * 4, b.y + s1 * 6 + c1 * 4, b.x + c1 * 6 + s1 * 4, b.y + s1 * 6 - c1 * 4, bc, 2.5);
      jline(b.x + c1 * 6 + s1 * 4, b.y + s1 * 6 - c1 * 4, b.x - c1 * 6 + s1 * 4, b.y - s1 * 6 - c1 * 4, bc, 2.5);
      jline(b.x - c1 * 6 + s1 * 4, b.y - s1 * 6 - c1 * 4, b.x - c1 * 6 - s1 * 4, b.y - s1 * 6 + c1 * 4, bc, 2.5);
      jline(b.x - s1 * 4, b.y + c1 * 4, b.x + s1 * 4, b.y - c1 * 4, bc, 1.2);
    } else if (b.kind === 'ice') {   // 冰锥：尖三角碎片
      const c1 = Math.cos(a), s1 = Math.sin(a);
      jline(b.x + c1 * 11, b.y + s1 * 11, b.x - c1 * 6 - s1 * 5, b.y - s1 * 6 + c1 * 5, bc, 2.5);
      jline(b.x + c1 * 11, b.y + s1 * 11, b.x - c1 * 6 + s1 * 5, b.y - s1 * 6 - c1 * 5, bc, 2.5);
      jline(b.x - c1 * 6 - s1 * 5, b.y - s1 * 6 + c1 * 5, b.x - c1 * 6 + s1 * 5, b.y - s1 * 6 - c1 * 5, bc, 1.5);
    } else if (b.kind === 'pin') {   // 大头钉：圆头 + 针尖
      jcircle(b.x - Math.cos(a) * 4, b.y - Math.sin(a) * 4, 2.8, bc, 2);
      jline(b.x - Math.cos(a) * 3, b.y - Math.sin(a) * 3, b.x + Math.cos(a) * 7, b.y + Math.sin(a) * 7, bc, 1.8);
    } else {
      jline(b.x, b.y, b.x - Math.cos(a) * 10, b.y - Math.sin(a) * 10, bc, 3);
    }
  }
  for (const eb of ebullets) {  // 敌方墨弹：红笔点
    setSeed(6500 + Math.floor(eb.x + eb.y));
    jcircle(eb.x, eb.y, 4.5, RED, 2);
    jcircle(eb.x, eb.y, 1.8, RED, 1);
  }
  for (const l of lightnings) {
    if (l.delay > 0) continue;   // 还没轮到这段
    const p = l.prog === undefined ? 1 : l.prog;
    const hx = l.x1 + (l.x2 - l.x1) * p, hy = l.y1 + (l.y2 - l.y1) * p;
    const lc = l.col || (l.c && l.c.col) || ARC;
    ctx.globalAlpha = Math.min(1, l.t / 0.12);
    setSeed(9500);
    jline(l.x1, l.y1, hx, hy, lc, 3);
    jline(l.x1, l.y1, hx, hy, lc, 1);
    if (p < 1) {  // 飞行中的电弧头：属性色双层光点
      jcircle(hx, hy, 5.5, lc, 2);
      jcircle(hx, hy, 2.5, lc, 2.5);
    }
    ctx.globalAlpha = 1;
  }
  setSeed(1);
  const candle = getActive('candle');
  if (candle) {   // 蜡烛头：灼烧光环 + 头顶火苗
    const cc = skillCalc(candle), rad = 90 * cc.rad;
    setSeed(8900);
    ctx.globalAlpha = 0.25;
    jcircle(player.x, player.y, rad, cc.col, 1.2);
    ctx.globalAlpha = 1;
    const fx = player.x, fy = player.y - 34;
    setSeed(8910);
    jline(fx - 3, fy + 8, fx - 3, fy + 2, INK, 2);   // 蜡烛梗
    jline(fx + 3, fy + 8, fx + 3, fy + 2, INK, 2);
    jline(fx - 3, fy + 8, fx + 3, fy + 8, INK, 2);
    const fl = Math.sin(boilT * 2.3) * 1.5;
    jline(fx - 3, fy + 1, fx + fl, fy - 7, cc.col, 2);  // 火苗
    jline(fx + 3, fy + 1, fx + fl, fy - 7, cc.col, 2);
  }
  if (player.hurtT <= 0 || Math.floor(player.hurtT * 20) % 2 === 0)
    drawStick(player.x, player.y, 30, player.walk, player.hurtT > 0 ? RED : INK);
  for (const s of sparks) {
    const k = 1 - s.t / 0.18, sc = s.color || DARK;
    ctx.globalAlpha = 1 - k;
    setSeed(4000 + Math.floor(s.x * 3));
    for (let i = 0; i < 6; i++) {
      const a = i / 6 * Math.PI * 2 + 0.3;
      const r0 = 3 + k * 4, r1 = 6 + k * 12;
      jline(s.x + Math.cos(a) * r0, s.y + Math.sin(a) * r0,
            s.x + Math.cos(a) * r1, s.y + Math.sin(a) * r1, sc, 1.6);
    }
    jcircle(s.x, s.y, 2 + k * 3, sc, 1.2);
    ctx.globalAlpha = 1;
  }
  ctx.textAlign = 'center';
  for (const f of floats) {
    ctx.globalAlpha = Math.min(1, f.t * 2);
    ctx.fillStyle = f.color; ctx.font = 'bold 13px ' + FONT;
    ctx.fillText(f.txt, f.x, f.y);
    if (f.crit) {
      setSeed(6100);
      const w = ctx.measureText(f.txt).width;
      jline(f.x - w / 2, f.y + 3, f.x + w / 2, f.y + 3, RED, 1.5);
      jline(f.x - w / 2, f.y + 6, f.x + w / 2, f.y + 6, RED, 1.5);
    }
  }
  ctx.globalAlpha = 1;
  ctx.restore();

  // 纸面揉皱特效（Boss 出场/变身）
  if (crumpleT > 0) {
    setSeed(31337);
    ctx.globalAlpha = crumpleT / 0.7 * 0.55;
    for (let i = 0; i < 9; i++) {
      const y = i / 9 * H + (srand() - 0.5) * 30;
      jline(0, y, W * 0.5, y + (srand() - 0.5) * 130, GRAY, 1.5);
      jline(W * 0.5, y + (srand() - 0.5) * 130, W, y + (srand() - 0.5) * 60, GRAY, 1.5);
    }
    ctx.globalAlpha = 1;
  }

  drawHUD();
  if (state === 'start') drawCards('穿越了！选择你的起手涂鸦');
  if (state === 'levelup') drawCards(hasItem('crown') ? '升级！选一张涂鸦卡（王冠：四选一）' : '升级！选一张涂鸦卡');
  if (state === 'over') drawEnd(false);
  if (state === 'win') drawEnd(true);
}

function drawHUD() {
  setSeed(42);
  // 桌面上的信息使用浅纸色底板，保证技能、装备和顶部数据清晰可读
  ctx.fillStyle = 'rgba(255,250,238,0.88)';
  ctx.fillRect(7, 4, W - 14, 45);
  ctx.fillRect(10, 66, W - 20, 12 + player.actives.length * 15);
  ctx.fillRect(10, H - 104, 156, 84);
  // 顶部中央：关卡-波数 + 计时
  const t = Math.floor(gameTime);
  const mm = String(Math.floor(t / 60)).padStart(2, '0'), ss = String(t % 60).padStart(2, '0');
  const wv = ((player.level - 1) % 10) + 1;
  ctx.textAlign = 'center'; ctx.fillStyle = INK; ctx.font = 'bold 20px ' + FONT;
  ctx.fillText(curStage + '-' + wv, W / 2, 22);
  ctx.font = '11px ' + FONT; ctx.fillStyle = '#686868';
  ctx.fillText(mm + ':' + ss, W / 2, 37);
  // 左上：血条 + 经验条；等级独立放在经验条下方，避免与关卡重叠
  const top = 8;
  jrect(14, top, 150, 13, INK, 2);
  const ratio = Math.max(0, player.hp / player.maxhp);
  if (ratio > 0) { setSeed(43); ctx.save(); ctx.beginPath(); ctx.rect(15, top + 1, 148 * ratio, 11); ctx.clip(); scribbleFill(15, top + 1, 148 * ratio, 11, RED); ctx.restore(); }
  setSeed(45);
  jrect(14, top + 17, 150, 6, PICKUP, 1.5);
  const xr = Math.max(0, Math.min(1, player.xp / player.xpNext));
  if (xr > 0) { setSeed(46); ctx.save(); ctx.beginPath(); ctx.rect(15, top + 18, 148 * xr, 4); ctx.clip(); scribbleFill(15, top + 18, 148 * xr, 4, PICKUP); ctx.restore(); }
  ctx.fillStyle = INK; ctx.textAlign = 'left'; ctx.font = 'bold 12px ' + FONT;
  ctx.fillText('Lv.' + player.level, 16, top + 38);
  ctx.textAlign = 'right'; ctx.font = 'bold 13px ' + FONT;
  ctx.fillText('击杀 ' + kills, W - 16, top + 11);
  // Boss 血条
  const boss = enemies.find(e => e.boss && !e.dead);
  if (boss) {
    const bw = 230, bx = (W - bw) / 2, by = 50;
    setSeed(88);
    jrect(bx, by, bw, 12, RED, 2);
    const br = Math.max(0, boss.hp / boss.maxhp);
    if (br > 0) {
      ctx.save(); ctx.beginPath(); ctx.rect(bx + 1, by + 1, (bw - 2) * br, 10); ctx.clip();
      setSeed(89); scribbleFill(bx + 1, by + 1, (bw - 2) * br, 10, RED);
      ctx.restore();
    }
    ctx.fillStyle = RED; ctx.textAlign = 'center'; ctx.font = 'bold 12px ' + FONT;
    ctx.fillText(boss.name + (boss.phase === 2 ? '·暴走' : ''), W / 2, by - 4);
  }
  // 技能列表
  ctx.textAlign = 'left'; ctx.font = 'bold 11px ' + FONT;
  player.actives.forEach((a, i) => {
    const supTxt = a.supports.map(sp => SUPPORTS[sp.id].name + '·' + sp.lvl).join('+');
    ctx.fillStyle = INK;
    const nameTxt = SKILL_DEFS[a.id].name + ' Lv' + a.lvl;
    ctx.fillText(nameTxt, 16, 78 + i * 15);
    if (supTxt) { ctx.fillStyle = PURPLE; ctx.fillText('  ' + supTxt, 16 + ctx.measureText(nameTxt).width + 4, 78 + i * 15); }
  });
  // 装备栏
  ctx.font = 'bold 10px ' + FONT;
  SLOTS.forEach((s, i) => {
    const eq = player.equip[s];
    ctx.fillStyle = eq ? INK : '#686868';
    ctx.fillText('[' + SLOT_NAME[s] + ']' + (eq ? ITEM_DEFS[eq.key].name + (eq.lvl > 1 ? ' Lv' + eq.lvl : '') : '—'), 16, H - 96 + i * 14);
  });
  ctx.textAlign = 'center';
  toasts.forEach((ts, i) => {
    ctx.globalAlpha = Math.min(1, ts.t);
    ctx.fillStyle = DARK; ctx.font = 'bold 13px ' + FONT;
    ctx.fillText(ts.txt, W / 2, H - 130 - i * 20);
    ctx.globalAlpha = 1;
  });
  if (joy.active) {
    ctx.globalAlpha = 0.3;
    setSeed(99); jcircle(joy.bx, joy.by, 55, DARK, 2);
    jcircle(joy.bx + joy.dx * 55, joy.by + joy.dy * 55, 20, INK, 3);
    ctx.globalAlpha = 1;
  }
}

function drawCards(title) {
  ctx.fillStyle = 'rgba(245,241,230,0.94)';
  ctx.fillRect(0, 0, W, H);
  setSeed(777);
  ctx.fillStyle = INK; ctx.textAlign = 'center'; ctx.font = 'bold 22px ' + FONT;
  ctx.fillText(title, W / 2, 100);
  cards.forEach((cd, i) => {
    const r = cardRects[i];
    setSeed(1000 + i);
    jrect(r.x, r.y, r.w, r.h, cd.tagColor, 2.5);
    ctx.textAlign = 'left';
    ctx.fillStyle = cd.tagColor; ctx.font = 'bold 12px ' + FONT;
    ctx.fillText(cd.tag, r.x + 16, r.y + 20);
    ctx.fillStyle = INK; ctx.font = 'bold 16px ' + FONT;
    ctx.fillText(cd.name, r.x + 16, r.y + 42);
    ctx.fillStyle = DARK; ctx.font = '13px ' + FONT;
    ctx.fillText(cd.desc, r.x + 16, r.y + 62);
    ctx.fillStyle = GRAY; ctx.font = '11px ' + FONT;
    ctx.fillText('点按选择  [按 ' + (i + 1) + ']', r.x + 16, r.y + r.h - 10);
  });
}

function drawEnd(win) {
  ctx.fillStyle = 'rgba(245,241,230,0.94)';
  ctx.fillRect(0, 0, W, H);
  setSeed(win ? 555 : 666);
  ctx.textAlign = 'center'; ctx.fillStyle = win ? INK : RED;
  ctx.font = 'bold 30px ' + FONT;
  ctx.fillText(win ? '你在笔记本里活下来了！' : '你被画叉了……', W / 2, 240);
  if (!win) { jline(W / 2 - 60, 190, W / 2 + 60, 290, RED, 5); jline(W / 2 + 60, 190, W / 2 - 60, 290, RED, 5); }
  ctx.fillStyle = DARK; ctx.font = '16px ' + FONT;
  const t = Math.floor(gameTime);
  const prog = win ? '通关 10 页' : '倒在 ' + curStage + '-' + (((player.level - 1) % 10) + 1);
  ctx.fillText(prog + ' · 存活 ' + String(Math.floor(t / 60)).padStart(2, '0') + ':' + String(t % 60).padStart(2, '0') + ' · 击杀 ' + kills + ' · Lv.' + player.level, W / 2, 320);
  ctx.fillStyle = GRAY; ctx.font = '14px ' + FONT;
  ctx.fillText('点按任意处重开一局', W / 2, 400);
}

/* ---------- 主循环 ---------- */
let last = 0;
function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min(0.05, (now - last) / 1000 || 0.016);
  last = now;
  boilT = Math.floor(now / 120);
  if (state === 'play') update(dt);
  render();
}
resetGame();
requestAnimationFrame(loop);

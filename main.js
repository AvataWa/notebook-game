'use strict';
/* ============================================================
   《我穿越到笔记本了》 M2 原型 v12
   关卡制：A-B（关卡-波数）· 10 种作业本底纹 · 每关一个 Boss
   升级=波数+1，每 10 波换一关，涂掉第 10 关 Boss 即胜利
   18 个主动技能 × 12 种辅助（辅助按技能过滤有效组合）· 技能/辅助 1-5 级 · 装备系统
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
const ENEMY_AIM = '#e56b3f'; // 狙击预警使用橘红色，与红色实际伤害区域区分
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
// 浏览器统一读取 battle-config.js；兜底仅用于未加载配置脚本的旧无头测试
const BATTLE = typeof BATTLE_CONFIG !== 'undefined' ? BATTLE_CONFIG : {
  player: { radius: 12, hp: 100, speed: 168, maxInk: 100, hitInvuln: 0.65 },
  feedback: { squash: 0.22, knockback: 150, levelupDelay: 0.5 },
  melee: { total: 0.55, active: 0.2, triggerExtra: 32 },
  enemyAttack: { earlyMin: 2.5, earlyMax: 3, lateMin: 1.5, lateMax: 2, maxStage: 10 },
  spawning: { baseNormal: 20, perStage: 10 },
  ink: {
    ownSpeed: 1.12, hostileSpeed: 0.58, enemyOwnSpeed: 1.12, enemyFriendlySpeed: 0.82,
    regenBase: 0.35, regenOwnBonus: 2.5,
    trailFreshCharge: 0.003, trailCoverCharge: 0.005, trailChargePerSecond: 6,
    captureCellDivisor: 180, captureSingleCap: 2, captureInkPerSecond: 2
  },
  dive: { ownCost: 12, otherCost: 36, speed: 1.55 },
  absorb: { duration: 0.35, ownDuration: 0.4, cooldown: 1.2, successCooldown: 0.5, radius: 65, ownRadius: 100, maxGain: 12, bulletInk: 3, meleeInk: 8, charge: 20, hitStop: 0.3, slowScale: 0.15, meleeRadius: 120, meleeDamage: 27.5 },
  surge: { radius: 168, chargeTime: 1.2, minScale: 0.6, maxScale: 1.2, damage: 55, visual: 0.35 },
  skills: { closeRadius: 125, colaRadius: 150, vortexCap: 6, vortexPerCast: 2, vortexDuration: 5, projectileSize: 1.2, ballistaBulletSpeed: 620 },
  traits: { inkArmorReduction: 0.2, inkDamageMul: 1.2, parryChargeMul: 1.5, absorbInkMul: 1.5, surgeRetain: 20 }
};
const SQUASH_T = BATTLE.feedback.squash, KNOCK_V = BATTLE.feedback.knockback;

const canvas = document.getElementById('game');
let ctx = canvas.getContext('2d');
let viewScale = 1, renderQuality = 0;
const perfStats = { frameMs: 16.7, dpr: 1, cacheHits: 0, quality: 0 };
function renderDprCap() {
  const mobile = window.innerWidth <= 600 || (window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
  return (mobile ? [1.5, 1.25, 1] : [2, 1.5, 1])[renderQuality];
}
function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, renderDprCap());
  const s = Math.min(window.innerWidth / W, window.innerHeight / H);
  viewScale = s * dpr; perfStats.dpr = dpr;
  canvas.width = Math.round(W * viewScale);
  canvas.height = Math.round(H * viewScale);
  canvas.style.width = (W * s) + 'px';
  canvas.style.height = (H * s) + 'px';
}
function setRenderQuality(level) {
  const next = Math.max(0, Math.min(2, level));
  if (next === renderQuality) return;
  renderQuality = next; perfStats.quality = next; resize();
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
  ballista: { name: '图钉炮台',   desc: '钉下炮台自动射击周围敌人' },
  boomerang:{ name: '回力橡皮擦', desc: '掷出橡皮擦，飞出去再旋回来' },
  vortex:   { name: '涂改带刀阵', desc: '六枚碎片组成连续整圈刀阵，越叠越多' },
  candle:   { name: '蜡烛头',     desc: '头顶点起蜡烛，持续灼烧周围敌人' },
  icespear: { name: '冰锥图钉',   desc: '射出贯穿冰锥，命中减速' },
  inkrain:  { name: '毒墨雨',     desc: '召唤数片毒墨云，持续淋伤下方敌人' },
  ruler:    { name: '裂地直尺',   desc: '直尺劈落，地刺成排刺出并余震' },
  chalk:    { name: '流星粉笔头', desc: '粉笔头从天而降，砸出大坑' },
  pinburst: { name: '蜂群大头钉', desc: '扇形射出一把大头钉，钉尖爆裂' },
  absolve:  { name: '赦免粉笔',   desc: '光柱劈最强的敌人，劈死则化为己方小鬼' },
  brand:    { name: '橡皮筋烙印', desc: '给敌人套上橡皮筋，持续电击并弹向周围' },
  cola:     { name: '冰可乐新星', desc: '冰可乐炸开，冻慢身边一圈敌人' }
};
const SKILL_EVOLUTIONS = {
  cyclone:  { 3: '质变：增加反向旋转的外圈笔迹', 5: '觉醒：三重蜡笔风暴，范围和频率提升' },
  volcanic: { 3: '质变：裂缝向左右分支', 5: '觉醒：延长火山带，末端大范围喷发' },
  tornado:  { 3: '质变：纸飞机额外分裂一代', 5: '觉醒：大飞机编队，连续分裂' },
  arc:      { 3: '质变：主电弧额外分叉', 5: '觉醒：连锁落点留下持续雷网' },
  cola:     { 3: '质变：新星后留下减速冰面', 5: '觉醒：冻结怪群并引发连环碎冰' }
};
function activeUpgradeDesc(id, lvl) {
  let desc = (SKILL_EVOLUTIONS[id] && SKILL_EVOLUTIONS[id][lvl]) || '伤害 +15%，冷却 -4%';
  if ((SKILL_TAGS[id] || []).includes('proj') && (lvl === 2 || lvl === 4)) desc += '，弹数 +1';
  return desc;
}
/* 技能标签：proj=子弹 area=范围 strike=打击（辅助按标签过滤，双标签可吃两系） */
const SKILL_TAGS = {
  cyclone: ['strike', 'area'], volcanic: ['area', 'strike'], tornado: ['proj'], chainclip: ['proj'],
  arc: ['area'], spark: ['proj'], ballista: ['proj'], boomerang: ['proj'],
  vortex: ['strike', 'area'], candle: ['area'], icespear: ['proj'], inkrain: ['area'],
  ruler: ['area', 'strike'], chalk: ['area'], pinburst: ['proj'], absolve: ['strike'],
  brand: ['area'], cola: ['area']
};
/* 技能属性：phys 物理灰 / fire 火橙 / ice 冰浅蓝 / thunder 雷蓝紫 */
const SKILL_ATTR = {
  cyclone: 'phys', ballista: 'phys', vortex: 'phys', ruler: 'phys',
  volcanic: 'fire', candle: 'fire', chalk: 'fire', inkrain: 'fire', pinburst: 'fire',
  tornado: 'ice', spark: 'ice', boomerang: 'ice', icespear: 'ice', cola: 'ice',
  chainclip: 'thunder', arc: 'thunder', absolve: 'thunder', brand: 'thunder'
};
const ATTR_COLOR = { phys: '#6b6b6b', fire: '#e67e22', ice: '#7ec8e3', thunder: '#5b5bd6' };
const ATTR_NAME = { phys: '物理', fire: '火', ice: '冰', thunder: '雷' };
const TAG_NAME = { proj: '子弹', area: '范围', strike: '打击' };
function attrOf(aid) { return ATTR_COLOR[SKILL_ATTR[aid]] || INK; }
function trailColorOf(aid) { return SKILL_ATTR[aid] === 'phys' ? INK : attrOf(aid); }

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
  sweep:   { name: '大开大合', tag: 'strike', skills: ['cyclone', 'vortex', 'volcanic', 'ruler'] },
  followup:{ name: '追加一笔', tag: 'strike' },
  leech:   { name: '回锋',     tag: 'strike' },
  shock:   { name: '震荡纸面', tag: 'strike' },
  dur:     { name: '持久墨水', tag: 'strike', skills: ['vortex', 'absolve'] }
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
  { id: 'dmg', name: '笔力', desc: '全部伤害 +10%', fx: () => player.dmgMul *= 1.1 },
  { id: 'haste', name: '速写', desc: '全部技能冷却与墨潮蓄力时间 -6%', fx: () => player.cdMul *= 0.94 },
  { id: 'spd', name: '碎步', desc: '移动速度 +6%', fx: () => player.speed *= 1.06 },
  { id: 'hpup', name: '厚纸', desc: '最大生命 +20 并回复 20', fx: () => { player.maxhp += 20; player.hp = Math.min(player.maxhp, player.hp + 20); } },
  { id: 'magnet', name: '灵感', desc: '普通怪物击杀经验 +15%', fx: () => player.xpMul *= 1.15 },
  { id: 'crit', name: '重墨', desc: '暴击率 +10%（双倍伤害）', fx: () => player.crit += 0.1 },
  { id: 'inkmaster', name: '泼墨', desc: '全部技能与弹反范围 +20%', once: true, fx: () => { player.taken.inkmaster = true; player.radMul *= 1.2; } },
  { id: 'fountain', name: '笔芯连供', desc: '全部技能冷却与墨潮蓄力时间 -12%，但全部伤害 -8%', once: true, fx: () => { player.taken.fountain = true; player.cdMul *= 0.88; player.dmgMul *= 0.92; } },
  { id: 'inkarmor', name: '墨层护膜', desc: '站在己方墨迹上，受到伤害 -20%', once: true, fx: () => player.taken.inkarmor = true },
  { id: 'inkpower', name: '领地笔意', desc: '站在己方墨迹上，全部伤害 +20%', once: true, fx: () => player.taken.inkpower = true }
];
const OPERATION_AFFIX_LIST = typeof OPERATION_AFFIXES !== 'undefined' ? OPERATION_AFFIXES : [];
function hasAffix(skill, id) { return !!(player && ((player.affixes && player.affixes[skill] && player.affixes[skill][id]) || (player.taken && player.taken[id]))); }

/* ---------- 装备与品质 ---------- */
const SLOTS = ['head', 'body', 'hands', 'feet', 'acc'];
const SLOT_NAME = { head: '头部', body: '上身', hands: '手部', feet: '脚部', acc: '饰品' };
const RARITY_LIST = typeof RARITIES !== 'undefined' ? RARITIES : [
  { id: 'common', name: '普通', color: '#858585', weight: 64, mul: 1 },
  { id: 'rare', name: '稀有', color: '#3578c7', weight: 25, mul: 1.35 },
  { id: 'legendary', name: '传说', color: '#8b52b5', weight: 8, mul: 1.75 },
  { id: 'epic', name: '史诗', color: '#d77b24', weight: 3, mul: 2.3 }
];
const ITEM_DEFS = typeof EQUIPMENT_ITEM_DEFS !== 'undefined' ? EQUIPMENT_ITEM_DEFS : {
  crown: { slot: 'head', name: '涂鸦王冠', atk: 15, hp: 30, fx: '升级时四选一' },
  cap4: { slot: 'head', name: '四色笔帽', atk: 12, hp: 0, fx: '每个主动技能使伤害 +8%' },
  cloak: { slot: 'body', name: '勇者披风', atk: 0, hp: 50, fx: '生命低于 30% 时伤害 +40%' },
  stapler: { slot: 'body', name: '订书机甲', atk: 0, hp: 70, fx: '受击无敌时间 +0.2 秒' },
  glove: { slot: 'hands', name: '红笔指套', atk: 10, hp: 0, fx: '暴击率 +15%，暴击伤害 x2.5' },
  compass: { slot: 'hands', name: '圆规护腕', atk: 10, hp: 0, fx: '每条辅助使对应技能范围 +5%' },
  shoes: { slot: 'feet', name: '弹簧拖鞋', atk: 0, hp: 20, fx: '移速 +12%，受击后移速再 +30%' },
  tape: { slot: 'feet', name: '修正带鞋', atk: 0, hp: 25, fx: '每 30 秒抵挡一次致命伤害' },
  pendant: { slot: 'acc', name: '墨胆吊坠', atk: 8, hp: 20, fx: '墨水上限 +25，基础回墨 +0.5/秒' },
  bookmark: { slot: 'acc', name: '灵感书签', atk: 6, hp: 15, fx: '升级回复 50 墨水并完成吸墨冷却' }
};
const ITEM_KEYS = typeof EQUIPMENT_ITEM_KEYS !== 'undefined' ? EQUIPMENT_ITEM_KEYS : Object.keys(ITEM_DEFS);
function equipped(key) { return SLOTS.map(s => player.equip[s]).find(eq => eq && eq.key === key) || null; }
function rarityIndex(eq) { return Math.max(0, Math.min(RARITY_LIST.length - 1, eq && eq.rarity || 0)); }
function itemValues(key, rarity = 0) {
  const def = ITEM_DEFS[key], out = {};
  if (def && def.v) for (const k in def.v) out[k] = def.v[k][rarity];
  return out;
}
function itemV(key, prop, legacy = 0) {
  const eq = equipped(key); if (!eq) return 0;
  const def = ITEM_DEFS[key];
  return def.v && def.v[prop] ? def.v[prop][rarityIndex(eq)] : legacy;
}
function itemDescription(key, rarity = 0) {
  const def = ITEM_DEFS[key];
  return def.text ? def.text(itemValues(key, rarity)) : (def.fx || '');
}
function rollRarity() {
  let roll = Math.random() * RARITY_LIST.reduce((s, r) => s + r.weight, 0);
  for (let i = 0; i < RARITY_LIST.length; i++) { roll -= RARITY_LIST[i].weight; if (roll < 0) return i; }
  return 0;
}
function makeEquipmentDrop(x, y) {
  return { x, y, item: ITEM_KEYS[Math.floor(Math.random() * ITEM_KEYS.length)], rarity: rollRarity(), bob: Math.random() * 6 };
}

/* ---------- 游戏状态 ---------- */
let state, gameTime, kills, camX, camY, shakeT, cycAng, crumpleT, hitStopT, levelupDelayT;
let player, enemies, bullets, ebullets, drops, floats, lightnings, erupts, minions, totems, sparks, toasts, cards, cardRects, hazards, blades, clouds, brands, novas, followups, fields, erases;
let spawnAcc, nextId, bossStageSpawned, curStage, nextHordeT, hordeIndex, killChain, killChainT, enemyTrailT;
let gestureDraw, pendingGesture, redrawOutlines, gestureNoticeT, drawMode, drawModeT;
let inkSurgePainting;
const HOSTILE_INK = '#70645e';
/* ---------- 固定墨迹场：网格既负责显示也负责判定，不保存历史墨团对象 ---------- */
const INK_CELL = 2, INK_GW = Math.ceil(WORLD_W / INK_CELL), INK_GH = Math.ceil(WORLD_H / INK_CELL);
const INK_COUNT = INK_GW * INK_GH;
const inkOwner = new Uint8Array(INK_COUNT);       // 0 空白 / 1 己方 / 2 敌方
const inkAmount = new Uint8Array(INK_COUNT);      // 仅表示是否存在：0 无 / 1 有，不再积累浓度
const inkPulse = new Uint8Array(INK_COUNT);       // 仅技能墨团产生伤害，移动与弹道路径不脉冲
const inkSource = new Uint32Array(INK_COUNT);     // 敌方墨迹来源怪物 id；己方或无来源为 0
const enemyInkCells = new Map();                  // 每只怪物当前仍拥有的网格，击杀时只扫描自己的墨迹
const inkCutDeadline = new Float32Array(INK_COUNT); // 失源转化的截止时间；0 表示仍与来源相连
const inkCutChecks = new Set(), inkOrphanCells = new Set(), inkOrphanCounts = new Map();
const inkVisit = new Uint32Array(INK_COUNT), inkSearchQueue = new Int32Array(INK_COUNT);
let inkVisitStamp = 0;
let inkPaintedCount = 0, inkFriendlyColor = INK, inkFriendlyRgb = [26, 43, 143];
const inkHostileRgb = [112, 100, 94];
function makeInkLayer() {
  if (typeof document.createElement !== 'function') return { canvas: null, ctx: null, image: null };
  const layer = document.createElement('canvas'); layer.width = INK_GW; layer.height = INK_GH;
  const c = layer.getContext('2d');
  return { canvas: layer, ctx: c, image: c ? c.createImageData(INK_GW, INK_GH) : null };
}
const friendlyInkLayer = makeInkLayer(), hostileInkLayer = makeInkLayer();
function inkRgb(hex) {
  const m = /^#([0-9a-f]{6})$/i.exec(hex || '');
  return m ? [parseInt(m[1].slice(0, 2), 16), parseInt(m[1].slice(2, 4), 16), parseInt(m[1].slice(4, 6), 16)] : [26, 43, 143];
}
function putInkRegion(layer, x0, y0, x1, y1) {
  if (!layer.ctx || !layer.image) return;
  // Canvas 脏矩形只接受整数；技能轨迹可能给出小数坐标，向外取整并限制在墨迹层内。
  const left = Math.max(0, Math.floor(Math.min(x0, x1)));
  const top = Math.max(0, Math.floor(Math.min(y0, y1)));
  const right = Math.min(INK_GW - 1, Math.ceil(Math.max(x0, x1)));
  const bottom = Math.min(INK_GH - 1, Math.ceil(Math.max(y0, y1)));
  if (![left, top, right, bottom].every(Number.isFinite) || right < left || bottom < top) return;
  layer.ctx.putImageData(layer.image, 0, 0, left, top, right - left + 1, bottom - top + 1);
}
function syncInkPixel(i) {
  const p = i * 4, owner = inkOwner[i];
  if (friendlyInkLayer.image) {
    const d = friendlyInkLayer.image.data;
    if (owner === 1) { d[p] = inkFriendlyRgb[0]; d[p + 1] = inkFriendlyRgb[1]; d[p + 2] = inkFriendlyRgb[2]; d[p + 3] = 255; }
    else d[p + 3] = 0;
  }
  if (hostileInkLayer.image) {
    const d = hostileInkLayer.image.data;
    if (owner === 2) {
      const orphan = inkCutDeadline[i] > 0;
      d[p] = orphan ? 154 : inkHostileRgb[0]; d[p + 1] = orphan ? 143 : inkHostileRgb[1]; d[p + 2] = orphan ? 133 : inkHostileRgb[2]; d[p + 3] = 255;
    } else d[p + 3] = 0;
  }
}
function clearInkOrphan(i) {
  if (!inkCutDeadline[i]) return;
  const sourceId = inkSource[i], count = (inkOrphanCounts.get(sourceId) || 1) - 1;
  inkCutDeadline[i] = 0; inkOrphanCells.delete(i);
  if (count > 0) inkOrphanCounts.set(sourceId, count); else inkOrphanCounts.delete(sourceId);
  syncInkPixel(i);
}
function markInkOrphan(i, deadline) {
  if (inkCutDeadline[i]) return;   // 不反复延长失源倒计时
  const sourceId = inkSource[i];
  inkCutDeadline[i] = deadline; inkOrphanCells.add(i);
  inkOrphanCounts.set(sourceId, (inkOrphanCounts.get(sourceId) || 0) + 1);
  syncInkPixel(i);
}
function setInkSource(i, sourceId) {
  const previous = inkSource[i];
  if (previous === sourceId) {
    if (sourceId && inkCutDeadline[i]) inkCutChecks.add(sourceId);
    return;
  }
  clearInkOrphan(i);
  if (previous) {
    const cells = enemyInkCells.get(previous);
    if (cells) { cells.delete(i); if (!cells.size) enemyInkCells.delete(previous); }
    if (!sourceId) inkCutChecks.add(previous);   // 彩墨覆盖或吸墨可能切断供墨线
  }
  inkSource[i] = sourceId;
  if (sourceId) {
    let cells = enemyInkCells.get(sourceId);
    if (!cells) { cells = new Set(); enemyInkCells.set(sourceId, cells); }
    cells.add(i);
    if (inkOrphanCounts.get(sourceId)) inkCutChecks.add(sourceId);
  }
}
function convertEnemyInk(sourceId) {
  const cells = enemyInkCells.get(sourceId);
  inkCutChecks.delete(sourceId);
  if (!cells || !cells.size) return 0;
  let converted = 0;
  for (const i of cells) {
    if (inkOwner[i] !== 2 || inkSource[i] !== sourceId) continue;
    clearInkOrphan(i);
    inkOwner[i] = 1; inkAmount[i] = 1; inkPulse[i] = 0; inkSource[i] = 0;
    syncInkPixel(i); converted++;
  }
  enemyInkCells.delete(sourceId); inkOrphanCounts.delete(sourceId);
  if (converted) {
    if (friendlyInkLayer.ctx) friendlyInkLayer.ctx.putImageData(friendlyInkLayer.image, 0, 0);
    if (hostileInkLayer.ctx) hostileInkLayer.ctx.putImageData(hostileInkLayer.image, 0, 0);
  }
  return converted;
}
function resetInkField() {
  inkOwner.fill(0); inkAmount.fill(0); inkPulse.fill(0); inkSource.fill(0); inkCutDeadline.fill(0); inkVisit.fill(0);
  enemyInkCells.clear(); inkCutChecks.clear(); inkOrphanCells.clear(); inkOrphanCounts.clear(); inkPaintedCount = 0; inkVisitStamp = 0;
  updateInkStains.dotT = 0; updateInkStains.poolT = 0;
  if (friendlyInkLayer.image) friendlyInkLayer.image.data.fill(0);
  if (hostileInkLayer.image) hostileInkLayer.image.data.fill(0);
  if (friendlyInkLayer.ctx) friendlyInkLayer.ctx.putImageData(friendlyInkLayer.image, 0, 0);
  if (hostileInkLayer.ctx) hostileInkLayer.ctx.putImageData(hostileInkLayer.image, 0, 0);
}
// 从来源怪物及其存活墨弹出发做连通检查；断开的部分进入 1 秒失源倒计时
function refreshInkConnectivity(sourceId) {
  const cells = enemyInkCells.get(sourceId);
  if (!cells || !cells.size) { inkOrphanCounts.delete(sourceId); return; }
  const stamp = ++inkVisitStamp;
  let head = 0, tail = 0;
  function seed(x, y, r) {
    const b = inkGridBounds(x, y, x, y, r), rr = r * r;
    for (let gy = b.y0; gy <= b.y1; gy++) for (let gx = b.x0; gx <= b.x1; gx++) {
      const wx = WORLD_L + (gx + 0.5) * INK_CELL - x, wy = WORLD_T + (gy + 0.5) * INK_CELL - y;
      const i = gy * INK_GW + gx;
      if (wx * wx + wy * wy > rr || inkSource[i] !== sourceId || inkVisit[i] === stamp) continue;
      inkVisit[i] = stamp; inkSearchQueue[tail++] = i;
    }
  }
  const source = enemies && enemies.find(e => e.id === sourceId && !e.dead);
  if (source) seed(source.x, source.y, source.r + 14);
  if (ebullets) for (const b of ebullets) {
    if (b.sourceId === sourceId && !b.inkConverted && b.life > 0) seed(b.x, b.y, 18);
  }
  while (head < tail) {
    const i = inkSearchQueue[head++], gx = i % INK_GW, gy = Math.floor(i / INK_GW);
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const nx = gx + dx, ny = gy + dy;
      if (nx < 0 || nx >= INK_GW || ny < 0 || ny >= INK_GH) continue;
      const ni = ny * INK_GW + nx;
      if (inkSource[ni] !== sourceId || inkVisit[ni] === stamp) continue;
      inkVisit[ni] = stamp; inkSearchQueue[tail++] = ni;
    }
  }
  for (const i of cells) {
    if (inkVisit[i] === stamp) clearInkOrphan(i);
    else markInkOrphan(i, gameTime + 1);
  }
}
function refundInk(amount, x, y, label, crit) {
  const gained = Math.min(Math.max(0, player.maxInk - player.ink), Math.max(0, amount));
  if (gained <= 0) return 0;
  player.ink += gained;
  return gained;
}
function regenInkResourceBudgets(dt) {
  const rule = BATTLE.ink;
  player.trailChargeBudget = Math.min(rule.trailChargePerSecond,
    (player.trailChargeBudget || 0) + rule.trailChargePerSecond * dt);
  player.captureInkBudget = Math.min(rule.captureInkPerSecond,
    (player.captureInkBudget || 0) + rule.captureInkPerSecond * dt);
}
function updateInkTactics() {
  if (inkCutChecks.size) {
    const checks = Array.from(inkCutChecks); inkCutChecks.clear();
    for (const sourceId of checks) refreshInkConnectivity(sourceId);
  }
  if (!inkOrphanCells.size) return;
  let changed = false;
  const captured = new Map();
  for (const i of inkOrphanCells) {
    if (!inkCutDeadline[i] || inkCutDeadline[i] > gameTime) continue;
    const sourceId = inkSource[i];
    clearInkOrphan(i);
    if (inkOwner[i] !== 2 || !sourceId || inkSource[i] !== sourceId) continue;
    inkOwner[i] = 1; inkAmount[i] = 1; inkPulse[i] = 0; inkSource[i] = 0;
    const cells = enemyInkCells.get(sourceId);
    if (cells) { cells.delete(i); if (!cells.size) enemyInkCells.delete(sourceId); }
    syncInkPixel(i); changed = true;
    const gx = i % INK_GW, gy = Math.floor(i / INK_GW);
    const info = captured.get(sourceId) || { n: 0, x: 0, y: 0 };
    info.n++; info.x += WORLD_L + (gx + 0.5) * INK_CELL; info.y += WORLD_T + (gy + 0.5) * INK_CELL;
    captured.set(sourceId, info);
  }
  if (changed) {
    if (friendlyInkLayer.ctx) friendlyInkLayer.ctx.putImageData(friendlyInkLayer.image, 0, 0);
    if (hostileInkLayer.ctx) hostileInkLayer.ctx.putImageData(hostileInkLayer.image, 0, 0);
    for (const info of captured.values()) {
      const x = info.x / info.n, y = info.y / info.n;
      const gained = refundInk(Math.min(12, info.n / 80), x, y, '截墨', true);
      if (!gained) floats.push({ x, y, txt: '截墨！', t: 0.85, color: inkFriendlyColor, crit: true });
    }
  }
}
function inkGridBounds(x1, y1, x2, y2, r) {
  return {
    x0: Math.max(0, Math.floor((Math.min(x1, x2) - r - WORLD_L) / INK_CELL)),
    y0: Math.max(0, Math.floor((Math.min(y1, y2) - r - WORLD_T) / INK_CELL)),
    x1: Math.min(INK_GW - 1, Math.floor((Math.max(x1, x2) + r - WORLD_L) / INK_CELL)),
    y1: Math.min(INK_GH - 1, Math.floor((Math.max(y1, y2) + r - WORLD_T) / INK_CELL))
  };
}
function paintInkSegment(x1, y1, x2, y2, r, amount, col, hostile, trail, sourceId, pathCharge = false) {
  if (amount <= 0 || r <= 0) return 0;
  const b = inkGridBounds(x1, y1, x2, y2, r), dx = x2 - x1, dy = y2 - y1;
  const len2 = dx * dx + dy * dy, r2 = r * r, nextOwner = hostile ? 2 : 1;
  const nextSource = hostile ? (sourceId || 0) : 0;
  let cells = 0, fresh = 0, covered = 0;
  const minX = Math.min(x1, x2) - r - 30, maxX = Math.max(x1, x2) + r + 30;
  const minY = Math.min(y1, y2) - r - 30, maxY = Math.max(y1, y2) + r + 30;
  const contested = [];
  if (!hostile) {
    const wanted = player && player.actives.length ? trailColorOf(player.actives[0].id) : INK;
    if (wanted !== inkFriendlyColor) recolorFriendlyInk(wanted);
    // 先记录确实站在灰墨上的怪物，避免重复涂彩墨也触发夺地
    if (enemies) for (const e of enemies) {
      if (e.dead || e.x < minX || e.x > maxX || e.y < minY || e.y > maxY) continue;
      if (inkCircleHas(e.x, e.y, e.r * 0.35, true)) contested.push(e);
    }
  }
  for (let gy = b.y0; gy <= b.y1; gy++) {
    const wy = WORLD_T + (gy + 0.5) * INK_CELL;
    for (let gx = b.x0; gx <= b.x1; gx++) {
      const wx = WORLD_L + (gx + 0.5) * INK_CELL;
      let t = len2 > 1e-8 ? ((wx - x1) * dx + (wy - y1) * dy) / len2 : 0;
      t = Math.max(0, Math.min(1, t));
      const ddx = wx - (x1 + dx * t), ddy = wy - (y1 + dy * t);
      if (ddx * ddx + ddy * ddy > r2) continue;
      cells++;
      const i = gy * INK_GW + gx, previous = inkOwner[i];
      if (previous === 0) { inkPaintedCount++; fresh++; }
      else if (previous !== nextOwner) covered++;
      // 不累计浓度：后画的无条件覆盖先画的，并更新技能脉冲与怪物来源
      inkOwner[i] = nextOwner; inkAmount[i] = 1; inkPulse[i] = trail ? 0 : 1;
      setInkSource(i, nextSource);
      syncInkPixel(i);
    }
  }
  putInkRegion(friendlyInkLayer, b.x0, b.y0, b.x1, b.y1);
  putInkRegion(hostileInkLayer, b.x0, b.y0, b.x1, b.y1);
  if (!hostile && !trail && !inkSurgePainting && covered > 0) {
    const rule = BATTLE.ink;
    const requested = Math.min(rule.captureSingleCap, covered / rule.captureCellDivisor);
    const allowed = Math.min(requested, player.captureInkBudget || 0);
    const gained = refundInk(allowed, (x1 + x2) / 2, (y1 + y2) / 2 - 18, '夺地');
    player.captureInkBudget = Math.max(0, player.captureInkBudget - gained);
  }
  if (covered) for (const e of contested) {
    if (e.dead || gameTime < (e.groundStealCd || 0) || !inkCircleHas(e.x, e.y, e.r * 0.35, false)) continue;
    const stun = e.boss ? 0.12 : (e.elite ? 0.25 : 0.4);
    e.stunT = Math.max(e.stunT || 0, stun);
    e.groundStealCd = gameTime + (e.boss ? 2 : 1.2);
    if (!inkSurgePainting) floats.push({ x: e.x, y: e.y - e.r - 12, txt: '夺地！', t: 0.65, color: inkFriendlyColor });
  }
  const coveredRatio = cells ? covered / cells : 0;
  if (!hostile && cells) {
    const charge = pathCharge
      ? fresh * BATTLE.ink.trailFreshCharge + covered * BATTLE.ink.trailCoverCharge
      : amount * fresh / cells * 1.2 + coveredRatio * 2;
    if (pathCharge) chargeTrail(charge);
    else chargeTurf(charge);
  }
  return coveredRatio;
}
function inkCircleHas(x, y, r, hostile) {
  const wanted = hostile ? 2 : 1, b = inkGridBounds(x, y, x, y, r), rr = (r + INK_CELL * 0.5) ** 2;
  for (let gy = b.y0; gy <= b.y1; gy++) for (let gx = b.x0; gx <= b.x1; gx++) {
    const wx = WORLD_L + (gx + 0.5) * INK_CELL - x, wy = WORLD_T + (gy + 0.5) * INK_CELL - y;
    const i = gy * INK_GW + gx;
    if (wx * wx + wy * wy <= rr && inkOwner[i] === wanted && inkAmount[i] > 0) return true;
  }
  return false;
}
function inkPulseAt(x, y, r) {
  const b = inkGridBounds(x, y, x, y, r), rr = (r + INK_CELL * 0.5) ** 2;
  let strongest = 0;
  for (let gy = b.y0; gy <= b.y1; gy++) for (let gx = b.x0; gx <= b.x1; gx++) {
    const wx = WORLD_L + (gx + 0.5) * INK_CELL - x, wy = WORLD_T + (gy + 0.5) * INK_CELL - y;
    const i = gy * INK_GW + gx;
    if (wx * wx + wy * wy <= rr && inkOwner[i] === 1) strongest = Math.max(strongest, inkPulse[i]);
  }
  return strongest;
}
function inkCellAt(x, y) {
  const gx = Math.max(0, Math.min(INK_GW - 1, Math.floor((x - WORLD_L) / INK_CELL)));
  const gy = Math.max(0, Math.min(INK_GH - 1, Math.floor((y - WORLD_T) / INK_CELL)));
  const i = gy * INK_GW + gx;
  return { owner: inkOwner[i], amount: inkAmount[i], pulse: inkPulse[i], orphan: inkCutDeadline[i] > 0, cutIn: inkCutDeadline[i] > 0 ? Math.max(0, inkCutDeadline[i] - gameTime) : 0, gx, gy };
}
function consumeInkDisk(x, y, r) {
  const b = inkGridBounds(x, y, x, y, r), r2 = r * r;
  let cells = 0;
  for (let gy = b.y0; gy <= b.y1; gy++) for (let gx = b.x0; gx <= b.x1; gx++) {
    const wx = WORLD_L + (gx + 0.5) * INK_CELL - x, wy = WORLD_T + (gy + 0.5) * INK_CELL - y;
    const i = gy * INK_GW + gx;
    if (wx * wx + wy * wy > r2 || !inkOwner[i]) continue;
    cells++; inkOwner[i] = 0; inkAmount[i] = 0; inkPulse[i] = 0; inkPaintedCount--;
    setInkSource(i, 0); syncInkPixel(i);
  }
  putInkRegion(friendlyInkLayer, b.x0, b.y0, b.x1, b.y1);
  putInkRegion(hostileInkLayer, b.x0, b.y0, b.x1, b.y1);
  // 吸取收益只看实际覆盖面积，不看浓度
  return Math.min(12, cells / 40);
}
function nearestInkCell(x, y, maxDist) {
  if (!inkPaintedCount) return null;
  const step = INK_CELL * 2;
  for (let radius = 0; radius <= maxDist; radius += step) {
    const b = inkGridBounds(x - radius, y - radius, x + radius, y + radius, 0);
    for (let gy = b.y0; gy <= b.y1; gy += 2) for (let gx = b.x0; gx <= b.x1; gx += 2) {
      const wx = WORLD_L + (gx + 0.5) * INK_CELL, wy = WORLD_T + (gy + 0.5) * INK_CELL;
      const d = Math.hypot(wx - x, wy - y);
      if (Math.abs(d - radius) > step * 1.5 || !inkOwner[gy * INK_GW + gx]) continue;
      return { x: wx, y: wy, d };
    }
  }
  return null;
}
function recolorFriendlyInk(col) {
  if (col === inkFriendlyColor) return;
  inkFriendlyColor = col; inkFriendlyRgb = inkRgb(col);
  for (let i = 0; i < INK_COUNT; i++) if (inkOwner[i] === 1) syncInkPixel(i);
  if (friendlyInkLayer.ctx) friendlyInkLayer.ctx.putImageData(friendlyInkLayer.image, 0, 0);
}
function inkStats() {
  let friendly = 0, hostile = 0;
  for (let i = 0; i < INK_COUNT; i++) { if (inkOwner[i] === 1) friendly++; else if (inkOwner[i] === 2) hostile++; }
  return { friendly, hostile, capacity: INK_COUNT, cellSize: INK_CELL };
}
const gestureCooldowns = { cross: 0, redraw: 0, v: 0, zig: 0, circle: 0 };
const ABSORB_RULE = BATTLE.absorb;
// 左手固定摇杆，右手拇指操作三个技能；按钮扩大并错层排列，减少误触
const JOY_HOME = { x: 72, y: H - 174, r: 52 };
const absorbRect = { x: W - 88, y: H - 157, w: 74, h: 64 }; // 向下多延伸 12 像素，扩大右手拇指热区
const specialRect = { x: W - 172, y: H - 157, w: 74, h: 52 };
const diveRect = { x: W - 88, y: H - 221, w: 74, h: 52 };
const buildRect = { x: W / 2 - 42, y: H - 62, w: 84, h: 36 };
const keys = {};
const joy = { active: false, id: -1, bx: JOY_HOME.x, by: JOY_HOME.y, dx: 0, dy: 0 };

let pendingEquipment = null, diveDecoys = [];
function resetGame() {
  state = 'start'; gameTime = 0; kills = 0; shakeT = 0; cycAng = 0; crumpleT = 0; hitStopT = 0; levelupDelayT = -1;
  joy.active = false; joy.id = -1; joy.dx = 0; joy.dy = 0;
  camX = 0; camY = 0; spawnAcc = 0; nextId = 1; pendingEquipment = null; diveDecoys = [];
  bossStageSpawned = 0; curStage = 0; nextHordeT = 12; hordeIndex = 0; killChain = 0; killChainT = 0; enemyTrailT = 0.1;
  gestureDraw = null; pendingGesture = null; redrawOutlines = []; gestureNoticeT = 0; drawMode = false; drawModeT = 0;
  resetInkField(); inkSurgePainting = false;
  for (const k in gestureCooldowns) gestureCooldowns[k] = 0;
  enemies = []; bullets = []; ebullets = []; drops = []; floats = []; lightnings = [];
  erupts = []; minions = []; totems = []; sparks = []; toasts = []; cards = []; cardRects = []; hazards = [];
  blades = []; clouds = []; brands = []; novas = []; followups = []; fields = []; erases = [];
  player = {
    x: 0, y: 0, r: BATTLE.player.radius, hp: BATTLE.player.hp, maxhp: BATTLE.player.hp, speed: BATTLE.player.speed, faceA: 0,
    trailX: 0, trailY: 0, diving: false, special: 0, specialAnnounced: false,
    surgeCharging: false, surgeChargeT: 0, surgePointerId: null, surgeGrowth: 0,
    lastSeenX: 0, lastSeenY: 0, grayTick: 0, noInkT: 0, turf: 0,
    trailChargeBudget: BATTLE.ink.trailChargePerSecond,
    captureInkBudget: BATTLE.ink.captureInkPerSecond,
    absorbT: 0, absorbDuration: ABSORB_RULE.duration, absorbRadius: ABSORB_RULE.radius, absorbCd: 0, absorbGain: 0, absorbHeal: 0, absorbInkUsed: false,
    diveT: 0, diveCd: 0, diveSpent: 0, diveFreeT: 0, diveEntryT: 0, diveDecoyT: 0, diveWashT: 0, diveBurstT: 0, diveShieldCd: 0, diveChargeAcc: 0,
    exitShieldT: 0, parryShieldT: 0, itemAmbushT: 0, itemSurgeT: 0, itemParryT: 0, itemArmorCd: 0,
    itemInkCd: 0, itemInkCdT: 0, itemBurstN: 0, itemBurstT: 0, itemRerolls: 0, moveT: 0, stillT: 0,
    level: 1, xp: 0, xpNext: xpForNextLevel(1), xpMul: 1, ink: BATTLE.player.maxInk, maxInk: BATTLE.player.maxInk, bonusHp: 0,
    dmgMul: 1, cdMul: 1, radMul: 1, crit: 0, condDmg: 1,
    eqAtk: 0, eqCrit: 0, eqSpd: 1, eqDr: 0, eqRad: 1,
    hurtBoostT: 0, lastRevive: -999, leechT: 0, leechN: 0,
    walk: 0, hurtT: 0, goldT: 0, taken: {}, affixes: { dive: {}, surge: {}, absorb: {} },
    equip: { head: null, body: null, hands: null, feet: null, acc: null },
    actives: []
  };
  if (typeof CreatureGameRuntime !== 'undefined') CreatureGameRuntime.attachPlayer(player);
  buildStartCards();
  const dbg = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('skill') : null;
  if (dbg && SKILL_DEFS[dbg]) { player.actives.push({ id: dbg, lvl: 1, supports: [], t: 0.3, uc: 0 }); state = 'play'; }
}
function hasItem(id) { return !!equipped(id); }
function getActive(id) { return player.actives.find(a => a.id === id); }
function recomputeEquip() {
  player.eqAtk = 0; player.eqCrit = 0; player.eqSpd = 1; player.eqDr = 0; player.eqRad = 1;
  let hpBonus = 0;
  const oldMaxInk = player.maxInk || BATTLE.player.maxInk;
  for (const s of SLOTS) {
    const eq = player.equip[s]; if (!eq) continue;
    const it = ITEM_DEFS[eq.key], mul = RARITY_LIST[rarityIndex(eq)].mul;
    player.eqAtk += Math.round(it.atk * mul); hpBonus += Math.round(it.hp * mul);
  }
  player.eqCrit += itemV('glove', 'crit', 15) / 100;
  player.eqSpd *= 1 + itemV('shoes', 'speed', 12) / 100;
  const hpRatio = player.maxhp > 0 ? player.hp / player.maxhp : 1;
  player.maxhp = BATTLE.player.hp + (player.metaHpBonus || 0) + hpBonus + player.bonusHp;
  player.hp = Math.max(1, Math.round(player.maxhp * hpRatio));
  player.maxInk = BATTLE.player.maxInk + (player.metaInkBonus || 0) + itemV('pendant', 'ink', 25);
  player.ink = Math.min(player.maxInk, player.ink + Math.max(0, player.maxInk - oldMaxInk));
}
function skillCalc(a) {
  // 主动等级：每级伤害 +15%、冷却 -4%；子弹技能 Lv2、Lv4 各增加 1 弹数
  const isStrike = (SKILL_TAGS[a.id] || []).includes('strike');
  const isProjectile = (SKILL_TAGS[a.id] || []).includes('proj');
  let dmg = 1 + 0.15 * (a.lvl - 1), cd = 1 - 0.04 * (a.lvl - 1);
  let count = isProjectile ? Math.floor(a.lvl / 2) : 0, rad = 1, pierce = 0, chain = 0, dot = 0, proj = 1, areaT = 1, unleash = 0, vuln = 0;
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
  const supportCount = a.supports.length;
  const compassRadius = Math.min(itemV('compass', 'cap', 20), itemV('compass', 'radius', 5) * supportCount) / 100;
  const itemRadius = (player.itemSurgeT > 0 ? itemV('surgeglove', 'radius') / 100 : 0) + (player.stillT >= 1 ? itemV('rulerband', 'radius') / 100 : 0);
  const totalSupports = player.actives.reduce((n, sk) => n + sk.supports.length, 0);
  const coreCd = Math.min(itemV('multicore', 'cap'), Math.floor(totalSupports / 4) * itemV('multicore', 'cd')) / 100;
  const fullInkCd = player.ink >= 80 ? itemV('fullink', 'cd') / 100 : 0;
  return {
    dmg: dmg * player.dmgMul * (1 + player.eqAtk / 100) * player.condDmg * (player.itemAmbushT > 0 ? 1.45 : 1),
    cd: cd * player.cdMul * Math.max(0.35, 1 - coreCd - fullInkCd),
    count, rad: rad * player.radMul * player.eqRad * (1 + compassRadius + itemRadius),
    pierce, chain, dot, proj, areaT, unleash, vuln,
    bdmg, bcrit, brad, lifeMul, homing: homing ? 2 + homing : 0, blast,
    admg, soak, bossMul, core, retick, lingerT, reburst, stain,
    strike: isStrike, sdmg, firstblood, combo, scrit, counter, rapid, sweep, followup, leech, shock,
    col: attrOf(a.id)
  };
}
function toast(txt) { toasts.push({ txt, t: 2.8 }); if (toasts.length > 3) toasts.shift(); }

/* ---------- 敌人（基础生命/攻击在 enemy-config.js 中配置） ---------- */
/* ---------- 关卡定义：10 页作业本 ---------- */
const STAGE_NAMES = ['横线练习本', '数学方格本', '田字格本', '英语本', '米字格本', '作文本', '五线谱本', '点阵本', '坐标纸', '草稿纸'];
// 每关纸色：米白/淡绿/米黄/淡蓝/暖黄/奶油/灰白/淡紫灰/淡青/旧黄
const STAGE_PAPER = ['#f5f1e6', '#eaf2e6', '#f7efdc', '#ecf1f8', '#f6eeda', '#fdf4e8', '#f0eee8', '#efeff4', '#eaf2f6', '#eee2cc'];
const BOSS_DEFS = [
  { name: '乱线魔王',       arch: 'charger', hp: 2200,  r: 51, dmg: 30, sp: 64 },
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
function scaledEnemyStats(d0) {
  const g = ENEMY_GROWTH, minutes = gameTime / 60, stage = curSt(), wave = Math.max(1, player.level);
  return {
    hp: d0.hp * g.hpBase
      * (1 + minutes * g.hpPerMinute)
      * (1 + (stage - 1) * g.hpPerStage)
      * (1 + (wave - 1) * g.hpPerWave),
    dmg: Math.round(d0.dmg
      * (1 + minutes * g.dmgPerMinute)
      * (1 + (stage - 1) * g.dmgPerStage)
      * (1 + (wave - 1) * g.dmgPerWave))
  };
}
function isShooter(e) { return !!(ENEMY_DEFS[e.type] && ENEMY_DEFS[e.type].attack === 'shoot'); }
function enemySwingRange(e) { return e.r + (e.elite ? 63 : 50); }
function enemyAttackDelay() {
  const rule = BATTLE.enemyAttack;
  const progress = Math.max(0, Math.min(1, (curSt() - 1) / (rule.maxStage - 1)));
  const min = rule.earlyMin + (rule.lateMin - rule.earlyMin) * progress;
  const max = rule.earlyMax + (rule.lateMax - rule.earlyMax) * progress;
  return (min + Math.random() * (max - min)) * (player.metaEnemyAttackMul || 1);
}
function initEnemyCombat(e, d0) {
  e.swingCd = enemyAttackDelay(); e.swingT = 0; e.swingHit = false; e.swingDamage = false; e.swingA = 0;
  e.shotCd = enemyAttackDelay(); e.shotWindup = 0; e.burstLeft = 0; e.burstT = 0;
  e.aimA = 0; e.faceA = 0;
  if (d0.attack === 'shoot') e.swingCd = 999999;
}
function fireEnemyShot(e, aimA) {
  const d0 = ENEMY_DEFS[e.type], count = d0.bulletCount || 1, spread = d0.spread || 0;
  for (let i = 0; i < count; i++) {
    const a = aimA + (i - (count - 1) / 2) * spread;
    ebullets.push({ x: e.x + Math.cos(a) * (e.r + 5), y: e.y + Math.sin(a) * (e.r + 5),
      vx: Math.cos(a) * d0.bulletSpeed, vy: Math.sin(a) * d0.bulletSpeed,
      dmg: Math.max(1, Math.round(e.dmg * 0.65)), life: 3.2, sourceId: e.id, reflectable: true });
  }
  sparks.push({ x: e.x, y: e.y, t: 0.16, color: RED });
}
function updateShooter(e, dt) {
  const d0 = ENEMY_DEFS[e.type];
  const hidden = player.diving && Math.hypot(player.x - e.x, player.y - e.y) > 85;
  const tx = hidden ? player.lastSeenX : player.x, ty = hidden ? player.lastSeenY : player.y;
  const dx = tx - e.x, dy = ty - e.y, d = Math.hypot(dx, dy) || 1;
  e.faceA = Math.atan2(dy, dx);
  let move = 0;
  if (d < d0.keepDist - 35) move = -1;
  else if (d > d0.keepDist + 55) move = 1;
  const moveScale = e.shotWindup > 0 ? 0.3 : 1;
  e.x += dx / d * e.sp * move * moveScale * dt;
  e.y += dy / d * e.sp * move * moveScale * dt;
  e.walk += dt * (move ? 8 : 3);
  if (e.burstLeft > 0) {
    e.burstT -= dt;
    if (e.burstT <= 0) {
      fireEnemyShot(e, Math.atan2(ty - e.y, tx - e.x));
      e.burstLeft--; e.burstT = d0.burstGap || 0.18;
    }
  } else if (e.shotWindup > 0) {
    e.shotWindup -= dt;
    if (e.shotWindup <= 0) {
      e.shotCd = enemyAttackDelay();
      if (d0.burst) { e.burstLeft = d0.burst; e.burstT = 0; }
      else fireEnemyShot(e, e.aimA);
    }
  } else {
    e.shotCd -= dt;
    if (e.shotCd <= 0 && d < 540) {
      e.aimA = Math.atan2(dy, dx); e.shotWindup = d0.shotWindup;
    }
  }
}
function updateMeleeSwing(e, dt) {
  const range = enemySwingRange(e);
  const d = Math.hypot(player.x - e.x, player.y - e.y);
  e.swingCd -= dt;
  if (e.swingT > 0) {
    e.swingT = Math.max(0, e.swingT - dt);
    if (e.swingT <= BATTLE.melee.active) {
      if (!e.swingHit) {
        e.swingHit = true;
        addHostileInk(e.x, e.y, 3, Math.max(18, e.r * 0.8), e.id);
      }
      // 命中圈持续期间逐帧检测，后按吸墨也能弹反；每次挥击仍只伤害一次
      const parried = reflectMeleeSwing(e);
      if (!parried && !e.swingDamage && d < range + player.r) {
        e.swingDamage = true;
        hurtPlayer(e.dmg, 'enemy', e);
      }
    }
  } else if (e.swingCd <= 0 && d < range + player.r + BATTLE.melee.triggerExtra) {
    e.swingCd = enemyAttackDelay(); e.swingT = BATTLE.melee.total; e.swingHit = false; e.swingDamage = false;
    e.swingA = Math.atan2(player.y - e.y, player.x - e.x);
  }
}
function normalEnemyCap() {
  return BATTLE.spawning.baseNormal + (curSt() - 1) * BATTLE.spawning.perStage;
}
function normalEnemyCount() {
  let count = 0;
  for (const e of enemies) if (!e.boss && !e.dead) count++;
  return count;
}
function spawnEnemy(typeOverride, x, y) {
  if (normalEnemyCount() >= normalEnemyCap()) return;
  const t = gameTime;
  const normalPool = Object.keys(ENEMY_DEFS).filter(k => !ENEMY_DEFS[k].elite && t >= ENEMY_DEFS[k].after);
  const elitePool = Object.keys(ENEMY_DEFS).filter(k => ENEMY_DEFS[k].elite && t + (player.metaEliteEarly || 0) >= ENEMY_DEFS[k].after);
  let type = typeOverride || normalPool[Math.floor(Math.random() * normalPool.length)] || 'stick';
  // 精英约 4.5% 概率替换本次普通刷怪；编队指定怪物时不随机替换
  if (!typeOverride && elitePool.length && Math.random() < 0.045) type = elitePool[Math.floor(Math.random() * elitePool.length)];
  const a = Math.random() * Math.PI * 2, d = 430 + Math.random() * 120;
  const d0 = ENEMY_DEFS[type], grown = scaledEnemyStats(d0);
  const st = curSt();
  const e = {
    id: nextId++, type, name: d0.name, elite: !!d0.elite, swarm: !!d0.swarm,
    x: clampW(x === undefined ? player.x + Math.cos(a) * d : x, 20),
    y: clampH(y === undefined ? player.y + Math.sin(a) * d : y, 20),
    r: d0.r, hp: grown.hp, sp: d0.sp, dmg: grown.dmg, xp: d0.xp + st,
    walk: Math.random() * 6, hitCd: 0, flash: 0, squash: 0, dotT: 0, dotDps: 0,
    vx: 0, vy: 0, kbx: 0, kby: 0
  };
  e.maxhp = e.hp; e.baseMaxHp = e.maxhp; e.baseR = e.r; e.baseDmg = e.dmg; e.ink = 0;
  initEnemyCombat(e, d0);
  e.inkCd = 1 + Math.random() * 1.5;
  e.trailX = e.x; e.trailY = e.y;
  if (type === 'plane') {
    const aa = Math.atan2(player.y - e.y, player.x - e.x);
    e.vx = Math.cos(aa); e.vy = Math.sin(aa);
  }
  enemies.push(e);
}
function spawnHorde() {
  const form = hordeIndex++ % 3, late = gameTime >= 90;
  const n = gameTime < 30 ? 10 : (late ? 28 : 16);
  const a = Math.random() * Math.PI * 2, fx = Math.cos(a), fy = Math.sin(a), px = -fy, py = fx;
  let type = 'doodle', label = '涂鸦人潮涌过来了！';
  if (form === 1 && gameTime >= 35) { type = 'spider'; label = '墨线蜘蛛从四周围拢！'; }
  if (form === 2 && gameTime >= 140) { type = 'plane'; label = '纸飞机编队冲进纸面！'; }
  for (let i = 0; i < n; i++) {
    let x, y;
    if (form === 1) {   // 包围圈
      const aa = i / n * Math.PI * 2 + a, d = 290 + (i % 3) * 24;
      x = player.x + Math.cos(aa) * d; y = player.y + Math.sin(aa) * d;
    } else if (form === 2) {   // V 字编队
      const row = Math.floor(i / 2) + 1, side = i % 2 ? 1 : -1;
      x = player.x + fx * (430 + row * 22) + px * side * row * 24;
      y = player.y + fy * (430 + row * 22) + py * side * row * 24;
    } else {   // 多排人潮
      const row = Math.floor(i / 5), col = i % 5;
      x = player.x + fx * (430 + row * 30) + px * (col - 2) * 28;
      y = player.y + fy * (430 + row * 30) + py * (col - 2) * 28;
    }
    spawnEnemy(type, x, y);
  }
  if (hordeIndex % 4 === 0 && gameTime >= 100) {
    const elites = Object.keys(ENEMY_DEFS).filter(k => ENEMY_DEFS[k].elite && gameTime + (player.metaEliteEarly || 0) >= ENEMY_DEFS[k].after);
    if (elites.length) spawnEnemy(elites[Math.floor(Math.random() * elites.length)], player.x + fx * 400, player.y + fy * 400);
  }
  toast(label);
}
/* ---------- Boss（三种原型：charger 冲刺 / caster 龙息陨石 / blob 弹幕召唤） ---------- */
function spawnBoss(st) {
  // Boss 登场直接撤走所有小怪与敌方弹幕，不触发击杀、经验或掉落结算。
  enemies = enemies.filter(e => e.boss && !e.dead);
  ebullets = []; hazards = [];
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
  e.maxhp = e.hp; e.baseMaxHp = e.maxhp; e.baseR = e.r; e.baseDmg = e.dmg; e.ink = 0;
  if (e.stage === 1 && typeof BossHuntRuntime !== 'undefined') BossHuntRuntime.init(e);
  enemies.push(e);
  crumpleT = 0.7; shakeT = 0.5;
  toast('纸面被揉皱了…… ' + def.name + ' 爬了出来！');
}
function summonMob(type, x, y) {
  if (normalEnemyCount() >= normalEnemyCap()) return null;
  const d0 = ENEMY_DEFS[type], grown = scaledEnemyStats(d0);
  const e = {
    id: nextId++, type, name: d0.name, elite: !!d0.elite, x, y,
    r: d0.r, hp: grown.hp, sp: d0.sp, dmg: grown.dmg, xp: d0.xp + curSt(),
    walk: Math.random() * 6, hitCd: 0, flash: 0, squash: 0, dotT: 0, dotDps: 0, vx: 0, vy: 0, kbx: 0, kby: 0
  };
  e.maxhp = e.hp; e.baseMaxHp = e.maxhp; e.baseR = e.r; e.baseDmg = e.dmg; e.ink = 0;
  initEnemyCombat(e, d0);
  enemies.push(e);
  return e;
}
function spawnInkShade(skillId) {
  const a = Math.random() * Math.PI * 2;
  const e = summonMob('rage', clampW(player.x + Math.cos(a) * 170, 20), clampH(player.y + Math.sin(a) * 170, 20));
  if (!e) return false;
  e.shade = true; e.shadeSkill = skillId; e.name = '墨债·' + SKILL_DEFS[skillId].name;
  e.sp = 92; e.shadeCd = 1.1; e.xp = 5;
  e.hp = e.maxhp = e.maxhp * 1.35; e.baseMaxHp = e.maxhp;
  toast('墨债成形：' + SKILL_DEFS[skillId].name + ' 被复制了！');
  return true;
}
function updateInkShade(e, dt) {
  const pa = Math.atan2(player.y - e.y, player.x - e.x);
  e.x += Math.cos(pa) * e.sp * dt; e.y += Math.sin(pa) * e.sp * dt; e.walk += dt * 10;
  e.shadeCd -= dt;
  if (e.shadeCd > 0) return;
  e.shadeCd = 2.6;
  const tags = SKILL_TAGS[e.shadeSkill] || ['strike'];
  if (tags.includes('proj')) {
    for (let i = -1; i <= 1; i++) ebullets.push({ x: e.x, y: e.y, vx: Math.cos(pa + i * 0.22) * 185,
      vy: Math.sin(pa + i * 0.22) * 185, dmg: Math.round(e.dmg * 0.65), life: 3.2, sourceId: e.id });
  } else if (tags.includes('area')) {
    hazards.push({ kind: 'meteor', x: player.x, y: player.y, r: 52, delay: 0.75,
      dmg: Math.round(e.dmg * 0.8), t: 0.35, done: false });
  } else {
    hazards.push({ kind: 'meteor', x: e.x, y: e.y, r: 68, delay: 0.5,
      dmg: Math.round(e.dmg * 0.9), t: 0.35, done: false });
  }
}
function updateBoss(e, dt) {
  if (e.huntBoss && typeof BossHuntRuntime !== 'undefined') { BossHuntRuntime.update(e, dt); return; }
  const pa = Math.atan2(player.y - e.y, player.x - e.x);
  if (e.phase === 1 && e.hp < e.maxhp * (player.metaBossPhaseAt || 0.5)) {
    e.phase = 2; e.sp *= 1.35; crumpleT = 0.7; shakeT = 0.5;
    toast(e.name + ' 暴走了！线条开始崩坏！');
  }
  const rate = (e.phase === 2 ? 0.6 : 1) * (player.metaEnemyAttackMul || 1);
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
    if (e.summonT <= 0 && normalEnemyCount() < normalEnemyCap()) {
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
      hazards.push({ kind: 'cone', x: e.x, y: e.y, ang: pa, arc: 0.75, range: 300, delay: 0.9, dmg: Math.round(e.dmg * 0.9), t: 0.6, done: false, sourceId: e.id });
    }
    if (e.meteorCd <= 0) {
      e.meteorCd = (e.phase === 2 ? 2.2 : 3.2);
      const n = (e.phase === 2 ? 7 : 5) + Math.floor(e.stage / 3);
      for (let i = 0; i < n; i++) {
        hazards.push({
          kind: 'meteor', x: player.x + (Math.random() - 0.5) * 340, y: player.y + (Math.random() - 0.5) * 340,
          r: 46, delay: 0.85 + Math.random() * 0.4, dmg: Math.round(e.dmg * 0.7), t: 0.35, done: false, sourceId: e.id
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
        ebullets.push({ x: e.x, y: e.y, vx: Math.cos(a) * 135, vy: Math.sin(a) * 135, dmg: Math.round(e.dmg * 0.55), life: 3.2, sourceId: e.id });
      }
      for (let i = 0; i < 3; i++) {
        const a = i / 3 * Math.PI * 2 + e.walk;
        addHostileInk(e.x + Math.cos(a) * (e.r + 42), e.y + Math.sin(a) * (e.r + 42), 12 + e.stage, 32, e.id);
      }
    }
    if (e.sumCd <= 0 && normalEnemyCount() < normalEnemyCap()) {
      e.sumCd = 6 * rate;
      for (let i = 0; i < 3; i++) summonMob('spider', e.x + (Math.random() - 0.5) * 80, e.y + (Math.random() - 0.5) * 80);
    }
  }
}
function xpForNextLevel(level) {
  // 首级需求从 8 提高到 26，后续需求加速增长，明显减少升级打断
  return 18 + Math.round(level * 8 + level * level * 0.35);
}
function killEnemy(e) {
  if (e.dead) return;
  e.dead = true; kills++;
  killChain++; killChainT = 1.25;
  if (killChain === 10 || killChain === 25 || killChain === 50 || killChain === 100) toast(killChain + ' 连擦！');
  if (killChain % 10 === 0) shakeT = Math.max(shakeT, 0.09);
  if (e.boss) {
    // Boss 只补足当前一级，不再额外散落经验珠，也不把超额经验滚到下一级
    player.xp = player.xpNext;
  } else {
    let xpGain = e.xp * player.xpMul;
    if (hasItem('bookmark') && Math.random() < 0.08) xpGain += e.xp * player.xpMul * 0.5;
    player.xp += xpGain;
  }
  if (hasItem('pendant') && kills % 10 === 0) player.hp = Math.min(player.maxhp, player.hp + 1);
  // 击杀爆开己方墨迹：输出会转化为下一片可潜行、补墨的领地
  const deathCol = player.actives.length ? trailColorOf(player.actives[0].id) : INK;
  addInkStain(e.x, e.y, e.boss ? 12 : 3, e.boss ? 55 : 23, deathCol, false, true);
  if (e.type === 'inksac') addHostileInk(e.x, e.y, 35, 55, e.id);
  // 这只怪物仍留在纸上的移动与攻击墨迹全部归玩家；被其他来源覆盖的不追回
  convertEnemyInk(e.id);
  // 来源怪物已死亡但墨弹仍存活时，后续路径也直接画成己方；子弹本身的伤害不变
  for (const eb of ebullets) if (eb.sourceId === e.id) eb.inkConverted = true;
  if (e.ink > 0) {   // 养肥后击杀：返还大部分墨量，并产生一次墨爆
    const amount = e.ink; e.ink = 0;
    player.ink = Math.min(player.maxInk, player.ink + amount * 0.7);
    floats.push({ x: e.x, y: e.y - e.r - 16, txt: '夺墨+' + Math.round(amount * 0.7), t: 1, color: PURPLE });
    erupts.push({ x: e.x, y: e.y, delay: 0.05, dmg: 12 + amount * 2.2, r: 45 + amount * 0.8,
      c: { col: PURPLE }, done: false, t: 0 });
  }
  if (e.boss) {
    shakeT = 0.5;
    const bossTest = typeof window !== 'undefined' && window.__metaRuntime && window.__metaRuntime.run && window.__metaRuntime.run.mode === 'bossTest';
    if (!bossTest) drops.push({ ...makeEquipmentDrop(e.x, e.y), bob: 0 });
    if (bossTest || e.stage >= 10) { crumpleT = 0.8; state = 'win'; }
    else toast(e.name + ' 被涂掉了！第 ' + e.stage + ' 页通过！');
    return;
  }
  erases.push({ x: e.x, y: e.y, r: e.r, t: 0.28, seed: e.id });
  if (erases.length > 140) erases.shift();
  const rate = e.elite ? 0.35 : (e.type === 'rage' ? 0.15 : 0.025);
  if (Math.random() < rate && drops.length < 12) {
    drops.push(makeEquipmentDrop(e.x, e.y));
  }
}
function hurtEnemy(e, dmg, dotDps, sx, sy, vuln, critAdd, bossMul, hitCol, weakFloat, skillId) {
  if (e.dead) return;
  if (player.taken.inkpower && playerOnOwnInk()) dmg *= BATTLE.traits.inkDamageMul;
  if (e.vulnT > 0) dmg *= 1 + e.vuln;   // 破绽标记：受伤加深
  if (e.areaVulnT > 0) dmg *= 1 + e.areaVuln;   // 纸面浸透：区域易伤
  if (e.boss && bossMul) dmg *= 1 + bossMul;    // 压纸重涂：对 Boss 加伤
  if (e.huntBoss && (e.huntMode === 'fatigue' || e.huntMode === 'down')) dmg *= 1.2;
  if (vuln) { e.vuln = vuln; e.vulnT = 2; }
  let crit = false;
  const critChance = player.crit + player.eqCrit + (critAdd || 0);
  const critMul = hasItem('glove') ? 2.5 : 2;
  if (critChance > 0 && Math.random() < critChance) { dmg *= critMul; crit = true; }
  e.hp -= dmg; e.flash = 0.12; e.squash = SQUASH_T;
  const kx = e.x - (sx === undefined ? player.x : sx);
  const ky = e.y - (sy === undefined ? player.y : sy);
  const kd = Math.hypot(kx, ky) || 1;
  const kbMul = e.boss ? 0.1 : (e.elite ? 0.35 : 1);
  if (!(e.parryKbT > 0)) {
    e.kbx = kx / kd * KNOCK_V * kbMul; e.kby = ky / kd * KNOCK_V * kbMul;
  }
  if (dotDps) { e.dotDps = Math.max(e.dotDps, dotDps); e.dotT = 3; }
  sparks.push({ x: e.x + (Math.random() - 0.5) * e.r, y: e.y + (Math.random() - 0.5) * e.r, t: 0.18, color: hitCol || INK });
  floats.push({ x: e.x + (Math.random() - 0.5) * 40, y: e.y - e.r - 8 - Math.random() * 18, txt: Math.round(dmg) + (crit ? '!' : ''), t: 0.7, color: hitCol || INK, crit, weak: !!weakFloat });
  if (e.huntBoss && e.hp > 0 && typeof BossHuntRuntime !== 'undefined') BossHuntRuntime.onDamage(e, sx, sy, dmg);
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
  hurtEnemy(e, dmg, dmg * (c.dot || 0), sx, sy, c.vuln, c.strike ? c.scrit : 0, c.bossMul, c.col, false, c.hadesSkill);
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
function isInkEater(e) { return e.type === 'leech' || e.type === 'inkthief'; }
function updateInkEater(e, dt) {
  if (e.ink >= 60 || !inkPaintedCount) return false;
  let target = e.inkTarget;
  if (target && inkCellAt(target.x, target.y).owner) target.d = Math.hypot(target.x - e.x, target.y - e.y);
  else { target = nearestInkCell(e.x, e.y, 500); e.inkTarget = target; }
  if (!target) return false;
  const d = target.d || 1;
  e.x += (target.x - e.x) / d * e.sp * (e.slowT > 0 ? 0.5 : 1) * dt;
  e.y += (target.y - e.y) / d * e.sp * (e.slowT > 0 ? 0.5 : 1) * dt;
  e.walk += dt * 8;
  if (d < e.r + 12) {
    const amount = Math.min(consumeInkDisk(target.x, target.y, Math.max(12, e.r)), 60 - e.ink);
    e.inkTarget = null;
    e.ink += amount;
    e.maxhp += amount * 4; e.hp += amount * 4; e.dmg += amount * 0.12;
    e.r = Math.min(e.baseR + 10, e.baseR + e.ink * 0.12);
    floats.push({ x: e.x, y: e.y - e.r - 8, txt: '吸墨+' + Math.round(amount), t: 0.8, color: PURPLE });
    sparks.push({ x: e.x, y: e.y, t: 0.18, color: PURPLE });
  }
  return true;
}
function drainEnemyInk(e, amount) {
  const drained = Math.min(e.ink || 0, amount);
  if (drained <= 0) return 0;
  e.ink -= drained;
  e.maxhp = Math.max(e.baseMaxHp, e.maxhp - drained * 4); e.hp = Math.min(e.hp, e.maxhp);
  e.dmg = Math.max(e.baseDmg, e.dmg - drained * 0.12);
  e.r = Math.max(e.baseR, e.baseR + e.ink * 0.12);
  floats.push({ x: e.x, y: e.y - e.r - 8, txt: '抽墨-' + Math.round(drained), t: 0.8, color: INK });
  return drained;
}
function enemyInkFactor(e) {
  if (inkCircleHas(e.x, e.y, e.r * 0.35, true)) return BATTLE.ink.enemyOwnSpeed;
  if (inkCircleHas(e.x, e.y, e.r * 0.35, false)) return BATTLE.ink.enemyFriendlySpeed;
  return 1;
}
function diveInkCost() {
  const own = playerOnOwnInk();
  let reduction = hasAffix('dive', 'inksaver') ? 0.18 : 0;
  if (!own && hasAffix('dive', 'grayboat')) reduction += 0.25;
  if (hasAffix('dive', 'longbreath')) reduction += Math.min(0.3, Math.floor(player.diveT) * 0.05);
  if (player.hp < player.maxhp * 0.35 && hasAffix('dive', 'lowhpdive')) reduction += 0.25;
  if (player.surgeCharging && hasAffix('surge', 'divesurge')) reduction += 0.35;
  return (own ? BATTLE.dive.ownCost : BATTLE.dive.otherCost) * Math.max(0.5, 1 - reduction);
}
function convertGrayDisk(x, y, radius) {
  const b = inkGridBounds(x, y, x, y, radius), rr = radius * radius;
  let converted = 0;
  for (let gy = b.y0; gy <= b.y1; gy++) for (let gx = b.x0; gx <= b.x1; gx++) {
    const wx = WORLD_L + (gx + 0.5) * INK_CELL - x, wy = WORLD_T + (gy + 0.5) * INK_CELL - y;
    if (wx * wx + wy * wy > rr) continue;
    const i = gy * INK_GW + gx; if (inkOwner[i] !== 2) continue;
    inkOwner[i] = 1; inkAmount[i] = 1; inkPulse[i] = 0; setInkSource(i, 0); syncInkPixel(i); converted++;
  }
  if (converted) {
    putInkRegion(friendlyInkLayer, b.x0, b.y0, b.x1, b.y1);
    putInkRegion(hostileInkLayer, b.x0, b.y0, b.x1, b.y1);
  }
  return converted;
}
function enterDive() {
  player.diving = true; player.diveT = 0; player.diveSpent = 0; player.diveEntryT = 0.6;
  player.lastSeenX = player.x; player.lastSeenY = player.y;
  if (hasAffix('dive', 'freeentry') && gameTime >= player.diveFreeT) { player.diveFreeT = gameTime + 4; player.diveEntryFreeT = 0.45; }
  else player.diveEntryFreeT = 0;
  if (hasAffix('dive', 'decoy') && gameTime >= player.diveDecoyT) {
    player.diveDecoyT = gameTime + 4; diveDecoys.push({ x: player.x, y: player.y, t: 1.5 });
  }
  if (hasAffix('dive', 'entrywash') && gameTime >= player.diveWashT) {
    player.diveWashT = gameTime + 2; convertGrayDisk(player.x, player.y, 35 * player.radMul);
  }
  toast('潜墨：无敌位移 · 当前耗墨 ' + diveInkCost().toFixed(1) + '/秒');
}
function exitDive() {
  if (!player.diving) return;
  const ox = player.x, oy = player.y;
  player.diving = false;
  player.diveCd = (BATTLE.dive.cooldown || 1) * player.cdMul * (hasAffix('dive', 'fastdive') ? 0.5 : 1);
  if (hasAffix('dive', 'inkrefund')) refundInk(Math.min(12, player.diveSpent * 0.2), player.x, player.y - 28, '余墨');
  if (hasAffix('dive', 'exitburst') && gameTime >= player.diveBurstT) {
    player.diveBurstT = gameTime + 1.5;
    const burstRadius = 75 * player.radMul;
    novas.push({ x: player.x, y: player.y, t: 0.25, max: burstRadius, col: inkFriendlyColor });
    for (const e of enemies) {
      if (e.dead || Math.hypot(e.x - player.x, e.y - player.y) >= burstRadius + e.r) continue;
      hurtEnemy(e, 30 * player.dmgMul * (1 + player.eqAtk / 100) * (player.metaDiveMul || 1), 0, player.x, player.y, 0, 0, 0, inkFriendlyColor);
      if (!e.dead) { e.kbx *= 2.5; e.kby *= 2.5; e.stunT = Math.max(e.stunT || 0, e.boss ? 0.1 : 0.3); }
    }
  }
  if (hasAffix('dive', 'ambush')) player.itemAmbushT = 2;
  if (hasAffix('dive', 'exitshield') && gameTime >= player.diveShieldCd) {
    player.diveShieldCd = gameTime + 3; player.exitShieldT = 1;
  }
  if (hasAffix('dive', 'exitdash')) {
    player.x = clampW(player.x + Math.cos(player.faceA) * 55, 14);
    player.y = clampH(player.y + Math.sin(player.faceA) * 55, 14);
    addInkStroke(ox, oy, player.x, player.y, inkFriendlyColor, false);
  }
}
function toggleDive() {
  if (state !== 'play') return false;
  if (player.diving) { exitDive(); return true; }
  if (player.diveCd > 0) { toast('潜墨冷却 ' + player.diveCd.toFixed(1) + ' 秒'); return false; }
  if (player.ink <= 0) { toast('墨水不足，无法潜墨'); return false; }
  enterDive(); return true;
}
function chargeTurf(amount) {
  if (inkSurgePainting || amount <= 0 || player.special >= 100) return;
  player.special = Math.min(100, player.special + amount);
  player.turf += amount;
  if (player.special >= 100 && !player.specialAnnounced) {
    player.specialAnnounced = true;
    toast('墨潮已满！长按「墨潮」蓄力，松开释放');
  }
}
function chargeTrail(amount) {
  if (amount <= 0 || inkSurgePainting) return 0;
  const allowed = Math.min(amount, player.trailChargeBudget || 0);
  if (allowed <= 0) return 0;
  const before = player.special;
  chargeTurf(allowed);
  const applied = Math.max(0, player.special - before);
  player.trailChargeBudget = Math.max(0, player.trailChargeBudget - applied);
  return applied;
}
function surgeChargeTime() { return BATTLE.surge.chargeTime * player.cdMul * (hasAffix('surge', 'fastcharge') ? 0.75 : 1); }
function inkSurgeChargeRatio() {
  return Math.min(1, Math.max(0, player.surgeChargeT / surgeChargeTime()));
}
function inkSurgeChargeRadius() {
  const s = BATTLE.surge;
  let radius = s.radius * (s.minScale + (s.maxScale - s.minScale) * inkSurgeChargeRatio());
  if (hasAffix('surge', 'surgewide')) radius *= 1.18;
  radius *= 1 + player.surgeGrowth * 0.08;
  if (player.diving && hasAffix('surge', 'divesurge')) radius *= 0.9;
  return radius;
}
function startInkSurgeCharge(pointerId = null) {
  if (state !== 'play') return false;
  if (player.special < 100) { toast('墨潮还未充满，涂新区域或覆盖灰墨'); return false; }
  if (player.surgeCharging) return player.surgePointerId === pointerId;
  player.surgeCharging = true; player.surgeChargeT = 0; player.surgePointerId = pointerId;
  return true;
}
function updateInkSurgeCharge(dt) {
  if (player.surgeCharging) {
    const speed = player.diving && hasAffix('dive', 'divefastcharge') ? 1.35 : 1;
    player.surgeChargeT = Math.min(surgeChargeTime(), player.surgeChargeT + dt * speed);
  }
}
function cancelInkSurgeCharge(pointerId = null) {
  if (!player.surgeCharging || player.surgePointerId !== pointerId) return false;
  player.surgeCharging = false; player.surgeChargeT = 0; player.surgePointerId = null;
  return true;
}
function releaseInkSurgeCharge(pointerId = null) {
  if (!player.surgeCharging || player.surgePointerId !== pointerId) return false;
  const radius = inkSurgeChargeRadius(), full = inkSurgeChargeRatio() >= 0.999;
  player.surgeCharging = false; player.surgeChargeT = 0; player.surgePointerId = null;
  return castInkSurge(radius, full);
}
function castInkSurge(radius = BATTLE.surge.radius, full = false) {
  if (state !== 'play') return false;
  if (player.special < 100) { toast('墨潮还未充满，涂新区域或覆盖灰墨'); return false; }
  radius *= player.radMul;
  // 从伤害结算开始就封锁涂地充能，墨潮击杀产生的死亡墨团也不能反哺下一发墨潮
  inkSurgePainting = true;
  player.special = 0; player.specialAnnounced = false;
  player.surgeCharging = false; player.surgeChargeT = 0; player.surgePointerId = null;
  const col = player.actives.length ? trailColorOf(player.actives[0].id) : INK;
  let damage = BATTLE.surge.damage * player.dmgMul * (1 + player.eqAtk / 100) * (player.metaSurgeMul || 1);
  if (hasAffix('surge', 'surgedamage')) damage *= 1.3;
  if (full && hasAffix('surge', 'fulldamage')) damage *= 1.55;
  if (full && hasAffix('surge', 'inkburst') && player.ink >= 25) { player.ink -= 25; damage *= 1.8; }
  novas.push({ x: player.x, y: player.y, t: BATTLE.surge.visual, max: radius, col, outerDamage: hasAffix('surge', 'outerdamage') });
  shakeT = Math.max(shakeT, 0.42);
  for (const e of enemies) {
    const d = Math.hypot(e.x - player.x, e.y - player.y);
    if (e.dead || d >= radius + e.r) continue;
    let hitDamage = damage;
    if (hasAffix('surge', 'outerdamage') && d >= radius * 0.7) hitDamage *= 1.5;
    if (hasAffix('surge', 'surgeseed')) e.surgeSeedT = 0.2;
    hurtEnemy(e, hitDamage, 0, player.x, player.y, 0, 0, 0, col);
    if (!e.dead) {
      e.surgeSeedT = 0;
      const kb = hasAffix('surge', 'surgeknock') ? 3.52 : 2.2;
      e.kbx *= kb; e.kby *= kb;
      if (e.boss && hasAffix('surge', 'surgeknock')) { e.x += (e.x - player.x) / (d || 1) * 8; e.y += (e.y - player.y) / (d || 1) * 8; }
      if (full && hasAffix('surge', 'fullstun')) e.stunT = Math.max(e.stunT || 0, e.boss ? 0.15 : 0.6);
      if (hasAffix('surge', 'surgeslow')) e.surgeSlowT = 3;
      if (hasAffix('surge', 'silence') && (isShooter(e) || e.boss)) e.sealT = Math.max(e.sealT || 0, e.boss ? 0.6 : 2);
    }
  }
  if (hasAffix('surge', 'clearbullets')) {
    for (const eb of ebullets) if (Math.hypot(eb.x - player.x, eb.y - player.y) < radius) eb.life = 0;
  }
  if (hasAffix('surge', 'surgeprojectiles')) {
    for (let i = 0; i < 8; i++) fireBullet(player.x, player.y, i / 8 * Math.PI * 2, 260, damage * 0.45, 'surge', { life: 1.2, col });
  }
  inkSurgePainting = true;
  if (hasAffix('surge', 'washink')) {
    const covered = convertGrayDisk(player.x, player.y, radius);
    if (covered) refundInk(Math.min(15, covered / 80), player.x, player.y - 30, '洗地');
  }
  addInkStain(player.x, player.y, 28, radius, col, false, false);
  if (full && hasAffix('surge', 'outerink')) {
    const ringR = radius + 22.5;
    for (let i = 0; i < 48; i++) {
      const a = i / 48 * Math.PI * 2, b = (i + 1) / 48 * Math.PI * 2;
      paintInkSegment(player.x + Math.cos(a) * ringR, player.y + Math.sin(a) * ringR,
        player.x + Math.cos(b) * ringR, player.y + Math.sin(b) * ringR, 22.5, 4, col, false, false, 0);
    }
  }
  inkSurgePainting = false;
  if (hasAffix('surge', 'surgeecho')) chargeTurf(BATTLE.traits.surgeRetain);
  if (full && hasItem('surgeglove')) player.itemSurgeT = 3;
  player.surgeGrowth = 0;
  if (player.diving && !hasAffix('dive', 'divecast')) exitDive();
  return true;
}
function castMeleeInkSurge() {
  const col = player.actives.length ? trailColorOf(player.actives[0].id) : INK;
  const radius = ABSORB_RULE.meleeRadius * player.radMul * (hasAffix('absorb', 'meleeradius') ? 1.3 : 1);
  const damage = ABSORB_RULE.meleeDamage * player.dmgMul * (1 + player.eqAtk / 100) * (hasAffix('absorb', 'meleedamage') ? 1.45 : 1) * (player.metaAbsorbMul || 1);
  novas.push({ x: player.x, y: player.y, t: BATTLE.surge.visual, max: radius, col });
  for (const e of enemies) {
    if (e.dead || Math.hypot(e.x - player.x, e.y - player.y) >= radius + e.r) continue;
    hurtEnemy(e, damage, 0, player.x, player.y, 0, 0, 0, col);
    if (!e.dead) {
      const kb = hasAffix('absorb', 'meleeradius') ? 4.5 : 3.6;
      e.kbx *= kb; e.kby *= kb; e.parryKbT = 0.25;
    }
  }
  inkSurgePainting = true;
  addInkStain(player.x, player.y, 14, radius, col, false, false);
  inkSurgePainting = false;
}
function castAbsorb() {
  if (state !== 'play' || player.absorbCd > 0) return false;
  const onOwnInk = playerOnOwnInk();
  player.absorbDuration = (onOwnInk ? ABSORB_RULE.ownDuration : ABSORB_RULE.duration) + (hasAffix('absorb', 'longabsorb') ? 0.08 : 0);
  player.absorbRadius = ((onOwnInk ? ABSORB_RULE.ownRadius : ABSORB_RULE.radius) + (hasAffix('absorb', 'wideabsorb') ? 20 : 0)) * player.radMul;
  player.absorbT = player.absorbDuration;
  player.absorbCd = Math.max(0.45, ABSORB_RULE.cooldown * player.cdMul * (hasAffix('absorb', 'fastabsorb') ? 0.8 : 1));
  player.absorbGain = 0; player.absorbHeal = 0; player.absorbInkUsed = false;
  if (player.diving) exitDive();
  sparks.push({ x: player.x, y: player.y, t: 0.2, color: inkFriendlyColor });
  return true;
}
function rewardAbsorb(amount) {
  if (player.absorbInkUsed) return 0;
  amount *= hasAffix('absorb', 'parrywell') ? BATTLE.traits.absorbInkMul : 1;
  const cap = hasAffix('absorb', 'gaincap') ? 20 : ABSORB_RULE.maxGain;
  const allowed = Math.min(amount, Math.max(0, cap - player.absorbGain));
  if (allowed <= 0) return 0;
  const gained = refundInk(allowed, player.x, player.y - 32, '吸墨');
  if (gained > 0) player.absorbInkUsed = true;
  player.absorbGain += gained;
  return gained;
}
function chargeParry() {
  let amount = ABSORB_RULE.charge * (hasAffix('absorb', 'parrycharge') ? BATTLE.traits.parryChargeMul : 1);
  if (hasAffix('absorb', 'perfect') && player.absorbDuration - player.absorbT <= 0.12) amount *= 2;
  chargeTurf(amount);
  if (hasAffix('absorb', 'parrycooldown')) chargeTurf(4);
  player.absorbCd = ABSORB_RULE.successCooldown * player.cdMul;
  if (hasAffix('absorb', 'parryshield')) player.parryShieldT = 1;
  if (hasAffix('absorb', 'parryheal') && player.absorbHeal < 6) {
    player.absorbHeal += 2; player.hp = Math.min(player.maxhp, player.hp + 2);
  }
  if (hasAffix('absorb', 'surgegrowth')) player.surgeGrowth = Math.min(5, player.surgeGrowth + 1);
  if (hasAffix('surge', 'chargeparry') && player.surgeCharging) player.surgeChargeT = Math.min(surgeChargeTime(), player.surgeChargeT + surgeChargeTime() * 0.25);
  if (hasItem('parrygrip')) player.itemParryT = 2;
}
function reflectEnemyBullet(eb) {
  if (player.absorbT <= 0 || eb.reflectable === false || eb.life <= 0) return false;
  hitStopT = Math.max(hitStopT, ABSORB_RULE.hitStop);
  eb.life = 0;
  if (eb.sourceId && !eb.inkConverted) inkCutChecks.add(eb.sourceId);
  const source = enemies.find(e => e.id === eb.sourceId && !e.dead);
  const target = source || nearestEnemy(eb.x, eb.y, 480);
  const a = target ? Math.atan2(target.y - eb.y, target.x - eb.x) : Math.atan2(-eb.vy, -eb.vx);
  const speed = Math.max(160, Math.hypot(eb.vx, eb.vy) * 1.25);
  let damage = eb.dmg * 1.5 * (hasAffix('absorb', 'reflectdamage') ? 1.45 : 1) * (player.metaAbsorbMul || 1);
  const split = hasAffix('absorb', 'reflectsplit');
  if (split) damage *= 0.55;
  const count = split ? 3 : 1;
  for (let i = 0; i < count; i++) {
    const shotA = a + (i - (count - 1) / 2) * 0.22;
    fireBullet(eb.x, eb.y, shotA, speed, damage, 'reflect', {
      hits: 1 + (hasAffix('absorb', 'reflectpierce') ? 2 : 0), life: 2, col: inkFriendlyColor,
      reflected: true, homing: hasAffix('absorb', 'reflecthoming') ? 7 : 0, inkWide: hasAffix('absorb', 'reflecttrail') ? 1.8 : 1
    });
  }
  addInkStain(eb.x, eb.y, 4, 28, inkFriendlyColor, false, true);
  if (hasAffix('absorb', 'bulletink')) addInkStain(player.x, player.y, 8, 55, inkFriendlyColor, false, false);
  rewardAbsorb(ABSORB_RULE.bulletInk);
  chargeParry();
  floats.push({ x: player.x, y: player.y - 45, txt: '弹反！', t: 0.65, color: inkFriendlyColor, crit: true });
  sparks.push({ x: eb.x, y: eb.y, t: 0.22, color: inkFriendlyColor });
  return true;
}
function reflectMeleeSwing(e) {
  // 已实际命中的挥击不能补报弹反；未造成伤害、仅双圈相交时仍可后按弹反
  if (player.absorbT <= 0 || e.dead || e.swingDamage) return false;
  const d = Math.hypot(player.x - e.x, player.y - e.y);
  if (d >= enemySwingRange(e) + player.absorbRadius) return false;
  hitStopT = Math.max(hitStopT, ABSORB_RULE.hitStop);
  hurtEnemy(e, e.dmg * 1.5 * (player.metaAbsorbMul || 1), 0, player.x, player.y, 0, 0, 0, inkFriendlyColor);
  if (!e.dead) {
    e.stunT = Math.max(e.stunT || 0, e.elite ? 0.2 : 0.5);
    e.swingT = 0;
  }
  rewardAbsorb(ABSORB_RULE.meleeInk);
  chargeParry();
  floats.push({ x: player.x, y: player.y - 45, txt: '弹反！', t: 0.7, color: inkFriendlyColor, crit: true });
  sparks.push({ x: e.x, y: e.y, t: 0.24, color: inkFriendlyColor });
  castMeleeInkSurge();
  shakeT = Math.max(shakeT, 0.1);
  return true;
}
function hazardTouchesCircle(hz, x, y, radius) {
  const d = Math.hypot(x - hz.x, y - hz.y);
  if (hz.kind === 'meteor') return d < hz.r + radius;
  let da = Math.atan2(y - hz.y, x - hz.x) - hz.ang;
  while (da > Math.PI) da -= Math.PI * 2;
  while (da < -Math.PI) da += Math.PI * 2;
  const angularPad = d > 0 ? Math.asin(Math.min(1, radius / d)) : Math.PI;
  return d < hz.range + radius && Math.abs(da) < hz.arc / 2 + angularPad;
}
function reflectHazard(hz) {
  if (player.absorbT <= 0 || hz.done) return false;
  const source = enemies.find(e => e.id === hz.sourceId && !e.dead);
  if (!source || !source.boss) return false;
  hz.done = true; hz.t = 0;
  hitStopT = Math.max(hitStopT, ABSORB_RULE.hitStop);
  hurtEnemy(source, hz.dmg * 1.5 * (player.metaAbsorbMul || 1), 0, player.x, player.y, 0, 0, 0, inkFriendlyColor);
  rewardAbsorb(ABSORB_RULE.meleeInk);
  chargeParry();
  floats.push({ x: player.x, y: player.y - 45, txt: '弹反！', t: 0.7, color: inkFriendlyColor, crit: true });
  castMeleeInkSurge();
  return true;
}
function updatePlayerInk(dt) {
  const own = playerOnOwnInk(), hostile = playerOnHostileInk();
  if (player.diving) {
    player.ink = Math.max(0, player.ink - diveInkCost() * dt);
    if (player.ink <= 0) { player.diving = false; toast('墨水耗尽，退出潜墨'); }
  } else {
    player.lastSeenX = player.x; player.lastSeenY = player.y;
    let regen = BATTLE.ink.regenBase;
    if (own) regen += BATTLE.ink.regenOwnBonus;
    if (hostile) regen = 0;
    player.ink = Math.min(player.maxInk, player.ink + regen * dt);
  }
  return { own, hostile };
}
function updateInkStains(dt) {
  const dotT = (updateInkStains.dotT || 0) - dt, poolT = (updateInkStains.poolT || 0) - dt;
  const dot = dotT <= 0, pool = poolT <= 0;
  updateInkStains.dotT = dot ? 0.55 : dotT;
  updateInkStains.poolT = pool ? 1.35 : poolT;
  if (!dot && !pool) return;
  for (const e of enemies) {
    if (e.dead || !inkPulseAt(e.x, e.y, e.r + (pool ? 24 : 0))) continue;
    // 技能墨迹只有“有 / 无”，不再按浓度分档；移动与弹道路径仍不伤人
    if (dot) hurtEnemy(e, 2, 0, e.x, e.y, 0, 0, 0, inkFriendlyColor, true);
    if (pool) {
      hurtEnemy(e, 3, 0, e.x, e.y, 0, 0, 0, inkFriendlyColor, true);
      sparks.push({ x: e.x, y: e.y, t: 0.18, color: inkFriendlyColor });
    }
  }
}
function hurtPlayer(dmg, kind, source) {
  // 潜墨、弹反慢放、选词金色保护与受击保护均免疫伤害；红闪只表示真实受击
  if (player.diving || hitStopT > 0 || player.goldT > 0 || player.hurtT > 0) return;
  const inkDr = player.taken.inkarmor && playerOnOwnInk() ? BATTLE.traits.inkArmorReduction : 0;
  dmg = Math.round(dmg * (1 - player.eqDr) * (1 - inkDr));
  player.diving = false;
  if (player.hp - dmg <= 0 && !player.metaNoRevive && hasItem('tape') && gameTime - player.lastRevive > 30) {
    player.lastRevive = gameTime;
    player.hp = 1; player.hurtT = BATTLE.player.hitInvuln; shakeT = 0.3;
    toast('修正带挡下了致命一击！');
    return;
  }
  player.hp -= dmg; player.hurtT = BATTLE.player.hitInvuln; player.hurtBoostT = 2; shakeT = 0.18;
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
    dmg, dot: 0, kind: kind || 'nib', hits: 1, chainLeft: 0, life: 1.4, split: false, extra: 0, proj: 1,
    size: BATTLE.skills.projectileSize, inkX: x, inkY: y
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
    const baseRad = BATTLE.skills.closeRadius * c.rad * (1 + c.sweep);
    const rings = a.lvl >= 5 ? [1, 1.32, 1.64] : (a.lvl >= 3 ? [1, 1.35] : [1]);
    for (let ri = 0; ri < rings.length; ri++) {
      const rad = baseRad * rings[ri];
      for (const e of enemies) {
        const d = Math.hypot(e.x - px, e.y - py);
        if (!e.dead && d < rad + e.r) areaHit(e, 11 * c.dmg * (ri ? 0.6 : 1), c, px, py, rad, d);
      }
    }
  } else if (a.id === 'volcanic') {
    const tgt = nearestEnemy(px, py, 520 * c.rad);   // 朝最近的怪物方向喷发
    const va = tgt ? Math.atan2(tgt.y - py, tgt.x - px) : player.faceA;
    const dirs = a.lvl >= 3 ? [va - 0.36, va, va + 0.36] : [va];
    const len = (a.lvl >= 5 ? 7 : 3) + c.count;
    for (let di = 0; di < dirs.length; di++) {
      const aa = dirs[di];
      for (let k = 0; k < len; k++) {
        erupts.push({
          x: px + Math.cos(aa) * (60 + k * 66), y: py + Math.sin(aa) * (60 + k * 66),
          delay: k * (a.lvl >= 5 ? 0.14 : 0.22) + di * 0.04,
          dmg: 26 * c.dmg * (di === 1 || dirs.length === 1 ? 1 : 0.72),
          r: 52 * c.rad * (1 + c.sweep), c, done: false, t: 0
        });
      }
      if (a.lvl >= 5) erupts.push({
        x: px + Math.cos(aa) * (60 + len * 66), y: py + Math.sin(aa) * (60 + len * 66),
        delay: len * 0.14 + 0.12, dmg: 38 * c.dmg, r: 92 * c.rad * (1 + c.sweep), c, done: false, t: 0
      });
    }
  } else if (a.id === 'tornado') {
    const t0 = nearestEnemy(px, py, 430);
    if (!t0) return;
    const base = Math.atan2(t0.y - py, t0.x - px), n = 1 + c.count + (a.lvl >= 5 ? 2 : 0);
    for (let i = 0; i < n; i++) {
      fireBullet(px, py - 10, base + (i - (n - 1) / 2) * 0.18, 380 * c.proj, 15 * c.dmg * (1 + c.bdmg) * (a.lvl >= 5 ? 1.2 : 1), 'torn',
        Object.assign(projOpts(c, 1.3), { hits: 1 + c.pierce, extra: c.chain + (a.lvl >= 5 ? 2 : 0),
          gen: a.lvl >= 5 ? 2 : (a.lvl >= 3 ? 1 : 0), big: a.lvl >= 5,
          rad: c.rad * (1 + c.brad) * (a.lvl >= 5 ? 1.35 : 1) }));
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
    const first = nearestEnemy(px, py, 330 * c.rad);
    if (!first) return;
    const shootArc = (start, startX, startY, jumps, baseDmg, delayBase) => {
      let cur = start, sx = startX, sy = startY, dmg = baseDmg;
      const hitSet = [];
      for (let j = 0; j <= jumps && cur; j++) {
        lightnings.push({ x1: sx, y1: sy, x2: cur.x, y2: cur.y, t: 0.25, delay: delayBase + j * 0.09, prog: 0, tgt: cur, dmg, c });
        if (a.lvl >= 5) fields.push({ kind: 'thunder', x: cur.x, y: cur.y, r: 52 * c.rad, t: 2.2, tick: 0.18 + j * 0.04, dmg: 7 * c.dmg, c });
        hitSet.push(cur); sx = cur.x; sy = cur.y; dmg *= 0.85;
        let nxt = null, bd = 150 * c.rad * (150 * c.rad);
        for (const e of enemies) {
          if (e.dead || hitSet.includes(e)) continue;
          const d2 = (e.x - sx) ** 2 + (e.y - sy) ** 2;
          if (d2 < bd) { bd = d2; nxt = e; }
        }
        cur = nxt;
      }
    };
    shootArc(first, px, py - 10, 3 + c.chain, 22 * c.dmg, 0.03);
    if (a.lvl >= 3) {
      const fork = nearestEnemy(first.x, first.y, 190 * c.rad, first);
      if (fork) shootArc(fork, first.x, first.y, 2 + c.chain, 15 * c.dmg, 0.18);
    }
    sparks.push({ x: px, y: py - 10, t: 0.18, color: c.col });  // 笔尖端口亮一下
  } else if (a.id === 'spark') {
    // 真环形发射 + 撞纸边反弹
    const n = 5 + 2 * c.count, off = Math.random() * Math.PI * 2;
    for (let i = 0; i < n; i++) {
      fireBullet(px, py, off + i / n * Math.PI * 2 + (Math.random() - 0.5) * 0.15, 130 * c.proj, 12 * c.dmg * (1 + c.bdmg), 'ink',
        Object.assign(projOpts(c, 2.6), { hits: 2 + c.pierce, bounce: 2 }));
    }
  } else if (a.id === 'ballista') {
    const cap = 2 + c.count;
    if (totems.length < cap) {
      totems.push({
        x: px + (Math.random() - 0.5) * 30, y: py + 18,
        t: 8 * c.areaT, fireCd: 0.4, dmg: 12 * c.dmg * (1 + c.bdmg), dot: c.dot,
        pierce: c.pierce, proj: c.proj, rad: c.rad, vuln: c.vuln, shots: 1 + c.count, ex: projOpts(c, 1.2)
      });
    }
  } else if (a.id === 'boomerang') {   // 回力橡皮擦：飞出后旋回来，往返都能刮人
    const t0 = nearestEnemy(px, py, 460);
    const base = t0 ? Math.atan2(t0.y - py, t0.x - px) : player.faceA, n = 1 + c.count;
    for (let i = 0; i < n; i++) {
      fireBullet(px, py, base + (i - (n - 1) / 2) * 0.35, 330 * c.proj, 18 * c.dmg * (1 + c.bdmg), 'boom',
        Object.assign(projOpts(c, 2.4), { hits: 999, traveled: 0 }));
    }
  } else if (a.id === 'vortex') {      // 涂改带刀阵：均匀整圈分布，施放一次补两枚
    const cap = BATTLE.skills.vortexCap + c.count;
    for (let i = 0; i < BATTLE.skills.vortexPerCast; i++) {
      const ang = blades.length ? blades[0].ang : cycAng;
      blades.push({ ang, t: BATTLE.skills.vortexDuration * c.areaT, dmg: 10 * c.dmg, c, rad: c.rad,
        x: px + Math.cos(ang) * BATTLE.skills.closeRadius * c.rad,
        y: py + Math.sin(ang) * BATTLE.skills.closeRadius * c.rad });
    }
    while (blades.length > cap) blades.shift();
  } else if (a.id === 'candle') {      // 蜡烛头：常驻灼烧光环（高频小伤害）
    const rad = BATTLE.skills.closeRadius * c.rad;
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
    const base = Math.atan2(best.y - py, best.x - px), n = 1 + c.count;
    for (let i = 0; i < n; i++) {
      fireBullet(px, py - 10, base + (i - (n - 1) / 2) * 0.14, 460 * c.proj, 30 * c.dmg * (1 + c.bdmg), 'ice',
        Object.assign(projOpts(c, 1.5), { hits: 3 + c.pierce, slow: 2 }));
    }
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
    const rad = BATTLE.skills.colaRadius * c.rad;
    novas.push({ x: px, y: py, t: 0.35, max: rad, col: c.col, c });
    if (a.lvl >= 3) fields.push({ kind: 'ice', x: px, y: py, r: rad * 0.9, t: 2.8, tick: 0.2, dmg: 4 * c.dmg, c });
    let shatters = 0;
    for (const e of enemies) {
      const d = Math.hypot(e.x - px, e.y - py);
      if (!e.dead && d < rad + e.r) {
        e.slowT = Math.max(e.slowT || 0, a.lvl >= 5 ? 2.5 : 1.5);
        if (a.lvl >= 5 && !e.boss) e.stunT = Math.max(e.stunT || 0, 0.75);
        areaHit(e, 20 * c.dmg, c, px, py, rad, d);
        if (a.lvl >= 5 && !e.dead && shatters++ < 18) erupts.push({
          x: e.x, y: e.y, delay: 0.55 + shatters * 0.025, dmg: 16 * c.dmg, r: 48 * c.rad,
          c: Object.assign({}, c, { reburst: 0 }), done: false, t: 0
        });
      }
    }
    if (c.reburst) {   // 二次晕染：新星后再爆发一次
      erupts.push({ x: px, y: py, delay: 0.5, dmg: 20 * c.dmg * (0.5 + c.reburst), r: rad,
        c: Object.assign({}, c, { reburst: 0 }), done: false, t: 0 });
    }
  }
}
const INK_COST = {
  cyclone: 1, volcanic: 4, tornado: 2, chainclip: 2, arc: 4, spark: 3, ballista: 5,
  boomerang: 3, vortex: 2, candle: 1, icespear: 2, inkrain: 5, ruler: 4, chalk: 4,
  pinburst: 3, absolve: 4, brand: 4, cola: 4
};
function addInkStain(x, y, amount, r, col, hostile, trail, prevTrail, sourceId, pathCharge = false) {
  const px = prevTrail && Number.isFinite(prevTrail.x) ? prevTrail.x : x;
  const py = prevTrail && Number.isFinite(prevTrail.y) ? prevTrail.y : y;
  return paintInkSegment(px, py, x, y, r * (trail ? 0.78 : 1), amount, col, !!hostile, !!trail, sourceId || 0, pathCharge);
}
function addHostileInk(x, y, amount, r, sourceId) {
  return addInkStain(x, y, amount, r, HOSTILE_INK, true, false, null, sourceId || 0);
}
// 攻击路径提供领地与潜墨空间，不直接返还墨水
function addAttackPath(x, y, col, hostile, prevTrail, sourceId) {
  return addInkStain(x, y, hostile ? 0.8 : 0.55, hostile ? 11 : 9,
    col || (hostile ? HOSTILE_INK : INK), hostile, true, prevTrail || null, sourceId || 0, true);
}
function addInkStroke(x1, y1, x2, y2, col, hostile, sourceId) {
  return paintInkSegment(x1, y1, x2, y2, (hostile ? 11 : 9) * 0.78,
    hostile ? 0.8 : 0.55, col || (hostile ? HOSTILE_INK : INK), !!hostile, true, sourceId || 0, true);
}
function addPlayerTrail(x, y, col, prevTrail) {
  return addInkStain(x, y, 1.2, 14, col, false, true, prevTrail || null, 0, true);
}
// 每帧直接铺设“上一帧→当前帧”的完整线段；只保留实体当前位置，不保存历史墨团
function addLinkedTrail(owner, x, y, col, hostile, r, amount, spacing, xKey, yKey, refKey) {
  let px = owner[xKey], py = owner[yKey];
  if (!Number.isFinite(px) || !Number.isFinite(py)) { px = x; py = y; }
  const covered = paintInkSegment(px, py, x, y, r * 0.78, amount, col, !!hostile, true,
    hostile ? (owner.sourceId || owner.id || 0) : 0, true);
  owner[xKey] = x; owner[yKey] = y;
  if (!owner[refKey]) owner[refKey] = { x, y };
  else { owner[refKey].x = x; owner[refKey].y = y; }
  return covered;
}
function playerOnOwnInk() {
  return inkCircleHas(player.x, player.y, player.r * 0.35, false);
}
function playerOnHostileInk() {
  return inkCircleHas(player.x, player.y, player.r * 0.35, true);
}
function updateEnemyTrails() {
  for (const e of enemies) {
    if (!e || e.dead || Math.hypot(e.x - player.x, e.y - player.y) > 600) continue;
    addLinkedTrail(e, e.x, e.y, HOSTILE_INK, true, e.boss ? 18 : 12, e.boss ? 3 : 1.5,
      e.boss ? 14 : 12, 'trailX', 'trailY', 'trailS');
  }
}
function spendSkillInk(a, cost) {
  if (player.ink < cost) return false;
  player.ink -= cost;
  return true;
}
function addSkillStain(a, c, amount) {
  const anchored = ['cyclone', 'vortex', 'candle', 'ballista', 'cola'].includes(a.id);
  const t = anchored ? null : nearestEnemy(player.x, player.y, 380);
  addInkStain(t ? t.x : player.x, t ? t.y : player.y, amount, 18 + amount * 2.2, c.col);
}
function updateSkills(dt) {
  cycAng += dt * 6;
  if (player.diving) return;
  for (const a of player.actives) {
    a.t -= dt;
    if (a.t > 0) continue;
    const cost = INK_COST[a.id] || 2;
    if (!spendSkillInk(a, cost)) {
      a.t = 0.2;
      if (player.noInkT <= 0) { toast('墨水不足，潜入己方墨迹补墨'); player.noInkT = 2.2; }
      continue;
    }
    const c = skillCalc(a);
    let baseCd = {
      cyclone: 0.45, volcanic: 2.2, tornado: 0.8, chainclip: 0.9, arc: 1.6, spark: 1.8, ballista: 5,
      boomerang: 2.2, vortex: 1.5, candle: 0.25, icespear: 1.1, inkrain: 2.8, ruler: 2.0, chalk: 2.4,
      pinburst: 1.3, absolve: 2.0, brand: 2.5, cola: 1.8,
      bloodcore: 1.2, weakmark: 6, doommark: 4,
      pageslash: 3.2, piercerush: 4.5, spinlance: 6, shieldrush: 5, ricoshield: 4.5,
      perfectarrow: 3.8, arrowfocus: 5, magfist: 4, inkgrenade: 4.8, heatrail: 6.5
    }[a.id];
    a.t = baseCd * c.cd;
    if (a.id === 'cyclone' && a.lvl >= 5) a.t *= 0.72;
    if (a.id === 'candle') a.t /= 1 + (c.retick || 0);   // 反复涂抹：灼烧更频繁
    a.uc = (a.uc || 0) + 1;
    const reps = (c.unleash > 0 && a.uc % 3 === 0) ? 1 + c.unleash : 1;
    for (let r = 0; r < reps; r++) { fireSkill(a, c); addSkillStain(a, c, cost / reps); }
  }
}

/* ---------- 选卡（起手 / 升级共用） ---------- */
function wrapCardDescription(text, maxWidth) {
  const lines = [];
  let line = '';
  for (const ch of String(text || '')) {
    if (ch === '\n') { lines.push(line); line = ''; continue; }
    if (line && ctx.measureText(line + ch).width > maxWidth) { lines.push(line); line = ch; }
    else line += ch;
  }
  if (line || !lines.length) lines.push(line);
  return lines;
}
function layoutCards(n) {
  const baseH = n === 4 ? 84 : 92, gap = n === 4 ? 12 : 16;
  ctx.save(); ctx.font = '12px ' + FONT;
  const heights = cards.map(c => {
    c.descLines = wrapCardDescription(c.desc, 248);
    return Math.max(baseH, 92 + (c.descLines.length - 1) * 15);
  });
  ctx.restore();
  const total = heights.reduce((sum, h) => sum + h, 0) + (n - 1) * gap;
  const bottomLimit = state === 'levelup' && hasItem('rerollnote') ? 600 : H - 28;
  const y0 = Math.max(74, Math.min(130 + (430 - total) / 2, bottomLimit - total));
  let y = y0;
  cardRects = cards.map((c, i) => {
    const h = heights[i], rect = { x: 47, y, w: 280, h };
    y += h + gap;
    return rect;
  });
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
      kind: 'active+', skill: a.id, tag: (a.lvl + 1 === 3 || a.lvl + 1 === 5) && SKILL_EVOLUTIONS[a.id] ? '[形态进化]' : '[强化]', tagColor: INK,
      name: SKILL_DEFS[a.id].name + ' Lv' + (a.lvl + 1), desc: activeUpgradeDesc(a.id, a.lvl + 1)
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
  for (const p of PASSIVES) {
    if (p.once && player.taken[p.id]) continue;
    if (p.available && !p.available()) continue;
    pool.push({ kind: 'passive', id: p.id, tag: '[被动]', tagColor: DARK, name: p.name, desc: p.desc });
  }
  const opNames = { dive: '潜墨', surge: '墨潮', absorb: '吸墨' };
  const opColors = { dive: INK, surge: ARC, absorb: PURPLE };
  for (const a of OPERATION_AFFIX_LIST) {
    if (hasAffix(a.skill, a.id)) continue;
    pool.push({ kind: 'opaffix', id: a.id, skill: a.skill, tag: '[' + opNames[a.skill] + '辅助]', tagColor: opColors[a.skill], name: a.name, desc: a.desc });
  }
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  const nPick = hasItem('crown') ? 4 : 3;
  const picks = pool.slice(0, nPick);
  if (!picks.some(c => c.kind === 'passive')) {
    const idx = pool.findIndex(c => c.kind === 'passive');
    if (idx >= 0) picks[picks.length - 1] = pool[idx];
  }
  cards = picks;
  layoutCards(cards.length);
}
function rerollOptions() {
  if (state !== 'levelup' || player.itemRerolls <= 0) return false;
  player.itemRerolls--; buildOptions(); return true;
}
function applyOption(i) {
  const c = cards[i]; if (!c) return;
  const starting = c.kind === 'start';
  if (c.kind === 'active' || c.kind === 'start') player.actives.push({ id: c.id, lvl: 1, supports: [], t: 0.3, uc: 0 });
  else if (c.kind === 'active+') { const a = getActive(c.skill); if (a && a.lvl < MAX_LVL) a.lvl++; }
  else if (c.kind === 'support') { const a = getActive(c.skill); if (a) a.supports.push({ id: c.sup, lvl: 1 }); }
  else if (c.kind === 'support+') {
    const a = getActive(c.skill);
    const sp = a && a.supports.find(s => s.id === c.sup);
    if (sp && sp.lvl < MAX_LVL) sp.lvl++;
  }
  else if (c.kind === 'passive') PASSIVES.find(p => p.id === c.id).fx();
  else if (c.kind === 'opaffix') player.affixes[c.skill][c.id] = true;
  cards = []; state = 'play';
  if (!starting) player.goldT = Math.max(player.goldT, 1);
  if (starting) toast('潜墨可无敌位移但持续耗墨；涂新区域攒满墨潮');
}

/* ---------- 纸面手势：不接管自动战斗，只让玩家亲手改写战局 ---------- */
function screenToWorld(p) { return { x: camX + p.x / ZOOM, y: camY + p.y / ZOOM }; }
function pointSegDist(p, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy;
  const t = l2 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2)) : 0;
  return Math.hypot(p.x - a.x - dx * t, p.y - a.y - dy * t);
}
function strokeLen(ps) { let n = 0; for (let i = 1; i < ps.length; i++) n += Math.hypot(ps[i].x - ps[i - 1].x, ps[i].y - ps[i - 1].y); return n; }
function simplifyStroke(ps, tol) {
  if (ps.length <= 2) return ps.slice();
  let maxD = 0, idx = 0;
  for (let i = 1; i < ps.length - 1; i++) {
    const d = pointSegDist(ps[i], ps[0], ps[ps.length - 1]);
    if (d > maxD) { maxD = d; idx = i; }
  }
  if (maxD <= tol) return [ps[0], ps[ps.length - 1]];
  const left = simplifyStroke(ps.slice(0, idx + 1), tol), right = simplifyStroke(ps.slice(idx), tol);
  return left.slice(0, -1).concat(right);
}
function recognizeStroke(ps) {
  if (!ps || ps.length < 2) return { kind: 'none' };
  const len = strokeLen(ps); if (len < 20) return { kind: 'none' };
  const sp = simplifyStroke(ps, 7), first = ps[0], last = ps[ps.length - 1];
  let cx = 0, cy = 0;
  for (const p of ps) { cx += p.x; cy += p.y; }
  cx /= ps.length; cy /= ps.length;
  const close = Math.hypot(last.x - first.x, last.y - first.y);
  if (ps.length >= 8 && len > 70 && close < Math.max(30, len * 0.18)) {
    let turn = 0, mean = 0;
    const rs = [];
    for (const p of ps) { const r = Math.hypot(p.x - cx, p.y - cy); rs.push(r); mean += r; }
    mean /= rs.length;
    let variance = 0;
    for (const r of rs) variance += (r - mean) ** 2;
    for (let i = 2; i < ps.length; i++) {
      const a1 = Math.atan2(ps[i - 1].y - ps[i - 2].y, ps[i - 1].x - ps[i - 2].x);
      const a2 = Math.atan2(ps[i].y - ps[i - 1].y, ps[i].x - ps[i - 1].x);
      let da = a2 - a1;
      while (da > Math.PI) da -= Math.PI * 2;
      while (da < -Math.PI) da += Math.PI * 2;
      turn += da;
    }
    if (mean > 16 && Math.abs(turn) > 4.2 && Math.sqrt(variance / rs.length) / mean < 0.38)
      return { kind: 'circle', x: cx, y: cy, r: mean };
  }
  if (sp.length === 3) {
    const a = sp[0], b = sp[1], c = sp[2];
    const ab = Math.hypot(a.x - b.x, a.y - b.y), bc = Math.hypot(b.x - c.x, b.y - c.y);
    const chord = Math.hypot(c.x - a.x, c.y - a.y), height = pointSegDist(b, a, c);
    const u = Math.atan2(a.y - b.y, a.x - b.x), v = Math.atan2(c.y - b.y, c.x - b.x);
    let da = Math.abs(u - v); if (da > Math.PI) da = Math.PI * 2 - da;
    if (ab > 22 && bc > 22 && chord > 30 && height > 20 && da > 0.35 && da < 2.35 && len < (ab + bc) * 1.35)
      return { kind: 'v', a, b, c };
  }
  if (sp.length >= 4 && sp.length <= 8 && len > 55) {
    let turns = 0, prevSign = 0;
    for (let i = 2; i < sp.length; i++) {
      const a1 = Math.atan2(sp[i - 1].y - sp[i - 2].y, sp[i - 1].x - sp[i - 2].x);
      const a2 = Math.atan2(sp[i].y - sp[i - 1].y, sp[i].x - sp[i - 1].x);
      let da = a2 - a1;
      while (da > Math.PI) da -= Math.PI * 2;
      while (da < -Math.PI) da += Math.PI * 2;
      const sign = Math.abs(da) > 0.55 ? Math.sign(da) : 0;
      if (sign && prevSign && sign !== prevSign) turns++;
      if (sign) prevSign = sign;
    }
    if (turns >= 1) return { kind: 'zig', points: sp };   // Z 形三段折线即可触发，更多折返同样有效
  }
  if (sp.length === 2 && len >= 20) return { kind: 'line', a: sp[0], b: sp[1] };
  return { kind: 'none' };
}
function segmentCross(a, b, c, d) {
  const den = (a.x - b.x) * (c.y - d.y) - (a.y - b.y) * (c.x - d.x);
  if (Math.abs(den) < 0.001) return null;
  const t = ((a.x - c.x) * (c.y - d.y) - (a.y - c.y) * (c.x - d.x)) / den;
  const u = -((a.x - b.x) * (a.y - c.y) - (a.y - b.y) * (a.x - c.x)) / den;
  if (t < 0.08 || t > 0.92 || u < 0.08 || u > 0.92) return null;
  const ang = Math.abs(Math.sin(Math.atan2(b.y - a.y, b.x - a.x) - Math.atan2(d.y - c.y, d.x - c.x)));
  if (ang < 0.55) return null;
  return { x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) };
}
function gestureMessage(txt) { if (gestureNoticeT <= 0) { toast(txt); gestureNoticeT = 1.25; } }
function spendInk(kind, cost, cd) {
  if (gestureCooldowns[kind] > 0) return false;
  if (player.ink < cost) { gestureMessage('墨水不够，潜入己方墨迹补墨'); return false; }
  player.ink -= cost; gestureCooldowns[kind] = cd; return true;
}
function gestureCalc(id) {
  const a = getActive(id) || { id, lvl: 1, supports: [] };
  return { a, c: skillCalc(a) };
}
function castCross(g1, g2, hitScreen) {
  const a = screenToWorld(g1.a), b = screenToWorld(g1.b), c = screenToWorld(g2.a), d = screenToWorld(g2.b);
  const center = screenToWorld(hitScreen);
  const shot = ebullets.filter(eb => eb.life > 0 && Math.min(pointSegDist(eb, a, b), pointSegDist(eb, c, d)) < 26);
  const targets = enemies.filter(e => !e.dead && !e.boss &&
    Math.min(pointSegDist(e, a, b), pointSegDist(e, c, d)) < e.r + 17 &&
    e.hp / e.maxhp <= (e.elite ? 0.25 : 0.55))
    .sort((e1, e2) => Math.hypot(e1.x - center.x, e1.y - center.y) - Math.hypot(e2.x - center.x, e2.y - center.y)).slice(0, 5);
  if (!shot.length && !targets.length) { gestureMessage('画叉可擦弹，或擦除残血小怪'); return; }
  const elite = targets.some(e => e.elite), cost = elite ? 60 : (targets.length ? 40 : 25);
  if (!spendInk('cross', cost, 2.2)) return;
  for (const eb of shot) { eb.life = 0; sparks.push({ x: eb.x, y: eb.y, t: 0.18, color: INK }); }
  for (const e of targets) {
    if (!e.elite) {
      redrawOutlines.push({ x: e.x, y: e.y, r: e.r, type: e.type, t: 8, seed: e.id, dead: false });
      if (redrawOutlines.length > 12) redrawOutlines.shift();
    }
    killEnemy(e); sparks.push({ x: e.x, y: e.y, t: 0.18, color: INK });
  }
  shakeT = Math.max(shakeT, 0.16);
  toast(targets.length ? '画叉擦除！在淡影上画圈可重画' : '敌方弹幕被擦掉了！');
}
function castCircle(g) {
  const center = screenToWorld(g), wr = g.r / ZOOM;
  const ghost = redrawOutlines.filter(o => !o.dead && Math.hypot(o.x - center.x, o.y - center.y) < wr + o.r)
    .sort((a, b) => Math.hypot(a.x - center.x, a.y - center.y) - Math.hypot(b.x - center.x, b.y - center.y))[0];
  if (ghost) {
    if (minions.filter(m => m.redrawn).length >= 3) { gestureMessage('重画友军最多同时存在 3 个'); return; }
    if (!spendInk('redraw', 45, 2.5)) return;
    ghost.dead = true;
    const c = { col: INK, rapid: 0, sweep: 0 };
    minions.push({ x: ghost.x, y: ghost.y, t: 20, atkCd: 0, dmg: 24 * player.dmgMul * (1 + player.eqAtk / 100),
      dot: 0, walk: 0, rad: 1.3, vuln: 0, c, redrawn: true });
    sparks.push({ x: ghost.x, y: ghost.y, t: 0.18, color: INK });
    floats.push({ x: ghost.x, y: ghost.y - 24, txt: '重画！', t: 0.9, color: INK });
    toast('敌人被重画成了友军！');
    return;
  }
  if (!spendInk('circle', 55, 4)) return;
  const gc = gestureCalc(getActive('candle') ? 'candle' : (getActive('cola') ? 'cola' : 'candle')), c = gc.c;
  const radius = Math.max(50, Math.min(115, wr)) * c.rad;
  fields.push({ kind: 'scribble', x: center.x, y: center.y, r: radius, t: 4.5 * (1 + c.lingerT), tick: 0, dmg: 18 * c.dmg, c });
  novas.push({ x: center.x, y: center.y, t: 0.35, max: radius, col: c.col });
}
function castV(g) {
  if (!spendInk('v', 45, 3)) return;
  const origin = screenToWorld(g.b), end1 = screenToWorld(g.a), end2 = screenToWorld(g.c);
  const base = Math.atan2(origin.y - (end1.y + end2.y) / 2, origin.x - (end1.x + end2.x) / 2);
  const gc = gestureCalc('tornado'), a = gc.a, c = gc.c, n = 2 + c.count + (a.lvl >= 5 ? 2 : 0);
  for (let i = 0; i < n; i++) {
    fireBullet(origin.x, origin.y, base + (i - (n - 1) / 2) * 0.18, 420 * c.proj,
      34 * c.dmg * (1 + c.bdmg) * (a.lvl >= 5 ? 1.2 : 1), 'torn',
      Object.assign(projOpts(c, 1.5), { hits: 1 + c.pierce, extra: 1 + c.chain + (a.lvl >= 5 ? 2 : 0),
        gen: a.lvl >= 5 ? 3 : (a.lvl >= 3 ? 2 : 1), big: true }));
  }
}
function castZig(g) {
  const ps = g.points.map(screenToWorld), last = ps[ps.length - 1];
  const first = nearestEnemy(last.x, last.y, 260);
  if (!first) { gestureMessage('折线末端要靠近怪物，才能接上电弧'); return; }
  if (!spendInk('zig', 50, 3.5)) return;
  const gc = gestureCalc('arc'), a = gc.a, c = gc.c;
  let cur = first, sx = ps[0].x, sy = ps[0].y, dmg = 44 * c.dmg;
  const hitSet = [];
  for (let j = 0; j <= 5 + c.chain + (a.lvl >= 3 ? 1 : 0) && cur; j++) {
    lightnings.push({ x1: sx, y1: sy, x2: cur.x, y2: cur.y, t: 0.32, delay: j * 0.08, prog: 0, tgt: cur, dmg, c });
    if (a.lvl >= 5) fields.push({ kind: 'thunder', x: cur.x, y: cur.y, r: 52 * c.rad, t: 2.2, tick: 0.18 + j * 0.04, dmg: 7 * c.dmg, c });
    hitSet.push(cur); sx = cur.x; sy = cur.y; dmg *= 0.85;
    let nxt = null, bd = (180 * c.rad) ** 2;
    for (const e of enemies) {
      if (e.dead || hitSet.includes(e)) continue;
      const d2 = (e.x - sx) ** 2 + (e.y - sy) ** 2;
      if (d2 < bd) { bd = d2; nxt = e; }
    }
    cur = nxt;
  }
}
function finishGesture(ps) {
  if (state !== 'play' || !ps || ps.length < 2) return;
  const g = recognizeStroke(ps);
  if (g.kind === 'line') {
    if (pendingGesture && gameTime - pendingGesture.t <= 0.48) {
      const previous = pendingGesture.g;
      const hit = segmentCross(previous.a, previous.b, g.a, g.b);
      if (hit) { pendingGesture = null; castCross(previous, g, hit); setDrawMode(false); return; }
    }
    pendingGesture = { g, t: gameTime }; drawModeT = 0.75; return;   // 给第二笔叉留一个短窗口
  }
  pendingGesture = null;
  if (g.kind === 'circle') castCircle(g);
  else if (g.kind === 'v') castV(g);
  else if (g.kind === 'zig') castZig(g);
  setDrawMode(false);   // 每次只画一个手势，随后立即回到单手移动
}

/* ---------- 输入 ---------- */
window.addEventListener('keydown', e => {
  keys[e.key.toLowerCase()] = true;
  if ((state === 'levelup' || state === 'start') && ['1', '2', '3', '4'].includes(e.key)) applyOption(+e.key - 1);
  if ((state === 'over' || state === 'win') && (e.key === ' ' || e.key === 'Enter')) resetGame();
  if (!e.repeat && state === 'play' && e.key === ' ') { e.preventDefault(); toggleDive(); }
  if (!e.repeat && state === 'play' && e.key.toLowerCase() === 'q') { e.preventDefault(); startInkSurgeCharge(); }
  if (!e.repeat && state === 'play' && e.key.toLowerCase() === 'e') castAbsorb();
});
window.addEventListener('keyup', e => {
  const key = e.key.toLowerCase(); keys[key] = false;
  if (key === 'q') releaseInkSurgeCharge();
});
window.addEventListener('blur', () => {
  if (player.surgeCharging) cancelInkSurgeCharge(player.surgePointerId);
});

function toLogical(e) {
  const r = canvas.getBoundingClientRect();
  return { x: (e.clientX - r.left) / (r.width / W), y: (e.clientY - r.top) / (r.height / H) };
}
function pointInRect(p, r) { return p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h; }
// 手机浏览器：阻止长按全选/系统菜单及双指缩放，但不拦截 Pointer Events 的多指输入
for (const type of ['contextmenu', 'selectstart', 'dragstart', 'gesturestart', 'gesturechange', 'gestureend']) {
  canvas.addEventListener(type, e => e.preventDefault());
}
canvas.addEventListener('touchmove', e => e.preventDefault(), { passive: false });
canvas.addEventListener('pointerdown', e => {
  e.preventDefault();
  const p = toLogical(e);
  if (state === 'levelup' || state === 'start') {
    for (let i = 0; i < cardRects.length; i++) {
      const r = cardRects[i];
      if (pointInRect(p, r)) { applyOption(i); return; }
    }
    return;
  }
  if (state === 'over' || state === 'win') { resetGame(); return; }
  if (state !== 'play') return;
  // 技能按钮优先且使用独立触点：摇杆保持移动时，另一根手指仍可释放技能
  if (pointInRect(p, absorbRect)) { castAbsorb(); return; }
  if (pointInRect(p, specialRect)) {
    if (startInkSurgeCharge(e.pointerId) && canvas.setPointerCapture) canvas.setPointerCapture(e.pointerId);
    return;
  }
  if (pointInRect(p, diveRect)) { toggleDive(); return; }
  if (joy.active) return;
  if (Math.hypot(p.x - JOY_HOME.x, p.y - JOY_HOME.y) <= JOY_HOME.r + 26) {
    // 只有左下固定摇杆区域接管移动，右侧空白区域不会抢技能手指
    joy.active = true; joy.id = e.pointerId; joy.bx = JOY_HOME.x; joy.by = JOY_HOME.y; joy.dx = 0; joy.dy = 0;
  }
});
canvas.addEventListener('pointermove', e => {
  if (!joy.active || e.pointerId !== joy.id) return;
  const p = toLogical(e);
  let dx = p.x - joy.bx, dy = p.y - joy.by;
  const len = Math.hypot(dx, dy), max = JOY_HOME.r;
  if (len > max) { dx = dx / len * max; dy = dy / len * max; }
  joy.dx = dx / max; joy.dy = dy / max;
});
function endPointer(e) {
  if (e.type === 'pointercancel') cancelInkSurgeCharge(e.pointerId);
  else releaseInkSurgeCharge(e.pointerId);
  if (joy.active && e.pointerId === joy.id) { joy.active = false; joy.dx = 0; joy.dy = 0; }
}
canvas.addEventListener('pointerup', endPointer);
canvas.addEventListener('pointercancel', endPointer);

/* ---------- 主更新 ---------- */
function update(dt) {
  gameTime += dt;
  regenInkResourceBudgets(dt);
  crumpleT = Math.max(0, crumpleT - dt);
  player.noInkT = Math.max(0, player.noInkT - dt);
  const st = curSt();
  if (st !== curStage) {   // 翻页：换关卡底纹
    curStage = st; crumpleT = Math.max(crumpleT, 0.45);
    toast('翻到第 ' + st + ' 页 · ' + STAGE_NAMES[st - 1]);
  }
  if (player.level % 10 === 0 && bossStageSpawned < st) { bossStageSpawned = st; spawnBoss(st); }

  player.condDmg = 1;
  if (hasItem('cloak') && player.hp < player.maxhp * 0.3) player.condDmg *= 1.4;
  if (hasItem('cap4')) player.condDmg *= 1 + 0.08 * player.actives.length;
  player.absorbT = Math.max(0, player.absorbT - dt);
  player.absorbCd = Math.max(0, player.absorbCd - dt);
  updateInkSurgeCharge(dt);
  const ground = updatePlayerInk(dt);
  if (state === 'over') return;

  let mx = 0, my = 0;
  if (keys['w'] || keys['arrowup']) my -= 1;
  if (keys['s'] || keys['arrowdown']) my += 1;
  if (keys['a'] || keys['arrowleft']) mx -= 1;
  if (keys['d'] || keys['arrowright']) mx += 1;
  if (joy.active) { mx = joy.dx; my = joy.dy; }
  const ml = Math.hypot(mx, my);
  // 摇杆只决定方向；只要拖动就保持最大移动速度
  if (ml > 0) { mx /= ml; my /= ml; }
  player.hurtBoostT = Math.max(0, player.hurtBoostT - dt);
  player.leechT += dt;
  if (player.leechT >= 1) { player.leechT %= 1; player.leechN = 0; }
  const routeBoost = player.diving ? BATTLE.dive.speed : (ground.own ? BATTLE.ink.ownSpeed : 1);
  const hostileSlow = ground.hostile ? BATTLE.ink.hostileSpeed : 1;
  const spdNow = player.speed * player.eqSpd * routeBoost * hostileSlow * (hasItem('shoes') && player.hurtBoostT > 0 ? 1.3 : 1);
  player.x += mx * spdNow * dt;
  player.y += my * spdNow * dt;
  player.x = clampW(player.x, 14); player.y = clampH(player.y, 14);
  if (typeof CreatureGameRuntime !== 'undefined') CreatureGameRuntime.updatePlayer(player, dt);
  if (ml > 0.1) {
    player.walk += dt * 10; player.faceA = Math.atan2(my, mx);
    if ((!player.diving || player.taken.divepaint) && player.actives.length) {
      addLinkedTrail(player, player.x, player.y, trailColorOf(player.actives[0].id), false,
        14, 1.2, 12, 'trailX', 'trailY', 'trailS');
    }
  }
  player.hurtT = Math.max(0, player.hurtT - dt);
  player.goldT = Math.max(0, player.goldT - dt);
  shakeT = Math.max(0, shakeT - dt);

  const bossAlive = enemies.some(e => e.boss && !e.dead);
  if (!bossAlive) {   // Boss 在场：停刷小怪、冻结波数，Boss 死后才翻页继续
    const interval = Math.max(0.18, 1.1 - gameTime * 0.0015);
    const density = gameTime < 30 ? 2 : (gameTime < 90 ? 3 : 4);
    spawnAcc += dt * density;
    while (spawnAcc > interval) { spawnAcc -= interval; spawnEnemy(); }
    if (gameTime >= nextHordeT) {
      spawnHorde();
      nextHordeT = gameTime + (gameTime < 90 ? 15 : 20);
    }
    if (levelupDelayT < 0 && player.xp >= player.xpNext) levelupDelayT = BATTLE.feedback.levelupDelay;
  }
  // 经验满后先留出 0.5 秒看清战斗结果，再升级并弹出三选一
  if (levelupDelayT >= 0) {
    levelupDelayT -= dt;
    if (levelupDelayT <= 0) {
      levelupDelayT = -1;
      player.xp -= player.xpNext; player.level++;
      player.xpNext = xpForNextLevel(player.level);
      buildOptions(); state = 'levelup';
      return;
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
    e.parryKbT = Math.max(0, (e.parryKbT || 0) - dt);
    e.comboT = Math.max(0, (e.comboT || 0) - dt);
    if (e.comboT <= 0) e.comboN = 0;
    if (e.stainT > 0) {   // 墨渍残留：离开范围后仍受余伤
      e.stainT -= dt; e.hp -= e.stainDps * dt;
      if (e.hp <= 0) { killEnemy(e); continue; }
    }
    if (e.type === 'sprayer') {
      e.inkCd -= dt;
      if (e.inkCd <= 0) { e.inkCd = 2.8; addHostileInk(e.x, e.y, 8, 27, e.id); }
    }
    const inkFactor = enemyInkFactor(e);
    const sf = (e.slowT > 0 ? 0.5 : 1) * inkFactor;   // 彩墨阻碍怪物，灰墨帮助怪物
    if (e.dotT > 0) {
      e.dotT -= dt; e.hp -= e.dotDps * dt;
      if (e.hp <= 0) { killEnemy(e); continue; }
    }
    if (e.stunT <= 0) {   // 震荡僵直：停止移动和 AI，但保留击退位移
      if (e.shade) updateInkShade(e, dt * sf);
      else if (e.boss) updateBoss(e, dt * (e.slowT > 0 ? 0.55 : 1) * inkFactor);
      else if (isShooter(e)) updateShooter(e, dt * sf);
      else if (isInkEater(e) && updateInkEater(e, dt * inkFactor)) { /* 吸墨怪优先抢墨 */ }
      else if (e.type === 'plane') { e.x += e.vx * e.sp * sf * dt; e.y += e.vy * e.sp * sf * dt; }
      else {
        const hidden = player.diving && Math.hypot(player.x - e.x, player.y - e.y) > 85;
        const tx = hidden ? player.lastSeenX : player.x, ty = hidden ? player.lastSeenY : player.y;
        const a = Math.atan2(ty - e.y, tx - e.x);
        e.x += Math.cos(a) * e.sp * sf * dt; e.y += Math.sin(a) * e.sp * sf * dt;
        e.walk += dt * (e.type === 'spider' ? 14 : 8);
      }
    }
    e.x += e.kbx * dt; e.y += e.kby * dt;
    e.x = clampW(e.x, e.r); e.y = clampH(e.y, e.r);
    e.kbx *= kbDecay; e.kby *= kbDecay;
    // 在实际 AI、减速、击退和边界约束全部结算后驱动多足动作
    const d = Math.hypot(player.x - e.x, player.y - e.y);
    const onscreen = e.x >= camX - 70 && e.x <= camX + VIEW_W + 70 && e.y >= camY - 70 && e.y <= camY + VIEW_H + 70;
    if (e.type === 'spider') ProceduralLocomotion.updateSpiderLocomotionLOD(e, dt, d, onscreen);
    else if (typeof CreatureGameRuntime !== 'undefined') CreatureGameRuntime.updateEnemy(e, dt, d, onscreen);
    if (e.stunT <= 0 && !e.boss && !e.shade && !isShooter(e)) {
      updateMeleeSwing(e, dt);
      if (state === 'over') return;
    } else if (e.stunT <= 0 && !e.huntBoss && (e.boss || e.shade) && d < e.r + 10 && e.hitCd <= 0) {
      if (player.absorbT > 0 && reflectMeleeSwing(e)) continue;
      e.hitCd = 0.9;
      addHostileInk(e.x, e.y, 3, 18, e.id);
      hurtPlayer(e.dmg, 'enemy', e);
      if (state === 'over') return;
    }
  }
  updateEnemyTrails(dt);
  updateInkStains(dt);

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
    if (b.col) {
      addLinkedTrail(b, b.x, b.y, b.col, false, 9, 0.55, 16, 'inkX', 'inkY', 'inkS');
    }
    if (b.life <= 0) continue;
    if (b.arm > 0) { b.arm -= dt; continue; }   // 分裂后先飞离原目标，避免同帧连续引爆
    for (const e of enemies) {
      if (e.dead) continue;
      if (b.kind === 'boom' && e.boomCd > 0) continue;   // 往返多次命中：0.4s 免疫
      if (Math.hypot(e.x - b.x, e.y - b.y) < e.r + 6 * (b.rad || 1) * (b.size || 1)) {
        if (b.kind === 'torn' && !b.split) {
          b.split = true; b.life = 0;
          hurtEnemy(e, b.dmg, b.dmg * b.dot, b.x, b.y, b.vuln, b.critAdd, 0, b.col, false, b.hadesSkill);
          const nextGen = b.gen || 0, n = (nextGen > 0 ? 3 : 4) + b.extra;
          for (let i = 0; i < n; i++) {
            const ang = (i / n) * Math.PI * 2 + Math.random() * 0.4;
            fireBullet(b.x, b.y, ang, 300 * b.proj, b.dmg * 0.6, nextGen > 0 ? 'torn' : 'nib',
              { hits: 1, dot: b.dot, rad: b.rad, vuln: b.vuln, life: 0.8, critAdd: b.critAdd, col: b.col,
                gen: nextGen - 1, extra: Math.max(0, (b.extra || 0) - 1), arm: nextGen > 0 ? 0.12 : 0 });
          }
          break;
        }
        if (b.kind === 'chain' && b.chainLeft > 0) {
          hurtEnemy(e, b.dmg, b.dmg * b.dot, b.x, b.y, b.vuln, b.critAdd, 0, b.col, false, b.hadesSkill);
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
          hurtEnemy(e, b.dmg, b.dmg * b.dot, b.x, b.y, b.vuln, b.critAdd, 0, b.col, false, b.hadesSkill);
          if (b.chainN > 0) b.chainN--;
          continue;
        }
        hurtEnemy(e, b.dmg, b.dmg * b.dot, b.x, b.y, b.vuln, b.critAdd, 0, b.col, false, b.hadesSkill);
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
        addAttackPath(er.x, er.y, er.c && er.c.col, false);
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
        if (player.absorbT > 0 && hazardTouchesCircle(hz, player.x, player.y, player.absorbRadius) && reflectHazard(hz)) continue;
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
        if (hit) { hurtPlayer(hz.dmg, 'hazard', enemies.find(e => e.id === hz.sourceId)); if (state === 'over') return; }
      }
    } else hz.t -= dt;
  }
  hazards = hazards.filter(h => !h.done || h.t > 0);

  // 敌方墨弹（blob 系 Boss）
  for (const eb of ebullets) {
    if (eb.inkX === undefined) { eb.inkX = eb.x; eb.inkY = eb.y; }
    eb.x += eb.vx * dt; eb.y += eb.vy * dt; eb.life -= dt;
    const trailCol = eb.inkConverted ? (player.actives.length ? trailColorOf(player.actives[0].id) : INK) : HOSTILE_INK;
    addLinkedTrail(eb, eb.x, eb.y, trailCol, !eb.inkConverted, 11, 0.8, 16, 'inkX', 'inkY', 'inkS');
    if (eb.life <= 0 && eb.sourceId && !eb.inkConverted) inkCutChecks.add(eb.sourceId);
    const playerDist = Math.hypot(player.x - eb.x, player.y - eb.y);
    if (eb.life > 0 && player.absorbT > 0 && playerDist < player.absorbRadius && reflectEnemyBullet(eb)) continue;
    if (eb.life > 0 && playerDist < 16) {
      eb.life = 0;
      hurtPlayer(eb.dmg, 'bullet', enemies.find(e => e.id === eb.sourceId));
      if (state === 'over') return;
    }
  }
  ebullets = ebullets.filter(b => b.life > 0);

  for (const m of minions) {
    m.t -= dt; m.atkCd = Math.max(0, m.atkCd - dt); m.walk += dt * (m.king ? 15 : 10);
    const t0 = nearestEnemy(m.x, m.y, 9999);
    if (t0) {
      const a = Math.atan2(t0.y - m.y, t0.x - m.x), dist = Math.hypot(t0.x - m.x, t0.y - m.y);
      if (m.ranged && dist < 285) {
        if (m.atkCd <= 0) {
          m.atkCd = 0.9 / (1 + (m.c.rapid || 0));
          fireBullet(m.x, m.y - 8, a, 340, m.dmg, 'nib', { hits: 1, dot: m.dot, rad: m.rad, vuln: m.vuln, col: m.c.col });
        }
      } else {
        if (!m.ranged || dist > 175) {
          const sp = m.king ? 310 : 230;
          m.x += Math.cos(a) * sp * dt; m.y += Math.sin(a) * sp * dt;
        }
        if (dist < t0.r + 16 * (m.rad || 1) * (1 + (m.c.sweep || 0)) && m.atkCd <= 0) {
          m.atkCd = (m.king ? 0.42 : 0.6) / (1 + (m.c.rapid || 0));
          areaHit(t0, m.dmg, m.c, m.x, m.y);
        }
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
        const base = Math.atan2(t0.y - tt.y, t0.x - tt.x), n = tt.shots || 1;
        for (let i = 0; i < n; i++) {
          fireBullet(tt.x, tt.y - 14, base + (i - (n - 1) / 2) * 0.13,
            BATTLE.skills.ballistaBulletSpeed * tt.proj, tt.dmg, 'nib', Object.assign({ hits: 1 + tt.pierce }, tt.ex));
        }
      } else tt.fireCd = 0.2;
    }
  }
  totems = totems.filter(tt => tt.t > 0);

  // 涂改带刀阵：均匀整圈；上一位置到当前位置的整段轨迹都能命中，避免高速漏怪
  for (let i = 0; i < blades.length; i++) {
    const bl = blades[i], oldX = bl.x, oldY = bl.y;
    bl.t -= dt; bl.ang += dt * 3.2;
    const orbit = bl.ang + i / Math.max(1, blades.length) * Math.PI * 2;
    const radius = BATTLE.skills.closeRadius * bl.rad * (1 + (bl.c.sweep || 0));
    bl.x = player.x + Math.cos(orbit) * radius;
    bl.y = player.y + Math.sin(orbit) * radius;
    if (!bl.orbitReady) {
      bl.orbitReady = true; bl.trailX = bl.x; bl.trailY = bl.y; bl.trailS = null;
      addLinkedTrail(bl, bl.x, bl.y, bl.c.col, false, 9, 0.55, 10, 'trailX', 'trailY', 'trailS');
      continue;   // 新生成的一帧只落下当前笔触，不从角色中心拉出错误扫线
    }
    addLinkedTrail(bl, bl.x, bl.y, bl.c.col, false, 9, 0.55, 10, 'trailX', 'trailY', 'trailS');
    for (const e of enemies) {
      if (e.dead || e.vorCd > 0) continue;
      if (pointSegDist(e, { x: oldX, y: oldY }, bl) < e.r + 10 * (1 + (bl.c.sweep || 0))) {
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

  // 觉醒区域：电弧雷网 / 可乐冰面
  for (const f of fields) {
    f.t -= dt; f.tick -= dt;
    if (f.tick <= 0) {
      f.tick = f.kind === 'ice' ? 0.4 : 0.32;
      for (const e of enemies) {
        const d = Math.hypot(e.x - f.x, e.y - f.y);
        if (!e.dead && d < f.r + e.r) {
          if (f.kind === 'ice') e.slowT = Math.max(e.slowT || 0, 0.7);
          areaHit(e, f.dmg, f.c, f.x, f.y, f.r, d);
        }
      }
    }
  }
  fields = fields.filter(f => f.t > 0);
  if (fields.length > 60) fields.splice(0, fields.length - 60);

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
      if (l.prog >= 1) {
        if (!l.inked) { l.inked = true; addInkStroke(l.x1, l.y1, l.x2, l.y2, l.col || (l.c && l.c.col), false); }
        if (l.tgt && !l.tgt.dead) {
          if (l.c) areaHit(l.tgt, l.dmg, l.c, l.x1, l.y1);
          else hurtEnemy(l.tgt, l.dmg, l.dmg * (l.dot || 0), l.x1, l.y1, l.vuln, 0, 0, l.col);
        }
      }
    } else {
      if (!l.inked) { l.inked = true; addInkStroke(l.x1, l.y1, l.x2, l.y2, l.col || (l.c && l.c.col), false); }
      l.t -= dt;
    }
  }
  lightnings = lightnings.filter(l => l.t > 0);
  for (const s of sparks) s.t -= dt;
  sparks = sparks.filter(s => s.t > 0);

  for (const dr of drops) {
    dr.bob += dt * 4;
    if (!window.__buildRuntime && Math.hypot(player.x - dr.x, player.y - dr.y) < 20) {
      dr.got = true;
      const it = ITEM_DEFS[dr.item];
      const cur = player.equip[it.slot];
      if (cur && cur.key === dr.item) {   // 重复获得 → 强化，最高 Lv10
        if (cur.lvl < 10) { cur.lvl++; toast('【' + it.name + '】强化到 Lv' + cur.lvl + '！属性 +' + 20 * (cur.lvl - 1) + '%'); }
        else { toast('【' + it.name + '】已是 Lv10，转化为 10 点经验'); player.xp += 10; }
      } else {
        player.equip[it.slot] = { key: dr.item, lvl: 1 };
        toast('获得【' + it.name + '】' + it.fx);
      }
      recomputeEquip();
    }
  }
  drops = drops.filter(dr => !dr.got);

  enemies = enemies.filter(e => !e.dead);

  for (const er of erases) er.t -= dt;
  erases = erases.filter(er => er.t > 0);
  killChainT -= dt;
  if (killChainT <= 0) killChain = 0;
  for (const f of floats) { f.t -= dt; f.y -= 30 * dt; }
  floats = floats.filter(f => f.t > 0);
  if (floats.length > 100) floats.splice(0, floats.length - 100);
  for (const ts of toasts) ts.t -= dt;
  toasts = toasts.filter(ts => ts.t > 0);

  updateInkTactics();   // 统一处理本帧产生的截断、续墨和失源转化
  // 镜头不钳制在纸张范围内：即使角色贴边，也始终位于屏幕正中央
  camX = player.x - VIEW_W / 2;
  camY = player.y - VIEW_H / 2;
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
function drawEnemyHorns(x, y, size, c) {
  // 敌方人形怪统一的双角剪影，和玩家的圆润头部明确区分
  const headY = y - size * 0.62;
  jline(x - size * 0.19, headY - size * 0.18, x - size * 0.36, headY - size * 0.52, c, 2);
  jline(x - size * 0.36, headY - size * 0.52, x - size * 0.04, headY - size * 0.28, c, 2);
  jline(x + size * 0.19, headY - size * 0.18, x + size * 0.36, headY - size * 0.52, c, 2);
  jline(x + size * 0.36, headY - size * 0.52, x + size * 0.04, headY - size * 0.28, c, 2);
}
function drawEnemyFull(e) {
  setSeed(e.id);
  // 预警使用世界坐标，必须在身体受击缩放之前绘制，避免判定提示跟着抖动。
  if (e.huntBoss && typeof BossHuntRuntime !== 'undefined') BossHuntRuntime.drawTelegraph(e);
  const c = e.flash > 0 ? FLASH : DARK;
  const p = 1 - e.squash / SQUASH_T;
  const k = Math.pow(Math.max(0, 1 - p), 0.6);
  ctx.save();
  if (k > 0.01) {
    ctx.translate(e.x + (srand() - 0.5) * 3 * k, e.y + (srand() - 0.5) * 2.5 * k);
    ctx.scale(1 + 0.5 * k, 1 - 0.42 * k);
    ctx.translate(-e.x, -e.y);
  }
  if (typeof CreatureGameRuntime !== 'undefined' && CreatureGameRuntime.drawEnemyBody(ctx, e, c)) {
    // 新程序化身体只替换外观；下方射击、精英、墨债与 DOT 公共层保持不变
  } else if (e.type === 'stick' || e.type === 'doodle') {
    const size = e.type === 'stick' ? 26 : 19;
    drawStick(e.x, e.y, size, e.walk, c);
    drawEnemyHorns(e.x, e.y, size, c);
  } else if (e.type === 'spider') {
    // 程序化多足打样：世界坐标落脚点 + 交替四足步态 + 双段 IK
    const rig = ProceduralLocomotion.ensureSpiderRig(e);
    const poses = rig.getPose(e);
    for (const pose of poses) {
      if (pose.leg.lift > 0.1) {
        ctx.save(); ctx.globalAlpha = 0.13 * (1 - pose.leg.lift / 3);
        jcircle(pose.groundX, pose.groundY, 1.5, c, 1); ctx.restore();
      }
      jline(pose.hip.x, pose.hip.y, pose.knee.x, pose.knee.y, c, 1.7);
      jline(pose.knee.x, pose.knee.y, pose.foot.x, pose.foot.y, c, 1.45);
      if (pose.leg.state === 'planted') jcircle(pose.foot.x, pose.foot.y, 0.75, c, 1);
    }
    const bob = poses.reduce((sum, pose) => sum + pose.leg.lift, 0) * 0.08;
    ctx.save();
    ctx.translate(e.x, e.y - bob); ctx.rotate(rig.angle);
    jcircle(0, e.r * 0.3, e.r * 0.68, c, 2.2);
    jcircle(0, -e.r * 0.55, e.r * 0.46, c, 2);
    jcircle(-e.r * 0.18, -e.r * 0.62, 1.5, c, 1.2);
    jcircle(e.r * 0.18, -e.r * 0.62, 1.5, c, 1.2);
    jline(-3, -e.r * 0.25, -1.5, 1, c, 1.2);
    jline(3, -e.r * 0.25, 1.5, 1, c, 1.2);
    ctx.restore();
  } else if (e.type === 'crumple') {
    // 被揉皱后活过来的作业纸：撕折轮廓、怒目、锯齿嘴和纸团短腿
    for (let i = 0; i < 9; i++) {
      const a0 = i / 9 * Math.PI * 2, a1 = (i + 1) / 9 * Math.PI * 2;
      const r0 = e.r * (0.82 + srand() * 0.3), r1 = e.r * (0.82 + srand() * 0.3);
      jline(e.x + Math.cos(a0) * r0, e.y + Math.sin(a0) * r0,
            e.x + Math.cos(a1) * r1, e.y + Math.sin(a1) * r1, c, 2);
    }
    jline(e.x - e.r * 0.7, e.y - 3, e.x - e.r * 0.3, e.y + 4, c, 1.1);
    jline(e.x - 3, e.y - e.r * 0.75, e.x + 4, e.y - e.r * 0.35, c, 1.1);
    jline(e.x + e.r * 0.4, e.y - e.r * 0.6, e.x + e.r * 0.7, e.y - 2, c, 1.1);
    jline(e.x - 9, e.y - 6, e.x - 3, e.y - 3, c, 2);
    jline(e.x + 9, e.y - 6, e.x + 3, e.y - 3, c, 2);
    jcircle(e.x - 5, e.y - 1, 1.8, c, 1.4);
    jcircle(e.x + 5, e.y - 1, 1.8, c, 1.4);
    jline(e.x - 7, e.y + 6, e.x - 3, e.y + 3, c, 1.8);
    jline(e.x - 3, e.y + 3, e.x + 1, e.y + 7, c, 1.8);
    jline(e.x + 1, e.y + 7, e.x + 6, e.y + 4, c, 1.8);
    jline(e.x - 6, e.y + e.r * 0.85, e.x - 8, e.y + e.r * 1.25, c, 2);
    jline(e.x + 6, e.y + e.r * 0.85, e.x + 9, e.y + e.r * 1.2, c, 2);
  } else if (e.type === 'scissors') {
    // 大张口的剪刀：两个独立指环、明显转轴、两片带内侧线的尖刃
    const wobble = Math.sin(e.walk) * 1.5;
    jcircle(e.x - 8, e.y + 10, 5, c, 2.3);
    jcircle(e.x + 7, e.y + 10, 5, c, 2.3);
    jline(e.x - 5, e.y + 6, e.x - 1, e.y + 1, c, 2.5);
    jline(e.x + 4, e.y + 6, e.x + 1, e.y + 1, c, 2.5);
    jline(e.x - 1, e.y + 1, e.x - 13 - wobble, e.y - 15, c, 2.8);
    jline(e.x + 1, e.y + 1, e.x + 14 + wobble, e.y - 14, c, 2.8);
    jline(e.x - 13 - wobble, e.y - 15, e.x - 5, e.y - 3, c, 1.5);
    jline(e.x + 14 + wobble, e.y - 14, e.x + 5, e.y - 3, c, 1.5);
    jline(e.x - 5, e.y - 3, e.x - 2, e.y - 7, c, 1.2);
    jline(e.x + 5, e.y - 3, e.x + 2, e.y - 7, c, 1.2);
    jcircle(e.x, e.y + 1, 2.7, RED, 1.8);
    jcircle(e.x, e.y + 1, 0.8, c, 1.2);
  } else if (e.type === 'ink') {
    // 有脸的浓墨怪物：留白怒目和嘴，外沿伸出墨滴状触手
    jcircle(e.x, e.y, e.r, c, 3.5);
    ctx.save(); ctx.beginPath(); ctx.arc(e.x, e.y, e.r * 0.86, 0, 7); ctx.clip();
    scribbleFill(e.x - e.r, e.y - e.r, e.r * 2, e.r * 2, c); ctx.restore();
    jline(e.x - e.r * 0.8, e.y + 3, e.x - e.r * 1.2, e.y + 8, c, 3);
    jline(e.x + e.r * 0.8, e.y + 2, e.x + e.r * 1.15, e.y + 9, c, 3);
    jcircle(e.x - e.r * 1.18, e.y + 10, 2.8, c, 1.5);
    jcircle(e.x + e.r * 1.13, e.y + 11, 2.3, c, 1.5);
    ctx.fillStyle = PAPER;
    ctx.beginPath(); ctx.moveTo(e.x - 12, e.y - 7); ctx.lineTo(e.x - 3, e.y - 4); ctx.lineTo(e.x - 5, e.y + 2); ctx.lineTo(e.x - 11, e.y); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(e.x + 12, e.y - 7); ctx.lineTo(e.x + 3, e.y - 4); ctx.lineTo(e.x + 5, e.y + 2); ctx.lineTo(e.x + 11, e.y); ctx.closePath(); ctx.fill();
    jcircle(e.x - 7, e.y - 2, 1.4, c, 1.2); jcircle(e.x + 7, e.y - 2, 1.4, c, 1.2);
    jline(e.x - 8, e.y + 7, e.x - 3, e.y + 4, PAPER, 2.2);
    jline(e.x - 3, e.y + 4, e.x + 2, e.y + 8, PAPER, 2.2);
    jline(e.x + 2, e.y + 8, e.x + 8, e.y + 5, PAPER, 2.2);
    jline(e.x - 3, e.y + e.r * 0.85, e.x - 4, e.y + e.r * 1.3, c, 2.5);
  } else if (e.type === 'sprayer') {   // 喷墨涂鸦：背负脏墨囊与滴墨喷嘴
    drawStick(e.x, e.y, 24, e.walk, c);
    drawEnemyHorns(e.x, e.y, 24, c);
    jcircle(e.x + e.r * 0.75, e.y - 2, 6, HOSTILE_INK, 2.2);
    jline(e.x + e.r * 0.75, e.y + 4, e.x + e.r * 1.15, e.y + 11, HOSTILE_INK, 2);
    jcircle(e.x + e.r * 1.15, e.y + 13, 2.2, HOSTILE_INK, 1.5);
  } else if (e.type === 'inksac') {
    // 扎口的大墨袋：窄颈、结绳、鼓胀袋腹，以及袋中晃动的墨水
    const r = e.r;
    jline(e.x - 5, e.y - r * 1.15, e.x - 7, e.y - r * 0.65, c, 2.5);
    jline(e.x + 5, e.y - r * 1.15, e.x + 7, e.y - r * 0.65, c, 2.5);
    jline(e.x - 5, e.y - r * 1.15, e.x + 5, e.y - r * 1.15, c, 2);
    jline(e.x - 7, e.y - r * 0.72, e.x + 7, e.y - r * 0.72, HOSTILE_INK, 3);
    jline(e.x - 5, e.y - r * 1.15, e.x - 11, e.y - r * 1.35, c, 2);
    jline(e.x + 5, e.y - r * 1.15, e.x + 11, e.y - r * 1.32, c, 2);
    jline(e.x - 7, e.y - r * 0.65, e.x - r * 0.9, e.y - r * 0.15, c, 2.8);
    jline(e.x - r * 0.9, e.y - r * 0.15, e.x - r, e.y + r * 0.55, c, 2.8);
    jline(e.x - r, e.y + r * 0.55, e.x - r * 0.45, e.y + r, c, 2.8);
    jline(e.x - r * 0.45, e.y + r, e.x + r * 0.45, e.y + r, c, 2.8);
    jline(e.x + r * 0.45, e.y + r, e.x + r, e.y + r * 0.55, c, 2.8);
    jline(e.x + r, e.y + r * 0.55, e.x + r * 0.9, e.y - r * 0.15, c, 2.8);
    jline(e.x + r * 0.9, e.y - r * 0.15, e.x + 7, e.y - r * 0.65, c, 2.8);
    ctx.save(); ctx.globalAlpha = 0.45; scribbleFill(e.x - r * 0.8, e.y + r * 0.25, r * 1.6, r * 0.65, HOSTILE_INK); ctx.restore();
    jline(e.x - r * 0.75, e.y + r * 0.3, e.x, e.y + r * 0.2, HOSTILE_INK, 1.5);
    jline(e.x, e.y + r * 0.2, e.x + r * 0.75, e.y + r * 0.3, HOSTILE_INK, 1.5);
    jcircle(e.x - 5, e.y - 4, 2.2, c, 1.5); jcircle(e.x + 5, e.y - 4, 2.2, c, 1.5);
    jline(e.x - 4, e.y + 4, e.x + 4, e.y + 4, c, 1.8);
    jline(e.x + r * 0.85, e.y + r * 0.45, e.x + r * 1.2, e.y + r * 0.8, HOSTILE_INK, 2);
    jcircle(e.x + r * 1.22, e.y + r * 0.9, 2.5, HOSTILE_INK, 1.5);
  } else if (e.type === 'leech' || e.type === 'inkthief') {   // 吸墨怪：空肚软泥，吃墨后身体逐渐变厚
    jcircle(e.x, e.y, e.r, c, e.type === 'inkthief' ? 3.5 : 2.5);
    jcircle(e.x - e.r * 0.35, e.y - e.r * 0.15, 2.2, c, 1.5);
    jcircle(e.x + e.r * 0.35, e.y - e.r * 0.15, 2.2, c, 1.5);
    jline(e.x - e.r * 0.45, e.y + e.r * 0.35, e.x + e.r * 0.45, e.y + e.r * 0.35, PURPLE, 2.5);
    if (e.ink > 0) {
      ctx.save(); ctx.beginPath(); ctx.arc(e.x, e.y, e.r * 0.78, 0, 7); ctx.clip();
      ctx.globalAlpha = Math.min(0.75, 0.2 + e.ink / 80); scribbleFill(e.x - e.r, e.y - e.r, e.r * 2, e.r * 2, PURPLE); ctx.restore();
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
    const mx = e.x - c1 * 8, my = e.y - s1 * 8;
    jline(tx, ty, lx, ly, c, 2); jline(tx, ty, rx, ry, c, 2); jline(lx, ly, rx, ry, c, 2);
    jline(tx, ty, mx, my, c, 1.5);
    jline(mx, my, e.x - c1 * 3 - s1 * 3, e.y - s1 * 3 + c1 * 3, c, 1.2);
    jline(mx, my, e.x - c1 * 3 + s1 * 3, e.y - s1 * 3 - c1 * 3, c, 1.2);
  } else if (e.type === 'pencilthrower' || e.type === 'forkpen' || e.type === 'eliteCrossbow') {
    const size = e.elite ? 31 : 25;
    drawStick(e.x, e.y, size, e.walk, c);
    drawEnemyHorns(e.x, e.y, size, c);
    const a = e.faceA || 0, ca = Math.cos(a), sa = Math.sin(a);
    const wx = e.x + ca * (e.r + 7), wy = e.y + sa * (e.r + 7);
    if (e.type === 'forkpen') {
      jline(wx - ca * 8 - sa * 5, wy - sa * 8 + ca * 5, wx + ca * 10 + sa * 5, wy + sa * 10 - ca * 5, c, 2.2);
      jline(wx - ca * 8 + sa * 5, wy - sa * 8 - ca * 5, wx + ca * 10 - sa * 5, wy + sa * 10 + ca * 5, c, 2.2);
    } else if (e.type === 'eliteCrossbow') {
      jline(wx - sa * 11, wy + ca * 11, wx + ca * 9, wy + sa * 9, c, 2.8);
      jline(wx + ca * 9, wy + sa * 9, wx + sa * 11, wy - ca * 11, c, 2.8);
      jline(wx - sa * 11, wy + ca * 11, wx + sa * 11, wy - ca * 11, RED, 1.5);
    } else {
      jline(wx - ca * 11, wy - sa * 11, wx + ca * 13, wy + sa * 13, c, 3);
      jline(wx + ca * 13, wy + sa * 13, wx + ca * 9 - sa * 3, wy + sa * 9 + ca * 3, RED, 1.8);
    }
  } else if (e.type === 'elitePencil') {
    // 铅笔统领：橡皮笔帽、金属箍、六棱笔杆、木质削尖和石墨尖
    const r = e.r;
    jrect(e.x - r * 0.48, e.y - r * 1.05, r * 0.96, r * 0.35, RED, 2.4);
    jline(e.x - r * 0.52, e.y - r * 0.7, e.x + r * 0.52, e.y - r * 0.7, c, 2.5);
    jline(e.x - r * 0.52, e.y - r * 0.52, e.x + r * 0.52, e.y - r * 0.52, c, 1.6);
    jline(e.x - r * 0.48, e.y - r * 0.52, e.x - r * 0.48, e.y + r * 0.48, c, 2.8);
    jline(e.x + r * 0.48, e.y - r * 0.52, e.x + r * 0.48, e.y + r * 0.48, c, 2.8);
    jline(e.x, e.y - r * 0.52, e.x, e.y + r * 0.48, c, 1.3);
    jline(e.x - r * 0.48, e.y + r * 0.48, e.x, e.y + r * 1.25, c, 2.8);
    jline(e.x + r * 0.48, e.y + r * 0.48, e.x, e.y + r * 1.25, c, 2.8);
    jline(e.x - r * 0.48, e.y + r * 0.48, e.x - r * 0.16, e.y + r * 0.72, c, 1.4);
    jline(e.x + r * 0.48, e.y + r * 0.48, e.x + r * 0.16, e.y + r * 0.72, c, 1.4);
    jline(e.x - r * 0.16, e.y + r * 0.72, e.x, e.y + r * 1.25, c, 2.2);
    jline(e.x + r * 0.16, e.y + r * 0.72, e.x, e.y + r * 1.25, c, 2.2);
    jcircle(e.x - r * 0.2, e.y - r * 0.1, 1.8, c, 1.4);
    jcircle(e.x + r * 0.2, e.y - r * 0.1, 1.8, c, 1.4);
    jline(e.x - r * 0.18, e.y + r * 0.2, e.x + r * 0.18, e.y + r * 0.2, c, 1.8);
    jline(e.x - r * 0.5, e.y - r * 1.08, e.x - r * 0.3, e.y - r * 1.45, RED, 2);
    jline(e.x - r * 0.3, e.y - r * 1.45, e.x, e.y - r * 1.15, RED, 2);
    jline(e.x, e.y - r * 1.15, e.x + r * 0.3, e.y - r * 1.45, RED, 2);
    jline(e.x + r * 0.3, e.y - r * 1.45, e.x + r * 0.5, e.y - r * 1.08, RED, 2);
  } else if (e.type === 'eliteEraser') {   // 精英：宽厚橡皮霸主
    const r = e.r;
    jrect(e.x - r * 0.85, e.y - r * 0.65, r * 1.7, r * 1.3, c, 3.5);
    jline(e.x - r * 0.85, e.y - r * 0.1, e.x + r * 0.85, e.y - r * 0.1, c, 2);
    jline(e.x - r * 0.35, e.y - r * 0.65, e.x - r * 0.05, e.y + r * 0.65, c, 2);
    jcircle(e.x - r * 0.38, e.y + r * 0.25, 2.5, c, 1.5);
    jcircle(e.x + r * 0.38, e.y + r * 0.25, 2.5, c, 1.5);
    jline(e.x - r * 0.2, e.y + r * 0.48, e.x + r * 0.2, e.y + r * 0.48, c, 2);
  } else if (e.type === 'eliteEye') {   // 精英：红笔魔眼
    const r = e.r;
    jline(e.x - r, e.y, e.x - r * 0.45, e.y - r * 0.62, c, 3);
    jline(e.x - r * 0.45, e.y - r * 0.62, e.x + r * 0.45, e.y - r * 0.62, c, 3);
    jline(e.x + r * 0.45, e.y - r * 0.62, e.x + r, e.y, c, 3);
    jline(e.x - r, e.y, e.x - r * 0.45, e.y + r * 0.62, c, 3);
    jline(e.x - r * 0.45, e.y + r * 0.62, e.x + r * 0.45, e.y + r * 0.62, c, 3);
    jline(e.x + r * 0.45, e.y + r * 0.62, e.x + r, e.y, c, 3);
    jcircle(e.x, e.y, r * 0.38, RED, 3);
    jcircle(e.x, e.y, r * 0.12, c, 2);
    for (let i = 0; i < 6; i++) {
      const a = i / 6 * Math.PI * 2;
      jline(e.x + Math.cos(a) * r * 1.05, e.y + Math.sin(a) * r * 0.75,
            e.x + Math.cos(a) * r * 1.28, e.y + Math.sin(a) * r * 0.95, RED, 1.8);
    }
  } else if (e.boss) drawBoss(e, c);
  if (isShooter(e) && e.shotWindup > 0) {
    const d0 = ENEMY_DEFS[e.type], charge = 1 - e.shotWindup / d0.shotWindup;
    ctx.globalAlpha = 0.2 + charge * 0.65;
    setSeed(e.id + 120);
    jline(e.x, e.y, e.x + Math.cos(e.aimA) * 210, e.y + Math.sin(e.aimA) * 210, ENEMY_AIM, 1.2 + charge);
    jcircle(e.x + Math.cos(e.aimA) * (e.r + 9), e.y + Math.sin(e.aimA) * (e.r + 9), 3 + charge * 3, ENEMY_AIM, 1.8);
    ctx.globalAlpha = 1;
  }
  if (e.elite && e.type !== 'eliteCrossbow') {   // 弩手保留干净的人形与弩轮廓
    setSeed(e.id + 90);
    jcircle(e.x, e.y, e.r + 5, c, 1.4);
  }
  if (e.shade) {
    setSeed(e.id + 29000); jcircle(e.x, e.y, e.r + 6, PURPLE, 2.2);
    ctx.fillStyle = PURPLE; ctx.textAlign = 'center'; ctx.font = 'bold 11px ' + FONT;
    ctx.fillText('债', e.x, e.y - e.r - 11);
  }
  if (e.ink > 0) {
    ctx.fillStyle = PURPLE; ctx.textAlign = 'center'; ctx.font = 'bold 10px ' + FONT;
    ctx.fillText(Math.round(e.ink) + '墨', e.x, e.y + e.r + 15);
  }
  if (e.dotT > 0) {
    setSeed(e.id + 31);
    const ey = e.y - e.r - 8;
    jline(e.x - 6, ey, e.x - 2, ey - 3, RED, 1.5);
    jline(e.x - 2, ey - 3, e.x + 2, ey, RED, 1.5);
    jline(e.x + 2, ey, e.x + 6, ey - 3, RED, 1.5);
  }
  ctx.restore();
  // 攻击圈不参与怪物受击压扁，始终与固定圆形判定一致
  drawMeleeTelegraph(e);
}

/* 普通怪缓存：只简化远处绘制，攻击圈仍每帧按真实判定单独绘制 */
const ENEMY_SPRITE_SIZE = 112, enemySpriteCache = new Map();
function shouldUseEnemySprite(e) {
  if (typeof document.createElement !== 'function' || (!renderQuality && enemies.length <= 70)) return false;
  // 多足与飞行角色使用实时世界坐标运动，不能降级成共享的静态摆动帧
  if (e.type === 'spider' || (typeof CreatureGameRuntime !== 'undefined' && CreatureGameRuntime.requiresLiveBody(e)) ||
      e.boss || e.elite || e.shade || e.flash > 0 || e.squash > 0 || e.ink > 0 || e.dotT > 0 || e.shotWindup > 0) return false;
  return (e.x - player.x) ** 2 + (e.y - player.y) ** 2 > 180 * 180;
}
function getEnemySprite(e) {
  const frame = ((Math.floor(e.walk / (Math.PI / 2)) % 4) + 4) % 4;
  const key = e.type + ':' + frame;
  if (enemySpriteCache.has(key)) return enemySpriteCache.get(key);
  const layer = document.createElement('canvas'), scale = 2;
  layer.width = layer.height = ENEMY_SPRITE_SIZE * scale;
  const layerCtx = layer.getContext('2d');
  if (!layerCtx) return null;
  layerCtx.setTransform(scale, 0, 0, scale, 0, 0);
  let stableId = 0; for (let i = 0; i < e.type.length; i++) stableId = (stableId * 31 + e.type.charCodeAt(i)) | 0;
  const fake = Object.assign({}, e, {
    id: stableId, x: ENEMY_SPRITE_SIZE / 2, y: ENEMY_SPRITE_SIZE / 2, walk: frame * Math.PI / 2,
    flash: 0, squash: 0, elite: false, shade: false, ink: 0, dotT: 0, shotWindup: 0, swingT: 0
  });
  const mainCtx = ctx, mainBoil = boilT, mainSeed = _seed;
  try {
    ctx = layerCtx; boilT = 0; drawEnemyFull(fake);
  } finally {
    ctx = mainCtx; boilT = mainBoil; _seed = mainSeed;
  }
  enemySpriteCache.set(key, layer);
  return layer;
}

/* 远处蜘蛛：8 个朝向 × 4 个动作帧共享缓存；近处完整 IK 不受影响 */
const spiderFarSpriteCache = new Map();
function drawSpiderFarBody(e, c) {
  for (let sideIndex = 0; sideIndex < 2; sideIndex++) {
    const side = sideIndex === 0 ? -1 : 1;
    for (let i = 0; i < 4; i++) {
      const hipX = side * (3.2 + (i === 1 || i === 2 ? 0.8 : 0)), hipY = -5 + i * 3.7;
      const step = Math.sin(e.walk + i * 1.7 + sideIndex * Math.PI) * 1.5;
      const footX = side * (13.5 + (i === 1 || i === 2 ? 3.5 : 0)), footY = -15 + i * 10 + step;
      const kneeX = (hipX + footX) * 0.5 + side * 2, kneeY = (hipY + footY) * 0.5 - 1.5;
      jline(e.x + hipX, e.y + hipY, e.x + kneeX, e.y + kneeY, c, 1.5);
      jline(e.x + kneeX, e.y + kneeY, e.x + footX, e.y + footY, c, 1.25);
    }
  }
  ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(e.farAngle || 0);
  jcircle(0, e.r * 0.3, e.r * 0.68, c, 2.2);
  jcircle(0, -e.r * 0.55, e.r * 0.46, c, 2);
  jcircle(-e.r * 0.18, -e.r * 0.62, 1.5, c, 1.2);
  jcircle(e.r * 0.18, -e.r * 0.62, 1.5, c, 1.2);
  ctx.restore();
}
function getSpiderFarSprite(e) {
  const rig = ProceduralLocomotion.ensureSpiderRig(e);
  const sector = ((Math.round(rig.angle / (Math.PI / 4)) % 8) + 8) % 8;
  const frame = ((Math.floor(e.walk / (Math.PI / 2)) % 4) + 4) % 4;
  const key = sector + ':' + frame;
  if (spiderFarSpriteCache.has(key)) return spiderFarSpriteCache.get(key);
  const layer = document.createElement('canvas'), scale = 2;
  layer.width = layer.height = ENEMY_SPRITE_SIZE * scale;
  const layerCtx = layer.getContext('2d');
  if (!layerCtx) return null;
  layerCtx.setTransform(scale, 0, 0, scale, 0, 0);
  layerCtx.translate(ENEMY_SPRITE_SIZE / 2, ENEMY_SPRITE_SIZE / 2);
  const mainCtx = ctx, mainBoil = boilT, mainSeed = _seed;
  try {
    ctx = layerCtx; boilT = 0; setSeed(7000 + sector * 11 + frame);
    drawSpiderFarBody({ x: 0, y: 0, r: e.r, walk: frame * Math.PI / 2, farAngle: sector * Math.PI / 4 }, DARK);
  } finally {
    ctx = mainCtx; boilT = mainBoil; _seed = mainSeed;
  }
  spiderFarSpriteCache.set(key, layer);
  return layer;
}
function drawEnemy(e) {
  if (e.type === 'spider' && e.locomotionLod >= 2 && !e.flash && !e.squash && !e.shade && !e.ink && !e.dotT && !e.shotWindup) {
    const sprite = getSpiderFarSprite(e);
    if (sprite) {
      ctx.drawImage(sprite, e.x - ENEMY_SPRITE_SIZE / 2, e.y - ENEMY_SPRITE_SIZE / 2, ENEMY_SPRITE_SIZE, ENEMY_SPRITE_SIZE);
      perfStats.cacheHits++; drawMeleeTelegraph(e); return;
    }
  }
  if (shouldUseEnemySprite(e)) {
    const sprite = getEnemySprite(e);
    if (sprite) {
      ctx.drawImage(sprite, e.x - ENEMY_SPRITE_SIZE / 2, e.y - ENEMY_SPRITE_SIZE / 2, ENEMY_SPRITE_SIZE, ENEMY_SPRITE_SIZE);
      perfStats.cacheHits++; drawMeleeTelegraph(e); return;
    }
  }
  drawEnemyFull(e);
}

function drawMeleeTelegraph(e) {
  if (e.boss || e.shade || isShooter(e) || e.swingT <= 0) return;
  const active = e.swingT <= BATTLE.melee.active, range = enemySwingRange(e);
  setSeed(e.id + 160);
  if (!active) {
    // 外圈始终是真实判定范围；内圈从怪物脚下扩张，两圈重合时结算
    const charge = Math.max(0, Math.min(1, (BATTLE.melee.total - e.swingT) / (BATTLE.melee.total - BATTLE.melee.active)));
    const chargeR = e.r + (range - e.r) * charge;
    ctx.globalAlpha = 0.035 + charge * 0.055; ctx.fillStyle = RED;
    ctx.beginPath(); ctx.arc(e.x, e.y, range, 0, Math.PI * 2); ctx.fill();
    // 未进入打击判定时外圈保持低透明度；内圈仍清晰显示收缩时机
    ctx.globalAlpha = 0.22 + charge * 0.16;
    jcircle(e.x, e.y, range, RED, 1.8);
    ctx.globalAlpha = 0.25 + charge * 0.65;
    jcircle(e.x, e.y, chargeR, RED, 1.5 + charge * 1.3);
    if (charge > 0.45) {
      const warningY = e.y - e.r - 22;
      ctx.globalAlpha = Math.min(1, 0.65 + charge * 0.35);
      ctx.fillStyle = PAPER; ctx.beginPath(); ctx.arc(e.x, warningY, 8, 0, Math.PI * 2); ctx.fill();
      jcircle(e.x, warningY, 8, RED, 1.8);
      jline(e.x, warningY - 4, e.x, warningY + 1.5, RED, 2.2);
      ctx.fillStyle = RED; ctx.beginPath(); ctx.arc(e.x, warningY + 4.5, 1.2, 0, Math.PI * 2); ctx.fill();
    }
  } else {
    // 两圈已经重合：固定命中圈保留配置的持续时间，随后淡出
    const swingP = Math.max(0, Math.min(1, 1 - e.swingT / BATTLE.melee.active));
    ctx.globalAlpha = 0.16 * (1 - swingP * 0.55); ctx.fillStyle = RED;
    ctx.beginPath(); ctx.arc(e.x, e.y, range, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1 - swingP * 0.4;
    jcircle(e.x, e.y, range, RED, 3.4 - swingP * 0.8);
  }
  ctx.globalAlpha = 1;
}

function renderInkTerritory() {
  const friendlyCol = player.actives.length ? trailColorOf(player.actives[0].id) : INK;
  recolorFriendlyInk(friendlyCol);
  ctx.save(); ctx.imageSmoothingEnabled = true;
  if (hostileInkLayer.canvas) { ctx.globalAlpha = 0.27; ctx.drawImage(hostileInkLayer.canvas, WORLD_L, WORLD_T, WORLD_W, WORLD_H); }
  if (friendlyInkLayer.canvas) { ctx.globalAlpha = 0.23; ctx.drawImage(friendlyInkLayer.canvas, WORLD_L, WORLD_T, WORLD_W, WORLD_H); }
  ctx.restore();
}
function floatPopScale(f) {
  if (!f.maxT) f.maxT = f.t;
  const age = f.maxT - f.t, growT = 2 / 60;
  if (age < growT) return 1.5 + 0.5 * (age / growT); // 两帧：1.5 → 1.75 → 2 倍
  const pop = Math.max(0, 1 - (age - growT) / 0.12);
  return 1.5 + 0.5 * pop * pop;
}
function floatIsFlashing(f) {
  if (!f.maxT) f.maxT = f.t;
  return f.maxT - f.t < 0.08 + 1 / 60; // 原闪白时长增加一帧
}
function drawCoreDamageZone(x, y, radius, c, showLabel = true) {
  if (!c || !c.core || !radius) return;
  const innerR = radius * 0.5, col = c.col || INK;
  ctx.save();
  ctx.fillStyle = col; ctx.globalAlpha = 0.07;
  ctx.beginPath(); ctx.arc(x, y, innerR, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = col; ctx.globalAlpha = 0.7; ctx.lineWidth = 1.2; ctx.setLineDash([3, 3]);
  ctx.beginPath(); ctx.arc(x, y, innerR, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
  if (showLabel) {
    ctx.globalAlpha = 0.95; ctx.fillStyle = col; ctx.textAlign = 'center'; ctx.font = 'bold 9px ' + FONT;
    ctx.shadowColor = PAPER; ctx.shadowBlur = 3;
    ctx.fillText('圆心增伤 +' + Math.round(c.core * 100) + '%', x, y + innerR + 12);
  }
  ctx.restore();
}
function drawOuterSurgeDamageZone(x, y, radius, alpha = 1) {
  if (!radius) return;
  const innerR = radius * 0.7;
  ctx.save();
  ctx.fillStyle = INK; ctx.globalAlpha = 0.055 * alpha;
  ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.arc(x, y, innerR, 0, Math.PI * 2, true); ctx.fill('evenodd');
  ctx.strokeStyle = INK; ctx.globalAlpha = 0.75 * alpha; ctx.lineWidth = 1.4; ctx.setLineDash([5, 4]);
  ctx.beginPath(); ctx.arc(x, y, innerR, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
  ctx.globalAlpha = 0.95 * alpha; ctx.fillStyle = INK; ctx.textAlign = 'center'; ctx.font = 'bold 10px ' + FONT;
  ctx.shadowColor = PAPER; ctx.shadowBlur = 3;
  ctx.fillText('外圈增伤 +50%', x, y + innerR + 14);
  ctx.restore();
}
function drawPlayerResources() {
  const hpRatio = Math.max(0, Math.min(1, player.hp / player.maxhp));
  const inkRatio = Math.max(0, Math.min(1, player.ink / player.maxInk));
  const centerY = player.y + 4;
  ctx.save();
  ctx.globalAlpha = 0.95; ctx.lineCap = 'round';
  function resourceArc(radius, color, width, ratio = 1) {
    const start = Math.PI / 6, span = Math.PI * 2 / 3;
    ctx.beginPath(); ctx.strokeStyle = color; ctx.lineWidth = width;
    ctx.arc(player.x, centerY, radius, start, start + span * ratio); ctx.stroke();
  }
  resourceArc(28, 'rgba(245,241,230,0.82)', 2.8);
  resourceArc(23, 'rgba(245,241,230,0.82)', 2.6);
  if (hpRatio > 0) resourceArc(28, RED, 1.6, hpRatio);
  if (inkRatio > 0) resourceArc(23, INK, 1.4, inkRatio);
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
  renderInkTerritory();

  let eruptionCoreLabeled = false;
  for (const er of erupts) {
    setSeed(3000 + Math.floor(er.x));
    const ec = er.c && er.c.col ? er.c.col : INK;
    if (er.c && er.c.core) {
      drawCoreDamageZone(er.x, er.y, er.r, er.c, !eruptionCoreLabeled);
      eruptionCoreLabeled = true;
    }
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
  for (const dr of drops) {
    const bobY = dr.y + Math.sin(dr.bob) * 3;
    setSeed(7000 + Math.floor(dr.x));
    jrect(dr.x - 8, bobY - 8, 16, 16, PICKUP, 2);
    jline(dr.x - 4, bobY, dr.x + 4, bobY, PICKUP, 2);
  }
  // 被擦掉的小怪：纸色粗笔擦除 + 少量纸屑，活怪随后绘制避免被遮住
  for (const er of erases) {
    setSeed(er.seed + 12000); ctx.globalAlpha = Math.min(1, er.t / 0.18);
    const pc = STAGE_PAPER[(curStage || 1) - 1];
    jline(er.x - er.r, er.y - er.r * 0.5, er.x + er.r, er.y + er.r * 0.35, pc, 7);
    jline(er.x - er.r * 0.8, er.y + er.r * 0.55, er.x + er.r * 0.7, er.y - er.r * 0.45, pc, 5);
    for (let i = 0; i < 3; i++) jline(er.x + (srand() - 0.5) * er.r * 2, er.y + (srand() - 0.5) * er.r * 2,
      er.x + (srand() - 0.5) * er.r * 3, er.y + er.r + srand() * 6, GRAY, 1);
    ctx.globalAlpha = 1;
  }
  for (const e of enemies) {
    if (e.x < camX - 70 || e.x > camX + VIEW_W + 70 || e.y < camY - 70 || e.y > camY + VIEW_H + 70) continue;
    drawEnemy(e);
  }
  for (const m of minions) {
    setSeed(m.walk * 1000 | 0);
    if (m.ghost) {   // 赦免粉笔拉起来的幽灵小鬼：半透明描边
      ctx.globalAlpha = 0.55;
      drawStick(m.x, m.y, 18, m.walk, INK);
      jline(m.x - 5, m.y + 9, m.x - 2, m.y + 5, INK, 1.2);
      jline(m.x - 2, m.y + 5, m.x + 1, m.y + 9, INK, 1.2);
      jline(m.x + 1, m.y + 9, m.x + 4, m.y + 5, INK, 1.2);
      ctx.globalAlpha = 1;
    } else {
      drawStick(m.x, m.y, m.king ? 32 : 18, m.walk, ALLY);
      if (m.king) {
        jline(m.x - 9, m.y - 25, m.x - 6, m.y - 34, ALLY, 2.5);
        jline(m.x - 6, m.y - 34, m.x, m.y - 27, ALLY, 2.5);
        jline(m.x, m.y - 27, m.x + 6, m.y - 34, ALLY, 2.5);
        jline(m.x + 6, m.y - 34, m.x + 9, m.y - 25, ALLY, 2.5);
      } else if (m.ranged) jcircle(m.x + 9, m.y - 3, 4, ALLY, 1.5);
    }
  }
  for (const tt of totems) {
    setSeed(7000 + Math.floor(tt.x));
    jcircle(tt.x, tt.y - 10, 7, ALLY, 2.5);
    jline(tt.x, tt.y - 4, tt.x, tt.y + 8, DARK, 2.5);
    scribbleFill(tt.x - 5, tt.y - 13, 10, 6, ALLY);
  }
  // 毒墨云：涂鸦云团 + 雨线
  let cloudCoreLabeled = false;
  for (const cl of clouds) {
    setSeed(7300 + Math.floor(cl.x));
    const cc = cl.c.col || INK;
    if (cl.c.core) {
      drawCoreDamageZone(cl.x, cl.y, cl.r, cl.c, !cloudCoreLabeled);
      cloudCoreLabeled = true;
    }
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
  // 雷网与冰面：持续存在的觉醒领域
  let fieldCoreLabeled = false;
  for (const f of fields) {
    setSeed(7350 + Math.floor(f.x)); const fc = f.kind === 'ice' ? '#7ec8e3' : (f.c.col || ARC);
    if (f.c.core) {
      drawCoreDamageZone(f.x, f.y, f.r, f.c, !fieldCoreLabeled);
      fieldCoreLabeled = true;
    }
    ctx.globalAlpha = Math.min(0.65, f.t * 0.5);
    jcircle(f.x, f.y, f.r, fc, f.kind === 'ice' ? 2 : 2.5);
    jcircle(f.x, f.y, f.r * 0.72, fc, 1.2);
    for (let i = 0; i < 6; i++) {
      const a = i / 6 * Math.PI * 2;
      jline(f.x + Math.cos(a) * f.r * 0.25, f.y + Math.sin(a) * f.r * 0.25,
        f.x + Math.cos(a + 0.35) * f.r * 0.9, f.y + Math.sin(a + 0.35) * f.r * 0.9, fc, 1.2);
    }
    ctx.globalAlpha = 1;
  }
  // 涂改带刀阵：淡整圈轨迹 + 均匀分布的锯齿碎片
  if (blades.length) {
    const guide = blades[0], radius = BATTLE.skills.closeRadius * guide.rad * (1 + (guide.c.sweep || 0));
    setSeed(7599); ctx.globalAlpha = 0.16;
    jcircle(player.x, player.y, radius, guide.c.col || INK, 5);
    ctx.globalAlpha = 1;
  }
  for (const bl of blades) {
    setSeed(7600 + Math.floor(bl.ang * 10));
    const bc0 = bl.c.col || INK;
    ctx.globalAlpha = Math.min(1, bl.t * 2);
    const ba = Math.atan2(bl.y - player.y, bl.x - player.x) + Math.PI / 2, bc = Math.cos(ba), bs = Math.sin(ba);
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
    if (nv.c && nv.c.core) drawCoreDamageZone(nv.x, nv.y, nv.max, nv.c);
    if (nv.outerDamage) drawOuterSurgeDamageZone(nv.x, nv.y, nv.max, Math.max(0, nv.t / BATTLE.surge.visual));
    setSeed(7950);
    ctx.globalAlpha = 1 - k;
    jcircle(nv.x, nv.y, nv.max * (0.3 + 0.7 * k), nv.col || ARC, 3);
    jcircle(nv.x, nv.y, nv.max * (0.2 + 0.6 * k), nv.col || INK, 1.5);
    ctx.globalAlpha = 1;
  }
  if (getActive('cyclone') && !player.diving) {
    const ca = getActive('cyclone'), cc = skillCalc(ca), baseRad = BATTLE.skills.closeRadius * cc.rad * (1 + cc.sweep);
    const rings = ca.lvl >= 5 ? [1, 1.32, 1.64] : (ca.lvl >= 3 ? [1, 1.35] : [1]);
    for (let ri = 0; ri < rings.length; ri++) {
      const rad = baseRad * rings[ri], n = ca.lvl >= 5 ? 4 : 3;
      if (cc.core) drawCoreDamageZone(player.x, player.y, rad, cc, ri === 0);
      for (let i = 0; i < n; i++) {
        const a = cycAng * (ri % 2 ? -1 : 1) + ri * 0.4 + i * Math.PI * 2 / n;
        const x1 = player.x + Math.cos(a) * rad, y1 = player.y + Math.sin(a) * rad;
        const x2 = player.x + Math.cos(a + 0.9) * rad, y2 = player.y + Math.sin(a + 0.9) * rad;
        setSeed(8800 + i + ri * 10);
        jline(x1, y1, x2, y2, cc.col, ri === 2 ? 5 : 4);
      }
    }
  }
  for (const b of bullets) {
    ctx.save();
    ctx.translate(b.x, b.y); ctx.scale(b.size || 1, b.size || 1); ctx.translate(-b.x, -b.y);
    setSeed(6000 + (b.kind === 'ink' ? 7 : 0));
    const a = Math.atan2(b.vy, b.vx);
    const bc = b.col || INK;   // 属性色：物理灰/火橙/冰浅蓝/雷蓝紫
    if (b.kind === 'torn') {
      const c1 = Math.cos(a), s1 = Math.sin(a), sz = b.big ? 1.6 : 1;
      jline(b.x + c1 * 8 * sz, b.y + s1 * 8 * sz, b.x - c1 * 5 * sz - s1 * 6 * sz, b.y - s1 * 5 * sz + c1 * 6 * sz, bc, b.big ? 2.8 : 1.8);
      jline(b.x + c1 * 8 * sz, b.y + s1 * 8 * sz, b.x - c1 * 5 * sz + s1 * 6 * sz, b.y - s1 * 5 * sz - c1 * 6 * sz, bc, b.big ? 2.8 : 1.8);
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
    ctx.restore();
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
  if (candle && !player.diving) {   // 蜡烛头：灼烧光环 + 头顶火苗
    const cc = skillCalc(candle), rad = BATTLE.skills.closeRadius * cc.rad;
    if (cc.core) drawCoreDamageZone(player.x, player.y, rad, cc);
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
  if (player.absorbT > 0) {
    const ak = 1 - player.absorbT / player.absorbDuration;
    setSeed(8915); ctx.globalAlpha = 0.45 + player.absorbT;
    jcircle(player.x, player.y, player.absorbRadius * (1 - ak * 0.35), inkFriendlyColor, 2.5);
    jcircle(player.x, player.y, player.absorbRadius * (0.72 - ak * 0.2), inkFriendlyColor, 1.2);
    for (let i = 0; i < 8; i++) {
      const a = i / 8 * Math.PI * 2 + ak * 2;
      jline(player.x + Math.cos(a) * 43, player.y + Math.sin(a) * 43,
        player.x + Math.cos(a) * 27, player.y + Math.sin(a) * 27, inkFriendlyColor, 1.4);
    }
    ctx.globalAlpha = 1;
  }
  if (player.surgeCharging) {
    const cr = inkSurgeChargeRatio(), radius = inkSurgeChargeRadius();
    const col = player.actives.length ? trailColorOf(player.actives[0].id) : INK;
    if (hasAffix('surge', 'outerdamage')) drawOuterSurgeDamageZone(player.x, player.y, radius);
    setSeed(8918); ctx.globalAlpha = 0.35 + cr * 0.35;
    jcircle(player.x, player.y, radius, col, 2 + cr * 1.5);
    jcircle(player.x, player.y, 20 + cr * 9, col, 1.5);
    ctx.globalAlpha = 0.9; ctx.fillStyle = col; ctx.textAlign = 'center'; ctx.font = 'bold 12px ' + FONT;
    ctx.fillText(cr >= 1 ? '蓄力 100% · 松开' : '蓄力 ' + Math.round(cr * 100) + '%', player.x, player.y - radius - 10);
    ctx.globalAlpha = 1;
  }
  const goldenGuard = hitStopT > 0 || player.goldT > 0, guardGold = '#d8a64b';
  if (goldenGuard || player.hurtT <= 0 || Math.floor(player.hurtT * 20) % 2 === 0) {
    if (player.diving) {
      const col = player.actives.length ? trailColorOf(player.actives[0].id) : INK;
      setSeed(8920);
      if (typeof CreatureGameRuntime !== 'undefined') CreatureGameRuntime.drawDivingPlayer(ctx, player, col);
      else {
        ctx.save(); ctx.translate(player.x, player.y + 9); ctx.scale(1.28, 0.36); ctx.globalAlpha = 0.58;
        drawStick(0, 0, 30, player.walk, col); ctx.restore();
        ctx.globalAlpha = 0.8;
        jcircle(player.x, player.y + 8, 19 + Math.sin(player.walk) * 2, col, 1.8);
        jline(player.x - 25, player.y + 14, player.x - 10, player.y + 14, col, 1.4);
        jline(player.x + 10, player.y + 14, player.x + 25, player.y + 14, col, 1.4);
        ctx.globalAlpha = 1;
      }
    } else {
      ctx.save();
      if (goldenGuard) { ctx.shadowColor = guardGold; ctx.shadowBlur = 10; }
      const playerColor = !goldenGuard && player.hurtT > 0 ? RED : INK;
      if (typeof CreatureGameRuntime !== 'undefined') CreatureGameRuntime.drawPlayer(ctx, player, playerColor);
      else drawStick(player.x, player.y, 30, player.walk, playerColor);
      ctx.restore();
    }
  }
  if (goldenGuard) {
    ctx.save(); ctx.globalAlpha = 0.74 + Math.sin(boilT * 10) * 0.16;
    ctx.shadowColor = guardGold; ctx.shadowBlur = 9; setSeed(8922);
    jcircle(player.x, player.y - 3, 22, guardGold, 1.8);
    ctx.restore();
  }
  drawPlayerResources();
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
    const scale = f.weak ? 1 : floatPopScale(f), flashing = !f.weak && floatIsFlashing(f);
    ctx.save();
    ctx.globalAlpha = Math.min(1, f.t * 2) * (f.weak ? 0.58 : 1);
    ctx.fillStyle = flashing ? '#ffffff' : f.color;
    ctx.shadowColor = flashing ? (f.color || INK) : 'transparent';
    ctx.shadowBlur = flashing ? 5 : 0;
    // 普通跳字两帧长到 2 倍；墨迹持续伤害只用低透小字，不放大、不闪白
    ctx.translate(f.x, f.y); ctx.scale(scale, scale);
    ctx.font = f.weak ? '10px ' + FONT : ((f.crit ? '900 18px ' : 'bold 13px ') + FONT);
    ctx.fillText(f.txt, 0, 0);
    ctx.restore();
  }
  // 装备掉落等扩展内容仍在世界层绘制，不能越过 HUD 与选词卡
  if (window.__drawWorldExtras) { ctx.save(); window.__drawWorldExtras(); ctx.restore(); }
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
  if (state === 'play' || state === 'levelup' || state === 'start') drawBuildButton();
}

function drawBuildButton() {
  setSeed(47);
  ctx.fillStyle = 'rgba(255,250,238,0.94)'; ctx.fillRect(buildRect.x, buildRect.y, buildRect.w, buildRect.h);
  jrect(buildRect.x, buildRect.y, buildRect.w, buildRect.h, INK, 1.8);
  ctx.fillStyle = INK; ctx.textAlign = 'center'; ctx.font = 'bold 13px ' + FONT;
  ctx.fillText('养成', buildRect.x + buildRect.w / 2, buildRect.y + buildRect.h / 2 + 5);
}
function drawHUD() {
  setSeed(42);
  const boss = enemies.find(e => e.boss && !e.dead);
  const skillTop = boss && boss.huntBoss ? 88 : (boss ? 70 : 58);
  const equipTop = skillTop + 12 + player.actives.length * 15 + 6;
  // 顶部只保留关卡、经验与击杀；技能下紧跟装备，不再占用底部操作区
  ctx.fillStyle = 'rgba(255,250,238,0.88)';
  ctx.fillRect(7, 4, W - 14, 45);
  const t = Math.floor(gameTime);
  const mm = String(Math.floor(t / 60)).padStart(2, '0'), ss = String(t % 60).padStart(2, '0');
  const wv = ((player.level - 1) % 10) + 1;
  ctx.textAlign = 'center'; ctx.fillStyle = INK; ctx.font = 'bold 20px ' + FONT;
  ctx.fillText(curStage + '-' + wv, W / 2, 22);
  ctx.font = '11px ' + FONT; ctx.fillStyle = '#686868';
  ctx.fillText(mm + ':' + ss, W / 2, 37);
  const top = 8;
  setSeed(45);
  jrect(14, top + 17, 150, 6, PICKUP, 1.5);
  const xr = Math.max(0, Math.min(1, player.xp / player.xpNext));
  if (xr > 0) { setSeed(46); ctx.save(); ctx.beginPath(); ctx.rect(15, top + 18, 148 * xr, 4); ctx.clip(); scribbleFill(15, top + 18, 148 * xr, 4, PICKUP); ctx.restore(); }
  ctx.fillStyle = INK; ctx.textAlign = 'left'; ctx.font = 'bold 12px ' + FONT;
  ctx.fillText('Lv.' + player.level, 16, top + 38);
  ctx.textAlign = 'right'; ctx.font = 'bold 13px ' + FONT;
  ctx.fillText('击杀 ' + kills, W - 16, top + 11);
  if (killChain >= 5) {
    ctx.fillStyle = killChain >= 25 ? RED : INK; ctx.font = '900 14px ' + FONT;
    ctx.fillText(killChain + ' 连擦', W - 16, top + 30);
  }
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
    if (boss.huntBoss && typeof BossHuntRuntime !== 'undefined') BossHuntRuntime.drawHUD(boss, bx, by, bw);
  }
  ctx.save();
  ctx.shadowColor = 'rgba(255,250,238,0.96)'; ctx.shadowBlur = 4;
  ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0;
  ctx.textAlign = 'left'; ctx.font = 'bold 11px ' + FONT;
  player.actives.forEach((a, i) => {
    const supTxt = a.supports.map(sp => SUPPORTS[sp.id].name + '·' + sp.lvl).join('+');
    ctx.fillStyle = INK;
    const nameTxt = SKILL_DEFS[a.id].name + ' Lv' + a.lvl;
    const y = skillTop + 12 + i * 15;
    ctx.fillText(nameTxt, 16, y);
    if (supTxt) { ctx.fillStyle = PURPLE; ctx.fillText('  ' + supTxt, 16 + ctx.measureText(nameTxt).width + 4, y); }
  });
  ctx.font = 'bold 10px ' + FONT;
  SLOTS.forEach((s, i) => {
    const eq = player.equip[s], rarity = eq ? RARITY_LIST[rarityIndex(eq)] : null;
    ctx.fillStyle = rarity ? rarity.color : '#686868';
    const eqTxt = eq ? rarity.name + '·' + ITEM_DEFS[eq.key].name : '—';
    ctx.fillText('[' + SLOT_NAME[s] + ']' + eqTxt, 16, equipTop + 12 + i * 14);
  });
  ctx.restore();
  ctx.textAlign = 'center';
  toasts.forEach((ts, i) => {
    ctx.globalAlpha = Math.min(1, ts.t);
    ctx.fillStyle = DARK; ctx.font = 'bold 13px ' + FONT;
    ctx.fillText(ts.txt, W / 2, H - 278 - i * 20);
    ctx.globalAlpha = 1;
  });
  setSeed(16800);
  const absorbReady = player.absorbCd <= 0;
  ctx.fillStyle = player.absorbT > 0 ? 'rgba(210,225,255,0.96)' : 'rgba(255,250,238,0.94)';
  ctx.fillRect(absorbRect.x, absorbRect.y, absorbRect.w, absorbRect.h);
  jrect(absorbRect.x, absorbRect.y, absorbRect.w, absorbRect.h, absorbReady ? INK : GRAY, player.absorbT > 0 ? 3 : 2.2);
  ctx.fillStyle = absorbReady ? INK : GRAY; ctx.font = 'bold 13px ' + FONT;
  ctx.fillText(player.absorbT > 0 ? '吸墨中' : '吸墨', absorbRect.x + absorbRect.w / 2, absorbRect.y + 23);
  ctx.font = '8px ' + FONT;
  ctx.fillText(absorbReady ? '弹反' : player.absorbCd.toFixed(1) + ' 秒', absorbRect.x + absorbRect.w / 2, absorbRect.y + 40);
  ctx.fillStyle = player.surgeCharging ? 'rgba(190,215,250,0.96)' : (player.special >= 100 ? 'rgba(210,225,255,0.96)' : 'rgba(255,250,238,0.94)');
  ctx.fillRect(specialRect.x, specialRect.y, specialRect.w, specialRect.h);
  jrect(specialRect.x, specialRect.y, specialRect.w, specialRect.h, player.special >= 100 ? INK : GRAY, player.surgeCharging ? 3 : 2.2);
  ctx.fillStyle = player.special >= 100 ? INK : GRAY; ctx.font = 'bold 14px ' + FONT;
  ctx.fillText(player.surgeCharging ? '蓄力中' : '墨潮', specialRect.x + specialRect.w / 2, specialRect.y + 18);
  ctx.font = '9px ' + FONT;
  ctx.fillText(player.surgeCharging ? Math.round(inkSurgeChargeRatio() * 100) + '% · 松开' : (player.special >= 100 ? '长按' : Math.floor(player.special) + '%'), specialRect.x + specialRect.w / 2, specialRect.y + 33);
  const canDive = player.ink > 0 && player.diveCd <= 0;
  ctx.fillStyle = player.diving ? 'rgba(210,225,255,0.96)' : 'rgba(255,250,238,0.94)';
  ctx.fillRect(diveRect.x, diveRect.y, diveRect.w, diveRect.h);
  jrect(diveRect.x, diveRect.y, diveRect.w, diveRect.h, player.diving ? INK : (canDive ? INK : GRAY), 2.2);
  ctx.fillStyle = player.diving || canDive ? INK : GRAY; ctx.font = 'bold 13px ' + FONT;
  ctx.fillText(player.diving ? '潜墨中' : '潜墨', diveRect.x + diveRect.w / 2, diveRect.y + 18);
  ctx.font = '8px ' + FONT;
  ctx.fillText(player.diving ? '无敌 · ' + diveInkCost() + '/秒' : (player.diveCd > 0 ? player.diveCd.toFixed(1) + ' 秒' : '位移'), diveRect.x + diveRect.w / 2, diveRect.y + 33);
  // 固定左下摇杆始终可见，让玩家明确左手移动、右手技能的分区
  const jx = joy.active ? joy.bx : JOY_HOME.x, jy = joy.active ? joy.by : JOY_HOME.y;
  ctx.globalAlpha = joy.active ? 0.48 : 0.24;
  setSeed(99); jcircle(jx, jy, JOY_HOME.r, DARK, 2);
  jcircle(jx + joy.dx * JOY_HOME.r, jy + joy.dy * JOY_HOME.r, 20, INK, 3);
  if (!joy.active) {
    ctx.fillStyle = DARK; ctx.font = 'bold 11px ' + FONT;
    ctx.fillText('移动', jx, jy + 4);
  }
  ctx.globalAlpha = 1;
}

function drawCards(title) {
  ctx.fillStyle = 'rgba(245,241,230,0.2)';
  ctx.fillRect(0, 0, W, H);
  setSeed(777);
  const titleY = cardRects.length ? Math.min(100, cardRects[0].y - 22) : 100;
  ctx.fillStyle = INK; ctx.textAlign = 'center'; ctx.font = 'bold 22px ' + FONT;
  ctx.fillText(title, W / 2, titleY);
  cards.forEach((cd, i) => {
    const r = cardRects[i];
    setSeed(1000 + i);
    ctx.fillStyle = 'rgba(255,250,238,0.7)';
    ctx.fillRect(r.x, r.y, r.w, r.h);
    jrect(r.x, r.y, r.w, r.h, cd.tagColor, 2.5);
    ctx.textAlign = 'left';
    ctx.fillStyle = cd.tagColor; ctx.font = 'bold 12px ' + FONT;
    ctx.fillText(cd.tag, r.x + 16, r.y + 20);
    ctx.fillStyle = INK; ctx.font = 'bold 16px ' + FONT;
    ctx.fillText(cd.name, r.x + 16, r.y + 42);
    ctx.fillStyle = DARK; ctx.font = '12px ' + FONT;
    const lines = cd.descLines || wrapCardDescription(cd.desc, r.w - 32);
    lines.forEach((line, row) => ctx.fillText(line, r.x + 16, r.y + 58 + row * 15));
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

/* ---------- 主循环与自动画质：只降低渲染成本，逻辑始终逐帧更新 ---------- */
let last = 0, qualityBadT = 0, qualityGoodT = 0, renderFrame = 0;
function updateAdaptiveQuality(rawDt) {
  const ms = Math.min(100, rawDt * 1000);
  perfStats.frameMs += (ms - perfStats.frameMs) * 0.08;
  if (state !== 'play') return;
  if (perfStats.frameMs > 24 && enemies.length >= 45) qualityBadT += rawDt;
  else qualityBadT = Math.max(0, qualityBadT - rawDt * 2);
  if (qualityBadT >= 1.2 && renderQuality < 2) {
    setRenderQuality(renderQuality + 1); qualityBadT = 0; qualityGoodT = 0;
  }
  // 怪物仍然很多时不自动升档，避免低画质与卡顿之间反复跳变
  if (perfStats.frameMs < 18 && enemies.length < 35) qualityGoodT += rawDt;
  else qualityGoodT = 0;
  if (qualityGoodT >= 6 && renderQuality > 0) {
    setRenderQuality(renderQuality - 1); qualityGoodT = 0; qualityBadT = 0;
  }
}
function loop(now) {
  requestAnimationFrame(loop);
  const rawDt = (now - last) / 1000 || 0.016;
  const dt = Math.min(0.05, rawDt);
  last = now;
  boilT = Math.floor(now / ([120, 200, 300][renderQuality]));
  if (state === 'play') {
    if (hitStopT > 0) {
      hitStopT = Math.max(0, hitStopT - dt);
      update(dt * ABSORB_RULE.slowScale);
    } else update(dt);
  }
  updateAdaptiveQuality(rawDt); renderFrame++;
  if (!(state === 'play' && renderQuality === 2 && rawDt < 0.024 && renderFrame % 2)) render();
}
globalThis.doodleBridge = window.doodleBridge = { line: jline, circle: jcircle, rect: jrect };
resetGame();
requestAnimationFrame(loop);

/* ============================================================
   怪物数值配置（改这里即可，不需要修改战斗逻辑）
   name  = 图鉴名称
   hp    = 基础生命（实际生命会随时间和关卡成长）
   dmg   = 基础攻击（实际攻击会随时间和关卡成长）
   sp    = 移动速度
   r     = 身体半径 / 碰撞体积
   xp    = 基础经验
   after = 开局多少秒后加入刷怪池
   elite = 是否为精英怪（精英有独立刷出概率和更高装备掉落率）
   ============================================================ */

/* 怪物成长配置
   hpBase        = 所有普通怪/精英怪的基础生命倍率
   hpPerMinute   = 每分钟增加的生命比例，0.38 = +38%
   hpPerStage    = 每个关卡增加的生命比例，0.24 = +24%
   hpPerWave     = 每一波增加的生命比例，0.01 = +1%（默认 0，不影响原难度）
   dmgPerMinute  = 每分钟增加的攻击比例，0.15 = +15%
   dmgPerStage   = 每个关卡增加的攻击比例，0.12 = +12%
   dmgPerWave    = 每一波增加的攻击比例，0.01 = +1%（默认 0，不影响原难度）
   时间、关卡、波数三种成长分别计算后相乘；第 1 波不会获得波数加成。 */
const ENEMY_GROWTH = {
  hpBase: 1.2,
  hpPerMinute: 0.38,
  hpPerStage: 0.24,
  hpPerWave: 0.03,
  dmgPerMinute: 0.15,
  dmgPerStage: 0.12,
  dmgPerWave: 0
};

const ENEMY_DEFS = {
  // 普通小怪
  stick:    { name: '火柴人',     hp: 20,  dmg: 14, sp: 55,  r: 12, xp: 1, after: 0 },
  doodle:   { name: '小人潮',     hp: 12,  dmg: 10, sp: 72,  r: 9,  xp: 0.5, after: 0, swarm: true },
  spider:   { name: '墨线蜘蛛',   hp: 10,  dmg: 9,  sp: 105, r: 9,  xp: 1, after: 35 },
  crumple:  { name: '皱纸团',     hp: 48,  dmg: 16, sp: 44,  r: 14, xp: 2, after: 55 },
  scissors: { name: '剪刀怪',     hp: 24,  dmg: 18, sp: 132, r: 11, xp: 2, after: 75 },
  rage:     { name: '暴躁涂鸦',   hp: 85,  dmg: 22, sp: 32,  r: 16, xp: 3, after: 90 },
  ink:      { name: '浓墨团',     hp: 115, dmg: 20, sp: 26,  r: 18, xp: 4, after: 115 },
  plane:    { name: '失控纸飞机', hp: 14,  dmg: 12, sp: 175, r: 10, xp: 1, after: 140 },
  leech:    { name: '吸墨软泥',   hp: 42,  dmg: 12, sp: 58, r: 13, xp: 3, after: 20 },
  sprayer:  { name: '喷墨涂鸦',   hp: 30,  dmg: 12, sp: 64, r: 12, xp: 3, after: 45 },
  inksac:   { name: '墨囊怪',     hp: 90,  dmg: 14, sp: 38, r: 17, xp: 5, after: 100 },

  // 远程怪：attack=shoot；shotCd 射击间隔，shotWindup 瞄准前摇，keepDist 理想射程
  pencilthrower: { name: '铅笔投手', hp: 38, dmg: 16, sp: 62, r: 12, xp: 3, after: 45,
    attack: 'shoot', shotCd: 2.4, shotWindup: 0.4, bulletSpeed: 220, bulletCount: 1, keepDist: 240 },
  forkpen: { name: '分叉笔头', hp: 68, dmg: 18, sp: 56, r: 14, xp: 4, after: 100,
    attack: 'shoot', shotCd: 3, shotWindup: 0.5, bulletSpeed: 205, bulletCount: 3, spread: 0.22, keepDist: 265 },

  // 精英怪
  elitePencil: { name: '铅笔统领', hp: 260, dmg: 30, sp: 88, r: 20, xp: 8,  after: 100, elite: true },
  inkthief:  { name: '舔墨精英', hp: 330, dmg: 28, sp: 82, r: 19, xp: 9,  after: 120, elite: true },
  eliteCrossbow: { name: '橡皮弩手', hp: 420, dmg: 30, sp: 58, r: 21, xp: 10, after: 160, elite: true,
    attack: 'shoot', shotCd: 3.8, shotWindup: 0.6, bulletSpeed: 245, bulletCount: 1, burst: 3, burstGap: 0.18, keepDist: 280 },
  eliteEraser: { name: '橡皮霸主', hp: 520, dmg: 36, sp: 24, r: 25, xp: 12, after: 170, elite: true },
  eliteEye:    { name: '红笔魔眼', hp: 380, dmg: 42, sp: 52, r: 22, xp: 10, after: 240, elite: true }
};

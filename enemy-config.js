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

  // 精英怪
  elitePencil: { name: '铅笔统领', hp: 260, dmg: 30, sp: 88, r: 20, xp: 8,  after: 100, elite: true },
  eliteEraser: { name: '橡皮霸主', hp: 520, dmg: 36, sp: 24, r: 25, xp: 12, after: 170, elite: true },
  eliteEye:    { name: '红笔魔眼', hp: 380, dmg: 42, sp: 52, r: 22, xp: 10, after: 240, elite: true }
};

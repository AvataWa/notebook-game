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
const ENEMY_DEFS = {
  // 普通小怪
  stick:    { name: '火柴人',     hp: 20,  dmg: 14, sp: 55,  r: 12, xp: 1, after: 0 },
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

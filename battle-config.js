/* ============================================================
   战斗关键参数（日常调平衡只改这里）
   时间单位：秒；距离单位：像素；速度单位：像素/秒
   ============================================================ */
const BATTLE_CONFIG = {
  player: {
    radius: 12,             // 角色碰撞半径
    hp: 100,                // 初始生命
    speed: 168,             // 基础移动速度
    maxInk: 100,            // 墨水上限
    hitInvuln: 0.65         // 每次实际受击后的无敌时间，防止被围时同帧连续扣血
  },

  feedback: {
    squash: 0.22,           // 怪物受击压缩时间
    knockback: 150,         // 普通命中击退速度
    levelupDelay: 0.5       // 经验满后到三选一弹窗的延迟
  },

  melee: {
    period: 1.5,            // 近战怪物挥击周期
    total: 0.55,            // 挥击总时长（含前摇与命中持续）
    active: 0.2,            // 红色命中圈持续时间
    triggerExtra: 32        // 进入攻击范围外多少像素时开始挥击
  },

  spawning: {
    baseNormal: 20,         // 第 1 关普通怪、精英和召唤怪合计上限
    perStage: 10            // 之后每关增加的上限；Boss 额外保留 1 个位置
  },

  ink: {
    ownSpeed: 1.12,         // 普通状态站在己方墨迹上的移速倍率
    hostileSpeed: 0.58,     // 站在敌方墨迹上的移速倍率
    enemyOwnSpeed: 1.12,    // 怪物站在敌方（灰）墨迹上的移速倍率
    enemyFriendlySpeed: 0.82,// 怪物站在己方（彩）墨迹上的移速倍率
    regenBase: 0.35,        // 非潜墨状态基础回墨/秒
    regenOwnBonus: 2.5,     // 非潜墨站己方墨迹额外回墨/秒
    hostileTick: 0.55,      // 灰墨伤害间隔
    hostileDamage: 2,       // 灰墨每次伤害
    trailFreshCharge: 0.003,// 移动／弹道轨迹每个新增格提供的墨潮充能%
    trailCoverCharge: 0.005,// 移动／弹道轨迹每个覆盖灰墨格提供的墨潮充能%
    trailChargePerSecond: 6,// 全部移动／弹道轨迹共享的墨潮充能预算/秒
    captureCellDivisor: 180,// 夺地返墨的覆盖格数除数
    captureSingleCap: 2,    // 单次夺地返墨上限
    captureInkPerSecond: 2  // 全部主动技能夺地共享的返墨预算/秒
  },

  dive: {
    ownCost: 24,            // 己方墨迹潜墨耗墨/秒（原 6）
    otherCost: 36,          // 非己方墨迹潜墨耗墨/秒（原 18）
    speed: 1.55,            // 潜墨移速倍率
    cooldown: 1             // 退出潜墨后的基础冷却/秒
  },

  absorb: {
    duration: 0.35,         // 基础弹反判定时间
    ownDuration: 0.4,       // 己方墨迹上弹反判定时间
    cooldown: 1.2,          // 吸墨冷却
    radius: 65,             // 基础弹反半径
    ownRadius: 100,         // 己方墨迹上弹反半径
    maxGain: 12,            // 单次吸墨最多回复的墨水
    bulletInk: 3,           // 子弹弹反成功回墨
    meleeInk: 8,            // 近战弹反成功回墨
    charge: 20,             // 弹反成功的墨潮充能%
    hitStop: 0.3,           // 弹反成功慢放持续时间
    slowScale: 0.15,        // 慢放期间的战斗时间倍率
    meleeRadius: 120,       // 近战弹反小墨潮半径
    meleeDamage: 27.5       // 近战弹反小墨潮基础伤害
  },

  surge: {
    radius: 168,            // 墨潮基准半径（原 240，整体缩小 30%）
    chargeTime: 1.2,        // 从最小到最大范围的蓄力时间
    minScale: 0.6,          // 点按快速松开：100.8 像素
    maxScale: 1.2,          // 蓄满：201.6 像素
    damage: 55,             // 墨潮基础伤害（蓄力只改变范围）
    visual: 0.35            // 墨潮扩散动画时间
  },

  skills: {
    closeRadius: 125,       // 旋转蜡笔／刀阵／蜡烛头基础半径，覆盖近战攻击圈
    colaRadius: 150,        // 冰可乐新星基础半径
    vortexCap: 6,           // 刀阵基础上限
    vortexPerCast: 2,       // 刀阵每次施放新增碎片数
    vortexDuration: 5,      // 刀阵基础持续时间
    projectileSize: 1.2,    // 全部玩家子弹视觉与命中尺寸倍率，不影响敌弹
    ballistaBulletSpeed: 620// 图钉炮台基础弹速
  },

  // 大节点词条强度；是否拥有词条由 player.taken 决定
  traits: {
    inkArmorReduction: 0.2, // 墨层护膜：站己方墨迹受伤降低比例
    inkDamageMul: 1.2,      // 领地笔意：站己方墨迹伤害倍率
    parryChargeMul: 1.5,    // 回墨共振：弹反充能倍率
    absorbInkMul: 1.5,      // 深吸：弹反回墨倍率
    surgeRetain: 20         // 余潮：释放墨潮后保留的充能%
  }
};

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

  feel: {
    heavyFreeze: 0.045,     // 重击只暂停受击怪物，不冻结整场战斗
    critFreeze: 0.055,      // 暴击局部顿帧时间
    impactTime: 0.18,       // 普通方向化笔尖爆点时长
    deathTime: 0.42,        // 普通怪物纸屑飞散时长
    maxImpacts: 90,         // 命中与核心操作特效同屏上限
    maxDeaths: 50,          // 纸屑死亡事件同屏上限
    maxCameraKicks: 4,      // 镜头冲击最多合成数量
    heavyShake: 1.1,        // 重击附加震动幅度（逻辑像素）
    eliteShake: 1.8,        // 精英死亡震动幅度
    bossShake: 3.5          // Boss 死亡震动幅度
  },

  melee: {
    total: 0.55,            // 挥击总时长（含前摇与命中持续）
    active: 0.2,            // 红色命中圈持续时间
    triggerExtra: 32        // 进入攻击范围外多少像素时开始挥击
  },

  enemyAttack: {
    earlyMin: 2.5,          // 第 1 关随机出招间隔下限
    earlyMax: 3,            // 第 1 关随机出招间隔上限
    lateMin: 1.5,           // 第 10 关随机出招间隔下限
    lateMax: 2,             // 第 10 关随机出招间隔上限
    maxStage: 10
  },

  spawning: {
    baseNormal: 20,         // 第 1 关普通怪、精英和召唤怪合计上限
    perStage: 10            // 之后每关增加的上限；Boss 额外保留 1 个位置
  },

  equipment: {
    pickupRadius: 40,       // 装备自动拾取半径（原 22）
    maxLevel: 10,           // 五个部位各自独立的装备等级上限
    levelBaseStep: 0.1,     // 每级增加基础攻击与基础生命的比例；特殊词条不受影响
    rarityXp: [1, 2, 3, 5], // 普通／稀有／传说／史诗提供的部位经验
    duplicateXp: 1,         // 同名装备额外提供的经验，不再弹出替换窗口
    replaceInputLock: 0.5   // 不同装备替换弹窗出现后的防误触时间（秒）
  },

  ink: {
    ownSpeed: 1.12,         // 普通状态站在己方墨迹上的移速倍率
    hostileSpeed: 0.58,     // 站在敌方墨迹上的移速倍率
    enemyOwnSpeed: 1.12,    // 怪物站在敌方（灰）墨迹上的移速倍率
    enemyFriendlySpeed: 0.82,// 怪物站在己方（彩）墨迹上的移速倍率
    regenBase: 0.35,        // 非潜墨状态基础回墨/秒
    regenOwnBonus: 2.5,     // 非潜墨站己方墨迹额外回墨/秒
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
    successCooldown: 0.5,   // 弹反成功后的吸墨冷却
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

  // 全部三选一主动技能的基础冷却（秒）；实际冷却 = 本表数值 × skillCalc 的 cd 倍率
  activeCooldowns: {
    // 基础文具技能
    cyclone: 0.45,      // 旋转蜡笔
    volcanic: 2.2,      // 火山压痕
    tornado: 0.8,       // 分叉纸飞机
    chainclip: 0.9,     // 链条回形针
    arc: 1.6,           // 电弧荧光笔
    spark: 1.8,         // 慢速墨滴
    ballista: 5,        // 图钉炮台
    boomerang: 2.2,     // 回力橡皮擦
    vortex: 1.5,        // 涂改带刀阵
    candle: 0.25,       // 蜡烛头
    icespear: 1.1,      // 冰锥图钉
    inkrain: 2.8,       // 毒墨雨
    ruler: 2,           // 裂地直尺
    chalk: 2.4,         // 流星粉笔头
    pinburst: 1.3,      // 蜂群大头钉
    absolve: 2,         // 赦免粉笔
    brand: 2.5,         // 橡皮筋烙印
    cola: 1.8,          // 冰可乐新星

    // 哈迪斯机制技能
    weakmark: 4,        // 红笔减分
    doommark: 3,        // 死线红勾

    // 哈迪斯武器启发技能
    pageslash: 3.2,     // 断页斩
    piercerush: 3.5,    // 交叉贯枪
    spinlance: 4,       // 钉页旋枪
    shieldrush: 3,      // 三层盾印
    ricoshield: 3.5,    // 折跃飞盾
    perfectarrow: 2.5,  // 完美一箭
    arrowfocus: 4,      // 群箭批注
    magfist: 3,         // 磁墨升拳
    inkgrenade: 3.5,    // 墨榴弹
    heatrail: 4.5       // 过热扫射
  },

  skills: {
    closeRadius: 125,       // 旋转蜡笔／刀阵／蜡烛头基础半径，覆盖近战攻击圈
    colaRadius: 150,        // 冰可乐新星基础半径
    vortexCap: 6,           // 刀阵基础上限
    vortexPerCast: 2,       // 刀阵每次施放新增碎片数
    vortexDuration: 5,      // 刀阵基础持续时间
    projectileSize: 1.2,    // 全部玩家子弹视觉与命中尺寸倍率，不影响敌弹
    ballistaBulletSpeed: 820// 图钉炮台基础弹速
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

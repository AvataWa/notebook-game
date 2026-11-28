/* 其余 19 套 Boss 专属装备：配置先于 main.js 加载，统一进入装备、存档与图标体系。 */
const BOSS_SET_COLLECTION = (() => {
  'use strict';
  const list = [], byId = {};
  const vals = obj => Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, [v, v, v, v]]));
  function item(set, slot, key, name, atk, hp, values, text, craftOnly) {
    const def = equipmentDef(slot, name, atk, hp, vals(values), v => text.replace(/\{(\w+)\}/g, (_, k) => bossValue(v[k])));
    Object.assign(def, { bossSet: set.id, bossStage: set.stage, craftOnly: true });
    EQUIPMENT_ITEM_DEFS[key] = def;
    if (!EQUIPMENT_ITEM_KEYS.includes(key)) EQUIPMENT_ITEM_KEYS.push(key);
    set.keys[slot] = key;
  }
  function add(id, stage, boss, name, color, special, summary, rows) {
    const set = { id, stage, boss, name, color, special, summary, keys: {} };
    list.push(set); byId[id] = set;
    rows.forEach(row => item(set, ...row));
    set.purple = [];
    set.gold = [set.keys.hands, set.keys.feet, set.keys.head, set.keys.body, set.keys.acc];
    set.all = [...set.gold];
  }
  const S = [
    ['2 件：移动积累乱线充能，满 5 层后下次主动技能生成 140% 贯穿尾刺', '3 件：尾刺附加 3 秒受伤 +15% 标记', '5 件：70% 折射；无其他目标时 Boss 追加 50%'],
    ['2 件：每第 4 次施放主动技能铺设涂改带，2 秒后造成 100% 范围伤害并减速', '3 件：爆裂附加 3 秒受伤 +15%，玩家获得纸甲', '5 件：50% 二次收束；单体 Boss 追加 40%'],
    ['2 件：主动技能命中同一目标叠加审判，满 5 层触发 120% 红叉处刑', '3 件：红叉附加 3 秒受伤 +15% 终审', '5 件：60% 连锁宣判；单体 Boss 追加 40%'],
    ['2 件：每第 5 次施放主动技能召唤 110% 幻想陨星', '3 件：留下 3 秒受伤 +15% 星墨区域', '5 件：两颗 55% 小陨星；单体 Boss 追加 40%'],
    ['2 件：每第 4 次施放主动技能召唤 4 秒纸影，重复该技能 45% 伤害', '3 件：纸影命中附加 3 秒受伤 +15% 标记', '5 件：消失冲锋 60%；单体 Boss 追加 40%'],
    ['2 件：覆盖灰墨积累至多 3 层元素充能；释放墨潮全部消耗，每层引发 45% 墨爆', '3 件：墨爆留下 3 秒受伤 +15% 元素墨域', '5 件：60% 弹射；单体 Boss 追加 40%'],
    ['2 件：每第 4 次施放主动技能发射 3 道 40% 折返纸刃', '3 件：折返纸刃附加 3 秒受伤 +15% 折痕', '5 件：50% 分裂刃；单体 Boss 追加 40%'],
    ['2 件：潜墨擦除灰墨积累摩擦，满 100 后下次主动技能消耗并造成 110% 爆发', '3 件：碎屑附加 3 秒受伤 +15% 擦痕', '5 件：60% 反弹；单体 Boss 追加 40%'],
    ['2 件：接触或覆盖灰墨积累至多 5 层深渊；满层后下次主动技能造成 120% 触手伤害', '3 件：留下减速及受伤 +15% 深渊墨域', '5 件：60% 延伸；单体 Boss 追加 40%'],
    ['2 件：依次施放 4 个不同主动技能写完一页；下次主动技能触发 120% 终页', '3 件：终页附加 3 秒受伤 +15% 作者批注', '5 件：60% 临摹；单体 Boss 追加 40%'],
    ['2 件：潜墨移动积累至多 3 层猎踪；退出潜墨全部消耗，每层造成 40% 扑杀伤害', '3 件：扑杀附加 3 秒受伤 +15% 标记', '5 件：60% 折返；单体 Boss 追加 40%'],
    ['2 件：在己方墨迹上慢移积累至多 3 层墨壳；受击耗 1 层造成 140% 壳震', '3 件：壳震附加 3 秒受伤 +15% 与短暂抗打断', '5 件：65% 内缩；单体 Boss 追加 50%'],
    ['2 件：每第 5 次施放主动技能生成捕笼，闭合造成 100% 伤害并减速', '3 件：附加 3 秒受伤 +15%，小怪僵直、Boss 减速', '5 件：50% 二次收束；单体 Boss 追加 40%'],
    ['2 件：直线移动积攒冲势，满 3 层后下次主动技能造成 150% 贯穿车道；转向清空', '3 件：终点折冲并附加 3 秒受伤 +15%', '5 件：75% 平行副车道；单体 Boss 追加 50%'],
    ['2 件：每第 4 次施放主动技能播种荚果，至多 3 个并形成根网连线', '3 件：根网闭合收缩并附加 3 秒受伤 +15%', '5 件：荚果各造成 50% 爆裂；单体 Boss 追加 40%'],
    ['2 件：记录潜墨轨迹，退出依次回放造成 130% 路径伤害', '3 件：回放附加 3 秒受伤 +15% 标记', '5 件：75% 反向回放；单体 Boss 追加 50%'],
    ['2 件：主动技能命中留下至多 6 枚羽刃，吸墨召回各造成 45% 伤害', '3 件：归羽附加 3 秒受伤 +15% 折光标记', '5 件：50% 散羽；单体 Boss 追加 40%'],
    ['2 件：每第 4 次施放主动技能造成 150% 正交凝视', '3 件：留下 3 秒受伤 +15% 象限网格', '5 件：75% 旋转凝视；单体 Boss 追加 50%'],
    ['2 件：每第 3 次施放主动技能储存截线，下次主动技能收刀，每道造成 45% 伤害', '3 件：收刀附加 3 秒受伤 +15% 标记', '5 件：60% 交叉回放；单体 Boss 追加 40%'],
    ['2 件：每第 3 次施放主动技能轮换爪击、育荚、回迹，各造成 75% 伤害', '3 件：三种终稿命中同目标后附加 3 秒受伤 +15%', '5 件：第三终稿追加 60% 融合伤害；单体 Boss 追加 40%']
  ];
  add('correction', 2, '涂改巨灵', '涂改堡垒', '#527fbd', '巨灵带芯', S[1], [
    ['hands', 'tapegrip', '封带握把', 12, 0, { dmg: 16 }, '对灰墨或减速状态的敌人伤害 +{dmg}%。', false],
    ['feet', 'tapeboots', '压带重靴', 0, 20, { speed: 10, kb: 40 }, '移速 +{speed}%；受到击退距离降低 {kb}%。', false],
    ['head', 'tapehelm', '巨灵带盔', 14, 25, { activeDmg: 20, setDmg: 40 }, '范围主动技能伤害 +{activeDmg}%；涂改带爆裂伤害 +{setDmg}%。', true],
    ['body', 'tapearmor', '换带仓甲', 0, 60, { hurtDr: 15 }, '受击后 3 秒受伤降低 {hurtDr}%；受击生成减速涂改带，每 5 秒最多触发一次。', true],
    ['acc', 'tapecore', '巨灵带芯', 10, 25, { castInk: 6, hitInk: 2 }, '每施放 4 次主动技能回墨 {castInk}；涂改带每困住一敌回墨 {hitInk}，每次最多 8。', true]
  ]);
  add('judge', 3, '红笔判官', '朱笔终审', '#c84b4b', '终审红印', S[2], [
    ['hands', 'judgegloves', '判官指虎', 12, 0, { chargeDmg: 2 }, '主动技能命中同一目标可叠加审判；每层使对该目标的主动技能伤害 +{chargeDmg}%，最多 5 层。', false],
    ['feet', 'judgeboots', '长笔官靴', 0, 20, { speed: 12 }, '移速 +{speed}%；朝审判目标移动时不受其他小怪碰撞减速。', false],
    ['head', 'judgecrown', '朱笔判冠', 14, 25, { activeDmg: 20, setDmg: 40 }, '单体主动技能伤害 +{activeDmg}%；红叉处刑伤害 +{setDmg}%。', true],
    ['body', 'judgerobe', '朱印官袍', 0, 60, { lowHpDr: 20 }, '生命低于 50% 时受伤降低 {lowHpDr}%；受击向攻击者附加 2 层审判，每 3 秒最多触发一次。', true],
    ['acc', 'judgeseal', '终审印章', 10, 25, { castInk: 4, hitInk: 2 }, '施放主动技能后首次命中回墨 {castInk}；红叉每处刑一敌回墨 {hitInk}，每次最多 8。', true]
  ]);
  add('dragon', 4, '空想巨龙', '空想星翼', '#9b72cf', '幻想龙珠', S[3], [
    ['hands', 'dragonclaw', '星墨龙爪', 12, 0, { projDmg: 16 }, '子弹与远程主动技能伤害 +{projDmg}%。', false],
    ['feet', 'dragonboots', '空想翼靴', 0, 20, { speed: 12 }, '移速 +{speed}%。', false],
    ['head', 'dragoncrown', '巨龙星冠', 14, 25, { activeDmg: 20, setDmg: 40 }, '范围主动技能伤害 +{activeDmg}%；幻想陨星伤害 +{setDmg}%。', true],
    ['body', 'dragonhide', '幻翼龙皮', 0, 60, { speed: 20, hurtDr: 15 }, '受击后 3 秒移速 +{speed}%、受伤降低 {hurtDr}%；受击额外积累 2 层陨星进度，每 3 秒最多触发一次。', true],
    ['acc', 'dragonorb', '幻想龙珠', 10, 25, { castInk: 6, hitInk: 2 }, '每施放 4 次主动技能回墨 {castInk}；陨星每命中一敌回墨 {hitInk}，单次最多 8。', true]
  ]);
  add('knights', 5, '涂鸦骑士团长', '涂鸦列队', '#4f7f68', '团长军徽', S[4], [
    ['hands', 'lancegrip', '骑枪握把', 12, 0, { closeDmg: 16 }, '近距离主动技能伤害 +{closeDmg}%。', false],
    ['feet', 'knightboots', '骑士铁靴', 0, 20, { speed: 10, hurtSpeed: 20 }, '移速 +{speed}%；受击后 2 秒额外提高 {hurtSpeed}%。', false],
    ['head', 'knightcrown', '团长盔冠', 14, 25, { activeDmg: 20, setDmg: 40 }, '近战与冲击主动技能伤害 +{activeDmg}%；纸影伤害 +{setDmg}%。', true],
    ['body', 'knightarmor', '列队胸甲', 0, 60, { hurtDr: 15 }, '受击后 3 秒受伤降低 {hurtDr}%；每个纸影可抵挡一次小怪碰撞。', true],
    ['acc', 'knightbadge', '团长军徽', 10, 25, { castInk: 4, endInk: 4 }, '施放主动技能后首次命中回墨 {castInk}；纸影消失回墨 {endInk}。', true]
  ]);
  add('element', 6, '墨水元素', '元素墨域', '#3f8f9f', '元素墨核', S[5], [
    ['hands', 'elementglove', '凝墨指套', 12, 0, { inkDmg: 16 }, '位于己方墨迹上时主动技能伤害 +{inkDmg}%。', false],
    ['feet', 'elementboots', '液行靴', 0, 20, { speed: 12 }, '移速 +{speed}%；在己方墨迹上不受灰墨减速影响。', false],
    ['head', 'elementcrown', '元素液冠', 14, 25, { activeDmg: 20, setDmg: 40 }, '区域与持续主动技能伤害 +{activeDmg}%；元素墨爆伤害 +{setDmg}%。', true],
    ['body', 'elementarmor', '淤积墨甲', 0, 60, { inkDr: 16, shield: 8 }, '位于己方墨迹上受伤降低 {inkDr}%；墨爆后获得 {shield}% 最大生命纸甲。', true],
    ['acc', 'elementcore', '元素墨核', 10, 25, { grayInk: 2, hitInk: 1 }, '每覆盖一片灰墨回墨 {grayInk}，每 1.5 秒最多触发一次；墨爆每命中一敌回墨 {hitInk}，最多 8。', true]
  ]);
  add('origami', 7, '折纸龙王', '千纸龙翼', '#527ac6', '龙王纸心', S[6], [
    ['hands', 'origamiclaw', '折刃护爪', 12, 0, { projDmg: 16 }, '子弹主动技能伤害 +{projDmg}%。', false],
    ['feet', 'origamiboots', '展翼纸靴', 0, 20, { speed: 12 }, '移速 +{speed}%。', false],
    ['head', 'origamicrown', '龙王纸冠', 14, 25, { activeDmg: 20, setDmg: 40 }, '远程与子弹主动技能伤害 +{activeDmg}%；纸刃伤害 +{setDmg}%。', true],
    ['body', 'origamiarmor', '千折龙甲', 0, 60, { hurtDr: 15, shield: 5 }, '受击后 3 秒受伤降低 {hurtDr}%；折返纸刃提供 {shield}% 最大生命纸甲，每次主动技能一次。', true],
    ['acc', 'origamiheart', '龙王纸心', 10, 25, { castInk: 6, hitInk: 1 }, '每施放 4 次主动技能回墨 {castInk}；折返纸刃每命中一敌回墨 {hitInk}，每次主动技能最多 8。', true]
  ]);
  add('eraser', 8, '暴走橡皮', '暴走摩擦', '#cf7f72', '碎屑收集器', S[7], [
    ['hands', 'eraserfist', '碎屑拳套', 12, 0, { diveDmg: 20 }, '潜墨结束后 3 秒内主动技能伤害 +{diveDmg}%。', false],
    ['feet', 'eraserboots', '摩擦跑鞋', 0, 20, { speed: 12, efficiency: 20 }, '移速 +{speed}%；潜墨擦除灰墨效率 +{efficiency}%。', false],
    ['head', 'eraserband', '暴走头带', 14, 25, { diveDmg: 20, setDmg: 40 }, '潜墨结束后 3 秒主动技能伤害再 +{diveDmg}%；碎屑爆发伤害 +{setDmg}%。', true],
    ['body', 'eraserarmor', '橡皮厚甲', 0, 60, { hurtDr: 15, charge: 25 }, '受击后 3 秒受伤降低 {hurtDr}%；受击获得 {charge} 点摩擦（满 100 后下次主动技能触发碎屑爆发），每 3 秒最多触发一次。', true],
    ['acc', 'eraserpack', '碎屑收集器', 10, 25, { grayInk: 2, hitInk: 1 }, '每擦除一片灰墨回墨 {grayInk}，每 1.5 秒最多触发一次；碎屑每命中一敌回墨 {hitInk}，最多 8。', true]
  ]);
  add('abyss', 9, '万墨之渊', '深渊万墨', '#55486f', '渊底墨胆', S[8], [
    ['hands', 'abyssgrip', '触手握笔', 12, 0, { grayDmg: 16 }, '对位于灰墨上的敌人伤害 +{grayDmg}%。', false],
    ['feet', 'abyssboots', '渊行足', 0, 20, { speed: 10, graySlow: 40 }, '移速 +{speed}%；灰墨对玩家的减速效果降低 {graySlow}%。', false],
    ['head', 'abysscrown', '深渊王冠', 14, 25, { activeDmg: 20, setDmg: 40 }, '区域与持续主动技能伤害 +{activeDmg}%；深渊触手伤害 +{setDmg}%。', true],
    ['body', 'abyssarmor', '万墨渊甲', 0, 60, { hurtDr: 15 }, '受击后 3 秒受伤降低 {hurtDr}%；受击获得 2 层深渊（满 5 层后下次主动技能召唤触手），每 3 秒最多触发一次。', true],
    ['acc', 'abyssgall', '渊底墨胆', 10, 25, { castInk: 4, hitInk: 2 }, '施放主动技能后首次命中回墨 {castInk}；触手每命中一敌回墨 {hitInk}，最多 10。', true]
  ]);
  add('author', 10, '笔记本之主', '终页作者', '#8a6847', '作者书签', S[9], [
    ['hands', 'authorpen', '作者握笔', 12, 0, { chargeDmg: 4 }, '依次施放不同主动技能积累书写进度；每个不同技能使后续主动技能伤害 +{chargeDmg}%，最多 4 个；重复同一技能会重新累计。', false],
    ['feet', 'authorshoes', '翻页鞋', 0, 20, { speed: 12 }, '移速 +{speed}%。', false],
    ['head', 'authorcrown', '笔记本王冠', 14, 25, { activeDmg: 20, setDmg: 40 }, '装备 4 个不同主动技能时全部伤害 +{activeDmg}%；终页伤害 +{setDmg}%。', true],
    ['body', 'authorarmor', '封面书甲', 0, 60, { hurtDr: 15, shield: 8 }, '受击后 3 秒受伤降低 {hurtDr}%；依次施放 4 个不同主动技能后获得 {shield}% 最大生命纸甲。', true],
    ['acc', 'authorbookmark', '作者书签', 10, 25, { pageInk: 8, hitInk: 1 }, '每依次施放 4 个不同主动技能回墨 {pageInk}；终页每命中一敌回墨 {hitInk}，最多 8。', true]
  ]);
  add('feral', 11, '荒原六足狸', '荒原猎踪', '#9b7548', '猎踪铃铛', S[10], [
    ['hands', 'feralclaw', '裂纸爪', 12, 0, { backDmg: 20 }, '从目标侧后方命中时主动技能伤害 +{backDmg}%。', false],
    ['feet', 'feralboots', '六足猎靴', 0, 20, { speed: 12, diveSpeed: 10 }, '移速 +{speed}%；潜墨移动速度额外 +{diveSpeed}%。', false],
    ['head', 'feralcrown', '荒原猎冠', 14, 25, { diveDmg: 20, setDmg: 40 }, '潜墨结束后 3 秒主动技能伤害 +{diveDmg}%；荒原扑杀伤害 +{setDmg}%。', true],
    ['body', 'feralhide', '荒原兽皮', 0, 60, { speed: 20, hurtDr: 15 }, '受击后 3 秒移速 +{speed}%、受伤降低 {hurtDr}%；受击获得 2 层猎踪（退出潜墨时每层触发一次扑杀），每 3 秒最多触发一次。', true],
    ['acc', 'feralbell', '猎踪铃铛', 10, 25, { diveInk: 6, hitInk: 2 }, '潜墨结束回墨 {diveInk}；扑杀每命中一敌回墨 {hitInk}，最多 8。', true]
  ]);
  add('turtle', 12, '墨壳山龟', '墨壳山甲', '#5c785a', '壳心墨珠', S[11], [
    ['hands', 'turtlefist', '甲角护拳', 12, 0, { highHpDmg: 25 }, '生命高于 80% 时主动技能伤害 +{highHpDmg}%。', false],
    ['feet', 'turtleboots', '山龟重靴', 0, 20, { speed: 10, kb: 50 }, '移速 +{speed}%；受到击退距离降低 {kb}%。', false],
    ['head', 'turtlecrown', '墨壳山冠', 14, 25, { hp: 18, setDmg: 50 }, '最大生命 +{hp}%；壳震外环伤害 +{setDmg}%。', true],
    ['body', 'turtlearmor', '山龟重甲', 0, 60, { hurtDr: 25, shellDr: 6 }, '受击后 3 秒受伤降低 {hurtDr}%；套装的墨壳每层额外减伤 {shellDr}%（在己方墨迹上慢移积累，受击消耗）。', true],
    ['acc', 'turtleorb', '壳心墨珠', 10, 25, { shellInk: 2, hitInk: 1 }, '套装的每层墨壳每秒回墨 {shellInk}；壳震每命中一敌回墨 {hitInk}，最多 8。', true]
  ]);
  add('flower', 13, '缚根捕笼花', '缚根花笼', '#6f9451', '花蜜墨囊', S[12], [
    ['hands', 'flowerbranch', '藤蔓握枝', 12, 0, { controlDmg: 20 }, '对减速、束缚或僵直目标伤害 +{controlDmg}%。', false],
    ['feet', 'flowerboots', '根行鞋', 0, 20, { speed: 12 }, '移速 +{speed}%；穿过己方根须时不受碰撞减速。', false],
    ['head', 'flowercrown', '捕笼花冠', 14, 25, { activeDmg: 20, setDmg: 40 }, '持续与区域主动技能伤害 +{activeDmg}%；捕笼闭合伤害 +{setDmg}%。', true],
    ['body', 'flowerarmor', '缚根花衣', 0, 60, { hurtDr: 15, shield: 7 }, '受击后 3 秒受伤降低 {hurtDr}%；捕笼形成时获得 {shield}% 最大生命纸甲。', true],
    ['acc', 'flowergall', '花蜜墨囊', 10, 25, { castInk: 6, hitInk: 2 }, '每施放 4 次主动技能回墨 {castInk}；捕笼每困住一敌回墨 {hitInk}，最多 8。', true]
  ]);
  add('rhino', 14, '钉角六足犀', '钉角车阵', '#a06a43', '双轨轴心', S[13], [
    ['hands', 'rhinofist', '钉角拳套', 12, 0, { chargeDmg: 25 }, '车阵套装：直线移动每 100 像素获得 1 层冲势；有冲势时主动技能伤害 +{chargeDmg}%。最多 3 层，明显转向会清空。', false],
    ['feet', 'rhinoboots', '六足车靴', 0, 20, { speed: 14, efficiency: 30 }, '移速 +{speed}%；直线移动时，冲势积累效率 +{efficiency}%。', false],
    ['head', 'rhinocrown', '钉角头盔', 14, 25, { activeDmg: 20, setDmg: 50 }, '冲击类主动技能，以及位移后 3 秒内的主动技能伤害 +{activeDmg}%；钉角车道伤害 +{setDmg}%。', true],
    ['body', 'rhinoarmor', '车阵重甲', 0, 60, { hurtDr: 15 }, '受击后 3 秒受伤降低 {hurtDr}%；受击获得 2 层冲势（满 3 层后下次主动技能释放车道），每 3 秒最多触发一次。', true],
    ['acc', 'rhinoaxis', '双轨轴心', 10, 25, { chargeInk: 6, hitInk: 1 }, '冲势达到 3 层时回墨 {chargeInk}；车道每命中一敌回墨 {hitInk}，单条最多 8。', true]
  ]);
  add('pods', 15, '百荚育母树', '百荚根网', '#798848', '育母树心', S[14], [
    ['hands', 'podbranch', '荚果护枝', 12, 0, { summonDmg: 20 }, '友方召唤物与纸影伤害 +{summonDmg}%。', false],
    ['feet', 'podboots', '根网足', 0, 20, { speed: 12, linkSpeed: 10 }, '移速 +{speed}%；在根网连线上再提高 {linkSpeed}%。', false],
    ['head', 'podcrown', '育母树冠', 14, 25, { activeDmg: 16, setDmg: 40 }, '召唤物存在时主动技能伤害 +{activeDmg}%；根网连线伤害 +{setDmg}%。', true],
    ['body', 'podarmor', '百荚树甲', 0, 60, { hurtDr: 15 }, '受击后 3 秒受伤降低 {hurtDr}%；每个荚果可抵挡一次小怪碰撞。', true],
    ['acc', 'podheart', '育母树心', 10, 25, { podInk: 4, hitInk: 1 }, '荚果生成回墨 {podInk}；根网每命中一敌回墨 {hitInk}，每次收缩最多 8。', true]
  ]);
  add('blind', 16, '盲根泽兽', '盲根回迹', '#477c78', '回声墨囊', S[15], [
    ['hands', 'blindclaw', '盲根触爪', 12, 0, { diveDmg: 25 }, '潜墨结束后 3 秒内主动技能伤害 +{diveDmg}%。', false],
    ['feet', 'blindboots', '泽兽游足', 0, 20, { speed: 12, diveSpeed: 15 }, '移速 +{speed}%；潜墨移动速度额外 +{diveSpeed}%。', false],
    ['head', 'blindcrown', '盲根泽冠', 14, 25, { diveDmg: 25, setDmg: 50 }, '位移后 3 秒主动技能伤害 +{diveDmg}%；轨迹回放伤害 +{setDmg}%。', true],
    ['body', 'blindhide', '泽兽滑皮', 0, 60, { speed: 20, hurtDr: 15, shield: 8 }, '受击后 3 秒移速 +{speed}%、受伤降低 {hurtDr}%；轨迹回放期间获得 {shield}% 最大生命纸甲。', true],
    ['acc', 'blindgall', '回声墨囊', 10, 25, { diveInk: 8, hitInk: 1 }, '潜墨结束回墨 {diveInk}；回放每命中一敌回墨 {hitInk}，最多 8。', true]
  ]);
  add('feather', 17, '折光羽蛇', '折光归羽', '#4b9fc4', '归巢羽心', S[16], [
    ['hands', 'featherpen', '羽刃握笔', 12, 0, { projDmg: 16 }, '子弹与回旋主动技能伤害 +{projDmg}%。', false],
    ['feet', 'featherboots', '羽蛇游靴', 0, 20, { speed: 12 }, '移速 +{speed}%。', false],
    ['head', 'feathercrown', '折光羽冠', 14, 25, { activeDmg: 20, setDmg: 40 }, '远程主动技能伤害 +{activeDmg}%；召回羽刃伤害 +{setDmg}%。', true],
    ['body', 'featherarmor', '光羽鳞甲', 0, 60, { hurtDr: 15, shield: 6 }, '受击后 3 秒受伤降低 {hurtDr}%；每次召回归羽获得 {shield}% 最大生命纸甲。', true],
    ['acc', 'featherheart', '归巢羽心', 10, 25, { castInk: 6, hitInk: 1 }, '每施放 4 次主动技能回墨 {castInk}；归羽每命中一敌回墨 {hitInk}，每次召回最多 8。', true]
  ]);
  add('totem', 18, '百眼图腾兽', '百眼象限', '#8864a8', '旋眼墨珠', S[17], [
    ['hands', 'totempen', '图腾刻笔', 12, 0, { farDmg: 25 }, '对距离超过 180 像素的目标伤害 +{farDmg}%。', false],
    ['feet', 'totemboots', '百眼碑靴', 0, 20, { speed: 10, stillRad: 30 }, '移速 +{speed}%；站立 1 秒后主动技能范围 +{stillRad}%。', false],
    ['head', 'totemcrown', '百眼图腾冠', 14, 25, { activeDmg: 20, setDmg: 50 }, '远程与直线主动技能伤害 +{activeDmg}%；正交凝视伤害 +{setDmg}%。', true],
    ['body', 'totemarmor', '象限碑甲', 0, 60, { stillDr: 25, shield: 8 }, '站立 1 秒后受伤降低 {stillDr}%；凝视释放获得 {shield}% 最大生命纸甲。', true],
    ['acc', 'totemorb', '旋眼墨珠', 10, 25, { stillInk: 3, hitInk: 1 }, '站立 1 秒后每秒回墨 {stillInk}；凝视每命中一敌回墨 {hitInk}，最多 8。', true]
  ]);
  add('mantis', 19, '断线螳王', '断线残月', '#6c8b91', '收刀墨胆', S[18], [
    ['hands', 'mantisclaw', '螳王刃爪', 12, 0, { meleeDmg: 20 }, '近战与斩击主动技能伤害 +{meleeDmg}%。', false],
    ['feet', 'mantisboots', '断线猎靴', 0, 20, { speed: 12 }, '移速 +{speed}%。', false],
    ['head', 'mantiscrown', '螳王残冠', 14, 25, { executeDmg: 20, setDmg: 40 }, '对生命低于 40% 的敌人主动技能伤害 +{executeDmg}%；截线收刀伤害 +{setDmg}%。', true],
    ['body', 'mantisarmor', '六肢刀甲', 0, 60, { hurtDr: 15, shield: 5 }, '受击后 3 秒受伤降低 {hurtDr}%；储存截线获得 {shield}% 最大生命纸甲，每次主动技能一次。', true],
    ['acc', 'mantisgall', '收刀墨胆', 10, 25, { castInk: 4, hitInk: 1 }, '施放主动技能后首次命中回墨 {castInk}；收刀每命中一敌回墨 {hitInk}，最多 8。', true]
  ]);
  add('mother', 20, '终页·混生母体', '混生终稿', '#9c567d', '终页母核', S[19], [
    ['hands', 'motherclaw', '混生肢爪', 12, 0, { chargeDmg: 4 }, '依次施放不同主动技能积累混生进度；每个不同技能使后续主动技能伤害 +{chargeDmg}%，最多 3 个；重复同一技能会重新累计。', false],
    ['feet', 'motherboots', '终页游足', 0, 20, { speed: 12, diveSpeed: 10 }, '移速 +{speed}%；潜墨移动速度额外 +{diveSpeed}%。', false],
    ['head', 'mothercrown', '混生母体冠', 14, 25, { activeDmg: 20, setDmg: 40 }, '装备至少 3 个不同主动技能时全部伤害 +{activeDmg}%；套装的爪击、育荚与回迹伤害 +{setDmg}%。', true],
    ['body', 'motherarmor', '终稿混生甲', 0, 60, { speed: 20, hurtDr: 15, shield: 6 }, '受击后 3 秒移速 +{speed}%、受伤降低 {hurtDr}%；每第 3 次施放主动技能，轮换终稿并获得 {shield}% 最大生命纸甲。', true],
    ['acc', 'mothercore', '终页母核', 10, 25, { cycleInk: 10, hitInk: 1 }, '每轮换完爪击、育荚、回迹三种终稿回墨 {cycleInk}；终稿每命中一敌回墨 {hitInk}，每次最多 8。', true]
  ]);
  // 每双 Boss 鞋都具有条件增速或移速转化；原词条保留，新增词条同样随装备完成度缩放。
  const shoeSpeedMods = {
    tapeboots: [{ setSpeedDmg: 2, setSpeedDmgCap: 20 }, '每 10% 额外移速使涂改带伤害 +{setSpeedDmg}%，最多 +{setSpeedDmgCap}%。'],
    judgeboots: [{ speedDmg: 1.5, speedDmgCap: 15 }, '每 10% 额外移速使主动技能伤害 +{speedDmg}%，最多 +{speedDmgCap}%。'],
    dragonboots: [{ speedDmg: 1.5, speedDmgCap: 15 }, '每 10% 额外移速使主动技能伤害 +{speedDmg}%，最多 +{speedDmgCap}%。'],
    elementboots: [{ ownInkSpeed: 15 }, '位于己方墨迹时额外移速 +{ownInkSpeed}%。'],
    origamiboots: [{ setSpeedDmg: 2, setSpeedDmgCap: 20 }, '每 10% 额外移速使折返纸刃伤害 +{setSpeedDmg}%，最多 +{setSpeedDmgCap}%。'],
    eraserboots: [{ diveSpeed: 15 }, '潜墨移动速度额外 +{diveSpeed}%。'],
    abyssboots: [{ graySpeed: 15 }, '位于灰墨时额外移速 +{graySpeed}%。'],
    authorshoes: [{ speedCd: 1, speedCdCap: 12 }, '每 10% 额外移速使主动释放频率提升 {speedCd}%，最多提升 {speedCdCap}%。'],
    turtleboots: [{ speedDr: 1, speedDrCap: 12 }, '每 10% 额外移速提供 {speedDr}% 减伤，最多 {speedDrCap}%。'],
    flowerboots: [{ setSpeedDmg: 2, setSpeedDmgCap: 20 }, '每 10% 额外移速使捕笼与根须伤害 +{setSpeedDmg}%，最多 +{setSpeedDmgCap}%。'],
    rhinoboots: [{ moveSpeed: 15 }, '持续移动 1 秒后额外移速 +{moveSpeed}%。'],
    featherboots: [{ setSpeedDmg: 2, setSpeedDmgCap: 20 }, '每 10% 额外移速使归羽伤害 +{setSpeedDmg}%，最多 +{setSpeedDmgCap}%。'],
    totemboots: [{ speedDmg: 1.5, speedDmgCap: 15 }, '每 10% 额外移速使主动技能伤害 +{speedDmg}%，最多 +{speedDmgCap}%。'],
    mantisboots: [{ setSpeedDmg: 2, setSpeedDmgCap: 20 }, '每 10% 额外移速使截线收刀伤害 +{setSpeedDmg}%，最多 +{setSpeedDmgCap}%。']
  };
  for (const [key, [values, text]] of Object.entries(shoeSpeedMods)) {
    const def = EQUIPMENT_ITEM_DEFS[key], baseText = def.text;
    Object.assign(def.v, vals(values));
    def.text = v => baseText(v) + text.replace(/\{(\w+)\}/g, (_, k) => bossValue(v[k]));
  }
  const baseHit = { cyclone: 11, volcanic: 26, tornado: 15, chainclip: 13, arc: 22, spark: 12,
    ballista: 12, boomerang: 18, vortex: 10, candle: 7, icespear: 30, inkrain: 8,
    ruler: 22, chalk: 45, pinburst: 12, brand: 9, cola: 20,
    bloodcore: 34, doommark: 24, shieldrush: 28, starfall: 30, pageslash: 22, crosspike: 26,
    dualpin: 10, tripleshield: 18, ricoshield: 20, perfectshot: 34, pinvolley: 9, magnetupper: 28,
    stickymine: 24, strafe: 8 };
  return { list, byId, baseHit, byStage: Object.fromEntries(list.map(s => [s.stage, s])) };
})();

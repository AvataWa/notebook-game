/* 独立造型总览：只定义程序化外观，不接入正式战斗。 */
(function (root, factory) {
  const locomotion = root.ProceduralLocomotion || (typeof require !== 'undefined' ? require('./procedural-locomotion.js') : null);
  const api = factory(locomotion);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.CreatureDesigns = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (PL) {
  'use strict';
  const INK = '#1a2b8f', DARK = '#2b2b2b', RED = '#a85e55', PURPLE = '#75617f';
  const PAPER = '#f5f1e6', HOSTILE = '#70645e', OCHRE = '#9b8257', BLUEGRAY = '#657987';
  const defs = [];
  const add = (id, name, group, legs, shape, r, desc, extra) => {
    defs.push(Object.assign({ id, name, group, legs, shape, r, desc,
      color: DARK, accent: HOSTILE, bodyW: r * 1.15, bodyLen: r * 1.35,
      legLen: r * 0.85, spread: r * 1.35, thick: 1.6, speed: 55, foot: 'dot'
    }, extra || {}));
  };

  add('player', '我 · 穿越而来的画中人', 'player', 2, 'player', 12,
    '弹性双足、圆头无角；潜墨时四肢收成一滴蓝墨。', { color: INK, accent: INK, bodyW: 10, bodyLen: 19, legLen: 10, spread: 9, thick: 2, speed: 72, foot: 'shoe' });
  add('stick', '火柴人', 'normal', 2, 'stick', 12, '长直腿与双角，清楚的大步左右交替。', { bodyW: 10, bodyLen: 22, legLen: 12, spread: 10, speed: 55, horns: true, foot: 'shoe' });
  add('doodle', '小人潮', 'normal', 2, 'doodle', 9, '大头短腿、高频碎步，每只错开动作相位。', { bodyW: 8, bodyLen: 14, legLen: 7, spread: 7, speed: 72, horns: true, thick: 1.4, foot: 'shoe' });
  add('spider', '墨线蜘蛛', 'normal', 8, 'spider', 9, '八条双关节腿，保留前到后的波浪步态。', { bodyW: 10, bodyLen: 15, legLen: 10, spread: 17, speed: 105, thick: 1.5 });
  add('crumple', '皱纸团', 'normal', 4, 'crumple', 14, '四只极短纸爪托着会滚动的大纸团。', { accent: OCHRE, bodyW: 23, bodyLen: 20, legLen: 5, spread: 14, speed: 44, foot: 'claw', thick: 1.8 });
  add('scissors', '剪刀怪', 'normal', 4, 'scissors', 11, '两条支撑后腿与两片刃足，转轴就是身体。', { accent: RED, bodyW: 14, bodyLen: 19, legLen: 11, spread: 16, speed: 132, foot: 'blade', thick: 2 });
  add('rage', '暴躁涂鸦', 'normal', 2, 'rage', 16, '粗腿宽肩，攻击前双腿站宽、身体下压。', { bodyW: 22, bodyLen: 22, legLen: 10, spread: 13, speed: 32, horns: true, thick: 2.8, foot: 'block' });
  add('ink', '浓墨团', 'normal', 6, 'ink', 18, '六条短软墨足，身体比落脚点晚半拍跟上。', { bodyW: 28, bodyLen: 23, legLen: 6, spread: 20, speed: 26, foot: 'suction', thick: 2.4, fill: true });
  add('plane', '失控纸飞机', 'normal', 0, 'plane', 10, '无足悬浮，两片纸翼与中央折线侧倾前进。', { accent: BLUEGRAY, bodyW: 24, bodyLen: 28, speed: 175, thick: 1.8 });
  add('leech', '吸墨软泥', 'normal', 6, 'leech', 13, '六只吸盘足先抓住墨迹，再把身体拖过去。', { accent: PURPLE, bodyW: 21, bodyLen: 16, legLen: 6, spread: 16, speed: 58, foot: 'suction', thick: 1.9 });
  add('sprayer', '喷墨涂鸦', 'normal', 6, 'sprayer', 12, '四足移动、两足稳住背囊，喷射带明显后坐。', { bodyW: 13, bodyLen: 18, legLen: 9, spread: 16, speed: 64, foot: 'claw' });
  add('inksac', '墨囊怪', 'normal', 6, 'inksac', 17, '六条负重短腿，巨大墨袋左右晃动。', { bodyW: 25, bodyLen: 29, legLen: 6, spread: 18, speed: 38, foot: 'block', thick: 2.2 });
  add('pencilthrower', '铅笔投手', 'normal', 2, 'pencilthrower', 12, '铅笔杆身体，射击前站定并后仰投掷。', { accent: OCHRE, bodyW: 10, bodyLen: 24, legLen: 11, spread: 10, speed: 62, horns: true, foot: 'shoe' });
  add('forkpen', '分叉笔头', 'normal', 3, 'forkpen', 14, '三条圆规支架腿，射击前张开成为炮台。', { accent: RED, bodyW: 18, bodyLen: 23, legLen: 12, spread: 19, speed: 56, foot: 'claw', thick: 1.9 });

  add('elitePencil', '铅笔统领', 'elite', 2, 'elitePencil', 20, '装甲长腿与笔帽王冠，慢步后突然大步追击。', { accent: RED, bodyW: 17, bodyLen: 37, legLen: 16, spread: 14, speed: 88, foot: 'block', thick: 2.3 });
  add('inkthief', '舔墨精英', 'elite', 8, 'inkthief', 19, '八只吸盘触手，前两对伸长抓向墨迹。', { accent: PURPLE, bodyW: 30, bodyLen: 22, legLen: 12, spread: 27, speed: 82, foot: 'suction', thick: 2.1 });
  add('eliteCrossbow', '橡皮弩手', 'elite', 4, 'eliteCrossbow', 21, '双主腿加两根射击支架，三连射时压低身体。', { accent: BLUEGRAY, bodyW: 22, bodyLen: 27, legLen: 13, spread: 19, speed: 58, foot: 'block', thick: 2.5 });
  add('eliteEraser', '橡皮霸主', 'elite', 4, 'eliteEraser', 25, '四条粗短腿扛起矩形橡皮，重踏擦出纸屑。', { accent: BLUEGRAY, bodyW: 38, bodyLen: 29, legLen: 7, spread: 23, speed: 24, foot: 'block', thick: 3 });
  add('eliteEye', '红笔魔眼', 'elite', 6, 'eliteEye', 22, '六条踮脚细足，身体转动时瞳孔仍盯住玩家。', { accent: RED, bodyW: 31, bodyLen: 22, legLen: 15, spread: 28, speed: 52, foot: 'claw', thick: 1.8 });

  add('bossScribble', '乱线魔王', 'boss', 7, 'bossScribble', 34, '七条不对称乱线腿，冲刺前突然收拢成束。', { accent: RED, bodyW: 50, bodyLen: 46, legLen: 24, spread: 46, speed: 64, foot: 'claw', thick: 2.4 });
  add('bossTape', '涂改巨灵', 'boss', 6, 'bossTape', 40, '六根粗柱腿，侧面纸带仓负责释放小怪。', { accent: OCHRE, bodyW: 62, bodyLen: 48, legLen: 17, spread: 43, speed: 36, foot: 'block', thick: 4 });
  add('bossJudge', '红笔判官', 'boss', 2, 'bossJudge', 30, '反关节长腿与钢笔尖头颅，交叉步后开始冲刺。', { accent: RED, bodyW: 26, bodyLen: 52, legLen: 27, spread: 20, speed: 90, foot: 'claw', thick: 2.7 });
  add('bossDragon', '空想巨龙', 'boss', 4, 'bossDragon', 45, '四足双翼、长颈长尾，施法时前足离地。', { accent: BLUEGRAY, bodyW: 55, bodyLen: 68, legLen: 25, spread: 48, speed: 40, foot: 'claw', thick: 3, wings: true });
  add('bossKnight', '涂鸦骑士团长', 'boss', 4, 'bossKnight', 38, '半人马四足底盘，上身始终端枪保持平衡。', { accent: RED, bodyW: 48, bodyLen: 53, legLen: 24, spread: 40, speed: 72, foot: 'block', thick: 3.2 });
  add('bossElement', '墨水元素', 'boss', 8, 'bossElement', 46, '八条流动墨足，攻击时汇入中央液滴核心。', { accent: PURPLE, bodyW: 54, bodyLen: 67, legLen: 21, spread: 46, speed: 42, foot: 'suction', thick: 3, fill: true });
  add('bossOrigami', '折纸龙王', 'boss', 4, 'bossOrigami', 48, '折纸利爪与棱角纸翼，关节逐段折叠转身。', { accent: OCHRE, bodyW: 62, bodyLen: 67, legLen: 27, spread: 52, speed: 50, foot: 'blade', thick: 2.8, wings: true });
  add('bossEraser', '暴走橡皮', 'boss', 4, 'bossEraser', 42, '方块粗腿起步缓慢，随后进入高速冲撞。', { accent: BLUEGRAY, bodyW: 64, bodyLen: 46, legLen: 14, spread: 40, speed: 84, foot: 'block', thick: 4 });
  add('bossAbyss', '万墨之渊', 'boss', 10, 'bossAbyss', 54, '十条粗触手围绕深渊口，喷墨前全部向外撑开。', { accent: PURPLE, bodyW: 76, bodyLen: 65, legLen: 18, spread: 58, speed: 36, foot: 'suction', thick: 3.4, fill: true });
  add('bossNotebook', '笔记本之主', 'boss', 12, 'bossNotebook', 62, '十二条文具长腿，背负一本不断翻页的笔记本。', { accent: RED, bodyW: 82, bodyLen: 73, legLen: 30, spread: 67, speed: 46, foot: 'blade', thick: 2.7 });

  function createRigFor(def, body) {
    if (!def.legs) return null;
    const legs = [], pairs = Math.floor(def.legs / 2);
    for (let sideIndex = 0; sideIndex < 2; sideIndex++) {
      const side = sideIndex === 0 ? -1 : 1;
      for (let i = 0; i < pairs; i++) {
        let hipX, hipY, restX, restY;
        if (def.legs === 2) {
          hipX = side * def.bodyW * 0.22; hipY = def.bodyLen * 0.27;
          restX = side * def.spread * 0.45; restY = def.bodyLen * 0.55 + def.legLen * 0.55;
        } else {
          const t = pairs === 1 ? 0.5 : i / (pairs - 1);
          hipY = (t - 0.5) * def.bodyLen * 0.75;
          hipX = side * def.bodyW * 0.42;
          restX = side * def.spread * (0.88 + Math.sin(t * Math.PI) * 0.14);
          restY = hipY * 1.65 + (t - 0.5) * def.legLen * 0.85;
        }
        const upper = def.legLen * 0.52, lower = def.legLen * 0.58;
        legs.push({ hipX, hipY, restX, restY, upper, lower,
          bend: side * (i % 2 === 0 ? 1 : -1), group: sideIndex,
          liftHeight: Math.max(1.2, def.legLen * 0.18), foot: def.foot });
      }
    }
    if (def.legs % 2) {
      legs.push({ hipX: 0, hipY: def.bodyLen * 0.32, restX: 0,
        restY: def.bodyLen * 0.65 + def.legLen * 0.65,
        upper: def.legLen * 0.52, lower: def.legLen * 0.58,
        bend: 1, group: 0, liftHeight: def.legLen * 0.18, foot: def.foot });
    }
    const sequence = [];
    for (let i = 0; i < pairs; i++) sequence.push(i, i + pairs);
    if (def.legs % 2) sequence.push(legs.length - 1);
    return new PL.MultiLegRig(body, { legs, sequence,
      stepDistance: Math.max(2.5, def.legLen * 0.4), stepDuration: 0.12,
      velocityPrediction: 0.1, turnSpeed: 12, forwardOffset: Math.PI / 2 });
  }

  return { DEFS: defs, createRigFor,
    PALETTE: { INK, DARK, RED, PURPLE, PAPER, HOSTILE, OCHRE, BLUEGRAY } };
});

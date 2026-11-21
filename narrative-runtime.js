/* 轻叙事：选角后的黑屏逐行开场与结算短句；记得上一局结果，战斗中不覆盖叙事纸签。 */
(() => {
  'use strict';
  const PROGRESS_KEY = 'notebook-narrative-progress';
  const CHARACTER_LINES = {
    draft: ['无名草稿', '先画一笔。像不像，之后再说。'],
    parry: ['回锋', '别急。等它先撞上这一笔。'],
    dive: ['墨底游', '我去墨里走一趟。出来时，别眨眼。'],
    surge: ['过曝', '墨已经满了。接下来，不许留白。'],
    summon: ['纸偶师', '出来吧。今天不用一直待在页边。'],
    colors: ['四色笔记', '先选颜色？不，我全都要。'],
    single: ['一笔到底', '笔不落，我就不停。'],
    idle: ['挂机者', '你负责走。剩下的，让他们自己看着办。']
  };
  const OPENING = [
    '你只是趴在桌上眯了一会儿。',
    '再睁眼，页边的小人正朝你挥手。',
    '“作者，你终于进来了。”',
    '“别发呆了——留白已经追过来了！”'
  ];
  const RETURNING = [
    '你又睡着了。页边的小人已经替你拿好了笔。',
    '熟悉的天花板没有出现，熟悉的横线倒是有三条。',
    '这一页还记得你。只是上面的怪物也记得。',
    '作者回来了。大家把没画完的部分藏一藏。'
  ];
  const PAGES = [
    ['第一个小人', '你画下的第一个小人，已经在这里等了很多年。'],
    ['格子里的宇宙', '这些方格曾经是整片宇宙，而你曾是舰队司令。'],
    ['出格的勇士', '每个字都要写在格子里，但勇士不必。'],
    ['听不懂的咒语', '当年背不下来的单词，如今全变成了咒语。'],
    ['最后一式', '横、竖、撇、捺。你说这叫书法，它说这是剑谱。'],
    ['没写完的故事', '老师要求八百字，你只给故事写了开头。'],
    ['跑调的军团', '音符没有站在线上，它们决定亲自出征。'],
    ['万点星河', '你当年随手点下的每一点，都以为自己是一颗星。'],
    ['找不到的原点', '所有道路都能计算，只有回家的路没有坐标。'],
    ['没有画完的梦', '这里什么都有，也什么都没有完成。']
  ];
  const EVOLUTIONS = {
    chainclip: { 3: ['电荷回跳', '去过的位置，也可以再回去一次。'], 5: ['首末闭链', '最后一笔，接上了最开始的那一笔。'] },
    ballista: { 3: ['集火穿透', '瞄准同一点，纸也会先撑不住。'], 5: ['余火续射', '炮台没有忘记上一个敌人。'] },
    inkrain: { 3: ['云聚成雨', '两朵雨云，想起了它们属于同一场暴雨。'], 5: ['雨余毒潭', '雨停了，地上的墨迹还不肯干。'] },
    absolve: { 3: ['赦免传递', '被原谅的故事，也可以讲给下一个。'], 5: ['纸蝶折射', '被赦免的，不止一个。'] }
  };
  const BOSS_INTROS = {
    '乱线魔王': '当年你三笔给了我王冠，却没教我怎样做个好人。', '涂改巨灵': '你每改一次，我就多吃掉一个昨天的自己。',
    '红笔判官': '这一页全是错误。包括突然出现的你。', '空想巨龙': '你说我会喷火。于是我真的等了很多年。',
    '涂鸦骑士团长': '拔笔吧，作者。看看谁才是这一页的英雄。', '墨水元素': '是你把我倒在这里，又怪我弄湿了整页？',
    '折纸龙王': '每道折痕都是命令。可我忘了是谁折的。', '暴走橡皮': '他们都怕我，因为只有我知道空白长什么样。',
    '万墨之渊': '所有断掉的线，最后都会流到我这里。', '笔记本之主': '你创造了我，却连最后一笔都不肯留下。'
  };
  const BOSS_OUTROS = {
    '乱线魔王': '原来乱七八糟，也可以有结局。', '涂改巨灵': '这一次，不用再改了。', '红笔判官': '这一笔，不扣分。',
    '空想巨龙': '飞不起来，也不影响我曾是巨龙。', '涂鸦骑士团长': '这一页，终于有真正的勇士了。',
    '墨水元素': '干掉的墨迹，也会留下颜色。', '折纸龙王': '展开以后，我也只是一张纸。',
    '暴走橡皮': '擦不掉，就不必再擦了。', '万墨之渊': '深渊底下，原来还有下一页。',
    '笔记本之主': '原来你不是忘了，只是还没画完。'
  };
  const DEFEATS = [
    '这一页被合上了。但有一笔，留在了下一页。', '你醒了。笔记本上的小人，却少了一个。',
    '笔迹还没有干，故事不算结束。', '留白追上了你。下次记得跑快一点。', '小人倒下了，页边又多了一幅新的涂鸦。'
  ];
  const WINS = [
    '梦又做完了一遍。小人坚持说，这次更精彩。', '结局没有变，你画出的每一笔却不一样。', '笔记本合上了。页缝里漏出一点新的墨水。'
  ];

  const V2 = globalThis.NARRATIVE_COPY_V2;
  if (V2) {
    RETURNING.push(...V2.RETURNING); DEFEATS.push(...V2.DEFEATS); WINS.push(...V2.WINS);
    for (const id of Object.keys(V2.CHARACTER_LINES)) CHARACTER_LINES[id].push(...V2.CHARACTER_LINES[id]);
  }
  const SPECIAL_DEFEATS = V2 ? V2.SPECIAL_DEFEATS : { firstDeath: [], bossStreak: [], recordDeath: [], finalBossLow: [] };
  const BOSS_DEFEATS = V2 ? V2.BOSS_DEFEATS : {};
  const MEMORY = V2 ? V2.MEMORY : { fail: [], bossFail: [], win: [], record: [], sameCharacter: [], newCharacter: [] };

  const S = {
    intro: null, endState: '', endText: '', currentRun: null,
    progress: { openingSeen: false, winSeen: false, totalDeaths: 0, bossDeaths: {}, lastRun: null, recent: {} }
  };
  try {
    const saved = globalThis.localStorage && JSON.parse(localStorage.getItem(PROGRESS_KEY) || 'null');
    if (saved && typeof saved === 'object') {
      S.progress.openingSeen = saved.openingSeen === true;
      S.progress.winSeen = saved.winSeen === true;
      S.progress.totalDeaths = Math.max(0, Math.floor(+saved.totalDeaths || 0));
      S.progress.bossDeaths = saved.bossDeaths && typeof saved.bossDeaths === 'object' ? saved.bossDeaths : {};
      S.progress.lastRun = saved.lastRun && typeof saved.lastRun === 'object' ? saved.lastRun : null;
      S.progress.recent = saved.recent && typeof saved.recent === 'object' ? saved.recent : {};
    }
  } catch (_) { /* 存档不可用时仅本次记录 */ }

  function saveProgress() {
    try { if (globalThis.localStorage) localStorage.setItem(PROGRESS_KEY, JSON.stringify(S.progress)); } catch (_) { /* 隐私模式下本次有效 */ }
  }
  function enabled() { return !globalThis.SettingsRuntime || SettingsRuntime.narrativeEnabled; }
  function pick(list, key = 'generic') {
    if (!list || !list.length) return '';
    const recent = Array.isArray(S.progress.recent[key]) ? S.progress.recent[key] : [];
    const available = list.length > 1 ? list.filter(text => !recent.includes(text)) : list.slice();
    const pool = available.length ? available : list;
    const chosen = pool[Math.floor(Math.random() * pool.length)];
    if (list.length > 1) {
      recent.unshift(chosen);
      S.progress.recent[key] = recent.slice(0, Math.min(4, list.length - 1));
    }
    return chosen;
  }
  function fill(text, last) {
    const boss = last && (last.bossName || (last.bossStage && BOSS_DEFS[last.bossStage - 1] && BOSS_DEFS[last.bossStage - 1].name)) || '';
    return String(text || '').replaceAll('{boss}', boss).replaceAll('{page}', String(last && last.stage || 1));
  }
  function wrapLines(text, width, size = 17) {
    ctx.font = size + 'px ' + FONT;
    const lines = []; let line = '';
    for (const char of String(text)) {
      if (line && ctx.measureText(line + char).width > width) { lines.push(line); line = char; }
      else line += char;
    }
    if (line) lines.push(line);
    return lines;
  }
  function skipRect() { return { x: W - 96, y: 24, w: 72, h: 32 }; }

  function introMemory(characterId) {
    const last = S.progress.lastRun;
    if (!last) return { kind: 'returning', text: pick(RETURNING, 'returning') };
    let kind = 'fail';
    if (last.record) kind = 'record';
    else if (last.characterId !== characterId) kind = 'newCharacter';
    else if (((last.sameStreak || 1) + 1) % 3 === 0) kind = 'sameCharacter';
    else if (!last.win && last.bossName) kind = 'bossFail';
    else if (last.win) kind = 'win';
    return { kind, text: fill(pick(MEMORY[kind], 'memory:' + kind), last) };
  }
  function startIntro() {
    if (!enabled()) return finishIntro();
    const id = CHARACTER_LINES[CharacterRuntime.viewId] ? CharacterRuntime.viewId : 'draft';
    const character = CHARACTER_LINES[id];
    const first = !S.progress.openingSeen;
    const memory = first ? null : introMemory(id);
    const lines = (first ? OPENING.slice() : [memory.text]).map(text => ({ title: '', text }));
    const characterText = first ? character[1] : pick(character.slice(1), 'character:' + id);
    lines.push({ title: character[0], text: characterText });
    S.progress.openingSeen = true; saveProgress();
    S.intro = { lines, index: 0, reveal: 0, wait: 0, context: memory || { kind: 'firstOpening' } };
    S.endState = ''; S.endText = ''; state = 'narrativeIntro';
    return true;
  }
  function finishIntro() {
    S.intro = null;
    const result = baseConfirmSelection();
    const m = globalThis.__metaRuntime;
    if (result && m && m.run && typeof player !== 'undefined') {
      const last = S.progress.lastRun;
      S.currentRun = {
        characterId: player.characterId, mode: m.run.mode, startHighest: m.data.stats.highestStage,
        sameStreak: last && last.characterId === player.characterId ? (last.sameStreak || 1) + 1 : 1,
        death: null, recorded: false
      };
    } else S.currentRun = null;
    return result;
  }
  function advanceIntro() {
    const intro = S.intro;
    if (!intro) return false;
    const line = intro.lines[intro.index];
    if (intro.reveal < line.text.length) {
      intro.reveal = line.text.length; intro.wait = 0; return true;
    }
    if (intro.index >= intro.lines.length - 1) return finishIntro();
    intro.index++; intro.reveal = 0; intro.wait = 0; return true;
  }
  function clear() {
    S.endText = ''; S.endState = '';
    if (S.intro || state === 'narrativeIntro') finishIntro();
  }

  const baseConfirmSelection = CharacterRuntime.confirmSelection;
  CharacterRuntime.confirmSelection = function() {
    CharacterRuntime.selectCharacter(CharacterRuntime.viewId);
    return startIntro();
  };

  const baseResetGame = resetGame;
  resetGame = function() {
    baseResetGame();
    S.intro = null; S.endState = ''; S.endText = ''; S.currentRun = null;
  };
  const baseHurtPlayer = hurtPlayer;
  hurtPlayer = function(dmg, kind, source) {
    const result = baseHurtPlayer(dmg, kind, source);
    if (state === 'over' && S.currentRun && !S.currentRun.death) {
      const boss = source && source.boss;
      S.currentRun.death = {
        bossStage: boss ? source.stage : 0, bossName: boss ? source.name : '',
        bossHpRatio: boss && source.maxhp > 0 ? Math.max(0, Math.min(1, source.hp / source.maxhp)) : 0,
        elite: !!(source && source.elite)
      };
    }
    return result;
  };
  function tickIntro(dt) {
    const intro = S.intro;
    if (state !== 'narrativeIntro' || !intro) return;
    const line = intro.lines[intro.index];
    if (intro.reveal < line.text.length) {
      intro.reveal = Math.min(line.text.length, intro.reveal + dt * 18);
      intro.wait = 0;
    } else {
      intro.wait += dt;
      if (intro.wait >= 1.8) advanceIntro();
    }
  }
  const baseUpdate = update;
  update = function(dt) { baseUpdate(dt); tickIntro(dt); };

  function drawIntro() {
    const intro = S.intro;
    if (!intro) return;
    ctx.save();
    ctx.fillStyle = '#101116'; ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 0.12; setSeed(20261122);
    jline(28, 92, W - 28, 92, '#8d96bd', 1); jline(28, H - 100, W - 28, H - 100, '#8d96bd', 1);
    ctx.globalAlpha = 1;
    ctx.textAlign = 'left'; ctx.fillStyle = '#8d96bd'; ctx.font = '11px ' + FONT;
    ctx.fillText('我穿越到笔记本了', 28, 48);
    const skip = skipRect(); ctx.fillStyle = '#171922'; ctx.fillRect(skip.x, skip.y, skip.w, skip.h);
    jrect(skip.x, skip.y, skip.w, skip.h, '#8d96bd', 1.1);
    ctx.textAlign = 'center'; ctx.fillStyle = '#c8cde0'; ctx.font = '11px ' + FONT;
    ctx.fillText('跳过', skip.x + skip.w / 2, skip.y + 21);

    const display = [];
    for (let i = 0; i <= intro.index; i++) {
      const entry = intro.lines[i], wrapped = wrapLines(entry.text, W - 64);
      if (entry.title) display.push({ text: '—— ' + entry.title + ' ——', title: true });
      let remaining = i === intro.index ? Math.floor(intro.reveal) : entry.text.length;
      for (const line of wrapped) {
        const text = line.slice(0, remaining); remaining -= line.length;
        display.push({ text, title: false });
      }
    }
    let y = H / 2 - display.length * 15;
    for (const line of display) {
      ctx.fillStyle = line.title ? '#9da7d2' : '#f3f0e7';
      ctx.font = (line.title ? '12px ' : '17px ') + FONT;
      ctx.fillText(line.text, W / 2, y, W - 54); y += line.title ? 27 : 31;
    }
    const current = intro.lines[intro.index], complete = intro.reveal >= current.text.length;
    ctx.fillStyle = '#8d96bd'; ctx.font = '11px ' + FONT;
    ctx.fillText(complete ? (intro.index === intro.lines.length - 1 ? '点击进入战斗' : '点击下一句') : '点击显示整句', W / 2, H - 65);
    ctx.fillStyle = '#656c88'; ctx.font = '9px ' + FONT; ctx.fillText('自动播放中', W / 2, H - 43);
    ctx.restore();
  }

  function recordRun(win) {
    const current = S.currentRun;
    if (!current || current.recorded || current.mode !== 'normal') return null;
    current.recorded = true;
    const stage = Math.max(1, curSt()), death = current.death || {};
    const last = {
      win, characterId: current.characterId, stage, record: stage > current.startHighest,
      bossStage: death.bossStage || 0, bossName: death.bossName || '', bossHpRatio: death.bossHpRatio || 0,
      sameStreak: current.sameStreak
    };
    S.progress.lastRun = last;
    if (!win) {
      S.progress.totalDeaths++;
      if (last.bossStage) S.progress.bossDeaths[last.bossStage] = (S.progress.bossDeaths[last.bossStage] || 0) + 1;
    }
    saveProgress();
    return last;
  }
  function settlementText(win) {
    const key = win ? 'win' : 'over';
    if (S.endState !== key) {
      S.endState = key;
      const last = recordRun(win);
      if (!enabled()) S.endText = '';
      else if (win && !S.progress.winSeen) {
        S.endText = '你把最后一笔补上了。\n下次做梦，也带上我们。';
        S.progress.winSeen = true;
      } else if (win) S.endText = pick(WINS, 'wins');
      else if (last && S.progress.totalDeaths === 1) S.endText = pick(SPECIAL_DEFEATS.firstDeath, 'special:firstDeath');
      else if (last && last.bossStage === 10 && last.bossHpRatio > 0 && last.bossHpRatio <= 0.15) S.endText = pick(SPECIAL_DEFEATS.finalBossLow, 'special:finalBossLow');
      else if (last && last.record) S.endText = pick(SPECIAL_DEFEATS.recordDeath, 'special:recordDeath');
      else if (last && last.bossStage && S.progress.bossDeaths[last.bossStage] >= 3) S.endText = fill(pick(SPECIAL_DEFEATS.bossStreak, 'special:bossStreak'), last);
      else if (last && last.bossName && BOSS_DEFEATS[last.bossName]) S.endText = pick(BOSS_DEFEATS[last.bossName], 'bossDeath:' + last.bossStage);
      else S.endText = pick(DEFEATS, 'defeats');
      saveProgress();
    }
    return S.endText;
  }
  function drawSettlement() {
    if (state !== 'win' && state !== 'over') return;
    const text = settlementText(state === 'win');
    if (!text) return;
    ctx.save(); ctx.textAlign = 'center'; ctx.fillStyle = GRAY; ctx.font = '13px ' + FONT;
    text.split('\n').forEach((line, i) => ctx.fillText(line, W / 2, 352 + i * 19, W - 64));
    ctx.restore();
  }
  const baseRender = render;
  render = function() {
    const result = baseRender();
    if (state === 'narrativeIntro') drawIntro();
    else drawSettlement();
    return result;
  };

  canvas.addEventListener('pointerdown', e => {
    if (state !== 'narrativeIntro' || !S.intro) return;
    e.preventDefault(); e.stopImmediatePropagation();
    const p = toLogical(e);
    if (pointInRect(p, skipRect())) finishIntro(); else advanceIntro();
  }, true);
  window.addEventListener('keydown', e => {
    if (state !== 'narrativeIntro' || !S.intro) return;
    if (!['Enter', ' ', 'Escape'].includes(e.key)) return;
    e.preventDefault(); e.stopImmediatePropagation();
    if (e.key === 'Escape') finishIntro(); else advanceIntro();
  }, true);

  globalThis.NarrativeRuntime = {
    state: S, startIntro, advanceIntro, finishIntro, tick: tickIntro, clear, settlementText, skipRect,
    copy: { CHARACTER_LINES, OPENING, RETURNING, PAGES, EVOLUTIONS, BOSS_INTROS, BOSS_OUTROS, DEFEATS, WINS, SPECIAL_DEFEATS, BOSS_DEFEATS, MEMORY },
    get progressStorageKey() { return PROGRESS_KEY; }
  };
})();

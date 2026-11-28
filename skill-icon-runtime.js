/* 动态技能图标：干净蜡笔底图 + 实时等级、辅助数、连接、冷却与充能。 */
(() => {
  'use strict';
  const IDS = ['cyclone', 'brutal', 'swift', 'wide', 'sweep', 'absorb', 'dive', 'surge'];
  const UNIVERSAL_SUPPORT = 'support-universal';
  const images = {};
  const PAPER = '#fffaf0', INK = '#263a59', GREEN = '#4f7f60', RED = '#b34e45';
  const fontFamily = () => typeof FONT !== 'undefined' ? FONT : 'sans-serif';

  for (const id of IDS.concat(UNIVERSAL_SUPPORT)) {
    const image = new Image();
    image.src = 'assets/skill-icons/base/' + id + '.png';
    images[id] = image;
  }
  function ready(id) {
    const image = images[id];
    return !!image && image.complete && image.naturalWidth > 0;
  }
  function cap() { return typeof supportCap === 'function' ? supportCap() : 4; }
  function currentActive(id) { return typeof getActive === 'function' ? getActive(id) : null; }
  function namedLevel(name, fallback) {
    const match = String(name || '').match(/Lv\.?\s*(\d+)/i);
    return match ? +match[1] : fallback;
  }
  function cardMeta(card) {
    if (!card) return null;
    if (card.kind === 'start' || card.kind === 'active' || card.kind === 'active+') {
      const id = card.id || card.skill, active = card.kind === 'active+' ? currentActive(id) : null;
      const level = card.kind === 'active+' ? namedLevel(card.name, active ? active.lvl + 1 : 1) : 1;
      return { id, kind: 'active', level, state: (active ? active.supports.length : 0) + '/' + cap() };
    }
    if (card.kind === 'support' || card.kind === 'support+') {
      const active = currentActive(card.skill), owned = active && active.supports.find(sp => sp.id === card.sup);
      const level = card.kind === 'support+' ? namedLevel(card.name, owned ? owned.lvl + 1 : 1) : 1;
      return { id: card.sup, kind: 'support', level, connected: !card.acquire, state: card.acquire ? '库' : '' };
    }
    return null;
  }
  function itemMeta(item, options = {}) {
    if (!item || !item.value) return null;
    if (item.kind === 'active') {
      return { id: item.value.id, kind: 'active', level: item.value.lvl,
        state: item.value.supports.length + '/' + cap() };
    }
    if (item.kind === 'support') {
      return { id: item.value.id, kind: 'support', level: item.value.lvl,
        connected: options.connected === true, state: options.connected === true ? '' : '库' };
    }
    return null;
  }

  function polygon(points, color) {
    ctx.beginPath(); ctx.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i++) ctx.lineTo(points[i][0], points[i][1]);
    ctx.closePath(); ctx.fillStyle = color; ctx.fill();
  }
  function typeGlyph(kind, cx, cy, size, color = INK) {
    ctx.fillStyle = color; ctx.strokeStyle = color; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    if (kind === 'active') {
      polygon([[cx + size * .1, cy - size * .48], [cx - size * .32, cy + size * .05],
        [cx - size * .03, cy + size * .03], [cx - size * .14, cy + size * .48],
        [cx + size * .35, cy - size * .12], [cx + size * .06, cy - size * .09]], color);
    } else if (kind === 'support') {
      ctx.lineWidth = Math.max(1.5, size * .13);
      for (const dx of [-size * .14, size * .14]) {
        ctx.save(); ctx.translate(cx + dx, cy); ctx.rotate(-.55);
        ctx.beginPath(); ctx.ellipse(0, 0, size * .26, size * .13, 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
      }
    } else {
      polygon([[cx, cy - size * .48], [cx - size * .30, cy + size * .08],
        [cx - size * .27, cy + size * .29], [cx, cy + size * .43],
        [cx + size * .27, cy + size * .29], [cx + size * .30, cy + size * .08]], color);
    }
  }
  function genericMain(id, kind, cx, cy, size) {
    const color = kind === 'active' && typeof attrOf === 'function' ? attrOf(id) : (kind === 'support' ? '#655374' : '#527fbd');
    ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = Math.max(2, size * .055); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const L = (x1, y1, x2, y2) => { ctx.beginPath(); ctx.moveTo(cx + x1 * size, cy + y1 * size); ctx.lineTo(cx + x2 * size, cy + y2 * size); ctx.stroke(); };
    const C = (x, y, r, fill = false) => { ctx.beginPath(); ctx.arc(cx + x * size, cy + y * size, r * size, 0, Math.PI * 2); fill ? ctx.fill() : ctx.stroke(); };
    const P = (points, fill = false) => { ctx.beginPath(); ctx.moveTo(cx + points[0][0] * size, cy + points[0][1] * size); for (let i = 1; i < points.length; i++) ctx.lineTo(cx + points[i][0] * size, cy + points[i][1] * size); ctx.closePath(); fill ? ctx.fill() : ctx.stroke(); };
    const A = (x1, y1, x2, y2) => { L(x1, y1, x2, y2); const a = Math.atan2(y2 - y1, x2 - x1); for (const d of [-2.45, 2.45]) L(x2, y2, x2 + Math.cos(a + d) * .13, y2 + Math.sin(a + d) * .13); };
    const drop = (x = 0, y = 0, scale = 1) => P([[x, y - .34 * scale], [x - .19 * scale, y + .08 * scale], [x - .13 * scale, y + .27 * scale], [x, y + .34 * scale], [x + .13 * scale, y + .27 * scale], [x + .19 * scale, y + .08 * scale]], true);
    const burst = (x, y, r = .3, rays = 8) => { for (let i = 0; i < rays; i++) { const a = i * Math.PI * 2 / rays; L(x + Math.cos(a) * r * .4, y + Math.sin(a) * r * .4, x + Math.cos(a) * r, y + Math.sin(a) * r); } };
    if (kind === 'ink') { drop(); return; }
    if (kind === 'support') {
      switch (id) {
        case 'brutal': for (const y of [-.2, 0, .2]) L(-.28, y + .12, .25, y - .12); break;
        case 'swift': A(-.3, .18, .25, -.2); A(-.18, .3, .32, -.02); break;
        case 'unleash': for (const y of [-.24, 0, .24]) { L(-.23, y + .1, 0, y - .1); L(0, y - .1, .23, y + .1); } break;
        case 'focus': C(0, 0, .27); C(0, 0, .07, true); L(-.4, 0, -.19, 0); L(.19, 0, .4, 0); L(0, -.4, 0, -.19); L(0, .19, 0, .4); break;
        case 'dot': drop(); C(0, .12, .06); break;
        case 'sharpen': P([[-.28, .25], [.2, -.3], [.3, -.18], [-.12, .3]]); L(-.28, .25, -.12, .3); break;
        case 'projspd': for (const y of [-.2, 0, .2]) A(-.34, y, .3, y); break;
        case 'heavynib': P([[0, -.36], [.18, -.05], [.13, .29], [-.13, .29], [-.18, -.05]], true); L(-.22, .32, .22, .32); break;
        case 'longshot': A(-.4, 0, .34, 0); L(-.36, .2, .12, .2); break;
        case 'fatpipe': P([[-.3, -.2], [.22, -.2], [.34, 0], [.22, .2], [-.3, .2]]); L(-.18, -.2, -.18, .2); break;
        case 'multi': for (const a of [-.55, 0, .55]) A(-.25, .25, Math.sin(a) * .35, -Math.cos(a) * .35); break;
        case 'pierce': C(-.12, 0, .17); C(.14, 0, .17); A(-.38, 0, .38, 0); break;
        case 'chain': C(-.25, .1, .07, true); C(0, -.12, .07, true); C(.25, .1, .07, true); L(-.18, .05, -.07, -.07); L(.07, -.07, .18, .05); break;
        case 'homing': C(.16, -.08, .18); C(.16, -.08, .05, true); ctx.beginPath(); ctx.arc(cx - .05 * size, cy + .08 * size, .3 * size, .2, Math.PI * 1.35); ctx.stroke(); A(-.3, .12, -.08, .28); break;
        case 'blast': burst(0, 0, .39, 10); C(0, 0, .1, true); break;
        case 'wide': C(0, 0, .35); C(0, 0, .2); break;
        case 'saturate': C(0, .04, .27, true); for (const x of [-.2, 0, .2]) L(x, -.34, x, -.15); break;
        case 'soak': C(0, .08, .29); A(0, -.38, 0, -.04); break;
        case 'sheath': ctx.beginPath(); ctx.arc(cx, cy, .29 * size, -.5, Math.PI * 1.35); ctx.stroke(); A(.22, -.2, .34, .03); break;
        case 'pressboss': P([[-.3, .18], [-.25, -.2], [-.08, -.02], [0, -.27], [.1, -.02], [.27, -.2], [.3, .18]]); A(0, -.4, 0, .3); break;
        case 'core': C(0, 0, .34); C(0, 0, .19); C(0, 0, .06, true); break;
        case 'retick': ctx.beginPath(); ctx.arc(cx, cy, .29 * size, .3, Math.PI * 1.75); ctx.stroke(); A(-.23, -.2, -.34, .02); for (const a of [0, 2.1, 4.2]) L(Math.cos(a) * .2, Math.sin(a) * .2, Math.cos(a) * .34, Math.sin(a) * .34); break;
        case 'linger': P([[-.24, -.32], [.24, -.32], [-.18, .32], [.18, .32], [-.24, -.32]]); L(-.28, -.34, .28, -.34); L(-.28, .34, .28, .34); break;
        case 'reburst': burst(-.12, -.08, .27, 7); burst(.17, .14, .25, 7); break;
        case 'stain': C(-.08, .02, .23, true); C(.22, -.2, .08, true); C(.22, .23, .06, true); C(-.28, -.25, .05, true); break;
        case 'heavyweight': P([[-.28, -.24], [.23, -.24], [.23, .02], [-.28, .02]], true); L(0, .02, 0, .3); L(-.2, .3, .2, .3); break;
        case 'firstblood': drop(.05, -.03, .85); L(-.35, .27, .3, -.3); break;
        case 'combo': for (let i = 0; i < 3; i++) L(-.25 + i * .2, .28, -.25 + i * .2, .16 - i * .18); A(-.28, .2, .26, -.28); break;
        case 'scrit': P([[0, -.36], [.08, -.09], [.34, 0], [.08, .09], [0, .36], [-.08, .09], [-.34, 0], [-.08, -.09]], true); break;
        case 'counter': A(-.32, -.15, .29, -.15); A(.32, .17, -.29, .17); break;
        case 'rapid': typeGlyph('active', cx - size * .1, cy, size * .65, color); typeGlyph('active', cx + size * .17, cy, size * .48, color); break;
        case 'sweep': ctx.beginPath(); ctx.arc(cx, cy + .1 * size, .34 * size, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke(); A(.25, -.18, .36, .02); break;
        case 'followup': L(-.28, -.22, .02, .2); L(.02, -.3, .32, .12); C(-.18, -.24, .05, true); break;
        case 'leech': C(.1, -.05, .19); A(-.32, .2, .02, .2); L(-.1, -.04, .1, .14); L(-.1, .14, .1, -.04); break;
        case 'shock': L(-.28, 0, .28, 0); for (const x of [-.2, 0, .2]) { L(x, -.08, x - .12, -.3); L(x, .08, x + .12, .3); } break;
        case 'dur': ctx.beginPath(); ctx.ellipse(cx - .14 * size, cy, .19 * size, .13 * size, -.5, 0, Math.PI * 2); ctx.stroke(); ctx.beginPath(); ctx.ellipse(cx + .14 * size, cy, .19 * size, .13 * size, -.5, 0, Math.PI * 2); ctx.stroke(); break;
        case 'onabsorb': A(-.34, -.2, .05, .08); A(.34, -.2, -.05, .08); drop(0, .12, .55); break;
        case 'ondive': drop(0, 0, .8); A(-.3, -.2, .15, .15); break;
        case 'onsurge': for (const r of [.12, .25, .38]) { ctx.beginPath(); ctx.arc(cx, cy + .1 * size, r * size, Math.PI, Math.PI * 2); ctx.stroke(); } break;
        case 'oncrit': burst(0, 0, .34, 4); typeGlyph('active', cx, cy, size * .5, color); break;
        case 'onkill': C(0, -.04, .23); C(-.08, -.08, .04, true); C(.08, -.08, .04, true); L(-.15, .28, .15, .28); L(-.15, .18, .15, .38); break;
        case 'areastorm': C(-.13, -.12, .15); C(.1, -.14, .18); L(-.28, .01, .28, .01); typeGlyph('active', cx, cy + .17 * size, size * .48, color); break;
        case 'areaspikes': for (const x of [-.25, 0, .25]) P([[x - .1, .28], [x, -.3], [x + .1, .28]], true); break;
        case 'areaouter': C(0, 0, .25); for (let i = 0; i < 10; i++) { const a = i * Math.PI / 5; L(Math.cos(a) * .28, Math.sin(a) * .28, Math.cos(a) * .4, Math.sin(a) * .4); } break;
        case 'areagravity': C(0, 0, .09, true); A(-.36, -.25, -.1, -.07); A(.36, -.25, .1, -.07); A(-.36, .25, -.1, .07); A(.36, .25, .1, .07); break;
        case 'areadeath': C(0, -.05, .2); C(-.07, -.09, .04, true); C(.07, -.09, .04, true); drop(-.28, .18, .35); drop(.28, .18, .35); break;
        case 'areastack': for (const y of [-.24, 0, .24]) P([[-.3, y], [0, y - .11], [.3, y], [0, y + .11]]); break;
        case 'cycloneline': L(-.4, 0, .4, 0); for (const x of [-.25, 0, .25]) C(x, .12, .07); burst(0, -.13, .18, 4); break;
        case 'cycloneresidue': L(-.38, -.18, .38, -.18); for (const x of [-.27, 0, .27]) { L(x - .07, .06, x + .02, .22); L(x + .02, .06, x + .1, .18); } break;
        case 'cycloneshards': burst(0, 0, .16, 4); A(-.06, -.03, -.4, -.27); A(.06, .03, .4, .27); P([[-.4, -.27], [-.25, -.26], [-.34, -.14]], true); P([[.4, .27], [.25, .26], [.34, .14]], true); break;
        case 'cyclonedetonate': C(-.12, .08, .18); L(-.38, .27, .02, -.12); typeGlyph('active', cx + .17 * size, cy - .12 * size, size * .45, color); burst(.17, -.12, .3, 4); break;
        case 'projrepeat': for (const y of [-.14, .14]) { C(-.25, y, .07, true); A(-.1, y, .34, y); } break;
        case 'projreturn': A(-.32, -.16, .3, -.16); ctx.beginPath(); ctx.arc(cx, cy + .02 * size, .28 * size, 0, Math.PI); ctx.stroke(); A(-.28, .1, -.32, -.02); break;
        case 'projendsplit': L(-.35, 0, .08, 0); A(.08, 0, .34, -.25); A(.08, 0, .34, .25); break;
        case 'projaccel': ctx.beginPath(); ctx.arc(cx, cy + .13 * size, .32 * size, Math.PI, Math.PI * 2); ctx.stroke(); A(0, .13, .23, -.16); for (const x of [-.24, 0, .24]) L(x, .29, x, .36); break;
        case 'strikecross': L(-.32, -.32, .32, .32); L(.32, -.32, -.32, .32); C(0, 0, .12); break;
        case 'strikeaftershock': C(0, 0, .07, true); C(0, 0, .2); C(0, 0, .36); break;
        case 'strikecrowd': for (const x of [-.25, 0, .25]) C(x, .14, .08); L(-.32, -.22, .32, -.02); break;
        case 'strikeexecute': L(-.32, -.25, .32, -.25); L(-.32, -.08, .05, -.08); A(.1, -.02, .1, .34); L(-.2, .2, .32, .2); break;
        case 'physdmg': L(-.25, .28, .25, -.28); P([[.25, -.28], [.08, -.2], [.2, -.08]], true); L(-.3, .12, -.1, .32); break;
        case 'firedmg': P([[0, -.38], [-.23, .05], [-.14, .3], [0, .18], [.14, .3], [.23, .05]], true); C(0, .08, .07); break;
        case 'icedmg': for (const a of [0, Math.PI / 3, Math.PI * 2 / 3]) L(Math.cos(a) * .36, Math.sin(a) * .36, -Math.cos(a) * .36, -Math.sin(a) * .36); C(0, 0, .06, true); break;
        case 'thunderdmg': typeGlyph('active', cx, cy, size * .8, color); C(0, 0, .36); break;
        case 'physcrit': L(-.3, .25, .12, -.2); burst(.18, -.17, .26, 4); break;
        case 'firecrit': P([[-.1, .3], [-.25, .04], [0, -.35], [.04, .05], [.2, -.08], [.14, .3]], true); burst(.23, -.22, .18, 4); break;
        case 'icecrit': for (const a of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) L(Math.cos(a) * .3, Math.sin(a) * .3, -Math.cos(a) * .3, -Math.sin(a) * .3); burst(0, 0, .4, 4); break;
        case 'thundercrit': typeGlyph('active', cx - .08 * size, cy, size * .65, color); burst(.2, -.12, .24, 4); break;
        case 'physvuln': P([[0, -.34], [-.28, -.2], [-.2, .2], [0, .34], [.2, .2], [.28, -.2]]); L(-.12, -.25, .1, .25); L(.1, -.12, -.08, .02); break;
        case 'physburst': L(-.28, .25, .12, -.15); burst(.12, -.12, .34, 7); break;
        case 'fireburn': for (const x of [-.2, 0, .2]) P([[x, -.3], [x - .12, .1], [x, .28], [x + .12, .1]], true); break;
        case 'firespark': P([[-.12, .3], [-.25, .02], [-.04, -.34], [.12, .02], [.12, .3]], true); for (const x of [.18, .3, .38]) C(x, -.2 + x * .3, .04, true); break;
        case 'fireblast': P([[0, -.25], [-.2, .1], [0, .28], [.2, .1]], true); burst(0, 0, .42, 9); break;
        case 'icefrost': for (const a of [0, Math.PI / 3, Math.PI * 2 / 3]) L(Math.cos(a) * .3, Math.sin(a) * .3, -Math.cos(a) * .3, -Math.sin(a) * .3); for (const x of [-.22, .22]) { L(x - .07, .23, x, .32); L(x, .32, x + .07, .23); } break;
        case 'iceshard': for (const x of [-.24, 0, .24]) P([[x, -.28], [x + .1, .08], [x, .3], [x - .1, .08]], true); break;
        case 'icefield': ctx.strokeRect(cx - .3 * size, cy - .3 * size, .6 * size, .6 * size); for (const x of [-.15, .15]) { L(x, -.3, x, .3); L(-.3, x, .3, x); } break;
        case 'thunderstatic': C(0, 0, .28); C(0, 0, .07, true); typeGlyph('active', cx, cy, size * .55, color); break;
        case 'thunderchain': C(-.27, 0, .07, true); C(.27, 0, .07, true); L(-.2, 0, -.05, -.15); L(-.05, -.15, .06, .15); L(.06, .15, .2, 0); break;
        case 'thundernet': for (const x of [-.25, 0, .25]) { L(x, -.32, x, .32); L(-.32, x, .32, x); } typeGlyph('active', cx, cy, size * .45, color); break;
        case 'inkpool': C(0, .12, .28, true); drop(-.2, -.18, .45); drop(.18, -.25, .35); break;
        default: for (const offset of [-.18, 0, .18]) L(offset - .2, .29, offset + .17, -.28);
      }
      return;
    }
    switch (id) {
      case 'cyclone': P([[-.36, .18], [-.2, -.22], [0, .22], [.2, -.22], [.36, .02]]); P([[-.3, .32], [-.14, -.06], [.06, .32], [.3, -.1]]); L(.23, -.31, .36, -.18); break;
      case 'volcanic': P([[-.38, .28], [-.08, -.3], [.06, -.08], [.17, -.22], [.39, .28]]); L(-.08, -.3, -.02, .28); L(.17, -.22, .12, .28); break;
      case 'tornado': P([[-.38, -.16], [.38, -.34], [.08, .32], [-.02, .05], [-.38, -.16]]); L(-.02, .05, .38, -.34); L(-.24, .28, -.05, .12); break;
      case 'chainclip': ctx.save(); ctx.translate(cx, cy); ctx.rotate(-.45); ctx.beginPath(); ctx.ellipse(-.12 * size, 0, .22 * size, .12 * size, 0, 0, Math.PI * 2); ctx.stroke(); ctx.beginPath(); ctx.ellipse(.12 * size, 0, .22 * size, .12 * size, 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore(); break;
      case 'arc': typeGlyph('active', cx, cy, size * .85, color); L(-.32, .25, -.12, .05); L(.12, -.05, .32, -.25); break;
      case 'spark': drop(-.08, -.03, .8); A(-.34, .25, .28, .25); L(.28, .25, .28, -.05); break;
      case 'ballista': C(0, -.18, .18, true); L(0, 0, 0, .35); L(-.2, .35, .2, .35); L(-.23, -.05, .23, -.05); break;
      case 'boomerang': P([[-.3, -.18], [.05, -.3], [.3, .18], [-.05, .3]], true); ctx.beginPath(); ctx.arc(cx, cy, .39 * size, -.8, Math.PI * 1.1); ctx.stroke(); break;
      case 'vortex': P([[-.36, -.22], [.18, -.22], [.18, -.08], [.31, .02], [.18, .12], [.31, .24], [-.36, .24]]); L(-.27, -.1, .12, -.1); L(-.27, .02, .08, .02); A(.02, .32, .26, -.34); break;
      case 'candle': P([[-.16, -.02], [.16, -.02], [.13, .34], [-.13, .34]], true); P([[0, -.38], [-.13, -.1], [0, -.15], [.13, -.1]], true); break;
      case 'icespear': P([[0, -.4], [.13, .05], [0, .36], [-.13, .05]], true); L(-.28, .18, .28, -.18); break;
      case 'inkrain': C(-.14, -.08, .16); C(.07, -.15, .2); C(.22, -.04, .13); L(-.28, .02, .28, .02); for (const x of [-.2, 0, .2]) { L(x, .12, x - .05, .28); } break;
      case 'ruler': ctx.save(); ctx.translate(cx, cy); ctx.rotate(-.55); ctx.strokeRect(-.12 * size, -.37 * size, .24 * size, .74 * size); for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(-.12 * size, i * .12 * size); ctx.lineTo(.02 * size, i * .12 * size); ctx.stroke(); } ctx.restore(); break;
      case 'chalk': A(-.28, -.32, .1, .12); P([[.02, .03], [.25, .03], [.32, .31], [.08, .31]], true); burst(.18, .3, .2, 6); break;
      case 'pinburst': for (const a of [-.65, -.3, 0, .3, .65]) { const x = Math.sin(a) * .36, y = -Math.cos(a) * .36; L(0, .28, x, y); C(x, y, .045, true); } break;
      case 'brand': ctx.beginPath(); ctx.ellipse(cx, cy, .33 * size, .21 * size, -.35, 0, Math.PI * 2); ctx.stroke(); typeGlyph('active', cx, cy, size * .45, color); break;
      case 'cola': P([[-.15, -.23], [.15, -.23], [.2, .3], [-.2, .3]]); L(-.09, -.34, .09, -.34); L(-.09, -.34, -.09, -.23); for (const a of [0, Math.PI / 3, Math.PI * 2 / 3]) L(Math.cos(a) * .35, Math.sin(a) * .35, -Math.cos(a) * .35, -Math.sin(a) * .35); break;
      case 'doommark': L(-.32, 0, -.08, .25); L(-.08, .25, .36, -.3); L(-.36, -.3, .32, .32); break;
      case 'pageslash': ctx.beginPath(); ctx.arc(cx, cy, .35 * size, -.9, Math.PI * .75); ctx.stroke(); P([[.08, -.35], [.28, -.18], [-.12, .35], [-.3, .18]], true); break;
      case 'piercerush': A(-.36, -.3, .34, .3); A(.36, -.3, -.34, .3); C(0, 0, .08, true); break;
      case 'spinlance': L(0, -.38, 0, .38); P([[0, -.4], [-.12, -.18], [.12, -.18]], true); ctx.beginPath(); ctx.arc(cx, cy, .32 * size, .2, Math.PI * 1.7); ctx.stroke(); break;
      case 'shieldrush': for (const x of [-.22, 0, .22]) P([[x, -.3], [x - .14, -.18], [x - .11, .18], [x, .33], [x + .11, .18], [x + .14, -.18]]); break;
      case 'ricoshield': P([[0, -.3], [-.25, -.16], [-.18, .18], [0, .34], [.18, .18], [.25, -.16]]); A(-.36, .26, .3, -.28); break;
      case 'perfectarrow': A(-.38, 0, .36, 0); L(.12, -.22, .34, 0); L(.12, .22, .34, 0); C(-.13, 0, .13); break;
      case 'arrowfocus': for (const x of [-.22, 0, .22]) A(x, -.32, x * .4, .28); C(0, .24, .09); break;
      case 'magfist': P([[-.25, .22], [-.18, -.12], [-.05, -.12], [-.05, -.32], [.08, -.32], [.08, -.05], [.25, -.05], [.2, .25]], true); A(-.36, .18, -.3, -.24); A(.36, .18, .3, -.24); break;
      case 'inkgrenade': C(0, .08, .25, true); L(.12, -.14, .28, -.32); burst(.3, -.32, .14, 5); break;
      case 'heatrail': for (const y of [-.22, 0, .22]) { L(-.35, y, .12, y); C(.24, y, .07, true); } L(-.25, .34, .28, .34); break;
      default: C(0, 0, .28); burst(0, 0, .42, 5); C(0, 0, .06, true);
    }
  }
  function fallback(id, kind, x, y, size) {
    ctx.fillStyle = PAPER; ctx.fillRect(x, y, size, size);
    ctx.strokeStyle = INK; ctx.lineWidth = Math.max(1.2, size * .035); ctx.strokeRect(x + .5, y + .5, size - 1, size - 1);
    genericMain(id, kind, x + size / 2, y + size / 2, size * .76);
    const unit = size * .27, gap = size * .026;
    typeGlyph(kind, x + size - gap - unit * .45, y + gap + unit * .45, unit);
  }
  function badge(value, x, y, size, color, align, baseline) {
    const text = String(value);
    ctx.font = '900 ' + size + 'px ' + fontFamily(); ctx.textAlign = align; ctx.textBaseline = baseline;
    ctx.lineJoin = 'round'; ctx.lineWidth = Math.max(1.4, size * .16); ctx.strokeStyle = PAPER;
    ctx.strokeText(text, x, y); ctx.fillStyle = color; ctx.fillText(text, x, y);
  }
  function connectedCheck(x, y, size) {
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const path = () => { ctx.beginPath(); ctx.moveTo(x - size * .34, y); ctx.lineTo(x - size * .08, y + size * .27); ctx.lineTo(x + size * .37, y - size * .31); };
    path(); ctx.strokeStyle = PAPER; ctx.lineWidth = Math.max(3, size * .25); ctx.stroke();
    path(); ctx.strokeStyle = GREEN; ctx.lineWidth = Math.max(2, size * .15); ctx.stroke();
  }

  function draw(id, kind, x, y, size, options = {}) {
    if (!id || !kind || !(size > 0)) return false;
    ctx.save();
    if (ready(id)) ctx.drawImage(images[id], x, y, size, size);
    else if (kind === 'support' && ready(UNIVERSAL_SUPPORT) && (typeof SUPPORTS === 'undefined' || !SUPPORTS[id])) ctx.drawImage(images[UNIVERSAL_SUPPORT], x, y, size, size);
    else fallback(id, kind, x, y, size);
    if (options.disabled) { ctx.fillStyle = 'rgba(255,250,238,0.48)'; ctx.fillRect(x, y, size, size); }
    const gap = Math.max(2, size * .026);
    if (options.showLevel !== false && options.level !== undefined && options.level !== null) {
      badge(options.level, x + gap, y + gap - 1, Math.max(11, size * .228), INK, 'left', 'top');
    }
    const stateSize = Math.max(9, size * (String(options.state || '').length > 3 ? .17 : .20));
    if (options.connected) {
      const unit = size * .27;
      connectedCheck(x + size - gap - unit * .35, y + size - gap - unit * .30, unit);
    } else if (options.showState !== false && options.state !== undefined && options.state !== null && options.state !== '') {
      const text = String(options.state), color = /s$|秒|^[0-9]+\.[0-9]+$/.test(text) ? RED : INK;
      badge(text, x + size - gap, y + size - gap + 1, stateSize, color, 'right', 'bottom');
    }
    ctx.restore();
    return true;
  }
  function drawCard(card, x, y, size, options = {}) {
    const meta = cardMeta(card); if (!meta) return false;
    return draw(meta.id, meta.kind, x, y, size, Object.assign({}, meta, options));
  }
  function drawItem(item, x, y, size, options = {}) {
    const meta = itemMeta(item, options); if (!meta) return false;
    return draw(meta.id, meta.kind, x, y, size, Object.assign({}, meta, options));
  }
  window.SkillIconRuntime = { draw, drawCard, drawItem, cardMeta, itemMeta, has: id => IDS.includes(id), ready };
})();

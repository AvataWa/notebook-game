/* 装备图标：两套蜡笔部位底图 + 实时等级、词条数值与套装角标。 */
(() => {
  'use strict';
  const SLOTS_LOCAL = ['head', 'body', 'hands', 'feet', 'acc'];
  const images = {};
  const PAPER = '#fffaf0', INK = '#263a59';
  for (const theme of ['general', 'scribble']) {
    for (const slot of SLOTS_LOCAL) {
      const id = theme + '-' + slot, image = new Image();
      image.src = 'assets/equipment-icons/base/' + id + '.png';
      images[id] = image;
    }
  }
  function definition(key) { return typeof ITEM_DEFS !== 'undefined' ? ITEM_DEFS[key] : null; }
  function imageId(key) {
    const def = definition(key) || {};
    const theme = def.bossSet === 'scribble' ? 'scribble' : 'general';
    const slot = SLOTS_LOCAL.includes(def.slot) ? def.slot : 'acc';
    return theme + '-' + slot;
  }
  function ready(key) {
    const image = images[imageId(key)];
    return !!image && image.complete && image.naturalWidth > 0;
  }
  function normalize(eqOrKey) { return typeof eqOrKey === 'string' ? { key: eqOrKey } : (eqOrKey || {}); }
  function meta(eqOrKey, options = {}) {
    const eq = normalize(eqOrKey), def = definition(eq.key) || {};
    const level = options.level !== undefined ? options.level : (eq.lvl !== undefined ? eq.lvl : (eq.level !== undefined ? eq.level : 1));
    let state = options.state;
    if (state === undefined && options.roll !== undefined) state = options.roll;
    if (state === undefined && def.bossSet && eq.roll !== undefined && eq.roll !== null) state = eq.roll;
    return { id: eq.key, kind: 'equipment', level, state: state === undefined || state === null ? '' : String(state) };
  }
  function badge(value, x, y, size, align, baseline) {
    const text = String(value);
    ctx.font = '900 ' + size + 'px ' + (typeof FONT !== 'undefined' ? FONT : 'sans-serif');
    ctx.textAlign = align; ctx.textBaseline = baseline; ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(1.4, size * .16); ctx.strokeStyle = PAPER;
    ctx.strokeText(text, x, y); ctx.fillStyle = INK; ctx.fillText(text, x, y);
  }
  function fallback(key, x, y, size) {
    ctx.fillStyle = PAPER; ctx.fillRect(x, y, size, size);
    ctx.strokeStyle = INK; ctx.lineWidth = Math.max(1.2, size * .035); ctx.strokeRect(x + .5, y + .5, size - 1, size - 1);
    const def = definition(key) || {}, color = def.bossSet === 'scribble' ? '#8b52b5' : '#527fbd';
    ctx.fillStyle = color; ctx.strokeStyle = INK; ctx.lineWidth = Math.max(1.5, size * .04);
    const cx = x + size / 2, cy = y + size / 2, u = size / 252;
    ctx.beginPath();
    if (def.slot === 'head') {
      ctx.moveTo(cx - 65*u, cy + 45*u); ctx.lineTo(cx - 58*u, cy - 48*u); ctx.lineTo(cx - 24*u, cy - 12*u);
      ctx.lineTo(cx, cy - 62*u); ctx.lineTo(cx + 25*u, cy - 12*u); ctx.lineTo(cx + 58*u, cy - 48*u); ctx.lineTo(cx + 65*u, cy + 45*u); ctx.closePath();
    } else if (def.slot === 'feet') {
      ctx.moveTo(cx - 48*u, cy - 63*u); ctx.lineTo(cx + 5*u, cy - 63*u); ctx.lineTo(cx + 18*u, cy + 10*u);
      ctx.lineTo(cx + 68*u, cy + 37*u); ctx.lineTo(cx + 62*u, cy + 61*u); ctx.lineTo(cx - 58*u, cy + 61*u); ctx.closePath();
    } else if (def.slot === 'acc') {
      ctx.moveTo(cx, cy - 58*u); ctx.lineTo(cx + 48*u, cy - 5*u); ctx.lineTo(cx + 32*u, cy + 55*u);
      ctx.lineTo(cx, cy + 72*u); ctx.lineTo(cx - 32*u, cy + 55*u); ctx.lineTo(cx - 48*u, cy - 5*u); ctx.closePath();
    } else {
      ctx.moveTo(cx - 42*u, cy - 55*u); ctx.lineTo(cx - 15*u, cy - 68*u); ctx.lineTo(cx, cy - 45*u);
      ctx.lineTo(cx + 15*u, cy - 68*u); ctx.lineTo(cx + 42*u, cy - 55*u); ctx.lineTo(cx + 65*u, cy - 25*u);
      ctx.lineTo(cx + 43*u, cy - 5*u); ctx.lineTo(cx + 48*u, cy + 63*u); ctx.lineTo(cx - 48*u, cy + 63*u);
      ctx.lineTo(cx - 43*u, cy - 5*u); ctx.lineTo(cx - 65*u, cy - 25*u); ctx.closePath();
    }
    ctx.fill(); ctx.stroke();
  }
  function baseImage(key, hideType) {
    const id = imageId(key), image = images[id];
    if (!hideType || !ready(key) || typeof document === 'undefined') return image;
    const cache = baseImage.cache || (baseImage.cache = {});
    if (cache[id]) return cache[id];
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 252;
    const brush = canvas.getContext('2d');
    brush.drawImage(image, 0, 0, 252, 252);
    // 原底图烘焙了右上角部位剪影；制作页用纸张色抹除并补回边框。
    brush.fillStyle = PAPER; brush.fillRect(174, 4, 66, 47);
    brush.strokeStyle = INK; brush.lineWidth = 3; brush.beginPath();
    brush.moveTo(174, 4); brush.lineTo(247, 4); brush.lineTo(247, 51); brush.stroke();
    cache[id] = canvas; return canvas;
  }
  function themedImage(key, hideType = false) {
    const def = definition(key) || {}, id = imageId(key), image = baseImage(key, hideType);
    if (!def.bossSet || def.bossSet === 'scribble' || !ready(key)) return image;
    const set = typeof BOSS_SET_COLLECTION !== 'undefined' && BOSS_SET_COLLECTION.byId[def.bossSet];
    if (!set || typeof document === 'undefined') return image;
    const cache = themedImage.cache || (themedImage.cache = {}), cacheKey = def.bossSet + '-' + def.slot + (hideType ? '-clean' : '');
    if (cache[cacheKey]) return cache[cacheKey];
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 252;
    const brush = canvas.getContext('2d');
    brush.drawImage(image, 0, 0, 252, 252);
    brush.globalCompositeOperation = 'multiply'; brush.globalAlpha = .62; brush.fillStyle = set.color; brush.fillRect(0, 0, 252, 252);
    brush.globalCompositeOperation = 'destination-in'; brush.globalAlpha = 1; brush.drawImage(image, 0, 0, 252, 252);
    cache[cacheKey] = canvas; return canvas;
  }
  function setBadge(key, x, y, size) {
    const def = definition(key) || {}; if (!def.bossSet || def.bossSet === 'general') return;
    const set = def.bossSet === 'scribble' ? { stage: 1, color: '#8b52b5' } :
      (typeof BOSS_SET_COLLECTION !== 'undefined' && BOSS_SET_COLLECTION.byId[def.bossSet]); if (!set) return;
    const u = size * .15, cx = x + u * .72, cy = y + size - u * .72, sides = 3 + (set.stage % 5);
    ctx.fillStyle = set.color; ctx.strokeStyle = PAPER; ctx.lineWidth = Math.max(1, size * .025); ctx.beginPath();
    for (let i = 0; i < sides; i++) { const a = -Math.PI / 2 + i * Math.PI * 2 / sides, px = cx + Math.cos(a) * u * .62, py = cy + Math.sin(a) * u * .62; if (!i) ctx.moveTo(px, py); else ctx.lineTo(px, py); }
    ctx.closePath(); ctx.fill(); ctx.stroke();
  }
  function draw(eqOrKey, x, y, size, options = {}) {
    const eq = normalize(eqOrKey); if (!eq.key || !(size > 0)) return false;
    const data = meta(eq, options);
    ctx.save();
    if (ready(eq.key)) ctx.drawImage(themedImage(eq.key, options.showType === false), x, y, size, size);
    else fallback(eq.key, x, y, size);
    setBadge(eq.key, x, y, size);
    if (options.disabled) { ctx.fillStyle = 'rgba(255,250,238,0.48)'; ctx.fillRect(x, y, size, size); }
    const gap = Math.max(2, size * .026);
    if (options.showLevel !== false && data.level !== undefined && data.level !== null) {
      badge(data.level, x + gap, y + gap - 1, Math.max(11, size * .228), 'left', 'top');
    }
    if (options.showState !== false && data.state) {
      badge(data.state, x + size - gap, y + size - gap + 1, Math.max(9, size * .20), 'right', 'bottom');
    }
    ctx.restore();
    return true;
  }
  window.EquipmentIconRuntime = { draw, meta, ready, imageId };
})();

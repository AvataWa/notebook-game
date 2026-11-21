/* 局内技能整理：四格备用库、主动与辅助拖动交换；不改变技能数值。 */
(() => {
  'use strict';
  const RESERVE_SIZE = 4;
  const DRAG_DISTANCE = 6;
  let drag = null, regions = [], buttons = [], lastError = '';

  function ensureReserve(root = player) {
    if (!Array.isArray(root.reserve)) root.reserve = [];
    while (root.reserve.length < RESERVE_SIZE) root.reserve.push(null);
    if (root.reserve.length > RESERVE_SIZE) root.reserve.length = RESERVE_SIZE;
    return root.reserve;
  }
  function sameRef(a, b) {
    return !!a && !!b && a.type === b.type && a.index === b.index && a.activeIndex === b.activeIndex && a.supportIndex === b.supportIndex;
  }
  function validRef(ref) {
    return !!ref && ((ref.type === 'active' && Number.isInteger(ref.index) && ref.index >= 0 && ref.index < activeCap())
      || (ref.type === 'support' && Number.isInteger(ref.activeIndex) && ref.activeIndex >= 0 && ref.activeIndex < activeCap()
        && Number.isInteger(ref.supportIndex) && ref.supportIndex >= 0 && ref.supportIndex < supportCap())
      || (ref.type === 'reserve' && Number.isInteger(ref.index) && ref.index >= 0 && ref.index < RESERVE_SIZE));
  }
  function readSlot(ref, root = player) {
    if (!validRef(ref)) return null;
    if (ref.type === 'active') {
      const value = root.actives[ref.index];
      return value ? { kind: 'active', value } : null;
    }
    if (ref.type === 'support') {
      const active = root.actives[ref.activeIndex], value = active && active.supports[ref.supportIndex];
      return value ? { kind: 'support', value } : null;
    }
    ensureReserve(root);
    return root.reserve[ref.index] || null;
  }
  function writeSlot(ref, item, root = player) {
    if (ref.type === 'active') root.actives[ref.index] = item ? item.value : null;
    else if (ref.type === 'support') {
      const active = root.actives[ref.activeIndex];
      if (active) active.supports[ref.supportIndex] = item ? item.value : null;
    } else root.reserve[ref.index] = item || null;
  }
  function compact(root) {
    for (const active of root.actives) if (active) {
      const supports = active.supports.filter(Boolean);
      active.supports.splice(0, active.supports.length, ...supports);
    }
    const actives = root.actives.filter(Boolean);
    root.actives.splice(0, root.actives.length, ...actives);
  }
  function accept(ref, item, root) {
    if (!item || !validRef(ref) || readSlot(ref, root)) { lastError = '目标槽位不可用'; return false; }
    if (ref.type === 'reserve') return true;
    if (ref.type === 'active') {
      if (item.kind !== 'active') { lastError = '主动位只能放入主动技能'; return false; }
      if (root.actives.filter(Boolean).length >= activeCap()) { lastError = '主动栏已满'; return false; }
      return true;
    }
    if (item.kind !== 'support') { lastError = '辅助位只能放入辅助技能'; return false; }
    const active = root.actives[ref.activeIndex];
    if (!active) { lastError = '这里还没有主动技能'; return false; }
    if (active.supports.filter(Boolean).length >= supportCap()) { lastError = '辅助栏已满'; return false; }
    if (!supportUsable(item.value.id, active.id)) { lastError = '该辅助不适配目标主动'; return false; }
    if (active.supports.some(sp => sp && sp.id === item.value.id)) { lastError = '目标主动已有同名辅助'; return false; }
    return true;
  }
  function canAccept(ref, item, otherRef = null, root = player) {
    const copy = {
      characterId: root.characterId,
      actives: root.actives.map(a => Object.assign({}, a, { supports: a.supports.slice() })),
      reserve: ensureReserve(root).map(slot => slot ? { kind: slot.kind, value: slot.value } : null)
    };
    if (otherRef && validRef(otherRef)) writeSlot(otherRef, null, copy);
    writeSlot(ref, null, copy);
    return accept(ref, item, copy);
  }
  function transfer(source, target, root = player) {
    lastError = '';
    ensureReserve(root);
    if (!validRef(source) || !validRef(target)) { lastError = '请拖到一个技能槽'; return false; }
    if (sameRef(source, target)) return true;
    const sourceItem = readSlot(source, root);
    if (!sourceItem) { lastError = '这里没有可移动的技能'; return false; }
    const targetItem = readSlot(target, root);
    const oldActives = root.actives.slice();
    const oldSupports = oldActives.map(a => a.supports.slice());
    const oldReserve = root.reserve.slice();
    const rollback = () => {
      root.actives.splice(0, root.actives.length, ...oldActives);
      oldActives.forEach((a, i) => a.supports.splice(0, a.supports.length, ...oldSupports[i]));
      root.reserve.splice(0, root.reserve.length, ...oldReserve);
    };
    writeSlot(source, null, root); writeSlot(target, null, root);
    if (!accept(target, sourceItem, root) || (targetItem && !accept(source, targetItem, root))) {
      rollback(); return false;
    }
    writeSlot(target, sourceItem, root);
    if (targetItem) writeSlot(source, targetItem, root);
    compact(root);
    return true;
  }
  function canMove(source, target, root = player) {
    const copy = {
      characterId: root.characterId,
      actives: root.actives.map(a => Object.assign({}, a, { supports: a.supports.map(sp => Object.assign({}, sp)) })),
      reserve: ensureReserve(root).map(slot => slot ? { kind: slot.kind, value: Object.assign({}, slot.value, slot.kind === 'active' ? { supports: slot.value.supports.map(sp => Object.assign({}, sp)) } : {}) } : null)
    };
    return transfer(source, target, copy);
  }
  function move(source, target, root = player) {
    const result = transfer(source, target, root);
    if (!result && typeof toast === 'function') toast(lastError);
    return result;
  }

  const meta = () => window.__metaRuntime;
  if (meta()) {
    const baseBeginRun = meta().beginRun;
    meta().beginRun = function(...args) { const result = baseBeginRun(...args); ensureReserve().fill(null); drag = null; return result; };
    const baseBeginBossTest = meta().beginBossTest;
    meta().beginBossTest = function(...args) { const result = baseBeginBossTest(...args); ensureReserve().fill(null); drag = null; return result; };
  }

  function txt(value, x, y, size = 12, color = DARK, align = 'left', bold = false, maxWidth) {
    ctx.fillStyle = color; ctx.textAlign = align; ctx.font = (bold ? 'bold ' : '') + size + 'px ' + FONT;
    ctx.fillText(String(value), x, y, maxWidth);
  }
  function button(rect, label, action, enabled = true, active = false) {
    ctx.fillStyle = active ? 'rgba(205,222,248,0.98)' : 'rgba(255,250,238,0.96)'; ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    jrect(rect.x, rect.y, rect.w, rect.h, enabled ? INK : GRAY, active ? 2.4 : 1.6);
    txt(label, rect.x + rect.w / 2, rect.y + rect.h / 2 + 4, 12, enabled ? INK : GRAY, 'center', true);
    buttons.push({ rect, action, enabled });
  }
  function slotColor(item) { return item ? (item.kind === 'active' ? attrOf(item.value.id) : PURPLE) : GRAY; }
  function slotName(item) {
    if (!item) return '';
    return (item.kind === 'active' ? SKILL_DEFS[item.value.id].name : SUPPORTS[item.value.id].name) + ' Lv.' + item.value.lvl;
  }
  function resolveDropTarget(source, target, root = player) {
    if (!source || !target) return target;
    const item = readSlot(source, root);
    if (!item) return target;
    // 主动落到另一张卡的辅助芯片上时，仍按整张主动卡处理，避免类型误判。
    if (item.kind === 'active' && target.type === 'support') return { type: 'active', index: target.activeIndex };
    // 辅助落到主动卡的标题或空白处时，自动放入第一个空辅助槽。
    if (item.kind === 'support' && target.type === 'active') {
      const active = root.actives[target.index];
      if (active && active.supports.length < supportCap()) return { type: 'support', activeIndex: target.index, supportIndex: active.supports.length };
    }
    return target;
  }
  function drawSlot(ref, rect, item, compactChip = false, showLabel = true) {
    const source = drag && drag.source;
    const resolved = source ? resolveDropTarget(source, ref) : ref;
    const isSource = source && sameRef(source, ref);
    const valid = !!source && !isSource && sameRef(resolved, ref) && canMove(source, ref);
    const hovered = drag && drag.moved && pointInRect(drag.current, rect);
    const pulse = 0.5 + 0.5 * Math.sin(Date.now() * 0.007);
    let fill = item ? 'rgba(255,250,238,0.96)' : 'rgba(235,232,222,0.55)';
    let border = slotColor(item), width = item ? 1.4 : 1, labelColor = slotColor(item);
    if (source && valid) {
      fill = `rgba(190,220,250,${0.42 + pulse * 0.42})`;
      border = INK; width = (hovered ? 2.8 : 1.5) + pulse * 1.2;
    } else if (source && !isSource) {
      fill = 'rgba(235,232,222,0.5)'; border = GRAY; width = 1; labelColor = GRAY;
    }
    ctx.fillStyle = fill; ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    jrect(rect.x, rect.y, rect.w, rect.h, border, width);
    if (item && showLabel) {
      const label = slotName(item), tag = (item.kind === 'active' ? '主动 · ' + skillTagText(item.value.id) : '辅助 · ' + supportTagText(item.value.id));
      txt(label, rect.x + rect.w / 2, rect.y + (compactChip ? 10 : 19), compactChip ? 9 : 11, labelColor, 'center', true, rect.w - 6);
      ctx.font = (compactChip ? 8 : 9) + 'px ' + FONT;
      const chipWidth = Math.min(rect.w - 8, ctx.measureText(tag).width + 6);
      drawTagChip(tag, rect.x + (rect.w - chipWidth) / 2, rect.y + (compactChip ? 12 : 31), slotColor(item), compactChip ? 8 : 9, rect.w - 8);
    } else if (!item && !compactChip) txt(ref.type === 'reserve' ? '空备用格' : '空主动位', rect.x + rect.w / 2, rect.y + rect.h / 2 + 4, 11, GRAY, 'center');
    regions.push({ ref, rect });
  }
  function drawReserve(desktop) {
    ensureReserve();
    const x = desktop ? 70 : 24, y = desktop ? 211 : 158, total = desktop ? 836 : 327, gap = desktop ? 12 : 8;
    const w = (total - gap * 3) / 4, h = desktop ? 58 : 60;
    txt('备用库 · 仅本局', x, y - 10, 11, GRAY);
    for (let i = 0; i < RESERVE_SIZE; i++) drawSlot({ type: 'reserve', index: i }, { x: x + i * (w + gap), y, w, h }, player.reserve[i]);
  }
  function drawActive(active, index, rect, desktop) {
    const item = active ? { kind: 'active', value: active } : null;
    drawSlot({ type: 'active', index }, rect, item, false, false);
    if (!active) return;
    // 主动标题单独绘制，槽位本体仍负责整卡拖动与详情。
    txt(SKILL_DEFS[active.id].name + '  Lv.' + active.lvl, rect.x + 12, rect.y + 21, desktop ? 16 : 14, attrOf(active.id), 'left', true, rect.w - 90);
    drawTagChip('主动 · ' + skillTagText(active.id), rect.x + 12, rect.y + 26, attrOf(active.id), desktop ? 10 : 8, rect.w - 90);
    txt('辅 ' + active.supports.length + '/' + supportCap(), rect.x + rect.w - 12, rect.y + 20, 10, PURPLE, 'right');
    if (desktop) txt(window.UICopy ? UICopy.skillShort(active.id) : SKILL_DEFS[active.id].desc, rect.x + 12, rect.y + 58, 11, GRAY, 'left', false, rect.w - 24);
    const cap = supportCap(), columns = desktop && cap === 8 ? 8 : 4, gap = 5, pad = 10;
    const chipW = (rect.w - pad * 2 - gap * (columns - 1)) / columns;
    const chipY = rect.y + (desktop ? 78 : 45), chipH = desktop ? 33 : 31;
    for (let i = 0; i < cap; i++) {
      // 普通角色只留一个可放置空格，避免无意义的空槽占满界面。
      if (i > active.supports.length) break;
      const row = Math.floor(i / columns), col = i % columns;
      const r = { x: rect.x + pad + col * (chipW + gap), y: chipY + row * (chipH + 6), w: chipW, h: chipH };
      const sp = active.supports[i];
      drawSlot({ type: 'support', activeIndex: index, supportIndex: i }, r, sp ? { kind: 'support', value: sp } : null, true);
      if (!sp) txt('+', r.x + r.w / 2, r.y + 18, 13, GRAY, 'center');
    }
  }
  function drawMobile() {
    ctx.fillStyle = 'rgba(35,31,28,0.8)'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(245,241,230,0.98)'; ctx.fillRect(12, 28, W - 24, 610); jrect(12, 28, W - 24, 610, INK, 2.4);
    txt('角色养成', 27, 61, 21, INK, 'left', true);
    const character = window.CharacterRuntime && CHARACTER_CONFIG.defs.find(c => c.id === player.characterId);
    if (character) txt(character.name + ' Lv.' + player.characterLevel + ' · ' + character.title, 27, 82, 10, character.color, 'left', true);
    button({ x: 117, y: 590, w: 140, h: 32 }, '返回', () => window.__buildView.close());
    [['skills', '技能'], ['affixes', '词条'], ['equipment', '装备']].forEach(([id, name], i) => button({ x: 24 + i * 111, y: 100, w: 105, h: 36 }, name, () => window.__buildView.setTab(id), true, id === 'skills'));
    drawReserve(false);
    const cap = activeCap(), single = cap === 1;
    for (let i = 0; i < cap; i++) {
      const h = single ? 154 : 80, y = single ? 238 : 234 + i * 86;
      drawActive(player.actives[i] || null, i, { x: 24, y, w: 327, h }, false);
    }
    if (single && player.characterLevel >= 3) button({ x: 117, y: 548, w: 140, h: 32 }, CharacterRuntime.state.reforgeUsed ? '本局已重铸' : '免费重铸辅助', () => CharacterRuntime.reforgeSupport(), CharacterRuntime.canReforge());
    txt(drag ? '发光槽位可放置 · 松开完成交换' : '拖动交换 · 轻点详情 · 备用库不跨局保留', W / 2, 630, 10, GRAY, 'center');
  }
  function drawDesktop() {
    ctx.fillStyle = 'rgba(32,30,29,0.76)'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = PAPER; ctx.fillRect(40, 42, W - 80, H - 84); jrect(40, 42, W - 80, H - 84, INK, 2.4);
    txt('角色养成', 70, 88, 25, INK, 'left', true); txt('拖动交换 · 轻点查看详情', 270, 86, 13, GRAY);
    button({ x: W - 230, y: 624, w: 160, h: 38 }, '返回 Esc', () => window.__buildView.close());
    [['skills', '技能'], ['affixes', '词条'], ['equipment', '装备']].forEach(([id, name], i) => button({ x: 70 + i * 150, y: 112, w: 134, h: 40 }, name, () => window.__buildView.setTab(id), true, id === 'skills'));
    const character = window.CharacterRuntime && CHARACTER_CONFIG.defs.find(c => c.id === player.characterId);
    if (character) { txt(character.name + ' Lv.' + player.characterLevel + ' · ' + character.title, 70, 174, 14, character.color, 'left', true); txt(character.short, 400, 174, 12, GRAY); }
    drawReserve(true);
    const cap = activeCap();
    for (let i = 0; i < cap; i++) {
      const rect = cap === 1 ? { x: 70, y: 292, w: 1130, h: 132 } : { x: 70 + (i % 2) * 580, y: 292 + Math.floor(i / 2) * 146, w: 550, h: 132 };
      drawActive(player.actives[i] || null, i, rect, true);
    }
    if (cap === 1 && player.characterLevel >= 3) button({ x: W - 270, y: 202, w: 200, h: 40 }, CharacterRuntime.state.reforgeUsed ? '本局已重铸' : '免费重铸一次辅助', () => CharacterRuntime.reforgeSupport(), CharacterRuntime.canReforge());
    txt(drag ? '发光槽位可放置 · 松开完成交换' : '主动连同辅助一起移动 · 备用库可混合存放主动与辅助 · 每局清空', 70, 624, 12, GRAY);
  }
  function drawDrag() {
    if (!drag || !drag.moved) return;
    const item = readSlot(drag.source); if (!item) return;
    const r = { x: drag.current.x - 70, y: drag.current.y - 38, w: 140, h: 30 };
    ctx.save(); ctx.globalAlpha = 0.9; ctx.fillStyle = PAPER; ctx.fillRect(r.x, r.y, r.w, r.h); jrect(r.x, r.y, r.w, r.h, slotColor(item), 1.8);
    txt(slotName(item), drag.current.x, r.y + 20, 11, slotColor(item), 'center', true, 132); ctx.restore();
  }

  const baseRender = render;
  render = function() {
    baseRender();
    // 详情由前一层绘制；技能页不能再次覆盖它，否则会出现“看不见详情且无法拖动”。
    if (window.UIDetail && UIDetail.isOpen) return;
    if (state !== 'build' || !window.__buildView || __buildView.tab !== 'skills') return;
    regions = []; buttons = []; ensureReserve();
    if (window.DesktopRuntime && DesktopRuntime.active) drawDesktop(); else drawMobile();
    drawDrag();
  };
  function slotAt(p) { for (let i = regions.length - 1; i >= 0; i--) if (pointInRect(p, regions[i].rect)) return regions[i].ref; return null; }
  function openDetails(ref) {
    const item = readSlot(ref); if (!item || !window.UIDetail) return;
    if (item.kind === 'active') UICopy.skillDetail(item.value);
    else UIDetail.open({ title: SUPPORTS[item.value.id].name + ' Lv.' + item.value.lvl, subtitle: '拖动可更换镶嵌', tag: '辅助 · ' + supportTagText(item.value.id), body: supDesc(item.value.id, item.value.lvl), color: PURPLE });
  }
  function ownPointer(e) { e.preventDefault(); e.stopImmediatePropagation(); }
  function eventCoord(e) {
    const touch = e.touches && e.touches[0] || e.changedTouches && e.changedTouches[0];
    return touch || e;
  }
  function logicalPoint(e) {
    const q = eventCoord(e), r = canvas.getBoundingClientRect();
    return { x: (q.clientX - r.left) / (r.width / W), y: (q.clientY - r.top) / (r.height / H), inside: q.clientX >= r.left && q.clientX <= r.right && q.clientY >= r.top && q.clientY <= r.bottom };
  }
  function startDrag(e, id) {
    if (drag || (window.UIDetail && UIDetail.isOpen)) return;
    if (state !== 'build' || !window.__buildView || __buildView.tab !== 'skills') return;
    const p = logicalPoint(e); if (!p.inside) return;
    ownPointer(e);
    for (let i = buttons.length - 1; i >= 0; i--) if (buttons[i].enabled && pointInRect(p, buttons[i].rect)) { buttons[i].action(); return; }
    const source = slotAt(p); if (!source || !readSlot(source)) return;
    drag = { source, start: p, current: p, pointerId: id, moved: false };
    if (typeof id === 'number' && canvas.setPointerCapture) try { canvas.setPointerCapture(id); } catch (_) {}
  }
  function moveDrag(e, id) {
    if (!drag || drag.pointerId !== id) return;
    ownPointer(e); drag.current = logicalPoint(e);
    if (Math.hypot(drag.current.x - drag.start.x, drag.current.y - drag.start.y) >= DRAG_DISTANCE) drag.moved = true;
  }
  function releaseDragPointer(id) {
    if (typeof id === 'number' && canvas.releasePointerCapture) try { canvas.releasePointerCapture(id); } catch (_) {}
  }
  function endDrag(e, id) {
    if (!drag || drag.pointerId !== id) return;
    const current = drag; drag = null;
    try {
      ownPointer(e); current.current = logicalPoint(e);
      if (current.moved) {
        const target = resolveDropTarget(current.source, slotAt(current.current));
        if (target) move(current.source, target); else toast('请拖到一个技能槽');
      } else openDetails(current.source);
    } finally {
      // 即使交换或详情打开异常，也不能把后续输入锁在一次拖动里。
      releaseDragPointer(id);
    }
  }
  function cancelDrag(e, id) {
    if (!drag || drag.pointerId !== id) return;
    ownPointer(e); drag = null; releaseDragPointer(id);
  }
  // 现代手机同时产生 Pointer、Touch 和兼容 Mouse 事件，只能由一套输入接管，否则拖动后会被误判为轻点。
  if (typeof window.PointerEvent === 'function') {
    window.addEventListener('pointerdown', e => startDrag(e, e.pointerId), { capture: true, passive: false });
    window.addEventListener('pointermove', e => moveDrag(e, e.pointerId), { capture: true, passive: false });
    window.addEventListener('pointerup', e => endDrag(e, e.pointerId), { capture: true, passive: false });
    window.addEventListener('pointercancel', e => cancelDrag(e, e.pointerId), { capture: true, passive: false });
    window.addEventListener('lostpointercapture', e => { if (drag && drag.pointerId === e.pointerId) drag = null; }, true);
  } else {
    // 老旧浏览器兜底；触摸后的兼容鼠标事件不再重复处理。
    let lastTouchAt = -1000;
    window.addEventListener('mousedown', e => { if (e.button === 0 && Date.now() - lastTouchAt > 900) startDrag(e, 'mouse'); }, true);
    window.addEventListener('mousemove', e => moveDrag(e, drag && drag.pointerId), true);
    window.addEventListener('mouseup', e => endDrag(e, drag && drag.pointerId), true);
    window.addEventListener('touchstart', e => { lastTouchAt = Date.now(); startDrag(e, 'touch'); }, { capture: true, passive: false });
    window.addEventListener('touchmove', e => { lastTouchAt = Date.now(); moveDrag(e, drag && drag.pointerId); }, { capture: true, passive: false });
    window.addEventListener('touchend', e => { lastTouchAt = Date.now(); endDrag(e, drag && drag.pointerId); }, { capture: true, passive: false });
    window.addEventListener('touchcancel', e => { lastTouchAt = Date.now(); cancelDrag(e, 'touch'); }, { capture: true, passive: false });
  }
  window.addEventListener('keydown', e => {
    if (window.UIDetail && UIDetail.isOpen) return;
    if (state !== 'build' || !window.__buildView || __buildView.tab !== 'skills' || e.key !== 'Escape') return;
    e.preventDefault(); e.stopImmediatePropagation();
    if (drag) drag = null; else window.__buildView.close();
  }, true);
  window.addEventListener('blur', () => { drag = null; });

  window.LoadoutRuntime = {
    RESERVE_SIZE, ensureReserve, readSlot, canAccept, canMove, move, resolveDropTarget,
    get lastError() { return lastError; }, get dragging() { return !!drag; },
    get regions() { return regions.map(r => ({ ref: Object.assign({}, r.ref), rect: Object.assign({}, r.rect) })); },
    cancel() { drag = null; }
  };
})();

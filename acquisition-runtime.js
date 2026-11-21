/* 满栏新技能：备用库自动入库；库满时可取消、二次确认替换。 */
(() => {
  'use strict';
  let pending = null, hits = [];

  function sameRef(a, b) {
    return !!a && !!b && a.type === b.type && a.index === b.index
      && a.activeIndex === b.activeIndex && a.supportIndex === b.supportIndex;
  }
  function makeItem(card) {
    if (card.kind === 'active') return { kind: 'active', value: { id: card.id, lvl: 1, supports: [], t: 0.3, uc: 0 } };
    return { kind: 'support', value: { id: card.sup, lvl: 1 } };
  }
  function itemName(item) {
    return item.kind === 'active' ? SKILL_DEFS[item.value.id].name : SUPPORTS[item.value.id].name;
  }
  function newName(card) { return card.kind === 'active' ? SKILL_DEFS[card.id].name : SUPPORTS[card.sup].name; }
  function newDescription(card) { return card.kind === 'active' ? SKILL_DEFS[card.id].desc : supDesc(card.sup, 1); }
  function finish(message) {
    cards = []; pending = null; hits = []; state = 'play';
    player.goldT = Math.max(player.goldT, 1);
    toast(message);
    return true;
  }
  function acquire(card) {
    const reserve = LoadoutRuntime.ensureReserve();
    const empty = reserve.findIndex(slot => !slot);
    if (empty >= 0) {
      reserve[empty] = makeItem(card);
      return finish(newName(card) + ' Lv.1 已放入备用库 ' + (empty + 1));
    }
    pending = { card, originalCards: cards, returnState: state, selected: null, page: 0 };
    state = 'acquireReplace';
    return true;
  }
  function cancel() {
    if (!pending || state !== 'acquireReplace') return false;
    const original = pending.originalCards, returnState = pending.returnState || 'levelup';
    pending = null; hits = []; cards = original; state = returnState;
    levelupPickAfter = 0;
    layoutCards(cards.length);
    return true;
  }
  function targets() {
    if (!pending) return [];
    const card = pending.card, result = [];
    if (card.kind === 'active') {
      player.actives.forEach((active, index) => {
        if (!active) return;
        result.push({ ref: { type: 'active', index }, item: { kind: 'active', value: active },
          label: '场上主动 ' + (index + 1), activeLoss: active.supports.length });
      });
      LoadoutRuntime.ensureReserve().forEach((slot, index) => {
        if (slot && slot.kind === 'active') result.push({ ref: { type: 'reserve', index }, item: slot,
          label: '备用格 ' + (index + 1), activeLoss: slot.value.supports.length });
      });
      return result;
    }
    player.actives.forEach((active, activeIndex) => {
      if (!active) return;
      active.supports.forEach((support, supportIndex) => {
        if (!support || !supportUsable(card.sup, active.id)) return;
        if (active.supports.some((sp, i) => i !== supportIndex && sp && sp.id === card.sup)) return;
        result.push({ ref: { type: 'support', activeIndex, supportIndex }, item: { kind: 'support', value: support },
          label: SKILL_DEFS[active.id].name + ' · 辅助 ' + (supportIndex + 1), activeLoss: 0 });
      });
    });
    const compatible = player.actives.some(active => active && supportUsable(card.sup, active.id));
    if (compatible) LoadoutRuntime.ensureReserve().forEach((slot, index) => {
      if (slot && slot.kind === 'support') result.push({ ref: { type: 'reserve', index }, item: slot,
        label: '备用格 ' + (index + 1), activeLoss: 0 });
    });
    return result;
  }
  function selectTarget(ref) {
    if (!pending || state !== 'acquireReplace') return false;
    const target = targets().find(entry => sameRef(entry.ref, ref));
    if (!target) return false;
    pending.selected = target.ref;
    return true;
  }
  function selectVisible(index) {
    if (!pending) return false;
    const perPage = desktop() ? 12 : 6, list = targets();
    const target = list[pending.page * perPage + index];
    return target ? selectTarget(target.ref) : false;
  }
  function confirm() {
    if (!pending || state !== 'acquireReplace' || !pending.selected) return false;
    const target = targets().find(entry => sameRef(entry.ref, pending.selected));
    if (!target) { pending.selected = null; return false; }
    const item = makeItem(pending.card), ref = target.ref;
    if (ref.type === 'active') player.actives[ref.index] = item.value;
    else if (ref.type === 'support') player.actives[ref.activeIndex].supports[ref.supportIndex] = item.value;
    else LoadoutRuntime.ensureReserve()[ref.index] = item;
    return finish(itemName(item) + ' Lv.1 已替换 ' + itemName(target.item));
  }

  const baseApplyOption = applyOption;
  applyOption = function(i) {
    const chosen = cards[i];
    if (state === 'levelup' && chosen && chosen.acquire) {
      if (Date.now() < levelupPickAfter) return false;
      return acquire(chosen);
    }
    return baseApplyOption(i);
  };

  function clearPending() { pending = null; hits = []; }
  const meta = () => window.__metaRuntime;
  if (meta()) {
    const baseBeginRun = meta().beginRun;
    meta().beginRun = function(...args) { const result = baseBeginRun(...args); clearPending(); return result; };
    const baseBeginBossTest = meta().beginBossTest;
    meta().beginBossTest = function(...args) { const result = baseBeginBossTest(...args); clearPending(); return result; };
  }

  function desktop() { return !!(window.DesktopRuntime && DesktopRuntime.active); }
  function text(value, x, y, size = 12, color = DARK, align = 'left', bold = false, maxWidth) {
    ctx.fillStyle = color; ctx.textAlign = align; ctx.font = (bold ? 'bold ' : '') + size + 'px ' + FONT;
    ctx.fillText(String(value), x, y, maxWidth);
  }
  function wrapped(value, x, y, width, lineHeight, maxLines = 2) {
    const lines = []; let line = '';
    for (const ch of String(value || '')) {
      if (line && ctx.measureText(line + ch).width > width) { lines.push(line); line = ch; }
      else line += ch;
    }
    if (line || !lines.length) lines.push(line);
    lines.slice(0, maxLines).forEach((entry, i) => text(entry, x, y + i * lineHeight, 11, DARK));
  }
  function button(rect, label, action, enabled = true, active = false, color = INK) {
    ctx.fillStyle = active ? 'rgba(205,222,248,0.98)' : 'rgba(255,250,238,0.96)'; ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    jrect(rect.x, rect.y, rect.w, rect.h, enabled ? color : GRAY, active ? 2.6 : 1.6);
    text(label, rect.x + rect.w / 2, rect.y + rect.h / 2 + 4, 12, enabled ? color : GRAY, 'center', true);
    hits.push({ rect, action, enabled });
  }
  function drawReplacement() {
    if (!pending) return;
    const wide = desktop(), margin = wide ? 40 : 12, top = wide ? 42 : 28;
    const panelW = W - margin * 2, panelH = H - top * 2, innerX = margin + 20, innerW = panelW - 40;
    hits = [];
    ctx.fillStyle = 'rgba(32,30,29,0.8)'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = PAPER; ctx.fillRect(margin, top, panelW, panelH); jrect(margin, top, panelW, panelH, INK, 2.4);
    text('备用库已满 · 选择替换', innerX, top + (wide ? 45 : 34), wide ? 25 : 20, INK, 'left', true);
    text('新技能始终为 Lv.1，不继承旧技能等级', innerX, top + (wide ? 70 : 56), wide ? 13 : 10, GRAY);
    const newRect = { x: innerX, y: top + (wide ? 86 : 72), w: innerW, h: 72 };
    ctx.fillStyle = 'rgba(255,250,238,0.96)'; ctx.fillRect(newRect.x, newRect.y, newRect.w, newRect.h);
    jrect(newRect.x, newRect.y, newRect.w, newRect.h, pending.card.kind === 'active' ? INK : PURPLE, 2);
    text('新' + (pending.card.kind === 'active' ? '主动' : '辅助') + ' · ' + newName(pending.card) + ' Lv.1',
      newRect.x + 14, newRect.y + 24, wide ? 17 : 14, pending.card.kind === 'active' ? INK : PURPLE, 'left', true, newRect.w - 28);
    ctx.font = (wide ? 12 : 10) + 'px ' + FONT;
    wrapped(newDescription(pending.card), newRect.x + 14, newRect.y + 47, newRect.w - 28, 15, 1);

    const list = targets(), perPage = wide ? 12 : 6, pages = Math.max(1, Math.ceil(list.length / perPage));
    pending.page = Math.max(0, Math.min(pending.page, pages - 1));
    const targetY = top + (wide ? 186 : 164), gap = 8, rowH = wide ? 46 : 45;
    text('选择要被替换的旧技能', innerX, targetY - 12, wide ? 13 : 11, DARK, 'left', true);
    const visible = list.slice(pending.page * perPage, pending.page * perPage + perPage);
    visible.forEach((entry, i) => {
      const columns = wide ? 2 : 1, col = i % columns, row = Math.floor(i / columns);
      const cardW = (innerW - (columns - 1) * 12) / columns;
      const r = { x: innerX + col * (cardW + 12), y: targetY + row * (rowH + gap), w: cardW, h: rowH };
      const selected = sameRef(pending.selected, entry.ref), color = entry.item.kind === 'active' ? attrOf(entry.item.value.id) : PURPLE;
      ctx.fillStyle = selected ? 'rgba(205,222,248,0.96)' : 'rgba(255,250,238,0.94)'; ctx.fillRect(r.x, r.y, r.w, r.h);
      jrect(r.x, r.y, r.w, r.h, selected ? INK : color, selected ? 2.7 : 1.4);
      text(entry.label, r.x + 10, r.y + 17, wide ? 11 : 9, GRAY, 'left', false, r.w - 20);
      text(itemName(entry.item) + ' Lv.' + entry.item.value.lvl + (entry.activeLoss ? ' · 辅 ' + entry.activeLoss : ''),
        r.x + 10, r.y + 36, wide ? 13 : 11, color, 'left', true, r.w - 20);
      hits.push({ rect: r, action: () => selectTarget(entry.ref), enabled: true });
    });

    const infoY = top + (wide ? 520 : 484), selected = list.find(entry => sameRef(entry.ref, pending.selected));
    if (selected) {
      text(itemName(selected.item) + ' Lv.' + selected.item.value.lvl + '  →  ' + newName(pending.card) + ' Lv.1',
        innerX, infoY, wide ? 15 : 12, INK, 'left', true, innerW);
      text(selected.item.kind === 'active' ? '旧主动及其全部辅助将消失，此操作不可撤销。' : '旧辅助将消失，新辅助从 Lv.1 开始。',
        innerX, infoY + 22, wide ? 13 : 10, RED, 'left', false, innerW);
    } else text('点选旧技能后，再点击下方“确认替换”。', innerX, infoY, wide ? 13 : 11, GRAY);

    const pageY = top + (wide ? 548 : 526);
    if (pages > 1) {
      button({ x: innerX, y: pageY, w: 86, h: 28 }, '上一页', () => { pending.page--; }, pending.page > 0);
      text((pending.page + 1) + ' / ' + pages, W / 2, pageY + 19, 11, GRAY, 'center');
      button({ x: innerX + innerW - 86, y: pageY, w: 86, h: 28 }, '下一页', () => { pending.page++; }, pending.page < pages - 1);
    }
    const buttonY = H - top - (wide ? 54 : 49), buttonW = wide ? 180 : 140;
    button({ x: innerX, y: buttonY, w: buttonW, h: wide ? 38 : 32 }, '取消 · 返回选卡', cancel);
    button({ x: innerX + innerW - buttonW, y: buttonY, w: buttonW, h: wide ? 38 : 32 }, '确认替换', confirm, !!selected, true, RED);
  }

  const baseRender = render;
  render = function() {
    baseRender();
    if (state === 'acquireReplace') drawReplacement();
  };
  function logicalPoint(e) {
    const touch = e.touches && e.touches[0] || e.changedTouches && e.changedTouches[0], q = touch || e;
    const r = canvas.getBoundingClientRect();
    return { x: (q.clientX - r.left) / (r.width / W), y: (q.clientY - r.top) / (r.height / H) };
  }
  function pointerDown(e) {
    if (state !== 'acquireReplace') return;
    e.preventDefault(); e.stopImmediatePropagation();
    const p = logicalPoint(e);
    for (let i = hits.length - 1; i >= 0; i--) if (hits[i].enabled && pointInRect(p, hits[i].rect)) { hits[i].action(); return; }
  }
  if (typeof window.PointerEvent === 'function') window.addEventListener('pointerdown', pointerDown, { capture: true, passive: false });
  else {
    let lastTouchAt = -1000;
    window.addEventListener('mousedown', e => { if (Date.now() - lastTouchAt > 900) pointerDown(e); }, true);
    window.addEventListener('touchstart', e => { lastTouchAt = Date.now(); pointerDown(e); }, { capture: true, passive: false });
  }
  window.addEventListener('keydown', e => {
    if (state !== 'acquireReplace') return;
    if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); cancel(); return; }
    if (e.key === 'Enter') { e.preventDefault(); e.stopImmediatePropagation(); confirm(); return; }
    if (e.key === 'Tab') { e.preventDefault(); e.stopImmediatePropagation(); return; }
    if (['1', '2', '3', '4', '5', '6'].includes(e.key)) {
      e.preventDefault(); e.stopImmediatePropagation(); selectVisible(+e.key - 1);
    }
  }, true);

  window.AcquisitionRuntime = {
    acquire, cancel, confirm, targets, selectTarget, selectVisible, makeItem,
    get pending() { return pending; },
    get selected() { return pending && pending.selected; },
    get hits() { return hits.map(hit => ({ rect: Object.assign({}, hit.rect), enabled: hit.enabled })); },
    get page() { return pending ? pending.page : 0; },
    setPage(value) { if (pending) pending.page = Math.max(0, value | 0); }
  };
})();

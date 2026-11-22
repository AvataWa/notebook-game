/* 独立详情弹层：不修改游戏 state，打开时拦截全部底层输入。 */
(() => {
  'use strict';
  let detail = null;
  const panelRect = { x: 36, y: 150, w: 303, h: 300 };
  const closeRect = { x: 118, y: 400, w: 139, h: 32 };
  function desktopLayout() {
    const panel = { x: (W - 640) / 2, y: 140, w: 640, h: 400 };
    return { panel, close: { x: W / 2 - 90, y: panel.y + panel.h - 54, w: 180, h: 38 } };
  }
  function getLayout() {
    return window.DesktopRuntime && DesktopRuntime.active ? desktopLayout() : { panel: panelRect, close: closeRect };
  }
  function open(data) {
    if (!data) return false;
    detail = { title: String(data.title || '详情'), subtitle: String(data.subtitle || ''), tag: String(data.tag || ''), body: String(data.body || ''), color: data.color || INK, icon: data.icon || null };
    return true;
  }
  function close() { if (!detail) return false; detail = null; return true; }
  function wrapLines(text, maxWidth) {
    const lines = [];
    for (const paragraph of String(text || '').split('\n')) {
      if (!paragraph) { lines.push(''); continue; }
      let line = '';
      for (const ch of paragraph) {
        if (line && ctx.measureText(line + ch).width > maxWidth) { lines.push(line); line = ch; }
        else line += ch;
      }
      if (line) lines.push(line);
    }
    return lines;
  }
  function draw() {
    if (!detail) return;
    if (window.DesktopRuntime && DesktopRuntime.active) { DesktopRuntime.drawDetail(detail); return; }
    ctx.fillStyle = 'rgba(25,23,22,0.72)'; ctx.fillRect(0, 0, W, H);
    panelRect.x = 36; panelRect.w = W - 72;
    ctx.font = '11px ' + FONT;
    const lines = wrapLines(detail.body, panelRect.w - 32), maxLines = 12, tagOffset = detail.tag ? 22 : 0;
    panelRect.h = Math.max(230, Math.min(400, 154 + tagOffset + Math.min(lines.length, maxLines) * 17));
    panelRect.y = Math.max(64, (H - panelRect.h) / 2);
    Object.assign(closeRect, { x: W / 2 - 65, y: panelRect.y + panelRect.h - 46, w: 130, h: 32 });
    const x = panelRect.x, y = panelRect.y, w = panelRect.w;
    ctx.fillStyle = PAPER; ctx.fillRect(x, y, w, panelRect.h);
    jrect(x, y, w, panelRect.h, detail.color, 2.2);
    const icon = detail.icon && (detail.icon.kind === 'equipment' ? window.EquipmentIconRuntime : window.SkillIconRuntime);
    if (icon) {
      if (detail.icon.kind === 'equipment') EquipmentIconRuntime.draw(detail.icon.id, x + 14, y + 13, 48, detail.icon);
      else SkillIconRuntime.draw(detail.icon.id, detail.icon.kind, x + 14, y + 13, 48, detail.icon);
    }
    const titleX = x + (icon ? 72 : 16), titleW = w - (icon ? 88 : 32);
    ctx.textAlign = 'left'; ctx.fillStyle = detail.color; ctx.font = 'bold 18px ' + FONT;
    ctx.fillText(detail.title, titleX, y + 36, titleW);
    if (detail.tag) drawTagChip(detail.tag, titleX, y + 46, detail.color, 10, titleW);
    if (detail.subtitle) {
      ctx.fillStyle = GRAY; ctx.font = '10px ' + FONT;
      ctx.fillText(detail.subtitle, titleX, y + 58 + tagOffset, titleW);
    }
    jline(x + 16, y + 74 + tagOffset, x + w - 16, y + 74 + tagOffset, detail.color, 1.1);
    ctx.fillStyle = DARK; ctx.font = '11px ' + FONT;
    lines.slice(0, maxLines).forEach((line, i) => ctx.fillText(line, x + 16, y + 98 + tagOffset + i * 17));
    if (lines.length > maxLines) {
      ctx.fillStyle = GRAY; ctx.textAlign = 'center'; ctx.font = '9px ' + FONT;
      ctx.fillText('内容较多 · 可在养成页逐项查看', W / 2, closeRect.y - 12);
    }
    ctx.fillStyle = 'rgba(255,250,238,0.98)'; ctx.fillRect(closeRect.x, closeRect.y, closeRect.w, closeRect.h);
    jrect(closeRect.x, closeRect.y, closeRect.w, closeRect.h, INK, 1.7);
    ctx.fillStyle = INK; ctx.textAlign = 'center'; ctx.font = 'bold 12px ' + FONT;
    ctx.fillText('返回', W / 2, closeRect.y + 21);
  }
  const baseRenderForDetail = render;
  render = function() { baseRenderForDetail(); draw(); };
  canvas.addEventListener('pointerdown', e => {
    if (!detail) return;
    e.preventDefault(); e.stopImmediatePropagation();
    const p = toLogical(e), layout = getLayout(), panel = layout.panel;
    if (pointInRect(p, layout.close) || !pointInRect(p, panel)) close();
  }, true);
  window.addEventListener('keydown', e => {
    if (!detail) return;
    e.preventDefault(); e.stopImmediatePropagation();
    if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') close();
  }, true);
  window.UIDetail = { open, close, draw, getLayout, get isOpen() { return !!detail; }, get current() { return detail; } };
})();

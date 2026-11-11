/* 独立详情弹层：不修改游戏 state，打开时拦截全部底层输入。 */
(() => {
  'use strict';
  let detail = null;
  const closeRect = { x: 118, y: 568, w: 139, h: 38 };
  function open(data) {
    if (!data) return false;
    detail = { title: String(data.title || '详情'), subtitle: String(data.subtitle || ''), body: String(data.body || ''), color: data.color || INK };
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
    ctx.fillStyle = 'rgba(25,23,22,0.72)'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = PAPER; ctx.fillRect(24, 82, W - 48, 536);
    jrect(24, 82, W - 48, 536, detail.color, 2.4);
    ctx.textAlign = 'left'; ctx.fillStyle = detail.color; ctx.font = 'bold 20px ' + FONT;
    ctx.fillText(detail.title, 42, 120, W - 84);
    if (detail.subtitle) {
      ctx.fillStyle = GRAY; ctx.font = '11px ' + FONT;
      ctx.fillText(detail.subtitle, 42, 143, W - 84);
    }
    jline(42, 158, W - 42, 158, detail.color, 1.2);
    ctx.fillStyle = DARK; ctx.font = '12px ' + FONT;
    const lines = wrapLines(detail.body, W - 84);
    const maxLines = 20;
    lines.slice(0, maxLines).forEach((line, i) => ctx.fillText(line, 42, 184 + i * 18));
    ctx.fillStyle = 'rgba(255,250,238,0.98)'; ctx.fillRect(closeRect.x, closeRect.y, closeRect.w, closeRect.h);
    jrect(closeRect.x, closeRect.y, closeRect.w, closeRect.h, INK, 1.8);
    ctx.fillStyle = INK; ctx.textAlign = 'center'; ctx.font = 'bold 13px ' + FONT;
    ctx.fillText('返回', W / 2, closeRect.y + 25);
    if (lines.length > maxLines) {
      ctx.fillStyle = GRAY; ctx.font = '9px ' + FONT;
      ctx.fillText('部分内容较多，请在养成页逐项查看', W / 2, 552);
    }
  }
  const baseRenderForDetail = render;
  render = function() { baseRenderForDetail(); draw(); };
  canvas.addEventListener('pointerdown', e => {
    if (!detail) return;
    e.preventDefault(); e.stopImmediatePropagation();
    const p = toLogical(e);
    if (pointInRect(p, closeRect) || p.y < 82 || p.y > 618 || p.x < 24 || p.x > W - 24) close();
  }, true);
  window.addEventListener('keydown', e => {
    if (!detail) return;
    e.preventDefault(); e.stopImmediatePropagation();
    if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') close();
  }, true);
  window.UIDetail = { open, close, draw, get isOpen() { return !!detail; }, get current() { return detail; } };
})();

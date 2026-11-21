/* 统一设置：声音、震屏、叙事；主界面与战斗均可打开，选择持久化保存。 */
(() => {
  'use strict';
  const STORAGE_KEY = 'notebook-shake';
  const NARRATIVE_KEY = 'notebook-narrative';
  const MOTION_SCALE = 0.55;
  let shakeEnabled = true, narrativeEnabled = true, returnState = null;
  try {
    shakeEnabled = !globalThis.localStorage || localStorage.getItem(STORAGE_KEY) !== '0';
    narrativeEnabled = !globalThis.localStorage || localStorage.getItem(NARRATIVE_KEY) !== '0';
  } catch (_) { /* 默认开启 */ }

  function entryRect() { return { x: W - 42, y: 58, w: 30, h: 30 }; }
  function layout() {
    const wide = W >= 700, w = wide ? 460 : Math.min(327, W - 48), h = wide ? 490 : 466;
    const x = (W - w) / 2, y = (H - h) / 2;
    return {
      wide, panel: { x, y, w, h },
      sound: { x: x + 22, y: y + 92, w: w - 44, h: 66 },
      shake: { x: x + 22, y: y + 172, w: w - 44, h: 66 },
      narrative: { x: x + 22, y: y + 252, w: w - 44, h: 66 },
      close: { x: x + 36, y: y + h - 68, w: w - 72, h: 42 }
    };
  }
  function toggleShake() {
    shakeEnabled = !shakeEnabled;
    try { if (globalThis.localStorage) localStorage.setItem(STORAGE_KEY, shakeEnabled ? '1' : '0'); } catch (_) { /* 隐私模式下本次有效 */ }
    if (!shakeEnabled) {
      shakeT = 0;
      if (globalThis.CombatFeelRuntime) CombatFeelRuntime.cameraKicks.length = 0;
    }
    return shakeEnabled;
  }
  function toggleNarrative() {
    narrativeEnabled = !narrativeEnabled;
    try { if (globalThis.localStorage) localStorage.setItem(NARRATIVE_KEY, narrativeEnabled ? '1' : '0'); } catch (_) { /* 隐私模式下本次有效 */ }
    if (!narrativeEnabled && globalThis.NarrativeRuntime) NarrativeRuntime.clear();
    return narrativeEnabled;
  }
  function open() {
    if (state === 'settings' || !['play', 'metaHome', 'desktopPause'].includes(state)) return false;
    returnState = state;
    if (state === 'play') {
      if (player.surgeCharging) cancelInkSurgeCharge(player.surgePointerId);
      joy.active = false; joy.dx = 0; joy.dy = 0;
      for (const key of Object.keys(keys)) keys[key] = false;
    }
    state = 'settings';
    return true;
  }
  function close() {
    if (state !== 'settings') return false;
    state = returnState || 'play'; returnState = null;
    return true;
  }
  function text(value, x, y, size, color = DARK, align = 'left', bold = false) {
    ctx.fillStyle = color; ctx.textAlign = align; ctx.font = (bold ? 'bold ' : '') + size + 'px ' + FONT;
    ctx.fillText(String(value), x, y);
  }
  function drawEntry() {
    const r = entryRect();
    ctx.save(); setSeed(488); ctx.globalAlpha = 0.78;
    jcircle(r.x + r.w / 2, r.y + r.h / 2, 12, INK, 1.5);
    text('设', r.x + r.w / 2, r.y + 19, 10, INK, 'center', true);
    ctx.restore();
  }
  function drawRow(rect, title, description, enabled) {
    ctx.fillStyle = enabled ? 'rgba(205,222,248,0.38)' : 'rgba(245,241,230,0.82)';
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h); jrect(rect.x, rect.y, rect.w, rect.h, enabled ? INK : GRAY, 1.4);
    text(title, rect.x + 15, rect.y + 26, 16, enabled ? INK : DARK, 'left', true);
    text(description, rect.x + 15, rect.y + 48, 10, GRAY);
    const switchRect = { x: rect.x + rect.w - 68, y: rect.y + 16, w: 52, h: 34 };
    ctx.fillStyle = enabled ? INK : '#d7d2c8'; ctx.fillRect(switchRect.x, switchRect.y, switchRect.w, switchRect.h);
    jrect(switchRect.x, switchRect.y, switchRect.w, switchRect.h, enabled ? INK : GRAY, 1.4);
    text(enabled ? '开启' : '关闭', switchRect.x + switchRect.w / 2, switchRect.y + 22, 12, enabled ? PAPER : GRAY, 'center', true);
  }
  function drawPanel() {
    const l = layout(), p = l.panel;
    ctx.save();
    ctx.fillStyle = 'rgba(25,23,22,0.74)'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = PAPER; ctx.fillRect(p.x, p.y, p.w, p.h); jrect(p.x, p.y, p.w, p.h, INK, 2.4);
    text('设置', W / 2, p.y + 43, 25, INK, 'center', true);
    text(l.wide ? '按自己的习惯调整这一页' : '选择会自动保存', W / 2, p.y + 68, 11, GRAY, 'center');
    drawRow(l.sound, '声音', '命中、技能与操作音效', !CombatFeelRuntime.muted);
    drawRow(l.shake, '震屏', '镜头晃动、冲击位移与缩放回弹', shakeEnabled);
    drawRow(l.narrative, '叙事提示', '选角开场与胜负结算短句', narrativeEnabled);
    text('关闭叙事不影响战斗、奖励与系统提示', W / 2, l.close.y - 19, 10, GRAY, 'center');
    ctx.fillStyle = 'rgba(255,250,238,0.96)'; ctx.fillRect(l.close.x, l.close.y, l.close.w, l.close.h);
    jrect(l.close.x, l.close.y, l.close.w, l.close.h, INK, 1.8);
    text('返回', W / 2, l.close.y + 27, 14, INK, 'center', true);
    ctx.restore();
  }

  const baseRender = render;
  render = function() {
    let result;
    if (state === 'settings' && returnState) {
      const panelState = state;
      state = returnState;
      try { result = baseRender(); } finally { state = panelState; }
    } else result = baseRender();
    if (state === 'settings') drawPanel();
    else if (state === 'metaHome' || (state === 'play' && !globalThis.CombatFeelRuntime)) drawEntry();
    return result;
  };

  canvas.addEventListener('pointerdown', e => {
    const p = toLogical(e);
    if (state === 'settings') {
      e.preventDefault(); e.stopImmediatePropagation();
      const l = layout();
      if (pointInRect(p, l.sound)) CombatFeelRuntime.toggleMute();
      else if (pointInRect(p, l.shake)) toggleShake();
      else if (pointInRect(p, l.narrative)) toggleNarrative();
      else if (pointInRect(p, l.close)) close();
      return;
    }
    if ((state === 'play' || state === 'metaHome') && pointInRect(p, entryRect())) {
      e.preventDefault(); e.stopImmediatePropagation(); open();
    }
  }, true);
  window.addEventListener('keydown', e => {
    if (state === 'settings' && e.key === 'Escape') {
      e.preventDefault(); e.stopImmediatePropagation(); close();
    }
  }, true);

  globalThis.SettingsRuntime = {
    open, close, toggleShake, toggleNarrative, layout,
    motionScale: () => shakeEnabled ? MOTION_SCALE : 0,
    get shakeEnabled() { return shakeEnabled; },
    get narrativeEnabled() { return narrativeEnabled; },
    get isOpen() { return state === 'settings'; },
    get entryRect() { return entryRect(); },
    get storageKey() { return STORAGE_KEY; },
    get narrativeStorageKey() { return NARRATIVE_KEY; }
  };
})();

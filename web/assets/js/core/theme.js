/* ==========================================================================
   Hyico · core/theme.js
   深浅色主题：默认跟随系统，手动切换后持久化。
   首屏防闪白由 HTML <head> 里的内联脚本负责，这里是交互与状态同步层。
   ========================================================================== */
(function (H) {
  'use strict';

  var dom = H.dom;
  var KEY = 'hyico-theme';

  // 与 tokens.css 的画布色保持一致，供浏览器 UI（地址栏）取色
  var META_COLOR = { light: '#EBF1EF', dark: '#1A2723' };

  var mq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

  function stored() {
    try { return window.localStorage.getItem(KEY); } catch (e) { return null; }
  }

  function systemTheme() {
    return mq && mq.matches ? 'dark' : 'light';
  }

  function current() {
    return document.documentElement.getAttribute('data-theme') || systemTheme();
  }

  function syncMeta(mode) {
    var meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('name', 'theme-color');
      document.head.appendChild(meta);
    }
    meta.setAttribute('content', META_COLOR[mode] || META_COLOR.light);
  }

  function syncButtons(mode) {
    dom.$$('[data-theme-toggle]').forEach(function (btn) {
      var isDark = mode === 'dark';
      btn.setAttribute('aria-pressed', isDark ? 'true' : 'false');
      btn.setAttribute('aria-label', isDark ? '切换到浅色模式' : '切换到深色模式');
      btn.setAttribute('title', isDark ? '切换到浅色模式' : '切换到深色模式');
    });
  }

  function set(mode, persist) {
    var next = mode === 'dark' ? 'dark' : 'light';
    var root = document.documentElement;

    root.setAttribute('data-theme', next);
    root.style.colorScheme = next;

    if (persist) {
      try { window.localStorage.setItem(KEY, next); } catch (e) { /* 隐私模式下忽略 */ }
    }

    syncMeta(next);
    syncButtons(next);
    document.dispatchEvent(new CustomEvent('hyico:themechange', { detail: { theme: next } }));
  }

  function toggle() {
    set(current() === 'dark' ? 'light' : 'dark', true);
  }

  function init() {
    // 兜底：若内联脚本未执行（被 CSP 拦等），这里补一次
    if (!document.documentElement.getAttribute('data-theme')) {
      set(stored() || systemTheme(), false);
    } else {
      syncMeta(current());
      syncButtons(current());
    }

    dom.$$('[data-theme-toggle]').forEach(function (btn) {
      dom.on(btn, 'click', toggle);
    });

    // 只在用户未手动指定过时，才跟随系统变化
    if (mq) {
      var handler = function () { if (!stored()) set(systemTheme(), false); };
      if (mq.addEventListener) mq.addEventListener('change', handler);
      else if (mq.addListener) mq.addListener(handler);
    }
  }

  H.theme = {
    init: init,
    set: set,
    toggle: toggle,
    current: current,
    system: systemTheme
  };
})(window.HYICO = window.HYICO || {});

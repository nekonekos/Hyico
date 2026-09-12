/* ==========================================================================
   Hyico · components/countup.js
   数字滚动。仅用于装饰性指标；数值本身来自 JSON（可为占位值）。
   [data-countup="1200"] [data-countup-suffix="+"] [data-countup-decimals="1"]
   ========================================================================== */
(function (H) {
  'use strict';

  var dom = H.dom;

  function easeOutExpo(t) {
    return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
  }

  function run(el) {
    var target = parseFloat(el.getAttribute('data-countup'));
    if (!isFinite(target)) return;

    var decimals = parseInt(el.getAttribute('data-countup-decimals'), 10) || 0;
    var suffix = el.getAttribute('data-countup-suffix') || '';
    var prefix = el.getAttribute('data-countup-prefix') || '';
    var duration = parseInt(el.getAttribute('data-countup-duration'), 10) || 1500;

    var format = function (value) {
      if (decimals > 0) return prefix + value.toFixed(decimals) + suffix;
      return prefix + dom.formatNumber(Math.round(value)) + suffix;
    };

    if (dom.reducedMotion()) {
      el.textContent = format(target);
      return;
    }

    var start = null;
    function frame(ts) {
      if (start === null) start = ts;
      var progress = dom.clamp((ts - start) / duration, 0, 1);
      el.textContent = format(target * easeOutExpo(progress));
      if (progress < 1) window.requestAnimationFrame(frame);
      else el.textContent = format(target);
    }
    window.requestAnimationFrame(frame);
  }

  function init() {
    var nodes = dom.$$('[data-countup]');
    if (!nodes.length) return;

    if (!('IntersectionObserver' in window)) {
      nodes.forEach(run);
      return;
    }

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        run(entry.target);
        io.unobserve(entry.target);
      });
    }, { threshold: 0.4 });

    nodes.forEach(function (el) {
      // 初始先归零，避免"先显示终值再跳回"的闪动
      el.textContent = (el.getAttribute('data-countup-prefix') || '') + '0' + (el.getAttribute('data-countup-suffix') || '');
      io.observe(el);
    });
  }

  H.countup = { init: init };
})(window.HYICO = window.HYICO || {});

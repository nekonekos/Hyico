/* ==========================================================================
   Hyico · components/reveal.js
   滚动进场：IntersectionObserver，零依赖，尊重"减少动态效果"偏好。
   [data-reveal] 单个元素
   [data-reveal-stagger] 容器，其内 [data-reveal] 自动递增延迟
   ========================================================================== */
(function (H) {
  'use strict';

  var dom = H.dom;

  function init() {
    var nodes = dom.$$('[data-reveal]');
    if (!nodes.length) return;

    // 同组自动错峰，避免整屏同时弹出
    dom.$$('[data-reveal-stagger]').forEach(function (group) {
      var step = parseInt(group.getAttribute('data-reveal-stagger'), 10) || 70;
      dom.$$('[data-reveal]', group).forEach(function (el, i) {
        if (!el.hasAttribute('data-reveal-delay')) {
          el.style.setProperty('--reveal-delay', (i * step) + 'ms');
        }
      });
    });

    nodes.forEach(function (el) {
      var explicit = el.getAttribute('data-reveal-delay');
      if (explicit) el.style.setProperty('--reveal-delay', explicit + 'ms');
    });

    var showAll = function () {
      nodes.forEach(function (el) { el.classList.add('is-in'); });
    };

    if (dom.reducedMotion() || !('IntersectionObserver' in window)) {
      showAll();
      return;
    }

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-in');
        io.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });

    nodes.forEach(function (el) { io.observe(el); });

    // 内容被 JSON 替换后，可能有新的未进场节点
    document.addEventListener('hyico:content-applied', function () {
      dom.$$('[data-reveal]:not(.is-in)').forEach(function (el) { io.observe(el); });
    });
  }

  H.reveal = { init: init };
})(window.HYICO = window.HYICO || {});

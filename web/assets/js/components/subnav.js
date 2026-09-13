/* ==========================================================================
   Hyico · components/subnav.js
   Apple 式产品页的吸顶二级导航：滚动时高亮当前所在的区块。

   设计约束：
   - 传统脚本（IIFE），不是 ES module —— 双击 HTML 用 file:// 打开必须可用。
   - 渐进增强：这里是**唯一**的高亮来源，但导航本身的锚点链接写在 HTML 里，
     所以没有 JS、或浏览器不支持 IntersectionObserver 时，导航依然能用，
     只是不显示「当前区块」。绝不能让内容依赖这个脚本才能读到。
   ========================================================================== */
(function (H) {
  'use strict';

  var dom = H.dom;

  /** 视口内最靠上的那个区块算「当前」—— 与 Apple 的行为一致 */
  function pickActive(items, visible) {
    var best = null;
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      if (!visible.has(it.el)) continue;
      if (!best || it.el.getBoundingClientRect().top < best.el.getBoundingClientRect().top) {
        best = it;
      }
    }
    return best;
  }

  function init() {
    var navs = dom.$$('.subnav');
    if (!navs.length) return;

    // 不支持就什么都不做，HTML 里的锚点链接照常工作
    if (!('IntersectionObserver' in window)) return;

    navs.forEach(function (nav) {
      var items = [];
      dom.$$('.subnav__link', nav).forEach(function (link) {
        var href = link.getAttribute('href') || '';
        if (href.charAt(0) !== '#' || href.length < 2) return;
        var el = document.getElementById(href.slice(1));
        if (el) items.push({ link: link, el: el });
      });
      if (!items.length) return;

      var visible = new Set();
      var ticking = false;

      function sync() {
        ticking = false;
        var best = pickActive(items, visible);
        items.forEach(function (it) {
          if (it === best) it.link.setAttribute('aria-current', 'true');
          else it.link.removeAttribute('aria-current');
        });
      }

      function schedule() {
        if (ticking) return;
        ticking = true;
        window.requestAnimationFrame(sync);
      }

      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) visible.add(entry.target);
          else visible.delete(entry.target);
        });
        schedule();
      }, {
        // 上边收窄 15%（避开吸顶导航），下边收窄 55%，让「当前」落在阅读区内
        rootMargin: '-15% 0px -55% 0px',
        threshold: 0
      });

      items.forEach(function (it) { io.observe(it.el); });
      window.addEventListener('scroll', schedule, { passive: true });
      window.addEventListener('resize', schedule, { passive: true });
      sync();
    });
  }

  H.subnav = { init: init };
})(window.HYICO = window.HYICO || {});

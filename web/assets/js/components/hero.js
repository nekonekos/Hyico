/* ==========================================================================
   Hyico · components/hero.js
   Hero 图纸的轻微指针视差。仅在精细指针设备 + 允许动效时启用。
   ========================================================================== */
(function (H) {
  'use strict';

  var dom = H.dom;

  function init() {
    var art = dom.$('[data-parallax]');
    if (!art) return;
    if (dom.reducedMotion()) return;
    if (!window.matchMedia || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;

    var depth = parseFloat(art.getAttribute('data-parallax')) || 10;
    var frame = null;

    function onMove(e) {
      if (frame) return;
      frame = window.requestAnimationFrame(function () {
        frame = null;
        var rect = art.getBoundingClientRect();
        if (!rect.width || !rect.height) return;
        var x = (e.clientX - rect.left) / rect.width - 0.5;
        var y = (e.clientY - rect.top) / rect.height - 0.5;
        art.style.transform = 'translate3d(' + (-x * depth).toFixed(2) + 'px,' + (-y * depth).toFixed(2) + 'px,0)';
      });
    }

    function reset() {
      art.style.transform = '';
    }

    var zone = art.closest('.hero') || art;
    dom.on(zone, 'mousemove', onMove);
    dom.on(zone, 'mouseleave', reset);
  }

  H.heroArt = { init: init };
})(window.HYICO = window.HYICO || {});

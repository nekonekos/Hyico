/* ==========================================================================
   Hyico · components/tabs.js
   选项卡。ARIA 与面板结构写在 HTML 里，无 JS 时所有面板直接可见（优雅降级）。
   [data-tabs] 容器 / [role="tab"] 按钮 / [role="tabpanel"] 面板
   ========================================================================== */
(function (H) {
  'use strict';

  var dom = H.dom;

  function initGroup(root) {
    var tabs = dom.$$('[role="tab"]', root);
    var panels = dom.$$('[role="tabpanel"]', root);
    if (!tabs.length || !panels.length) return;

    function select(index, focusPanel) {
      tabs.forEach(function (tab, i) {
        var selected = i === index;
        tab.setAttribute('aria-selected', selected ? 'true' : 'false');
        tab.setAttribute('tabindex', selected ? '0' : '-1');
      });
      panels.forEach(function (panel, i) {
        panel.hidden = i !== index;
      });
      if (focusPanel) panels[index].focus();
    }

    var initial = tabs.findIndex(function (t) { return t.getAttribute('aria-selected') === 'true'; });
    select(initial === -1 ? 0 : initial, false);

    tabs.forEach(function (tab, index) {
      dom.on(tab, 'click', function () { select(index, false); });

      dom.on(tab, 'keydown', function (e) {
        var next = null;
        if (e.key === 'ArrowRight') next = (index + 1) % tabs.length;
        else if (e.key === 'ArrowLeft') next = (index - 1 + tabs.length) % tabs.length;
        else if (e.key === 'Home') next = 0;
        else if (e.key === 'End') next = tabs.length - 1;
        if (next === null) return;
        e.preventDefault();
        select(next, false);
        tabs[next].focus();
      });
    });
  }

  function init() {
    dom.$$('[data-tabs]').forEach(initGroup);
  }

  H.tabs = { init: init };
})(window.HYICO = window.HYICO || {});

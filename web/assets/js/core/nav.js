/* ==========================================================================
   Hyico · core/nav.js
   页头滚动状态、当前页高亮、桌面下拉菜单、移动端抽屉（构建 + 焦点陷阱）。
   抽屉内容从页头主导航克隆，全站只需维护一份导航结构。
   ========================================================================== */
(function (H) {
  'use strict';

  var dom = H.dom;
  var DESKTOP = '(min-width: 1000px)';
  var FOCUSABLE = 'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])';

  var state = {
    drawer: null,
    navToggle: null,
    lastFocused: null,
    built: false
  };

  /* ------------------------------------------------------------------ *
   * 当前页高亮
   * ------------------------------------------------------------------ */
  function markCurrent() {
    dom.$$('a[href]').forEach(function (a) {
      var href = a.getAttribute('href');
      if (a.hasAttribute('data-no-current')) return;
      if (dom.isCurrentLink(href)) {
        a.setAttribute('aria-current', 'page');
      } else if (a.getAttribute('aria-current') === 'page') {
        a.removeAttribute('aria-current');
      }
    });
  }

  /* ------------------------------------------------------------------ *
   * 桌面下拉菜单
   * ------------------------------------------------------------------ */
  function initMenus() {
    var items = dom.$$('.nav__item--has-menu');

    function close(item) {
      item.classList.remove('is-open');
      var trigger = item.querySelector('[data-menu-trigger]');
      if (trigger) trigger.setAttribute('aria-expanded', 'false');
    }

    function closeAll(except) {
      items.forEach(function (item) { if (item !== except) close(item); });
    }

    items.forEach(function (item) {
      var trigger = item.querySelector('[data-menu-trigger]');
      if (!trigger) return;

      dom.on(trigger, 'click', function (e) {
        e.preventDefault();
        var willOpen = !item.classList.contains('is-open');
        closeAll(item);
        item.classList.toggle('is-open', willOpen);
        trigger.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
      });

      // 指针设备上支持悬停展开，键盘与触屏仍走点击
      if (window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
        var timer = null;
        dom.on(item, 'mouseenter', function () {
          clearTimeout(timer);
          closeAll(item);
          item.classList.add('is-open');
          trigger.setAttribute('aria-expanded', 'true');
        });
        dom.on(item, 'mouseleave', function () {
          timer = setTimeout(function () { close(item); }, 140);
        });
      }

      // 焦点离开整块时收起
      dom.on(item, 'focusout', function (e) {
        if (!item.contains(e.relatedTarget)) close(item);
      });

      dom.on(item, 'keydown', function (e) {
        if (e.key === 'Escape') {
          close(item);
          trigger.focus();
        }
      });
    });

    document.addEventListener('click', function (e) {
      if (!e.target.closest('.nav__item--has-menu')) closeAll(null);
    });
  }

  /* ------------------------------------------------------------------ *
   * 移动端抽屉
   * ------------------------------------------------------------------ */
  function buildDrawer(drawer, nav) {
    var host = drawer.querySelector('[data-drawer-nav]');
    var list = nav && nav.querySelector('.nav__list');
    if (!host || !list || state.built) return;

    var frag = document.createDocumentFragment();
    var groupIndex = 0;

    Array.prototype.slice.call(list.children).forEach(function (li) {
      var link = li.querySelector(':scope > .nav__link');
      var menu = li.querySelector(':scope > .nav__menu');

      if (!menu) {
        var a = document.createElement('a');
        a.className = 'drawer__link';
        a.href = (link && link.getAttribute('href')) || '#';
        a.textContent = link ? link.textContent.trim() : '';
        frag.appendChild(a);
        return;
      }

      // 有子菜单 → 可折叠分组
      groupIndex += 1;
      var id = 'drawer-sub-' + groupIndex;
      var group = document.createElement('div');
      group.className = 'drawer__group';

      var toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.className = 'drawer__toggle';
      toggle.setAttribute('aria-expanded', 'false');
      toggle.setAttribute('aria-controls', id);
      toggle.innerHTML = '<span></span>' + caretSVG();
      toggle.firstChild.textContent = link ? link.textContent.trim() : '';
      group.appendChild(toggle);

      var sub = document.createElement('div');
      sub.className = 'drawer__sub';
      sub.id = id;
      sub.hidden = true;
      Array.prototype.slice.call(menu.querySelectorAll('a')).forEach(function (src) {
        var copy = document.createElement('a');
        copy.href = src.getAttribute('href');
        copy.textContent = src.querySelector('.nav__menu-desc')
          ? src.childNodes[0].textContent.trim()
          : src.textContent.trim();
        sub.appendChild(copy);
      });
      group.appendChild(sub);

      dom.on(toggle, 'click', function () {
        var open = toggle.getAttribute('aria-expanded') === 'true';
        toggle.setAttribute('aria-expanded', open ? 'false' : 'true');
        sub.hidden = open;
        group.classList.toggle('is-open', !open);
      });

      frag.appendChild(group);
    });

    host.innerHTML = '';
    host.appendChild(frag);
    state.built = true;
  }

  function caretSVG() {
    return '<svg class="nav__caret" viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6.5 8 10.5l4-4"/></svg>';
  }

  function openDrawer() {
    var drawer = state.drawer;
    if (!drawer) return;

    state.lastFocused = document.activeElement;
    drawer.hidden = false;
    // 强制重排，保证 transition 生效
    void drawer.offsetHeight;
    drawer.classList.add('is-open');
    document.body.classList.add('is-locked');

    if (state.navToggle) state.navToggle.setAttribute('aria-expanded', 'true');

    var first = drawer.querySelector(FOCUSABLE);
    if (first) first.focus();
  }

  function closeDrawer(returnFocus) {
    var drawer = state.drawer;
    if (!drawer || drawer.hidden) return;

    drawer.classList.remove('is-open');
    document.body.classList.remove('is-locked');
    if (state.navToggle) {
      state.navToggle.setAttribute('aria-expanded', 'false');
      if (returnFocus) state.navToggle.focus();
    }

    var finish = function () { drawer.hidden = true; };
    if (dom.reducedMotion()) finish();
    else setTimeout(finish, 220);
  }

  function isDrawerOpen() {
    return !!(state.drawer && !state.drawer.hidden);
  }

  function trapFocus(e) {
    if (!isDrawerOpen() || e.key !== 'Tab') return;
    var nodes = dom.$$(FOCUSABLE, state.drawer).filter(function (n) {
      return n.offsetParent !== null || n === document.activeElement;
    });
    if (!nodes.length) return;

    var first = nodes[0];
    var last = nodes[nodes.length - 1];

    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  function initDrawer() {
    state.drawer = dom.$('[data-drawer]');
    state.navToggle = dom.$('[data-nav-toggle]');
    var nav = dom.$('[data-nav]');

    if (!state.drawer || !state.navToggle) return;

    buildDrawer(state.drawer, nav);

    dom.on(state.navToggle, 'click', function () {
      isDrawerOpen() ? closeDrawer(true) : openDrawer();
    });

    // 点击抽屉内的链接后自动收起
    dom.on(state.drawer, 'click', function (e) {
      if (e.target.closest('a[href]')) closeDrawer(false);
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && isDrawerOpen()) closeDrawer(true);
    });

    document.addEventListener('keydown', trapFocus);

    // 视口放大到桌面断点时收起抽屉，避免状态残留
    if (window.matchMedia) {
      var dq = window.matchMedia(DESKTOP);
      var onChange = function (e) { if (e.matches) closeDrawer(false); };
      if (dq.addEventListener) dq.addEventListener('change', onChange);
      else if (dq.addListener) dq.addListener(onChange);
    }

    window.addEventListener('pagehide', function () { closeDrawer(false); });
  }

  /* ------------------------------------------------------------------ *
   * 滚动状态
   * ------------------------------------------------------------------ */
  function initScrollState() {
    var header = dom.$('[data-header]');
    if (!header) return;

    var ticking = false;
    function update() {
      header.classList.toggle('is-scrolled', window.scrollY > 8);
      ticking = false;
    }
    function onScroll() {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(update);
    }

    update();
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  function init() {
    markCurrent();
    initScrollState();
    initMenus();
    initDrawer();
  }

  H.nav = { init: init, markCurrent: markCurrent, closeDrawer: closeDrawer };
})(window.HYICO = window.HYICO || {});

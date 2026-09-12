/* ==========================================================================
   Hyico · pages/list.js
   两件事：
   1. [data-list="news"][data-limit="3"]  — 首页等处取前 N 条摘要卡片
   2. [data-filter-bar="#selector"]        — 新闻/招聘列表的分类筛选
   内容全部来自同名 JSON，不在这里写死任何文案。
   ========================================================================== */
(function (H) {
  'use strict';

  var dom = H.dom;
  var cache = {};

  function fetchJSON(url) {
    if (!cache[url]) {
      cache[url] = fetch(url, { cache: 'no-cache' }).then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status + ' · ' + url);
        return res.json();
      });
    }
    return cache[url];
  }

  /* ------------------------------------------------------------------ *
   * 摘要列表
   * ------------------------------------------------------------------ */
  function initSummary() {
    dom.$$('[data-list]').forEach(function (host) {
      var source = host.getAttribute('data-list');
      if (!source) return;

      var limit = parseInt(host.getAttribute('data-limit'), 10) || 0;
      var tpl = host.querySelector('[data-template]') || host.firstElementChild;
      var emptySel = host.getAttribute('data-empty');
      if (!tpl) return;

      var template = tpl.cloneNode(true);
      template.removeAttribute('data-template');

      // file:// 下无法 fetch，保留 HTML 内联的一条默认卡片即可
      if (window.location.protocol === 'file:') return;

      fetchJSON(source + '.json')
        .then(function (data) {
          var items = Array.isArray(data.items) ? data.items.slice(0) : [];
          if (limit > 0) items = items.slice(0, limit);

          var empty = emptySel ? dom.$(emptySel) : null;

          if (!items.length) {
            host.hidden = true;
            if (empty) empty.hidden = false;
            return;
          }

          var frag = document.createDocumentFragment();
          items.forEach(function (item) {
            var node = template.cloneNode(true);
            var scope = item && typeof item === 'object' ? item : { value: item };
            H.content.apply(node, scope, scope);
            frag.appendChild(node);
          });

          host.innerHTML = '';
          host.appendChild(frag);
          host.hidden = false;
          if (empty) empty.hidden = true;
          document.dispatchEvent(new CustomEvent('hyico:content-applied'));
        })
        .catch(function () {
          // 静默降级：HTML 内联的默认卡片继续显示
        });
    });
  }

  /* ------------------------------------------------------------------ *
   * 分类筛选
   * ------------------------------------------------------------------ */
  function initFilters() {
    dom.$$('[data-filter-bar]').forEach(function (bar) {
      var list = dom.$(bar.getAttribute('data-filter-bar'));
      if (!list) return;

      var buttons = dom.$$('[data-filter]', bar);
      if (!buttons.length) return;

      var emptySel = bar.getAttribute('data-empty');
      var empty = emptySel ? dom.$(emptySel) : null;

      function apply(value) {
        var shown = 0;

        dom.$$('[data-post-item]', list).forEach(function (item) {
          var tags = dom.$$('[data-post-tag]', item).map(function (tag) {
            return tag.textContent.trim();
          });
          var match = value === '*' || tags.indexOf(value) !== -1;
          item.hidden = !match;
          if (match) shown += 1;
        });

        if (empty) empty.hidden = shown > 0;

        var url = new URL(window.location.href);
        if (value === '*') url.searchParams.delete('tag');
        else url.searchParams.set('tag', value);
        window.history.replaceState({}, '', url);
      }

      buttons.forEach(function (btn) {
        dom.on(btn, 'click', function () {
          buttons.forEach(function (other) {
            other.setAttribute('aria-pressed', other === btn ? 'true' : 'false');
          });
          apply(btn.getAttribute('data-filter'));
        });
      });

      // 支持 ?tag=产品 直达
      var preset = new URLSearchParams(window.location.search).get('tag');
      if (preset) {
        var match = buttons.filter(function (b) { return b.getAttribute('data-filter') === preset; })[0];
        if (match) match.click();
      }
    });
  }

  function init() {
    initSummary();
    initFilters();
  }

  H.list = { init: init, fetchJSON: fetchJSON };
})(window.HYICO = window.HYICO || {});

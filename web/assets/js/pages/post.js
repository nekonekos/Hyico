/* ==========================================================================
   Hyico · pages/post.js
   新闻 / 招聘通用详情页。
   页面只有一个 HTML 模板（news-post.html / careers-post.html），
   通过 ?slug= 读取同目录子文件夹里的条目 JSON：
     news-post.html?slug=first-flight  →  news/first-flight.json
     careers-post.html?slug=uav-engineer →  careers/uav-engineer.json
   ========================================================================== */
(function (H) {
  'use strict';

  var dom = H.dom;

  function init() {
    var collection = document.body.getAttribute('data-collection');
    if (!collection) return;

    var article = dom.$('[data-post-article]');
    var missing = dom.$('[data-post-missing]');
    var loading = dom.$('[data-post-loading]');

    function showMissing() {
      if (article) article.hidden = true;
      if (loading) loading.hidden = true;
      if (missing) missing.hidden = false;
      document.documentElement.setAttribute('data-post-state', 'missing');
    }

    function showReady() {
      if (loading) loading.hidden = true;
      if (missing) missing.hidden = true;
      if (article) article.hidden = false;
      document.documentElement.setAttribute('data-post-state', 'ready');
    }

    var slug = new URLSearchParams(window.location.search).get('slug');

    if (!slug) {
      showMissing();
      return;
    }

    if (window.location.protocol === 'file:') {
      showMissing();
      return;
    }

    fetch(collection + '/' + encodeURIComponent(slug) + '.json', { cache: 'no-cache' })
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function (data) {
        // 条目数据覆盖模板里的内联默认文案。
        // 第二轮必须带上第一轮的全局数据（site.json + 模板 JSON），
        // 否则 site.tagline 之类的键会解析失败。
        var root = H.content.merge(H.data || {}, data);
        H.content.apply(document, root, root);
        showReady();

        if (data.meta) {
          if (data.meta.title) {
            // meta.title 可能已经自带品牌后缀，避免出现"· Hyico · Hyico"
            document.title = /Hyico/i.test(data.meta.title) ? data.meta.title : data.meta.title + ' · Hyico';
          }
          var desc = document.querySelector('meta[name="description"]');
          if (desc && data.meta.description) desc.setAttribute('content', data.meta.description);
        }
        var canonical = document.querySelector('link[rel="canonical"]');
        if (canonical) canonical.setAttribute('href', window.location.pathname + window.location.search);

        document.dispatchEvent(new CustomEvent('hyico:content-applied'));
      })
      .catch(showMissing);
  }

  H.post = { init: init };
})(window.HYICO = window.HYICO || {});

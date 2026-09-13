/* ==========================================================================
   Hyico · main.js
   全站引导。加载顺序是有意的：
     1) 主题与导航先就绪 —— 它们是首屏交互，不能被网络请求拖慢；
     2) 同名 JSON 覆盖文案；
     3) 依赖内容结构的组件（选项卡、滚动进场、数字滚动、列表、详情）再初始化，
        这样数组展开后的新节点也能被正确观察与绑定。
   ========================================================================== */
(function (H) {
  'use strict';

  var dom = H.dom;

  function initAfterContent() {
    // 每个模块都做存在性判断：页面按需引入脚本（例如 404 不需要 nav.js）
    if (H.tabs) H.tabs.init();
    if (H.list) H.list.init();
    if (H.post) H.post.init();
    if (H.reveal) H.reveal.init();
    if (H.countup) H.countup.init();
    if (H.heroArt) H.heroArt.init();
    if (H.contact) H.contact.init();
    if (H.subnav) H.subnav.init();
    if (H.nav) H.nav.markCurrent();
  }

  dom.ready(function () {
    if (H.theme) H.theme.init();
    if (H.nav) H.nav.init();

    // content.load() 永不 reject：JSON 缺失时静默降级为 HTML 内联文案
    H.content.load().then(initAfterContent, initAfterContent);
  });
})(window.HYICO = window.HYICO || {});

/* ==========================================================================
   Hyico · core/dom.js
   最小工具集：选择、事件、断点、格式化。
   刻意不引入任何依赖，全部使用传统脚本（非 ES module），
   这样直接双击 HTML 用 file:// 打开也不会因 CORS 而整体失效。
   ========================================================================== */
(function (H) {
  'use strict';

  function $(sel, root) { return (root || document).querySelector(sel); }

  function $$(sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  }

  function on(el, type, fn, opts) {
    if (el) el.addEventListener(type, fn, opts);
    return fn;
  }

  function ready(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn, { once: true });
    } else {
      fn();
    }
  }

  function reducedMotion() {
    return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  /** 取当前文件名的 stem，例如 /web/h770.html → "h770"，"/web/" → "index" */
  function pageStem() {
    var path = window.location.pathname || '';
    var file = path.substring(path.lastIndexOf('/') + 1);
    if (!file || file.indexOf('.') === -1) return 'index';
    return file.replace(/\.html?$/i, '') || 'index';
  }

  /** 与当前页面对比，判断链接是否指向本页 */
  function isCurrentLink(href) {
    if (!href) return false;
    if (/^(#|mailto:|tel:|https?:)/i.test(href)) return false;
    var target = href.split(/[?#]/)[0];
    var seg = target.substring(target.lastIndexOf('/') + 1) || 'index.html';
    var mine = window.location.pathname.substring(window.location.pathname.lastIndexOf('/') + 1) || 'index.html';
    return seg.toLowerCase() === mine.toLowerCase();
  }

  /** 数字千分位 */
  function formatNumber(value) {
    var n = Number(value);
    if (!isFinite(n)) return String(value);
    return n.toLocaleString('en-US');
  }

  /** 安全写入 HTML：仅保留简单标签，剔除脚本与事件属性 */
  function sanitizeHTML(html) {
    var doc = document.implementation.createHTMLDocument('sanitize');
    doc.body.innerHTML = String(html);
    $$('script, style, iframe, object, embed, form, link, meta', doc.body).forEach(function (n) {
      n.parentNode.removeChild(n);
    });
    $$('*', doc.body).forEach(function (n) {
      Array.prototype.slice.call(n.attributes).forEach(function (attr) {
        var name = attr.name.toLowerCase();
        var val = String(attr.value).replace(/\s+/g, ' ').trim();
        if (name.indexOf('on') === 0 || /^(javascript|data|vbscript):/i.test(val)) {
          n.removeAttribute(attr.name);
        }
      });
    });
    return doc.body.innerHTML;
  }

  /** 复制文本，优先 Clipboard API，回退 execCommand */
  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text);
    }
    return new Promise(function (resolve, reject) {
      try {
        var ta = document.createElement('textarea');
        ta.value = text;
        ta.setAttribute('readonly', '');
        ta.style.cssText = 'position:fixed;top:-1000px;opacity:0';
        document.body.appendChild(ta);
        ta.select();
        var ok = document.execCommand('copy');
        document.body.removeChild(ta);
        ok ? resolve() : reject(new Error('copy failed'));
      } catch (err) {
        reject(err);
      }
    });
  }

  H.dom = {
    $: $,
    $$: $$,
    on: on,
    ready: ready,
    reducedMotion: reducedMotion,
    clamp: clamp,
    pageStem: pageStem,
    isCurrentLink: isCurrentLink,
    formatNumber: formatNumber,
    sanitizeHTML: sanitizeHTML,
    copyText: copyText
  };
})(window.HYICO = window.HYICO || {});

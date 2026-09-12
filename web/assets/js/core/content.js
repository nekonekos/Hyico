/* ==========================================================================
   Hyico · core/content.js
   同名 JSON 内容覆盖引擎
   --------------------------------------------------------------------------
   设计原则：
   1. HTML 里始终写"完整可读的中文默认文案"，因此关掉 JS、JSON 丢失、
      或直接 file:// 打开，页面都照常成立。
   2. 同名 JSON（index.html ↔ index.json）加载成功后，按键覆盖 HTML 文案。
      改文案只改 JSON，改结构才动 HTML。
   3. 任何一步失败都静默降级，绝不把页面搞成空白。

   支持的属性：
     data-content="a.b.c"              写入 textContent
     data-content-html="a.b.c"         写入 HTML（自动 sanitize）
     data-content-attr="href:u;title:t"  批量设置属性
     data-each="a.b"                   数组重复；内部键相对当前项，
                                       需要访问全局用 ^ 前缀，如 ^site.name
     data-each-hide-empty              数组为空时隐藏整个宿主
     data-optional="a.b"               键为假值/空数组时隐藏该元素
     data-template                     标记 data-each 的克隆模板（可选，默认首个子元素）
   ========================================================================== */
(function (H) {
  'use strict';

  var dom = H.dom;

  var DEBUG = /[?&]content-debug(=|&|$)/.test(window.location.search);
  var passId = 0;

  function info(msg, extra) {
    if (DEBUG) console.info('[content] ' + msg, extra === undefined ? '' : extra);
  }

  function warn(msg, extra) {
    if (DEBUG) console.warn('[content] ' + msg, extra === undefined ? '' : extra);
  }

  function isPlainObject(v) {
    return v !== null && typeof v === 'object' && !Array.isArray(v);
  }

  function get(obj, path) {
    if (obj === null || obj === undefined || !path) return undefined;
    var parts = String(path).split('.');
    var cur = obj;
    for (var i = 0; i < parts.length; i++) {
      if (cur === null || cur === undefined) return undefined;
      cur = cur[parts[i]];
    }
    return cur;
  }

  /**
   * 解析路径。作用域优先级：当前项 → 全局。
   * "^" 前缀强制走全局，用于在 data-each 内部取站点级字段。
   */
  function resolve(path, scope, root) {
    if (typeof path !== 'string' || !path) return undefined;
    if (path.charAt(0) === '^') return get(root, path.slice(1));
    if (scope !== undefined && scope !== null) {
      var local = get(scope, path);
      if (local !== undefined) return local;
    }
    return get(root, path);
  }

  function isBlank(value) {
    if (value === undefined || value === null || value === false) return true;
    if (Array.isArray(value)) return value.length === 0;
    if (typeof value === 'string') return value.trim() === '';
    return false;
  }

  /* ------------------------------------------------------------------ *
   * 本轮标记：同一轮里防止外层作用域覆盖内层已绑定的节点。
   * 不同轮之间 passId 递增，因此 post.js / list.js 可以在首轮之后再覆盖一次。
   * ------------------------------------------------------------------ */
  function claimed(el, kind) {
    return el['__hc_' + kind] === passId;
  }

  function claim(el, kind) {
    el['__hc_' + kind] = passId;
  }

  /**
   * 只取"属于当前作用域"的元素：
   * - 容器自身也参与匹配。模板根节点上的 data-content-attr 必须能生效，
   *   而 querySelectorAll 不含容器本身。
   * - 跳过仍带 data-template 的节点（模板是惰性的，只有被克隆并赋予作用域后才绑定）。
   * - 跳过尚未展开的 data-each 宿主内部节点，避免外层用错误的 scope 覆盖内层绑定。
   */
  function owned(selector, container) {
    var out = [];

    if (container && container.nodeType === 1 && typeof container.matches === 'function' &&
        container.matches(selector) && !container.hasAttribute('data-template')) {
      out.push(container);
    }

    dom.$$(selector, container).forEach(function (el) {
      if (el.hasAttribute('data-template')) return;

      var node = el.parentElement;
      while (node && node !== container) {
        if (node.hasAttribute) {
          if (node.hasAttribute('data-template')) return;
          if (node.hasAttribute('data-each') && node.__hcExpanded !== passId) return;
        }
        node = node.parentElement;
      }
      out.push(el);
    });

    return out;
  }

  /* ------------------------------------------------------------------ *
   * data-each
   * ------------------------------------------------------------------ */
  function expandEach(container, scope, root) {
    owned('[data-each]', container).forEach(function (host) {
      if (host.__hcExpanded === passId) return;

      var path = host.getAttribute('data-each');
      var value = resolve(path, scope, root);
      var tpl = host.querySelector('[data-template]') || host.firstElementChild;

      host.__hcExpanded = passId;

      if (!tpl) return;

      // 键不存在 → 保留 HTML 内联默认内容（JSON 缺失时的降级路径）
      if (value === undefined || value === null) {
        warn('data-each "' + path + '" 未取到数据，保留内联默认内容');
        return;
      }

      var items = Array.isArray(value) ? value : [value];

      // 数组为空 → 视为"确实没有内容"，隐藏宿主以便显示空状态
      if (!items.length) {
        if (!host.hasAttribute('data-each-keep-empty')) host.hidden = true;
        info('data-each "' + path + '" 为空数组，已隐藏');
        return;
      }

      var source = tpl.cloneNode(true);
      source.removeAttribute('data-template');

      var frag = document.createDocumentFragment();
      items.forEach(function (raw, index) {
        // 数组元素可以是字符串/数字，统一包装成 { value }，模板里用 data-content="value"
        var item = isPlainObject(raw) || Array.isArray(raw) ? raw : { value: raw };
        var node = source.cloneNode(true);
        node.removeAttribute('data-template');
        node.style.setProperty('--item-index', String(index));
        apply(node, item, root, true);
        frag.appendChild(node);
      });

      host.innerHTML = '';
      host.appendChild(frag);
      host.hidden = false;
      info('data-each "' + path + '" 展开 ' + items.length + ' 项');
    });
  }

  /* ------------------------------------------------------------------ *
   * 文本 / 属性 / 条件显示
   * ------------------------------------------------------------------ */
  function bindText(container, scope, root) {
    owned('[data-content]', container).forEach(function (el) {
      if (claimed(el, 'text')) return;
      claim(el, 'text');
      var path = el.getAttribute('data-content');
      var value = resolve(path, scope, root);
      if (value === undefined || value === null) {
        warn('缺少文案键 "' + path + '"，保留 HTML 内联默认值');
        return;
      }
      var text = String(value);
      if (el.textContent.trim() !== text.trim()) el.textContent = text;
    });

    owned('[data-content-html]', container).forEach(function (el) {
      if (claimed(el, 'html')) return;
      claim(el, 'html');
      var path = el.getAttribute('data-content-html');
      var value = resolve(path, scope, root);
      if (value === undefined || value === null) {
        warn('缺少 HTML 键 "' + path + '"');
        return;
      }
      el.innerHTML = dom.sanitizeHTML(value);
    });
  }

  function bindAttrs(container, scope, root) {
    owned('[data-content-attr]', container).forEach(function (el) {
      if (claimed(el, 'attr')) return;
      claim(el, 'attr');

      el.getAttribute('data-content-attr').split(';').forEach(function (pair) {
        var idx = pair.indexOf(':');
        if (idx === -1) return;
        var attr = pair.slice(0, idx).trim();
        var path = pair.slice(idx + 1).trim();
        if (!attr || !path) return;

        var value = resolve(path, scope, root);
        if (value === undefined || value === null) {
          warn('缺少属性键 "' + path + '"（' + attr + '）');
          return;
        }
        el.setAttribute(attr, String(value));
      });
    });
  }

  function bindConditionals(container, scope, root) {
    owned('[data-optional]', container).forEach(function (el) {
      if (claimed(el, 'cond')) return;
      claim(el, 'cond');
      var value = resolve(el.getAttribute('data-optional'), scope, root);
      if (isBlank(value)) el.hidden = true;
      else el.hidden = false;
    });

    // 占位数据标记：避免未验证的参数被当成真实指标发布
    owned('[data-placeholder]', container).forEach(function (el) {
      if (claimed(el, 'draft')) return;
      claim(el, 'draft');
      var isDraft = resolve(el.getAttribute('data-placeholder'), scope, root);
      if (isDraft !== true && isDraft !== 'true') return;
      if (el.querySelector('.draft-flag')) return;
      if (el.parentElement && el.parentElement.querySelector('.draft-flag')) return;

      var flag = document.createElement('span');
      flag.className = 'draft-flag';
      flag.textContent = '待确认';
      el.appendChild(flag);
    });

    // data-countup-from → 数值交给 countup 组件
    owned('[data-countup-from]', container).forEach(function (el) {
      if (claimed(el, 'count')) return;
      claim(el, 'count');
      var value = resolve(el.getAttribute('data-countup-from'), scope, root);
      if (value === undefined || value === null || value === '') return;
      el.setAttribute('data-countup', String(value));
    });
  }

  /**
   * 递归入口。
   * @param {Element|Document} container 作用域容器
   * @param {*} scope 当前数据作用域（data-each 内部为单项）
   * @param {*} root 全局数据
   * @param {boolean} [nested] 由 expandEach 内部调用时为 true，不新开一轮
   */
  function apply(container, scope, root, nested) {
    if (!nested) passId += 1;
    expandEach(container, scope, root);
    bindText(container, scope, root);
    bindAttrs(container, scope, root);
    bindConditionals(container, scope, root);
  }

  /* ------------------------------------------------------------------ *
   * 加载
   * ------------------------------------------------------------------ */
  function fetchJSON(url) {
    return fetch(url, { cache: 'no-cache' }).then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status + ' · ' + url);
      return res.json();
    });
  }

  function isPlainObjectLike(v) {
    return v !== null && typeof v === 'object' && !Array.isArray(v);
  }

  /** 深合并：对象递归合并，数组与原始值由后者覆盖 */
  function merge(base, patch) {
    if (!isPlainObjectLike(patch)) return patch === undefined ? base : patch;
    var out = isPlainObjectLike(base) ? Object.assign({}, base) : {};
    Object.keys(patch).forEach(function (key) {
      var bv = out[key];
      var pv = patch[key];
      out[key] = isPlainObjectLike(bv) && isPlainObjectLike(pv) ? merge(bv, pv) : pv;
    });
    return out;
  }

  function load(page) {
    var name = page || dom.pageStem();

    if (window.location.protocol === 'file:') {
      info('file:// 环境无法读取 JSON，已使用 HTML 内联文案');
      return Promise.resolve(null);
    }

    // site.json 提供全站信息（导航、页脚、公司资料），页面 JSON 覆盖同名键
    var globalReq = fetchJSON('site.json').catch(function (err) {
      info('未加载 site.json（' + err.message + '）');
      return {};
    });

    // 404 等页面被任意深度的未知路径复用，同名 JSON 的相对位置不可靠，
    // 因此用 <html data-no-page-json> 显式跳过页面 JSON，只保留 site.json。
    var skipPage = document.documentElement.hasAttribute('data-no-page-json');

    var pageReq = skipPage
      ? Promise.resolve({})
      : fetchJSON(name + '.json').catch(function (err) {
          info('未加载 ' + name + '.json（' + err.message + '），使用 HTML 内联文案');
          return {};
        });

    return Promise.all([globalReq, pageReq])
      .then(function (results) {
        var data = merge(results[0] || {}, results[1] || {});
        if (!Object.keys(data).length) return null;

        H.data = data;
        apply(document, data, data);
        document.documentElement.setAttribute('data-content-loaded', name);
        info('已应用 site.json + ' + name + '.json');
        document.dispatchEvent(new CustomEvent('hyico:content-applied'));
        return data;
      })
      .catch(function (err) {
        // 兜底：任何意外都静默降级，页面已由 HTML 内联文案完整呈现
        info('内容覆盖失败（' + err.message + '），使用 HTML 内联文案');
        return null;
      });
  }

  H.content = {
    load: load,
    apply: apply,
    resolve: resolve,
    get: get,
    merge: merge,
    debug: DEBUG
  };
})(window.HYICO = window.HYICO || {});

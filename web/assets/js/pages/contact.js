/* ==========================================================================
   Hyico · pages/contact.js
   无后端的联系表单：校验后交给邮件客户端（mailto）。
   若以后接入 Formspree / Web3Forms，只需在 send() 里换成 fetch 提交即可。
   ========================================================================== */
(function (H) {
  'use strict';

  var dom = H.dom;
  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  /* ------------------------------------------------------------------ *
   * 邮箱一键复制
   * ------------------------------------------------------------------ */
  function initCopy() {
    dom.$$('[data-copy]').forEach(function (btn) {
      var original = btn.textContent;

      dom.on(btn, 'click', function () {
        var target = dom.$(btn.getAttribute('data-copy'));
        if (!target) return;

        var value = (target.value !== undefined ? target.value : target.textContent).trim();

        dom.copyText(value).then(
          function () {
            btn.textContent = '已复制';
            btn.setAttribute('data-state', 'ok');
            setTimeout(function () {
              btn.textContent = original;
              btn.removeAttribute('data-state');
            }, 1800);
          },
          function () {
            btn.textContent = '复制失败';
            setTimeout(function () { btn.textContent = original; }, 1800);
          }
        );
      });
    });
  }

  /* ------------------------------------------------------------------ *
   * 表单校验 + mailto
   * ------------------------------------------------------------------ */
  function fieldError(field, message) {
    var errorEl = document.getElementById(field.id + '-error');
    if (message) {
      field.setAttribute('aria-invalid', 'true');
      if (errorEl) {
        errorEl.textContent = message;
        errorEl.hidden = false;
      }
    } else {
      field.removeAttribute('aria-invalid');
      if (errorEl) {
        errorEl.textContent = '';
        errorEl.hidden = true;
      }
    }
    return !message;
  }

  function validate(form) {
    var ok = true;
    var firstBad = null;

    dom.$$('[required]', form).forEach(function (field) {
      var value = (field.value || '').trim();
      if (!value) {
        if (!fieldError(field, '这一项需要填写')) ok = false;
        if (!firstBad) firstBad = field;
        return;
      }
      if (field.type === 'email' && !EMAIL_RE.test(value)) {
        if (!fieldError(field, '请填写有效的邮箱地址')) ok = false;
        if (!firstBad) firstBad = field;
        return;
      }
      fieldError(field, '');
    });

    if (firstBad) firstBad.focus();
    return ok;
  }

  function send(form) {
    var data = new FormData(form);
    var to = form.getAttribute('data-mailto') || '';
    var subject = (data.get('subject') || '网站咨询').toString().trim();
    var lines = [];

    data.forEach(function (value, key) {
      if (key === 'subject') return;
      var text = value.toString().trim();
      if (!text) return;
      var label = form.querySelector('[name="' + key + '"]');
      var title = label && label.getAttribute('data-label') ? label.getAttribute('data-label') : key;
      lines.push(title + '：' + text);
    });

    var body = lines.join('\n') + '\n\n—— 来自 Hyico 官网联系表单';
    var url = 'mailto:' + to +
      '?subject=' + encodeURIComponent('[Hyico] ' + subject) +
      '&body=' + encodeURIComponent(body);

    window.location.href = url;
  }

  function initForm() {
    var form = dom.$('[data-contact-form]');
    if (!form) return;

    var notice = form.querySelector('[data-form-notice]');

    dom.on(form, 'submit', function (e) {
      e.preventDefault();

      if (!validate(form)) {
        if (notice) {
          notice.hidden = false;
          notice.className = 'form__notice';
          notice.textContent = '请检查标红的字段后再提交。';
        }
        return;
      }

      send(form);

      if (notice) {
        notice.hidden = false;
        notice.className = 'form__notice form__notice--ok';
        notice.textContent = '已为你打开邮件客户端。如果没有反应，请直接写信到页面右侧的邮箱地址。';
      }
    });

    // 用户开始修正时立刻清掉错误态
    dom.$$('[required]', form).forEach(function (field) {
      dom.on(field, 'input', function () { fieldError(field, ''); });
    });
  }

  function init() {
    initCopy();
    initForm();
  }

  H.contact = { init: init };
})(window.HYICO = window.HYICO || {});

/* ==========================================================================
 * HyicoPlatform API 客户端
 * 依赖 common.js（window.HYICO）。自动附带 JWT，401 时跳转登录。
 * ========================================================================== */
(function () {
    'use strict';

    function authHeaders() {
        const token = window.HYICO.getToken();
        const h = { 'Content-Type': 'application/json' };
        if (token) h['Authorization'] = 'Bearer ' + token;
        return h;
    }

    async function request(path, options) {
        const base = window.HYICO.getApiBase();
        const opts = options || {};
        const headers = Object.assign(authHeaders(), opts.headers || {});
        let res;
        try {
            res = await fetch(base + path, {
                method: opts.method || 'GET',
                headers: headers,
                body: opts.body ? JSON.stringify(opts.body) : undefined
            });
        } catch (e) {
            window.HYICO.toast(window.HYICO.i18n.errors.network, 'error');
            throw e;
        }

        // 登录接口返回的 401 是「密码错了」，不是「会话过期」。
        // 必须排除掉，否则：真实的 invalid_credentials 永远拿不到（这里抛的是
        // 没有 detail 的通用错误），还会弹一个误导性的「未授权」提示，
        // 并在 600ms 后强制刷新页面、把用户刚填的表单清空。
        const isLoginCall = path === '/api/auth/login';
        if (res.status === 401 && !isLoginCall) {
            window.HYICO.setToken('');
            window.HYICO.setUser(null);
            window.HYICO.toast(window.HYICO.i18n.errors.unauthorized, 'error');
            setTimeout(() => { window.location.href = './login.html'; }, 600);
            throw new Error('unauthorized');
        }

        let data = null;
        try { data = await res.json(); } catch (e) { /* empty body */ }

        if (!res.ok) {
            const detail = (data && data.detail) ? data.detail : ('HTTP ' + res.status);
            const err = new Error(typeof detail === 'string' ? detail : JSON.stringify(detail));
            err.status = res.status;
            err.detail = detail;
            throw err;
        }
        return data;
    }

    window.HYICO.api = {
        request: request,
        get: (p) => request(p),
        post: (p, body) => request(p, { method: 'POST', body: body }),
        patch: (p, body) => request(p, { method: 'PATCH', body: body }),
        del: (p) => request(p, { method: 'DELETE' }),

        login: (server, username, password) => {
            window.HYICO.setServer(server);
            return request('/api/auth/login', {
                method: 'POST',
                body: { username: username, password: password }
            });
        },
        me: () => request('/api/me'),
        health: () => request('/api/health'),
        drones: () => request('/api/drones'),
        drone: (sysid) => request('/api/drones/' + sysid),
        history: (sysid, limit) => request('/api/drones/' + sysid + '/history?limit=' + (limit || 300)),
        alerts: (sysid, active) => request('/api/drones/' + sysid + '/alerts' + (active ? '?active=1' : '')),
        command: (sysid, command, params) => request('/api/drones/' + sysid + '/command', {
            method: 'POST',
            body: { command: command, params: params || {} }
        })
    };
})();

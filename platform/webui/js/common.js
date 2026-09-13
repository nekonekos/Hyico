/* ==========================================================================
 * HyicoPlatform 前端公共库
 * 职责：主题、后端地址管理、格式化工具、导航、提示、i18n 文案加载。
 * 所有页面共享；页面 JS 通过 window.HYICO 调用。
 * ========================================================================== */
(function () {
    'use strict';

    const LS_SERVER = 'hyico-server';
    const LS_THEME = 'hyico-theme';
    const LS_TOKEN = 'hyico-token';
    const LS_USER = 'hyico-user';

    const root = document.documentElement;

    const DEFAULT_I18N = {
        appName: 'HyicoPlatform',
        nav: {
            dashboard: '机队总览',
            logout: '退出登录'
        },
        status: {
            online: '在线',
            offline: '离线',
            armed: '已解锁',
            disarmed: '已上锁'
        },
        alertLevels: {
            info: { label: '提示' },
            warning: { label: '警告' },
            critical: { label: '严重' }
        },
        alertRules: {
            /* 后端 alarm 引擎可能发出的规则名。
               这张表必须跟着后端同步扩——没映射到的规则会直接把内部标识符
               漏到界面上（例如显示成 “battery_low”）。alertRuleLabel() 里
               加了 console.warn，漂移会被看到而不是静默显示错东西。 */
            link_lost: '链路丢失',
            low_battery: '低电量',
            battery_critical: '电量危急',
            gps_lost: 'GPS 丢星',
            gps_weak: '卫星数偏少',
            mode_failsafe: '失控保护',
            attitude_limit: '姿态越限',
            vibration: '振动异常',
            ekf: 'EKF 异常',
            geofence: '越出地理围栏',
            rc_lost: '遥控信号丢失',
            arm: '已解锁',
            disarm: '已上锁'
        },
        modes: {
            STABILIZE: '自稳', ACRO: '特技', ALT_HOLD: '定高', AUTO: '自动',
            GUIDED: '引导', LOITER: '悬停', RTL: '返航', CIRCLE: '绕圈',
            LAND: '降落', DRIFT: '漂移', SPORT: '运动', FLIP: '翻转',
            AUTOTUNE: '自动调参', POSHOLD: '定点', BRAKE: '刹车', THROW: '抛飞',
            AVOID_ADSB: '避让', GUIDED_NOGPS: '无GPS引导', SMART_RTL: '智能返航',
            FLOWHOLD: '光流悬停', FOLLOW: '跟随', ZIGZAG: 'Z字形',
            SYSTEMID: '系统识别', AUTOROTATE: '自旋降落', UNKNOWN: '未知'
        },
        errors: {
            network: '无法连接到后端服务器，请检查地址与网络',
            unauthorized: '登录已过期，请重新登录',
            serverRequired: '请先填写后端服务器地址'
        }
    };

    const HYICO = {
        i18n: DEFAULT_I18N,
        jsonBase: './json'
    };

    // ---------------------------------------------------------------- server
    function normalizeServer(url) {
        if (!url) return '';
        let u = String(url).trim();
        if (!u) return '';
        if (!/^https?:\/\//i.test(u)) u = 'http://' + u;
        return u.replace(/\/+$/, '');
    }

    HYICO.getServer = function () {
        return normalizeServer(localStorage.getItem(LS_SERVER) || '');
    };
    HYICO.setServer = function (url) {
        const u = normalizeServer(url);
        if (u) localStorage.setItem(LS_SERVER, u);
        else localStorage.removeItem(LS_SERVER);
        return u;
    };
    // 后端 API 基址：
    //  - 若用户在登录页手工填写了服务器地址，则用该地址（兼容直连）。
    //  - 否则返回空串，前端用相对路径 /api/... 走本站同源代理
    //    （Cloudflare Pages Functions 会把 /api/* 转发到后端），
    //    从而避免 HTTPS 页面请求 HTTP 的混合内容错误。
    HYICO.getApiBase = function () {
        return HYICO.getServer();
    };

    HYICO.wsUrl = function () {
        const s = HYICO.getServer();
        if (s) return s.replace(/^http/i, 'ws') + '/ws';
        // 未填服务器 => 走同源代理：wss://<当前域名>/ws
        const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
        return proto + '://' + window.location.host + '/ws';
    };

    // ---------------------------------------------------------------- auth
    HYICO.getToken = function () { return localStorage.getItem(LS_TOKEN) || ''; };
    HYICO.setToken = function (t) { t ? localStorage.setItem(LS_TOKEN, t) : localStorage.removeItem(LS_TOKEN); };
    HYICO.getUser = function () {
        try { return JSON.parse(localStorage.getItem(LS_USER) || 'null'); }
        catch (e) { return null; }
    };
    HYICO.setUser = function (u) { u ? localStorage.setItem(LS_USER, JSON.stringify(u)) : localStorage.removeItem(LS_USER); };
    HYICO.logout = function () {
        HYICO.setToken('');
        HYICO.setUser(null);
        window.location.href = './login.html';
    };

    // ---------------------------------------------------------------- theme
    function getPreferredTheme() {
        const stored = localStorage.getItem(LS_THEME);
        if (stored === 'dark' || stored === 'light') return stored;
        return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    HYICO.applyTheme = function (theme) {
        if (theme === 'dark') root.setAttribute('data-theme', 'dark');
        else root.removeAttribute('data-theme');
        localStorage.setItem(LS_THEME, theme);
    };
    HYICO.getTheme = function () {
        return root.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
    };
    HYICO.toggleTheme = function () {
        HYICO.applyTheme(HYICO.getTheme() === 'dark' ? 'light' : 'dark');
    };
    HYICO.initTheme = function () {
        HYICO.applyTheme(getPreferredTheme());
        const toggle = document.getElementById('themeToggle');
        if (toggle) toggle.addEventListener('click', HYICO.toggleTheme);
    };

    // ---------------------------------------------------------------- utils
    HYICO.escapeHtml = function (value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    };

    HYICO.modeLabel = function (mode) {
        const m = HYICO.i18n.modes || {};
        return m[mode] || mode || '未知';
    };
    HYICO.alertRuleLabel = function (rule) {
        const label = (HYICO.i18n.alertRules || {})[rule];
        if (label) return label;
        // 未映射：宁可显示原始标识符（保留信息，便于上报）也不显示一个含糊的
        // 「告警」，但同时要留下痕迹，否则这类漂移会一直没人发现。
        console.warn('[HyicoPlatform] 未映射的告警规则名，请补进 i18n.alertRules：', rule);
        return rule;
    };
    HYICO.alertLevelMeta = function (level) {
        const meta = (HYICO.i18n.alertLevels || {})[level] || {};
        return { label: meta.label || level, color: meta.color || '#64748b' };
    };

    HYICO.fmt = function (value, digits) {
        if (value == null || isNaN(value)) return '--';
        const d = digits == null ? 1 : digits;
        return Number(value).toFixed(d);
    };
    HYICO.fmtInt = function (value) {
        if (value == null || isNaN(value)) return '--';
        return Math.round(Number(value));
    };
    HYICO.fmtVolt = function (v) { return v == null ? '--' : HYICO.fmt(v, 1) + ' V'; };
    HYICO.fmtCurr = function (c) { return c == null ? '--' : HYICO.fmt(c, 1) + ' A'; };
    HYICO.fmtAlt = function (a) { return a == null ? '--' : HYICO.fmt(a, 1) + ' m'; };
    HYICO.fmtSpeed = function (s) { return s == null ? '--' : HYICO.fmt(s, 1) + ' m/s'; };

    HYICO.fmtTime = function (ts) {
        if (!ts) return '--';
        const d = new Date(ts * 1000);
        const p = (n) => String(n).padStart(2, '0');
        return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) +
            ' ' + p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds());
    };
    HYICO.relTime = function (ts) {
        if (!ts) return '--';
        const diff = Math.max(0, Date.now() / 1000 - ts);
        if (diff < 5) return '刚刚';
        if (diff < 60) return Math.floor(diff) + ' 秒前';
        if (diff < 3600) return Math.floor(diff / 60) + ' 分钟前';
        return Math.floor(diff / 3600) + ' 小时前';
    };

    // ---------------------------------------------------------------- toast
    HYICO.toast = function (message, type) {
        let host = document.getElementById('toastHost');
        if (!host) {
            host = document.createElement('div');
            host.id = 'toastHost';
            host.className = 'toast-host';
            document.body.appendChild(host);
        }
        const el = document.createElement('div');
        el.className = 'toast toast--' + (type || 'info');
        el.textContent = message;
        host.appendChild(el);
        setTimeout(() => {
            el.classList.add('toast--out');
            setTimeout(() => el.remove(), 300);
        }, 3200);
    };

    // ---------------------------------------------------------------- i18n

    /** 顶层浅合并 + 嵌套普通对象一层深合并。
        这里必须深合并：alertRules / modes / status 这类**子表**如果被 JSON
        整体替换掉代码里的默认值，两层就会静默漂移。实际撞到过：代码里补到
        13 条告警规则，被 JSON 里只有 5 条的旧表整个盖掉，界面上直接漏出
        “gps_weak”、“arm” 这种内部标识符。
        数组仍然整体替换（不做元素级合并）。 */
    function mergeI18n(base, extra) {
        const out = Object.assign({}, base);
        if (!extra || typeof extra !== 'object') return out;
        Object.keys(extra).forEach(function (key) {
            const a = out[key];
            const b = extra[key];
            const bothPlain = a && b &&
                typeof a === 'object' && typeof b === 'object' &&
                !Array.isArray(a) && !Array.isArray(b);
            out[key] = bothPlain ? Object.assign({}, a, b) : b;
        });
        return out;
    }

    HYICO.loadI18n = async function (extraJson) {
        try {
            const res = await fetch(HYICO.jsonBase + '/common.json', { cache: 'no-cache' });
            if (res.ok) {
                HYICO.i18n = mergeI18n(DEFAULT_I18N, await res.json());
            }
        } catch (e) { /* keep defaults */ }
        if (extraJson) {
            try {
                const res = await fetch(HYICO.jsonBase + '/' + extraJson, { cache: 'no-cache' });
                if (res.ok) {
                    HYICO.i18n = mergeI18n(HYICO.i18n, await res.json());
                }
            } catch (e) { /* keep defaults */ }
        }
        return HYICO.i18n;
    };

    // ---------------------------------------------------------------- nav
    HYICO.renderNav = function (active) {
        const nav = document.getElementById('topNav');
        if (!nav) return;
        const user = HYICO.getUser();
        const i18n = HYICO.i18n;
        nav.innerHTML =
            '<a class="nav__brand" href="./dashboard.html">' +
                '<span class="nav__brand-dot"></span>' + HYICO.escapeHtml(i18n.appName) +
            '</a>' +
            '<div class="nav__links">' +
                '<a class="nav__link' + (active === 'dashboard' ? ' is-active' : '') + '" href="./dashboard.html">' +
                    HYICO.escapeHtml(i18n.nav.dashboard) + '</a>' +
            '</div>' +
            '<div class="nav__right">' +
                '<button id="themeToggle" class="btn btn--ghost" type="button" title="切换主题">' +
                    '<span class="theme-icon" aria-hidden="true"></span></button>' +
                '<span class="nav__user">' + HYICO.escapeHtml(user ? user.username : '') + '</span>' +
                '<button id="logoutBtn" class="btn btn--ghost" type="button">' +
                    HYICO.escapeHtml(i18n.nav.logout) + '</button>' +
            '</div>';
        const lg = document.getElementById('logoutBtn');
        if (lg) lg.addEventListener('click', HYICO.logout);
        const tt = document.getElementById('themeToggle');
        if (tt) tt.addEventListener('click', HYICO.toggleTheme);
    };

    window.HYICO = HYICO;
})();

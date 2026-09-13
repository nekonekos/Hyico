/* ==========================================================================
 * HyicoPlatform 登录页逻辑
 * ========================================================================== */
(function () {
    'use strict';

    document.addEventListener('DOMContentLoaded', async function () {
        await window.HYICO.loadI18n();
        window.HYICO.initTheme();

        const appName = document.getElementById('authAppName');
        const tagline = document.getElementById('authTagline');
        appName.textContent = window.HYICO.i18n.appName;
        tagline.textContent = window.HYICO.i18n.tagline || '无人机运营监管平台';

        const serverInput = document.getElementById('serverInput');
        serverInput.value = window.HYICO.getServer().replace(/^https?:\/\//, '') || '';

        const form = document.getElementById('loginForm');
        const errorBox = document.getElementById('loginError');
        const loginBtn = document.getElementById('loginBtn');

        function showError(msg) {
            errorBox.textContent = msg;
            errorBox.hidden = false;
        }
        function clearError() {
            errorBox.hidden = true;
        }

        form.addEventListener('submit', async function (event) {
            event.preventDefault();
            clearError();

            const server = serverInput.value.trim();
            const username = document.getElementById('usernameInput').value.trim();
            const password = document.getElementById('passwordInput').value;

            if (!username || !password) { showError('请输入用户名和密码'); return; }

            loginBtn.disabled = true;
            loginBtn.textContent = '登录中…';
            try {
                const data = await window.HYICO.api.login(server, username, password);
                window.HYICO.setToken(data.access_token);
                window.HYICO.setUser({ username: data.username, role: data.role });
                window.location.href = './dashboard.html';
            } catch (err) {
                const detail = err.detail;
                if (detail === 'invalid_credentials') showError('用户名或密码错误');
                else if (typeof detail === 'string') showError(detail);
                else showError(window.HYICO.i18n.errors.network);
                loginBtn.disabled = false;
                loginBtn.textContent = '登 录';
            }
        });
    });
})();

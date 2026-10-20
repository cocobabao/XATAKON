(function () {
    'use strict';

    const API_URL = 'http://127.0.0.1:8000';

    const originalFetch = window.fetch;
    window.fetch = function (input, init = {}) {
        const token = localStorage.getItem('jwt_token');
        if (token) {
            const url = typeof input === 'string' ? input : (input.url || '');
            const isApiCall = url.includes('127.0.0.1:8000') || url.includes('/api/');
            const isAuthEndpoint = url.includes('/api/auth/login') || url.includes('/api/auth/register');

            if (isApiCall && !isAuthEndpoint) {
                let headers = init.headers || {};
                if (headers instanceof Headers) {
                    const h = {};
                    headers.forEach((v, k) => h[k] = v);
                    headers = h;
                } else if (Array.isArray(headers)) {
                    const h = {};
                    headers.forEach(([k, v]) => h[k] = v);
                    headers = h;
                } else {
                    headers = { ...headers };
                }

                if (!headers['Authorization'] && !headers['authorization']) {
                    headers['Authorization'] = 'Bearer ' + token;
                }
                init = { ...init, headers };
            }
        }
        return originalFetch.call(this, input, init);
    };

    function updateNav() {
        const token = localStorage.getItem('jwt_token');
        const userSession = localStorage.getItem('user_session');
        if (!token || !userSession) return;

        let user = null;
        try { user = JSON.parse(userSession); } catch (e) { return; }
        const nickname = user.nickname || user.name || 'Пользователь';

        const loginLinks = document.querySelectorAll('a[href*="logreg.html"], a[href*="login.html"], .login-link, #login-link');
        loginLinks.forEach(link => {
            if (link.dataset.replaced === 'true') return;
            link.dataset.replaced = 'true';
            const profileBlock = document.createElement('div');
            profileBlock.className = 'nav-user-profile';
            profileBlock.style.display = 'flex';
            profileBlock.style.alignItems = 'center';
            profileBlock.style.gap = '8px';
            profileBlock.style.marginLeft = '15px';
            
            profileBlock.innerHTML = `
                <span class="user-nickname" style="color: var(--accent); font-weight: 600; background: rgba(117, 221, 210, 0.1); padding: 6px 12px; border-radius: 8px; border: 1px solid rgba(117, 221, 210, 0.3);">👤 ${escapeHtml(nickname)}</span>
                <button class="logout-btn" style="padding: 6px 12px; border-radius: 8px; border: 1px solid rgba(243, 139, 168, 0.3); background: transparent; color: #f38ba8; cursor: pointer;">Выйти</button>
            `;
            
            link.style.display = 'none';
            link.parentNode.insertBefore(profileBlock, link.nextSibling);
            profileBlock.querySelector('.logout-btn').addEventListener('click', () => {
                localStorage.removeItem('jwt_token');
                localStorage.removeItem('user_session');
                window.location.href = 'logreg.html';
            });
        });
    }

    function escapeHtml(str) { const div = document.createElement('div'); div.textContent = str; return div.innerHTML; }

    // 3. ХЕЛПЕРЫ
    window.authGetUser = function () { const s = localStorage.getItem('user_session'); try { return s ? JSON.parse(s) : null; } catch { return null; } };
    window.authGetToken = function () { return localStorage.getItem('jwt_token'); };
    window.authLogout = function () { localStorage.removeItem('jwt_token'); localStorage.removeItem('user_session'); window.location.href = 'logreg.html'; };
    window.authGetUserId = function () { const u = window.authGetUser(); return u ? (u.id || u.user_id) : null; };

    document.addEventListener('DOMContentLoaded', () => { updateNav(); });
})();
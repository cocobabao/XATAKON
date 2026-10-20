(function () {
    'use strict';

    const CONFIG = {
        BACKEND_URL: 'http://127.0.0.1:8000'
    };

    const SafeDOM = {
        showToast(message, type = 'info', duration = 4000) {
            const toast = document.getElementById('toast');
            if (!toast) return;
            toast.textContent = message;
            toast.className = `toast toast-${type} toast-visible`;
            toast.style.display = 'block';
            if (toast._timeout) clearTimeout(toast._timeout);
            toast._timeout = setTimeout(() => {
                toast.style.display = 'none';
                toast.className = 'toast';
            }, duration);
        },
        showFieldError(fieldId, message) {
            const errorEl = document.getElementById(`${fieldId}-error`);
            const inputEl = document.getElementById(fieldId);
            if (errorEl) { errorEl.textContent = message; errorEl.style.display = 'block'; }
            if (inputEl) inputEl.classList.add('input-error');
        },
        clearErrors() {
            document.querySelectorAll('.error-msg').forEach(el => { el.textContent = ''; el.style.display = 'none'; });
            document.querySelectorAll('.input-error').forEach(el => el.classList.remove('input-error'));
        },
        setButtonLoading(buttonId, loading) {
            const btn = document.getElementById(buttonId);
            if (!btn) return;
            if (loading) {
                btn.dataset.originalText = btn.textContent;
                btn.textContent = 'Загрузка...';
                btn.disabled = true;
                btn.classList.add('btn-loading');
            } else {
                btn.textContent = btn.dataset.originalText || '';
                btn.disabled = false;
                btn.classList.remove('btn-loading');
            }
        }
    };

    const Forms = {
        initRegisterForm() {
            const form = document.getElementById('registerForm');
            if (!form) return;
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                SafeDOM.clearErrors();
                
                const nickname = document.getElementById('reg-name').value.trim();
                const email = document.getElementById('reg-email').value.trim();
                const password = document.getElementById('reg-pass').value;

                if (nickname.length < 3) {
                    SafeDOM.showFieldError('reg-name', 'Никнейм должен быть от 3 символов');
                    return;
                }

                const emailRegex = /^[a-zA-Z0-9._%+-]{3,}@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
                if (!emailRegex.test(email)) {
                    SafeDOM.showFieldError('reg-email', 'Email должен быть от 3 символов до @ и иметь точку после (например: name@mail.ru)');
                    return;
                }


                if (password.length < 4) {
                    SafeDOM.showFieldError('reg-pass', 'Пароль должен быть от 4 символов');
                    return;
                }

                SafeDOM.setButtonLoading('registerBtn', true);

                try {
                    const response = await fetch(`${CONFIG.BACKEND_URL}/api/auth/register`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ nickname, email, password })
                    });
                    
                    const data = await response.json();
                    
                    if (data.success) {
                        SafeDOM.showToast(`✅ ${data.message}`, 'success');
                        form.reset();
                        localStorage.setItem('jwt_token', data.token);
                        localStorage.setItem('user_session', JSON.stringify(data.user));
                        
                        setTimeout(() => {
                            window.location.href = 'gamelist.html';
                        }, 1200);
                    } else {
                        SafeDOM.showToast(`❌ ${data.message}`, 'error');
                    }
                } catch (error) {
                    SafeDOM.showToast('Ошибка подключения к серверу', 'error');
                } finally {
                    SafeDOM.setButtonLoading('registerBtn', false);
                }
            });
        },

                initLoginForm() {
            const form = document.getElementById('loginForm');
            if (!form) return;
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                SafeDOM.clearErrors();
                
                const email = document.getElementById('login-email').value.trim();
                const password = document.getElementById('login-pass').value;

                if (!email || !password) {
                    SafeDOM.showToast('Введите email и пароль', 'error');
                    return;
                }

                // Проверяем, что это действительно email
                const emailRegex = /^[a-zA-Z0-9._%+-]{3,}@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
                if (!emailRegex.test(email)) {
                    SafeDOM.showToast('Введите корректный email', 'error');
                    return;
                }

                SafeDOM.setButtonLoading('loginBtn', true);

                try {
                    const response = await fetch(`${CONFIG.BACKEND_URL}/api/auth/login`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ email, password }) // Отправляем email
                    });
                    
                    const data = await response.json();
                    
                    if (data.success) {
                        SafeDOM.showToast(`✅ Добро пожаловать, ${data.user.nickname}!`, 'success');
                        localStorage.setItem('jwt_token', data.token);
                        localStorage.setItem('user_session', JSON.stringify(data.user));
                        setTimeout(() => {
                            window.location.href = 'gamelist.html';
                        }, 1000);
                    } else {
                        SafeDOM.showToast(`❌ ${data.message}`, 'error');
                    }
                } catch (error) {
                    SafeDOM.showToast('Ошибка подключения к серверу', 'error');
                } finally {
                    SafeDOM.setButtonLoading('loginBtn', false);
                }
            });
        }
    };

    const Theme = {
        init() {
            const savedTheme = localStorage.getItem('theme');
            document.body.setAttribute('data-theme', savedTheme === 'light' ? 'light' : 'dark');
            const toggle = document.getElementById('themeToggle');
            if (toggle) {
                toggle.addEventListener('click', () => {
                    const newTheme = document.body.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
                    document.body.setAttribute('data-theme', newTheme);
                    localStorage.setItem('theme', newTheme);
                });
            }
        }
    };

    document.addEventListener('DOMContentLoaded', () => {
        Theme.init();
        Forms.initRegisterForm();
        Forms.initLoginForm();
    });

})();
document.addEventListener('DOMContentLoaded', () => {
    const API_URL = 'http://127.0.0.1:8000';

    const themeToggle = document.getElementById('theme-toggle');
    const iconMoon = document.getElementById('icon-moon');
    const iconSun = document.getElementById('icon-sun');
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'light') {
        document.body.classList.add('light-theme');
        if (iconMoon) iconMoon.style.display = 'none';
        if (iconSun) iconSun.style.display = 'block';
    }
    if (themeToggle) {
        themeToggle.addEventListener('click', () => {
            document.body.classList.toggle('light-theme');
            const isLight = document.body.classList.contains('light-theme');
            if (isLight) {
                if (iconMoon) iconMoon.style.display = 'none';
                if (iconSun) iconSun.style.display = 'block';
                localStorage.setItem('theme', 'light');
            } else {
                if (iconMoon) iconMoon.style.display = 'block';
                if (iconSun) iconSun.style.display = 'none';
                localStorage.setItem('theme', 'dark');
            }
        });
    }

    const container = document.getElementById('achievements-list');
    const tabBtns = document.querySelectorAll('.tab-btn');
    let currentTab = 'achievements';

    async function loadProfile() {
        try {
            const response = await fetch(`${API_URL}/api/auth/profile`);
            if (!response.ok) { if (response.status === 401) window.location.href = 'logreg.html'; return; }
            const data = await response.json();
            
            if (data.success) {
                const user = data.user;
                const bestStreak = user.best_streak || 0;
                const currentStreak = user.current_streak || 0; 
                
                document.getElementById('profile-username').textContent = user.nickname;
                document.getElementById('profile-level').textContent = user.level;
                
                const maxXp = 500 * Math.pow(2, user.level); 
                document.getElementById('profile-xp').textContent = `${user.xp} / ${maxXp} XP`;
                
                const progressBar = document.getElementById('profile-level-bar');
                const percent = Math.min((user.xp / maxXp) * 100, 100);
                progressBar.setAttribute('data-width', percent);
                progressBar.style.width = percent + '%';

                if (typeof ACHIEVEMENTS !== 'undefined') {
                    ACHIEVEMENTS.forEach(ach => {
                        const unlockedAt = data.unlocked_achievements[ach.id];
                        ach.unlocked = !!unlockedAt;
                        ach.unlockedDate = unlockedAt || null;
                        
                        if (ach.type === 'streak') {
                            ach.progress.current = Math.min(currentStreak, ach.target);
                        } else {
                            ach.progress.current = ach.unlocked ? 1 : 0; 
                        }
                    });
                }
            }
        } catch (error) { console.error("Ошибка загрузки профиля:", error); }
    }

    const levelProgress = document.querySelector('.level-progress');
    if (levelProgress) {
        setTimeout(() => {
            const width = levelProgress.getAttribute('data-width') || 0;
            levelProgress.style.width = width + '%';
        }, 200);
    }

    if (typeof ACHIEVEMENTS === 'undefined' || !Array.isArray(ACHIEVEMENTS)) {
        container.innerHTML = '<div class="loading">Ошибка: данные не загружены. Проверьте data.js</div>';
        return;
    }

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tabBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentTab = btn.getAttribute('data-tab');
            renderAchievements(currentTab);
        });
    });

    function renderAchievements(tab) {
        let filtered = tab === 'progress'
            ? ACHIEVEMENTS.filter(a => !a.unlocked)
            : ACHIEVEMENTS.filter(a => a.unlocked);

        if (tab === 'progress') {
            filtered.sort((a, b) => {
                const remainingA = a.progress ? (a.progress.required - a.progress.current) : Infinity;
                const remainingB = b.progress ? (b.progress.required - b.progress.current) : Infinity;
                return remainingA - remainingB;
            });
        }

        if (filtered.length === 0) {
            const message = tab === 'progress' ? 'Все достижения получены! 🎉' : 'Пока нет полученных достижений';
            container.innerHTML = `<div class="empty-state">${message}</div>`;
            return;
        }

        container.innerHTML = filtered.map(a => {
            const isProgress = tab === 'progress';
            const percent = a.progress && a.progress.required > 0
                ? Math.min((a.progress.current / a.progress.required) * 100, 100)
                : 0;
            const remaining = a.progress ? (a.progress.required - a.progress.current) : 0;

            let rightLabel = '';
            if (a.unlocked) {
                rightLabel = a.unlockedDate
                    ? `<span class="achievement-date">Выполнено ${a.unlockedDate.split(' ')[0]}</span>`
                    : `<span class="achievement-date">Выполнено</span>`;
            } else {
                rightLabel = `<span class="achievement-date">Осталось: ${remaining}</span>`;
            }

            return `
            <div class="achievement-card">
                <div class="achievement-icon">${a.icon || ''}</div>
                <div class="achievement-content">
                    <div class="achievement-header">
                        <h3 class="achievement-title">${a.title}</h3>
                        ${rightLabel}
                    </div>
                    <p class="achievement-description">${a.description}</p>
                    ${isProgress && a.progress
                        ? `<div class="progress-bar-container">
                            <div class="progress-bar-track">
                                <div class="progress-bar-fill" style="width: ${percent}%">
                                    <span class="progress-bar-current">${a.progress.current}</span>
                                </div>
                            </div>
                            <span class="progress-bar-total">${a.progress.required}</span>
                           </div>`
                        : ''}
                </div>
            </div>`;
        }).join('');

        requestAnimationFrame(() => {
            const cards = container.querySelectorAll('.achievement-card');
            cards.forEach((card, i) => { setTimeout(() => { card.classList.add('visible'); }, i * 50); });
            const fills = container.querySelectorAll('.progress-bar-fill');
            fills.forEach(fill => {
                const targetWidth = fill.style.width;
                fill.style.width = '0%';
                requestAnimationFrame(() => {
                    fill.style.transition = 'width 0.8s cubic-bezier(0.4, 0, 0.2, 1)';
                    fill.style.width = targetWidth;
                });
            });
        });
    }

    loadProfile().then(() => {
        renderAchievements(currentTab);
    });
});
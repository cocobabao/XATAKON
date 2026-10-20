document.addEventListener('DOMContentLoaded', () => {

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

    const levelProgress = document.querySelector('.level-progress');
    if (levelProgress) {
        const width = levelProgress.getAttribute('data-width');
        setTimeout(() => {
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

    renderAchievements(currentTab);

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

        if (tab === 'achievements') {
            filtered.sort((a, b) => {
                const dateA = parseDate(a.unlockedDate);
                const dateB = parseDate(b.unlockedDate);
                return dateB - dateA;
            });
        }

        if (filtered.length === 0) {
            const message = tab === 'progress'
                ? 'Все достижения получены! 🎉'
                : 'Пока нет полученных достижений';
            container.innerHTML = `<div class="empty-state">${message}</div>`;
            return;
        }

        container.innerHTML = filtered.map(a => {
            const isProgress = tab === 'progress';
            const percent = a.progress
                ? Math.min((a.progress.current / a.progress.required) * 100, 100)
                : 0;
            const remaining = a.progress ? (a.progress.required - a.progress.current) : 0;

            let rightLabel = '';
            if (a.unlocked) {
                rightLabel = a.unlockedDate
                    ? `<span class="achievement-date">Выполнено ${a.unlockedDate}</span>`
                    : '';
            } else {
                rightLabel = `<span class="achievement-date">Осталось: ${remaining}</span>`;
            }

            let playersText = '';
            if (a.playersUnlocked !== null && a.playersUnlocked !== undefined) {
                const pct = a.totalPlayers
                    ? (a.playersUnlocked / a.totalPlayers * 100).toFixed(3) + '%'
                    : '';
                playersText = `${a.playersUnlocked}${pct ? ' (' + pct + ')' : ''}`;
            } else {
                playersText = 'None';
            }

            return `
            <div class="achievement-card">
                <div class="achievement-icon">
                    ${a.icon || ''}
                </div>
                <div class="achievement-content">
                    <div class="achievement-header">
                        <h3 class="achievement-title">${a.title}</h3>
                        ${rightLabel}
                    </div>
                    <p class="achievement-description">${a.description}</p>
                    <div class="achievement-stats">
                        <div class="achievement-stat">
                            <span>Игроков получило:</span>
                            <span class="achievement-stat-value">${playersText}</span>
                        </div>
                    </div>
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
            cards.forEach((card, i) => {
                setTimeout(() => {
                    card.classList.add('visible');
                }, i * 50);
            });

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
});

function parseDate(dateStr) {
    if (!dateStr || dateStr === 'None') return new Date(0);
    const parts = dateStr.split('.');
    if (parts.length !== 3) return new Date(0);
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const year = parseInt(parts[2], 10);
    return new Date(year, month, day);
}
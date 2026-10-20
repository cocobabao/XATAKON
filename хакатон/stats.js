document.addEventListener('DOMContentLoaded', () => {
    const API_URL = 'http://127.0.0.1:8000';
    let myChart = null; 

    const tabBtns = document.querySelectorAll('.tabs > .tab-btn');
    const contents = document.querySelectorAll('.stat-content');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tabBtns.forEach(b => b.classList.remove('active'));
            contents.forEach(c => c.classList.remove('active'));

            btn.classList.add('active');
            const targetId = 'tab-' + btn.getAttribute('data-stat-tab');
            const targetContent = document.getElementById(targetId);
            if (targetContent) targetContent.classList.add('active');
            
            if (btn.getAttribute('data-stat-tab') === 'charts' && !myChart) {
                loadChartData('day'); 
            }
        });
    });

    const chartPeriodBtns = document.querySelectorAll('.chart-period-btn');
    const chartSubtitle = document.getElementById('chart-subtitle');

    chartPeriodBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            chartPeriodBtns.forEach(b => {
                b.classList.remove('active');
                b.style.borderColor = 'var(--border)';
                b.style.background = 'transparent';
                b.style.color = 'var(--text-color)';
            });
            
            btn.classList.add('active');
            btn.style.borderColor = 'var(--accent)';
            btn.style.background = 'rgba(117, 221, 210, 0.1)';
            btn.style.color = 'var(--accent)';

            const period = btn.dataset.period;
            if (period === 'day') chartSubtitle.textContent = 'За сегодняшний день';
            else if (period === 'month') chartSubtitle.textContent = 'За последние 30 дней';
            else chartSubtitle.textContent = 'За всё время';

            loadChartData(period);
        });
    });

    const themeToggle = document.getElementById('theme-toggle');
    const iconMoon = document.getElementById('icon-moon');
    const iconSun = document.getElementById('icon-sun');
    
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'light') {
        document.body.classList.add('light-theme');
        if(iconMoon) iconMoon.style.display = 'none';
        if(iconSun) iconSun.style.display = 'block';
    }

    if (themeToggle) {
        themeToggle.addEventListener('click', () => {
            document.body.classList.toggle('light-theme');
            const isLight = document.body.classList.contains('light-theme');
            
            if (isLight) {
                if(iconMoon) iconMoon.style.display = 'none';
                if(iconSun) iconSun.style.display = 'block';
                localStorage.setItem('theme', 'light');
            } else {
                if(iconMoon) iconMoon.style.display = 'block';
                if(iconSun) iconSun.style.display = 'none';
                localStorage.setItem('theme', 'dark');
            }
            if (myChart) updateChartTheme();
        });
    }

    async function loadStats() {
        try {
            const response = await fetch(`${API_URL}/api/auth/stats`);
            if (!response.ok) { if (response.status === 401) window.location.href = 'logreg.html'; return; }
            const data = await response.json();
            if (data.success) {
                renderSession(data.stats.session);
                renderOverall(data.stats.overall);
                renderDetails(data.stats.details);
            }
        } catch (error) { console.error("Ошибка статистики:", error); }
    }

    async function loadChartData(period = 'day') {
        try {
            const response = await fetch(`${API_URL}/api/auth/chart-data?period=${period}`);
            if (!response.ok) return;
            const data = await response.json();
            
            if (data.success) {
                document.getElementById('chart-placeholder').style.display = 'none';
                renderChart(data.labels, data.wpm, data.accuracy);
            }
        } catch (error) { console.error("Ошибка графика:", error); }
    }

    function renderChart(labels, wpmData, accuracyData) {
        const ctx = document.getElementById('speedChart').getContext('2d');
        const isLight = document.body.classList.contains('light-theme');
        
        const gridColor = isLight ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.05)';
        const textColor = isLight ? '#475569' : '#858dbd';
        const accentColor = isLight ? '#0ea5e9' : '#75ddd2'; 
        const purpleColor = isLight ? '#6366f1' : '#8889c9'; 

        if (myChart) myChart.destroy(); 

        myChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels.length > 0 ? labels : ['Нет данных'],
                datasets: [
                    {
                        label: 'Скорость (WPM)',
                        data: wpmData.length > 0 ? wpmData : [0],
                        borderColor: accentColor,
                        backgroundColor: isLight ? 'rgba(14, 165, 233, 0.1)' : 'rgba(117, 221, 210, 0.1)',
                        borderWidth: 3,
                        tension: 0.3, 
                        pointRadius: 4, 
                        pointHoverRadius: 6,
                        pointBackgroundColor: accentColor,
                        yAxisID: 'y'
                    },
                    {
                        label: 'Точность (%)',
                        data: accuracyData.length > 0 ? accuracyData : [0],
                        borderColor: purpleColor,
                        backgroundColor: 'transparent',
                        borderWidth: 2,
                        borderDash: [5, 5],
                        tension: 0.3,
                        pointRadius: 3,
                        pointBackgroundColor: purpleColor,
                        yAxisID: 'y1'
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                plugins: {
                    legend: { labels: { color: textColor, font: { family: 'Inter' } } },
                    tooltip: {
                        backgroundColor: isLight ? '#ffffff' : '#151a2c',
                        titleColor: isLight ? '#0f172a' : '#f0f1fa',
                        bodyColor: textColor,
                        borderColor: gridColor,
                        borderWidth: 1
                    }
                },
                scales: {
                    x: { 
                        grid: { color: gridColor }, 
                        ticks: { color: textColor, maxTicksLimit: 12 } 
                    },
                    y: {
                        type: 'linear',
                        display: true,
                        position: 'left',
                        grid: { color: gridColor },
                        ticks: { color: textColor },
                        title: { display: true, text: 'Скорость (WPM)', color: textColor }
                    },
                    y1: {
                        type: 'linear',
                        display: true,
                        position: 'right',
                        grid: { drawOnChartArea: false },
                        ticks: { color: textColor },
                        title: { display: true, text: 'Точность (%)', color: textColor },
                        min: 0,
                        max: 100
                    }
                }
            }
        });
    }

    function updateChartTheme() {
        if (!myChart) return;
        const isLight = document.body.classList.contains('light-theme');
        const gridColor = isLight ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.05)';
        const textColor = isLight ? '#475569' : '#858dbd';
        
        myChart.options.scales.x.grid.color = gridColor;
        myChart.options.scales.x.ticks.color = textColor;
        myChart.options.scales.y.grid.color = gridColor;
        myChart.options.scales.y.ticks.color = textColor;
        myChart.options.scales.y1.ticks.color = textColor;
        myChart.options.plugins.legend.labels.color = textColor;
        myChart.data.datasets[0].borderColor = isLight ? '#0ea5e9' : '#75ddd2';
        myChart.data.datasets[1].borderColor = isLight ? '#6366f1' : '#8889c9';
        myChart.update();
    }

    function renderSession(session) {
        const grid = document.getElementById('session-grid');
        grid.innerHTML = `
            <div class="stat-card panel">
                <span class="stat-label">Рекордная скорость</span>
                <div class="stat-value">${session.record_wpm} <span class="stat-unit">слов/мин</span></div>
                <div class="stat-sub">${session.record_cpm} символов/мин</div>
            </div>
            <div class="stat-card panel">
                <span class="stat-label">Точность (Сегодня)</span>
                <div class="stat-value accent-text">${session.today_accuracy}<span class="stat-unit">%</span></div>
                <div class="stat-sub">За текущий день</div>
            </div>
            <div class="stat-card panel">
                <span class="stat-label">Ошибки (Сегодня)</span>
                <div class="stat-value error-text">${session.today_errors}</div>
                <div class="stat-sub">Допущено за сегодня</div>
            </div>
        `;
    }

    function renderOverall(overall) {
        const grid = document.getElementById('overall-grid');
        grid.innerHTML = `
            <div class="stat-card panel">
                <span class="stat-label">Всего тренировок</span>
                <div class="stat-value">${overall.tests}</div>
                <div class="stat-sub">За всё время</div>
            </div>
            <div class="stat-card panel">
                <span class="stat-label">Общее время</span>
                <div class="stat-value">${overall.time}</div>
                <div class="stat-sub">Проведено за клавиатурой</div>
            </div>
            <div class="stat-card panel">
                <span class="stat-label">Средняя скорость</span>
                <div class="stat-value">${overall.avgWpm} <span class="stat-unit">слов/мин</span></div>
                <div class="stat-sub">За всё время</div>
            </div>
        `;
    }

    function renderDetails(details) {
        const grid = document.getElementById('key-grid');
        if (!details || details.length === 0) {
            grid.innerHTML = '<div class="empty-state" style="grid-column: 1 / -1;">Пока нет данных об ошибках. Сыграйте несколько заездов!</div>';
            return;
        }
        
        const maxErrors = Math.max(...details.map(d => d.rate));
        
        grid.innerHTML = details.map(item => {
            let severity = 'low';
            if (item.rate >= maxErrors * 0.7) severity = 'high';
            else if (item.rate >= maxErrors * 0.3) severity = 'medium';

            return `
            <div class="key-item ${severity}-error">
                <span class="key-char">${item.char}</span>
                <span class="key-error-rate">${item.rate}</span>
            </div>
            `;
        }).join('');
    }

    loadStats();
});
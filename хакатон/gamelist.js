document.addEventListener('DOMContentLoaded', () => {
    const API_URL = 'http://127.0.0.1:8000'; 
    const USER_ID = (window.authGetUserId && window.authGetUserId()) || 0; 

    let currentMode = 'words';
    let currentLang = 'russian'; 
    let currentGameId = null;
    let currentWords = [];
    let currentWordIndex = 0; 
    let isGameActive = false;
    let isSubmitting = false; 
    let typedWord = ""; 
    let firstLetterTyped = false;
    
    let totalTyped = 0;   
    let correctTyped = 0; 
    let hasErrorInCurrentWord = false; 
    let hadErrorInGame = false; 
    
    const COMBO_THRESHOLD = 300;

    const streakStorageKey = `keyflow_current_streak_${USER_ID}`;
    let currentStreak = Math.max(0, Number.parseInt(localStorage.getItem(streakStorageKey) || '0', 10) || 0);
    let maxStreak = currentStreak;
    let comboModeActive = currentStreak >= COMBO_THRESHOLD;

    let symSettings = { letters: true, numbers: true, specials: true };
    let currentKeyboardLayout = 'russian'; 
    let highlightMode = localStorage.getItem('keyboardHighlightMode') || 'key';
    let isKeyboardVisible = localStorage.getItem('keyboardVisible') !== 'false';

    const typingArea = document.getElementById('typing-area');
    const modeBtns = document.querySelectorAll('#mode-group .toolbar-btn');
    const dynamicSettings = document.getElementById('dynamic-settings');
    const resultsScreen = document.getElementById('results-screen');
    const hiddenInput = document.getElementById('hidden-input');
    const keyboardContainer = document.getElementById('keyboard');
    const toggleKeyboardBtn = document.getElementById('toggle-keyboard-btn');
    const toggleHighlightModeBtn = document.getElementById('toggle-highlight-mode');

    function updateHighlightModeButton() {
        if (toggleHighlightModeBtn) toggleHighlightModeBtn.textContent = highlightMode === 'key' ? 'Клавиша' : 'Слово';
    }
    if (toggleHighlightModeBtn) {
        toggleHighlightModeBtn.addEventListener('click', () => {
            highlightMode = highlightMode === 'key' ? 'word' : 'key';
            localStorage.setItem('keyboardHighlightMode', highlightMode);
            updateHighlightModeButton(); updateVisuals(); 
            if (hiddenInput) hiddenInput.focus();
        });
    }
    updateHighlightModeButton();

    function updateKeyboardVisibility() {
        if (!keyboardContainer) return;
        keyboardContainer.style.display = isKeyboardVisible ? 'flex' : 'none';
        if (toggleKeyboardBtn) toggleKeyboardBtn.textContent = isKeyboardVisible ? 'Скрыть клавиатуру' : 'Показать клавиатуру';
    }
    if (toggleKeyboardBtn) {
        toggleKeyboardBtn.addEventListener('click', () => {
            isKeyboardVisible = !isKeyboardVisible;
            localStorage.setItem('keyboardVisible', isKeyboardVisible);
            updateKeyboardVisibility();
            if (hiddenInput) hiddenInput.focus();
        });
    }
    updateKeyboardVisibility();

    document.addEventListener('mousedown', (e) => {
        if (e.target.closest('.toolbar-btn') || e.target.closest('.nav-link') || e.target.closest('.theme-toggle') || e.target.closest('.restart-btn')) return;
        if (hiddenInput) { e.preventDefault(); hiddenInput.focus(); }
    });
    window.addEventListener('blur', () => { setTimeout(() => { if (hiddenInput) hiddenInput.focus(); }, 10); });

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
        });
    }

    function updateToolbar() {
        dynamicSettings.innerHTML = '';
        if (currentMode === 'words' || currentMode === 'sentences') {
            dynamicSettings.innerHTML = `
                <button class="toolbar-btn ${currentLang === 'russian' ? 'active' : ''}" data-lang="russian">RU</button>
                <button class="toolbar-btn ${currentLang === 'english' ? 'active' : ''}" data-lang="english">EN</button>
            `;
            dynamicSettings.querySelectorAll('[data-lang]').forEach(btn => {
                btn.addEventListener('click', () => { currentLang = btn.dataset.lang; updateToolbar(); startGameRequest(); });
            });
        } else if (currentMode === 'symbols') {
            dynamicSettings.innerHTML = `
                <button class="toolbar-btn ${symSettings.letters ? 'active' : ''}" data-sym="letters">Буквы</button>
                <button class="toolbar-btn ${symSettings.numbers ? 'active' : ''}" data-sym="numbers">Цифры</button>
                <button class="toolbar-btn ${symSettings.specials ? 'active' : ''}" data-sym="specials">Спец</button>
            `;
            dynamicSettings.querySelectorAll('[data-sym]').forEach(btn => {
                btn.addEventListener('click', () => {
                    const key = btn.dataset.sym;
                    if (symSettings[key] && Object.values(symSettings).filter(v => v).length === 1) return;
                    symSettings[key] = !symSettings[key]; updateToolbar(); startGameRequest();
                });
            });
        } 
    }

    function renderKeyboard(layout) {
        if (!keyboardContainer) return;
        keyboardContainer.innerHTML = '';
        const rows = layout === 'russian' ? [
            ['ё', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-', '=', 'backspace'],
            ['й', 'ц', 'у', 'к', 'е', 'н', 'г', 'ш', 'щ', 'з', 'х', 'ъ'],
            ['ф', 'ы', 'в', 'а', 'п', 'р', 'о', 'л', 'д', 'ж', 'э'],
            ['shift', 'я', 'ч', 'с', 'м', 'и', 'т', 'ь', 'б', 'ю', '.', ','],
            [' ']
        ] : [
            ['`', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-', '=', 'backspace'],
            ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p', '[', ']', '\\'],
            ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', ';', "'"],
            ['shift', 'z', 'x', 'c', 'v', 'b', 'n', 'm', ',', '.', '/'],
            [' ']
        ];

        const fingerForPosition = (rowIndex, columnIndex, key) => {
            if (key === ' ') return 'finger-thumb';
            if (key === 'backspace') return 'finger-pinky-right';
            if (key === 'shift') return columnIndex === 0 ? 'finger-pinky' : 'finger-pinky-right';
            const russian = layout === 'russian';


            if (russian) {
                const normalizedKey = String(key).toLowerCase();

                if (normalizedKey === 'з') return 'finger-pinky-right';
                if (['8', 'ш', 'л', 'б'].includes(normalizedKey)) return 'finger-middle';
                if (['9', 'щ', 'д', 'ю'].includes(normalizedKey)) return 'finger-ring';
            }
            if (rowIndex === 0) {
                if (columnIndex <= 1) return 'finger-pinky';
                if (columnIndex === 2) return 'finger-ring';
                if (columnIndex === 3) return 'finger-middle';
                if (columnIndex <= 5) return 'finger-index';
                if (columnIndex <= 7) return 'finger-index-right';
                if (columnIndex === 8) return 'finger-middle-right';
                if (columnIndex === 9) return 'finger-ring-right';
                return 'finger-pinky-right';
            }
            if (rowIndex === 1) {
                if (columnIndex === 0) return 'finger-pinky';
                if (columnIndex === 1) return 'finger-ring';
                if (columnIndex === 2) return 'finger-middle';

                if (russian && columnIndex <= 5) return 'finger-index';
                if (!russian && columnIndex <= 4) return 'finger-index';
                if (columnIndex <= 7) return 'finger-index-right';
                if (columnIndex === 8) return 'finger-middle-right';
                if (columnIndex === 9) return 'finger-ring-right';
                return 'finger-pinky-right';
            }
            if (rowIndex === 2) {
                if (columnIndex === 0) return 'finger-pinky';
                if (columnIndex === 1) return 'finger-ring';
                if (columnIndex === 2) return 'finger-middle';
                if (columnIndex <= 4) return 'finger-index';
                if (columnIndex <= 6) return 'finger-index-right';
                if (columnIndex === 7) return 'finger-middle-right';
                if (columnIndex === 8) return 'finger-ring-right';
                return 'finger-pinky-right';
            }
            if (rowIndex === 3) {

                if (columnIndex <= 1) return 'finger-pinky';
                if (columnIndex === 2) return 'finger-ring';
                if (columnIndex === 3) return 'finger-middle';
                if (columnIndex <= 5) return 'finger-index';
                if (columnIndex <= 7) return 'finger-index-right';
                if (columnIndex === 8) return 'finger-middle-right';
                if (columnIndex === 9) return 'finger-ring-right';
                return 'finger-pinky-right';
            }
            return 'finger-thumb';
        };
        rows.forEach((row, rowIndex) => {
            const rowDiv = document.createElement('div'); rowDiv.className = 'keyboard-row';
            row.forEach((key, columnIndex) => {
                const keyDiv = document.createElement('div'); keyDiv.className = 'key';
                const fingerClass = fingerForPosition(rowIndex, columnIndex, key);
                keyDiv.classList.add(fingerClass);
                if (key === 'backspace') { keyDiv.classList.add('backspace-key'); keyDiv.textContent = '⌫'; }
                else if (key === 'shift') { keyDiv.classList.add('shift-key'); keyDiv.textContent = '⇧ Shift'; }
                else if (key === ' ') { keyDiv.classList.add('space-key'); keyDiv.textContent = 'Пробел'; }
                else { keyDiv.textContent = key; }
                keyDiv.dataset.key = key.toLowerCase();
                keyDiv.dataset.finger = fingerClass.replace('finger-', '');
                keyDiv.title = key === ' ' ? 'Большие пальцы' : `Нажимать: ${fingerClass.includes('pinky') ? 'мизинец' : fingerClass.includes('ring') ? 'безымянный' : fingerClass.includes('middle') ? 'средний' : fingerClass.includes('index') ? 'указательный' : 'большой палец'}`;
                rowDiv.appendChild(keyDiv);
            });
            keyboardContainer.appendChild(rowDiv);
        });
    }

    function highlightCharOnKeyboard(char) {
        let searchChar = char.toLowerCase();
        let needsShift = char !== char.toLowerCase() && char !== ' ';
        const russianShiftMap = {
            '!': '1', '"': '2', '№': '3', ';': '4', '%': '5', ':': '6', '?': '7',
            '*': '8', '(': '9', ')': '0', '_': '-', '+': '=', ',': '.',
            'Ё': 'ё', 'Й': 'й', 'Ц': 'ц', 'У': 'у', 'К': 'к', 'Е': 'е', 'Н': 'н',
            'Г': 'г', 'Ш': 'ш', 'Щ': 'щ', 'З': 'з', 'Х': 'х', 'Ъ': 'ъ',
            'Ф': 'ф', 'Ы': 'ы', 'В': 'в', 'А': 'а', 'П': 'п', 'Р': 'р', 'О': 'о',
            'Л': 'л', 'Д': 'д', 'Ж': 'ж', 'Э': 'э', 'Я': 'я', 'Ч': 'ч', 'С': 'с',
            'М': 'м', 'И': 'и', 'Т': 'т', 'Ь': 'ь', 'Б': 'б', 'Ю': 'ю'
        };
        const englishShiftMap = {
            '!': '1', '@': '2', '#': '3', '$': '4', '%': '5', '^': '6', '&': '7',
            '*': '8', '(': '9', ')': '0', '_': '-', '+': '=', '{': '[', '}': ']',
            ':': ';', '"': "'", '<': ',', '>': '.', '?': '/', '~': '`', '|': '\\'
        };
        const shiftMap = currentKeyboardLayout === 'russian' ? russianShiftMap : englishShiftMap;
        if (Object.prototype.hasOwnProperty.call(shiftMap, char)) {
            searchChar = shiftMap[char];
            needsShift = true;
        }
        const keyElement = Array.from(document.querySelectorAll('.key')).find(key => key.dataset.key === searchChar);
        if (keyElement) keyElement.classList.add('key-highlight');
        return needsShift;
    }

    function highlightNextKey() {
        document.querySelectorAll('.key').forEach(k => k.classList.remove('key-highlight'));
        if (!isGameActive || !isKeyboardVisible) return;
        const targetWord = currentWords[currentWordIndex];
        if (!targetWord) return;
        let hasError = false;
        for (let i = 0; i < typedWord.length; i++) { if (typedWord[i] !== targetWord[i]) { hasError = true; break; } }
        if (hasError) {
            const backspaceKey = document.querySelector(`.key[data-key="backspace"]`);
            if (backspaceKey) backspaceKey.classList.add('key-highlight');
            return;
        }
        let nextChar = ' ';
        if (typedWord.length < targetWord.length) nextChar = targetWord[typedWord.length];

        let requiredLayout = currentKeyboardLayout;
        if (/[а-яё]/i.test(nextChar)) requiredLayout = 'russian';
        else if (/[a-z]/i.test(nextChar)) requiredLayout = 'english';
        else if (currentMode === 'words' || currentMode === 'sentences') requiredLayout = currentLang;
        if (currentKeyboardLayout !== requiredLayout) { currentKeyboardLayout = requiredLayout; renderKeyboard(currentKeyboardLayout); }
        let needsShift = highlightCharOnKeyboard(nextChar);
        if (nextChar === ' ') { const spaceKey = document.querySelector(`.key[data-key=" "]`); if (spaceKey) spaceKey.classList.add('key-highlight'); }
        if (needsShift) { const shiftKey = document.querySelector(`.key[data-key="shift"]`); if (shiftKey) shiftKey.classList.add('key-highlight'); }
    }

    async function startGameRequest() {
        isGameActive = false; isSubmitting = false; typedWord = ""; firstLetterTyped = false;
        totalTyped = 0; correctTyped = 0; hasErrorInCurrentWord = false;
        currentStreak = Math.max(0, Number.parseInt(localStorage.getItem(streakStorageKey) || '0', 10) || 0);
        maxStreak = currentStreak;
        comboModeActive = currentStreak >= COMBO_THRESHOLD;
        const oldComboBanner = document.getElementById('combo-mode-banner');
        if (oldComboBanner) oldComboBanner.remove();
        hadErrorInGame = false; 
        currentKeyboardLayout = currentLang;
        
        if (resultsScreen) resultsScreen.style.display = 'none';
        typingArea.style.display = 'block'; updateKeyboardVisibility();
        typingArea.innerHTML = `<div class="loading-text">Загрузка...</div>`; currentWordIndex = 0;

        try {
            let url = `${API_URL}/api/game?mode=${currentMode}&language=${currentLang}`;
            if (currentMode === 'symbols') url += `&letters=${symSettings.letters}&numbers=${symSettings.numbers}&specials=${symSettings.specials}`;
            const response = await fetch(url);
            if (!response.ok) throw new Error('Ошибка сервера');
            const data = await response.json();
            if (data.status === "successful") {
                currentGameId = data.game_id; currentWords = data.text.split(' ');
                renderText(); renderKeyboard(currentKeyboardLayout);
                isGameActive = true; if (hiddenInput) hiddenInput.focus(); updateVisuals(); updateComboProgress(); 
            }
        } catch (error) { typingArea.innerHTML = `<div class="loading-text" style="color: red;">Сервер недоступен!</div>`; }
    }

    async function closeGameAndRestart() {
        if (currentGameId) { try { await fetch(`${API_URL}/api/close-game`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ game_id: currentGameId, close: true }) }); } catch (e) {} }
        startGameRequest();
    }

    function renderText() {
        typingArea.innerHTML = '';
        currentWords.forEach((word, index) => {
            const wordSpan = document.createElement('span'); wordSpan.className = 'word';
            word.split('').forEach((char, charIndex) => {
                const letterSpan = document.createElement('span'); letterSpan.className = 'letter';
                if (index === 0 && charIndex === 0) letterSpan.classList.add('active');
                letterSpan.textContent = char; wordSpan.appendChild(letterSpan);
            });
            typingArea.appendChild(wordSpan); typingArea.appendChild(document.createTextNode(' '));
        });
    }

    function updateVisuals() {
        const words = typingArea.querySelectorAll('.word');
        typingArea.querySelectorAll('.text-highlight').forEach(el => el.classList.remove('text-highlight'));
        if (currentWordIndex < words.length) {
            const currentWordSpan = words[currentWordIndex];
            const currentLetters = currentWordSpan.querySelectorAll('.letter');
            const targetWord = currentWords[currentWordIndex];
            currentLetters.forEach((letter, i) => {
                letter.classList.remove('correct', 'incorrect', 'active');
                if (i < typedWord.length) {
                    if (typedWord[i] === targetWord[i]) letter.classList.add('correct');
                    else letter.classList.add('incorrect');
                } else if (i === typedWord.length && highlightMode === 'key') { letter.classList.add('active'); }
            });
            if (highlightMode === 'word') currentWordSpan.classList.add('text-highlight');
            else if (typedWord.length < targetWord.length) currentLetters[typedWord.length].classList.add('text-highlight');
        }
        highlightNextKey();
    }

    async function submitWord() {
        const targetWord = currentWords[currentWordIndex];
        if (typedWord !== targetWord) return false;
        isSubmitting = true; 
        try {
            const response = await fetch(`${API_URL}/api/submit-word`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user: String(USER_ID), game_id: currentGameId, words_len: currentWordIndex + 1 }) });
            if (!response.ok) throw new Error("Валидация");
            const words = typingArea.querySelectorAll('.word'); words[currentWordIndex].classList.add('passed');
            currentWordIndex++; typedWord = ""; hasErrorInCurrentWord = false; 
            if (currentWordIndex < currentWords.length) updateVisuals(); else highlightNextKey();
            return true;
        } catch (error) { return false; } finally { isSubmitting = false; }
    }

    async function finishGame() {
        isGameActive = false;
        try {
            const response = await fetch(`${API_URL}/api/finish-game`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    game_id: currentGameId, user_id: USER_ID, finish: true, close: true,
                    total_typed: totalTyped, correct_typed: correctTyped, 
                    max_streak: Math.max(maxStreak, currentStreak),
                    combo_active: comboModeActive && currentStreak >= COMBO_THRESHOLD,
                    current_streak: currentStreak,
                    had_error: hadErrorInGame 
                })
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.detail || "Ошибка финиша");
            showResults(data);
        } catch (error) { alert("Сервер отклонил финиш: " + error.message); startGameRequest(); }
    }

    function showResults(data) {
        typingArea.style.display = 'none'; 
        if (keyboardContainer) keyboardContainer.style.display = 'none';
        if (resultsScreen) resultsScreen.style.display = 'flex'; 

        if (document.getElementById('res-wpm')) document.getElementById('res-wpm').textContent = data.wpm;
        if (document.getElementById('res-raw-wpm')) document.getElementById('res-raw-wpm').textContent = data.raw;
        if (document.getElementById('res-accuracy')) document.getElementById('res-accuracy').textContent = data.accuracy + '%';
        if (document.getElementById('res-time')) document.getElementById('res-time').textContent = data.time_seconds + 's';
        if (document.getElementById('res-original')) document.getElementById('res-original').textContent = data.original_text;

        const resultTitle = document.getElementById('result-title');
        if (resultTitle) {
            let titleHtml = `Тест завершен!<br>`;
            if (data.xp_gain > 0) {
                if (data.combo_active) titleHtml += `<div style="color:#a78bfa;font-weight:800;">⚡ Комбо x1.5 XP активировано!</div>`;
                titleHtml += `<span style="font-size: 2rem; color: var(--accent); font-weight: bold;">+${data.xp_gain} XP</span>`;
                let details = `База: ${data.base_xp} XP`;
                if (data.is_record) details += ` + Рекорд: ${data.record_bonus} XP`;
                titleHtml += `<div style="font-size: 1rem; color: var(--muted); margin-top: 5px; font-weight: normal;">${details}</div>`;
            }
            
            if (data.is_record) {
                let dateStr = "";
                if (data.record_date) {
                    const parts = data.record_date.split(' ');
                    if (parts.length > 1) dateStr = `(${parts[0]} в ${parts[1].substring(0, 5)})`;
                    else dateStr = `(${data.record_date})`;
                }
                titleHtml += `<br><span style="font-size: 1.3rem; color: #fbbf24; text-shadow: 0 0 10px rgba(251, 191, 36, 0.5);">🏆 Новый рекорд! ${dateStr}</span>`;
            }
            
            if (data.newly_unlocked && data.newly_unlocked.length > 0) {
                const achievementNames = {
                    1: "Первые шаги", 2: "Начинающий", 3: "Уверенный", 4: "Продвинутый", 5: "Опытный",
                    6: "Мастер", 7: "Эксперт", 8: "Виртуоз", 9: "Легенда", 10: "Божество клавиатуры",
                    11: "Точный удар", 12: "Стальные пальцы", 13: "Алмазная точность", 14: "Неуловимый",
                    15: "Кибернетический", 16: "Абсолют"
                };
                const names = data.newly_unlocked.map(id => achievementNames[id] || `Достижение ${id}`).join(', ');
                titleHtml += `<div style="margin-top: 15px; color: #a6e3a1; font-size: 1.1rem; font-weight: 600;">✨ Открыто: ${names}</div>`;
            }

            if (data.level_up) titleHtml += `<br><span style="font-size: 1.8rem; color: #f38ba8; margin-top: 15px; display: block;">🎉 Новый уровень! 🎉</span>`;
            resultTitle.innerHTML = titleHtml;
        }

        if (data.level_up || data.is_record) {
            confetti({ particleCount: 200, spread: 90, origin: { y: 0.6 }, colors: ['#75ddd2', '#0ea5e9', '#f0f1fa', '#fbbf24'] });
        }
    }

    let isTabPressed = false;

    function updateComboProgress() {
        let hud = document.getElementById('combo-progress-hud');
        if (!hud) {
            hud = document.createElement('div');
            hud.id = 'combo-progress-hud';
            hud.setAttribute('aria-live', 'polite');
            hud.style.cssText = 'position:fixed;z-index:9998;right:18px;bottom:18px;padding:10px 14px;border-radius:14px;background:var(--panel,#fff);color:var(--text-color,#0f172a);border:1px solid var(--border,#cbd5e1);box-shadow:0 8px 28px #0003;font:700 13px/1.35 system-ui,sans-serif;';
            document.body.appendChild(hud);
        }
        if (comboModeActive) {
            hud.innerHTML = '⚡ КОМБО АКТИВНО · x1.5 XP';
            hud.style.background = 'linear-gradient(120deg,#6d28d9,#0e7490)';
            hud.style.color = '#fff';
            hud.style.borderColor = 'transparent';
        } else {
            hud.textContent = `⚡ Комбо: ${Math.min(currentStreak, COMBO_THRESHOLD)}/${COMBO_THRESHOLD}`;
            hud.style.background = 'var(--panel,#fff)';
            hud.style.color = 'var(--text-color,#0f172a)';
            hud.style.borderColor = 'var(--border,#cbd5e1)';
        }
    }

    function showComboMode() {
        if (comboModeActive) return;
        comboModeActive = true;
        let banner = document.getElementById('combo-mode-banner');
        if (!banner) {
            banner = document.createElement('div');
            banner.id = 'combo-mode-banner';
            banner.setAttribute('role', 'status');
            banner.style.cssText = 'position:fixed;z-index:9999;top:18px;left:50%;transform:translateX(-50%);padding:16px 24px;border-radius:16px;background:linear-gradient(120deg,#7c3aed,#0891b2);color:white;font-weight:800;font-size:18px;box-shadow:0 12px 40px #0005;text-align:center;max-width:calc(100vw - 32px);';
            document.body.appendChild(banner);
        }
        banner.innerHTML = '⚡ КОМБО АКТИВИРОВАНО!<br><small>300 правильных нажатий подряд · x1.5 опыта за забег</small>';
        banner.style.display = 'block';
        updateComboProgress();
        if (window.confetti) window.confetti({ particleCount: 120, spread: 90, origin: { y: 0.2 } });
        window.setTimeout(() => { if (banner.isConnected) banner.style.display = 'none'; }, 4500);
    }

    window.addEventListener('keydown', async (e) => {
        if (e.key === 'Tab') { e.preventDefault(); isTabPressed = true; return; }
        if (e.key === 'Enter' && isTabPressed) { e.preventDefault(); closeGameAndRestart(); isTabPressed = false; return; }
        if (!isGameActive || isSubmitting) return;

        if (e.ctrlKey) {
            if (e.key === 'Backspace' || e.key === 'Delete' || e.code === 'KeyA') {
                e.preventDefault();
                if (typedWord.length > 0) { typedWord = ""; updateVisuals(); }
                return;
            }
        }
        if (e.ctrlKey || e.altKey || e.metaKey) return;

        if (!firstLetterTyped && e.key.length === 1) {
            firstLetterTyped = true;
            fetch(`${API_URL}/api/start-game`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ game_id: currentGameId, one_bokva: true }) }).catch(err => console.error(err));
        }

        if (e.key === ' ') {
            e.preventDefault(); 
            const targetWord = currentWords[currentWordIndex];
            totalTyped++; 
            if (typedWord === targetWord) correctTyped++; 
            await submitWord();
            return;
        }

        if (e.key === 'Backspace') {
            e.preventDefault();
            if (typedWord.length > 0) { typedWord = typedWord.slice(0, -1); updateVisuals(); }
            return;
        }

        if (e.key.length === 1) {
            const targetWord = currentWords[currentWordIndex];
            const expectedChar = targetWord[typedWord.length];

            totalTyped++;
            if (e.key === expectedChar) {
                correctTyped++;
                currentStreak++;
                localStorage.setItem(streakStorageKey, String(currentStreak));
                if (currentStreak > maxStreak) maxStreak = currentStreak;
                if (!comboModeActive && currentStreak >= COMBO_THRESHOLD) showComboMode();
                else updateComboProgress();

            } else {
                currentStreak = 0;
                maxStreak = Math.max(maxStreak, 0);
                comboModeActive = false;
                localStorage.setItem(streakStorageKey, '0');
                const activeBanner = document.getElementById('combo-mode-banner');
                if (activeBanner) activeBanner.remove();
                updateComboProgress();
                hadErrorInGame = true; 
                if (!hasErrorInCurrentWord) {
                    hasErrorInCurrentWord = true; 
                    fetch(`${API_URL}/api/log-error`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user: String(USER_ID), game_id: currentGameId, expected: expectedChar, typed: e.key }) }).catch(err => console.error(err));
                }
            }

            if (typedWord.length < targetWord.length) {
                typedWord += e.key;
                updateVisuals();
                const isLastWord = currentWordIndex === currentWords.length - 1;
                if (isLastWord && typedWord === targetWord) {
                    const success = await submitWord();
                    if (success) finishGame();
                }
            }
        }
    });

    window.addEventListener('keyup', (e) => { if (e.key === 'Tab') isTabPressed = false; });

    modeBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            modeBtns.forEach(b => b.classList.remove('active')); btn.classList.add('active');
            currentMode = btn.dataset.mode; updateToolbar(); closeGameAndRestart(); 
        });
    });

    updateToolbar();
    startGameRequest(); 
});
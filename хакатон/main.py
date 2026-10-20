from fastapi import FastAPI, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import sqlite3
import random
import time
import string
import jwt
from datetime import datetime, timedelta

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

SECRET_KEY = "super_secret_key_for_hackathon_project_2024"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24

ACHIEVEMENTS_DB = [
    {"id": 1, "type": "speed", "target": 20}, {"id": 2, "type": "speed", "target": 40},
    {"id": 3, "type": "speed", "target": 60}, {"id": 4, "type": "speed", "target": 80},
    {"id": 5, "type": "speed", "target": 100}, {"id": 6, "type": "speed", "target": 120},
    {"id": 7, "type": "speed", "target": 140}, {"id": 8, "type": "speed", "target": 160},
    {"id": 9, "type": "speed", "target": 180}, {"id": 10, "type": "speed", "target": 200},
    {"id": 11, "type": "streak", "target": 100}, {"id": 12, "type": "streak", "target": 500},
    {"id": 13, "type": "streak", "target": 1000}, {"id": 14, "type": "streak", "target": 5000},
    {"id": 15, "type": "streak", "target": 10000}, {"id": 16, "type": "streak", "target": 25000},
]

def init_db():
    conn = sqlite3.connect('users.db')
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            user_id INTEGER PRIMARY KEY AUTOINCREMENT,
            nickname TEXT UNIQUE NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            level INTEGER DEFAULT 0,
            xp INTEGER DEFAULT 0,
            current_streak INTEGER DEFAULT 0,
            best_streak INTEGER DEFAULT 0
        )
    ''')
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS user_achievements (
            user_id INTEGER,
            achievement_id INTEGER,
            unlocked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (user_id, achievement_id)
        )
    ''')
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS user_records (
            user_id INTEGER,
            mode TEXT,
            language TEXT,
            wpm INTEGER DEFAULT 0,
            recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (user_id, mode, language)
        )
    ''')
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS user_games (
            game_id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            wpm INTEGER,
            cpm INTEGER,
            accuracy REAL,
            errors INTEGER,
            time_seconds REAL,
            played_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS user_errors (
            user_id INTEGER,
            expected_char TEXT,
            error_count INTEGER DEFAULT 1,
            last_occurred TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (user_id, expected_char)
        )
    ''')
    conn.commit()
    conn.close()

init_db()

def get_db():
    conn = sqlite3.connect('users.db')
    conn.row_factory = sqlite3.Row
    return conn

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

class UserRegister(BaseModel):
    nickname: str
    email: str
    password: str

class UserLogin(BaseModel):
    email: str
    password: str

class WordSubmission(BaseModel):
    user: str
    game_id: int
    words_len: int

class ErrorLog(BaseModel):
    user: str
    game_id: int
    expected: str
    typed: str

class ActionRequest(BaseModel):
    game_id: int
    user_id: int = 0
    one_bokva: bool = False
    close: bool = False
    finish: bool = False
    total_typed: int = 0
    correct_typed: int = 0
    current_streak: int = 0 
    max_streak: int = 0
    combo_active: bool = False
    had_error: bool = False

@app.post("/api/auth/register")
async def register(user: UserRegister):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM users WHERE nickname = ?", (user.nickname,))
    if cursor.fetchone():
        conn.close()
        return {"success": False, "message": "Такой ник занят. Попробуйте другой."}
    cursor.execute("SELECT * FROM users WHERE email = ?", (user.email,))
    if cursor.fetchone():
        conn.close()
        return {"success": False, "message": "Этот Email уже используется."}
    try:
        cursor.execute("INSERT INTO users (nickname, email, password) VALUES (?, ?, ?)", (user.nickname, user.email, user.password))
        conn.commit()
        new_user_id = cursor.lastrowid
    except Exception as e:
        conn.rollback()
        conn.close()
        return {"success": False, "message": f"Ошибка БД: {str(e)}"}
    conn.close()
    token = create_access_token({"sub": str(new_user_id), "nickname": user.nickname, "email": user.email})
    return {"success": True, "message": "Ваш аккаунт успешно зарегистрирован", "token": token, "user": {"id": new_user_id, "nickname": user.nickname, "email": user.email}}

@app.post("/api/auth/login")
async def login(user: UserLogin):
    conn = get_db()
    cursor = conn.cursor()
    # ИЩЕМ ПО EMAIL, А НЕ ПО НИКНЕЙМУ
    cursor.execute("SELECT * FROM users WHERE email = ?", (user.email,))
    db_user = cursor.fetchone()
    conn.close()
    
    if not db_user or user.password != db_user["password"]:
        return {"success": False, "message": "Неверный Email или пароль"}
        
    token = create_access_token({"sub": str(db_user["user_id"]), "nickname": db_user["nickname"], "email": db_user["email"]})
    return {"success": True, "message": "Вход выполнен", "token": token, "user": {"id": db_user["user_id"], "nickname": db_user["nickname"], "email": db_user["email"]}}
@app.get("/api/auth/profile")
async def get_profile(authorization: str = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Не авторизован")
    token = authorization.split(" ")[1]
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = int(payload.get("sub"))
    except Exception:
        raise HTTPException(status_code=401, detail="Неверный токен")
    conn = get_db()
    cursor = conn.cursor()
    # ВОЗВРАЩАЕМ CURRENT_STREAK
    cursor.execute("SELECT user_id, nickname, email, level, xp, current_streak, best_streak FROM users WHERE user_id = ?", (user_id,))
    user = cursor.fetchone()
    if not user:
        conn.close()
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    cursor.execute("SELECT achievement_id, unlocked_at FROM user_achievements WHERE user_id = ?", (user_id,))
    unlocked_rows = cursor.fetchall()
    unlocked_dict = {row["achievement_id"]: row["unlocked_at"] for row in unlocked_rows}
    conn.close()
    return {
        "success": True, 
        "user": {
            "id": user["user_id"], "nickname": user["nickname"], "email": user["email"], 
            "level": user["level"], "xp": user["xp"], 
            "current_streak": user["current_streak"], "best_streak": user["best_streak"]
        }, 
        "unlocked_achievements": unlocked_dict
    }

@app.get("/api/auth/stats")
async def get_stats(authorization: str = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Не авторизован")
    token = authorization.split(" ")[1]
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = int(payload.get("sub"))
    except Exception:
        raise HTTPException(status_code=401, detail="Неверный токен")

    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("SELECT wpm FROM user_records WHERE user_id = ? ORDER BY wpm DESC LIMIT 1", (user_id,))
    record_row = cursor.fetchone()
    record_wpm = record_row["wpm"] if record_row else 0
    record_cpm = record_wpm * 5

    cursor.execute("SELECT AVG(accuracy) as avg_acc, SUM(errors) as total_err FROM user_games WHERE user_id = ? AND DATE(played_at) = DATE('now')", (user_id,))
    today_row = cursor.fetchone()
    today_accuracy = round(today_row["avg_acc"], 1) if today_row and today_row["avg_acc"] else 100.0
    today_errors = today_row["total_err"] if today_row and today_row["total_err"] else 0

    cursor.execute("SELECT COUNT(*) as total_games, SUM(time_seconds) as total_time, AVG(wpm) as avg_wpm FROM user_games WHERE user_id = ?", (user_id,))
    overall_row = cursor.fetchone()
    total_games = overall_row["total_games"] if overall_row else 0
    total_time_sec = overall_row["total_time"] if overall_row and overall_row["total_time"] else 0
    avg_wpm = round(overall_row["avg_wpm"], 1) if overall_row and overall_row["avg_wpm"] else 0

    hours = int(total_time_sec // 3600)
    minutes = int((total_time_sec % 3600) // 60)
    seconds = int(total_time_sec % 60)
    total_time_str = f"{hours:02}:{minutes:02}:{seconds:02}"

    cursor.execute("SELECT expected_char, error_count FROM user_errors WHERE user_id = ? ORDER BY error_count DESC LIMIT 8", (user_id,))
    top_errors = [{"char": row["expected_char"], "rate": row["error_count"]} for row in cursor.fetchall()]

    conn.close()

    return {
        "success": True,
        "stats": {
            "session": {
                "record_wpm": record_wpm,
                "record_cpm": record_cpm,
                "today_accuracy": today_accuracy,
                "today_errors": today_errors
            },
            "overall": {
                "tests": total_games,
                "time": total_time_str,
                "avgWpm": avg_wpm
            },
            "details": top_errors
        }
    }

@app.get("/api/auth/chart-data")
async def get_chart_data(period: str = "month", authorization: str = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Не авторизован")
    token = authorization.split(" ")[1]
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = int(payload.get("sub"))
    except Exception:
        raise HTTPException(status_code=401, detail="Неверный токен")

    conn = get_db()
    cursor = conn.cursor()

    if period == "day":
        query = "SELECT wpm, accuracy, played_at FROM user_games WHERE user_id = ? AND DATE(played_at) = DATE('now') ORDER BY played_at ASC"
    elif period == "month":
        query = "SELECT wpm, accuracy, played_at FROM user_games WHERE user_id = ? AND played_at >= DATE('now', '-30 days') ORDER BY played_at ASC"
    else:
        query = "SELECT wpm, accuracy, played_at FROM user_games WHERE user_id = ? ORDER BY played_at ASC"
        
    cursor.execute(query, (user_id,))
    rows = cursor.fetchall()
    conn.close()

    labels = []
    wpms = []
    accuracies = []

    for row in rows:
        dt = datetime.strptime(row["played_at"], "%Y-%m-%d %H:%M:%S")
        if period == "day":
            labels.append(dt.strftime("%H:%M"))
        else:
            labels.append(dt.strftime("%d.%m %H:%M"))
            
        wpms.append(row["wpm"])
        accuracies.append(round(row["accuracy"], 1))

    return {"success": True, "labels": labels, "wpm": wpms, "accuracy": accuracies}

active_games = {}
EASY_WORDS = {
    "russian": ["слова", "потому", "бывать", "делать", "кровать", "радоваться", "обижаться", "смотреть", "идти", "видеть", "код", "программа", "тест", "скорость", "печать", "быстро", "текст", "буква", "ошибка", "точность"],
    "english": ["words", "because", "happen", "do", "bed", "rejoice", "offend", "look", "go", "see", "code", "program", "test", "speed", "typing", "fast", "text", "letter", "error", "accuracy"]
}
HARD_WORDS = {
    "russian": ["разъясняться", "электрифицировать", "достопримечательность", "благоприятствовать", "экспериментальный", "усовершенствование", "препятствие", "непосредственный", "руководствоваться", "путешественник", "конкурентоспособность", "интеллектуальный", "беспрецедентный"],
    "english": ["unquestionably", "electroencephalogram", "misrepresentation", "incomprehensible", "straightforward", "characteristically", "extracurricular", "counterrevolution", "telecommunication", "internationalization", "indistinguishable", "prestidigitation"]
}
SENTENCES_DB = {
    "russian": ["Быстрая коричневая лиса прыгает через ленивую собаку.", "Программирование требует много терпения и практики.", "Сегодня отличная погода для долгой прогулки по парку.", "Никогда не сдавайся, иди до конца, даже если трудно.", "Изучение нового иностранного языка расширяет кругозор."],
    "english": ["The quick brown fox jumps over the lazy dog.", "Programming requires a lot of patience and practice.", "Today is great weather for a long walk in the park.", "Never give up, go all the way, even when it is hard.", "Learning a new foreign language broadens your horizons."]
}
CODE_DB = ["def hello():\n    print('Hello, World!')", "for i in range(10):\n    print(i)", "let x = 10;\nconst y = 20;\nconsole.log(x + y);", "const add = (a, b) => a + b;", "<div class='container'>\n  <p>Text</p>\n</div>", "body {\n  background: #000;\n}"]

@app.get("/api/game")
async def get_game(authorization: str = Header(None), mode: str = "words", language: str = "russian", letters: bool = True, numbers: bool = True, specials: bool = True):
    game_id = random.randint(1000000000000000, 9999999999999999)
    
    user_level = 0
    if authorization and authorization.startswith("Bearer "):
        try:
            token = authorization.split(" ")[1]
            payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
            user_id = int(payload.get("sub"))
            conn = get_db()
            cursor = conn.cursor()
            cursor.execute("SELECT level FROM users WHERE user_id = ?", (user_id,))
            row = cursor.fetchone()
            if row: user_level = row["level"]
            conn.close()
        except Exception: pass

    if mode == "words":
        easy_pool = EASY_WORDS.get(language, EASY_WORDS["russian"])
        hard_pool = HARD_WORDS.get(language, HARD_WORDS["russian"])
        
        if user_level < 3: words = random.sample(easy_pool, min(10, len(easy_pool)))
        elif user_level < 6: 
            words = random.sample(easy_pool, 7) + random.sample(hard_pool, 3)
            random.shuffle(words)
        else: 
            words = random.sample(easy_pool, 3) + random.sample(hard_pool, 7)
            random.shuffle(words)
        text = " ".join(words)
    elif mode == "sentences":
        pool = SENTENCES_DB.get(language, SENTENCES_DB["russian"])
        text = " ".join(random.sample(pool, 2))
    elif mode == "code":
        text = random.choice(CODE_DB).replace("\n", " ")
    elif mode == "symbols":
        char_pool = ""
        if letters: char_pool += string.ascii_letters + "абвгдеёжзийклмнопрстуфхцчшщъыьэюя"
        if numbers: char_pool += string.digits
        if specials: char_pool += "!@#$%^&*()_+-=[]{}|;:',.<>/?~`"
        if not char_pool: char_pool = string.ascii_letters
        text = " ".join([random.choice(char_pool) for _ in range(30)])
    else: text = "Error"

    text = " ".join(text.split())
    final_words = text.split(' ')
    active_games[game_id] = {"expected_word_index": 1, "words": final_words, "start_time": None, "is_finished": False, "mode": mode, "language": language}
    return {"status": "successful", "text": text, "game_id": game_id, "len_words": len(final_words)}

@app.post("/api/start-game")
async def start_game(data: ActionRequest):
    game = active_games.get(data.game_id)
    if game and data.one_bokva and game["start_time"] is None:
        game["start_time"] = time.time()
    return {"status": "successful"}

@app.post("/api/log-error")
async def log_error(data: ErrorLog):
    try:
        user_id = int(data.user)
        if user_id > 0:
            conn = get_db()
            cursor = conn.cursor()
            cursor.execute('''
                INSERT INTO user_errors (user_id, expected_char, error_count)
                VALUES (?, ?, 1)
                ON CONFLICT(user_id, expected_char) 
                DO UPDATE SET error_count = error_count + 1, last_occurred = CURRENT_TIMESTAMP
            ''', (user_id, data.expected))
            
            cursor.execute("UPDATE users SET current_streak = 0 WHERE user_id = ?", (user_id,))
            conn.commit()
            conn.close()
    except Exception as e: 
        print(f"Error logging: {e}")
    return {"status": "successful"}

@app.post("/api/submit-word")
async def submit_word(data: WordSubmission):
    game = active_games.get(data.game_id)
    if game and data.words_len == game["expected_word_index"]:
        game["expected_word_index"] += 1
    return {"status": "successful"}

@app.post("/api/finish-game")
async def finish_game(data: ActionRequest):
    game = active_games.get(data.game_id)
    if not game: raise HTTPException(status_code=404, detail="Игра не найдена")
    
    elapsed_time = round(time.time() - game["start_time"], 2) if game["start_time"] else 1
    time_in_mins = elapsed_time / 60 if elapsed_time > 0 else 1
    wpm = round((data.correct_typed / 5) / time_in_mins) if time_in_mins > 0 else 0
    raw_wpm = round((data.total_typed / 5) / time_in_mins) if time_in_mins > 0 else 0
    accuracy = round((data.correct_typed / data.total_typed) * 100) if data.total_typed > 0 else 100
    errors_count = data.total_typed - data.correct_typed
    
    base_xp = 0
    record_bonus = 0
    xp_gain = 0
    level_up = False
    is_record = False
    record_date = None
    newly_unlocked = []
    mode = game.get("mode", "words")
    language = game.get("language", "russian")
    
    if data.user_id > 0:
        base_xp = 200 if accuracy == 100 else 100
        conn = get_db()
        cursor = conn.cursor()
        
        cursor.execute('''
            INSERT INTO user_games (user_id, wpm, cpm, accuracy, errors, time_seconds)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (data.user_id, wpm, wpm*5, accuracy, errors_count, elapsed_time))
        
        cursor.execute("SELECT wpm FROM user_records WHERE user_id=? AND mode=? AND language=?", (data.user_id, mode, language))
        record_row = cursor.fetchone()
        old_record = record_row["wpm"] if record_row else 0
        if wpm > old_record:
            is_record = True
            record_bonus = 100
            
            if record_row:
                cursor.execute("UPDATE user_records SET wpm=?, recorded_at=CURRENT_TIMESTAMP WHERE user_id=? AND mode=? AND language=?", (wpm, data.user_id, mode, language))
            else:
                cursor.execute("INSERT INTO user_records (user_id, mode, language, wpm) VALUES (?, ?, ?, ?)", (data.user_id, mode, language, wpm))
            
            cursor.execute("SELECT recorded_at FROM user_records WHERE user_id=? AND mode=? AND language=?", (data.user_id, mode, language))
            record_date = cursor.fetchone()["recorded_at"]
        
        combo_active = data.current_streak >= 300
        xp_gain = round((base_xp + record_bonus) * (1.5 if combo_active else 1.0))
        
        cursor.execute("SELECT current_streak, best_streak FROM users WHERE user_id = ?", (data.user_id,))
        user_row = cursor.fetchone()
        

        new_current_streak = max(0, data.current_streak)
        
        old_best_streak = user_row["best_streak"] if user_row else 0
        new_best_streak = max(old_best_streak, data.max_streak, new_current_streak)
        
        cursor.execute("UPDATE users SET current_streak = ?, best_streak = ? WHERE user_id = ?", (new_current_streak, new_best_streak, data.user_id))

        cursor.execute("SELECT achievement_id FROM user_achievements WHERE user_id = ?", (data.user_id,))
        already_unlocked = [row["achievement_id"] for row in cursor.fetchall()]
        for ach in ACHIEVEMENTS_DB:
            if ach["id"] in already_unlocked: continue
            if (ach["type"] == "speed" and wpm >= ach["target"]) or (ach["type"] == "streak" and new_best_streak >= ach["target"]):
                cursor.execute("INSERT INTO user_achievements (user_id, achievement_id) VALUES (?, ?)", (data.user_id, ach["id"]))
                newly_unlocked.append(ach["id"])
        
        cursor.execute("SELECT level, xp FROM users WHERE user_id = ?", (data.user_id,))
        user = cursor.fetchone()
        if user:
            current_level = user["level"]
            new_xp = user["xp"] + xp_gain
            req_xp = 500 * (2 ** current_level)
            while new_xp >= req_xp:
                current_level += 1
                new_xp -= req_xp
                req_xp = 500 * (2 ** current_level)
                level_up = True
            cursor.execute("UPDATE users SET level = ?, xp = ? WHERE user_id = ?", (current_level, new_xp, data.user_id))
        
        conn.commit()
        conn.close()

    return {
        "status": "successful", "time_seconds": elapsed_time, "wpm": wpm, "raw": raw_wpm, "accuracy": accuracy, 
        "original_text": " ".join(game["words"]), "base_xp": base_xp, "record_bonus": record_bonus, "xp_gain": xp_gain,
        "level_up": level_up, "is_record": is_record, "record_date": record_date, "newly_unlocked": newly_unlocked, 
        "best_streak": new_best_streak if data.user_id > 0 else 0, "combo_active": bool(combo_active), "xp_multiplier": 1.5 if combo_active else 1.0
    }

@app.post("/api/close-game")
async def close_game(data: ActionRequest):
    if data.game_id in active_games: del active_games[data.game_id]
    return {"status": "successful"}

@app.get("/api/leaderboard")
async def leaderboard():
    conn = get_db()
    cursor = conn.cursor()
    try:
        speed = cursor.execute("""
            SELECT u.nickname, COALESCE(MAX(g.wpm), 0) AS value
            FROM users u LEFT JOIN user_games g ON g.user_id=u.user_id
            GROUP BY u.user_id ORDER BY value DESC, u.nickname COLLATE NOCASE LIMIT 6
        """).fetchall()
        accuracy = cursor.execute("""
            SELECT u.nickname, COALESCE(ROUND(AVG(g.accuracy), 1), 0) AS value
            FROM users u LEFT JOIN user_games g ON g.user_id=u.user_id
            GROUP BY u.user_id ORDER BY value DESC, u.nickname COLLATE NOCASE LIMIT 6
        """).fetchall()
        xp = cursor.execute("""
            SELECT nickname, xp + level * 0 AS value FROM users
            ORDER BY level DESC, xp DESC, nickname COLLATE NOCASE LIMIT 6
        """).fetchall()
        xp = cursor.execute("""
            SELECT nickname, level, xp FROM users
            ORDER BY level DESC, xp DESC, nickname COLLATE NOCASE LIMIT 6
        """).fetchall()
        return {"success": True, "speed": [dict(nickname=r["nickname"], value=r["value"]) for r in speed],
                "accuracy": [dict(nickname=r["nickname"], value=r["value"]) for r in accuracy],
                "xp": [dict(nickname=r["nickname"], value=(500 * (2 ** r["level"]) - 500) + r["xp"]) for r in xp]}
    finally:
        conn.close()

@app.get("/")
async def root():
    return {"message": "Сервер KeyFlow успешно запущен!"}
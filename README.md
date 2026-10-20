## Запуск

### Бэкенд
Убедись, что ты находишься в корневой папке проекта (там, где лежит файл `main.py`). Создай виртуальное окружение (по желанию):

```bash
python -m venv .venv
.venv\Scripts\activate   # Windows
# source .venv/bin/activate  # Linux/macOS

Установи зависимости:

pip install -r requirements.txt

Запусти сервер:

python -m uvicorn main:app --reload

После запуска сервера перейдите в проводник и откройте файл logreg.html
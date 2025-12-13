# Как восстановить Telegram Bot Token

## Проблема
Если вы видите в логах:
```
⚠️ TELEGRAM_BOT_TOKEN не установлен, бот не будет запущен
```

Это значит, что токен не найден в переменных окружения.

## Решение

### 1. Проверьте файл `.env`

Файл `.env` должен быть в корне проекта (рядом с `docker-compose.yml`).

```bash
# Проверьте, существует ли файл
ls -la .env

# Посмотрите содержимое (безопасно, токены обычно не отображаются полностью)
cat .env | grep TELEGRAM
```

### 2. Если файл `.env` отсутствует

Создайте его:

```bash
cd ~/car
nano .env
```

Добавьте минимум:
```env
TELEGRAM_BOT_TOKEN=ваш_токен_здесь
```

Или скопируйте из примера:
```bash
cp ENV_EXAMPLE.md .env
# Затем отредактируйте и добавьте токен
nano .env
```

### 3. Если токен отсутствует в `.env`

Добавьте строку:
```env
TELEGRAM_BOT_TOKEN=ваш_токен_от_BotFather
```

### 4. Где взять токен?

1. Откройте Telegram
2. Найдите бота [@BotFather](https://t.me/BotFather)
3. Отправьте команду `/mybots`
4. Выберите вашего бота (`@anosinopark_bot`)
5. Выберите "API Token"
6. Скопируйте токен (формат: `123456789:ABCdefGHIjklMNOpqrsTUVwxyz`)

**Если токен был скомпрометирован:**
- В том же меню выберите "Revoke current token" (отозвать текущий)
- Получите новый токен
- Обновите его в `.env`

### 5. После добавления токена

**ВАЖНО:** Перезапустите backend контейнер:

```bash
docker compose restart backend
```

Или если нужно пересобрать:
```bash
docker compose up -d --build backend
```

### 6. Проверьте, что токен применился

```bash
# Проверьте переменные в контейнере
docker compose exec backend env | grep TELEGRAM_BOT_TOKEN

# Проверьте логи
docker compose logs backend | grep -i telegram
```

Должно появиться:
```
✅ Telegram бот успешно инициализирован
```

Вместо:
```
⚠️ TELEGRAM_BOT_TOKEN не установлен
```

### 7. Безопасность

⚠️ **НИКОГДА не коммитьте файл `.env` в git!**

Убедитесь, что `.env` в `.gitignore`:
```bash
cat .gitignore | grep .env
```

Если нет - добавьте:
```bash
echo ".env" >> .gitignore
```

## Пример полного `.env` файла

```env
# JWT Secret
JWT_SECRET=ваш-секретный-ключ

# PostgreSQL
DB_NAME=passes_db
DB_USER=postgres
DB_PASSWORD=ваш-пароль

# Frontend URL
FRONTEND_URL=https://пропуск.аносинопарк.рф

# Telegram Bot Token
TELEGRAM_BOT_TOKEN=123456789:ABCdefGHIjklMNOpqrsTUVwxyz
```

## Частые ошибки

### Ошибка: "command not found: docker-compose"
Используйте `docker compose` (без дефиса) - это новый синтаксис Docker Compose V2.

### Ошибка: токен не применяется после перезапуска
1. Убедитесь, что файл `.env` находится в корне проекта
2. Проверьте, что нет лишних пробелов вокруг `=`
3. Убедитесь, что токен не в кавычках (если не требуется)
4. Пересоберите контейнер: `docker compose up -d --build backend`

### Ошибка: "Invalid token"
- Проверьте, что токен скопирован полностью
- Убедитесь, что нет лишних пробелов
- Проверьте токен в BotFather - возможно, он был отозван













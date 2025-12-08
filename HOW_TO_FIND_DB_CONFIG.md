# Как найти настройки базы данных

## 1. Проверьте docker-compose.yml (значения по умолчанию)

```bash
cd ~/car
cat docker-compose.yml | grep -A 10 "postgres:"
```

Значения по умолчанию:
- `POSTGRES_DB=${DB_NAME:-passes_db}` → по умолчанию: `passes_db`
- `POSTGRES_USER=${DB_USER:-postgres}` → по умолчанию: `postgres`
- `POSTGRES_PASSWORD=${DB_PASSWORD:-postgres}` → по умолчанию: `postgres`

## 2. Проверьте переменные окружения в контейнере PostgreSQL

```bash
# Посмотрите переменные окружения в запущенном контейнере postgres
docker compose exec postgres env | grep POSTGRES

# Или если контейнер остановлен:
docker inspect cottage-pass-postgres | grep -A 20 "Env"
```

## 3. Проверьте переменные окружения в контейнере backend

```bash
docker compose exec backend env | grep DB_
```

Это покажет, какие настройки использует backend для подключения к базе.

## 4. Проверьте, какие переменные Docker Compose подставляет

```bash
docker compose config | grep -A 15 "postgres:"
```

Это покажет финальную конфигурацию после подстановки переменных из `.env`.

## 5. Если контейнеры запущены - проверьте логи

```bash
# Посмотрите логи postgres при старте
docker compose logs postgres | head -20
```

## 6. Проверьте volumes (где хранятся данные)

```bash
docker volume ls | grep postgres
```

Данные базы хранятся в volume, поэтому даже если пересоздать контейнер с другим паролем, данные останутся старыми с старым паролем.

## Быстрое решение:

**Вариант 1: Используйте значения по умолчанию**

Если не помните пароль, попробуйте стандартные значения из `docker-compose.yml`:

```bash
cat > .env << EOF
DB_NAME=passes_db
DB_USER=postgres
DB_PASSWORD=postgres
DB_PORT=5432
JWT_SECRET=your-secure-random-secret-key
FRONTEND_URL=https://пропуск.аносинопарк.рф
TELEGRAM_BOT_TOKEN=8501432010:AAGSUEh67HexX8uLOVJcCnb838uh-aA6FBA
EOF

chmod 600 .env
docker compose restart backend
```

**Вариант 2: Проверьте существующий volume**

Если данные важны, нужно узнать старый пароль:

```bash
# Проверьте переменные окружения backend (если он когда-то работал)
docker inspect cottage-pass-backend | grep -A 30 "Env" | grep DB_
```

**Вариант 3: Подключитесь к базе напрямую**

Если база работает, попробуйте подключиться:

```bash
docker compose exec postgres psql -U postgres -d passes_db
```

Если попросит пароль - пробуйте:
1. `postgres` (стандартный)
2. Или посмотрите в логах при старте контейнера

## Если данные не критичны:

Можно пересоздать базу с новым паролем (данные удалятся!):

```bash
docker compose down -v  # Удалит все данные!
cat > .env << EOF
DB_NAME=passes_db
DB_USER=postgres
DB_PASSWORD=новый_надежный_пароль
DB_PORT=5432
JWT_SECRET=your-secure-random-secret-key
FRONTEND_URL=https://пропуск.аносинопарк.рф
TELEGRAM_BOT_TOKEN=8501432010:AAGSUEh67HexX8uLOVJcCnb838uh-aA6FBA
EOF
chmod 600 .env
docker compose up -d
```

## Рекомендация:

Попробуйте сначала стандартные значения (`postgres`), так как это значения по умолчанию в `docker-compose.yml`.



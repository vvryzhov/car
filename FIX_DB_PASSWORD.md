# Исправление проблемы с паролем базы данных

## Проблема
База данных была создана с одним паролем, но контейнер пересоздан с другим паролем. Volume с данными остался со старым паролем.

## Решение 1: Сброс пароля в существующей базе (если данные важны)

```bash
# Остановите контейнеры
docker compose down

# Запустите postgres в режиме восстановления (без проверки пароля)
docker run --rm -it \
  -v car_postgres_data:/var/lib/postgresql/data \
  -e POSTGRES_PASSWORD=postgres \
  postgres:15-alpine \
  postgres --single -D /var/lib/postgresql/data -c "ALTER USER postgres WITH PASSWORD 'postgres';"

# Или проще - подключитесь к базе и смените пароль
docker compose up -d postgres
# Подождите пока запустится
sleep 5

# Попробуйте подключиться без пароля (если это возможно)
docker compose exec postgres psql -U postgres -d passes_db -c "ALTER USER postgres WITH PASSWORD 'postgres';"
```

## Решение 2: Пересоздать базу с новым паролем (данные удалятся!)

**ВНИМАНИЕ: Это удалит все данные!**

```bash
# Остановите и удалите volume
docker compose down -v

# Убедитесь, что .env содержит правильные настройки
cat .env

# Запустите заново
docker compose up -d
```

## Решение 3: Использовать существующий пароль (если знаете)

Если знаете старый пароль, просто укажите его в `.env`:

```bash
nano .env
# Измените DB_PASSWORD на старый пароль
```

## Решение 4: Проверить, какой пароль был установлен

Попробуйте подключиться с разными паролями:

```bash
# Стандартные варианты:
# 1. postgres
# 2. password
# 3. (пустой)

docker compose exec postgres psql -U postgres -d passes_db
# Если попросит пароль, попробуйте разные варианты
```

## Быстрое решение (если данные не критичны):

```bash
# Удалить volume и пересоздать
docker compose down -v
docker compose up -d
```

После этого база будет создана с паролем `postgres` из `.env`.













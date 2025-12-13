# Быстрое исправление .env файла

После `docker compose down` нужно восстановить все переменные в `.env`.

## Выполните на сервере:

```bash
cd ~/car
nano .env
```

Добавьте все необходимые переменные:

```env
# База данных (ОБЯЗАТЕЛЬНО!)
DB_NAME=passes_db
DB_USER=postgres
DB_PASSWORD=postgres
DB_PORT=5432

# JWT Secret
JWT_SECRET=your-very-secure-random-secret-key-change-this

# Frontend URL
FRONTEND_URL=https://пропуск.аносинопарк.рф

# Telegram Bot Token
TELEGRAM_BOT_TOKEN=8501432010:AAGSUEh67HexX8uLOVJcCnb838uh-aA6FBA
```

**ВАЖНО:** Убедитесь, что `DB_PASSWORD` совпадает с тем, что было раньше (или используйте новый пароль и обновите его везде).

После сохранения:

```bash
chmod 600 .env
docker compose restart backend
```

Или если пароль изменился, пересоздайте базу:

```bash
docker compose down -v  # ВНИМАНИЕ: удалит все данные!
docker compose up -d
```













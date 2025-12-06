# Пример файла .env

Скопируйте этот файл в `.env` и заполните своими значениями:

```env
# JWT Secret для аутентификации (ОБЯЗАТЕЛЬНО измените на случайную строку!)
JWT_SECRET=your-very-secure-random-secret-key-change-this

# PostgreSQL настройки
DB_NAME=passes_db
DB_USER=postgres
DB_PASSWORD=your-secure-db-password-change-this
DB_PORT=5432

# Порт backend (можно оставить по умолчанию)
PORT=3001

# URL фронтенда (для ссылок в письмах, например для восстановления пароля)
# Замените на ваш домен, например: https://yourdomain.com или http://yourdomain.com:8080
# ВАЖНО: Используйте полный URL с протоколом (http:// или https://)
FRONTEND_URL=http://localhost:8080

# SMTP настройки (опционально, настраиваются через админ-панель)
# SMTP_HOST=smtp.gmail.com
# SMTP_PORT=587
# SMTP_SECURE=false
# SMTP_USER=your-email@gmail.com
# SMTP_PASSWORD=your-app-password
# SMTP_FROM_EMAIL=noreply@yourdomain.com
# SMTP_FROM_NAME=Система управления пропусками
```

## Как изменить URL для ссылок восстановления пароля

1. Откройте файл `.env` в корне проекта
2. Найдите строку `FRONTEND_URL=http://localhost:8080`
3. Замените на ваш домен, например:
   - `FRONTEND_URL=https://yourdomain.com` (для HTTPS)
   - `FRONTEND_URL=http://yourdomain.com:8080` (для HTTP с портом)
4. Сохраните файл
5. Перезапустите контейнеры:
   ```bash
   docker compose restart backend
   ```

После этого все ссылки в письмах будут использовать указанный домен.












# Система управления пропусками

Веб-сервис для управления пропусками в коттеджном поселке.

## Функционал

### Для пользователей (жителей):
- Личный кабинет с профилем
- Заказ пропуска с указанием типа транспорта, номера авто, даты въезда
- Просмотр, редактирование и удаление своих заявок
- Автоматическое подтягивание адреса из профиля

### Для охраны:
- Просмотр всех заявок на пропуск
- Фильтрация заявок по дате въезда
- Фильтрация заявок по типу транспорта (грузовой/легковой)

### Для администратора:
- Создание пользователей (жителей)
- Создание пользователей с ролью "Охрана"
- Просмотр всех пользователей

## Технологии

- **Backend**: Node.js, Express, TypeScript, PostgreSQL
- **Frontend**: React, TypeScript, Vite
- **Аутентификация**: JWT
- **Telegram Bot**: node-telegram-bot-api (опционально)

## Установка и запуск

### Вариант 1: Запуск через Docker (рекомендуется)

1. Клонируйте репозиторий:
```bash
git clone https://github.com/vvryzhov/car.git
cd car
```

2. Запустите через Docker Compose:
```bash
docker-compose up -d
```

3. Откройте браузер и перейдите на `http://localhost:8080`

Приложение будет доступно на порту 8080. Backend работает на порту 3001 внутри Docker сети.

**Примечание**: Для работы Telegram бота добавьте `TELEGRAM_BOT_TOKEN` в файл `.env`. Подробные инструкции см. в [TELEGRAM_BOT_SETUP.md](./TELEGRAM_BOT_SETUP.md)

Для остановки:
```bash
docker-compose down
```

### Вариант 2: Локальный запуск

#### Backend

```bash
cd backend
npm install
npm run dev
```

Backend будет доступен на `http://localhost:3001`

#### Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend будет доступен на `http://localhost:3000`

## Структура проекта

```
cottage-pass-system/
├── backend/
│   ├── src/
│   │   ├── database.ts          # Инициализация БД
│   │   ├── middleware/
│   │   │   └── auth.ts          # Аутентификация
│   │   ├── routes/
│   │   │   ├── auth.ts          # Роуты авторизации
│   │   │   ├── users.ts         # Роуты пользователей
│   │   │   └── passes.ts        # Роуты заявок
│   │   └── index.ts             # Точка входа
│   └── package.json
└── frontend/
    ├── src/
    │   ├── components/          # React компоненты
    │   ├── contexts/            # React контексты
    │   ├── pages/               # Страницы
    │   ├── services/            # API сервисы
    │   └── App.tsx
    └── package.json
```

## База данных

Используется PostgreSQL. База данных запускается в отдельном Docker контейнере.

### Переменные окружения для БД:
- `DB_HOST` - хост PostgreSQL (по умолчанию: postgres)
- `DB_PORT` - порт PostgreSQL (по умолчанию: 5432)
- `DB_NAME` - имя базы данных (по умолчанию: passes_db)
- `DB_USER` - пользователь PostgreSQL (по умолчанию: postgres)
- `DB_PASSWORD` - пароль PostgreSQL (по умолчанию: postgres)

### Переменные окружения для LPR:
- `LPR_TOKEN` - секретный токен для авторизации LPR Agent (обязательно)
- `LPR_COOLDOWN_SECONDS` - время cooldown между проверками (по умолчанию: 15)
- `LPR_ALLOWED_STATUSES` - разрешённые статусы для проезда (по умолчанию: pending)
- `LPR_ALLOW_REPEAT_AFTER_ENTERED` - разрешить повторный проезд после "Заехал" (по умолчанию: false)
- `TZ` - временная зона для определения "сегодня" (по умолчанию: Asia/Almaty)

### Таблицы:
- `users` - пользователи системы
- `passes` - заявки на пропуск (с полем `plate_norm` для LPR)
- `lpr_events` - логи событий от LPR Agent

База данных инициализируется автоматически при первом запуске backend сервера.

## Docker

Проект полностью готов к запуску через Docker. Используется multi-stage build для оптимизации размера образов.

### Структура Docker:
- `backend/Dockerfile` - образ для backend сервера
- `frontend/Dockerfile` - образ для frontend (с nginx)
- `docker-compose.yml` - оркестрация контейнеров
- `frontend/nginx.conf` - конфигурация nginx для SPA

### Переменные окружения

Создайте файл `.env` в корне проекта (опционально):
```
JWT_SECRET=your-secret-key-change-in-production
```

Если файл не создан, будет использовано значение по умолчанию.

## Загрузка в GitHub

Проект готов к загрузке в репозиторий https://github.com/vvryzhov/car

### Быстрая загрузка (Windows PowerShell):
```powershell
.\push-to-github.ps1
```

### Быстрая загрузка (Linux/Mac):
```bash
chmod +x push-to-github.sh
./push-to-github.sh
```

### Ручная загрузка:
```bash
git init
git add .
git commit -m "Initial commit: Cottage Pass System with Docker support"
git remote add origin https://github.com/vvryzhov/car.git
git branch -M main
git push -u origin main
```

## Клонирование и запуск из GitHub

После загрузки в GitHub, любой может клонировать и запустить проект:

```bash
git clone https://github.com/vvryzhov/car.git
cd car
docker-compose up -d
```

Приложение будет доступно на `http://localhost:8080`

## LPR Integration API

Сервис поддерживает интеграцию с LPR Agent для автоматического открытия шлагбаума.

### Эндпоинты

#### POST /api/lpr/check

Проверяет, разрешён ли проезд для номера.

**Заголовки:**
- `X-LPR-Token: <LPR_TOKEN>` - обязательный

**Request:**
```json
{
  "plate": "A123BC777",
  "gateId": "main",
  "capturedAt": "2025-12-12T05:20:00+05:00",
  "confidence": 0.91
}
```

**Response (разрешено):**
```json
{
  "allowed": true,
  "reason": "ACTIVE_PASS_FOUND",
  "passId": 12345,
  "plateNorm": "А123ВВ777",
  "cooldownSeconds": 15
}
```

**Response (запрещено):**
```json
{
  "allowed": false,
  "reason": "NO_ACTIVE_PASS",
  "cooldownSeconds": 15,
  "plateNorm": "А123ВВ777"
}
```

#### POST /api/lpr/event

Сохраняет событие от LPR Agent.

**Заголовки:**
- `X-LPR-Token: <LPR_TOKEN>` - обязательный

**Request:**
```json
{
  "gateId": "main",
  "eventType": "GATE_OPENED",
  "eventAt": "2025-12-12T05:20:03+05:00",
  "plate": "A123BC777",
  "passId": 12345,
  "requestId": "0d5b1c1f-1f3b-4e5b-aef9-2b49f7b6d7f2",
  "confidence": 0.91,
  "meta": {}
}
```

**Response:**
```json
{
  "ok": true
}
```

Подробнее см. [LPR_INTEGRATION.md](./backend/LPR_INTEGRATION.md)

Подробные инструкции по развертыванию см. в [DEPLOY.md](./DEPLOY.md)

2025 год

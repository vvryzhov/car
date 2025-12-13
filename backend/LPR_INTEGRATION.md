# Интеграция LPR Agent с сервисом пропусков

## Обзор

Сервис пропусков интегрирован с LPR Agent для автоматического открытия шлагбаума по распознаванию госномера.

## Новые компоненты

### 1. Утилита нормализации номеров

**Файл:** `src/utils/plateNormalizer.ts`

Функция `normalizePlate()` приводит номера к единому формату для корректного сравнения:
- Приводит к верхнему регистру
- Удаляет пробелы, дефисы, точки
- Заменяет латинские буквы на кириллицу (A→А, B→В и т.д.)
- Заменяет Ё на Е

### 2. Middleware для LPR авторизации

**Файл:** `src/middleware/lprAuth.ts`

Middleware `requireLprToken` проверяет заголовок `X-LPR-Token` и сравнивает с `process.env.LPR_TOKEN`.

### 3. API эндпоинты

**Файл:** `src/routes/lpr.ts`

#### POST /api/lpr/check

Проверяет, разрешён ли проезд для номера.

**Request:**
```json
{
  "plate": "A123BV777",
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

**Request:**
```json
{
  "gateId": "main",
  "eventType": "GATE_OPENED",
  "eventAt": "2025-12-12T05:20:03+05:00",
  "plate": "A123BV777",
  "passId": 12345,
  "requestId": "0d5b1c1f-1f3b-4e5b-aef9-2b49f7b6d7f2",
  "confidence": 0.91,
  "meta": {
    "controller": "ip-relay-1",
    "latencyMs": 120
  }
}
```

**Response:**
```json
{
  "ok": true
}
```

### 4. Изменения в базе данных

#### Таблица passes

Добавлено поле:
- `plate_norm` (TEXT) - нормализованный номер для поиска

Добавлен индекс:
- `idx_passes_plate_norm_entry_status` на (plate_norm, entryDate, status)

#### Таблица lpr_events

Новая таблица для логов событий LPR:
- `id` (BIGSERIAL PRIMARY KEY)
- `created_at` (TIMESTAMPTZ)
- `gate_id` (TEXT)
- `event_type` (TEXT)
- `plate_raw` (TEXT)
- `plate_norm` (TEXT)
- `confidence` (NUMERIC)
- `pass_id` (BIGINT)
- `request_id` (UUID)
- `payload` (JSONB)

Индексы:
- `idx_lpr_events_gate_created` на (gate_id, created_at DESC)
- `idx_lpr_events_plate_norm` на (plate_norm)

## Переменные окружения

Добавьте в `.env`:

```env
# LPR Integration
LPR_TOKEN=your-secret-lpr-token-here

# LPR Configuration (опционально)
LPR_COOLDOWN_SECONDS=15
LPR_ALLOWED_STATUSES=pending
LPR_ALLOW_REPEAT_AFTER_ENTERED=false
TZ=Asia/Almaty
```

## Бизнес-логика

### Проверка пропуска (POST /api/lpr/check)

1. Нормализует номер
2. Определяет "сегодня" в локальной временной зоне
3. Ищет заявку по критериям:
   - `plate_norm` = нормализованный номер
   - `entryDate` = сегодня
   - `status` = 'pending' (или из `LPR_ALLOWED_STATUSES`)
   - `deletedAt` IS NULL
4. Возвращает решение с причиной

### Обработка событий (POST /api/lpr/event)

1. Сохраняет событие в `lpr_events`
2. Если `eventType` = 'GATE_OPENED' или 'CAR_ENTERED' и есть `passId`:
   - Обновляет статус заявки на 'activated' (Заехал)
   - Обновляет `updatedAt`

## Миграции

Миграции выполняются автоматически при запуске сервера:
- Добавление поля `plate_norm` в таблицу `passes`
- Заполнение `plate_norm` для существующих записей
- Создание таблицы `lpr_events`
- Создание индексов

## Тестирование

### Проверка эндпоинта check

```bash
curl -X POST http://localhost:3001/api/lpr/check \
  -H "Content-Type: application/json" \
  -H "X-LPR-Token: your-secret-lpr-token-here" \
  -d '{
    "plate": "A123BC777",
    "gateId": "main",
    "confidence": 0.91
  }'
```

### Проверка эндпоинта event

```bash
curl -X POST http://localhost:3001/api/lpr/event \
  -H "Content-Type: application/json" \
  -H "X-LPR-Token: your-secret-lpr-token-here" \
  -d '{
    "gateId": "main",
    "eventType": "GATE_OPENED",
    "plate": "A123BC777",
    "passId": 12345,
    "confidence": 0.91
  }'
```

## Безопасность

- Все эндпоинты `/api/lpr/*` защищены middleware `requireLprToken`
- Токен передаётся в заголовке `X-LPR-Token`
- Токен сравнивается с `process.env.LPR_TOKEN`

## Дополнительные настройки

### Разрешить повторный проезд после "Заехал"

```env
LPR_ALLOW_REPEAT_AFTER_ENTERED=true
```

### Разрешить другие статусы

```env
LPR_ALLOWED_STATUSES=pending,approved
```

### Изменить cooldown

```env
LPR_COOLDOWN_SECONDS=20
```

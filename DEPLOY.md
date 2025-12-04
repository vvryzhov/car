# Инструкция по развертыванию

## Загрузка в GitHub

1. Инициализируйте git репозиторий (если еще не сделано):
```bash
cd cottage-pass-system
git init
```

2. Добавьте все файлы:
```bash
git add .
```

3. Создайте первый коммит:
```bash
git commit -m "Initial commit: Cottage Pass System"
```

4. Добавьте remote репозиторий:
```bash
git remote add origin https://github.com/vvryzhov/car.git
```

5. Загрузите код:
```bash
git branch -M main
git push -u origin main
```

## Клонирование и запуск из GitHub

1. Клонируйте репозиторий:
```bash
git clone https://github.com/vvryzhov/car.git
cd car
```

2. Запустите через Docker:
```bash
docker-compose up -d
```

3. Откройте браузер: `http://localhost`

## Обновление проекта

Если вы внесли изменения и хотите обновить репозиторий:

```bash
git add .
git commit -m "Описание изменений"
git push origin main
```

## Пересборка Docker образов

Если вы обновили код и хотите пересобрать образы:

```bash
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

Или просто:

```bash
docker-compose up -d --build
```

## Резервное копирование базы данных

База данных хранится в файле `backend/passes.db`. Для резервного копирования:

```bash
# Остановите контейнеры
docker-compose down

# Скопируйте файл базы данных
cp backend/passes.db backup/passes_$(date +%Y%m%d_%H%M%S).db

# Запустите снова
docker-compose up -d
```

## Логи

Просмотр логов:
```bash
# Все сервисы
docker-compose logs -f

# Только backend
docker-compose logs -f backend

# Только frontend
docker-compose logs -f frontend
```


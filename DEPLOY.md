# Инструкция по развертыванию на сервере

## Требования

- Linux сервер (Ubuntu/Debian/CentOS)
- Docker и Docker Compose установлены
- Git установлен
- Минимум 2GB RAM
- Минимум 10GB свободного места на диске

## Установка Docker и Docker Compose

### Ubuntu/Debian:

```bash
# Обновляем систему
sudo apt update && sudo apt upgrade -y

# Устанавливаем Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Добавляем пользователя в группу docker
sudo usermod -aG docker $USER

# Устанавливаем Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Перезаходим в систему или выполняем:
newgrp docker
```

### CentOS/RHEL:

```bash
# Устанавливаем Docker
sudo yum install -y yum-utils
sudo yum-config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
sudo yum install -y docker-ce docker-ce-cli containerd.io
sudo systemctl start docker
sudo systemctl enable docker

# Устанавливаем Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Добавляем пользователя в группу docker
sudo usermod -aG docker $USER
newgrp docker
```

## Развертывание проекта

### 1. Клонирование репозитория

```bash
# Переходим в домашнюю директорию или создаем директорию для проектов
cd ~
mkdir -p projects
cd projects

# Клонируем репозиторий
git clone https://github.com/vvryzhov/car.git
cd car
```

### 2. Настройка переменных окружения

Создайте файл `.env` в корне проекта:

```bash
nano .env
```

Добавьте следующие переменные (измените значения на свои):

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
```

Сохраните файл (Ctrl+O, Enter, Ctrl+X в nano).

### 3. Запуск проекта

```bash
# Запускаем все сервисы в фоновом режиме
docker-compose up -d

# Проверяем статус контейнеров
docker-compose ps

# Смотрим логи (если нужно)
docker-compose logs -f
```

### 4. Проверка работы

```bash
# Проверяем, что все контейнеры запущены
docker-compose ps

# Должны быть запущены:
# - cottage-pass-postgres
# - cottage-pass-backend
# - cottage-pass-frontend
```

Откройте в браузере: `http://ваш-ip-сервера:8080`

## Настройка файрвола

Если на сервере включен файрвол, откройте необходимые порты:

### UFW (Ubuntu):

```bash
sudo ufw allow 8080/tcp
sudo ufw allow 3001/tcp
sudo ufw allow 5432/tcp
sudo ufw reload
```

### firewalld (CentOS/RHEL):

```bash
sudo firewall-cmd --permanent --add-port=8080/tcp
sudo firewall-cmd --permanent --add-port=3001/tcp
sudo firewall-cmd --permanent --add-port=5432/tcp
sudo firewall-cmd --reload
```

## Настройка домена и Nginx (опционально)

Если у вас есть домен и вы хотите использовать его вместо IP:

### 1. Установите Nginx:

```bash
sudo apt install nginx -y  # Ubuntu/Debian
# или
sudo yum install nginx -y  # CentOS/RHEL
```

### 2. Создайте конфигурацию:

```bash
sudo nano /etc/nginx/sites-available/cottage-pass
```

Добавьте:

```nginx
server {
    listen 80;
    server_name ваш-домен.com;

    location / {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

### 3. Активируйте конфигурацию:

```bash
# Ubuntu/Debian
sudo ln -s /etc/nginx/sites-available/cottage-pass /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

# CentOS/RHEL
sudo cp /etc/nginx/sites-available/cottage-pass /etc/nginx/conf.d/cottage-pass.conf
sudo nginx -t
sudo systemctl reload nginx
```

## Управление проектом

### Остановка:

```bash
docker-compose down
```

### Запуск:

```bash
docker-compose up -d
```

### Перезапуск:

```bash
docker-compose restart
```

### Просмотр логов:

```bash
# Все сервисы
docker-compose logs -f

# Конкретный сервис
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f postgres
```

### Обновление проекта:

```bash
# Останавливаем контейнеры
docker-compose down

# Получаем последние изменения
git pull

# Пересобираем и запускаем
docker-compose up -d --build
```

## Резервное копирование базы данных

### Создание бэкапа:

```bash
# Создаем директорию для бэкапов
mkdir -p ~/backups

# Создаем бэкап
docker-compose exec postgres pg_dump -U postgres passes_db > ~/backups/passes_db_$(date +%Y%m%d_%H%M%S).sql

# Или с паролем (если установлен)
docker-compose exec -e PGPASSWORD=your-password postgres pg_dump -U postgres passes_db > ~/backups/passes_db_$(date +%Y%m%d_%H%M%S).sql
```

### Восстановление из бэкапа:

```bash
# Останавливаем backend
docker-compose stop backend

# Восстанавливаем базу
docker-compose exec -T postgres psql -U postgres passes_db < ~/backups/passes_db_YYYYMMDD_HHMMSS.sql

# Запускаем backend
docker-compose start backend
```

## Автоматический бэкап (cron)

Создайте скрипт для автоматического бэкапа:

```bash
nano ~/backup-db.sh
```

Добавьте:

```bash
#!/bin/bash
BACKUP_DIR=~/backups
DATE=$(date +%Y%m%d_%H%M%S)
cd /path/to/car
docker-compose exec -T postgres pg_dump -U postgres passes_db > $BACKUP_DIR/passes_db_$DATE.sql
# Удаляем бэкапы старше 7 дней
find $BACKUP_DIR -name "passes_db_*.sql" -mtime +7 -delete
```

Сделайте скрипт исполняемым:

```bash
chmod +x ~/backup-db.sh
```

Добавьте в crontab (бэкап каждый день в 2:00):

```bash
crontab -e
```

Добавьте строку:

```
0 2 * * * /home/username/backup-db.sh
```

## Мониторинг

### Проверка использования ресурсов:

```bash
docker stats
```

### Проверка места на диске:

```bash
docker system df
```

### Очистка неиспользуемых данных:

```bash
docker system prune -a
```

## Устранение неполадок

### Контейнеры не запускаются:

```bash
# Проверяем логи
docker-compose logs

# Проверяем статус
docker-compose ps

# Пересобираем образы
docker-compose build --no-cache
docker-compose up -d
```

### Проблемы с базой данных:

```bash
# Проверяем подключение к PostgreSQL
docker-compose exec postgres psql -U postgres -d passes_db -c "SELECT 1;"

# Проверяем логи PostgreSQL
docker-compose logs postgres
```

### Проблемы с портами:

```bash
# Проверяем, какие порты заняты
sudo netstat -tulpn | grep :8080
sudo netstat -tulpn | grep :3001
sudo netstat -tulpn | grep :5432
```

## Безопасность

1. **Обязательно измените JWT_SECRET** в `.env` на случайную строку
2. **Измените пароль PostgreSQL** в `.env`
3. **Настройте файрвол** - откройте только необходимые порты
4. **Используйте HTTPS** - настройте SSL сертификат (Let's Encrypt)
5. **Регулярно обновляйте** Docker образы и систему
6. **Делайте бэкапы** базы данных регулярно

## Подключение к внешней PostgreSQL (опционально)

Если у вас уже есть PostgreSQL сервер, измените в `.env`:

```env
DB_HOST=ваш-postgres-host
DB_PORT=5432
DB_NAME=passes_db
DB_USER=ваш-пользователь
DB_PASSWORD=ваш-пароль
```

И удалите сервис `postgres` из `docker-compose.yml` или закомментируйте его.

## Учетные данные

После первого запуска создается администратор по умолчанию. **ВАЖНО**: Смените пароль администратора после первого входа!

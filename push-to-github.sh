#!/bin/bash

# Скрипт для загрузки проекта в GitHub
# Использование: ./push-to-github.sh

echo "Инициализация Git репозитория..."

# Проверяем, инициализирован ли git
if [ ! -d .git ]; then
    git init
    echo "Git репозиторий инициализирован"
fi

# Добавляем remote (если еще не добавлен)
if ! git remote | grep -q "origin"; then
    git remote add origin https://github.com/vvryzhov/car.git
    echo "Remote 'origin' добавлен"
else
    echo "Remote 'origin' уже существует"
fi

# Добавляем все файлы
echo "Добавление файлов..."
git add .

# Проверяем, есть ли изменения для коммита
if [ -n "$(git status --porcelain)" ]; then
    echo "Создание коммита..."
    git commit -m "Initial commit: Cottage Pass System with Docker support"
    
    echo "Загрузка в GitHub..."
    git branch -M main
    git push -u origin main
    
    echo "Проект успешно загружен в GitHub!"
    echo "Репозиторий: https://github.com/vvryzhov/car"
else
    echo "Нет изменений для коммита"
fi

echo ""
echo "Для клонирования и запуска используйте:"
echo "  git clone https://github.com/vvryzhov/car.git"
echo "  cd car"
echo "  docker-compose up -d"


@echo off
cd /d %~dp0

echo Проверка статуса Git...
if not exist .git (
    echo Инициализация Git репозитория...
    git init
)

echo Проверка remote...
git remote | findstr /C:"origin" >nul
if errorlevel 1 (
    echo Добавление remote origin...
    git remote add origin https://github.com/vvryzhov/car.git
)

echo Добавление файлов...
git add .

echo Создание коммита...
git commit -m "Fix TypeScript compilation errors: sqlite3 promisify and port type"

echo Установка ветки main...
git branch -M main

echo Загрузка в GitHub...
git push -u origin main

echo Готово!
pause











@echo off
chcp 65001 >nul
cd /d %~dp0

echo ========================================
echo Загрузка исправлений в GitHub
echo ========================================
echo.

REM Проверка инициализации git
if not exist .git (
    echo [1/5] Инициализация Git репозитория...
    git init
    if errorlevel 1 (
        echo ОШИБКА: Не удалось инициализировать git
        pause
        exit /b 1
    )
) else (
    echo [1/5] Git репозиторий уже инициализирован
)

REM Проверка remote
echo [2/5] Проверка remote репозитория...
git remote | findstr /C:"origin" >nul
if errorlevel 1 (
    echo Добавление remote origin...
    git remote add origin https://github.com/vvryzhov/car.git
    if errorlevel 1 (
        echo ОШИБКА: Не удалось добавить remote
        pause
        exit /b 1
    )
) else (
    echo Remote origin уже настроен
    git remote set-url origin https://github.com/vvryzhov/car.git
)

REM Добавление файлов
echo [3/5] Добавление измененных файлов...
git add .
if errorlevel 1 (
    echo ОШИБКА: Не удалось добавить файлы
    pause
    exit /b 1
)

REM Проверка наличия изменений
git diff --cached --quiet
if not errorlevel 1 (
    echo Нет изменений для коммита
    pause
    exit /b 0
)

REM Создание коммита
echo [4/5] Создание коммита...
git commit -m "Fix TypeScript compilation errors: sqlite3 promisify and port type"
if errorlevel 1 (
    echo ОШИБКА: Не удалось создать коммит
    pause
    exit /b 1
)

REM Установка ветки main
echo [5/5] Настройка ветки main...
git branch -M main 2>nul

REM Пуш в GitHub
echo.
echo Загрузка в GitHub...
git push -u origin main
if errorlevel 1 (
    echo.
    echo ВНИМАНИЕ: Возможны проблемы с аутентификацией
    echo Убедитесь, что у вас есть доступ к репозиторию
    echo или используйте Personal Access Token
    pause
    exit /b 1
)

echo.
echo ========================================
echo Изменения успешно загружены в GitHub!
echo ========================================
echo Репозиторий: https://github.com/vvryzhov/car
echo.
pause











# Скрипт для загрузки исправлений в GitHub
# Использование: .\push-fixes.ps1

$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Загрузка исправлений в GitHub" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Переход в директорию скрипта
Set-Location $PSScriptRoot

# Проверка инициализации git
Write-Host "[1/5] Проверка Git репозитория..." -ForegroundColor Yellow
if (-not (Test-Path .git)) {
    Write-Host "Инициализация Git репозитория..." -ForegroundColor Green
    git init
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ОШИБКА: Не удалось инициализировать git" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "Git репозиторий уже инициализирован" -ForegroundColor Green
}

# Проверка remote
Write-Host "[2/5] Проверка remote репозитория..." -ForegroundColor Yellow
$remoteExists = git remote | Select-String -Pattern "origin"
if (-not $remoteExists) {
    Write-Host "Добавление remote origin..." -ForegroundColor Green
    git remote add origin https://github.com/vvryzhov/car.git
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ОШИБКА: Не удалось добавить remote" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "Remote origin уже настроен" -ForegroundColor Green
    git remote set-url origin https://github.com/vvryzhov/car.git
}

# Добавление файлов
Write-Host "[3/5] Добавление измененных файлов..." -ForegroundColor Yellow
git add .
if ($LASTEXITCODE -ne 0) {
    Write-Host "ОШИБКА: Не удалось добавить файлы" -ForegroundColor Red
    exit 1
}

# Проверка наличия изменений
$status = git status --porcelain
if (-not $status) {
    Write-Host "Нет изменений для коммита" -ForegroundColor Yellow
    exit 0
}

# Создание коммита
Write-Host "[4/5] Создание коммита..." -ForegroundColor Yellow
git commit -m "Fix TypeScript compilation errors: sqlite3 promisify and port type"
if ($LASTEXITCODE -ne 0) {
    Write-Host "ОШИБКА: Не удалось создать коммит" -ForegroundColor Red
    exit 1
}

# Установка ветки main
Write-Host "[5/5] Настройка ветки main..." -ForegroundColor Yellow
git branch -M main 2>$null

# Пуш в GitHub
Write-Host ""
Write-Host "Загрузка в GitHub..." -ForegroundColor Yellow
git push -u origin main
if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "ВНИМАНИЕ: Возможны проблемы с аутентификацией" -ForegroundColor Red
    Write-Host "Убедитесь, что у вас есть доступ к репозиторию" -ForegroundColor Yellow
    Write-Host "или используйте Personal Access Token" -ForegroundColor Yellow
    exit 1
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "Изменения успешно загружены в GitHub!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host "Репозиторий: https://github.com/vvryzhov/car" -ForegroundColor Cyan
Write-Host ""







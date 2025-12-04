# Скрипт для загрузки проекта в GitHub
# Использование: .\push-to-github.ps1

Write-Host "Инициализация Git репозитория..." -ForegroundColor Green

# Проверяем, инициализирован ли git
if (-not (Test-Path .git)) {
    git init
    Write-Host "Git репозиторий инициализирован" -ForegroundColor Green
}

# Добавляем remote (если еще не добавлен)
$remoteExists = git remote | Select-String -Pattern "origin"
if (-not $remoteExists) {
    git remote add origin https://github.com/vvryzhov/car.git
    Write-Host "Remote 'origin' добавлен" -ForegroundColor Green
} else {
    Write-Host "Remote 'origin' уже существует" -ForegroundColor Yellow
}

# Добавляем все файлы
Write-Host "Добавление файлов..." -ForegroundColor Green
git add .

# Проверяем, есть ли изменения для коммита
$status = git status --porcelain
if ($status) {
    Write-Host "Создание коммита..." -ForegroundColor Green
    git commit -m "Initial commit: Cottage Pass System with Docker support"
    
    Write-Host "Загрузка в GitHub..." -ForegroundColor Green
    git branch -M main
    git push -u origin main
    
    Write-Host "Проект успешно загружен в GitHub!" -ForegroundColor Green
    Write-Host "Репозиторий: https://github.com/vvryzhov/car" -ForegroundColor Cyan
} else {
    Write-Host "Нет изменений для коммита" -ForegroundColor Yellow
}

Write-Host "`nДля клонирования и запуска используйте:" -ForegroundColor Cyan
Write-Host "  git clone https://github.com/vvryzhov/car.git" -ForegroundColor White
Write-Host "  cd car" -ForegroundColor White
Write-Host "  docker-compose up -d" -ForegroundColor White


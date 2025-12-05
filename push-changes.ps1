# Скрипт для пуша изменений в GitHub
Set-Location $PSScriptRoot

Write-Host "Проверка статуса Git..." -ForegroundColor Green

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
}

# Добавляем все файлы
Write-Host "Добавление файлов..." -ForegroundColor Green
git add .

# Проверяем, есть ли изменения для коммита
$status = git status --porcelain
if ($status) {
    Write-Host "Создание коммита с исправлениями TypeScript..." -ForegroundColor Green
    git commit -m "Fix TypeScript compilation errors: sqlite3 promisify and port type"
    
    Write-Host "Загрузка в GitHub..." -ForegroundColor Green
    git branch -M main
    git push -u origin main
    
    Write-Host "Изменения успешно загружены в GitHub!" -ForegroundColor Green
} else {
    Write-Host "Нет изменений для коммита" -ForegroundColor Yellow
}











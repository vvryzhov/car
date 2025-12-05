# Инструкция по загрузке изменений в GitHub

## Быстрый способ (Windows)

Просто запустите файл `push-fixes.bat` двойным кликом или из командной строки:

```cmd
cd C:\Users\dollar\Coursor\car
push-fixes.bat
```

## Ручной способ

Если bat-файл не работает, выполните команды вручную в PowerShell или командной строке:

```powershell
# Перейти в директорию проекта
cd C:\Users\dollar\Coursor\car

# Инициализировать git (если еще не инициализирован)
git init

# Добавить remote (если еще не добавлен)
git remote add origin https://github.com/vvryzhov/car.git
# Или обновить существующий:
git remote set-url origin https://github.com/vvryzhov/car.git

# Добавить все изменения
git add .

# Создать коммит
git commit -m "Fix TypeScript compilation errors: sqlite3 promisify and port type"

# Установить ветку main
git branch -M main

# Запушить в GitHub
git push -u origin main
```

## Если требуется аутентификация

Если GitHub запросит логин и пароль:

1. **Используйте Personal Access Token вместо пароля:**
   - Перейдите в GitHub Settings → Developer settings → Personal access tokens → Tokens (classic)
   - Создайте новый token с правами `repo`
   - Используйте этот token как пароль

2. **Или настройте SSH ключ:**
   ```powershell
   git remote set-url origin git@github.com:vvryzhov/car.git
   ```

## Что будет запушено

- ✅ Исправления в `backend/src/database.ts` (обертки для sqlite3)
- ✅ Исправления в `backend/src/index.ts` (тип порта)
- ✅ Обновление `docker-compose.yml` (удалено устаревшее поле version)











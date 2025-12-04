@echo off
cd /d %~dp0
git add .
git commit -m "Fix TypeScript compilation errors: sqlite3 promisify and port type"
git push -u origin main




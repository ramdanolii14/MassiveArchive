@echo off
setlocal
cd /d "%~dp0"

if not exist "package.json" (
    echo [MassiveArchive] package.json tidak ditemukan.
    echo Pastikan file launcher ini berada di folder project MassiveArchive.
    pause
    exit /b 1
)

if not exist "server.js" (
    echo [MassiveArchive] server.js tidak ditemukan.
    pause
    exit /b 1
)

where npm.cmd >nul 2>&1
if errorlevel 1 (
    echo [MassiveArchive] Node.js/npm tidak ditemukan di Windows ini.
    echo Pasang Node.js terlebih dahulu agar npm start dapat dijalankan.
    pause
    exit /b 1
)

echo [MassiveArchive] Menjalankan npm start dari flashdisk:
echo %~dp0
echo.
call npm.cmd start
pause

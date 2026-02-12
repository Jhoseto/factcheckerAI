@echo off
echo ========================================
echo  FactChecker AI - Restart Script
echo ========================================
echo.

echo [1/3] Stopping all Node.js processes...
taskkill /F /IM node.exe 2>nul
if %errorlevel% equ 0 (
    echo ✓ All Node processes stopped
) else (
    echo - No Node processes found
)
timeout /t 2 /nobreak >nul

echo.
echo [2/3] Starting backend server...
start "Backend Server" cmd /k "node server.js"
timeout /t 3 /nobreak >nul

echo.
echo [3/3] Starting frontend dev server...
start "Frontend Dev Server" cmd /k "npm run dev"

echo.
echo ========================================
echo  ✓ Restart Complete!
echo ========================================
echo.
echo Backend:  http://localhost:8080
echo Frontend: http://localhost:3000
echo.
echo Close this window to continue...
timeout /t 5

@echo off
chcp 65001 >nul
cd /d "%~dp0.."

set "NODE="
if exist "C:\Program Files\nodejs\node.exe" set "NODE=C:\Program Files\nodejs\node.exe"
if exist "%LOCALAPPDATA%\Programs\node\node.exe" set "NODE=%LOCALAPPDATA%\Programs\node\node.exe"
if exist "%LOCALAPPDATA%\Programs\cursor\resources\app\resources\helpers\node.exe" (
  set "NODE=%LOCALAPPDATA%\Programs\cursor\resources\app\resources\helpers\node.exe"
)

if not defined NODE (
  echo Node.js not found. Install from https://nodejs.org
  exit /b 1
)

echo Stopping any process on port 3001...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3001" ^| findstr "LISTENING"') do (
  echo Killing PID %%a
  taskkill /PID %%a /F >nul 2>&1
)
timeout /t 1 /nobreak >nul

echo.
echo Starting 9ruDocs API: http://localhost:3001
echo Available routes (see console after start):
echo   GET  /health
echo   GET  /
echo   POST /blog/generate
echo   POST /wordpress/publish
echo   POST /wordpress/verify
echo   POST /wordpress/media
echo.
"%NODE%" apps\api\server.mjs

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

REM Already running?
"%NODE%" -e "fetch('http://127.0.0.1:3001/health').then(r=>r.ok?process.exit(0):process.exit(1)).catch(()=>process.exit(1))" 2>nul
if %errorlevel%==0 (
  echo API is already running: http://localhost:3001
  echo Health: http://localhost:3001/health
  exit /b 0
)

echo Starting API: http://localhost:3001
"%NODE%" apps\api\server.mjs

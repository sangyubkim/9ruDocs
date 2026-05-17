@echo off
chcp 65001 >nul
echo Stopping process on port 3001...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3001" ^| findstr "LISTENING"') do (
  echo Killing PID %%a
  taskkill /PID %%a /F >nul 2>&1
)
timeout /t 1 /nobreak >nul
echo Done. Run scripts\start-api.bat again.

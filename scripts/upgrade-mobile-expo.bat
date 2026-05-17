@echo off
chcp 65001 >nul
cd /d "%~dp0..\apps\mobile"
echo Expo SDK 55 upgrade...
if not exist package.json (
  echo apps\mobile not found
  exit /b 1
)
call npm install --no-audit --no-fund
if errorlevel 1 exit /b 1
call npx expo install --fix
echo.
echo Done. Run: npx expo start -c
pause

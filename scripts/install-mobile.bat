@echo off
chcp 65001 >nul
cd /d "%~dp0..\apps\mobile"
call npm install --no-audit --no-fund
if errorlevel 1 (
  echo npm install failed. Install Node.js LTS from https://nodejs.org
  exit /b 1
)
call npx expo install expo-asset expo-constants expo-font expo-modules-core --yes
echo Done. Run: cd apps\mobile ^&^& npx expo start

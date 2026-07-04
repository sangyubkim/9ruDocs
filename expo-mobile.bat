@echo off
REM Expo는 apps\mobile 에서만 실행 (루트 npx expo 는 npm에서 SDK 55 를 받아옴)
setlocal EnableExtensions
chcp 65001 >nul

if exist "%ProgramFiles%\nodejs" set "PATH=%ProgramFiles%\nodejs;%PATH%"

cd /d "%~dp0apps\mobile"
if errorlevel 1 (
  echo [오류] apps\mobile 폴더를 찾을 수 없습니다.
  exit /b 1
)

where node >nul 2>&1
if errorlevel 1 (
  echo [오류] Node.js 가 설치되어 있지 않습니다.
  exit /b 1
)

call node scripts\prestart-check.mjs
if errorlevel 1 exit /b 1

call npx expo %*

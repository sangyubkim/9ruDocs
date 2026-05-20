@echo off
REM Expo는 apps\mobile 에서만 실행 (루트 npx expo 는 npm에서 SDK 55 를 받아옴)
cd /d "%~dp0apps\mobile"
call npx expo %*

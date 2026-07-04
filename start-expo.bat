@echo off
chcp 65001 >nul
echo.
echo [9ruDocs] Expo는 apps\mobile 에서만 실행합니다.
echo 루트에서 npx expo / npm install expo 를 쓰면 SDK 55가 설치되어 오류가 납니다.
echo.
node "%~dp0scripts\clean-root-expo.mjs"
call "%~dp0expo-mobile.bat" start -c
pause

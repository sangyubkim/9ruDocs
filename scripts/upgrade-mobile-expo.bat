@echo off
setlocal EnableExtensions
chcp 65001 >nul

if exist "%ProgramFiles%\nodejs" set "PATH=%ProgramFiles%\nodejs;%PATH%"

set "MOBILE_DIR=%~dp0..\apps\mobile"
set "ROOT_DIR=%~dp0.."

cd /d "%MOBILE_DIR%"
if errorlevel 1 (
  echo [오류] apps\mobile 폴더를 찾을 수 없습니다.
  exit /b 1
)

echo ============================================================
echo  9ruDocs mobile - Expo SDK 54 (Play Store Expo Go 호환)
echo ============================================================
echo.
echo [사전 확인]
echo   1. Android: Play 스토어에서 "Expo Go" 최신 버전으로 업데이트
echo   2. Node.js 20 LTS 권장 (apps\mobile\.nvmrc 참고)
echo   3. 개발 서버는 반드시 apps\mobile 에서만 실행
echo      - OK:  cd apps\mobile  ^&^&  npx expo start -c
echo      - OK:  expo-mobile.bat start -c  (저장소 루트에서)
echo      - OK:  npm run mobile   (저장소 루트 9ruDocs 에서)
echo      - NO:  npx expo start   (루트에서 — SDK 55 잔여물로 오류 반복)
echo   4. 이 스크립트는 루트+apps\mobile node_modules 를 재생성합니다
echo.
pause

where node >nul 2>&1
if errorlevel 1 (
  echo [오류] Node.js 가 설치되어 있지 않습니다. https://nodejs.org LTS 설치 후 다시 실행하세요.
  exit /b 1
)

echo Node:
node -v
echo.

echo [0/5] 루트 expo 오염 정리 (clean-root-expo) ...
call node "%ROOT_DIR%\scripts\clean-root-expo.mjs"
if errorlevel 1 (
  echo [오류] 루트 expo 정리 실패. package.json 에 expo 항목이 남아 있는지 확인하세요.
  exit /b 1
)

if exist node_modules (
  echo [1/5] apps\mobile node_modules 삭제 ...
  rmdir /s /q node_modules
)
if exist package-lock.json (
  echo       package-lock.json 삭제 ...
  del /f /q package-lock.json
)

echo.
echo [2/5] npm install ...
call npm install --no-audit --no-fund
if errorlevel 1 exit /b 1

echo.
echo [3/5] expo install --fix (SDK 54 bundledNativeModules 맞춤) ...
call npx expo install --fix
if errorlevel 1 exit /b 1

echo.
echo [4/5] expo-doctor (의존성 검증) ...
call npm run doctor
if errorlevel 1 (
  echo.
  echo [경고] expo-doctor 에서 문제가 발견되었습니다. 위 로그를 확인하세요.
  echo        계속 진행합니다...
)

echo.
echo [5/5] 설치된 Expo SDK 확인 ...
call npx expo --version
node -e "const p=require('./node_modules/expo/package.json'); const major=p.version.split('.')[0]; console.log('expo package:', p.version, '-> SDK', major); if(major!=='54'){console.error('ERROR: SDK 54 가 아닙니다!'); process.exit(1);}"

if errorlevel 1 (
  echo.
  echo [오류] Expo SDK 54 가 아닙니다. package.json overrides 를 확인하세요.
  exit /b 1
)

call node scripts\prestart-check.mjs
if errorlevel 1 exit /b 1

echo.
echo ============================================================
echo  완료. 다음 순서로 실행하세요:
echo.
echo    cd apps\mobile
echo    npx expo start -c
echo.
echo  또는 저장소 루트에서:
echo    expo-mobile.bat start -c
echo.
echo  터미널에서 확인:
echo    - "Using Expo SDK 54" 또는 expo package 54.x.x
echo    - QR 스캔 후에도 오류면 Play 스토어에서 Expo Go 업데이트
echo.
echo  주의: 저장소 루트(9ruDocs)에서 npx expo 를 실행하지 마세요.
echo ============================================================
pause

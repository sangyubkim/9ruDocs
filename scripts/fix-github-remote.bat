@echo off
chcp 65001 >nul
cd /d "%~dp0.."

echo === 현재 origin ===
git remote -v
echo.

echo GitHub 사용자명/저장소명을 확인하세요.
echo   프로필: https://github.com/settings/profile
echo   저장소를 먼저 만든 뒤 URL을 입력합니다.
echo.
set /p GITHUB_USER=GitHub 사용자명 (예: sangyub-kim): 
set /p REPO_NAME=저장소 이름 (예: 9ruDocs): 

git remote remove origin 2>nul
git remote add origin https://github.com/%GITHUB_USER%/%REPO_NAME%.git
echo.
echo === 변경된 origin ===
git remote -v
echo.
echo 다음: git push -u origin main
echo (main이 없으면: git branch -M main)
pause

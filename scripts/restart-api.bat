@echo off
chcp 65001 >nul
cd /d "%~dp0"
call "%~dp0stop-api.bat"
echo.
call "%~dp0start-api.bat"

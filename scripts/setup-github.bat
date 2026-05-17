@echo off
cd /d "%~dp0.."
powershell -ExecutionPolicy Bypass -File "%~dp0setup-github.ps1" %*
pause

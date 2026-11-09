@echo off
title Marrow Rite 1v1 server
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0server.ps1" %*
echo.
echo The server has stopped. Press any key to close this window.
pause >nul

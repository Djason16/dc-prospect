@echo off
rem Menu of the project: double-click
where pwsh >nul 2>nul
if %errorlevel%==0 (pwsh -NoProfile -ExecutionPolicy Bypass -File "%~dp0start.ps1" %*) else (powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start.ps1" %*)
pause

@echo off
chcp 65001 >nul
REM Behavior:
REM  - Default: run once and exit
REM  - To enable automatic restart on exit/crash, pass the argument: loop
REM    Example: run_loop.bat loop

set "exe=C:\Program Files\SystemMonitor\SystemMonitor.exe"

if "%~1"=="loop" (
	echo Starting in loop mode: %exe%
	:loop
	"%exe%"
	timeout /t 2 /nobreak >nul
	goto loop
) else (
	echo Running once: %exe%
	"%exe%"
)

exit /b %ERRORLEVEL%

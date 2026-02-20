@echo off
chcp 65001 >nul
REM run_loop.bat lives in the resources folder; SystemMonitor.exe is one level up
set "SCRIPT_DIR=%~dp0"
set "EXE_PATH=%SCRIPT_DIR%..\SystemMonitor.exe"

REM Marker path checked before restarting. If present, do not restart.
set "MARKER=%ProgramData%\SystemMonitor\disabled"

:loop
if exist "%MARKER%" (
	echo [run_loop] Disabled marker found at "%MARKER%"; exiting loop.
	goto :eof
)

if exist "%EXE_PATH%" (
	"%EXE_PATH%"
) else (
	echo [run_loop] SystemMonitor.exe not found at "%EXE_PATH%"
	timeout /t 5 /nobreak >nul
)

timeout /t 2 /nobreak >nul
goto loop

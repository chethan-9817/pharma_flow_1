@echo off
rem Double-click this file to start PharmaFlow and open it in your browser.
call "%~dp0pharmaflow.cmd"
if errorlevel 1 goto failed
timeout /t 3 >nul
exit /b 0

:failed
echo.
echo Something went wrong. Read the message above, then press any key to close.
pause >nul
exit /b 1

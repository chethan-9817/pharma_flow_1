@echo off
rem PharmaFlow command. Works in PowerShell and Command Prompt.
rem
rem   pharmaflow          start the app in the background and open it in the browser
rem   pharmaflow dev      run the dev server in this window (Ctrl+C to stop)
rem   pharmaflow stop     stop the background app
rem   pharmaflow status   say whether the app is running
rem   pharmaflow test     run the tests
rem   pharmaflow db       build and print the sample database
rem   pharmaflow build    typecheck and create a production build
rem   pharmaflow help     show this list
rem
rem Add -NoBrowser to skip opening the browser, for example: pharmaflow -NoBrowser

set "PF_FLAG="
if /i "%~1"=="dev" set "PF_FLAG=-Foreground"
if /i "%~1"=="stop" set "PF_FLAG=-Stop"
if /i "%~1"=="status" set "PF_FLAG=-Status"
if /i "%~1"=="test" set "PF_FLAG=-Test"
if /i "%~1"=="db" set "PF_FLAG=-Db"
if /i "%~1"=="build" set "PF_FLAG=-Build"
if /i "%~1"=="help" goto help
if /i "%~1"=="-h" goto help
if /i "%~1"=="/?" goto help

rem Anything else (such as -NoBrowser) is passed straight through.
if not defined PF_FLAG set "PF_FLAG=%~1"

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0run.ps1" %PF_FLAG% %2 %3 %4
exit /b %ERRORLEVEL%

:help
echo.
echo   pharmaflow          start the app in the background and open it in the browser
echo   pharmaflow dev      run the dev server in this window (Ctrl+C to stop)
echo   pharmaflow stop     stop the background app
echo   pharmaflow status   say whether the app is running
echo   pharmaflow test     run the tests
echo   pharmaflow db       build and print the sample database
echo   pharmaflow build    typecheck and create a production build
echo.
exit /b 0

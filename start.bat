@echo off
REM Double-click this file to start the toolkit on Windows.
setlocal
chcp 65001 >nul
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo   Node.js isn't installed yet.
  echo   Get it from https://nodejs.org ^(the big green LTS button^),
  echo   then double-click this file again.
  echo.
  pause
  exit /b 1
)

node "packages\bridge\bin\start.js" %*
set EXITCODE=%errorlevel%

REM Keep the window open so any message stays readable instead of vanishing.
echo.
if %EXITCODE% neq 0 (
  echo   The toolkit stopped with an error ^(code %EXITCODE%^).
) else (
  echo   The toolkit has stopped.
)
pause
exit /b %EXITCODE%

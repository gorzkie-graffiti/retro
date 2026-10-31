@echo off
setlocal
cd /d "%~dp0yt2009"
where npm.cmd >nul 2>nul || (
  echo Node.js is required. See yt2009\windowsxp.md for legacy Windows notes.
  exit /b 1
)
if not exist node_modules call npm.cmd install || exit /b 1
call npm.cmd start
endlocal

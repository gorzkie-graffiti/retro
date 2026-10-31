@echo off
setlocal
cd /d "%~dp0spotamp"
where npm.cmd >nul 2>nul || (
  echo Node.js 20 or newer is required. Install it from https://nodejs.org/
  exit /b 1
)
if not exist node_modules call npm.cmd ci || exit /b 1
call npm.cmd run build
if errorlevel 1 exit /b %errorlevel%
echo.
echo Built Spotamp in "%cd%\dist".
echo Open chrome://extensions or edge://extensions, enable Developer mode,
echo then use "Load unpacked" and select that dist folder.
endlocal

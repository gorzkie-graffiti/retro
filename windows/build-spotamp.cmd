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
call npm.cmd run build:firefox
if errorlevel 1 exit /b %errorlevel%
echo.
echo Built Spotamp in:
echo   "%cd%\dist"          ^(Chrome / Edge, Manifest V3^)
echo   "%cd%\dist-firefox"  ^(Firefox 113+, Manifest V2^)
echo.
echo Chromium: open chrome://extensions or edge://extensions, enable
echo Developer mode, then "Load unpacked" and select the dist folder.
echo Firefox: open about:debugging#/runtime/this-firefox, choose
echo "Load Temporary Add-on..." and select dist-firefox\manifest.json.
endlocal

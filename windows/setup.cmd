@echo off
setlocal
cd /d "%~dp0"

where npm.cmd >nul 2>nul || (
  echo Node.js 20 or newer is required. Install it from https://nodejs.org/
  exit /b 1
)

echo Installing Gemini Retro dependencies...
call npm.cmd --prefix ai_apps ci || exit /b 1

echo Installing Retro PKP dependencies...
call npm.cmd --prefix retro-pkp ci || exit /b 1

echo Installing Spotamp dependencies...
call npm.cmd --prefix spotamp ci || exit /b 1

echo Installing yt2009 dependencies...
call npm.cmd --prefix yt2009 install || exit /b 1

where py.exe >nul 2>nul && (
  echo Installing optional Gemini bridge dependency...
  py -3 -m pip install -r ai_apps\gemini-web2api\requirements.txt || exit /b 1
) || echo Python launcher not found: install Python 3 before using Retro PKP or the Gemini bridge.

echo.
echo Setup complete. Read README-WINDOWS.md for launch commands.
endlocal

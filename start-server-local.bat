@echo off
title OmniDeck Arena - Local Server
cd /d "%~dp0"

echo [1/2] Building project...
call npm run build
if errorlevel 1 (
  echo Build failed. Please check errors above.
  pause
  exit /b 1
)

echo [2/2] Starting server on http://localhost:3000 ...
call npm start

pause
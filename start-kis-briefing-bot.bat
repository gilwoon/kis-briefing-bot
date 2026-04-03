@echo off
setlocal
cd /d %~dp0

if not exist ".env.local" (
  echo .env.local file not found.
  echo Copy .env.example to .env.local and fill in KIS_APP_KEY and KIS_APP_SECRET first.
  exit /b 1
)

echo Starting KIS Briefing Bot on port 4173...
npm.cmd start

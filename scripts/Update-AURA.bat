@echo off
title AURA Command Center — Updater
color 0B

echo.
echo  =====================================================
echo    AURA Command Center — One-Click Update
echo  =====================================================
echo.

:: Change to project root (two levels up from scripts\)
cd /d "%~dp0.."

echo  [1/4] Pulling latest code from GitHub...
git pull
if errorlevel 1 (
    echo  [WARN] Git pull failed. Continuing with local code.
)
echo.

echo  [2/4] Installing / updating npm packages...
call npm install
if errorlevel 1 (
    echo  [ERROR] npm install failed. Aborting.
    pause & exit /b 1
)
echo.

echo  [3/4] Building AURA (takes 5-15 minutes)...
call npm run tauri:build
if errorlevel 1 (
    echo  [ERROR] Build failed. Check output above.
    pause & exit /b 1
)
echo.

echo  [4/4] Opening installer folder...
start "" "src-tauri\target\release\bundle\nsis\"

echo.
echo  =====================================================
echo    Build complete!
echo    Run the .exe installer in the folder that just
echo    opened. It will update the installed app in place.
echo  =====================================================
echo.
pause

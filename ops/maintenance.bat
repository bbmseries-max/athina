@echo off
:: ==============================================================
:: Athina Clinical Vault - Operations & Maintenance Launcher
:: ==============================================================
setlocal EnableDelayedExpansion
cd /d "D:\athina"

:MENU
cls
echo ============================================================
echo   ATHINA CLINICAL VAULT - MANAGEMENT CONSOLE
echo ============================================================
echo  1. Check Service Status (PM2)
echo  2. Start All Background Services
echo  3. Stop All Background Services
echo  4. Restart All Background Services
echo  5. Stream Live Logs (WhatsApp and Web)
echo  6. Open Database GUI (Prisma Studio)
echo  7. Run SQLite Schema Push / Migration
echo  8. Backup Database and Storage to D:\athina_backups
echo  9. Pull Git Updates and Rebuild Next.js
echo 10. Exit
echo ============================================================
set /p choice="Enter option [1-10]: "

if "%choice%"=="1" goto STATUS
if "%choice%"=="2" goto START
if "%choice%"=="3" goto STOP
if "%choice%"=="4" goto RESTART
if "%choice%"=="5" goto LOGS
if "%choice%"=="6" goto STUDIO
if "%choice%"=="7" goto MIGRATE
if "%choice%"=="8" goto BACKUP
if "%choice%"=="9" goto UPDATE
if "%choice%"=="10" goto END
goto MENU

:STATUS
cls
echo Checking running services...
call npx pm2 status
pause
goto MENU

:START
cls
echo Starting Athina ecosystem...
call npx pm2 start ecosystem.config.cjs
call npx pm2 save
pause
goto MENU

:STOP
cls
echo Stopping all services...
call npx pm2 stop all
pause
goto MENU

:RESTART
cls
echo Restarting Athina services...
call npx pm2 restart all
pause
goto MENU

:LOGS
cls
echo Streaming logs (Press Ctrl+C to exit)...
call npx pm2 logs
goto MENU

:STUDIO
cls
echo Launching Prisma Studio at http://localhost:5555 ...
echo (Keep this window open while inspecting records)
call npx prisma studio
goto MENU

:MIGRATE
cls
echo Syncing Prisma schema with local SQLite database...
call npx prisma db push
pause
goto MENU

:BACKUP
cls
set BACKUP_DIR=D:\athina_backups\%date:~-4,4%%date:~-7,2%%date:~-10,2%_%time:~0,2%%time:~3,2%
set BACKUP_DIR=%BACKUP_DIR: =0%
echo Creating backup at %BACKUP_DIR%...
mkdir "%BACKUP_DIR%\db" 2>nul
mkdir "%BACKUP_DIR%\storage" 2>nul

copy "D:\athina\prisma\dev.db" "%BACKUP_DIR%\db\dev.db" /Y
xcopy "D:\athina_storage\processed" "%BACKUP_DIR%\storage\processed" /E /I /Y /Q

echo Backup completed successfully.
pause
goto MENU

:UPDATE
cls
echo Pulling latest code changes...
git pull
echo Installing dependencies...
call npm install
echo Rebuilding Next.js application...
call npm run build
echo Restarting PM2 processes...
call npx pm2 restart all
echo Update completed successfully.
pause
goto MENU

:END
exit
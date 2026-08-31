@echo off
chcp 65001 >nul
echo.
echo  AGEO - Demarrage
echo  =================
echo.
cd /d "%~dp0server"
if not exist "node_modules" (
    echo ERREUR : Lancez d abord 1-installer.bat
    pause & exit /b 1
)
if not exist ".env" (
    echo ERREUR : Copiez .env.example en .env et remplissez-le.
    pause & exit /b 1
)
echo  Application disponible sur http://localhost:3001
echo  Ctrl+C pour arreter.
echo.
where node >nul 2>&1
if %errorlevel% == 0 (
    node index.js
    goto end
)
if exist "C:\Program Files\nodejs\node.exe" (
    "C:\Program Files\nodejs\node.exe" index.js
    goto end
)
echo ERREUR : Node.js introuvable.
:end
pause
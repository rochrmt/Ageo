@echo off
chcp 65001 >nul
echo.
echo  AGEO - Installation
echo  ====================
echo.
cd /d "%~dp0server"
if not exist "package.json" (
    echo ERREUR : package.json introuvable dans server\
    pause & exit /b 1
)
echo  Installation des dependances...
echo.
where npm >nul 2>&1
if %errorlevel% == 0 (
    npm install
    goto done
)
if exist "C:\Program Files\nodejs\npm.cmd" (
    "C:\Program Files\nodejs\npm.cmd" install
    goto done
)
echo ERREUR : Node.js introuvable. Installez-le depuis https://nodejs.org
pause & exit /b 1
:done
echo.
echo  Termine. Editez server\.env avant de demarrer.
echo.
pause
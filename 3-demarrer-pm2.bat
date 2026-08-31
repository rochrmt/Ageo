@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion
echo.
echo  AGEO - Demarrage production
echo  ============================
echo.

:: Verifier que node_modules existe
if not exist "%~dp0server\node_modules" (
    echo  ERREUR : Lancez d abord 1-installer.bat
    pause
    exit /b 1
)

:: Demarrer AGEO maintenant via PM2
echo  Demarrage de AGEO...
cd /d "%~dp0server"
where pm2 >nul 2>&1
if not %errorlevel% == 0 (
    echo  Installation de PM2...
    npm install -g pm2
)
pm2 delete ageo >nul 2>&1
pm2 start index.js --name ageo
echo.

:: Creer le fichier VBS de demarrage silencieux
echo  Creation du demarrage automatique silencieux...
set VBS_PATH=%~dp0start-ageo.vbs
set SCRIPT=%~dp0server\index.js

(
echo Set ws = CreateObject^("WScript.Shell"^)
echo ws.Run """C:\Program Files\nodejs\node.exe"" ""%SCRIPT%""", 0, False
) > "%VBS_PATH%"

:: Ajouter au registre (demarrage a la connexion utilisateur)
reg add "HKCU\SOFTWARE\Microsoft\Windows\CurrentVersion\Run" /v "AGEO" /t REG_SZ /d "wscript.exe \"%VBS_PATH%\"" /f

if %errorlevel% == 0 (
    echo  OK : AGEO demarrera automatiquement a la prochaine connexion.
    echo.
    echo  Verification registre :
    reg query "HKCU\SOFTWARE\Microsoft\Windows\CurrentVersion\Run" /v "AGEO"
) else (
    echo  ECHEC : relancez en clic-droit : Executer en tant qu administrateur.
)

echo.
echo  Commandes PM2 utiles :
echo    pm2 status       - etat
echo    pm2 logs ageo    - logs en direct
echo    pm2 restart ageo - redemarrer
echo.
pause

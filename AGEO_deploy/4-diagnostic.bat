@echo off
chcp 65001 >nul
echo.
echo  AGEO - Diagnostic
echo  ==================
echo.

echo [1] Tache planifiee AGEO :
echo -------------------------------------------------------
schtasks /query /tn "AGEO" /fo LIST /v 2>nul
if %errorlevel% neq 0 (
    echo  ERREUR : La tache planifiee AGEO n existe pas !
    echo  Relancez 3-demarrer-pm2.bat en tant qu administrateur.
)
echo.

echo [2] Processus node.exe en cours :
echo -------------------------------------------------------
tasklist /fi "imagename eq node.exe" 2>nul
echo.

echo [3] Port 3001 en ecoute :
echo -------------------------------------------------------
netstat -an 2>nul | findstr ":3001"
if %errorlevel% neq 0 echo  Aucun processus n ecoute sur le port 3001 - AGEO n est pas demarre.
echo.

echo [4] Test : demarrage manuel de la tache planifiee...
echo -------------------------------------------------------
schtasks /run /tn "AGEO" 2>nul
if %errorlevel% neq 0 (
    echo  ERREUR : Impossible de demarrer la tache.
    goto :fin
)
echo  Tache lancee, attente 10 secondes...
timeout /t 10 /nobreak >nul

echo.
echo [5] Processus node.exe apres demarrage :
echo -------------------------------------------------------
tasklist /fi "imagename eq node.exe" 2>nul
echo.

echo [6] Port 3001 apres demarrage :
echo -------------------------------------------------------
netstat -an 2>nul | findstr ":3001"
if %errorlevel% == 0 (
    echo  OK : AGEO est demarre et ecoute sur le port 3001.
    echo  Ouvrez http://localhost:3001 dans le navigateur.
) else (
    echo  AGEO ne repond pas sur le port 3001.
    echo  Verifiez les logs : pm2 logs ageo
)

:fin
echo.
pause

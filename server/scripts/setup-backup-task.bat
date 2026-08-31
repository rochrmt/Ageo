@echo off
REM ============================================================
REM  Planification de la sauvegarde automatique de la base ageo
REM  Execute ce script en tant qu'administrateur
REM ============================================================

REM Chemin du script Node.js
set JS_SCRIPT=%~dp0backup-db.js

REM Chemin de Node.js (adapte si besoin)
set NODE_EXE=node

REM Nom de la tache planifiee
set TASK_NAME=AGEO_Backup_DB

REM Supprimer l'ancienne tache si elle existe
schtasks /query /tn "%TASK_NAME%" >nul 2>&1
if %errorlevel%==0 (
    schtasks /delete /tn "%TASK_NAME%" /f
    echo Ancienne tache supprimee.
)

REM Creer la tache : sauvegarde tous les jours a 02:00
schtasks /create /tn "%TASK_NAME%" /tr "%NODE_EXE% \"%JS_SCRIPT%\"" /sc daily /st 02:00 /rl highest /f

if %errorlevel%==0 (
    echo.
    echo Tache planifiee creee avec succes !
    echo Nom        : %TASK_NAME%
    echo Frequence  : Tous les jours a 02:00
    echo Script     : %JS_SCRIPT%
    echo.
    echo Pour lancer une sauvegarde test maintenant :
    echo   node "%JS_SCRIPT%"
    echo.
    echo Pour voir la tache :
    echo   schtasks /query /tn "%TASK_NAME%"
    echo.
    echo Pour supprimer la tache :
    echo   schtasks /delete /tn "%TASK_NAME%" /f
) else (
    echo ERREUR : impossible de creer la tache planifiee.
    echo Execute ce script en tant qu'administrateur.
)

pause

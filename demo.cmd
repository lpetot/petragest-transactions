@echo off
rem ==========================================================================
rem  DEMONSTRATION : site vitrine Petra Gest + espace transaction (un seul lien)
rem  Double-cliquer ce fichier. Le navigateur s'ouvre sur http://localhost:3000
rem  Arreter : fermer cette fenetre (ou Ctrl + C).
rem
rem  Le projet est copie hors de OneDrive, dans %LOCALAPPDATA%\petragest-transactions,
rem  pour que les modules et la base de demonstration ne soient jamais synchronises.
rem  Le site vitrine est lu dans ..\creations\petra-gest-site, sans jamais etre modifie.
rem ==========================================================================
setlocal
title Petra Gest - demonstration
set "SOURCE=%~dp0."
set "VITRINE=%~dp0..\creations\petra-gest-site"
set "DEST=%LOCALAPPDATA%\petragest-transactions"
set "OUVRIR=--ouvrir"
if defined PETRA_SANS_NAVIGATEUR set "OUVRIR="

where node >nul 2>nul
if errorlevel 1 goto pas_de_node

echo.
echo  Preparation de la demonstration...
robocopy "%SOURCE%" "%DEST%" /E /XD node_modules .local .git livraison sauvegardes /XF .env.local /NFL /NDL /NJH /NJS /NP >nul
if errorlevel 8 goto copie_impossible

cd /d "%DEST%"
if exist "node_modules\@electric-sql\pglite" goto lancer
echo  Premiere fois sur ce poste : installation des modules (environ une minute, Internet necessaire)...
call npm install --no-audit --no-fund
if errorlevel 1 goto installation_impossible

:lancer
if not exist "%VITRINE%\index.html" goto sans_vitrine
node scripts\dev.js --vitrine "%VITRINE%" %OUVRIR%
goto fin

:sans_vitrine
echo  Site vitrine introuvable a cote de ce dossier : seul l'espace transaction est lance.
node scripts\dev.js --sans-vitrine %OUVRIR%
goto fin

:pas_de_node
echo.
echo  Node.js est introuvable sur ce poste.
echo  Installez la version LTS depuis https://nodejs.org puis relancez ce fichier.
goto fin

:copie_impossible
echo.
echo  Copie impossible vers %DEST%.
goto fin

:installation_impossible
echo.
echo  Installation des modules impossible (connexion Internet ?).
goto fin

:fin
echo.
pause

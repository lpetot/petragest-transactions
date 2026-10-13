@echo off
rem ==========================================================================
rem  Remet la demonstration a neuf : efface les annonces, codes et photos ajoutes
rem  pendant les essais. Les donnees de demonstration sont recreees au prochain
rem  lancement de demo.cmd. A faire juste avant de montrer le site a un client.
rem  Fermez d'abord la fenetre de demo.cmd si elle est ouverte.
rem ==========================================================================
setlocal
set "DEST=%LOCALAPPDATA%\petragest-transactions"
if not exist "%DEST%\.local" goto rien
rmdir /s /q "%DEST%\.local"
if exist "%DEST%\.local" goto occupe
echo.
echo  Demonstration remise a neuf. Relancez demo.cmd.
goto fin

:rien
echo.
echo  Rien a effacer : la demonstration est deja neuve.
goto fin

:occupe
echo.
echo  Impossible d'effacer : fermez d'abord la fenetre de demo.cmd, puis recommencez.

:fin
echo.
pause

@echo off
chcp 65001 >nul
REM ============================================================
REM  DEPLOY TRE-GO · gerado automaticamente — NAO editar
REM  Pipe nativo CMD: type arquivo.sh | plink.exe "bash -s"
REM ============================================================
setlocal
set "PL=C:\Program Files\PuTTY\plink.exe"
set "ROOT=c:\Users\mario.junior\OneDrive - Sicoob Juriscred\1.Projetos\33.Portal Administrativo\Portal-Administrativo"
set "SH=%ROOT%\deploy_tre_go_producao_172.30.0.9.sh"
set "TS=%~1"
set "OUT=%ROOT%\deploy_final_%TS%.out.log"
set "ERR=%ROOT%\deploy_final_%TS%.err.log"
set "DONE=%ROOT%\deploy_final_%TS%.done.txt"
set "PW=%~2"

echo [%date% %time%] DEPLOY CMD lancado. TS=%TS%      > "%OUT%"
echo [%date% %time%] PLINK=%PL%                       >> "%OUT%"
echo [%date% %time%] SH=%SH%                          >> "%OUT%"
echo.                                                  >> "%OUT%"

if not exist "%PL%"  ( echo ERRO plink nao existe "%PL%"  > "%ERR%" & echo 98 > "%DONE%" & exit /b 98 )
if not exist "%SH%"  ( echo ERRO sh nao existe "%SH%"     > "%ERR%" & echo 97 > "%DONE%" & exit /b 97 )

echo.
echo === DEPLOY EM ANDAMENTO ===
echo Log stdout: "%OUT%"
echo Log stderr: "%ERR%"
echo Aguardar termino (20-30 min).
echo.

REM --------------------------------------------------------------
REM EXECUCAO PRINCIPAL: pipe TODO o bash sh para o plink remoto
REM --------------------------------------------------------------
"%PL%" -batch -no-antispoof -hostkey * -ssh -l juriscred -pw "%PW%" 172.30.0.9 "bash -s" 1>>"%OUT%" 2>>"%ERR%" < "%SH%"
set EC=%ERRORLEVEL%

echo. >> "%OUT%"
echo ======================================== >> "%OUT%"
echo [%date% %time%] DEPLOY FINALIZADO. PLINK EXIT CODE = %EC% >> "%OUT%"
echo ======================================== >> "%OUT%"
echo %EC% > "%DONE%"
endlocal & exit /b %EC%

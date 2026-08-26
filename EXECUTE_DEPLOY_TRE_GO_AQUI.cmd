@echo off
REM ============================================================
REM DEPLOY TRE-GO PRODUCAO 172.30.0.9 · DUPLO CLIQUE AQUI
REM ============================================================
chcp 65001 >nul
title DEPLOY TRE-GO · 172.30.0.9
cd /d "%~dp0"
echo.
echo ============================================================
echo    DEPLOY TRE-GO ^| Producao 172.30.0.9 ^| user: juriscred
echo ============================================================
echo.
echo Scripts localizados em:  %~dp0
echo   - deploy_tre_go_producao_172.30.0.9.sh   (bash remoto — 5 passos)
echo   - deploy_tre_go_producao_172.30.0.9.ps1  (orquestrador)
echo.
echo ------------------------------------------------------------
echo PASSO-A-PASSO:
echo   (1) Ira aparecer o prompt:  juriscred@172.30.0.9's password:
echo   (2) Digite a SENHA do usuario juriscred e pressione ENTER
echo       ^(A senha NAO aparece enquanto voce digita — normal SSH^)
echo   (3) Aguarde. O deploy roda 5 blocos automaticos:
echo       1/5 Backup previo SQLite obrigatorio em /tmp/
echo       2/5 git pull origin main (hash 76df3b9 esperado)
echo       3/5 npm ci + build backend + frontend
echo       4/5 PM2 restart portal-administrativo-backend id=8
echo       5/5 Validacao HTTP final + RESUMO
echo.
echo   ROLLBACK (qualquer momento): cp /tmp/consignado.sqlite.pre-tre-deploy_*.sqlite /var/www/html/Portal-Administrativo/backend/data/consignado.sqlite ^&^& pm2 restart 8
echo ------------------------------------------------------------
echo.
echo Pressione QUALQUER TECLA para abrir a conexao SSH e comecar...
pause >nul
echo.

where pwsh.exe >nul 2>nul
if %ERRORLEVEL%==0 (
  echo Usando pwsh.exe (PowerShell Core)...
  pwsh.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0deploy_tre_go_producao_172.30.0.9.ps1"
  goto :end
)
echo Usando powershell.exe (Windows PowerShell 5)...
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0deploy_tre_go_producao_172.30.0.9.ps1"

:end
echo.
echo.
if %ERRORLEVEL%==0 (
  echo [SUCESSO] Deploy TRE-GO finalizado com codigo 0.
) else (
  echo [AVISO] Deploy finalizou com codigo %ERRORLEVEL%. Verificar linhas acima.
)
echo.
pause

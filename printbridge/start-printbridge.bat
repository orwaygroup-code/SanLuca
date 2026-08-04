@echo off
REM ============================================================
REM  PrintBridge SanLuca - arranque con reinicio automatico.
REM  Corre "node index.js" y, si se cae, lo vuelve a levantar
REM  solo tras 5 segundos. No cierres esta ventana.
REM  (Normalmente lo lanza run-hidden.vbs, sin ventana visible.)
REM ============================================================
title PrintBridge SanLuca
cd /d "%~dp0"

:loop
node index.js
echo.
echo [%date% %time%] PrintBridge se detuvo. Reiniciando en 5s... (Ctrl+C para salir)
timeout /t 5 /nobreak >nul
goto loop

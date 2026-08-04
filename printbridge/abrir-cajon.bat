@echo off
REM Prueba manual del cajon: doble clic para abrirlo.
REM Si no abre, ejecuta desde una consola:  abrir-cajon.bat 5
cd /d "%~dp0"
node abrir-cajon.js %1
echo.
pause

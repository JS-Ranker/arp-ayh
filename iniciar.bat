@echo off
cd /d "%~dp0"
if not exist node_modules (
  echo Instalando dependencias, esto puede tardar un par de minutos la primera vez...
  call npm install
)
echo.
echo Iniciando ERP AYH en una ventana aparte...
echo NO cierres esa ventana mientras uses el sistema.
echo.
start "ERP AYH - servidor (no cerrar)" cmd /k npm start
timeout /t 3 /nobreak >nul
start "" http://localhost:3000
